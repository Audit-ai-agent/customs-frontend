import { useEffect, useRef, useState } from "react";
import type { DocumentAsset, RasterTextExtractionJob, ReviewComparison, ReviewRun } from "../api/v1/types";
import { isDocumentSource } from "../api/v1/types";
import type { AssetWorkbenchEntry } from "./store";
import { DOCUMENT_TYPES } from "./constants";
import {
  comparisonStatusLabel,
  displayValue,
  documentTypeLabel,
  extractionPreviewText,
  extractionStatusLabel,
  extractionUnavailableMessage,
  fieldLabel,
  focusDataTarget,
  rasterTextExtractionStatusLabel,
  rasterTextPreviewText,
  rasterTextWarningLabel,
  ruleTitle,
} from "./labels";
import { EmptyCopy, EmptyState, Field, Metric, RoleBoundaryNote, SectionHeading, Submit } from "./primitives";
import { DutyDiagnosisStage, HsClassificationCard, OriginVerificationCard } from "./trade";
import { useStore, useWorkbenchState } from "./useStore";

/** Shared call to action for the stages that need a run before they can show anything. */
export function GoToDocumentsButton() {
  const store = useStore();
  const state = useWorkbenchState();
  const hasActive = store.activeDocuments().length > 0;
  return (
    <button
      className="btn primary"
      type="button"
      onClick={() => {
        if (hasActive) void store.startReview();
        else if (state.selectedCase) store.setRoute(state.selectedCase.case_id, "documents");
      }}
    >
      {hasActive ? "AI 심사 시작하기" : "서류 등록 단계로 이동"}
    </button>
  );
}

/* ── 단계 1 · 서류 등록 ──────────────────────────────────────── */

export function DocumentsStage() {
  const store = useStore();
  const state = useWorkbenchState();
  return (
    <section className="stage-view">
      <section className="surface">
        <SectionHeading
          title="원본 파일 업로드 · 자동 추출"
          description="PDF·JPG·PNG 원본을 올리면 텍스트 추출 후보를 만듭니다. 담당자가 검수해 확정한 텍스트만 심사 입력이 됩니다."
        />
        {store.hasRole("reviewer") ? (
          <UploadAssetForm />
        ) : (
          <RoleBoundaryNote>서류 파일 업로드는 심사자 역할에서만 할 수 있습니다.</RoleBoundaryNote>
        )}
        <div className="asset-list">
          {state.documentAssets.map((entry) => (
            <AssetRow key={entry.asset.asset_id} entry={entry} />
          ))}
          {state.documentAssets.length === 0 ? <EmptyCopy>업로드한 원본 파일이 없습니다.</EmptyCopy> : null}
        </div>
      </section>

      <section className="surface">
        <SectionHeading
          title="서류 등록"
          description="활성 문서는 다음 심사 입력에 포함됩니다. 행을 누르면 원문 대조 창이 열립니다."
        />
        <div className="document-table" role="list">
          {state.documents.map((document) => {
            const superseded = Boolean(document.superseded_by_document_id);
            return (
              <button
                key={document.document_id}
                type="button"
                role="listitem"
                title="원문 대조 열기"
                className={`document-row${state.selectedDocument?.document_id === document.document_id ? " is-selected" : ""}${superseded ? " is-superseded" : ""}`}
                onClick={() => void store.openDocumentModal(document.document_id)}
              >
                <span className="document-type">{document.document_type}</span>
                <span className="document-name">{document.filename}</span>
                <span>{superseded ? "대체됨" : "활성"}</span>
                <small>{document.character_count.toLocaleString()}자</small>
              </button>
            );
          })}
          {state.documents.length === 0 ? <EmptyCopy>등록된 문서가 없습니다.</EmptyCopy> : null}
        </div>
        {store.hasRole("reviewer") ? (
          <details className="document-add-panel" open={state.documents.length === 0}>
            <summary>문서 등록 또는 보완</summary>
            <AddDocumentForm />
          </details>
        ) : (
          <RoleBoundaryNote>
            승인자 역할은 원문과 심사 이력을 읽을 수 있지만 문서를 등록하거나 보완할 수는 없습니다.
          </RoleBoundaryNote>
        )}
      </section>

      <HsClassificationCard />
    </section>
  );
}

