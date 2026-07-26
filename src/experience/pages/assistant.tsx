import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  AssistantConversation,
  AssistantStageEvent,
  AssistantMessage,
} from "../../api/v2/types";
import { useCaseWorkspace } from "../case-context";
import { useWorkbench } from "../context";
import { Icon } from "../icons";
import { assistantScopeLabels, formatDuration } from "../labels";
import { CaseCitationLink } from "../components/citation-link";
import { derivedIdempotencyKey } from "../idempotency";

const PENDING_KEY = "customs.enhanced.pending-assistant";
const INITIAL_QUESTIONS = [
  "이번 심사에서 가장 먼저 확인해야 할 사항은 무엇입니까?",
  "검색된 법령 근거가 이 심사 건에서 어떤 의미입니까?",
  "담당자가 다음으로 해야 할 일을 순서대로 알려 주십시오.",
];

const assistantStageLabels: Record<AssistantStageEvent["stage_code"], string> = {
  queued: "질문 처리를 준비하고 있습니다.",
  request_validation: "질문이 안전한 입력인지 확인하고 있습니다.",
  conversation_binding: "이전 대화와 현재 심사 결과를 연결하고 있습니다.",
  answer_planning: "답변에 필요한 사실과 근거를 정리하고 있습니다.",
  answer_composition: "질문에 대한 설명을 작성하고 있습니다.",
  grounding_verification: "답변이 문서와 법령 근거에 맞는지 확인하고 있습니다.",
  persistence: "검증된 답변을 대화 이력에 저장하고 있습니다.",
  completed: "답변 준비를 완료했습니다.",
  failed: "답변을 안전하게 완료하지 못했습니다.",
};

interface PendingAssistant {
  orgId: string;
  actorId: string;
  runId: string;
  conversationId: string;
  jobId: string | null;
  idempotencyKey: string;
  startedAt: string;
}

const TERMINAL_ASSISTANT_STATES = new Set([
  "succeeded",
  "failed",
  "delivery_uncertain",
  "response_received_rejected",
  "response_persistence_uncertain",
]);

