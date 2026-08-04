import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import type { AuthConfig } from "./api/v1/types";

const TOKEN_RENEWAL_SKEW_SECONDS = 60;
const TOKEN_RENEWAL_TIMEOUT_SECONDS = 10;
const SESSION_REAUTH_KEY = "customs.oidc.session-reauth";
const SESSION_REAUTH_MAX_AGE_MS = 5 * 60 * 1_000;

interface SessionReauthState {
  returnTo: string;
  initiatedAt: string;
}

export class OidcSession {
  private manager: UserManager | undefined;
  private user: User | undefined;
  private endSessionEndpoint: string | undefined;
  private renewal: Promise<string | undefined> | undefined;
  private sessionEpoch = 0;

  configure(config: AuthConfig): void {
    this.sessionEpoch += 1;
    this.user = undefined;
    this.renewal = undefined;
    this.endSessionEndpoint = typeof config.end_session_endpoint === "string" ? config.end_session_endpoint : undefined;
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
        ...(typeof config.end_session_endpoint === "string" ? { end_session_endpoint: config.end_session_endpoint } : {}),
      },
      userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
      stateStore: new WebStorageStateStore({ store: window.sessionStorage, prefix: "customs.oidc." }),
      automaticSilentRenew: false,
      monitorSession: false,
      loadUserInfo: false,
    });
  }

  async finishCallbackIfPresent(): Promise<boolean> {
    if (!this.manager) throw new Error("OIDC session is not configured");
    const url = new URL(window.location.href);
    const callback = url.pathname === "/auth/callback"
      && url.searchParams.has("state")
      && (url.searchParams.has("code") || url.searchParams.has("error"));
    if (!callback) return false;
    const reauth = readSessionReauth();
    try {
      const user = await this.manager.signinRedirectCallback(window.location.href);
      if (!user.access_token || !user.profile?.sub) {
        await this.manager.removeUser();
        throw new Error("OIDC callback did not return a subject-bound access token");
      }
      this.sessionEpoch += 1;
      this.user = user;
      clearSessionReauth();
      window.history.replaceState(
        {},
        document.title,
        callbackReturnTo(user.state, reauth?.returnTo),
      );
      return true;
    } catch (error) {
      if (reauth !== null) {
        this.sessionEpoch += 1;
        this.user = undefined;
        this.renewal = undefined;
        clearSessionReauth();
        try {
          await this.manager.removeUser();
        } catch {
          // The browser process has no usable credential. Provider cleanup
          // details must not reach the user-facing bootstrap screen.
        }
        const returnTo = safeReturnTo(reauth.returnTo, "/reviews");
        window.history.replaceState(
          {},
          document.title,
          `/login?returnTo=${encodeURIComponent(returnTo)}&session=expired`,
        );
        return true;
      }
      throw error;
    } finally {
      // One-time code, state, and provider errors must not remain in history,
      // screenshots, referrers, or a later browser refresh.
      if (window.location.pathname === "/auth/callback") {
        window.history.replaceState({}, document.title, "/login");
      }
    }
  }

  async tryCookieSessionRestore(): Promise<boolean> {
    if (!this.manager) throw new Error("OIDC session is not configured");
    if (this.isAuthenticated()) return false;
    const current = new URL(window.location.href);
    if (current.pathname === "/login" || current.pathname === "/auth/callback") return false;
    const existing = readSessionReauth();
    if (existing !== null) {
      clearSessionReauth();
      window.history.replaceState(
        {},
        document.title,
        `/login?returnTo=${encodeURIComponent(safeReturnTo(existing.returnTo, "/reviews"))}&session=expired`,
      );
      return false;
    }
    const returnTo = safeReturnTo(
      `${current.pathname}${current.search}${current.hash}`,
      "/reviews",
    );
    writeSessionReauth({ returnTo, initiatedAt: new Date().toISOString() });
    try {
      await this.manager.signinRedirect({
        prompt: "none",
        state: {
          intent: "cookie_session_restore",
          returnTo,
        },
      });
      return true;
    } catch (error) {
      clearSessionReauth();
      throw error;
    }
  }

  async login(): Promise<void> {
    if (!this.manager) throw new Error("OIDC session is not configured");
    const current = new URL(window.location.href);
    const returnTo = safeReturnTo(current.searchParams.get("returnTo"), "/reviews");
    await this.manager.signinRedirect({
      state: {
        intent: "interactive_login",
        returnTo,
      },
    });
  }

  async logout(): Promise<void> {
    if (!this.manager) return;
    const idTokenHint = this.user?.id_token;
    this.sessionEpoch += 1;
    this.user = undefined;
    this.renewal = undefined;
    await this.manager.removeUser();
    if (!this.endSessionEndpoint) {
      window.location.assign("/");
      return;
    }
    await this.manager.signoutRedirect({ ...(idTokenHint ? { id_token_hint: idTokenHint } : {}) });
  }

  async clear(): Promise<void> {
    this.sessionEpoch += 1;
    this.user = undefined;
    this.renewal = undefined;
    await this.manager?.removeUser();
  }

  freshAccessToken = async (): Promise<string | undefined> => {
    const user = this.user;
    const manager = this.manager;
    if (!user || !manager) return undefined;
    const expiresIn = user.expires_in;
    const needsRenewal = user.expired === true
      || (typeof expiresIn === "number" && expiresIn <= TOKEN_RENEWAL_SKEW_SECONDS);
    if (!needsRenewal) return user.access_token;
    if (!user.refresh_token) {
      await this.invalidateSession(manager, this.sessionEpoch);
      return undefined;
    }
    if (this.renewal) return this.renewal;

    const epoch = this.sessionEpoch;
    const subject = user.profile?.sub;
    let renewal: Promise<string | undefined>;
    renewal = manager.signinSilent({
      silentRequestTimeoutInSeconds: TOKEN_RENEWAL_TIMEOUT_SECONDS,
    }).then(async (refreshed) => {
      if (epoch !== this.sessionEpoch) {
        await this.repairStoreAfterStaleRenewal(manager);
        return undefined;
      }
      if (
        !refreshed?.access_token
        || !subject
        || refreshed.profile?.sub !== subject
      ) {
        await this.invalidateSession(manager, epoch);
        return undefined;
      }
      this.user = refreshed;
      return refreshed.access_token;
    }).catch(async () => {
      await this.invalidateSession(manager, epoch);
      return undefined;
    }).finally(() => {
      if (this.renewal === renewal) this.renewal = undefined;
    });
    this.renewal = renewal;
    return renewal;
  };

  isAuthenticated(): boolean {
    return this.user !== undefined
      && (this.user.expired !== true || Boolean(this.user.refresh_token));
  }

  private async invalidateSession(manager: UserManager, epoch: number): Promise<void> {
    if (epoch !== this.sessionEpoch) {
      await this.repairStoreAfterStaleRenewal(manager);
      return;
    }
    this.sessionEpoch += 1;
    this.user = undefined;
    try {
      await manager.removeUser();
    } catch {
      // The in-process credential is already gone. Do not expose provider
      // details or revive a session because storage cleanup also failed.
    }
  }

  private async repairStoreAfterStaleRenewal(manager: UserManager): Promise<void> {
    try {
      if (manager === this.manager && this.user) {
        await manager.storeUser(this.user);
      } else {
        await manager.removeUser();
      }
    } catch {
      // The current in-memory session remains authoritative. A later request
      // will fail closed if the library store cannot provide its refresh token.
    }
  }
}

