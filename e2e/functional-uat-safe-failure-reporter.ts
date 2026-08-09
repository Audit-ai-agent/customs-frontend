import { lstat, realpath, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ReporterDescription } from "@playwright/test";
import type {
  FullResult,
  Location,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

export const CUSTOMS_FUNCTIONAL_UAT_SAFE_FAILURE_FILE =
  "CUSTOMS_FUNCTIONAL_UAT_SAFE_FAILURE_FILE" as const;
export const FUNCTIONAL_UAT_SAFE_FAILURE_SCHEMA = "functional-uat-browser-failure/v1" as const;

const FAILURE_FILE_NAME = "failure.json";
const FUNCTIONAL_UAT_BROWSER_SPEC_FILE = "functional-uat-browser.spec.ts";
const REPORTER_MODULE = "./e2e/functional-uat-safe-failure-reporter.ts";
const REPORTER_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIRECTORY = path.resolve(REPORTER_DIRECTORY, "..", "..");

/** The reporter module, not an environment value, establishes this trust boundary. */
export const FUNCTIONAL_UAT_SAFE_FAILURE_ROOT = path.join(
  WORKSPACE_DIRECTORY,
  "_local",
  "state",
  "e2e-runs",
);

export interface FunctionalUatSafeFailureLocation {
  readonly file: typeof FUNCTIONAL_UAT_BROWSER_SPEC_FILE;
  readonly line: number;
  readonly column: number;
}

/** This is deliberately the entire cross-process failure payload. */
export interface FunctionalUatSafeFailureReport {
  readonly schema_version: typeof FUNCTIONAL_UAT_SAFE_FAILURE_SCHEMA;
  readonly status: "failed";
  readonly failure_count: number;
  readonly first_failure: FunctionalUatSafeFailureLocation | null;
}

export interface FunctionalUatSafeFailureReporterOptions {
  readonly outputFile?: string;
}

/** Keep the normal dot output and add the private reporter only when requested by the Backend wrapper. */
export function functionalUatReporterConfiguration(
  safeFailureFile: string | undefined = process.env[CUSTOMS_FUNCTIONAL_UAT_SAFE_FAILURE_FILE],
): ReporterDescription[] {
  if (!safeFailureFile) return [["dot"]];
  return [
    ["dot"],
    [REPORTER_MODULE, { outputFile: safeFailureFile }],
  ];
}

/**
 * A deliberately narrow reporter for the Browser Functional-UAT wrapper.
 * It never serializes Playwright titles, errors, stacks, attachments, page
 * data, or network data.  The wrapper owns the destination directory.
 */
export default class FunctionalUatSafeFailureReporter implements Reporter {
  private readonly outputFile: string | null;
  private failureCount = 0;
  private firstFailure: FunctionalUatSafeFailureLocation | null = null;

  public constructor(options: FunctionalUatSafeFailureReporterOptions = {}) {
    this.outputFile = validateSafeFailureFileSyntax(options.outputFile);
  }

  public onTestEnd(test: TestCase, result: TestResult): void {
    if (!isFailingStatus(result.status)) return;
    this.failureCount += 1;
    if (this.firstFailure === null) {
      this.firstFailure = safeFailureLocation(test, result);
    }
  }

  public async onEnd(result: FullResult): Promise<void> {
    if (result.status === "passed" || this.outputFile === null) return;

    const report: FunctionalUatSafeFailureReport = {
      schema_version: FUNCTIONAL_UAT_SAFE_FAILURE_SCHEMA,
      status: "failed",
      failure_count: Math.max(1, this.failureCount),
      first_failure: this.firstFailure,
    };
    await writeSafeFailureReport(this.outputFile, report);
  }
}

export function safeFailureLocation(
  test: Pick<TestCase, "location">,
  result: Pick<TestResult, "errors">,
): FunctionalUatSafeFailureLocation | null {
  for (const error of result.errors) {
    const location = safeLocation(error.location);
    if (location !== null) return location;
  }
  return safeLocation(test.location);
}

/**
 * Validate the exact workspace-local destination and its existing directory
 * ancestry immediately before any file write.
 */
export async function validateSafeFailureFile(value: string | undefined): Promise<string | null> {
  const target = validateSafeFailureFileSyntax(value);
  if (target === null) return null;

  const runDirectory = path.dirname(target);
  try {
    const [trustedRootStat, runDirectoryStat, resolvedTrustedRoot, resolvedRunDirectory] = await Promise.all([
      lstat(FUNCTIONAL_UAT_SAFE_FAILURE_ROOT),
      lstat(runDirectory),
      realpath(FUNCTIONAL_UAT_SAFE_FAILURE_ROOT),
      realpath(runDirectory),
    ]);
    if (
      !trustedRootStat.isDirectory()
      || trustedRootStat.isSymbolicLink()
      || !runDirectoryStat.isDirectory()
      || runDirectoryStat.isSymbolicLink()
      || !sameNativePath(resolvedTrustedRoot, FUNCTIONAL_UAT_SAFE_FAILURE_ROOT)
      || !sameNativePath(resolvedRunDirectory, runDirectory)
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return target;
}

function validateSafeFailureFileSyntax(value: string | undefined): string | null {
  if (!value) return null;
  if (!path.isAbsolute(value)) return null;

  const target = path.resolve(value);
  if (path.basename(target) !== FAILURE_FILE_NAME) return null;

  const relation = path.relative(FUNCTIONAL_UAT_SAFE_FAILURE_ROOT, target);
  const segments = relation.split(path.sep);
  if (
    !relation
    || relation === ".."
    || relation.startsWith(`..${path.sep}`)
    || segments.length !== 2
    || !segments[0]
    || segments[0] === "."
    || segments[0] === ".."
    || segments[1] !== FAILURE_FILE_NAME
  ) {
    return null;
  }
  return target;
}

export async function writeSafeFailureReport(
  outputFile: string,
  report: FunctionalUatSafeFailureReport,
): Promise<void> {
  const safeOutputFile = await validateSafeFailureFile(outputFile);
  if (safeOutputFile === null || !isSafeFailureReport(report)) return;
  try {
    await writeFile(safeOutputFile, JSON.stringify(report), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  } catch {
    // The original Playwright result remains authoritative if the local safe
    // report cannot be created.  Never surface an operating-system error.
  }
}

function safeLocation(location: Location | undefined): FunctionalUatSafeFailureLocation | null {
  if (
    location === undefined
    || safeBasename(location.file) !== FUNCTIONAL_UAT_BROWSER_SPEC_FILE
    || !isPositiveInteger(location.line)
    || !isPositiveInteger(location.column)
  ) {
    return null;
  }
  return {
    file: FUNCTIONAL_UAT_BROWSER_SPEC_FILE,
    line: location.line,
    column: location.column,
  };
}

function safeBasename(value: string): string {
  const posix = path.basename(value);
  return posix === value ? path.win32.basename(value) : posix;
}

function isFailingStatus(status: TestResult["status"]): boolean {
  return status === "failed" || status === "timedOut" || status === "interrupted";
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isSafeFailureReport(value: unknown): value is FunctionalUatSafeFailureReport {
  if (!isRecordWithExactKeys(value, ["schema_version", "status", "failure_count", "first_failure"])) {
    return false;
  }
  if (
    value.schema_version !== FUNCTIONAL_UAT_SAFE_FAILURE_SCHEMA
    || value.status !== "failed"
    || typeof value.failure_count !== "number"
    || !isPositiveInteger(value.failure_count)
  ) {
    return false;
  }
  if (value.first_failure === null) return true;
  return (
    isRecordWithExactKeys(value.first_failure, ["file", "line", "column"])
    && value.first_failure.file === FUNCTIONAL_UAT_BROWSER_SPEC_FILE
    && typeof value.first_failure.line === "number"
    && isPositiveInteger(value.first_failure.line)
    && typeof value.first_failure.column === "number"
    && isPositiveInteger(value.first_failure.column)
  );
}

function isRecordWithExactKeys(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function sameNativePath(left: string, right: string): boolean {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}
