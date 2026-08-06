import type {
  AgentWorkflow,
  Assessment,
  AuthConfig,
  CaseDocument,
  CaseSummary,
  ComparisonOperand,
  DocumentAnalysis,
  DocumentFact,
  DocumentLineItem,
  DocumentView,
  EvidenceItem,
  JobRecord,
  RequiredAction,
  ReviewerDecision,
  ReviewerDecisionHistoryItem,
  ReviewComparison,
  ReviewFinding,
  ReviewReport,
  ReviewRun,
  ReviewRunSummary,
  Session,
  SourceReference,
  WorkflowStage,
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
  return {
    case_id: requiredString(raw.case_id, "case.case_id"),
    org_id: requiredString(raw.org_id, "case.org_id"),
    ...(raw.external_reference === undefined || raw.external_reference === null
      ? {}
      : { external_reference: requiredString(raw.external_reference, "case.external_reference") }),
    title: requiredString(raw.title, "case.title"),
    status: oneOf(raw.status, ["open", "in_review", "closed"], "case.status"),
    revision: nonNegativeInteger(raw.revision, "case.revision"),
    updated_at: requiredString(raw.updated_at, "case.updated_at"),
  };
}

export function decodeDocument(value: unknown): CaseDocument {
  const raw = record(value, "document");
  const type = oneOf(raw.document_type, ["CI", "PL", "BL", "CO", "UNKNOWN"], "document.document_type");
  if (raw.media_type !== "text/plain") throw new ContractError("only text/plain documents are supported");
  return {
    document_id: requiredString(raw.document_id, "document.document_id"),
    case_id: requiredString(raw.case_id, "document.case_id"),
    document_type: type,
    filename: requiredString(raw.filename, "document.filename"),
    media_type: "text/plain",
    content_sha256: sha256(raw.content_sha256, "document.content_sha256"),
    byte_size: nonNegativeInteger(raw.byte_size, "document.byte_size"),
    character_count: nonNegativeInteger(raw.character_count, "document.character_count"),
    ...(raw.replaces_document_id === undefined || raw.replaces_document_id === null
      ? {}
      : { replaces_document_id: requiredString(raw.replaces_document_id, "document.replaces_document_id") }),
    ...(raw.superseded_by_document_id === undefined || raw.superseded_by_document_id === null
      ? {}
      : { superseded_by_document_id: requiredString(raw.superseded_by_document_id, "document.superseded_by_document_id") }),
    ...(raw.superseded_at === undefined || raw.superseded_at === null
      ? {}
      : { superseded_at: requiredString(raw.superseded_at, "document.superseded_at") }),
    created_by: requiredString(raw.created_by, "document.created_by"),
    created_at: requiredString(raw.created_at, "document.created_at"),
  };
}

export function decodeDocumentView(value: unknown): DocumentView {
  const raw = record(value, "document view");
  const content = raw.content_text === undefined ? undefined : displayText(raw.content_text, "document view.content_text");
  if (content === undefined) throw new ContractError("document view content is absent");
  return { record: decodeDocument(raw.record), content_text: content };
}

export function decodeDocumentListItem(value: unknown): CaseDocument {
  const raw = record(value, "document list item");
  return decodeDocument(raw.record ?? raw);
}

export function decodeReviewRunSummary(value: unknown): ReviewRunSummary {
  const raw = record(value, "review run summary");
  return {
    review_run_id: requiredString(raw.review_run_id, "run.review_run_id"),
    case_id: requiredString(raw.case_id, "run.case_id"),
    job_id: requiredString(raw.job_id, "run.job_id"),
    review_as_of: isoDate(raw.review_as_of, "run.review_as_of"),
    trade_type: oneOf(raw.trade_type, ["import", "export"], "run.trade_type"),
    execution_status: oneOf(raw.execution_status, ["succeeded", "partial", "failed"], "run.execution_status"),
    assessment: oneOf(raw.assessment, ["no_issue_detected", "issues_detected", "indeterminate"], "run.assessment") as Assessment,
    review_disposition: oneOf(raw.review_disposition, ["human_review_required", "blocked"], "run.review_disposition"),
    result_digest: sha256(raw.result_digest, "run.result_digest"),
    finding_count: nonNegativeInteger(raw.finding_count, "run.finding_count"),
    reviewer_decision_count: nonNegativeInteger(raw.reviewer_decision_count, "run.reviewer_decision_count"),
    created_at: requiredString(raw.created_at, "run.created_at"),
  };
}

