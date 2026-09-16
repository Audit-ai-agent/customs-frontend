import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LightweightWorkbench } from "../src/workbench";
import {
  displayComparisonValue,
  evidenceSourceHref,
  evidenceSourceLabel,
  findingDisplayTitle,
  fixParticles,
  humanizeFieldKeys,
  lawPortalHref,
  parseRequirementEvidence,
  requirementSentence,
  reviewerSentence,
} from "../src/ui/labels";

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.useRealTimers();
  window.location.hash = "#/cases";
});

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

const CASE = { case_id: "case-1", org_id: "local-org", title: "입항 서류", status: "in_review" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z" };

const DOCUMENT = {
  document_id: "document-1", case_id: "case-1", document_type: "CI" as const, filename: "invoice.txt",
  media_type: "text/plain" as const, content_sha256: "a".repeat(64), byte_size: 12, character_count: 12,
  created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z",
};

const RUN_SUMMARY = {
  review_run_id: "run-1", case_id: "case-1", job_id: "job-1", review_as_of: "2026-08-05", trade_type: "import" as const,
  execution_status: "succeeded" as const, assessment: "issues_detected" as const,
  review_disposition: "human_review_required" as const, result_digest: "b".repeat(64), finding_count: 3,
  reviewer_decision_count: 0, created_at: "2026-08-05T00:00:00Z",
};

const SOURCE = { source_kind: "document" as const, document_id: "document-1", quote: "10", occurrence: 0 };

function operand(display: string, factIds: string[] = []) {
  return { document_id: "document-1", item_id: null, fact_ids: factIds, display_value: display };
}

/** Three findings: two under the same known rule, one generic with a raw field key and a particle error. */
function reviewRun() {
  const sections = ["conclusion", "execution_process", "document_comparison", "issues_and_causes", "legal_evidence", "impact", "next_actions", "limitations"] as const;
  return {
    review_run_id: "run-1", case_id: "case-1", org_id: "local-org", job_id: "job-1", case_revision: 1,
    review_as_of: "2026-08-05", trade_type: "import" as const, execution_status: "succeeded" as const,
    assessment: "issues_detected" as const, review_disposition: "human_review_required" as const,
    completion_eligibility: { eligible: false as const, unmet_reason_codes: ["human_review_required"] },
    agent_schema_version: "3.3" as const, agent_status: "needs_review" as const, agent_engine: { kind: "deterministic" as const, model_id: "fixture" },
    report: {
      overall_status: "needs_review" as const, summary: "확인이 필요합니다.", disclaimer: "담당자 검토가 필요합니다.",
      sections: sections.map((section, index) => ({
        section, title: section,
        claims: [{ claim_id: `claim-${index + 1}`, text: "본문", fact_ids: [], comparison_ids: [], evidence_ids: [] }],
      })),
    },
    workflow: {
      status: "completed" as const,
      stages: [{ stage: "classify_documents" as const, status: "completed" as const, attempt_count: 1, summary: "문서를 판별했습니다." }],
      reextractions: [],
      planner: { cycle_count: 1 as const, actions: [{ cycle: 1 as const, action: "analyze_documents" as const, status: "completed" as const, summary: "문서를 분석했습니다.", correction_proposal_ids: [] }] },
      graph_trace: {
        framework: "langgraph" as const, iteration_count: 1 as const, loop_reason: null,
        node_runs: [
          { node: "extraction_agent" as const, iteration: 1 as const, status: "completed" as const, summary: "문서 1건을 분류·추출했습니다." },
          { node: "cross_validation_agent" as const, iteration: 1 as const, status: "needs_review" as const, summary: "코드 규칙 비교 3건: 불일치 2건." },
        ],
      },
    },
    agent_confidence: {
      overall: 0.62, threshold: 0.8, review_track: "detailed_review" as const, method: "deterministic_signals" as const,
      components: { extraction: 1, comparison: 0.5, evidence: 0.7 },
    },
    agent_eligibility_verdict: {
      verdict: "ineligible" as const, advisory: true as const, source: "rule" as const,
      reasons: [{ code: "document_mismatch", message: "상업송장과 포장명세서의 수량이 일치하지 않습니다.", finding_ids: ["finding-1"], evidence_ids: [] }],
    },
    document_analyses: [{
      document_id: "document-1", filename: "invoice.txt", declared_type: "invoice", document_type: "invoice" as const,
      classification_source: { ...SOURCE, quote: "INVOICE" }, extraction_status: "complete" as const,
      facts: [{ fact_id: "fact-1", name: "quantity", raw_value: "10", normalized_value: "10", unit: "EA", source: SOURCE }],
      line_items: [], warnings: [],
    }],
    comparisons: [
      { comparison_id: "comparison-1", rule_code: "invoice_packing_quantity_unit", status: "mismatch" as const, left: operand("10", ["fact-1"]), right: operand("12"), expected_value: "10", observed_value: "12", unit: "EA", message: "상업송장과 포장명세서의 수량이 일치하지 않습니다." },
      { comparison_id: "comparison-2", rule_code: "invoice_packing_quantity_unit", status: "mismatch" as const, left: operand("BOX", ["fact-1"]), right: operand("CTN"), expected_value: "BOX", observed_value: "CTN", unit: null, message: "상업송장과 포장명세서의 단위가 일치하지 않습니다." },
      { comparison_id: "comparison-3", rule_code: "required_field_presence", status: "needs_review" as const, left: operand("packing_no"), right: operand(""), expected_value: "packing_no", observed_value: null, unit: null, message: "포장명세서에서 필수 포장명세서 번호을 확인할 수 없습니다." },
    ],
    evidence: [] as Array<Record<string, unknown>>,
    findings: [
      { finding_id: "finding-1", code: "document_consistency", message: "상업송장과 포장명세서의 수량이 일치하지 않습니다.", kind: "validation_issue" as const, severity: "high" as const, comparison_id: "comparison-1", document_ids: ["document-1"], fact_ids: ["fact-1"], evidence_ids: [], confidence: 0.9, classification: { error_category: "value_mismatch" as const, explanation: "정규화한 두 값이 서로 다릅니다.", source: "rule" as const } },
      { finding_id: "finding-2", code: "document_consistency", message: "상업송장과 포장명세서의 단위가 일치하지 않습니다.", kind: "validation_issue" as const, severity: "high" as const, comparison_id: "comparison-2", document_ids: ["document-1"], fact_ids: ["fact-1"], evidence_ids: [] },
      { finding_id: "finding-3", code: "document_consistency", message: "포장명세서에서 필수 포장명세서 번호을 확인할 수 없습니다.", kind: "validation_issue" as const, severity: "medium" as const, comparison_id: "comparison-3", document_ids: ["document-1"], fact_ids: [], evidence_ids: [] },
    ],
    required_actions: [
      { action_code: "human_review_required", message: "상업송장과 포장명세서의 수량이 일치하지 않습니다.", finding_ids: ["finding-1"] },
      { action_code: "human_review_required", message: "상업송장과 포장명세서의 단위가 일치하지 않습니다.", finding_ids: ["finding-2"] },
      { action_code: "human_review_required", message: "포장명세서에서 필수 포장명세서 번호을 확인할 수 없습니다.", finding_ids: ["finding-3"] },
      { action_code: "human_review_required", message: "자동 승인하지 않습니다.", finding_ids: [] },
    ],
    reviewer_decisions: [] as Array<Record<string, unknown>>,
    created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z",
  };
}

function api(run: ReturnType<typeof reviewRun>, extra: Record<string, unknown> = {}) {
  return {
    getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
    listCases: vi.fn(async () => ({ items: [CASE] })),
    getCase: vi.fn(async () => CASE),
    listDocuments: vi.fn(async () => [DOCUMENT]),
    listDocumentAssets: vi.fn(async () => []),
    listReviewRuns: vi.fn(async () => [RUN_SUMMARY]),
    getReviewRun: vi.fn(async () => run),
    ...extra,
  };
}

async function mount(client: unknown) {
  const root = document.createElement("div");
  document.body.append(root);
  const app = new LightweightWorkbench(root, client as never, AUTH as never, "local-development");
  await act(async () => {
    await app.start();
  });
  await flush();
  return { root, dispose: () => { app.destroy(); root.remove(); } };
}

describe("labels · reviewer sentences", () => {
  it("fixes 을/를 and 이/가 after the attached noun", () => {
    expect(fixParticles("포장명세서 번호을 확인할 수 없습니다.")).toBe("포장명세서 번호를 확인할 수 없습니다.");
    expect(fixParticles("HS 코드을 확인할 수 없습니다.")).toBe("HS 코드를 확인할 수 없습니다.");
    expect(fixParticles("수량를 확인하십시오.")).toBe("수량을 확인하십시오.");
    expect(fixParticles("원산지가 다릅니다.")).toBe("원산지가 다릅니다.");
    expect(fixParticles("금액가 다릅니다.")).toBe("금액이 다릅니다.");
    // Latin/digit endings: l/m/n/r and 0/1/3/6/7/8 count as 받침.
    expect(fixParticles("Excel을 여십시오.")).toBe("Excel을 여십시오.");
    expect(fixParticles("PDF을 여십시오.")).toBe("PDF를 여십시오.");
    expect(fixParticles("3번를 보십시오.")).toBe("3번을 보십시오.");
  });

  it("labels raw field keys and leaves values alone", () => {
    expect(humanizeFieldKeys("shipping_marks 값 인용문이 입력 문서 본문에서 확인되지 않았습니다.")).toBe("선적 표시(Shipping Marks) 값 인용문이 입력 문서 본문에서 확인되지 않았습니다.");
    expect(displayComparisonValue("hs_code")).toBe("HS 부호");
    expect(displayComparisonValue("packing_no")).toBe("포장명세서 번호");
    expect(displayComparisonValue("unknown_field_key")).toBe("unknown field key");
    expect(displayComparisonValue("USD 160,820.00")).toBe("USD 160,820.00");
    expect(displayComparisonValue("")).toBe("확인 불가");
    expect(reviewerSentence("hs_code을 확인할 수 없습니다.")).toBe("HS 부호를 확인할 수 없습니다.");
  });

  it("titles a finding by its rule, then the linked comparison rule, then the first sentence", () => {
    expect(findingDisplayTitle({ code: "invoice_total_amount", kind: "validation_issue", message: "x." })).toBe("Invoice 합계 금액 확인");
    expect(findingDisplayTitle({ code: "document_consistency", kind: "validation_issue", message: "x." }, { rule_code: "bill_packing_container" })).toBe("B/L·포장명세서 컨테이너 번호 비교");
    expect(findingDisplayTitle({ code: "document_consistency", kind: "validation_issue", message: "컨테이너 번호을 두 문서에서 모두 확인할 수 없습니다. 추가 설명." }, null)).toBe("컨테이너 번호를 두 문서에서 모두 확인할 수 없습니다");
  });
});

const REQUIREMENT_EVIDENCE = {
  evidence_id: "evidence-req", item_id: "item-1", source_type: "customs_requirement", source_hash: "c".repeat(64),
  title: "전기용품 및 생활용품 안전관리법 — 전기용품 및 생활용품 요건확인서",
  text: "HSK 8504401000 import 요건: 전기용품 및 생활용품 안전관리법; 필요 확인서류 전기용품 및 생활용품 요건확인서; 요건승인기관 국가기술표준원.",
  source_uri: "https://apis.data.go.kr/1220000/retrieveCcctLworCd/getRetrieveCcctLworCd?hsSgn=8504401000&imexTpcd=2",
  law_id: "K01", law_name: "전기용품 및 생활용품 안전관리법",
};
const ARTICLE_EVIDENCE = {
  evidence_id: "evidence-law", item_id: "item-1", source_type: "law_article", source_hash: "d".repeat(64),
  title: "관세법 제226조(허가·승인 등의 증명 및 확인)", text: "세관장은 … 요건을 갖춘 것임을 증명하여야 한다.",
  source_uri: "https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EA%B4%80%EC%84%B8%EB%B2%95/%EC%A0%9C226%EC%A1%B0",
  law_id: "L01", law_name: "관세법",
};

describe("labels · 통관 요건 근거", () => {
  it("reads the Data platform's fixed requirement sentence back into reviewer fields", () => {
    const summary = parseRequirementEvidence(REQUIREMENT_EVIDENCE.text);
    expect(summary).toEqual({
      hsCode: "8504.40-1000", direction: "수입", lawName: "전기용품 및 생활용품 안전관리법",
      documentName: "전기용품 및 생활용품 요건확인서", agency: "국가기술표준원",
    });
    expect(requirementSentence(summary!)).toBe(
      "HSK 8504.40-1000 품목을 수입하려면 「전기용품 및 생활용품 안전관리법」에 따라 국가기술표준원이 확인한 전기용품 및 생활용품 요건확인서를 세관에 제출해야 합니다.",
    );
    expect(parseRequirementEvidence("세관장은 … 증명하여야 한다.")).toBeNull();
  });

  it("sends requirement sources to 법제처 instead of the key-less public-data API, and leaves statute links alone", () => {
    expect(lawPortalHref("관세법", "제226조")).toBe("https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EA%B4%80%EC%84%B8%EB%B2%95/%EC%A0%9C226%EC%A1%B0");
    expect(evidenceSourceHref(REQUIREMENT_EVIDENCE)).toBe(lawPortalHref("전기용품 및 생활용품 안전관리법"));
    expect(evidenceSourceLabel(REQUIREMENT_EVIDENCE)).toBe("법제처에서 법령 보기");
    expect(evidenceSourceHref(ARTICLE_EVIDENCE)).toBe(ARTICLE_EVIDENCE.source_uri);
    expect(evidenceSourceLabel(ARTICLE_EVIDENCE)).toBe("출처 열기");
    // Without a law name there is nothing to look up on 법제처; the raw link stays.
    expect(evidenceSourceHref({ ...REQUIREMENT_EVIDENCE, law_name: null })).toBe(REQUIREMENT_EVIDENCE.source_uri);
  });
});

describe("통관 심사 · 법령정보", () => {
  it("shows a requirement as a readable sentence with fields and links it to 법제처", async () => {
    window.location.hash = "#/cases/case-1/review";
    const run = reviewRun();
    run.evidence = [REQUIREMENT_EVIDENCE, ARTICLE_EVIDENCE];
    const { root, dispose } = await mount(api(run));
    const requirement = root.querySelector('[data-evidence-id="evidence-req"]');
    expect(requirement?.querySelector("[data-evidence-requirement]")?.textContent).toContain("HSK 8504.40-1000 품목을 수입하려면");
    expect(requirement?.querySelector("[data-evidence-requirement]")?.textContent).toContain("필요 확인서류");
    // The Data platform wording survives only inside the folded "원문 표기" details.
    expect(requirement?.querySelector("[data-evidence-requirement] > p")?.textContent).not.toMatch(/import 요건/u);
    expect(requirement?.querySelector("details")?.textContent).toContain("HSK 8504401000 import 요건");
    const link = requirement?.querySelector<HTMLAnchorElement>("[data-evidence-source]");
    expect(link?.textContent).toBe("법제처에서 법령 보기");
    expect(link?.getAttribute("href")).toBe(lawPortalHref("전기용품 및 생활용품 안전관리법"));
    const article = root.querySelector('[data-evidence-id="evidence-law"]');
    expect(article?.querySelector("[data-evidence-requirement]")).toBeNull();
    expect(article?.querySelector<HTMLAnchorElement>("[data-evidence-source]")?.getAttribute("href")).toBe(ARTICLE_EVIDENCE.source_uri);
    dispose();
  });
});

describe("통관 심사 · AI 권고 패널", () => {
  it("shows the review track, confidence, advisory verdict, and per-finding signals without closing anything", async () => {
    window.location.hash = "#/cases/case-1/review";
    const { root, dispose } = await mount(api(reviewRun()));
    const panel = root.querySelector("[data-advisory-panel]");
    expect(panel?.textContent).toContain("상세 검토 트랙");
    expect(panel?.textContent).toContain("분석 신뢰도 62%");
    expect(panel?.textContent).toContain("부적격 권고");
    expect(panel?.textContent).toContain("자동으로 종료하거나 승인하지 않습니다");
    // The track and verdict each carry a plain-language hint and the reason links to its finding.
    expect(root.querySelector("[data-track-hint]")?.textContent).toContain("적격 여부와는 다른 값");
    expect(root.querySelector("[data-verdict-next]")?.textContent).toContain("정정 제안");
    expect(root.querySelector("[data-advisory-finding]")?.textContent).toContain("확인 사항 1건 보기");
    expect(root.querySelector("[data-advisory-engine]")?.textContent).toContain("분석 엔진");
    expect(root.querySelector("[data-eligibility-verdict]")?.getAttribute("data-eligibility-verdict")).toBe("ineligible");
    const signal = root.querySelector('[data-finding-id="finding-1"] [data-finding-signal]');
    expect(signal?.textContent).toContain("값 불일치");
    expect(signal?.textContent).toContain("신뢰도 90%");
    expect(root.querySelector("[data-graph-trace]")?.textContent).toContain("교차검증 에이전트");
    expect(root.querySelector("[data-case-closure] .decision-form")).toBeNull();
    dispose();
  });
});

describe("통관 심사 · 확인 사항 카드", () => {
  it("collapses cards by default, opens the first outstanding one, and keeps a single card open", async () => {
    window.location.hash = "#/cases/case-1/review";
    const { root, dispose } = await mount(api(reviewRun()));
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".finding-card"));
    expect(cards).toHaveLength(3);
    expect(cards.filter((card) => card.classList.contains("is-expanded"))).toHaveLength(1);
    expect(cards[0]?.classList.contains("is-expanded")).toBe(true);
    expect(cards[0]?.querySelector(".decision-form")).not.toBeNull();
    // A collapsed card still summarises the compared values.
    expect(cards[1]?.querySelector(".finding-summary")?.textContent).toContain("기준 BOX · 관측 CTN");
    expect(cards[1]?.querySelector(".decision-form")).toBeNull();

    await click(cards[1]?.querySelector(".finding-toggle"));
    const after = Array.from(root.querySelectorAll<HTMLElement>(".finding-card"));
    expect(after[1]?.classList.contains("is-expanded")).toBe(true);
    expect(after[0]?.classList.contains("is-expanded")).toBe(false);
    expect(after.filter((card) => card.classList.contains("is-expanded"))).toHaveLength(1);
    dispose();
  });

  it("toggles a card from anywhere on its heading, not only the button", async () => {
    window.location.hash = "#/cases/case-1/review";
    const { root, dispose } = await mount(api(reviewRun()));
    const cards = () => Array.from(root.querySelectorAll<HTMLElement>(".finding-card"));
    expect(cards()[2]?.classList.contains("is-expanded")).toBe(false);
    // Clicking the title text of a collapsed card opens it.
    await click(cards()[2]?.querySelector(".finding-heading strong"));
    expect(cards()[2]?.classList.contains("is-expanded")).toBe(true);
    expect(cards().filter((card) => card.classList.contains("is-expanded"))).toHaveLength(1);
    // Clicking the message of the open card collapses it again.
    await click(cards()[2]?.querySelector(".finding-heading p"));
    expect(cards()[2]?.classList.contains("is-expanded")).toBe(false);
    // The button still works on its own without double-toggling.
    await click(cards()[2]?.querySelector(".finding-toggle"));
    expect(cards()[2]?.classList.contains("is-expanded")).toBe(true);
    // Clicks inside the expanded body (the decision form) do not collapse the card.
    await click(cards()[2]?.querySelector(".decision-form"));
    expect(cards()[2]?.classList.contains("is-expanded")).toBe(true);
    dispose();
  });

  it("shows progress, groups by rule title, and aggregates next steps", async () => {
    window.location.hash = "#/cases/case-1/review";
    const { root, dispose } = await mount(api(reviewRun()));
    expect(root.querySelector(".finding-progress strong")?.textContent).toBe("판단 3건 중 0건 기록");
    const groups = Array.from(root.querySelectorAll<HTMLElement>(".finding-group__title")).map((node) => node.textContent);
    expect(groups).toEqual(["Invoice·Packing List 수량·단위 비교 · 2건", "필수 기재 항목 누락 · 1건"]);
    // Titles come from the linked comparison rule, never the generic category; the category is a tag.
    const first = root.querySelector('[data-finding-id="finding-1"]');
    expect(first?.querySelector(".finding-heading strong")?.textContent).toBe("Invoice·Packing List 수량·단위 비교");
    expect(first?.querySelector(".finding-kind")?.textContent).toBe("문서 정합성 확인 사항");
    // Raw field keys and particle errors are corrected on the card.
    const third = root.querySelector('[data-finding-id="finding-3"]');
    expect(third?.textContent).toContain("포장명세서 번호를 확인할 수 없습니다");
    expect(third?.querySelector(".finding-summary")?.textContent).toContain("기준 포장명세서 번호 · 관측 확인 불가");
    // Next steps: 2 + 1 finding pointers collapse into two lines, plus the unique action.
    const steps = Array.from(root.querySelectorAll<HTMLElement>(".next-step-list li")).map((node) => node.textContent ?? "");
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain("Invoice·Packing List 수량·단위 비교");
    expect(steps[0]).toContain("· 2건");
    expect(steps[1]).toContain("필수 기재 항목 누락");
    expect(steps[2]).toContain("자동 승인하지 않습니다.");
    dispose();
  });

  it("jumps to the next outstanding finding and reflects recorded decisions in the progress strip", async () => {
    window.location.hash = "#/cases/case-1/review";
    const run = reviewRun();
    run.reviewer_decisions = [{
      finding_id: "finding-1", status: "confirmed", reason_code: "document_verified", reason: "원본 서류 대조 결과 이상 없음",
      decided_by: "local-reviewer", decided_at: "2026-08-05T00:05:00Z",
      history: [{ status: "confirmed", reason_code: "document_verified", reason: "원본 서류 대조 결과 이상 없음", decided_by: "local-reviewer", decided_at: "2026-08-05T00:05:00Z" }],
    }];
    const { root, dispose } = await mount(api(run));
    expect(root.querySelector(".finding-progress strong")?.textContent).toBe("판단 3건 중 1건 기록");
    // The settled card is collapsed and shows its recorded decision; the first unjudged card opens.
    const settled = root.querySelector('[data-finding-id="finding-1"]');
    expect(settled?.classList.contains("is-collapsed")).toBe(true);
    expect(settled?.querySelector(".finding-summary--decision")?.textContent).toContain("확인함 · 원본 서류 대조 결과 이상 없음");
    expect(root.querySelector('[data-finding-id="finding-2"]')?.classList.contains("is-expanded")).toBe(true);

    await click(root.querySelector(".finding-progress button"));
    expect(root.querySelector('[data-finding-id="finding-3"]')?.classList.contains("is-expanded")).toBe(true);
    expect(root.querySelector('[data-finding-id="finding-2"]')?.classList.contains("is-expanded")).toBe(false);
    dispose();
  });

  it("keeps the judgement submit disabled until status and reason are chosen, then records the chosen values", async () => {
    window.location.hash = "#/cases/case-1/review";
    const run = reviewRun();
    const recorded = {
      finding_id: "finding-1", status: "needs_information" as const, reason_code: "supplement_requested" as const,
      reason: "신고인에게 보완 자료 요청", decided_by: "local-reviewer", decided_at: "2026-08-05T00:05:00Z",
      history: [{ status: "needs_information" as const, reason_code: "supplement_requested" as const, reason: "신고인에게 보완 자료 요청", decided_by: "local-reviewer", decided_at: "2026-08-05T00:05:00Z" }],
    };
    const setFindingDecision = vi.fn(async () => recorded);
    const client = api(run, { setFindingDecision });
    const { root, dispose } = await mount(client);
    const card = root.querySelector('[data-finding-id="finding-1"]');
    const form = card?.querySelector<HTMLFormElement>(".decision-form");
    const status = form?.querySelector<HTMLSelectElement>('select[name="status"]');
    const reasonCode = form?.querySelector<HTMLSelectElement>('select[name="reason_code"]');
    const reason = form?.querySelector<HTMLTextAreaElement>('textarea[name="reason"]');
    const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!form || !status || !reasonCode || !reason || !button) throw new Error("decision form is unavailable");

    // Nothing preselected, submit disabled, and a submit event without choices records nothing.
    expect(status.value).toBe("");
    expect(reasonCode.value).toBe("");
    expect(button.disabled).toBe(true);
    await submit(form);
    expect(setFindingDecision).not.toHaveBeenCalled();

    setValue(status, "needs_information");
    expect(button.disabled).toBe(true);
    setValue(reasonCode, "other");
    await flush();
    expect(button.disabled).toBe(true); // 기타 needs free text
    expect(reason.required).toBe(true);
    setValue(reasonCode, "supplement_requested");
    await flush();
    expect(button.disabled).toBe(false);
    await submit(form);
    expect(setFindingDecision).toHaveBeenCalledWith("run-1", "finding-1", { status: "needs_information", reason_code: "supplement_requested", reason: "" });
    dispose();
  });
});

