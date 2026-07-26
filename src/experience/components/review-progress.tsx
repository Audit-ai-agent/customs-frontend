import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicStageEvent, ReviewJobExperience } from "../../api/v2/types";
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
const TERMINAL_JOB_STATES = new Set([
  "succeeded",
  "failed",
  "delivery_uncertain",
  "response_received_rejected",
  "response_persistence_uncertain",
]);

export function ReviewProgress({
  caseId,
  onCompleted,
}: {
  caseId: string;
  onCompleted(): Promise<void>;
}): React.ReactElement {
  const { experienceApi, metadata, session } = useWorkbench();
  const [job, setJob] = useState<ReviewJobExperience | null>(null);
  const [events, setEvents] = useState<PublicStageEvent[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const beginStreaming = async (jobId: string, startedAt: string): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    startedAtRef.current = new Date(startedAt).getTime();
    try {
      const current = await experienceApi.getReviewJob(jobId);
      setJob(current);
      if (TERMINAL_JOB_STATES.has(current.job.status)) {
        clearPending();
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
      const final = await experienceApi.getReviewJob(jobId);
      setJob(final);
      if (TERMINAL_JOB_STATES.has(final.job.status)) {
        clearPending();
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
        setError(reason instanceof Error ? reason.message : "실행 단계 연결이 끊겼습니다.");
      }
    }
  };

  const enqueuePending = async (target: PendingReview): Promise<void> => {
    setStarting(true);
    try {
      const response = await experienceApi.enqueueReview(caseId, {
        review_as_of: target.reviewAsOf,
        trade_type: "import",
        submitted_document_codes: [],
      }, target.idempotencyKey);
      const confirmed = { ...target, jobId: response.job.job_id };
      writePending(confirmed);
      setJob(response);
      await beginStreaming(response.job.job_id, target.startedAt);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "심사를 시작하지 못했습니다.");
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    const restored = readPending(session?.org_id, session?.subject);
    if (restored?.caseId === caseId) {
      if (restored.reviewAsOf !== metadata?.supported_review_as_of) {
        clearPending();
        setError("이전 심사 요청의 기준일이 현재 검증 환경과 달라 자동으로 다시 보내지 않았습니다.");
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
    if (!session || !metadata?.supported_review_as_of) {
      setError("현재 로그인 정보와 심사 기준일을 확인할 수 없습니다.");
      return;
    }
    const restored = readPending(session.org_id, session.subject);
    if (restored?.caseId === caseId && restored.reviewAsOf === metadata.supported_review_as_of) {
      await enqueuePending(restored);
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
    await enqueuePending(pending);
  };

  const latest = events.at(-1);
  const completedStages = useMemo(
    () => events.filter((event) => event.state === "completed" && !["completed", "failed"].includes(event.stage_code)),
    [events],
  );
  const active = job !== null
    && !TERMINAL_JOB_STATES.has(job.job.status)
    && latest?.stage_code !== "completed"
    && latest?.stage_code !== "failed";

  return (
    <section className={`review-launcher${active ? " is-active" : ""}`} aria-labelledby="review-launcher-title">
      <div className="review-launcher__copy">
        <p className="overline">AI 사전심사</p>
        <h2 id="review-launcher-title">{active ? "Agent가 심사를 진행하고 있습니다." : "현재 문서로 새 심사를 실행합니다."}</h2>
        <p>{active
          ? "화면을 닫거나 새로고침해도 같은 실행을 이어서 확인할 수 있습니다."
          : "실제 Claude 문서 분석과 3종 법령 검색을 순서대로 수행합니다."}</p>
      </div>
      {!active ? (
        <button
          className="commercial-button commercial-button--primary"
          type="button"
          onClick={() => void start()}
          disabled={starting}
          data-testid="start-review"
        >
          {starting ? "심사 준비 중" : "새 심사 실행"}
        </button>
      ) : null}
      {active ? (
        <div className="live-review" data-testid="review-progress" aria-live="polite">
          <div className="live-review__pulse" aria-hidden="true" />
          <div className="live-review__current">
            <span>현재 단계</span>
            <strong data-testid="current-stage">{latest ? stageLabels[latest.stage_code] : "실행 환경 확인"}</strong>
          </div>
          <div><span>경과 시간</span><strong data-testid="elapsed-time">{formatDuration(elapsed)}</strong></div>
          <div>
            <span>예상 소요 범위</span>
            <strong data-testid="eta-range">
              {job ? `${formatDuration(job.eta.lower_seconds)}~${formatDuration(job.eta.upper_seconds)}` : "약 4~7분"}
            </strong>
          </div>
          <div><span>완료 단계</span><strong>{completedStages.length}개</strong></div>
          <ol className="live-review__stages">
            {completedStages.slice(-4).map((event) => <li key={event.sequence}>{stageLabels[event.stage_code]} 완료</li>)}
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
