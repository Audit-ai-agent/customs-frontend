import { useEffect, useRef, useState } from "react";
import type {
  AssistantCitation,
  CreateCorrectionProposalRequest,
  FindingDecisionRequest,
  ReportClaim,
  ReportSection,
  ReviewComparison,
  ReviewFinding,
  ReviewRun,
  ReviewerDecision,
  SourceReference,
} from "../api/v1/types";
import {
  DECISION_REASON_OPTIONS,
  actionLabel,
  citationLabel,
  comparisonStatusLabel,
  decisionReasonLabel,
  decisionStatusLabel,
  display,
  displayComparisonValue,
  displayValue,
  documentAnalysisLabel,
  documentTypeLabel,
  evidenceSourceTypeLabel,
  findingDisplayTitle,
  findingKindLabel,
  focusDataTarget,
  formatDate,
  groundedCitations,
  reportSectionDescription,
  reviewerSentence,
  ruleTitle,
  severityWeight,
} from "./labels";
import {
  CollapsibleSection,
  EmptyCopy,
  EmptyState,
  ExternalSourceLink,
  Field,
  Metric,
  ReportSectionCard,
  RoleBoundaryNote,
  SectionHeading,
  Submit,
} from "./primitives";
import { GoToDocumentsButton, ReportFacts } from "./stages";
import { useStore, useWorkbenchState } from "./useStore";

