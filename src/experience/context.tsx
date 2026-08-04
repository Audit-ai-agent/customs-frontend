import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { userFacingErrorMessage } from "../api/user-facing-errors";
import type { ApiClient } from "../api/v1/client";
import type {
  CaseSummary,
  Session,
} from "../api/v1/types";
import type { ExperienceApiClient } from "../api/v2/client";
import type { CommercialUatMetadata } from "../api/v2/types";
import type { OidcSession } from "../auth";
import { experienceFeatureFlags, type ExperienceFeatureFlags } from "./feature-flags";

export interface CommercialDependencies {
  api: ApiClient;
  experienceApi: ExperienceApiClient;
  oidc: OidcSession;
  /**
   * Test/bootstrap injection only. The product entry point omits this value and
   * therefore remains bound to the immutable Vite build flags.
   */
  featureFlags?: ExperienceFeatureFlags;
}

interface WorkbenchContextValue extends CommercialDependencies {
  session: Session | null;
  metadata: CommercialUatMetadata | null;
  cases: CaseSummary[];
  loading: boolean;
  error: string | null;
  flags: ExperienceFeatureFlags;
  refreshCases(): Promise<void>;
  login(): Promise<void>;
  logout(): Promise<void>;
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

export function WorkbenchProvider({
  children,
  api,
  experienceApi,
  oidc,
  featureFlags,
}: PropsWithChildren<CommercialDependencies>): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [metadata, setMetadata] = useState<CommercialUatMetadata | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const flags = featureFlags ?? experienceFeatureFlags();
  const capabilityRefreshEnabled = Boolean(
    session && metadata && flags.enhancedExperience,
  );

  const refreshCases = useCallback(async (): Promise<void> => {
    const response = await api.listCases();
    setCases(response.items);
  }, [api]);

  useEffect(() => {
    let active = true;
    const load = async (): Promise<void> => {
      if (!oidc.isAuthenticated()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const [nextSession, nextMetadata, nextCases] = await Promise.all([
          api.getSession(),
          experienceApi.getUatMetadata(),
          api.listCases(),
        ]);
        if (!active) return;
        assertCommercialUatBootstrap(nextMetadata, flags);
        setSession(nextSession);
        setMetadata(nextMetadata);
        setCases(nextCases.items);
      } catch (reason) {
        if (!active) return;
        setError(userFacingErrorMessage(reason, "작업대 정보를 불러오지 못했습니다."));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [api, experienceApi, oidc]);

  useEffect(() => {
    if (!capabilityRefreshEnabled) return;
    let active = true;
    let refreshInFlight = false;
    const refreshCapability = async (): Promise<void> => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        const nextMetadata = await experienceApi.getUatMetadata();
        if (!active) return;
        assertCommercialUatBootstrap(nextMetadata, flags);
        setMetadata(nextMetadata);
        setCapabilityError(null);
      } catch (reason) {
        if (!active) return;
        setCapabilityError(userFacingErrorMessage(
          reason,
          "검증 환경의 실행 권한을 다시 확인하지 못했습니다.",
        ));
      } finally {
        refreshInFlight = false;
      }
    };
    const timer = window.setInterval(refreshCapability, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    experienceApi,
    capabilityRefreshEnabled,
    flags.adaptiveUat,
    flags.enhancedExperience,
  ]);

  const value = useMemo<WorkbenchContextValue>(() => ({
    api,
    experienceApi,
    oidc,
    session,
    metadata,
    cases,
    loading,
    error: error ?? capabilityError,
    flags,
    refreshCases,
    login: () => oidc.login(),
    logout: () => oidc.logout(),
  }), [
    api, experienceApi, oidc, session, metadata, cases, loading, error,
    capabilityError,
    flags.enhancedExperience, flags.adaptiveUat, refreshCases,
  ]);

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function assertCommercialUatBootstrap(
  metadata: CommercialUatMetadata,
  flags: ExperienceFeatureFlags,
): void {
  if (
    metadata.enhanced_agent_experience !== flags.enhancedExperience
    || metadata.uat_adaptive_active !== flags.adaptiveUat
  ) {
    throw new Error("Frontend 기능과 Backend 검증 권한이 일치하지 않아 작업대를 차단했습니다.");
  }
  if (!flags.enhancedExperience) return;
  const stores = metadata.evidence_dataset.store_counts;
  if (
    metadata.mode !== "local_uat"
    || metadata.claude_mode !== "actual"
    || metadata.evidence_profile !== "preserved-3law-v3-scenario-eval"
    || metadata.evidence_data_source !== "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY"
    || metadata.evidence_policy_mode !== "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY"
    || metadata.evidence_dataset.observed_law_count !== 3
    || metadata.evidence_dataset.observed_article_count !== 1007
    || stores.postgresql_article_count !== 1007
    || stores.qdrant_point_count !== 1007
    || stores.neo4j_article_count !== 1007
    || metadata.auto_completion_enabled
    || metadata.production_release
    || metadata.agent_experience_api_version !== "3.0"
    || metadata.assistant_api_version !== "2.0"
    || !metadata.actual_stage_streaming
    || (flags.adaptiveUat && metadata.planner_mode !== "diagnostic_active")
  ) {
    throw new Error("검증된 Local UAT 실행 조건이 충족되지 않아 상용형 작업대를 차단했습니다.");
  }
}

export function useWorkbench(): WorkbenchContextValue {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error("WorkbenchProvider is missing");
  return value;
}
