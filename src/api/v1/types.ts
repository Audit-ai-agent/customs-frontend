/** Exact Browser projection of the compact Backend API v1 contract. */

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

export interface CaseClosure {
  disposition: "cleared" | "returned";
  reason: string;
  review_run_id: string;
  closed_by: string;
  closed_at: string;
}

export interface CaseSummary {
  case_id: string;
  org_id: string;
  external_reference?: string | null;
  title: string;
  status: "open" | "in_review" | "closed";
  revision: number;
  updated_at: string;
  closure?: CaseClosure | null;
}

export type CaseDetail = CaseSummary;

export interface CaseClosureRequest {
  disposition: "cleared" | "returned";
  reason: string;
}

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
  trade_type: "import" | "export";
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

export interface ReviewRun {
  review_run_id: string;
  case_id: string;
  org_id: string;
  job_id: string;
  case_revision: number;
  review_as_of: string;
  trade_type: "import" | "export";
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
  created_by: string;
  created_at: string;
  /** A child run keeps its parent for an auditable, non-destructive history. */
  parent_review_run_id?: string | null;
  /** Only the Backend decides which approved correction proposals were applied. */
  applied_correction_proposal_ids?: string[];
}

/** A link in an assistant answer back to an already displayed review fact. */
export type AssistantCitationKind = "fact" | "comparison" | "evidence";

export interface AssistantCitation {
  kind: AssistantCitationKind;
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
  created_by: string;
  created_at: string;
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

/* ── binary document assets and the extraction preview boundary ── */

export type DocumentAssetMediaType = "application/pdf" | "image/jpeg" | "image/png";

/** Safe Browser projection of one immutable uploaded binary document. */
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

export type ExtractionJobStatus = "queued" | "preview_ready" | "needs_review" | "unavailable" | "failed";

export interface ExtractionSpan {
  span_id: string;
  ordinal: number;
  text: string;
  /** Normalized page-relative rectangle; absent when the adapter has no geometry. */
  bbox?: Record<string, number> | null;
  reading_order: number;
}

export interface ExtractionPage {
  page_number: number;
  width: number;
  height: number;
  coordinate_unit: "pixels" | "pdf_points";
  spans: ExtractionSpan[];
}

/** A human-editable extraction candidate; never a verified review fact. */
export interface ExtractionPreview {
  status: "preview_ready" | "needs_review" | "unavailable";
  pages: ExtractionPage[];
  warnings: string[];
  extractor_revision?: string | null;
}

export interface ExtractionJob {
  extraction_job_id: string;
  asset_id: string;
  case_id: string;
  status: ExtractionJobStatus;
  error_code?: string | null;
  result?: ExtractionPreview | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExtractionJobEnvelope {
  asset: DocumentAsset;
  job: ExtractionJob;
}

export interface ConfirmExtractedTextRequest {
  extraction_job_id: string;
  content_text: string;
  filename: string;
  replaces_document_id?: string | null;
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

export interface EnqueueReviewRequest {
  review_as_of?: string;
  trade_type?: "import" | "export";
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

// ── Backend-derived trade views (HSK / CO / duty) ──────────────

export interface HsAncestor {
  level: number;
  code: string;
  name_ko: string;
}

export interface HsCandidateBasis {
  document_id: string;
  fact_id: string;
  fact_name: string;
  raw_value: string;
}

export interface HsCandidate {
  code: string;
  name_ko?: string | null;
  name_en?: string | null;
  ancestors: HsAncestor[];
  confidence: number;
  in_reference: boolean;
  recommended: boolean;
  basis: HsCandidateBasis[];
}

export interface HsSelectionHistoryEntry {
  code: string;
  reason: string;
  selected_by: string;
  selected_at: string;
}

export interface HsSelection {
  code: string;
  reason: string;
  selected_by: string;
  selected_at: string;
  history: HsSelectionHistoryEntry[];
}

export interface HsClassification {
  review_run_id: string;
  case_id: string;
  reference: { as_of: string; source: string };
  candidates: HsCandidate[];
  selection?: HsSelection | null;
}

export interface HsSelectionRequest {
  code: string;
  reason: string;
}

export type OriginCheckField = "certificate_no" | "origin_country" | "hs_code";
export type OriginCheckStatus = "match" | "mismatch" | "missing";

export interface OriginCheck {
  field: OriginCheckField;
  certificate_value?: string | null;
  reference_value?: string | null;
  reference_document_id?: string | null;
  status: OriginCheckStatus;
}

export interface OriginFtaHint {
  agreement_code: string;
  agreement_name: string;
  origin_covered: boolean;
  certificate_form: string;
  source_uri: string;
}

export type OriginVerificationStatus =
  | "verified"
  | "mismatch"
  | "missing_certificate"
  | "needs_review";

export interface OriginVerification {
  review_run_id: string;
  case_id: string;
  status: OriginVerificationStatus;
  certificate?: {
    document_id: string;
    filename: string;
    extraction_status: string;
  } | null;
  origin_country?: string | null;
  checks: OriginCheck[];
  fta_hints: OriginFtaHint[];
}

export type DutyRateKind = "basic" | "fta";
export type DutyRequirementCode =
  | "origin_in_agreement"
  | "certificate_present"
  | "certificate_origin_match";

export interface DutyRateRequirement {
  code: DutyRequirementCode;
  satisfied: boolean;
}

export interface DutyRate {
  rate_kind: DutyRateKind;
  agreement_code?: string | null;
  label: string;
  rate_pct: number;
  source_uri: string;
  requirements: DutyRateRequirement[];
  applicable: boolean;
}

export interface DutyEstimate {
  rate_kind: DutyRateKind;
  agreement_code?: string | null;
  rate_pct: number;
  duty_amount: number;
  vat_rate_pct: number;
  vat_amount: number;
  total_estimated: number;
  currency: string;
}

export type DutyAssessmentStatus =
  | "estimated"
  | "hs_code_unavailable"
  | "rates_unavailable"
  | "value_unavailable";

export interface DutyAssessment {
  review_run_id: string;
  case_id: string;
  status: DutyAssessmentStatus;
  reference: { as_of: string; source: string; disclaimer: string };
  hs_code?: {
    code: string;
    source: "reviewer_selection" | "document_fact";
    name_ko?: string | null;
  } | null;
  origin_country?: string | null;
  dutiable_value?: {
    amount: number;
    currency: string;
    basis: string;
    document_id?: string | null;
  } | null;
  rates: DutyRate[];
  applied?: DutyEstimate | null;
  savings?: {
    vs_basic_duty: number;
    currency: string;
    blocked_requirements: string[];
  } | null;
}
