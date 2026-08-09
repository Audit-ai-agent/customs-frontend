import { stat, writeFile } from "node:fs/promises";
import * as path from "node:path";
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
    this.outputFile = validateSafeFailureFile(options.outputFile);
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

export function validateSafeFailureFile(value: string | undefined): string | null {
  if (!value) return null;
  const pathApi = pathFor(value);
  if (!pathApi.isAbsolute(value)) return null;

  const target = pathApi.resolve(value);
  if (pathApi.basename(target) !== FAILURE_FILE_NAME) return null;

  const marker = `${pathApi.sep}_local${pathApi.sep}state${pathApi.sep}e2e-runs${pathApi.sep}`;
  const markerIndex = target.indexOf(marker);
  if (markerIndex < 0) return null;

  const root = target.slice(0, markerIndex + marker.length - 1);
  const relation = pathApi.relative(root, target);
  if (
    !relation
    || relation === ".."
    || relation.startsWith(`..${pathApi.sep}`)
    || pathApi.basename(relation) !== FAILURE_FILE_NAME
    || pathApi.dirname(relation) === "."
  ) {
    return null;
  }
  return target;
}

export async function writeSafeFailureReport(
  outputFile: string,
  report: FunctionalUatSafeFailureReport,
): Promise<void> {
  const parent = pathFor(outputFile).dirname(outputFile);
  try {
    if (!(await stat(parent)).isDirectory()) return;
    await writeFile(outputFile, JSON.stringify(report), {
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

/** Choose the matching path rules so Windows-shaped inputs stay testable on non-Windows CI. */
function pathFor(value: string): typeof path {
  return path.isAbsolute(value) || !path.win32.isAbsolute(value) ? path : path.win32;
}
