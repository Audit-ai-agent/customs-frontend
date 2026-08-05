/** Exact Browser projection of the compact Backend API v1 contract. */

export type DocumentType = "CI" | "PL" | "BL" | "CO" | "UNKNOWN";
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
  roles: Array<"reviewer">;
}

export interface CaseSummary {
  case_id: string;
  org_id: string;
  external_reference?: string | null;
  title: string;
  status: "open" | "in_review" | "closed";
  revision: number;
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
  created_by: string;
  created_at: string;
}

export interface ReviewReport {
  overall_status: "needs_review" | "blocked";
  summary: string;
  disclaimer: string;
}

export interface ReviewFinding {
  code: string;
  message: string;
  kind: "validation_issue" | "regulatory_finding";
  severity: "low" | "medium" | "high" | "critical";
}

export interface EvidenceItem {
  title: string;
  text: string;
  law_id?: string | null;
  law_name?: string | null;
}

export interface RequiredAction {
  action_code: string;
  message: string;
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
  report: ReviewReport;
  evidence: EvidenceItem[];
  findings: ReviewFinding[];
  required_actions: RequiredAction[];
  created_by: string;
  created_at: string;
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
}

export interface EnqueueReviewRequest {
  review_as_of?: string;
  trade_type?: "import" | "export";
}
