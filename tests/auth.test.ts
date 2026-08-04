import { describe, expect, it } from "vitest";
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

  it("rejects an invalid development session response", async () => {
    const session = new LocalDevelopmentSession(async () => ({
      ...response,
      access_token: "too-short",
    }));

    await expect(session.start()).rejects.toThrow("local-development session response");
    expect(session.isAuthenticated()).toBe(false);
  });
});