export function AssistantPage(): React.ReactElement {
  const { caseDetail, selectedRun } = useCaseWorkspace();
  const { experienceApi, session } = useWorkbench();
  const [conversation, setConversation] = useState<AssistantConversation | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pending, setPending] = useState<PendingAssistant | null>(null);
  const [events, setEvents] = useState<AssistantStageEvent[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadMessages = async (target: AssistantConversation): Promise<AssistantMessage[]> => {
    const next = await experienceApi.listMessages(target.conversation_id);
    setMessages(next);
    return next;
  };

  const connectJob = async (
    target: PendingAssistant,
    targetConversation: AssistantConversation | null = conversation,
  ): Promise<void> => {
    const jobId = target.jobId;
    if (!jobId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(target);
    try {
      await experienceApi.streamAssistantEvents(jobId, (event) => {
        setEvents((previous) => previous.some((item) => item.sequence === event.sequence)
          ? previous
          : [...previous, event].sort((left, right) => left.sequence - right.sequence));
      }, controller.signal);
      const current = await experienceApi.getAssistantJob(jobId);
      if (current.state === "succeeded") {
        if (targetConversation) await loadMessages(targetConversation);
        clearPendingAssistant();
        setPending(null);
      } else if (TERMINAL_ASSISTANT_STATES.has(current.state)) {
        clearPendingAssistant();
        setPending(null);
        setError("답변 검증을 안전하게 완료하지 못했습니다. 기존 심사 결과는 변경되지 않았습니다.");
      } else {
        setError("실행 단계 연결이 먼저 종료되었습니다. 새로고침하면 같은 답변 작업을 다시 확인합니다.");
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "AI 심사 도우미 연결이 끊겼습니다.");
      }
    }
  };

  useEffect(() => {
    if (!selectedRun?.provider_result_sha256) {
      setLoading(false);
      return;
    }
    let active = true;
    const load = async (): Promise<void> => {
      try {
        const existing = await experienceApi.listConversations(selectedRun.review_run_id);
        let target = existing.find(
          (item) => item.bound_result_sha256 === selectedRun.provider_result_sha256,
        );
        if (!target) {
          target = await experienceApi.createConversation(
            selectedRun.review_run_id,
            selectedRun.provider_result_sha256!,
            derivedIdempotencyKey("conversation", [
              selectedRun.review_run_id,
              selectedRun.provider_result_sha256!,
            ]),
          );
        }
        if (!active) return;
        setConversation(target);
        const loadedMessages = await loadMessages(target);
        const restored = readPendingAssistant(session?.org_id, session?.subject);
        if (active && restored?.runId === selectedRun.review_run_id && restored.conversationId === target.conversation_id) {
          if (restored.jobId) {
            void connectJob(restored, target);
          } else {
            const trailingUserMessage = loadedMessages.at(-1);
            if (
              trailingUserMessage?.role === "user"
              && trailingUserMessage.bound_result_sha256 === selectedRun.provider_result_sha256
              && derivedIdempotencyKey("assistant", [
                target.conversation_id,
                selectedRun.provider_result_sha256!,
                trailingUserMessage.parent_message_id ?? "",
                trailingUserMessage.content,
              ]) === restored.idempotencyKey
            ) {
              const response = await experienceApi.sendMessage(target.conversation_id, {
                question: trailingUserMessage.content,
                bound_result_sha256: selectedRun.provider_result_sha256!,
                ...(trailingUserMessage.parent_message_id
                  ? { parent_message_id: trailingUserMessage.parent_message_id }
                  : {}),
              }, restored.idempotencyKey);
              const confirmed = { ...restored, jobId: response.job.assistant_job_id };
              writePendingAssistant(confirmed);
              if (active) void connectJob(confirmed, target);
            } else {
              clearPendingAssistant();
              setPending(null);
              setError("이전 질문이 서버 대화 이력에서 확인되지 않아 자동으로 다시 보내지 않았습니다.");
            }
          }
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "대화를 불러오지 못했습니다.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, [
    selectedRun?.review_run_id,
    selectedRun?.provider_result_sha256,
    session?.org_id,
    session?.subject,
  ]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setElapsed(
      Math.max(0, (Date.now() - new Date(pending.startedAt).getTime()) / 1_000),
    ), 1_000);
    return () => window.clearInterval(timer);
  }, [pending]);

  const ask = async (question: string): Promise<void> => {
    const clean = question.trim();
    if (!clean || !conversation || !selectedRun?.provider_result_sha256 || !session) return;
    setSubmitting(true);
    setError(null);
    setEvents([]);
    try {
      let currentMessages = messages;
      const restored = readPendingAssistant(session.org_id, session.subject);
      if (
        restored?.runId === selectedRun.review_run_id
        && restored.conversationId === conversation.conversation_id
      ) {
        if (restored.jobId) {
          await connectJob(restored, conversation);
          return;
        }
        currentMessages = await loadMessages(conversation);
        const trailingUserMessage = currentMessages.at(-1);
        if (
          trailingUserMessage?.role === "user"
          && derivedIdempotencyKey("assistant", [
            conversation.conversation_id,
            selectedRun.provider_result_sha256,
            trailingUserMessage.parent_message_id ?? "",
            trailingUserMessage.content,
          ]) === restored.idempotencyKey
        ) {
          const recovered = await experienceApi.sendMessage(conversation.conversation_id, {
            question: trailingUserMessage.content,
            bound_result_sha256: selectedRun.provider_result_sha256,
            ...(trailingUserMessage.parent_message_id
              ? { parent_message_id: trailingUserMessage.parent_message_id }
              : {}),
          }, restored.idempotencyKey);
          const confirmed = { ...restored, jobId: recovered.job.assistant_job_id };
          writePendingAssistant(confirmed);
          await connectJob(confirmed, conversation);
          return;
        }
        clearPendingAssistant();
      }
      const parentMessage = currentMessages.at(-1);
      const idempotencyKey = derivedIdempotencyKey("assistant", [
        conversation.conversation_id,
        selectedRun.provider_result_sha256,
        parentMessage?.message_id ?? "",
        clean,
      ]);
      const intent: PendingAssistant = {
        orgId: session.org_id,
        actorId: session.subject,
        runId: selectedRun.review_run_id,
        conversationId: conversation.conversation_id,
        jobId: null,
        idempotencyKey,
        startedAt: new Date().toISOString(),
      };
      writePendingAssistant(intent);
      setPending(intent);
      const response = await experienceApi.sendMessage(conversation.conversation_id, {
        question: clean,
        bound_result_sha256: selectedRun.provider_result_sha256,
        ...(parentMessage ? { parent_message_id: parentMessage.message_id } : {}),
      }, idempotencyKey);
      setMessages((previous) => previous.some((item) => item.message_id === response.user_message.message_id)
        ? previous
        : [...previous, response.user_message]);
      const target: PendingAssistant = {
        ...intent,
        jobId: response.job.assistant_job_id,
      };
      writePendingAssistant(target);
      await connectJob(target, conversation);
    } catch (reason) {
      setPending(null);
      setError(reason instanceof Error ? reason.message : "질문을 전달하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const question = draft;
    setDraft("");
    void ask(question);
  };

  const suggestions = useMemo(() => {
    const latestAnswer = [...messages].reverse().find((item) => item.answer)?.answer;
    return latestAnswer?.suggested_questions.length ? latestAnswer.suggested_questions : INITIAL_QUESTIONS;
  }, [messages]);

  if (!selectedRun?.provider_result_sha256) {
    return <div className="empty-business-state content-panel"><Icon name="assistant" /><h2>먼저 심사를 실행해 주십시오.</h2><p>AI 심사 도우미는 확정된 심사 결과와 법령 근거에 묶여 답변합니다.</p></div>;
  }

  return (
    <div className="page-stack assistant-page" data-testid="assistant-page">
      <header className="subpage-heading">
        <div><p className="overline">AI 심사 도우미</p><h2>심사 결과를 대화로 쉽게 확인합니다.</h2><p>현재 심사 건의 문서, 결과, 실제 법령 근거를 바탕으로 답변합니다.</p></div>
        <span><Icon name="shield" />근거 검증 후 공개</span>
      </header>
      <div className="assistant-layout">
        <section className="assistant-conversation" aria-label="AI 심사 도우미 대화">
          <div className="assistant-intro">
            <span><Icon name="assistant" /></span>
            <div><strong>무엇을 확인해 드릴까요?</strong><p>결과의 원인, 법령 근거의 의미, 다음 조치뿐 아니라 일반 통관 용어와 절차도 질문할 수 있습니다.</p></div>
          </div>
          <div className="assistant-messages" aria-live="polite">
            {loading ? <p className="inline-loading">이전 대화를 불러오는 중입니다.</p> : null}
            {!loading && messages.length === 0 ? <p className="assistant-empty">아래 추천 질문을 선택하거나 직접 질문하십시오.</p> : null}
            {messages.map((message) => (
              <MessageBubble
                key={message.message_id}
                caseId={caseDetail.case_id}
                message={message}
              />
            ))}
            {pending ? (
              <div className="assistant-thinking" data-testid="assistant-progress">
                <span className="assistant-thinking__pulse" aria-hidden="true" />
                <div><strong>{events.at(-1) ? assistantStageLabels[events.at(-1)!.stage_code] : "질문과 심사 근거를 연결하고 있습니다."}</strong><small>경과 {formatDuration(elapsed)} · 답변은 근거 검증이 끝난 뒤 표시합니다.</small></div>
              </div>
            ) : null}
          </div>
          <div className="suggested-questions" aria-label="추천 질문">
            {suggestions.slice(0, 3).map((question) => (
              <button key={question} type="button" onClick={() => void ask(question)} disabled={submitting || pending !== null}>
                {question}<Icon name="arrow" />
              </button>
            ))}
          </div>
          <form className="assistant-composer" onSubmit={submit}>
            <label htmlFor="assistant-question" className="sr-only">AI 심사 도우미에게 질문</label>
            <textarea
              id="assistant-question"
              name="question"
              rows={2}
              maxLength={2_000}
              required
              placeholder="예: 왜 요건 증명서를 추가로 확인해야 합니까?"
              disabled={submitting || pending !== null}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
            />
            <button className="commercial-button commercial-button--primary" type="submit" disabled={submitting || pending !== null}>
              질문하기
            </button>
          </form>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
        </section>
        <aside className="assistant-guide content-panel">
          <h3>이렇게 질문해 보십시오.</h3>
          <ul>
            <li><strong>결과 이해</strong><span>“왜 담당자 확인이 필요합니까?”</span></li>
            <li><strong>근거 의미</strong><span>“이 법령 조문이 현재 품목에 어떤 의미입니까?”</span></li>
            <li><strong>다음 행동</strong><span>“어떤 서류를 누구에게 확인해야 합니까?”</span></li>
            <li><strong>일반 안내</strong><span>“HSK와 HS Code의 차이를 설명해 주십시오.”</span></li>
          </ul>
          <p><Icon name="warning" />최신 법령이나 현재 3종 범위 밖의 판단은 자료 부족을 명확히 알리고 추가 확인을 안내합니다.</p>
        </aside>
      </div>
    </div>
  );
}

function MessageBubble({
  caseId,
  message,
}: {
  caseId: string;
  message: AssistantMessage;
}): React.ReactElement {
  if (message.role === "user") {
    return <article className="message-bubble message-bubble--user"><span>담당자</span><p>{message.content}</p></article>;
  }
  const answer = message.answer;
  if (!answer) return <article className="message-bubble message-bubble--assistant"><span>AI 심사 도우미</span><p>검증된 답변을 준비하지 못했습니다.</p></article>;
  return (
    <article className={`message-bubble message-bubble--assistant message-bubble--${answer.answer_scope}`}>
      <header><span>AI 심사 도우미</span><small>{assistantScopeLabels[answer.answer_scope]}</small></header>
      <section><h3>직접 답변</h3><p className="assistant-direct-answer">{answer.direct_answer}</p></section>
      <AnswerList title="그렇게 판단한 이유" items={answer.explanation} />
      <AnswerList title="법령 근거의 의미" items={answer.evidence_meaning} />
      <AnswerList title="업무상 영향" items={answer.impact} />
      <AnswerList title="다음 조치" items={answer.next_steps} ordered />
      {answer.citations.length > 0 ? (
        <section className="assistant-citations"><h3>확인한 근거</h3><div>
          {answer.citations.map((citation) => (
            <CaseCitationLink
              key={citation.reference_id}
              caseId={caseId}
              citation={citation}
            />
          ))}
        </div></section>
      ) : null}
      <AnswerList title="답변 범위와 한계" items={answer.limitations} subdued />
    </article>
  );
}

function AnswerList({
  title,
  items,
  ordered = false,
  subdued = false,
}: {
  title: string;
  items: string[];
  ordered?: boolean;
  subdued?: boolean;
}): React.ReactElement | null {
  if (items.length === 0) return null;
  const Tag = ordered ? "ol" : "ul";
  return <section className={subdued ? "assistant-limitations" : ""}><h3>{title}</h3><Tag>{items.map((item) => <li key={item}>{item}</li>)}</Tag></section>;
}

function readPendingAssistant(
  orgId: string | undefined,
  actorId: string | undefined,
): PendingAssistant | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingAssistant>;
    if (
      typeof value.runId !== "string"
      || typeof value.orgId !== "string"
      || typeof value.actorId !== "string"
      || typeof value.conversationId !== "string"
      || (value.jobId !== null && typeof value.jobId !== "string")
      || typeof value.idempotencyKey !== "string"
      || !/^assistant-[a-f0-9]{64}$/u.test(value.idempotencyKey)
      || typeof value.startedAt !== "string"
      || value.orgId !== orgId
      || value.actorId !== actorId
      || !Number.isFinite(new Date(value.startedAt).getTime())
    ) {
      window.sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    return {
      orgId: value.orgId,
      actorId: value.actorId,
      runId: value.runId,
      conversationId: value.conversationId,
      jobId: value.jobId ?? null,
      idempotencyKey: value.idempotencyKey,
      startedAt: value.startedAt,
    };
  } catch {
    clearPendingAssistant();
    return null;
  }
}

function writePendingAssistant(value: PendingAssistant): void {
  window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
}

function clearPendingAssistant(): void {
  window.sessionStorage.removeItem(PENDING_KEY);
}
