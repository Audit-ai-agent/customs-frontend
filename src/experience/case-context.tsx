import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Outlet, useParams, useSearchParams } from "react-router";
import type {
  AuditEvent,
  CaseDetail,
  ReviewRun,
  RunSummary,
} from "../api/v1/types";
import type { ReviewExperienceEnvelope } from "../api/v2/types";
import { useWorkbench } from "./context";
import { CaseNavigation } from "./layout";
import { caseStatusLabels, formatKoreanDate } from "./labels";

interface CaseContextValue {
  caseDetail: CaseDetail;
  runs: RunSummary[];
  selectedRun: ReviewRun | null;
  experience: ReviewExperienceEnvelope | null;
  audits: AuditEvent[];
  loadingRun: boolean;
  experienceError: string | null;
  refresh(): Promise<void>;
  selectRun(runId: string): void;
}

const CaseContext = createContext<CaseContextValue | null>(null);

export function CaseWorkspace(): React.ReactElement {
  const { caseId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { api, experienceApi } = useWorkbench();
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<ReviewRun | null>(null);
  const [experience, setExperience] = useState<ReviewExperienceEnvelope | null>(null);
  const [audits, setAudits] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRun, setLoadingRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [experienceError, setExperienceError] = useState<string | null>(null);

  const requestedRunId = searchParams.get("run");

  const loadCase = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [nextCase, nextRuns, nextAudits] = await Promise.all([
        api.getCase(caseId),
        api.listReviewRuns(caseId),
        api.getAuditEvents(caseId),
      ]);
      setCaseDetail(nextCase);
      setRuns(nextRuns);
      setAudits(nextAudits);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "심사 건을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [api, caseId]);

  useEffect(() => { void loadCase(); }, [loadCase]);

  useEffect(() => {
    const runId = requestedRunId ?? runs[0]?.review_run_id;
    if (!runId) {
      setSelectedRun(null);
      setExperience(null);
      return;
    }
    let active = true;
    setLoadingRun(true);
    setExperienceError(null);
    Promise.all([
      api.getReviewRun(runId),
      experienceApi.getReviewExperience(runId).catch((reason: unknown) => {
        if (active) {
          setExperienceError(reason instanceof Error ? reason.message : "사용자용 설명을 불러오지 못했습니다.");
        }
        return null;
      }),
    ]).then(([run, envelope]) => {
      if (!active) return;
      setSelectedRun(run);
      setExperience(envelope);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "심사 결과를 불러오지 못했습니다.");
    }).finally(() => {
      if (active) setLoadingRun(false);
    });
    return () => { active = false; };
  }, [api, experienceApi, requestedRunId, runs]);

  const value = useMemo<CaseContextValue | null>(() => caseDetail ? ({
    caseDetail,
    runs,
    selectedRun,
    experience,
    audits,
    loadingRun,
    experienceError,
    refresh: loadCase,
    selectRun: (runId) => {
      const next = new URLSearchParams(searchParams);
      next.set("run", runId);
      setSearchParams(next);
    },
  }) : null, [
    caseDetail, runs, selectedRun, experience, audits, loadingRun,
    experienceError, loadCase, searchParams, setSearchParams,
  ]);

  if (loading) return <PageLoading label="심사 건을 불러오는 중입니다." />;
  if (error || !value || !caseDetail) return <PageError title="심사 건을 열 수 없습니다." detail={error ?? "심사 건이 존재하지 않습니다."} />;
  const detail = caseDetail;

  return (
    <CaseContext.Provider value={value}>
      <div
        className="case-workspace"
        data-selected-case-id={detail.case_id}
        data-selected-case-external-reference={detail.external_reference ?? ""}
      >
      <header className="case-page-header">
        <div>
          <p className="overline">심사 건</p>
          <h1>{detail.title}</h1>
          <p>{detail.external_reference || "별도 업무 참조번호 없음"} · 최근 변경 {formatKoreanDate(detail.updated_at)}</p>
        </div>
        <div className="case-page-header__actions">
          <span className={`business-status business-status--${detail.status}`}>{caseStatusLabels[detail.status]}</span>
          {runs.length > 0 ? (
            <label className="run-selector">
              <span>심사 회차</span>
              <select
                aria-label="심사 회차 선택"
                value={selectedRun?.review_run_id ?? runs[0]?.review_run_id ?? ""}
                onChange={(event) => value.selectRun(event.target.value)}
              >
                {runs.map((run, index) => (
                  <option key={run.review_run_id} value={run.review_run_id}>
                    {runs.length - index}회차 · {formatKoreanDate(run.created_at)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </header>
      <CaseNavigation caseId={detail.case_id} />
      {loadingRun ? <div className="inline-loading">선택한 심사 결과를 불러오는 중입니다.</div> : null}
      <Outlet />
      </div>
    </CaseContext.Provider>
  );
}

export function useCaseWorkspace(): CaseContextValue {
  const value = useContext(CaseContext);
  if (!value) throw new Error("CaseWorkspace is missing");
  return value;
}

export function PageLoading({ label }: { label: string }): React.ReactElement {
  return (
    <div className="page-state" role="status">
      <span className="loading-orbit" aria-hidden="true" />
      <h1>{label}</h1>
      <p>잠시만 기다려 주십시오.</p>
    </div>
  );
}

export function PageError({ title, detail }: { title: string; detail: string }): React.ReactElement {
  return (
    <div className="page-state page-state--error" role="alert">
      <h1>{title}</h1>
      <p>{detail}</p>
    </div>
  );
}
