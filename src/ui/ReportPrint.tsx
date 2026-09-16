import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CaseDetail, ReviewFinding, ReviewRun, ReviewerDecision } from "../api/v1/types";
import { sessionDisplayName } from "./Chrome";
import { citationLabel, decisionReasonLabel, decisionStatusLabel, display, displayComparisonValue, documentAnalysisLabel, evidenceSourceHref, evidenceSourceTypeLabel, findingDisplayTitle, findingKindLabel, formatDate, formatDay, groundedCitations, parseRequirementEvidence, reportSectionDescription, requirementRows, requirementSentence, reviewerSentence, severityLabel, severityWeight, engineKindLabel } from "./labels";
import { nextStepRows } from "./nextSteps";
import { useWorkbenchState } from "./useStore";

/**
 * "PDF로 저장" for the review report.
 *
 * The Browser has no PDF library and the CSP allows no external one, so the
 * report is printed through the browser's own print dialog, where every
 * modern browser offers "PDF로 저장" as a destination. While printing, a
 * dedicated, fully expanded copy of the report is mounted at the end of
 * `<body>`; print.css hides the interactive workbench and shows only that
 * copy. Nothing new is fetched: the report comes from the run already on screen.
 */
export function ReportPrintButton() {
  const state = useWorkbenchState();
  const [printing, setPrinting] = useState(false);
  const run = state.selectedRun;
  const current = state.selectedCase;

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    // One frame lets the portal commit before the dialog snapshots the page.
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  if (!run || !current) return null;
  return (
    <>
      <button
        className="button button--secondary report-print-button"
        type="button"
        disabled={printing}
        title="브라우저 인쇄 창에서 대상을 'PDF로 저장'으로 선택하십시오."
        onClick={() => setPrinting(true)}
      >
        보고서 PDF로 저장
      </button>
      {printing
        ? createPortal(
          <ReportPrintView run={run} current={current} printedBy={sessionDisplayName(state.session?.subject)} />,
          document.body,
        )
        : null}
    </>
  );
}

const TRADE_TYPE_LABELS: Record<ReviewRun["trade_type"], string> = { import: "수입", export: "수출" };

