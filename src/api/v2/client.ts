import { ContractError, decodeJob, decodeLocalUatMetadata } from "../v1/decoders";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import { stableApiErrorMessage, technicalApiErrorDetail } from "../user-facing-errors";
import type {
  AnswerClaimSelections,
  AnswerScopeClassificationAudit,
  AssistantAnswer,
  AssistantAnswerScope,
  AssistantConversation,
  AssistantJob,
  AssistantStageEvent,
  AssistantMessage,
  AssistantMessageCreate,
  AssistantMessageEnqueueResponse,
  CommercialUatMetadata,
  GroundedPresentation,
  GroundedPresentationSection,
  GroundedPresentationStatement,
  PublicStageEvent,
  PublicReviewExperience,
  ReviewJobExperience,
} from "./types";

const API_BASE = "/api/v2";
const REQUEST_TIMEOUT_MS = 30_000;
const ASSISTANT_TIMEOUT_MS = 3 * 60_000;
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

type AccessTokenProvider = () => string | undefined | Promise<string | undefined>;

export interface ReviewResultResourceBinding {
  reviewRunId: string;
  caseId: string;
  orgId: string;
  resultSha256: string;
  effectiveResultDigest: string;
}

export class ExperienceApiError extends Error {
  readonly technicalDetail: string;

  constructor(
    detail: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(stableApiErrorMessage(status, code));
    this.name = "ExperienceApiError";
    this.technicalDetail = technicalApiErrorDetail({
      detail,
      status,
      ...(code ? { code } : {}),
      ...(requestId ? { requestId } : {}),
    });
  }
}

export class ExperienceApiClient {
  private readonly fetcher: typeof fetch;

  constructor(
    fetcher: typeof fetch = globalThis.fetch,
    private readonly accessToken?: AccessTokenProvider,
  ) {
    this.fetcher = fetcher === globalThis.fetch ? fetcher.bind(globalThis) : fetcher;
  }

  getUatMetadata(): Promise<CommercialUatMetadata> {
    return this.request(
      `${API_BASE}/uat/metadata`,
      { method: "GET" },
      decodeCommercialUatMetadata,
    );
  }

  getReviewExperience(binding: ReviewResultResourceBinding): Promise<PublicReviewExperience> {
    return this.request(
      `${API_BASE}/review-runs/${resourceId(binding.reviewRunId)}/experience`,
      { method: "GET" },
      (value) => {
        const envelope = decodePublicReviewExperience(value);
        assertBound(
          envelope.bound_provider_result_sha256,
          binding.resultSha256,
          "Review experience is not bound to the requested result",
        );
        assertBound(
          envelope.bound_effective_result_digest,
          binding.effectiveResultDigest,
          "Review experience is not bound to the current effective result",
        );
        return envelope;
      },
    );
  }

