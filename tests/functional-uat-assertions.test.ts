import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertFunctionalScenarioActual,
  evaluateFunctionalScenario,
  type FunctionalScenarioActualV1,
} from "../src/uat/functional-assertions";
import {
  UAT_SCENARIOS,
  localUatScenarioManifestSha256,
  localUatScenarioManifestV2,
} from "../src/uat/scenarios";

const PROFILE = "preserved-3law-v3-scenario-eval" as const;
const PRESENTATION_SECTIONS = [
  "conclusion",
  "process",
  "document_comparison",
  "issues_and_causes",
  "regulatory_meaning",
  "business_impact",
  "next_actions",
  "scope_and_limits",
];

describe("TASK-0033 product-owned functional scenario assertions", () => {
  it("passes the clean actual-three-law scenario on all three axes", () => {
    const result = evaluateFunctionalScenario(cleanActual());

    expect(result.status).toBe("PASS");
    expect(result.verdict_sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.axes.document_agent.passed).toBe(true);
    expect(result.axes.actual_rag.passed).toBe(true);
    expect(result.axes.policy_release.passed).toBe(true);
    expect(result.axes.actual_rag.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "retrieval.graph.succeeded", passed: true }),
      expect.objectContaining({ code: "retrieval.rerank.succeeded", passed: true }),
      expect.objectContaining({ code: "narrative.generation_mode", passed: true }),
    ]));
  });

  it("fails only the affected semantic checks for an unexpected issue and missing reranker", () => {
    const actual = cleanActual();
    actual.document_agent.issue_codes = ["UNEXPECTED_ISSUE"];
    actual.actual_rag.retrieval_stages.rerank.succeeded = false;

    const result = evaluateFunctionalScenario(actual);

    expect(result.status).toBe("FAIL");
    expect(result.axes.document_agent.checks).toContainEqual(expect.objectContaining({
      code: "issues.count",
      expected: 0,
      actual: 1,
      passed: false,
    }));
    expect(result.axes.actual_rag.checks).toContainEqual(expect.objectContaining({
      code: "retrieval.rerank.succeeded",
      passed: false,
    }));
  });

  it("rejects unexpected projection members before evaluation", () => {
    const attacked = { ...cleanActual(), document_text: "must not cross the assertion boundary" };
    expect(() => assertFunctionalScenarioActual(attacked)).toThrow(/unexpected or missing member/u);
  });

  it("CLI accepts Backend-shaped input but emits only a safe three-axis verdict", () => {
    const payload = backendEnvelope();
    const output = execFileSync(
      process.execPath,
      ["--experimental-strip-types", resolve("scripts/evaluate-uat-scenario.mjs")],
      {
        cwd: resolve("."),
        input: JSON.stringify(payload),
        encoding: "utf8",
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
        maxBuffer: 256 * 1024,
      },
    );

    expect(output).not.toContain("HIGHLY_SENSITIVE_TEST_TEXT");
    const verdict = JSON.parse(output) as {
      status: string;
      verdict_sha256: string;
      axes: Record<string, { passed: boolean }>;
    };
    expect(verdict.status).toBe("PASS");
    expect(verdict.verdict_sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(Object.keys(verdict.axes).sort()).toEqual([
      "actual_rag",
      "document_agent",
      "policy_release",
    ]);
  });
});

