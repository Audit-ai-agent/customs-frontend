import { useEffect, useRef, useState } from "react";
import type {
  DutyRate,
  HsCandidate,
  HsClassification,
  HsReferenceSearch,
  HsReferenceSearchResult,
  HsSelection,
  OriginCheckStatus,
} from "../api/v1/types";
import type { OriginFtaHint } from "../api/v1/types";
import { safeExternalHref } from "./labels";
import { CopyValueButton, EmptyCopy, EmptyState, Field, Num, RoleBoundaryNote, SectionHeading, Submit } from "./primitives";
import { GoToDocumentsButton } from "./stages";
import { useStore, useWorkbenchState } from "./useStore";

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/* ── 단계 1 · HSK 분류 카드 ──────────────────────────────────── */

type HsPickerView = Pick<HsClassification, "reference" | "candidates" | "selection">;

/** The recorded reason says how the code was picked; the reviewer does not type it. */
function hsSelectionReason(code: string, candidates: HsCandidate[], searchPick: HsReferenceSearchResult | null): string {
  const candidate = candidates.find((item) => item.code === code) ?? null;
  if (candidate?.origin === "document_code") {
    const documents = new Set(candidate.basis.map((item) => item.document_id)).size;
    return documents ? `서류 기재 코드 확정 (문서 ${documents}건 근거)` : "서류 기재 코드 확정";
  }
  if (candidate?.origin === "description_match") return "품명 매칭 후보에서 확정";
  if (searchPick?.code === code) return "HSK 참조 검색으로 확정";
  return "담당자 확정";
}

export function HsClassificationCard() {
  const store = useStore();
  const state = useWorkbenchState();
  if (!state.selectedRun) {
    // Before the first review the candidates come from the confirmed document
    // text; confirming here lets that first review retrieve law evidence.
    return (
      <HsPickerCard
        view={state.caseHsClassification}
        loading={state.caseHsLoading}
        error={state.caseHsError}
        resetKey={state.caseHsLoadedKey}
        basisCopy="확정된 서류 텍스트에서 세번(HS) 표기 줄의 코드를 읽어 후보를 제시합니다. AI 심사 전에 확정하면 첫 심사부터 법령 근거를 조회합니다."
        emptyCopy="서류 텍스트에서 HS 코드와 품명을 찾지 못했습니다. 서류를 등록·확정한 뒤 '서류에서 HSK 후보 추출'을 누르거나, 아래 검색창에서 코드나 품명으로 찾아 확정할 수 있습니다."
        onRefresh={() => void store.refreshCaseHsClassification()}
        onConfirm={(code, reason) => store.recordCaseHsSelection(code, reason)}
      />
    );
  }
  return (
    <HsPickerCard
      view={state.hsClassification}
      loading={state.hsLoading}
      error={state.hsError}
      resetKey={state.selectedRun.review_run_id}
      basisCopy="이번 심사 실행에서 추출된 HS 코드 사실을 근거로 후보를 제시합니다."
      emptyCopy="이번 실행의 문서 사실에서 HS 코드와 품명을 찾지 못했습니다. 문서 원문을 보완하거나 아래 검색창에서 코드나 품명으로 찾아 확정할 수 있습니다."
      priorSelection={state.hsClassification?.selection ? null : (state.caseHsClassification?.selection ?? null)}
      onConfirm={(code, reason) => store.recordHsSelection(code, reason)}
    />
  );
}

