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
    expect(Object.keys(openapi.paths).every((path) => (
      path.startsWith("/api/v1/")
      || path.startsWith("/api/v2/")
      || path.startsWith("/health/")
    ))).toBe(true);
    expect(openapi.paths).toHaveProperty("/api/v2/review-runs/{review_run_id}/experience");
    expect(openapi.paths).toHaveProperty(
      "/api/v2/review-runs/{review_run_id}/assistant/conversations",
    );
    expect(openapi.paths).toHaveProperty(
      "/api/v2/assistant/conversations/{conversation_id}/messages",
    );
    expect(openapi.paths).toHaveProperty("/api/v2/jobs/{job_id}/events/stream");
    const serialized = JSON.stringify(openapi);
    expect(serialized).not.toMatch(/internal\/agent/i);
    expect(serialized).not.toMatch(
      /qdrant_(url|uri|host|port|api_key)|neo4j_(url|uri|host|port|user|password)|qdrant:|bolt:/i,
    );
    expect(
      Object.keys(openapi.components.schemas.UatEvidenceStoreCountsResponse.properties).sort(),
    ).toEqual([
      "neo4j_article_count",
      "postgresql_article_count",
      "qdrant_point_count",
    ]);
  });

  it("accepts the provider's bounded 64-entry review stage trace", () => {
    expect(openapi.components.schemas.ReviewRunRecord.properties.review_stage_trace.maxItems).toBe(64);
    expect(openapi.components.schemas.ReviewStageTraceEntry.properties.sequence.maximum).toBe(64);
  });
});
