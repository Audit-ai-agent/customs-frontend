import type { ReactNode } from "react";
import {
  FONT_SCALES,
  HIDDEN_PAGES,
  SITE_PAGES,
  STAGE_IDS,
  type SitePage,
  type StageView,
  type WorkspaceView,
} from "./constants";
import { display, roleLabel } from "./labels";
import { useStore, useWorkbenchState } from "./useStore";

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * What the header calls the signed-in person. The OIDC subject is an opaque
 * identifier (often a UUID) that nobody can read; it stays available as a
 * tooltip, and the visible label falls back to a generic account name.
 */
export function sessionDisplayName(subject: string | undefined): string {
  if (!subject) return "세션 확인 중";
  return UUID_LIKE.test(subject) ? "기관 계정" : subject;
}

/** Text-size buttons: the KRDS utility that used to live in its own bar. */
function TextSizeControl() {
  const store = useStore();
  const state = useWorkbenchState();
  return (
    <div className="g-zoom" role="group" aria-label="본문 글자 크기 조절">
      <span className="g-zoom__label">글자크기</span>
      {FONT_SCALES.map(([scale, glyph, name]) => (
        <button
          key={name}
          type="button"
          className={`g-zoom__button${state.fontScale === scale ? " is-selected" : ""}`}
          aria-label={`글자 크기 ${name}`}
          aria-pressed={state.fontScale === scale}
          onClick={() => store.setFontScale(scale)}
        >
          {glyph}
        </button>
      ))}
    </div>
  );
}

