import { useEffect, useRef } from "react";
import type { SourceReference } from "../api/v1/types";
import { documentTypeLabel, occurrenceIndex, scrollIntoViewIfAvailable } from "./labels";
import { EmptyCopy } from "./primitives";
import { useStore, useWorkbenchState } from "./useStore";

export function DocumentModal() {
  const store = useStore();
  const state = useWorkbenchState();
  const closeRef = useRef<HTMLButtonElement>(null);
  const document = state.selectedDocument;

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        store.closeDocumentModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.document.body.style.overflow = previousOverflow;
    };
  }, [store]);

  return (
    <div
      className="docmodal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) store.closeDocumentModal();
      }}
    >
      <div className="docmodal" role="dialog" aria-modal="true" aria-label="원문 대조">
        <header className="docmodal__head">
          <div>
            <strong>원문 대조 · 인용 위치 확인</strong>
            <small>원문은 바뀌지 않습니다. 값 정정은 승인이 필요한 제안으로만 기록됩니다.</small>
          </div>
          <button
            ref={closeRef}
            className="docmodal__close"
            type="button"
            aria-label="닫기"
            onClick={() => store.closeDocumentModal()}
          >
            ✕
          </button>
        </header>

        <div className="docmodal__body">
          {document ? (
            <>
              <div className="docmodal__meta">
                <span className="document-type">{document.document_type}</span>
                <strong>{document.filename}</strong>
                <small>
                  {`${documentTypeLabel(document.document_type)} · ${document.character_count.toLocaleString()}자 · ${document.superseded_by_document_id ? "대체된 문서" : "활성 문서"}`}
                </small>
              </div>
              {state.sourceFocus?.quote ? (
                <p className="docmodal__hint">{`인용 위치를 원문에서 강조했습니다: “${state.sourceFocus.quote}”`}</p>
              ) : null}
              <DocumentText content={document.content_text} source={state.sourceFocus} />
            </>
          ) : (
            <EmptyCopy>문서 원문을 불러오지 못했습니다.</EmptyCopy>
          )}
        </div>

        <footer className="docmodal__foot">
          <span className="docmodal__note">Esc 키로 닫을 수 있습니다.</span>
          <button className="button button--quiet" type="button" onClick={() => store.closeDocumentModal()}>
            닫기
          </button>
          {document && store.hasRole("reviewer") ? (
            <button
              className="btn primary"
              type="button"
              disabled={!state.selectedRun}
              {...(state.selectedRun ? {} : { title: "심사 결과가 있어야 정정 제안을 기록할 수 있습니다." })}
              onClick={() => {
                store.closeDocumentModal();
                if (state.selectedCase) store.setRoute(state.selectedCase.case_id, "review");
              }}
            >
              이 문서로 정정 제안
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

/**
 * Renders the document as text with the cited span wrapped in a <mark>. The content is
 * split into React children rather than assembled as HTML, so a document that happens to
 * contain markup can never become markup.
 */
function DocumentText({ content, source }: { content: string; source: SourceReference | null }) {
  const markRef = useRef<HTMLElement>(null);
  const quote = source?.quote ?? "";
  const index = quote ? occurrenceIndex(content, quote, source?.occurrence ?? 0) : -1;

  useEffect(() => {
    if (index >= 0) scrollIntoViewIfAvailable(markRef.current);
  }, [index, content]);

  if (index < 0) {
    return (
      <pre className="document-text" tabIndex={0} aria-label="문서 원문">
        {content}
      </pre>
    );
  }
  return (
    <pre className="document-text" tabIndex={0} aria-label="문서 원문">
      {content.slice(0, index)}
      <mark ref={markRef} data-source-focus="true">
        {content.slice(index, index + quote.length)}
      </mark>
      {content.slice(index + quote.length)}
    </pre>
  );
}
