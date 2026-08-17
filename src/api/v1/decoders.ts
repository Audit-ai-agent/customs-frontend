import type {
  AgentWorkflow,
  AssistantAnswerScope,
  AssistantCitation,
  AssistantConversation,
  AssistantCorrectionDraft,
  AssistantMessage,
  AssistantMessageExchange,
  Assessment,
  AuthConfig,
  CaseClosure,
  CaseDocument,
  ReviewProgress,
  CaseSummary,
  ComparisonOperand,
  CorrectionDecision,
  CorrectionProposal,
  CorrectionProposalHistoryEntry,
  DocumentAnalysis,
  DocumentAsset,
  DocumentFact,
  DocumentLineItem,
  DocumentView,
  ExtractionJob,
  ExtractionJobEnvelope,
  ExtractionPage,
  ExtractionPreview,
  ExtractionSpan,
  EvidenceItem,
  FactSourceReference,
  HumanProvidedSourceReference,
  DutyAssessment,
  DutyEstimate,
  DutyRate,
  HsCandidate,
  HsClassification,
  HsReferenceEntry,
  HsSelection,
  JobRecord,
  OriginCheck,
  OriginVerification,
  PlannerAction,
  PlannerTrace,
  ReportClaim,
  ReportSection,
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

const DOCUMENT_TYPE_VALUES = [
  "CI",
  "PL",
  "BL",
  "CO",
  "AWB",
  "EXPORT_DECLARATION",
  "SUPPORTING_EVIDENCE",
  "UNKNOWN",
] as const;

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
    oneOf(item, ["reviewer", "approver"] as const, `session.roles[${index}]`),
  );
  if (!roles.length) throw new ContractError("session must have at least one workspace role");
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
    ...(raw.closure === undefined || raw.closure === null
      ? {}
      : { closure: decodeCaseClosure(raw.closure) }),
  };
}

export function decodeReviewProgress(value: unknown): ReviewProgress {
  const context = "review progress";
  const raw = record(value, context);
  return {
    status: oneOf(raw.status, ["idle", "running"] as const, `${context}.status`),
    ...(raw.review_run_id === undefined || raw.review_run_id === null
      ? {}
      : { review_run_id: requiredString(raw.review_run_id, `${context}.review_run_id`) }),
    stages: array(raw.stages ?? [], `${context}.stages`).map((item, index) => {
      const entry = record(item, `${context}.stages[${index}]`);
      return {
        stage: requiredString(entry.stage, `${context}.stages[${index}].stage`),
        status: requiredString(entry.status, `${context}.stages[${index}].status`),
      };
    }),
  };
}

function decodeCaseClosure(value: unknown): CaseClosure {
  const raw = record(value, "case.closure");
  return {
    disposition: oneOf(raw.disposition, ["cleared", "returned"] as const, "case.closure.disposition"),
    reason: displayText(raw.reason, "case.closure.reason"),
    review_run_id: requiredString(raw.review_run_id, "case.closure.review_run_id"),
    closed_by: requiredString(raw.closed_by, "case.closure.closed_by"),
    closed_at: requiredString(raw.closed_at, "case.closure.closed_at"),
  };
}

export function decodeDocument(value: unknown): CaseDocument {
  const raw = record(value, "document");
  const type = oneOf(raw.document_type, DOCUMENT_TYPE_VALUES, "document.document_type");
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
    ...(raw.parent_review_run_id === undefined || raw.parent_review_run_id === null
      ? {}
      : { parent_review_run_id: requiredString(raw.parent_review_run_id, "run.parent_review_run_id") }),
    ...(raw.applied_correction_proposal_ids === undefined
      ? {}
      : { applied_correction_proposal_ids: decodeIdentifierList(raw.applied_correction_proposal_ids, "run.applied_correction_proposal_ids") }),
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
    agent_schema_version: literal(raw.agent_schema_version, "3.2", "run.agent_schema_version"),
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
    ...(raw.parent_review_run_id === undefined || raw.parent_review_run_id === null
      ? {}
      : { parent_review_run_id: requiredString(raw.parent_review_run_id, "run.parent_review_run_id") }),
    ...(raw.applied_correction_proposal_ids === undefined
      ? {}
      : { applied_correction_proposal_ids: decodeIdentifierList(raw.applied_correction_proposal_ids, "run.applied_correction_proposal_ids") }),
  };
}

