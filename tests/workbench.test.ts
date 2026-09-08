import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LightweightWorkbench } from "../src/workbench";

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.useRealTimers();
  window.location.hash = "#/cases";
});

/** Lets queued work settle: hashchange, promise continuations, and the render they cause. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function click(element: Element | null | undefined): Promise<void> {
  if (!(element instanceof HTMLElement)) throw new Error("clickable element is unavailable");
  await act(async () => {
    element.click();
  });
  await flush();
}

/**
 * Writes through React's value tracker so a controlled input actually updates.
 * Assigning `.value` alone is swallowed by React's change de-duplication.
 */
function setValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element) as object, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

async function submit(form: HTMLFormElement | null | undefined): Promise<void> {
  if (!form) throw new Error("form is unavailable");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await flush();
}

const AUTH = { logout: async () => undefined, freshAccessToken: async () => "token", isAuthenticated: () => true };

const DOCUMENT = {
  document_id: "document-1", case_id: "case-1", document_type: "CI" as const, filename: "invoice.txt",
  media_type: "text/plain" as const, content_sha256: "a".repeat(64), byte_size: 12, character_count: 12,
  created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z",
};

const RUN_SUMMARY = {
  review_run_id: "run-1", case_id: "case-1", job_id: "job-1", review_as_of: "2026-08-05", trade_type: "import" as const,
  execution_status: "succeeded" as const, assessment: "issues_detected" as const,
  review_disposition: "human_review_required" as const, result_digest: "b".repeat(64), finding_count: 1,
  reviewer_decision_count: 0, created_at: "2026-08-05T00:00:00Z",
};

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

async function mount(api: unknown, auth: unknown, mode: "local-development" | "functional-uat") {
  const root = document.createElement("div");
  document.body.append(root);
  const app = new LightweightWorkbench(root, api as never, auth as never, mode);
  await act(async () => {
    await app.start();
  });
  await flush();
  return {
    root,
    app,
    dispose: () => {
      app.destroy();
      root.remove();
    },
  };
}

