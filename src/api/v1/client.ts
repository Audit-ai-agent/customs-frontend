import {
  ContractError,
  decodeAuthConfig,
  decodeAssistantConversation,
  decodeAssistantMessage,
  decodeAssistantMessageExchange,
  decodeCaseSummary,
  decodeCorrectionProposal,
  decodeDocumentAsset,
  decodeDocumentListItem,
  decodeDocumentView,
  decodeDutyAssessment,
  decodeExtractionJobEnvelope,
  decodeHsClassification,
  decodeHsReferenceEntry,
  decodeHsReferenceSearch,
  decodeCaseHsClassification,
  decodeHsSelection,
  decodeJob,
  decodeLawCatalog,
  decodeLawSearch,
  decodeLlmConnectionTest,
  decodeLlmSettings,
  decodeOperationsMetrics,
  decodeOriginVerification,
  decodeProblem,
  decodeReviewProgress,
  decodeReviewerDecision,
  decodeReviewRun,
  decodeReviewRunSummary,
  decodeRasterTextExtractionEnvelope,
  decodeSession,
  decodeRasterExtractionEnvelope,
} from "./decoders";
import type {
  AddDocumentRequest,
  AssistantConversation,
  AssistantMessage,
  AssistantMessageExchange,
  AuthConfig,
  CaseClosureRequest,
  CaseDetail,
  CaseDocument,
  CaseSummary,
  ConfirmExtractedTextRequest,
  CorrectionDecisionRequest,
  CorrectionProposal,
  CreateAssistantConversationRequest,
  CreateCaseRequest,
  CreateCorrectionProposalRequest,
  CreateRevisionRequest,
  DocumentAsset,
  DocumentAssetMediaType,
  DocumentType,
  DutyAssessment,
  EnqueueReviewRequest,
  ExtractionJobEnvelope,
  FindingDecisionRequest,
  CaseHsClassification,
  HsClassification,
  HsReferenceEntry,
  HsReferenceSearch,
  HsSelection,
  HsSelectionRequest,
  JobRecord,
  LawCatalog,
  LawSearch,
  LlmConnectionTest,
  LlmSettingsUpdate,
  LlmSettingsView,
  OperationsMetrics,
  OriginVerification,
  RasterExtractionEnvelope,
  RasterTextExtractionEnvelope,
  ReviewProgress,
  ReviewRun,
  ReviewRunSummary,
  ReviewerDecision,
  SendAssistantMessageRequest,
  Session,
} from "./types";
import type { LocalDevelopmentSessionResponse } from "../../auth";
import { stableApiErrorMessage, technicalApiErrorDetail } from "../user-facing-errors";

const API_BASE = "/api/v1" as const;
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;
/** The Backend's document-asset byte bound (16MiB); checked client-side for a fast, clear error. */
const MAX_ASSET_BODY_BYTES = 16 * 1024 * 1024;
const MAX_TEXT_DOCUMENT_CHARACTERS = 200_000;
const REQUEST_TIMEOUT_MS = 30_000;
/**
 * Backend runs the whole AI workflow inside the request for review start,
 * revision, and assistant replies: with the real model connected these
 * complete in minutes, not seconds. Aborting sooner loses work the server
 * keeps doing, so those calls get the long bound instead.
 */
