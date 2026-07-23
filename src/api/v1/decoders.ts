import { sha256 } from "@noble/hashes/sha2.js";
import type {
  AuthConfig,
  ApiProblem,
  AuditEvent,
  ChatRecord,
  CaseDetail,
  CaseSummary,
  GroundedAnswer,
  CorrectionProposal,
  CorrectionProposalDecisionResponse,
  HumanDecisionRecord,
  JobRecord,
  LocalUatMetadata,
  ModelExecutionSummary,
  NarrativeClaim,
  NarrativeReport,
  Paged,
  RequiredAction,
  ReleaseIdentity,
  ReviewRun,
  RunSummary,
  ReviewStageEvent,
  Session,
  SupportingDocumentRecord,
  UatScenario,
} from "./types";

type JsonObject = Record<string, unknown>;

const SHA256 = /^[a-f0-9]{64}$/;
const GLOBAL_REFERENCE_ID = /^[a-z][a-z0-9-]*_[a-f0-9]{64}$/;
const EXACT_CLAUDE_MODEL = /^claude-[a-z0-9-]+-[0-9]{8}$/;
const MAX_DOCUMENT_TEXT_CHARACTERS = 200_000;
export const MAX_SUPPORTING_DOCUMENTS = 100;
const MAX_SUPPORTING_ASSERTIONS = 20;
const MAX_SUPPORTING_REFERENCES = 100;
const REQUIRED_PRIMARY_DOCUMENT_TYPES = ["CI", "PL", "BL", "CO"] as const;
const RESULT_TYPE_BY_PRIMARY_DOCUMENT: Readonly<Record<(typeof REQUIRED_PRIMARY_DOCUMENT_TYPES)[number], string>> = {
  CI: "invoice",
  PL: "packing_list",
  BL: "bill_of_lading",
  CO: "certificate_of_origin",
};
const MANDATORY_CORE_STAGES = [
  "load_case",
  "classify_documents",
  "extract_documents",
  "normalize_documents",
  "pair_documents",
  "validate_cross_documents",
  "retrieve_regulations",
  "compliance_review",
  "generate_xai_report",
  "route_to_human_or_complete",
  "redact_sensitive_inputs",
] as const;
const ALLOWED_TOOLS = new Set([
  "document.reread_span/v1",
  "evidence.retrieve/v3",
  "human.request/v1",
  "explanation.compose/v1",
  "case.answer/v1",
]);
const GAP_TYPES = new Set([
  "field_uncertainty",
  "validation_issue",
  "regulatory_finding",
  "evidence_incomplete",
  "human_approval_required",
  "release_gate",
]);
const BACKEND_PUBLIC_RESULT_DETAIL_KEYS = [
  "document_results",
  "evidence_provenance",
  "fact_ledger",
  "jurisdiction",
  "knowledge_snapshot_id",
  "model_execution_summary",
  "narrative_execution_summary",
  "rag_evidence",
  "regulatory_findings",
  "retrieval_coverage",
  "retrieval_results",
  "retrieval_status",
  "review_as_of",
  "review_gaps",
  "review_plan",
  "review_stage_trace",
  "trade_type",
  "validation_issues",
] as const;
const BACKEND_PRIVATE_RESULT_FIELDS = [
  "schema_version",
  "status",
  "requires_human_review",
  "case_id",
  "input_manifest_sha256",
] as const;

function object(value: unknown, context: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContractError(`${context}: object expected`);
  }
  return value as JsonObject;
}

function string(value: unknown, context: string): string {
  if (typeof value !== "string") throw new ContractError(`${context}: string expected`);
  return value;
}

function array(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) throw new ContractError(`${context}: array expected`);
  return value;
}

function boundedArray(value: unknown, context: string, maximum: number): unknown[] {
  const decoded = array(value, context);
  if (decoded.length > maximum) throw new ContractError(`${context}: maximum ${maximum} items exceeded`);
  return decoded;
}

function boundedString(value: unknown, context: string, maximum: number): string {
  const decoded = string(value, context);
  if (decoded.length === 0 || decoded.length > maximum || /[\u0000-\u001f\u007f]/.test(decoded)) {
    throw new ContractError(`${context}: non-empty control-free string up to ${maximum} characters expected`);
  }
  return decoded;
}

export function decodeExactIsoDate(value: unknown, context: string): string {
  const decoded = string(value, context);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(decoded);
  if (!match) throw new ContractError(`${context}: exact YYYY-MM-DD calendar date expected`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > (days[month - 1] ?? 0)) {
    throw new ContractError(`${context}: valid calendar date expected`);
  }
  return decoded;
}

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

export function decodeSession(value: unknown): Session {
  const raw = object(value, "session");
  string(raw.subject, "session.subject");
  string(raw.org_id, "session.org_id");
  const allowedRoles = new Set(["reviewer", "approver", "auditor", "admin"]);
  const roles = array(raw.roles, "session.roles");
  if (roles.length === 0) throw new ContractError("session.roles: at least one role required");
  roles.forEach((role, index) => {
    const decoded = string(role, `session.roles[${index}]`);
    if (!allowedRoles.has(decoded)) throw new ContractError(`session.roles[${index}]: unsupported role`);
  });
  return raw as unknown as Session;
}

export function decodeLocalUatMetadata(value: unknown): LocalUatMetadata {
  const raw = object(value, "localUatMetadata");
  const allowedKeys = new Set([
    "mode",
    "assurance_ceiling",
    "text_only",
    "auto_completion_enabled",
    "claude_mode",
    "evidence_profile",
    "evidence_scope_label",
    "evidence_dataset",
    "supported_review_as_of",
    "planner_mode",
    "production_release",
  ]);
  if (Object.keys(raw).some((key) => !allowedKeys.has(key))) {
    throw new ContractError("localUatMetadata: unsupported or sensitive field");
  }
  const exact = <T extends string | boolean>(key: keyof LocalUatMetadata, expected: T): T => {
    if (raw[key] !== expected) throw new ContractError(`localUatMetadata.${key}: ${String(expected)} required`);
    return expected;
  };
  const oneOf = <T extends string>(key: keyof LocalUatMetadata, allowed: readonly T[]): T => {
    const decoded = boundedString(raw[key], `localUatMetadata.${key}`, 80);
    if (!allowed.includes(decoded as T)) throw new ContractError(`localUatMetadata.${key}: unsupported value`);
    return decoded as T;
  };
  const evidenceProfile = oneOf(
    "evidence_profile",
    ["synthetic-v3", "preserved-3law-v3-diagnostic", "unknown"] as const,
  );
  const evidenceScopeLabel = oneOf(
    "evidence_scope_label",
    ["TEST_ONLY_V3", "ACTUAL_3_LAW_RAG_3_OF_58", "UNKNOWN"] as const,
  );
  const dataset = object(raw.evidence_dataset, "localUatMetadata.evidence_dataset");
  const datasetKeys = [
    "data_source",
    "expected_production_law_count",
    "observed_article_count",
    "observed_law_count",
    "rag_quality_evaluated",
    "store_counts",
  ].sort().join(",");
  if (Object.keys(dataset).sort().join(",") !== datasetKeys) {
    throw new ContractError("localUatMetadata.evidence_dataset: unsupported or sensitive field");
  }
  const storeCounts = object(
    dataset.store_counts,
    "localUatMetadata.evidence_dataset.store_counts",
  );
  if (
    Object.keys(storeCounts).sort().join(",")
    !== ["neo4j_article_count", "postgresql_article_count", "qdrant_point_count"].join(",")
  ) {
    throw new ContractError(
      "localUatMetadata.evidence_dataset.store_counts: unsupported or sensitive field",
    );
  }
  const boundedCount = (candidate: unknown, context: string, maximum: number): number => {
    if (
      typeof candidate !== "number"
      || !Number.isInteger(candidate)
      || candidate < 0
      || candidate > maximum
    ) {
      throw new ContractError(`${context}: bounded non-negative integer expected`);
    }
    return candidate;
  };
  const dataSource = boundedString(
    dataset.data_source,
    "localUatMetadata.evidence_dataset.data_source",
    64,
  );
  if (![
    "SYNTHETIC_V3_NO_RAG_QUALITY",
    "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY",
    "UNKNOWN",
  ].includes(dataSource)) {
    throw new ContractError("localUatMetadata.evidence_dataset.data_source: unsupported value");
  }
  if (dataset.rag_quality_evaluated !== false) {
    throw new ContractError(
      "localUatMetadata.evidence_dataset.rag_quality_evaluated: false required",
    );
  }
  const expectedLawCount = boundedCount(
    dataset.expected_production_law_count,
    "localUatMetadata.evidence_dataset.expected_production_law_count",
    10_000,
  );
  const observedLawCount = boundedCount(
    dataset.observed_law_count,
    "localUatMetadata.evidence_dataset.observed_law_count",
    10_000,
  );
  const observedArticleCount = boundedCount(
    dataset.observed_article_count,
    "localUatMetadata.evidence_dataset.observed_article_count",
    10_000_000,
  );
  const postgresqlArticleCount = boundedCount(
    storeCounts.postgresql_article_count,
    "localUatMetadata.evidence_dataset.store_counts.postgresql_article_count",
    10_000_000,
  );
  const qdrantPointCount = boundedCount(
    storeCounts.qdrant_point_count,
    "localUatMetadata.evidence_dataset.store_counts.qdrant_point_count",
    10_000_000,
  );
  const neo4jArticleCount = boundedCount(
    storeCounts.neo4j_article_count,
    "localUatMetadata.evidence_dataset.store_counts.neo4j_article_count",
    10_000_000,
  );
  const actualThreeLaw = evidenceProfile === "preserved-3law-v3-diagnostic"
    && evidenceScopeLabel === "ACTUAL_3_LAW_RAG_3_OF_58"
    && dataSource === "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY"
    && expectedLawCount === 58
    && observedLawCount === 3
    && observedArticleCount > 0
    && postgresqlArticleCount === observedArticleCount
    && qdrantPointCount === observedArticleCount
    && neo4jArticleCount === observedArticleCount;
  const synthetic = evidenceProfile === "synthetic-v3"
    && evidenceScopeLabel === "TEST_ONLY_V3"
    && dataSource === "SYNTHETIC_V3_NO_RAG_QUALITY"
    && expectedLawCount === 58
    && observedLawCount === 0
    && observedArticleCount === 0
    && postgresqlArticleCount === 0
    && qdrantPointCount === 0
    && neo4jArticleCount === 0;
  const unknown = evidenceProfile === "unknown"
    && evidenceScopeLabel === "UNKNOWN"
    && dataSource === "UNKNOWN"
    && expectedLawCount === 58
    && observedLawCount === 0
    && observedArticleCount === 0
    && postgresqlArticleCount === 0
    && qdrantPointCount === 0
    && neo4jArticleCount === 0;
  if (!actualThreeLaw && !synthetic && !unknown) {
    throw new ContractError("localUatMetadata: incoherent Evidence profile observation");
  }
  return {
    mode: exact("mode", "local_uat"),
    assurance_ceiling: exact("assurance_ceiling", "diagnostic"),
    text_only: exact("text_only", true),
    auto_completion_enabled: exact("auto_completion_enabled", false),
    claude_mode: exact("claude_mode", "actual"),
    evidence_profile: evidenceProfile,
    evidence_scope_label: evidenceScopeLabel,
    evidence_dataset: {
      data_source: dataSource as LocalUatMetadata["evidence_dataset"]["data_source"],
      expected_production_law_count: expectedLawCount,
      observed_law_count: observedLawCount,
      observed_article_count: observedArticleCount,
      store_counts: {
        postgresql_article_count: postgresqlArticleCount,
        qdrant_point_count: qdrantPointCount,
        neo4j_article_count: neo4jArticleCount,
      },
      rag_quality_evaluated: false,
    },
    supported_review_as_of: decodeExactIsoDate(
      raw.supported_review_as_of,
      "localUatMetadata.supported_review_as_of",
    ),
    planner_mode: oneOf("planner_mode", ["shadow", "diagnostic_active"] as const),
    production_release: exact("production_release", false),
  };
}

const MODEL_EXECUTION_REASON_CODES = [
  "no_model_calls",
  "provider_not_anthropic",
  "model_id_incomplete_or_mixed",
  "non_text_model_call",
  "non_positive_input_tokens",
  "non_positive_output_tokens",
  "prompt_hash_incomplete",
  "schema_hash_incomplete",
  "runtime_identity_mismatch",
] as const;

export function decodeModelExecutionSummary(
  value: unknown,
  context = "modelExecutionSummary",
): ModelExecutionSummary {
  const raw = object(value, context);
  const expectedKeys = [
    "audit_complete",
    "call_count",
    "input_tokens_total",
    "model_id",
    "output_tokens_total",
    "prompt_hashes_complete",
    "provider",
    "runtime_identity_match",
    "schema_hashes_complete",
    "text_only",
    "unmet_reason_codes",
  ].sort().join(",");
  if (Object.keys(raw).sort().join(",") !== expectedKeys) {
    throw new ContractError(`${context}: exact safe model execution fields required`);
  }
  if (raw.provider !== null && raw.provider !== "anthropic") {
    throw new ContractError(`${context}.provider: anthropic or null expected`);
  }
  if (raw.model_id !== null) boundedString(raw.model_id, `${context}.model_id`, 128);
  for (const key of ["text_only", "prompt_hashes_complete", "schema_hashes_complete", "runtime_identity_match", "audit_complete"] as const) {
    if (typeof raw[key] !== "boolean") throw new ContractError(`${context}.${key}: boolean expected`);
  }
  const callCount = nonNegativeInteger(raw.call_count, `${context}.call_count`);
  const inputTokens = nonNegativeInteger(raw.input_tokens_total, `${context}.input_tokens_total`);
  const outputTokens = nonNegativeInteger(raw.output_tokens_total, `${context}.output_tokens_total`);
  if (callCount > 1_000 || inputTokens > 1_000_000_000_000 || outputTokens > 1_000_000_000_000) {
    throw new ContractError(`${context}: numeric bound exceeded`);
  }
  const reasons = boundedArray(raw.unmet_reason_codes, `${context}.unmet_reason_codes`, 9).map((item, index) => {
    const decoded = string(item, `${context}.unmet_reason_codes[${index}]`);
    if (!(MODEL_EXECUTION_REASON_CODES as readonly string[]).includes(decoded)) {
      throw new ContractError(`${context}.unmet_reason_codes[${index}]: unsupported reason`);
    }
    return decoded as ModelExecutionSummary["unmet_reason_codes"][number];
  });
  const expectedReasons: ModelExecutionSummary["unmet_reason_codes"] = callCount === 0
    ? ["no_model_calls"]
    : [
        ...(raw.provider === "anthropic" ? [] : ["provider_not_anthropic" as const]),
        ...(raw.model_id === null ? ["model_id_incomplete_or_mixed" as const] : []),
        ...(raw.text_only === true ? [] : ["non_text_model_call" as const]),
        ...(inputTokens > 0 ? [] : ["non_positive_input_tokens" as const]),
        ...(outputTokens > 0 ? [] : ["non_positive_output_tokens" as const]),
        ...(raw.prompt_hashes_complete === true ? [] : ["prompt_hash_incomplete" as const]),
        ...(raw.schema_hashes_complete === true ? [] : ["schema_hash_incomplete" as const]),
        ...(raw.runtime_identity_match === true ? [] : ["runtime_identity_mismatch" as const]),
      ];
  if (callCount === 0 && (
    raw.provider !== null
    || raw.model_id !== null
    || raw.text_only !== false
    || inputTokens !== 0
    || outputTokens !== 0
    || raw.prompt_hashes_complete !== false
    || raw.schema_hashes_complete !== false
    || raw.runtime_identity_match !== false
  )) throw new ContractError(`${context}: empty summary cannot advertise observed calls`);
  if (
    reasons.join(",") !== expectedReasons.join(",")
    || raw.audit_complete !== (expectedReasons.length === 0)
  ) throw new ContractError(`${context}: derived audit state mismatch`);
  return {
    provider: raw.provider,
    model_id: raw.model_id as string | null,
    text_only: raw.text_only as boolean,
    call_count: callCount,
    input_tokens_total: inputTokens,
    output_tokens_total: outputTokens,
    prompt_hashes_complete: raw.prompt_hashes_complete as boolean,
    schema_hashes_complete: raw.schema_hashes_complete as boolean,
    runtime_identity_match: raw.runtime_identity_match as boolean,
    audit_complete: raw.audit_complete as boolean,
    unmet_reason_codes: reasons,
  };
}