describe("chrome, home, and records", () => {
  it("names the signed-in person readably, shows role chips, and never prints the session UUID", async () => {
    window.location.hash = "#/cases";
    const subject = "7cc8fe39-ac47-4c6f-8411-f9ff84175eb7";
    const api = {
      getSession: async () => ({ subject, org_id: "local-functional", roles: ["approver", "reviewer"] }),
      listCases: async () => ({ items: [] }),
    };
    const { root, dispose } = await mount(api, AUTH, "functional-uat");
    const user = root.querySelector("[data-session-user]");
    expect(user?.textContent).not.toContain(subject);
    expect(user?.textContent).toContain("기관 계정");
    expect(Array.from(user?.querySelectorAll(".role-chip") ?? []).map((chip) => chip.textContent)).toEqual(["승인자", "심사자"]);
    expect(user?.querySelector(".user__name")?.getAttribute("title")).toContain(subject);
    // One header row: the text-size control now lives beside the identity instead of in a separate bar.
    expect(root.querySelector(".g-utilbar")).toBeNull();
    expect(root.querySelector(".topbar .g-zoom")).not.toBeNull();
    dispose();
  });

  it("lists the reviewer's pending in-review cases on the home page and jumps to a filtered inbox", async () => {
    window.location.hash = "#/home";
    const at = "2026-08-05T00:00:00Z";
    const cases = [
      { case_id: "case-a", org_id: "local-org", title: "종료된 건", status: "closed" as const, revision: 1, updated_at: at },
      { case_id: "case-b", org_id: "local-org", title: "판단 대기 건", external_reference: "IMP-1", status: "in_review" as const, revision: 1, updated_at: "2026-08-06T00:00:00Z" },
      { case_id: "case-c", org_id: "local-org", title: "새 건", status: "open" as const, revision: 1, updated_at: at },
    ];
    const api = {
      getSession: async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] }),
      listCases: async () => ({ items: cases }),
    };
    const { root, dispose } = await mount(api, AUTH, "local-development");
    expect(root.textContent).not.toContain("바로 가기");
    const todo = root.querySelector("[data-home-todo]");
    expect(todo?.querySelectorAll(".home-todo__row")).toHaveLength(1);
    expect(todo?.textContent).toContain("판단 대기 건");
    expect(todo?.textContent).not.toContain("종료된 건");
    // The pipeline shown on home is the workspace's own four stages.
    expect(root.textContent).toContain("관세 진단");
    expect(root.textContent).not.toContain("AI 사전심사 · 제한형");

    await click(root.querySelector('[data-home-page] .dash-stat[data-case-filter="closed"]'));
    expect(window.location.hash).toBe("#/cases");
    expect(root.querySelector('.dash-stat[data-case-filter="closed"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelectorAll(".case-row")).toHaveLength(1);
    dispose();
  });

  it("shows review records as counts with the case title first, not a red badge over an internal id", async () => {
    window.location.hash = "#/records";
    const caseDetail = { case_id: "case-1", org_id: "local-org", title: "입항 서류", status: "in_review" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z" };
    const api = {
      getSession: async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] }),
      listCases: async () => ({ items: [caseDetail] }),
      listReviewRuns: async () => [{ ...RUN_SUMMARY, finding_count: 3, reviewer_decision_count: 1 }],
    };
    const { root, dispose } = await mount(api, AUTH, "local-development");
    const row = root.querySelector(".records-row");
    expect(row?.querySelector(".records-row__title")?.textContent).toBe("입항 서류");
    expect(row?.textContent).toContain("참조번호 미지정");
    expect(row?.textContent).not.toContain("case-1");
    expect(row?.querySelector(".badge")).toBeNull();
    const verdict = row?.querySelector("[data-record-verdict]");
    expect(verdict?.getAttribute("data-record-verdict")).toBe("pending");
    expect(verdict?.textContent).toContain("확인 3건 · 판단 1건");
    expect(verdict?.textContent).toContain("미판단 2건");
    dispose();
  });

  it("keeps the new-case submit disabled until a title is typed and explains the reference field", async () => {
    window.location.hash = "#/cases";
    const createCase = vi.fn(async () => ({ case_id: "case-new", org_id: "local-org", title: "새 건", status: "open" as const, revision: 0, updated_at: "2026-08-05T00:00:00Z" }));
    const api = {
      getSession: async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] }),
      listCases: async () => ({ items: [] }),
      createCase,
      getCase: async () => ({ case_id: "case-new", org_id: "local-org", title: "새 건", status: "open" as const, revision: 0, updated_at: "2026-08-05T00:00:00Z" }),
      listDocuments: async () => [],
      listDocumentAssets: async () => [],
      listReviewRuns: async () => [],
    };
    const { root, dispose } = await mount(api, AUTH, "local-development");
    await click(root.querySelector(".new-btn"));
    const form = root.querySelector<HTMLFormElement>(".case-create-form");
    const submitButton = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!form || !submitButton) throw new Error("create-case form is unavailable");
    expect(submitButton.disabled).toBe(true);
    expect(submitButton.className).toContain("button--primary");
    expect(form.textContent).toContain("수입신고번호·사내 관리번호");
    const title = form.querySelector<HTMLInputElement>('input[name="title"]');
    if (!title) throw new Error("title input is unavailable");
    setValue(title, "새 건");
    expect(submitButton.disabled).toBe(false);
    await submit(form);
    expect(createCase).toHaveBeenCalledWith({ title: "새 건", external_reference: null });
    dispose();
  });
});

