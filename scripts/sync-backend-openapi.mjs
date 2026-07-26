import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import openapiTS, { astToString } from "openapi-typescript";

const sourceArgument = process.env.BACKEND_OPENAPI_FILE ?? process.argv[2];
if (!sourceArgument) {
  console.error("Usage: npm run contract:generate -- <backend-openapi.json>");
  process.exit(2);
}

const source = resolve(sourceArgument);
const snapshotUrl = new URL("../contracts/backend-openapi-v1.json", import.meta.url);
const generatedUrl = new URL("../src/api/v1/generated.ts", import.meta.url);
const lockUrl = new URL("../contracts/backend-openapi-v1.lock.json", import.meta.url);
const raw = await readFile(source);
const document = JSON.parse(raw.toString("utf8"));

if (document.openapi !== "3.1.0" || document.info?.title !== "Customs Review Workbench API") {
  throw new Error("Refusing to pin an unexpected Backend OpenAPI document");
}
const paths = Object.keys(document.paths ?? {});
if (!paths.length || paths.some((path) => !path.startsWith("/api/v1/") && !path.startsWith("/health/"))) {
  throw new Error("Backend OpenAPI contains an unexpected public path");
}

const generated = astToString(await openapiTS(document, { alphabetize: true }));
// Preserve the provider artifact byte-for-byte. This lets the consumer prove
// which exact Backend export it reviewed instead of accepting a semantic
// reserialization that has a different provenance hash.
await writeFile(snapshotUrl, raw);
await writeFile(generatedUrl, generated, "utf8");
await writeFile(
  lockUrl,
  `${JSON.stringify({
    contract: "customs-backend-public-api",
    version: "1.0",
    openapi_sha256: sha256(raw),
    generated_types_sha256: sha256(generated),
    operation_count: countOperations(document),
  }, null, 2)}\n`,
  "utf8",
);
console.log(`Pinned Backend OpenAPI ${sha256(raw)} and generated ${countOperations(document)} typed operations.`);

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
