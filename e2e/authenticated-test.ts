import { expect, test as base, type Page } from "@playwright/test";
import axe from "axe-core";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface UatCredentials {
  username: string;
  password: string;
}

export type UatActorRole = "reviewer" | "approver" | "auditor";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, "..");

function workspaceCredentialsFile(): string {
  let candidateRoot = REPOSITORY_ROOT;
  while (true) {
    if (existsSync(resolve(candidateRoot, "_local"))) {
      return resolve(candidateRoot, "_local", "secrets", "uat", "credentials.json");
    }
    const parent = dirname(candidateRoot);
    if (parent === candidateRoot) {
      throw new Error(
        "Browser E2E workspace credentials are unavailable. Set CUSTOMS_E2E_CREDENTIALS_FILE to an absolute external path.",
      );
    }
    candidateRoot = parent;
  }
}

function requiredCredential(value: unknown, field: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 512
    || /[\r\n\0]/u.test(value)
  ) {
    throw new Error(`Browser E2E ${field} is unavailable or invalid.`);
  }
  return value;
}

async function loadUatCredentials(role: UatActorRole): Promise<UatCredentials> {
  const environmentPrefix = role === "reviewer"
    ? "CUSTOMS_E2E_REVIEWER"
    : role === "approver"
      ? "CUSTOMS_E2E_APPROVER"
      : "CUSTOMS_E2E_AUDITOR";
  const usernameFromEnvironment = process.env[`${environmentPrefix}_USERNAME`];
  const passwordFromEnvironment = process.env[`${environmentPrefix}_PASSWORD`];
  if (usernameFromEnvironment !== undefined || passwordFromEnvironment !== undefined) {
    if (usernameFromEnvironment === undefined || passwordFromEnvironment === undefined) {
      throw new Error(
        `${environmentPrefix}_USERNAME and ${environmentPrefix}_PASSWORD must be provided together.`,
      );
    }
    return {
      username: requiredCredential(usernameFromEnvironment, "username"),
      password: requiredCredential(passwordFromEnvironment, "password"),
    };
  }

  const configuredPath = process.env.CUSTOMS_E2E_CREDENTIALS_FILE;
  const credentialsPath = configuredPath === undefined
    ? workspaceCredentialsFile()
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
      users?: Partial<Record<UatActorRole, { username?: unknown; password?: unknown }>>;
    };
    return {
      username: requiredCredential(parsed.users?.[role]?.username, `${role} username`),
      password: requiredCredential(parsed.users?.[role]?.password, `${role} password`),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Browser E2E credential file is not valid JSON.");
    }
    if (error instanceof Error && error.message.startsWith("Browser E2E")) {
      throw error;
    }
    throw new Error(
      `Browser E2E ${role} credentials are unavailable. Set an external credential file or the paired environment variables.`,
    );
  } finally {
    bytes?.fill(0);
  }
}

export async function loginUatUser(page: Page, role: UatActorRole): Promise<void> {
  const credentials = await loadUatCredentials(role);
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
    // Playwright's isolated init-script world is used for the test-only axe
    // runtime. The product page receives no inline script tag, so the exact
    // strict CSP remains active and is asserted separately in the E2E suite.
    await page.addInitScript({ content: axe.source });
    await page.addInitScript(() => {
      const target = window as typeof window & {
        __customsCspViolations?: Array<{
          blockedUri: string;
          effectiveDirective: string;
          violatedDirective: string;
        }>;
      };
      target.__customsCspViolations = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        target.__customsCspViolations?.push({
          blockedUri: event.blockedURI,
          effectiveDirective: event.effectiveDirective,
          violatedDirective: event.violatedDirective,
        });
      });
    });
    await loginUatUser(page, "reviewer");
    await use();
  }, { auto: true }],
});

export { expect };