/** Decode the planned Backend-owned assistant conversation projection. */
export function decodeAssistantConversation(value: unknown): AssistantConversation {
  const raw = record(value, "assistant conversation");
  return {
    conversation_id: requiredString(raw.conversation_id, "assistant conversation.conversation_id"),
    review_run_id: requiredString(raw.review_run_id, "assistant conversation.review_run_id"),
    ...(raw.title === undefined || raw.title === null
      ? {}
      : { title: displayText(raw.title, "assistant conversation.title") }),
    created_by: requiredString(raw.created_by, "assistant conversation.created_by"),
    created_at: requiredString(raw.created_at, "assistant conversation.created_at"),
    updated_at: requiredString(raw.updated_at, "assistant conversation.updated_at"),
  };
}

/**
 * Message history uses `content`; the `direct_answer` fallback accepts the
 * Agent's canonical answer projection while Backend wiring is being aligned.
 */
export function decodeAssistantMessage(
  value: unknown,
  inferredRole?: AssistantMessage["role"],
): AssistantMessage {
  const raw = record(value, "assistant message");
  const role = raw.role === undefined
    ? inferredRole
    : oneOf(raw.role, ["user", "assistant"], "assistant message.role");
  if (!role) throw new ContractError("assistant message.role is absent");
  const content = raw.content ?? raw.direct_answer;
  return {
    message_id: requiredString(raw.message_id, "assistant message.message_id"),
    conversation_id: requiredString(raw.conversation_id, "assistant message.conversation_id"),
    role,
    content: displayText(content, "assistant message.content"),
    ...decodeAssistantAnswerScope(raw.answer_scope, role),
    citations: raw.citations === undefined
      ? []
      : array(raw.citations, "assistant message.citations").map(decodeAssistantCitation),
    suggested_questions: raw.suggested_questions === undefined
      ? []
      : decodeSuggestedQuestions(raw.suggested_questions),
    ...(raw.correction_draft === undefined || raw.correction_draft === null
      ? {}
      : { correction_draft: decodeAssistantCorrectionDraft(raw.correction_draft, "assistant message.correction_draft") }),
    created_by: requiredString(raw.created_by, "assistant message.created_by"),
    created_at: requiredString(raw.created_at, "assistant message.created_at"),
  };
}

export function decodeAssistantMessageExchange(value: unknown): AssistantMessageExchange {
  const raw = record(value, "assistant message exchange");
  return {
    user_message: decodeAssistantMessage(raw.user_message, "user"),
    assistant_message: decodeAssistantMessage(raw.assistant_message, "assistant"),
  };
}

export function decodeCorrectionProposal(value: unknown): CorrectionProposal {
  const raw = record(value, "correction proposal");
  return {
    correction_proposal_id: requiredString(raw.correction_proposal_id, "correction proposal.correction_proposal_id"),
    review_run_id: requiredString(raw.review_run_id, "correction proposal.review_run_id"),
    ...(raw.finding_id === undefined || raw.finding_id === null
      ? {}
      : { finding_id: requiredString(raw.finding_id, "correction proposal.finding_id") }),
    document_id: requiredString(raw.document_id, "correction proposal.document_id"),
    ...(raw.item_id === undefined || raw.item_id === null
      ? {}
      : { item_id: requiredString(raw.item_id, "correction proposal.item_id") }),
    ...(raw.fact_id === undefined || raw.fact_id === null
      ? {}
      : { fact_id: requiredString(raw.fact_id, "correction proposal.fact_id") }),
    field_name: requiredString(raw.field_name, "correction proposal.field_name"),
    new_value: displayText(raw.new_value, "correction proposal.new_value"),
    ...(raw.unit === undefined || raw.unit === null
      ? {}
      : { unit: requiredString(raw.unit, "correction proposal.unit") }),
    reason: displayText(raw.reason, "correction proposal.reason"),
    status: oneOf(raw.status, ["proposed", "approved", "rejected"], "correction proposal.status"),
    created_by: requiredString(raw.created_by, "correction proposal.created_by"),
    created_at: requiredString(raw.created_at, "correction proposal.created_at"),
    ...(raw.decision === undefined || raw.decision === null
      ? {}
      : { decision: decodeCorrectionDecision(raw.decision, "correction proposal.decision") }),
    history: raw.history === undefined
      ? []
      : array(raw.history, "correction proposal.history").map((item, index) =>
        decodeCorrectionProposalHistoryEntry(item, `correction proposal.history[${index}]`),
      ),
    ...(raw.applied_review_run_id === undefined || raw.applied_review_run_id === null
      ? {}
      : { applied_review_run_id: requiredString(raw.applied_review_run_id, "correction proposal.applied_review_run_id") }),
  };
}

