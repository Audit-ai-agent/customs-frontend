import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const snapshot = await readFile(new URL("../contracts/backend-openapi-v1.json", import.meta.url), "utf8");
const generated = await readFile(new URL("../src/api/v1/generated.ts", import.meta.url), "utf8");
const lock = JSON.parse(await readFile(new URL("../contracts/backend-openapi-v1.lock.json", import.meta.url), "utf8"));
const document = JSON.parse(snapshot);
const failures = [];

if (lock.contract !== "customs-backend-public-api" || lock.version !== "1.0") failures.push("unexpected contract identity");
if (sha256(snapshot) !== lock.openapi_sha256) failures.push("pinned OpenAPI SHA-256 mismatch");
if (sha256(generated) !== lock.generated_types_sha256) failures.push("generated TypeScript SHA-256 mismatch");
if (countOperations(document) !== lock.operation_count) failures.push("operation count mismatch");
for (const path of Object.keys(document.paths ?? {})) {
  if (!path.startsWith("/api/v1/") && !path.startsWith("/health/")) failures.push(`boundary violation: ${path}`);
}

const externalPath = process.env.BACKEND_OPENAPI_FILE ?? process.argv[2];
if (externalPath) {
  const external = await readFile(resolve(externalPath));
  // The provider export is a release artifact. Compare its exact bytes so a
  // regenerated or reformatted document cannot silently inherit the old pin.
  if (sha256(external) !== lock.openapi_sha256) {
    failures.push(`Backend OpenAPI byte drift: ${sha256(external)} != ${lock.openapi_sha256}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Backend OpenAPI schema/hash check passed (${lock.operation_count} operations, ${lock.openapi_sha256}).`);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function countOperations(document) {
  const methods = new Set(["get", "post", "put", "patch", "delete"]);
  return Object.values(document.paths ?? {}).reduce(
    (total, item) => total + Object.keys(item ?? {}).filter((key) => methods.has(key)).length,
    0,
  );
}
