import { sha256 } from "@noble/hashes/sha2.js";
import {
  ContractError,
  decodeChatRecord,
  decodeCorrectionProposal,
  decodeCorrectionProposalDecision,
  decodeHumanDecision,
  decodeJob,
  decodeAuditEvent,
  decodeAuthConfig,
  decodeCaseDetail,
  decodeCaseSummary,
  decodeGroundedAnswer,
  decodePaged,
  decodeProblem,
  decodePublicDocument,
  decodeReviewRun,
  decodeRunSummary,
  decodeSession,
  decodeStageEvent,
  decodeSupportingDocument,
  MAX_SUPPORTING_DOCUMENTS,
} from "./decoders";
import type {
  AddDocumentRequest,
  AnswerRequest,
  AuditEvent,
  AuthConfig,
  CaseDetail,
  CaseDocument,
  CaseSummary,
  ChatRecord,
  CorrectionProposal,
  CorrectionProposalDecisionCreate,
  CorrectionProposalDecisionResponse,
  CreateCaseRequest,
  DeliveryReconciliationCreate,
  EnqueueReviewRequest,
  GroundedAnswer,
  HumanDecisionRecord,
  JobRecord,
  Paged,
  ReviewRun,
  ReviewStageEvent,
  RevisionProposalCreate,
  RunSummary,
  Session,
  SupportingDocumentCreate,
  SupportingDocumentRecord,
  VerificationAssertionCreate,
} from "./types";

const API_BASE = "/api/v1" as const;
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const SSE_CONNECTION_TIMEOUT_MS = 5 * 60_000;
const MAX_PRIMARY_DOCUMENTS = 6;
const MAX_TOTAL_DOCUMENT_RECORDS = MAX_PRIMARY_DOCUMENTS + MAX_SUPPORTING_DOCUMENTS;
const MAX_PRIMARY_TEXT_CHARACTERS = 500_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Decoder<T> = (value: unknown) => T;

