import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../src/api/v1/client";
import type {
  CaseDocument,
  ReviewRun,
  SupportingDocumentRecord,
} from "../src/api/v1/types";
import type { ExperienceApiClient } from "../src/api/v2/client";
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantMessageEnqueueResponse,
  PublicReviewExperience,
  ReviewJobExperience,
} from "../src/api/v2/types";
import type { OidcSession } from "../src/auth";
import { CommercialWorkbench } from "../src/experience/app";
import { citationDestination } from "../src/experience/components/citation-link";
import { derivedIdempotencyKey } from "../src/experience/idempotency";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

const digest = (character: string): string => character.repeat(64);

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function textSha256(value: string): Promise<string> {
  const digestValue = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digestValue)]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

async function fillSupportingMetadata(
  form: ReturnType<typeof within>,
  document: SupportingDocumentRecord,
): Promise<void> {
  await userEvent.type(
    form.getByRole("textbox", { name: "증명서 코드" }),
    document.document_code,
  );
  await userEvent.type(
    form.getByRole("textbox", { name: "발급기관" }),
    document.issuer,
  );
  await userEvent.type(
    form.getByRole("textbox", { name: "증명서 번호" }),
    document.document_number,
  );
  fireEvent.change(form.getByLabelText("발급일"), {
    target: { value: document.issued_on },
  });
  if (document.valid_until !== null) {
    fireEvent.change(form.getByLabelText(/유효기간/), {
      target: { value: document.valid_until },
    });
  }
  await userEvent.click(form.getByRole("checkbox", {
    name: "품목 1 · 품목분류번호 0303540000",
  }));
}

const caseSummary = {
  case_id: "case-1",
  org_id: "org-1",
  external_reference: "UAT-001",
  title: "냉동 고등어 수입 사전심사",
  status: "in_review" as const,
  revision: 1,
  updated_at: "2026-07-27T00:00:00Z",
  latest_run_id: "run-1",
};

const primaryDocument: CaseDocument = {
  document_id: "document-ci-1",
  case_id: "case-1",
  document_type: "CI",
  filename: "invoice.txt",
  media_type: "text/plain",
  content_sha256: digest("9"),
  byte_size: 120,
  character_count: 120,
  created_by: "reviewer-1",
  created_at: "2026-07-27T00:00:00Z",
};

const run: ReviewRun = {
  review_run_id: "run-1",
  case_id: "case-1",
  org_id: "org-1",
  execution_status: "succeeded",
  assessment: "no_issue_detected",
  review_disposition: "human_review_required",
  assurance_level: "diagnostic",
  created_at: "2026-07-27T00:00:00Z",
  case_revision: 1,
  result_digest: digest("a"),
  provider_result_sha256: digest("0"),
  input_manifest_digest: digest("b"),
  stages: [],
  fields: [],
  issues: [],
  evidence: [{
    evidence_id: "evidence-1",
    title: "관세법 관련 조문",
    law_id: "CUSTOMS_ACT",
    article: "제1조",
    excerpt: "통관 절차의 기본 목적을 정한 조문입니다.",
    source_uri: "https://example.invalid/law",
    source_hash: digest("c"),
  }],
  evidence_retrieval: {
    status: "ok",
    coverage: "complete",
    requirements_found: false,
    result_count: 1,
  },
  evidence_profile: "preserved-3law-v3-scenario-eval",
  evidence_data_source: "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY",
  evidence_request_id: "evidence-request-1",
  attempted_retrieval_methods: ["exact_hs", "dense", "bm25", "graph"],
  successful_retrieval_methods: ["exact_hs", "dense", "bm25", "graph"],
  observed_retrieval_methods: ["exact_hs"],
  retrieval_execution_attested: true,
  evidence_provenance: {
    request_id: "evidence-request-1",
    query_intent: "현재 품목의 법령 요건 확인",
    items: [{
      item_id: "item-1",
      query_description: "첫 번째 심사 품목",
      requested_hs_code: "0303540000",
      hs_resolution: "exact",
      resolved_hsk10: "0303540000",
      coverage: "complete",
      requirements_found: false,
    }],
    ranked_evidence: [{
      evidence_id: "evidence-1",
      item_id: "item-1",
      rank: 1,
      title: "관세법 관련 조문",
      excerpt: "통관 절차의 기본 목적을 정한 조문입니다.",
      source_type: "law_article",
      retrieval_methods: ["exact_hs"],
      score: 1,
      raw_scores: { exact_hs: 1 },
      law_id: "CUSTOMS_ACT",
      law_name: "관세법",
      article_no: "제1조",
      version_hash: digest("c"),
      source_uri: "https://example.invalid/law",
    }],
  },
  findings: [],
  sources: [],
  action_trace: [],
  corrections: [],
  required_actions: [],
  release_identity: {
    agent_package_version: "0.4.0",
    model_id: "claude-private-model-identifier",
    extraction_prompt_sha256: digest("d"),
    result_schema_sha256: digest("e"),
    policy_id: "policy",
    tool_registry_id: "tools",
    evidence_snapshot_id: "snapshot-private-identifier",
    evidence_runtime_v3_sha256: digest("b"),
  },
  review_stage_trace: [
    { sequence: 1, stage: "input_validation", status: "completed", reason_ids: [] },
  ],
};

const sectionCodes = [
  "conclusion",
  "process",
  "document_comparison",
  "issues_and_causes",
  "regulatory_meaning",
  "business_impact",
  "next_actions",
  "scope_and_limits",
] as const;

const envelope: PublicReviewExperience = {
  schema_version: "1.0",
  bound_provider_result_sha256: digest("0"),
  bound_effective_result_digest: digest("a"),
  user_presentation: {
    schema_version: "1.0",
    headline: "현재 확인 범위에서 별도의 문서 또는 규정 문제를 발견하지 않았습니다.",
    sections: sectionCodes.map((sectionCode, index) => ({
      section_code: sectionCode,
      title: sectionCode,
      statements: [{
        statement_id: `statement-${index}`,
        role: sectionCode === "scope_and_limits" ? "limitation" : sectionCode === "next_actions" ? "action" : "observation",
        text: `${index + 1}번째 심사 설명입니다.`,
        source_claim_ids: [`experience_claim_${digest(String(index))}`],
        citation_references: sectionCode === "scope_and_limits"
          ? []
          : [{ kind: "outcome", reference_id: "outcome-1" }],
        material: sectionCode !== "scope_and_limits",
      }],
    })),
    generation_audit: {
      mode: "claude",
      task_id: "presentation",
      model_id: "claude-private-model-identifier",
      prompt_sha256: digest("3"),
      output_schema_sha256: digest("4"),
      input_tokens: 100,
      output_tokens: 200,
      latency_ms: 1_000,
      attempt_count: 1,
      scope_classification: null,
    },
    verification_audit: {
      status: "passed",
      deterministic_checks_passed: true,
      entailment_verifier: "claude",
      verifier_model_id: "claude-private-model-identifier",
      verifier_context_sha256: digest("8"),
      verifier_prompt_sha256: digest("5"),
      verifier_schema_sha256: digest("6"),
      verified_content_sha256: digest("7"),
      checked_statement_count: 8,
      reason_codes: [],
    },
    presentation_sha256: digest("f"),
  },
  capability_attestation: {
    schema_version: "1.0",
    profile_id: "local-uat-active",
    environment: "local_uat",
    evidence_profile: "preserved-3law-v3-scenario-eval",
    loopback_only: true,
    issued_at: "2026-07-27T00:00:00Z",
    expires_at: "2026-07-28T00:00:00Z",
    agent_commit: "1".repeat(40),
    agent_code_snapshot_sha256: digest("7"),
    model_id: "claude-private-model-identifier",
    prompt_bundle_sha256: digest("8"),
    schema_bundle_sha256: digest("9"),
    tool_registry_id: "bounded-tools-v1",
    tool_registry_sha256: digest("a"),
    evidence_runtime_v3_sha256: digest("b"),
    max_cycles: 2,
    max_tool_calls: 6,
    max_rereads_per_field: 1,
    adaptive_active: true,
    auto_completion_enabled: false,
    capability_sha256: digest("1"),
  },
  user_action_events: [{
    schema_version: "1.0",
    event_id: `user_action_${digest("2")}`,
    action_code: "human_review",
    title: "심사 결과와 근거를 확인합니다.",
    description: "문서 대조 결과와 실제 3종 법령 근거를 확인한 뒤 담당자 검토를 완료합니다.",
    status: "needs_attention",
    source_reference_ids: ["outcome-1"],
  }],
  agent_envelope_sha256: digest("2"),
  public_experience_sha256: digest("3"),
};

const conversation: AssistantConversation = {
  conversation_id: "conversation-1",
  org_id: "org-1",
  case_id: "case-1",
  review_run_id: "run-1",
  bound_result_sha256: digest("0"),
  bound_effective_result_digest: digest("a"),
  created_by: "reviewer-1",
  created_at: "2026-07-27T00:00:00Z",
  updated_at: "2026-07-27T00:00:00Z",
};

const pendingProposal = {
  proposal_id: "proposal-1",
  review_run_id: "run-1",
  case_id: "case-1",
  org_id: "org-1",
  parent_result_digest: digest("a"),
  parent_input_manifest_sha256: digest("b"),
  case_revision: 1,
  actions: [],
  corrections: [],
  status: "pending" as const,
  created_by: "reviewer-1",
  created_at: "2026-07-27T00:00:00Z",
  decided_by: null,
  decided_at: null,
  decision_reason: null,
  child_job_id: null,
  idempotency_key: "proposal-key-1",
  idempotency_request_digest: digest("d"),
};

const groundedAssistantMessage: AssistantMessage = {
  message_id: "assistant-message-1",
  conversation_id: conversation.conversation_id,
  review_run_id: "run-1",
  case_id: "case-1",
  org_id: "org-1",
  parent_message_id: null,
  role: "assistant",
  content: "검색된 법령 근거의 의미를 설명합니다.",
  answer: {
    schema_version: "2.0",
    request_sha256: digest("9"),
    answer_scope: "evidence_grounded",
    status: "answered",
    direct_answer: "검색된 법령 근거의 의미를 설명합니다.",
    claim_selections: {
      direct_answer: [`experience_claim_${digest("1")}`],
      explanation: [`experience_claim_${digest("2")}`],
      evidence_meaning: [`experience_claim_${digest("3")}`],
      impact: [`experience_claim_${digest("4")}`],
      next_steps: [`experience_claim_${digest("5")}`],
    },
    explanation: ["현재 심사 품목과 연결된 근거입니다."],
    evidence_meaning: ["담당자가 적용 여부를 확인할 출발점입니다."],
    impact: ["최종 처리 전 담당자 확인이 필요합니다."],
    next_steps: ["근거 조문을 확인합니다."],
    limitations: ["현재 3종 법령 범위에 한정됩니다."],
    citations: [{ kind: "evidence", reference_id: "evidence-1" }],
    suggested_questions: [],
    used_context_message_ids: [],
    generation_audit: {
      ...envelope.user_presentation.generation_audit,
      task_id: "customs_case_answer_v2",
      scope_classification: {
        mode: "claude",
        task_id: "customs_case_scope_classifier",
        classified_scope: "evidence_grounded",
        guidance_topics: [],
        model_id: "claude-private-model-identifier",
        prompt_sha256: digest("1"),
        output_schema_sha256: digest("2"),
        semantic_output_schema_sha256: digest("3"),
        input_tokens: 12,
        output_tokens: 4,
        latency_ms: 100,
        reason_code: "evidence_question",
      },
    },
    verification_audit: envelope.user_presentation.verification_audit,
    answer_sha256: digest("c"),
  },
  bound_result_sha256: digest("0"),
  created_by: "system:assistant-worker",
  created_at: "2026-07-27T00:00:00Z",
};

