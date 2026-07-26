import { useEffect, useState, type FormEvent } from "react";
import type { CorrectionProposal } from "../../api/v1/types";
import { useCaseWorkspace } from "../case-context";
import { useWorkbench } from "../context";
import { Icon } from "../icons";
import {
  actionLabel,
  fieldLabel,
  findingLabel,
  issueLabel,
  severityLabels,
} from "../labels";

export function ReviewActionsPage(): React.ReactElement {
  const { caseDetail, selectedRun, refresh } = useCaseWorkspace();
  const { api, session } = useWorkbench();
  const [proposals, setProposals] = useState<CorrectionProposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadProposals = async (): Promise<void> => {
    if (!selectedRun) return;
    setProposals(await api.listRevisionProposals(selectedRun.review_run_id));
  };

  useEffect(() => { void loadProposals().catch((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : "수정 제안 이력을 불러오지 못했습니다.");
  }); }, [selectedRun?.review_run_id]);

  if (!selectedRun) {
    return <div className="empty-business-state content-panel"><Icon name="actions" /><h2>담당자 검토를 시작할 결과가 없습니다.</h2><p>심사를 실행한 뒤 확인·수정·재심사를 진행할 수 있습니다.</p></div>;
  }

  const createCorrection = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedRun.result_digest) {
      setError("결과 결박 정보를 확인할 수 없어 수정 제안을 만들 수 없습니다.");
      return;
    }
    const manifest = selectedRun.agent_input_manifest_sha256 ?? selectedRun.input_manifest_digest;
    if (!manifest) {
      setError("입력 문서 결박 정보를 확인할 수 없어 수정 제안을 만들 수 없습니다.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const fieldId = String(form.get("field_id"));
    const field = selectedRun.fields.find((item) => item.field_id === fieldId);
    if (!field) {
      setError("수정할 항목을 다시 선택해 주십시오.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createRevisionProposal(selectedRun.review_run_id, {
        parent_result_digest: selectedRun.result_digest,
        parent_input_manifest_sha256: manifest,
        case_revision: caseDetail.revision,
        actions: [{
          decision: "correct_field",
          reason: String(form.get("reason")),
          correction: {
            document_id: field.document_id,
            field_path: field.field_path,
            new_value: String(form.get("new_value")),
            reason: String(form.get("reason")),
            confidence: 1,
          },
        }],
      }, `proposal-${crypto.randomUUID()}`);
      event.currentTarget.reset();
      await loadProposals();
      setNotice("수정 제안을 저장했습니다. 다른 승인 담당자가 확인하기 전에는 기존 결과가 바뀌지 않습니다.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "수정 제안을 저장하지 못했습니다.");
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
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api.decideRevisionProposal(proposal.proposal_id, {
        decision,
        reason: String(form.get("reason")),
        parent_result_digest: selectedRun.result_digest,
        case_revision: caseDetail.revision,
      }, `decision-${crypto.randomUUID()}`);
      await Promise.all([loadProposals(), refresh()]);
      setNotice(decision === "approve"
        ? "제안을 승인하고 새 심사 회차를 요청했습니다."
        : "제안을 거절했습니다. 기존 심사 결과는 유지됩니다.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "제안 결정을 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack" data-testid="review-actions-page">
      <header className="subpage-heading">
        <div><p className="overline">담당자 검토</p><h2>확인 사항을 처리하고 수정·재심사를 진행합니다.</h2><p>Agent 결과를 직접 바꾸지 않고, 제안과 독립 승인을 통해 새 심사 회차를 만듭니다.</p></div>
        <span>{proposals.filter((item) => item.status === "pending").length}개 승인 대기</span>
      </header>
      {notice ? <p className="success-notice" role="status">{notice}</p> : null}
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <section className="action-summary-grid">
        <article className="content-panel">
          <div className="section-heading"><div><h3>문서 확인 사항</h3><p>원문과 대조해야 할 값입니다.</p></div><span>{selectedRun.issues.length}</span></div>
          {selectedRun.issues.length === 0 ? <p className="nothing-found"><Icon name="check" />별도의 문서 확인 사항이 없습니다.</p> : (
            <ul className="business-finding-list">{selectedRun.issues.map((item) => (
              <li key={item.issue_id} id={`reference-${item.issue_id}`} tabIndex={-1}><span className={`severity severity--${item.severity}`}>{severityLabels[item.severity]}</span><p><strong>{issueLabel(item.code)}</strong><small>문서 원문과 추출값을 함께 대조해 확인해야 합니다.</small></p></li>
            ))}</ul>
          )}
        </article>
        <article className="content-panel">
          <div className="section-heading"><div><h3>규정 확인 사항</h3><p>법령 근거와 연결된 요건입니다.</p></div><span>{selectedRun.findings.length}</span></div>
          {selectedRun.findings.length === 0 ? <p className="nothing-found"><Icon name="check" />별도의 규정 확인 사항이 없습니다.</p> : (
            <ul className="business-finding-list">{selectedRun.findings.map((item) => (
              <li key={item.finding_id} id={`reference-${item.finding_id}`} tabIndex={-1}><span className={`severity severity--${item.severity}`}>{severityLabels[item.severity]}</span><p><strong>{findingLabel(item.code)}</strong><small>법령 근거와 등록된 요건 증명서를 함께 확인해야 합니다.</small></p></li>
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
          <form className="correction-form" onSubmit={(event) => void createCorrection(event)}>
            <label><span>수정할 추출 항목</span><select name="field_id" required defaultValue="">
              <option value="" disabled>항목 선택</option>
              {selectedRun.fields.map((field) => <option key={field.field_id} value={field.field_id}>{fieldLabel(field.name, field.field_path)} · 현재값 {String(field.value ?? "없음")}</option>)}
            </select></label>
            <label><span>확인한 새 값</span><input name="new_value" required maxLength={2_000} /></label>
            <label><span>수정 사유</span><textarea name="reason" required minLength={3} maxLength={2_000} rows={3} /></label>
            <button className="commercial-button commercial-button--primary" type="submit" disabled={busy}>수정 제안 저장</button>
          </form>
        </article>
        <article className="content-panel" data-testid="hitl-proposals">
          <p className="overline">독립 승인</p>
          <h3>저장된 제안을 확인합니다.</h3>
          {proposals.length === 0 ? <p className="nothing-found">아직 등록된 수정 제안이 없습니다.</p> : (
            <div className="proposal-list">{proposals.map((proposal) => {
              const canDecide = proposal.status === "pending"
                && session?.roles.includes("approver")
                && session.subject !== proposal.created_by;
              return (
                <article key={proposal.proposal_id} className={`proposal proposal--${proposal.status}`}>
                  <header><strong>{proposal.status === "pending" ? "승인 대기" : proposal.status === "approved" ? "승인됨" : "거절됨"}</strong><small>제안자 {proposal.created_by}</small></header>
                  <p>{proposal.actions.length}개 변경 요청 · 기존 결과는 보존됩니다.</p>
                  {canDecide ? (
                    <form onSubmit={(event) => void decide(event, proposal, (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "reject" ? "reject" : "approve")}>
                      <label><span>검토 의견</span><input name="reason" required minLength={3} maxLength={2_000} /></label>
                      <div><button className="commercial-button commercial-button--primary" type="submit" value="approve" disabled={busy}>승인·재심사</button><button className="commercial-button commercial-button--secondary" type="submit" value="reject" disabled={busy}>거절</button></div>
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