/** The printable report: every section open, no buttons, references as plain text. */
export function ReportPrintView({ run, current, printedBy }: { run: ReviewRun; current: CaseDetail; printedBy: string }) {
  const decisions = new Map(run.reviewer_decisions.map((decision) => [decision.finding_id, decision]));
  const findings = [...run.findings].sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity));
  const open = findings.filter((finding) => !decisions.has(finding.finding_id)).length;
  const steps = nextStepRows(run);
  const printedAt = formatDate(new Date().toISOString());
  return (
    <article className="report-print" aria-hidden="true" data-report-print>
      <header className="report-print__head">
        <p className="report-print__eyebrow">통관 AI 사전심사 작업대 · 근거 기반 심사 보고서</p>
        <h1>{current.title}</h1>
        <dl className="report-print__meta">
          <div>
            <dt>참조번호</dt>
            <dd>{current.external_reference ?? "미지정"}</dd>
          </div>
          <div>
            <dt>심사 기준일</dt>
            <dd>{formatDay(run.review_as_of)}</dd>
          </div>
          <div>
            <dt>거래 유형</dt>
            <dd>{TRADE_TYPE_LABELS[run.trade_type]}</dd>
          </div>
          <div>
            <dt>실행 상태</dt>
            <dd>{display(run.execution_status)}</dd>
          </div>
          <div>
            <dt>AI 평가</dt>
            <dd>{display(run.assessment)}</dd>
          </div>
          <div>
            <dt>처리 방향</dt>
            <dd>{display(run.review_disposition)}</dd>
          </div>
          <div>
            <dt>담당자 판단</dt>
            <dd>{open === 0 ? `${findings.length}건 모두 기록` : `${findings.length}건 중 ${open}건 미판단`}</dd>
          </div>
          <div>
            <dt>심사 실행 일시</dt>
            <dd>{formatDate(run.created_at)}</dd>
          </div>
          <div>
            <dt>출력</dt>
            <dd>{`${printedAt} · ${printedBy}`}</dd>
          </div>
        </dl>
        <p className="report-print__summary">{run.report.summary}</p>
        <p className="report-print__disclaimer">{run.report.disclaimer}</p>
      </header>

      <section className="report-print__section">
        <h2>1. 확인 사항과 담당자 판단</h2>
        {findings.length ? (
          <table className="report-print__table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">확인 사항</th>
                <th scope="col">심각도</th>
                <th scope="col">내용</th>
                <th scope="col">담당자 판단</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding, index) => (
                <tr key={finding.finding_id}>
                  <td className="report-print__num">{index + 1}</td>
                  <td>
                    <strong>{findingDisplayTitle(finding, comparisonFor(finding, run))}</strong>
                    <br />
                    <small>{findingKindLabel(finding)}</small>
                  </td>
                  <td>{severityLabel(finding.severity)}</td>
                  <td>
                    {reviewerSentence(finding.message)}
                    <ComparisonLine finding={finding} run={run} />
                  </td>
                  <td>
                    <DecisionCell decision={decisions.get(finding.finding_id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="report-print__empty">이번 실행에서 확인 사항이 없습니다.</p>
        )}
      </section>

      <section className="report-print__section">
        <h2>2. 이어서 할 일</h2>
        <ol className="report-print__list">
          {steps.map((row) => (
            <li key={row.key}>
              <strong>{row.label}</strong>
              {row.title
                ? ` · 판단 기록: ${row.title}${row.findingIds.length > 1 ? ` (${row.findingIds.length}건)` : ""}`
                : ` · ${row.message ?? ""}`}
            </li>
          ))}
        </ol>
      </section>

      <section className="report-print__section">
        <h2>{`3. Agent 보고서 전문 (${run.report.sections.length}개 구역)`}</h2>
        {run.report.sections.map((section, index) => (
          <div className="report-print__block" key={section.section}>
            <h3>{`${index + 1}. ${section.title}`}</h3>
            <p className="report-print__hint">{reportSectionDescription(section.section)}</p>
            <ol className="report-print__list">
              {section.claims.map((claim) => {
                const citations = groundedCitations(claim);
                return (
                  <li key={claim.claim_id}>
                    {claim.text}
                    {citations.length ? (
                      <small className="report-print__cite">{` [근거: ${citations.map(citationLabel).join(", ")}]`}</small>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </section>

      <section className="report-print__section">
        <h2>{`4. 법령정보 (${run.evidence.length}건)`}</h2>
        {run.evidence.length ? (
          run.evidence.map((item) => {
            const linked = run.findings.filter((finding) => finding.evidence_ids.includes(item.evidence_id)).length;
            const requirement = item.source_type === "customs_requirement" ? parseRequirementEvidence(item.text) : null;
            return (
              <div className="report-print__block" key={item.evidence_id}>
                <h3>{item.title}</h3>
                <p className="report-print__hint">
                  {[evidenceSourceTypeLabel(item.source_type), item.law_name, `연결된 확인 사항 ${linked}건`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {requirement ? (
                  <>
                    <p>{requirementSentence(requirement)}</p>
                    <p className="report-print__hint">
                      {requirementRows(requirement).map((row) => `${row.label} ${row.value}`).join(" · ")}
                    </p>
                  </>
                ) : (
                  <p>{item.text}</p>
                )}
                <p className="report-print__source">{`출처: ${evidenceSourceHref(item) ?? item.source_uri}`}</p>
              </div>
            );
          })
        ) : (
          <p className="report-print__empty">현재 문서와 품목 기준으로 반환된 법령 근거가 없습니다.</p>
        )}
      </section>

      <section className="report-print__section">
        <h2>{`5. 분석 문서 (${run.document_analyses.length}건)`}</h2>
        {run.document_analyses.length ? (
          <table className="report-print__table">
            <thead>
              <tr>
                <th scope="col">파일명</th>
                <th scope="col">판별 유형</th>
                <th scope="col">등록 유형</th>
                <th scope="col">추출 상태</th>
              </tr>
            </thead>
            <tbody>
              {run.document_analyses.map((analysis) => (
                <tr key={analysis.document_id}>
                  <td>{analysis.filename}</td>
                  <td>{documentAnalysisLabel(analysis.document_type)}</td>
                  <td>{analysis.declared_type ? documentAnalysisLabel(analysis.declared_type) : "없음"}</td>
                  <td>{analysis.extraction_status === "complete" ? "사실 추출 완료" : "추가 확인 필요"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="report-print__empty">분석 결과에 문서 정보가 없습니다.</p>
        )}
      </section>

      <footer className="report-print__foot">
        <p>
          {`분석 엔진 ${
            run.agent_engine
              ? `${engineKindLabel(run.agent_engine.kind)} · ${run.agent_engine.model_id}${
                  run.agent_engine.orchestrator ? ` · ${run.agent_engine.orchestrator.framework} ${run.agent_engine.orchestrator.version}` : ""
                }`
              : "미기록"
          } · 결과 규격 V${run.agent_schema_version}`}
        </p>
        <p>이 문서는 AI 사전심사 결과이며 자동 승인되지 않습니다. 담당자 판단과 함께 읽어야 합니다.</p>
      </footer>
    </article>
  );
}

function comparisonFor(finding: ReviewFinding, run: ReviewRun) {
  return finding.comparison_id ? run.comparisons.find((item) => item.comparison_id === finding.comparison_id) : undefined;
}

function ComparisonLine({ finding, run }: { finding: ReviewFinding; run: ReviewRun }) {
  const comparison = comparisonFor(finding, run);
  if (!comparison) return null;
  return (
    <>
      <br />
      <small>
        {`기준 ${displayComparisonValue(comparison.expected_value)} · 관측 ${displayComparisonValue(comparison.observed_value)}`}
      </small>
    </>
  );
}

function DecisionCell({ decision }: { decision: ReviewerDecision | undefined }) {
  if (!decision) return <em>미판단</em>;
  // Same rule as the on-screen card: free text repeats only when it adds to the preset.
  const preset = decisionReasonLabel(decision.reason_code);
  const text = decision.reason.trim();
  const reason = [preset, !preset || text !== preset ? text : ""].filter(Boolean).join(" · ");
  return (
    <>
      <strong>{decisionStatusLabel(decision.status)}</strong>
      {reason ? (
        <>
          <br />
          {reason}
        </>
      ) : null}
      <br />
      <small>{`${decision.decided_by} · ${formatDate(decision.decided_at)}`}</small>
    </>
  );
}
