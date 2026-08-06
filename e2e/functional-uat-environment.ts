import { rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export const FUNCTIONAL_UAT_BROWSER_CHECKS = [
  "reviewer_login",
  "case_created",
  "document_registered",
  "review_completed",
  "analysis_displayed",
  "evidence_displayed",
  "citation_navigation",
  "assistant_conversation",
  "finding_decision",
  "correction_proposed",
  "approver_login",
  "correction_approved",
  "child_review_completed",
  "document_replaced",
  "replacement_review_completed",
  "backend_only_network",
] as const;

export type FunctionalUatBrowserCheck = (typeof FUNCTIONAL_UAT_BROWSER_CHECKS)[number];

export interface FunctionalUatBrowserEnvironment {
  readonly baseUrl: "http://127.0.0.1:5173";
  readonly reviewerUsername: string;
  readonly reviewerPassword: string;
  readonly approverUsername: string;
  readonly approverPassword: string;
  readonly receiptPath: string;
  readonly transientOutputPath: string;
}

export interface FunctionalUatBrowserReceipt {
  readonly schema_version: "functional-uat-browser-e2e/v1";
  readonly status: "passed";
  readonly profile: "functional-uat";
  readonly base_url: "http://127.0.0.1:5173";
  readonly checks: readonly FunctionalUatBrowserCheck[];
  readonly review_run_ids: readonly string[];
  readonly browser_api_origins: readonly ["http://127.0.0.1:5173"];
}

const REQUIRED_ENVIRONMENT = [
  "CUSTOMS_FUNCTIONAL_UAT_BROWSER_E2E",
  "CUSTOMS_FUNCTIONAL_UAT_BROWSER_BASE_URL",
  "CUSTOMS_FUNCTIONAL_UAT_BROWSER_REVIEWER_USERNAME",
  "CUSTOMS_FUNCTIONAL_UAT_BROWSER_REVIEWER_PASSWORD",
  "CUSTOMS_FUNCTIONAL_UAT_BROWSER_APPROVER_USERNAME",
  "CUSTOMS_FUNCTIONAL_UAT_BROWSER_APPROVER_PASSWORD",
  "CUSTOMS_FUNCTIONAL_UAT_BROWSER_RECEIPT_PATH",
] as const;

const RUN_ID = /^run_[0-9a-f]{32}$/u;
const RECEIPT_NAME = "receipt.json";
const TRANSIENT_OUTPUT_NAME = ".playwright-transient";

/**
 * Read only the narrow values the Backend wrapper injects into the local
 * Playwright child. No profile file, token, or credential is read by this
 * repository directly.
 */
export function loadFunctionalUatBrowserEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): FunctionalUatBrowserEnvironment {
  for (const name of REQUIRED_ENVIRONMENT) {
    if (!environment[name]) throw new Error("functional_uat_browser_environment_incomplete");
  }
  if (environment.CUSTOMS_FUNCTIONAL_UAT_BROWSER_E2E !== "1") {
    throw new Error("functional_uat_browser_execution_not_explicitly_enabled");
  }
  if (environment.CUSTOMS_FUNCTIONAL_UAT_BROWSER_BASE_URL !== "http://127.0.0.1:5173") {
    throw new Error("functional_uat_browser_base_url_must_be_literal_loopback");
  }

  const receiptPath = validateReceiptPath(environment.CUSTOMS_FUNCTIONAL_UAT_BROWSER_RECEIPT_PATH as string);
  return {
    baseUrl: "http://127.0.0.1:5173",
    reviewerUsername: environment.CUSTOMS_FUNCTIONAL_UAT_BROWSER_REVIEWER_USERNAME as string,
    reviewerPassword: environment.CUSTOMS_FUNCTIONAL_UAT_BROWSER_REVIEWER_PASSWORD as string,
    approverUsername: environment.CUSTOMS_FUNCTIONAL_UAT_BROWSER_APPROVER_USERNAME as string,
    approverPassword: environment.CUSTOMS_FUNCTIONAL_UAT_BROWSER_APPROVER_PASSWORD as string,
    receiptPath,
    transientOutputPath: join(dirname(receiptPath), TRANSIENT_OUTPUT_NAME),
  };
}

export function validateFunctionalUatBrowserReceipt(receipt: FunctionalUatBrowserReceipt): void {
  if (
    receipt.schema_version !== "functional-uat-browser-e2e/v1"
    || receipt.status !== "passed"
    || receipt.profile !== "functional-uat"
    || receipt.base_url !== "http://127.0.0.1:5173"
  ) {
    throw new Error("functional_uat_browser_receipt_identity_invalid");
  }
  if (
    receipt.browser_api_origins.length !== 1
    || receipt.browser_api_origins[0] !== "http://127.0.0.1:5173"
  ) {
    throw new Error("functional_uat_browser_receipt_api_origin_invalid");
  }
  const allowed = new Set<string>(FUNCTIONAL_UAT_BROWSER_CHECKS);
  if (
    receipt.checks.length !== FUNCTIONAL_UAT_BROWSER_CHECKS.length
    || new Set(receipt.checks).size !== receipt.checks.length
    || receipt.checks.some((check) => !allowed.has(check))
  ) {
    throw new Error("functional_uat_browser_receipt_checks_invalid");
  }
  if (
    receipt.review_run_ids.length < 3
    || new Set(receipt.review_run_ids).size !== receipt.review_run_ids.length
    || receipt.review_run_ids.some((runId) => !RUN_ID.test(runId))
  ) {
    throw new Error("functional_uat_browser_receipt_run_ids_invalid");
  }
}

export async function writeFunctionalUatBrowserReceipt(
  environment: FunctionalUatBrowserEnvironment,
  receipt: FunctionalUatBrowserReceipt,
): Promise<void> {
  validateFunctionalUatBrowserReceipt(receipt);
  const parent = dirname(environment.receiptPath);
  try {
    if (!(await stat(parent)).isDirectory()) throw new Error("functional_uat_browser_receipt_parent_invalid");
  } catch (error) {
    if (error instanceof Error && error.message === "functional_uat_browser_receipt_parent_invalid") throw error;
    throw new Error("functional_uat_browser_receipt_parent_unavailable");
  }
  await writeFile(environment.receiptPath, `${JSON.stringify(receipt)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
}

/** The validated directory is intentionally transient and contains no capture artifacts. */
export async function removeFunctionalUatBrowserTransientOutput(
  environment: FunctionalUatBrowserEnvironment,
): Promise<void> {
  const expected = join(dirname(environment.receiptPath), TRANSIENT_OUTPUT_NAME);
  if (environment.transientOutputPath !== expected || basename(expected) !== TRANSIENT_OUTPUT_NAME) {
    throw new Error("functional_uat_browser_transient_target_invalid");
  }
  await rm(expected, { recursive: true, force: true, maxRetries: 1, retryDelay: 100 });
}

function validateReceiptPath(value: string): string {
  if (!isAbsolute(value)) throw new Error("functional_uat_browser_receipt_path_must_be_absolute");
  const target = resolve(value);
  if (basename(target) !== RECEIPT_NAME) throw new Error("functional_uat_browser_receipt_name_invalid");
  const marker = `${sep}_local${sep}state${sep}e2e-runs${sep}`;
  if (!target.includes(marker)) throw new Error("functional_uat_browser_receipt_path_outside_local_state");
  const root = target.slice(0, target.indexOf(marker) + marker.length - 1);
  const relation = relative(root, target);
  if (!relation || relation.startsWith(`..${sep}`) || relation === "..") {
    throw new Error("functional_uat_browser_receipt_path_outside_local_state");
  }
  return target;
}
