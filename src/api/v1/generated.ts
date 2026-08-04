export interface paths {
    "/api/v1/auth/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Auth Config */
        get: operations["auth_config_api_v1_auth_config_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Cases Endpoint */
        get: operations["list_cases_endpoint_api_v1_cases_get"];
        put?: never;
        /** Create Case Endpoint */
        post: operations["create_case_endpoint_api_v1_cases_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cases/{case_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Case Endpoint */
        get: operations["get_case_endpoint_api_v1_cases__case_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cases/{case_id}/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Audit Endpoint */
        get: operations["list_audit_endpoint_api_v1_cases__case_id__audit_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cases/{case_id}/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Documents Endpoint */
        get: operations["list_documents_endpoint_api_v1_cases__case_id__documents_get"];
        put?: never;
        /** Add Document Endpoint */
        post: operations["add_document_endpoint_api_v1_cases__case_id__documents_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cases/{case_id}/documents/{document_id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Document Content Endpoint */
        get: operations["get_document_content_endpoint_api_v1_cases__case_id__documents__document_id__content_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cases/{case_id}/review-runs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Runs Endpoint */
        get: operations["list_runs_endpoint_api_v1_cases__case_id__review_runs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cases/{case_id}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Enqueue Review Endpoint */
        post: operations["enqueue_review_endpoint_api_v1_cases__case_id__reviews_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cases/{case_id}/supporting-documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Supporting Documents Endpoint */
        get: operations["list_supporting_documents_endpoint_api_v1_cases__case_id__supporting_documents_get"];
        put?: never;
        /** Add Supporting Document Endpoint */
        post: operations["add_supporting_document_endpoint_api_v1_cases__case_id__supporting_documents_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/cases/{case_id}/supporting-documents/{document_id}/assertions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Assert Supporting Document Endpoint */
        post: operations["assert_supporting_document_endpoint_api_v1_cases__case_id__supporting_documents__document_id__assertions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/correction-proposals/{proposal_id}/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Decide Correction Proposal Endpoint */
        post: operations["decide_correction_proposal_endpoint_api_v1_correction_proposals__proposal_id__decisions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Job Endpoint */
        get: operations["get_job_endpoint_api_v1_jobs__job_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{job_id}/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Job Events Endpoint */
        get: operations["get_job_events_endpoint_api_v1_jobs__job_id__events_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{job_id}/events/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stream Job Events Endpoint */
        get: operations["stream_job_events_endpoint_api_v1_jobs__job_id__events_stream_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{job_id}/reconciliation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reconcile Delivery Uncertain Endpoint */
        post: operations["reconcile_delivery_uncertain_endpoint_api_v1_jobs__job_id__reconciliation_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/review-runs/{review_run_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Run Endpoint */
        get: operations["get_run_endpoint_api_v1_review_runs__review_run_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/review-runs/{review_run_id}/answers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Answer Endpoint */
        post: operations["answer_endpoint_api_v1_review_runs__review_run_id__answers_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/review-runs/{review_run_id}/correction-proposals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Correction Proposals Endpoint */
        get: operations["list_correction_proposals_endpoint_api_v1_review_runs__review_run_id__correction_proposals_get"];
        put?: never;
        /** Create Correction Proposal Endpoint */
        post: operations["create_correction_proposal_endpoint_api_v1_review_runs__review_run_id__correction_proposals_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/review-runs/{review_run_id}/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Decisions Endpoint */
        get: operations["list_decisions_endpoint_api_v1_review_runs__review_run_id__decisions_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/review-runs/{review_run_id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Chat Endpoint */
        get: operations["list_chat_endpoint_api_v1_review_runs__review_run_id__messages_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/review-runs/{review_run_id}/revision-proposals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Revision Proposals Endpoint */
        get: operations["list_revision_proposals_endpoint_api_v1_review_runs__review_run_id__revision_proposals_get"];
        put?: never;
        /** Create Revision Proposal Endpoint */
        post: operations["create_revision_proposal_endpoint_api_v1_review_runs__review_run_id__revision_proposals_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/revision-proposals/{proposal_id}/decisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Decide Revision Proposal Endpoint */
        post: operations["decide_revision_proposal_endpoint_api_v1_revision_proposals__proposal_id__decisions_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Session */
        get: operations["session_api_v1_session_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/uat/metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Uat Metadata */
        get: operations["uat_metadata_api_v1_uat_metadata_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/uat/review-runs/{review_run_id}/evidence-trace": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Uat Evidence Trace Endpoint */
        get: operations["get_uat_evidence_trace_endpoint_api_v1_uat_review_runs__review_run_id__evidence_trace_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/assistant/conversations/{conversation_id}/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Assistant Jobs Endpoint */
        get: operations["list_assistant_jobs_endpoint_api_v2_assistant_conversations__conversation_id__jobs_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/assistant/conversations/{conversation_id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Assistant Messages Endpoint */
        get: operations["list_assistant_messages_endpoint_api_v2_assistant_conversations__conversation_id__messages_get"];
        put?: never;
        /** Enqueue Assistant Message Endpoint */
        post: operations["enqueue_assistant_message_endpoint_api_v2_assistant_conversations__conversation_id__messages_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/assistant/jobs/{assistant_job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Assistant Job Endpoint */
        get: operations["get_assistant_job_endpoint_api_v2_assistant_jobs__assistant_job_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/assistant/jobs/{assistant_job_id}/events/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stream Assistant Job Events Endpoint */
        get: operations["stream_assistant_job_events_endpoint_api_v2_assistant_jobs__assistant_job_id__events_stream_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/cases/{case_id}/reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Enqueue Experience Review Endpoint */
        post: operations["enqueue_experience_review_endpoint_api_v2_cases__case_id__reviews_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Experience Job Endpoint */
        get: operations["get_experience_job_endpoint_api_v2_jobs__job_id__get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/jobs/{job_id}/events/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Stream Experience Job Events Endpoint */
        get: operations["stream_experience_job_events_endpoint_api_v2_jobs__job_id__events_stream_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/review-runs/{review_run_id}/assistant/conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List Assistant Conversations Endpoint */
        get: operations["list_assistant_conversations_endpoint_api_v2_review_runs__review_run_id__assistant_conversations_get"];
        put?: never;
        /** Create Assistant Conversation Endpoint */
        post: operations["create_assistant_conversation_endpoint_api_v2_review_runs__review_run_id__assistant_conversations_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/review-runs/{review_run_id}/experience": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get Review Experience Endpoint */
        get: operations["get_review_experience_endpoint_api_v2_review_runs__review_run_id__experience_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v2/uat/metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Uat Metadata V2 */
        get: operations["uat_metadata_v2_api_v2_uat_metadata_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * AgentCallState
         * @enum {string}
         */
        AgentCallState: "not_started" | "started" | "completed" | "delivery_uncertain" | "delivery_reconciled" | "response_received_rejected" | "response_persistence_uncertain";
        /** AgentUatCapabilityAttestationV1 */
        AgentUatCapabilityAttestationV1: {
            /** Adaptive Active */
            adaptive_active: boolean;
            /** Agent Code Snapshot Sha256 */
            agent_code_snapshot_sha256: string;
            /** Agent Commit */
            agent_commit: string;
            /**
             * Auto Completion Enabled
             * @constant
             */
            auto_completion_enabled: false;
            /** Capability Sha256 */
            capability_sha256: string;
            /**
             * Environment
             * @constant
             */
            environment: "local_uat";
            /**
             * Evidence Profile
             * @constant
             */
            evidence_profile: "preserved-3law-v3-scenario-eval";
            /** Evidence Runtime V3 Sha256 */
            evidence_runtime_v3_sha256: string;
            /**
             * Expires At
             * Format: date-time
             */
            expires_at: string;
            /**
             * Issued At
             * Format: date-time
             */
            issued_at: string;
            /**
             * Loopback Only
             * @constant
             */
            loopback_only: true;
            /**
             * Max Cycles
             * @constant
             */
            max_cycles: 2;
            /**
             * Max Rereads Per Field
             * @constant
             */
            max_rereads_per_field: 1;
            /**
             * Max Tool Calls
             * @constant
             */
            max_tool_calls: 6;
            /** Model Id */
            model_id: string;
            /** Profile Id */
            profile_id: string;
            /** Prompt Bundle Sha256 */
            prompt_bundle_sha256: string;
            /** Schema Bundle Sha256 */
            schema_bundle_sha256: string;
            /**
             * Schema Version
             * @default 1.0
             * @constant
             */
            schema_version: "1.0";
            /** Tool Registry Id */
            tool_registry_id: string;
            /** Tool Registry Sha256 */
            tool_registry_sha256: string;
        };
        /**
         * AnswerClaimSelectionsV1
         * @description Canonical claim IDs selected for each user-visible answer area.
         */
        AnswerClaimSelectionsV1: {
            /** Direct Answer */
            direct_answer?: string[];
            /** Evidence Meaning */
            evidence_meaning?: string[];
            /** Explanation */
            explanation?: string[];
            /** Impact */
            impact?: string[];
            /** Next Steps */
            next_steps?: string[];
        };
        /** AnswerScopeClassificationAuditV1 */
        AnswerScopeClassificationAuditV1: {
            /**
             * Classified Scope
             * @enum {string}
             */
            classified_scope: "case_grounded" | "evidence_grounded" | "general_customs_guidance" | "clarification_needed" | "insufficient_evidence" | "out_of_scope";
            /** Guidance Topics */
            guidance_topics?: ("invoice" | "packing_list" | "bill_of_lading" | "certificate_of_origin" | "hsk" | "hs_hsk_comparison" | "customs_review" | "import_declaration" | "customs_valuation" | "duties_and_taxes" | "free_trade_agreement" | "import_requirements" | "inspection_and_supplement" | "document_correction" | "customs_broker")[];
            /**
             * Input Tokens
             * @default 0
             */
            input_tokens: number;
            /**
             * Latency Ms
             * @default 0
             */
            latency_ms: number;
            /**
             * Mode
             * @enum {string}
             */
            mode: "claude" | "deterministic_guard" | "fallback";
            /** Model Id */
            model_id?: string | null;
            /** Output Schema Sha256 */
            output_schema_sha256: string;
            /**
             * Output Tokens
             * @default 0
             */
            output_tokens: number;
            /** Prompt Sha256 */
            prompt_sha256: string;
            /** Reason Code */
            reason_code: string;
            /** Semantic Output Schema Sha256 */
            semantic_output_schema_sha256: string;
            /**
             * Task Id
             * @constant
             */
            task_id: "customs_case_scope_classifier";
        };
        /**
         * Assessment
         * @enum {string}
         */
        Assessment: "no_issue_detected" | "issues_detected" | "indeterminate";
        /** AssistantAnswerV2 */
        AssistantAnswerV2: {
            /**
             * Answer Scope
             * @enum {string}
             */
            answer_scope: "case_grounded" | "evidence_grounded" | "general_customs_guidance" | "clarification_needed" | "insufficient_evidence" | "out_of_scope";
            /** Answer Sha256 */
            answer_sha256: string;
            /** Citations */
            citations?: components["schemas"]["CitationReferenceV1"][];
            claim_selections?: components["schemas"]["AnswerClaimSelectionsV1"];
            /** Direct Answer */
            direct_answer: string;
            /** Evidence Meaning */
            evidence_meaning?: string[];
            /** Explanation */
            explanation?: string[];
            generation_audit: components["schemas"]["ExperienceGenerationAuditV1"];
            /** Impact */
            impact?: string[];
            /** Limitations */
            limitations?: string[];
            /** Next Steps */
            next_steps?: string[];
            /** Request Sha256 */
            request_sha256: string;
            /**
             * Schema Version
             * @default 2.0
             * @constant
             */
            schema_version: "2.0";
            /**
             * Status
             * @enum {string}
             */
            status: "answered" | "clarification_needed" | "insufficient_evidence" | "out_of_scope";
            /** Suggested Questions */
            suggested_questions?: string[];
            /** Used Context Message Ids */
            used_context_message_ids?: string[];
            verification_audit: components["schemas"]["ExperienceVerificationAuditV1"];
        };
        /** AssistantConversationListResponse */
        AssistantConversationListResponse: {
            /** Items */
            items: components["schemas"]["AssistantConversationRecord"][];
        };
        /** AssistantConversationRecord */
        AssistantConversationRecord: {
            /** Bound Effective Result Digest */
            bound_effective_result_digest: string;
            /** Bound Result Sha256 */
            bound_result_sha256: string;
            /** Case Id */
            case_id: string;
            /** Conversation Id */
            conversation_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by: string;
            /** Org Id */
            org_id: string;
            /** Review Run Id */
            review_run_id: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** AssistantJobEnqueueResponse */
        AssistantJobEnqueueResponse: {
            /** Idempotency Reused */
            idempotency_reused: boolean;
            job: components["schemas"]["AssistantJobView"];
            user_message: components["schemas"]["AssistantMessageRecord"];
        };
        /** AssistantJobListResponse */
        AssistantJobListResponse: {
            /** Items */
            items: components["schemas"]["AssistantJobView"][];
        };
        /**
         * AssistantJobState
         * @enum {string}
         */
        AssistantJobState: "queued" | "running" | "succeeded" | "failed" | "delivery_uncertain" | "response_received_rejected" | "response_persistence_uncertain";
        /** AssistantJobView */
        AssistantJobView: {
            /** Answer Message Id */
            answer_message_id?: string | null;
            /** Assistant Job Id */
            assistant_job_id: string;
            /** Case Id */
            case_id: string;
            /** Conversation Id */
            conversation_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Error Code */
            error_code?: string | null;
            /** Events */
            events: components["schemas"]["AssistantStageEvent"][];
            /** Request Binding Sha256 */
            request_binding_sha256: string;
            /** Review Run Id */
            review_run_id: string;
            state: components["schemas"]["AssistantJobState"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** AssistantMessageCreateV2 */
        AssistantMessageCreateV2: {
            /** Bound Result Sha256 */
            bound_result_sha256: string;
            /** Parent Message Id */
            parent_message_id?: string | null;
            /** Question */
            question: string;
        };
        /** AssistantMessageListResponse */
        AssistantMessageListResponse: {
            /** Items */
            items: components["schemas"]["AssistantMessageRecord"][];
        };
        /** AssistantMessageRecord */
        AssistantMessageRecord: {
            /** Bound Result Sha256 */
            bound_result_sha256: string;
            /** Case Id */
            case_id: string;
            /** Content */
            content: string;
            /** Conversation Id */
            conversation_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by: string;
            /** Message Id */
            message_id: string;
            /** Org Id */
            org_id: string;
            /** Parent Message Id */
            parent_message_id?: string | null;
            /** Review Run Id */
            review_run_id: string;
            /**
             * Role
             * @enum {string}
             */
            role: "user" | "assistant";
            structured_answer?: components["schemas"]["AssistantAnswerV2"] | null;
        };
        /** AssistantStageEvent */
        AssistantStageEvent: {
            /** Assistant Job Id */
            assistant_job_id: string;
            /** Duration Ms */
            duration_ms: number;
            /** Event Id */
            event_id: string;
            /** Message Key */
            message_key: string;
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
            /** Safe Counts */
            safe_counts?: {
                [key: string]: number;
            };
            /** Sequence */
            sequence: number;
            /**
             * Stage Code
             * @enum {string}
             */
            stage_code: "queued" | "request_validation" | "conversation_binding" | "answer_planning" | "answer_composition" | "grounding_verification" | "result_validation" | "persistence" | "completed" | "failed";
            /**
             * State
             * @enum {string}
             */
            state: "started" | "completed" | "skipped" | "failed";
        };
        /**
         * AssuranceLevel
         * @enum {string}
         */
        AssuranceLevel: "diagnostic" | "production_candidate" | "production";
        /** AuditListResponse */
        AuditListResponse: {
            /** Items */
            items: components["schemas"]["AuditRecord"][];
        };
        /** AuditRecord */
        AuditRecord: {
            /** Action */
            action: string;
            /** Actor Id */
            actor_id: string;
            /** Audit Id */
            audit_id: string;
            /** Case Id */
            case_id?: string | null;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Detail */
            detail?: {
                [key: string]: unknown;
            };
            /** Org Id */
            org_id: string;
            /** Review Run Id */
            review_run_id?: string | null;
        };
        /** AuthConfigResponse */
        AuthConfigResponse: {
            /** Audience */
            audience: string;
            /** Authorization Endpoint */
            authorization_endpoint: string;
            /** Client Id */
            client_id: string;
            /** End Session Endpoint */
            end_session_endpoint?: string | null;
            /**
             * Flow
             * @default authorization_code_pkce_s256
             */
            flow: string;
            /** Issuer */
            issuer: string;
            /** Token Endpoint */
            token_endpoint: string;
            /**
             * Token Storage
             * @default memory_only
             */
            token_storage: string;
        };
        /** AutoCompletionProfileBinding */
        AutoCompletionProfileBinding: {
            /** Approval Digest */
            approval_digest?: string | null;
            /** Approved Document Types */
            approved_document_types?: ("CI" | "PL" | "BL" | "CO")[];
            /** Approved Required Document Codes */
            approved_required_document_codes?: string[];
            /** Profile Id */
            profile_id?: string | null;
        };
        /** CaseCreate */
        CaseCreate: {
            /** Assigned Reviewer Subjects */
            assigned_reviewer_subjects?: string[];
            /** External Reference */
            external_reference?: string | null;
            /** Metadata */
            metadata?: {
                [key: string]: unknown;
            };
            /** Title */
            title: string;
        };
        /** CaseListResponse */
        CaseListResponse: {
            /** Items */
            items: components["schemas"]["CaseRecord"][];
        };
        /** CaseRecord */
        CaseRecord: {
            /** Assigned Reviewer Subjects */
            assigned_reviewer_subjects?: string[];
            /** Case Id */
            case_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by: string;
            /** Document Manifest Digest */
            document_manifest_digest: string;
            /** External Reference */
            external_reference?: string | null;
            /** Metadata */
            metadata?: {
                [key: string]: unknown;
            };
            /** Org Id */
            org_id: string;
            /** Owner Subject */
            owner_subject: string;
            /**
             * Revision
             * @default 0
             */
            revision: number;
            /** @default open */
            status: components["schemas"]["CaseStatus"];
            /** Title */
            title: string;
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * CaseStatus
         * @enum {string}
         */
        CaseStatus: "open" | "in_review" | "closed";
        /** ChatListResponse */
        ChatListResponse: {
            /** Items */
            items: components["schemas"]["ChatRecord"][];
        };
        /** ChatRecord */
        ChatRecord: {
            /** Answer */
            answer: string;
            /**
             * Answer Status
             * @enum {string}
             */
            answer_status: "answered" | "insufficient_evidence" | "out_of_scope";
            /** Bound Result Digest */
            bound_result_digest: string;
            /** Case Id */
            case_id: string;
            /** Citations */
            citations?: {
                [key: string]: string;
            }[];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by: string;
            /**
             * Generation Mode
             * @enum {string}
             */
            generation_mode: "claude" | "deterministic_fallback";
            /** Idempotency Key */
            idempotency_key: string;
            /** Idempotency Request Digest */
            idempotency_request_digest: string;
            /** Message Id */
            message_id: string;
            model_execution_summary: components["schemas"]["ModelExecutionSummary"];
            /** Org Id */
            org_id: string;
            /** Question */
            question: string;
            /** Review Run Id */
            review_run_id: string;
        };
        /** CitationReferenceV1 */
        CitationReferenceV1: {
            /**
             * Kind
             * @enum {string}
             */
            kind: "field_source" | "issue" | "finding" | "evidence" | "outcome";
            /** Reference Id */
            reference_id: string;
        };
        /** CompletionEligibility */
        CompletionEligibility: {
            /**
             * Eligible
             * @default false
             */
            eligible: boolean;
            /** Profile Id */
            profile_id?: string | null;
            /** Scope */
            scope?: string[];
            /** Unmet Reason Codes */
            unmet_reason_codes?: string[];
        };
        /** ConversationCreateV2 */
        ConversationCreateV2: {
            /** Bound Result Sha256 */
            bound_result_sha256: string;
        };
        /** CorrectionOperation */
        CorrectionOperation: {
            /**
             * Confidence
             * @default 1
             */
            confidence: number;
            /** Document Id */
            document_id: string;
            /** Field Path */
            field_path: string;
            /** New Value */
            new_value: unknown;
            /** Reason */
            reason: string;
        };
        /** CorrectionProposalCreate */
        CorrectionProposalCreate: {
            /** Case Revision */
            case_revision: number;
            /** Corrections */
            corrections: components["schemas"]["CorrectionOperation"][];
            /** Parent Input Manifest Sha256 */
            parent_input_manifest_sha256: string;
            /** Parent Result Digest */
            parent_result_digest: string;
        };
        /** CorrectionProposalDecisionCreate */
        CorrectionProposalDecisionCreate: {
            /** Case Revision */
            case_revision: number;
            /**
             * Decision
             * @enum {string}
             */
            decision: "approve" | "reject";
            /** Parent Result Digest */
            parent_result_digest: string;
            /** Reason */
            reason: string;
        };
        /** CorrectionProposalDecisionResponse */
        CorrectionProposalDecisionResponse: {
            decision: components["schemas"]["HumanDecisionRecord"];
            job?: components["schemas"]["JobView"] | null;
            proposal: components["schemas"]["CorrectionProposalRecord"];
        };
        /** CorrectionProposalListResponse */
        CorrectionProposalListResponse: {
            /** Items */
            items: components["schemas"]["CorrectionProposalRecord"][];
        };
        /** CorrectionProposalRecord */
        CorrectionProposalRecord: {
            /** Actions */
            actions?: components["schemas"]["RevisionAction"][];
            /** Case Id */
            case_id: string;
            /** Case Revision */
            case_revision: number;
            /** Child Job Id */
            child_job_id?: string | null;
            /** Corrections */
            corrections?: components["schemas"]["CorrectionOperation"][];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by: string;
            /** Decided At */
            decided_at?: string | null;
            /** Decided By */
            decided_by?: string | null;
            /** Decision Reason */
            decision_reason?: string | null;
            /** Idempotency Key */
            idempotency_key: string;
            /** Idempotency Request Digest */
            idempotency_request_digest: string;
            /** Org Id */
            org_id: string;
            /** Parent Input Manifest Sha256 */
            parent_input_manifest_sha256: string;
            /** Parent Result Digest */
            parent_result_digest: string;
            /** Proposal Id */
            proposal_id: string;
            /** Review Run Id */
            review_run_id: string;
            /** @default pending */
            status: components["schemas"]["CorrectionProposalStatus"];
        };
        /**
         * CorrectionProposalStatus
         * @enum {string}
         */
        CorrectionProposalStatus: "pending" | "approved" | "rejected";
        /** DecisionListResponse */
        DecisionListResponse: {
            /** Items */
            items: components["schemas"]["HumanDecisionRecord"][];
        };
        /**
         * DeliveryReconciliationCreate
         * @description Human evidence that an uncertain request was not processed by Agent.
         */
        DeliveryReconciliationCreate: {
            /** Evidence Reference Sha256 */
            evidence_reference_sha256: string;
            /** Reason */
            reason: string;
            /**
             * Resolution
             * @constant
             */
            resolution: "confirmed_not_processed";
        };
        /** DocumentListResponse */
        DocumentListResponse: {
            /** Items */
            items: components["schemas"]["DocumentViewResponse"][];
        };
        /** DocumentViewResponse */
        DocumentViewResponse: {
            /** Content Text */
            content_text?: string | null;
            record: components["schemas"]["PublicDocumentRecord"];
        };
        /**
         * ExecutionStatus
         * @enum {string}
         */
        ExecutionStatus: "succeeded" | "partial" | "failed";
        /** ExperienceGenerationAuditV1 */
        ExperienceGenerationAuditV1: {
            /**
             * Attempt Count
             * @default 1
             */
            attempt_count: number;
            /**
             * Input Tokens
             * @default 0
             */
            input_tokens: number;
            /**
             * Latency Ms
             * @default 0
             */
            latency_ms: number;
            /**
             * Mode
             * @enum {string}
             */
            mode: "claude" | "deterministic_fallback";
            /** Model Id */
            model_id?: string | null;
            /** Output Schema Sha256 */
            output_schema_sha256: string;
            /**
             * Output Tokens
             * @default 0
             */
            output_tokens: number;
            /** Prompt Sha256 */
            prompt_sha256: string;
            scope_classification?: components["schemas"]["AnswerScopeClassificationAuditV1"] | null;
            /** Task Id */
            task_id: string;
        };
        /** ExperienceVerificationAuditV1 */
        ExperienceVerificationAuditV1: {
            /** Checked Statement Count */
            checked_statement_count: number;
            /** Deterministic Checks Passed */
            deterministic_checks_passed: boolean;
            /**
             * Entailment Verifier
             * @enum {string}
             */
            entailment_verifier: "claude" | "not_run";
            /** Reason Codes */
            reason_codes?: string[];
            /**
             * Status
             * @enum {string}
             */
            status: "passed" | "fallback";
            /** Verified Content Sha256 */
            verified_content_sha256: string;
            /** Verifier Context Sha256 */
            verifier_context_sha256?: string | null;
            /** Verifier Model Id */
            verifier_model_id?: string | null;
            /** Verifier Prompt Sha256 */
            verifier_prompt_sha256: string;
            /** Verifier Schema Sha256 */
            verifier_schema_sha256: string;
        };
        /** GroundedPresentationV1 */
        GroundedPresentationV1: {
            generation_audit: components["schemas"]["ExperienceGenerationAuditV1"];
            /** Headline */
            headline: string;
            /** Presentation Sha256 */
            presentation_sha256: string;
            /**
             * Schema Version
             * @default 1.0
             * @constant
             */
            schema_version: "1.0";
            /** Sections */
            sections: components["schemas"]["PresentationSection"][];
            verification_audit: components["schemas"]["ExperienceVerificationAuditV1"];
        };
        /** GroundedQuestion */
        GroundedQuestion: {
            /** Bound Result Digest */
            bound_result_digest: string;
            /** Question */
            question: string;
        };
        /** HumanDecisionRecord */
        HumanDecisionRecord: {
            /** Case Id */
            case_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Decided By */
            decided_by: string;
            /**
             * Decision
             * @enum {string}
             */
            decision: "approve" | "reject";
            /** Decision Id */
            decision_id: string;
            /** Idempotency Key */
            idempotency_key?: string | null;
            /** Idempotency Request Digest */
            idempotency_request_digest?: string | null;
            /** Org Id */
            org_id: string;
            /** Proposal Id */
            proposal_id?: string | null;
            /** Reason */
            reason: string;
            /** Review Run Id */
            review_run_id: string;
            /** Target Revision Id */
            target_revision_id?: string | null;
        };
        /** InputDocumentManifestEntry */
        InputDocumentManifestEntry: {
            /** Content Sha256 */
            content_sha256: string;
            /** Document Id */
            document_id: string;
            /**
             * Document Type
             * @enum {string}
             */
            document_type: "CI" | "PL" | "BL" | "CO" | "UNKNOWN";
        };
        /** JobEventsResponse */
        JobEventsResponse: {
            /** Items */
            items: components["schemas"]["StageEvent"][];
        };
        /** JobExperienceResponse */
        JobExperienceResponse: {
            /** Idempotency Reused */
            idempotency_reused: boolean;
            job: components["schemas"]["JobExperienceView"];
        };
        /** JobExperienceView */
        JobExperienceView: {
            /** Agent Call State */
            agent_call_state: string;
            /** Attempt Count */
            attempt_count: number;
            /** Case Id */
            case_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by: string;
            /** Elapsed Seconds */
            elapsed_seconds: number;
            /** Error Code */
            error_code?: string | null;
            eta: components["schemas"]["ReviewEta"];
            /** Job Id */
            job_id: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "review" | "revision";
            /** Parent Run Id */
            parent_run_id?: string | null;
            /** Review Run Id */
            review_run_id: string;
            status: components["schemas"]["JobStatus"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /** JobResponse */
        JobResponse: {
            /** Idempotency Reused */
            idempotency_reused: boolean;
            job: components["schemas"]["JobView"];
        };
        /**
         * JobStatus
         * @enum {string}
         */
        JobStatus: "queued" | "running" | "succeeded" | "failed" | "delivery_uncertain" | "response_received_rejected" | "response_persistence_uncertain";
        /** JobView */
        JobView: {
            agent_call_state: components["schemas"]["AgentCallState"];
            /** Attempt Count */
            attempt_count: number;
            /** Case Id */
            case_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by: string;
            /** Error Code */
            error_code?: string | null;
            /** Job Id */
            job_id: string;
            /**
             * Kind
             * @enum {string}
             */
            kind: "review" | "revision";
            /** Parent Run Id */
            parent_run_id?: string | null;
            /** Review Run Id */
            review_run_id: string;
            status: components["schemas"]["JobStatus"];
            /**
             * Updated At
             * Format: date-time
             */
            updated_at: string;
        };
        /**
         * ModelExecutionSummary
         * @description Bounded, non-sensitive projection of provider model-call audit records.
         *
         *     This deliberately excludes document/request/message IDs, raw content, hashes,
         *     latency detail, credentials, and provider responses.  ``audit_complete`` means
         *     only that the provider-owned audit records are structurally complete and bound
         *     to the runtime identity; it is not a model-quality or Production-release claim.
         */
        ModelExecutionSummary: {
            /** Audit Complete */
            audit_complete: boolean;
            /** Call Count */
            call_count: number;
            /** Input Tokens Total */
            input_tokens_total: number;
            /** Model Id */
            model_id: string | null;
            /** Output Tokens Total */
            output_tokens_total: number;
            /** Prompt Hashes Complete */
            prompt_hashes_complete: boolean;
            /** Provider */
            provider: "anthropic" | null;
            /** Runtime Identity Match */
            runtime_identity_match: boolean;
            /** Schema Hashes Complete */
            schema_hashes_complete: boolean;
            /** Text Only */
            text_only: boolean;
            /** Unmet Reason Codes */
            unmet_reason_codes: ("no_model_calls" | "provider_not_anthropic" | "model_id_incomplete_or_mixed" | "non_text_model_call" | "non_positive_input_tokens" | "non_positive_output_tokens" | "prompt_hash_incomplete" | "schema_hash_incomplete" | "runtime_identity_mismatch")[];
        };
        /** PresentationSection */
        PresentationSection: {
            /**
             * Section Code
             * @enum {string}
             */
            section_code: "conclusion" | "process" | "document_comparison" | "issues_and_causes" | "regulatory_meaning" | "business_impact" | "next_actions" | "scope_and_limits";
            /** Statements */
            statements: components["schemas"]["PresentationStatement"][];
            /** Title */
            title: string;
        };
        /** PresentationStatement */
        PresentationStatement: {
            /** Citation References */
            citation_references?: components["schemas"]["CitationReferenceV1"][];
            /**
             * Material
             * @default true
             */
            material: boolean;
            /**
             * Role
             * @enum {string}
             */
            role: "conclusion" | "observation" | "reason" | "evidence" | "impact" | "action" | "limitation";
            /** Source Claim Ids */
            source_claim_ids: string[];
            /** Statement Id */
            statement_id: string;
            /** Text */
            text: string;
        };
        /** ProblemDetailsV1 */
        ProblemDetailsV1: {
            /** Code */
            code: string;
            /** Detail */
            detail: string;
            /** Instance */
            instance: string;
            /** Status */
            status: number;
            /** Title */
            title: string;
            /**
             * Type
             * @default about:blank
             * @constant
             */
            type: "about:blank";
        };
        /** PublicDocumentRecord */
        PublicDocumentRecord: {
            /** Byte Size */
            byte_size: number;
            /** Case Id */
            case_id: string;
            /** Character Count */
            character_count: number;
            /** Content Sha256 */
            content_sha256: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by: string;
            /** Document Id */
            document_id: string;
            /** Document Type */
            document_type: string;
            /** Filename */
            filename: string;
            /** Media Type */
            media_type: string;
        };
        /**
         * PublicReviewExperienceV1
         * @description Browser-safe projection; the full canonical Agent result remains private.
         */
        PublicReviewExperienceV1: {
            /** Agent Envelope Sha256 */
            agent_envelope_sha256: string;
            /** Bound Effective Result Digest */
            bound_effective_result_digest: string;
            /** Bound Provider Result Sha256 */
            bound_provider_result_sha256: string;
            capability_attestation: components["schemas"]["AgentUatCapabilityAttestationV1"];
            /** Public Experience Sha256 */
            public_experience_sha256: string;
            /**
             * Schema Version
             * @default 1.0
             * @constant
             */
            schema_version: "1.0";
            /** User Action Events */
            user_action_events?: components["schemas"]["UserActionEventV1"][];
            user_presentation: components["schemas"]["GroundedPresentationV1"];
        };
        /** RequiredAction */
        RequiredAction: {
            /** Action Code */
            action_code: string;
            /** Message */
            message: string;
            /** Source Reference Ids */
            source_reference_ids?: string[];
        };
        /**
         * ReviewDisposition
         * @enum {string}
         */
        ReviewDisposition: "auto_review_complete" | "human_review_required" | "blocked";
        /** ReviewEnqueueRequest */
        ReviewEnqueueRequest: {
            /** Review As Of */
            review_as_of?: string | null;
            /** Submitted Document Codes */
            submitted_document_codes?: string[];
            /**
             * Trade Type
             * @default import
             * @enum {string}
             */
            trade_type: "import" | "export";
        };
        /** ReviewEta */
        ReviewEta: {
            /** P50 Seconds */
            p50_seconds?: number | null;
            /** P90 Seconds */
            p90_seconds?: number | null;
            /** Range Max Seconds */
            range_max_seconds: number;
            /** Range Min Seconds */
            range_min_seconds: number;
            /** Sample Size */
            sample_size: number;
            /**
             * Source
             * @enum {string}
             */
            source: "observed" | "validated_default";
        };
        /** ReviewRunListResponse */
        ReviewRunListResponse: {
            /** Items */
            items: components["schemas"]["ReviewRunRecord"][];
        };
        /** ReviewRunRecord */
        ReviewRunRecord: {
            /** Action Trace */
            action_trace?: {
                [key: string]: unknown;
            }[];
            /** Agent Input Manifest Sha256 */
            agent_input_manifest_sha256: string;
            assessment: components["schemas"]["Assessment"];
            assurance_level: components["schemas"]["AssuranceLevel"];
            /** Attempted Retrieval Methods */
            attempted_retrieval_methods?: ("exact_hs" | "dense" | "bm25" | "graph")[];
            auto_completion_profile?: components["schemas"]["AutoCompletionProfileBinding"];
            /** Case Id */
            case_id: string;
            /** Case Revision */
            case_revision: number;
            completion_eligibility: components["schemas"]["CompletionEligibility"];
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by: string;
            /**
             * Evidence Data Source
             * @default UNATTESTED
             * @enum {string}
             */
            evidence_data_source: "UNATTESTED" | "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY";
            /**
             * Evidence Profile
             * @default unknown
             */
            evidence_profile: string;
            /** Evidence Request Id */
            evidence_request_id?: string | null;
            execution_status: components["schemas"]["ExecutionStatus"];
            /** Input Document Manifest */
            input_document_manifest?: components["schemas"]["InputDocumentManifestEntry"][];
            /** Input Manifest Digest */
            input_manifest_digest: string;
            /** Job Id */
            job_id?: string | null;
            /** Narrative Report */
            narrative_report?: {
                [key: string]: unknown;
            };
            /** Observed Retrieval Methods */
            observed_retrieval_methods?: ("exact_hs" | "dense" | "bm25" | "graph")[];
            /** Org Id */
            org_id: string;
            /** Parent Run Id */
            parent_run_id?: string | null;
            /** Provider Result Sha256 */
            provider_result_sha256: string;
            /** Release Identity */
            release_identity?: {
                [key: string]: unknown;
            };
            /** Required Actions */
            required_actions?: components["schemas"]["RequiredAction"][];
            /** Result Detail */
            result_detail: {
                [key: string]: unknown;
            };
            /** Result Digest */
            result_digest: string;
            /**
             * Retrieval Execution Attested
             * @default false
             */
            retrieval_execution_attested: boolean;
            /** Review As Of */
            review_as_of?: string | null;
            review_disposition: components["schemas"]["ReviewDisposition"];
            /** Review Run Id */
            review_run_id: string;
            /** Review Stage Trace */
            review_stage_trace?: components["schemas"]["ReviewStageTraceEntry"][];
            /** Successful Retrieval Methods */
            successful_retrieval_methods?: ("exact_hs" | "dense" | "bm25" | "graph")[];
            /** Trade Type */
            trade_type?: ("import" | "export") | null;
        };
        /** ReviewStageTraceEntry */
        ReviewStageTraceEntry: {
            /** Reason Ids */
            reason_ids?: string[];
            /** Sequence */
            sequence: number;
            /**
             * Stage
             * @enum {string}
             */
            stage: "load_case" | "classify_documents" | "extract_documents" | "normalize_documents" | "pair_documents" | "validate_cross_documents" | "retrieve_regulations" | "compliance_review" | "generate_xai_report" | "route_to_human_or_complete" | "redact_sensitive_inputs";
            /**
             * Status
             * @enum {string}
             */
            status: "completed" | "needs_review" | "partial" | "failed";
        };
        /**
         * RevisionAction
         * @description Typed, inert proposal action; it reaches Agent only after maker-checker approval.
         */
        RevisionAction: {
            /** Confirmed Reference Id */
            confirmed_reference_id?: string | null;
            correction?: components["schemas"]["CorrectionOperation"] | null;
            /**
             * Decision
             * @enum {string}
             */
            decision: "confirm_field" | "correct_field" | "add_supporting_document" | "approve_review" | "reject_review";
            /** Reason */
            reason: string;
            /** Supporting Document Id */
            supporting_document_id?: string | null;
        };
        /** RevisionProposalCreate */
        RevisionProposalCreate: {
            /** Actions */
            actions: components["schemas"]["RevisionAction"][];
            /** Case Revision */
            case_revision: number;
            /** Parent Input Manifest Sha256 */
            parent_input_manifest_sha256: string;
            /** Parent Result Digest */
            parent_result_digest: string;
        };
        /**
         * Role
         * @enum {string}
         */
        Role: "reviewer" | "approver" | "auditor" | "admin";
        /** SessionResponse */
        SessionResponse: {
            /** Org Id */
            org_id: string;
            /** Roles */
            roles: components["schemas"]["Role"][];
            /** Subject */
            subject: string;
        };
        /** StageEvent */
        StageEvent: {
            /** Detail */
            detail?: {
                [key: string]: unknown;
            };
            /** Event Id */
            event_id: string;
            /** Job Id */
            job_id: string;
            /** Message Code */
            message_code: string;
            /**
             * Occurred At
             * Format: date-time
             */
            occurred_at: string;
            /** Sequence */
            sequence: number;
            /**
             * Stage
             * @enum {string}
             */
            stage: "queued" | "input_validation" | "agent_analysis" | "result_validation" | "persistence" | "request_validation" | "document_analysis" | "normalization" | "document_pairing" | "cross_validation" | "adaptive_investigation" | "evidence_retrieval" | "compliance_review" | "report_composition" | "grounding_verification" | "conversation_binding" | "answer_planning" | "answer_composition" | "validation" | "evidence" | "compliance" | "report" | "completed" | "failed";
            /**
             * State
             * @enum {string}
             */
            state: "started" | "progress" | "completed" | "skipped" | "failed";
        };
        /** SupportingDocumentCreate */
        SupportingDocumentCreate: {
            /** Document Code */
            document_code: string;
            /** Document Id */
            document_id: string;
            /** Document Number */
            document_number: string;
            /** Hs Codes */
            hs_codes?: string[];
            /**
             * Issued On
             * Format: date
             */
            issued_on: string;
            /** Issuer */
            issuer: string;
            /** Source Sha256 */
            source_sha256: string;
            /** Subject Item Ids */
            subject_item_ids: string[];
            /** Valid Until */
            valid_until?: string | null;
        };
        /** SupportingDocumentListResponse */
        SupportingDocumentListResponse: {
            /** Items */
            items: components["schemas"]["SupportingDocumentRecord"][];
        };
        /** SupportingDocumentRecord */
        SupportingDocumentRecord: {
            /** Case Id */
            case_id: string;
            /**
             * Created At
             * Format: date-time
             */
            created_at: string;
            /** Created By */
            created_by: string;
            /** Document Code */
            document_code: string;
            /** Document Id */
            document_id: string;
            /** Document Number */
            document_number: string;
            /** Hs Codes */
            hs_codes?: string[];
            /**
             * Issued On
             * Format: date
             */
            issued_on: string;
            /** Issuer */
            issuer: string;
            /** Org Id */
            org_id: string;
            /** Source Sha256 */
            source_sha256: string;
            /** Subject Item Ids */
            subject_item_ids: string[];
            /** Valid Until */
            valid_until?: string | null;
            /** Verification Assertions */
            verification_assertions?: components["schemas"]["VerificationAssertionRecord"][];
        };
        /**
         * SupportingVerificationDecisionRecord
         * @description Backend-owned immutable lineage whose digest is embedded in a receipt.
         */
        SupportingVerificationDecisionRecord: {
            /** Actor Id */
            actor_id: string;
            /**
             * Actor Role
             * @default approver
             * @constant
             */
            actor_role: "approver";
            /** Case Id */
            case_id: string;
            /**
             * Decided At
             * Format: date-time
             */
            decided_at: string;
            /**
             * Decision
             * @default verify_supporting_document
             * @constant
             */
            decision: "verify_supporting_document";
            /** Document Id */
            document_id: string;
            /** Policy Release */
            policy_release: string;
            /** Policy Source Sha256 */
            policy_source_sha256: string;
            /**
             * Schema Version
             * @default backend-supporting-document-human-decision/v1
             * @constant
             */
            schema_version: "backend-supporting-document-human-decision/v1";
            /** Source Sha256 */
            source_sha256: string;
            /** Supporting Document Claims Sha256 */
            supporting_document_claims_sha256: string;
        };
        /** TextDocumentCreate */
        TextDocumentCreate: {
            /** Content Text */
            content_text: string;
            /**
             * Document Type
             * @enum {string}
             */
            document_type: "CI" | "PL" | "BL" | "CO" | "SUPPORTING" | "UNKNOWN";
            /** Filename */
            filename: string;
            /**
             * Media Type
             * @default text/plain
             * @constant
             */
            media_type: "text/plain";
        };
        /** UatEvidenceDatasetResponse */
        UatEvidenceDatasetResponse: {
            /**
             * Data Source
             * @enum {string}
             */
            data_source: "SYNTHETIC_V3_NO_RAG_QUALITY" | "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY" | "UNKNOWN";
            /** Expected Production Law Count */
            expected_production_law_count: number;
            /** Observed Article Count */
            observed_article_count: number;
            /** Observed Law Count */
            observed_law_count: number;
            /**
             * Rag Quality Evaluated
             * @default false
             * @constant
             */
            rag_quality_evaluated: false;
            store_counts: components["schemas"]["UatEvidenceStoreCountsResponse"];
        };
        /** UatEvidenceRetrievalResponse */
        UatEvidenceRetrievalResponse: {
            bm25: components["schemas"]["UatEvidenceRetrievalStageResponse"];
            dense: components["schemas"]["UatEvidenceRetrievalStageResponse"];
            graph: components["schemas"]["UatEvidenceRetrievalStageResponse"];
            structured: components["schemas"]["UatEvidenceRetrievalStageResponse"];
        };
        /** UatEvidenceRetrievalStageResponse */
        UatEvidenceRetrievalStageResponse: {
            /**
             * Attempted
             * @default true
             * @constant
             */
            attempted: true;
            /** Duration Ms */
            duration_ms: number;
            /** Result Count */
            result_count: number;
            /**
             * Succeeded
             * @default true
             * @constant
             */
            succeeded: true;
            /** Top K Count */
            top_k_count: number;
        };
        /** UatEvidenceStoreCountsResponse */
        UatEvidenceStoreCountsResponse: {
            /** Neo4J Article Count */
            neo4j_article_count: number;
            /** Postgresql Article Count */
            postgresql_article_count: number;
            /** Qdrant Point Count */
            qdrant_point_count: number;
        };
        /** UatEvidenceTraceResponse */
        UatEvidenceTraceResponse: {
            /** Knowledge Snapshot Id */
            knowledge_snapshot_id: string;
            /** Request Id */
            request_id: string;
            retrieval: components["schemas"]["UatEvidenceRetrievalResponse"];
            /**
             * Schema Version
             * @default customs-backend-uat-evidence-trace/v1
             * @constant
             */
            schema_version: "customs-backend-uat-evidence-trace/v1";
        };
        /** UatMetadataResponse */
        UatMetadataResponse: {
            /**
             * Assurance Ceiling
             * @default diagnostic
             * @constant
             */
            assurance_ceiling: "diagnostic";
            /**
             * Auto Completion Enabled
             * @default false
             * @constant
             */
            auto_completion_enabled: false;
            /**
             * Claude Mode
             * @default actual
             * @constant
             */
            claude_mode: "actual";
            /**
             * Evidence Data Source
             * @enum {string}
             */
            evidence_data_source: "SYNTHETIC_V3_NO_RAG_QUALITY" | "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY" | "UNKNOWN";
            evidence_dataset: components["schemas"]["UatEvidenceDatasetResponse"];
            /**
             * Evidence Policy Mode
             * @enum {string}
             */
            evidence_policy_mode: "SYNTHETIC_FIXTURE" | "ACTUAL_CODES_HUMAN_ONLY" | "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY" | "UNKNOWN";
            /**
             * Evidence Profile
             * @enum {string}
             */
            evidence_profile: "synthetic-v3" | "preserved-3law-v3-diagnostic" | "preserved-3law-v3-scenario-eval" | "unknown";
            /**
             * Evidence Scope
             * @enum {string}
             */
            evidence_scope: "TEST_ONLY_V3" | "ACTUAL_3_LAW_RAG_3_OF_58" | "ACTUAL_3_LAW_RAG_SCENARIO_EVAL_3_OF_58" | "UNKNOWN";
            /**
             * Evidence Scope Label
             * @enum {string}
             */
            evidence_scope_label: "TEST_ONLY_V3" | "ACTUAL_3_LAW_RAG_3_OF_58" | "ACTUAL_3_LAW_RAG_SCENARIO_EVAL_3_OF_58" | "UNKNOWN";
            /**
             * Mode
             * @default local_uat
             * @constant
             */
            mode: "local_uat";
            /**
             * Planner Mode
             * @enum {string}
             */
            planner_mode: "shadow" | "diagnostic_active";
            /**
             * Production Release
             * @default false
             * @constant
             */
            production_release: false;
            /**
             * Supported Review As Of
             * Format: date
             */
            supported_review_as_of: string;
            /**
             * Text Only
             * @default true
             * @constant
             */
            text_only: true;
        };
        /** UatMetadataV2Response */
        UatMetadataV2Response: {
            /**
             * Actual Stage Streaming
             * @default false
             */
            actual_stage_streaming: boolean;
            /**
             * Agent Experience Api Version
             * @default disabled
             * @enum {string}
             */
            agent_experience_api_version: "disabled" | "3.0";
            /**
             * Assistant Api Version
             * @default disabled
             * @enum {string}
             */
            assistant_api_version: "disabled" | "2.0";
            /**
             * Assurance Ceiling
             * @default diagnostic
             * @constant
             */
            assurance_ceiling: "diagnostic";
            /**
             * Auto Completion Enabled
             * @default false
             * @constant
             */
            auto_completion_enabled: false;
            /**
             * Claude Mode
             * @default actual
             * @constant
             */
            claude_mode: "actual";
            /**
             * Enhanced Agent Experience
             * @default false
             */
            enhanced_agent_experience: boolean;
            /**
             * Evidence Data Source
             * @enum {string}
             */
            evidence_data_source: "SYNTHETIC_V3_NO_RAG_QUALITY" | "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY" | "UNKNOWN";
            evidence_dataset: components["schemas"]["UatEvidenceDatasetResponse"];
            /**
             * Evidence Policy Mode
             * @enum {string}
             */
            evidence_policy_mode: "SYNTHETIC_FIXTURE" | "ACTUAL_CODES_HUMAN_ONLY" | "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY" | "UNKNOWN";
            /**
             * Evidence Profile
             * @enum {string}
             */
            evidence_profile: "synthetic-v3" | "preserved-3law-v3-diagnostic" | "preserved-3law-v3-scenario-eval" | "unknown";
            /**
             * Evidence Scope
             * @enum {string}
             */
            evidence_scope: "TEST_ONLY_V3" | "ACTUAL_3_LAW_RAG_3_OF_58" | "ACTUAL_3_LAW_RAG_SCENARIO_EVAL_3_OF_58" | "UNKNOWN";
            /**
             * Evidence Scope Label
             * @enum {string}
             */
            evidence_scope_label: "TEST_ONLY_V3" | "ACTUAL_3_LAW_RAG_3_OF_58" | "ACTUAL_3_LAW_RAG_SCENARIO_EVAL_3_OF_58" | "UNKNOWN";
            /**
             * Mode
             * @default local_uat
             * @constant
             */
            mode: "local_uat";
            /**
             * Planner Mode
             * @enum {string}
             */
            planner_mode: "shadow" | "diagnostic_active";
            /**
             * Production Release
             * @default false
             * @constant
             */
            production_release: false;
            /**
             * Supported Review As Of
             * Format: date
             */
            supported_review_as_of: string;
            /**
             * Text Only
             * @default true
             * @constant
             */
            text_only: true;
            /**
             * Uat Adaptive Active
             * @default false
             */
            uat_adaptive_active: boolean;
        };
        /** UserActionEventV1 */
        UserActionEventV1: {
            /** Action Code */
            action_code: string;
            /** Description */
            description: string;
            /** Event Id */
            event_id: string;
            /**
             * Schema Version
             * @default 1.0
             * @constant
             */
            schema_version: "1.0";
            /** Source Reference Ids */
            source_reference_ids?: string[];
            /**
             * Status
             * @enum {string}
             */
            status: "completed" | "needs_attention" | "deferred";
            /** Title */
            title: string;
        };
        /** VerificationAssertionCreate */
        VerificationAssertionCreate: {
            /**
             * Method
             * @default human_approver
             * @constant
             */
            method: "human_approver";
        };
        /** VerificationAssertionRecord */
        VerificationAssertionRecord: {
            /**
             * Asserted At
             * Format: date-time
             */
            asserted_at: string;
            /** Asserted By */
            asserted_by: string;
            /** Assertion Id */
            assertion_id: string;
            /** Authority Id */
            authority_id: string;
            /** Authority Release */
            authority_release: string;
            decision_record?: components["schemas"]["SupportingVerificationDecisionRecord"] | null;
            /**
             * Method
             * @enum {string}
             */
            method: "trusted_connector" | "human_approver" | "test_issuer";
            receipt?: components["schemas"]["VerificationReceiptRecord"] | null;
            /** Source Reference Sha256 */
            source_reference_sha256: string;
            /** Subject Document Id */
            subject_document_id: string;
        };
        /**
         * VerificationReceiptRecord
         * @description Agent-owned V1 detached receipt wire, persisted without private key material.
         */
        VerificationReceiptRecord: {
            /** Authority Id */
            authority_id: string;
            /** Authority Release */
            authority_release: string;
            /** Case Id */
            case_id: string;
            /** Connector Result Sha256 */
            connector_result_sha256?: string | null;
            /** Decision Record Sha256 */
            decision_record_sha256?: string | null;
            /**
             * Expires At
             * Format: date-time
             */
            expires_at: string;
            /** Key Id */
            key_id: string;
            /**
             * Method
             * @enum {string}
             */
            method: "trusted_connector" | "human_approver";
            /** Policy Release */
            policy_release: string;
            /** Policy Source Sha256 */
            policy_source_sha256: string;
            /** Signature Base64Url */
            signature_base64url: string;
            /**
             * Signed At
             * Format: date-time
             */
            signed_at: string;
            /** Supporting Document Claims Sha256 */
            supporting_document_claims_sha256: string;
            /**
             * Trust Domain
             * @constant
             */
            trust_domain: "customs-ai-agent/supporting-document-verification/v1";
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    auth_config_api_v1_auth_config_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuthConfigResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_cases_endpoint_api_v1_cases_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CaseListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    create_case_endpoint_api_v1_cases_post: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CaseCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CaseRecord"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    get_case_endpoint_api_v1_cases__case_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CaseRecord"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_audit_endpoint_api_v1_cases__case_id__audit_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_documents_endpoint_api_v1_cases__case_id__documents_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    add_document_endpoint_api_v1_cases__case_id__documents_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TextDocumentCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentViewResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    get_document_content_endpoint_api_v1_cases__case_id__documents__document_id__content_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
                document_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DocumentViewResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_runs_endpoint_api_v1_cases__case_id__review_runs_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewRunListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    enqueue_review_endpoint_api_v1_cases__case_id__reviews_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReviewEnqueueRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_supporting_documents_endpoint_api_v1_cases__case_id__supporting_documents_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportingDocumentListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    add_supporting_document_endpoint_api_v1_cases__case_id__supporting_documents_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupportingDocumentCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportingDocumentRecord"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    assert_supporting_document_endpoint_api_v1_cases__case_id__supporting_documents__document_id__assertions_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                case_id: string;
                document_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerificationAssertionCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupportingDocumentRecord"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    decide_correction_proposal_endpoint_api_v1_correction_proposals__proposal_id__decisions_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                proposal_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CorrectionProposalDecisionCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorrectionProposalDecisionResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    get_job_endpoint_api_v1_jobs__job_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobView"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    get_job_events_endpoint_api_v1_jobs__job_id__events_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobEventsResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    stream_job_events_endpoint_api_v1_jobs__job_id__events_stream_get: {
        parameters: {
            query?: never;
            header?: {
                "Last-Event-ID"?: string | null;
            };
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    reconcile_delivery_uncertain_endpoint_api_v1_jobs__job_id__reconciliation_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DeliveryReconciliationCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobView"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    get_run_endpoint_api_v1_review_runs__review_run_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ReviewRunRecord"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    answer_endpoint_api_v1_review_runs__review_run_id__answers_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["GroundedQuestion"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChatRecord"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_correction_proposals_endpoint_api_v1_review_runs__review_run_id__correction_proposals_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorrectionProposalListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    create_correction_proposal_endpoint_api_v1_review_runs__review_run_id__correction_proposals_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CorrectionProposalCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorrectionProposalRecord"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_decisions_endpoint_api_v1_review_runs__review_run_id__decisions_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DecisionListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_chat_endpoint_api_v1_review_runs__review_run_id__messages_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ChatListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_revision_proposals_endpoint_api_v1_review_runs__review_run_id__revision_proposals_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorrectionProposalListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    create_revision_proposal_endpoint_api_v1_review_runs__review_run_id__revision_proposals_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RevisionProposalCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorrectionProposalRecord"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    decide_revision_proposal_endpoint_api_v1_revision_proposals__proposal_id__decisions_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                proposal_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CorrectionProposalDecisionCreate"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorrectionProposalDecisionResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    session_api_v1_session_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    uat_metadata_api_v1_uat_metadata_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UatMetadataResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    get_uat_evidence_trace_endpoint_api_v1_uat_review_runs__review_run_id__evidence_trace_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UatEvidenceTraceResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_assistant_jobs_endpoint_api_v2_assistant_conversations__conversation_id__jobs_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantJobListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_assistant_messages_endpoint_api_v2_assistant_conversations__conversation_id__messages_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantMessageListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    enqueue_assistant_message_endpoint_api_v2_assistant_conversations__conversation_id__messages_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                conversation_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AssistantMessageCreateV2"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantJobEnqueueResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    get_assistant_job_endpoint_api_v2_assistant_jobs__assistant_job_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                assistant_job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantJobView"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    stream_assistant_job_events_endpoint_api_v2_assistant_jobs__assistant_job_id__events_stream_get: {
        parameters: {
            query?: never;
            header?: {
                "Last-Event-ID"?: string | null;
            };
            path: {
                assistant_job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    enqueue_experience_review_endpoint_api_v2_cases__case_id__reviews_post: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                case_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReviewEnqueueRequest"];
            };
        };
        responses: {
            /** @description Successful Response */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobExperienceResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    get_experience_job_endpoint_api_v2_jobs__job_id__get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["JobExperienceView"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    stream_experience_job_events_endpoint_api_v2_jobs__job_id__events_stream_get: {
        parameters: {
            query?: never;
            header?: {
                "Last-Event-ID"?: string | null;
            };
            path: {
                job_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    list_assistant_conversations_endpoint_api_v2_review_runs__review_run_id__assistant_conversations_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantConversationListResponse"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    create_assistant_conversation_endpoint_api_v2_review_runs__review_run_id__assistant_conversations_post: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ConversationCreateV2"];
            };
        };
        responses: {
            /** @description Successful Response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssistantConversationRecord"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    get_review_experience_endpoint_api_v2_review_runs__review_run_id__experience_get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                review_run_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicReviewExperienceV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
    uat_metadata_v2_api_v2_uat_metadata_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful Response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UatMetadataV2Response"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
            /** @description Problem Details V1 fail-closed response. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetailsV1"];
                };
            };
        };
    };
}
