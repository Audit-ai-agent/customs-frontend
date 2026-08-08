import { expect, test, type Browser, type Page } from "@playwright/test";
import { requiresControlledNarrative, requiresControlledStructuredValue } from "../src/presentation";
import {
  FUNCTIONAL_UAT_BROWSER_CHECKS,
  FUNCTIONAL_UAT_KEYCLOAK_ORIGIN,
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
const EXPORT_INVOICE = [
  "COMMERCIAL INVOICE",
  "Invoice No: INV-BROWSER-EXPORT-001",
  "Total Amount: USD 20",
  "Country of Origin: KR",
  "Description: Widget | HS Code: 0303540000 | Quantity: 2 PCS | Unit: PCS | Unit Price: USD 10 | Amount: USD 20",
].join("\n");
const EXPORT_PACKING = [
  "PACKING LIST",
  "Packing No: PL-BROWSER-EXPORT-001",
  "AWB No: AWB-BROWSER-EXPORT-001",
  "Total Gross Weight: 100 KG",
  "Description: Widget | HS Code: 0303540000 | Quantity: 2 PCS | Unit: PCS",
].join("\n");
const EXPORT_ORIGIN = "CERTIFICATE OF ORIGIN\nCertificate No: COO-BROWSER-EXPORT-001\nOrigin Country: KR\nHS Code: 0303540000";
const EXPORT_AWB = "AIR WAYBILL\nAWB No: AWB-BROWSER-EXPORT-001\nGross Weight: 100 KG";
const EXPORT_DECLARATION = [
  "EXPORT DECLARATION",
  "Export Declaration No: ED-BROWSER-EXPORT-001",
  "Filing Date: 2026-08-05",
  "Submission Status: Accepted",
  "Invoice No: INV-BROWSER-EXPORT-001",
  "Total Amount: USD 20",
  "Origin Country: KR",
  "Destination Country: US",
  "Description: Widget | HS Code: 0303540000 | Quantity: 2 PCS | Unit: PCS | Unit Price: USD 10 | Amount: USD 20",
].join("\n");
const EXPORT_SUPPORTING_EVIDENCE = "SUPPORTING EVIDENCE\nReceipt No: RECEIPT-BROWSER-EXPORT-001\nSubmission Date: 2026-08-05\nSubmission Status: Accepted";

test.describe.configure({ mode: "serial" });

test("실제 기능 UAT에서 사건 작업대의 사람 검토 여정을 완료한다", async ({ browser }) => {
  const checks = new Set<FunctionalUatBrowserCheck>();
  const networkBoundary = createNetworkBoundary();
  const caseTitle = `브라우저 기능 검증 ${Date.now()}`;
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

      await assertKoreanUserProse(reviewer, '[data-e2e="analysis-content"]');
      checks.add("korean_user_prose");
      await assertRawFilenameHidden(reviewer, '[data-e2e="analysis-content"]');
      checks.add("raw_filename_hidden");
      await expect(reviewer.locator('[data-e2e="regulatory-requirement-card"]')).toHaveCount(1);
      await expect(reviewer.locator('[data-e2e="regulatory-required-action"]')).toHaveCount(1);
      checks.add("regulatory_requirement_deduplicated");

      await reviewer.locator('[data-e2e="workspace-tab-evidence"]').click();
      await expect(reviewer.locator('[data-e2e="evidence-content"]')).toBeVisible();
      await expect(reviewer.locator('[data-e2e="evidence-card"]').first()).toBeVisible();
      checks.add("evidence_displayed");
      const retrievalStatus = reviewer.locator('[data-e2e="data-retrieval-status"]');
      await expect(retrievalStatus).toHaveAttribute("data-retrieval-semantics", "retrieval-complete");
      await expect(retrievalStatus).not.toContainText("Data Evidence 일부가 준비되지 않아");
      checks.add("data_retrieval_semantics");

      await reviewer.locator('[data-e2e="workspace-tab-analysis"]').click();
      const evidenceCitation = reviewer.getByRole("button", { name: "법령 근거 보기" }).first();
      await expect(evidenceCitation).toBeVisible();
      await evidenceCitation.click();
      await expect(reviewer.locator('[data-e2e="evidence-content"]')).toBeVisible();
      checks.add("citation_navigation");

      await reviewer.locator('[data-e2e="workspace-tab-assistant"]').click();
      await expect(reviewer.locator('[data-e2e="assistant-create"]')).toBeVisible();
      await reviewer.locator('[data-e2e="assistant-create"]').click();
      const assistantForm = reviewer.locator('[data-e2e="assistant-form"]');
      await expect(assistantForm).toBeVisible();
      await assistantForm.locator('textarea[name="assistant_message"]').fill("현재 사건의 문서 비교 결과와 일반 통관 절차를 함께 설명해 주세요.");
      await assistantForm.getByRole("button", { name: "질문 보내기" }).click();
      await expect(reviewer.locator('[data-e2e="assistant-message"][data-message-role="assistant"]')).toHaveCount(1);
      await assertKoreanUserProse(reviewer, '[data-e2e="assistant-message"][data-message-role="assistant"]');
      await assertRawFilenameHidden(reviewer, '[data-e2e="assistant-message"][data-message-role="assistant"]');
      checks.add("assistant_conversation");
      await expect(reviewer.locator('[data-e2e="answer-section-case_analysis"]')).toHaveCount(1);
      await expect(reviewer.locator('[data-e2e="answer-section-general_guidance"]')).toHaveCount(1);
      await expect(reviewer.locator('[data-e2e="answer-section-case_analysis"]')).toContainText("현재 사건 기준");
      await expect(reviewer.locator('[data-e2e="answer-section-general_guidance"]')).toContainText("일반 통관 안내");
      checks.add("assistant_mixed_sections");

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

  await test.step("독립 승인과 수정 반영 재심사", async () => {
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
      await waitForReviewPresentation(approver);
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

  await test.step("사건과 분리된 공식 통관 지식 대화", async () => {
    const reviewer = await signedInPage(browser, "reviewer", networkBoundary);
    try {
      await reviewer.goto(`${environment.baseUrl}/#/knowledge`);
      await expect(reviewer.locator('[data-e2e="knowledge-workspace-root"]')).toBeVisible();
      await expect(reviewer.locator('[data-e2e="knowledge-workspace"]')).toBeVisible();
      await reviewer.locator('[data-e2e="knowledge-create"]').click();
      const form = reviewer.locator('[data-e2e="knowledge-form"]');
      await expect(form).toBeVisible();
      await form.locator('textarea[name="knowledge_message"]').fill("인코텀즈 조건의 기본 차이와 확인할 책임을 알려 주세요.");
      await form.getByRole("button", { name: "질문 보내기" }).click();

      const answers = reviewer.locator('[data-e2e="knowledge-message"][data-message-role="assistant"]');
      await expect(answers).toHaveCount(1);
      await assertKoreanUserProse(reviewer, '[data-e2e="knowledge-message"][data-message-role="assistant"]');
      await assertRawFilenameHidden(reviewer, '[data-e2e="knowledge-message"][data-message-role="assistant"]');
      checks.add("knowledge_conversation");

      await assertOfficialKnowledgeSnapshot(answers.first());
      checks.add("knowledge_official_provenance");

      await assertVerificationDetailsClosed(answers.first());
      await assertNoTechnicalIdentifierInDefaultMessage(answers.first());
      checks.add("knowledge_default_boundary");

      // The active snapshot covers this `trade_terms` prompt through its
      // registered KOTRA source.  Send a second safe prompt in the same room
      // to verify persisted recent history without putting either question,
      // a conversation ID, or a response body in the compact receipt.
      const knowledgeConversations = reviewer.locator('[data-e2e="knowledge-conversation"]');
      const selectedConversation = reviewer.locator('[data-e2e="knowledge-conversation"][aria-current="page"]');
      await expect(selectedConversation).toHaveCount(1);
      const conversationCount = await knowledgeConversations.count();
      const selectedConversationTitle = await selectedConversation.locator("strong").innerText();
      await form.locator('textarea[name="knowledge_message"]').fill("FOB와 CIF 조건을 검토할 때 공식 안내에서 확인할 항목도 알려 주세요.");
      await form.getByRole("button", { name: "질문 보내기" }).click();

      await expect(answers).toHaveCount(2);
      await expect(reviewer.locator('[data-e2e="knowledge-message"][data-message-role="user"]')).toHaveCount(2);
      await expect(knowledgeConversations).toHaveCount(conversationCount);
      await expect(selectedConversation.locator("strong")).toHaveText(selectedConversationTitle);
      const recentAnswer = answers.nth(1);
      await assertKoreanUserProse(reviewer, '[data-e2e="knowledge-message"][data-message-role="assistant"]');
      await assertRawFilenameHidden(reviewer, '[data-e2e="knowledge-message"][data-message-role="assistant"]');
      await assertOfficialKnowledgeSnapshot(recentAnswer);
      await assertVerificationDetailsClosed(recentAnswer);
      await assertNoTechnicalIdentifierInDefaultMessage(recentAnswer);
      checks.add("knowledge_recent_history");
    } finally {
      await reviewer.context().close();
    }
  });

  await test.step("수출 문서와 부분 근거 범위를 사람 검토로 표시", async () => {
    const reviewer = await signedInPage(browser, "reviewer", networkBoundary);
    try {
      const exportCaseTitle = `브라우저 수출 기능 검증 ${Date.now()}`;
      await createCase(reviewer, exportCaseTitle);
      await addDocument(reviewer, { documentType: "CI", filename: "browser-e2e-export-invoice.txt", content: EXPORT_INVOICE });
      await addDocument(reviewer, { documentType: "PL", filename: "browser-e2e-export-packing-list.txt", content: EXPORT_PACKING });
      await addDocument(reviewer, { documentType: "CO", filename: "browser-e2e-export-origin.txt", content: EXPORT_ORIGIN });
      await addDocument(reviewer, { documentType: "AWB", filename: "browser-e2e-export-awb.txt", content: EXPORT_AWB });
      await addDocument(reviewer, { documentType: "EXPORT_DECLARATION", filename: "browser-e2e-export-declaration.txt", content: EXPORT_DECLARATION });
      await addDocument(reviewer, { documentType: "SUPPORTING_EVIDENCE", filename: "browser-e2e-export-supporting-evidence.txt", content: EXPORT_SUPPORTING_EVIDENCE });
      await expect(reviewer.locator('[data-e2e="document-row"]', { hasText: "항공화물운송장" })).toHaveCount(1);
      await expect(reviewer.locator('[data-e2e="document-row"]', { hasText: "수출신고필증" })).toHaveCount(1);
      await expect(reviewer.locator('[data-e2e="document-row"]', { hasText: "요건·보완 증빙" })).toHaveCount(1);
      checks.add("export_document_registered");

      await runReview(reviewer, "export");
      const executionStatus = reviewer.locator('[data-e2e="review-execution-status"]');
      const reviewDisposition = reviewer.locator('[data-e2e="review-disposition"]');
      await expect(executionStatus).toHaveAttribute("data-review-execution-status", "partial");
      await expect(executionStatus).toHaveText("일부 항목 확인 필요");
      await expect(reviewDisposition).toHaveAttribute("data-review-disposition", "human_review_required");
      await expect(reviewDisposition).toHaveText("담당자 확인 필요");
      await reviewer.locator('[data-e2e="workspace-tab-evidence"]').click();
      const retrievalStatus = reviewer.locator('[data-e2e="data-retrieval-status"]');
      await expect(retrievalStatus).toHaveAttribute("data-retrieval-semantics", "retrieval-partial");
      await expect(retrievalStatus).toContainText("일부 품목의 법령 근거를 확인하지 못했습니다.");
      checks.add("export_partial_coverage");
      checks.add("export_human_review_required");
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
  await expect(page.getByText("통관 AI 사전심사 작업대", { exact: true })).toBeVisible();
  const username = page.locator('input[name="username"]');
  const password = page.locator('input[name="password"]');
  const login = page.locator("#kc-login");
  await expect(username).toBeVisible();
  await expect(username).toHaveAccessibleName(/^(사용자 이름|사용자 이름 또는 이메일)$/u);
  await expect(password).toBeVisible();
  await expect(password).toHaveAccessibleName("비밀번호");
  await expect(login).toBeVisible();
  await expect(login).toHaveAccessibleName("로그인");
  await username.fill(actor === "reviewer" ? environment.reviewerUsername : environment.approverUsername);
  await password.fill(actor === "reviewer" ? environment.reviewerPassword : environment.approverPassword);
  await login.click();
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
  await form.getByRole("button", { name: "새 심사 건 등록" }).click();
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
    documentType: "CI" | "PL" | "BL" | "CO" | "AWB" | "EXPORT_DECLARATION" | "SUPPORTING_EVIDENCE";
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
  const documentRows = page.locator('[data-e2e="document-row"]');
  const beforeCount = await documentRows.count();
  await form.locator('select[name="document_type"]').selectOption(input.documentType);
  await form.locator('input[name="filename"]').fill(input.filename);
  if (input.replacesFilename) {
    await form.locator('select[name="replaces_document_id"]').selectOption({ label: "상업송장" });
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
  await expect(documentRows).toHaveCount(beforeCount + 1);
}

async function runReview(page: Page, tradeType: "import" | "export" = "import"): Promise<void> {
  await page.locator('select[name="review_trade_type"]').selectOption(tradeType);
  await page.locator('[data-e2e="review-start"]').click();
  await waitForReviewPresentation(page);
}

async function waitForReviewPresentation(page: Page): Promise<void> {
  const analysis = page.locator('[data-e2e="analysis-content"]');
  const alert = page.locator('[role="alert"]').first();
  let outcome: "analysis" | "alert";
  try {
    outcome = await Promise.race([
      analysis.waitFor({ state: "visible", timeout: 90_000 }).then(() => "analysis" as const),
      alert.waitFor({ state: "visible", timeout: 90_000 }).then(() => "alert" as const),
    ]);
  } catch {
    throw new Error("functional_uat_browser_result_display_timed_out");
  }
  if (outcome === "analysis") return;
  const message = await alert.textContent();
  if (message?.includes("심사 결과가 아직 화면에 준비되지 않았습니다.")) {
    throw new Error("functional_uat_browser_result_visibility_timed_out");
  }
  throw new Error("functional_uat_browser_result_display_failed");
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
  await form.locator('textarea[name="reason"]').fill("브라우저 기능 검증에서 문서 비교 결과를 확인했습니다.");
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
  await expect(form.locator('input[name="field_name"]')).not.toHaveValue("");
  await expect(form.locator('input[name="field_name"]')).toHaveAttribute("readonly", "");
  await form.locator('textarea[name="new_value"]').fill("INV-BROWSER-E2E-CORRECTED");
  await form.locator('textarea[name="reason"]').fill("브라우저 기능 검증의 독립 승인 흐름을 확인하기 위한 구조화 정정 제안입니다.");
  await form.getByRole("button", { name: "정정 제안 기록" }).click();
  await expect(form.locator('textarea[name="new_value"]')).toHaveValue("");
  await expect(form.locator('textarea[name="reason"]')).toHaveValue("");
}

async function decideCorrectionProposal(proposal: ReturnType<Page["locator"]>): Promise<void> {
  const form = proposal.locator('[data-e2e="correction-decision"]');
  await expect(form).toBeVisible();
  await form.locator('select[name="status"]').selectOption("approved");
  await form.locator('textarea[name="reason"]').fill("브라우저 기능 검증에서 독립 검토를 완료했습니다.");
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

async function assertKoreanUserProse(page: Page, scope: string): Promise<void> {
  const narratives = page.locator(`${scope} [data-e2e="reviewer-narrative"]`);
  const values = await narratives.allTextContents();
  if (!values.length || values.some((value) => !/[가-힣]/u.test(value))) {
    throw new Error("functional_uat_browser_korean_user_prose_missing");
  }
  if (values.some((value) => requiresControlledNarrative(value))) {
    throw new Error("functional_uat_browser_korean_user_prose_english_leak");
  }
}

async function assertRawFilenameHidden(page: Page, scope: string): Promise<void> {
  const narratives = page.locator(`${scope} [data-e2e="reviewer-narrative"]`);
  const narrativeValues = await narratives.allTextContents();
  const structuredValues = await page.locator(`${scope} [data-e2e="reviewer-structured-value"]`).allTextContents();
  if (
    narrativeValues.some((value) => requiresControlledNarrative(value))
    || structuredValues.some((value) => requiresControlledStructuredValue(value))
  ) {
    throw new Error("functional_uat_browser_raw_filename_or_identifier_visible");
  }
}

async function assertVerificationDetailsClosed(scope: ReturnType<Page["locator"]>): Promise<void> {
  const details = scope.locator("details.verification-details");
  const count = await details.count();
  for (let index = 0; index < count; index += 1) {
    await expect(details.nth(index)).not.toHaveAttribute("open", "");
  }
}

async function assertNoTechnicalIdentifierInDefaultMessage(scope: ReturnType<Page["locator"]>): Promise<void> {
  const visibleText = await scope.evaluate((node) => {
    const copy = node.cloneNode(true) as HTMLElement;
    for (const details of copy.querySelectorAll("details.verification-details")) details.remove();
    return copy.innerText;
  });
  if (/\b(?:case|run|knowledge_conv|guide)_[A-Za-z0-9_-]+/u.test(visibleText)) {
    throw new Error("functional_uat_browser_knowledge_default_technical_identifier_visible");
  }
}

/**
 * Both Browser prompts target the currently built `trade_terms` coverage.
 * A future snapshot may legitimately report partial coverage with citations;
 * treat that explicit limitation as safe, but never accept no-coverage or an
 * unavailable lookup as if it were an official answer.
 */
async function assertOfficialKnowledgeSnapshot(scope: ReturnType<Page["locator"]>): Promise<void> {
  const coverage = scope.locator('[data-e2e="knowledge-coverage"]');
  await expect(coverage).toHaveCount(1);
  const coverageText = (await coverage.innerText()).trim();
  if (coverageText === "일부 근거 확인됨") {
    await expect(scope.locator(".knowledge-answer-boundary")).toContainText("일부 범위의 공식 근거만 확인되었습니다.");
  } else if (coverageText !== "근거 범위 확인됨") {
    throw new Error("functional_uat_browser_knowledge_coverage_not_grounded");
  }
  await expect(scope.locator(".knowledge-citation").first()).toBeVisible();
  await expect(scope.locator(".knowledge-citation").first()).toContainText("지식 스냅샷 기준일 2026-08-05");
  await expect(scope.locator(".knowledge-citation a").first()).toBeVisible();
  await expect(scope.locator("header small").first()).toContainText("지식 스냅샷 기준일 2026-08-05");
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
          if (target.port === "18083" || target.port === "18090" || target.port === "18093" || target.pathname.startsWith("/internal/")) {
            violations.add("functional_uat_browser_direct_agent_or_data_request");
          }
          if (target.pathname.startsWith("/api/v1") && target.origin !== environment.baseUrl) {
            violations.add("functional_uat_browser_bypassed_backend_proxy");
          }
          if (target.origin !== environment.baseUrl && target.origin !== FUNCTIONAL_UAT_KEYCLOAK_ORIGIN) {
            violations.add("functional_uat_browser_unexpected_network_target");
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
