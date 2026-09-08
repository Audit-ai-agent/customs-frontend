/**
 * The KRDS login screen (mockup FRAME 00). Signing in is an explicit user
 * action, never an automatic redirect: the person sees what system they are
 * entering, which identity they will use, and what the system does and does
 * not do, before any credential flow starts.
 */
import type { FrontendRuntimeMode } from "./ui/constants";
import type { LocalDevelopmentActor } from "./auth";

export interface LoginChoice {
  /** Set in local-development mode; functional-uat delegates identity to OIDC. */
  actor?: LocalDevelopmentActor;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function showLoginScreen(root: HTMLElement, mode: FrontendRuntimeMode): Promise<LoginChoice> {
  return new Promise((resolve) => {
    const screen = el("div", "login-screen");
    const card = el("main", "login-card");
    card.id = "main-content";

    const brand = el("div", "login-brand");
    const mark = el("div", "seal-mark");
    mark.append(el("span", "", "通"));
    const titles = el("div", "login-title");
    const heading = el("h1", "", "통관 AI 사전심사");
    titles.append(
      heading,
      el("p", "", mode === "functional-uat" ? "실제 기능 UAT 환경" : "팀 개발 환경"),
    );
    brand.append(mark, titles);

    const copy = el(
      "p",
      "login-copy",
      "수입 통관 서류를 Case 단위로 등록하면 AI가 근거를 갖춰 사전심사하고, 판단은 항상 담당자가 확정하는 업무시스템입니다.",
    );

    const actions = el("div", "login-actions");
    const hint = el("p", "login-hint");
    const finish = (choice: LoginChoice, pressed: HTMLButtonElement, busyLabel: string) => {
      for (const button of actions.querySelectorAll("button")) button.disabled = true;
      pressed.textContent = busyLabel;
      resolve(choice);
    };

    if (mode === "functional-uat") {
      const login = el("button", "btn primary login-button", "기관 계정으로 로그인");
      login.type = "button";
      login.addEventListener("click", () => finish({}, login, "인증 화면으로 이동 중…"));
      actions.append(login);
      hint.textContent = "기관 통합 인증(OIDC)으로 이동해 본인 계정으로 로그인합니다.";
    } else {
      const reviewer = el("button", "btn primary login-button", "심사자로 시작");
      reviewer.type = "button";
      reviewer.addEventListener("click", () => finish({ actor: "reviewer" }, reviewer, "세션 준비 중…"));
      const approver = el("button", "btn login-button", "승인자로 시작");
      approver.type = "button";
      approver.addEventListener("click", () => finish({ actor: "approver" }, approver, "세션 준비 중…"));
      actions.append(reviewer, approver);
      hint.textContent = "팀 개발 세션은 이 PC의 Backend가 loopback 호출에만 발급하며, 역할은 이용 중에도 바꿀 수 있습니다.";
    }

    const contact = el("p", "login-hint login-contact", "계정 문제는 시스템 관리자에게 문의하십시오.");
    card.append(brand, copy, actions, hint, contact);
    screen.append(card);
    root.replaceChildren(screen);
    heading.focus?.();
  });
}
