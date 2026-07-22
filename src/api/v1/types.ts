import type { components } from "./generated";

type BackendSchemas = components["schemas"];

export type DocumentType = "CI" | "PL" | "BL" | "CO" | "SUPPORTING" | "UNKNOWN";
export type ExecutionStatus = "succeeded" | "partial" | "failed";
export type Assessment = "no_issue_detected" | "issues_detected" | "indeterminate";
export type ReviewDisposition = "auto_review_complete" | "human_review_required" | "blocked";
export type AssuranceLevel = "diagnostic" | "production_candidate" | "production";
export type Decision = "approved" | "rejected";

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
  roles: Array<"reviewer" | "approver" | "auditor" | "admin">;
}

/**
 * Safe, display-only LOCAL UAT runtime identity owned by the Backend.
 *
 * This intentionally contains no URL, credential, model token accounting, or
 * provider-internal identifiers.  It is not a release admission contract.
 */
export type LocalUatMetadata = BackendSchemas["UatMetadataResponse"];
export type ModelExecutionSummary = BackendSchemas["ModelExecutionSummary"];

export interface CaseSummary {
  case_id: string;
  org_id: string;
  external_reference?: string;
  title: string;
  status: "open" | "in_review" | "closed";
  revision: number;
  updated_at: string;
  latest_run_id?: string;
}

export interface CaseDocument {
  document_id: string;
  case_id: string;
  document_type: DocumentType;
  filename: string;
  media_type: "text/plain";
  content_text?: string;
  content_sha256: string;
  byte_size: number;
  character_count: number;
  created_by: string;
  created_at: string;
}

export type VerificationAssertionRecord = BackendSchemas["VerificationAssertionRecord"];
export type SupportingDocumentCreate = BackendSchemas["SupportingDocumentCreate"];
// The Backend wire contract permits omitted default arrays. The boundary
// decoder materializes them so rendering code never confuses absence with an
// unverified document.
export type SupportingDocumentRecord = Omit<BackendSchemas["SupportingDocumentRecord"], "hs_codes" | "verification_assertions"> & {
  hs_codes: string[];
  verification_assertions: VerificationAssertionRecord[];
};
export type VerificationAssertionCreate = BackendSchemas["VerificationAssertionCreate"];

export interface CaseDetail extends CaseSummary {
  created_at: string;
  documents: CaseDocument[];
  runs: RunSummary[];
}

export interface RunSummary {
  review_run_id: string;
  case_id: string;
  org_id: string;
  parent_run_id?: string;
  execution_status: ExecutionStatus;
  assessment?: Assessment;
  review_disposition?: ReviewDisposition;
  assurance_level?: AssuranceLevel;
  created_at: string;
}

export interface SourceReference {
  source_id: string;
  document_id?: string;
  evidence_id?: string;
  label: string;
  quote?: string;
  uri?: string;
  page?: number;
  start_offset?: number;
  end_offset?: number;
}

export interface ExtractedField {
  field_id: string;
  document_id: string;
  name: string;
  field_path: string;
  value: string | number | boolean | null;
  confidence?: number;
  source_ids: string[];
}

export interface ReviewIssue {
  issue_id: string;
  code: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  source_ids: string[];
}

export interface EvidenceItem {
  evidence_id: string;
  title: string;
  law_id: string;
  article?: string;
  excerpt: string;
  source_uri: string;
  source_hash: string;
  effective_date?: string;
}

export interface ComplianceFinding {
  finding_id: string;
  code: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  evidence_ids: string[];
  source_ids: string[];
}

export interface NarrativeClaim {
  claim_id: string;
  text: string;
  citation_ids: string[];
  material?: boolean;
}

export interface NarrativeReport {
  title: string;
  summary: NarrativeClaim[];
  document_consistency: NarrativeClaim[];
  regulatory_review: NarrativeClaim[];
  impact: NarrativeClaim[];
  recommended_actions: NarrativeClaim[];
  generated_by: "claude" | "deterministic_fallback" | "backend_policy_overlay";
  citation_verification: "passed";
}

export interface CompletionEligibility {
  eligible: boolean;
  profile_id?: string | null;
  scope: string[];
  unmet_reason_codes: string[];
}

export interface ActionTrace {
  action_id: string;
  cycle: number;
  tool: string;
  status: "planned" | "running" | "succeeded" | "failed" | "denied" | "deferred";
  reason_code: string;
  input_source_ids: string[];
  observation?: string;
  started_at: string;
  finished_at?: string;
}

export interface ReviewStageEvent {
  event_id: string;
  job_id: string;
  sequence: number;
  stage: string;
  status: "pending" | "running" | "succeeded" | "failed";
  message: string;
  occurred_at: string;
}

export type CorrectionOperation = BackendSchemas["CorrectionOperation"];
export type RevisionAction = BackendSchemas["RevisionAction"];
export type RevisionProposalCreate = BackendSchemas["RevisionProposalCreate"];
export type CorrectionProposal = Omit<BackendSchemas["CorrectionProposalRecord"], "actions" | "corrections"> & {
  actions: RevisionAction[];
  corrections: CorrectionOperation[];
};
export type CorrectionProposalDecisionCreate = BackendSchemas["CorrectionProposalDecisionCreate"];
export type CorrectionProposalDecisionResponse = Omit<BackendSchemas["CorrectionProposalDecisionResponse"], "job"> & {
  job?: JobRecord | null;
};

