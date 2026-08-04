import { beforeEach, describe, expect, it, vi } from "vitest";

const oidc = vi.hoisted(() => ({
  config: undefined as Record<string, unknown> | undefined,
  manager: {
    signinRedirectCallback: vi.fn(),
    signinRedirect: vi.fn(async () => undefined),
    signinSilent: vi.fn(),
    signoutRedirect: vi.fn(async () => undefined),
    removeUser: vi.fn(async () => undefined),
    storeUser: vi.fn(async () => undefined),
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

const user = (
  accessToken: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  access_token: accessToken,
  refresh_token: "memory-refresh-token",
  id_token: "memory-id-token",
  expires_in: 300,
  expired: false,
  profile: { sub: "reviewer-1" },
  ...overrides,
});

async function authenticatedSession(
  initialUser: Record<string, unknown> = user("memory-token"),
): Promise<OidcSession> {
  oidc.manager.signinRedirectCallback.mockResolvedValue(initialUser);
  const session = new OidcSession();
  session.configure(config());
  window.history.replaceState({}, "", "/auth/callback?code=one-time&state=bound-state");
  expect(await session.finishCallbackIfPresent()).toBe(true);
  return session;
}

describe("OIDC memory-only session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    oidc.config = undefined;
    oidc.manager.signinSilent.mockReset();
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("uses PKCE, session-only callback state and an in-memory user store", async () => {
    const session = await authenticatedSession();
    expect(await session.freshAccessToken()).toBe("memory-token");
    expect(window.location.pathname).toBe("/reviews");
    expect(oidc.config).toMatchObject({ response_type: "code", automaticSilentRenew: false });
    expect(oidc.config?.stateStore).toBeDefined();
    expect(oidc.config?.userStore).toBeDefined();
    expect(oidc.manager.signinSilent).not.toHaveBeenCalled();
    expect(JSON.stringify({
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
    })).not.toMatch(/memory-(token|refresh-token|id-token)/);
  });

  it("clears memory and uses the configured end-session endpoint only", async () => {
    const session = await authenticatedSession();
    await session.logout();
    expect(await session.freshAccessToken()).toBeUndefined();
    expect(oidc.manager.removeUser).toHaveBeenCalledOnce();
    expect(oidc.manager.signoutRedirect).toHaveBeenCalledWith({ id_token_hint: "memory-id-token" });
  });

  it("consumes an OIDC error callback and always removes one-time URL parameters", async () => {
    oidc.manager.signinRedirectCallback.mockRejectedValue(new Error("access denied"));
    const session = new OidcSession();
    session.configure(config());
    window.history.replaceState({}, "", "/auth/callback?error=access_denied&state=bound-state");
    await expect(session.finishCallbackIfPresent()).rejects.toThrow("access denied");
    expect(window.location.pathname).toBe("/login");
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

  it("renews an expiring access token on demand without using an iframe timer", async () => {
    const session = await authenticatedSession(user("old-token", { expires_in: 30 }));
    oidc.manager.signinSilent.mockResolvedValue(user("new-token"));

    await expect(session.freshAccessToken()).resolves.toBe("new-token");
    expect(oidc.manager.signinSilent).toHaveBeenCalledOnce();
    expect(oidc.manager.signinSilent).toHaveBeenCalledWith({ silentRequestTimeoutInSeconds: 10 });
    await expect(session.freshAccessToken()).resolves.toBe("new-token");
    expect(oidc.manager.signinSilent).toHaveBeenCalledOnce();
  });

  it("single-flights concurrent refreshes so a rotating refresh token is used once", async () => {
    const session = await authenticatedSession(user("old-token", { expires_in: 30 }));
    let resolveRenewal: ((value: Record<string, unknown>) => void) | undefined;
    oidc.manager.signinSilent.mockImplementation(() => new Promise((resolve) => {
      resolveRenewal = resolve;
    }));

    const requests = [
      session.freshAccessToken(),
      session.freshAccessToken(),
      session.freshAccessToken(),
    ];
    expect(oidc.manager.signinSilent).toHaveBeenCalledOnce();
    resolveRenewal?.(user("rotated-token", { refresh_token: "rotated-refresh-token" }));

    await expect(Promise.all(requests)).resolves.toEqual([
      "rotated-token",
      "rotated-token",
      "rotated-token",
    ]);
    expect(oidc.manager.signinSilent).toHaveBeenCalledOnce();
  });

  it("fails closed on refresh failure, a missing refresh token, or subject drift", async () => {
    for (const [initial, renewed] of [
      [user("expired-token", { expired: true, expires_in: 0 }), new Error("provider rejected")],
      [user("expired-token", { expired: true, expires_in: 0, refresh_token: undefined }), null],
      [user("expired-token", { expired: true, expires_in: 0 }), user("attacker-token", { profile: { sub: "attacker" } })],
    ] as const) {
      vi.clearAllMocks();
      const session = await authenticatedSession(initial);
      if (renewed instanceof Error) oidc.manager.signinSilent.mockRejectedValue(renewed);
      else oidc.manager.signinSilent.mockResolvedValue(renewed);

      await expect(session.freshAccessToken()).resolves.toBeUndefined();
      expect(session.isAuthenticated()).toBe(false);
      expect(oidc.manager.removeUser).toHaveBeenCalled();
    }
  });

  it("does not let an in-flight refresh resurrect a cleared session", async () => {
    const session = await authenticatedSession(user("old-token", { expires_in: 30 }));
    let resolveRenewal: ((value: Record<string, unknown>) => void) | undefined;
    oidc.manager.signinSilent.mockImplementation(() => new Promise((resolve) => {
      resolveRenewal = resolve;
    }));

    const pending = session.freshAccessToken();
    await session.clear();
    resolveRenewal?.(user("late-token"));

    await expect(pending).resolves.toBeUndefined();
    expect(session.isAuthenticated()).toBe(false);
    await expect(session.freshAccessToken()).resolves.toBeUndefined();
    expect(oidc.manager.removeUser).toHaveBeenCalledTimes(2);
  });

  it("restores a hard-refreshed route through the IdP cookie without persisting tokens", async () => {
    const session = new OidcSession();
    session.configure(config());
    window.history.replaceState(
      {},
      "",
      "/cases/case-1/assistant?run=run-1#latest-answer",
    );

    await expect(session.tryCookieSessionRestore()).resolves.toBe(true);
    expect(oidc.manager.signinRedirect).toHaveBeenCalledWith({
      prompt: "none",
      state: {
        intent: "cookie_session_restore",
        returnTo: "/cases/case-1/assistant?run=run-1#latest-answer",
      },
    });
    const stored = window.sessionStorage.getItem("customs.oidc.session-reauth");
    expect(stored).toContain("/cases/case-1/assistant");
    expect(stored).not.toMatch(/token|password|secret/iu);

    oidc.manager.signinRedirectCallback.mockResolvedValue(user("restored-token", {
      state: {
        intent: "cookie_session_restore",
        returnTo: "/cases/case-1/assistant?run=run-1#latest-answer",
      },
    }));
    window.history.replaceState({}, "", "/auth/callback?code=one-time&state=restored");
    await expect(session.finishCallbackIfPresent()).resolves.toBe(true);
    expect(window.location.pathname).toBe("/cases/case-1/assistant");
    expect(window.location.search).toBe("?run=run-1");
    expect(window.location.hash).toBe("#latest-answer");
    expect(window.sessionStorage.getItem("customs.oidc.session-reauth")).toBeNull();
    expect(await session.freshAccessToken()).toBe("restored-token");
  });

  it("fails a cookie-session restore safely to login and rejects an external return path", async () => {
    const session = new OidcSession();
    session.configure(config());
    window.history.replaceState({}, "", "/login?returnTo=https%3A%2F%2Fattacker.example%2Fsteal");
    await session.login();
    expect(oidc.manager.signinRedirect).toHaveBeenLastCalledWith({
      state: {
        intent: "interactive_login",
        returnTo: "/reviews",
      },
    });
    window.history.replaceState({}, "", "/reviews");
    await expect(session.tryCookieSessionRestore()).resolves.toBe(true);
    expect(oidc.manager.signinRedirect).toHaveBeenCalledWith({
      prompt: "none",
      state: {
        intent: "cookie_session_restore",
        returnTo: "/reviews",
      },
    });

    oidc.manager.signinRedirectCallback.mockRejectedValue(new Error("login_required"));
    window.history.replaceState({}, "", "/auth/callback?error=login_required&state=restored");
    await expect(session.finishCallbackIfPresent()).resolves.toBe(true);
    expect(window.location.pathname).toBe("/login");
    expect(window.location.search).toContain("returnTo=%2Freviews");
    expect(window.location.href).not.toContain("login_required");
    expect(session.isAuthenticated()).toBe(false);
  });
});