export function decodeCorrectionDecision(value: unknown, context = "correction decision"): CorrectionDecision {
  const raw = record(value, context);
  return {
    status: oneOf(raw.status, ["approved", "rejected"], `${context}.status`),
    reason: displayText(raw.reason, `${context}.reason`),
    ...(raw.decided_by === undefined || raw.decided_by === null
      ? {}
      : { decided_by: requiredString(raw.decided_by, `${context}.decided_by`) }),
    ...(raw.decided_at === undefined || raw.decided_at === null
      ? {}
      : { decided_at: requiredString(raw.decided_at, `${context}.decided_at`) }),
  };
}

function decodeCorrectionProposalHistoryEntry(
  value: unknown,
  context: string,
): CorrectionProposalHistoryEntry {
  const raw = record(value, context);
  return {
    event: oneOf(raw.event, ["proposed", "approved", "rejected", "applied"], `${context}.event`),
    reason: displayText(raw.reason, `${context}.reason`),
    actor: requiredString(raw.actor, `${context}.actor`),
    occurred_at: requiredString(raw.occurred_at, `${context}.occurred_at`),
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
  const sections = array(raw.sections, "run.report.sections").map((item, index) =>
    decodeReportSection(item, `run.report.sections[${index}]`),
  );
  const expectedSections = new Set([
    "conclusion",
    "execution_process",
    "document_comparison",
    "issues_and_causes",
    "legal_evidence",
    "impact",
    "next_actions",
    "limitations",
  ]);
  if (sections.length !== expectedSections.size || new Set(sections.map((section) => section.section)).size !== expectedSections.size) {
    throw new ContractError("run.report.sections must contain the eight bounded report sections");
  }
  if (sections.some((section) => !expectedSections.has(section.section))) {
    throw new ContractError("run.report.sections contains an unsupported section");
  }
  return {
    overall_status: oneOf(raw.overall_status, ["needs_review", "blocked"], "run.report.overall_status"),
    summary: displayText(raw.summary, "run.report.summary"),
    disclaimer: displayText(raw.disclaimer, "run.report.disclaimer"),
    sections,
  };
}

function decodeReportSection(value: unknown, context: string): ReportSection {
  const raw = record(value, context);
  const claims = array(raw.claims, `${context}.claims`).map((item, index) =>
    decodeReportClaim(item, `${context}.claims[${index}]`),
  );
  if (!claims.length || claims.length > 32) throw new ContractError(`${context}.claims must be bounded and non-empty`);
  return {
    section: oneOf(raw.section, [
      "conclusion",
      "execution_process",
      "document_comparison",
      "issues_and_causes",
      "legal_evidence",
      "impact",
      "next_actions",
      "limitations",
    ], `${context}.section`),
    title: requiredString(raw.title, `${context}.title`),
    claims,
  };
}

function decodeReportClaim(value: unknown, context: string): ReportClaim {
  const raw = record(value, context);
  const factIds = decodeIdentifierList(raw.fact_ids, `${context}.fact_ids`);
  const comparisonIds = decodeIdentifierList(raw.comparison_ids, `${context}.comparison_ids`);
  const evidenceIds = decodeIdentifierList(raw.evidence_ids, `${context}.evidence_ids`);
  if (!factIds.length && !comparisonIds.length && !evidenceIds.length) {
    throw new ContractError(`${context} must cite a fact, comparison, or Evidence item`);
  }
  return {
    claim_id: requiredString(raw.claim_id, `${context}.claim_id`),
    text: displayText(raw.text, `${context}.text`),
    fact_ids: factIds,
    comparison_ids: comparisonIds,
    evidence_ids: evidenceIds,
  };
}

function decodeWorkflow(value: unknown): AgentWorkflow {
  const raw = record(value, "run.workflow");
  const planner = decodePlanner(raw.planner, "run.workflow.planner");
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
    planner,
  };
}

function decodePlanner(value: unknown, context: string): PlannerTrace {
  const raw = record(value, context);
  const cycleCount = plannerCycle(raw.cycle_count, `${context}.cycle_count`);
  const actions = array(raw.actions, `${context}.actions`).map((item, index) =>
    decodePlannerAction(item, `${context}.actions[${index}]`),
  );
  if (!actions.length || actions.length > 6 || actions.some((action) => action.cycle > cycleCount)) {
    throw new ContractError(`${context} exceeds the bounded planning limit`);
  }
  if (actions.some((action, index) => index > 0 && action.cycle < (actions[index - 1]?.cycle ?? 1))) {
    throw new ContractError(`${context}.actions must be ordered by cycle`);
  }
  return { cycle_count: cycleCount, actions };
}