function assistantEnqueueResponse(
  question: string,
  parentMessageId: string | null = null,
): AssistantMessageEnqueueResponse {
  return {
    job: {
      assistant_job_id: "assistant-job-1",
      conversation_id: conversation.conversation_id,
      review_run_id: run.review_run_id,
      case_id: run.case_id,
      request_binding_sha256: digest("e"),
      state: "queued",
      events: [],
      answer_message_id: null,
      error_code: null,
      created_at: "2026-07-27T00:00:00Z",
      updated_at: "2026-07-27T00:00:00Z",
    },
    user_message: {
      message_id: "assistant-user-message-1",
      conversation_id: conversation.conversation_id,
      review_run_id: run.review_run_id,
      case_id: run.case_id,
      org_id: "org-1",
      parent_message_id: parentMessageId,
      role: "user",
      content: question,
      answer: null,
      bound_result_sha256: digest("0"),
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
    },
    idempotency_reused: false,
  };
}

function dependencies(): {
  api: ApiClient;
  experienceApi: ExperienceApiClient;
  oidc: OidcSession;
  featureFlags: {
    enhancedExperience: boolean;
    adaptiveUat: boolean;
  };
} {
  return {
    featureFlags: {
      enhancedExperience: true,
      adaptiveUat: true,
    },
    api: {
      getSession: vi.fn(async () => ({ subject: "reviewer-1", org_id: "org-1", roles: ["reviewer"] })),
      getUatMetadata: vi.fn(async () => ({
        mode: "local_uat",
        assurance_ceiling: "diagnostic",
        text_only: true,
        auto_completion_enabled: false,
        claude_mode: "actual",
        evidence_profile: "preserved-3law-v3-scenario-eval",
        evidence_scope: "ACTUAL_3_LAW_RAG_SCENARIO_EVAL_3_OF_58",
        evidence_scope_label: "ACTUAL_3_LAW_RAG_SCENARIO_EVAL_3_OF_58",
        evidence_data_source: "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY",
        evidence_policy_mode: "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY",
        evidence_dataset: {
          data_source: "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY",
          expected_production_law_count: 58,
          observed_law_count: 3,
          observed_article_count: 1007,
          rag_quality_evaluated: false,
          store_counts: {
            postgresql_article_count: 1007,
            qdrant_point_count: 1007,
            neo4j_article_count: 1007,
          },
        },
        supported_review_as_of: "2026-07-10",
        planner_mode: "diagnostic_active",
        production_release: false,
      })),
      listCases: vi.fn(async () => ({ items: [caseSummary] })),
      getCase: vi.fn(async () => ({
        ...caseSummary,
        created_at: "2026-07-27T00:00:00Z",
        documents: [],
        runs: [run],
      })),
      listReviewRuns: vi.fn(async () => [run]),
      getReviewRun: vi.fn(async () => run),
      getAuditEvents: vi.fn(async () => []),
      createCase: vi.fn(),
      addDocument: vi.fn(),
      addSupportingDocument: vi.fn(),
      listSupportingDocuments: vi.fn(async () => []),
      addSupportingAssertion: vi.fn(),
      getDocumentContent: vi.fn(),
      listRevisionProposals: vi.fn(async () => []),
      createRevisionProposal: vi.fn(),
      decideRevisionProposal: vi.fn(),
    } as unknown as ApiClient,
    experienceApi: {
      getUatMetadata: vi.fn(async () => ({
        mode: "local_uat",
        assurance_ceiling: "diagnostic",
        text_only: true,
        auto_completion_enabled: false,
        claude_mode: "actual",
        evidence_profile: "preserved-3law-v3-scenario-eval",
        evidence_scope: "ACTUAL_3_LAW_RAG_SCENARIO_EVAL_3_OF_58",
        evidence_scope_label: "ACTUAL_3_LAW_RAG_SCENARIO_EVAL_3_OF_58",
        evidence_data_source: "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY",
        evidence_policy_mode: "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY",
        evidence_dataset: {
          data_source: "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY",
          expected_production_law_count: 58,
          observed_law_count: 3,
          observed_article_count: 1007,
          rag_quality_evaluated: false,
          store_counts: {
            postgresql_article_count: 1007,
            qdrant_point_count: 1007,
            neo4j_article_count: 1007,
          },
        },
        supported_review_as_of: "2026-07-10",
        planner_mode: "diagnostic_active",
        production_release: false,
        enhanced_agent_experience: true,
        uat_adaptive_active: true,
        agent_experience_api_version: "3.0",
        assistant_api_version: "2.0",
        actual_stage_streaming: true,
      })),
      getReviewExperience: vi.fn(async () => envelope),
      listConversations: vi.fn(async () => []),
      createConversation: vi.fn(),
      listMessages: vi.fn(async () => []),
      sendMessage: vi.fn(),
      getAssistantJob: vi.fn(async () => ({
        assistant_job_id: "assistant-job-1",
        conversation_id: conversation.conversation_id,
        review_run_id: run.review_run_id,
        case_id: run.case_id,
        request_binding_sha256: digest("e"),
        state: "succeeded",
        events: [],
        answer_message_id: "assistant-message-1",
        error_code: null,
        created_at: "2026-07-27T00:00:00Z",
        updated_at: "2026-07-27T00:00:01Z",
      })),
      listAssistantJobs: vi.fn(async () => []),
      streamAssistantEvents: vi.fn(async () => undefined),
      enqueueReview: vi.fn(),
      getReviewJob: vi.fn(),
      streamReviewEvents: vi.fn(async () => undefined),
    } as unknown as ExperienceApiClient,
    oidc: {
      isAuthenticated: vi.fn(() => true),
      login: vi.fn(async () => undefined),
      logout: vi.fn(async () => undefined),
    } as unknown as OidcSession,
  };
}

