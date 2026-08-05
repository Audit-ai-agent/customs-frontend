import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const snapshot = await readFile(new URL("../contracts/backend-openapi-v1.json", import.meta.url));
const document = parseAndValidate(snapshot);
const externalPath = process.env.BACKEND_OPENAPI_FILE ?? process.argv[2];

if (externalPath) {
  const provider = await readFile(resolve(externalPath));
  if (!snapshot.equals(provider)) {
    console.error("Backend OpenAPI byte drift; run contract:generate deliberately.");
    process.exit(1);
  }
}

console.log(`Backend OpenAPI check passed (${countOperations(document)} operations).`);

function parseAndValidate(raw) {
  let document;
  try {
    document = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error("Backend OpenAPI must be valid JSON");
  }
  if (document.openapi !== "3.1.0" || document.info?.title !== "Customs Review Workbench API") {
    throw new Error("unexpected Backend OpenAPI document");
  }
  const paths = Object.keys(document.paths ?? {});
  if (!paths.length || paths.some((path) => !path.startsWith("/api/v1/") && !path.startsWith("/health/"))) {
    throw new Error("Backend OpenAPI contains an unexpected public path");
  }
  return document;
}

function countOperations(document) {
  const methods = new Set(["get", "post", "put", "patch", "delete"]);
  return Object.values(document.paths ?? {}).reduce(
    (total, item) => total + Object.keys(item ?? {}).filter((key) => methods.has(key)).length,
    0,
  );
}
