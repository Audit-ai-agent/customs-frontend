import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
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
}: PropsWithChildren<CommercialDependencies>): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [metadata, setMetadata] = useState<CommercialUatMetadata | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const flags = experienceFeatureFlags();

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
        setSession(nextSession);
        setMetadata(nextMetadata);
        setCases(nextCases.items);
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "작업대 정보를 불러오지 못했습니다.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [api, experienceApi, oidc]);

  const value = useMemo<WorkbenchContextValue>(() => ({
    api,
    experienceApi,
    oidc,
    session,
    metadata,
    cases,
    loading,
    error,
    flags,
    refreshCases,
    login: () => oidc.login(),
    logout: () => oidc.logout(),
  }), [
    api, experienceApi, oidc, session, metadata, cases, loading, error,
    flags.enhancedExperience, flags.adaptiveUat, refreshCases,
  ]);

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench(): WorkbenchContextValue {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error("WorkbenchProvider is missing");
  return value;
}