function decodePlannerAction(value: unknown, context: string): PlannerAction {
  const raw = record(value, context);
  return {
    cycle: plannerCycle(raw.cycle, `${context}.cycle`),
    action: oneOf(raw.action, [
      "analyze_documents",
      "apply_human_corrections",
      "compare_documents",
      "reextract_documents",
      "retrieve_evidence",
      "generate_report",
    ], `${context}.action`),
    status: oneOf(raw.status, ["completed", "skipped", "needs_review", "failed"], `${context}.status`),
    summary: displayText(raw.summary, `${context}.summary`),
    correction_proposal_ids: raw.correction_proposal_ids === undefined
      ? []
      : decodeIdentifierList(raw.correction_proposal_ids, `${context}.correction_proposal_ids`),
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
    document_type: oneOf(
      raw.document_type,
      ["invoice", "packing_list", "bill_of_lading", "certificate_of_origin", "air_waybill", "export_declaration", "supporting_evidence", "unknown"],
      "document analysis.document_type",
    ),
    classification_source: raw.classification_source === null ? null : decodeDocumentSource(raw.classification_source),
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
    source: decodeDocumentSource(raw.source),
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
    source: decodeFactSource(raw.source),
  };
}

function decodeDocumentSource(value: unknown): SourceReference {
  const raw = record(value, "document source");
  return {
    source_kind: literal(raw.source_kind, "document", "document source.source_kind"),
    document_id: requiredString(raw.document_id, "document source.document_id"),
    quote: displayText(raw.quote, "document source.quote"),
    occurrence: nonNegativeInteger(raw.occurrence, "document source.occurrence"),
  };
}

function decodeFactSource(value: unknown): FactSourceReference {
  const raw = record(value, "fact.source");
  if (raw.source_kind === "document") return decodeDocumentSource(raw);
  if (raw.source_kind !== "human_provided") {
    throw new ContractError("fact.source.source_kind must be document or human_provided");
  }
  const source: HumanProvidedSourceReference = {
    source_kind: "human_provided",
    document_id: requiredString(raw.document_id, "human-provided source.document_id"),
    correction_proposal_id: requiredString(raw.correction_proposal_id, "human-provided source.correction_proposal_id"),
    reason: displayText(raw.reason, "human-provided source.reason"),
  };
  return source;
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

function decodeAssistantCitation(value: unknown): AssistantCitation {
  const raw = record(value, "assistant citation");
  return {
    kind: oneOf(raw.kind, ["fact", "comparison", "evidence"], "assistant citation.kind"),
    reference_id: requiredString(raw.reference_id, "assistant citation.reference_id"),
  };
}

function decodeAssistantAnswerScope(
  value: unknown,
  role: AssistantMessage["role"],
): { answer_scope?: AssistantAnswerScope } {
  if (value === undefined || value === null) {
    if (role === "assistant") throw new ContractError("assistant answer_scope is absent");
    return {};
  }
  return {
    answer_scope: oneOf(value, [
      "case_grounded",
      "evidence_grounded",
      "general_customs_guidance",
      "clarification_needed",
      "insufficient_evidence",
      "out_of_scope",
    ], "assistant message.answer_scope"),
  };
}

function decodeSuggestedQuestions(value: unknown): string[] {
  const questions = array(value, "assistant message.suggested_questions");
  if (questions.length > 3) throw new ContractError("assistant message.suggested_questions exceeds three items");
  return questions.map((question, index) =>
    displayText(question, `assistant message.suggested_questions[${index}]`),
  );
}

function decodeAssistantCorrectionDraft(value: unknown, context: string): AssistantCorrectionDraft {
  const raw = record(value, context);
  return {
    document_id: requiredString(raw.document_id, `${context}.document_id`),
    ...(raw.item_id === undefined || raw.item_id === null
      ? {}
      : { item_id: requiredString(raw.item_id, `${context}.item_id`) }),
    ...(raw.fact_id === undefined || raw.fact_id === null
      ? {}
      : { fact_id: requiredString(raw.fact_id, `${context}.fact_id`) }),
    field_name: requiredString(raw.field_name, `${context}.field_name`),
    new_value: displayText(raw.new_value, `${context}.new_value`),
    ...(raw.unit === undefined || raw.unit === null
      ? {}
      : { unit: requiredString(raw.unit, `${context}.unit`) }),
    reason: displayText(raw.reason, `${context}.reason`),
  };
}

function decodeIdentifierList(value: unknown, context: string): string[] {
  return array(value, context).map((item, index) => requiredString(item, `${context}[${index}]`));
}

/* ── binary document assets and the extraction preview boundary ── */

export function decodeDocumentAsset(value: unknown): DocumentAsset {
  const raw = record(value, "document asset");
  return {
    asset_id: requiredString(raw.asset_id, "document asset.asset_id"),
    case_id: requiredString(raw.case_id, "document asset.case_id"),
    document_type: oneOf(raw.document_type, DOCUMENT_TYPE_VALUES, "document asset.document_type"),
    filename: requiredString(raw.filename, "document asset.filename"),
    media_type: oneOf(raw.media_type, ["application/pdf", "image/jpeg", "image/png"], "document asset.media_type"),
    byte_size: positiveInteger(raw.byte_size, "document asset.byte_size"),
    page_count: nonNegativeInteger(raw.page_count, "document asset.page_count"),
    pixel_count: nonNegativeInteger(raw.pixel_count, "document asset.pixel_count"),
    created_by: requiredString(raw.created_by, "document asset.created_by"),
    created_at: requiredString(raw.created_at, "document asset.created_at"),
  };
}

function decodeExtractionSpan(value: unknown, context: string): ExtractionSpan {
  const raw = record(value, context);
  const bbox = raw.bbox;
  return {
    span_id: requiredString(raw.span_id, `${context}.span_id`),
    ordinal: positiveInteger(raw.ordinal, `${context}.ordinal`),
    text: displayText(raw.text, `${context}.text`),
    ...(bbox === undefined || bbox === null
      ? {}
      : { bbox: decodeBoundingBox(bbox, `${context}.bbox`) }),
    reading_order: positiveInteger(raw.reading_order, `${context}.reading_order`),
  };
}

function decodeBoundingBox(value: unknown, context: string): Record<string, number> {
  const raw = record(value, context);
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(raw)) {
    if (typeof item !== "number" || !Number.isFinite(item)) throw new ContractError(`${context}.${key}: number expected`);
    result[key] = item;
  }
  return result;
}

