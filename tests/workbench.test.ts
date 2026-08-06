import { afterEach, describe, expect, it, vi } from "vitest";
import { LightweightWorkbench } from "../src/workbench";

afterEach(() => {
  window.location.hash = "#/cases";
});

function reviewRun() {
  return {
    review_run_id: "run-1", case_id: "case-1", org_id: "local-org", job_id: "job-1", case_revision: 1,
    review_as_of: "2026-08-05", trade_type: "import" as const, execution_status: "succeeded" as const,
    assessment: "issues_detected" as const, review_disposition: "human_review_required" as const,
    completion_eligibility: { eligible: false as const, unmet_reason_codes: ["human_review_required"] },
    agent_schema_version: "3.1" as const, agent_status: "needs_review" as const, agent_engine: { kind: "deterministic" as const, model_id: "fixture" },
    report: { overall_status: "needs_review" as const, summary: "수량을 확인해야 합니다.", disclaimer: "담당자 검토가 필요합니다." },
    workflow: { status: "completed" as const, stages: [{ stage: "classify_documents" as const, status: "completed" as const, attempt_count: 1, summary: "문서를 판별했습니다." }], reextractions: [] },
    document_analyses: [{
      document_id: "document-1", filename: "invoice.txt", declared_type: "invoice", document_type: "invoice" as const,
      classification_source: { document_id: "document-1", quote: "INVOICE", occurrence: 0 }, extraction_status: "complete" as const,
      facts: [{ fact_id: "fact-1", name: "quantity", raw_value: "10", normalized_value: "10", unit: "EA", source: { document_id: "document-1", quote: "10", occurrence: 0 } }],
      line_items: [], warnings: [],
    }],
    comparisons: [{ comparison_id: "comparison-1", rule_code: "QTY_MISMATCH_INVOICE_PACKING", status: "mismatch" as const, left: { document_id: "document-1", item_id: null, fact_ids: ["fact-1"], display_value: "10" }, right: { document_id: "document-1", item_id: null, fact_ids: [], display_value: "12" }, expected_value: "10", observed_value: "12", unit: "EA", message: "수량이 일치하지 않습니다." }],
    evidence: [{ evidence_id: "evidence-1", item_id: "item-1", title: "관세법", text: "근거 조문", source_uri: "https://example.test/law", source_type: "law", source_hash: "a".repeat(64), law_id: "law-1", law_name: "관세법" }],
    findings: [{ finding_id: "finding-1", code: "QTY_MISMATCH_INVOICE_PACKING", message: "수량이 일치하지 않습니다.", kind: "validation_issue" as const, severity: "high" as const, comparison_id: "comparison-1", document_ids: ["document-1"], fact_ids: ["fact-1"], evidence_ids: ["evidence-1"] }],
    required_actions: [{ action_code: "inspect_quantity", message: "수량을 확인하십시오.", finding_ids: ["finding-1"] }, { action_code: "human_review_required", message: "자동 승인하지 않습니다.", finding_ids: [] }],
    reviewer_decisions: [], created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z",
  };
}

describe("commercial review workspace", () => {
  it("renders the no-secret local-development workspace", async () => {
    window.location.hash = "#/cases";
    const root = document.createElement("div");
    const api = { getSession: async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] }), listCases: async () => ({ items: [] }) };
    const auth = { logout: async () => undefined, freshAccessToken: async () => "token", isAuthenticated: () => true };
    const app = new LightweightWorkbench(root, api as never, auth, "local-development");
    await app.start();
    expect(root.textContent).toContain("문서와 근거를 한 화면에서 검토합니다.");
    expect(root.textContent).toContain("기본 개발");
    expect(root.textContent).toContain("사람 검토");
    expect(root.textContent).not.toContain("릴리스");
    app.destroy();
  });

  it("opens a synchronous completed result and exposes workflow, comparison, and reviewer action", async () => {
    window.location.hash = "#/cases/case-1/documents";
    const root = document.createElement("div");
    const caseDetail = { case_id: "case-1", org_id: "local-org", title: "입항 서류", status: "in_review" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z" };
    const job = { job_id: "job-1", case_id: "case-1", review_run_id: "run-1", status: "succeeded" as const, created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z", updated_at: "2026-08-05T00:00:00Z" };
    const run = reviewRun();
    const api = {
      getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })),
      getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => [{ document_id: "document-1", case_id: "case-1", document_type: "CI" as const, filename: "invoice.txt", media_type: "text/plain" as const, content_sha256: "a".repeat(64), byte_size: 12, character_count: 12, created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z" }]),
      listReviewRuns: vi.fn(async () => [{ review_run_id: "run-1", case_id: "case-1", job_id: "job-1", review_as_of: "2026-08-05", trade_type: "import" as const, execution_status: "succeeded" as const, assessment: "issues_detected" as const, review_disposition: "human_review_required" as const, result_digest: "b".repeat(64), finding_count: 1, reviewer_decision_count: 0, created_at: "2026-08-05T00:00:00Z" }]),
      enqueueReview: vi.fn(async () => job), getReviewRun: vi.fn(async () => run),
      getJob: vi.fn(async () => { throw new Error("a synchronously completed Job must not be polled"); }),
    };
    const auth = { logout: async () => undefined, freshAccessToken: async () => "token", isAuthenticated: () => true };
    const app = new LightweightWorkbench(root, api as never, auth, "functional-uat");
    await app.start();
    await (app as unknown as { startReview(): Promise<void> }).startReview();
    expect(api.getJob).not.toHaveBeenCalled();
    expect(api.getReviewRun).toHaveBeenCalledWith("run-1");
    expect(root.textContent).toContain("Agent 워크플로우");
    expect(root.textContent).toContain("문서 간 비교");
    expect(root.textContent).toContain("담당자 판단 기록");
    expect(root.textContent).toContain("심사가 완료되었습니다");
    app.destroy();
  });
});
