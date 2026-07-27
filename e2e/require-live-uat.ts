import type { FullConfig } from "@playwright/test";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { loadExactScenarioBindings } from "./scenario-bindings";

export default async function requireLiveUat(_config: FullConfig): Promise<void> {
  if (process.env.CUSTOMS_E2E_LIVE !== "true") {
    throw new Error(
      "Browser E2E requires a running loopback UAT stack and explicit CUSTOMS_E2E_LIVE=true.",
    );
  }
  const baseUrl = new URL(process.env.CUSTOMS_UAT_BASE_URL ?? "http://127.0.0.1:18088");
  if (
    baseUrl.protocol !== "http:"
    || baseUrl.hostname !== "127.0.0.1"
    || baseUrl.username !== ""
    || baseUrl.password !== ""
    || baseUrl.pathname !== "/"
    || baseUrl.search !== ""
    || baseUrl.hash !== ""
  ) {
    throw new Error("Browser E2E requires a credential-free literal loopback UAT origin.");
  }
  const sourceRoot = resolve(process.cwd(), "src");
  const forbidden = "dangerouslySetInnerHTML";
  const sourceFiles = await walk(sourceRoot);
  const violations: string[] = [];
  for (const file of sourceFiles) {
    if (![".ts", ".tsx"].includes(extname(file))) continue;
    if ((await readFile(file, "utf8")).includes(forbidden)) violations.push(file);
  }
  if (violations.length > 0) {
    throw new Error(
      `Browser E2E refuses an unsafe HTML rendering escape hatch: ${violations.join(", ")}`,
    );
  }
  // `--list` only discovers the immutable project inventory and never opens a
  // Browser or executes a test body. Every executable E2E run still requires
  // the exact current Harness binding below.
  if (!process.argv.includes("--list")) {
    const bindings = await loadExactScenarioBindings();
    process.env.CUSTOMS_E2E_VALIDATED_SCENARIO_BINDINGS = JSON.stringify(bindings);
  }
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => (
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]
  )));
  return nested.flat();
}
