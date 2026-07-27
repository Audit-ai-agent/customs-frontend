import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.CUSTOMS_UAT_BASE_URL ?? "http://127.0.0.1:18088";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/require-live-uat.ts",
  outputDir: "test-results/playwright",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/playwright/results.json" }]],
  use: {
    baseURL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    // OIDC credentials are entered before every test because access tokens are
    // deliberately memory-only. Recording that interaction is prohibited.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "chrome-1440",
      grep: /@(primary|responsive)/u,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "edge-1024",
      grep: /@responsive/u,
      use: {
        ...devices["Desktop Edge"],
        channel: "msedge",
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "chrome-mobile-390",
      grep: /@responsive/u,
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