function UploadAssetForm() {
  const store = useStore();
  const state = useWorkbenchState();
  const fileRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<(typeof DOCUMENT_TYPES)[number]>("CI");
  return (
    <form
      className="asset-upload-form"
      onSubmit={(event) => {
        event.preventDefault();
        const file = fileRef.current?.files?.[0];
        if (!file) {
          store.showError(new Error("업로드할 PDF·JPG·PNG 파일을 선택하십시오."));
          return;
        }
        void store.uploadDocumentAsset({ documentType, file }).then(() => {
          if (fileRef.current) fileRef.current.value = "";
        });
      }}
    >
      <p className="form-hint">
        원본 파일은 그대로 보존됩니다. 일반 PDF는 내장 텍스트를 먼저 읽고, 스캔 PDF·JPG·PNG는 별도의 OCR 텍스트
        초안을 실행할 수 있습니다. 어떤 결과도 검수·확정 전에는 심사에 사용되지 않습니다.
      </p>
      <div className="form-grid">
        <Field label="문서 유형">
          <select
            name="asset_document_type"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value as (typeof DOCUMENT_TYPES)[number])}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {documentTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="원본 파일 (PDF·JPG·PNG)">
          <input ref={fileRef} name="asset_file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" />
        </Field>
      </div>
      <Submit label={state.uploadingAsset ? "업로드 중…" : "파일 업로드 · 자동 추출"} disabled={state.uploadingAsset || state.busy} />
    </form>
  );
}

function AssetRow({ entry }: { entry: AssetWorkbenchEntry }) {
  const store = useStore();
  const state = useWorkbenchState();
  const { asset, extraction, extracting } = entry;
  // The Backend does not link assets to their confirmed documents, so a prior
  // session's confirmation is recognized by the default confirm filename.
  const confirmedFilename = asset.filename.replace(/\.(pdf|jpe?g|png)$/iu, "") + ".txt";
  const confirmedDocument = state.documents.find((document) => document.filename === confirmedFilename) ?? null;
  const confirmed = entry.confirmed || confirmedDocument !== null;
  const preview = extraction?.result ?? null;
  const confirmable =
    !confirmed &&
    extraction !== null &&
    (extraction.status === "preview_ready" || extraction.status === "needs_review");
  return (
    <article className="asset-row" data-asset-id={asset.asset_id}>
      <header className="asset-row__head">
        <span className="document-type">{asset.document_type}</span>
        <div className="asset-row__meta">
          <strong>{asset.filename}</strong>
          <small>
            {`${documentTypeLabel(asset.document_type)} · ${asset.media_type} · ${asset.byte_size.toLocaleString()}B`}
            {asset.media_type === "application/pdf" ? ` · ${asset.page_count}쪽` : ""}
          </small>
        </div>
        <span className={`asset-status asset-status--${confirmed ? "confirmed" : extraction?.status ?? "none"}`}>
          {confirmed
            ? "문서로 확정됨"
            : extracting
              ? "추출 중…"
              : extraction
                ? extractionStatusLabel(extraction.status)
                : "추출 전"}
        </span>
        {(!extraction || extraction.status === "failed" || extraction.status === "unavailable") &&
        !extracting &&
        !confirmed ? (
          <button className="btn" type="button" onClick={() => void store.runExtraction(asset.asset_id)}>
            {extraction ? "자동 추출 다시 실행" : "자동 추출 실행"}
          </button>
        ) : null}
      </header>
      {extraction && extraction.status === "unavailable" ? (
        <p className="asset-row__note">{extractionUnavailableMessage(extraction.result?.warnings)}</p>
      ) : null}
      {confirmed ? (
        <p className="asset-confirmed-note" data-asset-confirmed>
          확정됨 · 검수한 텍스트가 활성 문서로 등록되어 있습니다.
          {confirmedDocument ? (
            <button
              className="text-link"
              type="button"
              onClick={() => void store.openDocumentModal(confirmedDocument.document_id)}
            >
              원문 보기
            </button>
          ) : null}
        </p>
      ) : (
        <RasterTextExtractionPanel entry={entry} confirmed={confirmed} />
      )}
      {confirmable && preview && store.hasRole("reviewer") ? (
        <ConfirmExtractionPanel
          assetId={asset.asset_id}
          extractionJobId={extraction.extraction_job_id}
          initialText={extractionPreviewText(preview)}
          initialFilename={asset.filename.replace(/\.(pdf|jpe?g|png)$/iu, "") + ".txt"}
          warnings={preview.warnings}
          needsReview={extraction.status === "needs_review"}
        />
      ) : null}
    </article>
  );
}

