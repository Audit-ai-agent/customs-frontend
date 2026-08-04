import { useEffect, useRef, useState, type FormEvent } from "react";
import { userFacingErrorMessage } from "../../api/user-facing-errors";
import type {
  CorrectionProposal,
  ReviewRun,
  SupportingDocumentRecord,
} from "../../api/v1/types";
import type { PublicStageEvent, ReviewJobExperience } from "../../api/v2/types";
import { canMutate } from "../capabilities";
import { useCaseWorkspace } from "../case-context";
import { useWorkbench } from "../context";
import { Icon } from "../icons";
import { derivedIdempotencyKey } from "../idempotency";
import {
  actionLabel,
  actorRoleLabel,
  fieldLabel,
  findingLabel,
  formatDuration,
  issueLabel,
  severityLabels,
  stageLabels,
} from "../labels";

const CHILD_REVIEW_OBSERVATION_TIMEOUT_MS = 12 * 60 * 1_000;
const CHILD_REVIEW_TERMINAL_STATES = new Set([
  "succeeded",
  "failed",
  "delivery_uncertain",
  "response_received_rejected",
  "response_persistence_uncertain",
]);

export function ReviewActionsPage(): React.ReactElement {
  const { caseDetail, selectedRun, loadingRun, refresh } = useCaseWorkspace();
  const { api, experienceApi, session } = useWorkbench();
  const [proposals, setProposals] = useState<CorrectionProposal[]>([]);
  const [supportingDocuments, setSupportingDocuments] = useState<SupportingDocumentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [childReview, setChildReview] = useState<ReviewJobExperience | null>(null);
  const [childReviewEvents, setChildReviewEvents] = useState<PublicStageEvent[]>([]);
  const activeRunRef = useRef<string | null>(selectedRun?.review_run_id ?? null);
  const childReviewAbortRef = useRef<AbortController | null>(null);
  const canPropose = canMutate(session, "propose_revision");
  const canDecide = canMutate(session, "decide_revision");

  activeRunRef.current = selectedRun?.review_run_id ?? null;

  const loadProposals = async (): Promise<void> => {
    if (!selectedRun) return;
    const targetRunId = selectedRun.review_run_id;
    const next = await api.listRevisionProposals(targetRunId);
    if (activeRunRef.current === targetRunId) setProposals(next);
  };

  useEffect(() => {
    const targetRunId = selectedRun?.review_run_id;
    setProposals([]);
    setSupportingDocuments([]);
    setError(null);
    setNotice(null);
    if (!targetRunId) return;
    void Promise.all([
      api.listRevisionProposals(targetRunId),
      api.listSupportingDocuments(caseDetail.case_id),
    ]).then(([next, supporting]) => {
      if (activeRunRef.current === targetRunId) {
        setProposals(next);
        setSupportingDocuments(supporting);
      }
    }).catch((reason: unknown) => {
      if (activeRunRef.current === targetRunId) {
        setError(userFacingErrorMessage(reason, "수정 제안 이력을 불러오지 못했습니다."));
      }
    });
  }, [api, caseDetail.case_id, selectedRun?.review_run_id]);

  useEffect(() => () => childReviewAbortRef.current?.abort(), []);

  if (!selectedRun) {
    return <div className="empty-business-state content-panel"><Icon name="actions" /><h2>담당자 검토를 시작할 결과가 없습니다.</h2><p>심사를 실행한 뒤 확인·수정·재심사를 진행할 수 있습니다.</p></div>;
  }
  const visibleProposals = proposals.filter(
    (proposal) => proposal.review_run_id === selectedRun.review_run_id,
  );

  const createCorrection = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const proposalForm = event.currentTarget;
    if (!canPropose) {
      setError("현재 계정은 조회 전용이거나 승인 전용이므로 수정 제안을 만들 수 없습니다.");
      return;
    }
    if (!selectedRun.result_digest) {
      setError("결과 결박 정보를 확인할 수 없어 수정 제안을 만들 수 없습니다.");
      return;
    }
    const manifest = selectedRun.agent_input_manifest_sha256 ?? selectedRun.input_manifest_digest;
    if (!manifest) {
      setError("입력 문서 결박 정보를 확인할 수 없어 수정 제안을 만들 수 없습니다.");
      return;
    }
    const form = new FormData(proposalForm);
    const fieldId = String(form.get("field_id"));
    const field = selectedRun.fields.find((item) => item.field_id === fieldId);
    if (!field) {
      setError("수정할 항목을 다시 선택해 주십시오.");
      return;
    }
    const newValue = String(form.get("new_value"));
    const reason = String(form.get("reason"));
    const idempotencyKey = derivedIdempotencyKey("proposal", [
      selectedRun.review_run_id,
      selectedRun.result_digest,
      manifest,
      String(caseDetail.revision),
      field.field_id,
      newValue,
      reason,
    ]);
    setBusy(true);
    setError(null);
    try {
      await api.createRevisionProposal(selectedRun.review_run_id, {
        parent_result_digest: selectedRun.result_digest,
        parent_input_manifest_sha256: manifest,
        case_revision: caseDetail.revision,
        actions: [{
          decision: "correct_field",
          reason,
          correction: {
            document_id: field.document_id,
            field_path: field.field_path,
            new_value: newValue,
            reason,
            confidence: 1,
          },
        }],
      }, idempotencyKey);
      proposalForm.reset();
      await loadProposals();
      setNotice("수정 제안을 저장했습니다. 다른 승인 담당자가 확인하기 전에는 기존 결과가 바뀌지 않습니다.");
    } catch (reason) {
      setError(userFacingErrorMessage(reason, "수정 제안을 저장하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (
    event: FormEvent<HTMLFormElement>,
    proposal: CorrectionProposal,
    decision: "approve" | "reject",
  ): Promise<void> => {
    event.preventDefault();
    if (!selectedRun.result_digest) return;
    const proposalReview = reviewProposal(
      proposal,
      selectedRun,
      caseDetail.revision,
      supportingDocuments,
    );
    if (decision === "approve" && !proposalReview.validForApproval) {
      setError("제안 대상과 현재 심사 회차의 결박을 확인할 수 없어 승인을 차단했습니다.");
      return;
    }
    if (!canDecide || session?.subject === proposal.created_by) {
      setError("제안자와 다른 승인 담당자만 승인 또는 거절할 수 있습니다.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const reason = String(form.get("reason"));
    const idempotencyKey = derivedIdempotencyKey("decision", [
      proposal.proposal_id,
      decision,
      reason,
      selectedRun.result_digest,
      String(caseDetail.revision),
    ]);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await api.decideRevisionProposal(proposal.proposal_id, {
        decision,
        reason,
        parent_result_digest: selectedRun.result_digest,
        case_revision: caseDetail.revision,
      }, idempotencyKey);
      await loadProposals();
      if (decision === "reject") {
        await refresh();
        setNotice("제안을 거절했습니다. 기존 심사 결과는 유지됩니다.");
        return;
      }
      if (!response.job) {
        throw new Error("승인은 저장됐지만 새 심사 작업을 확인할 수 없습니다. 같은 요청을 다시 보내지 말고 담당자에게 확인해 주십시오.");
      }
      setChildReview(null);
      setChildReviewEvents([]);
      setNotice("수정 제안을 승인했습니다. Agent가 수정값을 반영한 새 심사 회차를 진행합니다.");
      await observeChildReview(response.job.job_id, response.job.case_id);
    } catch (reason) {
      setError(userFacingErrorMessage(reason, "제안 결정을 저장하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const observeChildReview = async (jobId: string, expectedCaseId: string): Promise<void> => {
    childReviewAbortRef.current?.abort();
    const controller = new AbortController();
    childReviewAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), CHILD_REVIEW_OBSERVATION_TIMEOUT_MS);
    try {
      const current = await experienceApi.getReviewJob(jobId, expectedCaseId);
      if (current.job.status !== "succeeded") setChildReview(current);
      if (!CHILD_REVIEW_TERMINAL_STATES.has(current.job.status)) {
        await experienceApi.streamReviewEvents(jobId, (event) => {
          setChildReviewEvents((previous) => (
            previous.some((item) => item.sequence === event.sequence)
              ? previous
              : [...previous, event].sort((left, right) => left.sequence - right.sequence)
          ));
        }, controller.signal);
      }
      const final = CHILD_REVIEW_TERMINAL_STATES.has(current.job.status)
        ? current
        : await experienceApi.getReviewJob(jobId, expectedCaseId);
      if (final.job.status !== "succeeded") {
        setChildReview(final);
        if (CHILD_REVIEW_TERMINAL_STATES.has(final.job.status)) {
          throw new Error(childReviewFailureMessage(final.job.status));
        }
        throw new Error("재심사 단계 연결이 먼저 종료되었습니다. 같은 요청을 다시 보내지 말고 심사 이력에서 진행 상태를 확인해 주십시오.");
      }
      await refresh();
      if (!controller.signal.aborted) {
        setChildReview(final);
        setNotice("재심사가 완료되어 수정값, 새 심사 회차와 감사 이력을 반영했습니다.");
      }
    } catch (reason) {
      if (controller.signal.aborted) {
        throw new Error("재심사 확인 시간이 지났습니다. 같은 요청을 다시 보내지 말고 심사 이력에서 진행 상태를 확인해 주십시오.");
      }
      throw reason;
    } finally {
      window.clearTimeout(timeout);
      if (childReviewAbortRef.current === controller) childReviewAbortRef.current = null;
    }
  };

  const submitDecision = (
    event: FormEvent<HTMLFormElement>,
    proposal: CorrectionProposal,
  ): void => {
    const requestedDecision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    if (requestedDecision !== "approve" && requestedDecision !== "reject") {
      event.preventDefault();
      setError("승인 또는 거절 버튼을 직접 선택해 주십시오. 키보드 Enter만으로는 결정을 확정하지 않습니다.");
      return;
    }
    void decide(event, proposal, requestedDecision);
  };

  return (
    <div className="page-stack" data-testid="review-actions-page">
      <header className="subpage-heading">
        <div><p className="overline">담당자 검토</p><h2>확인 사항을 처리하고 수정·재심사를 진행합니다.</h2><p>Agent 결과를 직접 바꾸지 않고, 제안과 독립 승인을 통해 새 심사 회차를 만듭니다.</p></div>
        <span>{visibleProposals.filter((item) => item.status === "pending").length}개 승인 대기</span>
      </header>
      {notice ? <p className="success-notice" role="status">{notice}</p> : null}
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      {childReview ? (
        <section
          className={`review-launcher${childReview.job.status === "succeeded" ? "" : " is-active"}`}
          data-testid="child-review-progress"
          data-job-state={childReview.job.status}
          data-child-job-id={childReview.job.job_id}
          data-child-review-run-id={childReview.job.review_run_id}
          aria-live="polite"
        >
          <div className="review-launcher__copy">
            <p className="overline">수정 반영 재심사</p>
            <h3>{childReview.job.status === "succeeded"
              ? "새 심사 회차가 완료되었습니다."
              : "Agent가 수정값을 반영해 다시 심사하고 있습니다."}</h3>
            <p>{childReviewStageMessage(childReview, childReviewEvents.at(-1))}</p>
          </div>
        </section>
      ) : null}
      <section className="action-summary-grid">
        <article className="content-panel">
          <div className="section-heading"><div><h3>문서 확인 사항</h3><p>원문과 대조해야 할 값입니다.</p></div><span>{selectedRun.issues.length}</span></div>
          {selectedRun.issues.length === 0 ? <p className="nothing-found"><Icon name="check" />별도의 문서 확인 사항이 없습니다.</p> : (
            <ul className="business-finding-list">{selectedRun.issues.map((item) => (
              <li
                key={item.issue_id}
                id={`reference-${item.issue_id}`}
                tabIndex={-1}
                data-citation-ready={loadingRun ? undefined : "true"}
                data-review-run-id={selectedRun.review_run_id}
              ><span className={`severity severity--${item.severity}`}>{severityLabels[item.severity]}</span><p><strong>{issueLabel(item.code)}</strong><small>문서 원문과 추출값을 함께 대조해 확인해야 합니다.</small></p></li>
            ))}</ul>
          )}
        </article>
        <article className="content-panel">
          <div className="section-heading"><div><h3>규정 확인 사항</h3><p>법령 근거와 연결된 요건입니다.</p></div><span>{selectedRun.findings.length}</span></div>
          {selectedRun.findings.length === 0 ? <p className="nothing-found"><Icon name="check" />별도의 규정 확인 사항이 없습니다.</p> : (
            <ul className="business-finding-list">{selectedRun.findings.map((item) => (
              <li
                key={item.finding_id}
                id={`reference-${item.finding_id}`}
                tabIndex={-1}
                data-citation-ready={loadingRun ? undefined : "true"}
                data-review-run-id={selectedRun.review_run_id}
              ><span className={`severity severity--${item.severity}`}>{severityLabels[item.severity]}</span><p><strong>{findingLabel(item.code)}</strong><small>법령 근거와 등록된 요건 증명서를 함께 확인해야 합니다.</small></p></li>
            ))}</ul>
          )}
        </article>
      </section>
      <section className="content-panel required-actions-panel">
        <div className="section-heading"><div><p className="overline">다음 조치</p><h3>담당자가 처리해야 할 항목</h3></div></div>
        {selectedRun.required_actions.length === 0 ? <p className="nothing-found"><Icon name="check" />표시된 필수 조치가 없습니다. 결과 범위를 확인한 뒤 담당자 검토를 완료하십시오.</p> : (
          <ol>{selectedRun.required_actions.map((item, index) => (
            <li key={item.action_id}><span>{index + 1}</span><div><strong>{actionLabel(item.code)}</strong><p>처리한 내용은 담당자 검토 이력에 남습니다.</p></div></li>
          ))}</ol>
        )}
      </section>
      <section className="review-workflow-grid">
        <article className="content-panel">
          <p className="overline">수정 제안</p>
          <h3>원문을 확인한 값을 새 심사에 반영하도록 제안합니다.</h3>
          <p>현재 심사 회차는 그대로 보존되며, 독립 승인 후에만 새 회차가 만들어집니다.</p>
          {!canPropose ? (
            <p className="read-only-notice" role="note">
              현재 계정에서는 저장된 제안만 확인할 수 있습니다. 새 수정 제안은 심사 담당자 또는 관리자가 작성합니다.
            </p>
          ) : null}
          <form className="correction-form" onSubmit={(event) => void createCorrection(event)}>
            <label><span>수정할 추출 항목</span><select name="field_id" required disabled={!canPropose} defaultValue="">
              <option value="" disabled>항목 선택</option>
              {selectedRun.fields.map((field) => <option key={field.field_id} value={field.field_id}>{fieldLabel(field.name, field.field_path)} · 현재값 {String(field.value ?? "없음")}</option>)}
            </select></label>
            <label><span>확인한 새 값</span><input name="new_value" required disabled={!canPropose} maxLength={2_000} /></label>
            <label><span>수정 사유</span><textarea name="reason" required disabled={!canPropose} minLength={3} maxLength={1_000} rows={3} /></label>
            <button className="commercial-button commercial-button--primary" type="submit" disabled={busy || !canPropose}>수정 제안 저장</button>
          </form>
        </article>
        <article className="content-panel" data-testid="hitl-proposals">
          <p className="overline">독립 승인</p>
          <h3>저장된 제안을 확인합니다.</h3>
          {visibleProposals.length === 0 ? <p className="nothing-found">아직 등록된 수정 제안이 없습니다.</p> : (
            <div className="proposal-list">{visibleProposals.map((proposal) => {
              const review = reviewProposal(
                proposal,
                selectedRun,
                caseDetail.revision,
                supportingDocuments,
              );
              const canDecideProposal = proposal.status === "pending"
                && canDecide
                && session?.subject !== proposal.created_by;
              return (
                <article key={proposal.proposal_id} className={`proposal proposal--${proposal.status}`}>
                  <header>
                    <strong>{proposal.status === "pending" ? "승인 대기" : proposal.status === "approved" ? "승인됨" : "거절됨"}</strong>
                    <small>{actorRoleLabel(proposal.created_by, session?.subject, "심사 담당자")} 제안</small>
                  </header>
                  <p>{proposal.actions.length}개 변경 요청 · 기존 결과는 보존됩니다.</p>
                  <div className="proposal-diff" data-testid={`proposal-diff-${proposal.proposal_id}`}>
                    {review.actions.map((action, index) => (
                      <article key={`${proposal.proposal_id}-${index}`}>
                        <h4>{index + 1}. {action.actionLabel}</h4>
                        <dl>
                          <div><dt>변경 대상</dt><dd>{action.targetLabel}</dd></div>
                          <div><dt>현재 값</dt><dd>{action.currentValue}</dd></div>
                          <div><dt>제안 값</dt><dd>{action.proposedValue}</dd></div>
                          <div><dt>제안 사유</dt><dd>{action.reason}</dd></div>
                        </dl>
                      </article>
                    ))}
                  </div>
                  {!review.validForApproval ? (
                    <p className="form-alert" role="alert">
                      현재 심사 회차에서 변경 대상과 원본 값을 정확히 확인할 수 없어 이 제안의 승인을 차단했습니다.
                    </p>
                  ) : null}
                  {canDecideProposal ? (
                    <form onSubmit={(event) => submitDecision(event, proposal)}>
                      <label><span>검토 의견</span><input name="reason" required minLength={3} maxLength={2_000} /></label>
                      <div><button className="commercial-button commercial-button--primary" type="submit" value="approve" disabled={busy || !review.validForApproval}>승인·재심사</button><button className="commercial-button commercial-button--secondary" type="submit" value="reject" disabled={busy}>거절</button></div>
                    </form>
                  ) : proposal.status === "pending" ? <small>제안자와 다른 승인 담당자가 결정해야 합니다.</small> : null}
                </article>
              );
            })}</div>
          )}
        </article>
      </section>
    </div>
  );
}

interface ProposalActionReview {
  actionLabel: string;
  targetLabel: string;
  currentValue: string;
  proposedValue: string;
  reason: string;
  valid: boolean;
}

function reviewProposal(
  proposal: CorrectionProposal,
  run: ReviewRun,
  caseRevision: number,
  supportingDocuments: SupportingDocumentRecord[],
): { validForApproval: boolean; actions: ProposalActionReview[] } {
  const manifest = run.agent_input_manifest_sha256 ?? run.input_manifest_digest;
  const lineageValid = Boolean(
    run.result_digest
    && manifest
    && proposal.org_id === run.org_id
    && proposal.case_id === run.case_id
    && proposal.review_run_id === run.review_run_id
    && proposal.parent_result_digest === run.result_digest
    && proposal.parent_input_manifest_sha256 === manifest
    && proposal.case_revision === caseRevision
    && proposal.actions.length > 0,
  );
  const actions = proposal.actions.map((action): ProposalActionReview => {
    const reason = action.reason.trim() || "제안 사유를 확인할 수 없습니다.";
    if (action.decision === "correct_field") {
      const correction = action.correction;
      const fields = correction === null || correction === undefined
        ? []
        : run.fields.filter((field) => (
          field.document_id === correction.document_id
          && field.field_path === correction.field_path
        ));
      const field = fields.length === 1 ? fields[0] : undefined;
      const documentBound = correction !== null && correction !== undefined
        && run.input_document_manifest?.some(
          (entry) => entry.document_id === correction.document_id,
        ) === true;
      return {
        actionLabel: "추출값 수정",
        targetLabel: field
          ? `${fieldLabel(field.name, field.field_path)} · ${documentTypeForId(run, field.document_id)}`
          : "확인되지 않은 문서 항목",
        currentValue: field ? displayProposalValue(field.value) : "현재 값을 확인할 수 없습니다.",
        proposedValue: correction ? displayProposalValue(correction.new_value) : "제안 값을 확인할 수 없습니다.",
        reason,
        valid: Boolean(field && documentBound && correction && correction.reason.trim().length >= 3),
      };
    }
    if (action.decision === "confirm_field") {
      const referenceId = action.confirmed_reference_id;
      const target = referenceId ? referenceLabel(run, referenceId) : null;
      return {
        actionLabel: "문서 항목 확인",
        targetLabel: target ?? "확인되지 않은 심사 항목",
        currentValue: "담당자 확인 전",
        proposedValue: "원문 대조 확인",
        reason,
        valid: target !== null,
      };
    }
    if (action.decision === "add_supporting_document") {
      const supporting = supportingDocuments.filter(
        (document) => (
          document.document_id === action.supporting_document_id
          && document.case_id === run.case_id
          && document.org_id === run.org_id
        ),
      );
      const document = supporting.length === 1 ? supporting[0] : undefined;
      return {
        actionLabel: "요건 증명서 반영",
        targetLabel: document
          ? `${document.document_code} · ${document.document_number}`
          : "확인되지 않은 요건 증명서",
        currentValue: "심사 결과에 반영되지 않음",
        proposedValue: "새 심사 회차에서 검증 후 반영",
        reason,
        valid: document !== undefined,
      };
    }
    if (action.decision === "approve_review") {
      return {
        actionLabel: "담당자 검토 확인",
        targetLabel: "현재 심사 회차의 담당자 검토 상태",
        currentValue: "담당자 확인 필요",
        proposedValue: "담당자 확인 완료로 새 심사 요청",
        reason,
        valid: action.confirmed_reference_id == null
          && action.supporting_document_id == null
          && action.correction == null,
      };
    }
    return {
      actionLabel: "심사 결과 반려",
      targetLabel: "현재 심사 회차의 담당자 검토 상태",
      currentValue: "담당자 확인 필요",
      proposedValue: "반려 사유를 기록하고 기존 결과 유지",
      reason,
      valid: action.confirmed_reference_id == null
        && action.supporting_document_id == null
        && action.correction == null,
    };
  });
  return {
    validForApproval: lineageValid
      && actions.every((action) => action.valid)
      && proposal.actions.every((action) => action.reason.trim().length >= 3),
    actions,
  };
}

function referenceLabel(run: ReviewRun, referenceId: string): string | null {
  const field = run.fields.find((item) => item.field_id === referenceId);
  if (field) return `${fieldLabel(field.name, field.field_path)} · ${documentTypeForId(run, field.document_id)}`;
  const issue = run.issues.find((item) => item.issue_id === referenceId);
  if (issue) return issueLabel(issue.code);
  const finding = run.findings.find((item) => item.finding_id === referenceId);
  if (finding) return findingLabel(finding.code);
  const evidence = run.evidence.find((item) => item.evidence_id === referenceId);
  if (evidence) return evidence.title;
  const requiredAction = run.required_actions.find((item) => item.action_id === referenceId);
  if (requiredAction) return actionLabel(requiredAction.code);
  return null;
}

function documentTypeForId(run: ReviewRun, documentId: string): string {
  const type = run.input_document_manifest?.find(
    (entry) => entry.document_id === documentId,
  )?.document_type;
  const labels = {
    CI: "상업송장",
    PL: "포장명세서",
    BL: "선하증권",
    CO: "원산지증명서",
    UNKNOWN: "문서 종류 확인 필요",
  } as const;
  return type ? labels[type] : "입력 문서";
}

function displayProposalValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "값 없음";
  if (typeof value === "boolean") return value ? "예" : "아니요";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "구조화된 값";
}

function childReviewFailureMessage(status: string): string {
  if (status === "delivery_uncertain" || status === "response_persistence_uncertain") {
    return "재심사 요청의 전달 또는 저장 완료 여부를 확정할 수 없습니다. 중복 실행하지 말고 심사 이력에서 서버 확인 결과를 기다려 주십시오.";
  }
  if (status === "response_received_rejected") {
    return "재심사 결과가 안전 검증을 통과하지 못해 반영되지 않았습니다. 기존 심사 결과를 유지하고 담당자에게 확인해 주십시오.";
  }
  return "재심사를 안전하게 완료하지 못했습니다. 기존 심사 결과를 유지하고 담당자에게 확인해 주십시오.";
}

function childReviewStageMessage(
  review: ReviewJobExperience,
  latest: PublicStageEvent | undefined,
): string {
  if (review.job.status === "succeeded") {
    return `총 ${formatDuration(review.elapsed_seconds)} 동안 처리했으며 새 회차와 감사 이력을 확인할 수 있습니다.`;
  }
  if (CHILD_REVIEW_TERMINAL_STATES.has(review.job.status)) {
    return childReviewFailureMessage(review.job.status);
  }
  const stage = latest ? stageLabels[latest.stage_code] : "재심사 실행 준비";
  return `${stage} 단계입니다. 현재 ${formatDuration(review.elapsed_seconds)} 경과했으며 예상 범위는 ${formatDuration(review.eta.lower_seconds)}~${formatDuration(review.eta.upper_seconds)}입니다.`;
}
