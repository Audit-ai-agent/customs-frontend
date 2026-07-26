import { expect, test } from "./authenticated-test";

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
  });

  test("실제 3법령 RAG 시나리오 9개를 모두 선택할 수 있습니다", async ({ page }) => {
    await page.goto("/test-lab");
    await expect(page.getByTestId("test-lab")).toBeVisible();
    await expect(page.locator('[data-testid^="scenario-"]:not([data-testid="scenario-count"])')).toHaveCount(9);
    for (const button of await page.locator(".scenario-catalog button").all()) {
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
    }
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
});
