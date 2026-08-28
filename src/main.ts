import { ApiClient } from "./api/v1/client";
import { userFacingErrorMessage } from "./api/user-facing-errors";
import {
  LocalDevelopmentSession,
  type BrowserSession,
} from "./auth";

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("Application root is missing");

  const bootstrapClient = new ApiClient();
  try {
    // The stylesheet loads before the login screen so FRAME 00 wears KRDS too.
    await import("./styles.css");
    const { showLoginScreen } = await import("./login");
    let session: BrowserSession;
    if (__CUSTOMS_RUNTIME_MODE__ === "local-development") {
      const localSession = new LocalDevelopmentSession(
        (actor) => bootstrapClient.createLocalDevelopmentSession(actor),
      );
      // Signing in is an explicit choice, including which local role to use.
      const choice = await showLoginScreen(root, "local-development");
      await localSession.start(choice.actor);
      session = localSession;
    } else {
      const { OidcSession } = await import("./functional-oidc");
      const oidc = new OidcSession();
      oidc.configure(await bootstrapClient.getAuthConfig());
      const callbackHandled = await oidc.finishCallbackIfPresent();
      if (!callbackHandled && !oidc.isAuthenticated()) {
        // FRAME 00: the person starts the OIDC redirect, not the page.
        await showLoginScreen(root, "functional-uat");
        await oidc.login();
        return;
      }
      session = oidc;
    }
    root.replaceChildren();
    const api = new ApiClient(fetch, session.freshAccessToken);
    const { LightweightWorkbench } = await import("./workbench");
    const workbench = new LightweightWorkbench(root, api, session, __CUSTOMS_RUNTIME_MODE__);
    await workbench.start();
  } catch (error) {
    const main = document.createElement("main");
    main.id = "main-content";
    main.className = "fatal-state";
    const title = document.createElement("h1");
    title.textContent = "작업대를 시작하지 못했습니다.";
    const detail = document.createElement("p");
    detail.textContent = userFacingErrorMessage(
      error,
      "작업대를 안전하게 시작하지 못했습니다. 잠시 후 다시 시도해 주십시오.",
    );
    const hint = document.createElement("p");
    hint.textContent = "문제가 계속되면 시스템 관리자에게 문의해 주십시오.";
    main.append(title, detail, hint);
    root.replaceChildren(main);
  }
}

void bootstrap();
