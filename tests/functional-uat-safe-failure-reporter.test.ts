import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import * as path from "node:path";
import { tmpdir } from "node:os";
import type { FullResult, TestCase, TestResult } from "@playwright/test/reporter";
import { afterEach, describe, expect, it } from "vitest";
import FunctionalUatSafeFailureReporter, {
  FUNCTIONAL_UAT_SAFE_FAILURE_SCHEMA,
  functionalUatReporterConfiguration,
  safeFailureLocation,
  validateSafeFailureFile,
} from "../e2e/functional-uat-safe-failure-reporter";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })));
});

async function safeFailureFile(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "functional-uat-safe-reporter-"));
  temporaryRoots.push(root);
  const runDirectory = path.join(root, "_local", "state", "e2e-runs", "run-1");
  await mkdir(runDirectory, { recursive: true });
  return path.join(runDirectory, "failure.json");
}

function testCase(location: unknown): TestCase {
  return { location } as TestCase;
}

function testResult(status: TestResult["status"], errors: unknown[] = []): TestResult {
  return { status, errors } as TestResult;
}

describe("Functional-UAT safe failure reporter", () => {
  it("uses only dot output unless the Backend wrapper supplied a safe failure destination", () => {
    expect(functionalUatReporterConfiguration(undefined)).toEqual([["dot"]]);
    expect(functionalUatReporterConfiguration("C:\\workspace\\_local\\state\\e2e-runs\\run-1\\failure.json"))
      .toEqual([
        ["dot"],
        ["./e2e/functional-uat-safe-failure-reporter.ts", {
          outputFile: "C:\\workspace\\_local\\state\\e2e-runs\\run-1\\failure.json",
        }],
      ]);
  });

  it("reduces a safe first source location to a basename and positive coordinates", () => {
    expect(safeFailureLocation(
      testCase({
        file: "C:\\workspace\\customs-frontend\\e2e\\functional-uat-browser.spec.ts",
        line: 74,
        column: 9,
      }),
      testResult("failed", [{
        message: "sensitive assertion content must never be read into the report",
        location: { file: "C:\\private\\document.txt", line: 1, column: 1 },
      }]),
    )).toEqual({ file: "functional-uat-browser.spec.ts", line: 74, column: 9 });

    expect(safeFailureLocation(
      testCase({ file: "C:\\private\\document.txt", line: 74, column: 9 }),
      testResult("failed"),
    )).toBeNull();
  });

  it("writes the exact compact failure schema without a test title, error, stack, or absolute path", async () => {
    const outputFile = await safeFailureFile();
    const reporter = new FunctionalUatSafeFailureReporter({ outputFile });

    reporter.onTestEnd(
      testCase({
        file: "C:\\workspace\\customs-frontend\\e2e\\functional-uat-browser.spec.ts",
        line: 74,
        column: 9,
      }),
      testResult("failed", [{
        message: "raw document content must not leave Playwright",
        stack: "C:\\workspace\\customs-frontend\\e2e\\functional-uat-browser.spec.ts:74:9",
        location: { file: "C:\\private\\invoice.pdf", line: 1, column: 1 },
      }]),
    );
    reporter.onTestEnd(
      testCase({ file: "C:\\private\\invoice.pdf", line: 1, column: 1 }),
      testResult("timedOut"),
    );

    await reporter.onEnd({ status: "failed" } as FullResult);

    const raw = await readFile(outputFile, "utf8");
    expect(JSON.parse(raw)).toEqual({
      schema_version: FUNCTIONAL_UAT_SAFE_FAILURE_SCHEMA,
      status: "failed",
      failure_count: 2,
      first_failure: { file: "functional-uat-browser.spec.ts", line: 74, column: 9 },
    });
    expect(raw).not.toContain("raw document content");
    expect(raw).not.toContain("C:\\workspace");
    expect(raw).not.toContain("invoice.pdf");
    expect(raw).not.toContain("stack");
  });

  it("uses a null first_failure when there is no whitelisted positive source location", async () => {
    const outputFile = await safeFailureFile();
    const reporter = new FunctionalUatSafeFailureReporter({ outputFile });

    reporter.onTestEnd(
      testCase({ file: "C:\\private\\invoice.pdf", line: 0, column: 0 }),
      testResult("failed"),
    );
    await reporter.onEnd({ status: "failed" } as FullResult);

    expect(JSON.parse(await readFile(outputFile, "utf8"))).toEqual({
      schema_version: FUNCTIONAL_UAT_SAFE_FAILURE_SCHEMA,
      status: "failed",
      failure_count: 1,
      first_failure: null,
    });
  });

  it("does not write a report after a passing run and rejects destinations outside local state", async () => {
    const outputFile = await safeFailureFile();
    const reporter = new FunctionalUatSafeFailureReporter({ outputFile });
    reporter.onTestEnd(
      testCase({ file: "functional-uat-browser.spec.ts", line: 1, column: 1 }),
      testResult("failed"),
    );

    await reporter.onEnd({ status: "passed" } as FullResult);
    await expect(access(outputFile)).rejects.toThrow();
    expect(validateSafeFailureFile("C:\\workspace\\failure.json")).toBeNull();
    expect(validateSafeFailureFile(outputFile)).toBe(outputFile);
  });
});
