import type { Locator, Page, TestInfo } from "@playwright/test";
import { expect, loginUatUser, test } from "./authenticated-test";
import {
  EVIDENCE_PROFILE,
  SCENARIO_IDS,
  scenarioBindingsFromWorkerEnvironment,
} from "./scenario-bindings";

const EVIDENCE_SOURCE = "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY";
const REPORT_SECTION_CODES = [
  "conclusion",
  "process",
  "document_comparison",
  "issues_and_causes",
  "regulatory_meaning",
  "business_impact",
  "next_actions",
  "scope_and_limits",
] as const;
const REVIEW_STAGE_CODES = [
  "request_validation",
  "document_analysis",
  "normalization",
  "document_pairing",
  "cross_validation",
  "evidence_retrieval",
  "compliance_review",
  "adaptive_investigation",
  "report_composition",
  "grounding_verification",
  "result_validation",
] as const;
const MINIMUM_REPORT_CHARACTERS = 650;
const MINIMUM_SECTION_CHARACTERS = 28;
const MINIMUM_MATERIAL_STATEMENT_CHARACTERS = 18;
const MINIMUM_KOREAN_LETTER_RATIO = 0.65;

async function seriousAccessibilityViolations(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const runner = (window as typeof window & {
      axe: { run(root: Document): Promise<{ violations: Array<{ id: string; impact: string | null }> }> };
    }).axe;
    const result = await runner.run(document);
    return result.violations
      .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
      .map((violation) => violation.id);
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
}

async function expectNoCspViolations(page: Page): Promise<void> {
  const violations = await page.evaluate(() => (
    (window as typeof window & {
      __customsCspViolations?: Array<{
        blockedUri: string;
        effectiveDirective: string;
        violatedDirective: string;
      }>;
    }).__customsCspViolations ?? []
  ));
  expect(violations).toEqual([]);
}

async function attachSafeScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  target?: Locator,
): Promise<void> {
  const mask = [
    page.locator(".message-bubble"),
    page.locator(".presentation-statement p"),
    page.locator(".presentation-citations"),
    page.locator("input"),
    page.locator("textarea"),
    page.locator('[data-testid="technical-drawer"]'),
    page.locator("details[open]"),
  ];
  const options = {
    animations: "disabled" as const,
    caret: "hide" as const,
    mask,
    maskColor: "#dce7e5",
  };
  const body = target
    ? await target.screenshot(options)
    : await page.screenshot({ ...options, fullPage: false });
  await testInfo.attach(name, { body, contentType: "image/png" });
}

function normalizedText(value: string | null): string {
  return (value ?? "").replace(/\s+/gu, " ").trim();
}

async function expectCommercialReport(page: Page): Promise<void> {
  const materialTexts: string[] = [];
  for (const sectionCode of REPORT_SECTION_CODES) {
    const section = page.getByTestId(`report-section-${sectionCode}`);
    await expect(section).toBeVisible();
    const sectionText = normalizedText(await section.locator(".presentation-statement > p").allTextContents()
      .then((items) => items.join(" ")));
    expect(
      sectionText.length,
      `${sectionCode} 구역은 최소 ${MINIMUM_SECTION_CHARACTERS}자여야 합니다.`,
    ).toBeGreaterThanOrEqual(MINIMUM_SECTION_CHARACTERS);

    const materialStatements = section.locator(
      '.presentation-statement[data-material="true"]',
    );
    expect(
      await materialStatements.count(),
      `${sectionCode} 구역에는 근거가 결박된 실질 문장이 필요합니다.`,
    ).toBeGreaterThan(0);
    for (const statement of await materialStatements.all()) {
      const text = normalizedText(await statement.locator(":scope > p").textContent());
      expect(
        text.length,
        `${sectionCode} 구역의 실질 문장이 지나치게 짧습니다.`,
      ).toBeGreaterThanOrEqual(MINIMUM_MATERIAL_STATEMENT_CHARACTERS);
      expect(text, `${sectionCode} 구역은 정중한 '~습니다.'체여야 합니다.`).toMatch(
        /니다\.$/u,
      );
      expect(
        await statement.locator('a[data-testid^="citation-"]').count(),
        `${sectionCode} 구역의 실질 문장에는 검증된 근거 링크가 필요합니다.`,
      ).toBeGreaterThan(0);
      materialTexts.push(text);
    }
  }
  const reportText = materialTexts.join(" ");
  expect(materialTexts.length).toBeGreaterThanOrEqual(REPORT_SECTION_CODES.length);
  expect(reportText.length).toBeGreaterThanOrEqual(MINIMUM_REPORT_CHARACTERS);
  const letters = [...reportText].filter((character) => /\p{L}/u.test(character));
  const koreanLetters = letters.filter((character) => /[가-힣]/u.test(character));
  expect(koreanLetters.length / Math.max(letters.length, 1)).toBeGreaterThanOrEqual(
    MINIMUM_KOREAN_LETTER_RATIO,
  );
}

