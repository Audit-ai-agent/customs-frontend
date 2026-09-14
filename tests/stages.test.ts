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

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
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
  review_disposition: "human_review_required" as const, result_digest: "b".repeat(64), finding_count: 1,
  reviewer_decision_count: 0, created_at: "2026-08-05T00:00:00Z",
};

const SOURCE = { source_kind: "document" as const, document_id: "document-1", quote: "10", occurrence: 0 };

function comparison(id: string, rule: string, status: "pass" | "mismatch" | "needs_review" | "skip", left: string, right: string | null, message: string) {
  return {
    comparison_id: id, rule_code: rule, status,
    left: { document_id: "document-1", item_id: null, fact_ids: ["fact-1"], display_value: left },
    right: { document_id: "document-1", item_id: null, fact_ids: [], display_value: right },
    expected_value: left, observed_value: right, unit: null, message,
  };
}

function reviewRun() {
  const sections = ["conclusion", "execution_process", "document_comparison", "issues_and_causes", "legal_evidence", "impact", "next_actions", "limitations"] as const;
  return {
    review_run_id: "run-1", case_id: "case-1", org_id: "local-org", job_id: "job-1", case_revision: 1,
    review_as_of: "2026-08-05", trade_type: "import" as const, execution_status: "succeeded" as const,
    assessment: "issues_detected" as const, review_disposition: "human_review_required" as const,
    completion_eligibility: { eligible: false as const, unmet_reason_codes: ["human_review_required"] },
    agent_schema_version: "3.3" as const, agent_status: "needs_review" as const, agent_engine: { kind: "deterministic" as const, model_id: "fixture" },
    report: {
      overall_status: "needs_review" as const, summary: "수량을 확인해야 합니다.", disclaimer: "담당자 검토가 필요합니다.",
      sections: sections.map((section, index) => ({
        section, title: section,
        claims: [{ claim_id: `claim-${index + 1}`, text: "확인", fact_ids: ["fact-1"], comparison_ids: [], evidence_ids: [] }],
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
      classification_source: { ...SOURCE, quote: "INVOICE" }, extraction_status: "complete" as const,
      facts: [{ fact_id: "fact-1", name: "quantity", raw_value: "10", normalized_value: "10", unit: "EA", source: SOURCE }],
      line_items: [], warnings: [],
    }],
    comparisons: [
      comparison("comparison-1", "invoice_packing_quantity_unit", "mismatch", "10", "12", "수량이 일치하지 않습니다."),
      comparison("comparison-2", "hs_code_presence", "needs_review", "hs_code", "확인 불가", "상업송장에서 필수 HS 코드를 확인할 수 없습니다."),
    ],
    evidence: [],
    findings: [{ finding_id: "finding-1", code: "invoice_packing_quantity_unit", message: "수량이 일치하지 않습니다.", kind: "validation_issue" as const, severity: "high" as const, comparison_id: "comparison-1", document_ids: ["document-1"], fact_ids: ["fact-1"], evidence_ids: [] }],
    required_actions: [{ action_code: "human_review_required", message: "자동 승인하지 않습니다.", finding_ids: [] }],
    reviewer_decisions: [], created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z",
  };
}

function hint(code: string, name: string, covered: boolean) {
  return { agreement_code: code, agreement_name: name, origin_covered: covered, certificate_form: "원산지증명서", source_uri: `https://www.fta.go.kr/${code.toLowerCase()}/` };
}

function originVerification(originCountry: string | null) {
  return {
    review_run_id: "run-1", case_id: "case-1", status: "needs_review" as const,
    certificate: { document_id: "document-1", filename: "co.txt", extraction_status: "complete" },
    origin_country: originCountry, checks: [],
    fta_hints: [hint("KR-CL", "한-칠레 FTA", false), hint("KR-EU", "한-EU FTA", true), hint("KR-US", "한-미 FTA", false), hint("RCEP", "RCEP", true)],
  };
}

function rate(kind: "basic" | "wto" | "fta", label: string, pct: number, applicable: boolean, agreement: string | null = null) {
  return {
    rate_kind: kind, agreement_code: agreement, code: null, label, rate_pct: pct,
    source_uri: agreement ? `https://www.fta.go.kr/${agreement.toLowerCase()}/` : "https://unipass.customs.go.kr/",
    requirements: kind === "fta" ? [{ code: "origin_in_agreement" as const, satisfied: applicable }] : [],
    applicable,
  };
}

function dutyAssessment() {
  return {
    review_run_id: "run-1", case_id: "case-1", status: "estimated" as const,
    reference: { as_of: "2026-01-01", source: "관세청 관세율표", disclaimer: "참조 스냅샷입니다." },
    hs_code: { code: "6109101000", source: "document_fact" as const, name_ko: "티셔츠" },
    origin_country: "DE",
    dutiable_value: { amount: 1000, currency: "USD", basis: "invoice_total", document_id: "document-1" },
    rates: [
      rate("basic", "기본세율", 13, true),
      rate("wto", "WTO 양허세율", 35, true),
      rate("fta", "한-EU FTA 협정세율", 0, true, "KR-EU"),
      rate("fta", "한-미 FTA 협정세율", 0, false, "KR-US"),
      rate("fta", "한-칠레 FTA 협정세율", 0, false, "KR-CL"),
    ],
    applied: { rate_kind: "fta" as const, agreement_code: "KR-EU", rate_pct: 0, duty_amount: 0, vat_rate_pct: 10, vat_amount: 100, total_estimated: 100, currency: "USD" },
    savings: { vs_basic_duty: 130, currency: "USD", blocked_requirements: [] },
  };
}

function api(extra: Record<string, unknown>, runs = [RUN_SUMMARY]) {
  return {
    getSession: vi.fn(async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] })),
    listCases: vi.fn(async () => ({ items: [CASE] })),
    getCase: vi.fn(async () => CASE),
    listDocuments: vi.fn(async () => [DOCUMENT]),
    listDocumentAssets: vi.fn(async () => []),
    listReviewRuns: vi.fn(async () => runs),
    getReviewRun: vi.fn(async () => reviewRun()),
    ...extra,
  };
}