function decodeExtractionPage(value: unknown, context: string): ExtractionPage {
  const raw = record(value, context);
  return {
    page_number: positiveInteger(raw.page_number, `${context}.page_number`),
    width: positiveInteger(raw.width, `${context}.width`),
    height: positiveInteger(raw.height, `${context}.height`),
    coordinate_unit: oneOf(raw.coordinate_unit, ["pixels", "pdf_points"], `${context}.coordinate_unit`),
    spans: array(raw.spans, `${context}.spans`).map((item, index) => decodeExtractionSpan(item, `${context}.spans[${index}]`)),
  };
}

function decodeExtractionPreview(value: unknown): ExtractionPreview {
  const raw = record(value, "extraction preview");
  const revision = optionalString(raw.extractor_revision, "extraction preview.extractor_revision");
  return {
    status: oneOf(raw.status, ["preview_ready", "needs_review", "unavailable"], "extraction preview.status"),
    pages: array(raw.pages, "extraction preview.pages").map((item, index) => decodeExtractionPage(item, `extraction preview.pages[${index}]`)),
    warnings: array(raw.warnings, "extraction preview.warnings").map((item, index) => requiredString(item, `extraction preview.warnings[${index}]`)),
    ...(revision === undefined ? {} : { extractor_revision: revision }),
  };
}

export function decodeExtractionJob(value: unknown): ExtractionJob {
  const raw = record(value, "extraction job");
  const errorCode = optionalString(raw.error_code, "extraction job.error_code");
  return {
    extraction_job_id: requiredString(raw.extraction_job_id, "extraction job.extraction_job_id"),
    asset_id: requiredString(raw.asset_id, "extraction job.asset_id"),
    case_id: requiredString(raw.case_id, "extraction job.case_id"),
    status: oneOf(raw.status, ["queued", "preview_ready", "needs_review", "unavailable", "failed"], "extraction job.status"),
    ...(errorCode === undefined ? {} : { error_code: errorCode }),
    ...(raw.result === undefined || raw.result === null ? {} : { result: decodeExtractionPreview(raw.result) }),
    created_by: requiredString(raw.created_by, "extraction job.created_by"),
    created_at: requiredString(raw.created_at, "extraction job.created_at"),
    updated_at: requiredString(raw.updated_at, "extraction job.updated_at"),
  };
}

export function decodeExtractionJobEnvelope(value: unknown): ExtractionJobEnvelope {
  const raw = record(value, "extraction job response");
  return {
    asset: decodeDocumentAsset(raw.asset),
    job: decodeExtractionJob(raw.job),
  };
}

