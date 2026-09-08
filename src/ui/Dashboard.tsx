import { useEffect, useRef, useState, type RefObject } from "react";
import type { CaseSummary } from "../api/v1/types";
import { CASE_FILTERS, type CaseFilter, type CaseSortKey } from "./constants";
import { display, formatDate } from "./labels";
import { DashStat, EmptyCopy, Field, RoleBoundaryNote, SectionHeading, Submit } from "./primitives";
import { useStore, useWorkbenchState } from "./useStore";

/** Display order of the status groups: judgement work first, finished work last. */
const GROUP_ORDER: readonly Exclude<CaseFilter, "all">[] = ["in_review", "open", "closed"];
const GROUP_HINTS: Readonly<Record<Exclude<CaseFilter, "all">, string>> = {
  in_review: "담당자 판단이 필요한 건",
  open: "심사를 아직 시작하지 않은 건",
  closed: "검토가 끝난 건 · 읽기 전용",
};

/** The four status cards double as the filter: one set of numbers, one control. */
const STAT_CARDS: readonly { id: CaseFilter; label: string; hint: string; tone?: string }[] = [
  { id: "all", label: "전체 Case", hint: "업무함에 등록된 전체 건" },
  { id: "open", label: "진행 전", hint: "심사를 아직 시작하지 않은 건", tone: "open" },
  { id: "in_review", label: "검토 중", hint: "담당자 판단이 필요한 건", tone: "review" },
  { id: "closed", label: "종료", hint: "검토가 끝난 건", tone: "done" },
];

/** An internal `case_…` id is never something a person should read as a reference. */
export function referenceLabel(item: Pick<CaseSummary, "external_reference">): string {
  return item.external_reference?.trim() ? item.external_reference : "미지정";
}

export function Dashboard() {
  const store = useStore();
  const state = useWorkbenchState();
  const counts = store.caseCounts();
  const searchRef = useRef<HTMLInputElement>(null);

  // The mockup's `/` shortcut. It stays out of the store because it only moves focus.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const typing = target instanceof HTMLElement &&
        (/^(input|textarea|select)$/iu.test(target.tagName) || target.isContentEditable);
      if (typing) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="dashboard">
      <div className="dash-head dash-head--compact">
        <p className="sub">
          {`등록된 Case ${state.cases.length}건 · 상태 카드를 누르면 목록이 그 상태로 좁혀지고, 행을 누르면 심사 워크스페이스로 이동합니다.`}
        </p>
        {store.hasRole("reviewer") ? (
          <button className="new-btn" type="button" onClick={() => store.setCreateCaseOpen(true)}>
            ＋ 새 Case 등록
          </button>
        ) : null}
      </div>

      <div className="dash-stats" role="group" aria-label="상태 필터">
        {STAT_CARDS.map((card) => (
          <DashStat
            key={card.id}
            label={card.label}
            value={counts[card.id]}
            hint={card.hint}
            {...(card.tone ? { tone: card.tone } : {})}
            filterId={card.id}
            active={state.caseFilter === card.id}
            onClick={() => store.setCaseFilter(card.id)}
          />
        ))}
      </div>

      <div className="dash-tools dash-tools--search-only">
        <div className="dash-search">
          <span className="dash-search__icon" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={searchRef}
            name="search"
            type="text"
            value={state.query}
            aria-label="Case 검색"
            placeholder="Case명 또는 참조번호 검색 ( / )"
            onChange={(event) => store.setQuery(event.target.value)}
          />
          {state.query ? (
            <button className="dash-search__clear" type="button" aria-label="검색어 지우기" onClick={() => store.setQuery("")}>
              ✕
            </button>
          ) : null}
        </div>
      </div>

      <section className="surface dash-table-panel">
        <SectionHeading
          title={state.caseFilter === "all" ? "Case 목록" : `Case 목록 · ${CASE_FILTERS.find((filter) => filter.id === state.caseFilter)?.label ?? ""}`}
          description={
            state.caseFilter === "all"
              ? "상태별로 묶어 표시합니다. 행을 누르면 해당 Case의 심사 워크스페이스로 이동합니다."
              : "행을 누르면 해당 Case의 심사 워크스페이스로 이동합니다."
          }
        />
        <CaseTable />
      </section>

      {!store.hasRole("reviewer") ? (
        <RoleBoundaryNote>
          승인자 역할은 Case를 읽고 정정 제안을 독립적으로 승인·반려할 수 있습니다. 새 Case 등록은 심사자 역할에서만 가능합니다.
        </RoleBoundaryNote>
      ) : null}
      {state.createCaseOpen ? <CreateCaseModal /> : null}
    </section>
  );
}

function CreateCaseModal() {
  const store = useStore();
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        store.setCreateCaseOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  return (
    <div
      className="modal-overlay on"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) store.setCreateCaseOpen(false);
      }}
    >
      <div className="modal modal--narrow" role="dialog" aria-modal="true" aria-label="새 Case 등록">
        <div className="modal-hd">
          <div className="mt">
            새 Case 등록
            <small>Case를 만들고 서류 등록 단계에서 원본 파일 또는 텍스트를 올립니다.</small>
          </div>
          <button className="x" type="button" aria-label="닫기" onClick={() => store.setCreateCaseOpen(false)}>
            ✕
          </button>
        </div>
        <div className="modal-bd modal-bd--block">
          <CreateCaseForm titleRef={titleRef} />
        </div>
      </div>
    </div>
  );
}

