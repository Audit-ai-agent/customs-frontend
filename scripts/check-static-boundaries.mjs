import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const source = new URL("../src/", import.meta.url);
const files = await walk(source);
const violations = [];

for (const file of files.filter((name) => [".ts", ".css"].includes(extname(name)))) {
  const content = await readFile(file, "utf8");
  const label = relative(rootPath, file).replaceAll("\\", "/");
  for (const [pattern, reason] of [
    [/\.innerHTML\s*=/u, "unsafe innerHTML assignment"],
    [/\blocalStorage\b/u, "persistent browser storage"],
    [/["'\x60]\/(?:internal\/agent|internal\/rag|evidence)(?:\/|["'\x60])/iu, "direct Agent/Data API reference"],
    [/(?:qdrant|neo4j|postgres(?:ql)?):\/\//iu, "direct data-store connection"],
    [/fetch\(\s*["'\x60]https?:/iu, "absolute browser network call"],
  ]) {
    if (pattern.test(content)) violations.push(label + ": " + reason);
  }
}

const main = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
if (!main.includes('import("./workbench")')) {
  violations.push("main entry must load the API-v1 lightweight workbench");
}
if (main.includes("/api/v2")) violations.push("main entry must not use the retired v2 experience API");
const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
if (viteConfig.includes("/api/v2")) violations.push("Vite must not proxy the retired v2 experience API");
const playwrightConfig = await readFile(new URL("../playwright.functional-uat.config.ts", import.meta.url), "utf8");
for (const required of [
  'channel: "msedge"',
  'headless: true',
  'screenshot: "off"',
  'video: "off"',
  'trace: "off"',
  "workers: 1",
]) {
  if (!playwrightConfig.includes(required)) {
    violations.push("Functional-UAT Browser config must remain local, single-worker, and capture-free");
    break;
  }
}
const browserE2e = await readFile(new URL("../e2e/functional-uat-browser.spec.ts", import.meta.url), "utf8");
for (const forbidden of [/\bpage\.request\b/u, /\brequest\.newContext\b/u, /\bAPIRequestContext\b/u, /\bfetch\s*\(/u]) {
  if (forbidden.test(browserE2e)) {
    violations.push("Functional-UAT Browser spec must use the visible Browser UI only");
    break;
  }
}
const apiClient = await readFile(new URL("../src/api/v1/client.ts", import.meta.url), "utf8");
if (apiClient.includes("/api/v2") || !apiClient.includes('const API_BASE = "/api/v1"')) {
  violations.push("Browser client must use Backend API v1 only");
}

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
for (const forbidden of ["react", "react-dom", "react-router", "@vitejs/plugin-react"]) {
  if (packageJson.dependencies?.[forbidden] || packageJson.devDependencies?.[forbidden]) {
    violations.push("unused dependency remains: " + forbidden);
  }
}
if (packageJson.devDependencies?.["@playwright/test"] !== "1.62.1") {
  violations.push("local Functional-UAT browser runner must pin @playwright/test 1.62.1 exactly");
}
if (packageJson.scripts?.["functional-uat:browser"] !== "playwright test --config playwright.functional-uat.config.ts") {
  violations.push("Functional-UAT browser command must remain local-only and explicit");
}
for (const script of ["build:uat", "uat:export:scenarios", "uat:evaluate:scenario", "test:e2e", "test:coverage"]) {
  if (packageJson.scripts?.[script]) violations.push("retired script remains: " + script);
}
for (const retired of ["scripts/run-gitleaks.ps1", "scripts/check-enhanced-bundle.mjs"]) {
  try {
    await readFile(new URL("../" + retired, import.meta.url), "utf8");
    violations.push("retired script remains: " + retired);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
if (packageJson.scripts?.["check:quick"] !== "npm run lint && npm run typecheck && npm run test") {
  violations.push("check:quick must be lint + typecheck + unit test only");
}
if (packageJson.scripts?.["check:contract"] !== "npm run contract:check") {
  violations.push("check:contract must remain the Backend API byte check");
}
if (!viteConfig.includes('exclude: ["node_modules/**", "dist/**", "e2e/**"]')) {
  violations.push("Vitest must exclude the explicit local Browser E2E path");
}

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log("Frontend boundary check passed (" + files.length + " source files).");

async function walk(directoryUrl) {
  const directory = fileURLToPath(directoryUrl);
  const entries = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(entries.map((entry) => (
    entry.isDirectory() ? walk(new URL(entry.name + "/", directoryUrl)) : [join(directory, entry.name)]
  )));
  return children.flat();
}