  enqueueReview(
    caseId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<ReviewJobExperience> {
    return this.request(
      `${API_BASE}/cases/${resourceId(caseId)}/reviews`,
      jsonRequest("POST", payload, idempotencyKey),
      (value) => {
        const decoded = decodeReviewJobExperience(value);
        assertBound(decoded.job.case_id, caseId, "Review Job is not bound to the requested Case");
        return decoded;
      },
    );
  }

  getReviewJob(jobId: string, expectedCaseId: string): Promise<ReviewJobExperience> {
    return this.request(
      `${API_BASE}/jobs/${resourceId(jobId)}`,
      { method: "GET" },
      (value) => {
        const decoded = decodeReviewJobExperience(value);
        assertBound(decoded.job.job_id, jobId, "Review Job is not bound to the requested Job");
        assertBound(
          decoded.job.case_id,
          expectedCaseId,
          "Review Job is not bound to the current Case",
        );
        return decoded;
      },
    );
  }

  listConversations(binding: ReviewResultResourceBinding): Promise<AssistantConversation[]> {
    return this.request(
      `${API_BASE}/review-runs/${resourceId(binding.reviewRunId)}/assistant/conversations`,
      { method: "GET" },
      (value) => {
        const conversations = decodeArrayPayload(
          value,
          decodeConversation,
          "assistant conversations",
        );
        for (const conversation of conversations) {
          assertBound(
            conversation.review_run_id,
            binding.reviewRunId,
            "Assistant conversation is not bound to the requested Run",
          );
          assertConversationBinding(conversation, binding);
        }
        return conversations;
      },
    );
  }

  createConversation(
    binding: ReviewResultResourceBinding,
    idempotencyKey: string,
  ): Promise<AssistantConversation> {
    return this.request(
      `${API_BASE}/review-runs/${resourceId(binding.reviewRunId)}/assistant/conversations`,
      jsonRequest("POST", { bound_result_sha256: binding.resultSha256 }, idempotencyKey),
      (value) => {
        const conversation = decodeConversation(value);
        assertBound(
          conversation.review_run_id,
          binding.reviewRunId,
          "Assistant conversation is not bound to the requested Run",
        );
        assertBound(
          conversation.bound_result_sha256,
          binding.resultSha256,
          "Assistant conversation is not bound to the requested result",
        );
        assertConversationBinding(conversation, binding);
        return conversation;
      },
    );
  }

  listMessages(conversation: AssistantConversation): Promise<AssistantMessage[]> {
    return this.request(
      `${API_BASE}/assistant/conversations/${resourceId(conversation.conversation_id)}/messages`,
      { method: "GET" },
      (value) => {
        const messages = decodeArrayPayload(
          value,
          decodeAssistantMessage,
          "assistant messages",
        );
        for (const message of messages) {
          assertBound(
            message.conversation_id,
            conversation.conversation_id,
            "Assistant message is not bound to the requested conversation",
          );
          assertMessageBinding(message, conversation);
        }
        return messages;
      },
    );
  }

  sendMessage(
    conversation: AssistantConversation,
    payload: AssistantMessageCreate,
    idempotencyKey: string,
  ): Promise<AssistantMessageEnqueueResponse> {
    return this.request(
      `${API_BASE}/assistant/conversations/${resourceId(conversation.conversation_id)}/messages`,
      jsonRequest("POST", payload, idempotencyKey),
      (value) => {
        const decoded = decodeAssistantMessageEnqueueResponse(value);
        assertAssistantEnqueueBinding(decoded, conversation, payload);
        return decoded;
      },
      ASSISTANT_TIMEOUT_MS,
    );
  }

  getAssistantJob(jobId: string, conversation: AssistantConversation): Promise<AssistantJob> {
    return this.request(
      `${API_BASE}/assistant/jobs/${resourceId(jobId)}`,
      { method: "GET" },
      (value) => {
        const job = decodeAssistantJob(value);
        assertBound(
          job.assistant_job_id,
          jobId,
          "Assistant Job is not bound to the requested Job",
        );
        assertBound(
          job.conversation_id,
          conversation.conversation_id,
          "Assistant Job is not bound to the requested conversation",
        );
        assertBound(job.review_run_id, conversation.review_run_id, "Assistant Job Run differs");
        assertBound(job.case_id, conversation.case_id, "Assistant Job Case differs");
        return job;
      },
    );
  }

  listAssistantJobs(conversation: AssistantConversation): Promise<AssistantJob[]> {
    return this.request(
      `${API_BASE}/assistant/conversations/${resourceId(conversation.conversation_id)}/jobs`,
      { method: "GET" },
      (value) => {
        const jobs = decodeArrayPayload(value, decodeAssistantJob, "assistant jobs");
        for (const job of jobs) {
          assertBound(
            job.conversation_id,
            conversation.conversation_id,
            "Assistant Job is not bound to the requested conversation",
          );
          assertBound(job.review_run_id, conversation.review_run_id, "Assistant Job Run differs");
          assertBound(job.case_id, conversation.case_id, "Assistant Job Case differs");
        }
        return jobs;
      },
    );
  }

  async streamReviewEvents(
    jobId: string,
    onEvent: (event: PublicStageEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    await this.streamEvents(
      `${API_BASE}/jobs/${resourceId(jobId)}/events/stream`,
      (event) => {
        const decoded = decodePublicStageEvent(event);
        if (decoded.job_id !== jobId) {
          throw new ContractError("Review stage event is not bound to the requested Job");
        }
        onEvent(decoded);
      },
      signal,
    );
  }

  async streamAssistantEvents(
    jobId: string,
    onEvent: (event: AssistantStageEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    await this.streamEvents(
      `${API_BASE}/assistant/jobs/${resourceId(jobId)}/events/stream`,
      (event) => {
        const decoded = decodeAssistantStageEvent(event);
        if (decoded.assistant_job_id !== jobId) {
          throw new ContractError("Assistant stage event is not bound to the requested Job");
        }
        onEvent(decoded);
      },
      signal,
    );
  }

  private async streamEvents(
    url: string,
    onEvent: (event: unknown) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const token = await this.accessToken?.();
    const response = await this.fetcher(url, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "same-origin",
      redirect: "error",
      signal,
    });
    if (!response.ok || !response.body) {
      throw new ExperienceApiError(
        "event stream connection failed",
        response.status || 503,
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/event-stream")) {
      throw new ContractError("Review event stream must be text/event-stream");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let lastSequence = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      if (buffer.length > MAX_RESPONSE_BYTES) throw new ContractError("Review event stream exceeded the safe size");
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim()).join("\n");
        if (!data) continue;
        const value = JSON.parse(data) as unknown;
        const raw = record(value, "stage event");
        const sequence = integer(raw.sequence, "stage event.sequence");
        if (sequence <= lastSequence) throw new ContractError("Review stage events are out of order");
        lastSequence = sequence;
        onEvent(value);
      }
    }
  }

  private async request<T>(
    url: string,
    init: RequestInit,
    decoder: (value: unknown) => T,
    timeoutMs = REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const token = await this.accessToken?.();
      const headers = new Headers(init.headers);
      headers.set("Accept", "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await this.fetcher(url, {
        ...init,
        headers,
        credentials: "same-origin",
        redirect: "error",
        signal: controller.signal,
      });
      const text = await limitedText(response);
      const value = text ? JSON.parse(text) as unknown : null;
      if (!response.ok) {
        const detail = isRecord(value) && typeof value.detail === "string"
          ? value.detail
          : "request failed without a safe problem detail";
        const code = isRecord(value) && typeof value.code === "string"
          ? value.code
          : undefined;
        const requestId = isRecord(value) && typeof value.request_id === "string"
          ? value.request_id
          : undefined;
        throw new ExperienceApiError(detail, response.status, code, requestId);
      }
      return decoder(value);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function decodeCommercialUatMetadata(value: unknown): CommercialUatMetadata {
  const raw = record(value, "commercial UAT metadata");
  const enhanced = boolean(
    raw.enhanced_agent_experience,
    "commercial UAT metadata.enhanced_agent_experience",
  );
  const adaptive = boolean(raw.uat_adaptive_active, "commercial UAT metadata.uat_adaptive_active");
  const experienceVersion = enumValue(
    raw.agent_experience_api_version,
    ["disabled", "3.0"],
    "commercial UAT metadata.agent_experience_api_version",
  );
  const assistantVersion = enumValue(
    raw.assistant_api_version,
    ["disabled", "2.0"],
    "commercial UAT metadata.assistant_api_version",
  );
  const streaming = boolean(
    raw.actual_stage_streaming,
    "commercial UAT metadata.actual_stage_streaming",
  );
  if (
    enhanced !== (experienceVersion === "3.0")
    || enhanced !== (assistantVersion === "2.0")
    || enhanced !== streaming
    || (adaptive && !enhanced)
  ) {
    throw new ContractError("commercial UAT metadata capability flags are inconsistent");
  }
  const base = { ...raw };
  delete base.enhanced_agent_experience;
  delete base.uat_adaptive_active;
  delete base.agent_experience_api_version;
  delete base.assistant_api_version;
  delete base.actual_stage_streaming;
  return {
    ...decodeLocalUatMetadata(base),
    enhanced_agent_experience: enhanced,
    uat_adaptive_active: adaptive,
    agent_experience_api_version: experienceVersion,
    assistant_api_version: assistantVersion,
    actual_stage_streaming: streaming,
  };
}

function jsonRequest(method: "POST", payload: unknown, idempotencyKey: string): RequestInit {
  if (!/^[\w.-]{8,160}$/.test(idempotencyKey)) throw new Error("Invalid idempotency key");
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  };
}

function assertBound(actual: string, expected: string, message: string): void {
  if (actual !== expected) throw new ContractError(message);
}

function assertAssistantEnqueueBinding(
  decoded: AssistantMessageEnqueueResponse,
  conversation: AssistantConversation,
  payload: AssistantMessageCreate,
): void {
  const { job, user_message: message } = decoded;
  assertBound(
    job.conversation_id,
    conversation.conversation_id,
    "Assistant Job is not bound to the requested conversation",
  );
  assertBound(
    message.conversation_id,
    conversation.conversation_id,
    "Assistant message is not bound to the requested conversation",
  );
  assertBound(job.review_run_id, message.review_run_id, "Assistant Job and message Run differ");
  assertBound(job.case_id, message.case_id, "Assistant Job and message Case differ");
  assertMessageBinding(message, conversation);
  assertBound(
    message.bound_result_sha256,
    payload.bound_result_sha256,
    "Assistant message is not bound to the requested result",
  );
  assertBound(message.content, payload.question, "Assistant message does not match the submitted question");
  if (message.role !== "user") {
    throw new ContractError("Assistant enqueue response did not return the submitted user message");
  }
  if ((message.parent_message_id ?? undefined) !== payload.parent_message_id) {
    throw new ContractError("Assistant message is not bound to the submitted parent message");
  }
}

function assertConversationBinding(
  conversation: AssistantConversation,
  binding: ReviewResultResourceBinding,
): void {
  assertBound(conversation.case_id, binding.caseId, "Assistant conversation Case differs");
  assertBound(conversation.org_id, binding.orgId, "Assistant conversation organization differs");
  assertBound(
    conversation.review_run_id,
    binding.reviewRunId,
    "Assistant conversation Run differs",
  );
  assertBound(
    conversation.bound_result_sha256,
    binding.resultSha256,
    "Assistant conversation result differs",
  );
  assertBound(
    conversation.bound_effective_result_digest,
    binding.effectiveResultDigest,
    "Assistant conversation effective result differs",
  );
}

function assertMessageBinding(
  message: AssistantMessage,
  conversation: AssistantConversation,
): void {
  assertBound(
    message.conversation_id,
    conversation.conversation_id,
    "Assistant message conversation differs",
  );
  assertBound(message.review_run_id, conversation.review_run_id, "Assistant message Run differs");
  assertBound(message.case_id, conversation.case_id, "Assistant message Case differs");
  assertBound(message.org_id, conversation.org_id, "Assistant message organization differs");
  assertBound(
    message.bound_result_sha256,
    conversation.bound_result_sha256,
    "Assistant message result differs",
  );
}

async function limitedText(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_RESPONSE_BYTES) throw new ContractError("Backend response exceeded the safe size");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
    throw new ContractError("Backend response exceeded the safe size");
  }
  return text;
}