export class ApiClient {
  private session: Session | undefined;

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly accessToken: () => string | undefined = () => undefined,
  ) {}

  getAuthConfig(): Promise<AuthConfig> {
    return this.request("/auth/config", { method: "GET" }, decodeAuthConfig, false);
  }

  async getSession(): Promise<Session> {
    const session = await this.request("/session", { method: "GET" }, decodeSession);
    this.session = session;
    return session;
  }

  listCases(): Promise<Paged<CaseSummary>> {
    return this.request("/cases", { method: "GET" }, (value) => {
      const page = pageOrArray(value, decodeCaseSummary);
      page.items.forEach((item, index) => this.assertOrg(item.org_id, `cases[${index}]`));
      return page;
    });
  }

  createCase(payload: CreateCaseRequest): Promise<CaseDetail> {
    return this.request("/cases", this.json("POST", payload), (value) => {
      const item = decodeCaseDetail(value);
      this.assertOrg(item.org_id, "created Case");
      return item;
    });
  }

  getCase(caseId: string): Promise<CaseDetail> {
    return this.request(`/cases/${segment(caseId)}`, { method: "GET" }, (value) => {
      const item = decodeCaseDetail(value);
      this.assertIdentity(item.case_id, caseId, "Case");
      this.assertOrg(item.org_id, "Case");
      return item;
    });
  }

  listDocuments(caseId: string): Promise<CaseDocument[]> {
    return this.request(`/cases/${segment(caseId)}/documents`, { method: "GET" }, (value) => {
      const items = boundedArrayPayload(value, MAX_TOTAL_DOCUMENT_RECORDS, "Document list")
        .map((item, index) => decodeDocumentView(item, `documents[${index}]`));
      this.assertEvery(items, (item) => item.case_id === caseId, "Document list contains another Case");
      const primary = items.filter((item) => item.document_type !== "SUPPORTING");
      const supporting = items.filter((item) => item.document_type === "SUPPORTING");
      const primaryCharacters = primary.reduce((total, item) => total + item.character_count, 0);
      if (
        primary.length > MAX_PRIMARY_DOCUMENTS
        || supporting.length > MAX_SUPPORTING_DOCUMENTS
        || primaryCharacters > MAX_PRIMARY_TEXT_CHARACTERS
      ) {
        throw new ContractError("Document list exceeds the text-first aggregate limits");
      }
      return items;
    });
  }

  getDocumentContent(caseId: string, documentId: string): Promise<CaseDocument> {
    return this.request(
      `/cases/${segment(caseId)}/documents/${segment(documentId)}/content`,
      { method: "GET" },
      (value) => {
        const item = decodeDocumentView(value, "documentContent", true);
        this.assertIdentity(item.case_id, caseId, "Document content Case");
        this.assertIdentity(item.document_id, documentId, "Document content");
        return item;
      },
    );
  }

  addDocument(caseId: string, payload: AddDocumentRequest): Promise<CaseDocument> {
    return this.request(`/cases/${segment(caseId)}/documents`, this.json("POST", payload), (value) => {
      const item = decodeDocumentView(value, "createdDocument");
      this.assertIdentity(item.case_id, caseId, "Document Case");
      return item;
    });
  }

  listSupportingDocuments(caseId: string): Promise<SupportingDocumentRecord[]> {
    return this.request(`/cases/${segment(caseId)}/supporting-documents`, { method: "GET" }, (value) => {
      const items = boundedArrayPayload(value, MAX_SUPPORTING_DOCUMENTS, "Supporting-document list")
        .map(decodeSupportingDocument);
      this.assertEvery(items, (item) => item.case_id === caseId, "Supporting-document list contains another Case");
      items.forEach((item, index) => this.assertOrg(item.org_id, `supportingDocuments[${index}]`));
      return items;
    });
  }

  addSupportingDocument(caseId: string, payload: SupportingDocumentCreate): Promise<SupportingDocumentRecord> {
    return this.request(`/cases/${segment(caseId)}/supporting-documents`, this.json("POST", payload), (value) => {
      const item = decodeSupportingDocument(value);
      this.assertIdentity(item.case_id, caseId, "Supporting document Case");
      this.assertIdentity(item.document_id, payload.document_id, "Supporting document");
      this.assertOrg(item.org_id, "Supporting document");
      return item;
    });
  }

  addSupportingAssertion(
    caseId: string,
    supportingDocumentId: string,
    payload: VerificationAssertionCreate,
  ): Promise<SupportingDocumentRecord> {
    if (
      payload.method !== "human_approver"
      || Object.keys(payload as object).some((key) => key !== "method")
    ) {
      throw new ContractError(
        "Supporting assertion authority and source fields must be derived by Backend",
      );
    }
    return this.request(
      `/cases/${segment(caseId)}/supporting-documents/${segment(supportingDocumentId)}/assertions`,
      this.json("POST", { method: "human_approver" }),
      (value) => {
        const item = decodeSupportingDocument(value);
        this.assertIdentity(item.case_id, caseId, "Supporting assertion Case");
        this.assertIdentity(item.document_id, supportingDocumentId, "Supporting assertion document");
        this.assertOrg(item.org_id, "Supporting assertion");
        return item;
      },
    );
  }

  enqueueReview(caseId: string, payload: EnqueueReviewRequest, idempotencyKey: string): Promise<JobRecord> {
    if (this.session === undefined) {
      throw new ContractError("Review enqueue binding requires an authenticated session");
    }
    if (
      !Array.isArray(payload.submitted_document_codes)
      || payload.submitted_document_codes.length !== 0
    ) {
      throw new ContractError(
        "Requirement-document codes must come from persisted supporting documents",
      );
    }
    const allowedKeys = new Set(["review_as_of", "trade_type", "submitted_document_codes"]);
    if (Object.keys(payload as object).some((key) => !allowedKeys.has(key))) {
      throw new ContractError("Review enqueue contains an unsupported field");
    }
    const canonicalPayload: EnqueueReviewRequest = {
      trade_type: payload.trade_type,
      submitted_document_codes: [],
      ...(payload.review_as_of === undefined ? {} : { review_as_of: payload.review_as_of }),
    };
    const init = this.json("POST", canonicalPayload);
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", idempotencyKey);
    return this.request(`/cases/${segment(caseId)}/reviews`, { ...init, headers }, (value) => {
      const job = decodeJobResponse(value);
      this.assertIdentity(job.case_id, caseId, "Review Job Case");
      if (job.kind !== "review" || (job.parent_run_id !== undefined && job.parent_run_id !== null)) {
        throw new ContractError("Review enqueue must return a root review Job");
      }
      this.assertActor(job.created_by, "Review Job creator");
      return job;
    });
  }

  async getJob(jobId: string): Promise<JobRecord> {
    const job = await this.request(`/jobs/${segment(jobId)}`, { method: "GET" }, decodeJob);
    if (job.job_id !== jobId) {
      throw new ContractError("Backend Job response does not match the requested Job ID");
    }
    return job;
  }

  async reconcileDeliveryUncertain(
    jobId: string,
    payload: DeliveryReconciliationCreate,
  ): Promise<JobRecord> {
    const job = await this.request(
      `/jobs/${segment(jobId)}/reconciliation`,
      this.json("POST", payload),
      decodeJob,
    );
    if (job.job_id !== jobId) {
      throw new ContractError("Backend reconciliation response does not match the requested Job ID");
    }
    if (job.status !== "failed" || job.agent_call_state !== "delivery_reconciled") {
      throw new ContractError("Backend reconciliation did not return the required terminal state");
    }
    return job;
  }

  listJobEvents(jobId: string): Promise<ReviewStageEvent[]> {
    return this.request(`/jobs/${segment(jobId)}/events`, { method: "GET" }, (value) => {
      const events = arrayPayload(value).map(decodeStageEvent);
      validateEventSequence(events, jobId);
      return events;
    });
  }

  async streamJobEvents(
    jobId: string,
    onEvent: (event: ReviewStageEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const url = `${API_BASE}/jobs/${segment(jobId)}/events/stream`;
    const headers = new Headers({ Accept: "text/event-stream" });
    const token = this.accessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const boundedSignal = AbortSignal.any([signal, AbortSignal.timeout(SSE_CONNECTION_TIMEOUT_MS)]);
    const response = await this.fetcher(url, {
      method: "GET",
      headers,
      credentials: "same-origin",
      redirect: "error",
      referrerPolicy: "same-origin",
      signal: boundedSignal,
    });
    if (!response.ok) {
      const contentType = response.headers.get("content-type") ?? "";
      const responseText = await readLimitedResponseText(response, MAX_JSON_BODY_BYTES);
      const value: unknown = contentType.includes("application/json") && responseText
        ? parseJson(responseText, false)
        : null;
      const problem = decodeProblem(value, response.status);
      throw new ApiError(problem.detail, problem.status, problem.code, problem.request_id);
    }
    const responseType = (response.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase();
    if (responseType !== "text/event-stream") {
      await response.body?.cancel("Backend SSE response has an invalid media type");
      throw new ContractError("Backend SSE response must use text/event-stream");
    }
    if (!response.body) throw new ContractError("Backend SSE response body is missing");
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let lastSequence = -1;
    const eventIds = new Set<string>();
    try {
      while (!boundedSignal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        if (buffer.length > 1_000_000) throw new ContractError("Backend SSE frame exceeded the safe limit");
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const eventName = frame.split(/\r?\n/).find((line) => line.startsWith("event:"))?.slice(6).trim();
          const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
          if (eventName === "review-stage" && data) {
            const event = decodeStageEvent(parseJson(data, true));
            this.assertIdentity(event.job_id, jobId, "SSE Job");
            if (event.sequence <= lastSequence || eventIds.has(event.event_id)) {
              throw new ContractError("Backend SSE event sequence is duplicated or out of order");
            }
            lastSequence = event.sequence;
            eventIds.add(event.event_id);
            onEvent(event);
          }
        }
      }
      if (buffer.trim().length > 0) throw new ContractError("Backend SSE stream ended with an incomplete frame");
    } finally {
      reader.releaseLock();
    }
  }

  listReviewRuns(caseId: string): Promise<RunSummary[]> {
    return this.request(`/cases/${segment(caseId)}/review-runs`, { method: "GET" }, (value) => {
      const items = arrayPayload(value).map(decodeRunSummary);
      this.assertEvery(items, (item) => item.case_id === caseId, "Review Run list contains another Case");
      items.forEach((item, index) => this.assertOrg(item.org_id, `reviewRuns[${index}]`));
      return items;
    });
  }

  getReviewRun(runId: string): Promise<ReviewRun> {
    return this.request(`/review-runs/${segment(runId)}`, { method: "GET" }, (value) => {
      const item = decodeReviewRun(value);
      this.assertIdentity(item.review_run_id, runId, "Review Run");
      this.assertOrg(item.org_id, "Review Run");
      return item;
    });
  }

  listRevisionProposals(runId: string): Promise<CorrectionProposal[]> {
    return this.request(
      `/review-runs/${segment(runId)}/revision-proposals`,
      { method: "GET" },
      (value) => {
        const items = arrayPayload(value).map(decodeCorrectionProposal);
        this.assertEvery(items, (item) => item.review_run_id === runId, "Proposal list contains another Review Run");
        items.forEach((item, index) => this.assertOrg(item.org_id, `revisionProposals[${index}]`));
        assertSameValue(items.map((item) => item.case_id), "Proposal list contains mixed Case lineage");
        return items;
      },
    );
  }

  createRevisionProposal(runId: string, payload: RevisionProposalCreate, idempotencyKey: string): Promise<CorrectionProposal> {
    const init = this.json("POST", payload);
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", idempotencyKey);
    return this.request(
      `/review-runs/${segment(runId)}/revision-proposals`,
      { ...init, headers },
      (value) => {
        const item = decodeCorrectionProposal(value);
        this.assertIdentity(item.review_run_id, runId, "Revision proposal Run");
        this.assertIdentity(item.parent_result_digest, payload.parent_result_digest, "Revision proposal parent result");
        this.assertOrg(item.org_id, "Revision proposal");
        this.assertActor(item.created_by, "Revision proposal creator");
        this.assertIdempotencyBinding(
          item.idempotency_key,
          item.idempotency_request_digest,
          "revision-proposal.create/v1",
          item.case_id,
          idempotencyKey,
          {
            review_run_id: runId,
            proposal: normalizeRevisionProposal(payload),
          },
          "Revision proposal",
        );
        return item;
      },
    );
  }

  decideRevisionProposal(
    proposalId: string,
    payload: CorrectionProposalDecisionCreate,
    idempotencyKey: string,
  ): Promise<CorrectionProposalDecisionResponse> {
    const init = this.json("POST", payload);
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", idempotencyKey);
    return this.request(
      `/revision-proposals/${segment(proposalId)}/decisions`,
      { ...init, headers },
      (value) => {
        const response = decodeCorrectionProposalDecision(value);
        this.assertIdentity(response.proposal.proposal_id, proposalId, "Proposal decision");
        this.assertIdentity(response.decision.proposal_id ?? "", proposalId, "Decision proposal");
        this.assertIdentity(response.decision.review_run_id, response.proposal.review_run_id, "Decision Run");
        this.assertIdentity(response.decision.case_id, response.proposal.case_id, "Decision Case");
        this.assertOrg(response.proposal.org_id, "Proposal decision");
        this.assertOrg(response.decision.org_id, "Proposal decision record");
        this.assertActor(response.decision.decided_by, "Proposal decision actor");
        this.assertIdempotencyBinding(
          response.decision.idempotency_key,
          response.decision.idempotency_request_digest,
          "revision-proposal.decide/v1",
          response.proposal.case_id,
          idempotencyKey,
          { proposal_id: proposalId, decision: payload },
          "Proposal decision",
        );
        if (response.job !== undefined && response.job !== null) {
          this.assertIdentity(response.job.case_id, response.proposal.case_id, "Proposal child Job Case");
          if (response.job.kind !== "revision") throw new ContractError("Proposal approval must create a revision Job");
        }
        return response;
      },
    );
  }

  listDecisions(runId: string): Promise<HumanDecisionRecord[]> {
    return this.request(`/review-runs/${segment(runId)}/decisions`, { method: "GET" }, (value) => {
      const items = arrayPayload(value).map(decodeHumanDecision);
      this.assertEvery(items, (item) => item.review_run_id === runId, "Decision list contains another Review Run");
      items.forEach((item, index) => this.assertOrg(item.org_id, `decisions[${index}]`));
      assertSameValue(items.map((item) => item.case_id), "Decision list contains mixed Case lineage");
      return items;
    });
  }

  answerCaseQuestion(runId: string, payload: AnswerRequest, idempotencyKey: string): Promise<GroundedAnswer> {
    const init = this.json("POST", payload);
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", idempotencyKey);
    return this.request(`/review-runs/${segment(runId)}/answers`, { ...init, headers }, (value) => {
      const record = decodeChatRecord(value);
      if (!("message_id" in record)) throw new ContractError("Chat response must use the durable Backend ChatRecord contract");
      this.assertActor(record.created_by, "Chat answer creator");
      this.assertIdempotencyBinding(
        record.idempotency_key,
        record.idempotency_request_digest,
        "case.answer/v1",
        record.case_id,
        idempotencyKey,
        { review_run_id: runId, question: payload },
        "Chat answer",
      );
      const answer = decodeGroundedAnswer(value);
      this.assertIdentity(answer.review_run_id, runId, "Chat answer Run");
      this.assertIdentity(answer.bound_result_digest, payload.bound_result_digest, "Chat answer result digest");
      this.assertOrg(answer.org_id, "Chat answer");
      return answer;
    });
  }

  listChat(runId: string): Promise<Array<ChatRecord | GroundedAnswer>> {
    return this.request(
      `/review-runs/${segment(runId)}/messages`,
      { method: "GET" },
      (value) => {
        const items = arrayPayload(value).map(decodeChatRecord);
        this.assertEvery(items, (item) => item.review_run_id === runId, "Chat list contains another Review Run");
        items.forEach((item, index) => this.assertOrg(item.org_id, `chat[${index}]`));
        assertSameValue(items.map((item) => item.case_id), "Chat list contains mixed Case lineage");
        assertSameValue(items.map((item) => item.bound_result_digest), "Chat list contains mixed result lineage");
        return items;
      },
    );
  }

  getAuditEvents(caseId: string): Promise<AuditEvent[]> {
    return this.request(`/cases/${segment(caseId)}/audit`, { method: "GET" }, (value) => {
      const items = arrayPayload(value).map(decodeAuditEvent);
      this.assertEvery(items, (item) => item.case_id === caseId, "Audit list contains another Case");
      items.forEach((item, index) => this.assertOrg(item.org_id, `audit[${index}]`));
      return items;
    });
  }

  private json(method: "POST" | "PUT" | "PATCH" | "DELETE", payload: unknown): RequestInit {
    const body = JSON.stringify(payload);
    if (new TextEncoder().encode(body).byteLength > MAX_JSON_BODY_BYTES) {
      throw new ContractError("Backend JSON request exceeds the 4 MiB public boundary");
    }
    return {
      method,
      headers: { "Content-Type": "application/json" },
      body,
    };
  }

  private async request<T>(
    path: `/${string}`,
    init: RequestInit,
    decoder: Decoder<T>,
    authenticated = true,
  ): Promise<T> {
    const url = `${API_BASE}${path}`;
    if (!url.startsWith("/api/v1/")) throw new Error("Frontend API boundary violation");
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    const token = this.accessToken();
    if (authenticated && token) headers.set("Authorization", `Bearer ${token}`);
    const response = await this.fetcher(url, {
      ...init,
      headers,
      credentials: "same-origin",
      redirect: "error",
      referrerPolicy: "same-origin",
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
      await response.body?.cancel("Backend response exceeds the 4 MiB public boundary");
      throw new ContractError("Backend response exceeds the 4 MiB public boundary");
    }
    const responseText = await readLimitedResponseText(response, MAX_JSON_BODY_BYTES);
    let value: unknown = null;
    if (contentType.includes("application/json") && responseText) {
      value = parseJson(responseText, response.ok);
    }
    if (!response.ok) {
      const problem = decodeProblem(value, response.status);
      throw new ApiError(problem.detail, problem.status, problem.code, problem.request_id);
    }
    if (!contentType.toLowerCase().startsWith("application/json")) {
      throw new ContractError("Backend success response must use application/json");
    }
    return decoder(value);
  }

  private assertIdentity(actual: string, expected: string, context: string): void {
    if (actual !== expected) throw new ContractError(`${context} response does not match the requested identity`);
  }

  private assertOrg(actual: string, context: string): void {
    if (this.session !== undefined && actual !== this.session.org_id) {
      throw new ContractError(`${context} response does not belong to the authenticated organization`);
    }
  }

  private assertActor(actual: string, context: string): void {
    if (this.session !== undefined && actual !== this.session.subject) {
      throw new ContractError(`${context} response does not belong to the authenticated subject`);
    }
  }

  private assertIdempotencyBinding(
    actualKey: string | null | undefined,
    actualRequestDigest: string | null | undefined,
    endpoint: "revision-proposal.create/v1" | "revision-proposal.decide/v1" | "case.answer/v1",
    caseId: string,
    suppliedKey: string,
    requestPayload: unknown,
    context: string,
  ): void {
    if (this.session === undefined) {
      throw new ContractError(`${context} idempotency binding requires an authenticated session`);
    }
    const expectedKey = `idem_${canonicalSha256({
      endpoint,
      actor_id: this.session.subject,
      org_id: this.session.org_id,
      case_id: caseId,
      supplied_key: suppliedKey,
    })}`;
    if (actualKey !== expectedKey) {
      throw new ContractError(`${context} response does not match the scoped idempotency identity`);
    }
    if (actualRequestDigest !== canonicalSha256(requestPayload)) {
      throw new ContractError(`${context} response does not match the submitted request digest`);
    }
  }

  private assertEvery<T>(items: T[], predicate: (item: T) => boolean, message: string): void {
    if (!items.every(predicate)) throw new ContractError(message);
  }
}

async function readLimitedResponseText(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let decoded = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel("Backend response exceeds the 4 MiB public boundary");
        throw new ContractError("Backend response exceeds the 4 MiB public boundary");
      }
      decoded += decoder.decode(chunk.value, { stream: true });
    }
    return decoded + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function parseJson(value: string, failOnMalformed: boolean): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    if (failOnMalformed) throw new ContractError("Backend returned malformed JSON");
    return null;
  }
}

