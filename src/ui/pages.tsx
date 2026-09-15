import { useEffect, useRef, useState } from "react";
import type { CaseSummary, HsReferenceSearch, HsReferenceSearchResult, LawSearch, OperationsMetrics, ReviewRunSummary } from "../api/v1/types";
import { FLOW_MAP, STAGES, type CaseFilter } from "./constants";
import { referenceLabel } from "./Dashboard";
import { decisionReasonLabel, formatDate, formatDay, ruleTitle } from "./labels";
import { DashStat, DisabledReason, EmptyCopy, ExternalSourceLink, SectionHeading } from "./primitives";
import { CaseStateFlow, ReviewerWorkflowList } from "./StateFlow";
import { useStore, useWorkbenchState } from "./useStore";

/* ── 홈 (#/home) ─────────────────────────────────────────────────
 * KRDS 방문(visiting) 서비스 패턴: 서비스가 무엇인지, 지금 무엇을 하면
 * 되는지, 어디로 가면 되는지를 첫 화면에서 답한다. 수치는 전부 실데이터. */

/** The four status cards: on the home page they jump to the inbox filtered by that status. */
const HOME_STATS: readonly { id: CaseFilter; label: string; hint: string; tone?: string }[] = [
  { id: "all", label: "전체 Case", hint: "업무함에 등록된 전체 건" },
  { id: "open", label: "진행 전", hint: "심사를 아직 시작하지 않은 건", tone: "open" },
  { id: "in_review", label: "검토 중", hint: "담당자 판단이 필요한 건", tone: "review" },
  { id: "closed", label: "종료", hint: "검토가 끝난 건", tone: "done" },
];

const HOME_TODO_LIMIT = 5;