export function ReviewStage() {
  const store = useStore();
  const state = useWorkbenchState();
  const run = state.selectedRun;
  if (!run) {
    return (
      <EmptyState title="아직 심사 결과가 없습니다." copy="활성 텍스트 문서를 등록한 뒤 AI 심사를 시작하십시오.">
        <GoToDocumentsButton />
      </EmptyState>
    );
  }
  const open = store.openFindings().length;
  const sorted = [...run.findings].sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity));
  return (
    <section className="stage-view grounded-report">
      <header className="surface verdict-panel">
        <VerdictStamp run={run} openCount={open} />
        <div className="verdict-panel__text">
          <p className="eyebrow">근거 기반</p>
          <h2>근거 기반 심사 보고서</h2>
          <p className="summary-copy">{run.report.summary}</p>
          <p className="disclaimer">{run.report.disclaimer}</p>
        </div>
      </header>

      <section className="surface">
        <SectionHeading
          title="확인 사항"
          description={open ? `담당자 판단이 필요한 항목 ${open}건이 남아 있습니다.` : "모든 확인 사항에 담당자 판단이 기록되었습니다."}
        />
        <FindingList findings={sorted} run={run} />
      </section>

      <section className="surface">
        <SectionHeading title="법령정보" description="이 심사 실행이 검색해 인용한 법령 조문입니다." />
        <EvidenceList run={run} />
      </section>

      <section className="surface">
        <SectionHeading title="이어서 할 일" description="이번 실행이 담당자에게 남긴 조치입니다." />
        <NextSteps run={run} />
      </section>

      <CaseClosurePanel />

      {/* The agent narrative and the raw references are reference material: reachable,
          but not stacked on top of the judgement work by default. */}
      <CollapsibleSection
        title={`Agent 보고서 전문 · ${run.report.sections.length}개 구역`}
        description="Agent가 이 실행에서 반환한 주장과 근거 참조를 그대로 표시합니다. 근거 버튼을 누르면 해당 문서 사실, 비교 결과, 법령정보로 이동합니다."
      >
        <div className="report-section-stack">
          {run.report.sections.map((section, index) => (
            <AgentReportSection key={section.section} section={section} index={index} />
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="심사 근거 상세" description="보고서의 각 근거 참조를 더 자세히 확인할 수 있습니다.">
        <div className="report-supporting-data">
          <div className="review-metrics">
            <Metric label="확인 사항" value={run.findings.length} />
            <Metric label="문서 비교" value={run.comparisons.length} />
            <Metric label="법령 근거" value={run.evidence.length} />
            <Metric label="담당자 판단" value={run.reviewer_decisions.length} />
          </div>
          <ReportDocuments run={run} />
          <ReportFacts run={run} />
          <ReportEvidenceRows run={run} />
        </div>
      </CollapsibleSection>
    </section>
  );
}

/** The final step of the journey: record the internal disposition and close. */
function CaseClosurePanel() {
  const store = useStore();
  const state = useWorkbenchState();
  const [disposition, setDisposition] = useState<"cleared" | "returned">("cleared");
  const [reason, setReason] = useState("");
  const current = state.selectedCase;
  if (!current) return null;

  if (current.status === "closed") {
    const closure = current.closure ?? null;
    return (
      <section className="surface" data-case-closure>
        <SectionHeading title="심사 종료" description="이 Case는 종료되었습니다. 결과는 읽기 전용으로 남습니다." />
        {closure ? (
          <p className="form-hint">
            {`${closure.disposition === "cleared" ? "검토 종결" : "반려 · 보완 요청"} · ${closure.closed_by} · ${closure.reason}`}
          </p>
        ) : null}
      </section>
    );
  }

  const closable = store.caseClosable();
  return (
    <section className="surface" data-case-closure>
      <SectionHeading
        title="심사 종료"
        description={
          closable
            ? "모든 확인 사항에 판단이 기록되었습니다. 최종 처리 방향을 선택해 이 Case를 종료할 수 있습니다."
            : "모든 확인 사항에 담당자 판단이 기록되면 Case를 종료할 수 있습니다."
        }
      />
      {store.hasRole("reviewer") ? (
        closable ? (
          <form
            className="decision-form"
            onSubmit={(event) => {
              event.preventDefault();
              void store.closeCase(disposition, reason.trim()).then(() => setReason(""));
            }}
          >
            <Field label="최종 처리 방향">
              <select
                name="closure_disposition"
                value={disposition}
                onChange={(event) => setDisposition(event.target.value as "cleared" | "returned")}
              >
                <option value="cleared">검토 종결 · 이상 없음</option>
                <option value="returned">반려 · 보완 요청 후 종결</option>
              </select>
            </Field>
            <Field label="종료 사유">
              <input
                name="closure_reason"
                type="text"
                required
                maxLength={4_000}
                placeholder="예: 확인 사항 판단 완료, 서류 이상 없음"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <Submit label="심사 종료" disabled={state.busy} />
          </form>
        ) : null
      ) : (
        <RoleBoundaryNote>심사 종료는 심사자 역할에서만 할 수 있습니다.</RoleBoundaryNote>
      )}
    </section>
  );
}

/**
 * The mockup's verdict stamp. It reflects the run's own disposition and the
 * outstanding judgement count; it never claims a clearance the Backend has not given.
 */
function VerdictStamp({ run, openCount }: { run: ReviewRun; openCount: number }) {
  const settled = openCount === 0;
  return (
    <div className={`verdict-stamp verdict-stamp--${settled ? "settled" : "pending"}`}>
      <span className="verdict-stamp__mark">{settled ? "검토\n완료" : "검토\n필요"}</span>
      <span className="verdict-stamp__meta">
        <strong>{display(run.assessment)}</strong>
        <small>처리 방향 · {display(run.review_disposition)}</small>
        <small>{settled ? "판단 기록 완료" : `미판단 ${openCount}건`}</small>
      </span>
    </div>
  );
}

/* ── findings ────────────────────────────────────────────────── */

function comparisonFor(finding: ReviewFinding, run: ReviewRun): ReviewComparison | undefined {
  return finding.comparison_id ? run.comparisons.find((item) => item.comparison_id === finding.comparison_id) : undefined;
}

/** Findings grouped by their display title, in first-appearance order. */
function groupFindings(findings: ReviewFinding[], run: ReviewRun): { title: string; items: ReviewFinding[] }[] {
  const groups: { title: string; items: ReviewFinding[] }[] = [];
  for (const finding of findings) {
    const title = findingDisplayTitle(finding, comparisonFor(finding, run));
    const group = groups.find((entry) => entry.title === title);
    if (group) group.items.push(finding);
    else groups.push({ title, items: [finding] });
  }
  return groups;
}

function FindingList({ findings, run }: { findings: ReviewFinding[]; run: ReviewRun }) {
  const state = useWorkbenchState();
  const containerRef = useRef<HTMLDivElement>(null);
  const focusId = state.findingFocusId;
  const decided = new Set(run.reviewer_decisions.map((decision) => decision.finding_id));
  const unjudged = findings.filter((finding) => !decided.has(finding.finding_id));
  // One card is open at a time; the first outstanding judgement starts open.
  const [expandedId, setExpandedId] = useState<string | null>(unjudged[0]?.finding_id ?? null);

  useEffect(() => {
    if (focusId) {
      setExpandedId(focusId);
      focusDataTarget(containerRef.current, "data-finding-id", focusId);
    }
  }, [focusId]);

  if (!findings.length) {
    return <EmptyState title="등록된 확인 사항이 없습니다." copy="그래도 결과는 자동 완료되지 않으며 담당자 검토가 필요합니다." />;
  }
  const done = findings.length - unjudged.length;
  const goToNext = () => {
    const currentIndex = unjudged.findIndex((finding) => finding.finding_id === expandedId);
    const next = unjudged[(currentIndex + 1) % unjudged.length] ?? unjudged[0];
    if (!next) return;
    setExpandedId(next.finding_id);
    focusDataTarget(containerRef.current, "data-finding-id", next.finding_id);
  };
  return (
    <div className="finding-list" ref={containerRef}>
      <div className="finding-progress" role="status" aria-live="polite">
        <div className="finding-progress__text">
          <strong>{`판단 ${findings.length}건 중 ${done}건 기록`}</strong>
          <span>{unjudged.length ? `미판단 ${unjudged.length}건` : "모든 확인 사항에 판단이 기록되었습니다."}</span>
        </div>
        <progress className="finding-progress__bar" max={findings.length} value={done} aria-label="판단 기록 진행률" />
        <button className="button button--secondary" type="button" onClick={goToNext} disabled={!unjudged.length}>
          다음 미판단으로
        </button>
      </div>
      {groupFindings(findings, run).map((group) => (
        <section className="finding-group" key={group.title} data-finding-group={group.title}>
          <h4 className="finding-group__title">
            {group.title} <span className="finding-group__count">{`· ${group.items.length}건`}</span>
          </h4>
          {group.items.map((finding) => (
            <FindingCard
              key={finding.finding_id}
              finding={finding}
              run={run}
              title={group.title}
              expanded={expandedId === finding.finding_id}
              onToggle={() => setExpandedId(expandedId === finding.finding_id ? null : finding.finding_id)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function FindingCard({
  finding,
  run,
  title,
  expanded,
  onToggle,
}: {
  finding: ReviewFinding;
  run: ReviewRun;
  title: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const store = useStore();
  const state = useWorkbenchState();
  const decision = run.reviewer_decisions.find((item) => item.finding_id === finding.finding_id);
  const comparison = comparisonFor(finding, run);
  const source = store.sourceForFinding(finding);
  const focused = state.findingFocusId === finding.finding_id;
  const message = reviewerSentence(finding.message);
  const reasonLabel = decision ? decisionReasonLabel(decision.reason_code) : null;
  return (
    <article
      data-finding-id={finding.finding_id}
      data-finding-code={finding.code}
      className={`finding-card${decision ? " is-settled" : ""}${focused ? " is-focused" : ""}${expanded ? " is-expanded" : " is-collapsed"}`}
    >
      <header className="finding-heading">
        <div>
          <strong>{title}</strong>
          <span className="finding-kind">{findingKindLabel(finding)}</span>
          <p>{message}</p>
          {!expanded && comparison ? (
            <p className="finding-summary">
              {`기준 ${displayComparisonValue(comparison.expected_value ?? comparison.left.display_value)} · 관측 ${displayComparisonValue(
                comparison.observed_value ?? comparison.right.display_value,
              )}${comparison.unit ? ` · ${comparison.unit}` : ""}`}
            </p>
          ) : null}
          {!expanded && decision ? (
            <p className="finding-summary finding-summary--decision">
              {`담당자 판단: ${decisionStatusLabel(decision.status)}${reasonLabel ? ` · ${reasonLabel}` : ""}`}
            </p>
          ) : null}
        </div>
        <div className="finding-heading__side">
          <span className={`finding-state${decision ? " is-settled" : ""}`}>{decision ? "판단 기록됨" : "판단 필요"}</span>
          <button className="button button--secondary finding-toggle" type="button" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? "접기" : decision ? "자세히" : "판단하기"}
          </button>
        </div>
      </header>
      {expanded ? (
        <>
          {comparison ? <ComparisonDetail comparison={comparison} findingMessage={message} /> : null}
          <div className="finding-links">
            {source ? (
              <button className="text-link" type="button" onClick={() => void store.focusSource(source)}>
                문서 원문 인용 보기
              </button>
            ) : null}
            {finding.evidence_ids.length ? (
              <button className="text-link" type="button" onClick={() => store.focusEvidence(finding.evidence_ids[0] as string)}>
                연결된 법령 근거 {finding.evidence_ids.length}건
              </button>
            ) : null}
          </div>
          <DecisionPanel finding={finding} decision={decision} />
          <CorrectionProposalPanel finding={finding} source={source} />
        </>
      ) : null}
    </article>
  );
}

/**
 * The compared values behind a finding. The Agent copies the comparison message
 * into the finding message verbatim, so the sentence is shown once — on the card —
 * and this block only adds what the card does not already say.
 */
function ComparisonDetail({ comparison, findingMessage }: { comparison: ReviewComparison; findingMessage: string }) {
  const comparisonMessage = reviewerSentence(comparison.message);
  const restated = comparisonMessage.trim() === findingMessage.trim();
  return (
    <div className={`comparison-detail comparison-detail--${comparison.status}`}>
      <span>{`${ruleTitle(comparison.rule_code)} · ${comparisonStatusLabel(comparison.status)}`}</span>
      {restated ? null : <p>{comparisonMessage}</p>}
      <dl className="comparison-values">
        <div>
          <dt>기준</dt>
          <dd className="mono">{displayComparisonValue(comparison.expected_value ?? comparison.left.display_value)}</dd>
        </div>
        <div>
          <dt>관측</dt>
          <dd className="mono">{displayComparisonValue(comparison.observed_value ?? comparison.right.display_value)}</dd>
        </div>
        {comparison.unit ? (
          <div>
            <dt>단위</dt>
            <dd>{comparison.unit}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/** A recorded decision's rationale: the preset label when one was chosen, plus any words the reviewer added. */
function DecisionReason({ entry }: { entry: ReviewerDecision["history"][number] }) {
  const preset = decisionReasonLabel(entry.reason_code);
  const showText = !preset || entry.reason.trim() !== preset;
  return (
    <>
      {preset ? <span className="decision-reason-code">{preset}</span> : null}
      {showText ? <p>{entry.reason}</p> : null}
    </>
  );
}

function DecisionPanel({ finding, decision }: { finding: ReviewFinding; decision: ReviewerDecision | undefined }) {
  const store = useStore();
  const state = useWorkbenchState();
  // Nothing is preselected: a judgement must be chosen deliberately before it can be recorded.
  const [status, setStatus] = useState<FindingDecisionRequest["status"] | "">("");
  const [reasonCode, setReasonCode] = useState<NonNullable<FindingDecisionRequest["reason_code"]> | "">("");
  const [reason, setReason] = useState("");
  const freeTextRequired = reasonCode === "other";
  const canSubmit = status !== "" && reasonCode !== "" && (!freeTextRequired || reason.trim().length > 0) && !state.busy;
  return (
    <details className="decision-panel" open={!decision}>
      <summary>{decision ? "담당자 판단 보기·수정" : "담당자 판단 기록"}</summary>
      {decision ? (
        <div className="decision-history">
          <div className="decision-current">
            <strong>담당자 판단: {decisionStatusLabel(decision.status)}</strong>
            <DecisionReason entry={decision} />
            <small>
              {decision.decided_by} · {formatDate(decision.decided_at)}
            </small>
          </div>
          {decision.history.length > 1 ? (
            <ol className="decision-history-list">
              {decision.history
                .slice(0, -1)
                .reverse()
                .map((entry, index) => (
                  <li key={`${entry.decided_at}-${index}`}>
                    <strong>{decisionStatusLabel(entry.status)}</strong>
                    <span>{decisionReasonLabel(entry.reason_code) ?? entry.reason}</span>
                    <small>
                      {entry.decided_by} · {formatDate(entry.decided_at)}
                    </small>
                  </li>
                ))}
            </ol>
          ) : null}
        </div>
      ) : (
        <p className="decision-empty">아직 담당자 판단이 기록되지 않았습니다.</p>
      )}
      {store.hasRole("reviewer") ? (
        <form
          className="decision-form decision-form--coded"
          onSubmit={(event) => {
            event.preventDefault();
            if (status === "" || reasonCode === "" || (freeTextRequired && !reason.trim())) return;
            void store
              .decideFinding(finding.finding_id, { status, reason_code: reasonCode, reason: reason.trim() })
              .then(() => {
                setReason("");
                setStatus("");
                setReasonCode("");
              });
          }}
        >
          <Field label="판단 상태">
            <select
              name="status"
              value={status}
              required
              onChange={(event) => setStatus(event.target.value as FindingDecisionRequest["status"] | "")}
            >
              <option value="">선택하십시오</option>
              <option value="confirmed">확인함</option>
              <option value="needs_information">추가자료 요청</option>
              <option value="resolved">해결됨</option>
            </select>
          </Field>
          <Field label="판단 사유">
            <select
              name="reason_code"
              value={reasonCode}
              required
              onChange={(event) => setReasonCode(event.target.value as NonNullable<FindingDecisionRequest["reason_code"]> | "")}
            >
              <option value="">선택하십시오</option>
              {DECISION_REASON_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={freeTextRequired ? "사유 직접 기재 (필수)" : "추가 의견 (선택)"}>
            <textarea
              name="reason"
              required={freeTextRequired}
              rows={3}
              maxLength={4_000}
              placeholder={freeTextRequired ? "기타 사유를 구체적으로 기록하십시오." : "사전 정의 사유에 덧붙일 내용이 있으면 기록하십시오."}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <Submit label={decision ? "판단 수정" : "판단 기록"} disabled={!canSubmit} />
          {!canSubmit && !state.busy ? (
            <p className="form-hint decision-form__hint">판단 상태와 사유를 모두 선택하면 기록할 수 있습니다.</p>
          ) : null}
        </form>
      ) : (
        <RoleBoundaryNote>확인 사항 판단은 심사자 역할에서만 기록할 수 있습니다.</RoleBoundaryNote>
      )}
    </details>
  );
}

function CorrectionProposalPanel({ finding, source }: { finding: ReviewFinding; source: SourceReference | null }) {
  const store = useStore();
  const state = useWorkbenchState();
  const draft = state.correctionDraft;
  const matchesDraft =
    draft !== null &&
    (!source || draft.document_id === source.document_id) &&
    (!source || !draft.fact_id || finding.fact_ids.includes(draft.fact_id));
  const target = matchesDraft ? draft : null;
  const documentId = target?.document_id ?? source?.document_id;

  const [fieldName, setFieldName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [unit, setUnit] = useState("");
  const [reason, setReason] = useState("");

  // The assistant's draft only ever pre-fills the form; recording it stays a human action.
  useEffect(() => {
    if (!target) return;
    setFieldName(target.field_name);
    setNewValue(target.new_value);
    setUnit(target.unit ?? "");
    setReason(target.reason);
  }, [target]);

  if (!store.hasRole("reviewer")) {
    return (
      <RoleBoundaryNote>
        정정 제안은 심사자 역할에서만 만들 수 있습니다. 승인자 역할에서는 심사 이력 화면에서 다른 사람이 만든 제안을
        독립적으로 결정할 수 있습니다.
      </RoleBoundaryNote>
    );
  }
  if (!documentId) {
    return (
      <p className="muted">
        이 확인 사항에는 정정할 문서 사실이 연결되어 있지 않습니다. 문서 원문을 보완하거나 AI 도우미의 근거 있는 정정
        제안을 사용하십시오.
      </p>
    );
  }

  const factId = target?.fact_id ?? finding.fact_ids[0] ?? "";
  const itemId = target?.item_id ?? "";

  return (
    <details className="correction-proposal-panel" open={matchesDraft}>
      <summary>{matchesDraft ? "AI 도우미 제안 검토·기록" : "정정 제안 만들기"}</summary>
      <p className="form-hint">
        이 제안은 원문이나 기존 결과를 바꾸지 않습니다. 담당자 승인 후에만 자식 심사 실행에 반영할 수 있습니다.
      </p>
      <form
        className="correction-proposal-form"
        onSubmit={(event) => {
          event.preventDefault();
          const payload: CreateCorrectionProposalRequest = {
            document_id: documentId,
            field_name: fieldName.trim(),
            new_value: newValue.trim(),
            reason: reason.trim(),
            ...(itemId ? { item_id: itemId } : {}),
            ...(factId ? { fact_id: factId } : {}),
            ...(unit.trim() ? { unit: unit.trim() } : {}),
            finding_id: finding.finding_id,
          };
          void store.createCorrectionProposal(payload).then(() => {
            setFieldName("");
            setNewValue("");
            setUnit("");
            setReason("");
          });
        }}
      >
        <Field label="정정할 필드">
          <input
            name="field_name"
            type="text"
            required
            maxLength={64}
            placeholder="예: quantity"
            value={fieldName}
            onChange={(event) => setFieldName(event.target.value)}
          />
        </Field>
        <Field label="제안 값">
          <textarea
            name="new_value"
            required
            rows={8}
            maxLength={2_000}
            placeholder="문서 원문을 기준으로 제안 값을 입력하십시오."
            value={newValue}
            onChange={(event) => setNewValue(event.target.value)}
          />
        </Field>
        <Field label="단위">
          <input
            name="unit"
            type="text"
            maxLength={64}
            placeholder="선택 입력"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />
        </Field>
        <Field label="제안 근거">
          <textarea
            name="reason"
            required
            rows={8}
            maxLength={2_000}
            placeholder="왜 이 값으로 정정해야 하는지 문서 근거를 적으십시오."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <Submit label="정정 제안 기록" disabled={state.busy} />
      </form>
    </details>
  );
}

/* ── evidence, next steps, agent report ──────────────────────── */

function EvidenceList({ run }: { run: ReviewRun }) {
  const state = useWorkbenchState();
  const containerRef = useRef<HTMLDivElement>(null);
  const focusId = state.evidenceFocusId;
  const [referenceOpen, setReferenceOpen] = useState(false);

  // Judgement-relevant first: anything a finding cites, plus the per-HSK
  // requirement rows. The rest are retrieval context, folded by default so
  // the reviewer is not asked to read every search hit.
  const primary = run.evidence.filter(
    (item) =>
      item.source_type === "customs_requirement" ||
      run.findings.some((finding) => finding.evidence_ids.includes(item.evidence_id)),
  );
  const reference = run.evidence.filter((item) => !primary.includes(item));
  const referenceHasFocus = focusId !== null && reference.some((item) => item.evidence_id === focusId);

  useEffect(() => {
    if (referenceHasFocus) setReferenceOpen(true);
  }, [referenceHasFocus]);

  useEffect(() => {
    if (focusId) focusDataTarget(containerRef.current, "data-evidence-id", focusId);
  }, [focusId, referenceOpen]);

  if (!run.evidence.length) {
    return <EmptyCopy>현재 문서와 품목 기준으로 반환된 법령 근거가 없습니다.</EmptyCopy>;
  }

  const card = (item: (typeof run.evidence)[number]) => {
    const linked = run.findings.filter((finding) => finding.evidence_ids.includes(item.evidence_id));
    return (
      <article
        key={item.evidence_id}
        data-evidence-id={item.evidence_id}
        className={`evidence-card${focusId === item.evidence_id ? " is-focused" : ""}`}
      >
        <header>
          <span className="evidence-type">{evidenceSourceTypeLabel(item.source_type)}</span>
          <h3>{item.title}</h3>
        </header>
        {item.law_name ? <p className="evidence-law">{item.law_name}</p> : null}
        <p>{item.text}</p>
        <div className="evidence-footer">
          <span>연결된 확인 사항 {linked.length}건</span>
          <ExternalSourceLink uri={item.source_uri} />
        </div>
      </article>
    );
  };

  // Never fold everything: with no finding-linked rows the full list stays out.
  if (!primary.length || !reference.length) {
    return <div className="evidence-list" ref={containerRef}>{run.evidence.map(card)}</div>;
  }
  return (
    <div className="evidence-list" ref={containerRef}>
      {primary.map(card)}
      <details
        className="evidence-reference"
        open={referenceOpen}
        onToggle={(event) => setReferenceOpen(event.currentTarget.open)}
      >
        <summary>
          {`참고 법령 근거 ${reference.length}건 — 확인 사항과 직접 연결되지 않은 검색 결과`}
        </summary>
        <div className="evidence-list evidence-list--reference">{reference.map(card)}</div>
      </details>
    </div>
  );
}

function NextSteps({ run }: { run: ReviewRun }) {
  const store = useStore();
  const state = useWorkbenchState();
  const actions = run.required_actions.length
    ? run.required_actions
    : [
      {
        action_code: "human_review_required",
        message: "자동 완료하지 않습니다. 담당자가 문서와 법령정보를 확인하십시오.",
        finding_ids: [],
      },
    ];
  // The Agent emits one action per finding whose message is the finding
  // message verbatim. Those are already on the cards above; here they collapse
  // into a pointer to the finding instead of repeating the sentence.
  const findingByMessage = new Map(run.findings.map((finding) => [finding.message.trim(), finding]));
  // Identical "record a judgement" pointers collapse into one line per rule title with a count.
  type Row = { key: string; label: string; title?: string; findingIds: string[]; message?: string };
  const rows: Row[] = [];
  for (const [index, action] of actions.entries()) {
    const restated = findingByMessage.get(action.message.trim());
    if (restated) {
      const title = findingDisplayTitle(restated, comparisonFor(restated, run));
      const key = `judge:${title}`;
      const existing = rows.find((row) => row.key === key);
      if (existing) existing.findingIds.push(restated.finding_id);
      else rows.push({ key, label: "확인 사항 판단", title, findingIds: [restated.finding_id] });
    } else {
      rows.push({
        key: `${action.action_code}-${index}`,
        label: actionLabel(action.action_code),
        findingIds: [],
        message: reviewerSentence(action.message),
      });
    }
  }
  return (
    <div className="next-step-stack">
      <ol className="next-step-list">
        {rows.map((row) => (
          <li key={row.key}>
            <strong>{row.label}</strong>
            {row.title ? (
              <span>
                판단 기록 ·{" "}
                <button className="text-link" type="button" onClick={() => store.focusFinding(row.findingIds[0] as string)}>
                  {row.title}
                </button>
                {row.findingIds.length > 1 ? <span className="next-step-count">{` · ${row.findingIds.length}건`}</span> : null}
              </span>
            ) : (
              <span>{row.message}</span>
            )}
          </li>
        ))}
      </ol>
      <button
        className="button button--secondary"
        type="button"
        onClick={() => {
          if (state.selectedCase) store.setRoute(state.selectedCase.case_id, "assistant");
        }}
      >
        AI 도우미에게 근거 질문하기
      </button>
    </div>
  );
}

function AgentReportSection({ section, index }: { section: ReportSection; index: number }) {
  return (
    <ReportSectionCard
      index={String(index + 1).padStart(2, "0")}
      title={section.title}
      description={reportSectionDescription(section.section)}
      sectionName={section.section}
    >
      <ol className="report-claim-list" data-report-claim-section={section.section}>
        {section.claims.map((claim) => (
          <ReportClaimItem key={claim.claim_id} claim={claim} />
        ))}
      </ol>
    </ReportSectionCard>
  );
}

function ReportClaimItem({ claim }: { claim: ReportClaim }) {
  const citations = groundedCitations(claim);
  return (
    <li className="report-claim" data-report-claim-id={claim.claim_id}>
      <p>{claim.text}</p>
      <div className="report-claim-citations" aria-label="보고서 주장 근거">
        <span>근거</span>
        {citations.map((citation) => (
          <CitationChip key={`${citation.kind}:${citation.reference_id}`} citation={citation} />
        ))}
      </div>
    </li>
  );
}

export function CitationChip({ citation, disabled }: { citation: AssistantCitation; disabled?: boolean }) {
  const store = useStore();
  return (
    <button
      className="citation-chip"
      type="button"
      disabled={disabled ?? false}
      onClick={() => void store.openGroundedCitation(citation).catch((error: unknown) => store.showError(error))}
    >
      {citationLabel(citation)}
    </button>
  );
}

function ReportDocuments({ run }: { run: ReviewRun }) {
  const store = useStore();
  if (!run.document_analyses.length) return <EmptyCopy>분석 결과에 문서 정보가 없습니다.</EmptyCopy>;
  return (
    <div className="report-document-list">
      {run.document_analyses.map((analysis) => (
        <button
          key={analysis.document_id}
          className="report-document-row"
          type="button"
          onClick={() =>
            void store.focusSource({ source_kind: "document", document_id: analysis.document_id, quote: "", occurrence: 0 })}
        >
          <strong>{analysis.filename}</strong>
          <span>
            {`${documentAnalysisLabel(analysis.document_type)} · ${analysis.extraction_status === "complete" ? "사실 추출 완료" : "추가 확인 필요"}`}
          </span>
          <small>{analysis.declared_type ? `등록 유형: ${documentAnalysisLabel(analysis.declared_type)}` : "등록 유형 없음"}</small>
        </button>
      ))}
    </div>
  );
}

function ReportEvidenceRows({ run }: { run: ReviewRun }) {
  const store = useStore();
  if (!run.evidence.length) return <EmptyCopy>이번 실행에서 연결된 법령정보가 없습니다.</EmptyCopy>;
  return (
    <div className="report-evidence-list">
      {run.evidence.map((evidence) => (
        <button
          key={evidence.evidence_id}
          className="report-evidence-row"
          type="button"
          onClick={() => store.focusEvidence(evidence.evidence_id)}
        >
          <strong>{evidence.title}</strong>
          <span>{evidence.law_name ?? evidence.source_type}</span>
          <small className="mono">원문 해시 {evidence.source_hash.slice(0, 12)}…</small>
        </button>
      ))}
    </div>
  );
}
