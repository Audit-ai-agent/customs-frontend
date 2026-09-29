import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LightweightWorkbench } from "../src/workbench";

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = "#/cases";
});

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function click(element: Element | null | undefined): Promise<void> {
  if (!(element instanceof HTMLElement)) throw new Error("clickable element is unavailable");
  await act(async () => {
    element.click();
  });
  await flush();
}

function setValue(element: HTMLInputElement | HTMLSelectElement | null, value: string): void {
  if (!element) throw new Error("form control is unavailable");
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element) as object, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

async function submit(form: HTMLFormElement | null | undefined): Promise<void> {
  if (!form) throw new Error("form is unavailable");
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await flush();
}

const AUTH = { logout: async () => undefined, freshAccessToken: async () => "token", isAuthenticated: () => true };

function llmSettings(overrides: Record<string, unknown> = {}) {
  return {
    provider: "openai" as const,
    model: "gpt-5.6-luna",
    max_tokens: 16384,
    timeout_seconds: 90,
    source: "environment" as const,
    version: 1,
    updated_at: null,
    error_code: null,
    service_mode: "functional-uat",
    adjustable: true,
    providers: [
      { provider: "openai" as const, credential_present: true, default_model: "gpt-4.1-mini" },
      { provider: "anthropic" as const, credential_present: false, default_model: "claude-haiku-4-5-20251001" },
    ],
    ...overrides,
  };
}

async function mount(api: unknown, roles: ("reviewer" | "approver")[]) {
  const root = document.createElement("div");
  document.body.append(root);
  const fullApi = {
    getSession: async () => ({ subject: roles.includes("approver") ? "admin" : "reviewer", org_id: "local-org", roles }),
    listCases: async () => ({ items: [] }),
    ...(api as object),
  };
  const app = new LightweightWorkbench(root, fullApi as never, AUTH as never, "functional-uat");
  await act(async () => {
    await app.start();
  });
  await flush();
  return {
    root,
    dispose: () => {
      app.destroy();
      root.remove();
    },
  };
}

