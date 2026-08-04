import { describe, expect, it } from "vitest";
import { ApiClient } from "../src/api/v1/client";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("lightweight Backend API client", () => {
  it("creates a loopback development session without sending a bearer token", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return json({
        access_token: "a".repeat(32),
        token_type: "Bearer",
        expires_in: 3_600,
        session: { subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] },
      });
    };
    const api = new ApiClient(fetcher, async () => "must-not-be-sent");

    await expect(api.createLocalDevelopmentSession()).resolves.toMatchObject({
      session: { subject: "local-reviewer", org_id: "local-org" },
    });

    expect(calls).toHaveLength(1);
    const [url, init] = calls[0] as [RequestInfo | URL, RequestInit | undefined];
    expect(url).toBe("/api/v1/dev/session");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  });

  it("uses the Backend v1 boundary and validates the current organization", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const replies = [
      json({ subject: "reviewer", org_id: "org-a", roles: ["reviewer"] }),
      json({ items: [{
        case_id: "case-1",
        org_id: "org-a",
        title: "입항 서류",
        status: "open",
        revision: 0,
        updated_at: "2026-08-05T00:00:00Z",
      }] }),
    ];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      const reply = replies.shift();
      if (reply === undefined) throw new Error("unexpected fetch call");
      return reply;
    };
    const api = new ApiClient(fetcher, async () => "local-token");

    await api.getSession();
    await expect(api.listCases()).resolves.toEqual({
      items: [expect.objectContaining({ case_id: "case-1", org_id: "org-a" })],
    });

    for (const [url, init] of calls) {
      expect(String(url)).toMatch(/^\/api\/v1\//u);
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer local-token");
    }
  });

  it("sends the compact review request without retired document-code fields", async () => {
    let request: RequestInit | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      request = init;
      return json({
        job: {
          job_id: "job-1",
          case_id: "case-1",
          review_run_id: "run-1",
          status: "queued",
          created_by: "reviewer",
          created_at: "2026-08-05T00:00:00Z",
          updated_at: "2026-08-05T00:00:00Z",
        },
        idempotency_reused: false,
      }, 202);
    };
    const api = new ApiClient(fetcher, async () => "local-token");

    await expect(api.enqueueReview("case-1", { trade_type: "import" }, "review-key-1"))
      .resolves.toMatchObject({ job_id: "job-1", review_run_id: "run-1" });

    expect(JSON.parse(String(request?.body))).toEqual({ trade_type: "import" });
  });

  it("decodes the current human-review run projection", async () => {
    const fetcher: typeof fetch = async () => json({
      review_run_id: "run-1",
      case_id: "case-1",
      org_id: "org-a",
      job_id: "job-1",
      case_revision: 1,
      review_as_of: "2026-08-05",
      trade_type: "import",
      execution_status: "succeeded",
      assessment: "issues_detected",
      review_disposition: "human_review_required",
      completion_eligibility: { eligible: false, unmet_reason_codes: ["human_review_required"] },
      report: {
        overall_status: "needs_review",
        summary: "검토 결과입니다.",
        disclaimer: "담당자 검토가 필요합니다.",
      },
      evidence: [{ title: "관세법", text: "근거 조문", law_name: "관세법" }],
      findings: [{
        kind: "regulatory_finding",
        code: "required_document",
        severity: "medium",
        message: "서류를 확인하십시오.",
      }],
      required_actions: [{ action_code: "human_review_required", message: "담당자 검토" }],
      created_by: "reviewer",
      created_at: "2026-08-05T00:00:00Z",
    });
    const api = new ApiClient(fetcher, async () => "local-token");

    await expect(api.getReviewRun("run-1")).resolves.toMatchObject({
      report: { overall_status: "needs_review" },
      completion_eligibility: { eligible: false },
      required_actions: [{ action_code: "human_review_required" }],
    });
  });
});
