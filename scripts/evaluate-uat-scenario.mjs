import {
  assertFunctionalScenarioActual,
  evaluateFunctionalScenario,
} from "../src/uat/functional-assertions.ts";
import {
  UAT_SCENARIOS,
  localUatScenarioManifestSha256,
  localUatScenarioManifestV2,
} from "../src/uat/scenarios.ts";

const MAX_STDIN_BYTES = 8 * 1024 * 1024;
const chunks = [];
let byteCount = 0;
for await (const chunk of process.stdin) {
  byteCount += chunk.length;
  if (byteCount > MAX_STDIN_BYTES) rejectInput();
  chunks.push(chunk);
}

try {
  const envelope = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const projection = projectBackendResult(envelope);
  assertFunctionalScenarioActual(projection);
  process.stdout.write(`${JSON.stringify(evaluateFunctionalScenario(projection))}\n`);
} catch {
  rejectInput();
}

function projectBackendResult(value) {
  const envelope = record(value);
  const scenarioId = text(envelope.scenario_id);
  const evidenceProfile = text(envelope.evidence_profile);
  const actual = record(envelope.actual);
  const reviewRun = record(actual.review_run);
  const detail = isRecord(reviewRun.result_detail) ? reviewRun.result_detail : reviewRun;
  const experience = record(actual.experience);
  const evidenceTrace = record(actual.evidence_trace);
  const scenario = UAT_SCENARIOS.find((candidate) => candidate.scenario_id === scenarioId);
  if (scenario === undefined) throw new Error("unknown scenario");
  const manifest = localUatScenarioManifestV2(scenario, evidenceProfile);

  const issues = firstArray(reviewRun.issues, detail.issues, detail.validation_issues);
  const findings = firstArray(reviewRun.findings, detail.findings, detail.regulatory_findings);
  const provenance = isRecord(detail.evidence_provenance) ? detail.evidence_provenance : {};
  const provenanceItems = firstArray(provenance.items);
  const rankedEvidence = firstArray(provenance.ranked_evidence);
  const evidence = firstArray(reviewRun.evidence, detail.evidence, detail.evidence_items, rankedEvidence);
  const requiredActions = firstArray(reviewRun.required_actions, detail.required_actions);
  const actionTrace = firstArray(reviewRun.action_trace, detail.action_trace);
  const stageTrace = firstArray(reviewRun.review_stage_trace, detail.review_stage_trace);
  const modelExecution = record(detail.model_execution_summary);
  const completion = record(firstDefined(reviewRun.completion_eligibility, detail.completion_eligibility));
  const releaseIdentity = isRecord(reviewRun.release_identity)
    ? reviewRun.release_identity
    : isRecord(detail.release_identity)
      ? detail.release_identity
      : {};
  const presentation = record(experience.user_presentation);
  const capability = record(experience.capability_attestation);
  const sections = array(presentation.sections);
  const retrieval = record(evidenceTrace.retrieval);

  const policyMode = firstDefined(
    evidenceTrace.evidence_policy_mode,
    nested(reviewRun, "uat_metadata", "evidence_policy_mode"),
    nested(experience, "uat_metadata", "evidence_policy_mode"),
  );
  const productionRelease = firstBoolean(
    nested(reviewRun, "uat_metadata", "production_release"),
    nested(experience, "uat_metadata", "production_release"),
    capability.environment === "local_uat" && capability.loopback_only === true ? false : undefined,
  );
  const autoCompletion = firstBoolean(
    nested(reviewRun, "uat_metadata", "auto_completion_enabled"),
    capability.auto_completion_enabled,
  );

  return {
    schema_version: "frontend-functional-scenario-actual/v1",
    scenario_id: scenarioId,
    evidence_profile: evidenceProfile,
    manifest: {
      input_manifest_sha256: manifest.input_manifest_sha256,
      expected_semantics_sha256: manifest.expected_semantics_sha256,
      manifest_sha256: localUatScenarioManifestSha256(manifest),
    },
    document_agent: {
      execution_status: firstDefined(detail.execution_status, reviewRun.execution_status),
      assessment: firstDefined(detail.assessment, reviewRun.assessment),
      issue_codes: issues.map((item) => codeFrom(item, "code", "issue_code")),
      model_execution: {
        provider: firstDefined(modelExecution.provider, null),
        model_id_present: typeof modelExecution.model_id === "string" && modelExecution.model_id.length > 0,
        text_only: modelExecution.text_only,
        call_count: modelExecution.call_count,
        input_tokens_total: modelExecution.input_tokens_total,
        output_tokens_total: modelExecution.output_tokens_total,
        prompt_hashes_complete: modelExecution.prompt_hashes_complete,
        schema_hashes_complete: modelExecution.schema_hashes_complete,
        runtime_identity_match: modelExecution.runtime_identity_match,
        audit_complete: modelExecution.audit_complete,
        unmet_reason_codes: array(modelExecution.unmet_reason_codes).map(text),
      },
    },
    actual_rag: {
      evidence_count: evidence.length,
      retrieval_status: firstDefined(detail.retrieval_status, nested(detail, "evidence_retrieval", "status")),
      coverage: firstDefined(detail.retrieval_coverage, nested(detail, "evidence_retrieval", "coverage")),
      requirements_found: provenanceItems.length === 0
        ? firstDefined(nested(detail, "evidence_retrieval", "requirements_found"), null)
        : provenanceItems.some((item) => record(item).requirements_found === true),
      result_count: rankedEvidence.length > 0
        ? rankedEvidence.length
        : firstDefined(nested(detail, "evidence_retrieval", "result_count"), evidence.length),
      finding_codes: findings.map((item) => codeFrom(item, "code", "finding_code")),
      required_action_codes: requiredActions.map((item) => codeFrom(item, "code", "action_code")),
      actions: actionTrace.map((item) => ({
        tool: text(record(item).tool),
        status: text(record(item).status),
      })),
      completed_stages: stageTrace
        .map(record)
        .filter((item) => item.status === "completed")
        .map((item) => text(item.stage)),
      narrative: {
        generation_mode: nested(presentation, "generation_audit", "mode"),
        verification_status: nested(presentation, "verification_audit", "status"),
        section_codes: sections.map((item) => text(record(item).section_code)),
        material_citations_complete: materialCitationsComplete(sections),
      },
      evidence_snapshot_id_present: nonEmptyString(firstDefined(
        releaseIdentity.evidence_snapshot_id,
        evidenceTrace.knowledge_snapshot_id,
      )),
      evidence_runtime_v3_sha256_present: nonEmptyString(firstDefined(
        releaseIdentity.evidence_runtime_v3_sha256,
        capability.evidence_runtime_v3_sha256,
        nested(evidenceTrace, "provider_identity", "runtime_release_v3_sha256"),
      )),
      retrieval_stages: {
        structured: retrievalStage(retrieval.structured),
        dense: retrievalStage(retrieval.dense),
        bm25: retrievalStage(retrieval.bm25),
        rerank: retrievalStage(retrieval.rerank),
        graph: retrievalStage(retrieval.graph),
      },
    },
    policy_release: {
      review_disposition: firstDefined(detail.review_disposition, reviewRun.review_disposition),
      unmet_reason_codes: array(completion.unmet_reason_codes).map(text),
      evidence_policy_mode: policyMode,
      auto_completion_enabled: autoCompletion,
      production_release: productionRelease,
    },
  };
}

