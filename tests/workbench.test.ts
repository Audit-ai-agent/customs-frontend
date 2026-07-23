import axe from "axe-core";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { WorkbenchApp, type WorkbenchAuth } from "../src/app";
import { ApiError, type ApiClient } from "../src/api/v1/client";
import type { CaseDocument, ChatRecord, CorrectionProposal, CorrectionProposalDecisionResponse, JobRecord, ModelExecutionSummary, ReviewRun } from "../src/api/v1/types";
import {
  localUatScenarioExternalReference,
  UAT_SCENARIOS,
  type LocalUatScenario,
} from "../src/uat/scenarios";

const SUPPORTED_REVIEW_AS_OF = "2026-07-10";
const ACTUAL_MODEL_EXECUTION: ModelExecutionSummary = {
  provider: "anthropic",
  model_id: "claude-sonnet-4-20250514",
  text_only: true,
  call_count: 2,
  input_tokens_total: 1_200,
  output_tokens_total: 320,
  prompt_hashes_complete: true,
  schema_hashes_complete: true,
  runtime_identity_match: true,
  audit_complete: true,
  unmet_reason_codes: [],
};
const EMPTY_MODEL_EXECUTION: ModelExecutionSummary = {
  provider: null,
  model_id: null,
  text_only: false,
  call_count: 0,
  input_tokens_total: 0,
  output_tokens_total: 0,
  prompt_hashes_complete: false,
  schema_hashes_complete: false,
  runtime_identity_match: false,
  audit_complete: false,
  unmet_reason_codes: ["no_model_calls"],
};
const SYNTHETIC_EVIDENCE_DATASET = {
  data_source: "SYNTHETIC_V3_NO_RAG_QUALITY",
  expected_production_law_count: 58,
  observed_law_count: 0,
  observed_article_count: 0,
  store_counts: {
    postgresql_article_count: 0,
    qdrant_point_count: 0,
    neo4j_article_count: 0,
  },
  rag_quality_evaluated: false,
} as const;
const ACTUAL_THREE_LAW_EVIDENCE_DATASET = {
  data_source: "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY",
  expected_production_law_count: 58,
  observed_law_count: 3,
  observed_article_count: 1_007,
  store_counts: {
    postgresql_article_count: 1_007,
    qdrant_point_count: 1_007,
    neo4j_article_count: 1_007,
  },
  rag_quality_evaluated: false,
} as const;

const run: ReviewRun = {
  review_run_id: "run-001",
  case_id: "case-1",
  org_id: "org-1",
  case_revision: 1,
  review_as_of: SUPPORTED_REVIEW_AS_OF,
  created_at: "2026-07-21T12:00:00Z",
  execution_status: "partial",
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
  model_execution_summary: ACTUAL_MODEL_EXECUTION,
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
  review_stage_trace: [{ sequence: 7, stage: "retrieve_regulations", status: "completed", reason_ids: [] }],
};