describe("통관 심사 · 보고서 PDF 저장", () => {
  it("mounts a fully expanded print copy at the end of body, opens the print dialog, and unmounts after printing", async () => {
    window.location.hash = "#/cases/case-1/review";
    const print = vi.fn();
    window.print = print;
    const run = reviewRun();
    run.reviewer_decisions = [{
      finding_id: "finding-1", status: "confirmed", reason_code: "document_verified", reason: "원본 서류 대조 결과 이상 없음",
      decided_by: "local-reviewer", decided_at: "2026-08-05T00:05:00Z",
      history: [{ status: "confirmed", reason_code: "document_verified", reason: "원본 서류 대조 결과 이상 없음", decided_by: "local-reviewer", decided_at: "2026-08-05T00:05:00Z" }],
    }];
    const { root, dispose } = await mount(api(run));
    expect(document.body.querySelector(".report-print")).toBeNull();

    await click(root.querySelector(".report-print-button"));
    // The dialog opens one animation frame after the print copy commits.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    const printed = document.body.querySelector<HTMLElement>("body > .report-print");
    expect(printed).not.toBeNull();
    expect(print).toHaveBeenCalledTimes(1);
    // The interactive workbench is untouched; the print copy is a sibling of the app root.
    expect(root.querySelector(".report-print")).toBeNull();
    const text = printed?.textContent ?? "";
    expect(printed?.querySelector("h1")?.textContent).toBe("입항 서류");
    expect(text).toContain("2026. 8. 5.");
    expect(text).toContain("수입");
    expect(text).toContain("3건 중 2건 미판단");
    // Findings table: all three rows, judged and unjudged alike, with corrected wording.
    const rows = Array.from(printed?.querySelector(".report-print__table")?.querySelectorAll("tbody tr") ?? []);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.textContent).toContain("확인함");
    expect(rows[0]?.textContent).toContain("원본 서류 대조 결과 이상 없음");
    expect(rows[2]?.textContent).toContain("미판단");
    expect(text).toContain("포장명세서 번호를 확인할 수 없습니다");
    // Every report section prints in order, expanded, with no buttons anywhere.
    const headings = Array.from(printed?.querySelectorAll(".report-print__block h3") ?? []).map((node) => node.textContent);
    expect(headings.slice(0, 8)).toEqual(["1. conclusion", "2. execution_process", "3. document_comparison", "4. issues_and_causes", "5. legal_evidence", "6. impact", "7. next_actions", "8. limitations"]);
    expect(printed?.querySelector("button")).toBeNull();
    expect(text).toContain("자동 승인하지 않습니다.");

    await act(async () => {
      window.dispatchEvent(new Event("afterprint"));
    });
    await flush();
    expect(document.body.querySelector(".report-print")).toBeNull();
    dispose();
  });
});
