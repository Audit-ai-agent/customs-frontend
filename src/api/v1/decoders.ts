import type {
  Assessment,
  AuthConfig,
  CaseDocument,
  CaseSummary,
  EvidenceItem,
  JobRecord,
  RequiredAction,
  ReviewFinding,
  ReviewReport,
  ReviewRun,
  Session,
} from "./types";

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export interface ApiProblem {
  detail: string;
  status: number;
  code?: string;
  request_id?: string;
}

export function decodeAuthConfig(value: unknown): AuthConfig {
  const raw = record(value, "authConfig");
  const endSessionEndpoint = optionalString(raw.end_session_endpoint, "authConfig.end_session_endpoint");
  return {
    issuer: requiredString(raw.issuer, "authConfig.issuer"),
    audience: requiredString(raw.audience, "authConfig.audience"),
    client_id: requiredString(raw.client_id, "authConfig.client_id"),
    authorization_endpoint: requiredString(raw.authorization_endpoint, "authConfig.authorization_endpoint"),
    token_endpoint: requiredString(raw.token_endpoint, "authConfig.token_endpoint"),
    ...(endSessionEndpoint === undefined ? {} : { end_session_endpoint: endSessionEndpoint }),
    ...(Array.isArray(raw.scopes)
      ? { scopes: raw.scopes.map((item, index) => requiredString(item, `authConfig.scopes[${index}]`)) }
      : {}),
    ...(raw.flow === undefined
      ? {}
      : { flow: literal(raw.flow, "authorization_code_pkce_s256", "authConfig.flow") }),
    ...(raw.token_storage === undefined
      ? {}
      : { token_storage: literal(raw.token_storage, "memory_only", "authConfig.token_storage") }),
  };
}

export function decodeSession(value: unknown): Session {
  const raw = record(value, "session");
  const roles = array(raw.roles, "session.roles").map((item, index) =>
    literal(item, "reviewer", `session.roles[${index}]`),
  );
  if (!roles.length) throw new ContractError("session must have a reviewer role");
  return {
    subject: requiredString(raw.subject, "session.subject"),
    org_id: requiredString(raw.org_id, "session.org_id"),
    roles,
  };
}

export function decodeCaseSummary(value: unknown): CaseSummary {
  const raw = record(value, "case");
  const status = requiredString(raw.status, "case.status");
  if (!isOneOf(status, ["open", "in_review", "closed"])) {
    throw new ContractError("case status is unsupported");
  }
  return {
    case_id: requiredString(raw.case_id, "case.case_id"),
    org_id: requiredString(raw.org_id, "case.org_id"),
    ...(raw.external_reference === undefined || raw.external_reference === null
      ? {}
      : { external_reference: requiredString(raw.external_reference, "case.external_reference") }),
    title: requiredString(raw.title, "case.title"),
    status,
    revision: nonNegativeInteger(raw.revision, "case.revision"),
    updated_at: requiredString(raw.updated_at, "case.updated_at"),
  };
}

export function decodeDocument(value: unknown): CaseDocument {
  const raw = record(value, "document");
  const type = requiredString(raw.document_type, "document.document_type");
  if (!isOneOf(type, ["CI", "PL", "BL", "CO", "UNKNOWN"])) {
    throw new ContractError("document type is unsupported");
  }
  if (raw.media_type !== "text/plain") {
    throw new ContractError("only text/plain documents are supported");
  }
  return {
    document_id: requiredString(raw.document_id, "document.document_id"),
    case_id: requiredString(raw.case_id, "document.case_id"),
    document_type: type,
    filename: requiredString(raw.filename, "document.filename"),
    media_type: "text/plain",
    content_sha256: sha256(raw.content_sha256, "document.content_sha256"),
    byte_size: nonNegativeInteger(raw.byte_size, "document.byte_size"),
    character_count: nonNegativeInteger(raw.character_count, "document.character_count"),
    created_by: requiredString(raw.created_by, "document.created_by"),
    created_at: requiredString(raw.created_at, "document.created_at"),
  };
}

export function decodeDocumentView(value: unknown): CaseDocument {
  const raw = record(value, "document view");
  return decodeDocument(raw.record);
}

export function decodeReviewRun(value: unknown): ReviewRun {
  const raw = record(value, "review run");
  const executionStatus = oneOf(raw.execution_status, ["succeeded", "partial", "failed"], "run.execution_status");
  const assessment = oneOf(
    raw.assessment,
    ["no_issue_detected", "issues_detected", "indeterminate"],
    "run.assessment",
  ) as Assessment;
  const disposition = oneOf(
    raw.review_disposition,
    ["human_review_required", "blocked"],
    "run.review_disposition",
  );
  return {
    review_run_id: requiredString(raw.review_run_id, "run.review_run_id"),
    case_id: requiredString(raw.case_id, "run.case_id"),
    org_id: requiredString(raw.org_id, "run.org_id"),
    job_id: requiredString(raw.job_id, "run.job_id"),
    case_revision: nonNegativeInteger(raw.case_revision, "run.case_revision"),
    review_as_of: isoDate(raw.review_as_of, "run.review_as_of"),
    trade_type: oneOf(raw.trade_type, ["import", "export"], "run.trade_type"),
    execution_status: executionStatus,
    assessment,
    review_disposition: disposition,
    completion_eligibility: decodeCompletionEligibility(raw.completion_eligibility),
    report: decodeReport(raw.report),
    evidence: array(raw.evidence, "run.evidence").map(decodeEvidence),
    findings: array(raw.findings, "run.findings").map(decodeFinding),
    required_actions: array(raw.required_actions, "run.required_actions").map(decodeAction),
    created_by: requiredString(raw.created_by, "run.created_by"),
    created_at: requiredString(raw.created_at, "run.created_at"),
  };
}

