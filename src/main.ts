import "./styles.css";
import { ApiClient } from "./api/v1/client";
import { OidcSession } from "./auth";
import { createWorkbench } from "./app";

async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("Application root is missing");

  const oidc = new OidcSession();
  const bootstrapClient = new ApiClient();
  try {
    oidc.configure(await bootstrapClient.getAuthConfig());
    await oidc.finishCallbackIfPresent();
    const app = createWorkbench(root, new ApiClient(fetch, oidc.freshAccessToken), oidc);
    await app.start();
  } catch (error) {
    const main = document.createElement("main");
    main.id = "main-content";
    main.className = "fatal-state";
    const title = document.createElement("h1");
    title.textContent = "작업대를 시작하지 못했습니다.";
    const detail = document.createElement("p");
    detail.textContent = error instanceof Error ? error.message : "알 수 없는 초기화 오류";
    const hint = document.createElement("p");
    hint.textContent = "Backend /api/v1/auth/config와 OIDC 설정을 확인하세요.";
    main.append(title, detail, hint);
    root.replaceChildren(main);
  }
}

void bootstrap();