function RasterTextExtractionPanel({ entry, confirmed }: { entry: AssetWorkbenchEntry; confirmed: boolean }) {
  const store = useStore();
  const state = useWorkbenchState();
  const envelope = entry.rasterTextExtraction;
  const job = envelope?.job ?? null;
  const preview = job?.result ?? null;
  const candidate = rasterTextPreviewText(preview);
  const pending = job?.status === "queued" || job?.status === "running";
  const confirmable = !confirmed
    && envelope !== null
    && !envelope.profile_superseded
    && (job?.status === "preview_ready" || job?.status === "needs_review")
    && Boolean(candidate.trim());
  const notices = [...new Set([...(preview?.warnings ?? []), ...(preview?.needs_review_reasons ?? [])])];

  return (
    <section className="raster-text-panel" data-testid="raster-text-panel">
      <div className="raster-text-panel__head">
        <div>
          <strong>스캔·이미지 OCR 텍스트</strong>
          <p>텍스트만 읽습니다. 표·셀·위치 구조는 만들거나 추정하지 않습니다.</p>
        </div>
        {job ? (
          <span className={`asset-status asset-status--${job.status}`}>{rasterTextExtractionStatusLabel(job.status)}</span>
        ) : null}
      </div>

      {!job && store.hasRole("reviewer") ? (
        <div className="raster-text-panel__actions">
          <button
            className="btn btn--secondary"
            type="button"
            disabled={entry.rasterTextExtracting || state.busy || confirmed}
            onClick={() => void store.runRasterTextExtraction(entry.asset.asset_id)}
          >
            {entry.rasterTextExtracting ? "OCR 요청 중…" : "스캔·이미지 OCR 실행"}
          </button>
          <span className="form-hint">
            스캔한 PDF나 사진처럼 내장 텍스트가 없어 위의 자동 추출이 비어 있을 때 사용합니다.
          </span>
        </div>
      ) : null}

      {job ? (
        <div className="raster-text-panel__actions">
          <button
            className="btn"
            type="button"
            disabled={entry.rasterTextExtracting || state.busy}
            onClick={() => void store.refreshRasterTextExtraction(entry.asset.asset_id)}
          >
            {entry.rasterTextExtracting ? "상태 확인 중…" : "OCR 상태 새로고침"}
          </button>
          {envelope?.profile_superseded ? (
            <button
              className="btn primary"
              type="button"
              disabled={entry.rasterTextExtracting || state.busy}
              onClick={() => void store.runRasterTextExtraction(entry.asset.asset_id)}
            >
              현재 프로필로 새 OCR 요청
            </button>
          ) : null}
        </div>
      ) : null}

      {pending ? (
        <p className="form-hint">3초 간격으로 최대 60초 동안 상태를 자동 확인합니다. OCR 요청 자체는 백그라운드에서 계속 처리됩니다.</p>
      ) : null}
      {envelope?.profile_superseded ? (
        <p className="asset-row__note">OCR 프로필이 바뀌어 이전 초안은 등록할 수 없습니다. 현재 프로필로 새로 요청하십시오.</p>
      ) : null}
      {job?.status === "unavailable" || job?.status === "failed" ? (
        <p className="asset-row__note">{job.status === "unavailable" ? "이 문서의 OCR 텍스트 초안을 제공할 수 없습니다." : "OCR 처리에 실패했습니다. 기존 문서는 변경되지 않았습니다."}</p>
      ) : null}
      {notices.length ? (
        <ul className="raster-text-notices">
          {notices.map((code) => <li key={code}>{rasterTextWarningLabel(code)}</li>)}
        </ul>
      ) : null}
      {preview?.pages.length ? (
        <div className="raster-text-pages">
          {[...preview.pages].sort((left, right) => left.page_number - right.page_number).map((page) => (
            <details key={page.page_number} open={preview.pages.length === 1}>
              <summary>
                {page.page_number}쪽
                {page.confidence === null ? " · 신뢰도 정보 없음" : ` · 신뢰도 ${Math.round(page.confidence * 1000) / 10}%`}
              </summary>
              <pre>{page.text}</pre>
            </details>
          ))}
        </div>
      ) : null}
      {confirmable && job ? (
        <>
          <RasterTextSourceViewer asset={entry.asset} />
          <RasterTextConfirmationPanel
            key={job.raster_text_extraction_job_id}
            asset={entry.asset}
            job={job}
            initialText={candidate}
            notices={notices}
          />
        </>
      ) : null}
    </section>
  );
}

