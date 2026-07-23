import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import type { AuthConfig } from "./api/v1/types";

const TOKEN_RENEWAL_SKEW_SECONDS = 60;
const TOKEN_RENEWAL_TIMEOUT_SECONDS = 10;

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
    try {
      const user = await this.manager.signinRedirectCallback(window.location.href);
      if (!user.access_token || !user.profile?.sub) {
        await this.manager.removeUser();
        throw new Error("OIDC callback did not return a subject-bound access token");
      }
      this.sessionEpoch += 1;
      this.user = user;
      return true;
    } finally {
      // One-time code, state, and provider errors must not remain in history,
      // screenshots, referrers, or a later browser refresh.
      window.history.replaceState({}, document.title, "/");
    }
  }

  async login(): Promise<void> {
    if (!this.manager) throw new Error("OIDC session is not configured");
    await this.manager.signinRedirect({ state: { returnTo: "/" } });
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
