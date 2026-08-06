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
    agent_schema_version: "3.2" as const, agent_status: "needs_review" as const, agent_engine: { kind: "deterministic" as const, model_id: "fixture" },
    report: {
      overall_status: "needs_review" as const,
      summary: "수량을 확인해야 합니다.",
      disclaimer: "담당자 검토가 필요합니다.",
      sections: [
        ["conclusion", "심사 결론", "Invoice와 Packing List의 수량을 사람이 확인해야 합니다."],
        ["execution_process", "처리 과정과 실행 상태", "문서 분석과 비교를 제한된 순서로 완료했습니다."],
        ["document_comparison", "문서 간 비교", "수량 비교에서 불일치가 확인되었습니다."],
        ["issues_and_causes", "문제와 원인", "문서별 수량 값이 다릅니다."],
        ["legal_evidence", "법령 근거", "연결된 Evidence를 함께 확인해야 합니다."],
        ["impact", "영향", "심사 결과는 자동 완료되지 않습니다."],
        ["next_actions", "담당자 판단 기록", "담당자가 확인 사유를 남겨야 합니다."],
        ["limitations", "한계", "텍스트 문서에 있는 사실만 확인했습니다."],
      ].map(([section, title, text], index) => ({
        section: section as "conclusion" | "execution_process" | "document_comparison" | "issues_and_causes" | "legal_evidence" | "impact" | "next_actions" | "limitations",
        title,
        claims: [{ claim_id: `claim-${index + 1}`, text, fact_ids: index === 4 ? [] : ["fact-1"], comparison_ids: index === 2 || index === 3 ? ["comparison-1"] : [], evidence_ids: index === 4 ? ["evidence-1"] : [] }],
      })),
    },
    workflow: {
      status: "completed" as const,
      stages: [{ stage: "classify_documents" as const, status: "completed" as const, attempt_count: 1, summary: "문서를 판별했습니다." }],
      reextractions: [],
      planner: { cycle_count: 1 as const, actions: [{ cycle: 1 as const, action: "analyze_documents" as const, status: "completed" as const, summary: "문서를 분석했습니다.", correction_proposal_ids: [] }] },
    },
    document_analyses: [{
      document_id: "document-1", filename: "invoice.txt", declared_type: "invoice", document_type: "invoice" as const,
      classification_source: { source_kind: "document" as const, document_id: "document-1", quote: "INVOICE", occurrence: 0 }, extraction_status: "complete" as const,
      facts: [{ fact_id: "fact-1", name: "quantity", raw_value: "10", normalized_value: "10", unit: "EA", source: { source_kind: "document" as const, document_id: "document-1", quote: "10", occurrence: 0 } }],
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
    expect(root.textContent).toContain("처리 과정과 실행 상태");
    expect(root.textContent).toContain("문서 간 비교");
    expect(root.textContent).toContain("담당자 판단 기록");
    expect(root.querySelectorAll("[data-report-section]")).toHaveLength(8);
    expect(root.querySelector("[data-planner-trace]")?.textContent).toContain("제한형 계획");
    const comparisonCitation = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-report-claim-id="claim-3"] .citation-chip'))
      .find((item) => item.textContent?.includes("문서 비교"));
    expect(comparisonCitation).toBeDefined();
    comparisonCitation?.click();
    await (app as unknown as { followRoute(): Promise<void> }).followRoute();
    expect(root.querySelector('[data-comparison-id="comparison-1"]')?.classList.contains("is-focused")).toBe(true);
    expect(root.textContent).toContain("심사가 완료되었습니다");
    app.destroy();
  });

  it("opens the assistant route, preserves conversation history, sends a question, and follows evidence citations", async () => {
    window.location.hash = "#/cases/case-1/assistant";
    const root = document.createElement("div");
    const caseDetail = { case_id: "case-1", org_id: "local-org", title: "입항 서류", status: "in_review" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z" };
    const conversation = { conversation_id: "conversation-1", review_run_id: "run-1", title: "수량 검토", created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z", updated_at: "2026-08-05T00:00:00Z" };
    const userMessage = { message_id: "message-user-1", conversation_id: "conversation-1", role: "user" as const, content: "수량을 확인해 줘", citations: [], suggested_questions: [], created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z" };
    const assistantMessage = { message_id: "message-assistant-1", conversation_id: "conversation-1", role: "assistant" as const, content: "문서 간 비교 결과를 확인하십시오.", answer_scope: "case_grounded" as const, citations: [{ kind: "evidence" as const, reference_id: "evidence-1" }], suggested_questions: ["원문 인용을 보여줘"], correction_draft: { document_id: "document-1", fact_id: "fact-1", field_name: "quantity", new_value: "12", unit: "EA", reason: "원문 확인" }, created_by: "agent", created_at: "2026-08-05T00:00:01Z" };
    const run = reviewRun();
    const api = {
      getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })),
      getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => [{ document_id: "document-1", case_id: "case-1", document_type: "CI" as const, filename: "invoice.txt", media_type: "text/plain" as const, content_sha256: "a".repeat(64), byte_size: 12, character_count: 12, created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z" }]),
      listReviewRuns: vi.fn(async () => [{ review_run_id: "run-1", case_id: "case-1", job_id: "job-1", review_as_of: "2026-08-05", trade_type: "import" as const, execution_status: "succeeded" as const, assessment: "issues_detected" as const, review_disposition: "human_review_required" as const, result_digest: "b".repeat(64), finding_count: 1, reviewer_decision_count: 0, created_at: "2026-08-05T00:00:00Z" }]),
      getReviewRun: vi.fn(async () => run),
      listAssistantConversations: vi.fn(async () => [conversation]),
      listAssistantMessages: vi.fn(async () => [userMessage, assistantMessage]),
      sendAssistantMessage: vi.fn(async () => ({ user_message: { ...userMessage, message_id: "message-user-2", content: "근거를 열어 줘", created_at: "2026-08-05T00:01:00Z" }, assistant_message: { ...assistantMessage, message_id: "message-assistant-2", content: "Evidence를 열었습니다.", created_at: "2026-08-05T00:01:01Z" } })),
      createAssistantConversation: vi.fn(async () => conversation),
    };
    const auth = { logout: async () => undefined, freshAccessToken: async () => "token", isAuthenticated: () => true };
    const app = new LightweightWorkbench(root, api as never, auth, "local-development");
    await app.start();
    expect(root.textContent).toContain("AI 도우미");
    expect(root.textContent).toContain("문서 간 비교 결과를 확인하십시오.");
    await (app as unknown as { sendAssistantMessage(value: string): Promise<void> }).sendAssistantMessage("근거를 열어 줘");
    expect(api.sendAssistantMessage).toHaveBeenCalled();
    expect(root.textContent).toContain("Evidence를 열었습니다.");
    await (app as unknown as { openAssistantCitation(value: { kind: "evidence"; reference_id: string }): Promise<void> }).openAssistantCitation({ kind: "evidence", reference_id: "evidence-1" });
    // Evidence lives inside the "통관 심사" stage now; the flow follows the mockup's stage bar.
    expect(window.location.hash).toBe("#/cases/case-1/review");
    app.destroy();
  });

  it("switches the local session to an independent approver and preserves correction child-run history", async () => {
    window.location.hash = "#/cases/case-1/history";
    const root = document.createElement("div");
    const caseDetail = { case_id: "case-1", org_id: "local-org", title: "입항 서류", status: "in_review" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z" };
    const parentRun = reviewRun();
    const parentAnalysis = parentRun.document_analyses[0];
    if (!parentAnalysis) throw new Error("review fixture analysis is absent");
    const childRun = {
      ...parentRun,
      review_run_id: "run-child-1",
      job_id: "job-child-1",
      created_at: "2026-08-05T00:03:00Z",
      parent_review_run_id: "run-1",
      applied_correction_proposal_ids: ["proposal-1"],
      document_analyses: [{
        ...parentAnalysis,
        facts: [...parentAnalysis.facts, {
          fact_id: "fact-human-1", name: "quantity", raw_value: "12", normalized_value: "12", unit: "EA",
          source: { source_kind: "human_provided" as const, document_id: "document-1", correction_proposal_id: "proposal-1", reason: "Packing List 원문 확인" },
        }],
      }],
    };
    const parentSummary = { review_run_id: "run-1", case_id: "case-1", job_id: "job-1", review_as_of: "2026-08-05", trade_type: "import" as const, execution_status: "succeeded" as const, assessment: "issues_detected" as const, review_disposition: "human_review_required" as const, result_digest: "b".repeat(64), finding_count: 1, reviewer_decision_count: 0, created_at: "2026-08-05T00:00:00Z" };
    const childSummary = { ...parentSummary, review_run_id: "run-child-1", job_id: "job-child-1", parent_review_run_id: "run-1", applied_correction_proposal_ids: ["proposal-1"], created_at: "2026-08-05T00:03:00Z" };
    let actor: "reviewer" | "approver" = "reviewer";
    let approved = false;
    const proposal = {
      correction_proposal_id: "proposal-1", review_run_id: "run-1", finding_id: "finding-1", document_id: "document-1", fact_id: "fact-1",
      field_name: "quantity", new_value: "12", unit: "EA", reason: "Packing List 원문 확인", status: "proposed" as const,
      created_by: "local-reviewer", created_at: "2026-08-05T00:02:00Z", history: [{ event: "proposed" as const, reason: "Packing List 원문 확인", actor: "local-reviewer", occurred_at: "2026-08-05T00:02:00Z" }],
    };
    const api = {
      getSession: vi.fn(async () => ({ subject: actor === "approver" ? "local-approver" : "local-reviewer", org_id: "local-org", roles: [actor] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })),
      getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => [{ document_id: "document-1", case_id: "case-1", document_type: "CI" as const, filename: "invoice.txt", media_type: "text/plain" as const, content_sha256: "a".repeat(64), byte_size: 12, character_count: 12, created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z" }]),
      listReviewRuns: vi.fn(async () => approved ? [childSummary, parentSummary] : [parentSummary]),
      getReviewRun: vi.fn(async (runId: string) => runId === "run-child-1" ? childRun : parentRun),
      listCorrectionProposals: vi.fn(async () => [approved ? {
        ...proposal, status: "approved" as const, decision: { status: "approved" as const, reason: "독립 검토 완료", decided_by: "local-approver", decided_at: "2026-08-05T00:02:30Z" },
        history: [...proposal.history, { event: "approved" as const, reason: "독립 검토 완료", actor: "local-approver", occurred_at: "2026-08-05T00:02:30Z" }],
      } : proposal]),
      decideCorrectionProposal: vi.fn(async () => {
        approved = true;
        return {
          ...proposal, status: "approved" as const, decision: { status: "approved" as const, reason: "독립 검토 완료", decided_by: "local-approver", decided_at: "2026-08-05T00:02:30Z" },
          history: [...proposal.history, { event: "approved" as const, reason: "독립 검토 완료", actor: "local-approver", occurred_at: "2026-08-05T00:02:30Z" }],
        };
      }),
      enqueueRevision: vi.fn(async () => ({ job_id: "job-child-1", case_id: "case-1", review_run_id: "run-child-1", status: "succeeded" as const, created_by: "local-approver", created_at: "2026-08-05T00:03:00Z", updated_at: "2026-08-05T00:03:00Z" })),
    };
    const auth = {
      logout: async () => undefined,
      freshAccessToken: async () => "token",
      isAuthenticated: () => true,
      switchActor: vi.fn(async (next: "reviewer" | "approver") => { actor = next; }),
    };
    const app = new LightweightWorkbench(root, api as never, auth, "local-development");
    await app.start();
    expect(root.textContent).toContain("제안자는 자신의 제안을 승인하거나 반려할 수 없습니다.");
    expect(root.querySelector(".correction-decision-form")).toBeNull();

    await (app as unknown as { switchDevelopmentActor(value: "approver"): Promise<void> }).switchDevelopmentActor("approver");
    await (app as unknown as { ensureCorrectionProposalsLoaded(): Promise<void> }).ensureCorrectionProposalsLoaded();
    expect(auth.switchActor).toHaveBeenCalledWith("approver");
    expect(root.textContent).toContain("local-approver");
    expect(root.querySelector(".correction-decision-form")).not.toBeNull();

    const decisionForm = root.querySelector<HTMLFormElement>(".correction-decision-form");
    expect(decisionForm).not.toBeNull();
    const decisionSelect = decisionForm?.querySelector<HTMLSelectElement>('select[name="status"]');
    const decisionReason = decisionForm?.querySelector<HTMLTextAreaElement>('textarea[name="reason"]');
    if (!decisionForm || !decisionSelect || !decisionReason) throw new Error("approval form is unavailable");
    decisionSelect.value = "approved";
    decisionReason.value = "독립 검토 완료";
    await (app as unknown as { decideCorrectionProposal(value: typeof proposal, form: HTMLFormElement): Promise<void> }).decideCorrectionProposal(proposal, decisionForm);

    await expect((app as unknown as { startRevision(): Promise<void> }).startRevision()).rejects.toThrow("한 건 이상 선택");
    expect(api.enqueueRevision).not.toHaveBeenCalled();
    const revisionCheckbox = root.querySelector<HTMLInputElement>('[data-correction-proposal-id="proposal-1"]');
    if (!revisionCheckbox) throw new Error("approved correction selection is unavailable");
    revisionCheckbox.checked = true;
    revisionCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    await (app as unknown as { startRevision(): Promise<void> }).startRevision();

    expect(api.enqueueRevision).toHaveBeenCalledWith("run-1", { proposal_ids: ["proposal-1"] }, expect.any(String));
    window.location.hash = "#/cases/case-1/history";
    await (app as unknown as { followRoute(): Promise<void> }).followRoute();
    expect(root.textContent).toContain("정정 반영 자식 실행");
    window.location.hash = "#/cases/case-1/analysis";
    await (app as unknown as { followRoute(): Promise<void> }).followRoute();
    expect(root.textContent).toContain("사람 제공 값");
    app.destroy();
  });
});
