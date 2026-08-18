import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import type { AuthConfig } from "./api/v1/types";
import type { BrowserSession } from "./auth";

/**
 * Deliberately small OIDC client for one local functional-UAT journey.
 *
 * This is isolated from the no-secret fixture bundle. The user completes a
 * normal Authorization Code + PKCE redirect; access and refresh tokens stay
 * in memory, and the PKCE state survives only the one redirect.
 */
export class OidcSession implements BrowserSession {
  private manager: UserManager | undefined;
  private user: User | undefined;
  private endSessionEndpoint: string | undefined;

  configure(config: AuthConfig): void {
    this.user = undefined;
    this.endSessionEndpoint = typeof config.end_session_endpoint === "string"
      ? config.end_session_endpoint
      : undefined;
    this.manager = new UserManager({
      authority: config.issuer,
      client_id: config.client_id,
      redirect_uri: `${window.location.origin}/auth/callback`,
      post_logout_redirect_uri: window.location.origin,
      response_type: "code",
      scope: (config.scopes ?? ["openid"]).join(" "),
      metadata: {
        issuer: config.issuer,
        authorization_endpoint: config.authorization_endpoint,
        token_endpoint: config.token_endpoint,
        ...(this.endSessionEndpoint ? { end_session_endpoint: this.endSessionEndpoint } : {}),
      },
      stateStore: new WebStorageStateStore({ store: window.sessionStorage, prefix: "customs.oidc." }),
      userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
      // The refresh token renews the access token in the background so a
      // journey is not interrupted mid-task; tokens still live only in memory.
      automaticSilentRenew: true,
      monitorSession: false,
      loadUserInfo: false,
    });
    this.manager.events.addUserLoaded((user) => {
      this.user = user;
    });
  }

  async finishCallbackIfPresent(): Promise<boolean> {
    const manager = this.requireManager();
    const url = new URL(window.location.href);
    const callback = url.pathname === "/auth/callback"
      && url.searchParams.has("state")
      && (url.searchParams.has("code") || url.searchParams.has("error"));
    if (!callback) return false;
    try {
      const user = await manager.signinRedirectCallback(window.location.href);
      if (!user.access_token || !user.profile?.sub) {
        await manager.removeUser();
        throw new Error("OIDC callback did not return a subject-bound access token");
      }
      this.user = user;
      window.history.replaceState({}, document.title, callbackReturnTo(user.state));
      return true;
    } finally {
      if (window.location.pathname === "/auth/callback") {
        window.history.replaceState({}, document.title, "/");
      }
    }
  }

  async login(): Promise<void> {
    const manager = this.requireManager();
    const current = new URL(window.location.href);
    const returnTo = safeReturnTo(`${current.pathname}${current.search}${current.hash}`, "/");
    await manager.signinRedirect({ state: { returnTo } });
  }

  async logout(): Promise<void> {
    const manager = this.manager;
    if (!manager) return;
    const idTokenHint = this.user?.id_token;
    this.user = undefined;
    await manager.removeUser();
    if (this.endSessionEndpoint) {
      await manager.signoutRedirect({ ...(idTokenHint ? { id_token_hint: idTokenHint } : {}) });
      return;
    }
    window.location.assign("/");
  }

  freshAccessToken = async (): Promise<string | undefined> => {
    const user = this.user;
    if (user?.access_token && user.expired !== true) return user.access_token;
    // The renew timer can miss (for example after system sleep); one on-demand
    // refresh-token exchange recovers the session without a redirect.
    if (user?.refresh_token && this.manager) {
      try {
        const renewed = await this.manager.signinSilent();
        if (renewed?.access_token) {
          this.user = renewed;
          return renewed.access_token;
        }
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  isAuthenticated(): boolean {
    return Boolean(this.user?.access_token && this.user.expired !== true);
  }

  private requireManager(): UserManager {
    if (!this.manager) throw new Error("OIDC session is not configured");
    return this.manager;
  }
}

function callbackReturnTo(state: unknown): string {
  if (typeof state !== "object" || state === null || Array.isArray(state)) return "/";
  return safeReturnTo((state as Record<string, unknown>).returnTo, "/");
}

function safeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  try {
    const target = new URL(value, window.location.origin);
    return target.origin === window.location.origin ? `${target.pathname}${target.search}${target.hash}` : fallback;
  } catch {
    return fallback;
  }
}