export interface RequiredAction {
  action_id: string;
  code: string;
  description: string;
  severity?: "low" | "medium" | "high" | "critical";
  source_ids: string[];
  status?: "required" | "completed" | "waived";
}

export interface ReleaseIdentity extends Record<string, unknown> {
  agent_package_version: string;
  agent_code_snapshot_sha256?: string;
  model_id: string;
  model_revision?: string;
  extraction_prompt_sha256: string;
  extraction_schema_sha256?: string;
  coordinator_prompt_sha256?: string;
  narrative_prompt_sha256?: string;
  chat_prompt_sha256?: string;
  result_schema_sha256: string;
  policy_id: string;
  tool_registry_id: string;
  evidence_snapshot_id?: string | null;
  evidence_runtime_v3_sha256?: string | null;
  assertion_trust_store_sha256?: string;
  assertion_trust_store_state?: "unreleased" | "active";
  release_profile_id?: string | null;
  release_profile_state?: "unreleased" | "approved";
  kill_switch_active?: boolean;
  backend_auto_completion_enabled?: boolean;
  backend_auto_completion_approval_digest?: string | null;
}

export interface ReviewRun extends RunSummary {
  case_revision: number;
  review_as_of?: string | null;
  trade_type?: "import" | "export" | null;
  input_document_manifest?: Array<{
    document_id: string;
    document_type: "CI" | "PL" | "BL" | "CO" | "UNKNOWN";
    content_sha256: string;
  }>;
  auto_completion_profile?: {
    profile_id: string | null;
    approved_document_types: Array<"CI" | "PL" | "BL" | "CO">;
    approved_required_document_codes: string[];
    approval_digest: string | null;
  };
  review_stage_trace?: Array<{
    sequence: number;
    stage: string;
    status: "completed" | "needs_review" | "partial" | "failed";
    reason_ids: string[];
  }>;
  result_digest?: string;
  input_manifest_digest?: string;
  agent_input_manifest_sha256?: string;
  provider_result_sha256?: string;
  stages: ReviewStageEvent[];
  fields: ExtractedField[];
  issues: ReviewIssue[];
  evidence: EvidenceItem[];
  /**
   * Backend-attested summary derived from the public Agent result. This is
   * diagnostic data only; the browser never calls the Evidence service.
   */
  evidence_retrieval?: {
    status: "ok" | "partial" | "failed";
    coverage: "complete" | "partial" | "unknown";
    requirements_found: boolean | null;
    result_count: number;
  };
  /** Safe Backend projection of the Agent provider-call audit. */
  model_execution_summary?: ModelExecutionSummary;
  /** Safe Backend projection of the V3 narrative Claude-call audit. */
  narrative_execution_summary?: ModelExecutionSummary;
  findings: ComplianceFinding[];
  sources: SourceReference[];
  narrative_report?: NarrativeReport;
  completion_eligibility?: CompletionEligibility;
  action_trace: ActionTrace[];
  corrections: CorrectionProposal[];
  required_actions: RequiredAction[];
  release_identity?: ReleaseIdentity;
}

export interface GroundedAnswer {
  answer_id: string;
  review_run_id: string;
  case_id: string;
  org_id: string;
  bound_result_digest: string;
  status: "answered" | "insufficient_evidence" | "out_of_scope";
  claims: NarrativeClaim[];
  generation_mode?: "claude" | "deterministic_fallback";
  model_execution_summary?: ModelExecutionSummary;
  snapshot_id: string;
  created_at: string;
}

export interface AuditEvent {
  event_id: string;
  org_id: string;
  case_id?: string | null;
  review_run_id?: string | null;
  event_type: string;
  actor_display: string;
  target_id: string;
  occurred_at: string;
  summary: string;
}

export interface UatScenario {
  scenario_id: string;
  title: string;
  description: string;
  category: "clean" | "mismatch" | "missing" | "security" | "failure";
  assurance_level: "diagnostic" | "production_candidate";
  expected: {
    execution_status: "succeeded";
    assessment: Assessment;
    review_disposition: ReviewDisposition;
  };
}

export type CreateCaseRequest = BackendSchemas["CaseCreate"];

export type AddDocumentRequest = Omit<BackendSchemas["TextDocumentCreate"], "document_type"> & {
  document_type: DocumentType;
};

export type EnqueueReviewRequest = BackendSchemas["ReviewEnqueueRequest"];

export type DeliveryReconciliationCreate = BackendSchemas["DeliveryReconciliationCreate"];

export type AnswerRequest = BackendSchemas["GroundedQuestion"];

export type JobRecord = Omit<BackendSchemas["JobView"], "status"> & {
  status: "queued" | "running" | "succeeded" | "failed" | "delivery_uncertain";
};

export interface ChatRecord {
  message_id: string;
  review_run_id: string;
  case_id: string;
  org_id: string;
  question: string;
  answer: string;
  answer_status: "answered" | "insufficient_evidence" | "out_of_scope";
  citations: Array<{ citation_id?: string; evidence_id?: string; source_id?: string; reference_id?: string; kind?: string; label?: string }>;
  generation_mode: "claude" | "deterministic_fallback";
  model_execution_summary: ModelExecutionSummary;
  bound_result_digest: string;
  idempotency_key: string;
  idempotency_request_digest: string;
  created_by: string;
  created_at: string;
}

export type HumanDecisionRecord = BackendSchemas["HumanDecisionRecord"];

export interface Paged<T> {
  items: T[];
  next_cursor?: string;
}

export interface ApiProblem {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code?: string;
  request_id?: string;
}
