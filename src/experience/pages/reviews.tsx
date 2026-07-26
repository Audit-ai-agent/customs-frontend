import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useWorkbench } from "../context";
import { Icon } from "../icons";
import { caseStatusLabels, formatKoreanDate } from "../labels";

export function ReviewsPage(): React.ReactElement {
  const { cases, api, refreshCases } = useWorkbench();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    if (!normalized) return cases;
    return cases.filter((item) => (
      item.title.toLocaleLowerCase("ko-KR").includes(normalized)
      || item.external_reference?.toLocaleLowerCase("ko-KR").includes(normalized)
    ));
  }, [cases, query]);

  const createCase = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const created = await api.createCase({
        title: String(form.get("title") ?? ""),
        external_reference: String(form.get("reference") ?? "") || null,
        assigned_reviewer_subjects: [],
        metadata: {},
      });
      await refreshCases();
      navigate(`/cases/${encodeURIComponent(created.case_id)}/documents`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "심사 건을 만들지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const counts = {
    all: cases.length,
    inReview: cases.filter((item) => item.status === "in_review").length,
    open: cases.filter((item) => item.status === "open").length,
  };

  return (
    <div className="page-stack" data-testid="reviews-inbox">
      <header className="page-heading">
        <div>
          <p className="overline">심사 업무함</p>
          <h1>처리할 심사 건을 확인합니다.</h1>
          <p>새 심사를 시작하거나 진행 중인 심사 결과와 담당자 조치를 이어서 확인할 수 있습니다.</p>
        </div>
        <button className="commercial-button commercial-button--primary" type="button" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" />새 심사 건
        </button>
      </header>

      <section className="metric-row" aria-label="심사 건 현황">
        <article><span>전체 심사 건</span><strong>{counts.all}</strong><small>현재 조직 기준</small></article>
        <article><span>심사 진행 중</span><strong>{counts.inReview}</strong><small>Agent 실행 또는 담당자 확인</small></article>
        <article><span>접수됨</span><strong>{counts.open}</strong><small>문서 등록·심사 시작 전</small></article>
      </section>

      <section className="content-panel">
        <div className="panel-toolbar">
          <div>
            <h2>심사 건 목록</h2>
            <p>최근 변경 순서로 표시합니다.</p>
          </div>
          <label className="search-control">
            <Icon name="search" />
            <span className="sr-only">심사 건 검색</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목 또는 업무 참조번호 검색"
            />
          </label>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-business-state">
            <Icon name="documents" />
            <h3>{cases.length === 0 ? "아직 등록된 심사 건이 없습니다." : "검색 결과가 없습니다."}</h3>
            <p>{cases.length === 0 ? "새 심사 건을 만들고 텍스트 문서를 등록해 시작합니다." : "다른 검색어를 입력해 보십시오."}</p>
          </div>
        ) : (
          <div className="case-table" aria-label="심사 건 목록">
            <div className="case-table__head" aria-hidden="true">
              <span>심사 건</span>
              <span>처리 상태</span>
              <span>최근 변경</span>
              <span><span className="sr-only">열기</span></span>
            </div>
            {filtered.map((item) => (
              <Link
                key={item.case_id}
                className="case-table__row"
                to={`/cases/${encodeURIComponent(item.case_id)}/overview`}
                data-testid="case-table-row"
                data-case-id={item.case_id}
                data-case-external-reference={item.external_reference ?? ""}
              >
                <span><strong>{item.title}</strong><small>{item.external_reference || "업무 참조번호 없음"}</small></span>
                <span><span className={`business-status business-status--${item.status}`}>{caseStatusLabels[item.status]}</span></span>
                <span>{formatKoreanDate(item.updated_at)}</span>
                <span><Icon name="arrow" /></span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {createOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCreateOpen(false);
        }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-case-title">
            <div className="modal-card__heading">
              <div><p className="overline">새 업무</p><h2 id="new-case-title">심사 건을 만듭니다.</h2></div>
              <button className="icon-button" type="button" aria-label="창 닫기" onClick={() => setCreateOpen(false)}><Icon name="close" /></button>
            </div>
            <form onSubmit={(event) => void createCase(event)}>
              <label><span>심사 건 제목</span><input name="title" required maxLength={200} placeholder="예: 냉동 고등어 수입 사전심사" /></label>
              <label><span>업무 참조번호 <small>선택</small></span><input name="reference" maxLength={200} placeholder="예: IMP-2026-071" /></label>
              {error ? <p className="form-alert" role="alert">{error}</p> : null}
              <div className="modal-actions">
                <button className="commercial-button commercial-button--secondary" type="button" onClick={() => setCreateOpen(false)}>취소</button>
                <button className="commercial-button commercial-button--primary" type="submit" disabled={submitting}>{submitting ? "생성 중" : "심사 건 생성"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
