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
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * AgentCallState
         * @enum {string}
         */
        AgentCallState: "not_started" | "started" | "completed" | "delivery_uncertain" | "delivery_reconciled" | "response_received_rejected" | "response_persistence_uncertain";
        /**
         * Assessment
         * @enum {string}
         */
        Assessment: "no_issue_detected" | "issues_detected" | "indeterminate";
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
            /** Idempotency Key */
            idempotency_key: string;
            /** Idempotency Request Digest */
            idempotency_request_digest: string;
            /** Message Id */
            message_id: string;
            /** Org Id */
            org_id: string;
            /** Question */
            question: string;
            /** Review Run Id */
            review_run_id: string;
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
            /** Review As Of */
            review_as_of?: string | null;
            review_disposition: components["schemas"]["ReviewDisposition"];
            /** Review Run Id */
            review_run_id: string;
            /** Review Stage Trace */
            review_stage_trace?: components["schemas"]["ReviewStageTraceEntry"][];
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
            stage: "queued" | "document_analysis" | "normalization" | "validation" | "evidence" | "compliance" | "report" | "completed" | "failed";
            /**
             * State
             * @enum {string}
             */
            state: "started" | "progress" | "completed" | "failed";
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
             * Evidence Profile
             * @enum {string}
             */
            evidence_profile: "synthetic-v3" | "preserved-3law" | "unknown";
            /**
             * Evidence Scope Label
             * @enum {string}
             */
            evidence_scope_label: "TEST_ONLY_V3" | "REAL_3_OF_58" | "UNKNOWN";
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
             * Text Only
             * @default true
             * @constant
             */
            text_only: true;
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
}