describe("commercial-grade local UAT workbench", () => {
  it("renders a Korean business inbox without exposing technical identity by default", async () => {
    window.history.replaceState({}, "", "/reviews");
    render(<CommercialWorkbench {...dependencies()} />);

    expect(await screen.findByTestId("reviews-inbox")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "처리할 심사 건을 확인합니다." })).not.toBeNull();
    expect(screen.getByText("검증 환경")).not.toBeNull();
    expect(screen.getByText("실제 법령 3종")).not.toBeNull();
    expect(screen.getByText("자동 처리 꺼짐")).not.toBeNull();
    expect(screen.queryByText("preserved-3law-v3-scenario-eval")).toBeNull();
    expect(screen.queryByText("ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY")).toBeNull();
    expect((await axe.run(document.body)).violations).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "검증 정보 보기" }));
    expect(screen.getByTestId("technical-drawer").textContent).toContain("preserved-3law-v3-scenario-eval");
  });

  it("traps keyboard focus inside verification details and returns it after Escape", async () => {
    window.history.replaceState({}, "", "/reviews");
    render(<CommercialWorkbench {...dependencies()} />);
    const trigger = await screen.findByRole("button", { name: "검증 정보 보기" });
    await userEvent.click(trigger);
    const close = screen.getByTestId("technical-drawer").querySelector<HTMLButtonElement>(
      'button[aria-label="검증 정보 닫기"]',
    );
    expect(close).not.toBeNull();
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("technical-drawer")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("opens mobile navigation with focus, makes the page inert, and restores focus on Escape", async () => {
    window.history.replaceState({}, "", "/reviews");
    render(<CommercialWorkbench {...dependencies()} />);
    const trigger = await screen.findByRole("button", { name: "메뉴 열기" });

    trigger.focus();
    fireEvent.click(trigger);

    const sidebar = document.querySelector<HTMLElement>("#commercial-primary-sidebar");
    const firstNavigationLink = sidebar?.querySelector<HTMLElement>(
      ".primary-navigation a[href]",
    );
    expect(sidebar?.classList.contains("is-open")).toBe(true);
    expect(document.activeElement).toBe(firstNavigationLink);
    expect(document.querySelector("#main-content")?.hasAttribute("inert")).toBe(true);
    expect(document.querySelector(".uat-boundary")?.hasAttribute("inert")).toBe(true);
    expect(document.body.classList.contains("mobile-navigation-open")).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.getByRole("button", { name: "메뉴 열기" })).not.toBeNull());
    expect(sidebar?.classList.contains("is-open")).toBe(false);
    expect(document.querySelector("#main-content")?.hasAttribute("inert")).toBe(false);
    expect(document.body.classList.contains("mobile-navigation-open")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("opens the new-case modal with initial focus, traps Tab, closes with Escape and restores focus", async () => {
    window.history.replaceState({}, "", "/reviews");
    render(<CommercialWorkbench {...dependencies()} />);
    const trigger = await screen.findByRole("button", { name: "새 심사 건" });
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "심사 건을 만듭니다." });
    const title = screen.getByRole("textbox", { name: "심사 건 제목" });
    expect(document.activeElement).toBe(title);
    const create = screen.getByRole("button", { name: "심사 건 생성" });
    create.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(dialog.querySelector('[aria-label="창 닫기"]'));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("blocks the enhanced workbench when immutable Frontend flags and Backend capability differ", async () => {
    const next = dependencies();
    const metadata = await next.experienceApi.getUatMetadata();
    vi.mocked(next.experienceApi.getUatMetadata).mockResolvedValue({
      ...metadata,
      uat_adaptive_active: false,
    });
    window.history.replaceState({}, "", "/reviews");
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByRole("heading", { name: "작업대를 시작할 수 없습니다." })).not.toBeNull();
    expect(screen.getByText(/Frontend 기능과 Backend 검증 권한이 일치하지 않아/)).not.toBeNull();
    expect(screen.queryByTestId("reviews-inbox")).toBeNull();
  });

  it("maps a malformed capability refresh to a stable Korean user error", async () => {
    let refresh: (() => unknown) | undefined;
    const nativeSetInterval = window.setInterval.bind(window);
    const interval = vi.spyOn(window, "setInterval").mockImplementation((
      handler,
      timeout,
    ) => {
      if (timeout === 60_000 && typeof handler === "function") {
        refresh = handler as () => unknown;
        return 91 as unknown as ReturnType<typeof setInterval>;
      }
      return nativeSetInterval(handler, timeout) as unknown as ReturnType<typeof setInterval>;
    });
    const next = dependencies();
    const validMetadata = await next.experienceApi.getUatMetadata();
    vi.mocked(next.experienceApi.getUatMetadata)
      .mockResolvedValueOnce(validMetadata)
      .mockRejectedValueOnce(new Error("metadata_contract_internal_failure"))
      .mockResolvedValue(validMetadata);
    window.history.replaceState({}, "", "/reviews");
    render(<CommercialWorkbench {...next} />);
    expect(await screen.findByTestId("reviews-inbox")).not.toBeNull();
    expect(refresh).toBeDefined();
    await act(async () => {
      await refresh?.();
    });
    expect(await screen.findByText("검증 환경의 실행 권한을 다시 확인하지 못했습니다.")).not.toBeNull();
    expect(document.body.textContent).not.toContain("metadata_contract_internal_failure");
    await act(async () => {
      await refresh?.();
    });
    expect(await screen.findByTestId("reviews-inbox")).not.toBeNull();
    expect(screen.queryByText("검증 환경의 실행 권한을 다시 확인하지 못했습니다.")).toBeNull();
    interval.mockRestore();
  });

  it("never lets a capability refresh clear an unrelated bootstrap failure", async () => {
    const next = dependencies();
    vi.mocked(next.api.listCases).mockRejectedValue(
      new Error("case_bootstrap_internal_failure"),
    );
    window.history.replaceState({}, "", "/reviews");
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByRole("heading", { name: "작업대를 시작할 수 없습니다." }))
      .not.toBeNull();
    expect(screen.getByText("작업대 정보를 불러오지 못했습니다.")).not.toBeNull();
    expect(document.body.textContent).not.toContain("case_bootstrap_internal_failure");
    expect(next.experienceApi.getUatMetadata).toHaveBeenCalledTimes(1);
  });

  it("makes all nine actual-RAG scenarios selectable from the isolated Test Lab", async () => {
    window.history.replaceState({}, "", "/test-lab");
    render(<CommercialWorkbench {...dependencies()} />);

    expect(await screen.findByTestId("test-lab")).not.toBeNull();
    expect(screen.getByTestId("scenario-count").textContent).toContain("9개 시나리오");
    expect(document.querySelectorAll('[data-testid^="scenario-"]:not([data-testid="scenario-count"])')).toHaveLength(9);
    expect(screen.getByText("입력 통관 문서와 증명서는 합성 테스트 자료입니다.")).not.toBeNull();
    expect(screen.getByText(/AI 문서 분석부터 법령 근거 검색/)).not.toBeNull();
    expect(document.body.textContent).not.toContain("REQUIRED_CERT_MISSING");
    expect(document.body.textContent).not.toContain("no_issue_detected");
    expect(document.body.textContent).not.toContain("PostgreSQL");
    await userEvent.click(screen.getByRole("button", { name: "기술 검증 정보 보기" }));
    expect(document.body.textContent).toContain("PostgreSQL · Qdrant · Neo4j");
  });

  it("shows eight user report sections in the required order and lazily reveals run identity", async () => {
    window.history.replaceState({}, "", "/cases/case-1/overview");
    render(<CommercialWorkbench {...dependencies()} />);

    expect(await screen.findByTestId("case-overview")).not.toBeNull();
    await screen.findByTestId("report-section-conclusion");
    const sections = sectionCodes.map((code) => screen.getByTestId(`report-section-${code}`));
    expect(sections).toHaveLength(8);
    expect(sections.map((element) => element.querySelector("h3")?.textContent)).toEqual([
      "한눈에 보는 결론",
      "Agent가 수행한 검토 과정",
      "문서 대조 결과",
      "발견된 문제와 원인",
      "법령 근거와 이 심사 건에서의 의미",
      "업무상 영향",
      "담당자가 다음으로 할 일",
      "검토 범위와 한계",
    ]);
    expect(screen.getByTestId("user-action-summary").textContent).toContain("담당자 확인 필요");
    expect(screen.getByTestId("user-action-summary").textContent).not.toContain("human_review");
    expect(document.body.textContent).not.toContain(digest("a"));
    expect(document.body.textContent).not.toContain("claude-private-model-identifier");

    const details = screen.getByTestId("technical-run-details");
    Object.defineProperty(details, "open", { configurable: true, value: true });
    fireEvent(details, new Event("toggle"));
    await waitFor(() => expect(document.body.textContent).toContain("claude-private-model-identifier"));
  });

  it("fails closed instead of fabricating a grounded report when experience loading fails", async () => {
    const next = dependencies();
    vi.mocked(next.experienceApi.getReviewExperience).mockRejectedValue(
      new Error("검증된 설명 응답을 확인할 수 없습니다."),
    );
    window.history.replaceState({}, "", "/cases/case-1/overview");
    render(<CommercialWorkbench {...next} />);

    const unavailable = await screen.findByTestId("presentation-unavailable");
    expect(unavailable.textContent).toContain("검증된 AI 심사 보고서를 불러오지 못했습니다.");
    expect(screen.queryByText("검증된 근거 연결")).toBeNull();
    expect(document.querySelectorAll('[data-testid^="report-section-"]')).toHaveLength(0);
    expect(document.body.textContent).not.toContain("안전한 기본 설명");
  });

  it("keeps stable case identity selectors and accessible route labels", async () => {
    window.history.replaceState({}, "", "/reviews");
    render(<CommercialWorkbench {...dependencies()} />);
    const caseTableRow = await screen.findByTestId("case-table-row");
    expect(caseTableRow.getAttribute("data-case-id")).toBe("case-1");
    expect(caseTableRow.getAttribute("data-case-external-reference")).toBe("UAT-001");

    const caseLink = await screen.findByRole("button", { name: /냉동 고등어 수입 사전심사/ });
    expect(caseLink.getAttribute("data-case-id")).toBe("case-1");
    expect(caseLink.getAttribute("data-case-external-reference")).toBe("UAT-001");

    await userEvent.click(caseLink);
    await waitFor(() => expect(document.querySelector(".case-workspace")?.getAttribute("data-selected-case-id")).toBe("case-1"));
    expect(screen.getByRole("navigation", { name: "심사 건 메뉴" })).not.toBeNull();
  });

  it("keeps UAT manifest references and identity subjects out of the default user view", async () => {
    const rawReference = `UAT2:clean_text:EVAL:${digest("f")}`;
    const next = dependencies();
    vi.mocked(next.api.getSession).mockResolvedValue({
      subject: "981da949-b930-4979-a889-72c6e5638906",
      org_id: "org-1",
      roles: ["reviewer"],
    });
    vi.mocked(next.api.listCases).mockResolvedValue({
      items: [{ ...caseSummary, external_reference: rawReference }],
    });
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      external_reference: rawReference,
      created_at: "2026-07-27T00:00:00Z",
      documents: [],
      runs: [run],
    });
    window.history.replaceState({}, "", "/reviews");
    render(<CommercialWorkbench {...next} />);

    const row = await screen.findByTestId("case-table-row");
    expect(row.textContent).toContain("검증 시나리오 · 업무 참조번호 없음");
    expect(document.body.textContent).not.toContain(rawReference);
    expect(document.body.textContent).not.toContain("981da949-b930-4979-a889-72c6e5638906");
    await userEvent.click(row);
    expect(await screen.findByText(/검증 시나리오 · 업무 참조번호 없음/)).not.toBeNull();
    expect(document.body.textContent).not.toContain(rawReference);

    await userEvent.click(screen.getByRole("button", { name: "검증 정보 보기" }));
    expect(await screen.findByText(rawReference)).not.toBeNull();
  });

  it("fails closed when a query parameter selects a Run from another Case", async () => {
    const next = dependencies();
    const foreignRun: ReviewRun = {
      ...run,
      review_run_id: "run-foreign",
      case_id: "case-foreign",
    };
    vi.mocked(next.api.listReviewRuns).mockResolvedValue([foreignRun]);
    vi.mocked(next.api.getReviewRun).mockResolvedValue(foreignRun);
    window.history.replaceState(
      {},
      "",
      "/cases/case-1/review-actions?run=run-foreign",
    );
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByRole("heading", { name: "심사 건을 열 수 없습니다." }))
      .not.toBeNull();
    expect(screen.getByText(/심사 건 결박이 일치하지 않아/)).not.toBeNull();
    expect(screen.queryByTestId("review-actions-page")).toBeNull();
    expect(next.api.createRevisionProposal).not.toHaveBeenCalled();
    expect(next.experienceApi.getReviewExperience).not.toHaveBeenCalled();
  });

  it("rejects a Run query parameter that is absent from the Case Run list", async () => {
    const next = dependencies();
    window.history.replaceState(
      {},
      "",
      "/cases/case-1/overview?run=run-not-in-case",
    );
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByText(/현재 심사 건에 속하지 않아/)).not.toBeNull();
    expect(next.api.getReviewRun).not.toHaveBeenCalled();
    expect(next.experienceApi.getReviewExperience).not.toHaveBeenCalled();
  });

  it("does not render untrusted HTML through a markup escape hatch", async () => {
    const next = dependencies();
    vi.mocked(next.api.listCases).mockResolvedValue({
      items: [{ ...caseSummary, title: "<img src=x onerror=alert(1)>" }],
    });
    window.history.replaceState({}, "", "/reviews");
    render(<CommercialWorkbench {...next} />);

    expect((await screen.findAllByText("<img src=x onerror=alert(1)>")).length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector("img")).toBeNull();
  });

  it("provides the complete user workflow routes for documents, Evidence, assistant, actions and history", async () => {
    for (const [route, testId] of [
      ["/cases/case-1/documents", "documents-page"],
      ["/cases/case-1/evidence", "evidence-page"],
      ["/cases/case-1/review-actions", "review-actions-page"],
      ["/cases/case-1/history", "history-page"],
      ["/cases/case-1/assistant", "assistant-page"],
    ] as const) {
      cleanup();
      window.history.replaceState({}, "", route);
      const next = dependencies();
      vi.mocked(next.experienceApi.createConversation).mockResolvedValue(conversation);
      render(<CommercialWorkbench {...next} />);
      expect(await screen.findByTestId(testId)).not.toBeNull();
    }
  });

  it("keeps the auditor role exhaustively read-only across commercial routes", async () => {
    for (const [route, assertion] of [
      ["/reviews", () => expect((screen.getByRole("button", { name: "새 심사 건" }) as HTMLButtonElement).disabled).toBe(true)],
      ["/test-lab", () => expect((screen.getByRole("button", { name: /이 시나리오로 심사 건 만들기/ }) as HTMLButtonElement).disabled).toBe(true)],
      ["/cases/case-1/overview", () => expect(screen.queryByTestId("start-review")).toBeNull()],
      ["/cases/case-1/documents", () => expect((screen.getByRole("button", { name: "문서 등록" }) as HTMLButtonElement).disabled).toBe(true)],
      ["/cases/case-1/assistant", () => expect((screen.getByRole("button", { name: "질문하기" }) as HTMLButtonElement).disabled).toBe(true)],
      ["/cases/case-1/review-actions", () => expect((screen.getByRole("button", { name: "수정 제안 저장" }) as HTMLButtonElement).disabled).toBe(true)],
    ] as const) {
      cleanup();
      const next = dependencies();
      vi.mocked(next.api.getSession).mockResolvedValue({
        subject: "auditor-1",
        org_id: "org-1",
        roles: ["auditor"],
      });
      window.history.replaceState({}, "", route);
      render(<CommercialWorkbench {...next} />);
      expect(await screen.findByText("감사 조회 담당자", { exact: true })).not.toBeNull();
      await waitFor(assertion);
      expect(next.api.createCase).not.toHaveBeenCalled();
      expect(next.api.addDocument).not.toHaveBeenCalled();
      expect(next.experienceApi.enqueueReview).not.toHaveBeenCalled();
      expect(next.experienceApi.createConversation).not.toHaveBeenCalled();
      expect(next.experienceApi.sendMessage).not.toHaveBeenCalled();
      expect(next.api.createRevisionProposal).not.toHaveBeenCalled();
      expect(next.api.decideRevisionProposal).not.toHaveBeenCalled();
    }
  });

  it("never marks unrecorded or failed Agent stages as completed", async () => {
    const next = dependencies();
    const incompleteRun: ReviewRun = {
      ...run,
      review_stage_trace: [
        { sequence: 1, stage: "classify_documents", status: "completed", reason_ids: [] },
        { sequence: 2, stage: "extract_documents", status: "failed", reason_ids: ["model_error"] },
      ],
    };
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [],
      runs: [incompleteRun],
    });
    vi.mocked(next.api.listReviewRuns).mockResolvedValue([incompleteRun]);
    vi.mocked(next.api.getReviewRun).mockResolvedValue(incompleteRun);
    window.history.replaceState({}, "", "/cases/case-1/overview");
    render(<CommercialWorkbench {...next} />);

    const process = await screen.findByTestId("agent-process");
    expect(process.querySelectorAll('[data-stage-state="failed"]')).toHaveLength(1);
    expect(process.textContent).toContain("완료하지 못함");
    expect(process.textContent).toContain("이 단계를 안전하게 완료하지 못했습니다.");
    expect(process.textContent).not.toContain("5/5");
  });

  it("does not offer a review execution before at least one primary text document exists", async () => {
    window.history.replaceState({}, "", "/cases/case-1/overview");
    render(<CommercialWorkbench {...dependencies()} />);

    expect(await screen.findByText(/심사를 시작할 일반 문서가 없습니다/)).not.toBeNull();
    expect(screen.queryByTestId("start-review")).toBeNull();
    expect(screen.getByRole("link", { name: "문서 등록 화면으로 이동" }).getAttribute("href"))
      .toBe("/cases/case-1/documents");
  });

  it("shows actual three-law RAG only when the Run and capability identities match", async () => {
    window.history.replaceState({}, "", "/cases/case-1/evidence");
    render(<CommercialWorkbench {...dependencies()} />);
    const actualPage = await screen.findByTestId("evidence-page");
    expect(actualPage.textContent).toContain("실제 3법령 RAG");
    expect(actualPage.textContent).toContain("제한된 실제 법령 검색을 정상적으로 완료했습니다.");

    cleanup();
    const next = dependencies();
    const unboundRun: ReviewRun = {
      ...run,
      release_identity: {
        ...run.release_identity!,
        evidence_runtime_v3_sha256: digest("c"),
      },
    };
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [],
      runs: [unboundRun],
    });
    vi.mocked(next.api.listReviewRuns).mockResolvedValue([unboundRun]);
    vi.mocked(next.api.getReviewRun).mockResolvedValue(unboundRun);
    window.history.replaceState({}, "", "/cases/case-1/evidence");
    render(<CommercialWorkbench {...next} />);
    const unboundPage = await screen.findByTestId("evidence-page");
    expect(unboundPage.textContent).toContain("검색 출처 확인 필요");
    expect(unboundPage.textContent).not.toContain("제한된 실제 법령 검색을 정상적으로 완료했습니다.");
  });

  it("requires all four actual retrieval paths to be attempted and successful", async () => {
    const next = dependencies();
    const partialRun: ReviewRun = {
      ...run,
      successful_retrieval_methods: ["exact_hs", "dense", "bm25"],
      observed_retrieval_methods: ["exact_hs", "dense"],
    };
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [],
      runs: [partialRun],
    });
    vi.mocked(next.api.listReviewRuns).mockResolvedValue([partialRun]);
    vi.mocked(next.api.getReviewRun).mockResolvedValue(partialRun);
    window.history.replaceState({}, "", "/cases/case-1/evidence");
    render(<CommercialWorkbench {...next} />);

    const page = await screen.findByTestId("evidence-page");
    expect(page.textContent).toContain("실제 법령 검색 경로 중 일부가 완료되지 않았습니다.");
    expect(page.textContent).toContain("부분 완료");
    expect(page.textContent).not.toContain("제한된 실제 법령 검색을 정상적으로 완료했습니다.");
    expect(page.textContent).toContain("법령 관계 확장");
  });

  it("shows Korean document badges and blocks local text limits before calling Backend", async () => {
    const documents: CaseDocument[] = Array.from({ length: 6 }, (_, index) => ({
      document_id: `primary-${index}`,
      case_id: "case-1",
      document_type: index === 0 ? "CI" : "PL",
      filename: `primary-${index}.txt`,
      media_type: "text/plain",
      content_sha256: digest(String((index + 1) % 10)),
      byte_size: 80_000,
      character_count: 80_000,
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
    }));
    documents.push({
      ...documents[0]!,
      document_id: "supporting-document",
      document_type: "SUPPORTING",
      filename: "certificate.txt",
      content_sha256: digest("f"),
    });
    const next = dependencies();
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents,
      runs: [run],
    });
    window.history.replaceState({}, "", "/cases/case-1/documents");
    render(<CommercialWorkbench {...next} />);

    const page = await screen.findByTestId("documents-page");
    expect(page.textContent).toContain("일반 심사 문서 6/6개");
    expect(page.textContent).toContain("480,000/500,000자");
    expect(screen.getByText("요건 증명", { selector: ".document-type-badge" })).not.toBeNull();
    expect(page.textContent).not.toContain("SUPPORTING");
    expect((screen.getByRole("button", { name: "문서 등록" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(screen.getByTestId("supporting-document-registration"))
      .getByRole("option", { name: /저장된 원문 이어서 등록/ })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "요건 증명" })).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "문서 원문" }), {
      target: { value: "가".repeat(200_001) },
    });
    fireEvent.submit(screen.getByRole("textbox", { name: "문서 원문" }).closest("form")!);
    expect(await screen.findByText(/200,000자 이하/)).not.toBeNull();
    expect(next.api.addDocument).not.toHaveBeenCalled();
  });

  it("registers a supporting-document source and its verification metadata as one user flow", async () => {
    const next = dependencies();
    const sourceContent = "CERTIFICATE CONTENT";
    const source: CaseDocument = {
      document_id: "supporting-source-1",
      case_id: "case-1",
      document_type: "SUPPORTING",
      filename: "certificate.txt",
      media_type: "text/plain",
      content_sha256: await textSha256(sourceContent),
      byte_size: new TextEncoder().encode(sourceContent).byteLength,
      character_count: sourceContent.length,
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
    };
    const registered: SupportingDocumentRecord = {
      document_id: source.document_id,
      case_id: "case-1",
      org_id: "org-1",
      document_code: "CCCT_DOC_46E819BB87B27371",
      document_number: "CERT-001",
      issuer: "UAT 시험 발급기관",
      issued_on: "2026-07-01",
      valid_until: "2026-12-31",
      subject_item_ids: ["item-1"],
      hs_codes: ["0303540000"],
      source_sha256: source.content_sha256,
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
      verification_assertions: [],
    };
    vi.mocked(next.api.addDocument).mockResolvedValue(source);
    vi.mocked(next.api.addSupportingDocument).mockResolvedValue(registered);
    window.history.replaceState({}, "", "/cases/case-1/documents");
    render(<CommercialWorkbench {...next} />);

    const form = within(await screen.findByTestId("supporting-document-registration"));
    await userEvent.type(form.getByRole("textbox", { name: "파일 이름" }), source.filename);
    await userEvent.type(form.getByRole("textbox", { name: "증명서 원문" }), sourceContent);
    await userEvent.type(form.getByRole("textbox", { name: "증명서 코드" }), registered.document_code);
    await userEvent.type(form.getByRole("textbox", { name: "발급기관" }), registered.issuer);
    await userEvent.type(form.getByRole("textbox", { name: "증명서 번호" }), registered.document_number);
    fireEvent.change(form.getByLabelText("발급일"), { target: { value: registered.issued_on } });
    fireEvent.change(form.getByLabelText(/유효기간/), { target: { value: registered.valid_until } });
    await userEvent.click(form.getByRole("checkbox", {
      name: "품목 1 · 품목분류번호 0303540000",
    }));
    await userEvent.click(form.getByRole("button", { name: "요건 증명서 등록" }));

    await waitFor(() => expect(next.api.addDocument).toHaveBeenCalledWith("case-1", {
      document_type: "SUPPORTING",
      filename: source.filename,
      media_type: "text/plain",
      content_text: sourceContent,
    }));
    expect(next.api.addSupportingDocument).toHaveBeenCalledWith("case-1", {
      document_id: source.document_id,
      document_code: registered.document_code,
      issuer: registered.issuer,
      document_number: registered.document_number,
      issued_on: registered.issued_on,
      valid_until: registered.valid_until,
      subject_item_ids: ["item-1"],
      hs_codes: ["0303540000"],
      source_sha256: source.content_sha256,
    });
    expect(await screen.findByText(/CCCT_DOC_46E819BB87B27371 · CERT-001/)).not.toBeNull();
  });

  it("reconciles a lost supporting-source response before metadata registration without reposting", async () => {
    const sourceContent = "SOURCE RESPONSE LOST";
    const source: CaseDocument = {
      document_id: "supporting-source-response-lost",
      case_id: "case-1",
      document_type: "SUPPORTING",
      filename: "lost-response-certificate.txt",
      media_type: "text/plain",
      content_sha256: await textSha256(sourceContent),
      byte_size: new TextEncoder().encode(sourceContent).byteLength,
      character_count: sourceContent.length,
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
    };
    const registered: SupportingDocumentRecord = {
      document_id: source.document_id,
      case_id: "case-1",
      org_id: "org-1",
      document_code: "CCCT_DOC_46E819BB87B27371",
      document_number: "CERT-SOURCE-RECOVERED",
      issuer: "UAT 시험 발급기관",
      issued_on: "2026-07-01",
      valid_until: null,
      subject_item_ids: ["item-1"],
      hs_codes: ["0303540000"],
      source_sha256: source.content_sha256,
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
      verification_assertions: [],
    };
    const next = dependencies();
    vi.mocked(next.api.getCase)
      .mockResolvedValueOnce({
        ...caseSummary,
        created_at: "2026-07-27T00:00:00Z",
        documents: [],
        runs: [run],
      })
      .mockResolvedValue({
        ...caseSummary,
        created_at: "2026-07-27T00:00:00Z",
        documents: [source],
        runs: [run],
      });
    vi.mocked(next.api.addDocument).mockRejectedValue(new Error("response lost"));
    vi.mocked(next.api.addSupportingDocument).mockResolvedValue(registered);
    window.history.replaceState({}, "", "/cases/case-1/documents");
    render(<CommercialWorkbench {...next} />);

    const form = within(await screen.findByTestId("supporting-document-registration"));
    await userEvent.type(form.getByRole("textbox", { name: "파일 이름" }), source.filename);
    await userEvent.type(form.getByRole("textbox", { name: "증명서 원문" }), sourceContent);
    await fillSupportingMetadata(form, registered);
    await userEvent.click(form.getByRole("button", { name: "요건 증명서 등록" }));

    await waitFor(() => expect(next.api.addSupportingDocument).toHaveBeenCalledOnce());
    expect(next.api.addDocument).toHaveBeenCalledOnce();
    expect(next.api.addSupportingDocument).toHaveBeenCalledWith(
      "case-1",
      expect.objectContaining({
        document_id: source.document_id,
        source_sha256: source.content_sha256,
      }),
    );
    expect(await screen.findByText(/요건 증명서와 검증 정보를 등록했습니다/)).not.toBeNull();
  });

  it("never adopts another actor's identical source while reconciling a lost response", async () => {
    const sourceContent = "IDENTICAL SOURCE CONTENT";
    const foreignSource: CaseDocument = {
      document_id: "supporting-source-foreign",
      case_id: "case-1",
      document_type: "SUPPORTING",
      filename: "same-certificate.txt",
      media_type: "text/plain",
      content_sha256: await textSha256(sourceContent),
      byte_size: new TextEncoder().encode(sourceContent).byteLength,
      character_count: sourceContent.length,
      created_by: "another-reviewer",
      created_at: "2026-07-27T00:00:00Z",
    };
    const next = dependencies();
    vi.mocked(next.api.getCase)
      .mockResolvedValueOnce({
        ...caseSummary,
        created_at: "2026-07-27T00:00:00Z",
        documents: [],
        runs: [run],
      })
      .mockResolvedValue({
        ...caseSummary,
        created_at: "2026-07-27T00:00:00Z",
        documents: [foreignSource],
        runs: [run],
      });
    vi.mocked(next.api.addDocument).mockRejectedValue(new Error("response lost"));
    window.history.replaceState({}, "", "/cases/case-1/documents");
    render(<CommercialWorkbench {...next} />);

    const form = within(await screen.findByTestId("supporting-document-registration"));
    await userEvent.type(
      form.getByRole("textbox", { name: "파일 이름" }),
      foreignSource.filename,
    );
    await userEvent.type(
      form.getByRole("textbox", { name: "증명서 원문" }),
      sourceContent,
    );
    await fillSupportingMetadata(form, {
      document_id: foreignSource.document_id,
      case_id: "case-1",
      org_id: "org-1",
      document_code: "CCCT_DOC_46E819BB87B27371",
      document_number: "CERT-FOREIGN",
      issuer: "UAT 시험 발급기관",
      issued_on: "2026-07-01",
      valid_until: null,
      subject_item_ids: ["item-1"],
      hs_codes: ["0303540000"],
      source_sha256: foreignSource.content_sha256,
      created_by: foreignSource.created_by,
      created_at: foreignSource.created_at,
      verification_assertions: [],
    });
    await userEvent.click(form.getByRole("button", { name: "요건 증명서 등록" }));

    expect(await screen.findByText(/자동 재전송을 차단했습니다/)).not.toBeNull();
    expect(next.api.addDocument).toHaveBeenCalledOnce();
    expect(next.api.addSupportingDocument).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("another-reviewer");
  });

  it("recovers supporting metadata registration without uploading the source twice", async () => {
    const sourceContent = "CERTIFICATE CONTENT";
    const source: CaseDocument = {
      document_id: "supporting-source-recovery",
      case_id: "case-1",
      document_type: "SUPPORTING",
      filename: "certificate-recovery.txt",
      media_type: "text/plain",
      content_sha256: await textSha256(sourceContent),
      byte_size: new TextEncoder().encode(sourceContent).byteLength,
      character_count: sourceContent.length,
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
    };
    const registered: SupportingDocumentRecord = {
      document_id: source.document_id,
      case_id: "case-1",
      org_id: "org-1",
      document_code: "CCCT_DOC_46E819BB87B27371",
      document_number: "CERT-RECOVERY",
      issuer: "UAT 시험 발급기관",
      issued_on: "2026-07-01",
      valid_until: null,
      subject_item_ids: ["item-1"],
      hs_codes: ["0303540000"],
      source_sha256: source.content_sha256,
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
      verification_assertions: [],
    };
    const next = dependencies();
    vi.mocked(next.api.getCase)
      .mockResolvedValueOnce({
        ...caseSummary,
        created_at: "2026-07-27T00:00:00Z",
        documents: [],
        runs: [run],
      })
      .mockResolvedValue({
        ...caseSummary,
        created_at: "2026-07-27T00:00:00Z",
        documents: [source],
        runs: [run],
      });
    vi.mocked(next.api.addDocument).mockResolvedValue(source);
    vi.mocked(next.api.addSupportingDocument)
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(registered);
    window.history.replaceState({}, "", "/cases/case-1/documents");
    render(<CommercialWorkbench {...next} />);

    let form = within(await screen.findByTestId("supporting-document-registration"));
    await userEvent.type(form.getByRole("textbox", { name: "파일 이름" }), source.filename);
    await userEvent.type(form.getByRole("textbox", { name: "증명서 원문" }), sourceContent);
    await fillSupportingMetadata(form, registered);
    await userEvent.click(form.getByRole("button", { name: "요건 증명서 등록" }));
    expect(await screen.findByText(/원문은 저장됐지만 검증 정보 등록은 완료되지 않았습니다/)).not.toBeNull();

    form = within(screen.getByTestId("supporting-document-registration"));
    await userEvent.selectOptions(
      form.getByRole("combobox", { name: "등록을 마칠 원문" }),
      source.document_id,
    );
    await userEvent.click(form.getByRole("button", { name: "요건 증명서 등록" }));

    await waitFor(() => expect(next.api.addSupportingDocument).toHaveBeenCalledTimes(2));
    expect(next.api.addDocument).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/CCCT_DOC_46E819BB87B27371 · CERT-RECOVERY/)).not.toBeNull();
  });

  it("does not let a late document response replace the currently selected document", async () => {
    const documentA: CaseDocument = {
      document_id: "document-a",
      case_id: "case-1",
      document_type: "CI",
      filename: "invoice-a.txt",
      media_type: "text/plain",
      content_sha256: digest("1"),
      byte_size: 12,
      character_count: 12,
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
    };
    const documentB: CaseDocument = {
      ...documentA,
      document_id: "document-b",
      document_type: "PL",
      filename: "packing-b.txt",
      content_sha256: digest("2"),
    };
    const responseA = deferred<CaseDocument>();
    const responseB = deferred<CaseDocument>();
    const next = dependencies();
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [documentA, documentB],
      runs: [run],
    });
    vi.mocked(next.api.getDocumentContent).mockImplementation(async (_caseId, documentId) => (
      documentId === documentA.document_id ? responseA.promise : responseB.promise
    ));
    window.history.replaceState({}, "", "/cases/case-1/documents");
    render(<CommercialWorkbench {...next} />);

    await userEvent.click(await screen.findByRole("button", { name: /invoice-a\.txt/ }));
    await userEvent.click(screen.getByRole("button", { name: /packing-b\.txt/ }));
    responseB.resolve({ ...documentB, content_text: "PACKING LIST CURRENT" });
    expect(await screen.findByText("PACKING LIST CURRENT")).not.toBeNull();
    responseA.resolve({ ...documentA, content_text: "STALE INVOICE" });
    await Promise.resolve();
    expect(screen.queryByText("STALE INVOICE")).toBeNull();
    expect(screen.getByText("PACKING LIST CURRENT")).not.toBeNull();
  });

  it("lets only an independent approver record supporting-document verification", async () => {
    const supporting: SupportingDocumentRecord = {
      document_id: "supporting-1",
      case_id: "case-1",
      org_id: "org-1",
      document_code: "CCCT_DOC_46E819BB87B27371",
      document_number: "CERT-001",
      issuer: "UAT 시험 발급기관",
      issued_on: "2026-07-01",
      valid_until: "2026-12-31",
      subject_item_ids: ["item-1"],
      hs_codes: ["0303540000"],
      source_sha256: digest("3"),
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
      verification_assertions: [],
    };
    const verified: SupportingDocumentRecord = {
      ...supporting,
      verification_assertions: [{
        assertion_id: "assertion-1",
        subject_document_id: supporting.document_id,
        method: "human_approver",
        authority_id: "approver-2",
        authority_release: "local-uat",
        source_reference_sha256: digest("4"),
        asserted_by: "approver-2",
        asserted_at: "2026-07-27T00:00:01Z",
        decision_record: null,
        receipt: null,
      }],
    };
    const next = dependencies();
    vi.mocked(next.api.getSession).mockResolvedValue({
      subject: "approver-2",
      org_id: "org-1",
      roles: ["approver"],
    });
    vi.mocked(next.api.listSupportingDocuments).mockResolvedValue([supporting]);
    vi.mocked(next.api.addSupportingAssertion).mockResolvedValue(verified);
    window.history.replaceState({}, "", "/cases/case-1/documents");
    render(<CommercialWorkbench {...next} />);

    await userEvent.click(await screen.findByRole("button", { name: "증명서 확인 기록 남기기" }));
    await waitFor(() => expect(next.api.addSupportingAssertion).toHaveBeenCalledWith(
      "case-1",
      supporting.document_id,
      { method: "human_approver" },
    ));
    expect(await screen.findByText(/현재 승인 담당자 확인/)).not.toBeNull();
    expect(document.body.textContent).not.toContain("approver-2");
  });

  it("never treats an implicit keyboard form submission as approval", async () => {
    const approvalRun: ReviewRun = {
      ...run,
      input_document_manifest: [{
        document_id: "doc-approval",
        document_type: "CI",
        content_sha256: digest("5"),
      }],
      fields: [{
        field_id: "field-approval",
        document_id: "doc-approval",
        name: "invoice_no",
        field_path: "invoice_no",
        value: "INV-OLD",
        source_ids: [],
      }],
    };
    const validProposal = {
      ...pendingProposal,
      actions: [{
        decision: "correct_field" as const,
        reason: "원문에서 새 송장번호를 확인했습니다.",
        confirmed_reference_id: null,
        supporting_document_id: null,
        correction: {
          document_id: "doc-approval",
          field_path: "invoice_no",
          new_value: "INV-NEW",
          reason: "원문에서 새 송장번호를 확인했습니다.",
          confidence: 1,
        },
      }],
      corrections: [{
        document_id: "doc-approval",
        field_path: "invoice_no",
        new_value: "INV-NEW",
        reason: "원문에서 새 송장번호를 확인했습니다.",
        confidence: 1,
      }],
    };
    const next = dependencies();
    vi.mocked(next.api.getSession).mockResolvedValue({
      subject: "approver-2",
      org_id: "org-1",
      roles: ["approver"],
    });
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [],
      runs: [approvalRun],
    });
    vi.mocked(next.api.listReviewRuns).mockResolvedValue([approvalRun]);
    vi.mocked(next.api.getReviewRun).mockResolvedValue(approvalRun);
    vi.mocked(next.api.listRevisionProposals).mockResolvedValue([validProposal]);
    window.history.replaceState({}, "", "/cases/case-1/review-actions");
    render(<CommercialWorkbench {...next} />);

    const proposals = await screen.findByTestId("hitl-proposals");
    const reason = await screen.findByRole("textbox", { name: "검토 의견" });
    const form = proposals.querySelector("form");
    expect(form).not.toBeNull();
    await userEvent.type(reason, "원문과 제안 값을 확인했습니다.");
    fireEvent.submit(form!);

    expect((await screen.findByText(/버튼을 직접 선택/)).textContent).toContain("버튼을 직접 선택");
    const diff = screen.getByTestId("proposal-diff-proposal-1");
    expect(diff.textContent).toContain("송장번호");
    expect(diff.textContent).toContain("INV-OLD");
    expect(diff.textContent).toContain("INV-NEW");
    expect(diff.textContent).toContain("원문에서 새 송장번호를 확인했습니다.");
    expect(next.api.decideRevisionProposal).not.toHaveBeenCalled();
  });

  it("shows a foreign or stale proposal but fails closed before approval", async () => {
    const next = dependencies();
    vi.mocked(next.api.getSession).mockResolvedValue({
      subject: "approver-2",
      org_id: "org-1",
      roles: ["approver"],
    });
    vi.mocked(next.api.listRevisionProposals).mockResolvedValue([{
      ...pendingProposal,
      case_revision: 0,
      actions: [{
        decision: "correct_field",
        reason: "다른 문서의 항목을 수정하려는 제안입니다.",
        confirmed_reference_id: null,
        supporting_document_id: null,
        correction: {
          document_id: "foreign-document",
          field_path: "invoice_no",
          new_value: "INV-FOREIGN",
          reason: "다른 문서의 항목을 수정하려는 제안입니다.",
          confidence: 1,
        },
      }],
      corrections: [],
    }]);
    window.history.replaceState({}, "", "/cases/case-1/review-actions");
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByText(/변경 대상과 원본 값을 정확히 확인할 수 없어/)).not.toBeNull();
    expect(screen.getByText("확인되지 않은 문서 항목")).not.toBeNull();
    expect((screen.getByRole("button", { name: "승인·재심사" }) as HTMLButtonElement).disabled).toBe(true);
    expect(next.api.decideRevisionProposal).not.toHaveBeenCalled();
  });

  it("starts a review, restores the persisted stage stream and shows measured timing", async () => {
    const next = dependencies();
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [primaryDocument],
      runs: [run],
    });
    const job: ReviewJobExperience = {
      job: {
        job_id: "job-1",
        case_id: "case-1",
        kind: "review",
        parent_run_id: null,
        status: "queued",
        review_run_id: "run-2",
        error_code: null,
        attempt_count: 0,
        agent_call_state: "not_started",
        created_by: "reviewer-1",
        created_at: "2026-07-27T00:00:00Z",
        updated_at: "2026-07-27T00:00:00Z",
      },
      elapsed_seconds: 0,
      eta: {
        source: "validated_default",
        sample_count: 0,
        lower_seconds: 240,
        upper_seconds: 420,
      },
      latest_stage: null,
    };
    vi.mocked(next.experienceApi.enqueueReview).mockResolvedValue(job);
    vi.mocked(next.experienceApi.getReviewJob).mockResolvedValue(job);
    vi.mocked(next.experienceApi.streamReviewEvents).mockImplementation(async (_jobId, onEvent) => {
      onEvent({
        event_id: "event-1",
        job_id: "job-1",
        sequence: 1,
        stage_code: "report_composition",
        state: "completed",
        occurred_at: "2026-07-27T00:00:01Z",
        duration_ms: 1_000,
        safe_counts: { statement_count: 8 },
        message_key: "review.report_composition",
      });
      onEvent({
        event_id: "event-2",
        job_id: "job-1",
        sequence: 2,
        stage_code: "report_composition",
        state: "started",
        occurred_at: "2026-07-27T00:00:02Z",
        duration_ms: 0,
        safe_counts: {},
        message_key: "review.report_composition",
      });
    });
    window.history.replaceState({}, "", "/cases/case-1/overview");
    render(<CommercialWorkbench {...next} />);
    await userEvent.click(await screen.findByTestId("start-review"));
    expect(await screen.findByTestId("review-progress")).not.toBeNull();
    expect(screen.getByTestId("current-stage").textContent).toContain("심사 설명 작성");
    expect(screen.getByTestId("eta-range").textContent).toContain("4분");
    const stageItems = [...document.querySelectorAll(".live-review__stages > li")];
    expect(stageItems).toHaveLength(11);
    expect(stageItems.map((item) => item.getAttribute("data-stage-code"))).toEqual([
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
    ]);
    expect(
      document.querySelector('[data-stage-code="report_composition"]')
        ?.getAttribute("data-stage-state"),
    ).toBe("started");
    expect(screen.getByTestId("handled-stage-count").textContent).toBe("0/11개");
    expect(next.experienceApi.enqueueReview).toHaveBeenCalledTimes(1);
  });

  it("reuses the same review idempotency key after a lost enqueue response without storing documents", async () => {
    const next = dependencies();
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [primaryDocument],
      runs: [run],
    });
    const queued: ReviewJobExperience = {
      job: {
        job_id: "job-response-loss",
        case_id: "case-1",
        kind: "review",
        parent_run_id: null,
        status: "queued",
        review_run_id: "run-response-loss",
        error_code: null,
        attempt_count: 0,
        agent_call_state: "not_started",
        created_by: "reviewer-1",
        created_at: "2026-07-27T00:00:00Z",
        updated_at: "2026-07-27T00:00:00Z",
      },
      elapsed_seconds: 0,
      eta: {
        source: "validated_default",
        sample_count: 0,
        lower_seconds: 240,
        upper_seconds: 420,
      },
      latest_stage: null,
    };
    vi.mocked(next.experienceApi.enqueueReview)
      .mockRejectedValueOnce(new Error("응답 확인 중 연결이 끊겼습니다."))
      .mockResolvedValue(queued);
    vi.mocked(next.experienceApi.getReviewJob).mockResolvedValue(queued);
    window.history.replaceState({}, "", "/cases/case-1/overview");
    render(<CommercialWorkbench {...next} />);

    await userEvent.click(await screen.findByTestId("start-review"));
    expect((await screen.findByRole("alert")).textContent).toContain("응답 확인 중 연결이 끊겼습니다.");
    const stored = window.sessionStorage.getItem("customs.enhanced.pending-review");
    expect(stored).not.toBeNull();
    expect(stored).not.toContain("냉동 고등어");
    expect(stored).not.toContain("Invoice");

    await userEvent.click(screen.getByTestId("start-review"));
    await waitFor(() => expect(next.experienceApi.enqueueReview).toHaveBeenCalledTimes(2));
    const firstKey = vi.mocked(next.experienceApi.enqueueReview).mock.calls[0]?.[2];
    const secondKey = vi.mocked(next.experienceApi.enqueueReview).mock.calls[1]?.[2];
    expect(firstKey).toBe(secondKey);
  });

  it("preserves a known uncertain Review Job and blocks duplicate calls across reload and Case routes", async () => {
    const pending = {
      orgId: "org-1",
      actorId: "reviewer-1",
      caseId: "case-1",
      jobId: "job-uncertain",
      idempotencyKey: "review-11111111-1111-4111-8111-111111111111",
      reviewAsOf: "2026-07-10",
      startedAt: "2026-07-27T00:00:00Z",
    };
    window.sessionStorage.setItem(
      "customs.enhanced.pending-review",
      JSON.stringify(pending),
    );
    const next = dependencies();
    vi.mocked(next.experienceApi.getReviewJob).mockResolvedValue({
      job: {
        job_id: "job-uncertain",
        case_id: "case-1",
        kind: "review",
        parent_run_id: null,
        status: "delivery_uncertain",
        review_run_id: "run-uncertain",
        error_code: "agent_delivery_uncertain",
        attempt_count: 1,
        agent_call_state: "delivery_uncertain",
        created_by: "reviewer-1",
        created_at: "2026-07-27T00:00:00Z",
        updated_at: "2026-07-27T00:00:01Z",
      },
      elapsed_seconds: 1,
      eta: {
        source: "validated_default",
        sample_count: 0,
        lower_seconds: 240,
        upper_seconds: 420,
      },
      latest_stage: null,
    });
    window.history.replaceState({}, "", "/cases/case-1/overview");
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByText(/같은 심사를 다시 실행하지 않고/)).not.toBeNull();
    expect(screen.queryByTestId("start-review")).toBeNull();
    expect(window.sessionStorage.getItem("customs.enhanced.pending-review")).toContain("job-uncertain");
    expect(next.experienceApi.enqueueReview).not.toHaveBeenCalled();

    cleanup();
    window.sessionStorage.setItem(
      "customs.enhanced.pending-review",
      JSON.stringify({ ...pending, caseId: "case-other", jobId: "job-other" }),
    );
    const crossCase = dependencies();
    window.history.replaceState({}, "", "/cases/case-1/overview");
    render(<CommercialWorkbench {...crossCase} />);
    expect(await screen.findByText(/다른 심사 건에서 확인 중인 실행/)).not.toBeNull();
    expect(crossCase.experienceApi.getReviewJob).not.toHaveBeenCalled();
    expect(crossCase.experienceApi.enqueueReview).not.toHaveBeenCalled();
  });

  it("recovers an acknowledged Assistant question with the same hash key and stores no question text", async () => {
    const next = dependencies();
    const question = "이 법령 근거가 현재 심사 건에서 어떤 의미입니까?";
    const trailingUserMessage = assistantEnqueueResponse(question).user_message;
    const key = derivedIdempotencyKey("assistant", [
      conversation.conversation_id,
      digest("0"),
      "",
      question,
    ]);
    window.sessionStorage.setItem("customs.enhanced.pending-assistant", JSON.stringify({
      orgId: "org-1",
      actorId: "reviewer-1",
      runId: "run-1",
      conversationId: conversation.conversation_id,
      jobId: null,
      requestBindingSha256: null,
      idempotencyKey: key,
      startedAt: new Date().toISOString(),
    }));
    vi.mocked(next.experienceApi.listConversations).mockResolvedValue([conversation]);
    vi.mocked(next.experienceApi.listMessages).mockResolvedValueOnce([trailingUserMessage]).mockResolvedValue([]);
    vi.mocked(next.experienceApi.sendMessage).mockResolvedValue(assistantEnqueueResponse(question));
    window.history.replaceState({}, "", "/cases/case-1/assistant");
    render(<CommercialWorkbench {...next} />);

    await waitFor(() => expect(next.experienceApi.sendMessage).toHaveBeenCalledTimes(1));
    expect(vi.mocked(next.experienceApi.sendMessage).mock.calls[0]?.[2]).toBe(key);
    await waitFor(() => expect(
      window.sessionStorage.getItem("customs.enhanced.pending-assistant"),
    ).toBeNull());
  });

  it("recovers an exactly bound persisted Backend Assistant Job without sending Claude again", async () => {
    const next = dependencies();
    const question = "검색된 근거가 이 심사 건에서 어떤 의미입니까?";
    const trailingUserMessage = assistantEnqueueResponse(question).user_message;
    const key = derivedIdempotencyKey("assistant", [
      conversation.conversation_id,
      digest("0"),
      "",
      question,
    ]);
    window.sessionStorage.setItem("customs.enhanced.pending-assistant", JSON.stringify({
      orgId: "org-1",
      actorId: "reviewer-1",
      runId: "run-1",
      conversationId: conversation.conversation_id,
      jobId: "assistant-job-1",
      requestBindingSha256: digest("e"),
      idempotencyKey: key,
      startedAt: "2026-07-27T00:00:00Z",
    }));
    vi.mocked(next.experienceApi.listConversations).mockResolvedValue([conversation]);
    vi.mocked(next.experienceApi.listMessages)
      .mockResolvedValueOnce([trailingUserMessage])
      .mockResolvedValue([trailingUserMessage, groundedAssistantMessage]);
    window.history.replaceState({}, "", "/cases/case-1/assistant");
    render(<CommercialWorkbench {...next} />);

    await waitFor(() => expect(next.experienceApi.getAssistantJob).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(
      window.sessionStorage.getItem("customs.enhanced.pending-assistant"),
    ).toBeNull());
    expect(next.experienceApi.listAssistantJobs).not.toHaveBeenCalled();
    expect(next.experienceApi.sendMessage).not.toHaveBeenCalled();
    expect(await screen.findByText("검색된 법령 근거의 의미를 설명합니다.")).not.toBeNull();
  });

  it("scrolls to a completed Assistant answer, announces it politely, and restores composer focus", async () => {
    const next = dependencies();
    const question = "이번 심사의 결론을 설명해 주십시오.";
    const response = assistantEnqueueResponse(question);
    const answer = {
      ...groundedAssistantMessage,
      parent_message_id: response.user_message.message_id,
    };
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    vi.mocked(next.experienceApi.listConversations).mockResolvedValue([conversation]);
    vi.mocked(next.experienceApi.listMessages)
      .mockResolvedValueOnce([])
      .mockResolvedValue([response.user_message, answer]);
    vi.mocked(next.experienceApi.sendMessage).mockResolvedValue(response);
    window.history.replaceState({}, "", "/cases/case-1/assistant");
    render(<CommercialWorkbench {...next} />);
    const textarea = await screen.findByLabelText("AI 심사 도우미에게 질문");
    await waitFor(() => expect((textarea as HTMLTextAreaElement).disabled).toBe(false));

    await userEvent.type(textarea, question);
    await userEvent.click(screen.getByRole("button", { name: "질문하기" }));

    const announcement = await screen.findByTestId("assistant-completion-announcement");
    expect(announcement.getAttribute("aria-live")).toBe("polite");
    expect(announcement.textContent).toContain("새 답변이 준비되었습니다");
    await waitFor(() => expect(document.activeElement).toBe(textarea));
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "auto", block: "end" });
  });

  it("keeps a known uncertain Assistant Job bound and disables all new questions", async () => {
    const next = dependencies();
    const question = "검색된 근거가 이 심사 건에서 어떤 의미입니까?";
    const key = derivedIdempotencyKey("assistant", [
      conversation.conversation_id,
      digest("0"),
      "",
      question,
    ]);
    window.sessionStorage.setItem("customs.enhanced.pending-assistant", JSON.stringify({
      orgId: "org-1",
      actorId: "reviewer-1",
      runId: "run-1",
      conversationId: conversation.conversation_id,
      jobId: "assistant-job-uncertain",
      requestBindingSha256: digest("e"),
      idempotencyKey: key,
      startedAt: "2026-07-27T00:00:00Z",
    }));
    vi.mocked(next.experienceApi.listConversations).mockResolvedValue([conversation]);
    vi.mocked(next.experienceApi.listMessages).mockResolvedValue([]);
    vi.mocked(next.experienceApi.getAssistantJob).mockResolvedValue({
      ...assistantEnqueueResponse(question).job,
      assistant_job_id: "assistant-job-uncertain",
      state: "response_persistence_uncertain",
      error_code: "assistant_response_persistence_uncertain",
    });
    window.history.replaceState({}, "", "/cases/case-1/assistant");
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByText(/같은 질문을 다시 보내지 않고/)).not.toBeNull();
    expect((screen.getByRole("textbox", { name: "AI 심사 도우미에게 질문" }) as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "질문하기" }) as HTMLButtonElement).disabled).toBe(true);
    expect(window.sessionStorage.getItem("customs.enhanced.pending-assistant")).toContain(
      "assistant-job-uncertain",
    );
    expect(next.experienceApi.sendMessage).not.toHaveBeenCalled();
  });

  it("rejects a persisted Assistant Job before opening a stream when its conversation is not server-owned", async () => {
    const next = dependencies();
    window.sessionStorage.setItem("customs.enhanced.pending-assistant", JSON.stringify({
      orgId: "org-1",
      actorId: "reviewer-1",
      runId: "run-1",
      conversationId: "conversation-from-another-case",
      jobId: "assistant-job-foreign",
      requestBindingSha256: digest("e"),
      idempotencyKey: `assistant-${digest("a")}`,
      startedAt: "2026-07-27T00:00:00Z",
    }));
    vi.mocked(next.experienceApi.listConversations).mockResolvedValue([conversation]);
    vi.mocked(next.experienceApi.listMessages).mockResolvedValue([]);
    window.history.replaceState({}, "", "/cases/case-1/assistant");
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByText(/현재 심사 회차의 서버 대화에 속하지 않아/)).not.toBeNull();
    expect(window.sessionStorage.getItem("customs.enhanced.pending-assistant")).toBeNull();
    expect(next.experienceApi.getAssistantJob).not.toHaveBeenCalled();
    expect(next.experienceApi.streamAssistantEvents).not.toHaveBeenCalled();
  });

  it("checks an acknowledged Assistant Job binding before opening its event stream", async () => {
    const next = dependencies();
    window.sessionStorage.setItem("customs.enhanced.pending-assistant", JSON.stringify({
      orgId: "org-1",
      actorId: "reviewer-1",
      runId: "run-1",
      conversationId: conversation.conversation_id,
      jobId: "assistant-job-1",
      requestBindingSha256: digest("e"),
      idempotencyKey: `assistant-${digest("b")}`,
      startedAt: "2026-07-27T00:00:00Z",
    }));
    vi.mocked(next.experienceApi.listConversations).mockResolvedValue([conversation]);
    vi.mocked(next.experienceApi.listMessages).mockResolvedValue([]);
    vi.mocked(next.experienceApi.getAssistantJob).mockResolvedValue({
      ...assistantEnqueueResponse("질문").job,
      conversation_id: "conversation-from-another-case",
    });
    window.history.replaceState({}, "", "/cases/case-1/assistant");
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByText(/서버 답변 작업의 결박이 일치하지 않아/)).not.toBeNull();
    expect(next.experienceApi.streamAssistantEvents).not.toHaveBeenCalled();
  });

  it("rejects a persisted Assistant Job whose exact request binding changed", async () => {
    const next = dependencies();
    const question = "검색된 근거가 이 심사 건에서 어떤 의미입니까?";
    const trailingUserMessage = assistantEnqueueResponse(question).user_message;
    const key = derivedIdempotencyKey("assistant", [
      conversation.conversation_id,
      digest("0"),
      "",
      question,
    ]);
    window.sessionStorage.setItem("customs.enhanced.pending-assistant", JSON.stringify({
      orgId: "org-1",
      actorId: "reviewer-1",
      runId: "run-1",
      conversationId: conversation.conversation_id,
      jobId: "assistant-job-1",
      requestBindingSha256: digest("e"),
      idempotencyKey: key,
      startedAt: "2026-07-27T00:00:00Z",
    }));
    vi.mocked(next.experienceApi.listConversations).mockResolvedValue([conversation]);
    vi.mocked(next.experienceApi.listMessages).mockResolvedValue([trailingUserMessage]);
    vi.mocked(next.experienceApi.getAssistantJob).mockResolvedValue({
      ...assistantEnqueueResponse(question).job,
      request_binding_sha256: digest("f"),
      state: "succeeded",
      answer_message_id: "assistant-message-1",
    });
    window.history.replaceState({}, "", "/cases/case-1/assistant");
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByText(/저장된 질문과 서버 답변 작업의 결박이 일치하지 않아/)).not.toBeNull();
    expect(window.sessionStorage.getItem("customs.enhanced.pending-assistant")).toBeNull();
    expect(next.experienceApi.sendMessage).not.toHaveBeenCalled();
  });

  it("retries a lost Assistant response with one key and derives a new key for a new question", async () => {
    const next = dependencies();
    const firstQuestion = "담당자가 다음으로 해야 할 일을 알려 주십시오.";
    const secondQuestion = "현재 확인 범위의 한계를 설명해 주십시오.";
    vi.mocked(next.experienceApi.listConversations).mockResolvedValue([conversation]);
    vi.mocked(next.experienceApi.listMessages).mockResolvedValue([]);
    vi.mocked(next.experienceApi.sendMessage)
      .mockRejectedValueOnce(new Error("답변 요청의 응답을 확인하지 못했습니다."))
      .mockImplementation(async (_conversationId, payload) => assistantEnqueueResponse(payload.question));
    window.history.replaceState({}, "", "/cases/case-1/assistant");
    render(<CommercialWorkbench {...next} />);
    const textarea = await screen.findByLabelText("AI 심사 도우미에게 질문");
    await waitFor(() => expect((textarea as HTMLTextAreaElement).disabled).toBe(false));

    await userEvent.type(textarea, firstQuestion);
    await userEvent.click(screen.getByRole("button", { name: "질문하기" }));
    expect((await screen.findByRole("alert")).textContent).toContain("응답을 확인하지 못했습니다.");
    const pendingStorage = window.sessionStorage.getItem("customs.enhanced.pending-assistant");
    expect(pendingStorage).not.toBeNull();
    expect(pendingStorage).not.toContain(firstQuestion);

    await userEvent.type(textarea, firstQuestion);
    await userEvent.click(screen.getByRole("button", { name: "같은 질문 다시 확인" }));
    await waitFor(() => expect(next.experienceApi.sendMessage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(
      window.sessionStorage.getItem("customs.enhanced.pending-assistant"),
    ).toBeNull());
    const firstKey = vi.mocked(next.experienceApi.sendMessage).mock.calls[0]?.[2];
    const retryKey = vi.mocked(next.experienceApi.sendMessage).mock.calls[1]?.[2];
    expect(retryKey).toBe(firstKey);

    await userEvent.type(textarea, secondQuestion);
    await userEvent.click(screen.getByRole("button", { name: "질문하기" }));
    await waitFor(() => expect(next.experienceApi.sendMessage).toHaveBeenCalledTimes(3));
    const nextKey = vi.mocked(next.experienceApi.sendMessage).mock.calls[2]?.[2];
    expect(nextKey).not.toBe(firstKey);
  });

  it("explains an actual bounded Agent tool action without exposing raw internal codes", async () => {
    const boundedRun: ReviewRun = {
      ...run,
      action_trace: [
        {
          action_id: "action-1",
          cycle: 1,
          tool: "document.reread_span/v1",
          status: "succeeded",
          reason_code: "field_uncertainty",
          input_source_ids: ["field-source-1"],
          observation: "safe-observation",
          started_at: "2026-07-27T00:00:01Z",
          finished_at: "2026-07-27T00:00:02Z",
        },
        {
          action_id: "action-2",
          cycle: 1,
          tool: "explanation.compose/v2",
          status: "succeeded",
          reason_code: "report_requested",
          input_source_ids: [],
          started_at: "2026-07-27T00:00:03Z",
          finished_at: "2026-07-27T00:00:04Z",
        },
      ],
    };
    const next = dependencies();
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [],
      runs: [boundedRun],
    });
    vi.mocked(next.api.listReviewRuns).mockResolvedValue([boundedRun]);
    vi.mocked(next.api.getReviewRun).mockResolvedValue(boundedRun);
    window.history.replaceState({}, "", "/cases/case-1/overview");
    render(<CommercialWorkbench {...next} />);

    const timeline = await screen.findByTestId("adaptive-action-timeline");
    expect(timeline.textContent).toContain("문서 원문 범위 재확인");
    expect(timeline.textContent).toContain("1회 추가 확인");
    expect(timeline.textContent).not.toContain("사용자용 결과 설명 구성");
    expect(timeline.textContent).toContain("추출한 값의 확신이 충분하지 않아");
    expect(timeline.textContent).toContain("확인 완료");
    expect(timeline.textContent).not.toContain("document.reread_span/v1");
    expect(timeline.textContent).not.toContain("field_uncertainty");
    expect(timeline.textContent).not.toContain("safe-observation");
  });

  it("shows the login surface without leaking an authenticated workbench", async () => {
    const next = dependencies();
    vi.mocked(next.oidc.isAuthenticated).mockReturnValue(false);
    window.history.replaceState({}, "", "/login");
    render(<CommercialWorkbench {...next} />);
    expect(await screen.findByRole("heading", { name: "심사 작업대에 로그인합니다." })).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /로그인/ }));
    expect(next.oidc.login).toHaveBeenCalledTimes(1);
  });

  it("moves a grounded Assistant citation to its actual Evidence target and focuses it", async () => {
    const next = dependencies();
    vi.mocked(next.experienceApi.listConversations).mockResolvedValue([conversation]);
    vi.mocked(next.experienceApi.listMessages).mockResolvedValue([groundedAssistantMessage]);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    window.history.replaceState({}, "", "/cases/case-1/assistant");
    render(<CommercialWorkbench {...next} />);
    await userEvent.click(await screen.findByTestId("citation-evidence-evidence-1"));
    expect(await screen.findByTestId("evidence-page")).not.toBeNull();
    await waitFor(() => expect(document.activeElement?.id).toBe("reference-evidence-1"));

    await new Promise((resolve) => window.setTimeout(resolve, 175));
    const originalTarget = document.getElementById("reference-evidence-1");
    const replacementTarget = originalTarget?.cloneNode(true);
    expect(replacementTarget).toBeInstanceOf(HTMLElement);
    originalTarget?.replaceWith(replacementTarget!);
    await waitFor(() => expect(document.activeElement).toBe(replacementTarget));
  });

  it("builds a run-bound source citation link and opens only its exact source span", async () => {
    const caseDocument: CaseDocument = {
      document_id: "doc-invoice-1",
      case_id: "case-1",
      document_type: "CI",
      filename: "invoice.txt",
      media_type: "text/plain",
      content_text: "Invoice No: INV-001",
      content_sha256: digest("c"),
      byte_size: 19,
      character_count: 19,
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
    };
    const fieldRun: ReviewRun = {
      ...run,
      input_document_manifest: [{
        document_id: caseDocument.document_id,
        document_type: "CI",
        content_sha256: caseDocument.content_sha256,
      }],
      fields: [{
        field_id: "field-invoice-number",
        document_id: caseDocument.document_id,
        name: "invoice_no",
        field_path: "invoice_no",
        value: "INV-001",
        confidence: 1,
        source_ids: ["source-invoice-prefix", "source-invoice-number"],
      }],
      sources: [
        {
          source_id: "source-invoice-prefix",
          document_id: caseDocument.document_id,
          label: "invoice_no_label",
          quote: "Invoice No",
          start_offset: 0,
          end_offset: 10,
        },
        {
          source_id: "source-invoice-number",
          document_id: caseDocument.document_id,
          label: "invoice_no",
          quote: "INV-001",
          start_offset: 12,
          end_offset: 19,
        },
      ],
    };
    const next = dependencies();
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [caseDocument],
      runs: [fieldRun],
    });
    vi.mocked(next.api.listReviewRuns).mockResolvedValue([fieldRun]);
    vi.mocked(next.api.getReviewRun).mockResolvedValue(fieldRun);
    vi.mocked(next.api.getDocumentContent).mockResolvedValue(caseDocument);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    const destination = citationDestination("case-1", "run-1", {
      kind: "field_source",
      reference_id: "source-invoice-number",
    });
    expect(destination).toBe(
      "/cases/case-1/documents?run=run-1&source=source-invoice-number#field-source-invoice-number",
    );
    window.history.replaceState({}, "", destination);
    render(<CommercialWorkbench {...next} />);

    const target = await screen.findByText("INV-001", { selector: "dd" });
    expect(target.parentElement?.className).toContain("is-citation-target");
    expect(target.parentElement?.dataset.reviewRunId).toBe("run-1");
    await waitFor(() => expect(document.activeElement?.id).toBe("field-source-invoice-number"));
    expect(screen.getByTestId("document-source-highlight").textContent).toBe("INV-001");
    expect(screen.getByTestId("citation-granularity").textContent).toContain("정확한 원문 범위");
    expect(next.api.getDocumentContent).toHaveBeenCalledWith("case-1", "doc-invoice-1");

    cleanup();
    const fieldLevel = dependencies();
    vi.mocked(fieldLevel.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [caseDocument],
      runs: [fieldRun],
    });
    vi.mocked(fieldLevel.api.listReviewRuns).mockResolvedValue([fieldRun]);
    vi.mocked(fieldLevel.api.getReviewRun).mockResolvedValue(fieldRun);
    vi.mocked(fieldLevel.api.getDocumentContent).mockResolvedValue(caseDocument);
    window.history.replaceState(
      {},
      "",
      citationDestination("case-1", "run-1", {
        kind: "field_source",
        reference_id: "field-invoice-number",
      }),
    );
    render(<CommercialWorkbench {...fieldLevel} />);
    expect((await screen.findByTestId("citation-granularity")).textContent).toContain(
      "문서 항목 수준",
    );
    expect(screen.queryByTestId("document-source-highlight")).toBeNull();
  });

  it("fails closed when a source citation claims a different document owner", async () => {
    const document: CaseDocument = {
      document_id: "doc-invoice-1",
      case_id: "case-1",
      document_type: "CI",
      filename: "invoice.txt",
      media_type: "text/plain",
      content_sha256: digest("c"),
      byte_size: 19,
      character_count: 19,
      created_by: "reviewer-1",
      created_at: "2026-07-27T00:00:00Z",
    };
    const foreignSourceRun: ReviewRun = {
      ...run,
      input_document_manifest: [{
        document_id: document.document_id,
        document_type: "CI",
        content_sha256: document.content_sha256,
      }],
      fields: [{
        field_id: "field-invoice-number",
        document_id: document.document_id,
        name: "invoice_no",
        field_path: "invoice_no",
        value: "INV-001",
        source_ids: ["source-foreign-owner"],
      }],
      sources: [{
        source_id: "source-foreign-owner",
        document_id: "doc-other",
        label: "invoice_no",
        quote: "INV-001",
        start_offset: 12,
        end_offset: 19,
      }],
    };
    const next = dependencies();
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [document],
      runs: [foreignSourceRun],
    });
    vi.mocked(next.api.listReviewRuns).mockResolvedValue([foreignSourceRun]);
    vi.mocked(next.api.getReviewRun).mockResolvedValue(foreignSourceRun);
    window.history.replaceState(
      {},
      "",
      "/cases/case-1/documents?run=run-1&source=source-foreign-owner#field-source-foreign-owner",
    );
    render(<CommercialWorkbench {...next} />);
    expect((await screen.findByTestId("document-citation-error")).textContent).toContain(
      "소유 관계를 정확히 확인할 수 없어",
    );
    expect(next.api.getDocumentContent).not.toHaveBeenCalled();
  });

  it("fails closed when a document citation is absent from the selected run manifest", async () => {
    const next = dependencies();
    const missingRun: ReviewRun = {
      ...run,
      input_document_manifest: [],
      fields: [{
        field_id: "field-not-in-manifest",
        document_id: "doc-not-in-manifest",
        name: "invoice_no",
        field_path: "invoice_no",
        value: "INV-X",
        source_ids: [],
      }],
    };
    vi.mocked(next.api.getCase).mockResolvedValue({
      ...caseSummary,
      created_at: "2026-07-27T00:00:00Z",
      documents: [],
      runs: [missingRun],
    });
    vi.mocked(next.api.listReviewRuns).mockResolvedValue([missingRun]);
    vi.mocked(next.api.getReviewRun).mockResolvedValue(missingRun);
    window.history.replaceState(
      {},
      "",
      "/cases/case-1/documents?run=run-1&source=field-not-in-manifest#field-field-not-in-manifest",
    );
    render(<CommercialWorkbench {...next} />);

    expect((await screen.findByTestId("document-citation-error")).textContent).toContain(
      "입력 문서 소유 관계를 정확히 확인할 수 없어",
    );
    expect(next.api.getDocumentContent).not.toHaveBeenCalled();
  });

  it("keeps the HSK and HS Code guidance question available before the first answer", async () => {
    const next = dependencies();
    vi.mocked(next.experienceApi.listConversations).mockResolvedValue([conversation]);
    vi.mocked(next.experienceApi.listMessages).mockResolvedValue([]);
    window.history.replaceState({}, "", "/cases/case-1/assistant");
    render(<CommercialWorkbench {...next} />);

    expect(await screen.findByRole("button", {
      name: "HSK와 HS Code의 차이를 설명해 주십시오.",
    })).not.toBeNull();
  });

  it.each([
    ["/reviews", "reviews-inbox"],
    ["/test-lab", "test-lab"],
    ["/cases/case-1/overview", "case-overview"],
    ["/cases/case-1/documents", "documents-page"],
    ["/cases/case-1/evidence", "evidence-page"],
    ["/cases/case-1/assistant", "assistant-page"],
    ["/cases/case-1/review-actions", "review-actions-page"],
    ["/cases/case-1/history", "history-page"],
  ])("has no axe violations on the primary route %s", async (path, testId) => {
    window.history.replaceState({}, "", path);
    render(<CommercialWorkbench {...dependencies()} />);
    expect(await screen.findByTestId(testId)).not.toBeNull();
    expect((await axe.run(document.body)).violations).toEqual([]);
  });
});
