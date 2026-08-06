import { defineConfig } from "@playwright/test";
import { loadFunctionalUatBrowserEnvironment } from "./e2e/functional-uat-environment";

const environment = loadFunctionalUatBrowserEnvironment();

/**
 * Explicit local Functional-UAT only. It never starts a service or downloads
 * a browser: the developer's installed Microsoft Edge is the sole browser.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "functional-uat-browser.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60 * 1_000,
  expect: { timeout: 180_000 },
  outputDir: environment.transientOutputPath,
  globalTeardown: "./e2e/functional-uat-teardown.ts",
  reporter: [["dot"]],
  use: {
    browserName: "chromium",
    channel: "msedge",
    headless: true,
    screenshot: "off",
    video: "off",
    trace: "off",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    baseURL: environment.baseUrl,
  },
});