function segment(value: string): string {
  if (!value || value.length > 160) throw new Error("Invalid resource identifier");
  return encodeURIComponent(value);
}

function arrayPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: unknown[] }).items;
  }
  throw new Error("Backend array payload contract mismatch");
}

function boundedArrayPayload(value: unknown, maximum: number, context: string): unknown[] {
  const items = arrayPayload(value);
  if (items.length > maximum) throw new ContractError(`${context} exceeds the maximum of ${maximum} items`);
  return items;
}

function pageOrArray<T>(value: unknown, decoder: Decoder<T>): Paged<T> {
  if (Array.isArray(value)) return { items: value.map(decoder) };
  return decodePaged(value, decoder);
}

function decodeDocumentView(value: unknown, context: string, requireContent = false): CaseDocument {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ContractError(`${context}: object expected`);
  const raw = value as { record?: unknown; content_text?: unknown };
  if (raw.record === undefined) throw new ContractError(`${context}.record: object expected`);
  const record = decodePublicDocument(raw.record, `${context}.record`);
  if (raw.content_text === null || raw.content_text === undefined) {
    if (requireContent) throw new ContractError(`${context}.content_text: string expected`);
    return record;
  }
  if (typeof raw.content_text !== "string") throw new ContractError(`${context}.content_text: string expected`);
  return decodePublicDocument({ ...record, content_text: raw.content_text }, context);
}

