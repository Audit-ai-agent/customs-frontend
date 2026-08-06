import { describe, expect, it } from "vitest";
import { ApiClient } from "../src/api/v1/client";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function reviewRunPayload() {
  return {
    review_run_id: "run-1", case_id: "case-1", org_id: "org-a", job_id: "job-1", case_revision: 1,
    review_as_of: "2026-08-05", trade_type: "import", execution_status: "succeeded", assessment: "issues_detected",
    review_disposition: "human_review_required", completion_eligibility: { eligible: false, unmet_reason_codes: ["human_review_required"] },
    agent_schema_version: "3.1", agent_status: "needs_review", agent_engine: { kind: "deterministic", model_id: "fixture" },
    report: { overall_status: "needs_review", summary: "검토 결과입니다.", disclaimer: "담당자 검토가 필요합니다." },
    workflow: { status: "completed", stages: [{ stage: "classify_documents", status: "completed", attempt_count: 1, summary: "문서를 판별했습니다." }], reextractions: [] },
    document_analyses: [{
      document_id: "document-1", filename: "invoice.txt", declared_type: "invoice", document_type: "invoice",
      classification_source: { document_id: "document-1", quote: "INVOICE", occurrence: 0 }, extraction_status: "complete",
      facts: [{ fact_id: "fact-1", name: "hs_code", raw_value: "8471.30", normalized_value: "8471.30", unit: null, source: { document_id: "document-1", quote: "8471.30", occurrence: 0 } }],
      line_items: [], warnings: [],
    }],
    comparisons: [{
      comparison_id: "comparison-1", rule_code: "QTY_MISMATCH_INVOICE_PACKING", status: "mismatch",
      left: { document_id: "document-1", item_id: null, fact_ids: ["fact-1"], display_value: "10" },
      right: { document_id: "document-1", item_id: null, fact_ids: [], display_value: "12" },
      expected_value: "10", observed_value: "12", unit: "EA", message: "수량을 확인하십시오.",
    }],
    evidence: [{ evidence_id: "evidence-1", item_id: "item-1", title: "관세법", text: "근거 조문", source_uri: "https://example.test/law", source_type: "law", source_hash: "a".repeat(64), law_id: "law-1", law_name: "관세법" }],
    findings: [{ finding_id: "finding-1", kind: "validation_issue", code: "QTY_MISMATCH_INVOICE_PACKING", severity: "high", message: "수량을 확인하십시오.", item_id: null, evidence_ids: ["evidence-1"], comparison_id: "comparison-1", document_ids: ["document-1"], fact_ids: ["fact-1"] }],
    required_actions: [{ action_code: "inspect_quantity", message: "수량을 확인하십시오.", finding_ids: ["finding-1"] }, { action_code: "human_review_required", message: "담당자 검토", finding_ids: [] }],
    reviewer_decisions: [], created_by: "reviewer", created_at: "2026-08-05T00:00:00Z",
  };
}

describe("Backend API client", () => {
  it("creates a loopback development session without sending a bearer token", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return json({ access_token: "a".repeat(32), token_type: "Bearer", expires_in: 3_600, session: { subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] } });
    };
    const api = new ApiClient(fetcher, async () => "must-not-be-sent");
    await expect(api.createLocalDevelopmentSession()).resolves.toMatchObject({ session: { subject: "local-reviewer", org_id: "local-org" } });
    expect(String(calls[0]?.[0])).toBe("/api/v1/dev/session");
    expect(new Headers(calls[0]?.[1]?.headers).has("Authorization")).toBe(false);
  });

  it("uses only the Backend v1 boundary and validates the organization", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const replies = [
      json({ subject: "reviewer", org_id: "org-a", roles: ["reviewer"] }),
      json({ items: [{ case_id: "case-1", org_id: "org-a", title: "입항 서류", status: "open", revision: 0, updated_at: "2026-08-05T00:00:00Z" }] }),
    ];
    const fetcher: typeof fetch = async (input, init) => { calls.push([input, init]); return replies.shift() ?? json({}); };
    const api = new ApiClient(fetcher, async () => "local-token");
    await api.getSession();
    await expect(api.listCases()).resolves.toMatchObject({ items: [expect.objectContaining({ case_id: "case-1" })] });
    for (const [url, init] of calls) {
      expect(String(url)).toMatch(/^\/api\/v1\//u);
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer local-token");
    }
  });

  it("keeps review input compact and records a reviewer decision only through Backend", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      if (String(input).endsWith("/reviews")) return json({ job: { job_id: "job-1", case_id: "case-1", review_run_id: "run-1", status: "queued", created_by: "reviewer", created_at: "2026-08-05T00:00:00Z", updated_at: "2026-08-05T00:00:00Z" }, idempotency_reused: false }, 202);
      return json({ finding_id: "finding-1", status: "resolved", reason: "보완 문서를 확인했습니다.", decided_by: "reviewer", decided_at: "2026-08-05T00:00:00Z", history: [{ status: "resolved", reason: "보완 문서를 확인했습니다.", decided_by: "reviewer", decided_at: "2026-08-05T00:00:00Z" }] });
    };
    const api = new ApiClient(fetcher, async () => "local-token");
    await api.enqueueReview("case-1", { trade_type: "import" }, "review-key-1");
    await api.setFindingDecision("run-1", "finding-1", { status: "resolved", reason: "보완 문서를 확인했습니다." });
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({ trade_type: "import" });
    expect(requests[1]?.url).toBe("/api/v1/review-runs/run-1/findings/finding-1/decision");
    expect(requests[1]?.init?.method).toBe("PUT");
  });

  it("decodes the structured V3.1 human-review projection", async () => {
    const api = new ApiClient(async () => json(reviewRunPayload()), async () => "local-token");
    await expect(api.getReviewRun("run-1")).resolves.toMatchObject({
      agent_schema_version: "3.1",
      workflow: { stages: [expect.objectContaining({ stage: "classify_documents" })] },
      comparisons: [expect.objectContaining({ comparison_id: "comparison-1" })],
      findings: [expect.objectContaining({ finding_id: "finding-1" })],
    });
  });
});
