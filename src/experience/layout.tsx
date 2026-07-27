import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { useWorkbench } from "./context";
import { Icon } from "./icons";
import {
  caseStatusLabels,
  formatKoreanDate,
  isLocalUatReference,
} from "./labels";

const roleLabels = {
  reviewer: "심사 담당자",
  approver: "승인 담당자",
  auditor: "감사 조회 담당자",
  admin: "관리자",
} as const;

export function ApplicationFrame({ children }: PropsWithChildren): React.ReactElement {
  const { cases, session, metadata, logout } = useWorkbench();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const technicalTriggerRef = useRef<HTMLButtonElement | null>(null);
  const technicalDrawerRef = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const selectedCaseId = caseIdFromPath(location.pathname);
  const selectedCase = cases.find((item) => item.case_id === selectedCaseId);

  useEffect(() => {
    if (!technicalOpen) return;
    const drawer = technicalDrawerRef.current;
    if (!drawer) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : technicalTriggerRef.current;
    const focusableSelector = [
      "button:not([disabled])",
      "a[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusable = (): HTMLElement[] => (
      [...drawer.querySelectorAll<HTMLElement>(focusableSelector)]
    );
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setTechnicalOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const targets = focusable();
      if (targets.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      const first = targets[0]!;
      const last = targets.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [technicalOpen]);

  if (!session) return <>{children}</>;
  return (
    <div className="commercial-app">
      <HashTargetFocus />
      <header className="commercial-topbar">
        <Link className="commercial-brand" to="/reviews" aria-label="통관 AI 사전심사 업무함">
          <span className="commercial-brand__mark">C</span>
          <span>
            <strong>통관 AI 사전심사</strong>
            <small>심사 담당자 작업대</small>
          </span>
        </Link>
        <div className="environment-summary" aria-label="현재 검증 환경">
          <span><Icon name="shield" />검증 환경</span>
          <span>실제 법령 3종</span>
          <span className="environment-summary__off">자동 처리 꺼짐</span>
        </div>
        <div className="commercial-user">
          <span>
            <strong>로그인 사용자</strong>
            <small>{session.roles.map((role) => roleLabels[role]).join(" · ")}</small>
          </span>
          <button className="icon-button" type="button" onClick={() => void logout()} aria-label="로그아웃">
            <Icon name="logout" />
          </button>
        </div>
        <button
          className="mobile-menu"
          type="button"
          aria-label={navigationOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={navigationOpen}
          onClick={() => setNavigationOpen((value) => !value)}
        >
          <Icon name={navigationOpen ? "close" : "menu"} />
        </button>
      </header>

      <aside className="uat-boundary" aria-label="내부 사용자 검증 범위">
        <strong>내부 사용자 검증용</strong>
        <span>텍스트 문서만 지원하며, 법적 통관 승인 결과가 아닙니다.</span>
        <button
          ref={technicalTriggerRef}
          type="button"
          className="uat-boundary__details"
          aria-expanded={technicalOpen}
          onClick={() => setTechnicalOpen((value) => !value)}
        >
          검증 정보 {technicalOpen ? "닫기" : "보기"}
        </button>
      </aside>
      {technicalOpen ? (
        <aside
          ref={technicalDrawerRef}
          className="technical-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="technical-drawer-title"
          data-testid="technical-drawer"
          tabIndex={-1}
        >
          <div className="technical-drawer__heading">
            <div>
              <p className="overline">검증 환경 상세</p>
              <h2 id="technical-drawer-title">이 실행 환경이 확인하는 범위</h2>
            </div>
            <button className="icon-button" type="button" aria-label="검증 정보 닫기" onClick={() => setTechnicalOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <dl className="technical-grid">
            <div><dt>실행 프로필</dt><dd>{metadata?.evidence_profile ?? "확인할 수 없음"}</dd></div>
            <div><dt>법령 검색 범위</dt><dd>{metadata?.evidence_scope ?? "확인할 수 없음"}</dd></div>
            <div><dt>데이터 원천</dt><dd>{metadata?.evidence_data_source ?? "확인할 수 없음"}</dd></div>
            <div><dt>정책 모드</dt><dd>{metadata?.evidence_policy_mode ?? "확인할 수 없음"}</dd></div>
            <div><dt>법령·조문</dt><dd>{metadata ? `${metadata.evidence_dataset.observed_law_count}종 · ${metadata.evidence_dataset.observed_article_count.toLocaleString()}개 조문` : "확인할 수 없음"}</dd></div>
            <div><dt>기준일</dt><dd>{metadata?.supported_review_as_of ?? "확인할 수 없음"}</dd></div>
            <div><dt>상세 AI 설명</dt><dd>{metadata?.enhanced_agent_experience ? "활성" : "비활성"}</dd></div>
            <div><dt>제한형 추가 조사</dt><dd>{metadata?.uat_adaptive_active ? "활성" : "비활성"}</dd></div>
            <div><dt>실행 단계 확인</dt><dd>{metadata?.actual_stage_streaming ? "활성" : "비활성"}</dd></div>
            {selectedCase && isLocalUatReference(selectedCase.external_reference) ? (
              <div>
                <dt>선택한 검증 시나리오 결박값</dt>
                <dd>{selectedCase.external_reference}</dd>
              </div>
            ) : null}
          </dl>
          <p className="technical-drawer__notice">
            이 정보는 구현·재현성 확인을 위한 기술 정보입니다. 현재 3종 법령 범위 밖의 법적 판단과 운영 자동 처리는 지원하지 않습니다.
          </p>
        </aside>
      ) : null}

      <div className="commercial-layout">
        <aside className={`commercial-sidebar${navigationOpen ? " is-open" : ""}`} aria-label="주요 메뉴">
          <nav className="primary-navigation">
            <NavLink to="/reviews" onClick={() => setNavigationOpen(false)}>
              <Icon name="home" /><span>심사 업무함</span>
            </NavLink>
            <NavLink to="/test-lab" onClick={() => setNavigationOpen(false)}>
              <Icon name="lab" /><span>시나리오 테스트</span>
            </NavLink>
          </nav>
          <div className="sidebar-section">
            <div className="sidebar-section__heading">
              <span>최근 심사 건</span>
              <Link to="/reviews" aria-label="심사 건 전체 보기">전체</Link>
            </div>
            <div className="recent-case-list">
              {cases.slice(0, 8).map((item) => (
                <button
                  key={item.case_id}
                  type="button"
                  className={`case-card${selectedCaseId === item.case_id ? " is-selected" : ""}`}
                  data-case-id={item.case_id}
                  data-case-external-reference={item.external_reference ?? ""}
                  onClick={() => {
                    setNavigationOpen(false);
                    navigate(`/cases/${encodeURIComponent(item.case_id)}/overview`);
                  }}
                >
                  <span className="case-dot" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{caseStatusLabels[item.status]} · {formatKoreanDate(item.updated_at)}</small>
                  </span>
                </button>
              ))}
              {cases.length === 0 ? <p className="sidebar-empty">등록된 심사 건이 없습니다.</p> : null}
            </div>
          </div>
          <div className="sidebar-safety">
            <Icon name="shield" />
            <p><strong>사람 검토 원칙</strong><span>Agent 결과는 담당자의 최종 확인을 거칩니다.</span></p>
          </div>
        </aside>
        <main id="main-content" className="commercial-main" tabIndex={-1}>
          {children}
        </main>
      </div>
      <span className="route-announcer" aria-live="polite">{routeTitle(location.pathname)}</span>
    </div>
  );
}

function caseIdFromPath(pathname: string): string | undefined {
  const encoded = /^\/cases\/([^/]+)(?:\/|$)/u.exec(pathname)?.[1];
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return undefined;
  }
}

function HashTargetFocus(): null {
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    let targetId: string;
    try {
      targetId = decodeURIComponent(location.hash.slice(1));
    } catch {
      return;
    }
    let stopped = false;
    let observer: MutationObserver | null = null;
    let settleTimeout: number | null = null;
    const focusTarget = (): boolean => {
      if (stopped) return false;
      const target = document.getElementById(targetId);
      if (!target) return false;
      if (settleTimeout !== null) window.clearTimeout(settleTimeout);
      settleTimeout = window.setTimeout(() => {
        if (stopped) return;
        const stableTarget = document.getElementById(targetId);
        if (!stableTarget) return;
        stableTarget.scrollIntoView({ block: "center", behavior: "auto" });
        stableTarget.focus({ preventScroll: true });
        observer?.disconnect();
      }, 50);
      return true;
    };
    observer = new MutationObserver(() => { focusTarget(); });
    observer.observe(document.getElementById("app") ?? document.body, {
      childList: true,
      subtree: true,
    });
    focusTarget();
    const timeout = window.setTimeout(() => observer?.disconnect(), 10_000);
    return () => {
      stopped = true;
      observer?.disconnect();
      if (settleTimeout !== null) window.clearTimeout(settleTimeout);
      window.clearTimeout(timeout);
    };
  }, [location.hash, location.pathname]);
  return null;
}

export function CaseNavigation({ caseId }: { caseId: string }): React.ReactElement {
  const encoded = encodeURIComponent(caseId);
  const items = [
    { path: "overview", label: "심사 요약", icon: "home" as const },
    { path: "documents", label: "등록 문서", icon: "documents" as const },
    { path: "evidence", label: "법령 근거", icon: "evidence" as const },
    { path: "assistant", label: "AI 심사 도우미", icon: "assistant" as const },
    { path: "review-actions", label: "담당자 검토", icon: "actions" as const },
    { path: "history", label: "심사 이력", icon: "history" as const },
  ];
  return (
    <nav className="case-navigation" aria-label="심사 건 메뉴">
      {items.map((item) => (
        <NavLink key={item.path} to={`/cases/${encoded}/${item.path}`}>
          <Icon name={item.icon} /><span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function routeTitle(pathname: string): string {
  if (pathname === "/reviews") return "심사 업무함";
  if (pathname === "/test-lab") return "시나리오 테스트";
  const leaf = pathname.split("/").at(-1);
  if (leaf === "documents") return "등록 문서";
  if (leaf === "evidence") return "법령 근거";
  if (leaf === "assistant") return "AI 심사 도우미";
  if (leaf === "review-actions") return "담당자 검토";
  if (leaf === "history") return "심사 이력";
  return "심사 요약";
}
