import {
  LOCAL_UAT_EVIDENCE_PROFILES,
  UAT_SCENARIOS,
  localUatExpectedSemanticsSha256,
  localUatInputManifestSha256,
  localUatScenarioExternalReference,
  localUatScenarioInputManifest,
  localUatScenarioManifestSha256,
  localUatScenarioManifestV2,
  localUatScenarioSupportsProfile,
  localUatScenarioVariant,
} from "../src/uat/scenarios.ts";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const arguments_ = process.argv.slice(2);
const requestedProfile = readProfile(arguments_);
const scenarios = UAT_SCENARIOS
  .filter((scenario) => localUatScenarioSupportsProfile(scenario, requestedProfile))
  .map((scenario) => {
    const variant = localUatScenarioVariant(scenario, requestedProfile);
    const inputManifest = localUatScenarioInputManifest(scenario, requestedProfile);
    const manifest = localUatScenarioManifestV2(scenario, requestedProfile);
    return {
      scenario_id: scenario.scenario_id,
      evidence_profile: requestedProfile,
      category: scenario.category,
      title: variant.title,
      description: variant.description,
      diagnostic_observation: variant.diagnostic_observation,
      documents: variant.documents,
      supporting_document: variant.supporting_document ?? null,
      requires_approver: variant.requires_approver === true,
      expected: variant.expected,
      production_blocked_reason: variant.production_blocked_reason ?? null,
      manifest_v2: {
        ...manifest,
        input_manifest: inputManifest,
        input_manifest_sha256: localUatInputManifestSha256(inputManifest),
        expected_semantics_sha256: localUatExpectedSemanticsSha256(
          scenario,
          requestedProfile,
        ),
        manifest_sha256: localUatScenarioManifestSha256(manifest),
        case_external_reference: localUatScenarioExternalReference(
          scenario,
          requestedProfile,
        ),
      },
    };
  });

if (requestedProfile === "preserved-3law-v3-scenario-eval" && scenarios.length !== 9) {
  throw new Error(`scenario-eval export requires exactly 9 variants; observed ${scenarios.length}`);
}

const serialized = `${JSON.stringify({
  schema_version: "frontend-uat-scenario-export/v2",
  test_only: true,
  contains_synthetic_document_text: true,
  contains_credentials: false,
  evidence_profile: requestedProfile,
  scenario_count: scenarios.length,
  scenarios,
}, null, 2)}\n`;
const output = readOutput(arguments_);
if (output === null) {
  process.stdout.write(serialized);
} else {
  await writeFile(output, serialized, { encoding: "utf8", flag: "w" });
}

function readProfile(args) {
  const profileFlag = args.findIndex((value) => value === "--profile");
  const candidate = profileFlag === -1
    ? "preserved-3law-v3-scenario-eval"
    : args[profileFlag + 1];
  if (!LOCAL_UAT_EVIDENCE_PROFILES.includes(candidate)) {
    throw new Error(
      `--profile must be one of ${LOCAL_UAT_EVIDENCE_PROFILES.join(", ")}`,
    );
  }
  return candidate;
}

function readOutput(args) {
  const outputFlag = args.findIndex((value) => value === "--output");
  if (outputFlag === -1) return null;
  const candidate = args[outputFlag + 1];
  const expected = resolve("dist", "uat-scenario-export.json");
  if (candidate === undefined || resolve(candidate) !== expected) {
    throw new Error("--output is restricted to dist/uat-scenario-export.json");
  }
  return expected;
}
