import { createRoot, type Root } from "react-dom/client";
import type { ApiClient } from "./api/v1/client";
import type { BrowserSession } from "./auth";
import { App } from "./ui/App";
import type { FrontendRuntimeMode } from "./ui/constants";
import { WorkbenchStore } from "./ui/store";
import { StoreProvider } from "./ui/useStore";

export type { FrontendRuntimeMode } from "./ui/constants";

/**
 * Browser-only case workspace. It consumes only the Backend v1 API and makes no
 * direct Agent, Data, database, or provider request.
 *
 * The React tree is intentionally not wrapped in StrictMode: the store owns the
 * session lifecycle, and StrictMode's development-only double effect invocation
 * would run the window listeners twice for no benefit here.
 */
export class CommercialReviewWorkspace {
  private readonly store: WorkbenchStore;
  private root: Root | null = null;

  constructor(
    private readonly container: HTMLElement,
    api: ApiClient,
    private readonly auth: BrowserSession,
    mode: FrontendRuntimeMode,
  ) {
    this.store = new WorkbenchStore(api, auth, mode);
  }

  async start(): Promise<void> {
    // Checked before mounting so a failed session leaves the container untouched for
    // main.ts to render its fatal state into.
    if (!this.auth.isAuthenticated()) throw new Error("브라우저 인증 세션을 시작하지 못했습니다.");
    const root = createRoot(this.container);
    this.root = root;
    root.render(
      <StoreProvider value={this.store}>
        <App />
      </StoreProvider>,
    );
    await this.store.start();
  }

  destroy(): void {
    this.store.destroy();
    this.root?.unmount();
    this.root = null;
  }
}

// Kept as the public bootstrap/test name while the UI is now a full workspace.
export const LightweightWorkbench = CommercialReviewWorkspace;