function decodeReviewJobExperience(value: unknown): ReviewJobExperience {
  const raw = record(value, "review job");
  const jobRaw = record(raw.job ?? value, "review job.job");
  const job = decodeJob(jobRaw);
  const elapsed = nonNegativeNumber(jobRaw.elapsed_seconds ?? raw.elapsed_seconds ?? 0, "review job.elapsed_seconds");
  const etaRaw = record(jobRaw.eta ?? raw.eta ?? {
    source: "validated_default",
    sample_size: 0,
    range_min_seconds: 240,
    range_max_seconds: 420,
  }, "review job.eta");
  return {
    job,
    elapsed_seconds: elapsed,
    eta: {
      source: enumValue(etaRaw.source, ["observed", "validated_default"], "review job.eta.source"),
      sample_count: integer(etaRaw.sample_size ?? etaRaw.sample_count, "review job.eta.sample_size"),
      lower_seconds: nonNegativeNumber(etaRaw.range_min_seconds ?? etaRaw.lower_seconds, "review job.eta.range_min_seconds"),
      upper_seconds: nonNegativeNumber(etaRaw.range_max_seconds ?? etaRaw.upper_seconds, "review job.eta.range_max_seconds"),
    },
    latest_stage: (jobRaw.latest_stage ?? raw.latest_stage) === null || (jobRaw.latest_stage ?? raw.latest_stage) === undefined
      ? null
      : decodeStageCode(jobRaw.latest_stage ?? raw.latest_stage),
  };
}

