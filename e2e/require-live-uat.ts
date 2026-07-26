import type { FullConfig } from "@playwright/test";

export default function requireLiveUat(_config: FullConfig): void {
  if (process.env.CUSTOMS_E2E_LIVE !== "true") {
    throw new Error(
      "Browser E2E requires a running loopback UAT stack and explicit CUSTOMS_E2E_LIVE=true.",
    );
  }
  const baseUrl = new URL(process.env.CUSTOMS_UAT_BASE_URL ?? "http://127.0.0.1:18088");
  if (
    baseUrl.protocol !== "http:"
    || baseUrl.hostname !== "127.0.0.1"
    || baseUrl.username !== ""
    || baseUrl.password !== ""
    || baseUrl.pathname !== "/"
    || baseUrl.search !== ""
    || baseUrl.hash !== ""
  ) {
    throw new Error("Browser E2E requires a credential-free literal loopback UAT origin.");
  }
}