export function decodeAuthConfig(value: unknown): AuthConfig {
  const raw = object(value, "authConfig");
  string(raw.audience, "authConfig.audience");
  string(raw.client_id, "authConfig.client_id");
  const endpoints: URL[] = [];
  for (const key of ["issuer", "authorization_endpoint", "token_endpoint"]) {
    const parsed = new URL(string(raw[key], `authConfig.${key}`));
    if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
      throw new ContractError(`authConfig.${key}: HTTPS required`);
    }
    endpoints.push(parsed);
  }
  if (raw.end_session_endpoint !== undefined && raw.end_session_endpoint !== null) {
    const endSession = new URL(string(raw.end_session_endpoint, "authConfig.end_session_endpoint"));
    if (endSession.protocol !== "https:" && endSession.hostname !== "127.0.0.1" && endSession.hostname !== "localhost") {
      throw new ContractError("authConfig.end_session_endpoint: HTTPS required");
    }
    endpoints.push(endSession);
  }
  if (new Set(endpoints.map((endpoint) => endpoint.origin)).size !== 1) {
    throw new ContractError("authConfig: every OIDC endpoint must use the issuer origin");
  }
  if (endpoints.some((endpoint) => endpoint.origin !== window.location.origin)) {
    throw new ContractError("authConfig: OIDC endpoints must use the Workbench origin");
  }
  if (endpoints.some((endpoint) => !endpoint.pathname.startsWith("/oidc/"))) {
    throw new ContractError("authConfig: OIDC endpoints must stay under the /oidc/ proxy");
  }
  if (raw.flow !== "authorization_code_pkce_s256") throw new ContractError("authConfig.flow: PKCE S256 required");
  if (raw.token_storage !== "memory_only") throw new ContractError("authConfig.token_storage: memory-only required");
  if (raw.scopes !== undefined) {
    const scopes = array(raw.scopes, "authConfig.scopes").map((scope, index) => string(scope, `authConfig.scopes[${index}]`));
    if (!scopes.includes("openid")) throw new ContractError("authConfig.scopes: openid required");
  }
  return raw as unknown as AuthConfig;
}

export function decodeCaseSummary(value: unknown): CaseSummary {
  const raw = object(value, "case");
  string(raw.case_id, "case.case_id");
  string(raw.org_id, "case.org_id");
  string(raw.title, "case.title");
  const status = string(raw.status, "case.status");
  if (status !== "open" && status !== "in_review" && status !== "closed") {
    throw new ContractError("case.status: unsupported status");
  }
  if (!Number.isInteger(raw.revision) || Number(raw.revision) < 0) {
    throw new ContractError("case.revision: non-negative integer expected");
  }
  string(raw.updated_at, "case.updated_at");
  return raw as unknown as CaseSummary;
}

export function decodeCaseDetail(value: unknown): CaseDetail {
  const raw = object(value, "caseDetail");
  const summary = decodeCaseSummary(raw);
  string(raw.created_at, "caseDetail.created_at");
  const documents = Array.isArray(raw.documents)
    ? raw.documents.map((item, index) => decodePublicDocument(item, `caseDetail.documents[${index}]`))
    : [];
  const runs = Array.isArray(raw.runs) ? raw.runs.map(decodeRunSummary) : [];
  if (documents.some((item) => item.case_id !== summary.case_id)) {
    throw new ContractError("caseDetail.documents: mixed Case lineage");
  }
  if (runs.some((item) => item.case_id !== summary.case_id || item.org_id !== summary.org_id)) {
    throw new ContractError("caseDetail.runs: mixed aggregate lineage");
  }
  return {
    ...(raw as unknown as CaseDetail),
    documents,
    runs,
  };
}

export function decodeReviewRun(value: unknown): ReviewRun {
  const raw = object(value, "reviewRun");
  for (const key of [
    "review_run_id",
    "case_id",
    "org_id",
    "created_by",
    "created_at",
    "execution_status",
    "assessment",
    "review_disposition",
    "assurance_level",
    "input_manifest_digest",
    "agent_input_manifest_sha256",
    "provider_result_sha256",
    "result_digest",
  ]) string(raw[key], `reviewRun.${key}`);
  if (raw.execution_status !== "succeeded" && raw.execution_status !== "partial" && raw.execution_status !== "failed") {
    throw new ContractError("reviewRun.execution_status: unsupported status");
  }
  if (raw.assessment !== "no_issue_detected" && raw.assessment !== "issues_detected" && raw.assessment !== "indeterminate") {
    throw new ContractError("reviewRun.assessment: unsupported assessment");
  }
  if (raw.review_disposition !== "auto_review_complete" && raw.review_disposition !== "human_review_required" && raw.review_disposition !== "blocked") {
    throw new ContractError("reviewRun.review_disposition: unsupported disposition");
  }
  if (raw.assurance_level !== "diagnostic" && raw.assurance_level !== "production_candidate" && raw.assurance_level !== "production") {
    throw new ContractError("reviewRun.assurance_level: unsupported level");
  }
  if (typeof raw.case_revision !== "number") throw new ContractError("reviewRun.case_revision: number expected");
  object(raw.result_detail, "reviewRun.result_detail");
  const resultValue = raw.result_detail ?? raw.result;
  const result = typeof resultValue === "object" && resultValue !== null ? (resultValue as JsonObject) : {};
  if ("report" in result) {
    throw new ContractError("reviewRun.result_detail.report: legacy V2 report is not part of the public Backend contract");
  }
  const modelExecutionSummary = result.model_execution_summary === undefined
    ? undefined
    : decodeModelExecutionSummary(
        result.model_execution_summary,
        "reviewRun.result_detail.model_execution_summary",
      );
  const narrativeExecutionSummary = result.narrative_execution_summary === undefined
    ? undefined
    : decodeModelExecutionSummary(
        result.narrative_execution_summary,
        "reviewRun.result_detail.narrative_execution_summary",
      );
  if (!validateBackendEffectiveResultDigest(raw, modelExecutionSummary, narrativeExecutionSummary)) {
    throw new ContractError("reviewRun.result_digest: Backend effective result digest mismatch");
  }
  const pickArray = (top: string, ...nested: string[]): unknown[] => {
    if (Array.isArray(raw[top])) return raw[top] as unknown[];
    for (const key of nested) if (Array.isArray(result[key])) return result[key] as unknown[];
    return [];
  };
  const completionRaw = raw.completion_eligibility === undefined
    ? undefined
    : object(raw.completion_eligibility, "reviewRun.completion_eligibility");
  const completionProfile = completionRaw?.profile_id === null
    ? null
    : typeof completionRaw?.profile_id === "string"
      ? completionRaw.profile_id
      : undefined;
  const completion = completionRaw === undefined
    ? undefined
    : {
        eligible: completionRaw.eligible === true,
        ...(completionProfile === undefined ? {} : { profile_id: completionProfile }),
        scope: stringItems(completionRaw.scope, "reviewRun.completion_eligibility.scope"),
        unmet_reason_codes: stringItems(
          completionRaw.unmet_reason_codes,
          "reviewRun.completion_eligibility.unmet_reason_codes",
        ),
      };
  const ledger = asObject(result.fact_ledger);
  const ledgerEntries = Array.isArray(ledger.entries) ? ledger.entries : [];
  const directFields = pickArray("fields", "fields", "extracted_fields").length > 0
    ? pickArray("fields", "fields", "extracted_fields")
    : pickArray("facts", "facts");
  const fields = (directFields.length > 0
    ? directFields
    : documentResultFields(result.document_results, ledgerEntries)).map(normalizeField);
  const rawIssues = pickArray("issues", "issues", "validation_issues");
  const issues = rawIssues.map((value) => normalizeIssue(value, ledgerEntries));
  const rawEvidence = pickArray("evidence", "evidence", "evidence_items", "rag_evidence");
  const evidence = rawEvidence.map(normalizeEvidence);
  const retrievalStatus = result.retrieval_status;
  const retrievalCoverage = result.retrieval_coverage;
  const rawRetrievalResults = result.retrieval_results;
  const hasRetrievalAttestation = retrievalStatus !== undefined
    || retrievalCoverage !== undefined
    || rawRetrievalResults !== undefined;
  let evidenceRetrieval: ReviewRun["evidence_retrieval"];
  if (hasRetrievalAttestation) {
    if (retrievalStatus !== "ok" && retrievalStatus !== "partial" && retrievalStatus !== "failed") {
      throw new ContractError("reviewRun.result_detail.retrieval_status: unsupported status");
    }
    if (retrievalCoverage !== "complete" && retrievalCoverage !== "partial" && retrievalCoverage !== "unknown") {
      throw new ContractError("reviewRun.result_detail.retrieval_coverage: unsupported coverage");
    }
    if (!Array.isArray(rawRetrievalResults)) {
      throw new ContractError("reviewRun.result_detail.retrieval_results: array expected");
    }
    const requirements = rawRetrievalResults.map((value, index) => {
      const item = object(value, `reviewRun.result_detail.retrieval_results[${index}]`);
      if (typeof item.requirements_found !== "boolean") {
        throw new ContractError(`reviewRun.result_detail.retrieval_results[${index}].requirements_found: boolean expected`);
      }
      return item.requirements_found;
    });
    evidenceRetrieval = {
      status: retrievalStatus,
      coverage: retrievalCoverage,
      requirements_found: requirements.length === 0 ? null : requirements.some(Boolean),
      result_count: requirements.length,
    };
  }
  const evidenceProvenance = result.evidence_provenance === undefined
    ? undefined
    : decodeEvidenceProvenance(
        result.evidence_provenance,
        new Set(evidence.map((item) => item.evidence_id)),
      );
  const rawFindings = pickArray("findings", "findings", "compliance_findings", "regulatory_findings");
  const findings = rawFindings.map((value) => normalizeFinding(value, ledgerEntries));
  const sources = deduplicateSources([
    ...pickArray("sources", "sources", "source_references").map(normalizeSource),
    ...documentResultSources(result.document_results, ledgerEntries).map(normalizeSource),
    ...findingDetailSources(rawFindings, ledgerEntries).map(normalizeSource),
    ...ledgerEntries.map(normalizeSource),
  ]);
  const knownCitationIds = new Set([
    ...fields.map((item) => item.field_id),
    ...issues.map((item) => item.issue_id),
    ...evidence.map((item) => item.evidence_id),
    ...findings.map((item) => item.finding_id),
    ...sources.map((item) => item.source_id),
  ]);
  const narrative = normalizeNarrative(raw.narrative_report, knownCitationIds);
  const releaseIdentity = raw.release_identity === undefined
    ? undefined
    : normalizeReleaseIdentity(raw.release_identity);
  const requiredActions = pickArray("required_actions", "required_actions").map(normalizeRequiredAction);
  const rawActionTrace = pickArray("action_trace", "action_trace");
  const actionTrace = rawActionTrace.map(normalizeAction);
  for (const action of requiredActions) {
    for (const sourceId of action.source_ids) {
      if (!knownCitationIds.has(sourceId)) throw new ContractError(`requiredAction.${action.action_id}: unknown citation ${sourceId}`);
    }
  }
  if (raw.review_disposition === "auto_review_complete") {
    const hasExplicitEmptyRequiredActions = Array.isArray(raw.required_actions) && raw.required_actions.length === 0;
    const rawReviewGaps: unknown[] | undefined = Array.isArray(result.review_gaps) ? result.review_gaps : undefined;
    const hasExplicitReviewGaps = rawReviewGaps !== undefined;
    const reviewGaps: JsonObject[] = rawReviewGaps?.map((item) => asObject(item)) ?? [];
    const release = releaseIdentity as JsonObject | undefined;
    const hasReleaseHash = (key: string): boolean => typeof release?.[key] === "string" && /^[a-f0-9]{64}$/.test(String(release[key]));
    const completionProfileMatches = typeof completion?.profile_id === "string"
      && completion.profile_id.length > 0
      && release?.release_profile_id === completion.profile_id;
    const snapshotMatches = typeof result.knowledge_snapshot_id === "string"
      && result.knowledge_snapshot_id.length > 0
      && release?.evidence_snapshot_id === result.knowledge_snapshot_id;
    const productionEnvelopeIsValid = validateProductionCompletionEnvelope({
      raw,
      result,
      rawEvidence,
      evidence,
      fields,
      sources,
      narrative,
      releaseIdentity,
      actionTrace,
      rawActionTrace,
      knownCitationIds,
      ledgerEntries,
      reviewGaps,
    });
    if (
      raw.execution_status !== "succeeded"
      || raw.assessment !== "no_issue_detected"
      || raw.assurance_level !== "production"
      || completion?.eligible !== true
      || completion.scope.length === 0
      || completion.unmet_reason_codes.length > 0
      || !completionProfileMatches
      || issues.length > 0
      || findings.length > 0
      || evidence.length === 0
      || !hasExplicitEmptyRequiredActions
      || !hasExplicitReviewGaps
      || requiredActions.length > 0
      || reviewGaps.length > 0
      || reviewGaps.some((gap) => gap.status === "open")
      || actionTrace.some((action) => action.status !== "succeeded")
      || actionTrace.length === 0
      || modelExecutionSummary?.audit_complete !== true
      || narrativeExecutionSummary?.audit_complete !== true
      || narrative === undefined
      || narrative.summary.length === 0
      || result.retrieval_status !== "ok"
      || result.retrieval_coverage !== "complete"
      || !snapshotMatches
      || release?.kill_switch_active !== false
      || release?.backend_auto_completion_enabled !== true
      || release?.assertion_trust_store_state !== "active"
      || release?.release_profile_state !== "approved"
      || !hasReleaseHash("assertion_trust_store_sha256")
      || !hasReleaseHash("evidence_runtime_v3_sha256")
      || !hasReleaseHash("release_profile_sha256")
      || !hasReleaseHash("release_profile_subject_sha256")
      || !hasReleaseHash("release_profile_evaluation_report_sha256")
      || !hasReleaseHash("backend_auto_completion_approval_digest")
      || !productionEnvelopeIsValid
    ) {
      throw new ContractError("reviewRun: incoherent automatic completion state");
    }
  }
  const safeRaw = { ...raw };
  // A top-level alias is not part of the Backend contract and must never
  // override the validated public Agent result_detail attestation.
  delete safeRaw.evidence_retrieval;
  delete safeRaw.evidence_provenance;
  delete safeRaw.model_execution_summary;
  delete safeRaw.narrative_execution_summary;
  return {
    ...(safeRaw as unknown as ReviewRun),
    stages: pickArray("stages", "stages") as ReviewRun["stages"],
    fields,
    issues,
    evidence,
    ...(evidenceRetrieval === undefined ? {} : { evidence_retrieval: evidenceRetrieval }),
    ...(evidenceProvenance === undefined ? {} : { evidence_provenance: evidenceProvenance }),
    ...(modelExecutionSummary === undefined ? {} : { model_execution_summary: modelExecutionSummary }),
    ...(narrativeExecutionSummary === undefined
      ? {}
      : { narrative_execution_summary: narrativeExecutionSummary }),
    findings,
    sources,
    action_trace: actionTrace,
    corrections: pickArray("corrections", "corrections") as ReviewRun["corrections"],
    required_actions: requiredActions,
    ...(completion === undefined ? {} : { completion_eligibility: completion }),
    ...(narrative === undefined ? {} : { narrative_report: narrative }),
    ...(releaseIdentity === undefined ? {} : { release_identity: releaseIdentity }),
  };
}

