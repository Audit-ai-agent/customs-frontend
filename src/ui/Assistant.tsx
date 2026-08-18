import { useEffect, useRef } from "react";
import type { AssistantMessage, ReviewRun } from "../api/v1/types";
import { assistantScopeLabel, assistantSuggestions, formatDate } from "./labels";
import { AssistantLoading, EmptyCopy, EmptyState, Field, RoleBoundaryNote, SectionHeading, Submit } from "./primitives";
import { CitationChip } from "./Review";
import { useStore, useWorkbenchState } from "./useStore";

export function AssistantScreen() {
  const store = useStore();
  const state = useWorkbenchState();
  const run = state.selectedRun;
  if (!run) {
    return (
      <EmptyState
        title="아직 질문할 심사 결과가 없습니다."
        copy="심사를 실행한 뒤 문서·비교·법령정보에 대해 질문할 수 있습니다."
      />
    );
  }
  const loading = state.assistantLoading;
  return (
    <section className="assistant-layout">
      <aside className="surface assistant-sidebar">
        <SectionHeading
          title="AI 도우미"
          description="사건 답변은 이 심사 실행의 문서·비교·법령정보만 사용합니다. 일반 통관 안내는 허용된 주제의 일반 설명이며 사건별 판단이 아닙니다."
        />
        <button
          className="button button--secondary"
          type="button"
          disabled={loading || state.assistantSending}
          onClick={() => void store.createAssistantConversation()}
        >
          새 대화
        </button>
        <nav className="assistant-conversations" aria-label="AI 도우미 대화 목록">
          {state.assistantConversations.map((conversation) => {
            const selected = state.selectedConversation?.conversation_id === conversation.conversation_id;
            return (
              <button
                key={conversation.conversation_id}
                type="button"
                className={`assistant-conversation${selected ? " is-selected" : ""}`}
                {...(selected ? { "aria-current": "page" as const } : {})}
                disabled={loading || state.assistantSending}
                onClick={() => void store.selectAssistantConversation(conversation)}
              >
                <strong>{conversation.title ?? "제목 없는 대화"}</strong>
                <small>{formatDate(conversation.updated_at)}</small>
              </button>
            );
          })}
          {!state.assistantConversations.length && !loading ? <EmptyCopy>아직 만든 대화가 없습니다.</EmptyCopy> : null}
        </nav>
      </aside>

      <section className="surface assistant-panel">
        <SectionHeading
          title="심사 결과에 질문하기"
          description="사건 답변의 인용을 누르면 문서 원문, 비교 결과, 법령정보로 바로 이동합니다. 일반 안내에는 사건별 결론을 넣지 않습니다."
        />
        {state.assistantError ? (
          <div className="assistant-error" role="alert">
            <p>{state.assistantError}</p>
            {state.assistantRetryContent ? (
              <button className="text-link" type="button" onClick={() => store.retryAssistantMessage()}>
                같은 질문 다시 보내기
              </button>
            ) : null}
            {!state.assistantLoadedRunId ? (
              <button className="text-link" type="button" onClick={() => store.reloadAssistant()}>
                대화 다시 불러오기
              </button>
            ) : null}
          </div>
        ) : null}
        {loading ? <AssistantLoading label="AI 도우미 대화 준비 중" /> : <ConversationPanel run={run} />}
      </section>
    </section>
  );
}

