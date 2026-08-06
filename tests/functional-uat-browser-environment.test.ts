import { describe, expect, it } from "vitest";
import {
  FUNCTIONAL_UAT_BROWSER_CHECKS,
  loadFunctionalUatBrowserEnvironment,
  validateFunctionalUatBrowserReceipt,
} from "../e2e/functional-uat-environment";

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    CUSTOMS_FUNCTIONAL_UAT_BROWSER_E2E: "1",
    CUSTOMS_FUNCTIONAL_UAT_BROWSER_BASE_URL: "http://127.0.0.1:5173",
    CUSTOMS_FUNCTIONAL_UAT_BROWSER_REVIEWER_USERNAME: "reviewer",
    CUSTOMS_FUNCTIONAL_UAT_BROWSER_REVIEWER_PASSWORD: "not-a-secret-fixture",
    CUSTOMS_FUNCTIONAL_UAT_BROWSER_APPROVER_USERNAME: "approver",
    CUSTOMS_FUNCTIONAL_UAT_BROWSER_APPROVER_PASSWORD: "not-a-secret-fixture",
    CUSTOMS_FUNCTIONAL_UAT_BROWSER_RECEIPT_PATH: "C:\\workspace\\_local\\state\\e2e-runs\\test-run\\receipt.json",
    ...overrides,
  };
}

describe("functional UAT browser environment", () => {
  it("accepts the narrow wrapper contract and derives only a transient local output path", () => {
    const loaded = loadFunctionalUatBrowserEnvironment(environment());
    expect(loaded.baseUrl).toBe("http://127.0.0.1:5173");
    expect(loaded.transientOutputPath).toContain("_local\\state\\e2e-runs\\test-run\\.playwright-transient");
  });

  it("rejects non-loopback URLs and receipt paths outside local state", () => {
    expect(() => loadFunctionalUatBrowserEnvironment(environment({
      CUSTOMS_FUNCTIONAL_UAT_BROWSER_BASE_URL: "http://localhost:5173",
    }))).toThrow("functional_uat_browser_base_url_must_be_literal_loopback");
    expect(() => loadFunctionalUatBrowserEnvironment(environment({
      CUSTOMS_FUNCTIONAL_UAT_BROWSER_RECEIPT_PATH: "C:\\workspace\\receipt.json",
    }))).toThrow("functional_uat_browser_receipt_path_outside_local_state");
  });

  it("accepts only the compact safe receipt shape", () => {
    expect(() => validateFunctionalUatBrowserReceipt({
      schema_version: "functional-uat-browser-e2e/v1",
      status: "passed",
      profile: "functional-uat",
      base_url: "http://127.0.0.1:5173",
      checks: FUNCTIONAL_UAT_BROWSER_CHECKS,
      review_run_ids: [
        "run_0123456789abcdef0123456789abcdef",
        "run_11111111111111111111111111111111",
        "run_22222222222222222222222222222222",
      ],
      browser_api_origins: ["http://127.0.0.1:5173"],
    })).not.toThrow();
  });
});
