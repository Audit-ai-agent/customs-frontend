import { expect, test as base, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface ReviewerCredentials {
  username: string;
  password: string;
}

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const WORKSPACE_CREDENTIALS_FILE = resolve(
  SCRIPT_DIRECTORY,
  "../../../../_secrets/uat/credentials.json",
);

function requiredCredential(value: unknown, field: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 512
    || /[\r\n\0]/u.test(value)
  ) {
    throw new Error(`Browser E2E reviewer ${field} is unavailable or invalid.`);
  }
  return value;
}

async function loadReviewerCredentials(): Promise<ReviewerCredentials> {
  const usernameFromEnvironment = process.env.CUSTOMS_E2E_REVIEWER_USERNAME;
  const passwordFromEnvironment = process.env.CUSTOMS_E2E_REVIEWER_PASSWORD;
  if (usernameFromEnvironment !== undefined || passwordFromEnvironment !== undefined) {
    if (usernameFromEnvironment === undefined || passwordFromEnvironment === undefined) {
      throw new Error(
        "CUSTOMS_E2E_REVIEWER_USERNAME and CUSTOMS_E2E_REVIEWER_PASSWORD must be provided together.",
      );
    }
    return {
      username: requiredCredential(usernameFromEnvironment, "username"),
      password: requiredCredential(passwordFromEnvironment, "password"),
    };
  }

  const configuredPath = process.env.CUSTOMS_E2E_CREDENTIALS_FILE;
  const credentialsPath = configuredPath === undefined
    ? WORKSPACE_CREDENTIALS_FILE
    : resolve(configuredPath);
  if (configuredPath !== undefined && !isAbsolute(configuredPath)) {
    throw new Error("CUSTOMS_E2E_CREDENTIALS_FILE must be an absolute path outside the repository.");
  }
  const repositoryContainment = relative(REPOSITORY_ROOT, credentialsPath);
  if (
    repositoryContainment !== ".."
    && !repositoryContainment.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    && !isAbsolute(repositoryContainment)
  ) {
    throw new Error("Browser E2E credentials must not be stored inside the Frontend repository.");
  }

  let bytes: Buffer | undefined;
  try {
    bytes = await readFile(credentialsPath);
    const parsed = JSON.parse(bytes.toString("utf8")) as {
      users?: { reviewer?: { username?: unknown; password?: unknown } };
    };
    return {
      username: requiredCredential(parsed.users?.reviewer?.username, "username"),
      password: requiredCredential(parsed.users?.reviewer?.password, "password"),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Browser E2E credential file is not valid JSON.");
    }
    if (error instanceof Error && error.message.startsWith("Browser E2E reviewer")) {
      throw error;
    }
    throw new Error(
      "Browser E2E reviewer credentials are unavailable. Set an external credential file or the paired environment variables.",
    );
  } finally {
    bytes?.fill(0);
  }
}

async function loginReviewer(page: Page): Promise<void> {
  const credentials = await loadReviewerCredentials();
  try {
    await page.goto("/login");
    const loginButton = page.getByTestId("login-button");
    await expect(loginButton).toBeVisible({ timeout: 30_000 });
    await loginButton.click();

    const username = page.locator("#username");
    const password = page.locator("#password");
    const submit = page.locator("#kc-login");
    await expect(username).toBeVisible({ timeout: 30_000 });
    await username.fill(credentials.username);
    await password.fill(credentials.password);
    await submit.click();

    await expect(page.getByTestId("reviews-inbox")).toBeVisible({ timeout: 45_000 });
    await expect(page).toHaveURL(/\/reviews$/u);
  } finally {
    credentials.username = "";
    credentials.password = "";
  }
}

/**
 * Authentication intentionally runs before every test while Playwright trace
 * and video recording remain disabled. The Workbench keeps OAuth tokens only
 * in memory, so a persisted storageState would both be ineffective and weaken
 * the credential boundary.
 */
export const test = base.extend<{ reviewerLogin: void }>({
  reviewerLogin: [async ({ page }, use) => {
    await loginReviewer(page);
    await use();
  }, { auto: true }],
});

export { expect };
