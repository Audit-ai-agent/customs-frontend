import type { DocumentType } from "../api/v1/types";

export type FrontendRuntimeMode = "local-development" | "functional-uat";
/**
 * Screen model taken from the 通審 interaction spec v1.3: a case runs through four
 * sequential stages, with the assistant and the history trail as their own screens.
 */
export type StageView = "documents" | "crosscheck" | "review" | "duty";
export type WorkspaceView = StageView | "assistant" | "history";
export type CaseFilter = "all" | "open" | "in_review" | "closed";
export type CaseSortKey = "reference" | "updated";

/** KRDS utility-bar text sizing. The choice stays in memory only. */
export type FontScale = 0.9 | 1 | 1.1;
export const FONT_SCALES: ReadonlyArray<readonly [FontScale, string, string]> = [
  [0.9, "가⁻", "작게"],
  [1, "가", "보통"],
  [1.1, "가⁺", "크게"],
];

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  "CI",
  "PL",
  "BL",
  "CO",
  "AWB",
  "EXPORT_DECLARATION",
  "SUPPORTING_EVIDENCE",
  "UNKNOWN",
];
export const ACTIVE_JOB_STATES: ReadonlySet<string> = new Set(["queued", "running"]);

/** The mockup's stage bar. */
export const STAGES: readonly { id: StageView; step: number; label: string; hint: string; supported: boolean }[] = [
  { id: "documents", step: 1, label: "서류 등록", hint: "텍스트 문서 구조화 · HSK 분류", supported: true },
  { id: "crosscheck", step: 2, label: "교차 검증", hint: "이기종 문서 불일치 · 원산지 검증", supported: true },
  { id: "review", step: 3, label: "통관 심사", hint: "요건 · 법령 근거 판정", supported: true },
  { id: "duty", step: 4, label: "관세 진단", hint: "세율 사다리 · 절감 진단", supported: true },
];
export const STAGE_IDS: readonly StageView[] = STAGES.map((stage) => stage.id);

/** Routes the earlier tab layout used; kept so existing links keep resolving. */
export const LEGACY_VIEW_ALIASES: Record<string, WorkspaceView> = { analysis: "review", evidence: "review" };

export const CASE_FILTERS: readonly { id: CaseFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "open", label: "진행 전" },
  { id: "in_review", label: "검토 중" },
  { id: "closed", label: "종료" },
];

/** Static map of the real pipeline. Every step here is backed by an API v1 call. */
export const FLOW_MAP: readonly { step: string; label: string; hint: string }[] = [
  { step: "1", label: "서류 등록", hint: "텍스트 문서 구조화" },
  { step: "2", label: "AI 사전심사", hint: "제한형 Agent workflow" },
  { step: "3", label: "교차 검증", hint: "문서 간 값 대조" },
  { step: "4", label: "판정 · 근거", hint: "확인 사항 · 법령정보" },
  { step: "5", label: "담당자 확정", hint: "판단 기록 · 정정 승인" },
];

/**
 * Site pages behind the KRDS global navigation. Every page is either backed by
 * real Backend v1 calls or explains exactly why it is not (metrics).
 */
export type SitePage = "home" | "cases" | "hsk" | "laws" | "records" | "metrics" | "guide" | "admin";

export const SITE_PAGES: readonly { id: SitePage; label: string; hash: string }[] = [
  { id: "home", label: "홈", hash: "#/home" },
  { id: "cases", label: "심사 업무함", hash: "#/cases" },
  { id: "hsk", label: "HSK 분류 참조", hash: "#/reference/hsk" },
  { id: "laws", label: "법령 조회", hash: "#/reference/laws" },
  { id: "records", label: "심사 기록", hash: "#/records" },
  { id: "metrics", label: "운영 지표", hash: "#/metrics" },
  { id: "guide", label: "이용안내", hash: "#/guide" },
];

/**
 * Pages that resolve from a typed URL only. They are deliberately absent from
 * the global navigation and from every in-app link: an operator reaches the
 * admin panel by entering its address, and the Backend still enforces the
 * approver role on every call it makes.
 */
export const HIDDEN_PAGES: readonly { id: SitePage; label: string; hash: string }[] = [
  { id: "admin", label: "관리자 설정", hash: "#/admin" },
];

const ROUTABLE_PAGES: readonly { id: SitePage; label: string; hash: string }[] = [...SITE_PAGES, ...HIDDEN_PAGES];

export function pageHash(page: SitePage): string {
  return ROUTABLE_PAGES.find((item) => item.id === page)?.hash ?? "#/home";
}

export function parseRoute(hash: string): { page: SitePage; caseId: string | null; view: WorkspaceView } {
  const fallback = { page: "home" as SitePage, caseId: null, view: "documents" as WorkspaceView };
  const staticPage = ROUTABLE_PAGES.find((item) => item.hash === hash);
  if (staticPage) return { ...fallback, page: staticPage.id };
  const match = /^#\/cases\/([^/]+)(?:\/([a-z]+))?$/u.exec(hash);
  if (!match) return fallback;
  try {
    const caseId = decodeURIComponent(match[1] ?? "");
    if (!caseId) return fallback;
    return { page: "cases", caseId, view: resolveView(match[2]) };
  } catch {
    return fallback;
  }
}

export function resolveView(segment: string | undefined): WorkspaceView {
  if (!segment) return "documents";
  if (segment === "assistant" || segment === "history") return segment;
  if (STAGE_IDS.includes(segment as StageView)) return segment as StageView;
  return LEGACY_VIEW_ALIASES[segment] ?? "documents";
}