export function decodeRunSummary(value: unknown): RunSummary {
  return decodeReviewRun(value);
}

export function decodeStageEvent(value: unknown): ReviewStageEvent {
  const raw = object(value, "stageEvent");
  const providerState = raw.status ?? raw.state;
  const rawStatus = string(providerState, "stageEvent.status");
  const status = rawStatus === "started" || rawStatus === "progress"
    ? "running"
    : rawStatus === "completed"
      ? "succeeded"
      : rawStatus;
  if (!(["pending", "running", "succeeded", "failed"] as const).includes(status as never)) {
    throw new ContractError("stageEvent.status: unsupported status");
  }
  return {
    event_id: string(raw.event_id, "stageEvent.event_id"),
    job_id: string(raw.job_id, "stageEvent.job_id"),
    sequence: nonNegativeInteger(raw.sequence, "stageEvent.sequence"),
    stage: string(raw.stage, "stageEvent.stage"),
    status: status as ReviewStageEvent["status"],
    message: string(raw.message_code ?? raw.message, "stageEvent.message"),
    occurred_at: string(raw.created_at ?? raw.occurred_at, "stageEvent.occurred_at"),
  };
}

export function decodePublicDocument(value: unknown, context = "document"): CaseDetail["documents"][number] {
  const raw = object(value, context);
  boundedString(raw.document_id, `${context}.document_id`, 160);
  boundedString(raw.case_id, `${context}.case_id`, 160);
  boundedString(raw.document_type, `${context}.document_type`, 32);
  boundedString(raw.filename, `${context}.filename`, 255);
  boundedString(raw.media_type, `${context}.media_type`, 128);
  boundedString(raw.content_sha256, `${context}.content_sha256`, 64);
  boundedString(raw.created_by, `${context}.created_by`, 256);
  boundedString(raw.created_at, `${context}.created_at`, 64);
  if (!["CI", "PL", "BL", "CO", "SUPPORTING", "UNKNOWN"].includes(String(raw.document_type))) {
    throw new ContractError(`${context}.document_type: unsupported type`);
  }
  if (raw.media_type !== "text/plain") throw new ContractError(`${context}.media_type: text-only release required`);
  if (!SHA256.test(String(raw.content_sha256))) throw new ContractError(`${context}.content_sha256: SHA-256 expected`);
  if (!Number.isInteger(raw.character_count) || Number(raw.character_count) < 1 || Number(raw.character_count) > MAX_DOCUMENT_TEXT_CHARACTERS) {
    throw new ContractError(`${context}.character_count: 1..${MAX_DOCUMENT_TEXT_CHARACTERS} expected`);
  }
  if (!Number.isInteger(raw.byte_size) || Number(raw.byte_size) < 1 || Number(raw.byte_size) > MAX_DOCUMENT_TEXT_CHARACTERS * 4) {
    throw new ContractError(`${context}.byte_size: bounded UTF-8 byte count expected`);
  }
  if (raw.content_text !== undefined) {
    const content = string(raw.content_text, `${context}.content_text`);
    if (content.length === 0 || content.length > MAX_DOCUMENT_TEXT_CHARACTERS) {
      throw new ContractError(`${context}.content_text: 1..${MAX_DOCUMENT_TEXT_CHARACTERS} characters expected`);
    }
    const bytes = new TextEncoder().encode(content);
    if (
      [...content].length !== raw.character_count
      || bytes.length !== raw.byte_size
      || hexSha256(bytes) !== raw.content_sha256
    ) {
      throw new ContractError(`${context}.content_text: content/hash/size metadata mismatch`);
    }
  }
  return raw as unknown as CaseDetail["documents"][number];
}

export function decodeSupportingDocument(value: unknown): SupportingDocumentRecord {
  const raw = object(value, "supportingDocument");
  boundedString(raw.document_id, "supportingDocument.document_id", 128);
  boundedString(raw.document_code, "supportingDocument.document_code", 128);
  boundedString(raw.issuer, "supportingDocument.issuer", 512);
  boundedString(raw.document_number, "supportingDocument.document_number", 256);
  boundedString(raw.issued_on, "supportingDocument.issued_on", 32);
  boundedString(raw.source_sha256, "supportingDocument.source_sha256", 64);
  boundedString(raw.case_id, "supportingDocument.case_id", 160);
  boundedString(raw.org_id, "supportingDocument.org_id", 256);
  boundedString(raw.created_by, "supportingDocument.created_by", 256);
  boundedString(raw.created_at, "supportingDocument.created_at", 64);
  if (!SHA256.test(String(raw.source_sha256))) throw new ContractError("supportingDocument.source_sha256: SHA-256 expected");
  const subjectItemIds = boundedArray(raw.subject_item_ids, "supportingDocument.subject_item_ids", MAX_SUPPORTING_REFERENCES)
    .map((item, index) => boundedString(item, `supportingDocument.subject_item_ids[${index}]`, 128));
  if (subjectItemIds.length === 0 || new Set(subjectItemIds).size !== subjectItemIds.length) {
    throw new ContractError("supportingDocument.subject_item_ids: non-empty unique references required");
  }
  const hsCodes = raw.hs_codes === undefined
    ? []
    : boundedArray(raw.hs_codes, "supportingDocument.hs_codes", MAX_SUPPORTING_REFERENCES)
      .map((item, index) => boundedString(item, `supportingDocument.hs_codes[${index}]`, 10));
  if (new Set(hsCodes).size !== hsCodes.length || hsCodes.some((code) => !/^\d{10}$/.test(code))) {
    throw new ContractError("supportingDocument.hs_codes: unique HSK10 values required");
  }
  const verificationAssertions = (raw.verification_assertions === undefined
    ? []
    : boundedArray(raw.verification_assertions, "supportingDocument.verification_assertions", MAX_SUPPORTING_ASSERTIONS))
    .map(decodeVerificationAssertion);
  const assertionIds = verificationAssertions.map((item) => item.assertion_id);
  if (new Set(assertionIds).size !== assertionIds.length) {
    throw new ContractError("supportingDocument.verification_assertions: duplicate assertion ID");
  }
  for (const [index, assertion] of verificationAssertions.entries()) {
    if (assertion.subject_document_id !== raw.document_id) {
      throw new ContractError(`supportingDocument.verification_assertions[${index}]: document lineage mismatch`);
    }
    if (assertion.decision_record && assertion.decision_record.case_id !== raw.case_id) {
      throw new ContractError(`supportingDocument.verification_assertions[${index}]: decision Case mismatch`);
    }
    if (assertion.receipt && assertion.receipt.case_id !== raw.case_id) {
      throw new ContractError(`supportingDocument.verification_assertions[${index}]: receipt Case mismatch`);
    }
  }
  if (raw.valid_until !== undefined && raw.valid_until !== null) boundedString(raw.valid_until, "supportingDocument.valid_until", 32);
  return {
    ...(raw as unknown as SupportingDocumentRecord),
    subject_item_ids: subjectItemIds,
    hs_codes: hsCodes,
    verification_assertions: verificationAssertions,
  };
}

function decodeVerificationAssertion(value: unknown, index: number): SupportingDocumentRecord["verification_assertions"][number] {
  const raw = object(value, `verificationAssertion[${index}]`);
  for (const key of [
    "assertion_id",
    "method",
    "subject_document_id",
    "asserted_by",
    "asserted_at",
    "authority_id",
    "authority_release",
    "source_reference_sha256",
  ]) {
    boundedString(raw[key], `verificationAssertion[${index}].${key}`, key.includes("sha256") ? 64 : 256);
  }
  if (!SHA256.test(String(raw.source_reference_sha256))) {
    throw new ContractError(`verificationAssertion[${index}].source_reference_sha256: SHA-256 expected`);
  }
  if (raw.method !== "trusted_connector" && raw.method !== "human_approver" && raw.method !== "test_issuer") {
    throw new ContractError(`verificationAssertion[${index}].method: unsupported method`);
  }
  if (raw.decision_record !== undefined && raw.decision_record !== null) {
    const decision = object(raw.decision_record, `verificationAssertion[${index}].decision_record`);
    for (const key of [
      "actor_id",
      "actor_role",
      "case_id",
      "decided_at",
      "decision",
      "document_id",
      "policy_release",
      "policy_source_sha256",
      "schema_version",
      "source_sha256",
      "supporting_document_claims_sha256",
    ]) boundedString(decision[key], `verificationAssertion[${index}].decision_record.${key}`, key.includes("sha256") ? 64 : 256);
    for (const key of ["policy_source_sha256", "source_sha256", "supporting_document_claims_sha256"]) {
      if (!SHA256.test(String(decision[key]))) throw new ContractError(`verificationAssertion[${index}].decision_record.${key}: SHA-256 expected`);
    }
    if (
      decision.actor_role !== "approver"
      || decision.decision !== "verify_supporting_document"
      || decision.schema_version !== "backend-supporting-document-human-decision/v1"
      || decision.document_id !== raw.subject_document_id
      || decision.source_sha256 !== raw.source_reference_sha256
    ) {
      throw new ContractError(`verificationAssertion[${index}].decision_record: binding mismatch`);
    }
  }
  if (raw.receipt !== undefined && raw.receipt !== null) {
    const receipt = object(raw.receipt, `verificationAssertion[${index}].receipt`);
    for (const key of [
      "authority_id",
      "authority_release",
      "case_id",
      "expires_at",
      "key_id",
      "method",
      "policy_release",
      "policy_source_sha256",
      "signature_base64url",
      "signed_at",
      "supporting_document_claims_sha256",
      "trust_domain",
    ]) boundedString(receipt[key], `verificationAssertion[${index}].receipt.${key}`, key.includes("sha256") ? 64 : 256);
    if (
      receipt.trust_domain !== "customs-ai-agent/supporting-document-verification/v1"
      || receipt.method !== raw.method
      || receipt.authority_id !== raw.authority_id
      || receipt.authority_release !== raw.authority_release
      || !/^[A-Za-z0-9_-]{86}$/.test(String(receipt.signature_base64url))
    ) {
      throw new ContractError(`verificationAssertion[${index}].receipt: binding mismatch`);
    }
    if (raw.method === "human_approver" && (raw.decision_record === undefined || raw.decision_record === null || typeof receipt.decision_record_sha256 !== "string")) {
      throw new ContractError(`verificationAssertion[${index}].receipt: human decision lineage required`);
    }
  }
  return raw as unknown as SupportingDocumentRecord["verification_assertions"][number];
}

export function decodeCorrectionProposal(value: unknown): CorrectionProposal {
  const raw = object(value, "correctionProposal");
  for (const key of ["proposal_id", "org_id", "case_id", "review_run_id", "parent_result_digest", "parent_input_manifest_sha256", "created_by", "created_at", "status"]) {
    string(raw[key], `correctionProposal.${key}`);
  }
  if (raw.status !== "pending" && raw.status !== "approved" && raw.status !== "rejected") {
    throw new ContractError("correctionProposal.status: unsupported status");
  }
  for (const key of ["parent_result_digest", "parent_input_manifest_sha256"]) {
    if (!SHA256.test(String(raw[key]))) throw new ContractError(`correctionProposal.${key}: SHA-256 expected`);
  }
  if (!/^idem_[a-f0-9]{64}$/.test(String(raw.idempotency_key ?? ""))) {
    throw new ContractError("correctionProposal.idempotency_key: scoped idempotency identity expected");
  }
  if (!SHA256.test(String(raw.idempotency_request_digest ?? ""))) {
    throw new ContractError("correctionProposal.idempotency_request_digest: SHA-256 expected");
  }
  const corrections = raw.corrections === undefined ? [] : array(raw.corrections, "correctionProposal.corrections");
  const actions = raw.actions === undefined ? [] : array(raw.actions, "correctionProposal.actions");
  if ((corrections.length === 0) === (actions.length === 0)) {
    throw new ContractError("correctionProposal: exactly one proposal payload required");
  }
  corrections.forEach((value, index) => {
    const correction = object(value, `correctionProposal.corrections[${index}]`);
    for (const key of ["document_id", "field_path", "reason"]) string(correction[key], `correctionProposal.corrections[${index}].${key}`);
    if (typeof correction.confidence !== "number") throw new ContractError(`correctionProposal.corrections[${index}].confidence: number expected`);
  });
  actions.forEach((value, index) => {
    const action = object(value, `correctionProposal.actions[${index}]`);
    const decision = string(action.decision, `correctionProposal.actions[${index}].decision`);
    string(action.reason, `correctionProposal.actions[${index}].reason`);
    if (!["confirm_field", "correct_field", "add_supporting_document", "approve_review", "reject_review"].includes(decision)) {
      throw new ContractError(`correctionProposal.actions[${index}].decision: unsupported decision`);
    }
    const hasConfirmedReference = typeof action.confirmed_reference_id === "string";
    const hasCorrection = typeof action.correction === "object" && action.correction !== null;
    const hasSupportingDocument = typeof action.supporting_document_id === "string";
    if (
      (decision === "confirm_field") !== hasConfirmedReference
      || (decision === "correct_field") !== hasCorrection
      || (decision === "add_supporting_document") !== hasSupportingDocument
    ) {
      throw new ContractError(`correctionProposal.actions[${index}]: payload does not match decision`);
    }
    if (hasCorrection) {
      const correction = object(action.correction, `correctionProposal.actions[${index}].correction`);
      for (const key of ["document_id", "field_path", "reason"]) {
        string(correction[key], `correctionProposal.actions[${index}].correction.${key}`);
      }
      if (typeof correction.confidence !== "number") {
        throw new ContractError(`correctionProposal.actions[${index}].correction.confidence: number expected`);
      }
    }
  });
  if (actions.filter((value) => {
    const decision = object(value, "correctionProposal.action").decision;
    return decision === "approve_review" || decision === "reject_review";
  }).length > 1) {
    throw new ContractError("correctionProposal.actions: at most one terminal decision allowed");
  }
  if (!Number.isInteger(raw.case_revision) || Number(raw.case_revision) < 0) throw new ContractError("correctionProposal.case_revision: non-negative integer expected");
  if (raw.child_job_id !== undefined && raw.child_job_id !== null) string(raw.child_job_id, "correctionProposal.child_job_id");
  if (raw.status === "pending" && raw.child_job_id !== undefined && raw.child_job_id !== null) {
    throw new ContractError("correctionProposal: pending proposal cannot have a child Job");
  }
  return { ...(raw as unknown as CorrectionProposal), corrections: corrections as CorrectionProposal["corrections"], actions: actions as CorrectionProposal["actions"] };
}