function CaseTable() {
  const store = useStore();
  const state = useWorkbenchState();
  const rows = store.visibleCases();
  const sortGlyph = (key: CaseSortKey) => (state.caseSort.key === key ? (state.caseSort.ascending ? "▲" : "▼") : "↕");
  const sortState = (key: CaseSortKey) =>
    state.caseSort.key === key ? { "aria-sort": (state.caseSort.ascending ? "ascending" : "descending") as "ascending" | "descending" } : {};
  // "전체" keeps every Case but shows them in status groups, so the judgement
  // backlog is visible at a glance instead of interleaved with closed work.
  const groups: { status: Exclude<CaseFilter, "all"> | null; rows: CaseSummary[] }[] =
    state.caseFilter === "all"
      ? GROUP_ORDER.map((status) => ({ status, rows: rows.filter((item) => item.status === status) })).filter((group) => group.rows.length)
      : [{ status: null, rows }];
  return (
    <div className="case-table" role="table" aria-label="Case 목록">
      <div className="case-table__header" role="row">
        <span role="columnheader">Case 제목</span>
        <button className="case-table__sort" type="button" role="columnheader" {...sortState("reference")} onClick={() => store.toggleCaseSort("reference")}>
          {`참조번호 ${sortGlyph("reference")}`}
        </button>
        <span role="columnheader">상태</span>
        <button className="case-table__sort" type="button" role="columnheader" {...sortState("updated")} onClick={() => store.toggleCaseSort("updated")}>
          {`최근 수정 ${sortGlyph("updated")}`}
        </button>
        <span aria-hidden="true" />
      </div>
      {groups.map((group) => (
        <div className="case-group" key={group.status ?? "filtered"} data-case-group={group.status ?? "filtered"}>
          {group.status ? (
            <div className={`case-group__head case-group__head--${group.status}`} role="rowgroup">
              <span className={`status-badge status-badge--${group.status}`}>{display(group.status)}</span>
              <span className="case-group__count">{`${group.rows.length}건`}</span>
              <span className="case-group__hint">{GROUP_HINTS[group.status]}</span>
            </div>
          ) : null}
          {group.rows.map((item) => (
            <CaseRow key={item.case_id} item={item} />
          ))}
        </div>
      ))}
      {rows.length === 0 ? (
        <EmptyCopy>
          {state.cases.length ? "조건에 맞는 Case가 없습니다." : "등록된 Case가 없습니다. 아래에서 새 Case를 만드십시오."}
        </EmptyCopy>
      ) : null}
    </div>
  );
}

function CaseRow({ item }: { item: CaseSummary }) {
  const store = useStore();
  const state = useWorkbenchState();
  const reference = referenceLabel(item);
  return (
    <div className="case-row-wrap" key={item.case_id}>
      <button
        className="case-row"
        type="button"
        role="row"
        disabled={state.busy}
        onClick={() => void store.openCase(item.case_id)}
      >
        <span className="case-row__title">{item.title}</span>
        <span className={`case-row__ref${reference === "미지정" ? " case-row__ref--none" : " mono"}`}>{reference}</span>
        <span>
          <span className={`status-badge status-badge--${item.status}`}>{display(item.status)}</span>
        </span>
        <span className="case-row__date">{formatDate(item.updated_at)}</span>
        <span className="case-row__go" aria-hidden="true">
          ›
        </span>
      </button>
      {store.hasRole("reviewer") ? (
        <button
          className="case-row__delete"
          type="button"
          title="Case 삭제"
          aria-label={`${item.title} 삭제`}
          disabled={state.busy}
          onClick={() => {
            if (window.confirm(`"${item.title}" Case를 삭제할까요?\n문서·업로드 파일·심사 기록이 함께 삭제되며 되돌릴 수 없습니다.`)) {
              void store.deleteCase(item.case_id);
            }
          }}
        >
          🗑
        </button>
      ) : null}
    </div>
  );
}

function CreateCaseForm({ titleRef }: { titleRef?: RefObject<HTMLInputElement | null> }) {
  const store = useStore();
  const state = useWorkbenchState();
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const ready = title.trim().length > 0;
  return (
    <form
      className="case-create-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        void store.createCase({ title: title.trim(), reference: reference.trim() }).then(() => {
          setTitle("");
          setReference("");
        });
      }}
    >
      <div className="form-grid">
        <Field label="Case 제목">
          <input
            ref={titleRef}
            name="title"
            type="text"
            required
            maxLength={200}
            placeholder="예: 8월 수입 신고 검토"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="업무 참조번호 (선택)">
          <input
            name="reference"
            type="text"
            maxLength={200}
            placeholder="예: 수입신고번호 12345-26-000001"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </Field>
      </div>
      <p className="form-hint">업무 참조번호는 수입신고번호·사내 관리번호처럼 업무에서 쓰는 번호입니다. 비우면 목록에 "미지정"으로 표시됩니다.</p>
      <Submit label="새 Case 만들기" disabled={state.busy || !ready} primary />
    </form>
  );
}
