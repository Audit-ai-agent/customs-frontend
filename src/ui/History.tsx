import { useState } from "react";
import type { CorrectionProposal, ReviewRun } from "../api/v1/types";
import { correctionHistoryLabel, correctionStatusLabel, display, fieldLabel, formatDate } from "./labels";
import { AssistantLoading, EmptyCopy, RoleBoundaryNote, SectionHeading, Submit } from "./primitives";
import { useStore, useWorkbenchState } from "./useStore";

export function HistoryScreen() {
  const store = useStore();
  const state = useWorkbenchState();
  const current = state.selectedCase;
  const selectedRun = state.selectedRun;
  const approvedCount = store.eligibleCorrectionProposals().length;
  const selectedCount = store.selectedEligibleCorrectionProposalIds().length;
  const canRevise = store.hasRole("approver");

  return (
    <section className="history-layout">
      <section className="surface history-main">
        <SectionHeading
          title="심사 이력"
          description="원래 심사 결과를 덮어쓰지 않고, 승인된 정정 제안은 자식 심사 실행으로 남깁니다."
        />
        {selectedRun ? <RunLineage run={selectedRun} /> : null}
        <ol className="history-timeline">
          {state.runs.map((run, index) => {
            const ordinal = state.runs.length - index;
            const parent = run.parent_review_run_id
              ? state.runs.find((item) => item.review_run_id === run.parent_review_run_id)
              : undefined;
            const relation = run.parent_review_run_id
              ? `정정 반영 재심사${parent ? ` · ${formatDate(parent.created_at)} 실행 기준` : ""}`
              : "기준 심사 실행";
            return (
              <li
                key={run.review_run_id}
                className={`history-item${state.selectedRun?.review_run_id === run.review_run_id ? " is-selected" : ""}`}
              >
                <button className="history-button" type="button" onClick={() => void store.selectRun(run.review_run_id)}>
                  <strong>{`${ordinal}차 · ${formatDate(run.created_at)}`}</strong>
                  <span>
                    {display(run.assessment)} · 확인 사항 {run.finding_count}건
                  </span>
                  <small>
                    {relation} · 담당자 판단 {run.reviewer_decision_count}건
                  </small>
                </button>
              </li>
            );
          })}
          {!state.runs.length ? <li className="empty-copy">아직 심사 이력이 없습니다.</li> : null}
        </ol>
        <CorrectionProposalHistory />
      </section>

      <section className="surface history-next">
        <SectionHeading
          title="다음 작업"
          description="문서 보완 또는 선택한 승인 정정 제안을 반영한 재심사를 진행할 수 있습니다."
        />
        <p>
          대체 문서는 서류 등록 단계에서 등록하십시오. 정정 제안은 승인돼도 원래 실행을 바꾸지 않으며, 선택한 항목만 새
          자식 심사에 반영됩니다.
        </p>
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            if (current) store.setRoute(current.case_id, "documents");
          }}
        >
          서류 등록 단계로 이동
        </button>
        {canRevise && approvedCount ? (
          <p className="correction-selection-summary">
            {`재심사에 반영할 승인된 제안을 선택하십시오. 선택 ${selectedCount}건 / 승인 ${approvedCount}건`}
          </p>
        ) : null}
        <button
          className="btn primary"
          type="button"
          disabled={!selectedCount || state.busy || !canRevise}
          {...(canRevise ? {} : { title: "자식 심사 실행은 승인자 역할에서만 가능합니다." })}
          onClick={() => void store.startRevision()}
        >
          {canRevise ? "선택한 정정으로 재심사" : "승인자 역할에서 재심사"}
        </button>
        {!canRevise ? (
          <RoleBoundaryNote>승인자 역할에서 승인된 제안을 선택해 자식 심사를 실행할 수 있습니다.</RoleBoundaryNote>
        ) : null}
      </section>
    </section>
  );
}

