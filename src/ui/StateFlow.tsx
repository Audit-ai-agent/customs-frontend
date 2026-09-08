import type { CaseFilter } from "./constants";

/**
 * The real Case state machine, drawn once so every page tells the same story.
 *
 * Only three states exist on the Backend (`open` → `in_review` → `closed`) and
 * only two transitions move a Case: starting the AI review, and the reviewer's
 * explicit closure after every 확인 사항 has a recorded judgement. There is no
 * automatic path to 종료 — this diagram must never suggest one.
 */
const STATES: readonly { id: Exclude<CaseFilter, "all">; label: string; hint: string; x: number }[] = [
  { id: "open", label: "진행 전", hint: "서류 등록 · 심사 시작 전", x: 20 },
  { id: "in_review", label: "검토 중", hint: "AI 사전심사 완료 · 담당자 판단", x: 300 },
  { id: "closed", label: "종료", hint: "담당자가 종료 기록", x: 580 },
];

const BOX_W = 180;
const BOX_H = 62;
const BOX_Y = 44;

export function CaseStateFlow({ activeStatus, compact }: { activeStatus?: string | null; compact?: boolean }) {
  const width = 780;
  const height = compact ? 150 : 214;
  return (
    <figure className={`state-flow${compact ? " state-flow--compact" : ""}`}>
      <svg
        className="state-flow__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="state-flow-title state-flow-desc"
        preserveAspectRatio="xMidYMid meet"
      >
        <title id="state-flow-title">Case 상태 흐름</title>
        <desc id="state-flow-desc">
          진행 전에서 AI 사전심사를 시작하면 검토 중이 되고, 모든 확인 사항에 담당자 판단이 기록된 뒤 담당자가 종료를
          기록해야 종료됩니다. 자동으로 종료되는 경로는 없습니다.
        </desc>
        <defs>
          <marker id="state-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="state-flow__arrowhead" />
          </marker>
        </defs>

        {/* transitions */}
        <g className="state-flow__edges">
          <line x1={STATES[0]!.x + BOX_W} y1={BOX_Y + BOX_H / 2} x2={STATES[1]!.x} y2={BOX_Y + BOX_H / 2} markerEnd="url(#state-flow-arrow)" />
          <text x={(STATES[0]!.x + BOX_W + STATES[1]!.x) / 2} y={BOX_Y + BOX_H / 2 - 12} textAnchor="middle" className="state-flow__edge-label">
            AI 사전심사 시작
          </text>
          <line x1={STATES[1]!.x + BOX_W} y1={BOX_Y + BOX_H / 2} x2={STATES[2]!.x} y2={BOX_Y + BOX_H / 2} markerEnd="url(#state-flow-arrow)" />
          <text x={(STATES[1]!.x + BOX_W + STATES[2]!.x) / 2} y={BOX_Y + BOX_H / 2 - 12} textAnchor="middle" className="state-flow__edge-label">
            담당자 종료 기록
          </text>
          {/* the loop that keeps a Case in 검토 중 until every finding is judged */}
          <path
            d={`M ${STATES[1]!.x + 40} ${BOX_Y + BOX_H} C ${STATES[1]!.x + 40} ${BOX_Y + BOX_H + 40}, ${STATES[1]!.x + BOX_W - 40} ${BOX_Y + BOX_H + 40}, ${STATES[1]!.x + BOX_W - 40} ${BOX_Y + BOX_H + 2}`}
            markerEnd="url(#state-flow-arrow)"
            className="state-flow__loop"
          />
          <text x={STATES[1]!.x + BOX_W / 2} y={BOX_Y + BOX_H + 52} textAnchor="middle" className="state-flow__edge-label">
            확인 사항 판단 기록 · 정정 제안 · 재심사
          </text>
        </g>

        {/* states */}
        {STATES.map((state) => (
          <g key={state.id} className={`state-flow__state state-flow__state--${state.id}${activeStatus === state.id ? " is-active" : ""}`}>
            <rect x={state.x} y={BOX_Y} width={BOX_W} height={BOX_H} rx="10" />
            <text x={state.x + BOX_W / 2} y={BOX_Y + 26} textAnchor="middle" className="state-flow__state-label">
              {state.label}
            </text>
            <text x={state.x + BOX_W / 2} y={BOX_Y + 46} textAnchor="middle" className="state-flow__state-hint">
              {state.hint}
            </text>
          </g>
        ))}

        {compact ? null : (
          <g className="state-flow__note">
            <text x={width / 2} y={height - 34} textAnchor="middle">
              종료 조건 · 모든 확인 사항에 담당자 판단이 기록된 뒤 최종 처리 방향(검토 종결 / 반려·보완 요청)을 선택
            </text>
            <text x={width / 2} y={height - 12} textAnchor="middle" className="state-flow__note-strong">
              자동 종료 경로 없음 — 진행 전에서 종료로 바로 넘어가는 건은 없습니다
            </text>
          </g>
        )}
      </svg>
    </figure>
  );
}

/**
 * The reviewer's own working order inside one Case: what to do at each stage
 * and which state change it produces. Rendered as a numbered list so it reads
 * the same in the app and in the printed report.
 */
export const REVIEWER_WORKFLOW: readonly { step: number; title: string; action: string; outcome: string }[] = [
  { step: 1, title: "Case 등록", action: "제목·참조번호를 입력하고 Case를 만듭니다.", outcome: "상태 진행 전" },
  { step: 2, title: "서류 등록", action: "Invoice·Packing List·B/L·원산지증명서 등을 올리고 추출 텍스트를 확인합니다.", outcome: "HSK 분류 후보 확인" },
  { step: 3, title: "AI 사전심사 실행", action: "심사 시작을 누르면 문서 사실 추출 → 교차 검증 → 법령 근거 검색 → 보고서 생성이 이어집니다.", outcome: "상태 검토 중" },
  { step: 4, title: "확인 사항 판단", action: "각 확인 사항의 근거를 보고 판단 상태와 사유(사전 정의 사유 또는 기타)를 기록합니다.", outcome: "미판단 0건이 되면 종료 가능" },
  { step: 5, title: "정정·재심사 (필요 시)", action: "문서 값이 틀렸으면 정정 제안 → 다른 승인자 승인 → 자식 재심사를 실행합니다.", outcome: "원래 결과는 보존" },
  { step: 6, title: "심사 종료", action: "최종 처리 방향(검토 종결 / 반려·보완 요청)과 종료 사유를 기록합니다.", outcome: "상태 종료 · 읽기 전용" },
];

export function ReviewerWorkflowList() {
  return (
    <ol className="workflow-steps">
      {REVIEWER_WORKFLOW.map((item) => (
        <li key={item.step} className="workflow-steps__item">
          <span className="workflow-steps__n">{item.step}</span>
          <span className="workflow-steps__body">
            <strong>{item.title}</strong>
            <span>{item.action}</span>
            <small>{item.outcome}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
