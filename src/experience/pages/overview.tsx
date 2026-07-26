import { useState } from "react";
import { Link } from "react-router";
import type { ReviewRun } from "../../api/v1/types";
import type {
  GroundedPresentationSection,
  GroundedPresentationStatement,
  ReviewExperienceEnvelope,
  UserActionEvent,
} from "../../api/v2/types";
import { useCaseWorkspace } from "../case-context";
import { Icon } from "../icons";
import {
  agentToolLabel,
  agentToolReasonLabel,
  agentToolStatusLabel,
  assessmentLabels,
  dispositionLabels,
  executionStatusLabels,
  presentationSectionLabels,
} from "../labels";
import { ReviewProgress } from "../components/review-progress";
import { CaseCitationLink } from "../components/citation-link";

export function OverviewPage(): React.ReactElement {
  const { caseDetail, selectedRun, experience, experienceError, refresh } = useCaseWorkspace();
  return (
    <div className="page-stack" data-testid="case-overview">
      <ReviewProgress caseId={caseDetail.case_id} onCompleted={refresh} />
      {!selectedRun ? (
        <section className="empty-business-state content-panel">
          <Icon name="documents" />
          <h2>아직 실행된 심사가 없습니다.</h2>
          <p>문서를 등록한 다음 위의 ‘새 심사 실행’을 선택하십시오.</p>
        </section>
      ) : (
        <>
          <ResultHero run={selectedRun} experience={experience} />
          <WhatAgentChecked run={selectedRun} />
          {experienceError ? (
            <p className="experience-warning" role="status">
              사용자용 장문 설명을 불러오지 못해 안전한 기본 설명을 표시합니다. {experienceError}
            </p>
          ) : null}
          <PresentationReport caseId={caseDetail.case_id} run={selectedRun} experience={experience} />
          <UserActionSummary
            caseId={caseDetail.case_id}
            events={experience?.user_action_events ?? []}
          />
          <TechnicalRunDrawer run={selectedRun} />
        </>
      )}
    </div>
  );
}

function ResultHero({
  run,
  experience,
}: {
  run: ReviewRun;
  experience: ReviewExperienceEnvelope | null;
}): React.ReactElement {
  const tone = run.assessment === "issues_detected" ? "warning" : run.assessment === "indeterminate" ? "hold" : "positive";
  return (
    <section className={`result-hero result-hero--${tone}`} aria-labelledby="result-heading">
      <div className="result-hero__icon"><Icon name={tone === "positive" ? "check" : "warning"} /></div>
      <div className="result-hero__main">
        <p className="overline">이번 심사의 결론</p>
        <h2 id="result-heading" tabIndex={-1}>
          {experience?.user_presentation.headline
            ?? fallbackHeadline(run)}
        </h2>
        <p>{resultMeaning(run)}</p>
      </div>
      <div className="result-hero__status">
        <span>처리 상태</span>
        <strong>{dispositionLabels[run.review_disposition ?? "human_review_required"]}</strong>
      </div>
      <dl className="result-facts">
        <div><dt>실행</dt><dd>{executionStatusLabels[run.execution_status]}</dd></div>
        <div><dt>판정</dt><dd>{assessmentLabels[run.assessment ?? "indeterminate"]}</dd></div>
        <div><dt>문서 확인 사항</dt><dd>{run.issues.length}건</dd></div>
        <div><dt>규정 확인 사항</dt><dd>{run.findings.length}건</dd></div>
      </dl>
      <p className="result-hero__boundary">이 결과는 담당자의 사전 검토를 돕는 정보이며 법적 통관 승인 결과가 아닙니다.</p>
    </section>
  );
}