describe("hidden admin page (#/admin)", () => {
  it("opens from its typed URL for an approver and is absent from the global navigation", async () => {
    window.location.hash = "#/admin";
    const getLlmSettings = vi.fn(async () => llmSettings());
    const { root, dispose } = await mount({ getLlmSettings }, ["reviewer", "approver"]);

    expect(window.location.hash).toBe("#/admin");
    expect(getLlmSettings).toHaveBeenCalledTimes(1);
    const page = root.querySelector("[data-admin-page]");
    expect(page).not.toBeNull();
    expect(page?.textContent).toContain("현재 설정");
    expect(page?.textContent).toContain("gpt-5.6-luna");
    expect(page?.textContent).toContain("OpenAI");
    expect(page?.textContent).toContain("서버 환경값");
    expect(root.querySelector("[data-admin-form]")).not.toBeNull();
    const nav = root.querySelector(".g-gnb");
    expect(nav?.textContent).not.toContain("관리자");
    expect(root.querySelector("main")?.textContent).not.toContain("#/admin");
    dispose();
  });

  it("shows the role boundary and no form to a reviewer-only session", async () => {
    window.location.hash = "#/admin";
    const { root, dispose } = await mount({ getLlmSettings: async () => llmSettings() }, ["reviewer"]);

    expect(root.querySelector("[data-admin-page]")).not.toBeNull();
    expect(root.querySelector("[data-admin-form]")).toBeNull();
    expect(root.querySelector(".role-boundary-note")?.textContent).toContain("승인자 역할에서만");
    dispose();
  });

  it("saves only the changed fields and re-renders the returned view", async () => {
    window.location.hash = "#/admin";
    const updateLlmSettings = vi.fn(async (update: Record<string, unknown>) =>
      llmSettings({ ...update, source: "override", version: 2, updated_at: "2026-09-09T01:00:00Z" }),
    );
    const { root, dispose } = await mount(
      { getLlmSettings: async () => llmSettings(), updateLlmSettings },
      ["reviewer", "approver"],
    );

    setValue(root.querySelector<HTMLInputElement>("[data-admin-form] input[list]"), "gpt-5.5");
    setValue(root.querySelector<HTMLInputElement>("[data-admin-form] input[type=number]"), "8192");
    await flush();
    await submit(root.querySelector<HTMLFormElement>("[data-admin-form] form"));

    expect(updateLlmSettings).toHaveBeenCalledTimes(1);
    expect(updateLlmSettings).toHaveBeenCalledWith({ model: "gpt-5.5", max_tokens: 8192 });
    const current = root.querySelector("[data-admin-current]");
    expect(current?.textContent).toContain("gpt-5.5");
    expect(current?.textContent).toContain("8,192");
    expect(current?.textContent).toContain("운영자 변경");
    expect(root.textContent).toContain("LLM 설정을 저장했습니다");
    dispose();
  });

  it("rejects an unchanged form locally without calling the Backend", async () => {
    window.location.hash = "#/admin";
    const updateLlmSettings = vi.fn(async () => llmSettings());
    const { root, dispose } = await mount(
      { getLlmSettings: async () => llmSettings(), updateLlmSettings },
      ["reviewer", "approver"],
    );

    await submit(root.querySelector<HTMLFormElement>("[data-admin-form] form"));

    expect(updateLlmSettings).not.toHaveBeenCalled();
    expect(root.querySelector("[data-admin-form]")?.textContent).toContain("변경된 값이 없습니다");
    dispose();
  });

  it("switching provider with an empty model sends only the provider so the default applies", async () => {
    window.location.hash = "#/admin";
    const updateLlmSettings = vi.fn(async (update: Record<string, unknown>) =>
      llmSettings({ ...update, model: "claude-haiku-4-5-20251001", source: "override", version: 2 }),
    );
    const view = llmSettings({
      providers: [
        { provider: "openai", credential_present: true, default_model: "gpt-4.1-mini" },
        { provider: "anthropic", credential_present: true, default_model: "claude-haiku-4-5-20251001" },
      ],
    });
    const { root, dispose } = await mount({ getLlmSettings: async () => view, updateLlmSettings }, ["approver"]);

    setValue(root.querySelector<HTMLSelectElement>("[data-admin-form] select"), "anthropic");
    await flush();
    expect(root.querySelector<HTMLInputElement>("[data-admin-form] input[list]")?.value).toBe("");
    await submit(root.querySelector<HTMLFormElement>("[data-admin-form] form"));

    expect(updateLlmSettings).toHaveBeenCalledWith({ provider: "anthropic" });
    expect(root.querySelector("[data-admin-current]")?.textContent).toContain("Anthropic (Claude)");
    dispose();
  });

  it("runs the connection test for the form values without saving and shows the result", async () => {
    window.location.hash = "#/admin";
    const testLlmSettings = vi.fn(async (update: Record<string, unknown>) => ({
      ok: true, provider: "openai", model: (update.model as string | undefined) ?? "gpt-5.6-luna", latency_ms: 842, error_code: null,
    }));
    const updateLlmSettings = vi.fn(async () => llmSettings());
    const { root, dispose } = await mount(
      { getLlmSettings: async () => llmSettings(), testLlmSettings, updateLlmSettings },
      ["approver"],
    );

    setValue(root.querySelector<HTMLInputElement>("[data-admin-form] input[list]"), "gpt-5.5");
    await flush();
    await click(root.querySelector("[data-admin-test]"));

    expect(testLlmSettings).toHaveBeenCalledWith({ model: "gpt-5.5" });
    expect(updateLlmSettings).not.toHaveBeenCalled();
    const result = root.querySelector("[data-admin-test-result]");
    expect(result?.textContent).toContain("성공");
    expect(result?.textContent).toContain("gpt-5.5");
    expect(result?.textContent).toContain("842 ms");
    dispose();
  });

  it("surfaces a failed connection test with its stable reason", async () => {
    window.location.hash = "#/admin";
    const testLlmSettings = vi.fn(async () => ({
      ok: false, provider: "openai", model: "gpt-5.6-luna", latency_ms: 1203, error_code: "provider_request_failed",
    }));
    const { root, dispose } = await mount({ getLlmSettings: async () => llmSettings(), testLlmSettings }, ["approver"]);

    await click(root.querySelector("[data-admin-test]"));

    expect(testLlmSettings).toHaveBeenCalledWith({});
    const result = root.querySelector("[data-admin-test-result]");
    expect(result?.textContent).toContain("실패");
    expect(result?.textContent).toContain("제공자 요청이 실패했습니다");
    expect(result?.textContent).toContain("provider_request_failed");
    dispose();
  });

  it("resets to the environment after confirmation", async () => {
    window.location.hash = "#/admin";
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const resetLlmSettings = vi.fn(async () => llmSettings({ version: 3 }));
    const { root, dispose } = await mount(
      { getLlmSettings: async () => llmSettings({ source: "override", version: 2, updated_at: "2026-09-09T01:00:00Z" }), resetLlmSettings },
      ["approver"],
    );

    await click(root.querySelector("[data-admin-reset]"));

    expect(resetLlmSettings).toHaveBeenCalledTimes(1);
    expect(root.querySelector("[data-admin-current]")?.textContent).toContain("서버 환경값");
    expect(root.textContent).toContain("서버 환경 기본값으로 되돌렸습니다");
    dispose();
  });

  it("explains a local-development service where settings cannot change", async () => {
    window.location.hash = "#/admin";
    const { root, dispose } = await mount(
      { getLlmSettings: async () => llmSettings({ adjustable: false, service_mode: "local-development" }) },
      ["approver"],
    );

    expect(root.querySelector("[data-admin-current]")?.textContent).toContain("변경할 수 없습니다");
    const submitButton = root.querySelector<HTMLButtonElement>("[data-admin-form] button[type=submit]");
    expect(submitButton?.disabled).toBe(true);
    dispose();
  });
});


