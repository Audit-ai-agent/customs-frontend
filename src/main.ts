import { ApiClient } from "./api/v1/client";
import { userFacingErrorMessage } from "./api/user-facing-errors";
import { OidcSession } from "./auth";
import { enhancedExperienceEnabled } from "./experience/feature-flags";

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("Application root is missing");

  const oidc = new OidcSession();
  const bootstrapClient = new ApiClient();
  try {
    oidc.configure(await bootstrapClient.getAuthConfig());
    const callbackHandled = await oidc.finishCallbackIfPresent();
    if (!callbackHandled && await oidc.tryCookieSessionRestore()) return;
    const api = new ApiClient(fetch, oidc.freshAccessToken);
    if (enhancedExperienceEnabled()) {
      const { mountCommercialWorkbench } = await import("./experience/bootstrap");
      mountCommercialWorkbench(root, api, oidc);
    } else {
      await import("./styles.css");
      const { createWorkbench } = await import("./app");
      const app = createWorkbench(root, api, oidc);
      await app.start();
    }
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
