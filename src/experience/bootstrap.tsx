import { createRoot } from "react-dom/client";
import type { ApiClient } from "../api/v1/client";
import { ExperienceApiClient } from "../api/v2/client";
import type { OidcSession } from "../auth";
import { CommercialWorkbench } from "./app";
import "./commercial.css";

export function mountCommercialWorkbench(
  root: HTMLElement,
  api: ApiClient,
  oidc: OidcSession,
): void {
  createRoot(root).render(
    <CommercialWorkbench
      api={api}
      experienceApi={new ExperienceApiClient(fetch, oidc.freshAccessToken)}
      oidc={oidc}
    />,
  );
}
