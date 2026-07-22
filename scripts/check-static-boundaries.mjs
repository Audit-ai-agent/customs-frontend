import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const src = new URL("../src/", import.meta.url);
const rootPath = fileURLToPath(root);
const files = await walk(src);
const violations = [];

for (const file of files.filter((name) => [".ts", ".css"].includes(extname(name)))) {
  const content = await readFile(file, "utf8");
  const label = relative(rootPath, file);
  for (const [pattern, message] of [
    [/\.innerHTML\s*=/g, "unsafe innerHTML assignment"],
    [/\blocalStorage\b/g, "persistent browser secret storage"],
    [/["'`]\/(?:internal\/agent|evidence)(?:\/|["'`])|qdrant|neo4j/gi, "direct Agent/Data boundary reference"],
    [/fetch\(\s*["'`]https?:/g, "direct absolute network call"],
    [/dangerouslySetInnerHTML/g, "unsafe HTML rendering escape hatch"],
  ]) {
    if (pattern.test(content)) violations.push(`${label}: ${message}`);
  }
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