function HsPickerCard({
  view,
  loading,
  error,
  resetKey,
  basisCopy,
  emptyCopy,
  priorSelection = null,
  onRefresh,
  onConfirm,
}: {
  view: HsPickerView | null;
  loading: boolean;
  error: string | null;
  resetKey: string | null;
  basisCopy: string;
  emptyCopy: string;
  priorSelection?: HsSelection | null;
  onRefresh?: () => void;
  onConfirm: (code: string, reason: string) => Promise<void>;
}) {
  const store = useStore();
  const state = useWorkbenchState();
  const [chosen, setChosen] = useState<string | null>(null);
  const [searchPick, setSearchPick] = useState<HsReferenceSearchResult | null>(null);
  // A different candidate set (another run, or another document set) must not
  // keep a pick made against the previous one.
  useEffect(() => {
    setChosen(null);
    setSearchPick(null);
  }, [resetKey]);

  const refreshButton =
    onRefresh && store.hasRole("reviewer") ? (
      <div className="hsk-actions">
        <button
          type="button"
          className="btn"
          data-hsk-extract
          disabled={loading || state.busy || !store.activeDocuments().length}
          onClick={onRefresh}
        >
          {loading ? "추출 중…" : "서류에서 HSK 후보 추출"}
        </button>
      </div>
    ) : null;

  if (error) {
    return (
      <section className="surface" data-hsk-card>
        <SectionHeading title="HSK 분류" description={basisCopy} />
        {refreshButton}
        <p className="unsupported-inline">{error}</p>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="surface" data-hsk-card>
        <SectionHeading title="HSK 분류" description={basisCopy} />
        {refreshButton}
        <EmptyCopy>{loading ? "HSK 후보를 불러오는 중…" : "HSK 후보가 아직 없습니다."}</EmptyCopy>
      </section>
    );
  }

  const selection = view.selection ?? null;
  const activeCode = chosen ?? selection?.code ?? null;
  const recommended = view.candidates.find((item) => item.recommended) ?? null;
  const manualOverride = selection !== null && recommended !== null && selection.code !== recommended.code;
  const descriptionOnly =
    view.candidates.length > 0 &&
    view.candidates.every((item) => item.origin === "description_match");

  return (
    <section className="surface" data-hsk-card>
      <SectionHeading
        title="HSK 분류"
        description={`${basisCopy} 품목명 출처: ${view.reference.source} (${view.reference.as_of} 기준)`}
      />
      {refreshButton}
      {descriptionOnly ? (
        <div className="hsk-note on" data-hsk-description-note>
          문서에서 HS 코드를 찾지 못해 <b>품명 매칭 후보</b>를 제시합니다. 참조표의 품목명과 품명 텍스트를
          대조한 결과일 뿐이므로 반드시 담당자가 검토 후 확정하십시오.
        </div>
      ) : null}
      {view.candidates.length === 0 ? (
        <EmptyCopy>{emptyCopy}</EmptyCopy>
      ) : (
        <div className="hsk">
          {view.candidates.map((candidate) => (
            <HsCandidateRow
              key={candidate.code}
              candidate={candidate}
              picked={activeCode === candidate.code}
              confirmed={selection?.code === candidate.code}
              onPick={() => setChosen(candidate.code)}
            />
          ))}
        </div>
      )}
      <HsReferenceSearchBox
        onChoose={(entry) => {
          setSearchPick(entry);
          setChosen(entry.code);
        }}
      />
      {searchPick !== null ? (
        <div className="hsk" data-hsk-manual-result>
          <HsCandidateRow
            candidate={{
              code: searchPick.code,
              name_ko: searchPick.name_ko ?? null,
              name_en: searchPick.name_en ?? null,
              ancestors: searchPick.ancestors,
              confidence: 0,
              in_reference: true,
              recommended: false,
              origin: "document_code",
              basis: [],
            }}
            picked={activeCode === searchPick.code}
            confirmed={selection?.code === searchPick.code}
            onPick={() => setChosen(searchPick.code)}
            manual
          />
        </div>
      ) : null}
      {selection ? (
        <p className="form-hint" data-hsk-selection>
          {`확정 코드 ${selection.code} · ${selection.selected_by} · ${selection.reason}`}
        </p>
      ) : null}
      {priorSelection ? (
        <p className="form-hint" data-hsk-prior-selection>
          {`서류 단계에서 확정한 코드 ${priorSelection.code} · 다음 심사부터 법령 근거 조회에 사용됩니다.`}
        </p>
      ) : null}
      {manualOverride ? (
        <div className="hsk-note on">
          ⚠ 추천 후보({recommended.code})와 다른 코드로 <b>수동 확정</b>되어 있습니다. 관세 진단의 세율·요건이 확정
          코드 기준으로 재평가됩니다.
        </div>
      ) : null}
      {store.hasRole("reviewer") ? (
        activeCode !== null && activeCode !== selection?.code ? (
          <form
            className="decision-form hsk-confirm"
            onSubmit={(event) => {
              event.preventDefault();
              // The Backend keeps a reason with every selection; it is derived
              // from how the code was picked so the reviewer confirms in one click.
              void onConfirm(activeCode, hsSelectionReason(activeCode, view.candidates, searchPick)).then(() => {
                setChosen(null);
                setSearchPick(null);
              });
            }}
          >
            <span className="form-hint">{`선택한 코드 ${activeCode}`}</span>
            <Submit label="HSK 분류 확정" disabled={state.busy} />
          </form>
        ) : null
      ) : (
        <RoleBoundaryNote>HSK 분류 확정은 심사자 역할에서만 할 수 있습니다.</RoleBoundaryNote>
      )}
    </section>
  );
}