function decodePublicReviewExperience(value: unknown): PublicReviewExperience {
  const raw = record(value, "review experience");
  assertExactKeys(
    raw,
    [
      "schema_version",
      "bound_provider_result_sha256",
      "bound_effective_result_digest",
      "user_presentation",
      "capability_attestation",
      "user_action_events",
      "agent_envelope_sha256",
      "public_experience_sha256",
    ],
    "review experience",
  );
  const schemaVersion = exactString(raw.schema_version, "1.0", "review experience.schema_version");
  const presentation = decodePresentation(raw.user_presentation);
  const capability = record(raw.capability_attestation, "review experience.capability_attestation");
  const actionEvents = array(raw.user_action_events, "review experience.user_action_events").map((item, index) => {
    const event = record(item, `user action event ${index}`);
    return {
      schema_version: exactString(event.schema_version, "1.0", "user action event.schema_version"),
      event_id: string(event.event_id, "user action event.event_id"),
      action_code: string(event.action_code, "user action event.action_code"),
      title: string(event.title, "user action event.title"),
      description: boundedText(event.description, "user action event.description", 2_000),
      status: enumValue(
        event.status,
        ["completed", "needs_attention", "deferred"],
        "user action event.status",
      ),
      source_reference_ids: stringArray(
        event.source_reference_ids,
        "user action event.source_reference_ids",
      ),
    };
  });
  const publicProjection = {
    schema_version: schemaVersion,
    bound_provider_result_sha256: digest(
      raw.bound_provider_result_sha256,
      "review experience.bound_provider_result_sha256",
    ),
    bound_effective_result_digest: digest(
      raw.bound_effective_result_digest,
      "review experience.bound_effective_result_digest",
    ),
    user_presentation: presentation,
    capability_attestation: {
      schema_version: exactString(capability.schema_version, "1.0", "capability.schema_version"),
      profile_id: string(capability.profile_id, "capability.profile_id"),
      environment: exactString(capability.environment, "local_uat", "capability.environment"),
      evidence_profile: exactString(
        capability.evidence_profile,
        "preserved-3law-v3-scenario-eval",
        "capability.evidence_profile",
      ),
      loopback_only: exactBoolean(capability.loopback_only, true, "capability.loopback_only"),
      issued_at: string(capability.issued_at, "capability.issued_at"),
      expires_at: string(capability.expires_at, "capability.expires_at"),
      agent_commit: commitDigest(capability.agent_commit, "capability.agent_commit"),
      agent_code_snapshot_sha256: digest(
        capability.agent_code_snapshot_sha256,
        "capability.agent_code_snapshot_sha256",
      ),
      model_id: string(capability.model_id, "capability.model_id"),
      prompt_bundle_sha256: digest(capability.prompt_bundle_sha256, "capability.prompt_bundle_sha256"),
      schema_bundle_sha256: digest(capability.schema_bundle_sha256, "capability.schema_bundle_sha256"),
      tool_registry_id: string(capability.tool_registry_id, "capability.tool_registry_id"),
      tool_registry_sha256: digest(capability.tool_registry_sha256, "capability.tool_registry_sha256"),
      evidence_runtime_v3_sha256: digest(
        capability.evidence_runtime_v3_sha256,
        "capability.evidence_runtime_v3_sha256",
      ),
      max_cycles: exactNumber(capability.max_cycles, 2, "capability.max_cycles"),
      max_tool_calls: exactNumber(capability.max_tool_calls, 6, "capability.max_tool_calls"),
      max_rereads_per_field: exactNumber(
        capability.max_rereads_per_field,
        1,
        "capability.max_rereads_per_field",
      ),
      adaptive_active: boolean(capability.adaptive_active, "capability.adaptive_active"),
      auto_completion_enabled: exactBoolean(
        capability.auto_completion_enabled,
        false,
        "capability.auto_completion_enabled",
      ),
      capability_sha256: digest(capability.capability_sha256, "capability.capability_sha256"),
    },
    user_action_events: actionEvents,
    agent_envelope_sha256: digest(
      raw.agent_envelope_sha256,
      "review experience.agent_envelope_sha256",
    ),
  };
  const publicExperienceSha256 = digest(
    raw.public_experience_sha256,
    "review experience.public_experience_sha256",
  );
  if (canonicalJsonSha256(publicProjection) !== publicExperienceSha256) {
    throw new ContractError("Review experience content digest is invalid");
  }
  return {
    ...publicProjection,
    public_experience_sha256: publicExperienceSha256,
  };
}

function decodePresentation(value: unknown): GroundedPresentation {
  const raw = record(value, "presentation");
  const sections = array(raw.sections, "presentation.sections").map(decodePresentationSection);
  const expectedCodes = [
    "conclusion", "process", "document_comparison", "issues_and_causes",
    "regulatory_meaning", "business_impact", "next_actions", "scope_and_limits",
  ];
  if (sections.map((section) => section.section_code).join("|") !== expectedCodes.join("|")) {
    throw new ContractError("Presentation sections are incomplete or out of order");
  }
  return {
    schema_version: exactString(raw.schema_version, "1.0", "presentation.schema_version"),
    headline: boundedText(raw.headline, "presentation.headline", 300),
    sections,
    generation_audit: decodeGenerationAudit(raw.generation_audit, "presentation.generation_audit"),
    verification_audit: decodeVerificationAudit(
      raw.verification_audit,
      "presentation.verification_audit",
    ),
    presentation_sha256: digest(raw.presentation_sha256, "presentation.presentation_sha256"),
  };
}

function decodePresentationSection(value: unknown, index: number): GroundedPresentationSection {
  const raw = record(value, `presentation section ${index}`);
  return {
    section_code: enumValue(raw.section_code, [
      "conclusion", "process", "document_comparison", "issues_and_causes",
      "regulatory_meaning", "business_impact", "next_actions", "scope_and_limits",
    ], "presentation section.section_code"),
    title: boundedText(raw.title, "presentation section.title", 120),
    statements: array(raw.statements, "presentation section.statements")
      .map((item, statementIndex) => decodePresentationStatement(item, statementIndex)),
  };
}

function decodePresentationStatement(value: unknown, index: number): GroundedPresentationStatement {
  const raw = record(value, `presentation statement ${index}`);
  return {
    statement_id: string(raw.statement_id, "presentation statement.statement_id"),
    role: enumValue(raw.role, [
      "conclusion", "observation", "reason", "evidence", "impact", "action", "limitation",
    ], "presentation statement.role"),
    text: boundedText(raw.text, "presentation statement.text", 4_000),
    source_claim_ids: stringArray(raw.source_claim_ids, "presentation statement.source_claim_ids"),
    citation_references: array(raw.citation_references, "presentation statement.citation_references")
      .map((item) => decodeCitationReference(item, "presentation citation")),
    material: boolean(raw.material, "presentation statement.material"),
  };
}

