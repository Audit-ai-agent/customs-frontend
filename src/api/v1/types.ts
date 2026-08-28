/** Exact Browser projection of the compact Backend API v1 contract. */

export type TradeType = "import" | "export";
export type KnowledgeTradeType = TradeType | "both";

/**
 * Text-document types accepted by the current review workflow.  The Browser
 * deliberately names operational evidence separately from the four core
 * commercial documents so reviewers do not have to disguise it as a CI/PL.
 */
export type DocumentType =
  | "CI"
  | "PL"
  | "BL"
  | "CO"
  | "AWB"
  | "EXPORT_DECLARATION"
  | "SUPPORTING_EVIDENCE"
  | "UNKNOWN";
export type ReviewDisposition = "human_review_required" | "blocked";
export type ExecutionStatus = "succeeded" | "partial" | "failed";
export type Assessment = "no_issue_detected" | "issues_detected" | "indeterminate";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface AuthConfig {
  issuer: string;
  audience: string;
  client_id: string;
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string | null;
  scopes?: string[];
  flow?: "authorization_code_pkce_s256";
  token_storage?: "memory_only";
}

export interface Session {
  subject: string;
  org_id: string;
  roles: Array<"reviewer" | "approver">;
}

export interface CaseSummary {
  case_id: string;
  org_id: string;
  external_reference?: string | null;
  title: string;
  status: "open" | "in_review" | "closed";
  revision: number;
  /**
   * Backend-owned optional metadata. The workbench reads only the two
   * documented Functional-UAT markers and never renders this object directly.
   */
  metadata?: Record<string, unknown>;
  updated_at: string;
}

export type CaseDetail = CaseSummary;

export interface CaseDocument {
  document_id: string;
  case_id: string;
  document_type: DocumentType;
  filename: string;
  media_type: "text/plain";
  content_sha256: string;
  byte_size: number;
  character_count: number;
  replaces_document_id?: string | null;
  superseded_by_document_id?: string | null;
  superseded_at?: string | null;
  created_by: string;
  created_at: string;
}

export interface DocumentView {
  record: CaseDocument;
  content_text: string;
}

/**
 * A binary source is intentionally separate from a CaseDocument.  It is not
 * part of the text-review input until a reviewer explicitly confirms edited
 * extraction text through the dedicated Backend route.
 */
export type DocumentAssetMediaType = "application/pdf" | "image/jpeg" | "image/png";

export interface DocumentAsset {
  asset_id: string;
  case_id: string;
  document_type: DocumentType;
  filename: string;
  media_type: DocumentAssetMediaType;
  byte_size: number;
  page_count: number;
  pixel_count: number;
  created_by: string;
  created_at: string;
}

export interface ExtractionBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractionSpan {
  span_id: string;
  ordinal: number;
  text: string;
  bbox?: ExtractionBoundingBox | null;
  reading_order: number;
}

export interface ExtractionPage {
  page_number: number;
  width: number;
  height: number;
  coordinate_unit: "pixels" | "pdf_points";
  spans: ExtractionSpan[];
}

/**
 * This is a human-review preview only.  It deliberately excludes the source
 * hash, object path, canonical-text hash, and provider diagnostics.
 */
export interface DocumentExtractionPreview {
  status: "preview_ready" | "needs_review" | "unavailable";
  extractor_revision?: string | null;
  pages: ExtractionPage[];
  warnings: string[];
}

