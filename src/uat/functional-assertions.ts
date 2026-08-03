import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import type {
  Assessment,
  ExecutionStatus,
  ReviewDisposition,
} from "../api/v1/types.ts";
import {
  UAT_SCENARIOS,
  localUatScenarioManifestSha256,
  localUatScenarioManifestV2,
  localUatScenarioVariant,
  type LocalUatEvidencePolicyMode,
  type LocalUatEvidenceProfile,
  type LocalUatModelExecutionExpectation,
  type LocalUatSemanticExpectation,
} from "./scenarios.ts";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/u;
const SCENARIO_EVAL_PROFILE = "preserved-3law-v3-scenario-eval";
const REQUIRED_RETRIEVAL_STAGES = [
  "structured",
  "dense",
  "bm25",
  "rerank",
  "graph",
] as const;
const REQUIRED_PRESENTATION_SECTIONS = [
  "conclusion",
  "process",
  "document_comparison",
  "issues_and_causes",
  "regulatory_meaning",
  "business_impact",
  "next_actions",
  "scope_and_limits",
] as const;

export type FunctionalUatAxis = "document_agent" | "actual_rag" | "policy_release";

export interface FunctionalModelExecutionProjection {
  provider: "anthropic" | null;
  model_id_present: boolean;
  text_only: boolean;
  call_count: number;
  input_tokens_total: number;
  output_tokens_total: number;
  prompt_hashes_complete: boolean;
  schema_hashes_complete: boolean;
  runtime_identity_match: boolean;
  audit_complete: boolean;
  unmet_reason_codes: string[];
}

export interface FunctionalRetrievalStageProjection {
  attempted: boolean;
  succeeded: boolean;
  result_count: number;
  top_k_count: number;
}

export interface FunctionalScenarioActualV1 {
  schema_version: "frontend-functional-scenario-actual/v1";
  scenario_id: string;
  evidence_profile: LocalUatEvidenceProfile;
  manifest: {
    input_manifest_sha256: string;
    expected_semantics_sha256: string;
    manifest_sha256: string;
  };
  document_agent: {
    execution_status: ExecutionStatus;
    assessment: Assessment;
    issue_codes: string[];
    model_execution: FunctionalModelExecutionProjection;
  };
  actual_rag: {
    evidence_count: number;
    retrieval_status: "ok" | "partial" | "failed";
    coverage: "complete" | "partial" | "unknown";
    requirements_found: boolean | null;
    result_count: number;
    finding_codes: string[];
    required_action_codes: string[];
    actions: Array<{ tool: string; status: string }>;
    completed_stages: string[];
    narrative: {
      generation_mode: "claude" | "deterministic_fallback";
      verification_status: "passed" | "fallback";
      section_codes: string[];
      material_citations_complete: boolean;
    };
    evidence_snapshot_id_present: boolean;
    evidence_runtime_v3_sha256_present: boolean;
    retrieval_stages: Record<
      typeof REQUIRED_RETRIEVAL_STAGES[number],
      FunctionalRetrievalStageProjection
    >;
  };
  policy_release: {
    review_disposition: ReviewDisposition;
    unmet_reason_codes: string[];
    evidence_policy_mode: LocalUatEvidencePolicyMode;
    auto_completion_enabled: boolean;
    production_release: boolean;
  };
}

export interface FunctionalUatCheck {
  code: string;
  expected: string | number | boolean;
  actual: string | number | boolean;
  passed: boolean;
}

export interface FunctionalUatAxisResult {
  passed: boolean;
  checks: FunctionalUatCheck[];
}

export interface FunctionalScenarioEvaluationV1 {
  schema_version: "frontend-functional-scenario-evaluation/v1";
  scenario_id: string;
  evidence_profile: LocalUatEvidenceProfile;
  status: "PASS" | "FAIL";
  axes: Record<FunctionalUatAxis, FunctionalUatAxisResult>;
  verdict_sha256: string;
}

/**
 * Evaluates a bounded, content-free projection against the product-owned UAT
 * semantics. Document text, prompts, questions, credentials, and provider
 * responses are intentionally absent from this boundary.
 */