function decodeConversation(value: unknown): AssistantConversation {
  const raw = record(value, "assistant conversation");
  return {
    conversation_id: string(raw.conversation_id, "assistant conversation.conversation_id"),
    org_id: string(raw.org_id, "assistant conversation.org_id"),
    case_id: string(raw.case_id, "assistant conversation.case_id"),
    review_run_id: string(raw.review_run_id, "assistant conversation.review_run_id"),
    bound_result_sha256: digest(raw.bound_result_sha256, "assistant conversation.bound_result_sha256"),
    bound_effective_result_digest: digest(
      raw.bound_effective_result_digest,
      "assistant conversation.bound_effective_result_digest",
    ),
    created_by: string(raw.created_by, "assistant conversation.created_by"),
    created_at: string(raw.created_at, "assistant conversation.created_at"),
    updated_at: string(raw.updated_at, "assistant conversation.updated_at"),
  };
}

function decodeAssistantMessage(value: unknown): AssistantMessage {
  const raw = record(value, "assistant message");
  const role = enumValue(raw.role, ["user", "assistant"], "assistant message.role");
  return {
    message_id: string(raw.message_id, "assistant message.message_id"),
    conversation_id: string(raw.conversation_id, "assistant message.conversation_id"),
    review_run_id: string(raw.review_run_id, "assistant message.review_run_id"),
    case_id: string(raw.case_id, "assistant message.case_id"),
    org_id: string(raw.org_id, "assistant message.org_id"),
    parent_message_id: nullableString(raw.parent_message_id, "assistant message.parent_message_id"),
    role,
    content: boundedText(raw.content, "assistant message.content", 8_000),
    answer: role === "assistant" ? decodeAssistantAnswer(raw.structured_answer) : null,
    bound_result_sha256: digest(raw.bound_result_sha256, "assistant message.bound_result_sha256"),
    created_by: string(raw.created_by, "assistant message.created_by"),
    created_at: string(raw.created_at, "assistant message.created_at"),
  };
}

function decodeAssistantAnswer(value: unknown): AssistantAnswer {
  const raw = record(value, "assistant answer");
  const generation = record(raw.generation_audit, "assistant answer.generation_audit");
  const verification = record(raw.verification_audit, "assistant answer.verification_audit");
  const answerScope = enumValue(raw.answer_scope, [
    "case_grounded", "evidence_grounded", "general_customs_guidance",
    "clarification_needed", "insufficient_evidence", "out_of_scope",
  ], "assistant answer.answer_scope");
  const status = enumValue(raw.status, [
    "answered", "clarification_needed", "insufficient_evidence", "out_of_scope",
  ], "assistant answer.status");
  const expectedStatus = {
    case_grounded: "answered",
    evidence_grounded: "answered",
    general_customs_guidance: "answered",
    clarification_needed: "clarification_needed",
    insufficient_evidence: "insufficient_evidence",
    out_of_scope: "out_of_scope",
  } satisfies Record<AssistantAnswerScope, AssistantAnswer["status"]>;
  if (status !== expectedStatus[answerScope]) {
    throw new ContractError("assistant answer: status does not match its classified scope");
  }
  const generationAudit = decodeGenerationAudit(generation, "assistant generation");
  if (
    generationAudit.scope_classification === null
    || generationAudit.scope_classification.classified_scope !== answerScope
  ) {
    throw new ContractError(
      "assistant answer: exact scope-classification audit is missing or inconsistent",
    );
  }
  const citations = array(raw.citations, "assistant answer.citations")
    .map((item) => decodeCitationReference(item, "assistant answer.citation"));
  if (
    (answerScope === "case_grounded" || answerScope === "evidence_grounded")
    && citations.length === 0
  ) {
    throw new ContractError("assistant answer: grounded answers require citations");
  }
  if (
    (answerScope === "clarification_needed" || answerScope === "out_of_scope")
    && citations.length > 0
  ) {
    throw new ContractError("assistant answer: this answer scope cannot claim citations");
  }
  const usedContextMessageIds = uniqueStringArray(
    raw.used_context_message_ids,
    "assistant answer.used_context_message_ids",
    8,
  );
  return {
    schema_version: exactString(raw.schema_version, "2.0", "assistant answer.schema_version"),
    request_sha256: digest(raw.request_sha256, "assistant answer.request_sha256"),
    answer_scope: answerScope,
    status,
    direct_answer: boundedText(raw.direct_answer, "assistant answer.direct_answer", 5_000),
    claim_selections: decodeAnswerClaimSelections(raw.claim_selections),
    explanation: textArray(raw.explanation, "assistant answer.explanation"),
    evidence_meaning: textArray(raw.evidence_meaning, "assistant answer.evidence_meaning"),
    impact: textArray(raw.impact, "assistant answer.impact"),
    next_steps: textArray(raw.next_steps, "assistant answer.next_steps"),
    limitations: textArray(raw.limitations, "assistant answer.limitations"),
    citations,
    suggested_questions: textArray(raw.suggested_questions, "assistant answer.suggested_questions", 3),
    used_context_message_ids: usedContextMessageIds,
    generation_audit: generationAudit,
    verification_audit: decodeVerificationAudit(verification, "assistant verification"),
    answer_sha256: digest(raw.answer_sha256, "assistant answer.answer_sha256"),
  };
}