function ConversationPanel({ run }: { run: ReviewRun }) {
  const store = useStore();
  const state = useWorkbenchState();
  const threadRef = useRef<HTMLOListElement>(null);
  const messageCount = state.assistantMessages.length;

  // New answers scroll into view the way the mockup thread does.
  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messageCount, state.assistantSending]);

  if (!state.selectedConversation) {
    return (
      <div className="assistant-empty">
        <h3>새 대화를 시작해 보십시오.</h3>
        <p>예: ‘수량 불일치가 나온 문서와 실제 값을 알려줘’처럼 현재 심사 결과에 대해 질문할 수 있습니다.</p>
        <button className="btn primary" type="button" onClick={() => void store.createAssistantConversation()}>
          첫 대화 만들기
        </button>
      </div>
    );
  }

  const suggestions = assistantSuggestions(run, state.assistantMessages);

  return (
    <div className="assistant-conversation-panel">
      <ol className="assistant-message-list" aria-live="polite" aria-label="AI 도우미 메시지" ref={threadRef}>
        {state.assistantMessages.map((item) => (
          <MessageItem key={item.message_id} item={item} />
        ))}
        {!messageCount ? (
          <li className="assistant-empty-message">
            <strong>이 대화에는 아직 메시지가 없습니다.</strong>
            <span>아래에 질문을 입력하면 심사 실행 ID와 연결된 근거로 답합니다.</span>
          </li>
        ) : null}
        {state.assistantSending ? (
          <li className="assistant-message assistant-message--assistant assistant-message--loading" role="status">
            <strong>AI 도우미</strong>
            <span>근거를 확인해 답변을 준비하고 있습니다…</span>
          </li>
        ) : null}
      </ol>

      {suggestions.length ? (
        <div className="assistant-suggestions" aria-label="추천 질문">
          <span>추천 질문</span>
          {suggestions.map((question) => (
            <button
              key={question}
              className="suggestion-chip"
              type="button"
              disabled={state.assistantSending}
              onClick={() => void store.sendAssistantMessage(question)}
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="assistant-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void store.sendAssistantMessage(state.assistantDraft);
        }}
      >
        <Field label="질문">
          <textarea
            name="assistant_message"
            rows={8}
            maxLength={4_000}
            placeholder="현재 심사 결과·문서 사실·비교 결과·법령정보 또는 제한된 일반 통관 안내에 관해 질문하십시오."
            value={state.assistantDraft}
            onChange={(event) => store.updateAssistantDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              event.preventDefault();
              void store.sendAssistantMessage(event.currentTarget.value);
            }}
          />
        </Field>
        <div className="assistant-composer__hint">
          <span>Enter 전송 · Shift+Enter 줄바꿈</span>
          <Submit label={state.assistantSending ? "답변 준비 중" : "질문 보내기"} disabled={state.assistantSending} />
        </div>
      </form>
    </div>
  );
}

function MessageItem({ item }: { item: AssistantMessage }) {
  const store = useStore();
  const state = useWorkbenchState();
  const label = item.role === "user" ? "나" : "AI 도우미";
  const draft = item.role === "assistant" ? item.correction_draft : null;
  return (
    <li className={`assistant-message assistant-message--${item.role}`}>
      <header>
        <strong>{label}</strong>
        {item.role === "assistant" && item.answer_scope ? (
          <span className="assistant-scope">{assistantScopeLabel(item.answer_scope)}</span>
        ) : null}
        <small>{formatDate(item.created_at)}</small>
      </header>
      {/* Answer text is rendered as text, never as markup: ADR-0002 forbids HTML string rendering. */}
      <p className="assistant-message__content">{item.content}</p>
      {item.role === "assistant" && item.citations.length ? (
        <div className="assistant-citations" aria-label="답변 근거">
          <span>근거</span>
          {item.citations.map((citation) => (
            <CitationChip key={`${citation.kind}:${citation.reference_id}`} citation={citation} />
          ))}
        </div>
      ) : null}
      {item.role === "assistant" && item.suggested_questions.length ? (
        <div className="assistant-message-suggestions">
          {item.suggested_questions.map((question) => (
            <button
              key={question}
              className="suggestion-chip"
              type="button"
              disabled={state.assistantSending}
              onClick={() => void store.sendAssistantMessage(question)}
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}
      {draft ? (
        store.hasRole("reviewer") ? (
          <button
            className="button button--secondary assistant-correction-import"
            type="button"
            onClick={() => store.useCorrectionDraft(draft)}
          >
            수정 제안으로 가져오기
          </button>
        ) : (
          <small className="role-boundary-note">정정 제안 초안은 심사자 역할에서만 기록할 수 있습니다.</small>
        )
      ) : null}
    </li>
  );
}
