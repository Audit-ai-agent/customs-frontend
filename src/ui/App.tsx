import { useEffect, useRef } from "react";
import { ACTIVE_JOB_STATES, STAGES, STAGE_IDS, type StageView } from "./constants";
import { AdminPage } from "./Admin";
import { AssistantScreen } from "./Assistant";
import { CaseSubNav, GlobalNav, Hero, SiteFooter, Topbar } from "./Chrome";
import { Dashboard } from "./Dashboard";
import { DocumentModal } from "./DocumentModal";
import { HistoryScreen } from "./History";
import { GuidePage, HomePage, HskReferencePage, LawsPage, MetricsPage, RecordsPage } from "./pages";
import { display, findingDisplayTitle } from "./labels";
import { Message } from "./primitives";
import { DocumentRail, TraceRail } from "./Rails";
import { ReviewStage } from "./Review";
import { CrosscheckStage, DocumentsStage, DutyStage } from "./stages";
import { useStore, useWorkbenchState } from "./useStore";

export function App() {
  const store = useStore();
  const state = useWorkbenchState();

  // KRDS utility-bar text sizing. The choice stays in memory only.
  useEffect(() => {
    const root = window.document.documentElement;
    if (state.fontScale === 1) root.style.removeProperty("font-size");
    else root.style.setProperty("font-size", `${Math.round(state.fontScale * 100)}%`);
    return () => {
      root.style.removeProperty("font-size");
    };
  }, [state.fontScale]);

  // Mockup shortcuts: `1`–`4` and arrows move between stages. `/` is handled by the dashboard.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const typing = target instanceof HTMLElement &&
        (/^(input|textarea|select)$/iu.test(target.tagName) || target.isContentEditable);
      if (typing || state.documentModalOpen || !state.selectedCase) return;
      if (event.key >= "1" && event.key <= "4") {
        event.preventDefault();
        store.goToStageNumber(Number(event.key));
        return;
      }
      if (!STAGE_IDS.includes(state.activeView as StageView)) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        store.moveStage(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        store.moveStage(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, state.documentModalOpen, state.selectedCase, state.activeView]);

  return (
    <div className="g-page">
      {state.busy ? <div className="g-progress" role="status" aria-label="요청을 처리하고 있습니다" /> : null}
      <Topbar right={<CaseChip />} />
      <GlobalNav />
      <main className="g-main" id="main-content" aria-busy={state.busy}>
        <Hero />
        <div className="g-inner g-body">
          {state.error ? <Message kind="error" text={state.error} /> : null}
          {state.notice ? <Message kind="notice" text={state.notice} /> : null}
          <PageScreen />
        </div>
      </main>
      <SiteFooter />
      {state.documentModalOpen ? <DocumentModal /> : null}
    </div>
  );
}

/** Routes each KRDS global-navigation page; the cases page nests the workspace. */
function PageScreen() {
  const state = useWorkbenchState();
  switch (state.activePage) {
    case "home":
      return <HomePage />;
    case "hsk":
      return <HskReferencePage />;
    case "laws":
      return <LawsPage />;
    case "records":
      return <RecordsPage />;
    case "metrics":
      return <MetricsPage />;
    case "guide":
      return <GuidePage />;
    case "admin":
      return <AdminPage />;
    default:
      return state.selectedCase ? <CaseScreen /> : <Dashboard />;
  }
}

function CaseChip() {
  const state = useWorkbenchState();
  const current = state.selectedCase;
  if (!current) return null;
  return (
    <div className="ship-chip">
      <span className="dot" />
      심사 건 <b className="mono">{current.external_reference ?? "참조번호 미지정"}</b>
      <span>· {display(current.status)}</span>
    </div>
  );
}

function CaseScreen() {
  const state = useWorkbenchState();
  // Stage moves have direction: forward slides in from the right, back from
  // the left. Direction is decided once per actual stage change so unrelated
  // re-renders (loading flags etc.) cannot flip it mid-animation.
  const stageIndex = STAGE_IDS.indexOf(state.activeView as StageView);
  const previousStageIndex = useRef(stageIndex);
  const directionRef = useRef<"fwd" | "back">("fwd");
  if (stageIndex >= 0 && stageIndex !== previousStageIndex.current) {
    directionRef.current = stageIndex < previousStageIndex.current ? "back" : "fwd";
    previousStageIndex.current = stageIndex;
  }
  const direction = directionRef.current;
  const processing = state.activeJob && ACTIVE_JOB_STATES.has(state.activeJob.status) ? <ProcessingNotice /> : null;

  if (state.activeView === "assistant") {
    return (
      <section className="case-screen">
        <CaseSubNav />
        {processing}
        <AssistantScreen />
      </section>
    );
  }
  if (state.activeView === "history") {
    return (
      <section className="case-screen">
        <CaseSubNav />
        {processing}
        <HistoryScreen />
      </section>
    );
  }
  return (
    <section className="case-screen">
      <CaseSubNav />
      {processing}
      <StageBar />
      <div className={`workspace${state.traceRailOpen ? "" : " workspace--rail-closed"}`}>
        <DocumentRail />
        <section className="workspace__canvas">
          <IssueBar />
          <div className={`stage-anim dir-${direction}`} key={state.activeView}>
            <StageContent />
          </div>
        </section>
        <TraceRail />
      </div>
      <p className="mobilenote">
        이 심사 화면은 3단 구성이라 좁은 화면에서는 가로 스크롤 없이 보여드릴 수 없습니다.
        <br />
        1024px 이상 화면에서 열어 주십시오.
      </p>
    </section>
  );
}

