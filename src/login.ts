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

/** Element with children; strings become text nodes (no HTML parsing). */
function h(tag: keyof HTMLElementTagNameMap, className: string, ...children: (Node | string)[]): HTMLElement {
  const node = el(tag, className);
  node.append(...children);
  return node;
}

/**
 * Static product introduction on the left half. The preview card is an
 * illustration of the workbench (fixed sample values), not live data.
 */
function buildHero(): HTMLElement {
  const row = (label: string, value: string, tag: string, tone: string) =>
    h("div", "login-preview__row", h("span", "", label), h("b", "", value), h("em", `is-${tone}`, tag));
  const doc = (name: string) => h("div", "", h("b", "", name), h("span", "", "추출 완료"));
  const feat = (title: string, text: string) => h("li", "", h("b", "", title), h("span", "", text));

  const mark = el("div", "login-hero__mark");
  mark.setAttribute("aria-hidden", "true");
  const headline = h("p", "login-hero__headline", "수입 통관 서류,", el("br", ""), "AI가 먼저 살피고", el("br", ""), "담당자가 확정합니다.");
  const preview = h(
    "div",
    "login-preview",
    h("div", "login-preview__top", h("span", "login-preview__dots", el("i", ""), el("i", ""), el("i", "")), h("b", "", "심사 작업대"), h("span", "", "예시 Case · 냉동 새우")),
    h(
      "div",
      "login-preview__body",
      h("div", "login-preview__docs", doc("B/L"), doc("Invoice"), doc("P/L"), doc("C/O")),
      row("교차검증", "6개 필드 대조", "중량 불일치 1건", "bad"),
      row("HS 분류", "0306.17-0000", "근거 3건", "ok"),
      row("통관 요건", "검역 대상 품목", "확인 필요", "warn"),
      h(
        "div",
        "login-preview__verdict",
        h("div", "", h("b", "", "AI 권고 · 검토 필요"), h("small", "", "불일치 1건과 요건 1건을 담당자가 확인해 주세요.")),
        h("span", "", "검토 열기"),
      ),
    ),
  );
  preview.setAttribute("aria-hidden", "true");

  return h(
    "section",
    "login-hero",
    h("div", "login-hero__brand", mark, h("div", "", h("strong", "", "통관 AI 사전심사"), h("small", "", "Customs-Fit 업무시스템"))),
    h(
      "div",
      "login-hero__copy",
      headline,
      h("p", "", "서류 대조와 근거 찾기는 AI가 먼저 끝내 둡니다. 담당자는 판단에만 집중하세요."),
    ),
    preview,
    h(
      "ul",
      "login-hero__feats",
      feat("서류 자동 추출", "양식이 달라도 품목·중량·금액을 정형 데이터로 정리"),
      feat("서류 간 교차검증", "같은 항목의 값이 서류마다 다르면 바로 표시"),
      feat("근거 있는 권고", "HS 분류와 요건마다 법령·해설서 출처 연결"),
    ),
  );
}

export function showLoginScreen(root: HTMLElement, mode: FrontendRuntimeMode): Promise<LoginChoice> {
  return new Promise((resolve) => {
    const screen = el("div", "login-screen");
    const hero = buildHero();

    const side = el("main", "login-side");
    side.id = "main-content";
    const panel = el("div", "login-panel");
    const heading = el("h1", "", "로그인");
    const copy = el(
      "p",
      "login-copy",
      mode === "functional-uat"
        ? "기관 계정으로 로그인해 배정된 Case를 확인하세요."
        : "팀 개발 환경입니다. 시작할 역할을 고르세요.",
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
      hint.textContent = "기관 통합 인증(OIDC) 페이지로 이동합니다.";
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

    const notes = el("ul", "login-notes");
    notes.append(
      el("li", "login-notes__ai", "AI는 권고만 하고, 최종 판단은 항상 담당자가 확정합니다."),
      el("li", "login-notes__help", "계정 문제는 시스템 관리자에게 문의하십시오."),
    );
    // Shown only after the runtime config loaded, i.e. the Backend answered.
    const status = h("p", "login-status", el("i", ""), "시스템 정상 운영 중");
    panel.append(heading, copy, actions, hint, notes, status);
    const link = (text: string) => {
      const a = el("a", "", text);
      a.href = "#";
      return a;
    };
    side.append(
      h("nav", "login-side__top", link("이용 안내"), link("문의")),
      panel,
      h("footer", "login-side__foot", h("span", "", "© Customs-Fit"), link("개인정보 처리방침")),
    );
    screen.append(hero, side);
    root.replaceChildren(screen);
    heading.focus?.();
  });
}