function RasterTextSourceViewer({ asset }: { asset: DocumentAsset }) {
  const store = useStore();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const close = () => {
    controller.current?.abort();
    controller.current = null;
    if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setObjectUrl(null);
    setLoading(false);
  };

  useEffect(() => () => {
    controller.current?.abort();
    controller.current = null;
    if (objectUrlRef.current !== null) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  const open = async () => {
    close();
    const nextController = new AbortController();
    controller.current = nextController;
    setLoading(true);
    try {
      const blob = await store.getDocumentAssetSource(asset.asset_id, nextController.signal);
      if (nextController.signal.aborted || controller.current !== nextController) return;
      const nextUrl = URL.createObjectURL(blob);
      if (nextController.signal.aborted || controller.current !== nextController) {
        URL.revokeObjectURL(nextUrl);
        return;
      }
      objectUrlRef.current = nextUrl;
      setObjectUrl(nextUrl);
    } catch (error) {
      if (!nextController.signal.aborted) store.showError(error);
    } finally {
      if (controller.current === nextController) {
        controller.current = null;
        setLoading(false);
      }
    }
  };

  return (
    <section className="raster-text-source-viewer">
      <div className="raster-text-panel__actions">
        <strong>원본 대조</strong>
        {objectUrl ? (
          <button className="btn" type="button" onClick={close}>원본 닫기</button>
        ) : (
          <button className="btn" type="button" disabled={loading} onClick={() => void open()}>
            {loading ? "원본 불러오는 중…" : "원본과 OCR 텍스트 대조"}
          </button>
        )}
      </div>
      {objectUrl ? (
        asset.media_type === "application/pdf" ? (
          <object className="raster-text-source-viewer__pdf" data={objectUrl} type="application/pdf" aria-label={`${asset.filename} 원본 PDF`}>
            <p>이 브라우저에서는 PDF 원본을 인라인으로 표시할 수 없습니다.</p>
          </object>
        ) : (
          <img className="raster-text-source-viewer__image" src={objectUrl} alt={`${asset.filename} 원본`} referrerPolicy="no-referrer" />
        )
      ) : (
        <p className="form-hint">원본은 요청할 때만 no-store 응답으로 받아 임시 Blob URL로 표시하며, 닫거나 화면을 벗어나면 즉시 해제합니다.</p>
      )}
    </section>
  );
}

function RasterTextConfirmationPanel({
  asset,
  job,
  initialText,
  notices,
}: {
  asset: DocumentAsset;
  job: RasterTextExtractionJob;
  initialText: string;
  notices: string[];
}) {
  const store = useStore();
  const state = useWorkbenchState();
  const [text, setText] = useState(initialText);
  const [filename, setFilename] = useState(asset.filename.replace(/\.(pdf|jpe?g|png)$/iu, "") + ".txt");
  return (
    <details className="asset-confirm-panel raster-text-confirm-panel" open>
      <summary>{job.status === "needs_review" ? "OCR 텍스트 원본 대조·확정" : "OCR 텍스트 검수·확정"}</summary>
      <p className="form-hint">
        아래 전체 텍스트를 직접 대조·수정한 값만 문서로 등록합니다. OCR 초안 자체는 심사 입력이 아닙니다.
        {notices.length ? ` (${notices.map(rasterTextWarningLabel).join(" ")})` : ""}
      </p>
      <form
        className="asset-confirm-form"
        onSubmit={(event) => {
          event.preventDefault();
          void store.confirmRasterTextExtraction({
            assetId: asset.asset_id,
            rasterTextExtractionJobId: job.raster_text_extraction_job_id,
            contentText: text,
            filename: filename.trim(),
          });
        }}
      >
        <Field label="원본과 대조해 확인한 전체 텍스트">
          <textarea
            name="raster_text_confirmed_text"
            rows={12}
            required
            maxLength={200_000}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
        <Field label="등록 파일명 (.txt)">
          <input
            name="raster_text_confirmed_filename"
            type="text"
            required
            maxLength={255}
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
          />
        </Field>
        <Submit label="확인한 OCR 텍스트를 문서로 등록" disabled={state.busy || !text.trim()} />
      </form>
    </details>
  );
}

function ConfirmExtractionPanel({
  assetId,
  extractionJobId,
  initialText,
  initialFilename,
  warnings,
  needsReview,
}: {
  assetId: string;
  extractionJobId: string;
  initialText: string;
  initialFilename: string;
  warnings: string[];
  needsReview: boolean;
}) {
  const store = useStore();
  const state = useWorkbenchState();
  const [text, setText] = useState(initialText);
  const [filename, setFilename] = useState(initialFilename);
  const panelRef = useRef<HTMLDetailsElement>(null);
  // The two-step flow (upload → 검수·확정) is easy to miss when the panel opens
  // below the fold; bring it into view once when it appears.
  useEffect(() => {
    panelRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, []);
  return (
    <details className="asset-confirm-panel" open ref={panelRef}>
      <summary>{needsReview ? "부분 추출 텍스트 검수·확정" : "추출 텍스트 검수·확정"}</summary>
      <p className="form-hint">
        추출 결과는 검수용 후보일 뿐입니다. 아래 내용을 원본과 대조해 수정한 뒤 확정해야 심사 입력이 됩니다.
        {warnings.length ? ` (참고: ${warnings.join(", ")})` : ""}
      </p>
      <form
        className="asset-confirm-form"
        onSubmit={(event) => {
          event.preventDefault();
          void store.confirmExtractedText({
            assetId,
            extractionJobId,
            contentText: text,
            filename: filename.trim(),
          });
        }}
      >
        <Field label="추출 텍스트 (검수 후 수정 가능)">
          <textarea
            name="confirmed_text"
            rows={10}
            maxLength={200_000}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </Field>
        <Field label="등록 파일명 (.txt)">
          <input
            name="confirmed_filename"
            type="text"
            required
            maxLength={255}
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
          />
        </Field>
        <Submit label="검수 완료 · 문서로 확정" disabled={state.busy} />
      </form>
    </details>
  );
}

function AddDocumentForm() {
  const store = useStore();
  const state = useWorkbenchState();
  const active = store.activeDocuments();
  const fileRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState<(typeof DOCUMENT_TYPES)[number]>("CI");
  const [filename, setFilename] = useState("");
  const [contentText, setContentText] = useState("");
  const [replacesDocumentId, setReplacesDocumentId] = useState("");

  return (
    <form
      className="document-form"
      onSubmit={(event) => {
        event.preventDefault();
        const file = fileRef.current?.files?.[0] ?? null;
        void store
          .addDocument({ documentType, filename: filename.trim(), contentText, file, replacesDocumentId })
          .then(() => {
            setFilename("");
            setContentText("");
            setReplacesDocumentId("");
            if (fileRef.current) fileRef.current.value = "";
          });
      }}
    >
      <p className="form-hint">
        텍스트 붙여넣기 또는 .txt 파일만 지원합니다. PDF·이미지·OCR은 이 기능 범위에 포함되지 않습니다.
      </p>
      <div className="form-grid">
        <Field label="문서 유형">
          <select
            name="document_type"
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value as (typeof DOCUMENT_TYPES)[number])}
          >
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {documentTypeLabel(type)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="파일명">
          <input
            name="filename"
            type="text"
            required
            maxLength={255}
            placeholder="commercial-invoice.txt"
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
          />
        </Field>
      </div>
      <Field label="대체할 활성 문서">
        <select
          name="replaces_document_id"
          value={replacesDocumentId}
          onChange={(event) => setReplacesDocumentId(event.target.value)}
        >
          <option value="">새 문서로 등록</option>
          {active.map((document) => (
            <option key={document.document_id} value={document.document_id}>
              {`${document.document_type} · ${document.filename}`}
            </option>
          ))}
        </select>
      </Field>
      <Field label="텍스트 파일(.txt)">
        <input ref={fileRef} name="text_file" type="file" accept=".txt,text/plain" />
      </Field>
      <Field label="문서 원문">
        <textarea
          name="content_text"
          rows={8}
          maxLength={200_000}
          placeholder="문서에서 추출한 텍스트를 붙여넣으십시오."
          value={contentText}
          onChange={(event) => setContentText(event.target.value)}
        />
      </Field>
      <Submit label="텍스트 문서 등록" disabled={state.busy} />
    </form>
  );
}

/* ── 단계 2 · 교차 검증 ──────────────────────────────────────── */

export function CrosscheckStage() {
  const state = useWorkbenchState();
  const run = state.selectedRun;
  if (!run) {
    return (
      <EmptyState title="아직 비교 결과가 없습니다." copy="활성 텍스트 문서를 등록한 뒤 AI 심사를 시작하십시오.">
        <GoToDocumentsButton />
      </EmptyState>
    );
  }
  const mismatches = run.comparisons.filter((item) => item.status === "mismatch" || item.status === "needs_review").length;
  return (
    <section className="stage-view">
      <section className="surface">
        <SectionHeading
          title="교차 검증"
          description="문서 간 값을 대조한 결과입니다. 행을 누르면 해당 값의 원문 위치가 열립니다."
        />
        <div className="review-metrics">
          <Metric label="전체 비교" value={run.comparisons.length} />
          <Metric label="확인 필요" value={mismatches} />
          <Metric label="문서" value={run.document_analyses.length} />
          <Metric
            label="추출 사실"
            value={run.document_analyses.reduce((total, analysis) => total + analysis.facts.length, 0)}
          />
        </div>
        <ComparisonTable comparisons={run.comparisons} />
      </section>
      <OriginVerificationCard />
      <section className="surface">
        <SectionHeading title="추출된 문서 사실" description="비교의 근거가 된 값입니다." />
        <ReportFacts run={run} />
      </section>
    </section>
  );
}

/** A comparison operand that is a bare field key (e.g. `hs_code`) reads as its Korean label. */
function comparisonValue(value: string | null | undefined): string {
  const text = displayValue(value);
  return /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/u.test(text) ? fieldLabel(text) : text;
}

export function ComparisonTable({ comparisons }: { comparisons: ReviewComparison[] }) {
  const store = useStore();
  const state = useWorkbenchState();
  const focusId = state.comparisonFocusId;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusId) focusDataTarget(containerRef.current, "data-comparison-id", focusId);
  }, [focusId]);

  if (!comparisons.length) {
    return <EmptyState title="비교 결과가 없습니다." copy="문서 유형과 필드가 충분하면 비교 결과가 표시됩니다." />;
  }
  return (
    <div className="comparison-table" role="table" aria-label="문서 비교 결과" ref={containerRef}>
      <div className="comparison-table__header" role="row">
        <span>검사</span>
        <span>상태</span>
        <span>비교값</span>
        <span>설명</span>
      </div>
      {comparisons.map((comparison) => (
        <button
          key={comparison.comparison_id}
          type="button"
          role="row"
          data-comparison-id={comparison.comparison_id}
          className={`comparison-row comparison-row--${comparison.status}${focusId === comparison.comparison_id ? " is-focused" : ""}`}
          onClick={() => void store.focusComparison(comparison)}
        >
          <span className="comparison-rule" title={comparison.rule_code}>
            {ruleTitle(comparison.rule_code)}
          </span>
          <span>
            <span className={`comparison-status comparison-status--${comparison.status}`}>
              {comparisonStatusLabel(comparison.status)}
            </span>
          </span>
          <span className="mono">
            {comparison.right.display_value?.trim()
              ? `${comparisonValue(comparison.left.display_value)} ↔ ${comparisonValue(comparison.right.display_value)}`
              : comparisonValue(comparison.left.display_value)}
          </span>
          <span>{comparison.message}</span>
        </button>
      ))}
    </div>
  );
}