function decodeAnswerClaimSelections(value: unknown): AnswerClaimSelections {
  const raw = record(value, "assistant answer.claim_selections");
  assertExactKeys(
    raw,
    ["direct_answer", "explanation", "evidence_meaning", "impact", "next_steps"],
    "assistant answer.claim_selections",
  );
  return {
    direct_answer: claimIdArray(raw.direct_answer, "assistant answer.claim_selections.direct_answer", 1),
    explanation: claimIdArray(raw.explanation, "assistant answer.claim_selections.explanation", 40),
    evidence_meaning: claimIdArray(
      raw.evidence_meaning,
      "assistant answer.claim_selections.evidence_meaning",
      40,
    ),
    impact: claimIdArray(raw.impact, "assistant answer.claim_selections.impact", 40),
    next_steps: claimIdArray(raw.next_steps, "assistant answer.claim_selections.next_steps", 40),
  };
}

function decodeAssistantJob(value: unknown): AssistantJob {
  const raw = record(value, "assistant job");
  return {
    assistant_job_id: string(raw.assistant_job_id, "assistant job.assistant_job_id"),
    conversation_id: string(raw.conversation_id, "assistant job.conversation_id"),
    review_run_id: string(raw.review_run_id, "assistant job.review_run_id"),
    case_id: string(raw.case_id, "assistant job.case_id"),
    request_binding_sha256: digest(
      raw.request_binding_sha256,
      "assistant job.request_binding_sha256",
    ),
    state: enumValue(raw.state, [
      "queued", "running", "succeeded", "failed", "delivery_uncertain",
      "response_received_rejected", "response_persistence_uncertain",
    ], "assistant job.state"),
    events: array(raw.events, "assistant job.events").map(decodeAssistantStageEvent),
    answer_message_id: nullableString(raw.answer_message_id, "assistant job.answer_message_id"),
    created_at: string(raw.created_at, "assistant job.created_at"),
    updated_at: string(raw.updated_at, "assistant job.updated_at"),
    error_code: nullableString(raw.error_code, "assistant job.error_code"),
  };
}

function decodeAssistantMessageEnqueueResponse(value: unknown): AssistantMessageEnqueueResponse {
  const raw = record(value, "assistant message enqueue response");
  return {
    job: decodeAssistantJob(raw.job),
    user_message: decodeAssistantMessage(raw.user_message),
    idempotency_reused: boolean(raw.idempotency_reused, "assistant message enqueue response.idempotency_reused"),
  };
}

export function decodePublicStageEvent(value: unknown): PublicStageEvent {
  const raw = record(value, "stage event");
  const detail = record(raw.detail ?? {}, "stage event.detail");
  const safeCountsRaw = record(detail.safe_counts ?? {}, "stage event.detail.safe_counts");
  const safeCounts: Record<string, number> = {};
  for (const [key, count] of Object.entries(safeCountsRaw)) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) throw new ContractError("Unsafe stage count name");
    safeCounts[key] = nonNegativeNumber(count, `stage event.safe_counts.${key}`);
  }
  return {
    event_id: string(raw.event_id, "stage event.event_id"),
    job_id: string(raw.job_id, "stage event.job_id"),
    sequence: integer(raw.sequence, "stage event.sequence"),
    stage_code: decodeStageCode(raw.stage),
    state: enumValue(raw.state, ["started", "progress", "completed", "skipped", "failed"], "stage event.state"),
    occurred_at: string(raw.occurred_at, "stage event.occurred_at"),
    duration_ms: detail.duration_ms === null || detail.duration_ms === undefined
      ? null
      : nonNegativeNumber(detail.duration_ms, "stage event.detail.duration_ms"),
    safe_counts: safeCounts,
    message_key: string(raw.message_code, "stage event.message_code"),
  };
}

export function decodeAssistantStageEvent(value: unknown): AssistantStageEvent {
  const raw = record(value, "assistant stage event");
  const safeCountsRaw = record(raw.safe_counts ?? {}, "assistant stage event.safe_counts");
  const safeCounts: Record<string, number> = {};
  for (const [key, count] of Object.entries(safeCountsRaw)) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) throw new ContractError("Unsafe assistant stage count name");
    safeCounts[key] = nonNegativeNumber(count, `assistant stage event.safe_counts.${key}`);
  }
  return {
    event_id: string(raw.event_id, "assistant stage event.event_id"),
    assistant_job_id: string(raw.assistant_job_id, "assistant stage event.assistant_job_id"),
    sequence: integer(raw.sequence, "assistant stage event.sequence"),
    stage_code: enumValue(raw.stage_code, [
      "queued", "request_validation", "conversation_binding", "answer_planning",
      "answer_composition", "grounding_verification", "result_validation",
      "persistence", "completed", "failed",
    ], "assistant stage event.stage_code"),
    state: enumValue(raw.state, ["started", "completed", "skipped", "failed"], "assistant stage event.state"),
    occurred_at: string(raw.occurred_at, "assistant stage event.occurred_at"),
    duration_ms: raw.duration_ms === null || raw.duration_ms === undefined
      ? null
      : nonNegativeNumber(raw.duration_ms, "assistant stage event.duration_ms"),
    safe_counts: safeCounts,
    message_key: string(raw.message_key, "assistant stage event.message_key"),
  };
}

function decodeStageCode(value: unknown): PublicStageEvent["stage_code"] {
  return enumValue(value, [
    "queued", "input_validation", "agent_analysis",
    "request_validation", "document_analysis", "normalization", "document_pairing",
    "cross_validation", "adaptive_investigation", "evidence_retrieval",
    "compliance_review", "report_composition", "grounding_verification",
    "result_validation", "persistence", "completed", "failed",
  ], "stage event.stage_code");
}

function decodeCitationReference(
  value: unknown,
  context: string,
): {
  kind: "field_source" | "issue" | "finding" | "evidence" | "outcome";
  reference_id: string;
} {
  const raw = record(value, context);
  return {
    kind: enumValue(
      raw.kind,
      ["field_source", "issue", "finding", "evidence", "outcome"],
      `${context}.kind`,
    ),
    reference_id: string(raw.reference_id, `${context}.reference_id`),
  };
}