function ProcessingNotice() {
  const state = useWorkbenchState();
  const job = state.activeJob;
  if (!job) return null;
  return (
    <section className="processing-notice" role="status">
      <strong>심사 요청 처리 중</strong>
      <span>
        {`Job ${job.job_id.slice(0, 12)} · ${display(job.status)}. 실제 완료 결과가 도착한 뒤 워크플로우를 표시합니다.`}
      </span>
    </section>
  );
}

function StageBar() {
  const store = useStore();
  const state = useWorkbenchState();
  const current = state.selectedCase;
  if (!current) return null;
  const openCount = store.openFindings().length;
  return (
    <nav className="stagebar" aria-label="심사 단계">
      {STAGES.map((stage, index) => {
        const active = stage.id === state.activeView;
        const done = !active && store.stageComplete(stage.id);
        const badge = stage.id === "review" ? openCount : 0;
        return (
          <span key={stage.id} style={{ display: "contents" }}>
            <button
              type="button"
              className={`stage${active ? " is-active" : ""}${done ? " is-done" : ""}${stage.supported ? "" : " is-unsupported"}`}
              {...(active ? { "aria-current": "step" as const } : {})}
              onClick={() => store.setRoute(current.case_id, stage.id)}
            >
              <span className="stage__n">{stage.step}</span>
              <span className="stage__label">
                <strong>{stage.label}</strong>
                <span>{stage.hint}</span>
              </span>
              {badge ? (
                <span className="stage__badge" aria-label={`미해결 확인 사항 ${badge}건`}>
                  {badge}
                </span>
              ) : null}
            </button>
            {index < STAGES.length - 1 ? (
              <span className="stage__sep" aria-hidden="true">
                ›
              </span>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}

function IssueBar() {
  const store = useStore();
  const state = useWorkbenchState();
  const current = state.selectedCase;
  if (!current || !state.selectedRun) return null;
  const open = store.openFindings();

  if (!open.length) {
    return (
      <div className="issuebar issuebar--clear" role="status">
        <span className="issuebar__icon" aria-hidden="true">
          ✓
        </span>
        <span className="issuebar__text">
          확인 사항 판단이 모두 기록되었습니다. 그래도 결과는 자동 완료되지 않으며 담당자 확정이 필요합니다.
        </span>
        <button className="issuebar__chip" type="button" onClick={() => store.setRoute(current.case_id, "history")}>
          심사 이력으로 →
        </button>
      </div>
    );
  }

  const highest = store.highestOpenFinding();
  const highestComparison = highest?.comparison_id
    ? state.selectedRun.comparisons.find((item) => item.comparison_id === highest.comparison_id)
    : undefined;
  return (
    <div className="issuebar" role="status">
      <span className="issuebar__icon" aria-hidden="true">
        !
      </span>
      <span className="issuebar__text">
        <strong>{`판단이 필요한 확인 사항 ${open.length}건`}</strong>
        <span> — 담당자 판단을 기록하면 이 표시가 사라집니다.</span>
      </span>
      {state.activeView === "review" ? null : (
        <button className="issuebar__chip" type="button" onClick={() => store.setRoute(current.case_id, "review")}>
          통관 심사로 →
        </button>
      )}
      {highest ? (
        <button className="issuebar__chip" type="button" onClick={() => store.focusFinding(highest.finding_id)}>
          {`우선 확인 · ${findingDisplayTitle(highest, highestComparison)}`}
        </button>
      ) : null}
    </div>
  );
}

function StageContent() {
  const state = useWorkbenchState();
  switch (state.activeView) {
    case "crosscheck":
      return <CrosscheckStage />;
    case "review":
      return <ReviewStage />;
    case "duty":
      return <DutyStage />;
    default:
      return <DocumentsStage />;
  }
}
