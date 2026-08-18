import { useEffect, useRef, useState } from "react";
import type { ReviewComparison, ReviewRun } from "../api/v1/types";
import { isDocumentSource } from "../api/v1/types";
import type { AssetWorkbenchEntry } from "./store";
import { DOCUMENT_TYPES } from "./constants";
import {
  comparisonStatusLabel,
  displayValue,
  documentTypeLabel,
  extractionPreviewText,
  extractionStatusLabel,
  focusDataTarget,
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
        원본 파일은 그대로 보존되며, 추출된 텍스트는 검수·확정 전에는 심사에 사용되지 않습니다. 이미지·스캔 문서는 이
        환경에서 자동 추출을 제공하지 않습니다.
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
  const confirmed = entry.confirmed || state.documents.some((document) => document.filename === confirmedFilename);
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
        {!extraction && !extracting && !confirmed ? (
          <button className="btn" type="button" onClick={() => void store.runExtraction(asset.asset_id)}>
            자동 추출 실행
          </button>
        ) : null}
      </header>
      {extraction && extraction.status === "unavailable" ? (
        <p className="asset-row__note">
          읽을 수 있는 텍스트 레이어가 없습니다. 이 환경은 스캔·이미지 OCR을 제공하지 않으므로, 아래 텍스트 등록 양식으로
          원문을 직접 등록하십시오.
        </p>
      ) : null}
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
  return (
    <details className="asset-confirm-panel" open>
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
          <span>{comparison.rule_code}</span>
          <span>{comparisonStatusLabel(comparison.status)}</span>
          <span className="mono">{`${displayValue(comparison.left.display_value)} ↔ ${displayValue(comparison.right.display_value)}`}</span>
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