const CLAUDE_CHAT: ChatRecord = {
  message_id: "message-1",
  review_run_id: "run-001",
  case_id: "case-1",
  org_id: "org-1",
  question: "이 Case의 결론 근거는 무엇인가요?",
  answer: "문서 원문의 Invoice 번호를 근거로 설명합니다.",
  answer_status: "answered",
  citations: [{ reference_id: "source-1" }],
  generation_mode: "claude",
  model_execution_summary: { ...ACTUAL_MODEL_EXECUTION, call_count: 1, input_tokens_total: 240, output_tokens_total: 80 },
  bound_result_digest: "a".repeat(64),
  idempotency_key: `idem_${"1".repeat(64)}`,
  idempotency_request_digest: "2".repeat(64),
  created_by: "reviewer-1",
  created_at: "2026-07-21T12:00:00Z",
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
const REVIEW_REQUEST_SHA256 = canonicalSha256({
  review_as_of: SUPPORTED_REVIEW_AS_OF,
  trade_type: "import",
  submitted_document_codes: [],
});

const CLEAN_SCENARIO = UAT_SCENARIOS.find((item) => item.scenario_id === "clean_text_no_requirement_uat")!;
const CLEAN_SCENARIO_REFERENCE = localUatScenarioExternalReference(CLEAN_SCENARIO);

function scenarioDocumentRecords(scenario: LocalUatScenario): CaseDocument[] {
  return scenario.documents.map((document, index) => ({
    document_id: `doc-${index + 1}`,
    case_id: "case-1",
    document_type: document.document_type,
    filename: document.filename,
    media_type: document.media_type,
    content_text: document.content_text,
    content_sha256: createHash("sha256").update(document.content_text).digest("hex"),
    byte_size: Buffer.byteLength(document.content_text, "utf8"),
    character_count: document.content_text.length,
    created_by: "reviewer-1",
    created_at: "2026-07-21T12:00:00Z",
  }));
}

function bindScenarioInput(api: ApiClient, scenario: LocalUatScenario): CaseDocument[] {
  const documents = scenarioDocumentRecords(scenario);
  vi.mocked(api.listDocuments).mockResolvedValue(documents);
  const expectedSupporting = scenario.supporting_document;
  if (expectedSupporting === undefined) {
    vi.mocked(api.listSupportingDocuments).mockResolvedValue([]);
    return documents;
  }
  const source = documents.find((document) => (
    document.document_type === "SUPPORTING" && document.filename === expectedSupporting.filename
  ))!;
  const invoice = documents.find((document) => document.document_type === "CI")!;
  vi.mocked(api.listSupportingDocuments).mockResolvedValue([{
    case_id: "case-1",
    org_id: "org-1",
    document_id: source.document_id,
    document_code: expectedSupporting.document_code,
    issuer: expectedSupporting.issuer,
    document_number: expectedSupporting.document_number,
    issued_on: expectedSupporting.issued_on,
    valid_until: expectedSupporting.valid_until,
    subject_item_ids: [`${invoice.document_id}_line_1`],
    hs_codes: [...expectedSupporting.hs_codes],
    source_sha256: source.content_sha256,
    verification_assertions: [],
    created_by: "reviewer-1",
    created_at: "2026-07-21T12:00:00Z",
  }]);
  return documents;
}

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
  `customs.workbench.review-recovery.v4:org-1:${subject}`;

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
    review_as_of: jobKind === "review" ? SUPPORTED_REVIEW_AS_OF : null,
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
    getUatMetadata: vi.fn(async () => ({
      mode: "local_uat",
      assurance_ceiling: "diagnostic",
      text_only: true,
      auto_completion_enabled: false,
      claude_mode: "actual",
      evidence_profile: "synthetic-v3",
      evidence_scope_label: "TEST_ONLY_V3",
      evidence_dataset: SYNTHETIC_EVIDENCE_DATASET,
      supported_review_as_of: SUPPORTED_REVIEW_AS_OF,
      planner_mode: "shadow",
      production_release: false,
    })),
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
    expect(root.textContent).toContain("PDF/이미지/OCR 입력은 명시적으로 거절됩니다");
    expect(root.querySelector('input[type="file"]')).toBeNull();
    const results = await axe.run(root);
    expect(results.violations).toEqual([]);
  });

  it("renders untrusted Backend text as text and separates the four result states", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const app = new WorkbenchApp(root, fakeApi(), auth(true));
    await app.start();

    expect(root.textContent).toContain("LOCAL UAT / DIAGNOSTIC · TEXT ONLY · NOT PRODUCTION");
    expect(root.textContent).toContain("Claude: actual");
    expect(root.textContent).toContain("Evidence: synthetic-v3 · TEST-ONLY V3");
    expect(root.textContent).toContain("Planner: shadow");
    expect(root.textContent).toContain("Auto-completion: OFF");
    expect(root.querySelector('[data-uat-metadata="verified"]')).not.toBeNull();
    expect(root.querySelector<HTMLOptionElement>(
      'option[value="actual_3law_structured_requirement_human_only"]',
    )?.disabled).toBe(true);
    expect(root.querySelector<HTMLOptionElement>(
      'option[value="clean_text_no_requirement_uat"]',
    )?.disabled).toBe(false);

    const caseButton = [...root.querySelectorAll("button")].find((item) => item.textContent?.includes("<img src=x"));
    expect(caseButton).toBeDefined();
    caseButton!.click();
    await vi.waitFor(() => expect(root.textContent).toContain("문서 정합성 문제가 없습니다."));
    expect(root.textContent).toContain("Claude 표현 · 코드 검증");

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

  it("labels a Backend policy-overlaid V3 narrative without presenting it as Claude prose", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    const overlaidRun: ReviewRun = {
      ...run,
      narrative_report: {
        ...run.narrative_report!,
        generated_by: "backend_policy_overlay",
      },
    };
    vi.mocked(api.listReviewRuns).mockResolvedValue([overlaidRun]);
    vi.mocked(api.getReviewRun).mockResolvedValue(overlaidRun);
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.includes("<img src=x"))
      ?.click();

    await vi.waitFor(() => expect(root.textContent).toContain("Backend 안전 정책 보정"));
    expect(root.textContent).not.toContain("Claude 표현 · 코드 검증");
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

  it("renders an explicit direct parent-versus-child result diff without mutating either Run", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    const parent: ReviewRun = {
      ...run,
      review_run_id: "run-parent",
      assessment: "issues_detected",
      fields: [{ ...run.fields[0]!, value: "CI-1" }],
      issues: [{ issue_id: "issue-parent", code: "INVOICE_NO_MISMATCH", severity: "high", message: "mismatch", source_ids: ["source-1"] }],
    };
    const child: ReviewRun = {
      ...run,
      review_run_id: "run-child",
      parent_run_id: "run-parent",
      assessment: "no_issue_detected",
      fields: [{ ...run.fields[0]!, value: "CI-2" }],
      issues: [],
    };
    vi.mocked(api.listReviewRuns).mockResolvedValue([child, parent]);
    vi.mocked(api.getReviewRun).mockImplementation(async (runId) => runId === "run-child" ? child : parent);
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("<img src=x"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("부모–자식 Run 변경 비교"));

    expect(api.getReviewRun).toHaveBeenCalledWith("run-child");
    expect(api.getReviewRun).toHaveBeenCalledWith("run-parent");
    expect(root.textContent).toContain("run-parent → run-child");
    expect(root.textContent).toContain("issues detected");
    expect(root.textContent).toContain("no issue detected");
    expect(root.textContent).toContain("INVOICE_NO_MISMATCH");
    expect(root.textContent).toContain("fields.invoice_no");
    expect(root.textContent).toContain("CI-1");
    expect(root.textContent).toContain("CI-2");
    expect(root.querySelectorAll(".run-diff-row--changed").length).toBeGreaterThanOrEqual(3);
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
    expect(root.textContent).toContain("Job 처리: queued");
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

  it("defines a complete synthetic no-requirement control separately from the untrusted-issuer case", () => {
    expect(UAT_SCENARIOS.every((scenario) => (
      scenario.expected.allowed_execution_statuses.join(",") === "succeeded,partial"
      && !(scenario.expected.allowed_execution_statuses as readonly string[]).includes("failed")
    ))).toBe(true);
    expect(UAT_SCENARIOS.every((scenario) => (
      scenario.supported_evidence_profiles.length > 0
      && scenario.diagnostic_observation.length > 0
    ))).toBe(true);
    const clean = UAT_SCENARIOS.find((item) => item.scenario_id === "clean_text_no_requirement_uat")!;
    expect(clean.supported_evidence_profiles).toEqual([
      "synthetic-v3",
      "preserved-3law-v3-diagnostic",
    ]);
    expect(clean.documents).toHaveLength(4);
    expect(clean.documents.every((document) => document.document_type !== "SUPPORTING")).toBe(true);
    expect(clean.documents.filter((document) => document.document_type === "CI" || document.document_type === "CO")
      .every((document) => document.content_text.includes("7318151000"))).toBe(true);
    expect(clean.documents.find((document) => document.document_type === "CI")?.content_text)
      .toContain("Origin Country: NORWAY");
    expect(clean.documents.find((document) => document.document_type === "PL")?.content_text)
      .toContain("Packing No: PL-2026-0001");
    expect(clean.documents.find((document) => document.document_type === "PL")?.content_text)
      .toContain("LINE ITEM 1");
    expect(clean.documents.find((document) => document.document_type === "BL")?.content_text)
      .toContain("Freight Terms: PREPAID");
    expect(clean.documents.find((document) => document.document_type === "CO")?.content_text)
      .toContain("HS Codes: 7318151000");
    expect(clean.expected.semantic).toEqual(expect.objectContaining({
      issues: { count: 0 },
      findings: { count: 0 },
      evidence: {
        count: 0,
        retrieval_status: "ok",
        coverage: "complete",
        requirements_found: false,
        minimum_result_count: 1,
      },
      narrative: { material_citations_complete: true },
    }));
    expect(clean.expected.semantic_by_evidence_profile?.["preserved-3law-v3-diagnostic"])
      .toEqual(expect.objectContaining({
        evidence: expect.objectContaining({
          minimum_count: 1,
          retrieval_status: "ok",
          coverage: "complete",
          requirements_found: false,
        }),
      }));
    expect(clean.expected.semantic?.model_execution).toEqual(expect.objectContaining({
      provider: "anthropic",
      minimum_call_count: 1,
      minimum_input_tokens: 1,
      minimum_output_tokens: 1,
      audit_complete: true,
    }));
    expect(clean.expected.semantic?.chat).toEqual(expect.objectContaining({
      status: "answered",
      generation_mode: "claude",
      grounded_citation: true,
    }));
    expect(clean.expected.semantic?.review_stages).toEqual({
      include_completed_stages: ["retrieve_regulations"],
    });

    const untrusted = UAT_SCENARIOS.find((item) => item.scenario_id === "clean_text_untrusted_supporting_document")!;
    expect(untrusted.supporting_document?.issuer).toBe("Synthetic Test Issuer");
    expect(untrusted.requires_approver).not.toBe(true);
    expect(untrusted.expected).toEqual(expect.objectContaining({
      assessment: "issues_detected",
      disposition: "human_review_required",
      unmet_reason_codes: ["supporting_document_verification_incomplete"],
    }));
    expect(untrusted.expected.semantic?.completion).toEqual({
      include_unmet_reason_codes: ["supporting_document_verification_incomplete"],
    });

    const actualRequirement = UAT_SCENARIOS.find(
      (item) => item.scenario_id === "actual_3law_structured_requirement_human_only",
    )!;
    expect(actualRequirement.supported_evidence_profiles)
      .toEqual(["preserved-3law-v3-diagnostic"]);
    expect(actualRequirement.documents).toHaveLength(4);
    expect(actualRequirement.documents.find((document) => document.document_type === "CI")?.content_text)
      .toContain("HS Code: 0303540000");
    expect(actualRequirement.expected).toEqual(expect.objectContaining({
      assessment: "issues_detected",
      disposition: "human_review_required",
      semantic: expect.objectContaining({
        evidence: expect.objectContaining({
          retrieval_status: "partial",
          coverage: "partial",
          requirements_found: true,
        }),
      }),
    }));
  });

  it.each([
    ["partial", "PASS", "Agent partial은 Job 실패가 아니라"],
    ["succeeded", "PASS", "Agent succeeded는 필수 심사 단계와"],
    ["failed", "FAIL", null],
  ] as const)("separates %s Agent completion from Job and human-review disposition", async (executionStatus, expectedState, explanation) => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    bindScenarioInput(api, CLEAN_SCENARIO);
    const cleanCase = {
      case_id: "case-1",
      org_id: "org-1",
      title: "합성 무요건 정상 Case",
      external_reference: CLEAN_SCENARIO_REFERENCE,
      status: "open" as const,
      revision: 1,
      updated_at: "2026-07-21T12:00:00Z",
      created_at: "2026-07-21T12:00:00Z",
      documents: [],
      runs: [],
    };
    vi.mocked(api.listCases).mockResolvedValue({ items: [cleanCase] });
    vi.mocked(api.getCase).mockResolvedValue(cleanCase);
    const noRequirementRun: ReviewRun = {
      ...run,
      execution_status: executionStatus,
      evidence: [],
      evidence_retrieval: {
        status: "ok",
        coverage: "complete",
        requirements_found: false,
        result_count: 1,
      },
      model_execution_summary: ACTUAL_MODEL_EXECUTION,
      narrative_report: { ...run.narrative_report!, regulatory_review: [] },
    };
    vi.mocked(api.listReviewRuns).mockResolvedValue([noRequirementRun]);
    vi.mocked(api.getReviewRun).mockResolvedValue(noRequirementRun);
    vi.mocked(api.listChat).mockResolvedValue([CLAUDE_CHAT]);
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("합성 무요건 정상 Case"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain(`시나리오 기능: ${expectedState}`));

    expect(root.textContent).toContain(`Agent 심사 완결성: ${executionStatus} / expected succeeded | partial`);
    if (explanation) expect(root.textContent).toContain(explanation);
    else {
      expect(root.textContent).not.toContain("Agent partial은 Job 실패가 아니라");
      expect(root.textContent).not.toContain("Agent succeeded는 필수 심사 단계와");
    }
    expect(root.textContent).toContain("Issue 수: 0 / expected 0");
    expect(root.textContent).toContain("Finding 수: 0 / expected 0");
    expect(root.textContent).toContain("Evidence 수: 0 / expected 0");
    expect(root.textContent).toContain("Evidence 조회 상태: ok / expected ok");
    expect(root.textContent).toContain("Evidence coverage: complete / expected complete");
    expect(root.textContent).toContain("요건 검색 결과: false / expected false");
    expect(root.textContent).toContain("Evidence 대상 품목: satisfied / expected satisfied");
    expect(root.textContent).toContain("XAI material citation: complete / expected complete");
    expect(root.textContent).toContain("Evidence runtime: configured / expected configured");
    expect(root.textContent).toContain("시나리오 Evidence 프로필: compatible / expected compatible");
    expect(root.textContent).toContain("필수 심사 단계 retrieve_regulations: completed / expected completed");
    expect(root.textContent).toContain(`Review 기준일 결박: ${SUPPORTED_REVIEW_AS_OF} / expected ${SUPPORTED_REVIEW_AS_OF}`);
    expect(root.textContent).toContain("Review Claude provider: anthropic / expected anthropic");
    expect(root.textContent).toContain("Review Claude input tokens: satisfied / expected satisfied");
    expect(root.textContent).toContain("Claude Chat answered: present / expected present");
    expect(root.textContent).toContain("Claude Chat generation: claude / expected claude");
    expect(root.textContent).toContain("Claude Chat grounding: grounded / expected grounded");
    expect(root.textContent).toContain("Chat Claude audit: true / expected true");
    expect(root.textContent).toContain("claude · anthropic · claude-sonnet-4-20250514 · calls 1");
    expect(root.textContent).toContain("업무 처리 결과: human review required");
    expect(root.textContent).toContain("업무 disposition은 기능 PASS/FAIL 계산에 포함되지 않습니다");
    app.destroy();
  });

  it("does not pass the full positive control with deterministic Chat fallback", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    bindScenarioInput(api, CLEAN_SCENARIO);
    const cleanCase = {
      case_id: "case-1",
      org_id: "org-1",
      title: "합성 무요건 정상 Case",
      external_reference: CLEAN_SCENARIO_REFERENCE,
      status: "open" as const,
      revision: 1,
      updated_at: "2026-07-21T12:00:00Z",
      created_at: "2026-07-21T12:00:00Z",
      documents: [],
      runs: [],
    };
    const noRequirementRun: ReviewRun = {
      ...run,
      evidence: [],
      evidence_retrieval: { status: "ok", coverage: "complete", requirements_found: false, result_count: 1 },
      narrative_report: { ...run.narrative_report!, regulatory_review: [] },
    };
    vi.mocked(api.listCases).mockResolvedValue({ items: [cleanCase] });
    vi.mocked(api.getCase).mockResolvedValue(cleanCase);
    vi.mocked(api.listReviewRuns).mockResolvedValue([noRequirementRun]);
    vi.mocked(api.getReviewRun).mockResolvedValue(noRequirementRun);
    vi.mocked(api.listChat).mockResolvedValue([{
      ...CLAUDE_CHAT,
      generation_mode: "deterministic_fallback",
      model_execution_summary: EMPTY_MODEL_EXECUTION,
    }]);
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.includes("합성 무요건 정상 Case"))
      ?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("시나리오 기능: FAIL"));

    expect(root.textContent).toContain("Claude Chat generation: deterministic fallback / expected claude");
    expect(root.textContent).toContain("Chat Claude call count: only 0 / expected satisfied");
    expect(root.textContent).toContain("Chat Claude audit: false / expected true");
    app.destroy();
  });

  it("shows the clean Core review as PENDING until the required Claude Chat is exercised", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    bindScenarioInput(api, CLEAN_SCENARIO);
    const cleanCase = {
      case_id: "case-1",
      org_id: "org-1",
      title: "합성 무요건 정상 Case",
      external_reference: CLEAN_SCENARIO_REFERENCE,
      status: "open" as const,
      revision: 1,
      updated_at: "2026-07-21T12:00:00Z",
      created_at: "2026-07-21T12:00:00Z",
      documents: [],
      runs: [],
    };
    const noRequirementRun: ReviewRun = {
      ...run,
      evidence: [],
      evidence_retrieval: { status: "ok", coverage: "complete", requirements_found: false, result_count: 1 },
      narrative_report: { ...run.narrative_report!, regulatory_review: [] },
    };
    vi.mocked(api.listCases).mockResolvedValue({ items: [cleanCase] });
    vi.mocked(api.getCase).mockResolvedValue(cleanCase);
    vi.mocked(api.listReviewRuns).mockResolvedValue([noRequirementRun]);
    vi.mocked(api.getReviewRun).mockResolvedValue(noRequirementRun);
    vi.mocked(api.listChat).mockResolvedValue([]);
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.includes("합성 무요건 정상 Case"))
      ?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("시나리오 기능: PENDING"));

    expect(root.textContent).toContain("UAT 입력 manifest: exact / expected exact");
    expect(root.textContent).toContain("Claude Chat 실행: pending / expected completed");
    expect(root.textContent).not.toContain("시나리오 기능: FAIL");
    expect(root.querySelector('[data-check-result="pending"]')).not.toBeNull();
    app.destroy();
  });

  it("marks a scenario with document drift INVALID and ignores a forged prefix-only association", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    const documents = bindScenarioInput(api, CLEAN_SCENARIO);
    documents.push({
      ...documents[0]!,
      document_id: "doc-extra",
      filename: "unexpected.txt",
      content_text: "unexpected",
      content_sha256: createHash("sha256").update("unexpected").digest("hex"),
      byte_size: 10,
      character_count: 10,
    });
    const cleanCase = {
      case_id: "case-1",
      org_id: "org-1",
      title: "합성 무요건 정상 Case",
      external_reference: CLEAN_SCENARIO_REFERENCE,
      status: "open" as const,
      revision: 1,
      updated_at: "2026-07-21T12:00:00Z",
      created_at: "2026-07-21T12:00:00Z",
      documents: [],
      runs: [],
    };
    const driftRun: ReviewRun = {
      ...run,
      evidence: [],
      evidence_retrieval: { status: "ok", coverage: "complete", requirements_found: false, result_count: 1 },
    };
    vi.mocked(api.listCases).mockResolvedValue({ items: [cleanCase] });
    vi.mocked(api.getCase).mockResolvedValue(cleanCase);
    vi.mocked(api.listReviewRuns).mockResolvedValue([driftRun]);
    vi.mocked(api.getReviewRun).mockResolvedValue(driftRun);
    vi.mocked(api.listChat).mockResolvedValue([CLAUDE_CHAT]);
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.includes("합성 무요건 정상 Case"))
      ?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("시나리오 기능: INVALID"));
    expect(root.textContent).toContain("UAT 입력 manifest: drift / expected exact");
    expect(root.querySelector('[data-check-result="invalid"]')).not.toBeNull();
    app.destroy();

    const forgedRoot = document.createElement("div");
    document.body.append(forgedRoot);
    const forgedApi = fakeApi();
    bindScenarioInput(forgedApi, CLEAN_SCENARIO);
    const forgedCase = {
      ...cleanCase,
      external_reference: "UAT-clean_text_no_requirement_uat-forged-prefix",
    };
    vi.mocked(forgedApi.listCases).mockResolvedValue({ items: [forgedCase] });
    vi.mocked(forgedApi.getCase).mockResolvedValue(forgedCase);
    const forgedApp = new WorkbenchApp(forgedRoot, forgedApi, auth(true));
    await forgedApp.start();
    [...forgedRoot.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.includes("합성 무요건 정상 Case"))
      ?.click();
    await vi.waitFor(() => expect(forgedRoot.textContent).toContain("run-001"));
    expect(forgedRoot.textContent).not.toContain("SCENARIO FUNCTION ASSERTION");
    forgedApp.destroy();
  });

  it("falls back to a visible UNKNOWN/OFF boundary when UAT metadata is unavailable", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    bindScenarioInput(api, CLEAN_SCENARIO);
    vi.mocked(api.getUatMetadata).mockRejectedValue(new ApiError("not installed", 404));
    const cleanCase = {
      case_id: "case-1",
      org_id: "org-1",
      title: "합성 무요건 정상 Case",
      external_reference: CLEAN_SCENARIO_REFERENCE,
      status: "open" as const,
      revision: 1,
      updated_at: "2026-07-21T12:00:00Z",
      created_at: "2026-07-21T12:00:00Z",
      documents: [],
      runs: [],
    };
    const noRequirementRun: ReviewRun = {
      ...run,
      evidence: [],
      evidence_retrieval: { status: "ok", coverage: "complete", requirements_found: false, result_count: 1 },
      narrative_report: { ...run.narrative_report!, regulatory_review: [] },
    };
    vi.mocked(api.listCases).mockResolvedValue({ items: [cleanCase] });
    vi.mocked(api.getCase).mockResolvedValue(cleanCase);
    vi.mocked(api.listReviewRuns).mockResolvedValue([noRequirementRun]);
    vi.mocked(api.getReviewRun).mockResolvedValue(noRequirementRun);
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("합성 무요건 정상 Case"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("시나리오 기능: INVALID"));

    expect(root.textContent).toContain("UNKNOWN — METADATA UNAVAILABLE");
    expect(root.textContent).toContain("Claude: unknown");
    expect(root.textContent).toContain("Evidence: unknown · UNKNOWN");
    expect(root.textContent).toContain("Auto-completion: OFF");
    expect(root.textContent).toContain("NOT PRODUCTION");
    expect(root.textContent).toContain("UAT runtime identity: unverified / expected verified");
    const reviewButton = [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent === "새 심사 실행");
    expect(reviewButton?.disabled).toBe(true);
    reviewButton?.click();
    expect(api.enqueueReview).not.toHaveBeenCalled();
    expect(root.querySelector('[data-uat-metadata="unknown"]')).not.toBeNull();
    app.destroy();
  });

  it("fails the positive control when Evidence retrieval did not succeed", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    bindScenarioInput(api, CLEAN_SCENARIO);
    const cleanCase = {
      case_id: "case-1",
      org_id: "org-1",
      title: "합성 무요건 정상 Case",
      external_reference: CLEAN_SCENARIO_REFERENCE,
      status: "open" as const,
      revision: 1,
      updated_at: "2026-07-21T12:00:00Z",
      created_at: "2026-07-21T12:00:00Z",
      documents: [],
      runs: [],
    };
    const failedRun: ReviewRun = {
      ...run,
      evidence: [],
      evidence_retrieval: { status: "failed", coverage: "unknown", requirements_found: false, result_count: 1 },
      action_trace: [{ ...run.action_trace[0]!, status: "failed" }],
      narrative_report: { ...run.narrative_report!, regulatory_review: [] },
    };
    vi.mocked(api.listCases).mockResolvedValue({ items: [cleanCase] });
    vi.mocked(api.getCase).mockResolvedValue(cleanCase);
    vi.mocked(api.listReviewRuns).mockResolvedValue([failedRun]);
    vi.mocked(api.getReviewRun).mockResolvedValue(failedRun);
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.includes("합성 무요건 정상 Case"))?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("시나리오 기능: FAIL"));

    expect(root.textContent).toContain("Evidence 조회 상태: failed / expected ok");
    expect(root.textContent).toContain("필수 심사 단계 retrieve_regulations: completed / expected completed");
    app.destroy();
  });

  it("makes the preserved Data corpus limitation visible as 3/58", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    vi.mocked(api.getUatMetadata).mockResolvedValue({
      mode: "local_uat",
      assurance_ceiling: "diagnostic",
      text_only: true,
      auto_completion_enabled: false,
      claude_mode: "actual",
      evidence_profile: "preserved-3law-v3-diagnostic",
      evidence_scope_label: "ACTUAL_3_LAW_RAG_3_OF_58",
      evidence_dataset: ACTUAL_THREE_LAW_EVIDENCE_DATASET,
      supported_review_as_of: SUPPORTED_REVIEW_AS_OF,
      planner_mode: "diagnostic_active",
      production_release: false,
    });
    const actualRun: ReviewRun = {
      ...run,
      evidence_provenance: {
        query_intent: "required_import_documents",
        items: [{
          item_id: "item-1",
          query_description: "Stainless steel bolts 수입 법령 및 요건",
          requested_hs_code: "7318151000",
          hs_resolution: "exact",
          resolved_hsk10: "7318151000",
          coverage: "complete",
          requirements_found: false,
        }],
        ranked_evidence: [{
          evidence_id: "evidence-1",
          item_id: "item-1",
          rank: 1,
          source_type: "law_article",
          retrieval_methods: ["dense", "bm25", "graph"],
          score: 0.87,
          raw_scores: { dense: 0.81, bm25: 4.2, graph: 0.7, rrf: 0.09 },
          law_id: "LAW-1",
          law_name: "관세법",
          article_no: "제241조",
          version_hash: "c".repeat(64),
          source_uri: "https://law.example/1",
        }],
      },
    };
    vi.mocked(api.listReviewRuns).mockResolvedValue([actualRun]);
    vi.mocked(api.getReviewRun).mockResolvedValue(actualRun);
    const app = new WorkbenchApp(root, api, auth(true));

    await app.start();

    expect(root.textContent).toContain(
      "ACTUAL 3-LAW RAG · 3 OF 58 · DIAGNOSTIC · TEXT ONLY · AUTO OFF · NOT PRODUCTION",
    );
    expect(root.textContent).toContain(
      "Evidence: preserved-3law-v3-diagnostic · ACTUAL 3-LAW RAG · 3 OF 58",
    );
    expect(root.textContent).toContain("보존 PostgreSQL structured lookup, Qdrant dense/BM25, Neo4j graph 확장을 실제 실행합니다.");
    expect(root.textContent).toContain("Evidence 프로필은 Review별 선택값이 아니라 UAT 시작 시 결박되는 실행 환경입니다.");
    expect(root.querySelector('[data-evidence-profile="preserved-3law-v3-diagnostic"][data-profile-active="true"]'))
      .not.toBeNull();
    expect(root.querySelector<HTMLOptionElement>(
      'option[value="actual_3law_structured_requirement_human_only"]',
    )?.disabled).toBe(false);
    expect(root.querySelector<HTMLOptionElement>(
      'option[value="clean_text_production_candidate_blocked"]',
    )?.disabled).toBe(true);
    expect(root.textContent).toContain(`Review 기준일: ${SUPPORTED_REVIEW_AS_OF}`);
    expect(root.textContent).toContain("Planner: diagnostic active");
    expect(root.textContent).toContain("Data: 3/58 laws · 1007 articles");
    expect(root.textContent).toContain("RAG quality evaluated: NO");
    expect(root.textContent).toContain("PostgreSQL1007 articles");
    expect(root.textContent).toContain("Qdrant1007 points");
    expect(root.textContent).toContain("Neo4j1007 articles");
    expect(root.querySelector(".uat-runtime-fact--warning")).not.toBeNull();
    [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.includes("<img src=x"))
      ?.click();
    await vi.waitFor(() => expect(root.textContent).toContain("ACTUAL 3-LAW RAG 실행 근거"));
    expect(root.textContent).toContain("Stainless steel bolts 수입 법령 및 요건");
    expect(root.textContent).toContain("7318151000");
    expect(root.textContent).toContain("Structured 해소exact");
    expect(root.textContent).toContain("dense");
    expect(root.textContent).toContain("bm25");
    expect(root.textContent).toContain("graph");
    expect(root.textContent).toContain("#1");
    expect(root.textContent).toContain("관세법 · 제241조");
    expect(root.textContent).toContain("final 0.870000");
    expect(root.querySelector<HTMLAnchorElement>('.evidence__source-link')?.href)
      .toBe("https://law.example/1");
    app.destroy();
  });

  it("creates source-bound UAT inputs but requires a different approver to assert them", async () => {
    for (const scenario of UAT_SCENARIOS.filter((item) => item.requires_approver)) {
      expect(scenario.requires_approver).toBe(true);
      expect(scenario.supporting_document).toBeDefined();
      expect(scenario.documents.some((document) => document.document_type === "SUPPORTING")).toBe(true);
      expect(scenario).not.toHaveProperty("submitted_document_codes");
    }

    const root = document.createElement("div");
    document.body.append(root);
    const api = fakeApi();
    const selectedScenario = UAT_SCENARIOS.find((item) => item.scenario_id === "clean_text_production_candidate_blocked")!;
    const externalReference = localUatScenarioExternalReference(selectedScenario);
    const supportingSource = selectedScenario.documents.find((document) => document.document_type === "SUPPORTING")!;
    const supportingSourceSha256 = createHash("sha256").update(supportingSource.content_text).digest("hex");
    const createdDocuments: Array<Awaited<ReturnType<ApiClient["addDocument"]>>> = [];
    const caseDetail = {
      case_id: "case-uat",
      org_id: "org-1",
      title: "[UAT] 정상 Production 후보 · Release Gate 차단",
      external_reference: externalReference,
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
      source_sha256: supportingSourceSha256,
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
        content_sha256: createHash("sha256").update(payload.content_text).digest("hex"),
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
    scenarioSelect.value = "clean_text_production_candidate_blocked";
    scenarioForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(api.addSupportingDocument).toHaveBeenCalledOnce());
    expect(api.createCase).toHaveBeenCalledWith({
      title: `[UAT] ${selectedScenario.title}`,
      external_reference: externalReference,
    });
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
      source_sha256: supportingSourceSha256,
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
      { review_as_of: SUPPORTED_REVIEW_AS_OF, trade_type: "import", submitted_document_codes: [] },
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
    expect(Object.keys(stored[0]!).sort()).toEqual(["case_id", "case_revision", "idempotency_key", "job_id", "job_kind", "org_id", "parent_run_id", "request_sha256", "review_as_of", "subject"]);
    expect(stored[0]).toEqual(expect.objectContaining({
      job_kind: "review",
      parent_run_id: null,
      review_as_of: SUPPORTED_REVIEW_AS_OF,
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

  it("tracks a long Claude Job past 267 seconds and preserves recovery at the 12-minute UI boundary", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    seedRecovery("reviewer-1", {
      case_id: "case-1",
      case_revision: 1,
      job_id: "job-long-claude",
      idempotency_key: crypto.randomUUID(),
    });
    const api = fakeApi();
    vi.mocked(api.getJob).mockResolvedValue({
      ...jobRecord("job-long-claude"),
      status: "running",
      agent_call_state: "started",
    });
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const timeout = vi.spyOn(window, "setTimeout");
    const app = new WorkbenchApp(root, api, auth(true));
    await app.start();
    [...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent?.includes("<img src=x"))
      ?.click();
    await vi.waitFor(() => expect(api.getJob).toHaveBeenCalledWith("job-long-claude"));

    const tracked = app as unknown as {
      jobTrackingStartedAtMs: number;
      pollJob(jobId: string): Promise<void>;
    };
    tracked.jobTrackingStartedAtMs = 1_000_000 - 267_596;
    await tracked.pollJob("job-long-claude");
    expect(root.textContent).not.toContain("12분 동안 심사가 완료되지 않았습니다");
    expect(timeout.mock.calls.some((call) => call[1] === 1_000)).toBe(true);
    expect(window.sessionStorage.getItem(recoveryKey())).not.toBeNull();

    tracked.jobTrackingStartedAtMs = 1_000_000 - (12 * 60_000);
    await tracked.pollJob("job-long-claude");
    expect(root.textContent).toContain("12분 동안 심사가 완료되지 않았습니다");
    expect(root.textContent).toContain("실행 결과를 실패로 단정하지 않고");
    expect(window.sessionStorage.getItem(recoveryKey())).not.toBeNull();
    expect([...root.querySelectorAll<HTMLButtonElement>("button")]
      .find((item) => item.textContent === "새 심사 실행")?.disabled).toBe(true);

    app.destroy();
    timeout.mockRestore();
    now.mockRestore();
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