export function decodeHumanDecision(value: unknown): HumanDecisionRecord {
  const raw = object(value, "humanDecision");
  for (const key of ["decision_id", "org_id", "case_id", "review_run_id", "decision", "reason", "decided_by", "created_at"]) {
    string(raw[key], `humanDecision.${key}`);
  }
  if (raw.decision !== "approve" && raw.decision !== "reject") throw new ContractError("humanDecision.decision: unsupported decision");
  const hasIdempotencyKey = raw.idempotency_key !== undefined && raw.idempotency_key !== null;
  const hasIdempotencyDigest = raw.idempotency_request_digest !== undefined && raw.idempotency_request_digest !== null;
  if (hasIdempotencyKey !== hasIdempotencyDigest) throw new ContractError("humanDecision: incomplete idempotency identity");
  if (hasIdempotencyKey && !/^idem_[a-f0-9]{64}$/.test(String(raw.idempotency_key))) {
    throw new ContractError("humanDecision.idempotency_key: scoped idempotency identity expected");
  }
  if (hasIdempotencyDigest && !SHA256.test(String(raw.idempotency_request_digest))) {
    throw new ContractError("humanDecision.idempotency_request_digest: SHA-256 expected");
  }
  return raw as unknown as HumanDecisionRecord;
}

export function decodeChatRecord(value: unknown): ChatRecord | GroundedAnswer {
  const raw = object(value, "chatRecord");
  if (typeof raw.answer_id === "string") return decodeGroundedAnswer(raw);
  for (const key of ["message_id", "review_run_id", "case_id", "org_id", "question", "answer", "answer_status", "bound_result_digest", "created_by", "created_at"]) {
    string(raw[key], `chatRecord.${key}`);
  }
  if (!/^idem_[a-f0-9]{64}$/.test(String(raw.idempotency_key ?? ""))) {
    throw new ContractError("chatRecord.idempotency_key: scoped idempotency identity expected");
  }
  if (!SHA256.test(String(raw.idempotency_request_digest ?? ""))) {
    throw new ContractError("chatRecord.idempotency_request_digest: SHA-256 expected");
  }
  if (!SHA256.test(String(raw.bound_result_digest))) {
    throw new ContractError("chatRecord.bound_result_digest: SHA-256 expected");
  }
  if (raw.answer_status !== "answered" && raw.answer_status !== "insufficient_evidence" && raw.answer_status !== "out_of_scope") {
    throw new ContractError("chatRecord.answer_status: unsupported status");
  }
  if (raw.generation_mode !== "claude" && raw.generation_mode !== "deterministic_fallback") {
    throw new ContractError("chatRecord.generation_mode: unsupported mode");
  }
  const modelExecutionSummary = decodeModelExecutionSummary(
    raw.model_execution_summary,
    "chatRecord.model_execution_summary",
  );
  if (modelExecutionSummary.call_count !== (raw.generation_mode === "claude" ? 1 : 0)) {
    throw new ContractError("chatRecord: generation mode/model execution mismatch");
  }
  const citations = array(raw.citations, "chatRecord.citations").map((value, index) => {
    const citation = object(value, `chatRecord.citations[${index}]`);
    const identifier = citation.citation_id ?? citation.evidence_id ?? citation.source_id ?? citation.reference_id;
    string(identifier, `chatRecord.citations[${index}].id`);
    return citation;
  });
  if (raw.answer_status === "answered" && citations.length === 0) {
    throw new ContractError("chatRecord: answered message requires a citation");
  }
  if (raw.answer_status !== "answered" && citations.length > 0) {
    throw new ContractError("chatRecord: non-answer status must not present material citations");
  }
  return {
    ...(raw as unknown as ChatRecord),
    generation_mode: raw.generation_mode,
    model_execution_summary: modelExecutionSummary,
    citations: citations as ChatRecord["citations"],
  };
}

export function decodeJob(value: unknown): JobRecord {
  const raw = object(value, "job");
  for (const key of ["job_id", "case_id", "created_by", "kind", "status", "agent_call_state", "review_run_id", "created_at", "updated_at"]) {
    string(raw[key], `job.${key}`);
  }
  if (raw.kind !== "review" && raw.kind !== "revision") throw new ContractError("job.kind: unsupported kind");
  if (raw.status !== "queued" && raw.status !== "running" && raw.status !== "succeeded" && raw.status !== "failed" && raw.status !== "delivery_uncertain") {
    throw new ContractError("job.status: unsupported status");
  }
  if (raw.agent_call_state !== "not_started" && raw.agent_call_state !== "started" && raw.agent_call_state !== "completed" && raw.agent_call_state !== "delivery_uncertain" && raw.agent_call_state !== "delivery_reconciled") {
    throw new ContractError("job.agent_call_state: unsupported state");
  }
  if ((raw.status === "delivery_uncertain") !== (raw.agent_call_state === "delivery_uncertain")) {
    throw new ContractError("job: delivery uncertainty state mismatch");
  }
  if (raw.status === "succeeded" && raw.agent_call_state !== "completed") {
    throw new ContractError("job: succeeded Job requires a completed Agent call");
  }
  if (raw.agent_call_state === "delivery_reconciled" && raw.status !== "failed") {
    throw new ContractError("job: reconciled delivery must be terminal failed");
  }
  if (typeof raw.attempt_count !== "number" || !Number.isInteger(raw.attempt_count) || raw.attempt_count < 0) {
    throw new ContractError("job.attempt_count: non-negative integer expected");
  }
  return raw as unknown as JobRecord;
}

export function decodeCorrectionProposalDecision(value: unknown): CorrectionProposalDecisionResponse {
  const raw = object(value, "correctionProposalDecision");
  return {
    proposal: decodeCorrectionProposal(raw.proposal),
    decision: decodeHumanDecision(raw.decision),
    ...(raw.job === undefined || raw.job === null ? {} : { job: decodeJob(raw.job) }),
  };
}

function documentResultFields(documentResults: unknown, ledgerEntries: unknown[]): unknown[] {
  if (!Array.isArray(documentResults)) return [];
  const fieldSources = ledgerEntries
    .map((entry) => asObject(entry))
    .filter((entry) => entry.kind === "field_source" && typeof entry.reference_id === "string");
  const extracted: JsonObject[] = [];
  const append = (
    fieldValue: unknown,
    documentId: string,
    fieldPath: string,
    displayName: string,
    ledgerLabel: string,
  ): void => {
    const field = asObject(fieldValue);
    const exactSource = fieldSources.find((entry) => entry.document_id === documentId && entry.label === ledgerLabel);
    const fallbackSources = fieldSources.filter((entry) =>
      entry.document_id === documentId
      && typeof entry.label === "string"
      && (entry.label === displayName || entry.label.endsWith(`.${displayName}`))
    );
    const source = exactSource ?? (fallbackSources.length === 1 ? fallbackSources[0] : undefined);
    extracted.push({
      field_id: typeof source?.reference_id === "string"
        ? source.reference_id
        : `unbound:${documentId}:${fieldPath}`,
      document_id: documentId,
      name: displayName,
      field_path: fieldPath,
      value: field.normalized_value ?? field.value ?? null,
      ...(typeof field.confidence === "number" ? { confidence: field.confidence } : {}),
      source_ids: typeof source?.reference_id === "string" ? [source.reference_id] : [],
    });
  };
  documentResults.forEach((documentValue) => {
    const document = asObject(documentValue);
    if (typeof document.document_id !== "string") return;
    const documentId = document.document_id;
    if (Array.isArray(document.fields)) {
      document.fields.forEach((fieldValue) => {
        const field = asObject(fieldValue);
        if (typeof field.name !== "string") return;
        append(
          field,
          documentId,
          `fields.${field.name}`,
          field.name,
          `${documentId}.fields.${field.name}`,
        );
      });
    }
    if (Array.isArray(document.line_items)) {
      document.line_items.forEach((itemValue, itemIndex) => {
        const item = asObject(itemValue);
        if (!Array.isArray(item.fields)) return;
        const itemId = typeof item.item_id === "string" ? item.item_id : String(itemIndex);
        item.fields.forEach((fieldValue) => {
          const field = asObject(fieldValue);
          if (typeof field.name !== "string") return;
          append(
            field,
            documentId,
            `line_items.${itemIndex}.${field.name}`,
            `${itemId}.${field.name}`,
            `${documentId}.line_items.${itemId}.${field.name}`,
          );
        });
      });
    }
  });
  return extracted;
}

function documentResultSources(documentResults: unknown, ledgerEntries: unknown[]): unknown[] {
  if (!Array.isArray(documentResults)) return [];
  const fieldEntries = ledgerEntries.map((entry) => asObject(entry)).filter((entry) => entry.kind === "field_source");
  const sources: JsonObject[] = [];
  const append = (documentId: string, label: string, displayName: string, sourceValue: unknown): void => {
    const source = asObject(sourceValue);
    const exact = fieldEntries.find((entry) => entry.document_id === documentId && entry.label === label);
    const fallback = fieldEntries.filter((entry) =>
      entry.document_id === documentId
      && typeof entry.label === "string"
      && (entry.label === displayName || entry.label.endsWith(`.${displayName}`))
    );
    const entry = exact ?? (fallback.length === 1 ? fallback[0] : undefined);
    if (!entry || typeof entry.reference_id !== "string") return;
    sources.push({
      ...entry,
      source_id: entry.reference_id,
      ...(typeof source.page === "number" ? { page: source.page } : {}),
      ...(typeof source.text_start === "number" ? { start_offset: source.text_start } : {}),
      ...(typeof source.text_end === "number" ? { end_offset: source.text_end } : {}),
    });
  };
  documentResults.forEach((documentValue) => {
    const document = asObject(documentValue);
    if (typeof document.document_id !== "string") return;
    const documentId = document.document_id;
    if (Array.isArray(document.fields)) document.fields.forEach((fieldValue) => {
      const field = asObject(fieldValue);
      if (typeof field.name !== "string") return;
      append(documentId, `${documentId}.fields.${field.name}`, field.name, field.source);
    });
    if (Array.isArray(document.line_items)) document.line_items.forEach((itemValue) => {
      const item = asObject(itemValue);
      if (!Array.isArray(item.fields)) return;
      const itemId = typeof item.item_id === "string" ? item.item_id : "unknown-item";
      item.fields.forEach((fieldValue) => {
        const field = asObject(fieldValue);
        if (typeof field.name !== "string") return;
        append(documentId, `${documentId}.line_items.${itemId}.${field.name}`, field.name, field.source);
      });
    });
  });
  return sources;
}

function findingDetailSources(findings: unknown[], ledgerEntries: unknown[]): unknown[] {
  return findings.flatMap((findingValue) => {
    const finding = asObject(findingValue);
    const entry = resolveFindingLedgerEntry(finding, ledgerEntries);
    const source = asObject(finding.source);
    if (Object.keys(source).length === 0) return [];
    return [{
      ...entry,
      source_id: entry.reference_id,
      ...(typeof source.document_id === "string" ? { document_id: source.document_id } : {}),
      ...(typeof source.page === "number" ? { page: source.page } : {}),
      ...(typeof source.text_start === "number" ? { start_offset: source.text_start } : {}),
      ...(typeof source.text_end === "number" ? { end_offset: source.text_end } : {}),
    }];
  });
}

function normalizeField(value: unknown, index: number): ReviewRun["fields"][number] {
  const raw = asObject(value);
  const name = stringValue(raw.name ?? raw.field_name ?? raw.path, stringValue(raw.fact_id, `field_${index + 1}`));
  const suppliedPath = stringValue(raw.field_path ?? raw.path, "");
  return {
    field_id: stringValue(raw.field_id ?? raw.fact_id, `field-${index + 1}`),
    document_id: stringValue(raw.document_id, "unbound-document"),
    name,
    field_path: suppliedPath.startsWith("fields.") || suppliedPath.startsWith("line_items.") ? suppliedPath : `fields.${name}`,
    value: isScalar(raw.value) ? raw.value : JSON.stringify(raw.value ?? null),
    ...(typeof raw.confidence === "number" ? { confidence: raw.confidence } : {}),
    source_ids: stringArray(raw.source_ids ?? raw.field_source_ids),
  };
}

function normalizeIssue(
  value: unknown,
  ledgerEntries: unknown[] = [],
): ReviewRun["issues"][number] {
  const raw = asObject(value);
  const ledgerEntry = resolveIssueLedgerEntry(raw, ledgerEntries);
  const ledgerReference = String(ledgerEntry.reference_id);
  const explicitSources = stringArray(raw.source_ids ?? raw.field_source_ids);
  return {
    issue_id: ledgerReference,
    code: stringValue(raw.code ?? raw.issue_code, "UNSPECIFIED_ISSUE"),
    severity: severity(raw.severity),
    message: stringValue(raw.message ?? raw.detail, "상세가 제공되지 않았습니다."),
    source_ids: explicitSources.length > 0 ? explicitSources : [ledgerReference],
  };
}