function retrievalStage(value) {
  const stage = record(value);
  return {
    attempted: stage.attempted,
    succeeded: stage.succeeded,
    result_count: stage.result_count,
    top_k_count: firstDefined(stage.top_k_count, stage.top_k_result_count),
  };
}

function materialCitationsComplete(sections) {
  const statements = sections.flatMap((section) => array(record(section).statements));
  const material = statements.map(record).filter((statement) => statement.material !== false);
  return material.length > 0 && material.every((statement) => (
    Array.isArray(statement.source_claim_ids)
    && statement.source_claim_ids.length > 0
    && Array.isArray(statement.citation_references)
    && statement.citation_references.length > 0
  ));
}

function codeFrom(value, primary, alternative) {
  const item = record(value);
  return text(firstDefined(item[primary], item[alternative]));
}

function nested(value, parent, child) {
  return isRecord(value[parent]) ? value[parent][child] : undefined;
}

function firstBoolean(...values) {
  const value = values.find((candidate) => typeof candidate === "boolean");
  if (value === undefined) throw new Error("missing boolean");
  return value;
}

function firstDefined(...values) {
  const value = values.find((candidate) => candidate !== undefined);
  if (value === undefined) throw new Error("missing value");
  return value;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function text(value) {
  if (typeof value !== "string") throw new Error("expected text");
  return value;
}

function array(value) {
  if (!Array.isArray(value)) throw new Error("expected array");
  return value;
}

function firstArray(...values) {
  const value = values.find((candidate) => Array.isArray(candidate));
  return value === undefined ? [] : value;
}

function record(value) {
  if (!isRecord(value)) throw new Error("expected object");
  return value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectInput() {
  process.stderr.write("Functional UAT scenario input was rejected.\n");
  process.exit(2);
}