export function decodeReviewRun(value: unknown): ReviewRun {
  const raw = record(value, "review run");
  return {
    review_run_id: requiredString(raw.review_run_id, "run.review_run_id"),
    case_id: requiredString(raw.case_id, "run.case_id"),
    org_id: requiredString(raw.org_id, "run.org_id"),
    job_id: requiredString(raw.job_id, "run.job_id"),
    case_revision: nonNegativeInteger(raw.case_revision, "run.case_revision"),
    review_as_of: isoDate(raw.review_as_of, "run.review_as_of"),
    trade_type: oneOf(raw.trade_type, ["import", "export"], "run.trade_type"),
    execution_status: oneOf(raw.execution_status, ["succeeded", "partial", "failed"], "run.execution_status"),
    assessment: oneOf(raw.assessment, ["no_issue_detected", "issues_detected", "indeterminate"], "run.assessment") as Assessment,
    review_disposition: oneOf(raw.review_disposition, ["human_review_required", "blocked"], "run.review_disposition"),
    completion_eligibility: decodeCompletionEligibility(raw.completion_eligibility),
    agent_schema_version: literal(raw.agent_schema_version, "3.1", "run.agent_schema_version"),
    agent_status: oneOf(raw.agent_status, ["needs_review", "blocked"], "run.agent_status"),
    ...(raw.agent_engine === undefined || raw.agent_engine === null
      ? { agent_engine: null }
      : { agent_engine: decodeEngine(raw.agent_engine) }),
    report: decodeReport(raw.report),
    workflow: decodeWorkflow(raw.workflow),
    document_analyses: array(raw.document_analyses, "run.document_analyses").map(decodeDocumentAnalysis),
    comparisons: array(raw.comparisons, "run.comparisons").map(decodeComparison),
    evidence: array(raw.evidence, "run.evidence").map(decodeEvidence),
    findings: array(raw.findings, "run.findings").map(decodeFinding),
    required_actions: array(raw.required_actions, "run.required_actions").map(decodeAction),
    reviewer_decisions: array(raw.reviewer_decisions, "run.reviewer_decisions").map(decodeReviewerDecision),
    created_by: requiredString(raw.created_by, "run.created_by"),
    created_at: requiredString(raw.created_at, "run.created_at"),
  };
}

