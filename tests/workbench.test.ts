import axe from "axe-core";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { WorkbenchApp, type WorkbenchAuth } from "../src/app";
import { ApiError, type ApiClient } from "../src/api/v1/client";
import type { CorrectionProposal, CorrectionProposalDecisionResponse, JobRecord, ReviewRun } from "../src/api/v1/types";
import { UAT_SCENARIOS } from "../src/uat/scenarios";

const run: ReviewRun = {
  review_run_id: "run-001",
  case_id: "case-1",
  org_id: "org-1",
  case_revision: 1,
  created_at: "2026-07-21T12:00:00Z",
  execution_status: "succeeded",
  assessment: "no_issue_detected",
  review_disposition: "human_review_required",
  assurance_level: "production_candidate",
  result_digest: "a".repeat(64),
  input_manifest_digest: "b".repeat(64),
  agent_input_manifest_sha256: "b".repeat(64),
  provider_result_sha256: "e".repeat(64),
  completion_eligibility: {
    eligible: false,
    profile_id: null,
    scope: [],
    unmet_reason_codes: ["domain_approval_missing"],
  },
  stages: [],
  fields: [{ field_id: "field-1", document_id: "doc-1", name: "invoice_no", field_path: "fields.invoice_no", value: "CI-1", confidence: 0.98, source_ids: ["source-1"] }],
  issues: [],
  evidence: [{ evidence_id: "evidence-1", title: "수입 요건", law_id: "LAW-1", excerpt: "신고확인증이 필요하다.", source_uri: "https://law.example/1", source_hash: "c".repeat(64) }],
  findings: [],
  sources: [{ source_id: "source-1", document_id: "doc-1", label: "Invoice number", quote: "CI-1" }],
  narrative_report: {
    title: "사전심사 보고서",
    summary: [{ claim_id: "claim-1", text: "문서 정합성 문제가 없습니다.", citation_ids: ["source-1"] }],
    document_consistency: [],
    regulatory_review: [{ claim_id: "claim-2", text: "적용 요건을 조회했습니다.", citation_ids: ["evidence-1"] }],
    impact: [],
    recommended_actions: [],
    generated_by: "claude",
    citation_verification: "passed",
  },
  action_trace: [{ action_id: "action-1", cycle: 0, tool: "evidence.retrieve/v3", status: "succeeded", reason_code: "hsk_exact", input_source_ids: ["source-1"], started_at: "2026-07-21T12:00:00Z" }],
  corrections: [],
  required_actions: [],
};

const proposal: CorrectionProposal = {
  proposal_id: "proposal-1",
  org_id: "org-1",
  review_run_id: "run-001",
  case_id: "case-1",
  idempotency_key: `idem_${"e".repeat(64)}`,
  idempotency_request_digest: "f".repeat(64),
  parent_result_digest: "a".repeat(64),
  parent_input_manifest_sha256: "b".repeat(64),
  case_revision: 1,
  corrections: [{ document_id: "doc-1", field_path: "fields.invoice_no", new_value: "CI-2", reason: "verified source", confidence: 1 }],
  actions: [],
  status: "pending",
  created_by: "reviewer-1",
  created_at: "2026-07-21T12:00:00Z",
};

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
};

const canonicalSha256 = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const REVIEW_REQUEST_SHA256 = canonicalSha256({ trade_type: "import", submitted_document_codes: [] });

function jobRecord(jobId: string, kind: "review" | "revision" = "review", createdBy = "reviewer-1"): JobRecord {
  return {
    job_id: jobId,
    case_id: "case-1",
    status: "queued",
    agent_call_state: "not_started",
    kind,
    attempt_count: 0,
    created_by: createdBy,
    parent_run_id: kind === "revision" ? "run-001" : null,
    review_run_id: "",
    created_at: "2026-07-21",
    updated_at: "2026-07-21",
  };
}

const recoveryKey = (subject = "reviewer-1"): string =>
  `customs.workbench.review-recovery.v3:org-1:${subject}`;

const reconciliationRecoveryKey = (subject = "reviewer-1"): string =>
  `customs.workbench.delivery-reconciliation-recovery.v1:org-1:${subject}`;

const proposalRecoveryKey = (subject = "approver-1"): string =>
  `customs.workbench.proposal-decision-recovery.v1:org-1:${subject}`;

function seedRecovery(subject: string, record: Omit<Record<string, unknown>, "org_id" | "subject">): void {
  const jobKind = record.job_kind === "revision" ? "revision" : "review";
  window.sessionStorage.setItem(recoveryKey(subject), JSON.stringify([{
    org_id: "org-1",
    subject,
    job_kind: jobKind,
    parent_run_id: jobKind === "revision" ? "run-001" : null,
    request_sha256: REVIEW_REQUEST_SHA256,
    ...record,
  }]));
}

function seedProposalDecisionRecovery(
  overrides: Record<string, unknown> = {},
): { rawKey: string; requestSha256: string; scopedKey: string } {
  const rawKey = "11111111-1111-4111-8111-111111111111";
  const decision = {
    decision: "approve",
    reason: "checked after independent review",
    parent_result_digest: "a".repeat(64),
    case_revision: 1,
  };
  const requestSha256 = canonicalSha256({ proposal_id: "proposal-1", decision });
  const scopedKey = `idem_${canonicalSha256({
    endpoint: "revision-proposal.decide/v1",
    actor_id: "approver-1",
    org_id: "org-1",
    case_id: "case-1",
    supplied_key: rawKey,
  })}`;
  window.sessionStorage.setItem(proposalRecoveryKey(), JSON.stringify([{
    org_id: "org-1",
    subject: "approver-1",
    case_id: "case-1",
    case_revision: 1,
    review_run_id: "run-001",
    proposal_id: "proposal-1",
    decision: "approve",
    parent_result_digest: "a".repeat(64),
    request_sha256: requestSha256,
    idempotency_key: rawKey,
    ...overrides,
  }]));
  return { rawKey, requestSha256, scopedKey };
}

function auth(authenticated: boolean): WorkbenchAuth {
  return {
    isAuthenticated: () => authenticated,
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  };
}