async function mount(clientApi: unknown) {
  const root = document.createElement("div");
  document.body.append(root);
  const app = new LightweightWorkbench(root, clientApi as never, AUTH as never, "local-development");
  await act(async () => {
    await app.start();
  });
  await flush();
  await flush();
  return { root, dispose: () => { app.destroy(); root.remove(); } };
}

describe("교차 검증 단계", () => {
  it("shows Korean rule titles and field labels instead of raw codes, with amber review status", async () => {
    window.location.hash = "#/cases/case-1/crosscheck";
    const { root, dispose } = await mount(api({ getOriginVerification: vi.fn(async () => originVerification("DE")) }));

    const rows = Array.from(root.querySelectorAll<HTMLElement>(".comparison-row"));
    expect(rows).toHaveLength(2);
    expect(rows[0]?.querySelector(".comparison-rule")?.textContent).toBe("Invoice·Packing List 수량·단위 비교");
    expect(rows[0]?.querySelector(".comparison-rule")?.getAttribute("title")).toBe("invoice_packing_quantity_unit");
    expect(rows[0]?.textContent).not.toContain("invoice_packing_quantity_unit");
    expect(rows[1]?.querySelector(".comparison-rule")?.textContent).toBe("HS 부호 기재 확인");
    expect(rows[1]?.querySelector(".mono")?.textContent).toContain("HS 부호");
    expect(rows[1]?.querySelector(".mono")?.textContent).not.toContain("hs_code");
    expect(rows[1]?.querySelector(".comparison-status--needs_review")?.textContent).toBe("검토 필요");
    dispose();
  });
});