export function decodeHsSelection(value: unknown, context = "HS selection"): HsSelection {
  const raw = record(value, context);
  return {
    code: hsCode(raw.code, `${context}.code`),
    reason: displayText(raw.reason, `${context}.reason`),
    selected_by: requiredString(raw.selected_by, `${context}.selected_by`),
    selected_at: requiredString(raw.selected_at, `${context}.selected_at`),
    history: array(raw.history, `${context}.history`).map((item, index) => {
      const entry = record(item, `${context}.history[${index}]`);
      return {
        code: hsCode(entry.code, `${context}.history[${index}].code`),
        reason: displayText(entry.reason, `${context}.history[${index}].reason`),
        selected_by: requiredString(entry.selected_by, `${context}.history[${index}].selected_by`),
        selected_at: requiredString(entry.selected_at, `${context}.history[${index}].selected_at`),
      };
    }),
  };
}

function decodeHsCandidate(value: unknown, context: string): HsCandidate {
  const raw = record(value, context);
  return {
    code: hsCode(raw.code, `${context}.code`),
    ...(raw.name_ko === undefined || raw.name_ko === null
      ? {}
      : { name_ko: displayText(raw.name_ko, `${context}.name_ko`) }),
    ...(raw.name_en === undefined || raw.name_en === null
      ? {}
      : { name_en: displayText(raw.name_en, `${context}.name_en`) }),
    ancestors: array(raw.ancestors ?? [], `${context}.ancestors`).map((item, index) => {
      const entry = record(item, `${context}.ancestors[${index}]`);
      return {
        level: nonNegativeInteger(entry.level, `${context}.ancestors[${index}].level`),
        code: requiredString(entry.code, `${context}.ancestors[${index}].code`),
        name_ko: displayText(entry.name_ko, `${context}.ancestors[${index}].name_ko`),
      };
    }),
    confidence: boundedRatio(raw.confidence, `${context}.confidence`),
    in_reference: booleanValue(raw.in_reference, `${context}.in_reference`),
    recommended: booleanValue(raw.recommended, `${context}.recommended`),
    origin:
      raw.origin === undefined
        ? "document_code"
        : oneOf(raw.origin, ["document_code", "description_match"] as const, `${context}.origin`),
    basis: array(raw.basis ?? [], `${context}.basis`).map((item, index) => {
      const entry = record(item, `${context}.basis[${index}]`);
      return {
        document_id: requiredString(entry.document_id, `${context}.basis[${index}].document_id`),
        fact_id: requiredString(entry.fact_id, `${context}.basis[${index}].fact_id`),
        fact_name: requiredString(entry.fact_name, `${context}.basis[${index}].fact_name`),
        raw_value: displayText(entry.raw_value, `${context}.basis[${index}].raw_value`),
      };
    }),
  };
}

export function decodeHsReferenceEntry(value: unknown): HsReferenceEntry {
  const context = "HSK reference entry";
  const raw = record(value, context);
  const reference = record(raw.reference, `${context}.reference`);
  return {
    code: hsCode(raw.code, `${context}.code`),
    in_reference: booleanValue(raw.in_reference, `${context}.in_reference`),
    ...(raw.name_ko === undefined || raw.name_ko === null
      ? {}
      : { name_ko: displayText(raw.name_ko, `${context}.name_ko`) }),
    ...(raw.name_en === undefined || raw.name_en === null
      ? {}
      : { name_en: displayText(raw.name_en, `${context}.name_en`) }),
    ancestors: array(raw.ancestors ?? [], `${context}.ancestors`).map((item, index) => {
      const entry = record(item, `${context}.ancestors[${index}]`);
      return {
        level: nonNegativeInteger(entry.level, `${context}.ancestors[${index}].level`),
        code: requiredString(entry.code, `${context}.ancestors[${index}].code`),
        name_ko: displayText(entry.name_ko, `${context}.ancestors[${index}].name_ko`),
      };
    }),
    reference: {
      as_of: requiredString(reference.as_of, `${context}.reference.as_of`),
      source: displayText(reference.source, `${context}.reference.source`),
    },
  };
}

export function decodeHsClassification(value: unknown): HsClassification {
  const context = "HS classification";
  const raw = record(value, context);
  const reference = record(raw.reference, `${context}.reference`);
  return {
    review_run_id: requiredString(raw.review_run_id, `${context}.review_run_id`),
    case_id: requiredString(raw.case_id, `${context}.case_id`),
    reference: {
      as_of: requiredString(reference.as_of, `${context}.reference.as_of`),
      source: displayText(reference.source, `${context}.reference.source`),
    },
    candidates: array(raw.candidates, `${context}.candidates`).map((item, index) =>
      decodeHsCandidate(item, `${context}.candidates[${index}]`),
    ),
    ...(raw.selection === undefined || raw.selection === null
      ? {}
      : { selection: decodeHsSelection(raw.selection, `${context}.selection`) }),
  };
}