export function decodeJob(value: unknown): JobRecord {
  const raw = record(value, "job");
  return {
    job_id: requiredString(raw.job_id, "job.job_id"),
    case_id: requiredString(raw.case_id, "job.case_id"),
    review_run_id: requiredString(raw.review_run_id, "job.review_run_id"),
    status: oneOf(raw.status, ["queued", "running", "succeeded", "failed"], "job.status"),
    created_by: requiredString(raw.created_by, "job.created_by"),
    created_at: requiredString(raw.created_at, "job.created_at"),
    updated_at: requiredString(raw.updated_at, "job.updated_at"),
  };
}

export function decodeProblem(value: unknown, status: number): ApiProblem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { detail: "요청을 처리하지 못했습니다.", status };
  }
  const raw = value as Record<string, unknown>;
  return {
    detail: typeof raw.detail === "string" ? raw.detail : "요청을 처리하지 못했습니다.",
    status: typeof raw.status === "number" ? raw.status : status,
    ...(typeof raw.code === "string" ? { code: raw.code } : {}),
    ...(typeof raw.request_id === "string" ? { request_id: raw.request_id } : {}),
  };
}

function decodeCompletionEligibility(value: unknown): ReviewRun["completion_eligibility"] {
  const raw = record(value, "run.completion_eligibility");
  if (raw.eligible !== false) throw new ContractError("automatic completion is unavailable");
  const reasons = array(raw.unmet_reason_codes, "run.completion_eligibility.unmet_reason_codes")
    .map((item, index) => requiredString(item, `run.completion_eligibility.unmet_reason_codes[${index}]`));
  if (!reasons.length) throw new ContractError("human review reason is absent");
  return { eligible: false, unmet_reason_codes: reasons };
}

function decodeReport(value: unknown): ReviewReport {
  const raw = record(value, "run.report");
  return {
    overall_status: oneOf(raw.overall_status, ["needs_review", "blocked"], "run.report.overall_status"),
    summary: displayText(raw.summary, "run.report.summary"),
    disclaimer: displayText(raw.disclaimer, "run.report.disclaimer"),
  };
}

function decodeEvidence(value: unknown): EvidenceItem {
  const raw = record(value, "run.evidence item");
  return {
    title: displayText(raw.title, "run.evidence.title"),
    text: displayText(raw.text, "run.evidence.text"),
    ...(raw.law_id === undefined || raw.law_id === null
      ? {}
      : { law_id: requiredString(raw.law_id, "run.evidence.law_id") }),
    ...(raw.law_name === undefined || raw.law_name === null
      ? {}
      : { law_name: displayText(raw.law_name, "run.evidence.law_name") }),
  };
}

function decodeFinding(value: unknown): ReviewFinding {
  const raw = record(value, "run.finding");
  return {
    code: requiredString(raw.code, "run.finding.code"),
    message: displayText(raw.message, "run.finding.message"),
    kind: oneOf(raw.kind, ["validation_issue", "regulatory_finding"], "run.finding.kind"),
    severity: oneOf(raw.severity, ["low", "medium", "high", "critical"], "run.finding.severity"),
  };
}

function decodeAction(value: unknown): RequiredAction {
  const raw = record(value, "run.required_action");
  return {
    action_code: requiredString(raw.action_code, "run.required_action.action_code"),
    message: displayText(raw.message, "run.required_action.message"),
  };
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContractError(`${context}: object expected`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) throw new ContractError(`${context}: array expected`);
  return value;
}

function requiredString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 20_000 || /[\r\n\0]/u.test(value)) {
    throw new ContractError(`${context}: safe string expected`);
  }
  return value;
}

function displayText(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 20_000 || /\0/u.test(value)) {
    throw new ContractError(`${context}: display text expected`);
  }
  return value;
}

function optionalString(value: unknown, context: string): string | undefined {
  return value === undefined || value === null ? undefined : requiredString(value, context);
}

function nonNegativeInteger(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000_000) {
    throw new ContractError(`${context}: non-negative integer expected`);
  }
  return value;
}

function sha256(value: unknown, context: string): string {
  const result = requiredString(value, context);
  if (!/^[a-f0-9]{64}$/u.test(result)) throw new ContractError(`${context}: sha256 expected`);
  return result;
}

function isoDate(value: unknown, context: string): string {
  const result = requiredString(value, context);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(result)) throw new ContractError(`${context}: ISO date expected`);
  return result;
}

function literal<T extends string>(value: unknown, expected: T, context: string): T {
  if (value !== expected) throw new ContractError(`${context}: unsupported value`);
  return expected;
}

function oneOf<T extends string>(value: unknown, expected: readonly T[], context: string): T {
  if (typeof value !== "string" || !expected.includes(value as T)) {
    throw new ContractError(`${context}: unsupported value`);
  }
  return value as T;
}

function isOneOf<T extends string>(value: string, expected: readonly T[]): value is T {
  return expected.includes(value as T);
}