function RoleSwitch() {
  const store = useStore();
  const state = useWorkbenchState();
  if (!store.canSwitchRole()) return null;
  const actors = [
    { id: "reviewer", label: "심사자" },
    { id: "approver", label: "승인자" },
  ] as const;
  return (
    <div className="local-role-switch" role="group" aria-label="로컬 개발 역할 전환">
      <span>개발 역할</span>
      {actors.map((actor) => {
        const selected = store.hasRole(actor.id);
        return (
          <button
            key={actor.id}
            type="button"
            className={`g-chip${selected ? " is-selected" : ""}`}
            aria-pressed={selected}
            disabled={state.busy || selected}
            onClick={() => void store.switchDevelopmentActor(actor.id)}
          >
            {actor.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One header row: brand, the case chip inside a case, the text-size and
 * sign-out utilities, and the signed-in identity as a readable name plus role
 * chips. Raw session identifiers never render as text.
 */
export function Topbar({ right }: { right?: ReactNode }) {
  const store = useStore();
  const state = useWorkbenchState();
  const session = state.session;
  const name = sessionDisplayName(session?.subject);
  return (
    <div className="topbar">
      <button className="brand" type="button" onClick={() => store.goToPage("home")} aria-label="홈으로 이동">
        <div className="seal-mark">
          <span>通</span>
        </div>
        <div className="brand-txt">
          <h1>통관 AI 사전심사</h1>
          <p>{store.mode === "functional-uat" ? "실제 기능 UAT 환경" : "팀 개발 환경"}</p>
        </div>
      </button>
      <div className="spacer" />
      {right}
      <div className="topbar__tools">
        <TextSizeControl />
        <RoleSwitch />
      </div>
      <div className="user" data-session-user>
        <div className="avatar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="user__identity">
          <span className="user__name" {...(session?.subject ? { title: `계정 ID ${session.subject}` } : {})}>
            {name}
          </span>
          {session?.roles.length ? (
            <span className="user__roles" aria-label="역할">
              {session.roles.map((role) => (
                <span key={role} className="role-chip">
                  {roleLabel(role)}
                </span>
              ))}
            </span>
          ) : null}
        </div>
        <button className="g-lnk" type="button" onClick={() => store.logout()}>
          로그아웃
        </button>
      </div>
    </div>
  );
}

/** KRDS global navigation: every top-level site page, always visible. */
export function GlobalNav() {
  const store = useStore();
  const state = useWorkbenchState();
  return (
    <nav className="g-gnb" aria-label="주요 메뉴">
      <div className="g-inner">
        {SITE_PAGES.map((page) => {
          const active = state.activePage === page.id;
          return (
            <button
              key={page.id}
              type="button"
              className={`g-gnb__item${active ? " is-active" : ""}`}
              {...(active ? { "aria-current": "page" as const } : {})}
              onClick={() => store.goToPage(page.id)}
            >
              {page.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Second-depth navigation inside one case: workspace stages, assistant, trail. */
export function CaseSubNav() {
  const store = useStore();
  const state = useWorkbenchState();
  const current = state.selectedCase;
  if (!current) return null;
  const sections: readonly { id: WorkspaceView; label: string; matches: (view: WorkspaceView) => boolean }[] = [
    { id: "documents", label: "심사 워크스페이스", matches: (view) => STAGE_IDS.includes(view as StageView) },
    { id: "assistant", label: "AI 도우미", matches: (view) => view === "assistant" },
    { id: "history", label: "심사 이력", matches: (view) => view === "history" },
  ];
  return (
    <nav className="case-subnav" aria-label="Case 화면 이동">
      {sections.map((section) => {
        const active = section.matches(state.activeView);
        return (
          <button
            key={section.id}
            type="button"
            className={`case-subnav__item${active ? " is-active" : ""}`}
            {...(active ? { "aria-current": "page" as const } : {})}
            onClick={() => store.setRoute(current.case_id, section.id)}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}

/** Per-page breadcrumb + title copy. Case screens override with the case itself. */
const PAGE_HERO: Record<SitePage, { title: string; subtitle: string }> = {
  home: { title: "통관 AI 사전심사", subtitle: "수입 통관 서류를 등록하면 AI가 근거를 갖춰 사전심사하고, 판단은 항상 담당자가 확정합니다." },
  cases: { title: "심사 업무함", subtitle: "" },
  hsk: { title: "HSK 분류 참조", subtitle: "관세청 HS부호 품목명 참조표를 코드·품명으로 검색합니다." },
  laws: { title: "법령 조회", subtitle: "적재된 65개 법령의 조문을 원문으로 검색하고, 심사가 인용한 근거를 모아 봅니다." },
  records: { title: "심사 기록", subtitle: "모든 Case의 AI 심사 실행 이력을 한 목록으로 봅니다." },
  metrics: { title: "운영 지표", subtitle: "저장된 Case·심사 실행을 서버가 집계한 수치입니다. 추정치 없음." },
  guide: { title: "이용안내", subtitle: "서비스 절차·역할·단축키와 책임 범위를 안내합니다." },
  admin: { title: "관리자 설정", subtitle: "AI 심사에 쓰는 LLM 제공자·모델·응답 한도를 확인하고 변경합니다. 승인자 역할에서만 변경할 수 있습니다." },
};

/** Pages whose hero keeps its explanatory sentence; every other page gets the compact one-row hero. */
const HERO_WITH_SUBTITLE: ReadonlySet<SitePage> = new Set<SitePage>(["home", "guide"]);

export function Hero() {
  const store = useStore();
  const state = useWorkbenchState();
  const current = state.selectedCase;
  const hero = PAGE_HERO[state.activePage];
  const pageLabel =
    [...SITE_PAGES, ...HIDDEN_PAGES].find((page) => page.id === state.activePage)?.label ?? "홈";
  // Every non-final crumb is a real destination; "홈" always lands on the home page.
  const trail: readonly { label: string; target?: SitePage }[] = current
    ? [{ label: "홈", target: "home" }, { label: "심사 업무함", target: "cases" }, { label: current.title }]
    : state.activePage === "home"
      ? [{ label: "홈" }]
      : [{ label: "홈", target: "home" }, { label: pageLabel }];
  const compact = current !== null || !HERO_WITH_SUBTITLE.has(state.activePage);
  // Inside a case the second line collapses into inline meta beside the title.
  const caseMeta = current
    ? `${current.external_reference ?? "참조번호 미지정"} · ${display(current.status)} · 활성 문서 ${store.activeDocuments().length}건`
    : null;
  return (
    <div className={`g-hero${compact ? " g-hero--compact" : ""}`}>
      <div className="g-inner">
        <p className="g-crumb" aria-label="현재 위치">
          {trail.map((step, index) => (
            <span key={step.label} style={{ display: "contents" }}>
              {index > 0 ? (
                <span className="g-crumb__sep" aria-hidden="true">
                  ›
                </span>
              ) : null}
              {index === trail.length - 1 ? (
                <strong>{step.label}</strong>
              ) : step.target !== undefined ? (
                <button
                  type="button"
                  className="g-crumb__link"
                  onClick={() => store.goToPage(step.target as SitePage)}
                >
                  {step.label}
                </button>
              ) : (
                <span>{step.label}</span>
              )}
            </span>
          ))}
        </p>
        <div className="g-hero__row">
          <div className="g-hero__text">
            <h1 className="g-title">
              {current ? current.title : hero.title}
              {caseMeta ? <span className="g-title-meta">{caseMeta}</span> : null}
            </h1>
            {!compact && hero.subtitle ? <p className="g-title-sub">{hero.subtitle}</p> : null}
          </div>
          {current ? (
            <div className="case-actions">
              <span className="human-review-badge" title="AI 결과는 자동 승인되지 않으며 담당자가 확정합니다.">
                항상 사람 검토 필요
              </span>
              <StartReviewButton />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function StartReviewButton() {
  const store = useStore();
  const state = useWorkbenchState();
  const running = state.activeJob !== null && ["queued", "running"].includes(state.activeJob.status);
  const canReview = store.hasRole("reviewer");
  // A case that already has a run gets a new run, not the first one; say so.
  const startLabel = state.runs.length ? "AI 심사 다시 실행" : "AI 심사 시작";
  // Law evidence is retrieved per confirmed HSK code; without one the first
  // run can only cross-check documents. Warn, never block.
  const hsConfirmed = Boolean(state.caseHsClassification?.selection ?? state.hsClassification?.selection);
  // Only after the case-level HSK state has loaded, so the hint does not flash on every case open.
  const hsStateLoaded = state.caseHsLoadedKey !== null;
  const warnUnconfirmedHs = canReview && !running && hsStateLoaded && store.activeDocuments().length > 0 && !hsConfirmed;
  return (
    <>
      <button
        className="btn primary"
        type="button"
        disabled={state.busy || !store.activeDocuments().length || running || !canReview}
        {...(canReview ? {} : { title: "AI 심사 실행은 심사자 역할에서만 가능합니다." })}
        onClick={() => void store.startReview()}
      >
        {running ? "심사 진행 중" : canReview ? startLabel : "심사자 역할에서 실행"}
      </button>
      {warnUnconfirmedHs ? (
        <span className="form-hint" data-hsk-unconfirmed>
          HSK 코드가 아직 확정되지 않았습니다. 서류 등록 화면의 HSK 분류에서 확정하면 첫 심사부터 법령 근거를 조회합니다.
        </span>
      ) : null}
    </>
  );
}

export function SiteFooter() {
  const store = useStore();
  return (
    <footer className="g-footer">
      <div className="g-inner">
        <p className="g-footer__title">
          {`통관 AI 사전심사 작업대 · ${store.mode === "functional-uat" ? "기능 UAT" : "팀 개발 환경"}`}
        </p>
        <p className="g-footer__note">문의: 시스템 관리자 · 모든 AI 결과는 담당자 검토 후 확정됩니다.</p>
      </div>
    </footer>
  );
}