describe("원산지 검증 카드", () => {
  it("names each agreement link, lists covered agreements first, and collapses the rest", async () => {
    window.location.hash = "#/cases/case-1/crosscheck";
    const { root, dispose } = await mount(api({ getOriginVerification: vi.fn(async () => originVerification("DE")) }));

    const covered = root.querySelector<HTMLElement>("[data-origin-fta-covered]");
    expect(covered).not.toBeNull();
    const coveredLinks = Array.from(covered!.querySelectorAll<HTMLAnchorElement>("[data-origin-agreement-link]"));
    expect(coveredLinks.map((link) => link.textContent)).toEqual(["한-EU FTA 협정 안내 ↗", "RCEP 협정 안내 ↗"]);
    expect(coveredLinks[0]?.href).toBe("https://www.fta.go.kr/kr-eu/");
    expect(root.querySelector("[data-origin-fta]")?.textContent).not.toContain("출처 열기");
    const others = root.querySelector<HTMLDetailsElement>("[data-origin-fta-others]");
    expect(others?.open).toBe(false);
    expect(others?.querySelector("summary")?.textContent).toBe("대상 아님 2건 보기");
    expect(root.querySelector("[data-origin-fta-unknown]")).toBeNull();
    dispose();
  });

  it("says plainly when the origin country is unknown", async () => {
    window.location.hash = "#/cases/case-1/crosscheck";
    const { root, dispose } = await mount(api({ getOriginVerification: vi.fn(async () => originVerification(null)) }));
    expect(root.querySelector("[data-origin-fta-unknown]")?.textContent).toContain("원산지를 확인하지 못해");
    dispose();
  });
});

describe("관세 진단 단계", () => {
  it("keeps unmet-requirement rates collapsed and groups sources by kind with the rate as link text", async () => {
    window.location.hash = "#/cases/case-1/duty";
    const { root, dispose } = await mount(api({ getDutyAssessment: vi.fn(async () => dutyAssessment()) }));

    const ladder = root.querySelector<HTMLElement>(".merit-hero .ladder");
    expect(ladder).not.toBeNull();
    const more = ladder!.querySelector<HTMLDetailsElement>("[data-duty-ladder-more]");
    expect(more?.open).toBe(false);
    expect(more?.querySelector("summary")?.textContent).toBe("요건 미충족 2건 보기");
    const visibleRates = Array.from(ladder!.querySelectorAll<HTMLElement>(".rate")).filter((row) => !more!.contains(row));
    expect(visibleRates.map((row) => row.dataset.dutyRate)).toEqual(["KR-EU", "basic", "wto"]);
    expect(Array.from(more!.querySelectorAll<HTMLElement>(".rate")).map((row) => row.dataset.dutyRate).sort()).toEqual(["KR-CL", "KR-US"]);

    const sources = root.querySelector<HTMLElement>("[data-duty-sources]");
    expect(sources?.textContent).not.toContain("출처 열기");
    const fta = sources?.querySelector<HTMLDetailsElement>('[data-duty-source-group="fta"]');
    expect(fta?.open).toBe(false);
    expect(fta?.querySelector("summary")?.textContent).toBe("FTA 협정세율 · 3건");
    expect(Array.from(fta!.querySelectorAll("a")).map((link) => link.textContent)).toEqual([
      "한-EU FTA 협정세율 0% ↗", "한-미 FTA 협정세율 0% ↗", "한-칠레 FTA 협정세율 0% ↗",
    ]);
    dispose();
  });
});

describe("서류 등록 단계", () => {
  it("hides the OCR panel for a confirmed asset and offers the original instead", async () => {
    window.location.hash = "#/cases/case-1/documents";
    const asset = {
      asset_id: "asset-1", case_id: "case-1", document_type: "CI" as const, filename: "invoice.pdf",
      media_type: "application/pdf" as const, byte_size: 2048, page_count: 1, pixel_count: 0,
      created_by: "local-reviewer", created_at: "2026-08-05T00:00:00Z",
    };
    const { root, dispose } = await mount(api({ listDocumentAssets: vi.fn(async () => [asset]) }, []));

    const row = root.querySelector<HTMLElement>('[data-asset-id="asset-1"]');
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain("문서로 확정됨");
    expect(row?.querySelector("[data-asset-confirmed]")?.textContent).toContain("원문 보기");
    expect(row?.querySelector('[data-testid="raster-text-panel"]')).toBeNull();
    dispose();
  });
});
