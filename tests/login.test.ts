import { describe, expect, it } from "vitest";
import { showLoginScreen } from "../src/login";

function buttons(root: HTMLElement): [HTMLButtonElement, ...HTMLButtonElement[]] {
  const found = [...root.querySelectorAll<HTMLButtonElement>(".login-actions button")];
  if (found.length === 0) throw new Error("no login buttons");
  return found as [HTMLButtonElement, ...HTMLButtonElement[]];
}

describe("login screen", () => {
  it("functional-uat offers one OIDC button and resolves without a local actor", async () => {
    const root = document.createElement("div");
    const choice = showLoginScreen(root, "functional-uat");

    expect(root.querySelector("#main-content h1")?.textContent).toBe("로그인");
    expect(root.querySelector(".login-preview")?.getAttribute("aria-hidden")).toBe("true");
    expect(root.textContent).not.toContain("UAT 환경");
    const [login, ...rest] = buttons(root);
    expect(rest).toHaveLength(0);
    expect(login.textContent).toBe("기관 계정으로 로그인");

    login.click();
    await expect(choice).resolves.toEqual({});
    expect(login.disabled).toBe(true);
    expect(login.textContent).toBe("인증 화면으로 이동 중…");
  });

  it("local-development offers both roles and resolves with the chosen actor", async () => {
    const root = document.createElement("div");
    const choice = showLoginScreen(root, "local-development");

    const [reviewer, approver] = buttons(root);
    if (!approver) throw new Error("approver button missing");
    expect(reviewer.textContent).toBe("심사자로 시작");
    approver.click();
    await expect(choice).resolves.toEqual({ actor: "approver" });
    expect(buttons(root).every((button) => button.disabled)).toBe(true);
  });
});
