import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { userFacingErrorMessage } from "../../api/user-facing-errors";
import type { PublicStageEvent, ReviewJobExperience } from "../../api/v2/types";
import { canMutate } from "../capabilities";
import { useWorkbench } from "../context";
import { formatDuration, stageLabels } from "../labels";

interface PendingReview {
  orgId: string;
  actorId: string;
  caseId: string;
  jobId: string | null;
  idempotencyKey: string;
  reviewAsOf: string;
  startedAt: string;
}

const STORAGE_KEY = "customs.enhanced.pending-review";
const SAFE_TERMINAL_JOB_STATES = new Set([
  "succeeded",
  "failed",
  "response_received_rejected",
]);
const UNCERTAIN_JOB_STATES = new Set([
  "delivery_uncertain",
  "response_persistence_uncertain",
]);
const REVIEW_STAGE_ORDER = [
  "request_validation",
  "document_analysis",
  "normalization",
  "document_pairing",
  "cross_validation",
  "evidence_retrieval",
  "compliance_review",
  "adaptive_investigation",
  "report_composition",
  "grounding_verification",
  "result_validation",
] as const satisfies readonly PublicStageEvent["stage_code"][];

export function ReviewProgress({
  caseId,
  hasReviewableDocuments,
  onCompleted,
}: {
  caseId: string;
  hasReviewableDocuments: boolean;
  onCompleted(): Promise<void>;
}): React.ReactElement {
  const { experienceApi, metadata, session } = useWorkbench();
  const canStartReview = canMutate(session, "start_review");
  const [job, setJob] = useState<ReviewJobExperience | null>(null);
  const [events, setEvents] = useState<PublicStageEvent[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingBinding, setPendingBinding] = useState<PendingReview | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const beginStreaming = async (jobId: string, startedAt: string): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    startedAtRef.current = new Date(startedAt).getTime();
    try {
      const current = await experienceApi.getReviewJob(jobId, caseId);
      setJob(current);
      if (UNCERTAIN_JOB_STATES.has(current.job.status)) {
        setError(
          "심사 요청의 전달 또는 저장 완료 여부를 확정할 수 없습니다. 같은 심사를 다시 실행하지 않고 서버 조정 결과를 기다립니다.",
        );
        return;
      }
      if (SAFE_TERMINAL_JOB_STATES.has(current.job.status)) {
        setElapsed(current.elapsed_seconds);
        startedAtRef.current = null;
        clearPending();
        setPendingBinding(null);
        if (current.job.status === "succeeded") {
          await onCompleted();
        } else {
          setError("심사를 안전하게 완료하지 못했습니다. 기존 결과를 유지하고 담당자에게 확인해 주십시오.");
        }
        return;
      }
      await experienceApi.streamReviewEvents(jobId, (event) => {
        setEvents((previous) => (
          previous.some((item) => item.sequence === event.sequence)
            ? previous
            : [...previous, event].sort((left, right) => left.sequence - right.sequence)
        ));
      }, controller.signal);
      const final = await experienceApi.getReviewJob(jobId, caseId);
      setJob(final);
      if (UNCERTAIN_JOB_STATES.has(final.job.status)) {
        setElapsed(final.elapsed_seconds);
        startedAtRef.current = null;
        setError(
          "심사 요청의 전달 또는 저장 완료 여부를 확정할 수 없습니다. 같은 심사를 다시 실행하지 않고 서버 조정 결과를 기다립니다.",
        );
      } else if (SAFE_TERMINAL_JOB_STATES.has(final.job.status)) {
        setElapsed(final.elapsed_seconds);
        startedAtRef.current = null;
        clearPending();
        setPendingBinding(null);
        if (final.job.status === "succeeded") {
          await onCompleted();
        } else {
          setError("심사를 안전하게 완료하지 못했습니다. 기존 결과를 유지하고 담당자에게 확인해 주십시오.");
        }
      } else {
        setError("실행 단계 연결이 먼저 종료되었습니다. 새로고침하면 같은 심사 작업을 다시 확인합니다.");
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(userFacingErrorMessage(reason, "실행 단계 연결이 끊겼습니다."));
      }
    }
  };

  const enqueuePending = async (target: PendingReview): Promise<void> => {
    if (target.caseId !== caseId) {
      setPendingBinding(target);
      setError("다른 심사 건의 실행 확인이 끝나지 않아 새 심사를 시작하지 않았습니다.");
      return;
    }
    setStarting(true);
    setPendingBinding(target);
    try {
      const response = await experienceApi.enqueueReview(caseId, {
        review_as_of: target.reviewAsOf,
        trade_type: "import",
        submitted_document_codes: [],
      }, target.idempotencyKey);
      const confirmed = { ...target, jobId: response.job.job_id };
      writePending(confirmed);
      setPendingBinding(confirmed);
      setJob(response);
      await beginStreaming(response.job.job_id, target.startedAt);
    } catch (reason) {
      setError(userFacingErrorMessage(reason, "심사를 시작하지 못했습니다."));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    const restored = readPending(session?.org_id, session?.subject);
    setPendingBinding(restored);
    if (restored && restored.caseId !== caseId) {
      setError("다른 심사 건에서 확인 중인 실행이 있습니다. 해당 심사 건의 실행 상태를 먼저 확인해 주십시오.");
    } else if (restored?.caseId === caseId) {
      if (restored.reviewAsOf !== metadata?.supported_review_as_of) {
        if (restored.jobId === null) {
          clearPending();
          setPendingBinding(null);
          setError("전송 전 심사 요청의 기준일이 현재 환경과 달라 해당 요청을 취소했습니다.");
        } else {
          setError("이미 전송된 심사의 기준일이 현재 환경과 다릅니다. 같은 요청을 다시 실행하지 않고 기존 상태를 확인합니다.");
          void beginStreaming(restored.jobId, restored.startedAt);
        }
      } else if (restored.jobId) {
        void beginStreaming(restored.jobId, restored.startedAt);
      } else {
        void enqueuePending(restored);
      }
    }
    return () => abortRef.current?.abort();
  }, [caseId, metadata?.supported_review_as_of, session?.org_id, session?.subject]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsed(Math.max(0, (Date.now() - startedAtRef.current) / 1_000));
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const start = async (): Promise<void> => {
    setError(null);
    setEvents([]);
    if (!canStartReview) {
      setError("현재 권한에서는 새 심사를 실행할 수 없습니다.");
      return;
    }
    if (!hasReviewableDocuments) {
      setError("심사를 시작하려면 상업송장·포장명세서·선하증권·원산지증명서 중 한 개 이상의 텍스트 문서를 먼저 등록해야 합니다.");
      return;
    }
    if (!session || !metadata?.supported_review_as_of) {
      setError("현재 로그인 정보와 심사 기준일을 확인할 수 없습니다.");
      return;
    }
    const restored = readPending(session.org_id, session.subject);
    if (restored) {
      setPendingBinding(restored);
      if (restored.caseId !== caseId) {
        setError("다른 심사 건의 실행 확인이 끝나지 않아 새 심사를 시작하지 않았습니다.");
      } else if (restored.reviewAsOf !== metadata.supported_review_as_of) {
        setError("이미 기록된 심사 요청의 기준일이 현재 환경과 달라 새 실행을 차단했습니다.");
      } else if (restored.jobId) {
        await beginStreaming(restored.jobId, restored.startedAt);
      } else {
        await enqueuePending(restored);
      }
      return;
    }
    const pending: PendingReview = {
      orgId: session.org_id,
      actorId: session.subject,
      caseId,
      jobId: null,
      idempotencyKey: `review-${crypto.randomUUID()}`,
      reviewAsOf: metadata.supported_review_as_of,
      startedAt: new Date().toISOString(),
    };
    writePending(pending);
    setPendingBinding(pending);
    await enqueuePending(pending);
  };

  const latest = events.at(-1);
  const handledStages = useMemo(
    () => REVIEW_STAGE_ORDER.filter((stageCode) => events.some(
      (event) => event.stage_code === stageCode
        && (event.state === "completed" || event.state === "skipped"),
    )),
    [events],
  );
  const stageJournal = useMemo(() => REVIEW_STAGE_ORDER.map((stageCode) => {
    const matching = events.filter((event) => event.stage_code === stageCode);
    const latestForStage = matching.at(-1);
    return {
      stageCode,
      state: latestForStage?.state ?? "pending",
      durationMs: latestForStage?.duration_ms ?? null,
    };
  }), [events]);
  const active = job !== null
    && !SAFE_TERMINAL_JOB_STATES.has(job.job.status)
    && !UNCERTAIN_JOB_STATES.has(job.job.status)
    && latest?.stage_code !== "completed"
    && latest?.stage_code !== "failed";
  const awaitingReconciliation = job !== null && UNCERTAIN_JOB_STATES.has(job.job.status);
  const blockedByAnotherCase = pendingBinding !== null && pendingBinding.caseId !== caseId;
  const retryingUnconfirmedEnqueue = pendingBinding?.caseId === caseId
    && pendingBinding.jobId === null;
  const startBlocked = pendingBinding !== null && !retryingUnconfirmedEnqueue;
  const showStageJournal = job !== null && events.length > 0;

  return (
    <section className={`review-launcher${active ? " is-active" : ""}`} aria-labelledby="review-launcher-title">
      <div className="review-launcher__copy">
        <p className="overline">AI 사전심사</p>
        <h2 id="review-launcher-title">
          {active
            ? "Agent가 심사를 진행하고 있습니다."
            : awaitingReconciliation
              ? "기존 심사의 전달·저장 상태를 확인하고 있습니다."
              : blockedByAnotherCase
                ? "다른 심사 건의 실행 확인이 필요합니다."
                : "현재 문서로 새 심사를 실행합니다."}
        </h2>
        <p>{active
          ? "화면을 닫거나 새로고침해도 같은 실행을 이어서 확인할 수 있습니다."
          : awaitingReconciliation
            ? "중복 Claude·Agent 호출을 막기 위해 같은 요청의 서버 조정 결과가 확정될 때까지 새 실행을 차단합니다."
            : blockedByAnotherCase
              ? "저장된 실행 결박을 덮어쓰지 않습니다. 원래 심사 건에서 상태를 확인해 주십시오."
          : "실제 Claude 문서 분석과 3종 법령 검색을 순서대로 수행합니다."}</p>
      </div>
      {!active && !startBlocked && canStartReview && hasReviewableDocuments ? (
        <button
          className="commercial-button commercial-button--primary"
          type="button"
          onClick={() => void start()}
          disabled={starting}
          data-testid="start-review"
        >
          {starting
            ? "심사 준비 중"
            : retryingUnconfirmedEnqueue
              ? "같은 심사 요청 다시 확인"
              : "새 심사 실행"}
        </button>
      ) : null}
      {!hasReviewableDocuments ? (
        <p className="read-only-notice" role="note">
          심사를 시작할 일반 문서가 없습니다. <Link to={`/cases/${encodeURIComponent(caseId)}/documents`}>문서 등록 화면으로 이동</Link>
        </p>
      ) : null}
      {retryingUnconfirmedEnqueue ? (
        <p className="read-only-notice" role="note">
          최초 전송 응답을 받지 못했습니다. 새 요청을 만들지 않고 저장된 동일 요청 번호로만 처리 여부를 다시 확인합니다.
        </p>
      ) : null}
      {!canStartReview ? (
        <p className="read-only-notice" role="note">
          현재 권한에서는 새 심사를 실행할 수 없습니다. 기존 심사 결과와 실행 이력은 확인할 수 있습니다.
        </p>
      ) : null}
      {showStageJournal ? (
        <div
          className={`live-review${active ? " is-running" : " is-finished"}`}
          data-testid="review-progress"
          data-review-state={active ? "running" : job.job.status}
          aria-live="polite"
        >
          <div className="live-review__pulse" aria-hidden="true" />
          <div className="live-review__current">
            <span>{active ? "현재 단계" : "마지막 실행 상태"}</span>
            <strong data-testid="current-stage">
              {latest ? stageLabels[latest.stage_code] : "실행 환경 확인"}
            </strong>
          </div>
          <div><span>경과 시간</span><strong data-testid="elapsed-time">{formatDuration(elapsed)}</strong></div>
          <div>
            <span>예상 소요 범위</span>
            <strong data-testid="eta-range">
              {job ? `${formatDuration(job.eta.lower_seconds)}~${formatDuration(job.eta.upper_seconds)}` : "약 4~7분"}
            </strong>
          </div>
          <div>
            <span>처리 단계</span>
            <strong data-testid="handled-stage-count">{handledStages.length}/{REVIEW_STAGE_ORDER.length}개</strong>
          </div>
          <ol className="live-review__stages" aria-label="Agent 전체 실행 단계">
            {stageJournal.map((stage, index) => (
              <li
                key={stage.stageCode}
                data-stage-code={stage.stageCode}
                data-stage-state={stage.state}
              >
                <span>{index + 1}</span>
                <strong>{stageLabels[stage.stageCode]}</strong>
                <small>
                  {stage.state === "completed"
                    ? stage.durationMs === null
                      ? "완료"
                      : `${formatDuration(stage.durationMs / 1_000)} 만에 완료`
                    : stage.state === "skipped"
                      ? "안전 기준에 따라 생략"
                      : stage.state === "failed"
                        ? "완료하지 못함"
                        : stage.state === "started" || stage.state === "progress"
                          ? "진행 중"
                          : "대기"}
                </small>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
    </section>
  );
}

function readPending(orgId: string | undefined, actorId: string | undefined): PendingReview | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingReview>;
    if (
      typeof value.caseId !== "string"
      || typeof value.orgId !== "string"
      || typeof value.actorId !== "string"
      || (value.jobId !== null && typeof value.jobId !== "string")
      || typeof value.idempotencyKey !== "string"
      || !/^review-[0-9a-f-]{36}$/u.test(value.idempotencyKey)
      || typeof value.reviewAsOf !== "string"
      || !/^\d{4}-\d{2}-\d{2}$/u.test(value.reviewAsOf)
      || typeof value.startedAt !== "string"
      || value.orgId !== orgId
      || value.actorId !== actorId
      || !Number.isFinite(new Date(value.startedAt).getTime())
    ) {
      clearPending();
      return null;
    }
    return {
      orgId: value.orgId,
      actorId: value.actorId,
      caseId: value.caseId,
      jobId: value.jobId ?? null,
      idempotencyKey: value.idempotencyKey,
      reviewAsOf: value.reviewAsOf,
      startedAt: value.startedAt,
    };
  } catch {
    clearPending();
    return null;
  }
}

function writePending(value: PendingReview): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function clearPending(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}