export function ReportFacts({ run }: { run: ReviewRun }) {
  const store = useStore();
  const state = useWorkbenchState();
  const focusId = state.factFocusId;
  const containerRef = useRef<HTMLDListElement>(null);

  const facts = run.document_analyses.flatMap((analysis) => [
    ...analysis.facts.map((fact) => ({ filename: analysis.filename, fact })),
    ...analysis.line_items.flatMap((item) => item.facts.map((fact) => ({ filename: analysis.filename, fact }))),
  ]);

  useEffect(() => {
    if (focusId) focusDataTarget(containerRef.current, "data-fact-id", focusId);
  }, [focusId]);

  if (!facts.length) {
    return (
      <EmptyCopy>
        이번 실행에서는 화면에 표시할 추출 사실이 없습니다. 문서 원문과 확인 사항을 직접 검토하십시오.
      </EmptyCopy>
    );
  }
  return (
    <dl className="report-fact-list" ref={containerRef}>
      {facts.map(({ filename, fact }) => {
        const source = fact.source;
        const normalized = fact.normalized_value && fact.normalized_value !== fact.raw_value ? ` → ${fact.normalized_value}` : "";
        return (
          <div
            key={fact.fact_id}
            className={`report-fact${focusId === fact.fact_id ? " is-focused" : ""}`}
            data-fact-id={fact.fact_id}
          >
            <dt>{`${filename} · ${fact.name}`}</dt>
            <dd className="mono">{`${fact.raw_value}${normalized}${fact.unit ? ` ${fact.unit}` : ""}`}</dd>
            {isDocumentSource(source) ? (
              <button className="text-link" type="button" onClick={() => void store.focusSource(source)}>
                원문 인용 보기
              </button>
            ) : (
              <small className="human-provided-fact">
                {`사람 제공 값 · 정정 제안 ${source.correction_proposal_id} · ${source.reason}`}
              </small>
            )}
          </div>
        );
      })}
    </dl>
  );
}

/* ── 단계 4 · 관세 진단 ──────────────────────────────────────── */

export function DutyStage() {
  return <DutyDiagnosisStage />;
}