function decodeGenerationAudit(value: unknown, context: string): {
  mode: "claude" | "deterministic_fallback";
  task_id: string;
  model_id: string | null;
  prompt_sha256: string;
  output_schema_sha256: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  attempt_count: number;
  scope_classification: AnswerScopeClassificationAudit | null;
} {
  const raw = record(value, context);
  const mode = enumValue(raw.mode, ["claude", "deterministic_fallback"], `${context}.mode`);
  const modelId = nullableString(raw.model_id, `${context}.model_id`);
  const inputTokens = integer(raw.input_tokens, `${context}.input_tokens`);
  const outputTokens = integer(raw.output_tokens, `${context}.output_tokens`);
  if (mode === "claude" && (modelId === null || inputTokens === 0 || outputTokens === 0)) {
    throw new ContractError(`${context}: Claude generation audit is incomplete`);
  }
  if (mode === "deterministic_fallback" && (modelId !== null || inputTokens !== 0 || outputTokens !== 0)) {
    throw new ContractError(`${context}: deterministic fallback cannot claim model usage`);
  }
  return {
    mode,
    task_id: string(raw.task_id, `${context}.task_id`),
    model_id: modelId,
    prompt_sha256: digest(raw.prompt_sha256, `${context}.prompt_sha256`),
    output_schema_sha256: digest(raw.output_schema_sha256, `${context}.output_schema_sha256`),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: nonNegativeNumber(raw.latency_ms, `${context}.latency_ms`),
    attempt_count: boundedInteger(raw.attempt_count, 1, 2, `${context}.attempt_count`),
    scope_classification: raw.scope_classification === null
      || raw.scope_classification === undefined
      ? null
      : decodeScopeClassificationAudit(
        raw.scope_classification,
        `${context}.scope_classification`,
      ),
  };
}

function decodeScopeClassificationAudit(
  value: unknown,
  context: string,
): AnswerScopeClassificationAudit {
  const raw = record(value, context);
  const mode = enumValue(
    raw.mode,
    ["claude", "deterministic_guard", "fallback"],
    `${context}.mode`,
  );
  const classifiedScope = enumValue(raw.classified_scope, [
    "case_grounded", "evidence_grounded", "general_customs_guidance",
    "clarification_needed", "insufficient_evidence", "out_of_scope",
  ], `${context}.classified_scope`);
  const modelId = nullableString(raw.model_id, `${context}.model_id`);
  const inputTokens = integer(raw.input_tokens, `${context}.input_tokens`);
  const outputTokens = integer(raw.output_tokens, `${context}.output_tokens`);
  if (mode === "claude" && (modelId === null || inputTokens === 0 || outputTokens === 0)) {
    throw new ContractError(`${context}: Claude classification audit is incomplete`);
  }
  if (mode !== "claude" && (modelId !== null || inputTokens !== 0 || outputTokens !== 0)) {
    throw new ContractError(`${context}: non-model classification cannot claim model usage`);
  }
  if (mode === "deterministic_guard" && classifiedScope !== "out_of_scope") {
    throw new ContractError(`${context}: deterministic guard is reserved for out-of-scope input`);
  }
  if (mode === "fallback" && classifiedScope !== "clarification_needed") {
    throw new ContractError(`${context}: classifier fallback must request clarification`);
  }
  const allowedGuidanceTopics = [
    "invoice", "packing_list", "bill_of_lading", "certificate_of_origin", "hsk",
    "hs_hsk_comparison", "customs_review", "import_declaration", "customs_valuation",
    "duties_and_taxes", "free_trade_agreement", "import_requirements",
    "inspection_and_supplement", "document_correction", "customs_broker",
  ] as const;
  const guidanceTopics = array(raw.guidance_topics, `${context}.guidance_topics`).map(
    (topic, index) => enumValue(
      topic,
      allowedGuidanceTopics,
      `${context}.guidance_topics[${index}]`,
    ),
  );
  if (guidanceTopics.length > 3 || guidanceTopics.length !== new Set(guidanceTopics).size) {
    throw new ContractError(`${context}: guidance topics are duplicated or exceed the limit`);
  }
  if (
    (classifiedScope === "general_customs_guidance") !== (guidanceTopics.length > 0)
  ) {
    throw new ContractError(`${context}: guidance topics do not match the classified scope`);
  }
  return {
    mode,
    task_id: exactString(
      raw.task_id,
      "customs_case_scope_classifier",
      `${context}.task_id`,
    ),
    classified_scope: classifiedScope,
    guidance_topics: guidanceTopics,
    model_id: modelId,
    prompt_sha256: digest(raw.prompt_sha256, `${context}.prompt_sha256`),
    output_schema_sha256: digest(
      raw.output_schema_sha256,
      `${context}.output_schema_sha256`,
    ),
    semantic_output_schema_sha256: digest(
      raw.semantic_output_schema_sha256,
      `${context}.semantic_output_schema_sha256`,
    ),
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: boundedInteger(raw.latency_ms, 0, 300_000, `${context}.latency_ms`),
    reason_code: boundedText(raw.reason_code, `${context}.reason_code`, 128),
  };
}