function callbackReturnTo(state: unknown, fallback: string | undefined): string {
  if (typeof state !== "object" || state === null) return safeReturnTo(fallback, "/reviews");
  const value = (state as { returnTo?: unknown }).returnTo;
  return safeReturnTo(typeof value === "string" ? value : fallback, "/reviews");
}

function safeReturnTo(value: string | null | undefined, fallback: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 2_048
    || !value.startsWith("/")
    || value.startsWith("//")
    || /[\r\n\0]/u.test(value)
  ) return fallback;
  let parsed: URL;
  try {
    parsed = new URL(value, window.location.origin);
  } catch {
    return fallback;
  }
  if (
    parsed.origin !== window.location.origin
    || parsed.pathname === "/auth/callback"
    || parsed.pathname === "/login"
  ) return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function readSessionReauth(): SessionReauthState | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_REAUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionReauthState>;
    const initiatedAt = typeof parsed.initiatedAt === "string"
      ? new Date(parsed.initiatedAt).getTime()
      : Number.NaN;
    if (
      typeof parsed.returnTo !== "string"
      || !Number.isFinite(initiatedAt)
      || Date.now() - initiatedAt > SESSION_REAUTH_MAX_AGE_MS
      || initiatedAt - Date.now() > 60_000
    ) {
      clearSessionReauth();
      return null;
    }
    return {
      returnTo: safeReturnTo(parsed.returnTo, "/reviews"),
      initiatedAt: String(parsed.initiatedAt),
    };
  } catch {
    clearSessionReauth();
    return null;
  }
}

function writeSessionReauth(value: SessionReauthState): void {
  window.sessionStorage.setItem(SESSION_REAUTH_KEY, JSON.stringify(value));
}

function clearSessionReauth(): void {
  window.sessionStorage.removeItem(SESSION_REAUTH_KEY);
}