function decodeEvidenceProvenance(
  value: unknown,
  publicEvidenceIds: ReadonlySet<string>,
): NonNullable<ReviewRun["evidence_provenance"]> {
  const raw = object(value, "reviewRun.result_detail.evidence_provenance");
  if (Object.keys(raw).sort().join(",") !== ["items", "query_intent", "ranked_evidence"].join(",")) {
    throw new ContractError("evidenceProvenance: unsupported or sensitive field");
  }
  const queryIntent = raw.query_intent === null
    ? null
    : boundedString(raw.query_intent, "evidenceProvenance.query_intent", 256);
  const itemIds = new Set<string>();
  const hsCode = (candidate: unknown, context: string): string | null => {
    if (candidate === null) return null;
    const decoded = boundedString(candidate, context, 10);
    if (!/^(?:[0-9]{6}|[0-9]{10})$/.test(decoded)) {
      throw new ContractError(`${context}: HS6 or HSK10 expected`);
    }
    return decoded;
  };
  const items = array(raw.items, "evidenceProvenance.items").map((value, index) => {
    const context = `evidenceProvenance.items[${index}]`;
    const item = object(value, context);
    const expectedKeys = [
      "coverage",
      "hs_resolution",
      "item_id",
      "query_description",
      "requested_hs_code",
      "requirements_found",
      "resolved_hsk10",
    ].sort().join(",");
    if (Object.keys(item).sort().join(",") !== expectedKeys) {
      throw new ContractError(`${context}: unsupported field`);
    }
    const itemId = boundedString(item.item_id, `${context}.item_id`, 256);
    if (itemIds.has(itemId)) throw new ContractError(`${context}.item_id: duplicate`);
    itemIds.add(itemId);
    const hsResolution = boundedString(item.hs_resolution, `${context}.hs_resolution`, 32);
    if (!["exact", "unique_descendant", "ambiguous", "invalid", "missing"].includes(hsResolution)) {
      throw new ContractError(`${context}.hs_resolution: unsupported`);
    }
    const coverage = boundedString(item.coverage, `${context}.coverage`, 16);
    if (!["complete", "partial", "unknown"].includes(coverage)) {
      throw new ContractError(`${context}.coverage: unsupported`);
    }
    if (typeof item.requirements_found !== "boolean") {
      throw new ContractError(`${context}.requirements_found: boolean expected`);
    }
    return {
      item_id: itemId,
      query_description: boundedString(
        item.query_description,
        `${context}.query_description`,
        2_000,
      ),
      requested_hs_code: hsCode(item.requested_hs_code, `${context}.requested_hs_code`),
      hs_resolution: hsResolution as NonNullable<
        ReviewRun["evidence_provenance"]
      >["items"][number]["hs_resolution"],
      resolved_hsk10: hsCode(item.resolved_hsk10, `${context}.resolved_hsk10`),
      coverage: coverage as NonNullable<
        ReviewRun["evidence_provenance"]
      >["items"][number]["coverage"],
      requirements_found: item.requirements_found,
    };
  });
  if (items.length > 100 || (queryIntent !== null && items.length === 0)) {
    throw new ContractError("evidenceProvenance.items: invalid bounded count");
  }

  const allowedMethods = new Set(["exact_hs", "dense", "bm25", "graph"]);
  const allowedScoreKeys = new Set([
    "exact_hs",
    "dense",
    "bm25",
    "graph",
    "rrf",
    "lexical_overlap",
  ]);
  const allowedSourceTypes = new Set([
    "law_article",
    "customs_requirement",
    "hsk_entry",
    "notice",
  ]);
  const evidenceIds = new Set<string>();
  const expectedRankByItem = new Map<string, number>();
  const rankedEvidence = array(
    raw.ranked_evidence,
    "evidenceProvenance.ranked_evidence",
  ).map((value, index) => {
    const context = `evidenceProvenance.ranked_evidence[${index}]`;
    const row = object(value, context);
    const expectedKeys = [
      "article_no",
      "evidence_id",
      "item_id",
      "law_id",
      "law_name",
      "rank",
      "raw_scores",
      "retrieval_methods",
      "score",
      "source_type",
      "source_uri",
      "version_hash",
    ].sort().join(",");
    if (Object.keys(row).sort().join(",") !== expectedKeys) {
      throw new ContractError(`${context}: unsupported field`);
    }
    const evidenceId = boundedString(row.evidence_id, `${context}.evidence_id`, 256);
    const itemId = boundedString(row.item_id, `${context}.item_id`, 256);
    if (!publicEvidenceIds.has(evidenceId) || evidenceIds.has(evidenceId)) {
      throw new ContractError(`${context}.evidence_id: unknown or duplicate`);
    }
    if (!itemIds.has(itemId)) throw new ContractError(`${context}.item_id: unknown`);
    evidenceIds.add(evidenceId);
    if (!Number.isInteger(row.rank) || Number(row.rank) < 1) {
      throw new ContractError(`${context}.rank: positive integer expected`);
    }
    const expectedRank = expectedRankByItem.get(itemId) ?? 1;
    if (row.rank !== expectedRank) throw new ContractError(`${context}.rank: non-contiguous`);
    expectedRankByItem.set(itemId, expectedRank + 1);
    const sourceType = boundedString(row.source_type, `${context}.source_type`, 64);
    if (!allowedSourceTypes.has(sourceType)) {
      throw new ContractError(`${context}.source_type: unsupported`);
    }
    const retrievalMethods = array(
      row.retrieval_methods,
      `${context}.retrieval_methods`,
    ).map((method, methodIndex) => {
      const decoded = boundedString(
        method,
        `${context}.retrieval_methods[${methodIndex}]`,
        32,
      );
      if (!allowedMethods.has(decoded)) {
        throw new ContractError(`${context}.retrieval_methods: unsupported`);
      }
      return decoded as NonNullable<
        ReviewRun["evidence_provenance"]
      >["ranked_evidence"][number]["retrieval_methods"][number];
    });
    if (
      retrievalMethods.length === 0
      || new Set(retrievalMethods).size !== retrievalMethods.length
    ) {
      throw new ContractError(`${context}.retrieval_methods: non-empty unique list required`);
    }
    const numeric = (candidate: unknown, numericContext: string): number => {
      if (
        typeof candidate !== "number"
        || !Number.isFinite(candidate)
        || Math.abs(candidate) > 1_000_000_000
      ) {
        throw new ContractError(`${numericContext}: bounded finite number expected`);
      }
      return candidate;
    };
    const score = row.score === null ? null : numeric(row.score, `${context}.score`);
    const rawScores = object(row.raw_scores, `${context}.raw_scores`);
    const decodedRawScores: Record<string, number> = {};
    for (const [key, scoreValue] of Object.entries(rawScores)) {
      if (!allowedScoreKeys.has(key)) {
        throw new ContractError(`${context}.raw_scores.${key}: unsupported`);
      }
      decodedRawScores[key] = numeric(scoreValue, `${context}.raw_scores.${key}`);
    }
    const optionalText = (
      candidate: unknown,
      optionalContext: string,
      maximum: number,
    ): string | null => candidate === null
      ? null
      : boundedString(candidate, optionalContext, maximum);
    const versionHash = boundedString(row.version_hash, `${context}.version_hash`, 64);
    if (!SHA256.test(versionHash)) {
      throw new ContractError(`${context}.version_hash: SHA-256 expected`);
    }
    const sourceUri = boundedString(row.source_uri, `${context}.source_uri`, 2_048);
    const parsedUri = safeUrl(sourceUri);
    if (
      parsedUri?.protocol !== "https:"
      || parsedUri.username !== ""
      || parsedUri.password !== ""
      || parsedUri.search !== ""
      || parsedUri.hash !== ""
    ) {
      throw new ContractError(`${context}.source_uri: sanitized HTTPS URI expected`);
    }
    return {
      evidence_id: evidenceId,
      item_id: itemId,
      rank: Number(row.rank),
      source_type: sourceType as NonNullable<
        ReviewRun["evidence_provenance"]
      >["ranked_evidence"][number]["source_type"],
      retrieval_methods: retrievalMethods,
      score,
      raw_scores: decodedRawScores,
      law_id: optionalText(row.law_id, `${context}.law_id`, 128),
      law_name: optionalText(row.law_name, `${context}.law_name`, 512),
      article_no: optionalText(row.article_no, `${context}.article_no`, 128),
      version_hash: versionHash,
      source_uri: sourceUri,
    };
  });
  if (
    rankedEvidence.length > 1_000
    || evidenceIds.size !== publicEvidenceIds.size
    || [...publicEvidenceIds].some((evidenceId) => !evidenceIds.has(evidenceId))
  ) {
    throw new ContractError("evidenceProvenance.ranked_evidence: public Evidence mismatch");
  }
  return {
    query_intent: queryIntent,
    items,
    ranked_evidence: rankedEvidence,
  };
}

function normalizeEvidence(value: unknown, index: number): ReviewRun["evidence"][number] {
  const context = `evidence[${index}]`;
  const raw = object(value, context);
  const evidenceId = boundedString(raw.evidence_id, `${context}.evidence_id`, 256);
  const title = boundedString(raw.title ?? raw.law_name, `${context}.title`, 512);
  const sourceRecordId = boundedString(raw.law_id ?? raw.source_record_id ?? raw.source_id, `${context}.source_record_id`, 256);
  const excerpt = string(raw.excerpt ?? raw.text ?? raw.quote, `${context}.text`);
  if (excerpt.trim().length === 0 || excerpt.length > 20_000) {
    throw new ContractError(`${context}.text: 1..20000 non-whitespace characters expected`);
  }
  const sourceUri = boundedString(raw.source_uri, `${context}.source_uri`, 2_048);
  const parsedUri = safeUrl(sourceUri);
  const loopbackHttp = parsedUri?.protocol === "http:" && (parsedUri.hostname === "127.0.0.1" || parsedUri.hostname === "localhost");
  if (parsedUri === undefined || (parsedUri.protocol !== "https:" && !loopbackHttp) || parsedUri.username !== "" || parsedUri.password !== "") {
    throw new ContractError(`${context}.source_uri: HTTPS or loopback HTTP URI without credentials required`);
  }
  const sourceHash = boundedString(raw.source_hash ?? raw.source_sha256 ?? raw.version_hash, `${context}.source_hash`, 64);
  if (!SHA256.test(sourceHash)) throw new ContractError(`${context}.source_hash: SHA-256 expected`);
  return {
    evidence_id: evidenceId,
    title,
    law_id: sourceRecordId,
    ...(typeof (raw.article ?? raw.article_no) === "string"
      ? { article: String(raw.article ?? raw.article_no) }
      : {}),
    excerpt: stringValue(raw.excerpt ?? raw.text ?? raw.quote, "본문 발췌가 제공되지 않았습니다."),
    source_uri: sourceUri,
    source_hash: sourceHash,
    ...(typeof (raw.effective_date ?? raw.valid_from) === "string"
      ? { effective_date: String(raw.effective_date ?? raw.valid_from) }
      : {}),
  };
}

function validateProductionCompletionEnvelope(input: {
  raw: JsonObject;
  result: JsonObject;
  rawEvidence: unknown[];
  evidence: ReviewRun["evidence"];
  fields: ReviewRun["fields"];
  sources: ReviewRun["sources"];
  narrative: NarrativeReport | undefined;
  releaseIdentity: ReleaseIdentity | undefined;
  actionTrace: ReviewRun["action_trace"];
  rawActionTrace: unknown[];
  knownCitationIds: ReadonlySet<string>;
  ledgerEntries: unknown[];
  reviewGaps: JsonObject[];
}): boolean {
  const { raw, result, releaseIdentity } = input;
  if (
    !SHA256.test(String(raw.result_digest))
    || !SHA256.test(String(raw.provider_result_sha256))
    || !SHA256.test(String(raw.agent_input_manifest_sha256))
    || Object.keys(result).sort().join(",") !== [...BACKEND_PUBLIC_RESULT_DETAIL_KEYS].sort().join(",")
    || BACKEND_PRIVATE_RESULT_FIELDS.some((key) => key in result)
    || ["fields", "issues", "evidence", "findings", "sources"].some((key) => key in raw)
    || !Array.isArray(result.validation_issues)
    || !Array.isArray(result.regulatory_findings)
    || !Array.isArray(result.rag_evidence)
    || !Array.isArray(result.document_results)
    || !Array.isArray(result.retrieval_results)
    || !Array.isArray(result.review_gaps)
    || !Array.isArray(raw.required_actions)
    || !Array.isArray(raw.action_trace)
  ) return false;

  const release = releaseIdentity as JsonObject | undefined;
  if (
    release === undefined
    || typeof release.model_id !== "string"
    || typeof release.model_revision !== "string"
    || !EXACT_CLAUDE_MODEL.test(release.model_id)
    || release.model_revision !== release.model_id
  ) return false;

  if (!validateProductionInputDocuments(raw, result, release, input.fields, input.sources)) return false;
  if (
    !validateMandatoryCoreStages(raw.review_stage_trace)
    || !validateMandatoryCoreStages(result.review_stage_trace)
    || canonicalJson(raw.review_stage_trace) !== canonicalJson(result.review_stage_trace)
  ) return false;

  const ledger = asObject(result.fact_ledger);
  if (!/^ledger_[a-f0-9]{64}$/.test(String(ledger.ledger_id ?? ""))) return false;
  const ledgerRows = input.ledgerEntries.map(asObject);
  const ledgerReferenceIds = new Set<string>();
  for (const [index, entry] of ledgerRows.entries()) {
    if (
      !/^fact_[a-f0-9]{64}$/.test(String(entry.fact_id ?? ""))
      || !GLOBAL_REFERENCE_ID.test(String(entry.reference_id ?? ""))
      || !["field_source", "issue", "finding", "evidence", "outcome"].includes(String(entry.kind))
      || typeof entry.label !== "string"
      || entry.label.length === 0
      || typeof entry.value !== "string"
      || entry.value.length === 0
      || !SHA256.test(String(entry.source_sha256 ?? ""))
    ) return false;
    const reference = String(entry.reference_id);
    if (ledgerReferenceIds.has(reference)) return false;
    ledgerReferenceIds.add(reference);
    if (entry.document_id !== null && entry.document_id !== undefined && typeof entry.document_id !== "string") {
      throw new ContractError(`reviewRun.fact_ledger.entries[${index}].document_id: string or null expected`);
    }
  }

  const ledgerReferences = (kind: string): string[] => ledgerRows
    .filter((entry) => entry.kind === kind)
    .map((entry) => String(entry.reference_id));
  const exactUniqueReferences = (actual: string[], expected: string[]): boolean => (
    actual.length === new Set(actual).size
    && expected.length === new Set(expected).size
    && actual.length === expected.length
    && expected.every((reference) => actual.includes(reference))
  );
  if (
    result.validation_issues.length !== 0
    || result.regulatory_findings.length !== 0
    || ledgerReferences("issue").length !== 0
    || ledgerReferences("finding").length !== 0
    || !exactUniqueReferences(ledgerReferences("field_source"), input.fields.map((field) => field.field_id))
  ) return false;

  const expectedOutcome = {
    status: "completed",
    requires_human_review: false,
    retrieval_status: result.retrieval_status,
    retrieval_coverage: result.retrieval_coverage,
  };
  const autoProfile = asObject(raw.auto_completion_profile);
  const approvedRequiredDocumentCodes = new Set(
    Array.isArray(autoProfile.approved_required_document_codes)
      ? autoProfile.approved_required_document_codes.filter((code): code is string => typeof code === "string")
      : [],
  );
  const outcomeRows = ledgerRows.filter((entry) => entry.kind === "outcome");
  if (
    outcomeRows.length !== 1
    || outcomeRows[0]?.reference_id !== `outcome_${sha256CanonicalJson(expectedOutcome)}`
    || outcomeRows[0]?.label !== "deterministic_outcome"
    || outcomeRows[0]?.value !== canonicalJson(expectedOutcome)
    || (outcomeRows[0]?.document_id !== null && outcomeRows[0]?.document_id !== undefined)
  ) return false;

  if (input.rawEvidence.length !== input.evidence.length || input.evidence.length === 0) return false;
  for (const [index, rawValue] of input.rawEvidence.entries()) {
    const evidenceRaw = asObject(rawValue);
    const evidence = input.evidence[index]!;
    const sourceType = String(evidenceRaw.source_type ?? "");
    const eligibility = String(evidenceRaw.eligibility ?? "");
    const uri = safeUrl(evidenceRaw.source_uri);
    const stableEvidenceId = typeof evidenceRaw.source_record_id === "string" && typeof evidenceRaw.version_hash === "string"
      ? `ev_${hexSha256(new TextEncoder().encode(`${evidenceRaw.source_record_id}\u001f${evidenceRaw.version_hash}`))}`
      : "";
    if (
      !/^ev_[a-f0-9]{64}$/.test(String(evidenceRaw.evidence_id ?? ""))
      || evidenceRaw.evidence_id !== stableEvidenceId
      || evidence.evidence_id !== evidenceRaw.evidence_id
      || typeof evidenceRaw.source_record_id !== "string"
      || evidenceRaw.source_record_id.length === 0
      || !["law_article", "customs_requirement", "hsk_entry", "notice"].includes(sourceType)
      || typeof evidenceRaw.item_id !== "string"
      || evidenceRaw.item_id.length === 0
      || typeof evidenceRaw.title !== "string"
      || evidenceRaw.title.length === 0
      || typeof evidenceRaw.text !== "string"
      || evidenceRaw.text.length === 0
      || uri?.protocol !== "https:"
      || uri.username !== ""
      || uri.password !== ""
      || !SHA256.test(String(evidenceRaw.version_hash ?? ""))
      || evidenceRaw.trade_type !== raw.trade_type
      || (eligibility !== "supporting" && eligibility !== "finding")
      || !Array.isArray(evidenceRaw.retrieval_methods)
      || evidenceRaw.retrieval_methods.length === 0
      || evidenceRaw.retrieval_methods.some((method) => !["exact_hs", "dense", "bm25", "graph"].includes(String(method)))
      || new Set(evidenceRaw.retrieval_methods).size !== evidenceRaw.retrieval_methods.length
      || (sourceType !== "hsk_entry" && (typeof evidenceRaw.law_id !== "string" || evidenceRaw.law_id.length === 0))
    ) return false;
    if (eligibility === "finding") {
      if (
        sourceType !== "customs_requirement"
        || typeof evidenceRaw.law_name !== "string"
        || evidenceRaw.law_name.length === 0
        || typeof evidenceRaw.valid_from !== "string"
        || !/^\d{4}-\d{2}-\d{2}$/.test(evidenceRaw.valid_from)
        || typeof evidenceRaw.matched_hs_code !== "string"
        || !/^\d{6}(?:\d{4})?$/.test(evidenceRaw.matched_hs_code)
        || typeof evidenceRaw.required_document_code !== "string"
        || evidenceRaw.required_document_code.length === 0
        || !approvedRequiredDocumentCodes.has(evidenceRaw.required_document_code)
        || typeof evidenceRaw.required_document_name !== "string"
        || evidenceRaw.required_document_name.length === 0
        || !Array.isArray(evidenceRaw.agencies)
        || evidenceRaw.agencies.length === 0
        || evidenceRaw.agencies.some((agency) => typeof agency !== "string" || agency.trim().length === 0)
        || new Set(evidenceRaw.agencies).size !== evidenceRaw.agencies.length
      ) return false;
    }
    const matches = ledgerRows.filter((entry) => (
      entry.kind === "evidence"
      && entry.reference_id === evidenceRaw.evidence_id
      && entry.label === evidenceRaw.title
      && entry.value === evidenceRaw.text
      && (entry.document_id === null || entry.document_id === undefined)
    ));
    if (matches.length !== 1) return false;
  }
  if (!exactUniqueReferences(
    ledgerReferences("evidence"),
    input.rawEvidence.map((value) => String(asObject(value).evidence_id ?? "")),
  )) return false;

  for (const field of input.fields) {
    const fieldLedger = ledgerRows.find((entry) => entry.kind === "field_source" && entry.reference_id === field.field_id);
    const fieldSource = input.sources.find((source) => source.source_id === field.field_id);
    if (
      !/^field_[a-f0-9]{64}$/.test(field.field_id)
      || field.document_id === "unbound-document"
      || field.source_ids.length === 0
      || field.source_ids.some((id) => !ledgerReferenceIds.has(id))
      || fieldLedger?.document_id !== field.document_id
      || fieldLedger?.value !== String(field.value)
      || fieldSource?.document_id !== field.document_id
      || fieldSource.quote !== fieldLedger.value
    ) return false;
  }
  if (input.sources.some((source) => !GLOBAL_REFERENCE_ID.test(source.source_id) || !ledgerReferenceIds.has(source.source_id))) {
    return false;
  }

  if (!validateProductionPublicResultConsistency(result)) return false;
  if (!validateProductionGaps(input.reviewGaps, ledgerReferenceIds)) return false;
  if (!validateProductionActionTrace(input.rawActionTrace, input.actionTrace, ledgerReferenceIds)) return false;
  if (!validateProductionNarrative(raw.narrative_report, input.narrative, input.knownCitationIds)) return false;
  return true;
}

