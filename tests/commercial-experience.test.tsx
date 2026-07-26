import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../src/api/v1/client";
import type { ReviewRun } from "../src/api/v1/types";
import type { ExperienceApiClient } from "../src/api/v2/client";
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantMessageEnqueueResponse,
  ReviewExperienceEnvelope,
  ReviewJobExperience,
} from "../src/api/v2/types";
import type { OidcSession } from "../src/auth";
import { CommercialWorkbench } from "../src/experience/app";
import { derivedIdempotencyKey } from "../src/experience/idempotency";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

const digest = (character: string): string => character.repeat(64);
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

const envelope: ReviewExperienceEnvelope = {
  schema_version: "1.0",
  canonical_result: {},
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
    },
    verification_audit: {
      status: "passed",
      deterministic_checks_passed: true,
      entailment_verifier: "claude",
      verifier_model_id: "claude-private-model-identifier",
      verifier_prompt_sha256: digest("5"),
      verifier_schema_sha256: digest("6"),
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
  envelope_sha256: digest("2"),
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
    answer_scope: "evidence_grounded",
    status: "answered",
    direct_answer: "검색된 법령 근거의 의미를 설명합니다.",
    explanation: ["현재 심사 품목과 연결된 근거입니다."],
    evidence_meaning: ["담당자가 적용 여부를 확인할 출발점입니다."],
    impact: ["최종 처리 전 담당자 확인이 필요합니다."],
    next_steps: ["근거 조문을 확인합니다."],
    limitations: ["현재 3종 법령 범위에 한정됩니다."],
    citations: [{ kind: "evidence", reference_id: "evidence-1" }],
    suggested_questions: [],
    used_context_message_ids: [],
    generation_audit: envelope.user_presentation.generation_audit,
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
} {
  return {
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
      getDocumentContent: vi.fn(),
      listRevisionProposals: vi.fn(async () => []),
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
        state: "succeeded",
        events: [],
        answer_message_id: "assistant-message-1",
        error_code: null,
        created_at: "2026-07-27T00:00:00Z",
        updated_at: "2026-07-27T00:00:01Z",
      })),
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

  it("makes all nine actual-RAG scenarios selectable from the isolated Test Lab", async () => {
    window.history.replaceState({}, "", "/test-lab");
    render(<CommercialWorkbench {...dependencies()} />);

    expect(await screen.findByTestId("test-lab")).not.toBeNull();
    expect(screen.getByTestId("scenario-count").textContent).toContain("9개 시나리오");
    expect(document.querySelectorAll('[data-testid^="scenario-"]:not([data-testid="scenario-count"])')).toHaveLength(9);
    expect(screen.getByText("입력 통관 문서와 증명서는 합성 테스트 자료입니다.")).not.toBeNull();
    expect(screen.getByText(/실제 Claude와 PostgreSQL·Qdrant·Neo4j 검색 경로/)).not.toBeNull();
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

  it("starts a review, restores the persisted stage stream and shows measured timing", async () => {
    const next = dependencies();
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
        stage_code: "document_analysis",
        state: "started",
        occurred_at: "2026-07-27T00:00:01Z",
        duration_ms: 0,
        safe_counts: { document_count: 4 },
        message_key: "review.document_analysis",
      });
    });
    window.history.replaceState({}, "", "/cases/case-1/overview");
    render(<CommercialWorkbench {...next} />);
    await userEvent.click(await screen.findByTestId("start-review"));
    expect(await screen.findByTestId("review-progress")).not.toBeNull();
    expect(screen.getByTestId("current-stage").textContent).toContain("문서 읽기");
    expect(screen.getByTestId("eta-range").textContent).toContain("4분");
    expect(next.experienceApi.enqueueReview).toHaveBeenCalledTimes(1);
  });

  it("reuses the same review idempotency key after a lost enqueue response without storing documents", async () => {
    const next = dependencies();
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

    await userEvent.type(textarea, firstQuestion);
    await userEvent.click(screen.getByRole("button", { name: "질문하기" }));
    expect((await screen.findByRole("alert")).textContent).toContain("응답을 확인하지 못했습니다.");
    const pendingStorage = window.sessionStorage.getItem("customs.enhanced.pending-assistant");
    expect(pendingStorage).not.toBeNull();
    expect(pendingStorage).not.toContain(firstQuestion);

    await userEvent.type(textarea, firstQuestion);
    await userEvent.click(screen.getByRole("button", { name: "질문하기" }));
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
      action_trace: [{
        action_id: "action-1",
        cycle: 1,
        tool: "document.reread_span/v1",
        status: "succeeded",
        reason_code: "field_uncertainty",
        input_source_ids: ["field-source-1"],
        observation: "safe-observation",
        started_at: "2026-07-27T00:00:01Z",
        finished_at: "2026-07-27T00:00:02Z",
      }],
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
  });
});
