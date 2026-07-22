import { beforeEach, describe, expect, it, vi } from "vitest";

const oidc = vi.hoisted(() => ({
  config: undefined as Record<string, unknown> | undefined,
  manager: {
    signinRedirectCallback: vi.fn(),
    signinRedirect: vi.fn(async () => undefined),
    signoutRedirect: vi.fn(async () => undefined),
    removeUser: vi.fn(async () => undefined),
  },
}));

vi.mock("oidc-client-ts", () => {
  class InMemoryWebStorage {}
  class WebStorageStateStore {
    constructor(readonly options: unknown) {}
  }
  class UserManager {
    constructor(config: Record<string, unknown>) {
      oidc.config = config;
      return oidc.manager as unknown as UserManager;
    }
  }
  return { InMemoryWebStorage, WebStorageStateStore, UserManager };
});

import { OidcSession } from "../src/auth";
import type { AuthConfig } from "../src/api/v1/types";

const config = (endSession: string | null = "https://customs.example/auth/logout"): AuthConfig => ({
  issuer: "https://customs.example/auth/realms/customs",
  audience: "customs-api",
  client_id: "customs-spa",
  authorization_endpoint: "https://customs.example/auth/authorize",
  token_endpoint: "https://customs.example/auth/token",
  end_session_endpoint: endSession,
  scopes: ["openid"],
  flow: "authorization_code_pkce_s256",
  token_storage: "memory_only",
});

describe("OIDC memory-only session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    oidc.config = undefined;
    window.history.replaceState({}, "", "/");
  });

  it("uses PKCE, session-only callback state and an in-memory user store", async () => {
    oidc.manager.signinRedirectCallback.mockResolvedValue({ access_token: "memory-token", id_token: "id-token", expired: false });
    const session = new OidcSession();
    session.configure(config());
    window.history.replaceState({}, "", "/auth/callback?code=one-time&state=bound-state");
    expect(await session.finishCallbackIfPresent()).toBe(true);
    expect(session.accessToken()).toBe("memory-token");
    expect(window.location.pathname).toBe("/");
    expect(oidc.config).toMatchObject({ response_type: "code", automaticSilentRenew: false });
    expect(oidc.config?.stateStore).toBeDefined();
    expect(oidc.config?.userStore).toBeDefined();
  });

  it("clears memory and uses the configured end-session endpoint only", async () => {
    oidc.manager.signinRedirectCallback.mockResolvedValue({ access_token: "memory-token", id_token: "id-token", expired: false });
    const session = new OidcSession();
    session.configure(config());
    window.history.replaceState({}, "", "/auth/callback?code=code&state=state");
    await session.finishCallbackIfPresent();
    await session.logout();
    expect(session.accessToken()).toBeUndefined();
    expect(oidc.manager.removeUser).toHaveBeenCalledOnce();
    expect(oidc.manager.signoutRedirect).toHaveBeenCalledWith({ id_token_hint: "id-token" });
  });

  it("consumes an OIDC error callback and always removes one-time URL parameters", async () => {
    oidc.manager.signinRedirectCallback.mockRejectedValue(new Error("access denied"));
    const session = new OidcSession();
    session.configure(config());
    window.history.replaceState({}, "", "/auth/callback?error=access_denied&state=bound-state");
    await expect(session.finishCallbackIfPresent()).rejects.toThrow("access denied");
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe("");
  });

  it("removes an expired or rejected session without persistent storage", async () => {
    const session = new OidcSession();
    session.configure(config(null));
    await session.clear();
    expect(session.isAuthenticated()).toBe(false);
    expect(oidc.manager.removeUser).toHaveBeenCalledOnce();
    expect(window.localStorage).toHaveLength(0);
  });
});