function validateBackendEffectiveResultDigest(
  raw: JsonObject,
  modelExecutionSummary: ModelExecutionSummary | undefined,
  narrativeExecutionSummary: ModelExecutionSummary | undefined,
): boolean {
  if (
    typeof raw.completion_eligibility !== "object"
    || raw.completion_eligibility === null
    || Array.isArray(raw.completion_eligibility)
    || (raw.auto_completion_profile !== undefined && (
      typeof raw.auto_completion_profile !== "object"
      || raw.auto_completion_profile === null
      || Array.isArray(raw.auto_completion_profile)
    ))
    || (raw.input_document_manifest !== undefined && !Array.isArray(raw.input_document_manifest))
    || (raw.required_actions !== undefined && !Array.isArray(raw.required_actions))
    || (raw.review_stage_trace !== undefined && !Array.isArray(raw.review_stage_trace))
  ) return false;
  const completion = asObject(raw.completion_eligibility);
  const profile = asObject(raw.auto_completion_profile);
  const inputManifest = Array.isArray(raw.input_document_manifest) ? raw.input_document_manifest : [];
  const requiredActions = Array.isArray(raw.required_actions) ? raw.required_actions : [];
  const stageTrace = Array.isArray(raw.review_stage_trace) ? raw.review_stage_trace : [];
  if (
    typeof completion.eligible !== "boolean"
    || (completion.profile_id !== undefined && completion.profile_id !== null && typeof completion.profile_id !== "string")
    || (completion.scope !== undefined && !Array.isArray(completion.scope))
    || (completion.unmet_reason_codes !== undefined && !Array.isArray(completion.unmet_reason_codes))
    || (profile.profile_id !== undefined && profile.profile_id !== null && typeof profile.profile_id !== "string")
    || (profile.approval_digest !== undefined && profile.approval_digest !== null && typeof profile.approval_digest !== "string")
    || (profile.approved_document_types !== undefined && !Array.isArray(profile.approved_document_types))
    || (profile.approved_required_document_codes !== undefined && !Array.isArray(profile.approved_required_document_codes))
    || !Object.keys(completion).every((key) => ["eligible", "profile_id", "scope", "unmet_reason_codes"].includes(key))
    || !Object.keys(profile).every((key) => ["profile_id", "approved_document_types", "approved_required_document_codes", "approval_digest"].includes(key))
  ) return false;
  if (inputManifest.some((value) => {
    const entry = asObject(value);
    return Object.keys(entry).sort().join(",") !== "content_sha256,document_id,document_type"
      || typeof entry.document_id !== "string"
      || typeof entry.document_type !== "string"
      || typeof entry.content_sha256 !== "string";
  })) return false;
  if (requiredActions.some((value) => {
    const action = asObject(value);
    return !Object.keys(action).every((key) => ["action_code", "message", "source_reference_ids"].includes(key))
      || typeof action.action_code !== "string"
      || typeof action.message !== "string"
      || (action.source_reference_ids !== undefined && !Array.isArray(action.source_reference_ids));
  })) return false;
  if (stageTrace.some((value) => {
    const stage = asObject(value);
    return !Object.keys(stage).every((key) => ["sequence", "stage", "status", "reason_ids"].includes(key))
      || !Number.isInteger(stage.sequence)
      || typeof stage.stage !== "string"
      || typeof stage.status !== "string"
      || (stage.reason_ids !== undefined && !Array.isArray(stage.reason_ids));
  })) return false;
  const effectiveSummary = {
    provider_result_sha256: raw.provider_result_sha256,
    input_manifest_digest: raw.input_manifest_digest,
    input_document_manifest: inputManifest.map((value) => {
      const entry = asObject(value);
      return {
        document_id: entry.document_id,
        document_type: entry.document_type,
        content_sha256: entry.content_sha256,
      };
    }),
    execution_status: raw.execution_status,
    assessment: raw.assessment,
    review_disposition: raw.review_disposition,
    assurance_level: raw.assurance_level,
    completion_eligibility: {
      eligible: completion.eligible,
      profile_id: completion.profile_id ?? null,
      scope: completion.scope ?? [],
      unmet_reason_codes: completion.unmet_reason_codes ?? [],
    },
    required_actions: requiredActions.map((value) => {
      const action = asObject(value);
      return {
        action_code: action.action_code,
        message: action.message,
        source_reference_ids: action.source_reference_ids ?? [],
      };
    }),
    review_stage_trace: stageTrace.map((value) => {
      const stage = asObject(value);
      return {
        sequence: stage.sequence,
        stage: stage.stage,
        status: stage.status,
        reason_ids: stage.reason_ids ?? [],
      };
    }),
    auto_completion_profile: {
      profile_id: profile.profile_id ?? null,
      approved_document_types: profile.approved_document_types ?? [],
      approved_required_document_codes: profile.approved_required_document_codes ?? [],
      approval_digest: profile.approval_digest ?? null,
    },
    ...(modelExecutionSummary === undefined
      ? {}
      : { model_execution_summary: modelExecutionSummary }),
    ...(narrativeExecutionSummary === undefined
      ? {}
      : { narrative_execution_summary: narrativeExecutionSummary }),
  };
  try {
    return raw.result_digest === sha256CanonicalJson(effectiveSummary);
  } catch {
    return false;
  }
}

function validateProductionInputDocuments(
  raw: JsonObject,
  result: JsonObject,
  release: JsonObject,
  fields: ReviewRun["fields"],
  sources: ReviewRun["sources"],
): boolean {
  if (
    typeof raw.case_id !== "string"
    || !Number.isInteger(raw.case_revision)
    || typeof raw.review_as_of !== "string"
    || !/^\d{4}-\d{2}-\d{2}$/.test(raw.review_as_of)
    || (raw.trade_type !== "import" && raw.trade_type !== "export")
    || result.review_as_of !== raw.review_as_of
    || result.trade_type !== raw.trade_type
  ) return false;
  const manifestValues = raw.input_document_manifest;
  const profile = asObject(raw.auto_completion_profile);
  if (!Array.isArray(manifestValues) || manifestValues.length !== REQUIRED_PRIMARY_DOCUMENT_TYPES.length) return false;
  if (typeof profile.profile_id !== "string" || profile.profile_id.length === 0) return false;
  const approvedRequiredDocumentCodes = profile.approved_required_document_codes;
  const completion = asObject(raw.completion_eligibility);
  if (
    profile.profile_id !== completion.profile_id
    || profile.profile_id !== release.release_profile_id
    || !SHA256.test(String(profile.approval_digest ?? ""))
    || profile.approval_digest !== release.backend_auto_completion_approval_digest
    || !Array.isArray(profile.approved_document_types)
    || !sameUniqueSet(profile.approved_document_types, REQUIRED_PRIMARY_DOCUMENT_TYPES)
    || !Array.isArray(approvedRequiredDocumentCodes)
    || approvedRequiredDocumentCodes.length === 0
    || approvedRequiredDocumentCodes.some((code) => typeof code !== "string" || code.length === 0 || code.length > 128)
    || new Set(approvedRequiredDocumentCodes).size !== approvedRequiredDocumentCodes.length
    || approvedRequiredDocumentCodes.some((code, index) => (
      index > 0 && String(approvedRequiredDocumentCodes[index - 1]).localeCompare(String(code)) >= 0
    ))
  ) return false;

  const manifest = manifestValues.map(asObject);
  const manifestIds = new Set<string>();
  const manifestTypes = new Set<string>();
  for (const entry of manifest) {
    if (
      Object.keys(entry).sort().join(",") !== "content_sha256,document_id,document_type"
      || typeof entry.document_id !== "string"
      || entry.document_id.length === 0
      || entry.document_id.length > 128
      || !REQUIRED_PRIMARY_DOCUMENT_TYPES.includes(entry.document_type as never)
      || !SHA256.test(String(entry.content_sha256 ?? ""))
      || manifestIds.has(entry.document_id)
      || manifestTypes.has(String(entry.document_type))
    ) return false;
    manifestIds.add(entry.document_id);
    manifestTypes.add(String(entry.document_type));
  }
  if (!sameUniqueSet([...manifestTypes], REQUIRED_PRIMARY_DOCUMENT_TYPES)) return false;
  if (manifest.some((entry, index) => index > 0 && String(manifest[index - 1]!.document_id).localeCompare(String(entry.document_id)) >= 0)) {
    return false;
  }
  const expectedManifestDigest = sha256CanonicalJson({
    case_id: raw.case_id,
    case_revision: raw.case_revision,
    review_as_of: raw.review_as_of,
    trade_type: raw.trade_type,
    documents: manifest.map((entry) => ({
      document_id: entry.document_id,
      document_type: entry.document_type,
      content_sha256: entry.content_sha256,
    })),
  });
  if (raw.input_manifest_digest !== expectedManifestDigest) return false;

  if (!Array.isArray(result.document_results) || result.document_results.length !== manifest.length) return false;
  const documentResults = result.document_results.map(asObject);
  const resultIds = new Set<string>();
  let materialFieldCount = 0;
  for (const document of documentResults) {
    const manifestEntry = manifest.find((entry) => entry.document_id === document.document_id);
    if (
      manifestEntry === undefined
      || document.document_type !== RESULT_TYPE_BY_PRIMARY_DOCUMENT[manifestEntry.document_type as keyof typeof RESULT_TYPE_BY_PRIMARY_DOCUMENT]
      || resultIds.has(String(document.document_id))
      || document.input_modality !== "text"
      || document.extraction_status !== "completed"
      || typeof document.extraction_provider !== "string"
      || document.extraction_provider.length === 0
      || document.model_id !== release.model_id
      || typeof document.extraction_confidence !== "number"
      || document.extraction_confidence < 0
      || document.extraction_confidence > 1
      || !Array.isArray(document.fields)
      || !Array.isArray(document.line_items)
    ) return false;
    resultIds.add(String(document.document_id));
    const documentFields = [
      ...document.fields.map(asObject),
      ...document.line_items.flatMap((item) => {
        const lineItem = asObject(item);
        return Array.isArray(lineItem.fields) ? lineItem.fields.map(asObject) : [];
      }),
    ];
    if (documentFields.length === 0) return false;
    materialFieldCount += documentFields.length;
    for (const field of documentFields) {
      const source = asObject(field.source);
      const materialValue = field.normalized_value ?? field.value;
      if (
        typeof field.name !== "string"
        || field.name.length === 0
        || materialValue === null
        || materialValue === undefined
        || (typeof materialValue === "string" && materialValue.trim().length === 0)
        || source.document_id !== document.document_id
        || source.source_modality !== "text"
        || !Number.isInteger(source.page)
        || Number(source.page) < 1
        || !Number.isInteger(source.text_start)
        || !Number.isInteger(source.text_end)
        || Number(source.text_start) < 0
        || Number(source.text_end) <= Number(source.text_start)
      ) return false;
    }
  }
  return resultIds.size === manifestIds.size
    && [...manifestIds].every((id) => resultIds.has(id))
    && materialFieldCount > 0
    && fields.length === materialFieldCount
    && sources.length > 0
    && [...manifestIds].every((documentId) => (
      fields.some((field) => field.document_id === documentId && field.source_ids.length > 0)
      && sources.some((source) => source.document_id === documentId)
    ));
}

function validateMandatoryCoreStages(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== MANDATORY_CORE_STAGES.length) return false;
  return value.every((entry, index) => {
    const stage = asObject(entry);
    return Object.keys(stage).sort().join(",") === "reason_ids,sequence,stage,status"
      && stage.sequence === index + 1
      && stage.stage === MANDATORY_CORE_STAGES[index]
      && stage.status === "completed"
      && Array.isArray(stage.reason_ids)
      && stage.reason_ids.length <= 100
      && stage.reason_ids.every((reason) => typeof reason === "string" && reason.length > 0 && reason.length <= 256)
      && new Set(stage.reason_ids).size === stage.reason_ids.length;
  });
}

