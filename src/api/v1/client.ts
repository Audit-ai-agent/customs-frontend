import {
  ContractError,
  decodeAuthConfig,
  decodeCaseSummary,
  decodeDocumentListItem,
  decodeDocumentView,
  decodeJob,
  decodeProblem,
  decodeReviewerDecision,
  decodeReviewRun,
  decodeReviewRunSummary,
  decodeSession,
} from "./decoders";
import type {
  AddDocumentRequest,
  AuthConfig,
  CaseDetail,
  CaseDocument,
  CaseSummary,
  CreateCaseRequest,
  EnqueueReviewRequest,
  FindingDecisionRequest,
  JobRecord,
  ReviewerDecision,
  ReviewRun,
  ReviewRunSummary,
  Session,
} from "./types";
import type { LocalDevelopmentSessionResponse } from "../../auth";
import { stableApiErrorMessage, technicalApiErrorDetail } from "../user-facing-errors";

const API_BASE = "/api/v1" as const;
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

type Decoder<T> = (value: unknown) => T;
type AccessTokenProvider = () => string | undefined | Promise<string | undefined>;

export interface CaseList {
  items: CaseSummary[];
}

/**
 * A deliberately small Browser client for the only team-facing public
 * boundary: Backend API v1.  It never calls Agent, Data, Docker, or an
 * external provider directly; Backend owns those service-to-service edges.
 */
export class ApiClient {
  private session: Session | undefined;
  private readonly fetcher: typeof fetch;

  constructor(
    fetcher: typeof fetch = globalThis.fetch,
    private readonly accessToken?: AccessTokenProvider,
  ) {
    this.fetcher = fetcher.bind(globalThis);
  }

  getAuthConfig(): Promise<AuthConfig> {
    return this.request("/auth/config", { method: "GET" }, decodeAuthConfig, false);
  }

  createLocalDevelopmentSession(): Promise<LocalDevelopmentSessionResponse> {
    return this.request("/dev/session", { method: "POST" }, decodeLocalDevelopmentSession, false);
  }

  async getSession(): Promise<Session> {
    const session = await this.request("/session", { method: "GET" }, decodeSession);
    this.session = session;
    return session;
  }

  listCases(): Promise<CaseList> {
    return this.request("/cases", { method: "GET" }, (value) => {
      const items = itemsFrom(value, "Case list").map(decodeCaseSummary);
      items.forEach((item, index) => this.assertOrg(item.org_id, `cases[${index}]`));
      return { items };
    });
  }

  createCase(payload: CreateCaseRequest): Promise<CaseDetail> {
    return this.request("/cases", this.json("POST", payload), (value) => {
      const item = decodeCaseSummary(value);
      this.assertOrg(item.org_id, "created Case");
      return item;
    });
  }

  getCase(caseId: string): Promise<CaseDetail> {
    return this.request(`/cases/${segment(caseId)}`, { method: "GET" }, (value) => {
      const item = decodeCaseSummary(value);
      this.assertIdentity(item.case_id, caseId, "Case");
      this.assertOrg(item.org_id, "Case");
      return item;
    });
  }

  listDocuments(caseId: string): Promise<CaseDocument[]> {
    return this.request(`/cases/${segment(caseId)}/documents`, { method: "GET" }, (value) => {
      const documents = itemsFrom(value, "Document list").map(decodeDocumentListItem);
      documents.forEach((item) => this.assertIdentity(item.case_id, caseId, "Document Case"));
      return documents;
    });
  }

  addDocument(caseId: string, payload: AddDocumentRequest): Promise<CaseDocument> {
    return this.request(`/cases/${segment(caseId)}/documents`, this.json("POST", payload), (value) => {
      const item = decodeDocumentView(value);
      this.assertIdentity(item.record.case_id, caseId, "Document Case");
      return item.record;
    });
  }

  getDocumentContent(caseId: string, documentId: string): Promise<CaseDocument & { content_text: string }> {
    return this.request(
      `/cases/${segment(caseId)}/documents/${segment(documentId)}/content`,
      { method: "GET" },
      (value) => {
        const item = decodeDocumentView(value);
        this.assertIdentity(item.record.case_id, caseId, "Document Case");
        this.assertIdentity(item.record.document_id, documentId, "Document");
        return { ...item.record, content_text: item.content_text };
      },
    );
  }

  listReviewRuns(caseId: string): Promise<ReviewRunSummary[]> {
    return this.request(`/cases/${segment(caseId)}/review-runs`, { method: "GET" }, (value) => {
      const runs = itemsFrom(value, "Review run list").map(decodeReviewRunSummary);
      runs.forEach((item, index) => {
        this.assertIdentity(item.case_id, caseId, "reviewRuns[" + index + "] Case");
      });
      return runs;
    });
  }

  getReviewRun(runId: string): Promise<ReviewRun> {
    return this.request(`/review-runs/${segment(runId)}`, { method: "GET" }, (value) => {
      const item = decodeReviewRun(value);
      this.assertIdentity(item.review_run_id, runId, "Review run");
      this.assertOrg(item.org_id, "Review run");
      return item;
    });
  }