function decodeOriginCheck(value: unknown, context: string): OriginCheck {
  const raw = record(value, context);
  return {
    field: oneOf(raw.field, ["certificate_no", "origin_country", "hs_code"] as const, `${context}.field`),
    ...(raw.certificate_value === undefined || raw.certificate_value === null
      ? {}
      : { certificate_value: displayText(raw.certificate_value, `${context}.certificate_value`) }),
    ...(raw.reference_value === undefined || raw.reference_value === null
      ? {}
      : { reference_value: displayText(raw.reference_value, `${context}.reference_value`) }),
    ...(raw.reference_document_id === undefined || raw.reference_document_id === null
      ? {}
      : {
          reference_document_id: requiredString(
            raw.reference_document_id,
            `${context}.reference_document_id`,
          ),
        }),
    status: oneOf(raw.status, ["match", "mismatch", "missing"] as const, `${context}.status`),
  };
}

export function decodeOriginVerification(value: unknown): OriginVerification {
  const context = "origin verification";
  const raw = record(value, context);
  const certificate =
    raw.certificate === undefined || raw.certificate === null
      ? undefined
      : record(raw.certificate, `${context}.certificate`);
  return {
    review_run_id: requiredString(raw.review_run_id, `${context}.review_run_id`),
    case_id: requiredString(raw.case_id, `${context}.case_id`),
    status: oneOf(
      raw.status,
      ["verified", "mismatch", "missing_certificate", "needs_review"] as const,
      `${context}.status`,
    ),
    ...(certificate === undefined
      ? {}
      : {
          certificate: {
            document_id: requiredString(certificate.document_id, `${context}.certificate.document_id`),
            filename: requiredString(certificate.filename, `${context}.certificate.filename`),
            extraction_status: requiredString(
              certificate.extraction_status,
              `${context}.certificate.extraction_status`,
            ),
          },
        }),
    ...(raw.origin_country === undefined || raw.origin_country === null
      ? {}
      : { origin_country: requiredString(raw.origin_country, `${context}.origin_country`) }),
    checks: array(raw.checks ?? [], `${context}.checks`).map((item, index) =>
      decodeOriginCheck(item, `${context}.checks[${index}]`),
    ),
    fta_hints: array(raw.fta_hints ?? [], `${context}.fta_hints`).map((item, index) => {
      const entry = record(item, `${context}.fta_hints[${index}]`);
      return {
        agreement_code: requiredString(entry.agreement_code, `${context}.fta_hints[${index}].agreement_code`),
        agreement_name: displayText(entry.agreement_name, `${context}.fta_hints[${index}].agreement_name`),
        origin_covered: booleanValue(entry.origin_covered, `${context}.fta_hints[${index}].origin_covered`),
        certificate_form: displayText(
          entry.certificate_form,
          `${context}.fta_hints[${index}].certificate_form`,
        ),
        source_uri: displayText(entry.source_uri, `${context}.fta_hints[${index}].source_uri`),
      };
    }),
  };
}

function decodeDutyRate(value: unknown, context: string): DutyRate {
  const raw = record(value, context);
  return {
    rate_kind: oneOf(raw.rate_kind, ["basic", "fta"] as const, `${context}.rate_kind`),
    ...(raw.agreement_code === undefined || raw.agreement_code === null
      ? {}
      : { agreement_code: requiredString(raw.agreement_code, `${context}.agreement_code`) }),
    label: displayText(raw.label, `${context}.label`),
    rate_pct: nonNegativeNumber(raw.rate_pct, `${context}.rate_pct`),
    source_uri: displayText(raw.source_uri, `${context}.source_uri`),
    requirements: array(raw.requirements ?? [], `${context}.requirements`).map((item, index) => {
      const entry = record(item, `${context}.requirements[${index}]`);
      return {
        code: oneOf(
          entry.code,
          ["origin_in_agreement", "certificate_present", "certificate_origin_match"] as const,
          `${context}.requirements[${index}].code`,
        ),
        satisfied: booleanValue(entry.satisfied, `${context}.requirements[${index}].satisfied`),
      };
    }),
    applicable: booleanValue(raw.applicable, `${context}.applicable`),
  };
}

function decodeDutyEstimate(value: unknown, context: string): DutyEstimate {
  const raw = record(value, context);
  return {
    rate_kind: oneOf(raw.rate_kind, ["basic", "fta"] as const, `${context}.rate_kind`),
    ...(raw.agreement_code === undefined || raw.agreement_code === null
      ? {}
      : { agreement_code: requiredString(raw.agreement_code, `${context}.agreement_code`) }),
    rate_pct: nonNegativeNumber(raw.rate_pct, `${context}.rate_pct`),
    duty_amount: nonNegativeNumber(raw.duty_amount, `${context}.duty_amount`),
    vat_rate_pct: nonNegativeNumber(raw.vat_rate_pct, `${context}.vat_rate_pct`),
    vat_amount: nonNegativeNumber(raw.vat_amount, `${context}.vat_amount`),
    total_estimated: nonNegativeNumber(raw.total_estimated, `${context}.total_estimated`),
    currency: currencyCode(raw.currency, `${context}.currency`),
  };
}

