import { describe, expect, it, vi } from "vitest";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import {
  ExperienceApiClient,
  decodeAssistantStageEvent,
  decodePublicStageEvent,
} from "../src/api/v2/client";
import type { AssistantConversation } from "../src/api/v2/types";

const digest = (character: string): string => character.repeat(64);
const commit = "a".repeat(40);
const timestamp = "2026-07-27T00:00:00Z";
const resultBinding = {
  reviewRunId: "run-1",
  caseId: "case-1",
  orgId: "org-1",
  resultSha256: digest("5"),
  effectiveResultDigest: digest("e"),
};

function generationAudit(withScopeClassification = false): Record<string, unknown> {
  return {
    mode: "claude",
    task_id: "customs_presentation",
    model_id: "claude-test",
    prompt_sha256: digest("1"),
    output_schema_sha256: digest("2"),
    input_tokens: 100,
    output_tokens: 80,
    latency_ms: 1_200,
    attempt_count: 1,
    scope_classification: withScopeClassification
      ? {
        mode: "claude",
        task_id: "customs_case_scope_classifier",
        classified_scope: "evidence_grounded",
        guidance_topics: [],
        model_id: "claude-test",
        prompt_sha256: digest("a"),
        output_schema_sha256: digest("b"),
        semantic_output_schema_sha256: digest("c"),
        input_tokens: 20,
        output_tokens: 5,
        latency_ms: 120,
        reason_code: "evidence_question",
      }
      : null,
  };
}

function verificationAudit(): Record<string, unknown> {
  return {
    status: "passed",
    deterministic_checks_passed: true,
    entailment_verifier: "claude",
    verifier_model_id: "claude-test",
    verifier_context_sha256: digest("d"),
    verifier_prompt_sha256: digest("3"),
    verifier_schema_sha256: digest("4"),
    verified_content_sha256: digest("0"),
    checked_statement_count: 8,
    reason_codes: [],
  };
}

function envelope(): Record<string, unknown> {
  const sectionCodes = [
    "conclusion",
    "process",
    "document_comparison",
    "issues_and_causes",
    "regulatory_meaning",
    "business_impact",
    "next_actions",
    "scope_and_limits",
  ];
  return sealPublicExperience({
    schema_version: "1.0",
    bound_provider_result_sha256: digest("5"),
    bound_effective_result_digest: digest("e"),
    user_presentation: {
      schema_version: "1.0",
      headline: "담당자가 확인할 수 있도록 심사 결과를 정리했습니다.",
      sections: sectionCodes.map((sectionCode, index) => ({
        section_code: sectionCode,
        title: `구역 ${index + 1}`,
        statements: [{
          statement_id: `statement-${index}`,
          role: sectionCode === "scope_and_limits" ? "limitation" : "observation",
          text: `${index + 1}번째 설명입니다.`,
          source_claim_ids: [`claim-${index}`],
          citation_references: sectionCode === "scope_and_limits"
            ? []
            : [{ kind: "outcome", reference_id: "outcome-1" }],
          material: sectionCode !== "scope_and_limits",
        }],
      })),
      generation_audit: generationAudit(),
      verification_audit: verificationAudit(),
      presentation_sha256: digest("6"),
    },
    capability_attestation: {
      schema_version: "1.0",
      profile_id: "local-uat-active",
      environment: "local_uat",
      evidence_profile: "preserved-3law-v3-scenario-eval",
      loopback_only: true,
      issued_at: timestamp,
      expires_at: "2026-07-28T00:00:00Z",
      agent_commit: commit,
      agent_code_snapshot_sha256: digest("7"),
      model_id: "claude-test",
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
      capability_sha256: digest("c"),
    },
    user_action_events: [{
      schema_version: "1.0",
      event_id: "user-action-1",
      action_code: "review_result",
      title: "심사 결과 확인",
      description: "문서와 법령 근거를 확인합니다.",
      status: "needs_attention",
      source_reference_ids: ["outcome-1"],
    }],
    agent_envelope_sha256: digest("d"),
  });
}

