import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const src = new URL("../src/", import.meta.url);
const rootPath = fileURLToPath(root);
const files = await walk(src);
const violations = [];

for (const file of files.filter((name) => [".ts", ".tsx", ".css"].includes(extname(name)))) {
  const content = await readFile(file, "utf8");
  const label = relative(rootPath, file);
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
  const label = relative(rootPath, file);
  if (/\bhumanize\s*\(/.test(content)) violations.push(`${label}: user wording must use an exhaustive Korean catalog`);
  if (/dangerouslySetInnerHTML/.test(content)) violations.push(`${label}: enhanced experience must never render untrusted HTML`);
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
if (packageJson.engines?.node !== "22.23.1") violations.push("Node runtime must be pinned to exact 22.23.1");
if (packageJson.packageManager !== "npm@10.9.8") violations.push("npm runtime must be pinned to exact 10.9.8");
if (!String(packageJson.scripts?.verify ?? "").startsWith("npm run doctor &&")) violations.push("verify must fail fast through the runtime doctor");
const npmrc = await readFile(new URL("../.npmrc", import.meta.url), "utf8");
if (!/^engine-strict=true$/m.test(npmrc)) violations.push("npm must reject an unsupported Node runtime");
if (!workflow.includes("node-version: 22.23.1")) violations.push("CI Node runtime must match the exact project pin");
if (!workflow.includes("timeout-minutes:")) violations.push("CI job requires a bounded timeout");
for (const match of workflow.matchAll(/^\s*-\s+uses:\s*([^\s#]+)/gm)) {
  const action = match[1];
  if (!action.startsWith("./") && !/@[a-f0-9]{40}$/.test(action)) {
    violations.push(`GitHub Action must be pinned to an exact 40-character commit: ${action}`);
  }
}
for (const match of workflow.matchAll(/^\s*zricethezav\/gitleaks@([^\s]+)$/gm)) {
  if (!/^sha256:[a-f0-9]{64}$/.test(match[1])) {
    violations.push("Gitleaks image must be pinned to an exact sha256 digest");
  }
}
for (const match of workflow.matchAll(/['"]?(aquasec\/trivy@[^'"\s]+)['"]?/g)) {
  if (!/@sha256:[a-f0-9]{64}$/.test(match[1])) violations.push("Trivy image must use an exact sha256 digest");
}
if (!workflow.includes("npm sbom --sbom-format cyclonedx")) violations.push("CI must generate a dependency SBOM");
if (!workflow.includes("frontend-image.cdx.json")) violations.push("CI must generate and retain a container SBOM");
if (!workflow.includes("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02")) violations.push("CI must retain SBOMs through the pinned artifact action");
if (!workflow.includes("if-no-files-found: error") || !workflow.includes("retention-days: 30")) violations.push("SBOM artifact policy must fail closed and retain evidence for 30 days");
if (!workflow.includes("--severity HIGH,CRITICAL")) violations.push("CI must scan the runtime image for High/Critical vulnerabilities");
if (workflow.includes("--ignore-unfixed")) violations.push("High/Critical vulnerability gate must not silently ignore unfixed findings");
if (!workflow.includes("Secret history scan refuses a zero-commit repository") || !workflow.includes("Gitleaks complete-history scan failed or found a secret")) {
  violations.push("complete-history secret scanning must fail on enumeration, zero history, scanner failure, or findings");
}
if (!workflow.includes("--read-only") || !workflow.includes("--cap-drop ALL") || !workflow.includes("no-new-privileges:true")) {
  violations.push("CI must smoke-test the runtime with a read-only root filesystem and reduced privileges");
}

const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
if (!/^# syntax=docker\/dockerfile:[^@\s]+@sha256:[a-f0-9]{64}$/m.test(dockerfile)) {
  violations.push("Dockerfile syntax frontend must use an exact sha256 digest");
}
for (const match of dockerfile.matchAll(/^FROM\s+([^\s]+)(?:\s+AS\s+\S+)?$/gmi)) {
  if (!/@sha256:[a-f0-9]{64}$/.test(match[1])) {
    violations.push(`Docker base image must be pinned to an exact sha256 digest: ${match[1]}`);
  }
}
if (!dockerfile.includes("HEALTHCHECK")) violations.push("Runtime image requires a healthcheck");
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
const nginx = await readFile(new URL("../deploy/default.conf.template", import.meta.url), "utf8");
if (!nginx.includes('Cache-Control "no-store, max-age=0"')) violations.push("SPA shell requires no-store cache policy");
if (!nginx.includes('Content-Security-Policy "default-src')) violations.push("Runtime Nginx must emit a CSP response header");

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
