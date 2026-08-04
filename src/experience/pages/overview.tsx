import { useState } from "react";
import { Link } from "react-router";
import type { ReviewRun } from "../../api/v1/types";
import type {
  GroundedPresentationStatement,
  PublicReviewExperience,
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
  const {
    caseDetail,
    selectedRun,
    experience,
    experienceError,
    loadingRun,
    refresh,
  } = useCaseWorkspace();
  return (
    <div className="page-stack" data-testid="case-overview">
      <ReviewProgress
        caseId={caseDetail.case_id}
        hasReviewableDocuments={caseDetail.documents.some(
          (document) => document.document_type !== "SUPPORTING",
        )}
        onCompleted={refresh}
      />
      {!selectedRun ? (
        <section className="empty-business-state content-panel">
          <Icon name="documents" />
          <h2>아직 실행된 심사가 없습니다.</h2>
          <p>문서를 등록한 다음 위의 ‘새 심사 실행’을 선택하십시오.</p>
        </section>
      ) : (
        <>
          <ResultHero
            run={selectedRun}
            experience={experience}
            citationReady={!loadingRun}
          />
          <WhatAgentChecked run={selectedRun} experience={experience} />
          {experienceError ? (
            <PresentationUnavailable detail={experienceError} />
          ) : null}
          {experience ? (
            <PresentationReport
              caseId={caseDetail.case_id}
              reviewRunId={selectedRun.review_run_id}
              experience={experience}
              actualDocumentModelCalls={selectedRun.actual_document_model_calls}
              inheritedDocumentModelCalls={selectedRun.inherited_document_model_calls}
            />
          ) : null}
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
  citationReady,
}: {
  run: ReviewRun;
  experience: PublicReviewExperience | null;
  citationReady: boolean;
}): React.ReactElement {
  const tone = run.assessment === "issues_detected" ? "warning" : run.assessment === "indeterminate" ? "hold" : "positive";
  return (
    <section className={`result-hero result-hero--${tone}`} aria-labelledby="result-heading">
      <div className="result-hero__icon"><Icon name={tone === "positive" ? "check" : "warning"} /></div>
      <div className="result-hero__main">
        <p className="overline">이번 심사의 결론</p>
        <h2
          id="result-heading"
          tabIndex={-1}
          data-citation-ready={citationReady ? "true" : undefined}
          data-review-run-id={run.review_run_id}
        >
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

function WhatAgentChecked({
  run,
  experience,
}: {
  run: ReviewRun;
  experience: PublicReviewExperience | null;
}): React.ReactElement {
  const adaptiveInvestigations = run.action_trace.filter((action) => (
    action.tool === "document.reread_span/v1" || action.tool === "evidence.retrieve/v3"
  ));
  const stepDefinitions = [
    {
      title: "문서 분석",
      stages: ["classify_documents", "extract_documents"],
      completedDetail: `${run.fields.length}개 핵심 값을 읽었습니다.`,
    },
    {
      title: "문서 대조",
      stages: ["pair_documents", "validate_cross_documents"],
      completedDetail: `${run.issues.length}개의 문서 확인 사항을 판별했습니다.`,
    },
    {
      title: "법령 검색",
      stages: ["retrieve_regulations"],
      completedDetail: `${run.evidence.length}개의 관련 근거를 확인했습니다.`,
    },
    {
      title: "규정 검토",
      stages: ["compliance_review"],
      completedDetail: `${run.findings.length}개의 규정 확인 사항을 정리했습니다.`,
    },
  ].map((definition) => ({
    ...definition,
    state: coreStageState(run, definition.stages),
  }));
  const explanationState: DisplayStageState = experience ? "completed" : "not_completed";
  const steps = [
    ...stepDefinitions,
    {
      title: "설명 검증",
      state: explanationState,
      completedDetail: experience
        ? experience.user_presentation.verification_audit.status === "passed"
          ? "Claude 설명과 근거 연결을 별도로 검증했습니다."
          : "Claude 설명 대신 검증된 결정론적 보고서를 사용했습니다."
        : "검증된 사용자용 보고서를 확인하지 못했습니다.",
    },
  ];
  const completedCount = steps.filter((step) => step.state === "completed").length;
  return (
    <section className="agent-checked content-panel" aria-labelledby="agent-checked-title">
      <div className="section-heading">
        <div><p className="overline">Agent 수행 과정</p><h2 id="agent-checked-title">Agent가 다음 순서로 확인했습니다.</h2></div>
        <span>{completedCount}/{steps.length}개 사용자 확인 단계 완료</span>
      </div>
      <ol className="agent-process" data-testid="agent-process">
        {steps.map((step, index) => (
          <li key={step.title} data-stage-state={step.state}>
            <span>{index + 1}</span>
            <p>
              <strong>{step.title}</strong>
              <small>
                {step.state === "completed"
                  ? step.completedDetail
                  : stageStateDescription(step.state)}
              </small>
            </p>
            <em>{stageStateLabel(step.state)}</em>
          </li>
        ))}
      </ol>
      <div className="adaptive-action-summary" data-testid="adaptive-action-timeline">
        <div>
          <p className="overline">제한형 추가 조사</p>
          <h3>
            {adaptiveInvestigations.length > 0
              ? `Agent가 필요한 부분을 ${adaptiveInvestigations.length}회 추가 확인했습니다.`
              : "이번 심사에서는 별도 추가 조사가 필요하지 않았습니다."}
          </h3>
          <p>
            Agent는 허용된 문서 재확인과 동일 법령 범위 재조회만 수행하며,
            판정이나 담당자 승인을 임의로 바꾸지 않습니다.
          </p>
        </div>
        {adaptiveInvestigations.length > 0 ? (
          <ol>
            {adaptiveInvestigations.map((action, index) => (
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

type DisplayStageState = "completed" | "needs_review" | "failed" | "not_completed";

function coreStageState(run: ReviewRun, stages: string[]): DisplayStageState {
  const entries = stages.map((stage) => (
    run.review_stage_trace?.find((entry) => entry.stage === stage)
  ));
  if (entries.some((entry) => entry?.status === "failed")) return "failed";
  if (entries.some((entry) => entry?.status === "partial" || entry?.status === "needs_review")) {
    return "needs_review";
  }
  if (entries.every((entry) => entry?.status === "completed")) return "completed";
  return "not_completed";
}

function stageStateLabel(state: DisplayStageState): string {
  return {
    completed: "완료",
    needs_review: "추가 확인",
    failed: "완료하지 못함",
    not_completed: "미확인",
  }[state];
}

function stageStateDescription(state: DisplayStageState): string {
  return {
    completed: "",
    needs_review: "이 단계에 추가 확인이 필요한 항목이 있습니다.",
    failed: "이 단계를 안전하게 완료하지 못했습니다.",
    not_completed: "이 단계의 완료 기록을 확인하지 못했습니다.",
  }[state];
}

function PresentationReport({
  caseId,
  reviewRunId,
  experience,
  actualDocumentModelCalls,
  inheritedDocumentModelCalls,
}: {
  caseId: string;
  reviewRunId: string;
  experience: PublicReviewExperience;
  actualDocumentModelCalls: number | undefined;
  inheritedDocumentModelCalls: number | undefined;
}): React.ReactElement {
  const sections = experience.user_presentation.sections;
  return (
    <section
      className="presentation-report"
      aria-labelledby="presentation-heading"
      data-bound-result-sha256={experience.bound_provider_result_sha256}
      data-generation-mode={experience.user_presentation.generation_audit.mode}
      data-verification-status={experience.user_presentation.verification_audit.status}
      data-actual-document-model-calls={actualDocumentModelCalls ?? ""}
      data-inherited-document-model-calls={inheritedDocumentModelCalls ?? ""}
    >
      <div className="presentation-report__heading">
        <div>
          <p className="overline">AI 심사 보고서</p>
          <h2 id="presentation-heading">이번 심사 결과를 이해하기 쉽게 설명합니다.</h2>
        </div>
        <span><Icon name="shield" />검증된 근거 연결</span>
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
                  reviewRunId={reviewRunId}
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

function PresentationUnavailable({ detail }: { detail: string }): React.ReactElement {
  return (
    <section
      className="experience-warning content-panel"
      role="alert"
      data-testid="presentation-unavailable"
    >
      <div>
        <p className="overline">상세 설명 확인 필요</p>
        <h2>검증된 AI 심사 보고서를 불러오지 못했습니다.</h2>
        <p>
          아래의 기본 심사 상태는 확인할 수 있지만, 원인·근거·영향·다음 조치를
          설명하는 장문 보고서는 표시하지 않습니다. 잠시 후 다시 시도하거나
          담당 관리자에게 문의하십시오.
        </p>
      </div>
      <details>
        <summary>오류 정보 확인</summary>
        <p>{detail}</p>
      </details>
    </section>
  );
}

function PresentationStatementView({
  caseId,
  reviewRunId,
  statement,
}: {
  caseId: string;
  reviewRunId: string;
  statement: GroundedPresentationStatement;
}): React.ReactElement {
  return (
    <div
      className={`presentation-statement presentation-statement--${statement.role}`}
      data-statement-id={statement.statement_id}
      data-material={statement.material ? "true" : "false"}
    >
      <p>{statement.text}</p>
      {statement.citation_references.length > 0 ? (
        <div className="presentation-citations" aria-label="이 설명의 근거">
          {statement.citation_references.map((citation) => (
            <CaseCitationLink
              key={`${statement.statement_id}-${citation.reference_id}`}
              caseId={caseId}
              reviewRunId={reviewRunId}
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
        <div><dt>실제 법령 검색 프로필</dt><dd>{run.evidence_profile ?? "없음"}</dd></div>
        <div><dt>법령 데이터 연결</dt><dd>{run.evidence_data_source ?? "없음"}</dd></div>
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