function WhatAgentChecked({ run }: { run: ReviewRun }): React.ReactElement {
  const completed = run.review_stage_trace?.filter((item) => item.status === "completed") ?? [];
  return (
    <section className="agent-checked content-panel" aria-labelledby="agent-checked-title">
      <div className="section-heading">
        <div><p className="overline">Agent 수행 과정</p><h2 id="agent-checked-title">Agent가 다음 순서로 확인했습니다.</h2></div>
        <span>{completed.length}개 필수 단계 확인</span>
      </div>
      <ol className="agent-process" data-testid="agent-process">
        {[
          ["문서 분석", `${run.fields.length}개 핵심 값을 읽었습니다.`],
          ["문서 대조", `${run.issues.length}개의 문서 확인 사항을 판별했습니다.`],
          ["법령 검색", `${run.evidence.length}개의 관련 근거를 확인했습니다.`],
          ["규정 검토", `${run.findings.length}개의 규정 확인 사항을 정리했습니다.`],
          ["설명 검증", "결과 설명이 원문과 법령 근거에 연결되는지 확인했습니다."],
        ].map(([title, detail], index) => (
          <li key={title}>
            <span>{index + 1}</span>
            <p><strong>{title}</strong><small>{detail}</small></p>
          </li>
        ))}
      </ol>
      <div className="adaptive-action-summary" data-testid="adaptive-action-timeline">
        <div>
          <p className="overline">제한형 추가 조사</p>
          <h3>
            {run.action_trace.length > 0
              ? `Agent가 필요한 부분을 ${run.action_trace.length}회 추가 확인했습니다.`
              : "이번 심사에서는 별도 추가 조사가 필요하지 않았습니다."}
          </h3>
          <p>
            Agent는 허용된 문서 재확인과 동일 법령 범위 재조회만 수행하며,
            판정이나 담당자 승인을 임의로 바꾸지 않습니다.
          </p>
        </div>
        {run.action_trace.length > 0 ? (
          <ol>
            {run.action_trace.map((action, index) => (
              <li key={action.action_id}>
                <span>{index + 1}</span>
                <div>
                  <strong>{agentToolLabel(action.tool)}</strong>
                  <p>{agentToolReasonLabel(action.reason_code)}</p>
                </div>
                <small>{agentToolStatusLabel(action.status)}</small>
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

function PresentationReport({
  caseId,
  run,
  experience,
}: {
  caseId: string;
  run: ReviewRun;
  experience: ReviewExperienceEnvelope | null;
}): React.ReactElement {
  const sections = experience?.user_presentation.sections ?? fallbackSections(run);
  return (
    <section className="presentation-report" aria-labelledby="presentation-heading">
      <div className="presentation-report__heading">
        <div>
          <p className="overline">AI 심사 보고서</p>
          <h2 id="presentation-heading">이번 심사 결과를 이해하기 쉽게 설명합니다.</h2>
        </div>
        <span><Icon name="shield" />근거 연결 확인됨</span>
      </div>
      <div className="presentation-sections">
        {sections.map((section, index) => (
          <article
            key={section.section_code}
            className={`presentation-section presentation-section--${section.section_code}`}
            data-testid={`report-section-${section.section_code}`}
          >
            <header><span>{String(index + 1).padStart(2, "0")}</span><h3>{presentationSectionLabels[section.section_code]}</h3></header>
            <div>
              {section.statements.length === 0 ? <p className="presentation-empty">현재 심사에서 별도로 확인된 내용이 없습니다.</p> : null}
              {section.statements.map((statement) => (
                <PresentationStatementView
                  key={statement.statement_id}
                  caseId={caseId}
                  statement={statement}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PresentationStatementView({
  caseId,
  statement,
}: {
  caseId: string;
  statement: GroundedPresentationStatement;
}): React.ReactElement {
  return (
    <div className={`presentation-statement presentation-statement--${statement.role}`}>
      <p>{statement.text}</p>
      {statement.citation_references.length > 0 ? (
        <div className="presentation-citations" aria-label="이 설명의 근거">
          {statement.citation_references.map((citation) => (
            <CaseCitationLink
              key={`${statement.statement_id}-${citation.reference_id}`}
              caseId={caseId}
              citation={citation}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UserActionSummary({
  caseId,
  events,
}: {
  caseId: string;
  events: UserActionEvent[];
}): React.ReactElement | null {
  if (events.length === 0) return null;
  const needsAttention = events.filter((event) => event.status === "needs_attention").length;
  return (
    <section
      className="user-action-summary content-panel"
      aria-labelledby="user-action-summary-title"
      data-testid="user-action-summary"
    >
      <div className="section-heading">
        <div>
          <p className="overline">담당자 다음 조치</p>
          <h2 id="user-action-summary-title">Agent가 이어서 확인할 업무를 정리했습니다.</h2>
          <p>결과를 자동으로 바꾸지 않으며, 담당자가 내용을 확인한 뒤 처리합니다.</p>
        </div>
        <span>{needsAttention > 0 ? `${needsAttention}건 확인 필요` : "현재 확인 완료"}</span>
      </div>
      <ol>
        {events.map((event, index) => (
          <li key={event.event_id}>
            <span>{index + 1}</span>
            <div>
              <strong>{event.title}</strong>
              <p>{event.description}</p>
            </div>
            <small>{userActionStatusLabel(event.status)}</small>
          </li>
        ))}
      </ol>
      <Link
        className="commercial-button commercial-button--secondary"
        to={`/cases/${encodeURIComponent(caseId)}/review-actions`}
      >
        담당자 검토 화면 열기
      </Link>
    </section>
  );
}

function userActionStatusLabel(status: UserActionEvent["status"]): string {
  const labels: Record<UserActionEvent["status"], string> = {
    completed: "확인 완료",
    needs_attention: "담당자 확인 필요",
    deferred: "추가 자료 대기",
  };
  return labels[status];
}

function TechnicalRunDrawer({ run }: { run: ReviewRun }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="technical-run-details"
      data-testid="technical-run-details"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>이 심사 회차의 기술 검증 정보</summary>
      {open ? (
      <dl>
        <div><dt>심사 회차 식별자</dt><dd>{run.review_run_id}</dd></div>
        <div><dt>결과 해시</dt><dd>{run.result_digest ?? "없음"}</dd></div>
        <div><dt>입력 해시</dt><dd>{run.input_manifest_digest ?? "없음"}</dd></div>
        <div><dt>Agent 버전</dt><dd>{run.release_identity?.agent_package_version ?? "없음"}</dd></div>
        <div><dt>Claude 모델</dt><dd>{run.release_identity?.model_id ?? "없음"}</dd></div>
        <div><dt>법령 데이터 스냅샷</dt><dd>{run.release_identity?.evidence_snapshot_id ?? "없음"}</dd></div>
      </dl>
      ) : null}
    </details>
  );
}

function fallbackHeadline(run: ReviewRun): string {
  if (run.assessment === "no_issue_detected") return "등록된 문서와 확인 가능한 법령 범위에서 별도 문제를 발견하지 않았습니다.";
  if (run.assessment === "issues_detected") return "담당자가 확인해야 할 문서 또는 규정 사항을 발견했습니다.";
  return "확정하기 어려운 항목이 있어 담당자 확인이 필요합니다.";
}

function resultMeaning(run: ReviewRun): string {
  if (run.assessment === "no_issue_detected") {
    return "문서 간 핵심 값과 현재 조회 가능한 규정 요건을 대조한 결과입니다. 다만 이 UAT 환경에서는 자동 처리하지 않습니다.";
  }
  if (run.assessment === "issues_detected") {
    return "발견된 사항의 원인과 근거를 아래 보고서에서 확인한 뒤 필요한 조치를 진행해야 합니다.";
  }
  return "문서나 근거가 충분하지 않아 Agent가 임의로 결론 내리지 않고 사람 검토로 안전하게 넘겼습니다.";
}

function fallbackSections(run: ReviewRun): GroundedPresentationSection[] {
  const statement = (
    section: GroundedPresentationSection["section_code"],
    role: GroundedPresentationStatement["role"],
    text: string,
  ): GroundedPresentationStatement => ({
    statement_id: `fallback-${section}`,
    role,
    text,
    source_claim_ids: [],
    citation_references: [],
    material: role !== "limitation",
  });
  return [
    { section_code: "conclusion", title: presentationSectionLabels.conclusion, statements: [statement("conclusion", "conclusion", fallbackHeadline(run))] },
    { section_code: "process", title: presentationSectionLabels.process, statements: [statement("process", "observation", `Agent는 ${run.fields.length}개 추출값을 정리한 뒤 문서 대조와 법령 검색, 규정 확인을 순서대로 수행했습니다.`)] },
    { section_code: "document_comparison", title: presentationSectionLabels.document_comparison, statements: [statement("document_comparison", "observation", run.issues.length === 0 ? "문서 사이에서 별도의 불일치를 발견하지 않았습니다." : `문서 사이에서 담당자가 확인해야 할 사항 ${run.issues.length}건을 발견했습니다.`)] },
    { section_code: "issues_and_causes", title: presentationSectionLabels.issues_and_causes, statements: [statement("issues_and_causes", "reason", run.issues.length === 0 && run.findings.length === 0 ? "현재 확인 범위에서는 결과에 영향을 줄 문제가 발견되지 않았습니다." : "문서 원문, 추출값, 법령 근거를 함께 대조해 원인을 확인해야 합니다.")] },
    { section_code: "regulatory_meaning", title: presentationSectionLabels.regulatory_meaning, statements: [statement("regulatory_meaning", "evidence", `제한된 3종 법령 검색에서 관련 근거 ${run.evidence.length}건을 확인했습니다.`)] },
    { section_code: "business_impact", title: presentationSectionLabels.business_impact, statements: [statement("business_impact", "impact", run.review_disposition === "blocked" ? "현재 상태에서는 다음 처리 단계로 진행할 수 없습니다." : "담당자 검토가 끝나기 전에는 이 결과를 최종 판단으로 사용할 수 없습니다.")] },
    { section_code: "next_actions", title: presentationSectionLabels.next_actions, statements: [statement("next_actions", "action", run.required_actions.length > 0 ? `표시된 필수 조치 ${run.required_actions.length}건을 확인하고 처리하십시오.` : "원문과 근거를 확인한 뒤 담당자 검토를 완료하십시오.")] },
    { section_code: "scope_and_limits", title: presentationSectionLabels.scope_and_limits, statements: [statement("scope_and_limits", "limitation", "현재 결과는 텍스트 입력과 실제 3종 법령 범위의 내부 사용자 검증 결과입니다. OCR, 58종 전체 법령, 법적 승인, 운영 자동 처리는 포함하지 않습니다.")] },
  ];
}
