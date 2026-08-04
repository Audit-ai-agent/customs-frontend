import { describe, expect, it } from "vitest";
import { LightweightWorkbench } from "../src/workbench";

describe("lightweight workbench", () => {
  it("renders the no-secret local-development journey", async () => {
    const root = document.createElement("div");
    const api = {
      getSession: async () => ({ subject: "local-reviewer", org_id: "local-org", roles: ["reviewer"] }),
      listCases: async () => ({ items: [] }),
    };
    const auth = {
      logout: async () => undefined,
      freshAccessToken: async () => "token",
      isAuthenticated: () => true,
    };

    const app = new LightweightWorkbench(root, api as never, auth, "local-development");
    await app.start();

    expect(root.textContent).toContain("기본 개발");
    expect(root.textContent).toContain("Case를 만들고");
    expect(root.textContent).not.toContain("시나리오");
    expect(root.textContent).not.toContain("릴리스");
  });
});