function fakeApi(): ApiClient {
  return {
    getSession: vi.fn(async () => ({ subject: "reviewer-1", org_id: "org-1", roles: ["reviewer"] })),
    listCases: vi.fn(async () => ({ items: [{ case_id: "case-1", org_id: "org-1", title: "<img src=x onerror=alert(1)>", status: "open", revision: 1, updated_at: "2026-07-21T12:00:00Z" }] })),
    createCase: vi.fn(),
    getCase: vi.fn(async () => ({ case_id: "case-1", org_id: "org-1", title: "안전 Case", status: "open", revision: 1, updated_at: "2026-07-21T12:00:00Z", created_at: "2026-07-21T12:00:00Z", documents: [], runs: [] })),
    listDocuments: vi.fn(async () => [{ document_id: "doc-1", case_id: "case-1", document_type: "CI", filename: "invoice.txt", media_type: "text/plain", content_text: "Invoice No: CI-1", content_sha256: "d".repeat(64), byte_size: 16, character_count: 16, created_by: "reviewer-1", created_at: "2026-07-21T12:00:00Z" }]),
    getDocumentContent: vi.fn(),
    addDocument: vi.fn(),
    listSupportingDocuments: vi.fn(async () => []),
    addSupportingDocument: vi.fn(),
    addSupportingAssertion: vi.fn(),
    enqueueReview: vi.fn(),
    getJob: vi.fn(),
    reconcileDeliveryUncertain: vi.fn(),
    listJobEvents: vi.fn(async () => []),
    streamJobEvents: vi.fn(async () => undefined),
    listReviewRuns: vi.fn(async () => [run]),
    getReviewRun: vi.fn(async () => run),
    listRevisionProposals: vi.fn(async () => []),
    createRevisionProposal: vi.fn(),
    decideRevisionProposal: vi.fn(),
    listDecisions: vi.fn(async () => []),
    answerCaseQuestion: vi.fn(),
    listChat: vi.fn(async () => []),
    getAuditEvents: vi.fn(async () => []),
  } as unknown as ApiClient;
}

