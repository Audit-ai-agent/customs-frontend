import type { JobRecord, LocalUatMetadata, ReviewRun } from "../v1/types";

export interface CommercialUatMetadata extends LocalUatMetadata {
  enhanced_agent_experience: boolean;
  uat_adaptive_active: boolean;
  agent_experience_api_version: "disabled" | "3.0";
  assistant_api_version: "disabled" | "2.0";
  actual_stage_streaming: boolean;
}

export type PresentationStatementRole =
  | "conclusion"
  | "observation"
  | "reason"
  | "evidence"
  | "impact"
  | "action"
  | "limitation";

export type CitationKind = "field_source" | "issue" | "finding" | "evidence" | "outcome";

export interface CitationReference {
  reference_id: string;
  kind: CitationKind;
}

export interface GroundedPresentationStatement {
  statement_id: string;
  role: PresentationStatementRole;
  text: string;
  source_claim_ids: string[];
  citation_references: CitationReference[];
  material: boolean;
}

export interface GroundedPresentationSection {
  section_code:
    | "conclusion"
    | "process"
    | "document_comparison"
    | "issues_and_causes"
    | "regulatory_meaning"
    | "business_impact"
    | "next_actions"
    | "scope_and_limits";
  title: string;
  statements: GroundedPresentationStatement[];
}

export type GeneralCustomsGuidanceTopic =
  | "invoice"
  | "packing_list"
  | "bill_of_lading"
  | "certificate_of_origin"
  | "hsk"
  | "hs_hsk_comparison"
  | "customs_review"
  | "import_declaration"
  | "customs_valuation"
  | "duties_and_taxes"
  | "free_trade_agreement"
  | "import_requirements"
  | "inspection_and_supplement"
  | "document_correction"
  | "customs_broker";

export interface AnswerScopeClassificationAudit {
  mode: "claude" | "deterministic_guard" | "fallback";
  task_id: "customs_case_scope_classifier";
  classified_scope: AssistantAnswerScope;
  guidance_topics: GeneralCustomsGuidanceTopic[];
  model_id: string | null;
  prompt_sha256: string;
  output_schema_sha256: string;
  semantic_output_schema_sha256: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  reason_code: string;
}

export interface ExperienceGenerationAudit {
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
}

export interface ExperienceVerificationAudit {
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
}

export interface GroundedPresentation {
  schema_version: "1.0";
  headline: string;
  sections: GroundedPresentationSection[];
  generation_audit: ExperienceGenerationAudit;
  verification_audit: ExperienceVerificationAudit;
  presentation_sha256: string;
}

export interface AgentUatCapabilityAttestation {
  schema_version: "1.0";
  profile_id: string;
  environment: "local_uat";
  evidence_profile: "preserved-3law-v3-scenario-eval";
  loopback_only: true;
  issued_at: string;
  expires_at: string;
  agent_commit: string;
  agent_code_snapshot_sha256: string;
  model_id: string;
  prompt_bundle_sha256: string;
  schema_bundle_sha256: string;
  tool_registry_id: string;
  tool_registry_sha256: string;
  evidence_runtime_v3_sha256: string;
  max_cycles: 2;
  max_tool_calls: 6;
  max_rereads_per_field: 1;
  adaptive_active: boolean;
  auto_completion_enabled: false;
  capability_sha256: string;
}

export interface UserActionEvent {
  schema_version: "1.0";
  event_id: string;
  action_code: string;
  title: string;
  description: string;
  status: "completed" | "needs_attention" | "deferred";
  source_reference_ids: string[];
}

/** Browser-safe Backend projection. The canonical Agent result is never exposed. */
export interface PublicReviewExperience {
  schema_version: "1.0";
  bound_provider_result_sha256: string;
  bound_effective_result_digest: string;
  user_presentation: GroundedPresentation;
  capability_attestation: AgentUatCapabilityAttestation;
  user_action_events: UserActionEvent[];
  agent_envelope_sha256: string;
  public_experience_sha256: string;
}