export function decodeDutyAssessment(value: unknown): DutyAssessment {
  const context = "duty assessment";
  const raw = record(value, context);
  const reference = record(raw.reference, `${context}.reference`);
  const hs = raw.hs_code === undefined || raw.hs_code === null ? undefined : record(raw.hs_code, `${context}.hs_code`);
  const dutiable =
    raw.dutiable_value === undefined || raw.dutiable_value === null
      ? undefined
      : record(raw.dutiable_value, `${context}.dutiable_value`);
  const savings =
    raw.savings === undefined || raw.savings === null
      ? undefined
      : record(raw.savings, `${context}.savings`);
  return {
    review_run_id: requiredString(raw.review_run_id, `${context}.review_run_id`),
    case_id: requiredString(raw.case_id, `${context}.case_id`),
    status: oneOf(
      raw.status,
      ["estimated", "hs_code_unavailable", "rates_unavailable", "value_unavailable"] as const,
      `${context}.status`,
    ),
    reference: {
      as_of: requiredString(reference.as_of, `${context}.reference.as_of`),
      source: displayText(reference.source, `${context}.reference.source`),
      disclaimer: displayText(reference.disclaimer, `${context}.reference.disclaimer`),
    },
    ...(hs === undefined
      ? {}
      : {
          hs_code: {
            code: hsCode(hs.code, `${context}.hs_code.code`),
            source: oneOf(
              hs.source,
              ["reviewer_selection", "document_fact"] as const,
              `${context}.hs_code.source`,
            ),
            ...(hs.name_ko === undefined || hs.name_ko === null
              ? {}
              : { name_ko: displayText(hs.name_ko, `${context}.hs_code.name_ko`) }),
          },
        }),
    ...(raw.origin_country === undefined || raw.origin_country === null
      ? {}
      : { origin_country: requiredString(raw.origin_country, `${context}.origin_country`) }),
    ...(dutiable === undefined
      ? {}
      : {
          dutiable_value: {
            amount: nonNegativeNumber(dutiable.amount, `${context}.dutiable_value.amount`),
            currency: currencyCode(dutiable.currency, `${context}.dutiable_value.currency`),
            basis: requiredString(dutiable.basis, `${context}.dutiable_value.basis`),
            ...(dutiable.document_id === undefined || dutiable.document_id === null
              ? {}
              : {
                  document_id: requiredString(
                    dutiable.document_id,
                    `${context}.dutiable_value.document_id`,
                  ),
                }),
          },
        }),
    rates: array(raw.rates ?? [], `${context}.rates`).map((item, index) =>
      decodeDutyRate(item, `${context}.rates[${index}]`),
    ),
    ...(raw.applied === undefined || raw.applied === null
      ? {}
      : { applied: decodeDutyEstimate(raw.applied, `${context}.applied`) }),
    ...(savings === undefined
      ? {}
      : {
          savings: {
            vs_basic_duty: nonNegativeNumber(savings.vs_basic_duty, `${context}.savings.vs_basic_duty`),
            currency: currencyCode(savings.currency, `${context}.savings.currency`),
            blocked_requirements: array(
              savings.blocked_requirements ?? [],
              `${context}.savings.blocked_requirements`,
            ).map((item, index) =>
              requiredString(item, `${context}.savings.blocked_requirements[${index}]`),
            ),
          },
        }),
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

function booleanValue(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") throw new ContractError(`${context}: boolean expected`);
  return value;
}

function nonNegativeNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) {
    throw new ContractError(`${context}: non-negative number expected`);
  }
  return value;
}

function boundedRatio(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new ContractError(`${context}: ratio between zero and one expected`);
  }
  return value;
}

function hsCode(value: unknown, context: string): string {
  const result = requiredString(value, context);
  if (!/^[0-9]{10}$/u.test(result)) throw new ContractError(`${context}: ten-digit HS code expected`);
  return result;
}

function currencyCode(value: unknown, context: string): string {
  const result = requiredString(value, context);
  if (!/^[A-Z]{3}$/u.test(result)) throw new ContractError(`${context}: ISO currency code expected`);
  return result;
}

function plannerCycle(value: unknown, context: string): 1 | 2 {
  if (value !== 1 && value !== 2) throw new ContractError(`${context}: one or two expected`);
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
