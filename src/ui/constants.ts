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

/**
 * The mockup's stage bar. Stage 4 keeps its place in the flow but has no Backend
 * v1 counterpart; see customs-backend/docs/FRONTEND_UX_BACKEND_GAP.ko.md.
 */
export const STAGES: readonly { id: StageView; step: number; label: string; hint: string; supported: boolean }[] = [
  { id: "documents", step: 1, label: "서류 등록", hint: "텍스트 문서 구조화", supported: true },
  { id: "crosscheck", step: 2, label: "교차 검증", hint: "이기종 문서 불일치 탐지", supported: true },
  { id: "review", step: 3, label: "통관 심사", hint: "요건 · 법령 근거 판정", supported: true },
  { id: "duty", step: 4, label: "관세 진단", hint: "세율 · 절감 (Backend 미지원)", supported: false },
];
export const STAGE_IDS: readonly StageView[] = STAGES.map((stage) => stage.id);

/** Routes the earlier tab layout used; kept so existing links keep resolving. */
export const LEGACY_VIEW_ALIASES: Record<string, WorkspaceView> = { analysis: "review", evidence: "review" };

export const CASE_FILTERS: readonly { id: CaseFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "open", label: "진행 전" },
  { id: "in_review", label: "사람 검토 중" },
  { id: "closed", label: "종료" },
];

/** Static map of the real pipeline. Every step here is backed by an API v1 call. */
export const FLOW_MAP: readonly { step: string; label: string; hint: string }[] = [
  { step: "1", label: "서류 등록", hint: "텍스트 문서 구조화" },
  { step: "2", label: "AI 사전심사", hint: "제한형 Agent workflow" },
  { step: "3", label: "교차 검증", hint: "문서 간 값 대조" },
  { step: "4", label: "판정 · 근거", hint: "확인 사항 · 법령 Evidence" },
  { step: "5", label: "담당자 확정", hint: "판단 기록 · 정정 승인" },
];

export function parseRoute(hash: string): { caseId: string | null; view: WorkspaceView } {
  const match = /^#\/cases\/([^/]+)(?:\/([a-z]+))?$/u.exec(hash);
  if (!match) return { caseId: null, view: "documents" };
  try {
    const caseId = decodeURIComponent(match[1] ?? "");
    if (!caseId) return { caseId: null, view: "documents" };
    return { caseId, view: resolveView(match[2]) };
  } catch {
    return { caseId: null, view: "documents" };
  }
}

export function resolveView(segment: string | undefined): WorkspaceView {
  if (!segment) return "documents";
  if (segment === "assistant" || segment === "history") return segment;
  if (STAGE_IDS.includes(segment as StageView)) return segment as StageView;
  return LEGACY_VIEW_ALIASES[segment] ?? "documents";
}
