import type {
  AgentWorkflow,
  AssistantAnswerSection,
  AssistantAnswerScope,
  AssistantCitation,
  AssistantConversation,
  AssistantCorrectionDraft,
  AssistantMessage,
  AssistantMessageExchange,
  Assessment,
  AuthConfig,
  CaseDocument,
  CaseSummary,
  ComparisonOperand,
  CorrectionDecision,
  CorrectionProposal,
  CorrectionProposalHistoryEntry,
  DocumentAnalysis,
  DocumentFact,
  DocumentLineItem,
  DocumentView,
  EvidenceItem,
  EvidenceTemporalContext,
  FactSourceReference,
  HumanProvidedSourceReference,
  JobRecord,
  KnowledgeAnswerScope,
  KnowledgeAnswerSection,
  KnowledgeCoverage,
  KnowledgeConversation,
  GuidanceResolution,
  GuidanceEvidenceCitation,
  KnowledgeMessage,
  KnowledgeMessageExchange,
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
  const metadata = raw.metadata === undefined || raw.metadata === null
    ? undefined
    : record(raw.metadata, "case.metadata");
  return {
    case_id: requiredString(raw.case_id, "case.case_id"),
    org_id: requiredString(raw.org_id, "case.org_id"),
    ...(raw.external_reference === undefined || raw.external_reference === null
      ? {}
      : { external_reference: requiredString(raw.external_reference, "case.external_reference") }),
    title: requiredString(raw.title, "case.title"),
    status: oneOf(raw.status, ["open", "in_review", "closed"], "case.status"),
    revision: nonNegativeInteger(raw.revision, "case.revision"),
    ...(metadata === undefined ? {} : { metadata }),
    updated_at: requiredString(raw.updated_at, "case.updated_at"),
  };
}