export type AssistantAnswerScope =
  | "case_grounded"
  | "evidence_grounded"
  | "general_customs_guidance"
  | "clarification_needed"
  | "insufficient_evidence"
  | "out_of_scope";

export interface AnswerClaimSelections {
  direct_answer: string[];
  explanation: string[];
  evidence_meaning: string[];
  impact: string[];
  next_steps: string[];
}

export interface AssistantAnswer {
  schema_version: "2.0";
  request_sha256: string;
  answer_scope: AssistantAnswerScope;
  status: "answered" | "clarification_needed" | "insufficient_evidence" | "out_of_scope";
  direct_answer: string;
  claim_selections: AnswerClaimSelections;
  explanation: string[];
  evidence_meaning: string[];
  impact: string[];
  next_steps: string[];
  limitations: string[];
  citations: CitationReference[];
  suggested_questions: string[];
  used_context_message_ids: string[];
  generation_audit: ExperienceGenerationAudit;
  verification_audit: ExperienceVerificationAudit;
  answer_sha256: string;
}

export interface AssistantMessage {
  message_id: string;
  conversation_id: string;
  review_run_id: string;
  case_id: string;
  org_id: string;
  parent_message_id: string | null;
  role: "user" | "assistant";
  content: string;
  answer: AssistantAnswer | null;
  bound_result_sha256: string;
  created_by: string;
  created_at: string;
}

export interface AssistantConversation {
  conversation_id: string;
  org_id: string;
  case_id: string;
  review_run_id: string;
  bound_result_sha256: string;
  bound_effective_result_digest: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AssistantJob {
  assistant_job_id: string;
  conversation_id: string;
  review_run_id: string;
  case_id: string;
  request_binding_sha256: string;
  state:
    | "queued"
    | "running"
    | "succeeded"
    | "failed"
    | "delivery_uncertain"
    | "response_received_rejected"
    | "response_persistence_uncertain";
  events: AssistantStageEvent[];
  answer_message_id: string | null;
  created_at: string;
  updated_at: string;
  error_code: string | null;
}

export interface AssistantMessageEnqueueResponse {
  job: AssistantJob;
  user_message: AssistantMessage;
  idempotency_reused: boolean;
}

export interface PublicStageEvent {
  event_id: string;
  job_id: string;
  sequence: number;
  stage_code:
    | "queued"
    | "input_validation"
    | "agent_analysis"
    | "request_validation"
    | "document_analysis"
    | "normalization"
    | "document_pairing"
    | "cross_validation"
    | "adaptive_investigation"
    | "evidence_retrieval"
    | "compliance_review"
    | "report_composition"
    | "grounding_verification"
    | "result_validation"
    | "persistence"
    | "completed"
    | "failed";
  state: "started" | "progress" | "completed" | "skipped" | "failed";
  occurred_at: string;
  duration_ms: number | null;
  safe_counts: Record<string, number>;
  message_key: string;
}

export interface AssistantStageEvent {
  event_id: string;
  assistant_job_id: string;
  sequence: number;
  stage_code:
    | "queued"
    | "request_validation"
    | "conversation_binding"
    | "answer_planning"
    | "answer_composition"
    | "grounding_verification"
    | "persistence"
    | "completed"
    | "failed";
  state: "started" | "completed" | "skipped" | "failed";
  occurred_at: string;
  duration_ms: number | null;
  safe_counts: Record<string, number>;
  message_key: string;
}

export interface ReviewJobExperience {
  job: JobRecord;
  elapsed_seconds: number;
  eta: {
    source: "observed" | "validated_default";
    sample_count: number;
    lower_seconds: number;
    upper_seconds: number;
  };
  latest_stage: PublicStageEvent["stage_code"] | null;
}

export interface ReviewExperienceView {
  run: ReviewRun;
  envelope: PublicReviewExperience;
}

export interface AssistantMessageCreate {
  question: string;
  parent_message_id?: string;
  bound_result_sha256: string;
}
