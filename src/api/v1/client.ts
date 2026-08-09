import {
  ContractError,
  decodeAuthConfig,
  decodeAssistantConversation,
  decodeAssistantMessage,
  decodeAssistantMessageExchange,
  decodeCaseSummary,
  decodeCorrectionProposal,
  decodeDocumentListItem,
  decodeDocumentView,
  decodeJob,
  decodeKnowledgeConversation,
  decodeKnowledgeMessage,
  decodeKnowledgeMessageExchange,
  decodeProblem,
  decodeReviewerDecision,
  decodeReviewRun,
  decodeReviewRunSummary,
  decodeSession,
} from "./decoders";
import type {
  AddDocumentRequest,
  AssistantConversation,
  AssistantMessage,
  AssistantMessageExchange,
  AuthConfig,
  CaseDetail,
  CaseDocument,
  CaseSummary,
  CreateCaseRequest,
  CreateAssistantConversationRequest,
  CreateCorrectionProposalRequest,
  CorrectionDecisionRequest,
  CorrectionProposal,
  CreateRevisionRequest,
  EnqueueReviewRequest,
  FindingDecisionRequest,
  JobRecord,
  CreateKnowledgeConversationRequest,
  KnowledgeConversation,
  KnowledgeMessage,
  KnowledgeMessageExchange,
  ReviewerDecision,
  ReviewRun,
  ReviewRunSummary,
  SendAssistantMessageRequest,
  SendKnowledgeMessageRequest,
  Session,
} from "./types";
import type { LocalDevelopmentSessionResponse } from "../../auth";
import { stableApiErrorMessage, technicalApiErrorDetail } from "../user-facing-errors";

