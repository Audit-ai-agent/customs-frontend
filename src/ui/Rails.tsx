import type { ReviewRun } from "../api/v1/types";
import { display, documentTypeLabel, plannerActionLabel, workflowLabel } from "./labels";
import { EmptyCopy, RoleBoundaryNote, TraceCount } from "./primitives";
import { useStore, useWorkbenchState } from "./useStore";

export function DocumentRail() {
  const store = useStore();
  const state = useWorkbenchState();
  const current = state.selectedCase;
  return (
    <aside className="workspace__rail-l" aria-label="선적 서류">
      <p className="rail-title">선적 서류 · {state.documents.length}</p>
      {state.documents.map((item) => {
        const superseded = Boolean(item.superseded_by_document_id);
        return (
          <button
            key={item.document_id}
            type="button"
            title="원문 대조 열기"
            className={`rail-doc${state.selectedDocument?.document_id === item.document_id ? " is-selected" : ""}${superseded ? " is-superseded" : ""}`}
            onClick={() => void store.openDocumentModal(item.document_id)}
          >
            <span className="rail-doc__type">{item.document_type}</span>
            <span className="rail-doc__meta">
              <strong>{item.filename}</strong>
              <small>{documentTypeLabel(item.document_type)}</small>
            </span>
            <span className={`rail-doc__tag${superseded ? " is-superseded" : ""}`}>{superseded ? "대체됨" : "활성"}</span>
          </button>
        );
      })}
      {state.documents.length === 0 ? <EmptyCopy>등록된 문서가 없습니다.</EmptyCopy> : null}
      {store.hasRole("reviewer") ? (
        <button
          className="rail-upload"
          type="button"
          onClick={() => {
            if (current) store.setRoute(current.case_id, "documents");
          }}
        >
          <span className="rail-upload__plus" aria-hidden="true">
            ＋
          </span>
          <span>
            <strong>서류 등록 · 보완</strong>
            <small>텍스트 · .txt만 지원</small>
          </span>
        </button>
      ) : (
        <RoleBoundaryNote>승인자 역할은 원문을 읽을 수 있지만 문서를 등록할 수는 없습니다.</RoleBoundaryNote>
      )}
    </aside>
  );
}

/**
 * The mockup's agent trace rail, populated from the run's own bounded workflow.
 * Nothing is streamed or invented: these are the stages the Backend recorded.
 */
export function TraceRail() {
  const store = useStore();
  const state = useWorkbenchState();
  const current = state.selectedCase;
  const run = state.selectedRun;

  if (!state.traceRailOpen) {
    return (
      <aside className="workspace__rail-r workspace__rail-r--collapsed">
        <button className="rail-expand" type="button" title="트레이스 펼치기" onClick={() => store.setTraceRailOpen(true)}>
          <span>‹</span>
          <span className="rail-expand__label">트레이스</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="workspace__rail-r" aria-label="Agent 실행 트레이스">
      <div className="trace-head">
        <div className="trace-head__row">
          <strong>Agent 실행 트레이스</strong>
          <button
            className="rail-collapse"
            type="button"
            title="접기"
            aria-label="트레이스 접기"
            onClick={() => store.setTraceRailOpen(false)}
          >
            »
          </button>
        </div>
        <p className="trace-head__sub">
          {run
            ? `실행 상태 ${display(run.workflow.status)} · 이 실행에서 실제로 수행한 제한형 workflow입니다.`
            : "아직 실행된 심사가 없습니다."}
        </p>
        {run ? (
          <div className="trace-counts">
            <TraceCount value={run.workflow.stages.length} label="처리 단계" />
            <TraceCount value={run.workflow.planner.actions.length} label="계획 실행" />
            <TraceCount value={run.workflow.reextractions.length} label="제한 재추출" />
          </div>
        ) : null}
      </div>
      <div className="trace-body">
        {run ? <Workflow run={run} /> : <EmptyCopy>심사를 실행하면 Agent 처리 트레이스가 표시됩니다.</EmptyCopy>}
      </div>
      <div className="trace-foot">
        <button
          className="button button--secondary button--full"
          type="button"
          onClick={() => {
            if (current) store.setRoute(current.case_id, "assistant");
          }}
        >
          💬 AI 도우미 열기 →
        </button>
      </div>
    </aside>
  );
}

function Workflow({ run }: { run: ReviewRun }) {
  return (
    <ol className="workflow-list">
      {run.workflow.stages.map((stage) => (
        <li key={`${stage.stage}-${stage.attempt_count}`} className={`workflow-step workflow-step--${stage.status}`}>
          <span className="workflow-dot" aria-hidden="true" />
          <div>
            <strong>{workflowLabel(stage.stage)}</strong>
            <p>{stage.summary}</p>
            <small>
              상태: {display(stage.status)} · 실행 {stage.attempt_count}회
            </small>
          </div>
        </li>
      ))}
      <li className="workflow-planner" data-planner-trace="true">
        <strong>제한형 계획 · {run.workflow.planner.cycle_count}회 cycle</strong>
        <ol className="planner-action-list">
          {run.workflow.planner.actions.map((action, index) => (
            <li key={`${action.action}-${action.cycle}-${index}`} className={`planner-action planner-action--${action.status}`}>
              <span>{action.cycle}차</span>
              <strong>{plannerActionLabel(action.action)}</strong>
              <span>{action.summary}</span>
              {action.correction_proposal_ids.length ? (
                <small>반영한 정정 제안 {action.correction_proposal_ids.length}건</small>
              ) : null}
            </li>
          ))}
        </ol>
      </li>
      {run.workflow.reextractions.length ? (
        <li className="workflow-retry">
          <strong>제한 재추출</strong>
          <span>{run.workflow.reextractions.length}개 문서에서 누락 필드 확인을 한 번만 재시도했습니다.</span>
        </li>
      ) : null}
    </ol>
  );
}
