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
const apiClient = await readFile(new URL("../src/api/v1/client.ts", import.meta.url), "utf8");
if (apiClient.includes("/api/v2") || !apiClient.includes('const API_BASE = "/api/v1"')) {
  violations.push("Browser client must use Backend API v1 only");
}

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
for (const forbidden of ["react", "react-dom", "react-router", "@playwright/test", "@vitejs/plugin-react"]) {
  if (packageJson.dependencies?.[forbidden] || packageJson.devDependencies?.[forbidden]) {
    violations.push("unused dependency remains: " + forbidden);
  }
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

const dockerfile = await readFile(new URL("../deploy/uat/Dockerfile", import.meta.url), "utf8");
if (!dockerfile.includes("npm run build:functional-uat")) {
  violations.push("functional-UAT static image must use the explicit functional profile build");
}
if (dockerfile.includes("scenario") || dockerfile.includes("CUSTOMS_UAT_ADAPTIVE")) {
  violations.push("functional-UAT static image must not include scenario or legacy-evaluator controls");
}
if (dockerfile.includes("OIDC_BACKEND_ORIGIN")) {
  violations.push("functional-UAT static image must not retain the unused OIDC proxy origin");
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