const API_BASE = "/api/v1" as const;
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
// A review can legitimately wait for the bounded Agent workflow and one
// provider response.  Keep ordinary workbench reads/actions responsive, but
// do not abandon a real review before the Backend has had a fair chance to
// return its terminal Job projection.
const REVIEW_EXECUTION_TIMEOUT_MS = 120_000;
// A standalone official-knowledge answer may make one bounded Data lookup
// and one Claude presentation call.  Backend's normal Agent response budget
// is 180 seconds, so the Browser must not abort the public request first.
// The small margin is only for the local public-response handoff; it is not
// another provider attempt.
const KNOWLEDGE_ANSWER_TIMEOUT_MS = 190_000;

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

  createLocalDevelopmentSession(actor?: "reviewer" | "approver"): Promise<LocalDevelopmentSessionResponse> {
    // Omitted remains the Backend's explicit reviewer default.  The approver
    // identity is requested only when a local developer deliberately switches
    // to the independent approval role.
    const init = actor === undefined ? { method: "POST" as const } : this.json("POST", { actor });
    return this.request("/dev/session", init, decodeLocalDevelopmentSession, false);
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
    return this.request(
      `/cases/${segment(caseId)}/reviews`,
      { ...init, headers },
      (value) => {
        const job = decodeJobEnvelope(value);
        this.assertIdentity(job.case_id, caseId, "Review Job Case");
        return job;
      },
      true,
      REVIEW_EXECUTION_TIMEOUT_MS,
    );
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

  listAssistantConversations(reviewRunId: string): Promise<AssistantConversation[]> {
    return this.request(
      `/review-runs/${segment(reviewRunId)}/assistant/conversations`,
      { method: "GET" },
      (value) => {
        const conversations = itemsFrom(value, "Assistant conversation list").map(decodeAssistantConversation);
        conversations.forEach((item, index) => {
          this.assertIdentity(item.review_run_id, reviewRunId, `assistant conversations[${index}] review run`);
        });
        return conversations;
      },
    );
  }

  createAssistantConversation(
    reviewRunId: string,
    payload: CreateAssistantConversationRequest = {},
  ): Promise<AssistantConversation> {
    const title = payload.title?.trim();
    if (title !== undefined && (!title || title.length > 200)) {
      throw new ContractError("assistant conversation title is invalid");
    }
    return this.request(
      `/review-runs/${segment(reviewRunId)}/assistant/conversations`,
      this.json("POST", title ? { title } : {}),
      (value) => {
        const conversation = decodeAssistantConversation(value);
        this.assertIdentity(conversation.review_run_id, reviewRunId, "Assistant conversation review run");
        return conversation;
      },
    );
  }

  /**
   * Global official-knowledge conversations are deliberately separate from a
   * Case review.  The Browser still calls only Backend API v1.
   */
  listKnowledgeConversations(): Promise<KnowledgeConversation[]> {
    return this.request(
      "/knowledge/conversations",
      { method: "GET" },
      (value) => itemsFrom(value, "Knowledge conversation list").map(decodeKnowledgeConversation),
    );
  }

  createKnowledgeConversation(
    payload: CreateKnowledgeConversationRequest,
  ): Promise<KnowledgeConversation> {
    const title = payload.title?.trim();
    if (title !== undefined && (!title || title.length > 200)) {
      throw new ContractError("knowledge conversation title is invalid");
    }
    const tradeType = payload.trade_type ?? "both";
    if (!(["import", "export", "both"] as const).includes(tradeType)) {
      throw new ContractError("knowledge conversation trade type is invalid");
    }
    if (payload.as_of !== undefined && !isIsoDate(payload.as_of)) {
      throw new ContractError("knowledge conversation date must be an ISO calendar date");
    }
    return this.request(
      "/knowledge/conversations",
      this.json("POST", {
        ...(title ? { title } : {}),
        trade_type: tradeType,
        ...(payload.as_of === undefined ? {} : { as_of: payload.as_of }),
      }),
      decodeKnowledgeConversation,
    );
  }

  listKnowledgeMessages(conversationId: string): Promise<KnowledgeMessage[]> {
    return this.request(
      `/knowledge/conversations/${segment(conversationId)}/messages`,
      { method: "GET" },
      (value) => {
        const messages = itemsFrom(value, "Knowledge message list").map((item) => decodeKnowledgeMessage(item));
        messages.forEach((item, index) => {
          this.assertIdentity(item.conversation_id, conversationId, `knowledge messages[${index}] conversation`);
        });
        return messages;
      },
    );
  }

  sendKnowledgeMessage(
    conversationId: string,
    payload: SendKnowledgeMessageRequest,
    idempotencyKey: string,
  ): Promise<KnowledgeMessageExchange> {
    const content = payload.content.trim();
    if (!content || content.length > 4_000) throw new ContractError("knowledge message content is invalid");
    if (!isSafeIdempotencyKey(idempotencyKey)) throw new ContractError("knowledge message Idempotency-Key is invalid");
    const init = this.json("POST", { content });
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", idempotencyKey);
    return this.request(
      `/knowledge/conversations/${segment(conversationId)}/messages`,
      { ...init, headers },
      (value) => {
        const exchange = decodeKnowledgeMessageExchange(value);
        this.assertIdentity(exchange.user_message.conversation_id, conversationId, "Knowledge user message conversation");
        this.assertIdentity(exchange.assistant_message.conversation_id, conversationId, "Knowledge answer conversation");
        return exchange;
      },
      true,
      KNOWLEDGE_ANSWER_TIMEOUT_MS,
    );
  }

  listAssistantMessages(conversationId: string): Promise<AssistantMessage[]> {
    return this.request(
      `/assistant/conversations/${segment(conversationId)}/messages`,
      { method: "GET" },
      (value) => {
        const messages = itemsFrom(value, "Assistant message list").map((item) => decodeAssistantMessage(item));
        messages.forEach((item, index) => {
          this.assertIdentity(item.conversation_id, conversationId, `assistant messages[${index}] conversation`);
        });
        return messages;
      },
    );
  }

  sendAssistantMessage(
    conversationId: string,
    payload: SendAssistantMessageRequest,
    idempotencyKey: string,
  ): Promise<AssistantMessageExchange> {
    const content = payload.content.trim();
    if (!content || content.length > 4_000) throw new ContractError("assistant message content is invalid");
    if (!isSafeIdempotencyKey(idempotencyKey)) throw new ContractError("assistant message Idempotency-Key is invalid");
    const init = this.json("POST", { content });
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", idempotencyKey);
    return this.request(
      `/assistant/conversations/${segment(conversationId)}/messages`,
      { ...init, headers },
      (value) => {
        const exchange = decodeAssistantMessageExchange(value);
        this.assertIdentity(exchange.user_message.conversation_id, conversationId, "Assistant user message conversation");
        this.assertIdentity(exchange.assistant_message.conversation_id, conversationId, "Assistant answer conversation");
        return exchange;
      },
    );
  }

  listCorrectionProposals(reviewRunId: string): Promise<CorrectionProposal[]> {
    return this.request(
      `/review-runs/${segment(reviewRunId)}/correction-proposals`,
      { method: "GET" },
      (value) => {
        const proposals = itemsFrom(value, "Correction proposal list").map(decodeCorrectionProposal);
        proposals.forEach((item, index) => {
          this.assertIdentity(item.review_run_id, reviewRunId, `correction proposals[${index}] review run`);
        });
        return proposals;
      },
    );
  }

  createCorrectionProposal(
    reviewRunId: string,
    payload: CreateCorrectionProposalRequest,
  ): Promise<CorrectionProposal> {
    const canonical = validateCorrectionProposal(payload);
    return this.request(
      `/review-runs/${segment(reviewRunId)}/correction-proposals`,
      this.json("POST", canonical),
      (value) => {
        const proposal = decodeCorrectionProposal(value);
        this.assertIdentity(proposal.review_run_id, reviewRunId, "Correction proposal review run");
        return proposal;
      },
    );
  }

  decideCorrectionProposal(
    proposalId: string,
    payload: CorrectionDecisionRequest,
  ): Promise<CorrectionProposal> {
    const reason = payload.reason.trim();
    if (!reason || reason.length > 2_000) throw new ContractError("correction decision reason is invalid");
    if (payload.status !== "approved" && payload.status !== "rejected") {
      throw new ContractError("correction decision status is invalid");
    }
    return this.request(
      `/correction-proposals/${segment(proposalId)}/decision`,
      this.json("PUT", { status: payload.status, reason }),
      (value) => {
        const proposal = decodeCorrectionProposal(value);
        this.assertIdentity(proposal.correction_proposal_id, proposalId, "Correction proposal");
        return proposal;
      },
    );
  }

  enqueueRevision(
    reviewRunId: string,
    payload: CreateRevisionRequest,
    idempotencyKey: string,
  ): Promise<JobRecord> {
    if (!isSafeIdempotencyKey(idempotencyKey)) throw new ContractError("revision Idempotency-Key is invalid");
    if (!payload.proposal_ids.length || payload.proposal_ids.length > 50) {
      throw new ContractError("revision proposal IDs are invalid");
    }
    const proposalIds = [...new Set(payload.proposal_ids.map((item) => item.trim()))];
    if (proposalIds.some((item) => !item || item.length > 256 || /[\r\n\0]/u.test(item))) {
      throw new ContractError("revision proposal IDs are invalid");
    }
    const init = this.json("POST", { proposal_ids: proposalIds });
    const headers = new Headers(init.headers);
    headers.set("Idempotency-Key", idempotencyKey);
    return this.request(
      `/review-runs/${segment(reviewRunId)}/revisions`,
      { ...init, headers },
      decodeJobEnvelope,
      true,
      REVIEW_EXECUTION_TIMEOUT_MS,
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
    timeoutMs = REQUEST_TIMEOUT_MS,
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
        signal: AbortSignal.timeout(timeoutMs),
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
  if (!roles.length || roles.some((role) => role !== "reviewer" && role !== "approver")) {
    throw new ContractError("development session role is unsupported");
  }
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

function validateCorrectionProposal(payload: CreateCorrectionProposalRequest): CreateCorrectionProposalRequest {
  const documentId = payload.document_id.trim();
  const fieldName = payload.field_name.trim();
  const newValue = payload.new_value.trim();
  const reason = payload.reason.trim();
  if (
    !documentId || documentId.length > 128 || /[\r\n\0]/u.test(documentId) ||
    !fieldName || fieldName.length > 64 || !/^[a-z][a-z0-9_]{0,63}$/u.test(fieldName)
  ) {
    throw new ContractError("correction proposal target is invalid");
  }
  if (!newValue || newValue.length > 2_000 || !reason || reason.length > 2_000) {
    throw new ContractError("correction proposal content is invalid");
  }
  const optional = (value: string | null | undefined, label: string, maximum = 256): string | undefined => {
    if (value === undefined || value === null) return undefined;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maximum || /[\r\n\0]/u.test(trimmed)) {
      throw new ContractError(`${label} is invalid`);
    }
    return trimmed;
  };
  const itemId = optional(payload.item_id, "correction proposal item ID");
  const factId = optional(payload.fact_id, "correction proposal fact ID");
  const unit = optional(payload.unit, "correction proposal unit", 64);
  const findingId = optional(payload.finding_id, "correction proposal finding ID");
  return {
    document_id: documentId,
    field_name: fieldName,
    new_value: newValue,
    reason,
    ...(itemId === undefined ? {} : { item_id: itemId }),
    ...(factId === undefined ? {} : { fact_id: factId }),
    ...(unit === undefined ? {} : { unit }),
    ...(findingId === undefined ? {} : { finding_id: findingId }),
  };
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
