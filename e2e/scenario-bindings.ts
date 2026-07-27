import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export const EVIDENCE_PROFILE = "preserved-3law-v3-scenario-eval";
export const SCENARIO_IDS = [
  "clean_text_no_requirement_uat",
  "actual_3law_structured_requirement_human_only",
  "clean_text_untrusted_supporting_document",
  "clean_text_production_candidate_blocked",
  "quantity_mismatch",
  "invoice_total_mismatch",
  "origin_mismatch",
  "missing_required_document",
  "prompt_injection",
] as const;

export interface ScenarioBrowserBinding {
  scenario_id: typeof SCENARIO_IDS[number];
  case_id: string;
  review_run_id: string;
  external_reference: string;
  manifest_sha256: string;
  result_sha256: string;
}

const BINDING_SCHEMA = "customs-browser-scenario-bindings/v1";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const REPOSITORY_ROOT = resolve(import.meta.dirname, "..");
const TOP_LEVEL_KEYS = [
  "evidence_profile",
  "scenario_count",
  "scenarios",
  "schema_version",
];
const ITEM_KEYS = [
  "case_id",
  "external_reference",
  "manifest_sha256",
  "result_sha256",
  "review_run_id",
  "scenario_id",
];

export async function loadExactScenarioBindings(): Promise<ScenarioBrowserBinding[]> {
  const configuredPath = process.env.CUSTOMS_E2E_SCENARIO_BINDINGS_FILE;
  const expectedSha256 = process.env.CUSTOMS_E2E_SCENARIO_BINDINGS_SHA256;
  if (!configuredPath || !isAbsolute(configuredPath)) {
    throw new Error(
      "Browser E2E requires an absolute CUSTOMS_E2E_SCENARIO_BINDINGS_FILE from the current Harness run.",
    );
  }
  if (!expectedSha256 || !SHA256_PATTERN.test(expectedSha256)) {
    throw new Error(
      "Browser E2E requires CUSTOMS_E2E_SCENARIO_BINDINGS_SHA256 for the exact binding file.",
    );
  }
  const bindingsPath = resolve(configuredPath);
  const containment = relative(REPOSITORY_ROOT, bindingsPath);
  if (
    containment !== ".."
    && !containment.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    && !isAbsolute(containment)
  ) {
    throw new Error("Browser scenario bindings must be generated outside the Frontend repository.");
  }

  const bindingStat = await lstat(bindingsPath);
  if (
    bindingStat.isSymbolicLink()
    || !bindingStat.isFile()
    || bindingStat.size < 2
    || bindingStat.size > 64 * 1_024
    || await realpath(bindingsPath) !== bindingsPath
  ) {
    throw new Error("Browser scenario binding file is not a bounded regular file.");
  }
  const bytes = await readFile(bindingsPath);
  try {
    if (createHash("sha256").update(bytes).digest("hex") !== expectedSha256) {
      throw new Error("Browser scenario binding file SHA-256 does not match the Harness binding.");
    }
    const parsed = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    if (
      !sameKeys(parsed, TOP_LEVEL_KEYS)
      || parsed.schema_version !== BINDING_SCHEMA
      || parsed.evidence_profile !== EVIDENCE_PROFILE
      || parsed.scenario_count !== SCENARIO_IDS.length
      || !Array.isArray(parsed.scenarios)
      || parsed.scenarios.length !== SCENARIO_IDS.length
    ) {
      throw new Error("Browser scenario binding envelope is invalid.");
    }
    const observed = new Set<string>();
    const bindings = parsed.scenarios.map((candidate): ScenarioBrowserBinding => {
      if (!isRecord(candidate) || !sameKeys(candidate, ITEM_KEYS)) {
        throw new Error("Browser scenario binding item has an unexpected member.");
      }
      const scenarioId = candidate.scenario_id;
      const caseId = candidate.case_id;
      const reviewRunId = candidate.review_run_id;
      const manifestSha256 = candidate.manifest_sha256;
      const resultSha256 = candidate.result_sha256;
      const externalReference = candidate.external_reference;
      if (
        typeof scenarioId !== "string"
        || !SCENARIO_IDS.includes(scenarioId as typeof SCENARIO_IDS[number])
        || observed.has(scenarioId)
        || typeof caseId !== "string"
        || !SAFE_ID_PATTERN.test(caseId)
        || typeof reviewRunId !== "string"
        || !SAFE_ID_PATTERN.test(reviewRunId)
        || typeof manifestSha256 !== "string"
        || !SHA256_PATTERN.test(manifestSha256)
        || typeof resultSha256 !== "string"
        || !SHA256_PATTERN.test(resultSha256)
        || typeof externalReference !== "string"
        || externalReference !== `UAT2:${scenarioId}:EVAL:${manifestSha256}`
      ) {
        throw new Error("Browser scenario binding identity is invalid.");
      }
      observed.add(scenarioId);
      return {
        scenario_id: scenarioId as typeof SCENARIO_IDS[number],
        case_id: caseId,
        review_run_id: reviewRunId,
        external_reference: externalReference,
        manifest_sha256: manifestSha256,
        result_sha256: resultSha256,
      };
    });
    if (SCENARIO_IDS.some((scenarioId) => !observed.has(scenarioId))) {
      throw new Error("Browser scenario binding set is incomplete.");
    }
    return [...bindings].sort(
      (left, right) => SCENARIO_IDS.indexOf(left.scenario_id) - SCENARIO_IDS.indexOf(right.scenario_id),
    );
  } finally {
    bytes.fill(0);
  }
}

export function scenarioBindingsFromWorkerEnvironment(): ScenarioBrowserBinding[] {
  const raw = process.env.CUSTOMS_E2E_VALIDATED_SCENARIO_BINDINGS;
  if (!raw) throw new Error("Browser scenario bindings were not validated by globalSetup.");
  const value = JSON.parse(raw) as ScenarioBrowserBinding[];
  if (
    !Array.isArray(value)
    || value.length !== SCENARIO_IDS.length
    || value.some((item, index) => (
      item.scenario_id !== SCENARIO_IDS[index]
      || item.external_reference !== `UAT2:${item.scenario_id}:EVAL:${item.manifest_sha256}`
      || !SHA256_PATTERN.test(item.result_sha256)
    ))
  ) {
    throw new Error("Validated Browser scenario bindings changed before the test worker started.");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const observed = Object.keys(value).sort();
  return observed.length === expected.length
    && observed.every((item, index) => item === expected[index]);
}