function cleanActual(): FunctionalScenarioActualV1 {
  const scenario = UAT_SCENARIOS.find(
    (candidate) => candidate.scenario_id === "clean_text_no_requirement_uat",
  )!;
  const manifest = localUatScenarioManifestV2(scenario, PROFILE);
  const stage = { attempted: true, succeeded: true, result_count: 3, top_k_count: 1 };
  return {
    schema_version: "frontend-functional-scenario-actual/v1",
    scenario_id: scenario.scenario_id,
    evidence_profile: PROFILE,
    manifest: {
      input_manifest_sha256: manifest.input_manifest_sha256,
      expected_semantics_sha256: manifest.expected_semantics_sha256,
      manifest_sha256: localUatScenarioManifestSha256(manifest),
    },
    document_agent: {
      execution_status: "succeeded",
      assessment: "no_issue_detected",
      issue_codes: [],
      model_execution: {
        provider: "anthropic",
        model_id_present: true,
        text_only: true,
        call_count: 4,
        input_tokens_total: 1_200,
        output_tokens_total: 320,
        prompt_hashes_complete: true,
        schema_hashes_complete: true,
        runtime_identity_match: true,
        audit_complete: true,
        unmet_reason_codes: [],
      },
    },
    actual_rag: {
      evidence_count: 3,
      retrieval_status: "ok",
      coverage: "complete",
      requirements_found: false,
      result_count: 1,
      finding_codes: [],
      required_action_codes: [],
      actions: [],
      completed_stages: ["retrieve_regulations"],
      narrative: {
        generation_mode: "claude",
        verification_status: "passed",
        section_codes: [...PRESENTATION_SECTIONS],
        material_citations_complete: true,
      },
      evidence_snapshot_id_present: true,
      evidence_runtime_v3_sha256_present: true,
      retrieval_stages: {
        structured: { ...stage },
        dense: { ...stage },
        bm25: { ...stage },
        rerank: { ...stage },
        graph: { ...stage, result_count: 0, top_k_count: 0 },
      },
    },
    policy_release: {
      review_disposition: "human_review_required",
      unmet_reason_codes: [],
      evidence_policy_mode: "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY",
      auto_completion_enabled: false,
      production_release: false,
    },
  };
}

function backendEnvelope(): Record<string, unknown> {
  const actual = cleanActual();
  const retrieval = Object.fromEntries(Object.entries(actual.actual_rag.retrieval_stages).map(
    ([name, stage]) => [name, {
      attempted: stage.attempted,
      succeeded: stage.succeeded,
      result_count: stage.result_count,
      top_k_result_count: stage.top_k_count,
    }],
  ));
  return {
    scenario_id: actual.scenario_id,
    evidence_profile: actual.evidence_profile,
    actual: {
      review_run: {
        execution_status: actual.document_agent.execution_status,
        assessment: actual.document_agent.assessment,
        review_disposition: actual.policy_release.review_disposition,
        required_actions: [],
        action_trace: [],
        review_stage_trace: [{ stage: "retrieve_regulations", status: "completed" }],
        result_detail: {
          validation_issues: [],
          regulatory_findings: [],
          retrieval_status: actual.actual_rag.retrieval_status,
          retrieval_coverage: actual.actual_rag.coverage,
          evidence_provenance: {
            items: [{ requirements_found: false }],
            ranked_evidence: [{ evidence_id: "ev-safe" }],
          },
          model_execution_summary: {
            provider: "anthropic",
            model_id: "claude-test-model",
            text_only: true,
            call_count: 4,
            input_tokens_total: 1_200,
            output_tokens_total: 320,
            prompt_hashes_complete: true,
            schema_hashes_complete: true,
            runtime_identity_match: true,
            audit_complete: true,
            unmet_reason_codes: [],
          },
        },
        completion_eligibility: { unmet_reason_codes: [] },
        release_identity: {
          evidence_snapshot_id: "snapshot-safe",
          evidence_runtime_v3_sha256: "a".repeat(64),
        },
        ignored_document_text: "HIGHLY_SENSITIVE_TEST_TEXT",
      },
      experience: {
        user_presentation: {
          sections: PRESENTATION_SECTIONS.map((sectionCode) => ({
            section_code: sectionCode,
            statements: [{
              material: true,
              source_claim_ids: ["claim-safe"],
              citation_references: [{ kind: "evidence", reference_id: "ev-safe" }],
            }],
          })),
          generation_audit: { mode: "claude" },
          verification_audit: { status: "passed" },
        },
        capability_attestation: {
          environment: "local_uat",
          loopback_only: true,
          auto_completion_enabled: false,
          evidence_runtime_v3_sha256: "a".repeat(64),
        },
      },
      evidence_trace: {
        evidence_policy_mode: "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY",
        knowledge_snapshot_id: "snapshot-safe",
        retrieval,
      },
    },
  };
}