async function expectBoundActualRagRun(page: Page, exactRunId?: string): Promise<void> {
  await expect(page.getByTestId("report-section-conclusion")).toBeVisible({ timeout: 60_000 });
  const caseId = await page.locator(".case-workspace").getAttribute("data-selected-case-id");
  expect(caseId).toBeTruthy();
  const runQuery = exactRunId === undefined
    ? ""
    : `?run=${encodeURIComponent(exactRunId)}`;
  const technical = page.getByTestId("technical-run-details");
  await technical.locator("summary").click();
  await expect(technical).toContainText(EVIDENCE_PROFILE);
  await expect(technical).toContainText(EVIDENCE_SOURCE);
  await page.goto(`/cases/${encodeURIComponent(caseId!)}/evidence${runQuery}`);
  const evidencePage = page.getByTestId("evidence-page");
  await expect(evidencePage).toContainText("실제 3법령 RAG");
  await expect(evidencePage).toContainText("제한된 실제 법령 검색을 정상적으로 완료했습니다.");
  await page.goto(`/cases/${encodeURIComponent(caseId!)}/overview${runQuery}`);
}

async function sendAssistantQuestion(
  page: Page,
  question: string,
  expectedAssistantCount: number,
): Promise<Locator> {
  await page.getByLabel("AI 심사 도우미에게 질문").fill(question);
  await page.getByRole("button", { name: "질문하기" }).click();
  await expect(page.getByTestId("assistant-progress")).toBeVisible({ timeout: 30_000 });
  const answers = page.locator(".message-bubble--assistant");
  await expect(answers).toHaveCount(expectedAssistantCount, { timeout: 4 * 60 * 1_000 });
  const answer = answers.nth(expectedAssistantCount - 1);
  await expect(answer.getByRole("heading", { name: "직접 답변" })).toBeVisible();
  expect(normalizedText(await answer.locator(".assistant-direct-answer").textContent()).length)
    .toBeGreaterThan(30);
  await expect(answer.getByRole("heading", { name: "그렇게 판단한 이유" })).toBeVisible();
  await expect(answer.getByRole("heading", { name: "다음 조치" })).toBeVisible();
  return answer;
}