export function evaluateFunctionalScenario(
  actual: FunctionalScenarioActualV1,
): FunctionalScenarioEvaluationV1 {
  const scenario = UAT_SCENARIOS.find((candidate) => candidate.scenario_id === actual.scenario_id);
  if (scenario === undefined) throw new Error(`Unknown UAT scenario: ${actual.scenario_id}`);
  const variant = localUatScenarioVariant(scenario, actual.evidence_profile);
  const canonicalManifest = localUatScenarioManifestV2(scenario, actual.evidence_profile);
  const checks: Record<FunctionalUatAxis, FunctionalUatCheck[]> = {
    document_agent: [],
    actual_rag: [],
    policy_release: [],
  };

  addCheck(
    checks.document_agent,
    "manifest.input",
    canonicalManifest.input_manifest_sha256,
    actual.manifest.input_manifest_sha256,
  );
  addCheck(
    checks.document_agent,
    "manifest.expected",
    canonicalManifest.expected_semantics_sha256,
    actual.manifest.expected_semantics_sha256,
  );
  addCheck(
    checks.document_agent,
    "manifest.envelope",
    localUatScenarioManifestSha256(canonicalManifest),
    actual.manifest.manifest_sha256,
  );
  addContainsCheck(
    checks.document_agent,
    "execution_status",
    variant.expected.document_agent.allowed_execution_statuses,
    actual.document_agent.execution_status,
  );
  addCheck(
    checks.document_agent,
    "assessment",
    variant.expected.document_agent.assessment,
    actual.document_agent.assessment,
  );
  evaluateSemantic(
    checks.document_agent,
    variant.expected.document_agent.semantic,
    actual,
  );

  evaluateSemantic(checks.actual_rag, variant.expected.actual_rag.semantic, actual);
  if (variant.expected.actual_rag.release_identity.required) {
    addCheck(
      checks.actual_rag,
      "release_identity.evidence_snapshot_id",
      variant.expected.actual_rag.release_identity.evidence_snapshot_id_required,
      actual.actual_rag.evidence_snapshot_id_present,
    );
    addCheck(
      checks.actual_rag,
      "release_identity.evidence_runtime_v3_sha256",
      variant.expected.actual_rag.release_identity.evidence_runtime_v3_sha256_required,
      actual.actual_rag.evidence_runtime_v3_sha256_present,
    );
  }
  if (actual.evidence_profile === SCENARIO_EVAL_PROFILE) {
    for (const stageName of REQUIRED_RETRIEVAL_STAGES) {
      const stage = actual.actual_rag.retrieval_stages[stageName];
      addCheck(checks.actual_rag, `retrieval.${stageName}.attempted`, true, stage.attempted);
      addCheck(checks.actual_rag, `retrieval.${stageName}.succeeded`, true, stage.succeeded);
      addMinimumCheck(checks.actual_rag, `retrieval.${stageName}.result_count`, 0, stage.result_count);
      addMinimumCheck(checks.actual_rag, `retrieval.${stageName}.top_k_count`, 0, stage.top_k_count);
    }
    addCheck(
      checks.actual_rag,
      "narrative.generation_mode",
      "claude",
      actual.actual_rag.narrative.generation_mode,
    );
    addCheck(
      checks.actual_rag,
      "narrative.verification_status",
      "passed",
      actual.actual_rag.narrative.verification_status,
    );
    for (const sectionCode of REQUIRED_PRESENTATION_SECTIONS) {
      addContainsCheck(
        checks.actual_rag,
        `narrative.section.${sectionCode}`,
        actual.actual_rag.narrative.section_codes,
        sectionCode,
      );
    }
  }

  addCheck(
    checks.policy_release,
    "review_disposition",
    variant.expected.policy_release.disposition,
    actual.policy_release.review_disposition,
  );
  for (const reasonCode of variant.expected.policy_release.unmet_reason_codes ?? []) {
    addContainsCheck(
      checks.policy_release,
      `unmet_reason.${reasonCode}`,
      actual.policy_release.unmet_reason_codes,
      reasonCode,
    );
  }
  evaluateSemantic(checks.policy_release, variant.expected.policy_release.semantic, actual);
  addCheck(
    checks.policy_release,
    "evidence_policy_mode",
    variant.expected.policy_release.evidence_policy_mode,
    actual.policy_release.evidence_policy_mode,
  );
  addCheck(
    checks.policy_release,
    "auto_completion_enabled",
    variant.expected.policy_release.auto_completion_enabled,
    actual.policy_release.auto_completion_enabled,
  );
  addCheck(
    checks.policy_release,
    "production_release",
    variant.expected.policy_release.production_release,
    actual.policy_release.production_release,
  );

  const axes = {
    document_agent: axisResult(checks.document_agent),
    actual_rag: axisResult(checks.actual_rag),
    policy_release: axisResult(checks.policy_release),
  };
  const result: Omit<FunctionalScenarioEvaluationV1, "verdict_sha256"> = {
    schema_version: "frontend-functional-scenario-evaluation/v1",
    scenario_id: actual.scenario_id,
    evidence_profile: actual.evidence_profile,
    status: (
      axes.document_agent.passed && axes.actual_rag.passed && axes.policy_release.passed
        ? "PASS"
        : "FAIL"
    ) as "PASS" | "FAIL",
    axes,
  };
  return {
    ...result,
    verdict_sha256: bytesToHex(nobleSha256(new TextEncoder().encode(canonicalJson(result)))),
  };
}

