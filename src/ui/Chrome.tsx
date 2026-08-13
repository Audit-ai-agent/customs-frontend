import type { ReactNode } from "react";
import { FONT_SCALES, STAGE_IDS, type FrontendRuntimeMode, type StageView, type WorkspaceView } from "./constants";
import { display, roleLabel } from "./labels";
import { useStore, useWorkbenchState } from "./useStore";

/** KRDS utility bar: text sizing, the local development role switch, and sign-out. */
export function UtilityBar() {
  const store = useStore();
  const state = useWorkbenchState();
  return (
    <div className="g-utilbar">
      <div className="g-inner">
        <span className="g-utilbar__site">통관 AI 사전심사 · 업무시스템</span>
        <div className="g-utilbar__tools">
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
          <RoleSwitch />
          <button className="g-lnk" type="button" onClick={() => store.logout()}>
            로그아웃
          </button>
        </div>
      </div>
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
 * The mockup topbar. The case chip only appears inside a case, and the sign-in
 * identity comes from the Backend session rather than a hard-coded name.
 */
export function Topbar({ right }: { right?: ReactNode }) {
  const store = useStore();
  const state = useWorkbenchState();
  const session = state.session;
  const subject = session?.subject ?? "세션 확인 중";
  return (
    <div className="topbar">
      <button className="brand" type="button" onClick={() => store.setRoute(null)} aria-label="심사 업무함으로 이동">
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
      <div className="user">
        <span className="mono">{subject}</span>
        <div className="avatar" aria-hidden="true">
          {subject.slice(0, 1).toUpperCase()}
        </div>
      </div>
      <div className="user-roles">
        {session?.org_id ? <small>{session.org_id}</small> : null}
        {session?.roles.length ? <small>{session.roles.map(roleLabel).join(", ")}</small> : null}
      </div>
    </div>
  );
}

export function GlobalNav() {
  const store = useStore();
  const state = useWorkbenchState();
  const current = state.selectedCase;
  const sections: readonly { id: WorkspaceView; label: string; matches: (view: WorkspaceView) => boolean }[] = [
    { id: "documents", label: "심사 워크스페이스", matches: (view) => STAGE_IDS.includes(view as StageView) },
    { id: "assistant", label: "AI 도우미", matches: (view) => view === "assistant" },
    { id: "history", label: "심사 이력", matches: (view) => view === "history" },
  ];
  return (
    <nav className="g-gnb" aria-label="주요 메뉴">
      <div className="g-inner">
        <button
          type="button"
          className={`g-gnb__item${current ? "" : " is-active"}`}
          {...(current ? {} : { "aria-current": "page" as const })}
          onClick={() => store.setRoute(null)}
        >
          심사 업무함
        </button>
        {current
          ? sections.map((section) => {
            const active = section.matches(state.activeView);
            return (
              <button
                key={section.id}
                type="button"
                className={`g-gnb__item${active ? " is-active" : ""}`}
                {...(active ? { "aria-current": "page" as const } : {})}
                onClick={() => store.setRoute(current.case_id, section.id)}
              >
                {section.label}
              </button>
            );
          })
          : null}
      </div>
    </nav>
  );
}

export function Hero() {
  const store = useStore();
  const state = useWorkbenchState();
  const current = state.selectedCase;
  const trail = current ? ["홈", "심사 업무함", current.title] : ["홈", "통관심사", "심사 업무함"];
  const subtitle = current
    ? `${current.external_reference ?? current.case_id} · ${display(current.status)} · 활성 문서 ${store.activeDocuments().length}건`
    : `등록된 Case ${state.cases.length}건 · 문서와 근거를 한 화면에서 검토합니다.`;
  return (
    <div className="g-hero">
      <div className="g-inner">
        <p className="g-crumb" aria-label="현재 위치">
          {trail.map((step, index) => (
            <span key={step} style={{ display: "contents" }}>
              {index > 0 ? (
                <span className="g-crumb__sep" aria-hidden="true">
                  ›
                </span>
              ) : null}
              {index === trail.length - 1 ? <strong>{step}</strong> : <span>{step}</span>}
            </span>
          ))}
        </p>
        <div className="g-hero__row">
          <div className="g-hero__text">
            <h1 className="g-title">{current ? current.title : "심사 업무함"}</h1>
            <p className="g-title-sub">{subtitle}</p>
          </div>
          {current ? (
            <div className="case-actions">
              <span className="human-review-badge">항상 사람 검토 필요</span>
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
  return (
    <button
      className="btn primary"
      type="button"
      disabled={state.busy || !store.activeDocuments().length || running || !canReview}
      {...(canReview ? {} : { title: "AI 심사 실행은 심사자 역할에서만 가능합니다." })}
      onClick={() => void store.startReview()}
    >
      {running ? "심사 진행 중" : canReview ? startLabel : "심사자 역할에서 실행"}
    </button>
  );
}

export function SiteFooter({ mode }: { mode: FrontendRuntimeMode }) {
  return (
    <footer className="g-footer">
      <div className="g-inner">
        <p className="g-footer__title">통관 AI 사전심사 작업대</p>
        <p>
          {mode === "functional-uat"
            ? "이 화면은 Backend API v1만 호출합니다. Agent·Data·저장소 주소와 비밀값은 브라우저에 전달되지 않습니다."
            : "팀 개발 모드입니다. 세션과 토큰은 메모리에만 두며 브라우저 저장소에 남기지 않습니다."}
        </p>
        <p>모든 결과는 항상 담당자 검토 대상이며 통관 승인 판단이 아닙니다. 화면에 비밀정보를 입력하지 마십시오.</p>
        <p className="g-footer__note">KRDS(대한민국 정부 디자인 시스템) 문법을 적용한 업무 화면입니다.</p>
      </div>
    </footer>
  );
}
