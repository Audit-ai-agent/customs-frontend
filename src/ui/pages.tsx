import { useEffect, useRef, useState } from "react";
import type { HsReferenceSearch, HsReferenceSearchResult } from "../api/v1/types";
import { FLOW_MAP } from "./constants";
import { display, formatDate } from "./labels";
import { EmptyCopy, SectionHeading } from "./primitives";
import { useStore, useWorkbenchState } from "./useStore";

/* ── HSK 분류 참조 (#/reference/hsk) ─────────────────────────────
 * KRDS 검색 패턴: 하나의 검색창, 결과 목록, 선택 상세. 데이터는 전부
 * Backend의 패키징 참조표 검색 API에서 온다. */

export function HskReferencePage() {
  const store = useStore();
  const [text, setText] = useState("");
  const [view, setView] = useState<HsReferenceSearch | null>(null);
  const [selected, setSelected] = useState<HsReferenceSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2) {
      setView(null);
      setError(null);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      store
        .searchHskReference(query)
        .then((result) => {
          if (cancelled) return;
          setView(result);
          setError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setView(null);
          setError("HSK 참조표 검색에 실패했습니다. 잠시 후 다시 시도하십시오.");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, store]);

  const fullCodeMiss =
    view !== null && view.mode === "code_prefix" && view.results.length === 0 && /^[0-9]{10}$/u.test(view.query);

  return (
    <section className="page-grid" data-hsk-reference-page>
      <section className="surface">
        <SectionHeading
          title="HSK 분류 참조"
          description="관세청 HS부호 품목명 참조표를 코드 접두어 또는 품명으로 검색합니다. 숫자를 입력하면 코드로, 그 외에는 품명으로 찾습니다."
        />
        <div className="hsk-page-search">
          <label className="field">
            <span className="field__label">검색어 (HSK 코드 또는 품명)</span>
            <input
              ref={inputRef}
              name="hsk_page_query"
              type="text"
              autoComplete="off"
              maxLength={100}
              placeholder="예: 6109101000 · 티셔츠 · frozen mackerel"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setSelected(null);
              }}
            />
          </label>
          {searching ? <p className="form-hint">검색 중…</p> : null}
          {error !== null ? <p className="unsupported-inline">{error}</p> : null}
        </div>

        {view === null ? (
          <EmptyCopy>두 글자 이상 입력하면 참조표에서 즉시 검색합니다. 결과는 참조 정보이며 분류 확정은 Case 워크스페이스의 서류 등록 단계에서 기록합니다.</EmptyCopy>
        ) : (
          <>
            {view.mode === "name" && view.results.length > 0 ? (
              <p className="form-hint" data-hsk-page-caption>
                {view.partial
                  ? "검색어 전체와 일치하는 항목이 없어 일부 단어가 일치한 결과를 표시합니다."
                  : "품명 역검색 — 참조표 품목명과 대조한 결과입니다."}
              </p>
            ) : null}
            {view.results.length === 0 ? (
              <EmptyCopy>
                {fullCodeMiss
                  ? "이 코드는 관세청 HSK 참조표에 없습니다. 코드를 다시 확인하십시오."
                  : "일치하는 참조표 항목이 없습니다. 다른 단어나 코드 접두어로 검색해 보십시오."}
              </EmptyCopy>
            ) : (
              <div className="hsk" data-hsk-page-results>
                {view.results.map((entry) => (
                  <div
                    key={entry.code}
                    className={`cand${selected?.code === entry.code ? " pick" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(entry)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(entry);
                      }
                    }}
                  >
                    <div className="code">{entry.code}</div>
                    <div className="desc">
                      {entry.name_ko ?? entry.name_en ?? "품목명 정보 없음"}
                      <small>{entry.ancestors.map((item) => item.name_ko).join(" › ") || "분류 경로 없음"}</small>
                    </div>
                    <span className="pin">{selected?.code === entry.code ? "선택" : "상세"}</span>
                  </div>
                ))}
              </div>
            )}
            {view.truncated ? (
              <p className="form-hint">결과가 더 있습니다 — 검색어를 좁히면 나머지가 보입니다.</p>
            ) : null}
          </>
        )}
      </section>

      {selected !== null ? (
        <section className="surface" data-hsk-page-detail>
          <SectionHeading
            title={`${selected.code} 상세`}
            description={view ? `${view.reference.source} · ${view.reference.as_of} 기준` : ""}
          />
          <div className="sheet">
            <div className="sheet-body">
              <div className="row">
                <span className="k">한글 품목명</span>
                <span className="v">{selected.name_ko ?? "—"}</span>
              </div>
              <div className="row">
                <span className="k">영문 품목명</span>
                <span className="v">{selected.name_en ?? "—"}</span>
              </div>
              {selected.ancestors.map((ancestor) => (
                <div className="row" key={ancestor.code}>
                  <span className="k">{`${ancestor.level}단위 ${ancestor.code}`}</span>
                  <span className="v">{ancestor.name_ko}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="form-hint">
            이 화면은 참조 조회 전용입니다. 심사 건의 HSK 분류 확정은 해당 Case 워크스페이스의 서류 등록 단계에서 사유와 함께 기록합니다.
          </p>
        </section>
      ) : null}
    </section>
  );
}

/* ── 심사 기록 (#/records) ───────────────────────────────────────
 * KRDS 목록 탐색 패턴: 전체 Case의 심사 실행을 한 목록으로. */

export function RecordsPage() {
  const store = useStore();
  const state = useWorkbenchState();
  const records = state.records ?? [];

  return (
    <section className="page-grid" data-records-page>
      <section className="surface">
        <div className="dash-head">
          <SectionHeading
            title="전체 심사 기록"
            description="모든 Case의 AI 심사 실행 이력입니다. 행을 누르면 해당 Case의 통관 심사 화면으로 이동합니다."
          />
          <button
            className="btn"
            type="button"
            disabled={state.recordsLoading}
            onClick={() => void store.refreshRecords()}
          >
            {state.recordsLoading ? "불러오는 중…" : "새로 고침"}
          </button>
        </div>
        {state.recordsError !== null ? <p className="unsupported-inline">{state.recordsError}</p> : null}
        {state.recordsLoading && state.records === null ? (
          <EmptyCopy>심사 기록을 불러오는 중…</EmptyCopy>
        ) : records.length === 0 ? (
          <EmptyCopy>기록된 심사 실행이 없습니다. 심사 업무함에서 Case를 열어 AI 심사를 시작하십시오.</EmptyCopy>
        ) : (
          <div className="records-table" role="table" aria-label="전체 심사 기록">
            <div className="records-table__header" role="row">
              <span>실행일</span>
              <span>Case</span>
              <span>기준일</span>
              <span>판정</span>
              <span>확인 사항</span>
              <span aria-hidden="true" />
            </div>
            {records.map(({ caseSummary, run }) => (
              <button
                key={`${caseSummary.case_id}:${run.review_run_id}`}
                className="records-row"
                type="button"
                role="row"
                disabled={state.busy}
                onClick={() => void store.openCase(caseSummary.case_id, "review")}
              >
                <span className="records-row__date">{formatDate(run.created_at)}</span>
                <span className="records-row__case">
                  <span className="mono">{caseSummary.external_reference ?? caseSummary.case_id}</span>
                  <small>{caseSummary.title}</small>
                </span>
                <span className="records-row__date">{run.review_as_of}</span>
                <span>
                  <span className={`badge ${run.assessment === "no_issue_detected" ? "b-ok" : "b-bad"}`}>
                    {display(run.assessment)}
                  </span>
                </span>
                <span className="records-row__counts">{`${run.finding_count}건 · 판단 ${run.reviewer_decision_count}건`}</span>
                <span className="case-row__go" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="form-hint">
          모든 실행은 human_review_required로 기록되며 자동 종결되지 않습니다. Case 단위 상세(판단·정정 제안 이력)는 각 Case의 심사 이력 화면에서 확인합니다.
        </p>
      </section>
    </section>
  );
}

/* ── 운영 지표 (#/metrics) ───────────────────────────────────────
 * Backend 집계 계약이 없는 동안 근거 없는 수치를 만들지 않는다는 원칙에
 * 따라, 미지원 사유와 요구사항 위치를 안내한다. */

export function MetricsPage() {
  return (
    <section className="page-grid" data-metrics-page>
      <section className="surface">
        <SectionHeading
          title="운영 지표"
          description="기간별 처리 건수·판정 분포 같은 운영 지표 화면은 Backend 집계 계약이 준비되면 제공됩니다."
        />
        <p className="unsupported-stage__lead">
          근거 없는 수치를 화면에 만들지 않는다는 원칙에 따라, 집계 API가 없는 동안 지표를 표시하지 않습니다.
        </p>
        <ul className="unsupported-stage__list">
          <li>필요한 계약 — Case·심사 실행 집계 API: 기간별 처리 건수, 판정 분포, 확인 사항 처리율</li>
          <li>요구사항 기록 위치 — customs-backend/docs/FRONTEND_UX_BACKEND_GAP.ko.md</li>
          <li>지금 확인할 수 있는 수치 — 심사 업무함의 상태별 Case 카운트, 심사 기록의 실행 목록</li>
        </ul>
        <p className="unsupported-stage__note">
          이 페이지가 비어 있는 것은 오류가 아니라 설계입니다. 집계 계약이 병합되면 같은 주소에서 실제 수치가 열립니다.
        </p>
      </section>
    </section>
  );
}

/* ── 이용안내 (#/guide) ──────────────────────────────────────────
 * KRDS 도움말(Help) 글로벌 패턴: 서비스 소개, 절차, 역할, 단축키, 책임 고지. */

const GUIDE_SHORTCUTS: readonly { keys: string; action: string }[] = [
  { keys: "/", action: "심사 업무함에서 Case 검색창으로 포커스 이동" },
  { keys: "1 ~ 4", action: "Case 워크스페이스에서 해당 심사 단계로 바로 이동" },
  { keys: "← / →", action: "이전·다음 심사 단계로 이동" },
  { keys: "Esc", action: "원문 대조 모달·대화상자 닫기" },
];

export function GuidePage() {
  return (
    <section className="page-grid" data-guide-page>
      <section className="surface">
        <SectionHeading
          title="서비스 소개"
          description="수입 통관 서류의 AI 사전심사 업무 화면입니다."
        />
        <p className="guide-copy">
          Invoice·Packing List·B/L·원산지증명서 같은 통관 서류를 Case 단위로 등록하면, 제한형 AI Agent가 문서
          사실 추출 → 교차 검증 → 법령 근거 검색 → 근거 보고서 생성을 수행합니다. 모든 결과는{" "}
          <b>항상 담당자 검토 대상</b>이며 자동 승인 경로가 없습니다. 근거 없는 값은 화면에 만들지 않고, 데이터가
          부족하면 그 사실을 그대로 표시합니다.
        </p>
      </section>

      <section className="surface">
        <SectionHeading title="처리 절차" description="서류 등록에서 담당자 확정까지의 실제 파이프라인입니다." />
        <ol className="guide-steps">
          {FLOW_MAP.map((step) => (
            <li key={step.step}>
              <span className="guide-steps__n">{step.step}</span>
              <span className="guide-steps__tx">
                <strong>{step.label}</strong>
                <span>{step.hint}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="surface">
        <SectionHeading title="역할과 권한" description="심사자와 승인자는 서로 다른 책임을 가집니다." />
        <div className="sheet">
          <div className="sheet-body">
            <div className="row">
              <span className="k">심사자</span>
              <span className="v">Case 등록·삭제, 문서 등록, AI 심사 실행, 확인 사항 판단 기록, HSK 분류 확정, 심사 종료</span>
            </div>
            <div className="row">
              <span className="k">승인자</span>
              <span className="v">Case 열람, 정정 제안 승인·반려, 승인된 정정으로 재심사 실행. 자신이 올린 제안은 스스로 결정할 수 없습니다.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="surface">
        <SectionHeading title="키보드 단축키" description="입력창에 포커스가 없을 때 동작합니다." />
        <div className="sheet">
          <div className="sheet-body">
            {GUIDE_SHORTCUTS.map((shortcut) => (
              <div className="row" key={shortcut.keys}>
                <span className="k mono">{shortcut.keys}</span>
                <span className="v">{shortcut.action}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface">
        <SectionHeading title="책임 범위" description="이 화면이 하지 않는 것을 분명히 합니다." />
        <ul className="guide-list">
          <li>모든 결과는 담당자 검토 대상이며 통관 승인 판단이 아닙니다.</li>
          <li>세율·요건 표시는 명시된 기준일의 참조 스냅샷이며, 실제 적용 세율은 UNI-PASS에서 확인해야 합니다.</li>
          <li>원문은 수정되지 않습니다. 정정은 별도 제안·승인 절차를 거쳐 자식 심사 실행으로만 반영됩니다.</li>
          <li>화면에 비밀정보를 입력하지 마십시오. 세션과 토큰은 메모리에만 유지됩니다.</li>
        </ul>
      </section>
    </section>
  );
}