function RunLineage({ run }: { run: ReviewRun }) {
  const store = useStore();
  const state = useWorkbenchState();
  const parentId = run.parent_review_run_id;
  const parent = parentId ? state.runs.find((item) => item.review_run_id === parentId) : undefined;
  const childCount = state.runs.filter((item) => item.parent_review_run_id === run.review_run_id).length;
  return (
    <section className="run-lineage-panel">
      <h3>정정 반영 계보</h3>
      <ul className="run-lineage">
        {parentId ? (
          <li>
            <strong>부모 심사</strong>
            <button className="text-link" type="button" onClick={() => void store.selectRun(parentId)}>
              {parent ? `${formatDate(parent.created_at)} 실행 열기` : "이전 실행 열기"}
            </button>
          </li>
        ) : (
          <li>
            <strong>기준 심사</strong>
            <span>이 실행은 이전 정정 제안을 반영한 자식 실행이 아닙니다.</span>
          </li>
        )}
        {run.applied_correction_proposal_ids?.length ? (
          <li>
            <strong>반영된 정정 제안</strong>
            <span>{run.applied_correction_proposal_ids.length}건</span>
          </li>
        ) : null}
        {childCount ? (
          <li>
            <strong>후속 자식 실행</strong>
            <span>{childCount}건</span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function CorrectionProposalHistory() {
  const store = useStore();
  const state = useWorkbenchState();

  if (state.correctionLoading) return <AssistantLoading label="정정 제안 불러오는 중" />;
  if (state.correctionError) {
    return (
      <section className="correction-history">
        <h3>정정 제안</h3>
        <p className="assistant-error">{state.correctionError}</p>
        <button className="text-link" type="button" onClick={() => store.reloadCorrectionProposals()}>
          다시 불러오기
        </button>
      </section>
    );
  }
  return (
    <section className="correction-history">
      <SectionHeading
        title="정정 제안"
        description={
          store.hasRole("approver")
            ? "제안 → 담당자 승인 또는 반려 → 승인된 항목 선택 → 자식 심사 실행의 순서로 진행됩니다."
            : "제안 → 담당자 승인 또는 반려 → 선택된 항목의 자식 심사 실행 순서로 진행됩니다."
        }
      />
      <div className="correction-proposal-list">
        {state.correctionProposals.map((proposal) => (
          <CorrectionProposalCard key={proposal.correction_proposal_id} proposal={proposal} />
        ))}
        {!state.correctionProposals.length ? (
          <EmptyCopy>이 심사 실행에는 기록된 정정 제안이 없습니다.</EmptyCopy>
        ) : null}
      </div>
    </section>
  );
}

function CorrectionProposalCard({ proposal }: { proposal: CorrectionProposal }) {
  const store = useStore();
  const state = useWorkbenchState();
  // Reviewers know documents by file name, not by identifier.
  const documentName = (documentId: string) =>
    state.documents.find((item) => item.document_id === documentId)?.filename ??
    state.selectedRun?.document_analyses.find((item) => item.document_id === documentId)?.filename ??
    "등록 문서";
  const selfProposed = proposal.created_by === state.session?.subject;
  const canDecide = proposal.status === "proposed" && store.hasRole("approver") && !selfProposed;
  const canSelectForRevision = store.hasRole("approver") && proposal.status === "approved" && !proposal.applied_review_run_id;
  const selectedForRevision = state.selectedCorrectionProposalIds.has(proposal.correction_proposal_id);
  const appliedRunId = proposal.applied_review_run_id;

  const [status, setStatus] = useState<"approved" | "rejected">("approved");
  const [reason, setReason] = useState("");

  return (
    <article className={`correction-proposal-card correction-proposal-card--${proposal.status}`}>
      <header>
        <span className="correction-status">{correctionStatusLabel(proposal.status)}</span>
        <small>{formatDate(proposal.created_at)}</small>
      </header>
      <h4>{`${fieldLabel(proposal.field_name)} → ${proposal.new_value}${proposal.unit ? ` ${proposal.unit}` : ""}`}</h4>
      <p>{proposal.reason}</p>
      <small>{documentName(proposal.document_id)}</small>

      {proposal.decision ? (
        <div className="correction-decision">
          <strong>{correctionStatusLabel(proposal.decision.status)}</strong>
          <p>{proposal.decision.reason}</p>
          {proposal.decision.decided_at ? <small>{formatDate(proposal.decision.decided_at)}</small> : null}
        </div>
      ) : null}

      {proposal.history.length ? (
        <ol className="correction-history-list">
          {proposal.history.map((entry, index) => (
            <li key={`${entry.event}-${entry.occurred_at}-${index}`}>
              <strong>{correctionHistoryLabel(entry.event)}</strong>
              <span>{entry.reason}</span>
              <small>
                {entry.actor} · {formatDate(entry.occurred_at)}
              </small>
            </li>
          ))}
        </ol>
      ) : null}

      {canDecide ? (
        <form
          className="correction-decision-form"
          onSubmit={(event) => {
            event.preventDefault();
            void store.decideCorrectionProposal(proposal, { status, reason: reason.trim() }).then(() => setReason(""));
          }}
        >
          <select name="status" value={status} onChange={(event) => setStatus(event.target.value as "approved" | "rejected")}>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
          </select>
          <textarea
            name="reason"
            required
            rows={8}
            maxLength={2_000}
            placeholder="승인 또는 반려 사유를 기록하십시오."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Submit label="결정 기록" disabled={state.busy} />
        </form>
      ) : null}

      {proposal.status === "proposed" && !canDecide ? (
        <RoleBoundaryNote>
          {selfProposed
            ? "제안자는 자신의 제안을 승인하거나 반려할 수 없습니다. 다른 승인자가 결정해야 합니다."
            : "제안의 승인·반려는 승인자 역할에서만 기록할 수 있습니다."}
        </RoleBoundaryNote>
      ) : null}

      {canSelectForRevision ? (
        <label className="correction-proposal-select">
          <input
            type="checkbox"
            data-correction-proposal-id={proposal.correction_proposal_id}
            aria-label={`${proposal.field_name} 정정을 자식 심사에 반영`}
            checked={selectedForRevision}
            onChange={(event) => store.setCorrectionProposalSelected(proposal.correction_proposal_id, event.target.checked)}
          />
          <span>이 정정을 자식 심사에 반영</span>
        </label>
      ) : null}

      {appliedRunId ? (
        <button className="text-link" type="button" onClick={() => void store.openAppliedRevision(appliedRunId)}>
          반영된 자식 심사 열기
        </button>
      ) : null}
    </article>
  );
}