function decodeJobResponse(value: unknown): JobRecord {
  if (typeof value !== "object" || value === null) throw new Error("Job response contract mismatch");
  const raw = value as { job?: unknown };
  return decodeJob(raw.job ?? value);
}

function assertSameValue(values: string[], message: string): void {
  if (new Set(values).size > 1) throw new ContractError(message);
}

function validateEventSequence(events: ReviewStageEvent[], jobId: string): void {
  let lastSequence = -1;
  const eventIds = new Set<string>();
  for (const event of events) {
    if (event.job_id !== jobId) throw new ContractError("Stage-event list contains another Job");
    if (event.sequence <= lastSequence || eventIds.has(event.event_id)) {
      throw new ContractError("Stage-event list is duplicated or out of sequence");
    }
    lastSequence = event.sequence;
    eventIds.add(event.event_id);
  }
}

function normalizeRevisionProposal(payload: RevisionProposalCreate): Record<string, unknown> {
  return {
    parent_result_digest: payload.parent_result_digest,
    parent_input_manifest_sha256: payload.parent_input_manifest_sha256,
    case_revision: payload.case_revision,
    actions: payload.actions.map((action) => ({
      decision: action.decision,
      reason: action.reason,
      confirmed_reference_id: action.confirmed_reference_id ?? null,
      correction: action.correction ?? null,
      supporting_document_id: action.supporting_document_id ?? null,
    })),
  };
}

function canonicalSha256(value: unknown): string {
  return [...sha256(new TextEncoder().encode(canonicalJson(value)))]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new ContractError("Idempotency binding contains a non-JSON value");
}
