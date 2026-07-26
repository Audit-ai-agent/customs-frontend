import { useState } from "react";
import { Link } from "react-router";
import { useCaseWorkspace } from "../case-context";
import { Icon } from "../icons";
import {
  assessmentLabels,
  dispositionLabels,
  executionStatusLabels,
  formatKoreanDate,
} from "../labels";

export function HistoryPage(): React.ReactElement {
  const { caseDetail, runs, audits } = useCaseWorkspace();
  const [technicalOpen, setTechnicalOpen] = useState(false);
  return (
    <div className="page-stack" data-testid="history-page">
      <header className="subpage-heading">
        <div><p className="overline">심사 이력</p><h2>심사 회차와 사람의 결정을 시간순으로 확인합니다.</h2><p>기존 결과를 덮어쓰지 않고 수정·승인·재심사의 계보를 보존합니다.</p></div>
        <span>{runs.length}개 심사 회차</span>
      </header>
      <section className="history-layout">
        <div className="content-panel">
          <div className="section-heading"><div><h3>심사 회차</h3><p>각 시점의 결과를 다시 열어 비교할 수 있습니다.</p></div></div>
          {runs.length === 0 ? <div className="empty-business-state"><Icon name="history" /><p>심사 이력이 없습니다.</p></div> : (
            <ol className="run-history">{runs.map((run, index) => (
              <li key={run.review_run_id}>
                <span className="history-node">{runs.length - index}</span>
                <div>
                  <header><strong>{runs.length - index}회차 심사</strong><time>{formatKoreanDate(run.created_at)}</time></header>
                  <p>{executionStatusLabels[run.execution_status]} · {assessmentLabels[run.assessment ?? "indeterminate"]} · {dispositionLabels[run.review_disposition ?? "human_review_required"]}</p>
                  <Link to={`/cases/${encodeURIComponent(caseDetail.case_id)}/overview?run=${encodeURIComponent(run.review_run_id)}`}>이 회차 결과 보기<Icon name="arrow" /></Link>
                </div>
              </li>
            ))}</ol>
          )}
        </div>
        <div className="content-panel">
          <div className="section-heading"><div><h3>감사 기록</h3><p>누가 언제 어떤 업무를 수행했는지 확인합니다.</p></div></div>
          {audits.length === 0 ? <p className="nothing-found">표시할 감사 기록이 없습니다.</p> : (
            <ol className="audit-timeline">{audits.map((event) => (
              <li key={event.event_id}><span /><div><header><strong>{event.summary}</strong><time>{formatKoreanDate(event.occurred_at)}</time></header><p>{event.actor_display}</p></div></li>
            ))}</ol>
          )}
        </div>
      </section>
      <details className="technical-run-details" onToggle={(event) => setTechnicalOpen(event.currentTarget.open)}>
        <summary>감사 기록 기술 식별자</summary>
        {technicalOpen ? <ul>{audits.map((event) => <li key={event.event_id}>{event.event_id} · {event.event_type} · {event.target_id}</li>)}</ul> : null}
      </details>
    </div>
  );
}