export function decodeReviewerDecision(value: unknown): ReviewerDecision {
  const raw = record(value, "reviewer decision");
  const current = decodeReviewerDecisionEntry(raw, "reviewer decision");
  return {
    finding_id: requiredString(raw.finding_id, "reviewer decision.finding_id"),
    ...current,
    history: array(raw.history, "reviewer decision.history").map((item, index) =>
      decodeReviewerDecisionEntry(record(item, `reviewer decision.history[${index}]`), `reviewer decision.history[${index}]`),
    ),
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

function decodeEngine(value: unknown): NonNullable<ReviewRun["agent_engine"]> {
  const raw = record(value, "run.agent_engine");
  return {
    kind: oneOf(raw.kind, ["deterministic", "claude"], "run.agent_engine.kind"),
    model_id: requiredString(raw.model_id, "run.agent_engine.model_id"),
  };
}

function decodeReport(value: unknown): ReviewReport {
  const raw = record(value, "run.report");
  return {
    overall_status: oneOf(raw.overall_status, ["needs_review", "blocked"], "run.report.overall_status"),
    summary: displayText(raw.summary, "run.report.summary"),
    disclaimer: displayText(raw.disclaimer, "run.report.disclaimer"),
  };
}

function decodeWorkflow(value: unknown): AgentWorkflow {
  const raw = record(value, "run.workflow");
  return {
    status: oneOf(raw.status, ["completed", "partial", "failed"], "run.workflow.status"),
    stages: array(raw.stages, "run.workflow.stages").map(decodeWorkflowStage),
    reextractions: array(raw.reextractions, "run.workflow.reextractions").map((item, index) => {
      const reextraction = record(item, `run.workflow.reextractions[${index}]`);
      return {
        document_id: requiredString(reextraction.document_id, "reextraction.document_id"),
        attempt_count: literal(reextraction.attempt_count, 1, "reextraction.attempt_count"),
        requested_fields: array(reextraction.requested_fields, "reextraction.requested_fields").map((field, fieldIndex) =>
          requiredString(field, `reextraction.requested_fields[${fieldIndex}]`),
        ),
        status: oneOf(reextraction.status, ["completed", "unavailable"], "reextraction.status"),
      };
    }),
  };
}

function decodeWorkflowStage(value: unknown): WorkflowStage {
  const raw = record(value, "workflow stage");
  return {
    stage: oneOf(raw.stage, [
      "classify_documents", "extract_facts", "normalize_facts", "match_documents",
      "validate_documents", "reextract_documents", "retrieve_evidence", "generate_result",
    ], "workflow stage.stage"),
    status: oneOf(raw.status, ["completed", "skipped", "needs_review", "failed"], "workflow stage.status"),
    attempt_count: nonNegativeInteger(raw.attempt_count, "workflow stage.attempt_count"),
    summary: displayText(raw.summary, "workflow stage.summary"),
  };
}

function decodeDocumentAnalysis(value: unknown): DocumentAnalysis {
  const raw = record(value, "document analysis");
  return {
    document_id: requiredString(raw.document_id, "document analysis.document_id"),
    filename: requiredString(raw.filename, "document analysis.filename"),
    declared_type: raw.declared_type === null ? null : requiredString(raw.declared_type, "document analysis.declared_type"),
    document_type: oneOf(raw.document_type, ["invoice", "packing_list", "bill_of_lading", "certificate_of_origin", "unknown"], "document analysis.document_type"),
    classification_source: raw.classification_source === null ? null : decodeSource(raw.classification_source),
    extraction_status: oneOf(raw.extraction_status, ["complete", "needs_review"], "document analysis.extraction_status"),
    facts: array(raw.facts, "document analysis.facts").map(decodeFact),
    line_items: array(raw.line_items, "document analysis.line_items").map(decodeLineItem),
    warnings: array(raw.warnings, "document analysis.warnings").map((item, index) => {
      const warning = record(item, `document analysis.warnings[${index}]`);
      return { code: requiredString(warning.code, "warning.code"), message: displayText(warning.message, "warning.message") };
    }),
  };
}

function decodeLineItem(value: unknown): DocumentLineItem {
  const raw = record(value, "line item");
  return {
    item_id: requiredString(raw.item_id, "line item.item_id"),
    source: decodeSource(raw.source),
    facts: array(raw.facts, "line item.facts").map(decodeFact),
  };
}

function decodeFact(value: unknown): DocumentFact {
  const raw = record(value, "document fact");
  return {
    fact_id: requiredString(raw.fact_id, "fact.fact_id"),
    name: requiredString(raw.name, "fact.name"),
    raw_value: displayText(raw.raw_value, "fact.raw_value"),
    ...(raw.normalized_value === undefined || raw.normalized_value === null
      ? {}
      : { normalized_value: displayText(raw.normalized_value, "fact.normalized_value") }),
    ...(raw.unit === undefined || raw.unit === null ? {} : { unit: requiredString(raw.unit, "fact.unit") }),
    source: decodeSource(raw.source),
  };
}

function decodeSource(value: unknown): SourceReference {
  const raw = record(value, "fact.source");
  return {
    document_id: requiredString(raw.document_id, "fact.source.document_id"),
    quote: displayText(raw.quote, "fact.source.quote"),
    occurrence: nonNegativeInteger(raw.occurrence, "fact.source.occurrence"),
  };
}

function decodeComparison(value: unknown): ReviewComparison {
  const raw = record(value, "comparison");
  return {
    comparison_id: requiredString(raw.comparison_id, "comparison.comparison_id"),
    rule_code: requiredString(raw.rule_code, "comparison.rule_code"),
    status: oneOf(raw.status, ["pass", "skip", "mismatch", "needs_review"], "comparison.status"),
    left: decodeOperand(raw.left, "comparison.left"),
    right: decodeOperand(raw.right, "comparison.right"),
    ...(raw.expected_value === undefined || raw.expected_value === null
      ? {}
      : { expected_value: displayText(raw.expected_value, "comparison.expected_value") }),
    ...(raw.observed_value === undefined || raw.observed_value === null
      ? {}
      : { observed_value: displayText(raw.observed_value, "comparison.observed_value") }),
    ...(raw.unit === undefined || raw.unit === null ? {} : { unit: requiredString(raw.unit, "comparison.unit") }),
    message: displayText(raw.message, "comparison.message"),
  };
}

function decodeOperand(value: unknown, context: string): ComparisonOperand {
  const raw = record(value, context);
  return {
    document_id: raw.document_id === null ? null : requiredString(raw.document_id, `${context}.document_id`),
    ...(raw.item_id === undefined || raw.item_id === null ? {} : { item_id: requiredString(raw.item_id, `${context}.item_id`) }),
    fact_ids: array(raw.fact_ids, `${context}.fact_ids`).map((fact, index) => requiredString(fact, `${context}.fact_ids[${index}]`)),
    ...(raw.display_value === undefined || raw.display_value === null
      ? {}
      : { display_value: displayText(raw.display_value, `${context}.display_value`) }),
  };
}

function decodeEvidence(value: unknown): EvidenceItem {
  const raw = record(value, "run.evidence item");
  return {
    evidence_id: requiredString(raw.evidence_id, "run.evidence.evidence_id"),
    item_id: requiredString(raw.item_id, "run.evidence.item_id"),
    title: displayText(raw.title, "run.evidence.title"),
    text: displayText(raw.text, "run.evidence.text"),
    source_uri: requiredString(raw.source_uri, "run.evidence.source_uri"),
    source_type: requiredString(raw.source_type, "run.evidence.source_type"),
    source_hash: sha256(raw.source_hash, "run.evidence.source_hash"),
    ...(raw.law_id === undefined || raw.law_id === null ? {} : { law_id: requiredString(raw.law_id, "run.evidence.law_id") }),
    ...(raw.law_name === undefined || raw.law_name === null ? {} : { law_name: displayText(raw.law_name, "run.evidence.law_name") }),
  };
}

function decodeFinding(value: unknown): ReviewFinding {
  const raw = record(value, "run.finding");
  return {
    finding_id: requiredString(raw.finding_id, "run.finding.finding_id"),
    code: requiredString(raw.code, "run.finding.code"),
    message: displayText(raw.message, "run.finding.message"),
    kind: oneOf(raw.kind, ["validation_issue", "regulatory_finding"], "run.finding.kind"),
    severity: oneOf(raw.severity, ["low", "medium", "high", "critical"], "run.finding.severity"),
    ...(raw.comparison_id === undefined || raw.comparison_id === null
      ? {}
      : { comparison_id: requiredString(raw.comparison_id, "run.finding.comparison_id") }),
    document_ids: array(raw.document_ids, "run.finding.document_ids").map((item, index) => requiredString(item, `run.finding.document_ids[${index}]`)),
    fact_ids: array(raw.fact_ids, "run.finding.fact_ids").map((item, index) => requiredString(item, `run.finding.fact_ids[${index}]`)),
    evidence_ids: array(raw.evidence_ids, "run.finding.evidence_ids").map((item, index) => requiredString(item, `run.finding.evidence_ids[${index}]`)),
  };
}

function decodeAction(value: unknown): RequiredAction {
  const raw = record(value, "run.required_action");
  return {
    action_code: requiredString(raw.action_code, "run.required_action.action_code"),
    message: displayText(raw.message, "run.required_action.message"),
    finding_ids: array(raw.finding_ids, "run.required_action.finding_ids").map((item, index) => requiredString(item, `run.required_action.finding_ids[${index}]`)),
  };
}

function decodeReviewerDecisionEntry(value: Record<string, unknown>, context: string): ReviewerDecisionHistoryItem {
  return {
    status: oneOf(value.status, ["confirmed", "needs_information", "resolved"], `${context}.status`),
    reason: displayText(value.reason, `${context}.reason`),
    decided_by: requiredString(value.decided_by, `${context}.decided_by`),
    decided_at: requiredString(value.decided_at, `${context}.decided_at`),
  };
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ContractError(`${context}: object expected`);
  return value as Record<string, unknown>;
}

function array(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) throw new ContractError(`${context}: array expected`);
  return value;
}

function requiredString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 20_000 || /[\r\n\0]/u.test(value)) throw new ContractError(`${context}: safe string expected`);
  return value;
}

function displayText(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 20_000 || /\0/u.test(value)) throw new ContractError(`${context}: display text expected`);
  return value;
}

function optionalString(value: unknown, context: string): string | undefined {
  return value === undefined || value === null ? undefined : requiredString(value, context);
}

function nonNegativeInteger(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000_000) throw new ContractError(`${context}: non-negative integer expected`);
  return value;
}

function positiveInteger(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 1_000_000_000) throw new ContractError(`${context}: positive integer expected`);
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

function literal<T extends string | number>(value: unknown, expected: T, context: string): T {
  if (value !== expected) throw new ContractError(`${context}: unsupported value`);
  return expected;
}

function oneOf<T extends string>(value: unknown, expected: readonly T[], context: string): T {
  if (typeof value !== "string" || !expected.includes(value as T)) throw new ContractError(`${context}: unsupported value`);
  return value as T;
}