function validateProductionGaps(gaps: JsonObject[], knownReferences: ReadonlySet<string>): boolean {
  const ids = new Set<string>();
  return gaps.every((gap) => {
    const gapId = String(gap.gap_id ?? "");
    if (ids.has(gapId)) return false;
    ids.add(gapId);
    return /^gap_[a-f0-9]{64}$/.test(gapId)
    && GAP_TYPES.has(String(gap.gap_type ?? ""))
    && typeof gap.reason_code === "string"
    && gap.reason_code.length > 0
    && gap.status === "resolved"
    && Array.isArray(gap.source_reference_ids)
    && new Set(gap.source_reference_ids).size === gap.source_reference_ids.length
    && gap.source_reference_ids.every((reference) => typeof reference === "string" && knownReferences.has(reference))
  });
}

function validateProductionPublicResultConsistency(result: JsonObject): boolean {
  const evidence = Array.isArray(result.rag_evidence) ? result.rag_evidence.map(asObject) : [];
  const retrievalResults = Array.isArray(result.retrieval_results) ? result.retrieval_results.map(asObject) : [];
  const retrievalEvidence = retrievalResults.flatMap((item) => (
    Array.isArray(item.evidence) ? item.evidence.map(asObject) : []
  ));
  const exactUniqueRecords = (values: JsonObject[], key: string, expected: JsonObject[]): boolean => {
    const actualIds = values.map((item) => String(item[key] ?? ""));
    const expectedIds = expected.map((item) => String(item[key] ?? ""));
    return actualIds.every((id) => id.length > 0)
      && expectedIds.every((id) => id.length > 0)
      && actualIds.length === new Set(actualIds).size
      && expectedIds.length === new Set(expectedIds).size
      && actualIds.length === expectedIds.length
      && expectedIds.every((id) => {
        const actual = values.find((item) => item[key] === id);
        const expectedValue = expected.find((item) => item[key] === id);
        return actual !== undefined
          && expectedValue !== undefined
          && canonicalJson(actual) === canonicalJson(expectedValue);
      });
  };
  if (!exactUniqueRecords(retrievalEvidence, "evidence_id", evidence)) return false;
  const retrievalItemIds = new Set<string>();
  const retrievalItemKeys = [
    "candidate_hsk10s",
    "coverage",
    "errors",
    "evidence",
    "hs_resolution",
    "item_id",
    "requirements_found",
    "resolved_hsk10",
  ].sort().join(",");
  for (const item of retrievalResults) {
    const itemId = String(item.item_id ?? "");
    const candidates = item.candidate_hsk10s;
    const itemEvidence = item.evidence;
    const customsRequirements = Array.isArray(itemEvidence)
      ? itemEvidence.map(asObject).filter((evidenceItem) => evidenceItem.source_type === "customs_requirement")
      : [];
    const findingRequirements = customsRequirements.filter((evidenceItem) => evidenceItem.eligibility === "finding");
    if (
      Object.keys(item).sort().join(",") !== retrievalItemKeys
      || itemId.length === 0
      || itemId.length > 256
      || retrievalItemIds.has(itemId)
      || (item.hs_resolution !== "exact" && item.hs_resolution !== "unique_descendant")
      || typeof item.resolved_hsk10 !== "string"
      || !/^\d{10}$/.test(item.resolved_hsk10)
      || !Array.isArray(candidates)
      || candidates.some((code) => typeof code !== "string" || !/^\d{10}$/.test(code))
      || new Set(candidates).size !== candidates.length
      || (candidates.length !== 0 && (candidates.length !== 1 || candidates[0] !== item.resolved_hsk10))
      || item.coverage !== "complete"
      || item.requirements_found !== (findingRequirements.length > 0)
      || !Array.isArray(itemEvidence)
      || itemEvidence.some((value) => asObject(value).item_id !== itemId)
      || customsRequirements.some((value) => value.matched_hs_code !== item.resolved_hsk10)
      || !Array.isArray(item.errors)
      || item.errors.length !== 0
    ) return false;
    retrievalItemIds.add(itemId);
  }
  return true;
}

function validateProductionActionTrace(
  rawTrace: unknown[],
  normalizedTrace: ReviewRun["action_trace"],
  knownReferences: ReadonlySet<string>,
): boolean {
  if (rawTrace.length === 0 || rawTrace.length !== normalizedTrace.length) return false;
  const actionIds = new Set<string>();
  return rawTrace.every((value, index) => {
    const raw = asObject(value);
    const actionId = String(raw.action_id ?? "");
    const tool = String(raw.tool_name ?? raw.tool ?? "");
    const inputs = raw.input_reference_ids ?? raw.input_source_ids;
    const outputs = raw.output_reference_ids ?? [];
    if (actionIds.has(actionId)) return false;
    actionIds.add(actionId);
    return /^action_[a-f0-9]{64}$/.test(actionId)
      && Number.isInteger(raw.cycle)
      && Number(raw.cycle) >= 0
      && Number(raw.cycle) <= 2
      && ALLOWED_TOOLS.has(tool)
      && raw.status === "succeeded"
      && typeof raw.reason_code === "string"
      && raw.reason_code.length > 0
      && Array.isArray(inputs)
      && inputs.every((reference) => typeof reference === "string" && knownReferences.has(reference))
      && Array.isArray(outputs)
      && outputs.every((reference) => typeof reference === "string" && knownReferences.has(reference))
      && normalizedTrace[index]?.status === "succeeded";
  });
}

function validateProductionNarrative(
  rawValue: unknown,
  report: NarrativeReport | undefined,
  knownCitationIds: ReadonlySet<string>,
): boolean {
  const raw = asObject(rawValue);
  if (report === undefined || report.generated_by !== "claude") return false;
  if (raw.generation_mode !== "claude" && raw.generated_by !== "claude") return false;
  if (!Array.isArray(raw.required_actions) || raw.required_actions.length !== 0 || report.recommended_actions.length !== 0) return false;
  const sections = ["summary", "document_consistency", "regulatory_review", "required_actions"];
  for (const section of sections) {
    const claims = raw[section];
    if (!Array.isArray(claims)) return false;
    if (["summary", "document_consistency", "regulatory_review"].includes(section) && claims.length === 0) return false;
    for (const value of claims) {
      const claim = asObject(value);
      if (!/^claim_[a-f0-9]{64}$/.test(String(claim.claim_id ?? "")) || typeof claim.text !== "string" || claim.text.length === 0) return false;
      const citations = Array.isArray(claim.citation_ids)
        ? claim.citation_ids
        : Array.isArray(claim.citations)
          ? claim.citations.map((item) => asObject(item).reference_id)
          : [];
      if (citations.length === 0 || citations.some((id) => typeof id !== "string" || !knownCitationIds.has(id))) return false;
    }
  }
  const visibleClaims = [
    ...report.summary,
    ...report.document_consistency,
    ...report.regulatory_review,
    ...report.impact,
    ...report.recommended_actions,
  ];
  const claimIds = new Set<string>();
  if (
    report.summary.length === 0
    || report.document_consistency.length === 0
    || report.regulatory_review.length === 0
    || visibleClaims.length === 0
  ) return false;
  for (const claim of visibleClaims) {
    if (
      !/^claim_[a-f0-9]{64}$/.test(claim.claim_id)
      || claim.text.trim().length === 0
      || claim.citation_ids.length === 0
      || claim.citation_ids.some((id) => !knownCitationIds.has(id))
      || claimIds.has(claim.claim_id)
    ) return false;
    claimIds.add(claim.claim_id);
  }
  return true;
}

function safeUrl(value: unknown): URL | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function sameUniqueSet(values: readonly unknown[], expected: readonly string[]): boolean {
  return values.length === expected.length
    && values.every((value): value is string => typeof value === "string")
    && new Set(values).size === values.length
    && expected.every((value) => values.includes(value));
}

function sha256CanonicalJson(value: unknown): string {
  return hexSha256(new TextEncoder().encode(canonicalJson(value)));
}

function hexSha256(value: Uint8Array): string {
  return [...sha256(value)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as JsonObject;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new ContractError("canonical JSON contains an unsupported value");
}

function normalizeFinding(
  value: unknown,
  ledgerEntries: unknown[] = [],
): ReviewRun["findings"][number] {
  const raw = asObject(value);
  const ledgerEntry = resolveFindingLedgerEntry(raw, ledgerEntries);
  const findingId = String(ledgerEntry.reference_id);
  const explicitSources = stringArray(raw.source_ids ?? raw.field_source_ids);
  return {
    finding_id: findingId,
    code: stringValue(raw.code ?? raw.finding_code, "UNSPECIFIED_FINDING"),
    severity: severity(raw.severity),
    title: stringValue(raw.title ?? raw.required_document_name ?? raw.finding_code, findingId),
    detail: stringValue(raw.detail ?? raw.message, "상세가 제공되지 않았습니다."),
    evidence_ids: stringArray(raw.evidence_ids),
    source_ids: explicitSources.length > 0 ? explicitSources : [findingId],
  };
}

function resolveIssueLedgerEntry(raw: JsonObject, ledgerEntries: unknown[]): JsonObject {
  return resolveSemanticLedgerEntry({
    kind: "issue",
    explicitReference: raw.reference_id,
    label: stringValue(raw.code ?? raw.issue_code, ""),
    value: stringValue(raw.message ?? raw.detail, ""),
    documentId: nullableString(raw.source_document_id),
    ledgerEntries,
  });
}

function resolveFindingLedgerEntry(raw: JsonObject, ledgerEntries: unknown[]): JsonObject {
  const source = asObject(raw.source);
  return resolveSemanticLedgerEntry({
    kind: "finding",
    explicitReference: raw.reference_id,
    label: stringValue(raw.code ?? raw.finding_code, ""),
    value: stringValue(raw.message ?? raw.detail, ""),
    documentId: nullableString(source.document_id),
    ledgerEntries,
  });
}

function resolveSemanticLedgerEntry(input: {
  kind: "issue" | "finding";
  explicitReference: unknown;
  label: string;
  value: string;
  documentId: string | null;
  ledgerEntries: unknown[];
}): JsonObject {
  if (!input.label || !input.value) {
    throw new ContractError(`reviewRun.${input.kind}: semantic binding fields are missing`);
  }
  if (input.explicitReference !== undefined && typeof input.explicitReference !== "string") {
    throw new ContractError(`reviewRun.${input.kind}.reference_id: string expected`);
  }
  const entries = input.ledgerEntries
    .map((entry) => asObject(entry))
    .filter((entry) => entry.kind === input.kind && typeof entry.reference_id === "string");
  const semanticallyMatches = (entry: JsonObject): boolean => (
    entry.label === input.label
    && entry.value === input.value
    && nullableString(entry.document_id) === input.documentId
  );
  const candidates = typeof input.explicitReference === "string"
    ? entries.filter((entry) => entry.reference_id === input.explicitReference && semanticallyMatches(entry))
    : entries.filter(semanticallyMatches);
  if (candidates.length !== 1) {
    const reason = candidates.length === 0 ? "missing" : "ambiguous";
    throw new ContractError(`reviewRun.${input.kind}: ${reason} FactLedger binding`);
  }
  return candidates[0]!;
}

function normalizeReleaseIdentity(value: unknown): ReleaseIdentity {
  const raw = object(value, "reviewRun.release_identity");
  for (const key of [
    "agent_package_version",
    "model_id",
    "extraction_prompt_sha256",
    "result_schema_sha256",
    "policy_id",
    "tool_registry_id",
  ]) string(raw[key], `reviewRun.release_identity.${key}`);
  for (const [key, identityValue] of Object.entries(raw)) {
    if (key.endsWith("_sha256") && identityValue !== null) {
      if (typeof identityValue !== "string" || !/^[a-f0-9]{64}$/.test(identityValue)) {
        throw new ContractError(`reviewRun.release_identity.${key}: SHA-256 expected`);
      }
    }
  }
  if (raw.assertion_trust_store_state !== undefined && raw.assertion_trust_store_state !== "unreleased" && raw.assertion_trust_store_state !== "active") {
    throw new ContractError("reviewRun.release_identity.assertion_trust_store_state: unsupported state");
  }
  if (raw.release_profile_state !== undefined && raw.release_profile_state !== "unreleased" && raw.release_profile_state !== "approved") {
    throw new ContractError("reviewRun.release_identity.release_profile_state: unsupported state");
  }
  for (const key of ["kill_switch_active", "backend_auto_completion_enabled"]) {
    if (raw[key] !== undefined && typeof raw[key] !== "boolean") {
      throw new ContractError(`reviewRun.release_identity.${key}: boolean expected`);
    }
  }
  return raw as ReleaseIdentity;
}

function normalizeSource(value: unknown, index: number): ReviewRun["sources"][number] {
  const raw = asObject(value);
  return {
    source_id: stringValue(raw.source_id ?? raw.reference_id, `source-${index + 1}`),
    label: stringValue(raw.label, "원문 근거"),
    ...(typeof raw.document_id === "string" ? { document_id: raw.document_id } : {}),
    ...(typeof raw.evidence_id === "string" ? { evidence_id: raw.evidence_id } : {}),
    ...(typeof (raw.quote ?? raw.value) === "string" ? { quote: String(raw.quote ?? raw.value) } : {}),
    ...(typeof raw.uri === "string" ? { uri: raw.uri } : {}),
    ...(typeof raw.page === "number" ? { page: raw.page } : {}),
    ...(typeof raw.start_offset === "number" ? { start_offset: raw.start_offset } : {}),
    ...(typeof raw.end_offset === "number" ? { end_offset: raw.end_offset } : {}),
  };
}

function deduplicateSources(sources: ReviewRun["sources"]): ReviewRun["sources"] {
  const byId = new Map<string, ReviewRun["sources"][number]>();
  for (const source of sources) if (!byId.has(source.source_id)) byId.set(source.source_id, source);
  return [...byId.values()];
}

function normalizeRequiredAction(value: unknown, index: number): RequiredAction {
  if (typeof value === "string") {
    return {
      action_id: `required-action-${index + 1}`,
      code: value,
      description: value.replaceAll("_", " "),
      source_ids: [],
      status: "required",
    };
  }
  const raw = asObject(value);
  const code = stringValue(raw.code ?? raw.action_code, `required_action_${index + 1}`);
  return {
    action_id: stringValue(raw.action_id, `required-action-${index + 1}`),
    code,
    description: stringValue(raw.description ?? raw.message ?? raw.detail, code.replaceAll("_", " ")),
    ...(raw.severity === "low" || raw.severity === "medium" || raw.severity === "high" || raw.severity === "critical"
      ? { severity: raw.severity }
      : {}),
    source_ids: stringArray(raw.source_ids ?? raw.source_reference_ids ?? raw.citation_ids),
    ...(raw.status === "required" || raw.status === "completed" || raw.status === "waived" ? { status: raw.status } : {}),
  };
}

function normalizeAction(value: unknown, index: number): ReviewRun["action_trace"][number] {
  const raw = asObject(value);
  const rawStatus = stringValue(raw.status, "succeeded");
  const status = rawStatus === "completed" ? "succeeded" : rawStatus === "started" ? "running" : rawStatus;
  return {
    action_id: stringValue(raw.action_id, `action-${index + 1}`),
    cycle: typeof raw.cycle === "number" ? raw.cycle : 0,
    tool: stringValue(raw.tool ?? raw.tool_name ?? raw.stage, "agent.workflow"),
    status: (["planned", "running", "succeeded", "failed", "denied", "deferred"] as const).includes(status as never)
      ? status as ReviewRun["action_trace"][number]["status"]
      : "failed",
    reason_code: stringValue(raw.reason_code ?? raw.message_code, "completed"),
    input_source_ids: stringArray(raw.input_source_ids ?? raw.input_reference_ids ?? raw.source_ids),
    ...(typeof raw.observation === "string" ? { observation: raw.observation } : {}),
    started_at: stringValue(raw.started_at ?? raw.occurred_at, "not-recorded"),
    ...(typeof raw.finished_at === "string" ? { finished_at: raw.finished_at } : {}),
  };
}

function normalizeNarrative(value: unknown, knownCitationIds: ReadonlySet<string>): NarrativeReport | undefined {
  const raw = asObject(value);
  if (Object.keys(raw).length === 0) return undefined;
  if (raw.recommended_actions !== undefined && raw.required_actions !== undefined) {
    throw new ContractError("narrative: recommended_actions and required_actions aliases cannot coexist");
  }
  const generatedBy = raw.generated_by;
  const generationMode = raw.generation_mode;
  if (
    generatedBy !== undefined
    && generatedBy !== "claude"
    && generatedBy !== "deterministic_fallback"
    && generatedBy !== "backend_policy_overlay"
  ) {
    throw new ContractError("narrative: unsupported generated_by value");
  }
  if (
    generationMode !== undefined
    && generationMode !== "claude"
    && generationMode !== "deterministic_fallback"
  ) {
    throw new ContractError("narrative: unsupported generation_mode value");
  }
  if (
    typeof generatedBy === "string"
    && typeof generationMode === "string"
    && generatedBy !== generationMode
  ) {
    throw new ContractError("narrative: generation-mode aliases disagree");
  }
  const citations = citationIds(raw.citations);
  const claims = (entry: unknown, prefix: string): NarrativeClaim[] => {
    if (Array.isArray(entry)) {
      return entry.map((item, index) => {
        const claim = object(item, `narrative.${prefix}[${index}]`);
        if (claim.citation_ids !== undefined && claim.citations !== undefined) {
          throw new ContractError(`narrative.${prefix}[${index}]: citation aliases cannot coexist`);
        }
        const claimCitations = Array.isArray(claim.citation_ids)
          ? array(claim.citation_ids, `narrative.${prefix}[${index}].citation_ids`).map((id, citationIndex) =>
              string(id, `narrative.${prefix}[${index}].citation_ids[${citationIndex}]`),
            )
          : array(claim.citations, `narrative.${prefix}[${index}].citations`).map((citation, citationIndex) => {
              const rawCitation = object(citation, `narrative.${prefix}[${index}].citations[${citationIndex}]`);
              return string(rawCitation.reference_id, `narrative.${prefix}[${index}].citations[${citationIndex}].reference_id`);
            });
        const claimId = boundedString(claim.claim_id, `narrative.${prefix}[${index}].claim_id`, 256);
        const claimText = string(claim.text, `narrative.${prefix}[${index}].text`);
        if (claimText.trim().length === 0 || claimText.length > 4_000) {
          throw new ContractError(`narrative.${prefix}[${index}].text: 1..4000 non-whitespace characters expected`);
        }
        if (claimCitations.length === 0 || new Set(claimCitations).size !== claimCitations.length) {
          throw new ContractError(`narrative.${prefix}[${index}]: every visible claim requires unique citations`);
        }
        return {
          claim_id: claimId,
          text: claimText,
          citation_ids: claimCitations,
          ...(typeof claim.material === "boolean" ? { material: claim.material } : {}),
        };
      });
    }
    if (typeof entry === "string") {
      if (entry.trim().length === 0 || entry.length > 4_000 || citations.length === 0) {
        throw new ContractError(`narrative.${prefix}: every visible claim requires bounded text and citations`);
      }
      return [{ claim_id: `${prefix}-1`, text: entry, citation_ids: citations }];
    }
    return [];
  };
  const report: NarrativeReport = {
    title: stringValue(raw.title, "AI 사전심사 보고서"),
    summary: claims(raw.summary, "summary"),
    document_consistency: claims(raw.document_consistency, "document-consistency"),
    regulatory_review: claims(raw.regulatory_review, "regulatory-review"),
    impact: claims(raw.impact, "impact"),
    recommended_actions: claims(raw.recommended_actions ?? raw.required_actions, "recommended-action"),
    generated_by: generatedBy === "backend_policy_overlay"
      ? "backend_policy_overlay"
      : generatedBy === "claude" || generationMode === "claude"
        ? "claude"
        : "deterministic_fallback",
    citation_verification: "passed",
  };
  if (raw.citation_verification !== "passed") throw new ContractError("narrative: citation verification must be passed");
  const visibleClaims = [
    ...report.summary,
    ...report.document_consistency,
    ...report.regulatory_review,
    ...report.impact,
    ...report.recommended_actions,
  ];
  const claimFingerprints = new Map<string, string>();
  for (const claim of visibleClaims) {
    if (knownCitationIds.has(claim.claim_id)) {
      throw new ContractError(`narrative.${claim.claim_id}: claim ID aliases a source or Evidence ID`);
    }
    const fingerprint = canonicalJson({
      text: claim.text,
      citation_ids: claim.citation_ids,
      material: claim.material ?? null,
    });
    const previousFingerprint = claimFingerprints.get(claim.claim_id);
    if (previousFingerprint !== undefined && previousFingerprint !== fingerprint) {
      throw new ContractError(`narrative.${claim.claim_id}: repeated claim ID has conflicting semantics`);
    }
    claimFingerprints.set(claim.claim_id, fingerprint);
    if (claim.citation_ids.length === 0) throw new ContractError(`narrative.${claim.claim_id}: every visible claim must cite evidence`);
    for (const citationId of claim.citation_ids) {
      if (!knownCitationIds.has(citationId)) throw new ContractError(`narrative.${claim.claim_id}: unknown citation ${citationId}`);
    }
  }
  return report;
}

function citationIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const decoded = value.map((item, index) => {
    const raw = object(item, `narrative.citations[${index}]`);
    const aliases = [raw.citation_id, raw.evidence_id, raw.source_id, raw.reference_id]
      .filter((candidate): candidate is string => typeof candidate === "string");
    if (aliases.length !== 1) throw new ContractError(`narrative.citations[${index}]: exactly one citation ID alias required`);
    return boundedString(aliases[0], `narrative.citations[${index}].id`, 256);
  });
  if (new Set(decoded).size !== decoded.length) throw new ContractError("narrative.citations: duplicate citation ID");
  return decoded;
}

