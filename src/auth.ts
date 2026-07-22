import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import type { AuthConfig } from "./api/v1/types";

export class OidcSession {
  private manager: UserManager | undefined;
  private user: User | undefined;
  private endSessionEndpoint: string | undefined;

  configure(config: AuthConfig): void {
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
      this.user = await this.manager.signinRedirectCallback(window.location.href);
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
    this.user = undefined;
    await this.manager.removeUser();
    if (!this.endSessionEndpoint) {
      window.location.assign("/");
      return;
    }
    await this.manager.signoutRedirect({ ...(idTokenHint ? { id_token_hint: idTokenHint } : {}) });
  }

  async clear(): Promise<void> {
    this.user = undefined;
    await this.manager?.removeUser();
  }

  accessToken = (): string | undefined => {
    if (!this.user || this.user.expired) return undefined;
    return this.user.access_token;
  };

  isAuthenticated(): boolean {
    return this.accessToken() !== undefined;
  }
}