function evaluateSemantic(
  checks: FunctionalUatCheck[],
  expected: LocalUatSemanticExpectation,
  actual: FunctionalScenarioActualV1,
): void {
  const issueCodes = actual.document_agent.issue_codes;
  const findingCodes = actual.actual_rag.finding_codes;
  if (expected.issues?.count !== undefined) {
    addCheck(checks, "issues.count", expected.issues.count, issueCodes.length);
  }
  for (const code of expected.issues?.include_codes ?? []) {
    addContainsCheck(checks, `issues.include.${code}`, issueCodes, code);
  }
  if (expected.findings?.count !== undefined) {
    addCheck(checks, "findings.count", expected.findings.count, findingCodes.length);
  }
  for (const code of expected.findings?.include_codes ?? []) {
    addContainsCheck(checks, `findings.include.${code}`, findingCodes, code);
  }
  if (expected.evidence?.count !== undefined) {
    addCheck(checks, "evidence.count", expected.evidence.count, actual.actual_rag.evidence_count);
  }
  if (expected.evidence?.minimum_count !== undefined) {
    addMinimumCheck(
      checks,
      "evidence.minimum_count",
      expected.evidence.minimum_count,
      actual.actual_rag.evidence_count,
    );
  }
  if (expected.evidence?.retrieval_status !== undefined) {
    addCheck(
      checks,
      "evidence.retrieval_status",
      expected.evidence.retrieval_status,
      actual.actual_rag.retrieval_status,
    );
  }
  if (expected.evidence?.coverage !== undefined) {
    addCheck(checks, "evidence.coverage", expected.evidence.coverage, actual.actual_rag.coverage);
  }
  if (expected.evidence?.requirements_found !== undefined) {
    addCheck(
      checks,
      "evidence.requirements_found",
      expected.evidence.requirements_found,
      actual.actual_rag.requirements_found ?? "not_available",
    );
  }
  if (expected.evidence?.minimum_result_count !== undefined) {
    addMinimumCheck(
      checks,
      "evidence.minimum_result_count",
      expected.evidence.minimum_result_count,
      actual.actual_rag.result_count,
    );
  }
  for (const code of expected.required_actions?.include_codes ?? []) {
    addContainsCheck(
      checks,
      `required_actions.include.${code}`,
      actual.actual_rag.required_action_codes,
      code,
    );
  }
  if (expected.required_actions?.minimum_count !== undefined) {
    addMinimumCheck(
      checks,
      "required_actions.minimum_count",
      expected.required_actions.minimum_count,
      actual.actual_rag.required_action_codes.length,
    );
  }
  for (const tool of expected.action_trace?.include_succeeded_tools ?? []) {
    const succeeded = actual.actual_rag.actions.some(
      (action) => action.tool === tool && action.status === "succeeded",
    );
    addCheck(checks, `actions.succeeded.${tool}`, true, succeeded);
  }
  if (
    expected.action_trace?.allowed_tools !== undefined
    && expected.action_trace.maximum_unauthorized_tool_count !== undefined
  ) {
    const allowed = new Set(expected.action_trace.allowed_tools);
    const unauthorized = actual.actual_rag.actions.filter((action) => !allowed.has(action.tool));
    addCheck(
      checks,
      "actions.unauthorized_count",
      expected.action_trace.maximum_unauthorized_tool_count,
      unauthorized.length,
    );
  }
  for (const stage of expected.review_stages?.include_completed_stages ?? []) {
    addContainsCheck(checks, `stages.completed.${stage}`, actual.actual_rag.completed_stages, stage);
  }
  for (const reasonCode of expected.completion?.include_unmet_reason_codes ?? []) {
    addContainsCheck(
      checks,
      `completion.unmet_reason.${reasonCode}`,
      actual.policy_release.unmet_reason_codes,
      reasonCode,
    );
  }
  if (expected.model_execution !== undefined) {
    evaluateModelExecution(checks, expected.model_execution, actual.document_agent.model_execution);
  }
  if (expected.narrative?.material_citations_complete === true) {
    addCheck(
      checks,
      "narrative.material_citations_complete",
      true,
      actual.actual_rag.narrative.material_citations_complete,
    );
  }
}

