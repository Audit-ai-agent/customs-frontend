import { expect, loginUatUser, test } from "./authenticated-test";

async function seriousAccessibilityViolations(page: import("@playwright/test").Page): Promise<string[]> {
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

test.describe("상용형 내부 UAT 사용자 작업대", () => {
  test("업무함과 기술 정보가 사용자 정보 계층을 지킵니다", async ({ page }) => {
    await page.goto("/reviews");
    await expect(page.getByTestId("reviews-inbox")).toBeVisible();
    await expect(page.getByRole("heading", { name: "처리할 심사 건을 확인합니다." })).toBeVisible();
    await expect(page.getByText("실제 법령 3종", { exact: true })).toBeVisible();
    await expect(page.getByText("자동 처리 꺼짐", { exact: true })).toBeVisible();
    await expect(page.getByText("preserved-3law-v3-scenario-eval", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "검증 정보 보기" }).click();
    await expect(page.getByTestId("technical-drawer")).toContainText(
      "preserved-3law-v3-scenario-eval",
    );
    await expect(page.getByRole("button", { name: "검증 정보 닫기" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("technical-drawer")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "검증 정보 보기" })).toBeFocused();
  });

  test("실제 3법령 RAG 시나리오 9개를 모두 선택할 수 있습니다", async ({ page }) => {
    await page.goto("/test-lab");
    await expect(page.getByTestId("test-lab")).toBeVisible();
    await expect(page.locator('[data-testid^="scenario-"]:not([data-testid="scenario-count"])')).toHaveCount(9);
    for (const button of await page.locator(".scenario-catalog button").all()) {
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.getByText("REQUIRED_CERT_MISSING", { exact: false })).toHaveCount(0);
    await expect(page.getByText("no_issue_detected", { exact: false })).toHaveCount(0);
    await expect(page.getByText("PostgreSQL", { exact: false })).toHaveCount(0);
    await page.getByText("기술 검증 정보 보기").click();
    await expect(page.getByText("PostgreSQL · Qdrant · Neo4j")).toBeVisible();
  });

  test("심사 건에서 보고서·진행·도우미·담당자 검토·이력을 찾을 수 있습니다", async ({ page }) => {
    await page.goto("/reviews");
    const rows = page.getByTestId("case-table-row");
    const exactReference = process.env.CUSTOMS_E2E_CASE_EXTERNAL_REFERENCE;
    const caseLink = exactReference === undefined
      ? rows.first()
      : rows.filter({ hasText: exactReference });
    await expect(caseLink).toHaveCount(1);
    await expect(caseLink).toHaveAttribute("data-case-id", /.+/u);
    if (exactReference === undefined) {
      await expect(caseLink).toHaveAttribute("data-case-external-reference");
    } else {
      await expect(caseLink).toHaveAttribute("data-case-external-reference", exactReference);
    }
    await caseLink.click();
    await expect(page.locator(".case-workspace[data-selected-case-id]")).toBeVisible();
    await expect(page.getByTestId("start-review")).toBeVisible();
    for (const section of [
      "conclusion",
      "process",
      "document_comparison",
      "issues_and_causes",
      "regulatory_meaning",
      "business_impact",
      "next_actions",
      "scope_and_limits",
    ]) {
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

  test("키보드·축소 화면·모션 감소 설정에서도 핵심 업무 흐름을 유지합니다", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/reviews");
    await page.keyboard.press("Tab");
    await expect(page.locator(".skip-link")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("감사 조회 담당자는 전체 이력을 읽되 어떤 변경도 시작할 수 없습니다", async ({
    browser,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chrome-1440",
      "역할 경계는 대표 브라우저에서 한 번만 검증합니다.",
    );
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

  test("주요 화면은 접근성 검사와 200% 글자 확대에서도 업무 정보를 유지합니다", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/reviews");
    const firstCase = page.getByTestId("case-table-row").first();
    await expect(firstCase).toBeVisible();
    const href = await firstCase.getAttribute("href");
    expect(href).not.toBeNull();
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
      await page.goto(route);
      expect(await seriousAccessibilityViolations(page)).toEqual([]);
    }
    await page.goto("/reviews");
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    const zoom = await page.evaluate(() => window.visualViewport?.scale ?? 1);
    const bodyFontSize = await page.evaluate(() => Number.parseFloat(
      window.getComputedStyle(document.body).fontSize,
    ));
    expect(zoom).toBeGreaterThanOrEqual(1.9);
    expect(bodyFontSize).toBeGreaterThanOrEqual(14);
    const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
    await expect(page.getByRole("heading", { name: "처리할 심사 건을 확인합니다." })).toBeVisible();
  });

  test("실제 사용자 여정으로 심사·설명·대화·독립 승인·이력 복구를 수행합니다", async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chrome-1440",
      "실제 Claude/RAG 사용자 여정은 중복 비용을 막기 위해 대표 데스크톱 프로젝트에서 한 번만 실행합니다.",
    );
    test.setTimeout(15 * 60 * 1_000);

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
    await expect(page.getByTestId("start-review")).toBeVisible();
    await page.getByTestId("start-review").click();
    await expect(page.getByTestId("review-progress")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("current-stage")).not.toHaveText("");
    await expect(page.getByTestId("elapsed-time")).toBeVisible();
    await expect(page.getByTestId("eta-range")).toContainText("~");

    await expect(page.getByTestId("report-section-conclusion")).toBeVisible({
      timeout: 10 * 60 * 1_000,
    });
    await expect(page.getByTestId("report-section-process")).toBeVisible();
    await expect(page.getByTestId("report-section-regulatory_meaning")).toBeVisible();
    await expect(page.getByTestId("report-section-next_actions")).toBeVisible();
    await expect(page.getByTestId("agent-process")).toBeVisible();

    await page.getByRole("link", { name: "법령 근거" }).click();
    const evidencePage = page.getByTestId("evidence-page");
    await expect(evidencePage).toContainText("실제 3법령 RAG");
    await expect(evidencePage).toContainText("제한된 실제 법령 검색을 정상적으로 완료했습니다.");

    await page.getByRole("link", { name: "AI 심사 도우미" }).click();
    const question = "이번 심사 결과의 이유와 담당자가 다음으로 할 일을 설명해 주십시오.";
    const composer = page.getByLabel("AI 심사 도우미에게 질문");
    await composer.fill(question);
    await page.getByRole("button", { name: "질문하기" }).click();
    await expect(page.getByTestId("assistant-progress")).toBeVisible({ timeout: 30_000 });
    const verifiedAnswer = page.locator(".message-bubble--assistant").last();
    await expect(verifiedAnswer.getByRole("heading", { name: "직접 답변" })).toBeVisible({
      timeout: 3 * 60 * 1_000,
    });
    const answerText = await verifiedAnswer.textContent();
    expect(answerText?.trim().length).toBeGreaterThan(80);

    await page.reload();
    await expect(page.getByTestId("assistant-page")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/cases/${encodeURIComponent(caseId)}/assistant$`, "u"));
    await expect(page.locator("#username")).toHaveCount(0);
    await expect(page.locator(".message-bubble--assistant").last()).toContainText("직접 답변");
    await expect(page.locator(".message-bubble--assistant").last()).toContainText(
      answerText?.slice(0, 40) ?? "",
    );

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
      await expect(pending).toContainText(
        "브라우저 사용자 여정에서 원문을 다시 확인한 수정 제안입니다.",
      );
      await pending.getByRole("textbox", { name: "검토 의견" }).fill(
        "제안자와 다른 승인 담당자로서 원문 결박과 수정 사유를 확인했습니다.",
      );
      await pending.getByRole("button", { name: "승인·재심사" }).click();
      await expect(approverPage.getByRole("status")).toContainText(
        "새 심사 회차를 요청했습니다.",
      );
      await approverPage.getByRole("link", { name: "심사 이력" }).click();
      await expect(approverPage.getByTestId("history-page")).toBeVisible();
      await expect(approverPage.locator(".run-history li")).toHaveCount(2, {
        timeout: 5 * 60 * 1_000,
      });
    } finally {
      await approverContext.close();
    }
  });
});