/**
 * Typeahead over the packaged HSK reference: a digits query suggests codes by
 * prefix, any other text reverse-searches item names. Results are Backend
 * reference rows only — choosing one still goes through the normal
 * pick-reason-confirm flow, nothing is auto-confirmed.
 */
function HsReferenceSearchBox({ onChoose }: { onChoose: (entry: HsReferenceSearchResult) => void }) {
  const store = useStore();
  const [text, setText] = useState("");
  const [view, setView] = useState<HsReferenceSearch | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  // Set when the input is filled programmatically (option chosen), so the
  // debounce effect does not immediately reopen the list for that text.
  const suppressSearch = useRef(false);

  useEffect(() => {
    if (suppressSearch.current) {
      suppressSearch.current = false;
      return;
    }
    const query = text.trim();
    if (query.length < 2) {
      setView(null);
      setOpen(false);
      setError(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      store
        .searchHskReference(query)
        .then((result) => {
          if (cancelled) return;
          setView(result);
          setOpen(true);
          setActive(-1);
          setError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setView(null);
          setOpen(false);
          setError("HSK 참조표 검색에 실패했습니다. 잠시 후 다시 시도하십시오.");
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, store]);

  const choose = (entry: HsReferenceSearchResult) => {
    suppressSearch.current = true;
    setText(entry.code);
    setOpen(false);
    setActive(-1);
    onChoose(entry);
  };

  const fullCodeMiss =
    view !== null && view.mode === "code_prefix" && view.results.length === 0 && /^[0-9]{10}$/u.test(view.query);

  return (
    <div className="hsk-search" data-hsk-search>
      <Field label="HSK 코드·품명 검색">
        <input
          name="hs_search"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="hsk-search-listbox"
          autoComplete="off"
          maxLength={100}
          placeholder="예: 6109101000 또는 티셔츠"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => {
            if (view !== null && text.trim().length >= 2) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              if (view === null || view.results.length === 0) return;
              event.preventDefault();
              setOpen(true);
              const count = view.results.length;
              const delta = event.key === "ArrowDown" ? 1 : -1;
              setActive((previous) => (previous + delta + count) % count);
            } else if (event.key === "Enter") {
              event.preventDefault();
              const entry = open && view !== null ? view.results[active] : undefined;
              if (entry) choose(entry);
            } else if (event.key === "Escape" && open) {
              event.stopPropagation();
              setOpen(false);
            }
          }}
        />
      </Field>
      {open && view !== null ? (
        <ul className="hsk-search-list" id="hsk-search-listbox" role="listbox" data-hsk-search-results>
          {view.mode === "name" && view.results.length > 0 ? (
            <li className="hsk-search-cap">
              {view.partial
                ? "품명 역검색 — 검색어 전체와 일치하는 항목이 없어 일부 단어가 일치한 결과를 표시합니다."
                : "품명 역검색 — 참조표 품목명과 대조한 결과입니다."}
            </li>
          ) : null}
          {view.results.length === 0 ? (
            <li className="hsk-search-empty">
              {fullCodeMiss
                ? "이 코드는 관세청 HSK 참조표에 없습니다. 코드를 다시 확인하십시오."
                : "일치하는 참조표 항목이 없습니다."}
            </li>
          ) : (
            view.results.map((entry, index) => (
              <li
                key={entry.code}
                role="option"
                aria-selected={index === active}
                className={`hsk-search-option${index === active ? " active" : ""}`}
                data-hsk-search-code={entry.code}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(entry);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span className="code">{entry.code}</span>
                <span className="nm">
                  {entry.name_ko ?? entry.name_en ?? "품목명 정보 없음"}
                  <small>{entry.ancestors.map((item) => item.name_ko).join(" › ") || "분류 경로 없음"}</small>
                </span>
              </li>
            ))
          )}
          {view.truncated ? (
            <li className="hsk-search-cap">결과가 더 있습니다 — 검색어를 좁히십시오.</li>
          ) : null}
        </ul>
      ) : null}
      {error !== null ? <p className="unsupported-inline">{error}</p> : null}
    </div>
  );
}

function HsCandidateRow({
  candidate,
  picked,
  confirmed,
  onPick,
  manual = false,
}: {
  candidate: HsCandidate;
  picked: boolean;
  confirmed: boolean;
  onPick: () => void;
  manual?: boolean;
}) {
  const breadcrumbs = candidate.ancestors.map((item) => item.name_ko).join(" › ");
  return (
    <div
      className={`cand${picked ? " pick" : ""}`}
      role="button"
      tabIndex={0}
      data-hsk-candidate-code={candidate.code}
      onClick={onPick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPick();
        }
      }}
    >
      <div className="code">{candidate.code}</div>
      <div className="desc">
        {candidate.name_ko ?? "품목명 정보 없음 (참조표 밖의 코드)"}
        <small>
          {breadcrumbs || "분류 경로 없음"}
          {manual
            ? " · 담당자가 검색으로 선택한 코드"
            : ` · 근거 문서 ${new Set(candidate.basis.map((item) => item.document_id)).size}건`}
        </small>
      </div>
      {manual ? null : (
        <div className="conf-bar">
          <div className="track">
            <div className="fill" style={{ width: `${Math.round(candidate.confidence * 100)}%` }} />
          </div>
          <div className="pct">{candidate.confidence.toFixed(2)}</div>
        </div>
      )}
      <span className="pin">
        {confirmed
          ? "확정"
          : manual
            ? "직접 선택"
            : candidate.recommended
              ? "추천"
              : candidate.origin === "description_match"
                ? "품명 기반"
                : "후보"}
      </span>
    </div>
  );
}