  enqueueReview(caseId: string, payload: EnqueueReviewRequest, idempotencyKey: string): Promise<JobRecord> {
    if (!isSafeIdempotencyKey(idempotencyKey)) {
      throw new ContractError("review Idempotency-Key is invalid");
    }
    if (payload.trade_type !== undefined && payload.trade_type !== "import" && payload.trade_type !== "export") {
      throw new ContractError("review trade type is invalid");
    }
    if (payload.review_as_of !== undefined && !isIsoDate(payload.review_as_of)) {
      throw new ContractError("review date must be an ISO calendar date");
    }
    const canonicalPayload: EnqueueReviewRequest = {
      ...(payload.trade_type === undefined ? {} : { trade_type: payload.trade_type }),
      ...(payload.review_as_of === undefined ? {} : { review_as_of: payload.review_as_of }),
    };
    const init = this.json("POST", canonicalPayload);
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", idempotencyKey);
    return this.request(`/cases/${segment(caseId)}/reviews`, { ...init, headers }, (value) => {
      const job = decodeJobEnvelope(value);
      this.assertIdentity(job.case_id, caseId, "Review Job Case");
      return job;
    });
  }

  async getJob(jobId: string): Promise<JobRecord> {
    const job = await this.request(`/jobs/${segment(jobId)}`, { method: "GET" }, decodeJobEnvelope);
    this.assertIdentity(job.job_id, jobId, "Job");
    return job;
  }

  setFindingDecision(
    reviewRunId: string,
    findingId: string,
    payload: FindingDecisionRequest,
  ): Promise<ReviewerDecision> {
    if (!payload.reason.trim() || payload.reason.length > 4_000) {
      throw new ContractError("reviewer decision reason is invalid");
    }
    if (!(["confirmed", "needs_information", "resolved"] as const).includes(payload.status)) {
      throw new ContractError("reviewer decision status is invalid");
    }
    return this.request(
      `/review-runs/${segment(reviewRunId)}/findings/${segment(findingId)}/decision`,
      this.json("PUT", { status: payload.status, reason: payload.reason.trim() }),
      (value) => {
        const decision = decodeReviewerDecision(value);
        this.assertIdentity(decision.finding_id, findingId, "Reviewer decision finding");
        return decision;
      },
    );
  }

  private json(method: "POST" | "PUT", payload: object): RequestInit {
    return {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    };
  }

  private async request<T>(
    path: string,
    init: RequestInit,
    decoder: Decoder<T>,
    authenticate = true,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (authenticate) {
      const token = await this.accessToken?.();
      if (!token) throw new ApiError("browser token is absent", 401);
      headers.set("Authorization", `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await this.fetcher(`${API_BASE}${path}`, {
        ...init,
        headers,
        credentials: "same-origin",
        redirect: "error",
        referrerPolicy: "same-origin",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new ApiError("Backend request failed before a response", 503);
    }

    const body = await readJson(response);
    if (!response.ok) {
      const problem = decodeProblem(body, response.status);
      throw new ApiError(problem.detail, problem.status, problem.code, problem.request_id);
    }
    return decoder(body);
  }

  private assertIdentity(actual: string, expected: string, label: string): void {
    if (actual !== expected) throw new ContractError(label + " does not match the requested identifier");
  }

  private assertOrg(orgId: string, label: string): void {
    if (this.session !== undefined && orgId !== this.session.org_id) {
      throw new ContractError(label + " belongs to a different organization");
    }
  }
}

export class ApiError extends Error {
  readonly technicalDetail: string;

  constructor(
    detail: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(stableApiErrorMessage(status, code));
    this.name = "ApiError";
    this.technicalDetail = technicalApiErrorDetail({
      detail,
      status,
      ...(code === undefined ? {} : { code }),
      ...(requestId === undefined ? {} : { requestId }),
    });
  }
}

function decodeLocalDevelopmentSession(value: unknown): LocalDevelopmentSessionResponse {
  const raw = object(value, "development session");
  const session = object(raw.session, "development session.session");
  const token = string(raw.access_token, "development session.access_token");
  const expiresIn = integer(raw.expires_in, "development session.expires_in");
  const roles = array(session.roles, "development session.session.roles")
    .map((item, index) => string(item, "development session.session.roles[" + index + "]"));
  if (raw.token_type !== undefined && raw.token_type !== "Bearer") {
    throw new ContractError("development session token type is unsupported");
  }
  return {
    access_token: token,
    token_type: "Bearer",
    expires_in: expiresIn,
    session: {
      subject: string(session.subject, "development session.session.subject"),
      org_id: string(session.org_id, "development session.session.org_id"),
      roles,
    },
  };
}

function decodeJobEnvelope(value: unknown): JobRecord {
  const raw = object(value, "job response");
  return decodeJob(raw.job === undefined ? raw : raw.job);
}

function itemsFrom(value: unknown, label: string): unknown[] {
  if (Array.isArray(value)) return value;
  const raw = object(value, label);
  return array(raw.items, label + ".items");
}

async function readJson(response: Response): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) > MAX_JSON_BODY_BYTES) {
    throw new ContractError("Backend response exceeds the safe size limit");
  }
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ContractError("Backend response exceeds the safe size limit");
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json") && !contentType.includes("+json")) {
    throw new ContractError("Backend response must be JSON");
  }
  if (!text) throw new ContractError("Backend JSON response is empty");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ContractError("Backend response contains invalid JSON");
  }
}

function segment(value: string): string {
  if (!value || value.length > 256 || /[\r\n\0]/u.test(value)) {
    throw new ContractError("path identifier is invalid");
  }
  return encodeURIComponent(value);
}

function isSafeIdempotencyKey(value: string): boolean {
  return value.length >= 8 && value.length <= 128 && /^[A-Za-z0-9._:-]+$/u.test(value);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContractError(label + ": object expected");
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new ContractError(label + ": array expected");
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4_096 || /[\r\n\0]/u.test(value)) {
    throw new ContractError(label + ": safe string expected");
  }
  return value;
}

function integer(value: unknown, label: string): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 1 || value > 8 * 60 * 60) {
    throw new ContractError(label + ": bounded integer expected");
  }
  return value;
}
