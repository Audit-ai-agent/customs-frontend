import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const src = new URL("../src/", import.meta.url);
const rootPath = fileURLToPath(root);
const files = await walk(src);
const violations = [];
const legacyHumanizeAllowlist = new Set(["src/app.ts", "src/dom.ts"]);

for (const file of files.filter((name) => [".ts", ".tsx", ".css"].includes(extname(name)))) {
  const content = await readFile(file, "utf8");
  const label = relative(rootPath, file).replaceAll("\\", "/");
  for (const [pattern, message] of [
    [/\.innerHTML\s*=/g, "unsafe innerHTML assignment"],
    [/\blocalStorage\b/g, "persistent browser secret storage"],
    [/["'`]\/(?:internal\/agent|evidence)(?:\/|["'`])/gi, "direct Agent/Data boundary reference"],
    [/(?:qdrant|neo4j)(?:\+s)?:\/\/|(?:fetch|WebSocket)\s*\([^)]*(?:qdrant|neo4j)/gi, "direct Data-store network reference"],
    [/fetch\(\s*["'`]https?:/g, "direct absolute network call"],
    [/dangerouslySetInnerHTML/g, "unsafe HTML rendering escape hatch"],
  ]) {
    if (pattern.test(content)) violations.push(`${label}: ${message}`);
  }
  if (/\bhumanize\b/.test(content) && !legacyHumanizeAllowlist.has(label)) {
    violations.push(`${label}: legacy diagnostic humanize must not enter product or shared code`);
  }
}

const v2Client = await readFile(new URL("../src/api/v2/client.ts", import.meta.url), "utf8");
if (!v2Client.includes('const API_BASE = "/api/v2"')) {
  violations.push("Enhanced experience client must keep a literal /api/v2 Backend-only boundary");
}
const mainEntry = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
if (/from\s+["']\.\/app["']/.test(mainEntry)) {
  violations.push("Enhanced entry must not statically include the legacy developer workbench");
}
if (!mainEntry.includes('await import("./app")') || !mainEntry.includes('await import("./experience/bootstrap")')) {
  violations.push("Legacy and commercial workbenches must remain isolated dynamic entry chunks");
}
const experienceFiles = files.filter((name) => name.includes(`${join("src", "experience")}`) && [".ts", ".tsx"].includes(extname(name)));
for (const file of experienceFiles) {
  const content = await readFile(file, "utf8");
  const label = relative(rootPath, file).replaceAll("\\", "/");
  if (/\bhumanize\s*\(/.test(content)) violations.push(`${label}: user wording must use an exhaustive Korean catalog`);
  if (/dangerouslySetInnerHTML/.test(content)) violations.push(`${label}: enhanced experience must never render untrusted HTML`);
}
const legacyDom = await readFile(new URL("../src/dom.ts", import.meta.url), "utf8");
if (!legacyDom.includes("@deprecated Legacy diagnostic-workbench compatibility only.")) {
  violations.push("src/dom.ts humanize compatibility exception must remain explicitly deprecated and diagnostic-only");
}

const client = await readFile(new URL("../src/api/v1/client.ts", import.meta.url), "utf8");
if (!client.includes('const API_BASE = "/api/v1"')) violations.push("API client must keep a literal /api/v1 boundary");
if (client.includes("/revisions")) violations.push("Frontend must not bypass CorrectionProposal approval with direct revision execution");
if (client.includes("createDecision")) {
  violations.push("Frontend must use replay-idempotent typed RevisionProposal decisions, not direct Run decisions");
}
for (const requiredPath of ["/supporting-documents", "/revision-proposals", "/events/stream", "/reconciliation"]) {
  if (!client.includes(requiredPath)) violations.push(`required Backend-only product boundary is missing: ${requiredPath}`);
}
if (!client.includes("documents/${segment(documentId)}/content")) {
  violations.push("document text must use the bounded Backend content endpoint");
}
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
if (!html.includes("Content-Security-Policy")) violations.push("index.html must carry a development CSP");

const workflow = await readFile(new URL("../.github/workflows/repository-guard.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
if (packageJson.engines?.node !== ">=22.22.0 <23") violations.push("Node runtime must require supported Node 22.22+ only");
if (packageJson.packageManager !== "npm@10.9.8") violations.push("npm runtime must be pinned to exact 10.9.8");
if (packageJson.dependencies?.["react-router"] !== "8.3.0") {
  violations.push("commercial workbench must pin patched React Router 8.3.0; see DL-0008");
}
if (packageJson.dependencies?.["react-router-dom"] !== undefined) {
  violations.push("React Router DOM 7.18.1 is prohibited by the High-severity dependency gate");
}
const expectedScripts = {
  "check:quick": "npm run lint && npm run typecheck && npm run test",
  "check:contract": "npm run contract:check",
  "check:candidate": "npm run check:quick && npm run check:contract && npm run build",
  verify: "npm run check:candidate",
};
for (const [name, expected] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[name] !== expected) {
    violations.push(`${name} must keep the lightweight lifecycle command ${JSON.stringify(expected)}`);
  }
}
if (/tsc|coverage|\btest\b/u.test(String(packageJson.scripts?.build ?? ""))) {
  violations.push("build must bundle once and must not repeat typecheck, tests, or coverage");
}
for (const name of ["check:quick", "check:contract", "check:candidate", "verify"]) {
  if (String(packageJson.scripts?.[name] ?? "").includes("test:coverage")) {
    violations.push(`${name} must not generate ordinary-run coverage`);
  }
}
const npmrc = await readFile(new URL("../.npmrc", import.meta.url), "utf8");
if (!/^engine-strict=true$/m.test(npmrc)) violations.push("npm must reject an unsupported Node runtime");
if (!workflow.includes("node-version: 22.23.1")) violations.push("CI Node runtime must retain the reproducible 22.23.1 pin");
if (!workflow.includes("timeout-minutes:")) violations.push("CI job requires a bounded timeout");
if (!workflow.includes("cancel-in-progress: true")) violations.push("CI must cancel superseded executions");
if (workflow.includes("fetch-depth: 0")) violations.push("ordinary PR CI must not fetch complete Git history");
for (const command of ["npm run check:quick", "npm run check:contract", "npm run build"]) {
  if (!workflow.includes(command)) violations.push(`ordinary PR CI is missing ${command}`);
}
for (const forbidden of ["npm run verify", "test:coverage", "npm sbom", "gitleaks", "aquasec/trivy", "upload-artifact"]) {
  if (workflow.toLowerCase().includes(forbidden)) {
    violations.push(`ordinary PR CI must not run Production certification step ${forbidden}`);
  }
}
if (!workflow.includes("steps.changes.outputs.dependency") || !workflow.includes("npm run security:audit")) {
  violations.push("dependency audit must run only when the dependency manifest or lock changes");
}
for (const match of workflow.matchAll(/^\s*-\s+uses:\s*([^\s#]+)/gm)) {
  const action = match[1];
  if (!action.startsWith("./") && !/@[a-f0-9]{40}$/.test(action)) {
    violations.push(`GitHub Action must be pinned to an exact 40-character commit: ${action}`);
  }
}

const playwrightConfig = await readFile(new URL("../playwright.config.ts", import.meta.url), "utf8");
const browserSuite = await readFile(new URL("../e2e/commercial-workbench.spec.ts", import.meta.url), "utf8");
if (!playwrightConfig.includes('name: "candidate-chromium"') || !playwrightConfig.includes("grep: /@candidate/u")) {
  violations.push("candidate Browser check must use one explicit Chromium project");
}
if ((browserSuite.match(/@candidate/gu) ?? []).length !== 1) {
  violations.push("exactly one representative Browser journey must be marked @candidate");
}
if (!playwrightConfig.includes('name: "functional-chromium"') || !playwrightConfig.includes("grep: /@functional/u")) {
  violations.push("functional UAT must reuse generated results in one explicit Chromium project");
}
if ((browserSuite.match(/@functional/gu) ?? []).length !== 1) {
  violations.push("exactly one generated-result Browser check must be marked @functional");
}
const uatDockerfile = await readFile(new URL("../deploy/uat/Dockerfile", import.meta.url), "utf8");
const uatEntrypoint = await readFile(new URL("../deploy/uat/entrypoint.sh", import.meta.url), "utf8");
const uatReadme = await readFile(new URL("../deploy/uat/README.md", import.meta.url), "utf8");
if (!uatDockerfile.includes("node:22.23.1-alpine3.23@sha256:8516dce0483394d5708d4b2ee6cacb79fb1d617ea4e2787c2120bcca92ce372e")) {
  violations.push("LOCAL UAT image must pin the exact Node 22.23.1 multi-platform digest");
}
for (const marker of ['com.customs.runtime="local-user-uat-diagnostic"', 'com.customs.production="false"', 'com.customs.auto-completion="off"']) {
  if (!uatDockerfile.includes(marker)) violations.push(`LOCAL UAT image boundary marker is missing: ${marker}`);
}
if (!uatDockerfile.includes("EXPOSE 5173") || !uatDockerfile.includes("HEALTHCHECK")) {
  violations.push("LOCAL UAT image must expose and healthcheck only its internal static runtime port");
}
if (!uatDockerfile.includes("RUN npm run build:uat")
  || !uatDockerfile.includes("COPY --chown=node:node scripts ./scripts")
  || !uatDockerfile.includes("COPY --from=build /workspace/dist /usr/share/nginx/html")
  || uatDockerfile.includes("vite --host")) {
  violations.push("LOCAL UAT must serve built external assets instead of Vite development style injection");
}
if (!uatDockerfile.includes("uat-scenario-export.json")
  && !(await readFile(new URL("../package.json", import.meta.url), "utf8"))
    .includes("--output dist/uat-scenario-export.json")) {
  violations.push("LOCAL UAT build must emit the canonical test-only scenario export");
}
for (const marker of ["BACKEND_ORIGIN", "OIDC_BACKEND_ORIGIN", "BUILT ASSETS / STRICT CSP"]) {
  if (!uatEntrypoint.includes(marker)) violations.push(`LOCAL UAT fail-closed entrypoint marker is missing: ${marker}`);
}
if (uatDockerfile.includes("18088") || !uatReadme.includes('127.0.0.1:18088:5173')) {
  violations.push("Host port 18088 must be loopback-published by Compose documentation, never bound by the image");
}
const uatNginx = await readFile(new URL("../deploy/uat/default.conf.template", import.meta.url), "utf8");
if (!uatNginx.includes("proxy_pass ${BACKEND_ORIGIN}") || !uatNginx.includes("proxy_pass ${OIDC_BACKEND_ORIGIN}")) {
  violations.push("LOCAL UAT Nginx must proxy only the Backend and same-origin OIDC boundaries");
}
if (!uatNginx.includes("style-src 'self'") || uatNginx.includes("'unsafe-inline'")) {
  violations.push("LOCAL UAT Nginx must keep an external-style-only CSP");
}
if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log(`Static boundary check passed (${files.length} source files).`);

async function walk(directoryUrl) {
  const directory = fileURLToPath(directoryUrl);
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(new URL(`${entry.name}/`, directoryUrl)) : [join(directory, entry.name)]));
  return nested.flat();
}