/* ── 단계 2 · 원산지(CO) 검증 카드 ───────────────────────────── */

const ORIGIN_STATUS_LABELS: Record<string, string> = {
  verified: "원산지 일치 확인",
  mismatch: "원산지 불일치",
  missing_certificate: "원산지증명서 없음",
  needs_review: "검수 필요",
};

const ORIGIN_FIELD_LABELS: Record<string, string> = {
  certificate_no: "증명서 번호",
  origin_country: "원산지 국가",
  hs_code: "HS 코드",
};

const CHECK_STATUS_LABELS: Record<OriginCheckStatus, string> = {
  match: "일치",
  mismatch: "불일치",
  missing: "값 없음",
};

export function OriginVerificationCard() {
  const state = useWorkbenchState();
  const view = state.originVerification;

  if (!state.selectedRun) return null;
  if (state.originError) {
    return (
      <section className="surface">
        <SectionHeading title="원산지 검증 (CO)" description="원산지증명서와 다른 서류의 값을 대조합니다." />
        <p className="unsupported-inline">{state.originError}</p>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="surface">
        <SectionHeading title="원산지 검증 (CO)" description="원산지증명서와 다른 서류의 값을 대조합니다." />
        <EmptyCopy>{state.originLoading ? "원산지 검증 결과를 불러오는 중…" : "검증 결과가 아직 없습니다."}</EmptyCopy>
      </section>
    );
  }

  const tone = view.status === "verified" ? "b-ok" : "b-bad";
  return (
    <section className="surface" data-origin-card>
      <SectionHeading
        title="원산지 검증 (CO)"
        description="원산지증명서의 번호·원산지·HS 코드를 다른 서류의 값과 대조한 결과입니다."
      />
      <p>
        <span className={`badge ${tone}`}>{ORIGIN_STATUS_LABELS[view.status] ?? view.status}</span>
        {view.certificate ? (
          <span className="form-hint">{` ${view.certificate.filename} 기준`}</span>
        ) : (
          <span className="form-hint"> 활성 문서 중 Certificate of Origin이 없습니다.</span>
        )}
      </p>
      {view.checks.length > 0 ? (
        <div className="sheet">
          <div className="sheet-body">
            {view.checks.map((check) => (
              <div className="row" key={check.field} data-origin-check={check.field}>
                <span className="k">{ORIGIN_FIELD_LABELS[check.field] ?? check.field}</span>
                <span className="v">
                  {`CO: ${check.certificate_value ?? "—"}`}
                  {check.field === "certificate_no" ? "" : ` · 대조: ${check.reference_value ?? "—"}`}
                  {"  "}
                  <span className={`badge ${check.status === "match" ? "b-ok" : "b-bad"}`}>
                    {CHECK_STATUS_LABELS[check.status]}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <OriginFtaHints hints={view.fta_hints} originCountry={view.origin_country ?? null} />
    </section>
  );
}

/** Agreement-specific official page (www.fta.go.kr/<agreement>/) named by the agreement itself. */
function AgreementLink({ hint }: { hint: OriginFtaHint }) {
  const href = safeExternalHref(hint.source_uri);
  if (!href) return <span>{hint.agreement_name}</span>;
  return (
    <a className="text-link" href={href} target="_blank" rel="noopener noreferrer" data-origin-agreement-link>
      {`${hint.agreement_name} 협정 안내 ↗`}
    </a>
  );
}

function OriginFtaHints({ hints, originCountry }: { hints: OriginFtaHint[]; originCountry: string | null }) {
  if (!hints.length) return null;
  const covered = hints.filter((hint) => hint.origin_covered);
  const others = hints.filter((hint) => !hint.origin_covered);
  return (
    <div className="origin-fta" data-origin-fta>
      <h4 className="origin-fta__title">협정 적용 가능성</h4>
      {originCountry === null ? (
        <p className="origin-fta__notice" data-origin-fta-unknown>
          원산지를 확인하지 못해 협정 대상 여부를 판단할 수 없습니다. 원산지증명서 또는 송장의 원산지 값을 보완하십시오.
        </p>
      ) : covered.length === 0 ? (
        <p className="origin-fta__notice">{`원산지 ${originCountry}은(는) 아래 협정 중 대상국이 아닙니다.`}</p>
      ) : null}
      {covered.length > 0 ? (
        <ul className="origin-fta__list" data-origin-fta-covered>
          {covered.map((hint) => (
            <li key={hint.agreement_code} className="origin-fta__item is-covered">
              <span className="badge b-ok">원산지 대상국</span>
              <AgreementLink hint={hint} />
              <small>{`필요 서식: ${hint.certificate_form}`}</small>
            </li>
          ))}
        </ul>
      ) : null}
      {others.length > 0 ? (
        <details className="origin-fta__others" data-origin-fta-others>
          <summary>{`대상 아님 ${others.length}건 보기`}</summary>
          <ul className="origin-fta__list">
            {others.map((hint) => (
              <li key={hint.agreement_code} className="origin-fta__item">
                <AgreementLink hint={hint} />
                <small>{`필요 서식: ${hint.certificate_form}`}</small>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/* ── 단계 4 · 관세 진단 화면 ─────────────────────────────────── */

const DUTY_REQUIREMENT_LABELS: Record<string, string> = {
  origin_in_agreement: "협정 대상국 원산지",
  certificate_present: "원산지증명서 제출",
  certificate_origin_match: "증명서 원산지 일치",
};

const DUTY_UNAVAILABLE_COPY: Record<string, { title: string; copy: string }> = {
  hs_code_unavailable: {
    title: "HS 코드를 찾지 못했습니다.",
    copy: "문서 사실에서 10자리 HS 코드를 찾지 못해 세율을 조회할 수 없습니다. 1단계에서 HSK 분류를 확인하십시오.",
  },
  rates_unavailable: {
    title: "이 HS 코드의 세율 스냅샷이 없습니다.",
    copy: "참조 세율 데이터에 이 코드의 항목이 없어 금액을 표시하지 않습니다. 실제 세율은 UNI-PASS에서 확인하십시오.",
  },
  value_unavailable: {
    title: "과세가격 근거를 찾지 못했습니다.",
    copy: "송장 총액(total_amount) 사실이 없어 금액 계산을 표시하지 않습니다. 송장 문서를 확인하십시오.",
  },
};

export function DutyDiagnosisStage() {
  const state = useWorkbenchState();
  const run = state.selectedRun;
  const view = state.dutyAssessment;

  if (!run) {
    return (
      <EmptyState title="아직 관세 진단이 없습니다." copy="활성 텍스트 문서를 등록한 뒤 AI 심사를 시작하십시오.">
        <GoToDocumentsButton />
      </EmptyState>
    );
  }
  if (state.dutyError) {
    return (
      <section className="surface">
        <SectionHeading title="관세 메리트 진단" description="확정 HS 코드와 문서 근거로 세율을 진단합니다." />
        <p className="unsupported-inline">{state.dutyError}</p>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="surface">
        <SectionHeading title="관세 메리트 진단" description="확정 HS 코드와 문서 근거로 세율을 진단합니다." />
        <EmptyCopy>{state.dutyLoading ? "관세 진단을 불러오는 중…" : "관세 진단이 아직 없습니다."}</EmptyCopy>
      </section>
    );
  }

  if (view.status !== "estimated") {
    const copy = DUTY_UNAVAILABLE_COPY[view.status];
    return (
      <section className="stage-view" data-duty-stage>
        <section className="surface">
          <SectionHeading title="관세 메리트 진단" description={view.reference.disclaimer} />
          <EmptyState title={copy?.title ?? "관세 진단을 표시할 수 없습니다."} copy={copy?.copy ?? ""} />
          {view.rates.length > 0 ? <RateLadder rates={view.rates} appliedKind={null} /> : null}
        </section>
      </section>
    );
  }

  const applied = view.applied;
  const savings = view.savings;
  const mainLadder = ladderSelection(view.rates);
  const dutiable = view.dutiable_value;
  const bestBlocked = view.rates.find((rate) => !rate.applicable && rate.requirements.length > 0);
  const currency = dutiable?.currency ?? "USD";

  return (
    <section className="stage-view" data-duty-stage>
      <section className="surface">
        <SectionHeading
          title="관세 메리트 진단"
          description={`확정 HSK ${view.hs_code?.code ?? "—"}${view.hs_code?.name_ko ? ` (${view.hs_code.name_ko})` : ""} · 원산지 ${view.origin_country ?? "미확인"} 기준. ${view.reference.disclaimer}`}
        />
        <div className="merit-hero">
          <div className="ladder">
            <h3>적용 가능 세율 사다리</h3>
            <div className="cap">
              {dutiable ? `과세가격 ${formatMoney(dutiable.amount, currency)} (송장 통화 기준) · 세율 낮은 순 우선` : "세율 낮은 순 우선"}
            </div>
            <RateLadderRows
              rates={mainLadder.shown}
              appliedKind={applied?.rate_kind ?? null}
              appliedAgreement={applied?.agreement_code ?? null}
            />
            <LadderOverflow
              rates={mainLadder.hiddenRates}
              appliedKind={applied?.rate_kind ?? null}
              appliedAgreement={applied?.agreement_code ?? null}
            />
            <div className="cap" style={{ marginTop: 12, marginBottom: 0 }}>
              ⚖ 세율 스냅샷 {view.reference.as_of} 기준 · 요건 충족 세율만 적용
            </div>
          </div>

          <div className="sim">
            <h3>예상 세액 (서버 계산)</h3>
            <div className="sim-out">
              <div className="so-row">
                <span className="k">과세가격</span>
                <span className="v">{dutiable ? formatMoney(dutiable.amount, currency) : "—"}</span>
              </div>
              <div className="so-row">
                <span className="k">{`적용 세율 (${applied ? `${applied.rate_pct}%` : "—"})`}</span>
                <span className="v">{applied ? <Num value={applied.duty_amount} format={(n) => formatMoney(n, currency)} /> : "—"}</span>
              </div>
              <div className="so-row sub">
                <span className="k">{`부가세 ${applied?.vat_rate_pct ?? 10}%`}</span>
                <span className="v">{applied ? formatMoney(applied.vat_amount, currency) : "—"}</span>
              </div>
              <div className="so-total">
                <span className="k">예상 세액 합계</span>
                <span className="v">{applied ? formatMoney(applied.total_estimated, currency) : "—"}</span>
              </div>
            </div>
          </div>

          <div className="saving">
            <div className="lab">
              {savings && savings.vs_basic_duty > 0
                ? "협정세율 적용으로 기본세율 대비 절감된 관세"
                : "요건 충족 시 절감 가능한 관세 (현재 기본세율 적용)"}
            </div>
            <div className="amt">
              <Num
                value={savings ? (savings.vs_basic_duty > 0 ? savings.vs_basic_duty : potentialSaving(view.rates, dutiable?.amount ?? 0)) : 0}
                format={(n) => formatMoney(n, currency)}
                duration={1100}
              />
            </div>
            <div className="sub">
              {savings && savings.vs_basic_duty > 0
                ? `기본세율 대비 · ${applied?.agreement_code ?? ""}`
                : savings && savings.blocked_requirements.length > 0
                  ? `미충족 요건: ${savings.blocked_requirements.map((code) => DUTY_REQUIREMENT_LABELS[code] ?? code).join(", ")}`
                  : "추가 절감 여지가 없습니다"}
            </div>
          </div>
        </div>
      </section>

      {bestBlocked ? (
        <section className="surface">
          <div className="section-lbl">
            <span className="bar" />
            {`${bestBlocked.label} ${bestBlocked.rate_pct}%를 받으려면 — 요건 체크`}
          </div>
          <div className="unlock">
            <div className="unlock-top">
              <div className="k">
                협정관세 적용 요건<small>세율 스냅샷 {view.reference.as_of} 기준</small>
              </div>
              <span className="goal">{`목표 ${bestBlocked.rate_pct}%`}</span>
            </div>
            {bestBlocked.requirements.map((requirement) => (
              <div className={`req ${requirement.satisfied ? "have" : "need"}`} key={requirement.code}>
                <div className="box">{requirement.satisfied ? "✓" : "!"}</div>
                <div className="rq">
                  <div className="t">
                    {DUTY_REQUIREMENT_LABELS[requirement.code] ?? requirement.code}
                    <span className="st">{requirement.satisfied ? "충족" : "미충족"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface">
        <SectionHeading title="세율 출처" description={`${view.reference.source} · ${view.reference.as_of} 기준`} />
        {view.hs_code?.code ? (
          <p className="form-hint">
            공식 포털은 품목별 화면으로 직접 연결되지 않습니다. 출처를 연 뒤 관세율표 검색창에 HS 코드를 붙여넣으십시오.
            <CopyValueButton value={view.hs_code.code} label={`HS 코드 ${view.hs_code.code} 복사`} />
          </p>
        ) : null}
        <RateSourceGroups rates={view.rates} />
      </section>
    </section>
  );
}

function potentialSaving(rates: DutyRate[], amount: number): number {
  if (!rates.length || amount <= 0) return 0;
  const basic = rates.find((rate) => rate.rate_kind === "basic");
  const best = rates.reduce((left, right) => (left.rate_pct <= right.rate_pct ? left : right));
  if (!basic) return 0;
  return Math.round((amount * (basic.rate_pct - best.rate_pct)) / 100 * 100) / 100;
}

/** Keep the visual ladder legible: rows the case can actually use
 *  (applicable, or 기본세율/WTO) stay visible; every 요건 미충족 row is kept
 *  behind one collapsed group so nothing is lost, only deferred. */
function ladderSelection(rates: DutyRate[]): { shown: DutyRate[]; hiddenRates: DutyRate[] } {
  const shown = rates.filter(
    (rate) => rate.applicable || rate.rate_kind === "basic" || rate.rate_kind === "wto",
  );
  const hiddenRates = rates
    .filter((rate) => !shown.includes(rate))
    .sort((left, right) => left.rate_pct - right.rate_pct);
  return { shown, hiddenRates };
}

function LadderOverflow({
  rates,
  appliedKind,
  appliedAgreement,
}: {
  rates: DutyRate[];
  appliedKind: string | null;
  appliedAgreement: string | null;
}) {
  if (!rates.length) return null;
  return (
    <details className="ladder-more" data-duty-ladder-more>
      <summary>{`요건 미충족 ${rates.length}건 보기`}</summary>
      <p className="cap">원산지·증명서 요건이 충족되면 적용 가능해지는 세율입니다. 세율 낮은 순입니다.</p>
      <RateLadderRows rates={rates} appliedKind={appliedKind} appliedAgreement={appliedAgreement} />
    </details>
  );
}

function RateLadder({ rates, appliedKind }: { rates: DutyRate[]; appliedKind: string | null }) {
  const { shown, hiddenRates } = ladderSelection(rates);
  return (
    <div className="ladder">
      <h3>이 코드의 세율 참조</h3>
      <RateLadderRows rates={shown} appliedKind={appliedKind} appliedAgreement={null} />
      <LadderOverflow rates={hiddenRates} appliedKind={appliedKind} appliedAgreement={null} />
    </div>
  );
}

const RATE_KIND_GROUPS: readonly { kind: DutyRate["rate_kind"]; label: string; open: boolean }[] = [
  { kind: "basic", label: "기본세율", open: true },
  { kind: "wto", label: "WTO 협정세율", open: true },
  { kind: "preferential", label: "특혜세율 (APTA·최빈개도국 등)", open: false },
  { kind: "conditional", label: "조건부 세율", open: false },
  { kind: "fta", label: "FTA 협정세율", open: false },
];

/** 세율 출처: one collapsed group per 세율 종류; the link text is the rate itself. */
function RateSourceGroups({ rates }: { rates: DutyRate[] }) {
  return (
    <div className="rate-source-groups" data-duty-sources>
      {RATE_KIND_GROUPS.map((group) => {
        const rows = rates.filter((rate) => rate.rate_kind === group.kind);
        if (!rows.length) return null;
        return (
          <details key={group.kind} className="rate-source-group" open={group.open} data-duty-source-group={group.kind}>
            <summary>{`${group.label} · ${rows.length}건`}</summary>
            <ul>
              {rows.map((rate) => {
                const href = safeExternalHref(rate.source_uri);
                const text = `${rate.label} ${rate.rate_pct}%`;
                return (
                  <li key={rate.code ?? `${rate.rate_kind}:${rate.agreement_code ?? "basic"}`}>
                    {href ? (
                      <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">
                        {`${text} ↗`}
                      </a>
                    ) : (
                      <span>{text}</span>
                    )}
                    {rate.applicable ? null : <small className="rate-source-group__flag">요건 미충족</small>}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

function RateLadderRows({
  rates,
  appliedKind,
  appliedAgreement,
}: {
  rates: DutyRate[];
  appliedKind: string | null;
  appliedAgreement: string | null;
}) {
  if (!rates.length) return null;
  const maxRate = Math.max(...rates.map((rate) => rate.rate_pct), 1);
  const lowest = Math.min(...rates.map((rate) => rate.rate_pct));
  const ordered = [...rates].sort((left, right) => left.rate_pct - right.rate_pct);
  return (
    <>
      {ordered.map((rate, index) => {
        const isApplied =
          appliedKind !== null &&
          rate.rate_kind === appliedKind &&
          (rate.rate_kind === "basic" || rate.agreement_code === appliedAgreement);
        const isBest = rate.rate_pct === lowest;
        return (
          <div
            className={`rate${isBest ? " best" : isApplied ? " applied" : ""}`}
            key={rate.code ?? `${rate.rate_kind}:${rate.agreement_code ?? "basic"}`}
            data-duty-rate={rate.agreement_code ?? rate.rate_kind}
          >
            <div className="nm">
              <span className="rk">{index + 1}</span>
              {rate.label}
            </div>
            <div className="track">
              <div className="fill" style={{ width: `${Math.max(6, Math.round((rate.rate_pct / maxRate) * 100))}%` }} />
            </div>
            <div className="pct">{rate.rate_pct}%</div>
            <span className="flag">
              {isApplied ? "현재 적용" : rate.applicable ? "적용 가능" : "요건 미충족"}
            </span>
          </div>
        );
      })}
    </>
  );
}