function asObject(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringItems(value: unknown, context: string): string[] {
  return array(value, context).map((item, index) => string(item, `${context}[${index}]`));
}

function nonNegativeInteger(value: unknown, context: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) throw new ContractError(`${context}: non-negative integer expected`);
  return Number(value);
}

function answerStatus(value: unknown, context: string): GroundedAnswer["status"] {
  const decoded = string(value, context);
  if (decoded !== "answered" && decoded !== "insufficient_evidence" && decoded !== "out_of_scope") {
    throw new ContractError(`${context}: unsupported status`);
  }
  return decoded;
}

function decodeAnswerClaims(value: unknown, context: string): NarrativeClaim[] {
  return array(value, context).map((item, index) => {
    const claim = object(item, `${context}[${index}]`);
    return {
      claim_id: string(claim.claim_id, `${context}[${index}].claim_id`),
      text: string(claim.text, `${context}[${index}].text`),
      citation_ids: stringItems(claim.citation_ids, `${context}[${index}].citation_ids`),
      ...(typeof claim.material === "boolean" ? { material: claim.material } : {}),
    };
  });
}

function validateAnswerClaimPolicy(
  status: GroundedAnswer["status"],
  claims: NarrativeClaim[],
  context: string,
): void {
  if (claims.length === 0) throw new ContractError(`${context}: at least one claim required`);
  if (status === "answered") {
    if (claims.some((claim) => claim.material !== false && claim.citation_ids.length === 0)) {
      throw new ContractError(`${context}: answered material claims require citations`);
    }
  } else if (claims.some((claim) => claim.citation_ids.length > 0)) {
    throw new ContractError(`${context}: non-answer statuses must not present material citations`);
  }
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function severity(value: unknown): "low" | "medium" | "high" | "critical" {
  return value === "medium" || value === "high" || value === "critical" ? value : "low";
}

export function decodeGroundedAnswer(value: unknown): GroundedAnswer {
  const raw = object(value, "answer");
  if (typeof raw.answer_id === "string") {
    for (const key of ["answer_id", "review_run_id", "case_id", "org_id", "bound_result_digest", "status", "snapshot_id", "created_at"]) {
      string(raw[key], `answer.${key}`);
    }
    if (!SHA256.test(String(raw.bound_result_digest))) throw new ContractError("answer.bound_result_digest: SHA-256 expected");
    const status = answerStatus(raw.status, "answer.status");
    const claims = decodeAnswerClaims(raw.claims, "answer.claims");
    validateAnswerClaimPolicy(status, claims, "answer");
    if (raw.snapshot_id !== raw.bound_result_digest) throw new ContractError("answer: snapshot/result binding mismatch");
    return { ...(raw as unknown as GroundedAnswer), status, claims };
  }
  const citations = Array.isArray(raw.citations) ? raw.citations : [];
  const status = answerStatus(raw.answer_status, "answer.answer_status");
  if (raw.generation_mode !== "claude" && raw.generation_mode !== "deterministic_fallback") {
    throw new ContractError("answer.generation_mode: unsupported mode");
  }
  const modelExecutionSummary = decodeModelExecutionSummary(
    raw.model_execution_summary,
    "answer.model_execution_summary",
  );
  if (modelExecutionSummary.call_count !== (raw.generation_mode === "claude" ? 1 : 0)) {
    throw new ContractError("answer: generation mode/model execution mismatch");
  }
  const messageId = string(raw.message_id, "answer.message_id");
  const boundResultDigest = string(raw.bound_result_digest, "answer.bound_result_digest");
  if (!SHA256.test(boundResultDigest)) throw new ContractError("answer.bound_result_digest: SHA-256 expected");
  if (!/^idem_[a-f0-9]{64}$/.test(String(raw.idempotency_key ?? ""))) {
    throw new ContractError("answer.idempotency_key: scoped idempotency identity expected");
  }
  if (!SHA256.test(String(raw.idempotency_request_digest ?? ""))) {
    throw new ContractError("answer.idempotency_request_digest: SHA-256 expected");
  }
  const claims: NarrativeClaim[] = [{
    claim_id: `${messageId}-claim`,
    text: string(raw.answer, "answer.answer"),
    citation_ids: citations.map((item, index) => {
      const citation = object(item, `answer.citations[${index}]`);
      return string(citation.citation_id ?? citation.evidence_id ?? citation.source_id ?? citation.reference_id, `answer.citations[${index}].id`);
    }),
    material: status === "answered",
  }];
  validateAnswerClaimPolicy(status, claims, "answer");
  return {
    answer_id: messageId,
    review_run_id: string(raw.review_run_id, "answer.review_run_id"),
    case_id: string(raw.case_id, "answer.case_id"),
    org_id: string(raw.org_id, "answer.org_id"),
    bound_result_digest: boundResultDigest,
    status,
    claims,
    generation_mode: raw.generation_mode,
    model_execution_summary: modelExecutionSummary,
    snapshot_id: boundResultDigest,
    created_at: string(raw.created_at, "answer.created_at"),
  };
}

export function decodePaged<T>(value: unknown, itemDecoder: (item: unknown) => T): Paged<T> {
  const raw = object(value, "page");
  return {
    items: array(raw.items, "page.items").map(itemDecoder),
    ...(raw.next_cursor === undefined ? {} : { next_cursor: string(raw.next_cursor, "page.next_cursor") }),
  };
}

export const decodeAuditEvent = (value: unknown): AuditEvent => {
  const raw = object(value, "auditEvent");
  if (typeof raw.event_id === "string") {
    for (const key of ["event_id", "org_id", "event_type", "actor_display", "target_id", "occurred_at", "summary"]) {
      string(raw[key], `auditEvent.${key}`);
    }
    if (raw.case_id !== undefined && raw.case_id !== null) string(raw.case_id, "auditEvent.case_id");
    if (raw.review_run_id !== undefined && raw.review_run_id !== null) string(raw.review_run_id, "auditEvent.review_run_id");
    return raw as unknown as AuditEvent;
  }
  const detail = typeof raw.detail === "object" && raw.detail !== null ? raw.detail as JsonObject : {};
  return {
    event_id: string(raw.audit_id, "auditEvent.audit_id"),
    org_id: string(raw.org_id, "auditEvent.org_id"),
    ...(raw.case_id === undefined || raw.case_id === null ? {} : { case_id: string(raw.case_id, "auditEvent.case_id") }),
    ...(raw.review_run_id === undefined || raw.review_run_id === null ? {} : { review_run_id: string(raw.review_run_id, "auditEvent.review_run_id") }),
    event_type: string(raw.action, "auditEvent.action"),
    actor_display: string(raw.actor_id, "auditEvent.actor_id"),
    target_id: typeof raw.review_run_id === "string" ? raw.review_run_id : typeof raw.case_id === "string" ? raw.case_id : "organization",
    occurred_at: string(raw.created_at, "auditEvent.created_at"),
    summary: typeof detail.summary === "string" ? detail.summary : string(raw.action, "auditEvent.action").replaceAll("_", " "),
  };
};

export const decodeUatScenario = (value: unknown): UatScenario => {
  const raw = object(value, "uatScenario");
  for (const key of ["scenario_id", "title", "description", "category", "assurance_level"]) {
    string(raw[key], `uatScenario.${key}`);
  }
  object(raw.expected, "uatScenario.expected");
  return raw as unknown as UatScenario;
};

export function decodeProblem(value: unknown, fallbackStatus: number): ApiProblem {
  try {
    const raw = object(value, "problem");
    if (raw.status !== undefined && raw.status !== fallbackStatus) {
      throw new ContractError("problem.status does not match the HTTP response status");
    }
    return {
      type: typeof raw.type === "string" ? raw.type : "about:blank",
      title: typeof raw.title === "string" ? raw.title : "요청을 처리하지 못했습니다",
      status: fallbackStatus,
      detail: typeof raw.detail === "string"
        ? raw.detail
        : typeof raw.detail === "object" && raw.detail !== null && typeof (raw.detail as JsonObject).code === "string"
          ? String((raw.detail as JsonObject).code).replaceAll("_", " ")
          : "Backend가 안전한 오류 상세를 제공하지 않았습니다.",
      ...(typeof raw.instance === "string" ? { instance: raw.instance } : {}),
      ...(typeof raw.code === "string"
        ? { code: raw.code }
        : typeof raw.detail === "object" && raw.detail !== null && typeof (raw.detail as JsonObject).code === "string"
          ? { code: String((raw.detail as JsonObject).code) }
          : {}),
      ...(typeof raw.request_id === "string" ? { request_id: raw.request_id } : {}),
    };
  } catch (error) {
    if (error instanceof ContractError) throw error;
    return {
      type: "about:blank",
      title: "요청을 처리하지 못했습니다",
      status: fallbackStatus,
      detail: "Backend 응답 형식이 계약과 일치하지 않습니다.",
    };
  }
}
