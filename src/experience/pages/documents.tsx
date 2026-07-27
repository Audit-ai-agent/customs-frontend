import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { userFacingErrorMessage } from "../../api/user-facing-errors";
import type {
  DocumentType,
  ExtractedField,
  ReviewRun,
  SourceReference,
  SupportingDocumentRecord,
} from "../../api/v1/types";
import { useCaseWorkspace } from "../case-context";
import { canMutate } from "../capabilities";
import { useWorkbench } from "../context";
import { Icon } from "../icons";
import {
  actorRoleLabel,
  documentTypeBadgeLabels,
  documentTypeLabels,
  fieldLabel,
  formatKoreanDate,
} from "../labels";

const uploadTypes: DocumentType[] = ["CI", "PL", "BL", "CO"];
const MAX_DOCUMENT_TEXT_CHARACTERS = 200_000;
const MAX_PRIMARY_DOCUMENTS = 6;
const MAX_PRIMARY_TEXT_CHARACTERS = 500_000;

interface FieldCitationResolution {
  kind: "field" | "source";
  field: ExtractedField;
  source: SourceReference | null;
}

export function DocumentsPage(): React.ReactElement {
  const { caseDetail, runs, selectedRun, loadingRun, refresh } = useCaseWorkspace();
  const { api, session } = useWorkbench();
  const canRegisterDocument = canMutate(session, "register_document");
  const canVerifySupportingDocument = canMutate(session, "verify_supporting_document");
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(caseDetail.documents[0]?.document_id ?? null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>("CI");
  const [draftCharacterCount, setDraftCharacterCount] = useState(0);
  const [supportingDocuments, setSupportingDocuments] = useState<SupportingDocumentRecord[]>([]);
  const [verifyingDocumentId, setVerifyingDocumentId] = useState<string | null>(null);
  const [supportingSubmitting, setSupportingSubmitting] = useState(false);
  const [supportingSourceId, setSupportingSourceId] = useState("new");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [citationError, setCitationError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);
  const activeCaseRef = useRef(caseDetail.case_id);
  activeCaseRef.current = caseDetail.case_id;
  const selected = caseDetail.documents.find((item) => item.document_id === selectedDocumentId);
  const citationSourceId = searchParams.get("source");
  const citationRunId = searchParams.get("run");
  const citationResolution = citationSourceId === null || selectedRun === null
    ? null
    : resolveFieldCitation(selectedRun, citationSourceId);
  const selectedFields = selectedRun?.fields.filter(
    (field) => field.document_id === selectedDocumentId,
  ) ?? [];
  const linkedField = citationResolution?.field ?? null;
  const linkedSource = citationResolution?.source ?? null;
  const primaryDocuments = caseDetail.documents.filter(
    (document) => document.document_type !== "SUPPORTING",
  );
  const primaryCharacterCount = primaryDocuments.reduce(
    (total, document) => total + document.character_count,
    0,
  );
  const primaryCapacityReached = primaryDocuments.length >= MAX_PRIMARY_DOCUMENTS;
  const remainingPrimaryCharacters = Math.max(
    0,
    MAX_PRIMARY_TEXT_CHARACTERS - primaryCharacterCount,
  );
  const primaryDraftExceedsAggregate = draftCharacterCount > remainingPrimaryCharacters;
  const registeredSupportingIds = new Set(
    supportingDocuments.map((document) => document.document_id),
  );
  const unregisteredSupportingSources = caseDetail.documents.filter(
    (document) => (
      document.document_type === "SUPPORTING"
      && !registeredSupportingIds.has(document.document_id)
    ),
  );
  const supportingItems = [...new Map(
    (selectedRun?.evidence_provenance?.items ?? [])
      .filter((item) => (
        item.item_id.length > 0
        && item.item_id.length <= 128
        && /^\d{10}$/u.test(item.resolved_hsk10 ?? item.requested_hs_code ?? "")
      ))
      .map((item) => [item.item_id, item] as const),
  ).values()];

  useEffect(() => {
    requestSequenceRef.current += 1;
    setSelectedDocumentId(caseDetail.documents[0]?.document_id ?? null);
    setContent(null);
    setContentLoading(false);
    setError(null);
    setNotice(null);
    setCitationError(null);
    setSupportingDocuments([]);
    setUploadType("CI");
    setDraftCharacterCount(0);
    setSupportingSourceId("new");
    const targetCaseId = caseDetail.case_id;
    void api.listSupportingDocuments(targetCaseId).then((items) => {
      if (activeCaseRef.current === targetCaseId) setSupportingDocuments(items);
    }).catch((reason: unknown) => {
      if (activeCaseRef.current === targetCaseId) {
        setError(userFacingErrorMessage(reason, "요건 증명서 정보를 불러오지 못했습니다."));
      }
    });
  }, [api, caseDetail.case_id]);

  const openDocument = useCallback(async (documentId: string): Promise<void> => {
    const targetCaseId = caseDetail.case_id;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setSelectedDocumentId(documentId);
    setContent(null);
    setContentLoading(true);
    setError(null);
    try {
      const loaded = await api.getDocumentContent(targetCaseId, documentId);
      if (
        requestSequenceRef.current === requestSequence
        && activeCaseRef.current === targetCaseId
      ) {
        setContent(loaded.content_text ?? "");
      }
    } catch (reason) {
      if (
        requestSequenceRef.current === requestSequence
        && activeCaseRef.current === targetCaseId
      ) {
        setError(userFacingErrorMessage(reason, "문서 원문을 불러오지 못했습니다."));
      }
    } finally {
      if (
        requestSequenceRef.current === requestSequence
        && activeCaseRef.current === targetCaseId
      ) {
        setContentLoading(false);
      }
    }
  }, [api, caseDetail.case_id]);

  useEffect(() => {
    if (citationSourceId === null) {
      setCitationError(null);
      return;
    }
    if (loadingRun) return;
    if (
      selectedRun === null
      && citationRunId !== null
      && runs.some((run) => run.review_run_id === citationRunId)
    ) return;
    if (
      citationRunId === null
      || selectedRun === null
      || selectedRun.review_run_id !== citationRunId
      || selectedRun.case_id !== caseDetail.case_id
      || selectedRun.org_id !== caseDetail.org_id
    ) {
      setSelectedDocumentId(null);
      setContent(null);
      setCitationError("선택한 문서 근거가 현재 심사 건과 회차에 속하는지 확인할 수 없어 이동을 차단했습니다.");
      return;
    }
    const resolution = resolveFieldCitation(selectedRun, citationSourceId);
    const field = resolution?.field;
    const manifestContainsDocument = field !== undefined
      && selectedRun.input_document_manifest?.some(
        (document) => document.document_id === field.document_id,
      ) === true;
    const documentExists = field === undefined
      ? false
      : caseDetail.documents.some((document) => document.document_id === field.document_id);
    if (resolution === null || field === undefined || !manifestContainsDocument || !documentExists) {
      setSelectedDocumentId(null);
      setContent(null);
      setCitationError(
        "선택한 문서 근거의 항목·원문 출처·입력 문서 소유 관계를 정확히 확인할 수 없어 이동을 차단했습니다.",
      );
      return;
    }
    setCitationError(null);
    void openDocument(field.document_id);
  }, [
    caseDetail.case_id,
    caseDetail.documents,
    caseDetail.org_id,
    citationRunId,
    citationSourceId,
    loadingRun,
    openDocument,
    runs,
    selectedRun,
  ]);

  const verifySupportingDocument = async (
    document: SupportingDocumentRecord,
  ): Promise<void> => {
    if (
      !canVerifySupportingDocument
      || session?.subject === document.created_by
      || document.case_id !== caseDetail.case_id
    ) {
      setError("문서를 등록한 사람과 다른 승인 담당자만 요건 증명서를 확인할 수 있습니다.");
      return;
    }
    setVerifyingDocumentId(document.document_id);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.addSupportingAssertion(
        caseDetail.case_id,
        document.document_id,
        { method: "human_approver" },
      );
      if (activeCaseRef.current === caseDetail.case_id) {
        setSupportingDocuments((previous) => previous.map((item) => (
          item.document_id === updated.document_id ? updated : item
        )));
      }
    } catch (reason) {
      try {
        const authoritative = await api.listSupportingDocuments(caseDetail.case_id);
        const committed = authoritative.find((item) => (
          item.document_id === document.document_id
          && item.source_sha256 === document.source_sha256
          && item.verification_assertions.some((assertion) => (
            assertion.method === "human_approver"
            && assertion.asserted_by === session?.subject
            && assertion.subject_document_id === document.document_id
            && assertion.source_reference_sha256 === document.source_sha256
          ))
        ));
        if (committed) {
          setSupportingDocuments(authoritative);
          setNotice(
            "증명서 독립 확인을 저장했습니다. 저장 응답이 끊겼지만 서버의 확인 기록을 다시 검증했습니다.",
          );
          return;
        }
      } catch {
        // The authoritative read also failed, so keep the operation unresolved.
      }
      setError(userFacingErrorMessage(reason, "요건 증명서 확인 완료 여부를 확인하지 못했습니다."));
    } finally {
      setVerifyingDocumentId(null);
    }
  };

  const selectDocument = (documentId: string): void => {
    const next = new URLSearchParams(searchParams);
    next.delete("source");
    setSearchParams(next, { replace: true });
    void openDocument(documentId);
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canRegisterDocument) {
      setError("현재 권한에서는 일반 심사 문서를 등록할 수 없습니다.");
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const requestedType = String(form.get("document_type"));
    if (!uploadTypes.includes(requestedType as DocumentType)) {
      setError("지원하는 문서 종류를 다시 선택해 주십시오.");
      return;
    }
    const documentType = requestedType as DocumentType;
    const contentText = String(form.get("content_text"));
    if (
      contentText.length < 1
      || contentText.length > MAX_DOCUMENT_TEXT_CHARACTERS
    ) {
      setError("문서 원문은 1자 이상 200,000자 이하로 입력해 주십시오.");
      return;
    }
    if (
      primaryCapacityReached
      || primaryCharacterCount + contentText.length > MAX_PRIMARY_TEXT_CHARACTERS
    ) {
      setError("일반 심사 문서는 최대 6개, 합계 500,000자 범위에서 등록할 수 있습니다.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const document = await api.addDocument(caseDetail.case_id, {
        document_type: documentType,
        filename: String(form.get("filename")),
        media_type: "text/plain",
        content_text: contentText,
      });
      formElement.reset();
      setUploadType("CI");
      setDraftCharacterCount(0);
      await refresh();
      await openDocument(document.document_id);
    } catch (reason) {
      setError(userFacingErrorMessage(reason, "문서를 등록하지 못했습니다."));
    } finally {
      setSubmitting(false);
    }
  };

  const submitSupportingDocument = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!canRegisterDocument) {
      setError("현재 권한에서는 요건 증명서를 등록할 수 없습니다.");
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const requestedSourceId = String(form.get("source_document_id") ?? "new");
    const existingSource = unregisteredSupportingSources.find(
      (document) => document.document_id === requestedSourceId,
    );
    if (requestedSourceId !== "new" && !existingSource) {
      setError("등록을 마칠 요건 증명서 원문을 다시 선택해 주십시오.");
      return;
    }
    const contentText = String(form.get("content_text") ?? "");
    if (
      requestedSourceId === "new"
      && (contentText.length < 1 || contentText.length > MAX_DOCUMENT_TEXT_CHARACTERS)
    ) {
      setError("요건 증명서 원문은 1자 이상 200,000자 이하로 입력해 주십시오.");
      return;
    }
    const requestedItemIds = form.getAll("subject_item_ids").map(String);
    const selectedItems = supportingItems.filter(
      (item) => requestedItemIds.includes(item.item_id),
    );
    if (
      requestedItemIds.length < 1
      || selectedItems.length !== new Set(requestedItemIds).size
    ) {
      setError("현재 심사 회차에서 확인된 대상 품목을 한 개 이상 선택해 주십시오.");
      return;
    }
    const subjectItemIds = selectedItems.map((item) => item.item_id);
    const hsCodes = [...new Set(selectedItems.map(
      (item) => item.resolved_hsk10 ?? item.requested_hs_code ?? "",
    ))];
    const documentCode = String(form.get("document_code") ?? "");
    const issuer = String(form.get("issuer") ?? "");
    const documentNumber = String(form.get("document_number") ?? "");
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(documentCode)) {
      setError("증명서 코드는 영문 또는 숫자로 시작하고 영문·숫자·마침표·밑줄·콜론·하이픈만 사용할 수 있습니다.");
      return;
    }
    const issuedOn = String(form.get("issued_on") ?? "");
    const validUntil = String(form.get("valid_until") ?? "");
    if (
      !/^\d{4}-\d{2}-\d{2}$/u.test(issuedOn)
      || (validUntil && !/^\d{4}-\d{2}-\d{2}$/u.test(validUntil))
      || (validUntil && validUntil < issuedOn)
    ) {
      setError("발급일과 유효기간을 확인해 주십시오. 유효기간은 발급일보다 빠를 수 없습니다.");
      return;
    }
    const filename = String(form.get("filename") ?? "");
    const encodedContent = new TextEncoder().encode(contentText);
    let expectedSourceSha256: string | null = existingSource?.content_sha256 ?? null;
    if (!existingSource) {
      try {
        expectedSourceSha256 = await sha256Hex(encodedContent);
      } catch {
        setError("원문 결박값을 계산하지 못해 요건 증명서 등록을 시작하지 않았습니다.");
        return;
      }
    }
    const sourceIdsBeforeWrite = new Set(
      caseDetail.documents
        .filter((document) => document.document_type === "SUPPORTING")
        .map((document) => document.document_id),
    );
    setSupportingSubmitting(true);
    setError(null);
    setNotice(null);
    let source = existingSource;
    try {
      if (!source) {
        try {
          source = await api.addDocument(caseDetail.case_id, {
            document_type: "SUPPORTING",
            filename,
            media_type: "text/plain",
            content_text: contentText,
          });
        } catch {
          try {
            const authoritativeCase = await api.getCase(caseDetail.case_id);
            const candidates = authoritativeCase.documents.filter((document) => (
              document.document_type === "SUPPORTING"
              && !sourceIdsBeforeWrite.has(document.document_id)
              && document.created_by === session?.subject
              && document.filename === filename
              && document.content_sha256 === expectedSourceSha256
              && document.character_count === contentText.length
              && document.byte_size === encodedContent.byteLength
            ));
            if (candidates.length === 1) {
              source = candidates[0]!;
              setNotice(
                "원문 저장 응답이 끊겼지만 서버의 원문 결박값을 다시 확인했습니다. 검증 정보 등록을 이어서 수행합니다.",
              );
            } else {
              setError(candidates.length === 0
                ? "원문 저장 여부를 서버에서 확정하지 못해 자동 재전송을 차단했습니다. 화면을 새로고침해 등록 문서를 확인한 뒤 다시 진행해 주십시오."
                : "같은 결박값의 새 원문이 둘 이상 확인되어 자동 선택을 차단했습니다. 담당자가 등록 문서를 확인해 주십시오.");
              return;
            }
          } catch {
            setError(
              "원문 저장 여부를 서버에서 확인하지 못해 자동 재전송을 차단했습니다. 화면을 새로고침해 등록 문서를 확인해 주십시오.",
            );
            return;
          }
        }
      }
      if (
        source.content_sha256 !== expectedSourceSha256
        || source.document_type !== "SUPPORTING"
        || source.created_by !== session?.subject
        || (!existingSource && (
          source.filename !== filename
          || source.character_count !== contentText.length
          || source.byte_size !== encodedContent.byteLength
        ))
      ) {
        setError("저장된 원문이 제출한 증명서 원문과 정확히 일치하지 않아 검증 정보 등록을 차단했습니다.");
        return;
      }
      const registered = await api.addSupportingDocument(caseDetail.case_id, {
        document_id: source.document_id,
        document_code: documentCode,
        issuer,
        document_number: documentNumber,
        issued_on: issuedOn,
        valid_until: validUntil || null,
        subject_item_ids: subjectItemIds,
        hs_codes: hsCodes,
        source_sha256: source.content_sha256,
      });
      setSupportingDocuments((previous) => [
        ...previous.filter((document) => document.document_id !== registered.document_id),
        registered,
      ]);
      formElement.reset();
      setSupportingSourceId("new");
      try {
        await refresh();
        setNotice("요건 증명서와 검증 정보를 등록했습니다.");
      } catch {
        setError(
          "요건 증명서는 정상 등록됐지만 최신 심사 건 목록을 다시 불러오지 못했습니다. 원문을 다시 등록하지 말고 화면을 새로고침해 주십시오.",
        );
      }
    } catch (reason) {
      if (source) {
        try {
          const authoritative = await api.listSupportingDocuments(caseDetail.case_id);
          const committed = authoritative.find((document) => (
            document.document_id === source?.document_id
            && document.source_sha256 === source.content_sha256
            && document.document_code === documentCode
            && document.issuer === issuer
            && document.document_number === documentNumber
            && document.issued_on === issuedOn
            && document.valid_until === (validUntil || null)
            && sameStringSet(document.subject_item_ids, subjectItemIds)
            && sameStringSet(document.hs_codes, hsCodes)
          ));
          if (committed) {
            setSupportingDocuments(authoritative);
            formElement.reset();
            setSupportingSourceId("new");
            try {
              await refresh();
            } catch {
              // The authoritative supporting-document list already proved the
              // write. A Case-list refresh failure must not trigger a retry.
            }
            setNotice(
              "요건 증명서는 정상 등록됐습니다. 저장 응답이 끊겼지만 서버의 등록 기록을 다시 확인했습니다.",
            );
            return;
          }
        } catch {
          // If reconciliation itself is unavailable, retain the already-saved
          // source and offer a metadata-only retry. Never upload it twice.
        }
        try {
          await refresh();
        } catch {
          // The source-document POST already succeeded. Never create another
          // source merely because refreshing the Case also failed.
        }
        setError(existingSource
          ? "검증 정보 등록 완료 여부를 확인하지 못했습니다. 원문을 다시 올리지 말고 같은 저장 원문을 선택해 다시 확인해 주십시오."
          : "증명서 원문은 저장됐지만 검증 정보 등록은 완료되지 않았습니다. 원문을 다시 올리지 말고 ‘등록을 마칠 원문’에서 저장된 문서를 선택해 다시 시도해 주십시오.");
      } else {
        setError(userFacingErrorMessage(reason, "요건 증명서 검증 정보를 등록하지 못했습니다."));
      }
    } finally {
      setSupportingSubmitting(false);
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
      {citationError ? (
        <p className="form-alert" role="alert" data-testid="document-citation-error">
          {citationError}
        </p>
      ) : null}
      {notice ? <p className="success-notice" role="status">{notice}</p> : null}
      <section className="document-workspace" id="document-workspace" tabIndex={-1}>
        <div className="document-register content-panel">
          <h3>새 문서 등록</h3>
          <p>문서 종류를 선택하고 원문 텍스트를 그대로 붙여 넣으십시오.</p>
          <p className="document-input-limits" data-testid="document-input-limits">
            문서당 최대 200,000자 · 일반 심사 문서 {primaryDocuments.length}/6개 ·
            합계 {primaryCharacterCount.toLocaleString()}/500,000자
          </p>
          {!canRegisterDocument ? (
            <p className="read-only-notice" role="note">
              현재 권한에서는 일반 심사 문서를 등록할 수 없습니다. 저장된 문서와 심사 근거는 확인할 수 있습니다.
            </p>
          ) : null}
          <form onSubmit={(event) => void submit(event)}>
            <label><span>문서 종류</span>
              <select
                name="document_type"
                required
                disabled={!canRegisterDocument}
                value={uploadType}
                onChange={(event) => setUploadType(event.currentTarget.value as DocumentType)}
              >
                {uploadTypes.map((item) => <option key={item} value={item}>{documentTypeLabels[item]}</option>)}
              </select>
            </label>
            <label><span>파일 이름</span><input name="filename" required disabled={!canRegisterDocument} maxLength={255} placeholder="예: commercial-invoice.txt" /></label>
            <label><span>문서 원문</span><textarea
              name="content_text"
              required
              disabled={!canRegisterDocument}
              minLength={1}
              maxLength={MAX_DOCUMENT_TEXT_CHARACTERS}
              rows={14}
              placeholder="문서의 텍스트 내용을 입력하십시오."
              onChange={(event) => setDraftCharacterCount(event.currentTarget.value.length)}
            /></label>
            <small aria-live="polite">
              현재 {draftCharacterCount.toLocaleString()}자
              {` · 이 심사 건에서 추가 가능한 글자 ${remainingPrimaryCharacters.toLocaleString()}자`}
            </small>
            {error ? <p className="form-alert" role="alert">{error}</p> : null}
            <button
              className="commercial-button commercial-button--primary"
              type="submit"
              disabled={(
                submitting
                || !canRegisterDocument
                || primaryCapacityReached
                || primaryDraftExceedsAggregate
              )}
            >
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
                  onClick={() => selectDocument(item.document_id)}
                >
                  <span className="document-type-badge">
                    {documentTypeBadgeLabels[item.document_type]}
                  </span>
                  <span><strong>{documentTypeLabels[item.document_type]}</strong><small>{item.filename} · {formatKoreanDate(item.created_at)}</small></span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          )}
          {selected ? (
            <article className="document-preview" aria-live="polite">
              <header><div><small>{documentTypeLabels[selected.document_type]}</small><h3>{selected.filename}</h3></div><span>{selected.character_count.toLocaleString()}자</span></header>
              {contentLoading ? (
                <p>원문을 불러오는 중입니다.</p>
              ) : (
                <DocumentText
                  content={content ?? "문서를 선택하면 원문이 표시됩니다."}
                  startOffset={linkedSource?.start_offset}
                  endOffset={linkedSource?.end_offset}
                />
              )}
              {selectedRun ? (
                <section className="extracted-field-list" aria-label="이 심사 회차에서 확인한 문서 항목">
                  <h4>AI가 확인한 문서 항목</h4>
                  {citationResolution ? (
                    <p className="citation-granularity" data-testid="citation-granularity">
                      {citationResolution.kind === "source"
                        ? "이 인용은 선택한 항목의 정확한 원문 범위까지 연결합니다."
                        : "이 인용은 문서 항목 수준의 근거입니다. 여러 원문 출처 중 하나를 임의로 선택하지 않습니다."}
                    </p>
                  ) : null}
                  {selectedFields.length === 0 ? (
                    <p>이 심사 회차에서 확인된 추출 항목이 없습니다.</p>
                  ) : (
                    <dl>
                      {selectedFields.map((field) => {
                        const highlighted = linkedField?.field_id === field.field_id;
                        return (
                          <div
                            key={field.field_id}
                            id={highlighted && citationSourceId !== null
                              ? `field-${citationSourceId}`
                              : `field-${field.field_id}`}
                            className={highlighted ? "is-citation-target" : ""}
                            tabIndex={-1}
                            data-field-id={field.field_id}
                            data-review-run-id={selectedRun.review_run_id}
                          >
                            <dt>{fieldLabel(field.name, field.field_path)}</dt>
                            <dd>{displayFieldValue(field.value)}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </section>
              ) : null}
            </article>
          ) : null}
        </div>
      </section>
      <section className="content-panel supporting-register" data-testid="supporting-document-registration">
        <div className="section-heading">
          <div>
            <p className="overline">요건 증명서 등록</p>
            <h3>증명서 원문과 검증에 필요한 발급 정보를 함께 등록합니다.</h3>
            <p>원문만 등록해서는 요건 검증에 사용할 수 없으므로 필수 메타데이터를 같은 흐름에서 결박합니다.</p>
          </div>
        </div>
        {!canRegisterDocument ? (
          <p className="read-only-notice" role="note">
            현재 권한에서는 요건 증명서를 등록할 수 없습니다. 승인 담당자는 아래에서 독립 확인을 기록할 수 있습니다.
          </p>
        ) : null}
        <form onSubmit={(event) => void submitSupportingDocument(event)}>
          <label>
            <span>등록을 마칠 원문</span>
            <select
              name="source_document_id"
              value={supportingSourceId}
              disabled={!canRegisterDocument}
              onChange={(event) => setSupportingSourceId(event.currentTarget.value)}
            >
              <option value="new">새 증명서 원문 등록</option>
              {unregisteredSupportingSources.map((document) => (
                <option key={document.document_id} value={document.document_id}>
                  저장된 원문 이어서 등록 · {document.filename}
                </option>
              ))}
            </select>
          </label>
          {supportingSourceId === "new" ? (
            <>
              <label><span>파일 이름</span><input name="filename" required disabled={!canRegisterDocument} maxLength={255} placeholder="예: requirement-certificate.txt" /></label>
              <label><span>증명서 원문</span><textarea name="content_text" required disabled={!canRegisterDocument} minLength={1} maxLength={MAX_DOCUMENT_TEXT_CHARACTERS} rows={8} /></label>
            </>
          ) : (
            <p className="read-only-notice" role="note">
              이미 저장된 원문을 재사용합니다. 원문을 중복 등록하지 않고 아래 검증 정보만 다시 저장합니다.
            </p>
          )}
          <div className="supporting-metadata-grid">
            <label><span>증명서 코드</span><input name="document_code" required disabled={!canRegisterDocument} minLength={1} maxLength={128} pattern="[A-Za-z0-9][A-Za-z0-9._:-]*" title="영문 또는 숫자로 시작하고 영문·숫자·마침표·밑줄·콜론·하이픈만 입력합니다." /></label>
            <label><span>발급기관</span><input name="issuer" required disabled={!canRegisterDocument} minLength={1} maxLength={256} /></label>
            <label><span>증명서 번호</span><input name="document_number" required disabled={!canRegisterDocument} minLength={1} maxLength={256} /></label>
            <label><span>발급일</span><input name="issued_on" type="date" required disabled={!canRegisterDocument} /></label>
            <label><span>유효기간 <small>선택</small></span><input name="valid_until" type="date" disabled={!canRegisterDocument} /></label>
          </div>
          <fieldset className="supporting-item-picker">
            <legend>증명서가 적용되는 품목과 품목분류번호</legend>
            {supportingItems.length === 0 ? (
              <p className="read-only-notice" role="note">
                먼저 일반 심사 문서를 등록하고 1차 심사를 실행해야 대상 품목을 안전하게 선택할 수 있습니다.
              </p>
            ) : supportingItems.map((item, index) => (
              <label key={item.item_id}>
                <input
                  type="checkbox"
                  name="subject_item_ids"
                  value={item.item_id}
                  disabled={!canRegisterDocument}
                />
                <span>
                  품목 {index + 1} · 품목분류번호 {
                    item.resolved_hsk10 ?? item.requested_hs_code
                  }
                </span>
              </label>
            ))}
            <small>Agent가 현재 심사 회차에서 확인한 품목만 선택할 수 있으며 내부 식별자는 화면에 노출하지 않습니다.</small>
          </fieldset>
          <button
            className="commercial-button commercial-button--primary"
            type="submit"
            disabled={(
              supportingSubmitting
              || !canRegisterDocument
              || supportingItems.length === 0
            )}
          >
            {supportingSubmitting ? "증명서 등록 중" : "요건 증명서 등록"}
          </button>
        </form>
      </section>
      <section className="content-panel supporting-verification" data-testid="supporting-verification">
        <div className="section-heading">
          <div>
            <p className="overline">요건 증명서 확인</p>
            <h3>등록자와 다른 승인 담당자가 증명서를 독립적으로 확인합니다.</h3>
            <p>이 확인은 Local UAT용 사람 검증 기록이며 법적 진위 확인이나 통관 승인을 뜻하지 않습니다.</p>
          </div>
          <span>{supportingDocuments.length}개</span>
        </div>
        {supportingDocuments.length === 0 ? (
          <p className="nothing-found">이 심사 건에 등록된 요건 증명서가 없습니다.</p>
        ) : (
          <div className="proposal-list">
            {supportingDocuments.map((document) => {
              const humanAssertions = document.verification_assertions.filter(
                (assertion) => assertion.method === "human_approver",
              );
              const currentActorVerified = humanAssertions.some(
                (assertion) => assertion.asserted_by === session?.subject,
              );
              const canVerify = Boolean(
                canVerifySupportingDocument
                && session?.subject !== document.created_by
                && !currentActorVerified,
              );
              return (
                <article key={document.document_id} className="proposal">
                  <header>
                    <strong>{document.document_code} · {document.document_number}</strong>
                    <small>{humanAssertions.length > 0 ? "독립 확인 기록 있음" : "독립 확인 필요"}</small>
                  </header>
                  <p>
                    발급자 {document.issuer} · 발급일 {document.issued_on} · {
                      actorRoleLabel(document.created_by, session?.subject, "심사 담당자")
                    } 등록
                  </p>
                  {humanAssertions.length > 0 ? (
                    <ul>
                      {humanAssertions.map((assertion) => (
                        <li key={assertion.assertion_id}>
                          {actorRoleLabel(assertion.asserted_by, session?.subject, "승인 담당자")} 확인 · {
                            formatKoreanDate(assertion.asserted_at)
                          }
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {canVerify ? (
                    <button
                      className="commercial-button commercial-button--primary"
                      type="button"
                      disabled={verifyingDocumentId !== null}
                      onClick={() => void verifySupportingDocument(document)}
                    >
                      {verifyingDocumentId === document.document_id ? "확인 저장 중" : "증명서 확인 기록 남기기"}
                    </button>
                  ) : (
                    <small>
                      {currentActorVerified
                        ? "현재 승인 담당자의 확인 기록이 이미 있습니다."
                        : canVerifySupportingDocument
                          ? "문서 등록자는 자신의 증명서를 승인할 수 없습니다."
                          : "승인 담당자 권한으로 로그인하면 독립 확인을 기록할 수 있습니다."}
                    </small>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DocumentText({
  content,
  startOffset,
  endOffset,
}: {
  content: string;
  startOffset: number | undefined;
  endOffset: number | undefined;
}): React.ReactElement {
  const validRange = (
    startOffset !== undefined
    && endOffset !== undefined
    && Number.isInteger(startOffset)
    && Number.isInteger(endOffset)
    && startOffset >= 0
    && endOffset > startOffset
    && endOffset <= content.length
  );
  if (!validRange) return <pre>{content}</pre>;
  return (
    <pre>
      {content.slice(0, startOffset)}
      <mark data-testid="document-source-highlight">
        {content.slice(startOffset, endOffset)}
      </mark>
      {content.slice(endOffset)}
    </pre>
  );
}

function displayFieldValue(value: string | number | boolean | null): string {
  if (value === null) return "값을 확인하지 못했습니다.";
  if (typeof value === "boolean") return value ? "예" : "아니요";
  return String(value);
}

async function sha256Hex(value: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function sameStringSet(left: string[], right: string[]): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return (
    sortedLeft.length === sortedRight.length
    && sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

function resolveFieldCitation(
  run: ReviewRun,
  referenceId: string,
): FieldCitationResolution | null {
  const fieldMatches = run.fields.filter((field) => field.field_id === referenceId);
  const sourceMatches = run.sources.filter((source) => source.source_id === referenceId);
  if (fieldMatches.length === 1 && sourceMatches.length === 0) {
    return { kind: "field", field: fieldMatches[0]!, source: null };
  }
  if (fieldMatches.length > 0 || sourceMatches.length !== 1) return null;
  const source = sourceMatches[0]!;
  if (typeof source.document_id !== "string") return null;
  const ownerFields = run.fields.filter((field) => (
    field.source_ids.includes(source.source_id)
    && field.document_id === source.document_id
  ));
  if (ownerFields.length !== 1) return null;
  return { kind: "source", field: ownerFields[0]!, source };
}
