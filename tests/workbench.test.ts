import { describe, expect, it, vi } from "vitest";
import { LightweightWorkbench } from "../src/workbench";

describe("lightweight workbench", () => {
  it("renders the no-secret local-development journey", async () => {
    const root = document.createElement("div");
    const api = {
      getSession: async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] }),
      listCases: async () => ({ items: [] }),
    };
    const auth = {
      logout: async () => undefined,
      freshAccessToken: async () => "token",
      isAuthenticated: () => true,
    };

    const app = new LightweightWorkbench(root, api as never, auth, "local-development");
    await app.start();

    expect(root.textContent).toContain("기본 개발");
    expect(root.textContent).toContain("Case를 만들고");
    expect(root.textContent).not.toContain("시나리오");
    expect(root.textContent).not.toContain("릴리스");
  });

  it("opens the completed review immediately when enqueue returns a succeeded Job", async () => {
    const root = document.createElement("div");
    const caseDetail = {
      case_id: "case-1",
      org_id: "local-org",
      title: "입항 서류",
      status: "in_review" as const,
      revision: 1,
      updated_at: "2026-08-05T00:00:00Z",
    };
    const job = {
      job_id: "job-1",
      case_id: "case-1",
      review_run_id: "run-1",
      status: "succeeded" as const,
      created_by: "local-reviewer",
      created_at: "2026-08-05T00:00:00Z",
      updated_at: "2026-08-05T00:00:00Z",
    };
    const run = {
      review_run_id: "run-1",
      case_id: "case-1",
      org_id: "local-org",
      job_id: "job-1",
      case_revision: 1,
      review_as_of: "2026-08-05",
      trade_type: "import" as const,
      execution_status: "succeeded" as const,
      assessment: "issues_detected" as const,
      review_disposition: "human_review_required" as const,
      completion_eligibility: { eligible: false as const, unmet_reason_codes: ["human_review_required"] },
      report: { overall_status: "needs_review" as const, summary: "검토 결과", disclaimer: "담당자 검토가 필요합니다." },
      evidence: [],
      findings: [],
      required_actions: [],
      created_by: "local-reviewer",
      created_at: "2026-08-05T00:00:00Z",
    };
    const api = {
      getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })),
      getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => [{
        document_id: "document-1",
        case_id: "case-1",
        document_type: "CI" as const,
        filename: "invoice.txt",
        media_type: "text/plain" as const,
        content_sha256: "a".repeat(64),
        byte_size: 12,
        character_count: 12,
        created_by: "local-reviewer",
        created_at: "2026-08-05T00:00:00Z",
      }]),
      listReviewRuns: vi.fn(async () => []),
      enqueueReview: vi.fn(async () => job),
      getReviewRun: vi.fn(async () => run),
      getJob: vi.fn(async () => {
        throw new Error("a synchronously completed Job must not be polled");
      }),
    };
    const auth = {
      logout: async () => undefined,
      freshAccessToken: async () => "token",
      isAuthenticated: () => true,
    };
    const app = new LightweightWorkbench(root, api as never, auth, "functional-uat");
    const internals = app as unknown as {
      openCase(caseId: string): Promise<void>;
      startReview(): Promise<void>;
    };

    await app.start();
    await internals.openCase("case-1");
    await internals.startReview();

    expect(api.getJob).not.toHaveBeenCalled();
    expect(api.getCase).toHaveBeenCalledTimes(2);
    expect(api.listDocuments).toHaveBeenCalledTimes(2);
    expect(api.listReviewRuns).toHaveBeenCalledTimes(2);
    expect(api.getReviewRun).toHaveBeenCalledWith("run-1");
    expect(root.textContent).toContain("심사 결과");
    expect(root.textContent).toContain("검토 결과");
    expect(root.textContent).toContain("심사가 완료되었습니다");
  });
});
