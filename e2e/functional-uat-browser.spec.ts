import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  FUNCTIONAL_UAT_BROWSER_CHECKS,
  loadFunctionalUatBrowserEnvironment,
  writeFunctionalUatBrowserReceipt,
  type FunctionalUatBrowserCheck,
} from "./functional-uat-environment";

const environment = loadFunctionalUatBrowserEnvironment();
const RUN_ID = /^run_[0-9a-f]{32}$/u;

const MISMATCH_INVOICE = [
  "COMMERCIAL INVOICE",
  "Invoice No: INV-BROWSER-E2E-001",
  "Total Amount: USD 30",
  "Country of Origin: KR",
  "Description: Frozen mackerel | HS Code: 0303540000 | Quantity: 3 PCS | Unit: PCS | Unit Price: USD 10 | Amount: USD 25",
].join("\n");
const MISMATCH_PACKING = [
  "PACKING LIST",
  "Packing No: PL-BROWSER-E2E-001",
  "B/L No: BL-BROWSER-E2E-001",
  "Container No: ABCD1234567",
  "Total Gross Weight: 100 KG",
  "Description: Frozen mackerel | HS Code: 0303540000 | Quantity: 2 PCS | Unit: PCS | Gross Weight: 100 KG",
].join("\n");
const MISMATCH_ORIGIN = "CERTIFICATE OF ORIGIN\nCertificate No: COO-BROWSER-E2E-001\nOrigin Country: CN\nHS Code: 0303540000";
const MISMATCH_BILL = "BILL OF LADING\nB/L No: BL-BROWSER-E2E-002\nContainer No: EFGH7654321\nGross Weight: 120 KG";
const REPLACEMENT_INVOICE = [
  "COMMERCIAL INVOICE",
  "Invoice No: INV-BROWSER-E2E-REPLACED",
  "Total Amount: USD 30",
  "Country of Origin: KR",
  "Description: Frozen mackerel | HS Code: 0303540000 | Quantity: 3 PCS | Unit: PCS | Unit Price: USD 10 | Amount: USD 30",
].join("\n");

test.describe.configure({ mode: "serial" });