describe("review workbench", () => {
  it("renders an accessible OIDC entry without exposing visual upload", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const app = new WorkbenchApp(root, fakeApi(), auth(false));

    await app.start();

    expect(root.textContent).toContain("조직 계정으로 로그인");
    expect(root.textContent).toContain("PDF/이미지/OCR 입력은 아직 지원하지 않습니다");
    expect(root.querySelector('input[type="file"]')).toBeNull();
    const results = await axe.run(root);
    expect(results.violations).toEqual([]);
  });

  it("renders untrusted Backend text as text and separates the four result states", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const app = new WorkbenchApp(root, fakeApi(), auth(true));
    await app.start();

    const caseButton = [...root.querySelectorAll("button")].find((item) => item.textContent?.includes("<img src=x"));
    expect(caseButton).toBeDefined();
    caseButton!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("문서 정합성 문제가 없습니다."));

    expect(root.querySelector("img")).toBeNull();
    expect(root.textContent).toContain("실행");
    expect(root.textContent).toContain("문서·규정 평가");
    expect(root.textContent).toContain("업무 처리");
    expect(root.textContent).toContain("보증 수준");
    expect(root.textContent).toContain("Evidence-bound Case Chat");
    expect(root.textContent).toContain("DIAGNOSTIC EVIDENCE — NOT RELEASED");
    expect(root.textContent).toContain("법적 판단 또는 Production 자동완료 근거로 사용할 수 없습니다");
    expect(root.querySelector('[data-evidence-release-state="diagnostic"]')).not.toBeNull();
    expect(root.textContent).toContain("원문 대조 확인 제안");
    expect(root.textContent).toContain("추출값 수정 제안");
    expect(root.textContent).toContain("요건서류 추가 제안");
    expect(root.textContent).toContain("심사 승인 제안");
    expect(root.textContent).toContain("심사 거절 제안");
    expect(root.textContent).toContain("결과 digest");
    const sourceCitation = [...root.querySelectorAll<HTMLButtonElement>("button.citation")].find((item) => item.textContent === "[source-1]");
    sourceCitation?.click();
    expect((document.activeElement as HTMLElement | null)?.dataset.sourceId).toBe("source-1");
    const accessibility = await axe.run(root);
    expect(accessibility.violations).toEqual([]);
  });

  it("marks Evidence as release-bound only for a production automatic-completion Run", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    const released: ReviewRun = {
      ...run,
      assurance_level: "production",
      review_disposition: "auto_review_complete",
      input_document_manifest: [{ document_id: "doc-1", document_type: "CI", content_sha256: "d".repeat(64) }],
      completion_eligibility: {
        eligible: true,
        profile_id: "profile-0303540000-v1",
        scope: ["KR/import/0303540000"],
        unmet_reason_codes: [],
      },
    };
    vi.mocked(api.listReviewRuns).mockResolvedValue([released]);
    vi.mocked(api.getReviewRun).mockResolvedValue(released);
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("RELEASE-BOUND EVIDENCE"));

    expect(root.textContent).not.toContain("DIAGNOSTIC EVIDENCE — NOT RELEASED");
    expect(root.querySelector('[data-evidence-release-state="release-bound"]')).not.toBeNull();
    app.destroy();
  });

  it("clears an expired bearer session and returns to the login affordance", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.getSession).mockRejectedValue(new ApiError("expired", 401));
    const session = auth(true);
    const app = new WorkbenchApp(root, api, session);
    await app.start();
    expect(root.textContent).toContain("세션이 만료되었습니다");
    expect(root.textContent).toContain("조직 계정으로 로그인");
    expect(session.clear).toHaveBeenCalledOnce();
  });

  it("keeps auditor Run detail readable when legacy Chat GET is forbidden and never enables Chat POST", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.getSession).mockResolvedValue({ subject: "auditor-1", org_id: "org-1", roles: ["auditor"] });
    vi.mocked(api.listChat).mockRejectedValue(new ApiError("forbidden", 403));
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    const create = [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "Case 생성");
    expect(create?.disabled).toBe(true);
    expect(root.textContent).toContain("현재 역할은 읽기 전용");
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("문서 정합성 문제가 없습니다."));
    expect(root.textContent).toContain("Chat 이력 권한이 아직 적용되지 않아");
    expect(root.textContent).toContain("Auditor는 저장된 Chat 이력을 읽을 수 있지만");
    expect(root.querySelector("form.chat-form")).toBeNull();
    expect(api.answerCaseQuestion).not.toHaveBeenCalled();
    app.destroy();
  });

  it("preserves exact text-document whitespace for Backend hashing", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.includes("<img src=x"))
      ?.click();
    await vi.waitFor(() => expect(root.querySelector("form.document-form")).not.toBeNull());
    const form = root.querySelector<HTMLFormElement>("form.document-form")!;
    const exactText = "  COMMERCIAL INVOICE\nInvoice No: CI-1\n  ";
    (form.elements.namedItem("filename") as HTMLInputElement).value = "invoice.txt";
    (form.elements.namedItem("content_text") as HTMLTextAreaElement).value = exactText;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(api.addDocument).toHaveBeenCalledOnce());
    expect(api.addDocument).toHaveBeenCalledWith("case-1", expect.objectContaining({
      content_text: exactText,
    }));
    app.destroy();
  });

  it("disables a review intent while enqueue is pending so duplicate Claude jobs cannot be created", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    let resolveJob!: (value: Awaited<ReturnType<ApiClient["enqueueReview"]>>) => void;
    vi.mocked(api.enqueueReview).mockReturnValue(new Promise((resolve) => { resolveJob = resolve; }));
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    const caseButton = [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"));
    caseButton?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("새 심사 실행"));
    const first = [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행");
    first?.click();
    await vi.waitFor(() => expect(api.enqueueReview).toHaveBeenCalledOnce());
    const pending = [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행");
    expect(pending?.disabled).toBe(true);
    pending?.click();
    expect(api.enqueueReview).toHaveBeenCalledOnce();
    resolveJob(jobRecord("job-1"));
    await vi.waitFor(() => expect(api.listJobEvents).toHaveBeenCalledWith("job-1"));
    app.destroy();
  });

  it("keeps authoritative Job tracking active when the optional stage ledger is unavailable", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.enqueueReview).mockResolvedValue(jobRecord("job-degraded"));
    vi.mocked(api.listJobEvents).mockRejectedValue(new ApiError("event stream unavailable", 503));
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("새 심사 실행"));
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("Job job-degraded"));
    expect(root.textContent).toContain("실행 단계 이벤트를 기다리는 중입니다.");
    expect(root.textContent).not.toContain("event stream unavailable");
    app.destroy();
  });

  it("binds supporting-document metadata to the selected source document hash", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.listDocuments).mockResolvedValue([
      { document_id: "doc-1", case_id: "case-1", document_type: "CI", filename: "invoice.txt", media_type: "text/plain", content_text: "Invoice No: CI-1", content_sha256: "d".repeat(64), byte_size: 16, character_count: 16, created_by: "reviewer-1", created_at: "2026-07-21T12:00:00Z" },
      { document_id: "support-1", case_id: "case-1", document_type: "SUPPORTING", filename: "permit.txt", media_type: "text/plain", content_text: "Permit P-1", content_sha256: "f".repeat(64), byte_size: 10, character_count: 10, created_by: "reviewer-1", created_at: "2026-07-21T12:00:00Z" },
    ]);
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.querySelector("form.supporting-form")).not.toBeNull());
    const form = root.querySelector<HTMLFormElement>("form.supporting-form")!;
    (form.elements.namedItem("document_code") as HTMLInputElement).value = "IMPORT_PERMIT";
    (form.elements.namedItem("issuer") as HTMLInputElement).value = "Test Issuer";
    (form.elements.namedItem("document_number") as HTMLInputElement).value = "P-1";
    (form.elements.namedItem("issued_on") as HTMLInputElement).value = "2026-01-01";
    (form.elements.namedItem("valid_until") as HTMLInputElement).value = "2027-01-01";
    (form.elements.namedItem("subject_item_ids") as HTMLInputElement).value = "item-1";
    (form.elements.namedItem("hs_codes") as HTMLInputElement).value = "0303540000";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(api.addSupportingDocument).toHaveBeenCalledOnce());
    expect(api.addSupportingDocument).toHaveBeenCalledWith("case-1", expect.objectContaining({
      document_id: "support-1",
      source_sha256: "f".repeat(64),
      subject_item_ids: ["item-1"],
      hs_codes: ["0303540000"],
    }));
    app.destroy();
  });

  it("hydrates bounded primary text through the authoritative content endpoint before rendering", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    const metadata = {
      document_id: "doc-1",
      case_id: "case-1",
      document_type: "CI" as const,
      filename: "invoice.txt",
      media_type: "text/plain" as const,
      content_sha256: "d".repeat(64),
      byte_size: 16,
      character_count: 16,
      created_by: "reviewer-1",
      created_at: "2026-07-21T12:00:00Z",
    };
    vi.mocked(api.listDocuments).mockResolvedValue([metadata]);
    vi.mocked(api.getDocumentContent).mockResolvedValue({ ...metadata, content_text: "Invoice No: CI-1" });
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();

    await vi.waitFor(() => expect(api.getDocumentContent).toHaveBeenCalledWith("case-1", "doc-1"));
    await vi.waitFor(() => expect(root.textContent).toContain("Invoice No: CI-1"));
    app.destroy();
  });

  it("creates source-bound UAT inputs but requires a different approver to assert them", async () => {
    for (const scenario of UAT_SCENARIOS.filter((item) => item.category === "clean" || item.category === "mismatch")) {
      expect(scenario.requires_approver).toBe(true);
      expect(scenario.supporting_document).toBeDefined();
      expect(scenario.documents.some((document) => document.document_type === "SUPPORTING")).toBe(true);
      expect(scenario).not.toHaveProperty("submitted_document_codes");
    }

    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    const createdDocuments: Array<Awaited<ReturnType<ApiClient["addDocument"]>>> = [];
    const caseDetail = {
      case_id: "case-uat",
      org_id: "org-1",
      title: "[UAT] 정상 문서 정합성 · 진단 Positive Control",
      external_reference: "UAT-clean_text_diagnostic-1",
      status: "open" as const,
      revision: 0,
      updated_at: "2026-07-21T12:00:00Z",
      created_at: "2026-07-21T12:00:00Z",
      documents: [],
      runs: [],
    };
    const supportingRecord = {
      document_id: "doc-supporting",
      document_code: "CCCT_DOC_46E819BB87B27371",
      issuer: "Synthetic Test Issuer",
      document_number: "TEST-REQ-2026-0001",
      issued_on: "2026-07-02",
      valid_until: "2026-12-31",
      subject_item_ids: ["doc-ci_line_1"],
      hs_codes: ["0303540000"],
      source_sha256: "e".repeat(64),
      case_id: "case-uat",
      org_id: "org-1",
      verification_assertions: [],
      created_by: "reviewer-1",
      created_at: "2026-07-21T12:00:00Z",
    };
    vi.mocked(api.getSession).mockResolvedValue({ subject: "reviewer-1", org_id: "org-1", roles: ["reviewer"] });
    vi.mocked(api.createCase).mockResolvedValue(caseDetail);
    vi.mocked(api.listCases).mockResolvedValue({ items: [caseDetail] });
    vi.mocked(api.getCase).mockResolvedValue(caseDetail);
    vi.mocked(api.listReviewRuns).mockResolvedValue([]);
    vi.mocked(api.addDocument).mockImplementation(async (_caseId, payload) => {
      const document = {
        document_id: payload.document_type === "SUPPORTING" ? "doc-supporting" : `doc-${payload.document_type.toLowerCase()}`,
        case_id: "case-uat",
        ...payload,
        content_sha256: payload.document_type === "SUPPORTING" ? "e".repeat(64) : "d".repeat(64),
        byte_size: new TextEncoder().encode(payload.content_text).length,
        character_count: payload.content_text.length,
        created_by: "reviewer-1",
        created_at: "2026-07-21T12:00:00Z",
      };
      createdDocuments.push(document);
      return document;
    });
    vi.mocked(api.listDocuments).mockImplementation(async () => createdDocuments);
    vi.mocked(api.addSupportingDocument).mockResolvedValue(supportingRecord);
    vi.mocked(api.listSupportingDocuments).mockResolvedValue([supportingRecord]);
    vi.mocked(api.enqueueReview).mockResolvedValue({ ...jobRecord("job-uat"), case_id: "case-uat" });

    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    const scenarioForm = [...root.querySelectorAll<HTMLFormElement>("form")]
      .find((form) => form.querySelector<HTMLSelectElement>('select[name="scenario"]'))!;
    const scenarioSelect = scenarioForm.elements.namedItem("scenario") as HTMLSelectElement;
    scenarioSelect.value = "clean_text_diagnostic";
    scenarioForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(api.addSupportingDocument).toHaveBeenCalledOnce());
    expect(api.addDocument).toHaveBeenCalledTimes(5);
    expect(api.addSupportingDocument).toHaveBeenCalledWith("case-uat", {
      document_id: "doc-supporting",
      document_code: "CCCT_DOC_46E819BB87B27371",
      issuer: "Synthetic Test Issuer",
      document_number: "TEST-REQ-2026-0001",
      issued_on: "2026-07-02",
      valid_until: "2026-12-31",
      subject_item_ids: ["doc-ci_line_1"],
      hs_codes: ["0303540000"],
      source_sha256: "e".repeat(64),
    });
    expect(api.addSupportingAssertion).not.toHaveBeenCalled();
    expect(root.textContent).toContain("작성자와 다른 approver가 요건서류를 검증한 뒤 실행하세요");

    await vi.waitFor(() => expect(root.textContent).toContain("새 심사 실행"));
    [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent === "새 심사 실행")
      ?.click();
    await vi.waitFor(() => expect(api.enqueueReview).toHaveBeenCalledOnce());
    expect(api.enqueueReview).toHaveBeenCalledWith(
      "case-uat",
      { trade_type: "import", submitted_document_codes: [] },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    app.destroy();
  });

  it("preserves an uncertain Job/key across reload and blocks every new Case review", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.enqueueReview).mockResolvedValue(jobRecord("job-uncertain"));
    vi.mocked(api.getJob).mockResolvedValue({
      ...jobRecord("job-uncertain"),
      status: "delivery_uncertain",
      agent_call_state: "delivery_uncertain",
      error_code: "agent_delivery_uncertain",
    });
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("새 심사 실행"));
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.click();
    await vi.waitFor(() => expect(api.enqueueReview).toHaveBeenCalledOnce());
    await (app as unknown as { pollJob(jobId: string): Promise<void> }).pollJob("job-uncertain");
    expect(root.textContent).toContain("Job과 Idempotency-Key를 보존");
    expect(root.querySelector(".reconciliation-form")).toBeNull();
    expect(root.textContent).toContain("Approver 또는 Admin 권한");
    expect([...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.disabled).toBe(true);
    const stored = JSON.parse(window.sessionStorage.getItem(recoveryKey()) ?? "null") as Array<Record<string, unknown>>;
    expect(stored).toEqual([expect.objectContaining({ case_id: "case-1", case_revision: 1, job_id: "job-uncertain" })]);
    expect(Object.keys(stored[0]!).sort()).toEqual(["case_id", "case_revision", "idempotency_key", "job_id", "job_kind", "org_id", "parent_run_id", "request_sha256", "subject"]);
    expect(stored[0]).toEqual(expect.objectContaining({
      job_kind: "review",
      parent_run_id: null,
      request_sha256: REVIEW_REQUEST_SHA256,
    }));
    expect(JSON.stringify(stored)).not.toMatch(/token|authorization|bearer/i);
    app.destroy();

    const restoredApi = fakeApi();
    vi.mocked(restoredApi.getJob).mockResolvedValue({
      ...jobRecord("job-uncertain"),
      status: "delivery_uncertain",
      agent_call_state: "delivery_uncertain",
      error_code: "agent_delivery_uncertain",
    });
    const restored = new WorkbenchApp(root, restoredApi, auth(true));
    await restored.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(restoredApi.getJob).toHaveBeenCalledWith("job-uncertain"));
    await vi.waitFor(() => expect(root.textContent).toContain("저장된 Job 상태 다시 확인"));
    expect([...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.disabled).toBe(true);
    restored.destroy();
  });

  it("lets only an approver resolve delivery uncertainty with independent evidence", async () => {
    seedRecovery("approver-1", {
      case_id: "case-1",
      case_revision: 1,
      job_id: "job-uncertain",
      idempotency_key: crypto.randomUUID(),
    });
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.getSession).mockResolvedValue({ subject: "approver-1", org_id: "org-1", roles: ["approver"] });
    vi.mocked(api.getJob).mockResolvedValue({
      ...jobRecord("job-uncertain", "review", "approver-1"),
      status: "delivery_uncertain",
      agent_call_state: "delivery_uncertain",
      error_code: "agent_delivery_uncertain",
    });
    vi.mocked(api.reconcileDeliveryUncertain).mockResolvedValue({
      ...jobRecord("job-uncertain", "review", "approver-1"),
      status: "failed",
      agent_call_state: "delivery_reconciled",
      error_code: "delivery_confirmed_not_processed",
    });
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.querySelector(".reconciliation-form")).not.toBeNull());
    const form = root.querySelector<HTMLFormElement>(".reconciliation-form")!;
    form.querySelector<HTMLInputElement>('[name="evidence_reference_sha256"]')!.value = "a".repeat(64);
    form.querySelector<HTMLTextAreaElement>('[name="reason"]')!.value = "Agent 수신 로그와 요청 원장을 독립 대조했습니다.";
    form.querySelector<HTMLInputElement>('[name="confirmed_not_processed"]')!.checked = true;
    form.requestSubmit();

    await vi.waitFor(() => expect(api.reconcileDeliveryUncertain).toHaveBeenCalledOnce());
    expect(api.reconcileDeliveryUncertain).toHaveBeenCalledWith("job-uncertain", {
      resolution: "confirmed_not_processed",
      evidence_reference_sha256: "a".repeat(64),
      reason: "Agent 수신 로그와 요청 원장을 독립 대조했습니다.",
    });
    await vi.waitFor(() => expect(root.textContent).toContain("기존 Job은 실패로 종결"));
    expect(window.sessionStorage.getItem(recoveryKey("approver-1"))).toBeNull();
    app.destroy();
  });

  it("recovers a delivery reconciliation completed in another session without presenting a generic failure", async () => {
    seedRecovery("reviewer-1", {
      case_id: "case-1",
      case_revision: 1,
      job_id: "job-reconciled",
      idempotency_key: crypto.randomUUID(),
    });
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.getJob).mockResolvedValue({
      ...jobRecord("job-reconciled"),
      status: "failed",
      agent_call_state: "delivery_reconciled",
      error_code: "delivery_confirmed_not_processed",
    });
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();

    await vi.waitFor(() => expect(root.textContent).toContain("Backend 감사 원장"));
    expect(root.textContent).not.toContain("심사 Job이 실패했습니다");
    expect(window.sessionStorage.getItem(recoveryKey())).toBeNull();
    expect([...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.disabled).toBe(false);
    app.destroy();
  });

  it("keeps the Case blocked when the reconciliation response is lost", async () => {
    seedRecovery("approver-1", {
      case_id: "case-1",
      case_revision: 1,
      job_id: "job-uncertain",
      idempotency_key: crypto.randomUUID(),
    });
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.getSession).mockResolvedValue({ subject: "approver-1", org_id: "org-1", roles: ["approver"] });
    vi.mocked(api.getJob).mockResolvedValue({
      ...jobRecord("job-uncertain", "review", "approver-1"),
      status: "delivery_uncertain",
      agent_call_state: "delivery_uncertain",
      error_code: "agent_delivery_uncertain",
    });
    vi.mocked(api.reconcileDeliveryUncertain).mockRejectedValue(new TypeError("response lost"));
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.querySelector(".reconciliation-form")).not.toBeNull());
    const form = root.querySelector<HTMLFormElement>(".reconciliation-form")!;
    form.querySelector<HTMLInputElement>('[name="evidence_reference_sha256"]')!.value = "b".repeat(64);
    form.querySelector<HTMLTextAreaElement>('[name="reason"]')!.value = "Agent 미수신 운영 증거를 독립적으로 확인했습니다.";
    form.querySelector<HTMLInputElement>('[name="confirmed_not_processed"]')!.checked = true;
    form.requestSubmit();

    await vi.waitFor(() => expect(api.reconcileDeliveryUncertain).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(root.textContent).toContain("response lost"));
    expect(window.sessionStorage.getItem(recoveryKey("approver-1"))).not.toBeNull();
    const reconciliationRecovery = window.sessionStorage.getItem(reconciliationRecoveryKey("approver-1"));
    expect(reconciliationRecovery).not.toBeNull();
    expect(reconciliationRecovery).not.toContain("Agent 미수신");
    expect(JSON.parse(reconciliationRecovery ?? "[]")).toEqual([
      expect.objectContaining({
        org_id: "org-1",
        subject: "approver-1",
        case_id: "case-1",
        job_id: "job-uncertain",
        request_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
    expect([...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.disabled).toBe(true);
    app.destroy();
  });

  it("requires an authoritative Job GET before retrying a delivery reconciliation after response loss", async () => {
    seedRecovery("approver-1", {
      case_id: "case-1",
      case_revision: 1,
      job_id: "job-uncertain",
      idempotency_key: crypto.randomUUID(),
    });
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    const order: string[] = [];
    vi.mocked(api.getSession).mockResolvedValue({ subject: "approver-1", org_id: "org-1", roles: ["approver"] });
    vi.mocked(api.getJob).mockImplementation(async () => {
      order.push("get");
      return {
        ...jobRecord("job-uncertain", "review", "approver-1"),
        status: "delivery_uncertain",
        agent_call_state: "delivery_uncertain",
        error_code: "agent_delivery_uncertain",
      };
    });
    vi.mocked(api.reconcileDeliveryUncertain)
      .mockImplementationOnce(async () => {
        order.push("post-1");
        throw new TypeError("response lost");
      })
      .mockImplementationOnce(async () => {
        order.push("post-2");
        return {
          ...jobRecord("job-uncertain", "review", "approver-1"),
          status: "failed",
          agent_call_state: "delivery_reconciled",
          error_code: "delivery_confirmed_not_processed",
        };
      });
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.querySelector(".reconciliation-form")).not.toBeNull());
    order.splice(0);

    const submit = (): void => {
      const form = root.querySelector<HTMLFormElement>(".reconciliation-form")!;
      form.querySelector<HTMLInputElement>('[name="evidence_reference_sha256"]')!.value = "b".repeat(64);
      form.querySelector<HTMLTextAreaElement>('[name="reason"]')!.value = "Agent 미수신 운영 증거를 독립적으로 확인했습니다.";
      form.querySelector<HTMLInputElement>('[name="confirmed_not_processed"]')!.checked = true;
      form.requestSubmit();
    };

    submit();
    await vi.waitFor(() => expect(root.textContent).toContain("response lost"));
    expect(order).toEqual(["post-1"]);
    submit();
    await vi.waitFor(() => expect(api.reconcileDeliveryUncertain).toHaveBeenCalledTimes(2));
    expect(order).toEqual(["post-1", "get", "post-2"]);
    await vi.waitFor(() => expect(window.sessionStorage.getItem(reconciliationRecoveryKey("approver-1"))).toBeNull());
    app.destroy();
  });

  it("does not accept a polled Job that belongs to another Case", async () => {
    seedRecovery("reviewer-1", {
      case_id: "case-1",
      case_revision: 1,
      job_id: "job-bound",
      idempotency_key: crypto.randomUUID(),
    });
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.getJob).mockResolvedValue({ ...jobRecord("job-bound"), case_id: "case-other" });
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();

    await vi.waitFor(() => expect(root.textContent).toContain("저장된 Job 상태를 확인하지 못했습니다"));
    expect(window.sessionStorage.getItem(recoveryKey())).not.toBeNull();
    expect([...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.disabled).toBe(true);
    app.destroy();
  });

  it("rejects restored review Jobs from a revision lineage or another authenticated actor", async () => {
    for (const attackedJob of [
      { ...jobRecord("job-bound", "revision"), created_by: "reviewer-1" },
      { ...jobRecord("job-bound"), created_by: "other-reviewer" },
    ]) {
      window.sessionStorage.clear();
      seedRecovery("reviewer-1", {
        case_id: "case-1",
        case_revision: 1,
        job_id: "job-bound",
        idempotency_key: crypto.randomUUID(),
      });
      const root = document.createElement("div");
      document.body.append(root);
      const api = fakeApi();
      vi.mocked(api.getJob).mockResolvedValue(attackedJob);
      const app = new WorkbenchApp(root, api, auth(true));

      await app.start();
      [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();

      await vi.waitFor(() => expect(root.textContent).toContain("저장된 Job 상태를 확인하지 못했습니다"));
      expect(window.sessionStorage.getItem(recoveryKey())).not.toBeNull();
      expect([...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.disabled).toBe(true);
      app.destroy();
      root.remove();
    }
  });

  it("rejects a tampered review recovery request digest before any Job lookup", async () => {
    seedRecovery("reviewer-1", {
      case_id: "case-1",
      case_revision: 1,
      job_id: "job-bound",
      request_sha256: "f".repeat(64),
      idempotency_key: crypto.randomUUID(),
    });
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();

    expect(root.textContent).toContain("Job 복구 상태 1번의 값이 올바르지 않습니다");
    expect(api.getJob).not.toHaveBeenCalled();
    app.destroy();
  });

  it("replays a response-lost enqueue only with the preserved Idempotency-Key", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.enqueueReview)
      .mockRejectedValueOnce(new TypeError("connection reset after request"))
      .mockResolvedValueOnce(jobRecord("job-replayed"));
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("새 심사 실행"));
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.click();
    await vi.waitFor(() => expect(api.enqueueReview).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(root.textContent).toContain("동일 요청 키로 안전하게 재조회"));
    const firstKey = vi.mocked(api.enqueueReview).mock.calls[0]?.[2];
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "동일 요청 키로 안전하게 재조회")?.click();
    await vi.waitFor(() => expect(api.enqueueReview).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.enqueueReview).mock.calls[1]?.[2]).toBe(firstKey);
    expect([...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.disabled).toBe(true);
    app.destroy();
  });

  it("shows a response-loss recovery even when an older failed Job remains on screen", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.enqueueReview)
      .mockResolvedValueOnce({ ...jobRecord("job-old"), status: "failed", error_code: "old-failure" })
      .mockRejectedValueOnce(new TypeError("new response lost"));
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("새 심사 실행"));
    const runButton = () => [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행");
    runButton()?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("old-failure"));
    runButton()?.click();

    await vi.waitFor(() => expect(root.textContent).toContain("동일 요청 키로 안전하게 재조회"));
    expect(window.sessionStorage.getItem(recoveryKey())).not.toBeNull();
    expect(runButton()?.disabled).toBe(true);
    app.destroy();
  });

  it("uses bounded exponential backoff after transient authoritative Job polling errors", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    seedRecovery("reviewer-1", {
      case_id: "case-1",
      case_revision: 1,
      job_id: "job-reconnect",
      idempotency_key: crypto.randomUUID(),
    });
    const api = fakeApi();
    vi.mocked(api.getJob).mockRejectedValue(new ApiError("temporary", 503));
    const timeout = vi.spyOn(window, "setTimeout");
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("자동 재조회"));
    expect(timeout.mock.calls.some((call) => call[1] === 1_000)).toBe(true);
    await (app as unknown as { pollJob(jobId: string): Promise<void> }).pollJob("job-reconnect");
    expect(timeout.mock.calls.some((call) => call[1] === 2_000)).toBe(true);
    expect([...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "새 심사 실행")?.disabled).toBe(true);
    timeout.mockRestore();
    app.destroy();
  });

  it("binds confirm, supporting-document, and terminal actions to typed revision proposals", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.listSupportingDocuments).mockResolvedValue([{
      document_id: "support-record-1",
      document_code: "IMPORT_PERMIT",
      issuer: "Test Issuer",
      document_number: "PERMIT-1",
      issued_on: "2026-07-01",
      valid_until: "2027-07-01",
      subject_item_ids: ["item-1"],
      hs_codes: ["0303540000"],
      source_sha256: "f".repeat(64),
      case_id: "case-1",
      org_id: "org-1",
      verification_assertions: [],
      created_by: "reviewer-2",
      created_at: "2026-07-21T12:00:00Z",
    }]);
    vi.mocked(api.createRevisionProposal).mockImplementation(async (_runId, payload) => ({
      ...proposal,
      corrections: [],
      actions: payload.actions,
    }));
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.includes("<img src=x"))
      ?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("원문 대조 확인 제안"));

    const submit = async (label: string, reason: string): Promise<void> => {
      const details = [...root.querySelectorAll<HTMLDetailsElement>("details.revision-action")]
        .find((item) => item.querySelector("summary")?.textContent === label)!;
      const form = details.querySelector<HTMLFormElement>("form")!;
      (form.elements.namedItem("reason") as HTMLTextAreaElement).value = reason;
      const expectedCalls = vi.mocked(api.createRevisionProposal).mock.calls.length + 1;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await vi.waitFor(() => expect(api.createRevisionProposal).toHaveBeenCalledTimes(expectedCalls));
      await vi.waitFor(() => expect(root.querySelector("main")?.getAttribute("aria-busy")).toBe("false"));
    };

    await submit("원문 대조 확인 제안", "source checked");
    await submit("요건서류 추가 제안", "permit added");
    await submit("심사 승인 제안", "ready for independent approval");

    const payloads = vi.mocked(api.createRevisionProposal).mock.calls.map((call) => call[1]);
    expect(payloads[0]?.actions).toEqual([{ decision: "confirm_field", reason: "source checked", confirmed_reference_id: "source-1" }]);
    expect(payloads[1]?.actions).toEqual([{ decision: "add_supporting_document", reason: "permit added", supporting_document_id: "support-record-1" }]);
    expect(payloads[2]?.actions).toEqual([{ decision: "approve_review", reason: "ready for independent approval" }]);
    app.destroy();
  });

  it("persists a reviewer correction as a typed proposal instead of directly creating a revision", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.createRevisionProposal).mockResolvedValue({
      ...proposal,
      corrections: [],
      actions: [{
        decision: "correct_field",
        reason: "verified source",
        correction: proposal.corrections[0]!,
      }],
    });
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("추출값 수정 제안"));
    const details = [...root.querySelectorAll<HTMLDetailsElement>("details.revision-action")]
      .find((item) => item.querySelector("summary")?.textContent === "추출값 수정 제안")!;
    const form = details.querySelector<HTMLFormElement>("form.hitl-form")!;
    (form.elements.namedItem("new_value") as HTMLInputElement).value = "CI-2";
    (form.elements.namedItem("reason") as HTMLTextAreaElement).value = "verified source";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(api.createRevisionProposal).toHaveBeenCalledOnce());
    expect(api.createRevisionProposal).toHaveBeenCalledWith("run-001", {
      parent_result_digest: "a".repeat(64),
      parent_input_manifest_sha256: "b".repeat(64),
      case_revision: 1,
      actions: [{
        decision: "correct_field",
        reason: "verified source",
        correction: { document_id: "doc-1", field_path: "fields.invoice_no", new_value: "CI-2", reason: "verified source", confidence: 1 },
      }],
    }, expect.stringMatching(/^proposal_[a-f0-9]{64}$/));
    expect((api as unknown as { createRevision?: unknown }).createRevision).toBeUndefined();
    app.destroy();
  });

  it("allows only an approver to approve a persisted proposal and create the child Job", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.getSession).mockResolvedValue({ subject: "approver-1", org_id: "org-1", roles: ["approver"] });
    vi.mocked(api.listRevisionProposals)
      .mockResolvedValueOnce([proposal])
      .mockResolvedValueOnce([{ ...proposal, status: "approved", child_job_id: "child-job-1", decided_by: "approver-1", decided_at: "2026-07-21T12:01:00Z" }]);
    vi.mocked(api.decideRevisionProposal).mockImplementation(async (proposalId, decisionRequest, suppliedKey) => ({
      proposal: { ...proposal, status: "approved", child_job_id: "child-job-1", decided_by: "approver-1", decided_at: "2026-07-21T12:01:00Z" },
      decision: {
        decision_id: "decision-1",
        org_id: "org-1",
        case_id: "case-1",
        review_run_id: "run-001",
        proposal_id: "proposal-1",
        decision: "approve",
        reason: "checked",
        decided_by: "approver-1",
        created_at: "2026-07-21T12:01:00Z",
        idempotency_key: `idem_${canonicalSha256({
          endpoint: "revision-proposal.decide/v1",
          actor_id: "approver-1",
          org_id: "org-1",
          case_id: "case-1",
          supplied_key: suppliedKey,
        })}`,
        idempotency_request_digest: canonicalSha256({ proposal_id: proposalId, decision: decisionRequest }),
      },
      job: { ...jobRecord("child-job-1", "revision", "approver-1"), review_run_id: "run-child-1" },
    }));
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("제안 승인·재심사"));
    const approve = [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "제안 승인·재심사")!;
    const form = approve.closest("form") as HTMLFormElement;
    (form.elements.namedItem("reason") as HTMLInputElement).value = "checked";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(api.decideRevisionProposal).toHaveBeenCalledOnce());
    expect(api.decideRevisionProposal).toHaveBeenCalledWith(
      "proposal-1",
      { decision: "approve", reason: "checked", parent_result_digest: "a".repeat(64), case_revision: 1 },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    await vi.waitFor(() => expect(api.listJobEvents).toHaveBeenCalledWith("child-job-1"));
    app.destroy();
  });

  it("rejects direct terminal Proposal responses with mismatched actor, status, or child Job lineage", async () => {
    const attacks: Array<{
      decision: "approve" | "reject";
      mutate: (response: CorrectionProposalDecisionResponse) => void;
    }> = [
      { decision: "approve", mutate: (response) => { response.proposal.decided_by = "other-approver"; } },
      { decision: "approve", mutate: (response) => { response.proposal.status = "rejected"; } },
      { decision: "approve", mutate: (response) => { response.proposal.child_job_id = "child-job-other"; } },
      {
        decision: "reject",
        mutate: (response) => {
          response.proposal.child_job_id = "child-job-for-rejection";
          response.job = { ...jobRecord("child-job-for-rejection", "revision", "approver-1") };
        },
      },
    ];
    for (const attack of attacks) {
      window.sessionStorage.clear();
      const root = document.createElement("div");
      document.body.append(root);
      const api = fakeApi();
      vi.mocked(api.getSession).mockResolvedValue({ subject: "approver-1", org_id: "org-1", roles: ["approver"] });
      vi.mocked(api.listRevisionProposals).mockResolvedValue([proposal]);
      vi.mocked(api.decideRevisionProposal).mockImplementation(async (proposalId, decisionRequest, suppliedKey) => {
        const approved = attack.decision === "approve";
        const response: CorrectionProposalDecisionResponse = {
          proposal: {
            ...proposal,
            status: approved ? "approved" : "rejected",
            ...(approved ? { child_job_id: "child-job-1" } : {}),
            decided_by: "approver-1",
            decided_at: "2026-07-21T12:01:00Z",
          },
          decision: {
            decision_id: "decision-attack",
            org_id: "org-1",
            case_id: "case-1",
            review_run_id: "run-001",
            proposal_id: "proposal-1",
            decision: attack.decision,
            reason: "checked",
            decided_by: "approver-1",
            created_at: "2026-07-21T12:01:00Z",
            idempotency_key: `idem_${canonicalSha256({
              endpoint: "revision-proposal.decide/v1",
              actor_id: "approver-1",
              org_id: "org-1",
              case_id: "case-1",
              supplied_key: suppliedKey,
            })}`,
            idempotency_request_digest: canonicalSha256({ proposal_id: proposalId, decision: decisionRequest }),
          },
          ...(approved ? { job: { ...jobRecord("child-job-1", "revision", "approver-1") } } : {}),
        };
        attack.mutate(response);
        return response;
      });
      const app = new WorkbenchApp(root, api, auth(true));

      await app.start();
      [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
      const buttonText = attack.decision === "approve" ? "제안 승인·재심사" : "제안 거절";
      await vi.waitFor(() => expect(root.textContent).toContain(buttonText));
      const button = [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === buttonText)!;
      const form = button.closest("form") as HTMLFormElement;
      (form.elements.namedItem("reason") as HTMLInputElement).value = "checked";
      form.requestSubmit();

      await vi.waitFor(() => expect(root.textContent).toContain("계보와 일치하지 않습니다"));
      expect(api.getJob).not.toHaveBeenCalled();
      expect(api.listJobEvents).not.toHaveBeenCalled();
      app.destroy();
      root.remove();
    }
  });

  it("persists proposal-decision intent before POST and recovers an authoritative child Job after response loss", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.getSession).mockResolvedValue({ subject: "approver-1", org_id: "org-1", roles: ["approver"] });
    vi.mocked(api.listRevisionProposals).mockResolvedValue([proposal]);
    vi.mocked(api.decideRevisionProposal).mockRejectedValue(new TypeError("response lost after commit"));
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("제안 승인·재심사"));
    const approve = [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === "제안 승인·재심사")!;
    const form = approve.closest("form") as HTMLFormElement;
    (form.elements.namedItem("reason") as HTMLInputElement).value = "checked after independent review";
    form.requestSubmit();
    await vi.waitFor(() => expect(api.decideRevisionProposal).toHaveBeenCalledOnce());
    const stored = JSON.parse(window.sessionStorage.getItem(proposalRecoveryKey()) ?? "null") as Array<Record<string, unknown>>;
    expect(stored).toEqual([expect.objectContaining({
      proposal_id: "proposal-1",
      review_run_id: "run-001",
      case_id: "case-1",
      decision: "approve",
      org_id: "org-1",
      subject: "approver-1",
    })]);
    expect(JSON.stringify(stored)).not.toContain("checked after independent review");
    app.destroy();

    const restoredApi = fakeApi();
    vi.mocked(restoredApi.getSession).mockResolvedValue({ subject: "approver-1", org_id: "org-1", roles: ["approver"] });
    vi.mocked(restoredApi.listRevisionProposals).mockResolvedValue([{
      ...proposal,
      status: "approved",
      child_job_id: "child-job-recovered",
      decided_by: "approver-1",
      decided_at: "2026-07-21T12:01:00Z",
    }]);
    const storedRecovery = stored[0]!;
    vi.mocked(restoredApi.listDecisions).mockResolvedValue([{
      decision_id: "decision-recovered",
      org_id: "org-1",
      case_id: "case-1",
      review_run_id: "run-001",
      proposal_id: "proposal-1",
      decision: "approve",
      reason: "checked after independent review",
      decided_by: "approver-1",
      created_at: "2026-07-21T12:01:00Z",
      idempotency_key: `idem_${canonicalSha256({
        endpoint: "revision-proposal.decide/v1",
        actor_id: "approver-1",
        org_id: "org-1",
        case_id: "case-1",
        supplied_key: storedRecovery.idempotency_key,
      })}`,
      idempotency_request_digest: String(storedRecovery.request_sha256),
    }]);
    vi.mocked(restoredApi.getJob).mockResolvedValue({
      ...jobRecord("child-job-recovered", "revision", "approver-1"),
    });
    const restored = new WorkbenchApp(root, restoredApi, auth(true));
    await restored.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(restoredApi.getJob).toHaveBeenCalledWith("child-job-recovered"));
    expect(window.sessionStorage.getItem(proposalRecoveryKey())).toBeNull();
    expect(window.sessionStorage.getItem(recoveryKey("approver-1"))).not.toBeNull();
    restored.destroy();
  });

  it("marks terminal proposal decisions by another actor, key, or request digest as superseded without binding their child Job", async () => {
    const attacks = [
      {},
      { decided_by: "other-approver" },
      { idempotency_key: `idem_${"d".repeat(64)}` },
      { idempotency_request_digest: "f".repeat(64) },
    ];
    for (const attack of attacks) {
      window.sessionStorage.clear();
      const binding = seedProposalDecisionRecovery();
      const root = document.createElement("div");
      document.body.append(root);
      const api = fakeApi();
      vi.mocked(api.getSession).mockResolvedValue({ subject: "approver-1", org_id: "org-1", roles: ["approver"] });
      vi.mocked(api.listRevisionProposals).mockResolvedValue([{
        ...proposal,
        status: "approved",
        child_job_id: "child-job-other-intent",
        decided_by: "other-approver",
        decided_at: "2026-07-21T12:01:00Z",
      }]);
      vi.mocked(api.listDecisions).mockResolvedValue([{
        decision_id: "decision-other-intent",
        org_id: "org-1",
        case_id: "case-1",
        review_run_id: "run-001",
        proposal_id: "proposal-1",
        decision: "approve",
        reason: "another terminal decision",
        decided_by: "approver-1",
        created_at: "2026-07-21T12:01:00Z",
        idempotency_key: binding.scopedKey,
        idempotency_request_digest: binding.requestSha256,
        ...attack,
      }]);
      const app = new WorkbenchApp(root, api, auth(true));

      await app.start();
      [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();

      await vi.waitFor(() => expect(root.textContent).toContain("superseded"));
      expect(api.getJob).not.toHaveBeenCalled();
      expect(window.sessionStorage.getItem(proposalRecoveryKey())).toBeNull();
      expect(window.sessionStorage.getItem(recoveryKey("approver-1"))).toBeNull();
      app.destroy();
      root.remove();
    }
  });

  it("keeps pending proposal controls disabled unless result, manifest, revision, and every target ID are current", async () => {
    const staleProposals: CorrectionProposal[] = [
      { ...proposal, parent_result_digest: "f".repeat(64) },
      { ...proposal, parent_input_manifest_sha256: "f".repeat(64) },
      { ...proposal, case_revision: 2 },
      { ...proposal, corrections: [{ ...proposal.corrections[0]!, field_path: "fields.unknown" }] },
      { ...proposal, corrections: [], actions: [{ decision: "confirm_field", reason: "check", confirmed_reference_id: "source-unknown" }] },
      { ...proposal, corrections: [], actions: [{ decision: "add_supporting_document", reason: "check", supporting_document_id: "support-unknown" }] },
    ];
    for (const staleProposal of staleProposals) {
      const root = document.createElement("div");
      document.body.append(root);
      const api = fakeApi();
      vi.mocked(api.getSession).mockResolvedValue({ subject: "approver-1", org_id: "org-1", roles: ["approver"] });
      vi.mocked(api.listRevisionProposals).mockResolvedValue([staleProposal]);
      const app = new WorkbenchApp(root, api, auth(true));

      await app.start();
      [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();

      await vi.waitFor(() => expect(root.textContent).toContain("Proposal"));
      expect([...root.querySelectorAll<HTMLButtonElement>("button")].some((item) => item.textContent === "제안 승인·재심사")).toBe(false);
      expect(root.querySelector(".correction-proposal .notice--warning")).not.toBeNull();
      expect(api.decideRevisionProposal).not.toHaveBeenCalled();
      app.destroy();
      root.remove();
    }
  });

  it("does not offer maker-checker decisions to the proposal creator", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.getSession).mockResolvedValue({ subject: "approver-1", org_id: "org-1", roles: ["approver"] });
    vi.mocked(api.listRevisionProposals).mockResolvedValue([{ ...proposal, created_by: "approver-1" }]);
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("자신이 만든 revision 제안은 결정할 수 없습니다"));
    expect([...root.querySelectorAll<HTMLButtonElement>("button")].some((item) => item.textContent === "제안 승인·재심사")).toBe(false);
    expect(api.decideRevisionProposal).not.toHaveBeenCalled();
    app.destroy();
  });
});