export interface ExtractionJob {
  extraction_job_id: string;
  asset_id: string;
  case_id: string;
  status: "queued" | "preview_ready" | "needs_review" | "unavailable" | "failed";
  result?: DocumentExtractionPreview | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentAssetExtraction {
  asset: DocumentAsset;
  job: ExtractionJob;
}

/**
 * Raster extraction is deliberately a second, additive preview contract.  It
 * does not change the existing born-digital PDF/text-layer extraction v1
 * contract above, and none of these values are Review input until a reviewer
 * explicitly confirms edited text.
 */
export type RasterDocumentType =
  | "bill_of_lading"
  | "commercial_invoice"
  | "packing_list";

export interface RasterExtractionPoint {
  x: number;
  y: number;
}

/** Optional quadrilateral/polygon supplied in the same normalized space as bbox. */
export interface RasterExtractionPolygon {
  points: RasterExtractionPoint[];
}

export interface RasterExtractionSpan {
  span_id: string;
  ordinal: number;
  text: string;
  bbox: ExtractionBoundingBox | null;
  polygon?: RasterExtractionPolygon | null;
  confidence: number;
  reading_order: number;
}

export interface RasterExtractionPage {
  page_number: number;
  width: number;
  height: number;
  coordinate_unit: "pixels";
  spans: RasterExtractionSpan[];
}

/** A field candidate remains evidence-linked OCR output, not a confirmed fact. */
export interface RasterFieldCandidate {
  field_id: string;
  value: string;
  confidence: number;
  evidence_span_ids: string[];
  bbox?: ExtractionBoundingBox | null;
}

export interface RasterTableCell {
  cell_id: string;
  row_index: number;
  column_index: number;
  text: string;
  bbox: ExtractionBoundingBox | null;
  confidence: number;
  evidence_span_ids: string[];
}

export interface RasterTableRow {
  row_index: number;
  cells: RasterTableCell[];
}

export interface RasterTable {
  table_id: string;
  page_number: number;
  bbox?: ExtractionBoundingBox | null;
  rows: RasterTableRow[];
}

/**
 * Safe Browser projection of raster OCR/layout output.  Source hashes,
 * canonical text hashes, provider diagnostics, and raw source bytes are not
 * part of this public preview model.
 */
export interface RasterDocumentExtractionPreview {
  status: "preview_ready" | "needs_review" | "unavailable";
  /**
   * A usable `preview_ready` result has both values.  `needs_review` may
   * deliberately omit both when the document type cannot be classified
   * safely (for example unsupported EXIF orientation or an unknown form).
   */
  document_type?: RasterDocumentType | null;
  classification_confidence?: number | null;
  pages: RasterExtractionPage[];
  field_candidates: RasterFieldCandidate[];
  tables: RasterTable[];
  warnings: string[];
  needs_review_reasons: string[];
}

export interface RasterExtractionJob {
  raster_extraction_job_id: string;
  asset_id: string;
  case_id: string;
  profile_revision: string;
  status: "queued" | "running" | "preview_ready" | "needs_review" | "unavailable" | "failed";
  attempt_count: number;
  result?: RasterDocumentExtractionPreview | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentAssetRasterExtraction {
  asset: DocumentAsset;
  job: RasterExtractionJob;
  /** True only when Backend reused the same asset + currently active profile job. */
  idempotency_reused: boolean;
  /** Null only when Agent currently has no active safe raster profile. */
  current_profile_revision: string | null;
  /** Historical job output must not be overlaid with the current profile. */
  profile_superseded: boolean;
}

/**
 * Raster text extraction is intentionally independent from the structured
 * raster preview above.  It carries only editable OCR text by page; it never
 * claims a table, cell, field, or source geometry.
 */
export interface RasterTextExtractionPage {
  page_number: number;
  text: string;
  confidence: number | null;
}

/** Safe Browser projection of the text-only raster OCR candidate. */
export interface RasterTextDocumentExtractionPreview {
  status: "preview_ready" | "needs_review" | "unavailable";
  pages: RasterTextExtractionPage[];
  /**
   * Provider-ordered whole-document text when available.  Browser otherwise
   * derives the editable draft from page order without inventing structure.
   */
  canonical_text: string | null;
  warnings: string[];
  needs_review_reasons: string[];
}

export interface RasterTextExtractionJob {
  raster_text_extraction_job_id: string;
  asset_id: string;
  case_id: string;
  profile_revision: string;
  status: "queued" | "running" | "preview_ready" | "needs_review" | "unavailable" | "failed";
  attempt_count: number;
  result?: RasterTextDocumentExtractionPreview | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Text-only OCR has its own activation pointer.  It must not be interpreted
 * as an approval of the structured raster OCR/layout profile.
 */
export interface DocumentAssetRasterTextExtraction {
  asset: DocumentAsset;
  job: RasterTextExtractionJob;
  idempotency_reused: boolean;
  current_profile_revision: string | null;
  profile_superseded: boolean;
}

export interface ReviewReport {
  overall_status: "needs_review" | "blocked";
  summary: string;
  disclaimer: string;
  /**
   * The Agent's eight grounded report sections.  These are rendered directly;
   * the Browser does not manufacture a second report from the raw result.
   */
  sections: ReportSection[];
}

export type ReportSectionName =
  | "conclusion"
  | "execution_process"
  | "document_comparison"
  | "issues_and_causes"
  | "legal_evidence"
  | "impact"
  | "next_actions"
  | "limitations";

export interface ReportClaim {
  claim_id: string;
  text: string;
  fact_ids: string[];
  comparison_ids: string[];
  evidence_ids: string[];
}

export interface ReportSection {
  section: ReportSectionName;
  title: string;
  claims: ReportClaim[];
}

export interface ReviewFinding {
  finding_id: string;
  code: string;
  message: string;
  kind: "validation_issue" | "regulatory_finding";
  severity: "low" | "medium" | "high" | "critical";
  comparison_id?: string | null;
  document_ids: string[];
  fact_ids: string[];
  evidence_ids: string[];
}

export interface EvidenceItem {
  evidence_id: string;
  item_id: string;
  title: string;
  text: string;
  source_uri: string;
  source_type: string;
  source_hash: string;
  law_id?: string | null;
  law_name?: string | null;
}

export interface RequiredAction {
  action_code: string;
  message: string;
  finding_ids: string[];
}

export type WorkflowStageName =
  | "classify_documents"
  | "extract_facts"
  | "normalize_facts"
  | "match_documents"
  | "validate_documents"
  | "reextract_documents"
  | "retrieve_evidence"
  | "generate_result";

export interface WorkflowStage {
  stage: WorkflowStageName;
  status: "completed" | "skipped" | "needs_review" | "failed";
  attempt_count: number;
  summary: string;
}

export interface ReextractionRecord {
  document_id: string;
  attempt_count: 1;
  requested_fields: string[];
  status: "completed" | "unavailable";
}

export interface AgentWorkflow {
  status: "completed" | "partial" | "failed";
  stages: WorkflowStage[];
  reextractions: ReextractionRecord[];
  planner: PlannerTrace;
}

export type PlannerActionName =
  | "analyze_documents"
  | "apply_human_corrections"
  | "compare_documents"
  | "reextract_documents"
  | "retrieve_evidence"
  | "generate_report";

export interface PlannerAction {
  cycle: 1 | 2;
  action: PlannerActionName;
  status: "completed" | "skipped" | "needs_review" | "failed";
  summary: string;
  correction_proposal_ids: string[];
}

export interface PlannerTrace {
  cycle_count: 1 | 2;
  actions: PlannerAction[];
}

export interface SourceReference {
  source_kind: "document";
  document_id: string;
  quote: string;
  /** Zero-based occurrence of the source quote in the document. */
  occurrence: number;
}

/**
 * An approved person-supplied value intentionally has no fabricated quote in
 * the source document.  It remains visibly separate from extracted facts.
 */
export interface HumanProvidedSourceReference {
  source_kind: "human_provided";
  document_id: string;
  correction_proposal_id: string;
  reason: string;
}

export type FactSourceReference = SourceReference | HumanProvidedSourceReference;

export function isDocumentSource(source: FactSourceReference): source is SourceReference {
  return source.source_kind === "document";
}

export interface DocumentFact {
  fact_id: string;
  name: string;
  raw_value: string;
  normalized_value?: string | null;
  unit?: string | null;
  source: FactSourceReference;
}

export interface DocumentLineItem {
  item_id: string;
  source: SourceReference;
  facts: DocumentFact[];
}

export interface DocumentAnalysis {
  document_id: string;
  filename: string;
  declared_type: string | null;
  document_type:
    | "invoice"
    | "packing_list"
    | "bill_of_lading"
    | "certificate_of_origin"
    | "air_waybill"
    | "export_declaration"
    | "supporting_evidence"
    | "unknown";
  classification_source: SourceReference | null;
  extraction_status: "complete" | "needs_review";
  facts: DocumentFact[];
  line_items: DocumentLineItem[];
  warnings: Array<{ code: string; message: string }>;
}

export interface ComparisonOperand {
  document_id: string | null;
  item_id?: string | null;
  fact_ids: string[];
  display_value?: string | null;
}

export interface ReviewComparison {
  comparison_id: string;
  rule_code: string;
  status: "pass" | "skip" | "mismatch" | "needs_review";
  left: ComparisonOperand;
  right: ComparisonOperand;
  expected_value?: string | null;
  observed_value?: string | null;
  unit?: string | null;
  message: string;
}

export interface ReviewerDecisionHistoryItem {
  status: "confirmed" | "needs_information" | "resolved";
  reason: string;
  decided_by: string;
  decided_at: string;
}

export interface ReviewerDecision extends ReviewerDecisionHistoryItem {
  finding_id: string;
  history: ReviewerDecisionHistoryItem[];
}

export interface ReviewRunSummary {
  review_run_id: string;
  case_id: string;
  job_id: string;
  review_as_of: string;
  trade_type: TradeType;
  execution_status: ExecutionStatus;
  assessment: Assessment;
  review_disposition: ReviewDisposition;
  result_digest: string;
  finding_count: number;
  reviewer_decision_count: number;
  created_at: string;
  /** Present when this run was created from approved corrections on another run. */
  parent_review_run_id?: string | null;
  /** The approved proposal IDs applied to produce this child run. */
  applied_correction_proposal_ids?: string[];
}

/**
 * Safe, user-facing dates for the distinct sources used by one Evidence
 * retrieval.  They are provenance notices, not a legal-effect conclusion.
 */
export interface EvidenceTemporalContext {
  law_as_of: string;
  hsk_snapshot_as_of: string;
  requirements_snapshot_as_of: string;
}

/**
 * Availability is deliberately separate from the three displayed dates.  A
 * historical Review can retain a baseline HSK or requirements date while the
 * corresponding official archive is unavailable, so the Browser must never
 * infer coverage from the date alone.
 */
export interface EvidenceTemporalCoverage {
  law: "covered" | "unavailable";
  hsk: "covered" | "unavailable";
  requirements: "covered" | "unavailable";
}

export interface ReviewRun {
  review_run_id: string;
  case_id: string;
  org_id: string;
  job_id: string;
  case_revision: number;
  review_as_of: string;
  trade_type: TradeType;
  execution_status: ExecutionStatus;
  assessment: Assessment;
  review_disposition: ReviewDisposition;
  completion_eligibility: {
    eligible: false;
    unmet_reason_codes: string[];
  };
  agent_schema_version: "3.2";
  agent_status: "needs_review" | "blocked";
  agent_engine?: { kind: "deterministic" | "claude"; model_id: string } | null;
  report: ReviewReport;
  workflow: AgentWorkflow;
  document_analyses: DocumentAnalysis[];
  comparisons: ReviewComparison[];
  evidence: EvidenceItem[];
  findings: ReviewFinding[];
  required_actions: RequiredAction[];
  reviewer_decisions: ReviewerDecision[];
  /**
   * Additive for the law-history profile.  Older three-law Review Runs omit
   * this field and must continue to render normally.
   */
  temporal_context?: EvidenceTemporalContext | null;
  /**
   * Additive archive availability for a dated Evidence retrieval.  It is
   * present only together with temporal_context; older Review Runs remain
   * readable when both fields are absent.
   */
  temporal_coverage?: EvidenceTemporalCoverage | null;
  created_by: string;
  created_at: string;
  /** A child run keeps its parent for an auditable, non-destructive history. */
  parent_review_run_id?: string | null;
  /** Only the Backend decides which approved correction proposals were applied. */
  applied_correction_proposal_ids?: string[];
}

/** A link in an assistant answer back to an already displayed Case review item. */
export type CaseCitationKind = "fact" | "comparison" | "evidence";

export interface CaseCitation {
  kind: CaseCitationKind;
  reference_id: string;
}

export type AssistantAnswerScope =
  | "case_grounded"
  | "evidence_grounded"
  | "general_customs_guidance"
  | "clarification_needed"
  | "insufficient_evidence"
  | "out_of_scope";

/**
 * The standalone knowledge route has no Case facts or review evidence.  Keep
 * its answer scope narrower at the Browser boundary so it cannot accidentally
 * be rendered as a Case-grounded answer.
 */
export type KnowledgeAnswerScope = Exclude<
  AssistantAnswerScope,
  "case_grounded" | "evidence_grounded"
>;

/**
 * A structured correction draft returned by the Agent. It is only a proposal:
 * the Browser never mutates a review result directly.
 */
export interface AssistantCorrectionDraft {
  document_id: string;
  item_id?: string | null;
  fact_id?: string | null;
  field_name: string;
  new_value: string;
  unit?: string | null;
  reason: string;
}

/**
 * A source from a versioned trade-knowledge snapshot.  It deliberately has
 * no Case or Review Run identifier and can therefore be shown safely in both
 * the global knowledge assistant and a separately labelled guidance section.
 */
export interface GuidanceEvidenceCitation {
  kind: "guidance_evidence";
  /** Backend may retain this compatibility alias only when it equals source_id. */
  reference_id?: string;
  source_id: string;
  /**
   * A Backend-controlled source category from the versioned official-source
   * registry. Presentation maps every contract value to a Korean work label;
   * the code itself is never part of the normal reviewer surface.
   */
  source_kind: KnowledgeSourceKind;
  source_title: string;
  source_uri: string;
  as_of: string;
  snapshot_id: string;
  coverage: KnowledgeCoverage;
  /**
   * Present only for a two-scope checklist.  The index binds this citation to
   * exactly one independently resolved guidance scope.
   */
  resolution_index?: 0 | 1 | null;
}

export type KnowledgeCoverage = "covered" | "no_coverage" | "partial" | "unavailable";
export type GuidanceTradeDirection = "import" | "export" | "both";

/**
 * The safe, user-facing result of one bounded official-guidance lookup.
 * Registry hashes and source identifiers remain internal verification data.
 */
export interface GuidanceResolution {
  topic: string;
  scope: string;
  requested_direction: GuidanceTradeDirection;
  applicable_directions: Exclude<GuidanceTradeDirection, "both">[];
  coverage: KnowledgeCoverage;
  snapshot_id?: string | null;
  as_of: string;
  registry_version: "1.0" | "2.0";
}

/** Exactly two independently resolved V2 guidance scopes, in classifier order. */
export type GuidanceResolutionPair = readonly [GuidanceResolution, GuidanceResolution];

/** Registered source categories in the Backend OpenAPI contract. */
export type KnowledgeSourceKind =
  | "official_law"
  | "official_law_catalog"
  | "official_agency_guidance"
  | "official_requirement_reference"
  | "official_public_guidance"
  | "development_fixture";
/** The shared citation contract for Case and official-guidance answer sections. */
export type AssistantCitation = CaseCitation | GuidanceEvidenceCitation;
export function isCaseCitation(citation: AssistantCitation): citation is CaseCitation {
  return citation.kind !== "guidance_evidence";
}
export type AssistantAnswerSectionKind = "case_analysis" | "general_guidance" | "case_application";

/**
 * An answer can contain a Case-grounded section, a separately labelled
 * general guidance section, and a deterministic next-check section.  The UI
 * must not merge them: their evidence boundaries are intentionally different.
 */
export interface AssistantAnswerSection {
  kind: AssistantAnswerSectionKind;
  title: string;
  content: string;
  citations: AssistantCitation[];
  /** Only a multi-scope general-guidance section owns one resolution index. */
  resolution_index?: 0 | 1 | null;
}

/** The standalone knowledge route can render only general guidance sections. */
export interface KnowledgeAnswerSection {
  kind: "general_guidance";
  title: string;
  content: string;
  citations: GuidanceEvidenceCitation[];
  /** Only a multi-scope section owns one independently resolved scope. */
  resolution_index?: 0 | 1 | null;
}

/** Browser projection of one persisted assistant conversation. */
export interface AssistantConversation {
  conversation_id: string;
  review_run_id: string;
  title?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * User messages have no answer scope. Assistant answers use the bounded
 * Backend-owned enum so the UI can explain what the answer is grounded in.
 */
export interface AssistantMessage {
  message_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  answer_scope?: AssistantAnswerScope | null;
  citations: AssistantCitation[];
  suggested_questions: string[];
  correction_draft?: AssistantCorrectionDraft | null;
  /** Additive V3.3-style answer projection; absent on older stored messages. */
  answer_sections?: AssistantAnswerSection[];
  /** Present when this Case reply attempted one bounded official-guidance lookup. */
  guidance_resolution?: GuidanceResolution | null;
  /**
   * Additive V2 two-scope result.  It is XOR with guidance_resolution and
   * always has exactly two independently resolved scopes.
   */
  guidance_resolutions?: GuidanceResolutionPair | null;
  /** Present only when guidance_resolutions is present. */
  answer_format?: "multi_scope_checklist" | null;
  /** The pasted Case-chat text was not admitted as Review evidence. */
  case_input_notice?: "unregistered_document_text" | null;
  created_by: string;
  created_at: string;
}

/** A global, Case-independent conversation grounded in the official snapshot. */
export interface KnowledgeConversation {
  conversation_id: string;
  title?: string | null;
  trade_type: KnowledgeTradeType;
  /** Backend resolves an omitted create value before persisting the conversation. */
  as_of: string;
  /**
   * Resolved only after the first official-knowledge answer.  This technical
   * identifier is shown exclusively inside the opt-in verification details.
   */
  snapshot_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** A global knowledge message never carries Case or Review Run references. */
export interface KnowledgeMessage {
  message_id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  answer_scope?: KnowledgeAnswerScope | null;
  /** Global messages can only cite the official knowledge snapshot. */
  citations: GuidanceEvidenceCitation[];
  answer_sections?: KnowledgeAnswerSection[];
  suggested_questions: string[];
  /**
   * Backend-owned resolution metadata for a standalone assistant answer.
   * It is intentionally absent from user messages and every Case assistant
   * message, so the Browser cannot mistake general guidance for Case data.
   */
  knowledge_coverage?: KnowledgeCoverage | null;
  knowledge_snapshot_id?: string | null;
  knowledge_as_of?: string | null;
  /** Additive V2 scope/direction result; absent on legacy stored messages. */
  guidance_resolution?: GuidanceResolution | null;
  /** Additive V2 two-scope result; XOR with the legacy singular field. */
  guidance_resolutions?: GuidanceResolutionPair | null;
  /** Present only when guidance_resolutions is present. */
  answer_format?: "multi_scope_checklist" | null;
  created_by: string;
  created_at: string;
}

export interface KnowledgeMessageExchange {
  user_message: KnowledgeMessage;
  assistant_message: KnowledgeMessage;
}

export interface AssistantMessageExchange {
  user_message: AssistantMessage;
  assistant_message: AssistantMessage;
}

export type CorrectionProposalStatus = "proposed" | "approved" | "rejected";

export interface CorrectionDecision {
  status: "approved" | "rejected";
  reason: string;
  decided_by?: string;
  decided_at?: string;
}

/** Immutable lifecycle entry kept by Backend for proposal-to-child-run traceability. */
export interface CorrectionProposalHistoryEntry {
  event: "proposed" | "approved" | "rejected" | "applied";
  reason: string;
  actor: string;
  occurred_at: string;
}

/** A proposed fact correction tied to one review run; it cannot change source text. */
export interface CorrectionProposal {
  correction_proposal_id: string;
  review_run_id: string;
  finding_id?: string | null;
  document_id: string;
  item_id?: string | null;
  fact_id?: string | null;
  field_name: string;
  new_value: string;
  unit?: string | null;
  reason: string;
  status: CorrectionProposalStatus;
  created_by: string;
  created_at: string;
  decision?: CorrectionDecision | null;
  history: CorrectionProposalHistoryEntry[];
  /** A non-destructive link to a child review run, if Backend has created one. */
  applied_review_run_id?: string | null;
}

export interface JobRecord {
  job_id: string;
  case_id: string;
  review_run_id: string;
  status: JobStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCaseRequest {
  title: string;
  external_reference?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AddDocumentRequest {
  document_type: DocumentType;
  filename: string;
  media_type?: "text/plain";
  content_text: string;
  replaces_document_id?: string | null;
}

/** Raw file bytes remain in the Browser-to-Backend request body only. */
export interface UploadDocumentAssetRequest {
  document_type: DocumentType;
  filename: string;
  media_type: DocumentAssetMediaType;
  content: Blob;
}

/**
 * Only reviewer-confirmed text can enter the existing text-review workflow.
 * Exactly one preview job identifier is accepted by Backend.  The original
 * PDF/text-layer and structured-raster identifiers remain additive so an
 * independently approved text-only raster profile cannot change either path.
 */
export interface ConfirmDocumentExtractionRequest {
  extraction_job_id?: string;
  raster_extraction_job_id?: string;
  raster_text_extraction_job_id?: string;
  filename: string;
  content_text: string;
  replaces_document_id?: string | null;
}

export interface EnqueueReviewRequest {
  review_as_of?: string;
  trade_type?: TradeType;
}

export interface FindingDecisionRequest {
  status: "confirmed" | "needs_information" | "resolved";
  reason: string;
}

export interface CreateAssistantConversationRequest {
  title?: string;
}

export interface SendAssistantMessageRequest {
  content: string;
}

export interface CreateKnowledgeConversationRequest {
  title?: string;
  trade_type?: KnowledgeTradeType;
  as_of?: string;
}

export interface SendKnowledgeMessageRequest {
  content: string;
}

export interface CreateCorrectionProposalRequest {
  document_id: string;
  item_id?: string | null;
  fact_id?: string | null;
  field_name: string;
  new_value: string;
  unit?: string | null;
  reason: string;
  finding_id?: string | null;
}

export interface CorrectionDecisionRequest {
  status: "approved" | "rejected";
  reason: string;
}

export interface CreateRevisionRequest {
  proposal_ids: string[];
}
