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
    let session: BrowserSession;
    if (__CUSTOMS_RUNTIME_MODE__ === "local-development") {
      const localSession = new LocalDevelopmentSession(
        () => bootstrapClient.createLocalDevelopmentSession(),
      );
      await localSession.start();
      session = localSession;
    } else {
      const { OidcSession } = await import("./functional-oidc");
      const oidc = new OidcSession();
      oidc.configure(await bootstrapClient.getAuthConfig());
      const callbackHandled = await oidc.finishCallbackIfPresent();
      if (!callbackHandled && !oidc.isAuthenticated()) {
        await oidc.login();
        return;
      }
      session = oidc;
    }
    const api = new ApiClient(fetch, session.freshAccessToken);
    await import("./styles.css");
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
    hint.textContent = "문제가 계속되면 화면에 비밀정보를 입력하지 말고 시스템 관리자에게 문의해 주십시오.";
    main.append(title, detail, hint);
    root.replaceChildren(main);
  }
}

void bootstrap();
