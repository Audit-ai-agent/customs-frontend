import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("TASK-0024 canonical UAT scenario export", () => {
  it("exports the exact 9 test-only scenario-eval variants deterministically", () => {
    const first = exportScenarioEval();
    const second = exportScenarioEval();
    expect(second).toBe(first);

    const payload = JSON.parse(first) as {
      schema_version: string;
      test_only: boolean;
      contains_synthetic_document_text: boolean;
      contains_credentials: boolean;
      evidence_profile: string;
      scenario_count: number;
      scenarios: Array<{
        scenario_id: string;
        evidence_profile: string;
        documents: Array<{ content_text: string }>;
        supporting_document: unknown;
        requires_approver: boolean;
        expected: {
          document_agent: unknown;
          actual_rag: unknown;
          policy_release: { evidence_policy_mode: string };
        };
        manifest_v2: {
          schema_version: string;
          input_manifest_sha256: string;
          expected_semantics_sha256: string;
          manifest_sha256: string;
          case_external_reference: string;
        };
      }>;
    };
    expect(payload).toEqual(expect.objectContaining({
      schema_version: "frontend-uat-scenario-export/v2",
      test_only: true,
      contains_synthetic_document_text: true,
      contains_credentials: false,
      evidence_profile: "preserved-3law-v3-scenario-eval",
      scenario_count: 9,
    }));
    expect(payload.scenarios).toHaveLength(9);
    expect(new Set(payload.scenarios.map((scenario) => scenario.scenario_id)).size).toBe(9);
    expect(payload.scenarios.every((scenario) => (
      scenario.evidence_profile === payload.evidence_profile
      && scenario.documents.length >= 4
      && scenario.documents.every((document) => document.content_text.length > 0)
      && scenario.expected.policy_release.evidence_policy_mode
        === "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY"
      && scenario.manifest_v2.schema_version === "frontend-uat-scenario-manifest/v2"
      && /^[a-f0-9]{64}$/u.test(scenario.manifest_v2.input_manifest_sha256)
      && /^[a-f0-9]{64}$/u.test(scenario.manifest_v2.expected_semantics_sha256)
      && /^[a-f0-9]{64}$/u.test(scenario.manifest_v2.manifest_sha256)
      && scenario.manifest_v2.case_external_reference.length <= 200
    ))).toBe(true);
  });
});

function exportScenarioEval(): string {
  return execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      resolve("scripts/export-uat-scenarios.mjs"),
      "--profile",
      "preserved-3law-v3-scenario-eval",
    ],
    {
      cwd: resolve("."),
      encoding: "utf8",
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
      maxBuffer: 2 * 1024 * 1024,
    },
  );
}