describe("demo fallback on the hidden admin page", () => {
  const fallbackView = (mode: "off" | "auto" | "always", sets: unknown[] = []) => ({
    settings: { mode, delay_seconds: 4, updated_by: null, updated_at: null },
    sets,
  });
  const registeredSet = {
    fallback_id: "fallback-1",
    name: "시연 1",
    source_case_id: "case-1",
    source_case_title: "티셔츠 수입",
    source_review_run_id: "run-1",
    documents: [
      { document_id: "d1", filename: "C0001_INV.pdf", document_type: "CI", content_sha256: "a".repeat(64) },
      { document_id: "d2", filename: "C0001_PL.pdf", document_type: "PL", content_sha256: "b".repeat(64) },
    ],
    has_hs_ranking: true,
    finding_count: 3,
    created_by: "admin",
    created_at: "2026-09-30T02:00:00Z",
    used_count: 0,
    last_used_at: null,
  };

  it("lets an approver switch the mode and register a completed run of a chosen case", async () => {
    window.location.hash = "#/admin";
    const getDemoFallback = vi.fn(async () => fallbackView("off"));
    const updateDemoFallback = vi.fn(async (update: { mode?: string }) => fallbackView(update.mode as "auto"));
    const listReviewRuns = vi.fn(async () => [
      { review_run_id: "run-1", case_id: "case-1", job_id: "job-1", review_as_of: "2026-09-30", trade_type: "import", execution_status: "completed", assessment: "needs_review", review_disposition: "human_review_required", result_digest: "c".repeat(64), finding_count: 3, reviewer_decision_count: 0, created_at: "2026-09-30T01:00:00Z" },
    ]);
    const registerDemoFallbackSet = vi.fn(async () => fallbackView("auto", [registeredSet]));
    const { root, dispose } = await mount(
      {
        getLlmSettings: async () => llmSettings(),
        listCases: async () => ({ items: [{ case_id: "case-1", org_id: "local-org", title: "티셔츠 수입", status: "in_review", revision: 1, updated_at: "2026-09-30T00:00:00Z" }] }),
        getDemoFallback,
        updateDemoFallback,
        listReviewRuns,
        registerDemoFallbackSet,
      },
      ["reviewer", "approver"],
    );

    expect(getDemoFallback).toHaveBeenCalledTimes(1);
    const card = root.querySelector("[data-admin-fallback]");
    expect(card?.textContent).toContain("등록된 세트가 없습니다");

    // Mode radios save immediately.
    await click(card?.querySelector('input[name="demo-fallback-mode"][value="auto"]'));
    expect(updateDemoFallback).toHaveBeenCalledWith({ mode: "auto" });

    // Choosing a case lists its runs; the form registers the selected one.
    const form = card?.querySelector<HTMLFormElement>("[data-admin-fallback-register]");
    setValue(form?.querySelector<HTMLInputElement>('input[type="text"]') ?? null, "시연 1");
    const selects = form?.querySelectorAll<HTMLSelectElement>("select") ?? [];
    setValue(selects[0] ?? null, "case-1");
    await flush();
    expect(listReviewRuns).toHaveBeenCalledWith("case-1");
    expect(selects[1]?.value).toBe("run-1");
    await submit(form);
    expect(registerDemoFallbackSet).toHaveBeenCalledWith({ name: "시연 1", review_run_id: "run-1" });
    const row = root.querySelector('[data-admin-fallback-set="fallback-1"]');
    expect(row?.textContent).toContain("티셔츠 수입");
    expect(row?.textContent).toContain("C0001_INV.pdf");
    expect(row?.textContent).toContain("있음");
    dispose();
  });

  it("shows only the role note to a reviewer-only session and never asks the Backend", async () => {
    window.location.hash = "#/admin";
    const getDemoFallback = vi.fn(async () => fallbackView("off"));
    const { root, dispose } = await mount({ getLlmSettings: async () => llmSettings(), getDemoFallback }, ["reviewer"]);
    expect(getDemoFallback).not.toHaveBeenCalled();
    expect(root.querySelector("[data-admin-fallback]")?.textContent).toContain("승인자 역할에서만");
    dispose();
  });
});