test("실제 기능 UAT에서 사건 작업대의 사람 검토 여정을 완료한다", async ({ browser }) => {
  const checks = new Set<FunctionalUatBrowserCheck>();
  const networkBoundary = createNetworkBoundary();
  const caseTitle = `Browser functional UAT ${Date.now()}`;
  let parentRunId = "";
  let childRunId = "";
  let replacementRunId = "";

  await test.step("심사자 로그인과 사건·문서 등록", async () => {
    const reviewer = await signedInPage(browser, "reviewer", networkBoundary);
    try {
      checks.add("reviewer_login");
      await createCase(reviewer, caseTitle);
      checks.add("case_created");

      await addDocument(reviewer, {
        documentType: "CI",
        filename: "browser-e2e-mismatch-invoice.txt",
        content: MISMATCH_INVOICE,
        asFile: true,
      });
      await addDocument(reviewer, { documentType: "PL", filename: "browser-e2e-mismatch-packing.txt", content: MISMATCH_PACKING });
      await addDocument(reviewer, { documentType: "CO", filename: "browser-e2e-mismatch-origin.txt", content: MISMATCH_ORIGIN });
      await addDocument(reviewer, { documentType: "BL", filename: "browser-e2e-mismatch-bl.txt", content: MISMATCH_BILL });
      checks.add("document_registered");

      await runReview(reviewer);
      checks.add("review_completed");
      await expect(reviewer.locator('[data-e2e="analysis-content"]')).toBeVisible();
      await expect(reviewer.locator("[data-report-section]")).toHaveCount(8);
      checks.add("analysis_displayed");

      await reviewer.locator('[data-e2e="workspace-tab-evidence"]').click();
      await expect(reviewer.locator('[data-e2e="evidence-content"]')).toBeVisible();
      await expect(reviewer.locator('[data-e2e="evidence-card"]').first()).toBeVisible();
      checks.add("evidence_displayed");

      await reviewer.locator('[data-e2e="workspace-tab-analysis"]').click();
      const evidenceCitation = reviewer.getByRole("button", { name: /^Evidence · /u }).first();
      await expect(evidenceCitation).toBeVisible();
      await evidenceCitation.click();
      await expect(reviewer.locator('[data-e2e="evidence-content"]')).toBeVisible();
      checks.add("citation_navigation");

      await reviewer.locator('[data-e2e="workspace-tab-assistant"]').click();
      await expect(reviewer.locator('[data-e2e="assistant-create"]')).toBeVisible();
      await reviewer.locator('[data-e2e="assistant-create"]').click();
      const assistantForm = reviewer.locator('[data-e2e="assistant-form"]');
      await expect(assistantForm).toBeVisible();
      await assistantForm.locator('textarea[name="assistant_message"]').fill("현재 Case의 문서 비교 결과와 확인할 사항을 간단히 설명해 주세요.");
      await assistantForm.getByRole("button", { name: "질문 보내기" }).click();
      await expect(reviewer.locator('[data-e2e="assistant-message"][data-message-role="assistant"]')).toHaveCount(1);
      checks.add("assistant_conversation");

      await reviewer.locator('[data-e2e="workspace-tab-analysis"]').click();
      const finding = reviewer.locator('[data-e2e="finding-card"]:has(.correction-proposal-panel)').first();
      await expect(finding).toBeVisible();
      await recordFindingDecision(finding);
      checks.add("finding_decision");
      await recordCorrectionProposal(finding);
      await openHistory(reviewer);
      await expect(reviewer.locator('[data-e2e="correction-card"]')).toHaveCount(1);
      checks.add("correction_proposed");
      parentRunId = await selectedRunId(reviewer);
    } finally {
      await reviewer.context().close();
    }
  });

  await test.step("독립 승인과 자식 심사", async () => {
    const approver = await signedInPage(browser, "approver", networkBoundary);
    try {
      checks.add("approver_login");
      await openCase(approver, caseTitle);
      await openHistory(approver);
      const proposal = approver.locator('[data-e2e="correction-card"]').first();
      await expect(proposal).toBeVisible();
      await decideCorrectionProposal(proposal);
      checks.add("correction_approved");

      const selection = proposal.locator('[data-e2e="correction-select"]');
      await expect(selection).toBeVisible();
      await selection.check();
      await approver.locator('[data-e2e="revision-start"]').click();
      await expect(approver.locator('[data-e2e="analysis-content"]')).toBeVisible();
      await openHistory(approver);
      const child = approver.locator('[data-e2e="review-run"].is-selected');
      childRunId = await reviewRunId(child);
      await expect(child).toHaveAttribute("data-parent-review-run-id", parentRunId);
      checks.add("child_review_completed");
    } finally {
      await approver.context().close();
    }
  });

  await test.step("문서 보완과 새 심사 이력", async () => {
    const reviewer = await signedInPage(browser, "reviewer", networkBoundary);
    try {
      await openCase(reviewer, caseTitle);
      await reviewer.locator('[data-e2e="workspace-tab-documents"]').click();
      await addDocument(reviewer, {
        documentType: "CI",
        filename: "browser-e2e-replacement-invoice.txt",
        content: REPLACEMENT_INVOICE,
        replacesFilename: "browser-e2e-mismatch-invoice.txt",
      });
      checks.add("document_replaced");

      await runReview(reviewer);
      await openHistory(reviewer);
      replacementRunId = await selectedRunId(reviewer);
      if (replacementRunId === parentRunId || replacementRunId === childRunId) {
        throw new Error("functional_uat_browser_replacement_run_not_new");
      }
      checks.add("replacement_review_completed");
    } finally {
      await reviewer.context().close();
    }
  });

  networkBoundary.assertValid();
  checks.add("backend_only_network");
  const orderedChecks = FUNCTIONAL_UAT_BROWSER_CHECKS.filter((check) => checks.has(check));
  if (orderedChecks.length !== FUNCTIONAL_UAT_BROWSER_CHECKS.length) {
    throw new Error("functional_uat_browser_checks_incomplete");
  }
  await writeFunctionalUatBrowserReceipt(environment, {
    schema_version: "functional-uat-browser-e2e/v1",
    status: "passed",
    profile: "functional-uat",
    base_url: environment.baseUrl,
    checks: orderedChecks,
    review_run_ids: [parentRunId, childRunId, replacementRunId],
    browser_api_origins: [environment.baseUrl],
  });
});

async function signedInPage(
  browser: Browser,
  actor: "reviewer" | "approver",
  networkBoundary: NetworkBoundary,
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  networkBoundary.attach(page);
  await page.goto(environment.baseUrl);
  await expect(page.locator('input[name="username"]')).toBeVisible();
  await page.locator('input[name="username"]').fill(actor === "reviewer" ? environment.reviewerUsername : environment.approverUsername);
  await page.locator('input[name="password"]').fill(actor === "reviewer" ? environment.reviewerPassword : environment.approverPassword);
  await page.locator("#kc-login").click();
  await expect(page.locator('[data-e2e="workspace-root"]')).toBeVisible();
  return page;
}

async function createCase(page: Page, title: string): Promise<void> {
  const panel = page.locator('[data-e2e="case-create-panel"]');
  await expect(panel).toBeVisible();
  if (!(await panel.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await panel.locator("summary").click();
  }
  const form = page.locator('[data-e2e="case-create-form"]');
  await form.locator('input[name="title"]').fill(title);
  await form.locator('input[name="reference"]').fill("Browser E2E");
  await form.getByRole("button", { name: "새 Case 만들기" }).click();
  await expect(page.locator('[data-e2e="case-workspace"]')).toBeVisible();
}

async function openCase(page: Page, title: string): Promise<void> {
  const card = page.locator('[data-e2e="case-card"]', { hasText: title });
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page.locator('[data-e2e="case-workspace"]')).toBeVisible();
}