function sealPublicExperience(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...value,
    public_experience_sha256: canonicalJsonSha256(value),
  };
}

function canonicalJsonSha256(value: unknown): string {
  return [...nobleSha256(new TextEncoder().encode(canonicalJson(value)))]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalJson(value: unknown): string {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value))
  ) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const item = value as Record<string, unknown>;
    return `{${Object.keys(item)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(item[key])}`)
      .join(",")}}`;
  }
  throw new Error("non-canonical test value");
}

function reviewJob(status = "queued"): Record<string, unknown> {
  return {
    job_id: "job-1",
    case_id: "case-1",
    kind: "review",
    parent_run_id: null,
    status,
    review_run_id: "run-1",
    error_code: null,
    attempt_count: status === "queued" ? 0 : 1,
    agent_call_state: status === "succeeded" ? "completed" : "not_started",
    created_by: "reviewer-1",
    created_at: timestamp,
    updated_at: timestamp,
    elapsed_seconds: 12,
    eta: {
      source: "validated_default",
      sample_size: 0,
      p50_seconds: null,
      p90_seconds: null,
      range_min_seconds: 240,
      range_max_seconds: 420,
    },
  };
}

function conversation(): Record<string, unknown> {
  return {
    conversation_id: "conversation-1",
    review_run_id: "run-1",
    case_id: "case-1",
    org_id: "org-1",
    bound_result_sha256: digest("5"),
    bound_effective_result_digest: digest("e"),
    created_by: "reviewer-1",
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function assistantAnswer(): Record<string, unknown> {
  return {
    schema_version: "2.0",
    request_sha256: digest("0"),
    answer_scope: "evidence_grounded",
    status: "answered",
    direct_answer: "현재 검색 범위에서 관련 법령 근거를 확인했습니다.",
    claim_selections: {
      direct_answer: [`experience_claim_${digest("1")}`],
      explanation: [`experience_claim_${digest("2")}`],
      evidence_meaning: [`experience_claim_${digest("3")}`],
      impact: [`experience_claim_${digest("4")}`],
      next_steps: [`experience_claim_${digest("5")}`],
    },
    explanation: ["현재 심사 품목과 검색 조건을 기준으로 확인했습니다."],
    evidence_meaning: ["검색된 근거는 담당자가 적용 여부를 검토할 출발점입니다."],
    impact: ["담당자 검토 전에는 최종 판단으로 사용할 수 없습니다."],
    next_steps: ["근거 조문과 문서 원문을 함께 확인합니다."],
    limitations: ["현재 3종 법령 범위에 한정됩니다."],
    citations: [{ kind: "evidence", reference_id: "evidence-1" }],
    suggested_questions: ["담당자가 다음으로 할 일은 무엇입니까?"],
    used_context_message_ids: ["assistant_message_user"],
    generation_audit: generationAudit(true),
    verification_audit: verificationAudit(),
    answer_sha256: digest("f"),
  };
}

function assistantMessage(
  role: "user" | "assistant",
  messageId: string,
): Record<string, unknown> {
  const answer = role === "assistant" ? assistantAnswer() : null;
  return {
    message_id: messageId,
    conversation_id: "conversation-1",
    review_run_id: "run-1",
    case_id: "case-1",
    org_id: "org-1",
    parent_message_id: role === "assistant" ? "assistant_message_user" : null,
    role,
    content: role === "assistant"
      ? (answer as { direct_answer: string }).direct_answer
      : "법령 근거는 어떤 의미입니까?",
    structured_answer: answer,
    bound_result_sha256: digest("5"),
    created_by: role === "assistant" ? "system:assistant-worker" : "reviewer-1",
    created_at: timestamp,
  };
}

function assistantJob(state = "queued"): Record<string, unknown> {
  return {
    assistant_job_id: "assistant-job-1",
    conversation_id: "conversation-1",
    review_run_id: "run-1",
    case_id: "case-1",
    request_binding_sha256: digest("e"),
    state,
    events: [],
    answer_message_id: state === "succeeded" ? "assistant_message_answer" : null,
    error_code: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function commercialMetadata(): Record<string, unknown> {
  return {
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
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ExperienceApiClient v2 trusted browser boundary", () => {
  it("decodes review, experience, conversation and assistant contracts from Backend-only paths", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith("/api/v2/cases/case-1/reviews")) {
        return jsonResponse({ job: reviewJob(), idempotency_reused: false }, 202);
      }
      if (url.endsWith("/api/v2/uat/metadata")) return jsonResponse(commercialMetadata());
      if (url.endsWith("/api/v2/jobs/job-1")) return jsonResponse(reviewJob("succeeded"));
      if (url.endsWith("/api/v2/review-runs/run-1/experience")) return jsonResponse(envelope());
      if (url.endsWith("/api/v2/review-runs/run-1/assistant/conversations")) {
        return init?.method === "POST" ? jsonResponse(conversation(), 201) : jsonResponse({ items: [conversation()] });
      }
      if (url.endsWith("/api/v2/assistant/conversations/conversation-1/jobs")) {
        return jsonResponse({ items: [assistantJob("succeeded")] });
      }
      if (url.endsWith("/api/v2/assistant/conversations/conversation-1/messages")) {
        if (init?.method === "POST") {
          return jsonResponse({
            job: assistantJob(),
            user_message: assistantMessage("user", "assistant_message_user"),
            idempotency_reused: false,
          }, 202);
        }
        return jsonResponse({
          items: [
            assistantMessage("user", "assistant_message_user"),
            assistantMessage("assistant", "assistant_message_answer"),
          ],
        });
      }
      if (url.endsWith("/api/v2/assistant/jobs/assistant-job-1")) {
        return jsonResponse(assistantJob("succeeded"));
      }
      return jsonResponse({ detail: "not found" }, 404);
    }) as unknown as typeof fetch;
    const client = new ExperienceApiClient(fetcher, async () => "access-token");

    expect((await client.getUatMetadata()).assistant_api_version).toBe("2.0");
    const enqueued = await client.enqueueReview("case-1", { trade_type: "import" }, "review-key-001");
    expect(enqueued.eta).toMatchObject({ lower_seconds: 240, upper_seconds: 420 });
    expect((await client.getReviewJob("job-1", "case-1")).job.status).toBe("succeeded");
    expect((await client.getReviewExperience(resultBinding)).user_presentation.sections).toHaveLength(8);
    expect(await client.listConversations(resultBinding)).toHaveLength(1);
    expect((await client.createConversation(resultBinding, "conversation-key-001")).case_id).toBe("case-1");
    const boundConversation = await client.createConversation(resultBinding, "conversation-key-002");
    expect(await client.listMessages(boundConversation)).toHaveLength(2);
    const sent = await client.sendMessage(boundConversation, {
      question: "법령 근거는 어떤 의미입니까?",
      bound_result_sha256: digest("5"),
    }, "assistant-key-001");
    expect(sent.user_message.bound_result_sha256).toBe(digest("5"));
    expect((await client.getAssistantJob("assistant-job-1", boundConversation)).state).toBe("succeeded");
    expect(await client.listAssistantJobs(boundConversation)).toHaveLength(1);
    expect(requests.every(({ url }) => url.startsWith("/api/v2/"))).toBe(true);
    expect(new Headers(requests[0]?.init?.headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("normalizes the persisted Backend review event projection without exposing Agent raw events", () => {
    expect(decodePublicStageEvent({
      event_id: "event-1",
      job_id: "job-1",
      sequence: 3,
      stage: "evidence_retrieval",
      state: "completed",
      message_code: "review.evidence_retrieval_completed",
      occurred_at: timestamp,
      detail: {
        operation_id: "agent-operation-1",
        duration_ms: 120,
        safe_counts: { evidence_count: 3 },
        agent_event_sha256: digest("1"),
      },
    })).toEqual({
      event_id: "event-1",
      job_id: "job-1",
      sequence: 3,
      stage_code: "evidence_retrieval",
      state: "completed",
      occurred_at: timestamp,
      duration_ms: 120,
      safe_counts: { evidence_count: 3 },
      message_key: "review.evidence_retrieval_completed",
    });
  });

  it("decodes the Backend assistant event and rejects unsafe count names", () => {
    expect(decodeAssistantStageEvent({
      event_id: "assistant-event-1",
      assistant_job_id: "assistant-job-1",
      sequence: 1,
      stage_code: "answer_composition",
      state: "started",
      occurred_at: timestamp,
      duration_ms: 0,
      safe_counts: { claim_count: 2 },
      message_key: "assistant.answer_composition",
    }).stage_code).toBe("answer_composition");

    expect(decodeAssistantStageEvent({
      event_id: "assistant-event-validation",
      assistant_job_id: "assistant-job-1",
      sequence: 2,
      stage_code: "result_validation",
      state: "completed",
      occurred_at: timestamp,
      duration_ms: 5,
      safe_counts: { citation_count: 2 },
      message_key: "assistant.result_validation",
    }).stage_code).toBe("result_validation");

    expect(() => decodeAssistantStageEvent({
      event_id: "assistant-event-2",
      assistant_job_id: "assistant-job-1",
      sequence: 3,
      stage_code: "completed",
      state: "completed",
      occurred_at: timestamp,
      duration_ms: 1,
      safe_counts: { "unsafe.key": 1 },
      message_key: "assistant.completed",
    })).toThrow("Unsafe assistant stage count name");
  });

  it("rejects invalid resource identifiers and unsupported presentation section order", async () => {
    const client = new ExperienceApiClient(
      vi.fn(async () => {
        const invalid = envelope();
        const presentation = invalid.user_presentation as { sections: unknown[] };
        presentation.sections = [...presentation.sections].reverse();
        return jsonResponse(invalid);
      }) as unknown as typeof fetch,
    );
    expect(() => client.getReviewExperience({ ...resultBinding, reviewRunId: "run/escape" })).toThrow("Invalid resource identifier");
    await expect(client.getReviewExperience(resultBinding)).rejects.toThrow(
      "Presentation sections are incomplete or out of order",
    );
  });

  it("rejects cross-resource experience, Job, conversation and message responses", async () => {
    const currentExperience = envelope();
    const wrongExperiencePayload = { ...currentExperience };
    delete wrongExperiencePayload.public_experience_sha256;
    const wrongExperience = sealPublicExperience({
      ...wrongExperiencePayload,
      bound_provider_result_sha256: digest("4"),
    });
    await expect(new ExperienceApiClient(
      vi.fn(async () => jsonResponse(wrongExperience)) as unknown as typeof fetch,
    ).getReviewExperience(resultBinding)).rejects.toThrow("not bound");

    await expect(new ExperienceApiClient(
      vi.fn(async () => jsonResponse({ ...reviewJob(), job_id: "job-other" })) as unknown as typeof fetch,
    ).getReviewJob("job-1", "case-1")).rejects.toThrow("not bound");

    const wrongCaseJobFetcher = vi.fn(
      async () => jsonResponse({ ...reviewJob(), case_id: "case-other" }),
    ) as unknown as typeof fetch;
    await expect(new ExperienceApiClient(wrongCaseJobFetcher)
      .getReviewJob("job-1", "case-1")).rejects.toThrow("current Case");

    await expect(new ExperienceApiClient(
      vi.fn(async () => jsonResponse({
        items: [{ ...conversation(), review_run_id: "run-other" }],
      })) as unknown as typeof fetch,
    ).listConversations(resultBinding)).rejects.toThrow("not bound");

    await expect(new ExperienceApiClient(
      vi.fn(async () => jsonResponse({
        items: [{ ...assistantMessage("user", "assistant_message_user"), conversation_id: "conversation-other" }],
      })) as unknown as typeof fetch,
    ).listMessages(conversation() as unknown as AssistantConversation)).rejects.toThrow("not bound");

    await expect(new ExperienceApiClient(
      vi.fn(async () => jsonResponse({ ...assistantJob(), assistant_job_id: "assistant-job-other" })) as unknown as typeof fetch,
    ).getAssistantJob(
      "assistant-job-1",
      conversation() as unknown as AssistantConversation,
    )).rejects.toThrow("not bound");

    await expect(new ExperienceApiClient(
      vi.fn(async () => jsonResponse({
        items: [{ ...assistantJob(), conversation_id: "conversation-other" }],
      })) as unknown as typeof fetch,
    ).listAssistantJobs(
      conversation() as unknown as AssistantConversation,
    )).rejects.toThrow("not bound");
  });

  it("rejects an assistant enqueue response that is not bound to the submitted question", async () => {
    const client = new ExperienceApiClient(
      vi.fn(async () => jsonResponse({
        job: assistantJob(),
        user_message: {
          ...assistantMessage("user", "assistant_message_user"),
          content: "다른 질문입니다.",
        },
        idempotency_reused: false,
      }, 202)) as unknown as typeof fetch,
    );
    await expect(client.sendMessage(conversation() as unknown as AssistantConversation, {
      question: "법령 근거는 어떤 의미입니까?",
      bound_result_sha256: digest("5"),
    }, "assistant-key-001")).rejects.toThrow("submitted question");
  });

  it("enforces the provider contract that a direct answer selects at most one canonical claim", async () => {
    const invalidAnswer = assistantAnswer();
    (invalidAnswer.claim_selections as { direct_answer: string[] }).direct_answer = [
      `experience_claim_${digest("1")}`,
      `experience_claim_${digest("2")}`,
    ];
    const invalidMessage = {
      ...assistantMessage("assistant", "assistant_message_answer"),
      structured_answer: invalidAnswer,
    };
    const client = new ExperienceApiClient(
      vi.fn(async () => jsonResponse({ items: [invalidMessage] })) as unknown as typeof fetch,
    );
    await expect(client.listMessages(
      conversation() as unknown as AssistantConversation,
    )).rejects.toThrow("exceed the limit");
  });

  it("streams review and assistant progress in sequence and rejects cross-job events", async () => {
    const reviewFrame = {
      event_id: "event-1",
      job_id: "job-1",
      sequence: 1,
      stage: "request_validation",
      state: "completed",
      message_code: "review.request_validation",
      occurred_at: timestamp,
      detail: { duration_ms: 10, safe_counts: {} },
    };
    const assistantFrame = {
      event_id: "assistant-event-1",
      assistant_job_id: "assistant-job-1",
      sequence: 1,
      stage_code: "completed",
      state: "completed",
      occurred_at: timestamp,
      duration_ms: 10,
      safe_counts: {},
      message_key: "assistant.completed",
    };
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const value = String(input).includes("/assistant/") ? assistantFrame : reviewFrame;
      return new Response(`event: stage\ndata: ${JSON.stringify(value)}\n\n`, {
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as unknown as typeof fetch;
    const client = new ExperienceApiClient(fetcher);
    const reviewEvents: unknown[] = [];
    const assistantEvents: unknown[] = [];
    await client.streamReviewEvents("job-1", (event) => reviewEvents.push(event), new AbortController().signal);
    await client.streamAssistantEvents(
      "assistant-job-1",
      (event) => assistantEvents.push(event),
      new AbortController().signal,
    );
    expect(reviewEvents).toHaveLength(1);
    expect(assistantEvents).toHaveLength(1);

    const wrongClient = new ExperienceApiClient(
      vi.fn(async () => new Response(
        `data: ${JSON.stringify({ ...reviewFrame, job_id: "job-2" })}\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      )) as unknown as typeof fetch,
    );
    await expect(wrongClient.streamReviewEvents(
      "job-1",
      () => undefined,
      new AbortController().signal,
    )).rejects.toThrow("not bound");
  });
});
