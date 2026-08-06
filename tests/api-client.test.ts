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
    agent_schema_version: "3.2", agent_status: "needs_review", agent_engine: { kind: "deterministic", model_id: "fixture" },
    report: {
      overall_status: "needs_review", summary: "검토 결과입니다.", disclaimer: "담당자 검토가 필요합니다.",
      sections: [
        ["conclusion", "심사 결론"], ["execution_process", "실행 과정"], ["document_comparison", "문서 비교"], ["issues_and_causes", "문제와 원인"],
        ["legal_evidence", "법령 근거"], ["impact", "영향"], ["next_actions", "다음 조치"], ["limitations", "한계"],
      ].map(([section, title], index) => ({
        section,
        title,
        claims: [{ claim_id: `claim-${index + 1}`, text: `${title} 설명`, fact_ids: index === 4 ? [] : [index === 6 ? "fact-human-1" : "fact-1"], comparison_ids: index === 2 ? ["comparison-1"] : [], evidence_ids: index === 4 ? ["evidence-1"] : [] }],
      })),
    },
    workflow: {
      status: "completed", stages: [{ stage: "classify_documents", status: "completed", attempt_count: 1, summary: "문서를 판별했습니다." }], reextractions: [],
      planner: { cycle_count: 2, actions: [
        { cycle: 1, action: "analyze_documents", status: "completed", summary: "문서를 분석했습니다.", correction_proposal_ids: [] },
        { cycle: 2, action: "apply_human_corrections", status: "completed", summary: "승인된 수정값을 반영했습니다.", correction_proposal_ids: ["proposal-1"] },
      ] },
    },
    document_analyses: [{
      document_id: "document-1", filename: "invoice.txt", declared_type: "invoice", document_type: "invoice",
      classification_source: { source_kind: "document", document_id: "document-1", quote: "INVOICE", occurrence: 0 }, extraction_status: "complete",
      facts: [
        { fact_id: "fact-1", name: "hs_code", raw_value: "8471.30", normalized_value: "8471.30", unit: null, source: { source_kind: "document", document_id: "document-1", quote: "8471.30", occurrence: 0 } },
        { fact_id: "fact-human-1", name: "quantity", raw_value: "12", normalized_value: "12", unit: "EA", source: { source_kind: "human_provided", document_id: "document-1", correction_proposal_id: "proposal-1", reason: "Packing List 원문 재확인" } },
      ],
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
      const approver = init?.body === JSON.stringify({ actor: "approver" });
      return json({ access_token: (approver ? "p" : "a").repeat(32), token_type: "Bearer", expires_in: 3_600, session: { subject: approver ? "local-approver" : "local-reviewer", org_id: "local-org", roles: [approver ? "approver" : "reviewer"] } });
    };
    const api = new ApiClient(fetcher, async () => "must-not-be-sent");
    await expect(api.createLocalDevelopmentSession()).resolves.toMatchObject({ session: { subject: "local-reviewer", org_id: "local-org" } });
    await expect(api.createLocalDevelopmentSession("approver")).resolves.toMatchObject({ session: { subject: "local-approver", roles: ["approver"] } });
    expect(String(calls[0]?.[0])).toBe("/api/v1/dev/session");
    expect(new Headers(calls[0]?.[1]?.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({ actor: "approver" });
    expect(new Headers(calls[1]?.[1]?.headers).has("Authorization")).toBe(false);
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

  it("decodes the structured V3.2 human-review projection including human-provided facts", async () => {
    const api = new ApiClient(async () => json(reviewRunPayload()), async () => "local-token");
    const result = await api.getReviewRun("run-1");
    expect(result.agent_schema_version).toBe("3.2");
    expect(result.workflow.stages).toEqual(expect.arrayContaining([expect.objectContaining({ stage: "classify_documents" })]));
    expect(result.workflow.planner).toMatchObject({ cycle_count: 2, actions: expect.arrayContaining([expect.objectContaining({ action: "apply_human_corrections" })]) });
    expect(result.report.sections).toEqual(expect.arrayContaining([expect.objectContaining({ section: "conclusion" })]));
    expect(result.document_analyses[0]?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ fact_id: "fact-human-1", source: expect.objectContaining({ source_kind: "human_provided", correction_proposal_id: "proposal-1" }) }),
    ]));
    expect(result.comparisons).toEqual(expect.arrayContaining([expect.objectContaining({ comparison_id: "comparison-1" })]));
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ finding_id: "finding-1" })]));
  });

  it("keeps assistant, correction, and child-review actions on planned Backend v1 routes", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const conversation = {
      conversation_id: "conversation-1", review_run_id: "run-1", title: "수량 확인",
      created_by: "reviewer", created_at: "2026-08-05T00:00:00Z", updated_at: "2026-08-05T00:01:00Z",
    };
    const userMessage = {
      message_id: "message-user-1", conversation_id: "conversation-1", role: "user",
      content: "수량을 확인해 줘", created_by: "reviewer", created_at: "2026-08-05T00:01:00Z",
    };
    const assistantMessage = {
      message_id: "message-assistant-1", conversation_id: "conversation-1", role: "assistant",
      content: "Invoice와 Packing List의 수량을 확인해야 합니다.", answer_scope: "case_grounded",
      citations: [{ kind: "comparison", reference_id: "comparison-1" }],
      suggested_questions: ["관련 문서 원문을 보여줘"],
      correction_draft: { document_id: "document-1", fact_id: "fact-1", field_name: "quantity", new_value: "12", unit: "EA", reason: "Packing List 원문 기준" },
      created_by: "agent", created_at: "2026-08-05T00:01:01Z",
    };
    const proposal = {
      correction_proposal_id: "proposal-1", review_run_id: "run-1", finding_id: "finding-1",
      document_id: "document-1", fact_id: "fact-1", field_name: "quantity", new_value: "12", unit: "EA",
      reason: "Packing List 원문 기준", status: "proposed", created_by: "reviewer", created_at: "2026-08-05T00:02:00Z", history: [{ event: "proposed", reason: "Packing List 원문 기준", actor: "reviewer", occurred_at: "2026-08-05T00:02:00Z" }],
    };
    const job = { job_id: "job-child-1", case_id: "case-1", review_run_id: "run-child-1", status: "queued", created_by: "reviewer", created_at: "2026-08-05T00:03:00Z", updated_at: "2026-08-05T00:03:00Z" };
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/assistant/conversations") && init?.method === "GET") return json({ items: [conversation] });
      if (url.endsWith("/assistant/conversations") && init?.method === "POST") return json(conversation);
      if (url.endsWith("/messages") && init?.method === "GET") return json({ items: [userMessage, assistantMessage] });
      if (url.endsWith("/messages") && init?.method === "POST") return json({ user_message: userMessage, assistant_message: assistantMessage });
      if (url.endsWith("/correction-proposals") && init?.method === "GET") return json({ items: [proposal] });
      if (url.endsWith("/correction-proposals") && init?.method === "POST") return json(proposal);
      if (url.endsWith("/decision")) return json({ ...proposal, status: "approved", decision: { status: "approved", reason: "문서 원문 확인", decided_by: "reviewer", decided_at: "2026-08-05T00:03:00Z" }, history: [...proposal.history, { event: "approved", reason: "문서 원문 확인", actor: "reviewer", occurred_at: "2026-08-05T00:03:00Z" }] });
      if (url.endsWith("/revisions")) return json({ job, idempotency_reused: false }, 202);
      return json({ detail: "unexpected request" }, 500);
    };
    const api = new ApiClient(fetcher, async () => "local-token");
    await api.listAssistantConversations("run-1");
    await api.createAssistantConversation("run-1", { title: "수량 확인" });
    await api.listAssistantMessages("conversation-1");
    await api.sendAssistantMessage("conversation-1", { content: "수량을 확인해 줘" }, "assistant-key-1");
    await api.listCorrectionProposals("run-1");
    await api.createCorrectionProposal("run-1", { document_id: "document-1", fact_id: "fact-1", field_name: "quantity", new_value: "12", unit: "EA", reason: "Packing List 원문 기준", finding_id: "finding-1" });
    await api.decideCorrectionProposal("proposal-1", { status: "approved", reason: "문서 원문 확인" });
    await api.enqueueRevision("run-1", { proposal_ids: ["proposal-1"] }, "revision-key-1");
    expect(calls.map((item) => item.url)).toEqual([
      "/api/v1/review-runs/run-1/assistant/conversations",
      "/api/v1/review-runs/run-1/assistant/conversations",
      "/api/v1/assistant/conversations/conversation-1/messages",
      "/api/v1/assistant/conversations/conversation-1/messages",
      "/api/v1/review-runs/run-1/correction-proposals",
      "/api/v1/review-runs/run-1/correction-proposals",
      "/api/v1/correction-proposals/proposal-1/decision",
      "/api/v1/review-runs/run-1/revisions",
    ]);
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ content: "수량을 확인해 줘" });
    expect(new Headers(calls[3]?.init?.headers).get("Idempotency-Key")).toBe("assistant-key-1");
    expect(JSON.parse(String(calls[5]?.init?.body))).toEqual({ document_id: "document-1", fact_id: "fact-1", field_name: "quantity", new_value: "12", unit: "EA", reason: "Packing List 원문 기준", finding_id: "finding-1" });
    expect(new Headers(calls[7]?.init?.headers).get("Idempotency-Key")).toBe("revision-key-1");
  });
});
