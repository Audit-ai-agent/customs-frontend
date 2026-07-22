import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import lock from "../contracts/backend-openapi-v1.lock.json";
import openapi from "../contracts/backend-openapi-v1.json";

describe("pinned Backend OpenAPI contract", () => {
  it("binds the complete schema bytes and generated types", () => {
    const snapshot = readFileSync(resolve("contracts/backend-openapi-v1.json"), "utf8");
    const generated = readFileSync(resolve("src/api/v1/generated.ts"), "utf8");
    expect(createHash("sha256").update(snapshot).digest("hex")).toBe(lock.openapi_sha256);
    expect(createHash("sha256").update(generated).digest("hex")).toBe(lock.generated_types_sha256);
    expect(Object.keys(openapi.paths).every((path) => path.startsWith("/api/v1/") || path.startsWith("/health/"))).toBe(true);
    expect(JSON.stringify(openapi)).not.toMatch(/internal\/agent|qdrant|neo4j/i);
  });
});