const AI_WORKFLOW_TIMEOUT_MS = 600_000;

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

  getReviewProgress(caseId: string): Promise<ReviewProgress> {
    return this.request(
      `/cases/${segment(caseId)}/review-progress`,
      { method: "GET" },
      (value) => decodeReviewProgress(value),
    );
  }

  async deleteCase(caseId: string): Promise<void> {
    await this.request(`/cases/${segment(caseId)}`, { method: "DELETE" }, () => undefined);
  }

  closeCase(caseId: string, payload: CaseClosureRequest): Promise<CaseDetail> {
    const reason = payload.reason.trim();
    if (!reason || reason.length > 4_000) throw new ContractError("closure reason is invalid");
    if (payload.disposition !== "cleared" && payload.disposition !== "returned") {
      throw new ContractError("closure disposition is invalid");
    }
    return this.request(
      `/cases/${segment(caseId)}/closure`,
      this.json("POST", { disposition: payload.disposition, reason }),
      (value) => {
        const item = decodeCaseSummary(value);
        this.assertIdentity(item.case_id, caseId, "Closed Case");
        this.assertOrg(item.org_id, "Closed Case");
        return item;
      },
    );
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

  listDocumentAssets(caseId: string): Promise<DocumentAsset[]> {
    return this.request(`/cases/${segment(caseId)}/document-assets`, { method: "GET" }, (value) => {
      const assets = itemsFrom(value, "Document asset list").map(decodeDocumentAsset);
      assets.forEach((item) => this.assertIdentity(item.case_id, caseId, "Document asset Case"));
      return assets;
    });
  }

  /** Uploads one immutable PDF/JPEG/PNG source file for the extraction preview. */
  addDocumentAsset(
    caseId: string,
    input: { documentType: DocumentType; filename: string; mediaType: DocumentAssetMediaType; body: Blob },
  ): Promise<DocumentAsset> {
    const filename = input.filename.trim();
    if (!filename || filename.length > 255 || /[\r\n\0]/u.test(filename)) {
      throw new ContractError("document asset filename is invalid");
    }
    if (input.body.size < 1 || input.body.size > MAX_ASSET_BODY_BYTES) {
      throw new ContractError("document asset size is outside the allowed limit");
    }
    const query = new URLSearchParams({ document_type: input.documentType, filename });
    return this.request(
      `/cases/${segment(caseId)}/document-assets?${query.toString()}`,
      { method: "POST", headers: { "Content-Type": input.mediaType }, body: input.body },
      (value) => {
        const asset = decodeDocumentAsset(value);
        this.assertIdentity(asset.case_id, caseId, "Document asset Case");
        return asset;
      },
    );
  }

  startExtraction(caseId: string, assetId: string): Promise<ExtractionJobEnvelope> {
    return this.request(
      `/cases/${segment(caseId)}/document-assets/${segment(assetId)}/extractions`,
      { method: "POST" },
      (value) => {
        const envelope = decodeExtractionJobEnvelope(value);
        this.assertIdentity(envelope.job.case_id, caseId, "Extraction Case");
        this.assertIdentity(envelope.job.asset_id, assetId, "Extraction asset");
        return envelope;
      },
    );
  }

  getExtraction(caseId: string, assetId: string, extractionJobId: string): Promise<ExtractionJobEnvelope> {
    return this.request(
      `/cases/${segment(caseId)}/document-assets/${segment(assetId)}/extractions/${segment(extractionJobId)}`,
      { method: "GET" },
      (value) => {
        const envelope = decodeExtractionJobEnvelope(value);
        this.assertIdentity(envelope.job.extraction_job_id, extractionJobId, "Extraction job");
        return envelope;
      },
    );
  }

  /** Enqueues the approved raster OCR + layout profile (PP-StructureV3, CPU). */
  requestRasterExtraction(
    caseId: string,
    assetId: string,
    idempotencyKey: string,
  ): Promise<RasterExtractionEnvelope> {
    if (!isSafeIdempotencyKey(idempotencyKey)) throw new ContractError("raster extraction Idempotency-Key is invalid");
    return this.request(
      `/cases/${segment(caseId)}/document-assets/${segment(assetId)}/raster-extractions`,
      { method: "POST", headers: { "Idempotency-Key": idempotencyKey } },
      (value) => {
        const envelope = decodeRasterExtractionEnvelope(value);
        this.assertIdentity(envelope.asset.case_id, caseId, "Raster extraction Case");
        this.assertIdentity(envelope.asset.asset_id, assetId, "Raster extraction asset");
        return envelope;
      },
    );
  }

  getRasterExtraction(
    caseId: string,
    assetId: string,
    rasterExtractionJobId: string,
  ): Promise<RasterExtractionEnvelope> {
    return this.request(
      `/cases/${segment(caseId)}/document-assets/${segment(assetId)}/raster-extractions/${segment(rasterExtractionJobId)}`,
      { method: "GET" },
      (value) => {
        const envelope = decodeRasterExtractionEnvelope(value);
        this.assertIdentity(envelope.asset.case_id, caseId, "Raster extraction Case");
        this.assertIdentity(envelope.asset.asset_id, assetId, "Raster extraction asset");
        this.assertIdentity(envelope.job.raster_extraction_job_id, rasterExtractionJobId, "Raster extraction job");
        return envelope;
      },
    );
  }

  /** Enqueues the independently approved text-only OCR profile. */
  requestRasterTextExtraction(
    caseId: string,
    assetId: string,
    idempotencyKey: string,
  ): Promise<RasterTextExtractionEnvelope> {
    if (!isSafeIdempotencyKey(idempotencyKey)) throw new ContractError("raster text extraction Idempotency-Key is invalid");
    return this.request(
      `/cases/${segment(caseId)}/document-assets/${segment(assetId)}/raster-text-extractions`,
      { method: "POST", headers: { "Idempotency-Key": idempotencyKey } },
      (value) => {
        const envelope = decodeRasterTextExtractionEnvelope(value);
        this.assertIdentity(envelope.asset.case_id, caseId, "Raster text extraction Case");
        this.assertIdentity(envelope.asset.asset_id, assetId, "Raster text extraction asset");
        return envelope;
      },
    );
  }

  getRasterTextExtraction(
    caseId: string,
    assetId: string,
    rasterTextExtractionJobId: string,
  ): Promise<RasterTextExtractionEnvelope> {
    return this.request(
      `/cases/${segment(caseId)}/document-assets/${segment(assetId)}/raster-text-extractions/${segment(rasterTextExtractionJobId)}`,
      { method: "GET" },
      (value) => {
        const envelope = decodeRasterTextExtractionEnvelope(value);
        this.assertIdentity(envelope.asset.case_id, caseId, "Raster text extraction Case");
        this.assertIdentity(envelope.asset.asset_id, assetId, "Raster text extraction asset");
        this.assertIdentity(envelope.job.raster_text_extraction_job_id, rasterTextExtractionJobId, "Raster text extraction job");
        return envelope;
      },
    );
  }

  /** Fetches the reviewer-only original into transient memory for inline comparison. */
  getDocumentAssetSource(caseId: string, asset: DocumentAsset, signal?: AbortSignal): Promise<Blob> {
    return this.requestBinary(
      `/cases/${segment(caseId)}/document-assets/${segment(asset.asset_id)}/source`,
      asset.media_type,
      asset.byte_size,
      MAX_ASSET_BODY_BYTES,
      signal,
    );
  }

  /** Human-confirmed extracted text enters the existing text-review workflow. */
  confirmExtractedText(
    caseId: string,
    assetId: string,
    payload: ConfirmExtractedTextRequest,
  ): Promise<CaseDocument> {
    if (!payload.content_text.trim() || payload.content_text.length > MAX_TEXT_DOCUMENT_CHARACTERS) {
      throw new ContractError("confirmed text is invalid");
    }
    const extractionJobId = payload.extraction_job_id === undefined
      ? undefined
      : requestIdentifier(payload.extraction_job_id, "extraction job ID");
    const rasterTextExtractionJobId = payload.raster_text_extraction_job_id === undefined
      ? undefined
      : requestIdentifier(payload.raster_text_extraction_job_id, "raster text extraction job ID");
    const rasterExtractionJobId = payload.raster_extraction_job_id === undefined
      ? undefined
      : requestIdentifier(payload.raster_extraction_job_id, "raster extraction job ID");
    if ([extractionJobId, rasterExtractionJobId, rasterTextExtractionJobId].filter((value) => value !== undefined).length !== 1) {
      throw new ContractError("exactly one extraction job ID is required");
    }
    const filename = payload.filename.trim();
    if (!filename || filename.length > 255 || /[\\/\r\n\0]/u.test(filename)) {
      throw new ContractError("confirmed text filename is invalid");
    }
    return this.request(
      `/cases/${segment(caseId)}/document-assets/${segment(assetId)}/confirmed-document`,
      this.json("POST", {
        ...(extractionJobId === undefined ? {} : { extraction_job_id: extractionJobId }),
        ...(rasterExtractionJobId === undefined ? {} : { raster_extraction_job_id: rasterExtractionJobId }),
        ...(rasterTextExtractionJobId === undefined ? {} : { raster_text_extraction_job_id: rasterTextExtractionJobId }),
        content_text: payload.content_text,
        filename,
        ...(payload.replaces_document_id === undefined || payload.replaces_document_id === null
          ? {}
          : { replaces_document_id: requestIdentifier(payload.replaces_document_id, "replacement document ID") }),
      }),
      (value) => {
        const item = decodeDocumentView(value);
        this.assertIdentity(item.record.case_id, caseId, "Document Case");
        return item.record;
      },
    );
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
      AI_WORKFLOW_TIMEOUT_MS,
    );
  }

  async getJob(jobId: string): Promise<JobRecord> {
    const job = await this.request(`/jobs/${segment(jobId)}`, { method: "GET" }, decodeJobEnvelope);
    this.assertIdentity(job.job_id, jobId, "Job");
    return job;
  }

  getCaseHsClassification(caseId: string): Promise<CaseHsClassification> {
    return this.request(
      `/cases/${segment(caseId)}/hs-classification`,
      { method: "GET" },
      (value) => {
        const view = decodeCaseHsClassification(value);
        this.assertIdentity(view.case_id, caseId, "HS classification case");
        return view;
      },
    );
  }

  recordCaseHsSelection(caseId: string, payload: HsSelectionRequest): Promise<HsSelection> {
    const reason = payload.reason.trim();
    if (!reason || reason.length > 4_000) throw new ContractError("HS selection reason is invalid");
    if (!/^[0-9]{10}$/u.test(payload.code)) throw new ContractError("HS selection code is invalid");
    return this.request(
      `/cases/${segment(caseId)}/hs-classification`,
      this.json("POST", { code: payload.code, reason }),
      (value) => decodeHsSelection(value),
    );
  }

  getHsClassification(reviewRunId: string): Promise<HsClassification> {
    return this.request(
      `/review-runs/${segment(reviewRunId)}/hs-classification`,
      { method: "GET" },
      (value) => {
        const view = decodeHsClassification(value);
        this.assertIdentity(view.review_run_id, reviewRunId, "HS classification review run");
        return view;
      },
    );
  }

  getHskReference(code: string): Promise<HsReferenceEntry> {
    if (!/^[0-9]{10}$/u.test(code)) throw new ContractError("HSK reference code is invalid");
    return this.request(`/hsk-reference/${segment(code)}`, { method: "GET" }, (value) => {
      const entry = decodeHsReferenceEntry(value);
      this.assertIdentity(entry.code, code, "HSK reference code");
      return entry;
    });
  }

  getOperationsMetrics(): Promise<OperationsMetrics> {
    return this.request("/operations-metrics", { method: "GET" }, decodeOperationsMetrics);
  }

  /* ── admin: LLM settings (approver only; reached from the hidden #/admin page) ── */

  getLlmSettings(): Promise<LlmSettingsView> {
    return this.request("/admin/llm-settings", { method: "GET" }, decodeLlmSettings);
  }

  updateLlmSettings(update: LlmSettingsUpdate): Promise<LlmSettingsView> {
    const payload = validateLlmSettingsUpdate(update);
    if (Object.keys(payload).length === 0) throw new ContractError("llm settings update is empty");
    return this.request("/admin/llm-settings", this.json("PUT", payload), decodeLlmSettings);
  }

  resetLlmSettings(): Promise<LlmSettingsView> {
    return this.request("/admin/llm-settings", { method: "DELETE" }, decodeLlmSettings);
  }

  /** Tests the candidate settings (or the active ones when `update` is empty) without saving. */
  testLlmSettings(update: LlmSettingsUpdate = {}): Promise<LlmConnectionTest> {
    return this.request(
      "/admin/llm-settings/test",
      this.json("POST", validateLlmSettingsUpdate(update)),
      decodeLlmConnectionTest,
      true,
      AI_WORKFLOW_TIMEOUT_MS,
    );
  }

  searchLaws(query: string, topK?: number): Promise<LawSearch> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length > 200) throw new ContractError("law search query is invalid");
    const params = new URLSearchParams({ q: trimmed });
    if (topK !== undefined) params.set("top_k", String(topK));
    return this.request(`/law-search?${params.toString()}`, { method: "GET" }, decodeLawSearch);
  }

  getLawCatalog(): Promise<LawCatalog> {
    return this.request("/laws", { method: "GET" }, decodeLawCatalog);
  }

  searchHskReference(query: string): Promise<HsReferenceSearch> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length > 100) throw new ContractError("HSK reference search query is invalid");
    const params = new URLSearchParams({ q: trimmed });
    return this.request(`/hsk-reference?${params.toString()}`, { method: "GET" }, decodeHsReferenceSearch);
  }

  recordHsSelection(reviewRunId: string, payload: HsSelectionRequest): Promise<HsSelection> {
    const reason = payload.reason.trim();
    if (!reason || reason.length > 4_000) throw new ContractError("HS selection reason is invalid");
    if (!/^[0-9]{10}$/u.test(payload.code)) throw new ContractError("HS selection code is invalid");
    return this.request(
      `/review-runs/${segment(reviewRunId)}/hs-classification`,
      this.json("POST", { code: payload.code, reason }),
      (value) => decodeHsSelection(value),
    );
  }

  getOriginVerification(reviewRunId: string): Promise<OriginVerification> {
    return this.request(
      `/review-runs/${segment(reviewRunId)}/origin-verification`,
      { method: "GET" },
      (value) => {
        const view = decodeOriginVerification(value);
        this.assertIdentity(view.review_run_id, reviewRunId, "Origin verification review run");
        return view;
      },
    );
  }

  getDutyAssessment(reviewRunId: string): Promise<DutyAssessment> {
    return this.request(
      `/review-runs/${segment(reviewRunId)}/duty-assessment`,
      { method: "GET" },
      (value) => {
        const view = decodeDutyAssessment(value);
        this.assertIdentity(view.review_run_id, reviewRunId, "Duty assessment review run");
        return view;
      },
    );
  }

  setFindingDecision(
    reviewRunId: string,
    findingId: string,
    payload: FindingDecisionRequest,
  ): Promise<ReviewerDecision> {
    const reasonCode = payload.reason_code ?? null;
    const preset = reasonCode !== null && reasonCode !== "other";
    if ((!preset && !payload.reason.trim()) || payload.reason.length > 4_000) {
      throw new ContractError("reviewer decision reason is invalid");
    }
    if (!(["confirmed", "needs_information", "resolved"] as const).includes(payload.status)) {
      throw new ContractError("reviewer decision status is invalid");
    }
    return this.request(
      `/review-runs/${segment(reviewRunId)}/findings/${segment(findingId)}/decision`,
      this.json("PUT", {
        status: payload.status,
        ...(reasonCode === null ? {} : { reason_code: reasonCode }),
        reason: payload.reason.trim(),
      }),
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
      true,
      AI_WORKFLOW_TIMEOUT_MS,
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
      AI_WORKFLOW_TIMEOUT_MS,
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
    timeoutMs: number = REQUEST_TIMEOUT_MS,
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

  private async requestBinary(
    path: string,
    expectedMediaType: DocumentAssetMediaType,
    expectedByteSize: number,
    maximumByteSize: number,
    callerSignal?: AbortSignal,
  ): Promise<Blob> {
    const token = await this.accessToken?.();
    if (!token) throw new ApiError("browser token is absent", 401);
    let response: Response;
    try {
      response = await this.fetcher(`${API_BASE}${path}`, {
        method: "GET",
        headers: {
          Accept: expectedMediaType,
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
        credentials: "same-origin",
        redirect: "error",
        referrerPolicy: "same-origin",
        signal: combinedRequestSignal(REQUEST_TIMEOUT_MS, callerSignal),
      });
    } catch {
      throw new ApiError("Backend source-viewer request failed before a response", 503);
    }
    if (!response.ok) {
      const problem = decodeProblem(await readJson(response), response.status);
      throw new ApiError(problem.detail, problem.status, problem.code, problem.request_id);
    }
    const actualMediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (actualMediaType !== expectedMediaType) throw new ContractError("source viewer returned an unexpected media type");
    if (!/^inline(?:;|$)/iu.test(response.headers.get("content-disposition") ?? "")) {
      throw new ContractError("source viewer must use inline content disposition");
    }
    if (!/(?:^|,)\s*no-store(?:\s|,|$)/iu.test(response.headers.get("cache-control") ?? "")) {
      throw new ContractError("source viewer response must be no-store");
    }
    if ((response.headers.get("x-content-type-options") ?? "").toLowerCase() !== "nosniff") {
      throw new ContractError("source viewer response must prevent MIME sniffing");
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength !== null && (!/^\d+$/u.test(contentLength) || Number(contentLength) !== expectedByteSize)) {
      throw new ContractError("source viewer response has an unexpected byte length");
    }
    const blob = await response.blob();
    if (blob.type && blob.type.split(";", 1)[0]?.toLowerCase() !== expectedMediaType) {
      throw new ContractError("source viewer blob has an unexpected media type");
    }
    if (blob.size !== expectedByteSize || blob.size > maximumByteSize) {
      throw new ContractError("source viewer response has an unexpected byte length");
    }
    return blob;
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

function validateLlmSettingsUpdate(update: LlmSettingsUpdate): LlmSettingsUpdate {
  const payload: LlmSettingsUpdate = {};
  if (update.provider !== undefined) {
    if (update.provider !== "openai" && update.provider !== "anthropic") throw new ContractError("llm provider is invalid");
    payload.provider = update.provider;
  }
  if (update.model !== undefined) {
    const model = update.model.trim();
    if (!model || model.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(model)) {
      throw new ContractError("llm model name is invalid");
    }
    payload.model = model;
  }
  if (update.max_tokens !== undefined) {
    if (!Number.isInteger(update.max_tokens) || update.max_tokens < 256 || update.max_tokens > 16_384) {
      throw new ContractError("llm max_tokens must be an integer between 256 and 16384");
    }
    payload.max_tokens = update.max_tokens;
  }
  if (update.timeout_seconds !== undefined) {
    if (!Number.isFinite(update.timeout_seconds) || update.timeout_seconds < 1 || update.timeout_seconds > 300) {
      throw new ContractError("llm timeout_seconds must be between 1 and 300");
    }
    payload.timeout_seconds = update.timeout_seconds;
  }
  return payload;
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

function requestIdentifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value)) {
    throw new ContractError(`${label} is invalid`);
  }
  return value;
}

/** Combines caller cancellation with the normal public-request timeout. */
function combinedRequestSignal(timeoutMs: number, callerSignal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!callerSignal) return timeout;
  const abortSignal = AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  if (typeof abortSignal.any === "function") return abortSignal.any([timeout, callerSignal]);
  const controller = new AbortController();
  const abort = () => controller.abort();
  timeout.addEventListener("abort", abort, { once: true });
  callerSignal.addEventListener("abort", abort, { once: true });
  if (timeout.aborted || callerSignal.aborted) controller.abort();
  return controller.signal;
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