describe("commercial review workspace", () => {
  it("renders the no-secret local-development workspace", async () => {
    window.location.hash = "#/cases";
    const api = {
      getSession: async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] }),
      listCases: async () => ({ items: [] }),
    };
    const { root, dispose } = await mount(api, AUTH, "local-development");
    expect(root.textContent).toContain("심사 워크스페이스로 이동합니다.");
    expect(root.textContent).toContain("팀 개발 환경");
    // The footer speaks to the person, not about the design system.
    expect(root.querySelector(".g-footer")?.textContent).toContain("문의: 시스템 관리자");
    expect(root.querySelector(".g-footer")?.textContent).not.toContain("KRDS");
    expect(root.textContent).toContain("검토 중");
    expect(root.textContent).not.toContain("릴리스");
    dispose();
  });

  it("groups the inbox by status under 전체 and lists a flat table under one filter", async () => {
    window.location.hash = "#/cases";
    const at = "2026-08-05T00:00:00Z";
    const cases = [
      { case_id: "case-a", org_id: "local-org", title: "종료된 건", status: "closed" as const, revision: 1, updated_at: at },
      { case_id: "case-b", org_id: "local-org", title: "판단 대기 건", status: "in_review" as const, revision: 1, updated_at: at },
      { case_id: "case-c", org_id: "local-org", title: "새 건", status: "open" as const, revision: 1, updated_at: at },
    ];
    const api = {
      getSession: async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] }),
      listCases: async () => ({ items: cases }),
    };
    const { root, dispose } = await mount(api, AUTH, "local-development");
    const groups = Array.from(root.querySelectorAll<HTMLElement>("[data-case-group]")).map((item) => item.dataset.caseGroup);
    expect(groups).toEqual(["in_review", "open", "closed"]);
    expect(root.querySelector('[data-case-group="in_review"] .case-group__head')?.textContent).toContain("1건");
    // Reference material (state flow, pipeline) no longer sits under the work list; it lives on the guide page.
    expect(root.querySelector(".state-flow__svg")).toBeNull();
    expect(root.querySelector(".dash-filter")).toBeNull();
    // An internal case id is never shown as a reference.
    expect(root.textContent).not.toContain("case-a");
    expect(root.querySelectorAll(".case-row__ref--none")).toHaveLength(3);

    const closedFilter = root.querySelector<HTMLButtonElement>('.dash-stat[data-case-filter="closed"]');
    await click(closedFilter);
    expect(closedFilter?.getAttribute("aria-pressed")).toBe("true");
    expect(Array.from(root.querySelectorAll<HTMLElement>("[data-case-group]")).map((item) => item.dataset.caseGroup)).toEqual(["filtered"]);
    expect(root.querySelectorAll(".case-row")).toHaveLength(1);
    dispose();
  });

  it("titles findings in Korean, shows the comparison sentence once, and records a preset decision rationale", async () => {
    window.location.hash = "#/cases/case-1/review";
    const caseDetail = { case_id: "case-1", org_id: "local-org", title: "입항 서류", status: "in_review" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z" };
    const run = reviewRun();
    run.comparisons[0]!.rule_code = "invoice_packing_quantity_unit";
    run.findings[0]!.code = "invoice_packing_quantity_unit";
    run.required_actions = [
      { action_code: "human_review_required", message: "수량이 일치하지 않습니다.", finding_ids: ["finding-1"] },
      { action_code: "human_review_required", message: "자동 승인하지 않습니다.", finding_ids: [] },
    ];
    const recorded = {
      finding_id: "finding-1", status: "confirmed" as const, reason_code: "notation_difference" as const,
      reason: "표기·단위·반올림 차이로 실질 불일치 아님", decided_by: "local-reviewer", decided_at: "2026-08-05T00:05:00Z",
      history: [{ status: "confirmed" as const, reason_code: "notation_difference" as const, reason: "표기·단위·반올림 차이로 실질 불일치 아님", decided_by: "local-reviewer", decided_at: "2026-08-05T00:05:00Z" }],
    };
    const api = {
      getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })),
      getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => [DOCUMENT]),
      listDocumentAssets: vi.fn(async () => []),
      listReviewRuns: vi.fn(async () => [RUN_SUMMARY]),
      getReviewRun: vi.fn(async () => run),
      setFindingDecision: vi.fn(async () => recorded),
    };
    const { root, dispose } = await mount(api, AUTH, "local-development");

    const card = root.querySelector('[data-finding-id="finding-1"]');
    expect(card).not.toBeNull();
    expect(card?.querySelector(".finding-heading strong")?.textContent).toBe("Invoice·Packing List 수량·단위 비교");
    expect(card?.textContent).not.toContain("invoice_packing_quantity_unit");
    expect(card?.querySelector(".severity")).toBeNull();
    // The Agent repeats the comparison sentence in the finding; the card shows it once.
    expect((card?.textContent?.match(/수량이 일치하지 않습니다\./gu) ?? []).length).toBe(1);
    expect(root.querySelector(".next-step-list")?.textContent).not.toContain("human_review_required");
    expect(root.querySelector(".next-step-list")?.textContent).toContain("확인 사항 판단");
    expect(root.querySelector(".issuebar__chip:last-child")?.textContent).toContain("우선 확인 · Invoice·Packing List 수량·단위 비교");

    const form = card?.querySelector<HTMLFormElement>(".decision-form");
    const reasonCode = form?.querySelector<HTMLSelectElement>('select[name="reason_code"]');
    const reason = form?.querySelector<HTMLTextAreaElement>('textarea[name="reason"]');
    if (!form || !reasonCode || !reason) throw new Error("decision form is unavailable");
    expect(reason.required).toBe(false);
    setValue(reasonCode, "other");
    expect(reason.required).toBe(true);
    setValue(reasonCode, "notation_difference");
    const statusSelect = form.querySelector<HTMLSelectElement>('select[name="status"]');
    if (!statusSelect) throw new Error("decision status select is unavailable");
    setValue(statusSelect, "confirmed");
    await submit(form);
    expect(api.setFindingDecision).toHaveBeenCalledWith("run-1", "finding-1", { status: "confirmed", reason_code: "notation_difference", reason: "" });
    expect(card?.querySelector(".decision-reason-code")?.textContent).toBe("표기·단위·반올림 차이로 실질 불일치 아님");
    expect(card?.textContent).toContain("판단 기록됨");
    dispose();
  });

  it("opens a synchronous completed result and exposes workflow, comparison, and reviewer action", async () => {
    window.location.hash = "#/cases/case-1/documents";
    const caseDetail = { case_id: "case-1", org_id: "local-org", title: "입항 서류", status: "in_review" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z" };
    const job = { job_id: "job-1", case_id: "case-1", review_run_id: "run-1", status: "succeeded" as const, created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z", updated_at: "2026-08-05T00:00:00Z" };
    const run = reviewRun();
    const api = {
      getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })),
      getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => [DOCUMENT]),
      listDocumentAssets: vi.fn(async () => []),
      listReviewRuns: vi.fn(async () => [RUN_SUMMARY]),
      enqueueReview: vi.fn(async () => job),
      getReviewRun: vi.fn(async () => run),
      getJob: vi.fn(async () => { throw new Error("a synchronously completed Job must not be polled"); }),
      getHsClassification: vi.fn(async () => ({
        review_run_id: "run-1",
        case_id: "case-1",
        reference: { as_of: "2026-01-01", source: "관세청 HS부호 단위별 품목명" },
        candidates: [{
          code: "0303540000", name_ko: "고등어", name_en: "Mackerel",
          ancestors: [{ level: 2, code: "03", name_ko: "어류" }],
          confidence: 1, in_reference: true, recommended: true,
          basis: [{ document_id: "document-1", fact_id: "fact-1", fact_name: "hs_code", raw_value: "0303540000" }],
        }],
      })),
    };
    const { root, dispose } = await mount(api, AUTH, "functional-uat");

    // The stage-1 HSK card is fed by the Backend-derived classification view.
    expect(api.getHsClassification).toHaveBeenCalledWith("run-1");
    expect(root.textContent).toContain("HSK 분류");
    const candidateRow = root.querySelector('[data-hsk-candidate-code="0303540000"]');
    expect(candidateRow?.textContent).toContain("고등어");
    expect(candidateRow?.textContent).toContain("추천");

    await click(root.querySelector(".case-actions .btn.primary"));

    expect(api.getJob).not.toHaveBeenCalled();
    expect(api.getReviewRun).toHaveBeenCalledWith("run-1");
    // A finished review announces itself but must not yank the user off the
    // stage they are on; the issue bar offers the jump to stage 3 instead.
    expect(root.textContent).toContain("심사가 완료되었습니다");
    expect(root.textContent).toContain("HSK 분류");
    const goToReview = Array.from(root.querySelectorAll<HTMLButtonElement>(".issuebar__chip"))
      .find((item) => item.textContent?.includes("통관 심사로"));
    expect(goToReview).toBeDefined();
    await click(goToReview);

    expect(root.textContent).toContain("처리 과정과 실행 상태");
    expect(root.textContent).toContain("문서 간 비교");
    expect(root.textContent).toContain("담당자 판단 기록");
    expect(root.querySelectorAll("[data-report-section]")).toHaveLength(8);
    expect(root.querySelector("[data-planner-trace]")?.textContent).toContain("제한형 계획");
    expect(root.textContent).toContain("심사가 완료되었습니다");

    const comparisonCitation = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-report-claim-id="claim-3"] .citation-chip'))
      .find((item) => item.textContent?.includes("문서 비교"));
    expect(comparisonCitation).toBeDefined();
    await click(comparisonCitation);
    expect(root.querySelector('[data-comparison-id="comparison-1"]')?.classList.contains("is-focused")).toBe(true);
    dispose();
  });

  it("opens the assistant route, preserves conversation history, sends a question, and follows evidence citations", async () => {
    window.location.hash = "#/cases/case-1/assistant";
    const caseDetail = { case_id: "case-1", org_id: "local-org", title: "입항 서류", status: "in_review" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z" };
    const conversation = { conversation_id: "conversation-1", review_run_id: "run-1", title: "수량 검토", created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z", updated_at: "2026-08-05T00:00:00Z" };
    const userMessage = { message_id: "message-user-1", conversation_id: "conversation-1", role: "user" as const, content: "수량을 확인해 줘", citations: [], suggested_questions: [], created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z" };
    const assistantMessage = { message_id: "message-assistant-1", conversation_id: "conversation-1", role: "assistant" as const, content: "문서 간 비교 결과를 확인하십시오.", answer_scope: "case_grounded" as const, citations: [{ kind: "evidence" as const, reference_id: "evidence-1" }], suggested_questions: ["원문 인용을 보여줘"], correction_draft: { document_id: "document-1", fact_id: "fact-1", field_name: "quantity", new_value: "12", unit: "EA", reason: "원문 확인" }, created_by: "agent", created_at: "2026-08-05T00:00:01Z" };
    const run = reviewRun();
    const api = {
      getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })),
      getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => [DOCUMENT]),
      listDocumentAssets: vi.fn(async () => []),
      listReviewRuns: vi.fn(async () => [RUN_SUMMARY]),
      getReviewRun: vi.fn(async () => run),
      listAssistantConversations: vi.fn(async () => [conversation]),
      listAssistantMessages: vi.fn(async () => [userMessage, assistantMessage]),
      sendAssistantMessage: vi.fn(async () => ({
        user_message: { ...userMessage, message_id: "message-user-2", content: "근거를 열어 줘", created_at: "2026-08-05T00:01:00Z" },
        assistant_message: { ...assistantMessage, message_id: "message-assistant-2", content: "Evidence를 열었습니다.", created_at: "2026-08-05T00:01:01Z" },
      })),
      createAssistantConversation: vi.fn(async () => conversation),
    };
    const { root, dispose } = await mount(api, AUTH, "local-development");

    expect(root.textContent).toContain("AI 도우미");
    expect(root.textContent).toContain("문서 간 비교 결과를 확인하십시오.");

    const composer = root.querySelector<HTMLTextAreaElement>('textarea[name="assistant_message"]');
    if (!composer) throw new Error("assistant composer is unavailable");
    setValue(composer, "근거를 열어 줘");
    await submit(root.querySelector<HTMLFormElement>(".assistant-composer"));

    expect(api.sendAssistantMessage).toHaveBeenCalled();
    expect(root.textContent).toContain("Evidence를 열었습니다.");

    const evidenceCitation = Array.from(root.querySelectorAll<HTMLButtonElement>(".assistant-citations .citation-chip"))
      .find((item) => item.textContent?.includes("법령정보"));
    await click(evidenceCitation);
    // 법령정보 lives inside the "통관 심사" stage now; the flow follows the mockup's stage bar.
    expect(window.location.hash).toBe("#/cases/case-1/review");
    dispose();
  });

  it("switches the local session to an independent approver and preserves correction child-run history", async () => {
    window.location.hash = "#/cases/case-1/history";
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
    const childSummary = { ...RUN_SUMMARY, review_run_id: "run-child-1", job_id: "job-child-1", parent_review_run_id: "run-1", applied_correction_proposal_ids: ["proposal-1"], created_at: "2026-08-05T00:03:00Z" };
    let actor: "reviewer" | "approver" = "reviewer";
    let approved = false;
    const proposal = {
      correction_proposal_id: "proposal-1", review_run_id: "run-1", finding_id: "finding-1", document_id: "document-1", fact_id: "fact-1",
      field_name: "quantity", new_value: "12", unit: "EA", reason: "Packing List 원문 확인", status: "proposed" as const,
      created_by: "local-reviewer", created_at: "2026-08-05T00:02:00Z", history: [{ event: "proposed" as const, reason: "Packing List 원문 확인", actor: "local-reviewer", occurred_at: "2026-08-05T00:02:00Z" }],
    };
    const approvedProposal = {
      ...proposal, status: "approved" as const,
      decision: { status: "approved" as const, reason: "독립 검토 완료", decided_by: "local-approver", decided_at: "2026-08-05T00:02:30Z" },
      history: [...proposal.history, { event: "approved" as const, reason: "독립 검토 완료", actor: "local-approver", occurred_at: "2026-08-05T00:02:30Z" }],
    };
    const api = {
      getSession: vi.fn(async () => ({ subject: actor === "approver" ? "local-approver" : "local-reviewer", org_id: "local-org", roles: [actor] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })),
      getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => [DOCUMENT]),
      listDocumentAssets: vi.fn(async () => []),
      listReviewRuns: vi.fn(async () => (approved ? [childSummary, RUN_SUMMARY] : [RUN_SUMMARY])),
      getReviewRun: vi.fn(async (runId: string) => (runId === "run-child-1" ? childRun : parentRun)),
      listCorrectionProposals: vi.fn(async () => [approved ? approvedProposal : proposal]),
      decideCorrectionProposal: vi.fn(async () => {
        approved = true;
        return approvedProposal;
      }),
      enqueueRevision: vi.fn(async () => ({ job_id: "job-child-1", case_id: "case-1", review_run_id: "run-child-1", status: "succeeded" as const, created_by: "local-approver", created_at: "2026-08-05T00:03:00Z", updated_at: "2026-08-05T00:03:00Z" })),
    };
    const auth = { ...AUTH, switchActor: vi.fn(async (next: "reviewer" | "approver") => { actor = next; }) };
    const { root, dispose } = await mount(api, auth, "local-development");

    expect(root.textContent).toContain("제안자는 자신의 제안을 승인하거나 반려할 수 없습니다.");
    expect(root.querySelector(".correction-decision-form")).toBeNull();

    const approverChip = Array.from(root.querySelectorAll<HTMLButtonElement>(".local-role-switch .g-chip"))
      .find((item) => item.textContent === "승인자");
    await click(approverChip);
    expect(auth.switchActor).toHaveBeenCalledWith("approver");
    expect(root.textContent).toContain("local-approver");

    const decisionForm = root.querySelector<HTMLFormElement>(".correction-decision-form");
    expect(decisionForm).not.toBeNull();
    const decisionSelect = decisionForm?.querySelector<HTMLSelectElement>('select[name="status"]');
    const decisionReason = decisionForm?.querySelector<HTMLTextAreaElement>('textarea[name="reason"]');
    if (!decisionForm || !decisionSelect || !decisionReason) throw new Error("approval form is unavailable");
    setValue(decisionSelect, "approved");
    setValue(decisionReason, "독립 검토 완료");
    await submit(decisionForm);
    expect(api.decideCorrectionProposal).toHaveBeenCalled();

    // Revising without picking an approved proposal is refused, and says so on screen.
    const reviseButton = Array.from(root.querySelectorAll<HTMLButtonElement>(".history-next .btn.primary"))
      .find((item) => item.textContent?.includes("재심사"));
    expect(reviseButton?.disabled).toBe(true);
    expect(api.enqueueRevision).not.toHaveBeenCalled();

    await click(root.querySelector('[data-correction-proposal-id="proposal-1"]'));
    await click(Array.from(root.querySelectorAll<HTMLButtonElement>(".history-next .btn.primary"))
      .find((item) => item.textContent?.includes("재심사")));

    expect(api.enqueueRevision).toHaveBeenCalledWith("run-1", { proposal_ids: ["proposal-1"] }, expect.any(String));

    window.location.hash = "#/cases/case-1/history";
    await flush();
    expect(root.textContent).toContain("정정 반영 재심사");
    // Reviewers see the file name and a Korean field name, never raw identifiers.
    expect(root.textContent).toContain("수량 → 12 EA");
    expect(root.textContent).not.toContain("문서 document-1");

    window.location.hash = "#/cases/case-1/analysis";
    await flush();
    expect(root.textContent).toContain("사람 제공 값");
    dispose();
  });

  it("polls text-only OCR through running, revokes the transient original, and confirms only edited text", async () => {
    window.location.hash = "#/cases/case-1/documents";
    const caseDetail = { case_id: "case-1", org_id: "local-org", title: "스캔 서류", status: "open" as const, revision: 0, updated_at: "2026-08-29T00:00:00Z" };
    const asset = {
      asset_id: "asset-ocr-1", case_id: "case-1", document_type: "CI" as const, filename: "scan.png",
      media_type: "image/png" as const, byte_size: 4, page_count: 1, pixel_count: 1,
      created_by: "local-reviewer", created_at: "2026-08-29T00:00:00Z",
    };
    const jobBase = {
      raster_text_extraction_job_id: "raster-text-job-1", asset_id: asset.asset_id, case_id: asset.case_id,
      profile_revision: "synthetic-raster-text-v1:9eb7f34b", attempt_count: 1,
      created_by: "local-reviewer", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:01Z",
    };
    const envelope = (status: "queued" | "running" | "needs_review") => ({
      asset,
      job: {
        ...jobBase,
        status,
        ...(status === "needs_review" ? {
          result: {
            status: "needs_review" as const,
            pages: [{ page_number: 1, text: "INVOICE 001", confidence: 0.976 }],
            canonical_text: "INVOICE 001",
            warnings: ["human_confirmation_required"],
            needs_review_reasons: ["ocr_low_confidence"],
          },
        } : {}),
      },
      idempotency_reused: false,
      current_profile_revision: jobBase.profile_revision,
      profile_superseded: false,
    });
    const confirmedDocument = { ...DOCUMENT, document_id: "document-ocr-1", filename: "scan.txt", character_count: 18 };
    let confirmed = false;
    const getRasterTextExtraction = vi.fn()
      .mockResolvedValueOnce(envelope("running"))
      .mockResolvedValueOnce(envelope("needs_review"));
    const api = {
      getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })),
      getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => confirmed ? [confirmedDocument] : []),
      listDocumentAssets: vi.fn(async () => [asset]),
      listReviewRuns: vi.fn(async () => []),
      requestRasterTextExtraction: vi.fn(async () => envelope("queued")),
      getRasterTextExtraction,
      getDocumentAssetSource: vi.fn(async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })),
      confirmExtractedText: vi.fn(async () => {
        confirmed = true;
        return confirmedDocument;
      }),
    };
    const createObjectUrl = vi.fn(() => "blob:ocr-source");
    const revokeObjectUrl = vi.fn();
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });
    const { root, dispose } = await mount(api, AUTH, "local-development");

    expect(root.textContent).toContain("표·셀·위치 구조는 만들거나 추정하지 않습니다.");
    vi.useFakeTimers();
    const requestButton = Array.from(root.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "스캔·이미지 OCR 실행");
    await act(async () => {
      requestButton?.click();
      await Promise.resolve();
    });
    expect(root.textContent).toContain("OCR 대기");
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(root.textContent).toContain("OCR 처리 중");
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(root.textContent).toContain("OCR 추가 확인 필요");
    expect(getRasterTextExtraction).toHaveBeenCalledTimes(2);
    vi.useRealTimers();

    const openSource = Array.from(root.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "원본과 OCR 텍스트 대조");
    await click(openSource);
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(root.querySelector<HTMLImageElement>(".raster-text-source-viewer__image")?.src).toContain("blob:ocr-source");
    await click(Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "원본 닫기"));
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:ocr-source");
    await click(Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "원본과 OCR 텍스트 대조"));

    const form = root.querySelector<HTMLFormElement>(".raster-text-confirm-panel form");
    const text = form?.querySelector<HTMLTextAreaElement>('textarea[name="raster_text_confirmed_text"]');
    if (!form || !text) throw new Error("OCR confirmation form is unavailable");
    setValue(text, "INVOICE 001 EDITED");
    await submit(form);
    expect(api.confirmExtractedText).toHaveBeenCalledWith("case-1", "asset-ocr-1", {
      raster_text_extraction_job_id: "raster-text-job-1",
      content_text: "INVOICE 001 EDITED",
      filename: "scan.txt",
    });
    expect(root.textContent).toContain("문서로 확정됨");
    expect(revokeObjectUrl).toHaveBeenCalledTimes(2);
    dispose();
    vi.useRealTimers();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
  });

  it("fails closed when no OCR profile is active or a previous profile is superseded", async () => {
    window.location.hash = "#/cases/case-1/documents";
    const caseDetail = { case_id: "case-1", org_id: "local-org", title: "스캔 서류", status: "open" as const, revision: 0, updated_at: "2026-08-29T00:00:00Z" };
    const asset = {
      asset_id: "asset-ocr-unavailable", case_id: "case-1", document_type: "CI" as const, filename: "scan.jpg",
      media_type: "image/jpeg" as const, byte_size: 4, page_count: 1, pixel_count: 1,
      created_by: "local-reviewer", created_at: "2026-08-29T00:00:00Z",
    };
    const unavailable = {
      asset,
      job: {
        raster_text_extraction_job_id: "raster-text-job-old", asset_id: asset.asset_id, case_id: asset.case_id,
        profile_revision: "synthetic-raster-text-v1:old", status: "unavailable" as const, attempt_count: 0,
        error_code: "raster_text_profile_unavailable",
        result: {
          status: "unavailable" as const, pages: [], canonical_text: null,
          warnings: ["raster_text_profile_unavailable"], needs_review_reasons: [],
        },
        created_by: "local-reviewer", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:01Z",
      },
      idempotency_reused: false,
      current_profile_revision: null,
      profile_superseded: true,
    };
    const api = {
      getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })), getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => []), listDocumentAssets: vi.fn(async () => [asset]), listReviewRuns: vi.fn(async () => []),
      requestRasterTextExtraction: vi.fn(async () => unavailable),
    };
    const { root, dispose } = await mount(api, AUTH, "local-development");
    await click(Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "스캔·이미지 OCR 실행"));
    expect(root.textContent).toContain("OCR 프로필이 바뀌어 이전 초안은 등록할 수 없습니다.");
    expect(root.textContent).toContain("현재 사용할 수 있는 OCR 텍스트 프로필이 없습니다.");
    expect(root.querySelector(".raster-text-confirm-panel")).toBeNull();
    expect(root.textContent).toContain("현재 프로필로 새 OCR 요청");
    dispose();
  });

  it("bounds queued or running OCR polling to twenty checks over sixty seconds", async () => {
    window.location.hash = "#/cases/case-1/documents";
    const caseDetail = { case_id: "case-1", org_id: "local-org", title: "스캔 서류", status: "open" as const, revision: 0, updated_at: "2026-08-29T00:00:00Z" };
    const asset = {
      asset_id: "asset-ocr-running", case_id: "case-1", document_type: "CI" as const, filename: "scan.pdf",
      media_type: "application/pdf" as const, byte_size: 4, page_count: 1, pixel_count: 0,
      created_by: "local-reviewer", created_at: "2026-08-29T00:00:00Z",
    };
    const makeEnvelope = (status: "queued" | "running") => ({
      asset,
      job: {
        raster_text_extraction_job_id: "raster-text-job-running", asset_id: asset.asset_id, case_id: asset.case_id,
        profile_revision: "synthetic-raster-text-v1:9eb7f34b", status, attempt_count: status === "queued" ? 0 : 1,
        created_by: "local-reviewer", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:01Z",
      },
      idempotency_reused: false,
      current_profile_revision: "synthetic-raster-text-v1:9eb7f34b",
      profile_superseded: false,
    });
    const getRasterTextExtraction = vi.fn(async () => makeEnvelope("running"));
    const api = {
      getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
      listCases: vi.fn(async () => ({ items: [caseDetail] })), getCase: vi.fn(async () => caseDetail),
      listDocuments: vi.fn(async () => []), listDocumentAssets: vi.fn(async () => [asset]), listReviewRuns: vi.fn(async () => []),
      requestRasterTextExtraction: vi.fn(async () => makeEnvelope("queued")), getRasterTextExtraction,
    };
    const { root, dispose } = await mount(api, AUTH, "local-development");
    vi.useFakeTimers();
    await act(async () => {
      Array.from(root.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "스캔·이미지 OCR 실행")?.click();
      await Promise.resolve();
      await vi.runAllTimersAsync();
    });
    expect(getRasterTextExtraction).toHaveBeenCalledTimes(20);
    expect(root.textContent).toContain("OCR 상태 자동 확인은 60초 후 멈췄습니다.");
    expect(root.textContent).toContain("OCR 상태 새로고침");
    dispose();
    vi.useRealTimers();
  });
});
