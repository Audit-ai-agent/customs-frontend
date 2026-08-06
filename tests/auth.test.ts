import { describe, expect, it, vi } from "vitest";
import { LocalDevelopmentSession } from "../src/auth";

const response = {
  access_token: "a".repeat(32),
  token_type: "Bearer" as const,
  expires_in: 60,
  session: {
    subject: "local-reviewer",
    org_id: "local-org",
    roles: ["reviewer"],
  },
};

describe("local-development session", () => {
  it("keeps the loopback development token in memory only", async () => {
    const session = new LocalDevelopmentSession(async () => response);

    await session.start();

    expect(session.isAuthenticated()).toBe(true);
    await expect(session.freshAccessToken()).resolves.toBe(response.access_token);
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it("switches to the explicit local approver identity without persisting either token", async () => {
    const createSession = vi.fn(async (actor?: "reviewer" | "approver") => actor === "approver"
      ? { ...response, access_token: "p".repeat(32), session: { ...response.session, subject: "local-approver", roles: ["approver"] } }
      : response);
    const session = new LocalDevelopmentSession(createSession);

    await session.start();
    await session.switchActor("approver");

    expect(createSession).toHaveBeenNthCalledWith(1, undefined);
    expect(createSession).toHaveBeenNthCalledWith(2, "approver");
    await expect(session.freshAccessToken()).resolves.toBe("p".repeat(32));
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it("rejects an invalid development session response", async () => {
    const session = new LocalDevelopmentSession(async () => ({
      ...response,
      access_token: "too-short",
    }));

    await expect(session.start()).rejects.toThrow("local-development session response");
    expect(session.isAuthenticated()).toBe(false);
  });
});