function evaluateModelExecution(
  checks: FunctionalUatCheck[],
  expected: LocalUatModelExecutionExpectation,
  actual: FunctionalModelExecutionProjection,
): void {
  addCheck(checks, "model.provider", expected.provider, actual.provider ?? "not_available");
  addCheck(checks, "model.model_id_present", true, actual.model_id_present);
  addCheck(checks, "model.text_only", expected.text_only, actual.text_only);
  addMinimumCheck(checks, "model.call_count", expected.minimum_call_count, actual.call_count);
  addMinimumCheck(
    checks,
    "model.input_tokens_total",
    expected.minimum_input_tokens,
    actual.input_tokens_total,
  );
  addMinimumCheck(
    checks,
    "model.output_tokens_total",
    expected.minimum_output_tokens,
    actual.output_tokens_total,
  );
  addCheck(checks, "model.prompt_hashes_complete", true, actual.prompt_hashes_complete);
  addCheck(checks, "model.schema_hashes_complete", true, actual.schema_hashes_complete);
  addCheck(checks, "model.runtime_identity_match", true, actual.runtime_identity_match);
  addCheck(checks, "model.audit_complete", expected.audit_complete, actual.audit_complete);
  addCheck(checks, "model.unmet_reason_count", 0, actual.unmet_reason_codes.length);
}

function addCheck(
  checks: FunctionalUatCheck[],
  code: string,
  expected: string | number | boolean,
  actual: string | number | boolean,
): void {
  checks.push({ code, expected, actual, passed: expected === actual });
}

function addMinimumCheck(
  checks: FunctionalUatCheck[],
  code: string,
  expected: number,
  actual: number,
): void {
  checks.push({ code, expected, actual, passed: actual >= expected });
}

function addContainsCheck(
  checks: FunctionalUatCheck[],
  code: string,
  expectedValues: readonly string[],
  actualValue: string,
): void {
  checks.push({
    code,
    expected: true,
    actual: expectedValues.includes(actualValue),
    passed: expectedValues.includes(actualValue),
  });
}

function axisResult(checks: FunctionalUatCheck[]): FunctionalUatAxisResult {
  return { passed: checks.every((check) => check.passed), checks };
}