async function addDocument(
  page: Page,
  input: {
    documentType: "CI" | "PL" | "BL" | "CO";
    filename: string;
    content: string;
    asFile?: boolean;
    replacesFilename?: string;
  },
): Promise<void> {
  const panel = page.locator('[data-e2e="document-add-panel"]');
  await expect(panel).toBeVisible();
  if (!(await panel.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await panel.locator("summary").click();
  }
  const form = page.locator('[data-e2e="document-form"]');
  await form.locator('select[name="document_type"]').selectOption(input.documentType);
  await form.locator('input[name="filename"]').fill(input.filename);
  if (input.replacesFilename) {
    await form.locator('select[name="replaces_document_id"]').selectOption({ label: `CI · ${input.replacesFilename}` });
  }
  if (input.asFile) {
    await form.locator('input[name="text_file"]').setInputFiles({
      name: input.filename,
      mimeType: "text/plain",
      buffer: Buffer.from(input.content, "utf8"),
    });
  } else {
    await form.locator('textarea[name="content_text"]').fill(input.content);
  }
  await form.getByRole("button", { name: "텍스트 문서 등록" }).click();
  await expect(page.locator('[data-e2e="document-row"]', { hasText: input.filename })).toHaveCount(1);
}

async function runReview(page: Page): Promise<void> {
  await page.locator('[data-e2e="review-start"]').click();
  await expect(page.locator('[data-e2e="analysis-content"]')).toBeVisible();
}

async function openHistory(page: Page): Promise<void> {
  await page.locator('[data-e2e="workspace-tab-history"]').click();
  await expect(page.locator('[data-e2e="history-content"]')).toBeVisible();
}

async function recordFindingDecision(finding: ReturnType<Page["locator"]>): Promise<void> {
  const panel = finding.locator(".decision-panel");
  if (!(await panel.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await panel.locator("summary").click();
  }
  const form = finding.locator('[data-e2e="finding-decision"]');
  await expect(form).toBeVisible();
  await form.locator('select[name="status"]').selectOption("confirmed");
  await form.locator('textarea[name="reason"]').fill("Browser Functional-UAT에서 문서 비교 결과를 확인했습니다.");
  await form.getByRole("button", { name: /판단 (기록|수정)/u }).click();
  await expect(panel.locator(".decision-current")).toHaveCount(1);
  if (!(await panel.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await panel.locator("summary").click();
  }
  await expect(panel.locator(".decision-current")).toBeVisible();
}

async function recordCorrectionProposal(finding: ReturnType<Page["locator"]>): Promise<void> {
  const panel = finding.locator(".correction-proposal-panel");
  await expect(panel).toBeVisible();
  if (!(await panel.evaluate((node) => (node as HTMLDetailsElement).open))) {
    await panel.locator("summary").click();
  }
  const form = finding.locator('[data-e2e="correction-proposal"]');
  await expect(form).toBeVisible();
  await form.locator('input[name="field_name"]').fill("invoice_number");
  await form.locator('textarea[name="new_value"]').fill("INV-BROWSER-E2E-CORRECTED");
  await form.locator('textarea[name="reason"]').fill("Browser Functional-UAT 독립 승인 흐름 확인용 구조화 정정 제안입니다.");
  await form.getByRole("button", { name: "정정 제안 기록" }).click();
  await expect(form.locator('input[name="field_name"]')).toHaveValue("");
}

async function decideCorrectionProposal(proposal: ReturnType<Page["locator"]>): Promise<void> {
  const form = proposal.locator('[data-e2e="correction-decision"]');
  await expect(form).toBeVisible();
  await form.locator('select[name="status"]').selectOption("approved");
  await form.locator('textarea[name="reason"]').fill("Browser Functional-UAT에서 독립 검토를 완료했습니다.");
  await form.getByRole("button", { name: "결정 기록" }).click();
  await expect(proposal).toContainText("승인됨");
}

async function selectedRunId(page: Page): Promise<string> {
  return reviewRunId(page.locator('[data-e2e="review-run"].is-selected'));
}

async function reviewRunId(locator: ReturnType<Page["locator"]>): Promise<string> {
  await expect(locator).toHaveCount(1);
  const runId = await locator.getAttribute("data-review-run-id");
  if (!runId || !RUN_ID.test(runId)) throw new Error("functional_uat_browser_review_run_id_invalid");
  return runId;
}

interface NetworkBoundary {
  attach(page: Page): void;
  assertValid(): void;
}

function createNetworkBoundary(): NetworkBoundary {
  const violations = new Set<string>();
  return {
    attach(page) {
      page.on("request", (request) => {
        try {
          const target = new URL(request.url());
          if (target.port === "18083" || target.port === "18090" || target.pathname.startsWith("/internal/")) {
            violations.add("functional_uat_browser_direct_agent_or_data_request");
          }
          if (target.pathname.startsWith("/api/v1") && target.origin !== environment.baseUrl) {
            violations.add("functional_uat_browser_bypassed_backend_proxy");
          }
        } catch {
          violations.add("functional_uat_browser_invalid_request_url");
        }
      });
    },
    assertValid() {
      if (violations.size) throw new Error([...violations].sort().join(","));
    },
  };
}