export function decodeDocument(value: unknown): CaseDocument {
  const raw = record(value, "document");
  const type = oneOf(raw.document_type, [
    "CI", "PL", "BL", "CO", "AWB", "EXPORT_DECLARATION", "SUPPORTING_EVIDENCE", "UNKNOWN",
  ], "document.document_type");
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
    ...(raw.temporal_context === undefined || raw.temporal_context === null
      ? {}
      : { temporal_context: decodeEvidenceTemporalContext(raw.temporal_context) }),
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

function decodeEvidenceTemporalContext(value: unknown): EvidenceTemporalContext {
  const raw = record(value, "run.temporal_context");
  return {
    law_as_of: isoDate(raw.law_as_of, "run.temporal_context.law_as_of"),
    hsk_snapshot_as_of: isoDate(raw.hsk_snapshot_as_of, "run.temporal_context.hsk_snapshot_as_of"),
    requirements_snapshot_as_of: isoDate(
      raw.requirements_snapshot_as_of,
      "run.temporal_context.requirements_snapshot_as_of",
    ),
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
  assertCaseMessageHasNoKnowledgeProvenance(raw, "assistant message");
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
      : decodeAssistantCitationList(raw.citations, "assistant message.citations"),
    suggested_questions: raw.suggested_questions === undefined
      ? []
      : decodeSuggestedQuestions(raw.suggested_questions),
    ...(raw.correction_draft === undefined || raw.correction_draft === null
      ? {}
      : { correction_draft: decodeAssistantCorrectionDraft(raw.correction_draft, "assistant message.correction_draft") }),
    ...(raw.answer_sections === undefined || raw.answer_sections === null
      ? {}
      : { answer_sections: decodeAssistantAnswerSections(raw.answer_sections, role, "assistant message.answer_sections") }),
    ...decodeCaseGuidanceResolution(raw, role, "assistant message"),
    ...decodeCaseInputNotice(raw, role, "assistant message"),
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

function decodeCaseGuidanceResolution(
  raw: Record<string, unknown>,
  role: AssistantMessage["role"],
  context: string,
): Pick<AssistantMessage, "guidance_resolution"> {
  if (raw.guidance_resolution === undefined || raw.guidance_resolution === null) return {};
  if (role !== "assistant") throw new ContractError(`${context} user message cannot carry guidance resolution`);
  return { guidance_resolution: decodeGuidanceResolutionValue(raw.guidance_resolution, `${context}.guidance_resolution`) };
}

function decodeGuidanceResolutionValue(value: unknown, context: string): GuidanceResolution {
  const raw = record(value, context);
  const applicable = array(raw.applicable_directions, `${context}.applicable_directions`);
  if (!applicable.length || applicable.length > 2) {
    throw new ContractError(`${context}.applicable_directions must have one or two values`);
  }
  const applicable_directions = applicable.map((direction, index) => oneOf(
    direction,
    ["import", "export"] as const,
    `${context}.applicable_directions[${index}]`,
  ));
  if (new Set(applicable_directions).size !== applicable_directions.length) {
    throw new ContractError(`${context}.applicable_directions must be unique`);
  }
  const coverage = oneOf(raw.coverage, ["covered", "no_coverage", "partial", "unavailable"] as const, `${context}.coverage`);
  const snapshot = raw.snapshot_id === undefined || raw.snapshot_id === null
    ? undefined
    : technicalIdentifier(raw.snapshot_id, `${context}.snapshot_id`);
  if ((coverage === "covered" || coverage === "partial") && !snapshot) {
    throw new ContractError(`${context} coverage requires a snapshot`);
  }
  return {
    topic: requiredString(raw.topic, `${context}.topic`),
    scope: requiredString(raw.scope, `${context}.scope`),
    requested_direction: oneOf(raw.requested_direction, ["import", "export", "both"] as const, `${context}.requested_direction`),
    applicable_directions,
    coverage,
    ...(snapshot === undefined ? {} : { snapshot_id: snapshot }),
    as_of: isoDate(raw.as_of, `${context}.as_of`),
    registry_version: oneOf(raw.registry_version, ["1.0", "2.0"] as const, `${context}.registry_version`),
  };
}

function decodeCaseInputNotice(
  raw: Record<string, unknown>,
  role: AssistantMessage["role"],
  context: string,
): Pick<AssistantMessage, "case_input_notice"> {
  if (raw.case_input_notice === undefined || raw.case_input_notice === null) return {};
  if (role !== "assistant") throw new ContractError(`${context} user message cannot carry a Case input notice`);
  return {
    case_input_notice: oneOf(raw.case_input_notice, ["unregistered_document_text"] as const, `${context}.case_input_notice`),
  };
}

/** Decode the Case-independent official knowledge conversation boundary. */
export function decodeKnowledgeConversation(value: unknown): KnowledgeConversation {
  const raw = record(value, "knowledge conversation");
  assertKnowledgeIsCaseIndependent(raw, "knowledge conversation");
  return {
    conversation_id: requiredString(raw.conversation_id, "knowledge conversation.conversation_id"),
    ...(raw.title === undefined || raw.title === null
      ? {}
      : { title: displayText(raw.title, "knowledge conversation.title") }),
    trade_type: oneOf(raw.trade_type, ["import", "export", "both"], "knowledge conversation.trade_type"),
    as_of: isoDate(raw.as_of, "knowledge conversation.as_of"),
    ...(raw.snapshot_id === undefined || raw.snapshot_id === null
      ? {}
      : { snapshot_id: technicalIdentifier(raw.snapshot_id, "knowledge conversation.snapshot_id") }),
    created_by: requiredString(raw.created_by, "knowledge conversation.created_by"),
    created_at: requiredString(raw.created_at, "knowledge conversation.created_at"),
    updated_at: requiredString(raw.updated_at, "knowledge conversation.updated_at"),
  };
}

export function decodeKnowledgeMessage(
  value: unknown,
  inferredRole?: KnowledgeMessage["role"],
): KnowledgeMessage {
  const raw = record(value, "knowledge message");
  assertKnowledgeIsCaseIndependent(raw, "knowledge message");
  const role = raw.role === undefined
    ? inferredRole
    : oneOf(raw.role, ["user", "assistant"], "knowledge message.role");
  if (!role) throw new ContractError("knowledge message.role is absent");
  if (raw.snapshot_id !== undefined || raw.as_of !== undefined || raw.coverage !== undefined || raw.registry_version !== undefined) {
    throw new ContractError("knowledge message provenance must be carried by guidance evidence citations");
  }
  const citations = raw.citations === undefined
    ? []
    : decodeAssistantCitationList(raw.citations, "knowledge message.citations");
  const answerSections = raw.answer_sections === undefined || raw.answer_sections === null
    ? []
    : decodeAssistantAnswerSections(raw.answer_sections, role, "knowledge message.answer_sections");
  const suggestedQuestions = raw.suggested_questions === undefined
    ? []
    : decodeSuggestedQuestions(raw.suggested_questions);
  const answerScope = decodeKnowledgeAnswerScope(raw.answer_scope, role);
  const provenance = decodeKnowledgeMessageProvenance(raw, role, "knowledge message");
  const guidanceResolution = decodeKnowledgeGuidanceResolution(raw, role, "knowledge message");
  if ([...citations, ...answerSections.flatMap((section) => section.citations)].some((citation) => citation.kind !== "guidance_evidence")) {
    throw new ContractError("knowledge message citations must not reference a Case or review run");
  }
  if (role === "user" && (citations.length || answerSections.length || suggestedQuestions.length || answerScope.answer_scope !== undefined)) {
    throw new ContractError("knowledge user message cannot carry an answer projection");
  }
  if (role === "assistant" && answerSections.some((section) => section.kind !== "general_guidance")) {
    throw new ContractError("knowledge answer cannot contain a Case analysis section");
  }
  return {
    message_id: requiredString(raw.message_id, "knowledge message.message_id"),
    conversation_id: requiredString(raw.conversation_id, "knowledge message.conversation_id"),
    role,
    content: displayText(raw.content, "knowledge message.content"),
    ...answerScope,
    citations: citations as GuidanceEvidenceCitation[],
    ...(answerSections.length ? { answer_sections: answerSections as KnowledgeAnswerSection[] } : {}),
    suggested_questions: suggestedQuestions,
    ...provenance,
    ...guidanceResolution,
    created_by: requiredString(raw.created_by, "knowledge message.created_by"),
    created_at: requiredString(raw.created_at, "knowledge message.created_at"),
  };
}

function decodeKnowledgeGuidanceResolution(
  raw: Record<string, unknown>,
  role: KnowledgeMessage["role"],
  context: string,
): Pick<KnowledgeMessage, "guidance_resolution"> {
  if (raw.guidance_resolution === undefined || raw.guidance_resolution === null) return {};
  if (role !== "assistant") throw new ContractError(`${context} user message cannot carry guidance resolution`);
  return { guidance_resolution: decodeGuidanceResolutionValue(raw.guidance_resolution, `${context}.guidance_resolution`) };
}

/**
 * The Backend's ordinary Case conversation route must never carry a global
 * knowledge-snapshot resolution.  Rejecting it here prevents a future API
 * regression from blurring the Case and general-guidance data boundaries.
 */
function assertCaseMessageHasNoKnowledgeProvenance(raw: Record<string, unknown>, context: string): void {
  const prohibited = ["knowledge_coverage", "knowledge_snapshot_id", "knowledge_as_of"];
  const found = prohibited.find((key) => raw[key] !== undefined);
  if (found) throw new ContractError(`${context} must not include standalone knowledge provenance (${found})`);
}

/**
 * New standalone knowledge answers retain the Data resolution even when no
 * citation exists (for example, no coverage or a temporary unavailable
 * result).  Older persisted messages legitimately have none of these
 * additive fields, but partial provenance and provenance on a user message
 * are both rejected.
 */
function decodeKnowledgeMessageProvenance(
  raw: Record<string, unknown>,
  role: KnowledgeMessage["role"],
  context: string,
): Pick<KnowledgeMessage, "knowledge_coverage" | "knowledge_snapshot_id" | "knowledge_as_of"> {
  const hasCoverage = raw.knowledge_coverage !== undefined;
  const hasSnapshot = raw.knowledge_snapshot_id !== undefined;
  const hasAsOf = raw.knowledge_as_of !== undefined;
  const supplied = hasCoverage || hasSnapshot || hasAsOf;
  if (!supplied) return {};
  if (role !== "assistant") {
    throw new ContractError(`${context} user message must not include standalone knowledge provenance`);
  }
  if (!hasCoverage || !hasAsOf) {
    throw new ContractError(`${context} provenance requires knowledge_coverage and knowledge_as_of`);
  }
  return {
    knowledge_coverage: oneOf(
      raw.knowledge_coverage,
      ["covered", "no_coverage", "partial", "unavailable"] as const,
      `${context}.knowledge_coverage`,
    ) as KnowledgeCoverage,
    knowledge_as_of: isoDate(raw.knowledge_as_of, `${context}.knowledge_as_of`),
    ...(hasSnapshot
      ? { knowledge_snapshot_id: technicalIdentifier(raw.knowledge_snapshot_id, `${context}.knowledge_snapshot_id`) }
      : {}),
  };
}

function assertKnowledgeIsCaseIndependent(raw: Record<string, unknown>, context: string): void {
  const prohibited = [
    "case_id",
    "review_run_id",
    "case",
    "review_run",
    "review_input",
    "review_result",
    "document_id",
    "document_ids",
    "document",
    "documents",
    "document_content",
    "content_text",
    "document_analyses",
    "correction_draft",
  ];
  const found = prohibited.find((key) => raw[key] !== undefined && raw[key] !== null);
  if (found) {
    throw new ContractError(`${context} must not include Case, review, or document data (${found})`);
  }
}

export function decodeKnowledgeMessageExchange(value: unknown): KnowledgeMessageExchange {
  const raw = record(value, "knowledge message exchange");
  return {
    user_message: decodeKnowledgeMessage(raw.user_message, "user"),
    assistant_message: decodeKnowledgeMessage(raw.assistant_message, "assistant"),
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
    document_type: oneOf(raw.document_type, [
      "invoice", "packing_list", "bill_of_lading", "certificate_of_origin", "air_waybill",
      "export_declaration", "supporting_evidence", "unknown",
    ], "document analysis.document_type"),
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

function decodeAssistantCitation(value: unknown, context: string): AssistantCitation {
  const raw = record(value, context);
  if (raw.kind === "guidance_evidence") {
    const sourceId = requiredString(raw.source_id, `${context}.source_id`);
    if (raw.reference_id !== undefined && raw.reference_id !== sourceId) {
      throw new ContractError(`${context}: guidance evidence reference_id must match source_id`);
    }
    return {
      kind: "guidance_evidence",
      ...(raw.reference_id === undefined ? {} : { reference_id: sourceId }),
      source_id: sourceId,
      source_kind: knowledgeSourceKind(raw.source_kind, `${context}.source_kind`),
      source_title: displayText(raw.source_title, `${context}.source_title`),
      source_uri: requiredString(raw.source_uri, `${context}.source_uri`),
      as_of: isoDate(raw.as_of, `${context}.as_of`),
      snapshot_id: requiredString(raw.snapshot_id, `${context}.snapshot_id`),
      coverage: oneOf(raw.coverage, ["covered", "no_coverage", "partial", "unavailable"] as const, `${context}.coverage`),
    } satisfies GuidanceEvidenceCitation;
  }
  if (
    raw.source_id !== undefined
    || raw.source_kind !== undefined
    || raw.source_title !== undefined
    || raw.source_uri !== undefined
    || raw.as_of !== undefined
    || raw.snapshot_id !== undefined
    || raw.coverage !== undefined
  ) {
    throw new ContractError(`${context}: Case citation cannot include guidance provenance`);
  }
  return {
    kind: oneOf(raw.kind, ["fact", "comparison", "evidence"] as const, `${context}.kind`),
    reference_id: requiredString(raw.reference_id, `${context}.reference_id`),
  };
}

function decodeAssistantCitationList(value: unknown, context: string): AssistantCitation[] {
  const values = array(value, context);
  if (values.length > 100) throw new ContractError(`${context} exceeds one hundred items`);
  return values.map((citation, index) => decodeAssistantCitation(citation, `${context}[${index}]`));
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

function decodeKnowledgeAnswerScope(
  value: unknown,
  role: KnowledgeMessage["role"],
): { answer_scope?: KnowledgeAnswerScope } {
  if (value === undefined || value === null) {
    if (role === "assistant") throw new ContractError("knowledge assistant answer_scope is absent");
    return {};
  }
  if (role !== "assistant") throw new ContractError("knowledge user message cannot carry an answer scope");
  return {
    answer_scope: oneOf(value, [
      "general_customs_guidance",
      "clarification_needed",
      "insufficient_evidence",
      "out_of_scope",
    ] as const, "knowledge message.answer_scope"),
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

function decodeAssistantAnswerSections(
  value: unknown,
  role: "user" | "assistant",
  context: string,
): AssistantAnswerSection[] {
  const sections = array(value, context);
  if (!sections.length) return [];
  if (role !== "assistant") throw new ContractError(`${context}: only assistant messages can include sections`);
  if (sections.length > 3) {
    throw new ContractError(`${context}: at most three bounded sections are allowed`);
  }
  const decoded = sections.map((section, index) => decodeAssistantAnswerSection(section, `${context}[${index}]`));
  if (new Set(decoded.map((section) => section.kind)).size !== decoded.length) {
    throw new ContractError(`${context}: duplicate section kind is not allowed`);
  }
  const ordering = decoded[0]?.kind === "general_guidance"
    ? ["general_guidance"] as const
    : ["case_analysis", "general_guidance", "case_application"] as const;
  if (decoded.some((section, index) => ordering[index] !== section.kind)) {
    throw new ContractError(`${context}: sections must use the Case, general guidance, application order`);
  }
  return decoded;
}

function decodeAssistantAnswerSection(value: unknown, context: string): AssistantAnswerSection {
  const raw = record(value, context);
  const citations = raw.citations === undefined
    ? []
    : decodeAssistantCitationList(raw.citations, `${context}.citations`);
  return {
    kind: oneOf(raw.kind, ["case_analysis", "general_guidance", "case_application"], `${context}.kind`),
    title: displayText(raw.title, `${context}.title`),
    content: displayText(raw.content, `${context}.content`),
    citations,
  };
}

function decodeIdentifierList(value: unknown, context: string): string[] {
  return array(value, context).map((item, index) => requiredString(item, `${context}[${index}]`));
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

/**
 * Snapshot identifiers are technical values: validate them before they reach
 * an opt-in copyable verification panel, and never render arbitrary provider
 * text as an identifier.
 */
function technicalIdentifier(value: unknown, context: string): string {
  const identifier = requiredString(value, context);
  if (identifier.length > 512 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(identifier)) {
    throw new ContractError(`${context} is not a safe technical identifier`);
  }
  return identifier;
}

function knowledgeSourceKind(value: unknown, context: string): GuidanceEvidenceCitation["source_kind"] {
  return oneOf(value, [
    "official_law",
    "official_law_catalog",
    "official_agency_guidance",
    "official_requirement_reference",
    "official_public_guidance",
    "development_fixture",
  ] as const, context);
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