export function HomePage() {
  const store = useStore();
  const state = useWorkbenchState();
  const counts = store.caseCounts();
  const todo = [...state.cases]
    .filter((item) => item.status === "in_review")
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  const shown = todo.slice(0, HOME_TODO_LIMIT);
  const goToInbox = (filter: CaseFilter) => {
    store.setCaseFilter(filter);
    store.goToPage("cases");
  };
  return (
    <section className="page-grid" data-home-page>
      <section className="surface">
        <SectionHeading
          title="심사 현황"
          description={`등록된 Case ${state.cases.length}건의 상태별 현황입니다. 카드를 누르면 그 상태의 목록으로 이동합니다.`}
        />
        <div className="dash-stats" role="group" aria-label="상태별 Case 수">
          {HOME_STATS.map((card) => (
            <DashStat
              key={card.id}
              label={card.label}
              value={counts[card.id]}
              hint={card.hint}
              {...(card.tone ? { tone: card.tone } : {})}
              filterId={card.id}
              onClick={() => goToInbox(card.id)}
            />
          ))}
        </div>
      </section>

      <section className="surface" data-home-todo>
        <div className="dash-head dash-head--compact">
          <SectionHeading
            title="내가 처리할 건"
            description={
              todo.length
                ? `담당자 판단이 필요한 검토 중 건 ${todo.length}건 중 최근 수정된 ${shown.length}건입니다. 행을 누르면 통관 심사 단계로 이동합니다.`
                : "담당자 판단이 필요한 검토 중 건이 없습니다."
            }
          />
          {todo.length > shown.length ? (
            <button className="btn" type="button" onClick={() => goToInbox("in_review")}>
              {`검토 중 ${todo.length}건 전체 보기`}
            </button>
          ) : null}
        </div>
        {shown.length === 0 ? (
          <EmptyCopy>지금 판단을 기다리는 건이 없습니다. 새 Case는 심사 업무함에서 등록합니다.</EmptyCopy>
        ) : (
          <div className="home-todo" role="list">
            {shown.map((item) => (
              <button
                key={item.case_id}
                type="button"
                role="listitem"
                className="home-todo__row"
                disabled={state.busy}
                onClick={() => void store.openCase(item.case_id, "review")}
              >
                <span className="home-todo__title">{item.title}</span>
                <span className="home-todo__ref">{referenceLabel(item)}</span>
                <span className="home-todo__date">{formatDate(item.updated_at)}</span>
                <span className="case-row__go" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="surface">
        <SectionHeading title="처리 절차" description="Case 워크스페이스의 네 단계와 같습니다. 모든 결과는 담당자 검토를 거칩니다." />
        <ol className="guide-steps">
          {STAGES.map((stage) => (
            <li key={stage.id}>
              <span className="guide-steps__n">{stage.step}</span>
              <span className="guide-steps__tx">
                <strong>{stage.label}</strong>
                <span>{stage.hint}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

/* ── 법령 조회 (#/reference/laws) ────────────────────────────────
 * Browser는 법령 데이터베이스에 직접 접근하지 않는다. 이 화면은 각 Case
 * 최신 심사 실행이 실제 인용한 법령 Evidence를 모은 것이고, 원문 전체
 * 검색은 공식 출처 링크로 안내한다. */

const OFFICIAL_LAW_SOURCES: readonly { name: string; copy: string; uri: string }[] = [
  { name: "국가법령정보센터", copy: "대한민국 법령 원문 전체 검색", uri: "https://www.law.go.kr" },
  { name: "관세청 UNI-PASS", copy: "실제 적용 세율·수입 요건 확인", uri: "https://unipass.customs.go.kr/clip/index.do" },
  { name: "관세청 FTA 포털", copy: "협정별 원산지 기준·증명 서식", uri: "https://www.customs.go.kr/ftaportalkor/main.do" },
];

/** Long article bodies start clamped to two lines; the reader opens the ones they need. */
function LawArticleText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 140;
  return (
    <div className="law-item__body">
      <p className={`law-item__text${long && !expanded ? " law-item__text--clamp" : ""}`}>{text}</p>
      {long ? (
        <button className="text-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? "접기" : "더 보기"}
        </button>
      ) : null}
    </div>
  );
}

/** Real free-text statute search over the loaded Data law store. */
function LawSearchSection() {
  const store = useStore();
  const state = useWorkbenchState();
  const [text, setText] = useState("");
  const [view, setView] = useState<LawSearch | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalog = state.lawCatalog;

  const runSearch = () => {
    const query = text.trim();
    if (query.length < 2 || searching) return;
    setSearching(true);
    setError(null);
    store
      .searchLaws(query)
      .then((result) => setView(result))
      .catch(() => setError("법령 검색에 실패했습니다. 잠시 후 다시 시도하십시오."))
      .finally(() => setSearching(false));
  };

  return (
    <section className="surface" data-law-search>
      <SectionHeading
        title="법령 원문 검색"
        description={
          catalog
            ? `적재된 법령 저장소 ${catalog.laws.length}개 법령의 조문을 원문 그대로 검색합니다 (${catalog.as_of} 기준 유효 조문).`
            : "적재된 법령 저장소의 조문을 원문 그대로 검색합니다."
        }
      />
      <form
        className="law-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <label className="field law-search-form__field">
          <span className="field__label">검색어</span>
          <input
            name="law_search_query"
            type="text"
            autoComplete="off"
            maxLength={200}
            placeholder="예: 원산지증명서 제출 · 통관 보류 · 수입신고 서류"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <button className="btn primary" type="submit" disabled={searching || text.trim().length < 2}>
          {searching ? "검색 중…" : "법령 검색"}
        </button>
      </form>
      {text.trim().length < 2 ? <DisabledReason>검색어를 두 글자 이상 입력하면 검색 버튼이 활성화됩니다.</DisabledReason> : null}
      {error !== null ? <p className="unsupported-inline">{error}</p> : null}
      {view !== null ? (
        view.results.length === 0 ? (
          <EmptyCopy>{`"${view.query}"와 일치하는 조문을 찾지 못했습니다. 다른 단어로 검색해 보십시오.`}</EmptyCopy>
        ) : (
          <div className="law-group" data-law-search-results>
            <h3 className="law-group__name">{`"${view.query}" 검색 결과 ${view.results.length}건`}</h3>
            {view.results.map((result) => (
              <article className="law-item" key={`${result.law_id ?? result.law_name}:${result.title}`}>
                <div className="law-item__head">
                  <strong>{result.title}</strong>
                  <ExternalSourceLink uri={result.source_uri} />
                </div>
                <LawArticleText text={result.text} />
                <p className="law-item__cites">
                  {`${result.law_name}${result.valid_from ? ` · 시행 ${result.valid_from}` : ""}${result.valid_to ? ` ~ ${result.valid_to}` : " ~ 현재"} · 관련도 ${result.score.toFixed(2)}`}
                </p>
              </article>
            ))}
          </div>
        )
      ) : null}
      {catalog !== null ? (
        <details className="law-catalog" data-law-catalog>
          <summary>{`검색 가능한 법령 ${catalog.laws.length}개 전체 보기`}</summary>
          <div className="law-catalog__grid">
            {catalog.laws.map((law) => (
              <span className="law-catalog__entry" key={law.law_id}>
                {law.law_name}
                <small>{`${law.hierarchy ? `${law.hierarchy} · ` : ""}${law.article_count.toLocaleString("en-US")}개 조문`}</small>
              </span>
            ))}
          </div>
        </details>
      ) : state.lawCatalogError !== null ? (
        <p className="unsupported-inline">{state.lawCatalogError}</p>
      ) : null}
    </section>
  );
}

export function LawsPage() {
  const store = useStore();
  const state = useWorkbenchState();
  const [keyword, setKeyword] = useState("");
  const entries = state.laws ?? [];
  const lowered = keyword.trim().toLocaleLowerCase();
  const visible = lowered
    ? entries.filter((entry) =>
      `${entry.law_name ?? ""} ${entry.title} ${entry.text}`.toLocaleLowerCase().includes(lowered),
    )
    : entries;
  const groups = new Map<string, typeof visible>();
  for (const entry of visible) {
    const groupName = entry.law_name ?? "기타 출처";
    groups.set(groupName, [...(groups.get(groupName) ?? []), entry]);
  }

  return (
    <section className="page-grid" data-laws-page>
      <LawSearchSection />
      <section className="surface">
        <div className="dash-head">
          <SectionHeading
            title="심사에 인용된 법령 근거"
            description="각 Case의 최신 심사 실행이 실제 인용한 법령 조문입니다. 근거 없는 법령 목록은 만들지 않습니다."
          />
          <button className="btn" type="button" disabled={state.lawsLoading} onClick={() => void store.refreshLaws()}>
            {state.lawsLoading ? "불러오는 중…" : "새로 고침"}
          </button>
        </div>
        {state.lawsError !== null ? <p className="unsupported-inline">{state.lawsError}</p> : null}
        {state.lawsLoading && state.laws === null ? (
          <EmptyCopy>인용 법령을 불러오는 중…</EmptyCopy>
        ) : entries.length === 0 ? (
          <EmptyCopy>아직 인용된 법령이 없습니다. AI 심사를 실행하면 판단에 사용된 조문이 여기에 모입니다.</EmptyCopy>
        ) : (
          <>
            <div className="hsk-page-search">
              <label className="field">
                <span className="field__label">인용 법령 검색</span>
                <input
                  name="law_query"
                  type="text"
                  autoComplete="off"
                  maxLength={100}
                  placeholder="예: 관세법 · 안전확인 · 226조"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </label>
            </div>
            {visible.length === 0 ? (
              <EmptyCopy>검색어와 일치하는 인용 법령이 없습니다.</EmptyCopy>
            ) : (
              [...groups.entries()].map(([groupName, groupEntries]) => (
                <div className="law-group" key={groupName}>
                  <h3 className="law-group__name">{groupName}</h3>
                  {groupEntries.map((entry) => (
                    <article className="law-item" key={`${entry.source_hash}:${entry.title}`}>
                      <div className="law-item__head">
                        <strong>{entry.title}</strong>
                        <ExternalSourceLink uri={entry.source_uri} />
                      </div>
                      <LawArticleText text={entry.text} />
                      <p className="law-item__cites">
                        {`인용 Case: ${entry.citedIn.map((cited) => cited.title).join(", ")}`}
                      </p>
                    </article>
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </section>

      <section className="surface">
        <SectionHeading title="공식 출처 바로가기" description="법령 원문 전체 검색과 실제 적용 기준은 공식 출처에서 확인하십시오." />
        <div className="home-cards">
          {OFFICIAL_LAW_SOURCES.map((source) => (
            <a key={source.name} className="home-card" href={source.uri} target="_blank" rel="noreferrer noopener">
              <strong>{source.name}</strong>
              <span>{source.copy}</span>
              <span className="home-card__go" aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </div>
      </section>
    </section>
  );
}

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
            {view.results.length > 0 ? (
              <p className="form-hint" data-hsk-page-count>
                {view.truncated
                  ? `결과 ${view.results.length}건 표시 · 결과가 더 있습니다. 검색어를 좁히면 나머지가 보입니다.`
                  : `결과 ${view.results.length}건`}
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
            이 화면은 참조 조회 전용입니다. 심사 건의 HSK 분류 확정은 해당 Case 워크스페이스의 서류 등록 단계에서 후보를 골라 한 번에 기록합니다.
          </p>
        </section>
      ) : null}
    </section>
  );
}

/* ── 심사 기록 (#/records) ───────────────────────────────────────
 * KRDS 목록 탐색 패턴: 전체 Case의 심사 실행을 한 목록으로. */

/**
 * The verdict cell is a count, not a red badge: "확인 N건 · 판단 M건" with a
 * dot that is amber while judgements are outstanding and green once every
 * finding has one (or there was nothing to judge).
 */
function RecordVerdict({ run }: { run: ReviewRunSummary }) {
  const open = Math.max(0, run.finding_count - run.reviewer_decision_count);
  const tone = run.execution_status === "failed" ? "failed" : open > 0 ? "pending" : "settled";
  const label = run.execution_status === "failed"
    ? "실행 실패"
    : run.finding_count === 0
      ? "확인 사항 없음"
      : `확인 ${run.finding_count}건 · 판단 ${run.reviewer_decision_count}건`;
  return (
    <span className={`records-row__verdict records-row__verdict--${tone}`} data-record-verdict={tone}>
      <span className="records-row__dot" aria-hidden="true" />
      <span>{label}</span>
      {open > 0 ? <small>{`미판단 ${open}건`}</small> : null}
    </span>
  );
}

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
              <span>확인 사항 · 판단</span>
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
                  <span className="records-row__title">{caseSummary.title}</span>
                  <small>{`참조번호 ${referenceLabel(caseSummary)}`}</small>
                </span>
                <span className="records-row__date">{formatDay(run.review_as_of)}</span>
                <RecordVerdict run={run} />
                <span className="case-row__go" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="form-hint">
          모든 실행은 담당자 검토 대상으로 기록되며 자동 종결되지 않습니다. Case 단위 상세(판단·정정 제안 이력)는 각 Case의 심사 이력 화면에서 확인합니다.
        </p>
      </section>
    </section>
  );
}

/* ── 운영 지표 (#/metrics) ───────────────────────────────────────
 * 모든 수치는 Backend가 저장된 Case·심사 실행에서 그대로 센 값이다
 * (GET /operations-metrics). 추정·샘플링 없음. 시각 문법: 단일 색조
 * 막대(크기 비교), 상태·범례는 색이 아니라 텍스트 라벨이 식별한다. */

/** Rule codes without a Korean title still get a distinct label instead of seven identical generic ones. */
function ruleChartLabel(code: string): string {
  const title = ruleTitle(code);
  return title === "담당자 확인 사항" ? `${title} (${code.replace(/_/gu, " ")})` : title;
}

function MetricBarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(value > 0 ? 3 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mbar">
      <span className="mbar__label">{label}</span>
      <span className="mbar__track">
        <span className="mbar__fill" style={{ width: `${width}%` }} />
      </span>
      <span className="mbar__value mono">{value.toLocaleString("en-US")}</span>
    </div>
  );
}

export function MetricsPage() {
  const store = useStore();
  const state = useWorkbenchState();
  const metrics = state.metrics;

  if (state.metricsError !== null && metrics === null) {
    return (
      <section className="page-grid" data-metrics-page>
        <section className="surface">
          <SectionHeading title="운영 지표" description="저장된 Case·심사 실행을 서버가 집계한 수치입니다." />
          <p className="unsupported-inline">{state.metricsError}</p>
          <button className="btn" type="button" onClick={() => void store.refreshMetrics()}>다시 시도</button>
        </section>
      </section>
    );
  }
  if (metrics === null) {
    return (
      <section className="page-grid" data-metrics-page>
        <section className="surface">
          <SectionHeading title="운영 지표" description="저장된 Case·심사 실행을 서버가 집계한 수치입니다." />
          <EmptyCopy>운영 지표를 불러오는 중…</EmptyCopy>
        </section>
      </section>
    );
  }

  const assessmentMax = Math.max(
    metrics.reviews.issues_detected,
    metrics.reviews.no_issue_detected,
    metrics.reviews.indeterminate,
  );
  const decidedShare =
    metrics.findings.total > 0 ? Math.round((metrics.findings.decided / metrics.findings.total) * 100) : null;
  const dailyMax = Math.max(...metrics.daily_reviews.map((entry) => entry.count), 1);
  const firstDay = metrics.daily_reviews[0]?.date ?? "";
  const lastDay = metrics.daily_reviews[metrics.daily_reviews.length - 1]?.date ?? "";
  const asMonthDay = (value: string) => value.slice(5).replace("-", ".");

  return (
    <section className="page-grid" data-metrics-page>
      <section className="surface">
        <div className="dash-head">
          <SectionHeading
            title="Case 현황"
            description={`저장된 Case·심사 실행을 서버가 그대로 센 값입니다 (${formatDate(metrics.generated_at)} 기준). 추정치 없음.`}
          />
          <button className="btn" type="button" disabled={state.metricsLoading} onClick={() => void store.refreshMetrics()}>
            {state.metricsLoading ? "불러오는 중…" : "새로 고침"}
          </button>
        </div>
        {state.metricsError !== null ? <p className="unsupported-inline">{state.metricsError}</p> : null}
        <div className="dash-stats">
          <DashStat label="전체 Case" value={metrics.cases.total} hint="업무함에 등록된 전체 건" />
          <DashStat label="진행 전" value={metrics.cases.open} hint="심사를 아직 시작하지 않은 건" tone="open" />
          <DashStat label="검토 중" value={metrics.cases.in_review} hint="담당자 판단이 필요한 건" tone="review" />
          <DashStat label="종료" value={metrics.cases.closed} hint="검토가 끝난 건" tone="done" />
        </div>
      </section>

      <section className="surface">
        <SectionHeading
          title="심사 실행"
          description={`AI 심사 실행 ${metrics.reviews.total.toLocaleString("en-US")}건 (이 중 정정 반영 재심사 ${metrics.reviews.revisions}건) · 실행 상태 — 성공 ${metrics.reviews.succeeded} · 부분 ${metrics.reviews.partial} · 실패 ${metrics.reviews.failed}`}
        />
        {metrics.reviews.total === 0 ? (
          <EmptyCopy>기록된 심사 실행이 없습니다. 심사 업무함에서 AI 심사를 시작하면 여기 집계됩니다.</EmptyCopy>
        ) : (
          <div className="mbar-list" aria-label="판정 분포">
            <MetricBarRow label="확인 사항 있음" value={metrics.reviews.issues_detected} max={assessmentMax} />
            <MetricBarRow label="주요 이슈 없음" value={metrics.reviews.no_issue_detected} max={assessmentMax} />
            <MetricBarRow label="판단 보류" value={metrics.reviews.indeterminate} max={assessmentMax} />
          </div>
        )}
      </section>

      <section className="surface">
        <SectionHeading
          title="확인 사항 처리"
          description="각 Case의 최신 심사 실행에 남아 있는 확인 사항 기준입니다. 지난 실행의 확인 사항은 재심사로 대체되어 세지 않습니다."
        />
        {decidedShare === null ? (
          <EmptyCopy>판단 대상 확인 사항이 없습니다.</EmptyCopy>
        ) : (
          <div className="mmeter">
            <div className="mmeter__row">
              <strong className="mono">{`${decidedShare}%`}</strong>
              <span>
                {`판단 기록 완료 — 전체 ${metrics.findings.total}건 중 ${metrics.findings.decided}건 기록, `}
                <b>{`미판단 ${metrics.findings.open}건`}</b>
              </span>
            </div>
            <div className="mmeter__track">
              <div className="mmeter__fill" style={{ width: `${decidedShare}%` }} />
            </div>
          </div>
        )}
        <div className="form-hint" data-metrics-closures>
          {`심사 종료 처리 — 검토 종결 ${metrics.closures.cleared}건 · 반려·보완 요청 ${metrics.closures.returned}건`}
        </div>
      </section>

      <ReviewLoadSection load={metrics.review_load} />

      <section className="surface">
        <SectionHeading title="최근 14일 심사 실행" description="하루 단위 실행 건수입니다. 빈 날도 0으로 표시합니다." />
        <div className="mcols" role="img" aria-label={`최근 14일 심사 실행, 최대 하루 ${dailyMax}건`}>
          {metrics.daily_reviews.map((entry) => (
            <div className="mcols__col" key={entry.date} title={`${entry.date} · 실행 ${entry.count}건`}>
              {entry.count > 0 ? <span className="mcols__value mono">{entry.count}</span> : null}
              <span
                className={`mcols__bar${entry.count === 0 ? " mcols__bar--zero" : ""}`}
                style={{ height: `${Math.max(2, Math.round((entry.count / dailyMax) * 64))}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mcols__axis">
          <span>{asMonthDay(firstDay)}</span>
          <span>{asMonthDay(lastDay)}</span>
        </div>
      </section>
    </section>
  );
}

/**
 * Where the judgement work comes from. This is the measurement behind the
 * roadmap for shrinking 검토 중: which rules raise findings most often, how
 * the automatic comparisons split, and which coded rationale reviewers pick.
 * A rule whose findings are mostly closed as "표기 차이" is a candidate for a
 * tighter comparison rule, not for automatic closure.
 */
function ReviewLoadSection({ load }: { load: OperationsMetrics["review_load"] }) {
  const judged = load.cases_with_findings + load.cases_without_findings;
  const findingShare = judged > 0 ? Math.round((load.cases_with_findings / judged) * 100) : null;
  const comparisonMax = Math.max(load.comparisons.passed, load.comparisons.mismatch, load.comparisons.needs_review, load.comparisons.skipped, 1);
  const codeMax = Math.max(...load.findings_by_code.map((item) => item.count), 1);
  const reasonMax = Math.max(...load.decision_reason_codes.map((item) => item.count), 1);
  const reasonLabel = (code: string) => (code === "uncoded" ? "사유 코드 없음 (자유 기재)" : decisionReasonLabel(code as never) ?? code);
  return (
    <section className="surface" data-metrics-review-load>
      <SectionHeading
        title="검토 부담 분석"
        description="각 Case의 최신 심사 실행 기준으로, 담당자 판단이 어디에서 생기는지 셉니다. 검토 중 건을 줄이려면 이 분포에서 자주 뜨는 규칙부터 손봅니다."
      />
      {judged === 0 ? (
        <EmptyCopy>아직 집계할 심사 실행이 없습니다.</EmptyCopy>
      ) : (
        <div className="review-load">
          <div className="mmeter">
            <div className="mmeter__row">
              <strong className="mono">{findingShare === null ? "–" : `${findingShare}%`}</strong>
              <span>
                {`확인 사항이 1건 이상 남은 Case 비율 — ${judged}건 중 ${load.cases_with_findings}건, `}
                <b>{`확인 사항 없음 ${load.cases_without_findings}건`}</b>
              </span>
            </div>
            <div className="mmeter__track">
              <div className="mmeter__fill" style={{ width: `${findingShare ?? 0}%` }} />
            </div>
          </div>

          <div className="review-load__grid">
            <div>
              <h3 className="review-load__title">{`자동 비교 결과 · ${load.comparisons.total}건`}</h3>
              <div className="mbar-list" aria-label="자동 비교 결과 분포">
                <MetricBarRow label="일치" value={load.comparisons.passed} max={comparisonMax} />
                <MetricBarRow label="불일치" value={load.comparisons.mismatch} max={comparisonMax} />
                <MetricBarRow label="검토 필요" value={load.comparisons.needs_review} max={comparisonMax} />
                <MetricBarRow label="비교 제외" value={load.comparisons.skipped} max={comparisonMax} />
              </div>
            </div>
            <div>
              <h3 className="review-load__title">확인 사항이 많이 뜨는 규칙</h3>
              {load.findings_by_code.length === 0 ? (
                <EmptyCopy>남은 확인 사항이 없습니다.</EmptyCopy>
              ) : (
                <div className="mbar-list" aria-label="규칙별 확인 사항 건수">
                  {load.findings_by_code.slice(0, 8).map((item) => (
                    <MetricBarRow key={item.code} label={ruleChartLabel(item.code)} value={item.count} max={codeMax} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="review-load__title">담당자 판단 사유 분포</h3>
              {load.decision_reason_codes.length === 0 ? (
                <EmptyCopy>기록된 판단이 없습니다.</EmptyCopy>
              ) : (
                <div className="mbar-list" aria-label="판단 사유 분포">
                  {load.decision_reason_codes.map((item) => (
                    <MetricBarRow key={item.code} label={reasonLabel(item.code)} value={item.count} max={reasonMax} />
                  ))}
                </div>
              )}
              <p className="form-hint">
                {`판단 상태 — 확인함 ${load.decision_statuses.confirmed} · 추가자료 요청 ${load.decision_statuses.needs_information} · 해결됨 ${load.decision_statuses.resolved}`}
              </p>
            </div>
          </div>
        </div>
      )}
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
        <SectionHeading title="Case 상태 흐름" description="Case는 세 가지 상태만 가지며, 종료는 담당자가 직접 기록할 때만 일어납니다." />
        <CaseStateFlow />
      </section>

      <section className="surface">
        <SectionHeading title="담당자 업무 순서" description="한 Case를 등록부터 종료까지 처리하는 순서와 각 단계의 결과입니다." />
        <ReviewerWorkflowList />
      </section>

      <section className="surface surface--secondary">
        <SectionHeading
          title="AI가 내부적으로 수행하는 단계"
          description="심사 시작 버튼 뒤에서 Agent가 실행하는 내부 파이프라인입니다. 담당자가 보는 화면 단계는 위 업무 순서와 워크스페이스의 4단계입니다."
        />
        <ol className="guide-steps guide-steps--secondary">
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
        <div className="sheet sheet--text">
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
        <div className="sheet sheet--text">
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