export function assertFunctionalScenarioActual(
  value: unknown,
): asserts value is FunctionalScenarioActualV1 {
  const root = exactRecord(value, [
    "actual_rag",
    "document_agent",
    "evidence_profile",
    "manifest",
    "policy_release",
    "scenario_id",
    "schema_version",
  ]);
  if (root.schema_version !== "frontend-functional-scenario-actual/v1") {
    throw new Error("Functional scenario input schema version is invalid.");
  }
  safeCode(root.scenario_id, "scenario_id");
  if (root.evidence_profile !== SCENARIO_EVAL_PROFILE) {
    throw new Error("Functional scenario input requires the actual three-law evaluation profile.");
  }
  const manifest = exactRecord(root.manifest, [
    "expected_semantics_sha256",
    "input_manifest_sha256",
    "manifest_sha256",
  ]);
  for (const [key, candidate] of Object.entries(manifest)) sha256(candidate, `manifest.${key}`);

  const documentAgent = exactRecord(root.document_agent, [
    "assessment",
    "execution_status",
    "issue_codes",
    "model_execution",
  ]);
  oneOf(documentAgent.execution_status, ["succeeded", "partial", "failed"], "execution_status");
  oneOf(
    documentAgent.assessment,
    ["no_issue_detected", "issues_detected", "indeterminate"],
    "assessment",
  );
  safeCodeArray(documentAgent.issue_codes, "issue_codes");
  validateModelExecution(documentAgent.model_execution);

  const actualRag = exactRecord(root.actual_rag, [
    "actions",
    "completed_stages",
    "coverage",
    "evidence_count",
    "evidence_runtime_v3_sha256_present",
    "evidence_snapshot_id_present",
    "finding_codes",
    "narrative",
    "required_action_codes",
    "requirements_found",
    "result_count",
    "retrieval_stages",
    "retrieval_status",
  ]);
  nonNegativeInteger(actualRag.evidence_count, "evidence_count");
  oneOf(actualRag.retrieval_status, ["ok", "partial", "failed"], "retrieval_status");
  oneOf(actualRag.coverage, ["complete", "partial", "unknown"], "coverage");
  if (actualRag.requirements_found !== null && typeof actualRag.requirements_found !== "boolean") {
    throw new Error("requirements_found must be boolean or null.");
  }
  nonNegativeInteger(actualRag.result_count, "result_count");
  safeCodeArray(actualRag.finding_codes, "finding_codes");
  safeCodeArray(actualRag.required_action_codes, "required_action_codes");
  safeCodeArray(actualRag.completed_stages, "completed_stages");
  const narrative = exactRecord(actualRag.narrative, [
    "generation_mode",
    "material_citations_complete",
    "section_codes",
    "verification_status",
  ]);
  oneOf(narrative.generation_mode, ["claude", "deterministic_fallback"], "generation_mode");
  oneOf(narrative.verification_status, ["passed", "fallback"], "verification_status");
  safeCodeArray(narrative.section_codes, "section_codes");
  boolean(narrative.material_citations_complete, "material_citations_complete");
  boolean(actualRag.evidence_snapshot_id_present, "evidence_snapshot_id_present");
  boolean(actualRag.evidence_runtime_v3_sha256_present, "evidence_runtime_v3_sha256_present");
  if (!Array.isArray(actualRag.actions) || actualRag.actions.length > 64) {
    throw new Error("actions must be a bounded array.");
  }
  for (const [index, candidate] of actualRag.actions.entries()) {
    const action = exactRecord(candidate, ["status", "tool"]);
    safeCode(action.tool, `actions[${index}].tool`);
    oneOf(
      action.status,
      ["planned", "running", "succeeded", "failed", "denied", "deferred"],
      `actions[${index}].status`,
    );
  }
  const retrievalStages = exactRecord(actualRag.retrieval_stages, [...REQUIRED_RETRIEVAL_STAGES]);
  for (const stageName of REQUIRED_RETRIEVAL_STAGES) {
    const stage = exactRecord(retrievalStages[stageName], [
      "attempted",
      "result_count",
      "succeeded",
      "top_k_count",
    ]);
    boolean(stage.attempted, `${stageName}.attempted`);
    boolean(stage.succeeded, `${stageName}.succeeded`);
    nonNegativeInteger(stage.result_count, `${stageName}.result_count`);
    nonNegativeInteger(stage.top_k_count, `${stageName}.top_k_count`);
  }

  const policy = exactRecord(root.policy_release, [
    "auto_completion_enabled",
    "evidence_policy_mode",
    "production_release",
    "review_disposition",
    "unmet_reason_codes",
  ]);
  oneOf(
    policy.review_disposition,
    ["auto_review_complete", "human_review_required", "blocked"],
    "review_disposition",
  );
  oneOf(
    policy.evidence_policy_mode,
    [
      "SYNTHETIC_FIXTURE",
      "ACTUAL_CODES_HUMAN_ONLY",
      "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY",
    ],
    "evidence_policy_mode",
  );
  safeCodeArray(policy.unmet_reason_codes, "unmet_reason_codes");
  boolean(policy.auto_completion_enabled, "auto_completion_enabled");
  boolean(policy.production_release, "production_release");
}

function validateModelExecution(value: unknown): void {
  const model = exactRecord(value, [
    "audit_complete",
    "call_count",
    "input_tokens_total",
    "model_id_present",
    "output_tokens_total",
    "prompt_hashes_complete",
    "provider",
    "runtime_identity_match",
    "schema_hashes_complete",
    "text_only",
    "unmet_reason_codes",
  ]);
  if (model.provider !== null) oneOf(model.provider, ["anthropic"], "provider");
  for (const name of [
    "model_id_present",
    "text_only",
    "prompt_hashes_complete",
    "schema_hashes_complete",
    "runtime_identity_match",
    "audit_complete",
  ] as const) boolean(model[name], name);
  for (const name of ["call_count", "input_tokens_total", "output_tokens_total"] as const) {
    nonNegativeInteger(model[name], name);
  }
  safeCodeArray(model.unmet_reason_codes, "model.unmet_reason_codes");
}

function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Functional scenario input member must be an object.");
  }
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error("Functional scenario input contains an unexpected or missing member.");
  }
  return value as Record<string, unknown>;
}

function safeCodeArray(value: unknown, label: string): void {
  if (!Array.isArray(value) || value.length > 128) throw new Error(`${label} must be a bounded array.`);
  for (const candidate of value) safeCode(candidate, label);
}

function safeCode(value: unknown, label: string): void {
  if (typeof value !== "string" || !SAFE_CODE_PATTERN.test(value)) {
    throw new Error(`${label} must contain only a safe bounded identifier.`);
  }
}

function sha256(value: unknown, label: string): void {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
}

function boolean(value: unknown, label: string): void {
  if (typeof value !== "boolean") throw new Error(`${label} must be boolean.`);
}

function nonNegativeInteger(value: unknown, label: string): void {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
}

function oneOf(value: unknown, options: readonly string[], label: string): void {
  if (typeof value !== "string" || !options.includes(value)) {
    throw new Error(`${label} is outside the allowed values.`);
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

function bytesToHex(value: Uint8Array): string {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