function decodeVerificationAudit(value: unknown, context: string): {
  status: "passed" | "fallback";
  deterministic_checks_passed: boolean;
  entailment_verifier: "claude" | "not_run";
  verifier_model_id: string | null;
  verifier_context_sha256: string | null;
  verifier_prompt_sha256: string;
  verifier_schema_sha256: string;
  verified_content_sha256: string;
  checked_statement_count: number;
  reason_codes: string[];
} {
  const raw = record(value, context);
  const status = enumValue(raw.status, ["passed", "fallback"], `${context}.status`);
  const deterministic = boolean(
    raw.deterministic_checks_passed,
    `${context}.deterministic_checks_passed`,
  );
  const verifier = enumValue(raw.entailment_verifier, ["claude", "not_run"], `${context}.entailment_verifier`);
  const verifierModel = nullableString(raw.verifier_model_id, `${context}.verifier_model_id`);
  const verifierContext = nullableDigest(
    raw.verifier_context_sha256,
    `${context}.verifier_context_sha256`,
  );
  const reasons = stringArray(raw.reason_codes, `${context}.reason_codes`);
  if (
    (verifier === "claude")
    !== (verifierModel !== null && verifierContext !== null)
  ) {
    throw new ContractError(`${context}: entailment verifier identity is incomplete`);
  }
  if (verifier !== "claude" && verifierContext !== null) {
    throw new ContractError(`${context}: non-model verifier cannot claim a context identity`);
  }
  if (status === "passed" && (!deterministic || reasons.length > 0)) {
    throw new ContractError(`${context}: passed verification contains blockers`);
  }
  if (status === "fallback" && reasons.length === 0) {
    throw new ContractError(`${context}: fallback verification requires a reason`);
  }
  return {
    status,
    deterministic_checks_passed: deterministic,
    entailment_verifier: verifier,
    verifier_model_id: verifierModel,
    verifier_context_sha256: verifierContext,
    verifier_prompt_sha256: digest(raw.verifier_prompt_sha256, `${context}.verifier_prompt_sha256`),
    verifier_schema_sha256: digest(raw.verifier_schema_sha256, `${context}.verifier_schema_sha256`),
    verified_content_sha256: digest(
      raw.verified_content_sha256,
      `${context}.verified_content_sha256`,
    ),
    checked_statement_count: boundedInteger(
      raw.checked_statement_count,
      0,
      1_000,
      `${context}.checked_statement_count`,
    ),
    reason_codes: reasons,
  };
}

function decodeArrayPayload<T>(
  value: unknown,
  decoder: (item: unknown) => T,
  context: string,
): T[] {
  const source = Array.isArray(value) ? value : record(value, context).items;
  return array(source, context).map(decoder);
}

function resourceId(value: string): string {
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(value)) throw new Error("Invalid resource identifier");
  return encodeURIComponent(value);
}

function record(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ContractError(`${context}: object expected`);
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: string[],
  context: string,
): void {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (
    actual.length !== required.length
    || actual.some((key, index) => key !== required[index])
  ) {
    throw new ContractError(`${context}: unexpected or missing fields`);
  }
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
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new ContractError("review experience contains a non-canonical value");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function array(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) throw new ContractError(`${context}: array expected`);
  if (value.length > 1_000) throw new ContractError(`${context}: too many items`);
  return value;
}

function string(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) throw new ContractError(`${context}: non-empty string expected`);
  return value;
}

function boundedText(value: unknown, context: string, maximum: number): string {
  const result = string(value, context);
  if (result.length > maximum) throw new ContractError(`${context}: text exceeds ${maximum} characters`);
  return result;
}

function nullableString(value: unknown, context: string): string | null {
  if (value === null || value === undefined) return null;
  return string(value, context);
}

function boolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") throw new ContractError(`${context}: boolean expected`);
  return value;
}

function exactBoolean<T extends boolean>(value: unknown, expected: T, context: string): T {
  if (value !== expected) throw new ContractError(`${context}: expected ${expected}`);
  return expected;
}

function exactNumber<T extends number>(value: unknown, expected: T, context: string): T {
  if (value !== expected) throw new ContractError(`${context}: expected ${expected}`);
  return expected;
}

function nonNegativeNumber(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ContractError(`${context}: non-negative number expected`);
  }
  return value;
}

function integer(value: unknown, context: string): number {
  const result = nonNegativeNumber(value, context);
  if (!Number.isInteger(result)) throw new ContractError(`${context}: integer expected`);
  return result;
}

function boundedInteger(value: unknown, minimum: number, maximum: number, context: string): number {
  const result = integer(value, context);
  if (result < minimum || result > maximum) {
    throw new ContractError(`${context}: integer outside the allowed range`);
  }
  return result;
}

function digest(value: unknown, context: string): string {
  const result = string(value, context);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new ContractError(`${context}: SHA-256 expected`);
  return result;
}

function nullableDigest(value: unknown, context: string): string | null {
  if (value === null || value === undefined) return null;
  return digest(value, context);
}

function commitDigest(value: unknown, context: string): string {
  const result = string(value, context);
  if (!/^[a-f0-9]{40}$/.test(result)) throw new ContractError(`${context}: Git commit SHA expected`);
  return result;
}

function stringArray(value: unknown, context: string): string[] {
  return array(value, context).map((item, index) => string(item, `${context}[${index}]`));
}

function uniqueStringArray(value: unknown, context: string, maximum: number): string[] {
  const result = stringArray(value, context);
  if (result.length > maximum || result.length !== new Set(result).size) {
    throw new ContractError(`${context}: values are duplicated or exceed the limit`);
  }
  return result;
}

function claimIdArray(value: unknown, context: string, maximum: number): string[] {
  const result = uniqueStringArray(value, context, maximum);
  if (result.some((item) => !/^experience_claim_[a-f0-9]{64}$/.test(item))) {
    throw new ContractError(`${context}: canonical experience claim ID expected`);
  }
  return result;
}

function textArray(value: unknown, context: string, maximum = 20): string[] {
  const values = array(value, context);
  if (values.length > maximum) throw new ContractError(`${context}: too many text blocks`);
  return values.map((item, index) => boundedText(item, `${context}[${index}]`, 4_000));
}

function exactString<T extends string>(value: unknown, expected: T, context: string): T {
  if (value !== expected) throw new ContractError(`${context}: expected ${expected}`);
  return expected;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], context: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ContractError(`${context}: unsupported value`);
  }
  return value as T;
}