test.describe("상용형 내부 UAT 사용자 작업대", () => {
  test("업무함과 기술 정보가 사용자 정보 계층을 지킵니다 @primary", async ({ page }) => {
    await page.goto("/reviews");
    await expect(page.getByTestId("reviews-inbox")).toBeVisible();
    await expect(page.getByRole("heading", { name: "처리할 심사 건을 확인합니다." })).toBeVisible();
    await expect(page.getByText("실제 법령 3종", { exact: true })).toBeVisible();
    await expect(page.getByText("자동 처리 꺼짐", { exact: true })).toBeVisible();
    await expect(page.getByText(EVIDENCE_PROFILE, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "검증 정보 보기" }).click();
    await expect(page.getByTestId("technical-drawer")).toContainText(EVIDENCE_PROFILE);
    await expect(page.getByRole("button", { name: "검증 정보 닫기" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("technical-drawer")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "검증 정보 보기" })).toBeFocused();
  });

  test("실제 3법령 RAG 시나리오 9개는 모두 활성화되고 같은 프로필에 결박됩니다 @primary", async ({
    page,
  }) => {
    test.setTimeout(8 * 60 * 1_000);
    await page.goto("/test-lab");
    await expect(page.getByTestId("scenario-count")).toHaveText("9개 시나리오");
    const scenarioButtons = page.locator(".scenario-catalog button");
    await expect(scenarioButtons).toHaveCount(SCENARIO_IDS.length);
    for (const scenarioId of SCENARIO_IDS) {
      const scenario = page.getByTestId(`scenario-${scenarioId}`);
      await expect(scenario).toBeEnabled();
      await scenario.click();
      await expect(scenario).toHaveAttribute("aria-pressed", "true");
      await page.getByText("기술 검증 정보 보기").click();
      await expect(page.getByTestId("scenario-technical-details")).toContainText(EVIDENCE_PROFILE);
      await expect(page.getByTestId("scenario-technical-details")).toContainText(
        "PostgreSQL · Qdrant · Neo4j",
      );
    }
    await expect(page.getByText("REQUIRED_CERT_MISSING", { exact: false })).toHaveCount(0);
    await expect(page.getByText("no_issue_detected", { exact: false })).toHaveCount(0);

    const exactBindings = scenarioBindingsFromWorkerEnvironment();
    for (const binding of exactBindings) {
      await page.goto("/reviews");
      const matchingCase = page.locator(
        `[data-testid="case-table-row"][data-case-id="${binding.case_id}"]`,
      );
      await expect(matchingCase).toHaveCount(1);
      await expect(matchingCase).toHaveAttribute(
        "data-case-external-reference",
        binding.external_reference,
      );
      await page.goto(
        `/cases/${encodeURIComponent(binding.case_id)}/overview`
          + `?run=${encodeURIComponent(binding.review_run_id)}`,
      );
      const workspace = page.locator(".case-workspace[data-selected-case-id]");
      await expect(workspace).toHaveAttribute("data-selected-case-id", binding.case_id);
      await expect(workspace).toHaveAttribute(
        "data-selected-case-external-reference",
        binding.external_reference,
      );
      await expect(page.locator(".presentation-report")).toHaveAttribute(
        "data-bound-result-sha256",
        binding.result_sha256,
      );
      await expectBoundActualRagRun(page, binding.review_run_id);
      await expect(page.locator(".presentation-report")).toHaveAttribute(
        "data-bound-result-sha256",
        binding.result_sha256,
      );
      await expectCommercialReport(page);
    }
  });

  test("심사 건에서 보고서·진행·도우미·담당자 검토·이력을 찾을 수 있습니다 @primary", async ({
    page,
  }) => {
    await page.goto("/reviews");
    const rows = page.getByTestId("case-table-row");
    const exactReference = process.env.CUSTOMS_E2E_CASE_EXTERNAL_REFERENCE;
    let caseLink = rows.first();
    if (exactReference !== undefined) {
      const references = await rows.evaluateAll((items) => items.map(
        (item) => item.getAttribute("data-case-external-reference"),
      ));
      const index = references.indexOf(exactReference);
      expect(index, "지정한 심사 건 참조번호가 업무함에 있어야 합니다.").toBeGreaterThanOrEqual(0);
      caseLink = rows.nth(index);
    }
    await expect(caseLink).toBeVisible();
    await caseLink.click();
    await expect(page.locator(".case-workspace[data-selected-case-id]")).toBeVisible();
    await expect(page.getByTestId("start-review")).toBeVisible();
    for (const section of REPORT_SECTION_CODES) {
      await expect(page.getByTestId(`report-section-${section}`)).toBeVisible();
    }
    await page.getByRole("link", { name: "AI 심사 도우미" }).click();
    await expect(page.getByTestId("assistant-page")).toBeVisible();
    await expect(page.getByLabel("AI 심사 도우미에게 질문")).toBeVisible();
    await page.getByRole("link", { name: "담당자 검토" }).click();
    await expect(page.getByTestId("review-actions-page")).toBeVisible();
    await expect(page.getByTestId("hitl-proposals")).toBeVisible();
    await page.getByRole("link", { name: "심사 이력" }).click();
    await expect(page.getByTestId("history-page")).toBeVisible();
  });

  test("각 목표 화면 크기에서 접근성·키보드·200% 확대·모션 감소·CSP를 지킵니다 @responsive", async ({
    page,
  }, testInfo) => {
    test.setTimeout(7 * 60 * 1_000);
    const expectedViewports: Record<string, { width: number; height: number }> = {
      "chrome-1440": { width: 1440, height: 900 },
      "edge-1024": { width: 1024, height: 768 },
      "chrome-mobile-390": { width: 390, height: 844 },
    };
    expect(page.viewportSize()).toEqual(expectedViewports[testInfo.project.name]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/reviews");
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    const firstCase = page.getByTestId("case-table-row").first();
    await expect(firstCase).toBeVisible();
    const href = await firstCase.getAttribute("href");
    const caseId = /\/cases\/([^/]+)\//u.exec(href ?? "")?.[1];
    expect(caseId).toBeTruthy();
    const routes = [
      "/reviews",
      "/test-lab",
      `/cases/${caseId}/overview`,
      `/cases/${caseId}/documents`,
      `/cases/${caseId}/evidence`,
      `/cases/${caseId}/assistant`,
      `/cases/${caseId}/review-actions`,
      `/cases/${caseId}/history`,
    ];
    for (const route of routes) {
      const response = await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      expect(await seriousAccessibilityViolations(page), `${route} 접근성 위반`).toEqual([]);
      await expectNoHorizontalOverflow(page);
      await expectNoCspViolations(page);
      const csp = response?.headers()["content-security-policy"] ?? "";
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self'");
      expect(csp).not.toContain("'unsafe-inline'");
      await page.waitForTimeout(30);
      const runningAnimations = await page.evaluate(() => document.getAnimations().filter(
        (animation) => animation.playState === "running"
          && Number(animation.effect?.getComputedTiming().duration ?? 0) > 1,
      ).length);
      expect(runningAnimations, `${route}에서 모션 감소 설정을 지켜야 합니다.`).toBe(0);
      if (
        route === "/reviews"
        || route === "/test-lab"
        || route.endsWith("/overview")
        || route.endsWith("/assistant")
      ) {
        const screenName = route === "/reviews"
          ? "reviews"
          : route === "/test-lab"
            ? "test-lab"
            : route.endsWith("/overview")
              ? "overview"
              : "assistant";
        await attachSafeScreenshot(
          page,
          testInfo,
          `viewport-${testInfo.project.name}-${screenName}`,
        );
      }
    }

    await page.goto("/test-lab");
    const keyboardScenario = page.getByTestId(`scenario-${SCENARIO_IDS[1]}`);
    await keyboardScenario.focus();
    await page.keyboard.press("Enter");
    await expect(keyboardScenario).toHaveAttribute("aria-pressed", "true");
    const technicalToggle = page.getByRole("button", { name: "기술 검증 정보 보기" });
    await technicalToggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("scenario-technical-details")).toBeVisible();

    const cdp = await page.context().newCDPSession(page);
    for (const route of routes) {
      await page.goto(route);
      await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
      expect(await page.evaluate(() => window.visualViewport?.scale ?? 1))
        .toBeGreaterThanOrEqual(1.9);
      await expect(page.locator("#main-content")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(await seriousAccessibilityViolations(page), `${route} 200% 확대 접근성 위반`)
        .toEqual([]);
      await expectNoCspViolations(page);
    }
  });

  test("감사 조회 담당자는 전체 이력을 읽되 어떤 변경도 시작할 수 없습니다 @primary", async ({
    browser,
  }) => {
    const baseURL = process.env.CUSTOMS_UAT_BASE_URL ?? "http://127.0.0.1:18088";
    const context = await browser.newContext({
      baseURL,
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
    });
    try {
      const auditor = await context.newPage();
      await loginUatUser(auditor, "auditor");
      await expect(auditor.getByText("감사 조회 담당자", { exact: true })).toBeVisible();
      await expect(auditor.getByRole("button", { name: "새 심사 건" })).toBeDisabled();
      const caseLink = auditor.getByTestId("case-table-row").first();
      await expect(caseLink).toBeVisible();
      const href = await caseLink.getAttribute("href");
      const caseId = /\/cases\/([^/]+)\//u.exec(href ?? "")?.[1];
      expect(caseId).toBeTruthy();

      await auditor.goto(`/cases/${caseId}/overview`);
      await expect(auditor.getByTestId("start-review")).toHaveCount(0);
      await expect(auditor.getByText(/조회 전용입니다.*기존 심사 결과/u)).toBeVisible();
      await auditor.goto(`/cases/${caseId}/documents`);
      await expect(auditor.getByRole("button", { name: "문서 등록" })).toBeDisabled();
      await auditor.goto(`/cases/${caseId}/assistant`);
      await expect(auditor.getByRole("button", { name: "질문하기" })).toBeDisabled();
      await auditor.goto(`/cases/${caseId}/review-actions`);
      await expect(auditor.getByRole("button", { name: "수정 제안 저장" })).toBeDisabled();
      await expect(auditor.getByRole("button", { name: "승인·재심사" })).toHaveCount(0);
      await auditor.goto(`/cases/${caseId}/history`);
      await expect(auditor.getByTestId("history-page")).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("실제 사용자 여정으로 11단계 심사·3턴 대화·독립 승인·child Run을 수행합니다 @primary", async ({
    browser,
    page,
  }, testInfo) => {
    test.setTimeout(25 * 60 * 1_000);

    await page.goto("/test-lab");
    const scenario = page.getByTestId("scenario-clean_text_no_requirement_uat");
    await scenario.click();
    await expect(scenario).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "이 시나리오로 심사 건 만들기" }).click();
    await expect(page.getByTestId("documents-page")).toBeVisible({ timeout: 90_000 });

    const caseMatch = /\/cases\/([^/]+)\/documents$/u.exec(new URL(page.url()).pathname);
    expect(caseMatch).not.toBeNull();
    const caseId = decodeURIComponent(caseMatch![1]!);
    await page.getByRole("link", { name: "심사 요약" }).click();
    await page.getByTestId("start-review").click();
    const progress = page.getByTestId("review-progress");
    await expect(progress).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("current-stage")).not.toHaveText("");
    await expect(page.getByTestId("elapsed-time")).toHaveText(/\d+(?:분|초)/u);
    await expect(page.getByTestId("eta-range")).toHaveText(/\d+(?:분|초).*~.*\d+(?:분|초)/u);
    await expect(progress).not.toContainText("%");

    await expect(page.getByTestId("report-section-conclusion")).toBeVisible({
      timeout: 10 * 60 * 1_000,
    });
    await expect(progress).toHaveAttribute("data-review-state", "succeeded");
    const stageItems = progress.locator(".live-review__stages > li");
    await expect(stageItems).toHaveCount(REVIEW_STAGE_CODES.length);
    expect(await stageItems.evaluateAll((nodes) => nodes.map(
      (node) => node.getAttribute("data-stage-code"),
    ))).toEqual(REVIEW_STAGE_CODES);
    for (const stageCode of REVIEW_STAGE_CODES) {
      const stage = progress.locator(`[data-stage-code="${stageCode}"]`);
      await expect(stage).toHaveAttribute(
        "data-stage-state",
        stageCode === "adaptive_investigation" ? /^(?:completed|skipped)$/u : "completed",
      );
    }
    await expect(page.getByTestId("handled-stage-count")).toHaveText("11/11개");
    await expect(page.getByTestId("agent-process")).toBeVisible();
    await expectCommercialReport(page);
    await expectBoundActualRagRun(page);
    await attachSafeScreenshot(page, testInfo, "successful-review-overview");
    await attachSafeScreenshot(
      page,
      testInfo,
      "successful-eight-section-report",
      page.locator(".presentation-report"),
    );

    await page.getByRole("link", { name: "AI 심사 도우미" }).click();
    const firstAnswer = await sendAssistantQuestion(
      page,
      "이번 심사의 결론과 그 결론에 이른 이유를 설명해 주십시오.",
      1,
    );
    const firstUser = page.locator(".message-bubble--user").nth(0);
    const firstUserId = await firstUser.getAttribute("data-message-id");
    const firstAssistantId = await firstAnswer.getAttribute("data-message-id");
    expect(firstUserId).toBeTruthy();
    expect(firstAssistantId).toBeTruthy();
    await expect(firstAnswer).toHaveAttribute("data-parent-message-id", firstUserId!);
    expect(await firstAnswer.locator('a[data-testid^="citation-"]').count()).toBeGreaterThan(0);

    const secondAnswer = await sendAssistantQuestion(
      page,
      "방금 설명한 이유 중에서 담당자가 가장 먼저 확인할 항목은 무엇입니까?",
      2,
    );
    const secondUser = page.locator(".message-bubble--user").nth(1);
    await expect(secondUser).toHaveAttribute("data-parent-message-id", firstAssistantId!);
    const secondUserId = await secondUser.getAttribute("data-message-id");
    const secondAssistantId = await secondAnswer.getAttribute("data-message-id");
    expect(secondUserId).toBeTruthy();
    expect(secondAssistantId).toBeTruthy();
    await expect(secondAnswer).toHaveAttribute("data-parent-message-id", secondUserId!);

    const secondAnswerPrefix = normalizedText(await secondAnswer.textContent()).slice(0, 50);
    await page.reload();
    await expect(page.getByTestId("assistant-page")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/cases/${encodeURIComponent(caseId)}/assistant$`, "u"));
    await expect(page.locator("#username")).toHaveCount(0);
    await expect(page.locator(".message-bubble--user")).toHaveCount(2);
    await expect(page.locator(".message-bubble--assistant")).toHaveCount(2);
    await expect(page.locator(".message-bubble--assistant").last()).toContainText(
      secondAnswerPrefix,
    );

    const thirdAnswer = await sendAssistantQuestion(
      page,
      "그 첫 번째 확인 항목을 처리할 때 참고할 법령 근거와 이 답변의 한계를 설명해 주십시오.",
      3,
    );
    const thirdUser = page.locator(".message-bubble--user").nth(2);
    await expect(thirdUser).toHaveAttribute("data-parent-message-id", secondAssistantId!);
    const thirdUserId = await thirdUser.getAttribute("data-message-id");
    expect(thirdUserId).toBeTruthy();
    await expect(thirdAnswer).toHaveAttribute("data-parent-message-id", thirdUserId!);
    await expect(thirdAnswer.getByRole("heading", { name: "답변 범위와 한계" })).toBeVisible();
    const resultBindings = await page.locator(".message-bubble").evaluateAll((nodes) => (
      [...new Set(nodes.map((node) => node.getAttribute("data-bound-result-sha256")))]
    ));
    expect(resultBindings).toHaveLength(1);
    expect(resultBindings[0]).toMatch(/^[a-f0-9]{64}$/u);
    await attachSafeScreenshot(page, testInfo, "successful-three-turn-assistant");

    await page.getByRole("link", { name: "담당자 검토" }).click();
    const fieldSelect = page.locator('select[name="field_id"]');
    await expect.poll(() => fieldSelect.locator("option").count()).toBeGreaterThan(1);
    await fieldSelect.selectOption({ index: 1 });
    await page.locator('input[name="new_value"]').fill("UAT 담당자 재확인 값");
    await page.locator('textarea[name="reason"]').fill(
      "브라우저 사용자 여정에서 원문을 다시 확인한 수정 제안입니다.",
    );
    await page.getByRole("button", { name: "수정 제안 저장" }).click();
    await expect(page.getByRole("status")).toContainText("수정 제안을 저장했습니다.");

    const baseURL = process.env.CUSTOMS_UAT_BASE_URL ?? "http://127.0.0.1:18088";
    const approverContext = await browser.newContext({
      baseURL,
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      reducedMotion: "reduce",
    });
    try {
      const approverPage = await approverContext.newPage();
      await loginUatUser(approverPage, "approver");
      await approverPage.goto(`/cases/${encodeURIComponent(caseId)}/review-actions`);
      const pending = approverPage.getByTestId("hitl-proposals").locator(".proposal--pending");
      await expect(pending).toHaveCount(1);
      await expect(pending.getByText("변경 대상", { exact: true })).toBeVisible();
      await expect(pending.getByText("현재 값", { exact: true })).toBeVisible();
      await expect(pending.getByText("제안 값", { exact: true })).toBeVisible();
      await expect(pending.getByText("제안 사유", { exact: true })).toBeVisible();
      await expect(pending).toContainText("UAT 담당자 재확인 값");
      await pending.getByRole("textbox", { name: "검토 의견" }).fill(
        "제안자와 다른 승인 담당자로서 원문 결박과 수정 사유를 확인했습니다.",
      );
      await pending.getByRole("button", { name: "승인·재심사" }).click();
      await expect(approverPage.getByRole("status")).toContainText(
        "새 심사 회차를 요청했습니다.",
      );
      await approverPage.getByRole("link", { name: "심사 이력" }).click();
      const runHistory = approverPage.locator(".run-history li");
      await expect(runHistory).toHaveCount(2, { timeout: 5 * 60 * 1_000 });
      const childRun = approverPage.locator(
        '.run-history li[data-parent-run-id]:not([data-parent-run-id=""])',
      );
      await expect(childRun).toHaveCount(1);
      const parentRunId = await childRun.getAttribute("data-parent-run-id");
      expect(parentRunId).toBeTruthy();
      await expect(runHistory.locator(`[data-review-run-id="${parentRunId}"]`)).toHaveCount(1);
      expect(await approverPage.locator(".audit-timeline li").count()).toBeGreaterThanOrEqual(6);
      await attachSafeScreenshot(
        approverPage,
        testInfo,
        "successful-child-run-history",
      );
      await approverPage.getByText("감사 기록 기술 식별자").click();
      const history = approverPage.getByTestId("history-page");
      await expect(history).toContainText("revision_proposal.created");
      await expect(history).toContainText("correction_proposal.decided");
    } finally {
      await approverContext.close();
    }
  });
});
