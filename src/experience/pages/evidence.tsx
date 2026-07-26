import { useState } from "react";
import { useCaseWorkspace } from "../case-context";
import { Icon } from "../icons";

export function EvidencePage(): React.ReactElement {
  const { selectedRun } = useCaseWorkspace();
  const [technicalOpen, setTechnicalOpen] = useState(false);
  if (!selectedRun) return <NoRun />;
  const retrieval = selectedRun.evidence_retrieval;
  const provenance = selectedRun.evidence_provenance;
  return (
    <div className="page-stack" data-testid="evidence-page">
      <header className="subpage-heading">
        <div><p className="overline">법령 근거</p><h2>Agent가 실제 검색한 법령 근거와 의미를 확인합니다.</h2></div>
        <span>{selectedRun.evidence.length}개 근거</span>
      </header>
      <section className="rag-summary">
        <div className="rag-summary__mark"><Icon name="evidence" /></div>
        <div>
          <p className="overline">실제 3법령 RAG</p>
          <h3>{retrieval?.status === "ok" ? "법령 검색을 정상적으로 완료했습니다." : "법령 검색 결과에 추가 확인이 필요합니다."}</h3>
          <p>
            구조화 조회와 의미 검색, 키워드 검색, 법령 관계 확장 경로를 이용해
            현재 심사 품목과 관련된 근거를 찾았습니다.
          </p>
        </div>
        <dl>
          <div><dt>검색 상태</dt><dd>{retrieval?.status === "ok" ? "정상" : "확인 필요"}</dd></div>
          <div><dt>검색 범위</dt><dd>{retrieval?.coverage === "complete" ? "현재 제한 범위 완료" : "일부 또는 미확인"}</dd></div>
          <div><dt>요건 발견</dt><dd>{retrieval?.requirements_found === true ? "있음" : retrieval?.requirements_found === false ? "없음" : "확인 필요"}</dd></div>
        </dl>
      </section>
      <div className="evidence-layout">
        <section className="content-panel evidence-results">
          <div className="section-heading"><div><h3>검색된 법령 근거</h3><p>각 근거가 어떤 조문에서 왔는지 확인할 수 있습니다.</p></div></div>
          {selectedRun.evidence.length === 0 ? (
            <div className="empty-business-state"><Icon name="evidence" /><h3>표시할 법령 근거가 없습니다.</h3><p>검색 결과가 없거나 현재 제한 범위 밖일 수 있습니다.</p></div>
          ) : selectedRun.evidence.map((item, index) => {
            const ranked = provenance?.ranked_evidence.find((entry) => entry.evidence_id === item.evidence_id);
            return (
              <article
                key={item.evidence_id}
                id={`reference-${item.evidence_id}`}
                className="legal-evidence-card"
                tabIndex={-1}
              >
                <header><span>{index + 1}</span><div><small>{item.article ? `관련 조문 · ${item.article}` : "관련 법령"}</small><h4>{item.title}</h4></div></header>
                <blockquote>{item.excerpt}</blockquote>
                <div className="evidence-methods">
                  {ranked?.retrieval_methods.map((method) => <span key={method}>{methodLabel(method)}</span>)}
                </div>
                <a href={item.source_uri} target="_blank" rel="noreferrer">원문 출처 확인<span className="sr-only">: {item.title}</span></a>
              </article>
            );
          })}
        </section>
        <aside className="content-panel evidence-meaning">
          <h3>이 근거를 어떻게 읽어야 합니까?</h3>
          <p>
            검색된 조문은 Agent가 현재 심사 건을 검토할 때 참고한 근거입니다.
            근거가 검색됐다는 사실만으로 위반이나 승인이 확정되는 것은 아닙니다.
          </p>
          <ul>
            <li><strong>문서와 연결</strong><span>HSK, 거래 구분, 심사 기준일을 이용해 검색했습니다.</span></li>
            <li><strong>규정 요건 확인</strong><span>필요한 증명서나 제한 사항이 있는지 별도로 판별했습니다.</span></li>
            <li><strong>사람 검토</strong><span>현재는 3종 법령만 있으므로 담당자가 적용 범위를 다시 확인해야 합니다.</span></li>
          </ul>
          <div className="limited-coverage"><Icon name="warning" /><p><strong>제한된 검색 범위</strong>운영에 필요한 58종 전체 법령이 아니라 보존된 3종만 조회합니다.</p></div>
        </aside>
      </div>
      <details className="technical-run-details" onToggle={(event) => setTechnicalOpen(event.currentTarget.open)}>
        <summary>법령 검색 기술 정보</summary>
        {technicalOpen ? (
        <dl>
          <div><dt>검색 요청 식별자</dt><dd>{provenance?.request_id ?? "없음"}</dd></div>
          <div><dt>검색 의도</dt><dd>{provenance?.query_intent ?? "없음"}</dd></div>
          <div><dt>검색 결과 수</dt><dd>{retrieval?.result_count ?? 0}</dd></div>
          <div><dt>데이터 스냅샷</dt><dd>{selectedRun.release_identity?.evidence_snapshot_id ?? "없음"}</dd></div>
        </dl>
        ) : null}
      </details>
    </div>
  );
}

function NoRun(): React.ReactElement {
  return <div className="empty-business-state content-panel"><Icon name="evidence" /><h2>아직 확인할 법령 근거가 없습니다.</h2><p>심사를 실행하면 실제 검색 결과가 여기에 표시됩니다.</p></div>;
}

function methodLabel(method: string): string {
  const labels: Record<string, string> = {
    exact_hs: "품목번호 정확 조회",
    dense: "의미 유사도 검색",
    bm25: "키워드 검색",
    graph: "법령 관계 확장",
  };
  return labels[method] ?? "기타 검색 경로";
}
