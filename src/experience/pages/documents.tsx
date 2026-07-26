import { useState, type FormEvent } from "react";
import type { DocumentType } from "../../api/v1/types";
import { useCaseWorkspace } from "../case-context";
import { useWorkbench } from "../context";
import { Icon } from "../icons";
import { documentTypeLabels, formatKoreanDate } from "../labels";

const uploadTypes: DocumentType[] = ["CI", "PL", "BL", "CO", "SUPPORTING"];

export function DocumentsPage(): React.ReactElement {
  const { caseDetail, refresh } = useCaseWorkspace();
  const { api } = useWorkbench();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(caseDetail.documents[0]?.document_id ?? null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = caseDetail.documents.find((item) => item.document_id === selectedDocumentId);

  const openDocument = async (documentId: string): Promise<void> => {
    setSelectedDocumentId(documentId);
    setContentLoading(true);
    setError(null);
    try {
      const loaded = await api.getDocumentContent(caseDetail.case_id, documentId);
      setContent(loaded.content_text ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "문서 원문을 불러오지 못했습니다.");
    } finally {
      setContentLoading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const document = await api.addDocument(caseDetail.case_id, {
        document_type: String(form.get("document_type")) as DocumentType,
        filename: String(form.get("filename")),
        media_type: "text/plain",
        content_text: String(form.get("content_text")),
      });
      event.currentTarget.reset();
      await refresh();
      await openDocument(document.document_id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "문서를 등록하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-stack" data-testid="documents-page">
      <header className="subpage-heading">
        <div><p className="overline">등록 문서</p><h2>심사할 텍스트 문서를 등록하고 원문을 확인합니다.</h2></div>
        <span>{caseDetail.documents.length}개 문서</span>
      </header>
      <div className="text-release-boundary" role="note">
        <Icon name="warning" />
        <p><strong>현재는 텍스트 문서만 처리합니다.</strong> PDF·이미지는 OCR 기능 검증 후 별도 버전에서 지원합니다.</p>
      </div>
      <section className="document-workspace" id="document-workspace" tabIndex={-1}>
        <div className="document-register content-panel">
          <h3>새 문서 등록</h3>
          <p>문서 종류를 선택하고 원문 텍스트를 그대로 붙여 넣으십시오.</p>
          <form onSubmit={(event) => void submit(event)}>
            <label><span>문서 종류</span>
              <select name="document_type" required defaultValue="CI">
                {uploadTypes.map((item) => <option key={item} value={item}>{documentTypeLabels[item]}</option>)}
              </select>
            </label>
            <label><span>파일 이름</span><input name="filename" required maxLength={255} placeholder="예: commercial-invoice.txt" /></label>
            <label><span>문서 원문</span><textarea name="content_text" required minLength={1} maxLength={500_000} rows={14} placeholder="문서의 텍스트 내용을 입력하십시오." /></label>
            {error ? <p className="form-alert" role="alert">{error}</p> : null}
            <button className="commercial-button commercial-button--primary" type="submit" disabled={submitting}>
              {submitting ? "등록 중" : "문서 등록"}
            </button>
          </form>
        </div>
        <div className="document-library content-panel">
          <div className="section-heading"><div><h3>등록된 문서</h3><p>선택하면 저장된 원문을 확인할 수 있습니다.</p></div></div>
          {caseDetail.documents.length === 0 ? (
            <div className="empty-business-state"><Icon name="documents" /><p>등록된 문서가 없습니다.</p></div>
          ) : (
            <div className="document-list">
              {caseDetail.documents.map((item) => (
                <button
                  key={item.document_id}
                  type="button"
                  className={selectedDocumentId === item.document_id ? "is-selected" : ""}
                  onClick={() => void openDocument(item.document_id)}
                >
                  <span className="document-type-badge">{item.document_type === "UNKNOWN" ? "확인" : item.document_type}</span>
                  <span><strong>{documentTypeLabels[item.document_type]}</strong><small>{item.filename} · {formatKoreanDate(item.created_at)}</small></span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          )}
          {selected ? (
            <article className="document-preview" aria-live="polite">
              <header><div><small>{documentTypeLabels[selected.document_type]}</small><h3>{selected.filename}</h3></div><span>{selected.character_count.toLocaleString()}자</span></header>
              {contentLoading ? <p>원문을 불러오는 중입니다.</p> : <pre>{content ?? "문서를 선택하면 원문이 표시됩니다."}</pre>}
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
