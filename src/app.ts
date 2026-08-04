import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import { ApiClient, ApiError } from "./api/v1/client";
import type {
  AddDocumentRequest,
  ActionTrace,
  AuditEvent,
  CaseDetail,
  CaseDocument,
  CaseSummary,
  ChatRecord,
  CorrectionProposal,
  CorrectionProposalDecisionResponse,
  CorrectionOperation,
  EnqueueReviewRequest,
  ExtractedField,
  GroundedAnswer,
  HumanDecisionRecord,
  JobRecord,
  LocalUatMetadata,
  ModelExecutionSummary,
  NarrativeClaim,
  RequiredAction,
  ReviewIssue,
  ReviewRun,
  ReviewStageEvent,
  RevisionAction,
  RevisionProposalCreate,
  RunSummary,
  Session,
  SupportingDocumentCreate,
  SupportingDocumentRecord,
  UatEvidenceTrace,
} from "./api/v1/types";
import type { OidcSession } from "./auth";
import { badge, button, el, empty, formatDate, humanize, labeledControl } from "./dom";
import {
  bindLocalUatScenario,
  localUatInputManifestSha256,
  localUatScenarioExternalReference,
  localUatScenarioInputManifest,
  localUatScenarioSupportsProfile,
  localUatScenarioVariant,
  restoreBoundLocalUatScenario,
  LOCAL_UAT_EVIDENCE_PROFILES,
  UAT_SCENARIOS,
  type BoundLocalUatScenario,
  type LocalUatEvidenceProfile,
  type LocalUatInputManifest,
  type LocalUatModelExecutionExpectation,
  type LocalUatScenario,
  type LocalUatScenarioVariant,
  type LocalUatSemanticExpectation,
} from "./uat/scenarios";

const MAX_PRIMARY_DOCUMENTS = 6;
const MAX_SUPPORTING_DOCUMENTS = 100;
const MAX_PRIMARY_TEXT_CHARACTERS = 500_000;
const MAX_DOCUMENT_TEXT_CHARACTERS = 200_000;
const REVIEW_RECOVERY_STORAGE_PREFIX = "customs.workbench.review-recovery.v4";
const PROPOSAL_DECISION_RECOVERY_STORAGE_PREFIX = "customs.workbench.proposal-decision-recovery.v1";
const DELIVERY_RECONCILIATION_RECOVERY_STORAGE_PREFIX = "customs.workbench.delivery-reconciliation-recovery.v1";
const MAX_RECOVERY_RECORDS = 50;
const MAX_TRANSIENT_POLL_FAILURES = 8;
const MAX_POLL_DELAY_MS = 15_000;
const JOB_TRACKING_TIMEOUT_MS = 15 * 60_000;
const REVIEW_TYPICAL_MINUTES = "4~7분";
const CHAT_TYPICAL_SECONDS = "약 1~2분";
interface UatRuntimeDisplayMetadata {
  mode: string;
  assurance_ceiling: "diagnostic" | "production_candidate" | "production";
  text_only: boolean;
  auto_completion_enabled: boolean;
  claude_mode: string;
  evidence_profile: string;
  evidence_scope: string;
  evidence_data_source: string;
  evidence_policy_mode: string;
  evidence_scope_label: string;
  evidence_dataset: {
    data_source: string;
    expected_production_law_count: number;
    observed_law_count: number;
    observed_article_count: number;
    store_counts: {
      postgresql_article_count: number;
      qdrant_point_count: number;
      neo4j_article_count: number;
    };
    rag_quality_evaluated: false;
  };
  supported_review_as_of: string | null;
  planner_mode: string;
  production_release: boolean;
}

type BoundReviewRequest = EnqueueReviewRequest & { review_as_of: string };

const SAFE_UNKNOWN_UAT_METADATA: UatRuntimeDisplayMetadata = Object.freeze({
  mode: "metadata_unavailable",
  assurance_ceiling: "diagnostic",
  text_only: true,
  auto_completion_enabled: false,
  claude_mode: "unknown",
  evidence_profile: "unknown",
  evidence_scope: "UNKNOWN",
  evidence_data_source: "UNKNOWN",
  evidence_policy_mode: "UNKNOWN",
  evidence_scope_label: "UNKNOWN",
  evidence_dataset: {
    data_source: "UNKNOWN",
    expected_production_law_count: 58,
    observed_law_count: 0,
    observed_article_count: 0,
    store_counts: {
      postgresql_article_count: 0,
      qdrant_point_count: 0,
      neo4j_article_count: 0,
    },
    rag_quality_evaluated: false as const,
  },
  supported_review_as_of: null,
  planner_mode: "unknown",
  production_release: false,
});

const SCENARIO_EVAL_PROFILE: LocalUatEvidenceProfile = "preserved-3law-v3-scenario-eval";

const isActualThreeLawProfile = (profile: string): boolean => (
  profile === "preserved-3law-v3-diagnostic"
  || profile === SCENARIO_EVAL_PROFILE
);

const isScenarioEvalRuntime = (metadata: UatRuntimeDisplayMetadata): boolean => (
  metadata.evidence_profile === SCENARIO_EVAL_PROFILE
  && metadata.evidence_scope === "ACTUAL_3_LAW_RAG_SCENARIO_EVAL_3_OF_58"
  && metadata.evidence_data_source === "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY"
  && metadata.evidence_policy_mode === "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY"
);

interface ReviewRecoveryRecord {
  org_id: string;
  subject: string;
  case_id: string;
  case_revision: number;
  job_id: string | null;
  job_kind: "review" | "revision";
  parent_run_id: string | null;
  review_as_of: string | null;
  request_sha256: string;
  idempotency_key: string;
}

interface UatCheck {
  label: string;
  expected: string;
  actual: string;
  matches?: boolean;
  pending?: boolean;
  invalid?: boolean;
}

const uatCheckMatches = (check: UatCheck): boolean => check.matches ?? check.expected === check.actual;

interface ProposalDecisionRecoveryRecord {
  org_id: string;
  subject: string;
  case_id: string;
  case_revision: number;
  review_run_id: string;
  proposal_id: string;
  decision: "approve" | "reject";
  parent_result_digest: string;
  request_sha256: string;
  idempotency_key: string;
}

interface DeliveryReconciliationRecoveryRecord {
  org_id: string;
  subject: string;
  case_id: string;
  job_id: string;
  request_sha256: string;
  attempted_at: string;
}

export interface WorkbenchAuth {
  login(): Promise<void>;
  logout(): Promise<void>;
  isAuthenticated(): boolean;
  clear(): Promise<void>;
}

type WorkbenchApi = Pick<
  ApiClient,
  | "getSession"
  | "listCases"
  | "createCase"
  | "getCase"
  | "listDocuments"
  | "getDocumentContent"
  | "addDocument"
  | "listSupportingDocuments"
  | "addSupportingDocument"
  | "addSupportingAssertion"
  | "enqueueReview"
  | "getJob"
  | "reconcileDeliveryUncertain"
  | "listJobEvents"
  | "streamJobEvents"
  | "listReviewRuns"
  | "getReviewRun"
  | "listRevisionProposals"
  | "createRevisionProposal"
  | "decideRevisionProposal"
  | "listDecisions"
  | "answerCaseQuestion"
  | "listChat"
  | "getAuditEvents"
> & {
  getUatMetadata?: () => Promise<LocalUatMetadata>;
  getUatEvidenceTrace?: (runId: string) => Promise<UatEvidenceTrace>;
};

interface WorkbenchState {
  session: Session | undefined;
  cases: CaseSummary[];
  selectedCase: CaseDetail | undefined;
  documents: CaseDocument[];
  supportingDocuments: SupportingDocumentRecord[];
  runs: RunSummary[];
  selectedRun: ReviewRun | undefined;
  parentRun: ReviewRun | undefined;
  job: JobRecord | undefined;
  chat: Array<ChatRecord | GroundedAnswer>;
  audit: AuditEvent[];
  decisions: HumanDecisionRecord[];
  proposals: CorrectionProposal[];
  liveStages: ReviewStageEvent[];
  selectedDocumentId: string | undefined;
  busy: boolean;
  error: string | undefined;
  notice: string | undefined;
  uatMetadata: UatRuntimeDisplayMetadata;
  uatMetadataVerified: boolean;
  uatEvidenceTrace: UatEvidenceTrace | undefined;
  uatEvidenceTraceStatus: "not_applicable" | "available" | "unavailable";
  chatRequest: {
    review_run_id: string;
    question: string;
    started_at_ms: number;
    state: "requesting" | "completed" | "failed";
    answer?: GroundedAnswer;
    error?: string;
  } | undefined;
}

export class WorkbenchApp {
  private state: WorkbenchState = {
    cases: [],
    documents: [],
    supportingDocuments: [],
    runs: [],
    chat: [],
    audit: [],
    decisions: [],
    proposals: [],
    liveStages: [],
    session: undefined,
    selectedCase: undefined,
    selectedRun: undefined,
    parentRun: undefined,
    job: undefined,
    selectedDocumentId: undefined,
    error: undefined,
    notice: undefined,
    busy: false,
    uatMetadata: SAFE_UNKNOWN_UAT_METADATA,
    uatMetadataVerified: false,
    uatEvidenceTrace: undefined,
    uatEvidenceTraceStatus: "not_applicable",
    chatRequest: undefined,
  };
  private pollTimer: number | undefined;
  private pollFlight:
    | {
        jobId: string;
        lifecycleEpoch: number;
        promise: Promise<void>;
      }
    | undefined;
  private destroyed = false;
  private lifecycleEpoch = 0;
  private trackedJobId: string | undefined;
  private jobTrackingStartedAtMs: number | undefined;
  private jobElapsedTimer: number | undefined;
  private jobObservationPausedReason: string | undefined;
  private jobObservationPausedAtMs: number | undefined;
  private transientPollFailures = 0;
  private streamAbort: AbortController | undefined;
  private chatElapsedTimer: number | undefined;
  private readonly idempotencyKeys = new Map<string, string>();
  private readonly jobIntentById = new Map<string, string>();
  private readonly recoveryByCase = new Map<string, ReviewRecoveryRecord>();
  private readonly proposalDecisionRecovery = new Map<string, ProposalDecisionRecoveryRecord>();
  private readonly deliveryReconciliationRecovery = new Map<string, DeliveryReconciliationRecoveryRecord>();
  private readonly scenarioByCase = new Map<string, BoundLocalUatScenario>();

  constructor(
    private readonly root: HTMLElement,
    private readonly api: WorkbenchApi,
    private readonly auth: WorkbenchAuth,
  ) {
  }

  async start(): Promise<void> {
    if (this.destroyed) return;
    if (!this.auth.isAuthenticated()) {
      this.renderLogin();
      return;
    }
    await this.act(async () => {
      this.state.session = await this.api.getSession();
      await this.loadUatMetadata();
      for (const record of readReviewRecoveries(this.state.session)) {
        this.recoveryByCase.set(record.case_id, record);
        this.idempotencyKeys.set(`review:${record.case_id}`, record.idempotency_key);
      }
      for (const record of readProposalDecisionRecoveries(this.state.session)) {
        this.proposalDecisionRecovery.set(record.proposal_id, record);
        this.idempotencyKeys.set(`proposal:${record.proposal_id}:${record.decision}`, record.idempotency_key);
      }
      for (const record of readDeliveryReconciliationRecoveries(this.state.session)) {
        this.deliveryReconciliationRecovery.set(record.job_id, record);
      }
      await this.refreshCases();
    });
  }

  private async loadUatMetadata(): Promise<void> {
    this.state.uatMetadata = SAFE_UNKNOWN_UAT_METADATA;
    this.state.uatMetadataVerified = false;
    if (!this.api.getUatMetadata) return;
    try {
      this.state.uatMetadata = await this.api.getUatMetadata();
      this.state.uatMetadataVerified = true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) throw error;
      // The workbench stays fail-safe and visibly UNKNOWN. A missing optional
      // diagnostic endpoint must never be inferred as a released runtime.
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.lifecycleEpoch += 1;
    this.cancelPollTimer();
    this.streamAbort?.abort();
    this.streamAbort = undefined;
    this.stopChatElapsedTimer();
    this.resetJobTracking();
  }

  private renderLogin(): void {
    this.root.replaceChildren(
      el(
        "main",
        { className: "login-shell", attrs: { id: "main-content" } },
        el(
          "section",
          { className: "login-hero", attrs: { "aria-label": "서비스 소개" } },
          el(
            "div",
            { className: "brand-lockup brand-lockup--login" },
            el("span", { className: "brand-mark", text: "CA", attrs: { "aria-hidden": "true" } }),
            el(
              "div",
              {},
              el("span", { className: "brand-kicker", text: "CUSTOMS ASSURANCE" }),
              el("strong", { className: "brand-name", text: "Trade Review Intelligence" }),
            ),
          ),
          el("p", { className: "eyebrow", text: "AI-ASSISTED CUSTOMS REVIEW" }),
          el("h1", { text: "통관 검토를 더 빠르고, 근거 있게." }),
          el("p", {
            className: "login-hero__lead",
            text: "문서 정합성부터 법령 근거, 사람 승인 이력까지 하나의 안전한 심사 흐름으로 연결합니다.",
          }),
          el(
            "div",
            { className: "login-benefits" },
            el(
              "article",
              {},
              el("span", { className: "benefit-icon", text: "01", attrs: { "aria-hidden": "true" } }),
              el("strong", { text: "문서 교차검증" }),
              el("p", { text: "CI·PL·B/L·C/O의 핵심 필드와 불일치를 한 화면에서 검토합니다." }),
            ),
            el(
              "article",
              {},
              el("span", { className: "benefit-icon", text: "02", attrs: { "aria-hidden": "true" } }),
              el("strong", { text: "근거 기반 설명" }),
              el("p", { text: "법령 Evidence와 원문 인용에 결박된 사전심사 보고서를 제공합니다." }),
            ),
            el(
              "article",
              {},
              el("span", { className: "benefit-icon", text: "03", attrs: { "aria-hidden": "true" } }),
              el("strong", { text: "검토 이력 보존" }),
              el("p", { text: "수정 제안, 독립 승인, 재심사 결과를 변경 불가능한 이력으로 남깁니다." }),
            ),
          ),
          el("p", { className: "login-hero__boundary", text: "LOCAL USER UAT · TEXT ONLY · NOT PRODUCTION" }),
        ),
        el(
          "section",
          { className: "login-card", attrs: { "aria-labelledby": "login-title" } },
          el("span", { className: "login-card__status", text: "INTERNAL ACCESS" }),
          el("p", { className: "eyebrow", text: "REVIEWER WORKBENCH" }),
          el("h1", { text: "통관 AI 사전심사 작업대", attrs: { id: "login-title" } }),
          el("p", {
            className: "lead",
            text: "조직 계정으로 로그인하여 배정된 Case와 AI 사전심사 결과를 확인하세요.",
          }),
          this.renderUatRuntimeBanner(),
          this.state.error ? el("div", { className: "notice notice--danger", text: this.state.error, attrs: { role: "alert", tabindex: "-1" } }) : null,
          button("조직 계정으로 로그인", () => void this.auth.login(), "primary"),
          el(
            "details",
            { className: "security-note" },
            el("summary", { text: "보안 및 입력 범위 안내" }),
            el("p", {
              className: "fine-print",
              text: "Authorization Code + PKCE를 사용하며 access token은 브라우저 메모리에만 유지합니다. LOCAL UAT는 text-only입니다. PDF/이미지/OCR 입력은 명시적으로 거절됩니다.",
            }),
          ),
        ),
      ),
    );
    if (this.state.error) queueMicrotask(() => this.root.querySelector<HTMLElement>('[role="alert"]')?.focus());
  }

  private render(): void {
    if (this.destroyed) return;
    if (!this.state.session) {
      this.renderLogin();
      return;
    }
    this.root.replaceChildren(
      this.renderHeader(),
      this.renderUatRuntimeBanner(),
      el(
        "div",
        { className: "app-shell" },
        this.renderSidebar(),
        el(
          "main",
          { className: "main", attrs: { id: "main-content", tabindex: "-1", "aria-busy": this.state.busy ? "true" : "false" } },
          this.state.error ? el("div", { className: "notice notice--danger", text: this.state.error, attrs: { role: "alert", tabindex: "-1" } }) : null,
          this.state.notice ? el("div", { className: "notice notice--success", text: this.state.notice, attrs: { role: "status" } }) : null,
          this.state.busy ? el("div", { className: "loading-bar", attrs: { role: "progressbar", "aria-label": "요청 처리 중" } }) : null,
          this.state.selectedCase ? this.renderCase() : this.renderWelcome(),
        ),
      ),
    );
    if (this.state.error) queueMicrotask(() => this.root.querySelector<HTMLElement>('[role="alert"]')?.focus());
  }

  private renderHeader(): HTMLElement {
    const session = this.state.session;
    return el(
      "header",
      { className: "topbar" },
      el(
        "div",
        { className: "brand-lockup" },
        el("span", { className: "brand-mark", text: "CA", attrs: { "aria-hidden": "true" } }),
        el(
          "div",
          {},
          el("span", { className: "brand-kicker", text: "CUSTOMS ASSURANCE" }),
          el("strong", { className: "brand", text: "AI 사전심사 작업대" }),
        ),
      ),
      el(
        "div",
        { className: "topbar-context" },
        el("span", { className: "topbar-context__label", text: "심사 업무함" }),
        el("div", { className: "release-flag", text: "LOCAL UAT · NOT PRODUCTION" }),
      ),
      el(
        "div",
        { className: "user-block" },
        el("span", { className: "user-avatar", text: (session?.subject ?? "U").slice(0, 1).toUpperCase(), attrs: { "aria-hidden": "true" } }),
        el("span", { className: "user-name", text: session?.subject ?? "—" }),
        el("small", { text: session ? `${session.org_id} · ${session.roles.join(", ")}` : "" }),
        button("로그아웃", () => void this.auth.logout(), "quiet"),
      ),
    );
  }

  private renderUatRuntimeBanner(): HTMLElement {
    const metadata = this.state.uatMetadata;
    const metadataVerified = this.state.uatMetadataVerified;
    const modeLabel = metadataVerified ? humanize(metadata.mode) : "UNKNOWN — METADATA UNAVAILABLE";
    const scenarioEval = metadataVerified && isScenarioEvalRuntime(metadata);
    const actualThreeLawRag = metadataVerified && isActualThreeLawProfile(metadata.evidence_profile);
    const evidenceScopeLabel = scenarioEval
      ? "ACTUAL 3-LAW RAG SCENARIO EVAL · 3 OF 58"
      : metadata.evidence_scope === "ACTUAL_3_LAW_RAG_3_OF_58"
        ? "ACTUAL 3-LAW RAG · 3 OF 58"
        : metadata.evidence_scope === "TEST_ONLY_V3"
          ? "TEST-ONLY V3"
          : metadata.evidence_scope;
    const scopeIsPartial = actualThreeLawRag;
    const dataset = metadata.evidence_dataset;
    const unsafe = metadata.auto_completion_enabled || metadata.production_release || !metadata.text_only;
    const runtimeState = !metadataVerified ? "unknown" : unsafe ? "unsafe" : "safe";
    const boundaryTitle = runtimeState === "unknown"
      ? "실행 환경 확인 불가 · 결과 사용 중지 · NOT PRODUCTION"
      : runtimeState === "unsafe"
        ? "UAT 안전 경계 위반 · 결과 사용 금지 · NOT PRODUCTION"
        : scenarioEval
          ? "ACTUAL 3-LAW RAG SCENARIO EVAL · 9/9 · 3 OF 58 · TEXT ONLY · AUTO OFF · NOT PRODUCTION"
          : actualThreeLawRag
            ? "ACTUAL 3-LAW RAG · 3 OF 58 · DIAGNOSTIC · TEXT ONLY · AUTO OFF · NOT PRODUCTION"
            : "LOCAL UAT / DIAGNOSTIC · TEXT ONLY · NOT PRODUCTION";
    const provenanceStatements = !metadataVerified
      ? [
          "통관 입력 자료·Evidence·정책 출처를 확인할 수 없습니다.",
          "실행 환경을 다시 확인하기 전에는 이 결과를 사용하지 마십시오.",
          "법적 판단·Production 자동완료 효력이 없습니다.",
        ]
      : scenarioEval
        ? [
            "통관 입력 문서·증명서는 합성 테스트 자료입니다.",
            "법령·조문 Evidence는 보존된 3법령 PostgreSQL/Qdrant/Neo4j를 실제 조회합니다.",
            "요건 검증정책은 TEST-ONLY이며 법적 판단·Production 자동완료 효력이 없습니다.",
          ]
        : actualThreeLawRag
          ? [
              "통관 입력 문서·증명서는 합성 테스트 자료입니다.",
              "법령·조문 Evidence는 보존된 3법령 PostgreSQL/Qdrant/Neo4j를 실제 조회합니다.",
              "요건 검증정책은 미승인 human-only 진단 정책이며 법적 판단·Production 자동완료 효력이 없습니다.",
            ]
          : [
              "통관 입력 문서·증명서와 Evidence는 합성 테스트 자료입니다.",
              "Synthetic 프로필은 PostgreSQL/Qdrant/Neo4j 실제 조회를 수행하지 않습니다.",
              "요건 검증정책은 Synthetic fixture이며 법적 판단·Production 자동완료 효력이 없습니다.",
            ];
    const profileCard = (
      profile: LocalUatEvidenceProfile,
      title: string,
      description: string,
    ): HTMLElement => {
      const active = metadata.evidence_profile === profile && this.state.uatMetadataVerified;
      return el(
        "article",
        {
          className: `uat-profile-card${active ? " uat-profile-card--active" : ""}`,
          attrs: {
            "data-evidence-profile": profile,
            "data-profile-active": String(active),
            "aria-current": active ? "true" : "false",
          },
        },
        el("span", { className: "uat-profile-card__state", text: active ? "현재 실행 중" : "UAT 재시작 필요" }),
        el("strong", { text: title }),
        el("p", { text: description }),
      );
    };
    return el(
      "section",
      {
        className: `uat-runtime-banner uat-runtime-banner--${runtimeState}${actualThreeLawRag ? " uat-runtime-banner--actual-rag" : ""}`,
        attrs: {
          role: runtimeState === "safe" ? "status" : "alert",
          "aria-label": "LOCAL UAT 실행 경계",
          "data-uat-metadata": this.state.uatMetadataVerified ? "verified" : "unknown",
          "data-active-evidence-profile": metadata.evidence_profile,
        },
      },
      el(
        "div",
        { className: "uat-runtime-summary" },
        el(
          "div",
          { className: "uat-runtime-heading" },
          el("span", { className: "runtime-status-dot", attrs: { "aria-hidden": "true" } }),
          el(
            "div",
            {},
            el("span", { className: "uat-runtime-heading__label", text: "현재 검증 환경" }),
            el("strong", { text: boundaryTitle }),
          ),
        ),
        el(
          "div",
          { className: "uat-runtime-core-facts" },
          el("span", { text: metadataVerified
            ? metadata.claude_mode === "actual" ? "Claude 실제 호출" : `Claude ${humanize(metadata.claude_mode)}`
            : "Claude 상태 미확인" }),
          el("span", { text: metadataVerified
            ? actualThreeLawRag ? "실제 3법령 RAG" : "합성 Evidence"
            : "Evidence 상태 미확인" }),
          el("span", { text: metadataVerified
            ? `${dataset.observed_law_count}/${dataset.expected_production_law_count} 법령`
            : "법령 범위 미확인" }),
          el("span", { text: metadataVerified
            ? metadata.auto_completion_enabled ? "자동완료 ON" : "자동완료 OFF"
            : "자동완료 상태 미확인" }),
        ),
      ),
      el(
        "div",
        { className: "uat-provenance-boundaries", attrs: { "aria-label": "UAT 자료·Evidence·정책 구분" } },
        ...provenanceStatements.map((statement) => el("p", { text: statement })),
      ),
      el(
        "details",
        { className: "uat-environment-details" },
        el("summary", { text: "실행 환경 및 안전 경계 상세" }),
        el(
          "div",
          { className: "uat-runtime-facts" },
          el("span", { text: `Runtime: ${modeLabel}` }),
          el("span", { text: `Claude: ${humanize(metadata.claude_mode)}` }),
          el("span", {
            className: scopeIsPartial ? "uat-runtime-fact--warning" : "",
            text: `Evidence: ${humanize(metadata.evidence_profile)} · ${evidenceScopeLabel}`,
          }),
          el("span", { text: `Evidence data source: ${metadata.evidence_data_source}` }),
          el("span", {
            className: metadata.evidence_policy_mode === "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY"
              ? "uat-runtime-fact--warning"
              : "",
            text: `Evidence policy: ${metadata.evidence_policy_mode}`,
          }),
          el("span", {
            className: scopeIsPartial ? "uat-runtime-fact--warning" : "",
            text: `Data: ${dataset.observed_law_count}/${dataset.expected_production_law_count} laws · ${dataset.observed_article_count} articles`,
          }),
          el("span", {
            className: "uat-runtime-fact--warning",
            text: `RAG quality evaluated: ${dataset.rag_quality_evaluated ? "YES" : "NO"}`,
          }),
          el("span", { text: `Review 기준일: ${metadata.supported_review_as_of ?? "UNKNOWN"}` }),
          el("span", { text: `Planner: ${humanize(metadata.planner_mode)}` }),
          el("span", {
            className: metadata.auto_completion_enabled ? "uat-runtime-fact--danger" : "",
            text: `Auto-completion: ${metadata.auto_completion_enabled ? "UNSAFE ON" : "OFF"}`,
          }),
          el("span", { text: `Assurance ceiling: ${humanize(metadata.assurance_ceiling)}` }),
        ),
        el(
          "div",
          { className: "uat-profile-grid", attrs: { "aria-label": "Evidence 실행 프로필" } },
          profileCard(
            "synthetic-v3",
            "Synthetic V3",
            "실제 HTTP 계약·XAI·Chat·HITL 사용자 흐름을 검증하지만 Data DB 검색은 수행하지 않습니다.",
          ),
          profileCard(
            "preserved-3law-v3-diagnostic",
            "Actual 3-Law RAG",
            "보존 3개 Store와 미승인 actual-codes human-only 정책의 fail-closed 회귀를 실행합니다.",
          ),
          profileCard(
            "preserved-3law-v3-scenario-eval",
            "실제 3법령 RAG 시나리오 9/9",
            "9개 사용자 시나리오 모두 실제 PostgreSQL structured, Qdrant dense/BM25, Neo4j graph 경로와 TEST-ONLY sealed 정책을 사용합니다.",
          ),
        ),
        el("p", {
          className: "uat-profile-note",
          text: "Evidence 프로필은 Review별 선택값이 아니라 UAT 시작 시 결박되는 실행 환경입니다. 다른 프로필은 Harness로 UAT를 재시작해야 하며 임의 URL이나 credential은 브라우저에서 입력할 수 없습니다.",
        }),
        actualThreeLawRag
          ? el(
              "dl",
              { className: "uat-store-counts", attrs: { "aria-label": "실제 Data 저장소 관측값" } },
              el("dt", { text: "Data source" }),
              el("dd", { text: metadata.evidence_data_source }),
              el("dt", { text: "Policy mode" }),
              el("dd", { text: metadata.evidence_policy_mode }),
              el("dt", { text: "PostgreSQL" }),
              el("dd", { text: `${dataset.store_counts.postgresql_article_count} articles` }),
              el("dt", { text: "Qdrant" }),
              el("dd", { text: `${dataset.store_counts.qdrant_point_count} points` }),
              el("dt", { text: "Neo4j" }),
              el("dd", { text: `${dataset.store_counts.neo4j_article_count} articles` }),
            )
          : null,
        runtimeState === "unknown"
          ? el("p", { className: "notice notice--danger", text: "Backend 실행 metadata를 검증하지 못했습니다. 환경을 복구하기 전에는 심사 결과를 사용하지 마세요." })
          : unsafe
          ? el("p", { className: "notice notice--danger", text: "UAT 안전 불변식이 깨졌습니다. 이 화면의 결과를 신뢰하거나 Production 근거로 사용하지 마세요." })
          : scenarioEval
            ? el("p", { className: "uat-scope-warning", text: "실제 3법령 RAG 사용자 시나리오 9/9 평가입니다. 55개 법령은 범위 밖이고 자동완료는 항상 OFF이며 모든 결과는 사람 검토 대상입니다." })
            : actualThreeLawRag
              ? el("p", { className: "uat-scope-warning", text: "실제 검색 경로의 기능 진단입니다. 55개 법령이 누락되어 전체 법적 coverage와 Production RAG 품질은 입증하지 않습니다." })
              : el("p", { className: "uat-scope-warning", text: "시나리오 기능 PASS는 업무 disposition 또는 Production 승인과 별개입니다." }),
      ),
    );
  }

  private hasRole(...roles: Session["roles"]): boolean {
    return roles.some((role) => this.state.session?.roles.includes(role));
  }

  private requireSession(): Session {
    if (!this.state.session) throw new Error("인증 세션이 없어 요청 식별자를 결박할 수 없습니다.");
    return this.state.session;
  }

  private canWrite(): boolean {
    return this.hasRole("reviewer", "approver", "admin");
  }

  private activeUatEvidenceProfile(): LocalUatEvidenceProfile | null {
    if (!this.state.uatMetadataVerified) return null;
    const profile = this.state.uatMetadata.evidence_profile;
    return LOCAL_UAT_EVIDENCE_PROFILES.includes(profile as LocalUatEvidenceProfile)
      ? profile as LocalUatEvidenceProfile
      : null;
  }

  private scenarioSupportsActiveProfile(scenario: LocalUatScenario): boolean {
    const profile = this.activeUatEvidenceProfile();
    return profile !== null && localUatScenarioSupportsProfile(scenario, profile);
  }

  private canApprove(): boolean {
    return this.hasRole("approver", "admin");
  }

  private canDecideProposal(proposal: CorrectionProposal, run: ReviewRun): boolean {
    return this.proposalDecisionBlockReason(proposal, run) === undefined;
  }

  private proposalDecisionBlockReason(proposal: CorrectionProposal, run: ReviewRun): string | undefined {
    const current = this.state.selectedCase;
    const session = this.state.session;
    if (!this.canApprove() || !current || !session) return "현재 역할에는 제안 결정 권한이 없습니다.";
    if (proposal.created_by === session.subject) return "자신이 만든 revision 제안은 결정할 수 없습니다.";
    if (proposal.status !== "pending") return "이미 종결된 제안입니다.";
    if (
      proposal.org_id !== session.org_id
      || proposal.case_id !== current.case_id
      || proposal.review_run_id !== run.review_run_id
      || proposal.parent_result_digest !== run.result_digest
      || proposal.parent_input_manifest_sha256 !== run.agent_input_manifest_sha256
      || proposal.case_revision !== current.revision
    ) return "Proposal의 parent result·input manifest·Case revision 계보가 현재 Run과 일치하지 않습니다.";
    const correctionTargets = new Set(run.fields
      .filter((field) => field.document_id !== "unbound-document")
      .map((field) => `${field.document_id}\u0000${field.field_path}`));
    const knownSources = new Set(run.sources.map((source) => source.source_id));
    const confirmableSources = new Set(run.fields.flatMap((field) => field.source_ids)
      .filter((sourceId) => knownSources.has(sourceId)));
    const supportingDocuments = new Set(this.state.supportingDocuments.map((document) => document.document_id));
    const corrections = [
      ...proposal.corrections,
      ...proposal.actions.flatMap((action) => action.correction ? [action.correction] : []),
    ];
    if (corrections.some((correction) => !correctionTargets.has(`${correction.document_id}\u0000${correction.field_path}`))) {
      return "Proposal correction이 현재 Run의 알려진 추출 필드를 가리키지 않습니다.";
    }
    if (proposal.actions.some((action) => (
      action.confirmed_reference_id !== undefined
      && action.confirmed_reference_id !== null
      && !confirmableSources.has(action.confirmed_reference_id)
    ))) return "Proposal 확인 대상이 현재 Run의 알려진 FactLedger 원문 근거가 아닙니다.";
    if (proposal.actions.some((action) => (
      action.supporting_document_id !== undefined
      && action.supporting_document_id !== null
      && !supportingDocuments.has(action.supporting_document_id)
    ))) return "Proposal 요건서류가 현재 Case에 등록된 문서가 아닙니다.";
    return undefined;
  }

  private canChat(): boolean {
    return this.hasRole("reviewer", "approver", "admin");
  }

  private renderSidebar(): HTMLElement {
    const caseSearch = el("input", {
      attrs: {
        type: "search",
        placeholder: "현재 목록에서 제목·참조번호 검색",
        "aria-label": "현재 Case 목록 검색",
        autocomplete: "off",
      },
      on: {
        input: (event) => {
          const query = event.currentTarget instanceof HTMLInputElement
            ? event.currentTarget.value.trim().toLocaleLowerCase("ko-KR")
            : "";
          for (const card of this.root.querySelectorAll<HTMLElement>(".case-card[data-search]")) {
            card.hidden = query.length > 0 && !String(card.dataset.search ?? "").includes(query);
          }
        },
      },
    });
    const createForm = el(
      "form",
      {
        className: "compact-form",
        on: { submit: (event) => void this.handleCreateCase(event) },
      },
      labeledControl("Case 제목", el("input", { attrs: { name: "title", required: "", maxlength: "200", ...disabledUnless(this.canWrite() && !this.state.busy) } })),
      labeledControl("외부 참조", el("input", { attrs: { name: "reference", maxlength: "200", ...disabledUnless(this.canWrite() && !this.state.busy) } })),
      el("button", { className: "button button--primary", text: "Case 생성", attrs: { type: "submit", ...disabledUnless(this.canWrite() && !this.state.busy) } }),
    );
    const activeProfile = this.activeUatEvidenceProfile();
    const profileGroups = ([
      { profile: "preserved-3law-v3-scenario-eval", label: "실제 3법령 RAG 시나리오 9/9" },
      { profile: "synthetic-v3", label: "Synthetic V3 회귀" },
      { profile: "preserved-3law-v3-diagnostic", label: "Actual 3-Law 미승인 정책 진단 회귀" },
    ] satisfies Array<{
      profile: LocalUatEvidenceProfile;
      label: string;
    }>).sort((left, right) => (
      left.profile === activeProfile ? -1 : right.profile === activeProfile ? 1 : 0
    ));
    const scenarioSelect = el(
      "select",
      { attrs: { name: "scenario", "aria-label": "UAT 시나리오", ...disabledUnless(this.canWrite() && !this.state.busy) } },
      ...profileGroups.map(({ profile, label }) => el(
        "optgroup",
        { attrs: { label: `${label}${profile === activeProfile ? " · 현재 실행" : " · 재시작 필요"}` } },
        ...UAT_SCENARIOS
          .filter((scenario) => localUatScenarioSupportsProfile(scenario, profile))
          .map((scenario) => {
            const variant = localUatScenarioVariant(scenario, profile);
            const compatible = profile === activeProfile;
            return el("option", {
              text: `${variant.title}${variant.requires_approver ? " · 별도 approver 검증 필요" : ""}${compatible ? "" : " · 현재 비활성"}`,
              attrs: {
                value: `${profile}|${scenario.scenario_id}`,
                ...(compatible ? {} : { disabled: "" }),
              },
            });
          }),
      )),
    );
    const scenarioForm = el(
      "form",
      { className: "compact-form", on: { submit: (event) => void this.handleScenario(event) } },
      el("p", { className: "section-help", text: "합성 통관 문서를 실제 Backend·Claude·Agent 경로에 등록합니다. Evidence 프로필은 process-wide이며 Case별로 바꿀 수 없습니다." }),
      labeledControl("시나리오", scenarioSelect),
      el("button", { className: "button button--secondary", text: "시나리오 Case 생성", attrs: { type: "submit", ...disabledUnless(this.canWrite() && !this.state.busy) } }),
    );
    return el(
      "aside",
      { className: "sidebar", attrs: { "aria-label": "Case 탐색" } },
      el(
        "div",
        { className: "sidebar-heading" },
        el("div", {}, el("p", { className: "eyebrow", text: "REVIEW QUEUE" }), el("h2", { text: "심사 업무함" })),
        el("span", {
          className: "case-count",
          text: `표시 ${this.state.cases.length}건`,
        }),
      ),
      labeledControl("Case 검색", caseSearch),
      el(
        "nav",
        { className: "case-list", attrs: { "aria-label": "Case 목록" } },
        ...this.state.cases.map((item) =>
          el(
            "button",
            {
              className: `case-card${this.state.selectedCase?.case_id === item.case_id ? " is-selected" : ""}`,
              attrs: {
                 type: "button",
                 "aria-current": this.state.selectedCase?.case_id === item.case_id ? "page" : "false",
                 "data-case-id": item.case_id,
                 "data-case-external-reference": item.external_reference ?? "",
                 "data-search": `${item.title} ${item.external_reference ?? item.case_id}`.toLocaleLowerCase("ko-KR"),
                 ...disabledUnless(!this.state.busy),
               },
              on: { click: () => void this.openCase(item.case_id) },
            },
            el("strong", { text: item.title }),
            el("span", { text: item.external_reference ?? item.case_id }),
            el("small", { text: `${humanize(item.status)} · ${formatDate(item.updated_at)}` }),
          ),
        ),
      ),
      el("details", { className: "sidebar-panel sidebar-panel--create" }, el("summary", { text: "새 Case 만들기" }), createForm),
      el("details", { className: "sidebar-panel sidebar-panel--test-lab" }, el("summary", { text: "Test Lab · UAT 시나리오" }), scenarioForm),
      el("p", { className: "diagnostic-label", text: "UAT 데이터는 합성 자료이며 법적 판단 자료가 아닙니다." }),
      !this.canWrite() ? el("p", { className: "section-help", text: "현재 역할은 읽기 전용이므로 Case나 심사를 생성할 수 없습니다." }) : null,
    );
  }

  private renderWelcome(): HTMLElement {
    return el(
      "section",
      { className: "welcome" },
      el(
        "div",
        { className: "welcome-hero" },
        el("p", { className: "eyebrow", text: "REVIEW OPERATIONS" }),
        el("h1", { text: "오늘의 통관 사전심사를 시작하세요." }),
        el("p", { className: "welcome-lead", text: "문서 원문, 추출값, 불일치, 법령 Evidence와 사람 결정을 하나의 검증 가능한 Run 이력으로 검토합니다." }),
        el(
          "div",
          { className: "welcome-actions" },
          el("button", {
            className: "button button--primary",
            text: "새 Case 시작",
            attrs: { type: "button", ...disabledUnless(this.canWrite() && !this.state.busy) },
            on: {
              click: () => {
                const panel = this.root.querySelector<HTMLDetailsElement>(".sidebar-panel--create");
                if (!panel) return;
                panel.open = true;
                panel.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
              },
            },
          }),
          el("span", {
            text: `현재 표시 ${this.state.cases.length}건`,
            className: "welcome-case-count",
          }),
        ),
      ),
      el(
        "div",
        { className: "welcome-capabilities", attrs: { "aria-label": "주요 심사 기능" } },
        el(
          "article",
          { className: "capability-card" },
          el("span", { className: "capability-card__index", text: "01" }),
          el("h2", { text: "문서 준비" }),
          el("p", { text: "CI·PL·B/L·C/O 텍스트와 요건서류를 Case 단위로 등록합니다." }),
        ),
        el(
          "article",
          { className: "capability-card" },
          el("span", { className: "capability-card__index", text: "02" }),
          el("h2", { text: "AI 사전심사" }),
          el("p", { text: "Claude 분석, 결정론적 정합성 검증, 법령 Evidence 조회를 실행합니다." }),
        ),
        el(
          "article",
          { className: "capability-card" },
          el("span", { className: "capability-card__index", text: "03" }),
          el("h2", { text: "검토와 결정" }),
          el("p", { text: "XAI 보고서, 수정 제안, 독립 승인과 재심사 이력을 확인합니다." }),
        ),
      ),
      el(
        "section",
        { className: "welcome-guide", attrs: { "aria-labelledby": "welcome-guide-title" } },
        el("div", {}, el("p", { className: "eyebrow", text: "HOW IT WORKS" }), el("h2", { text: "검증 가능한 3단계 심사 흐름", attrs: { id: "welcome-guide-title" } })),
        el(
          "ol",
          { className: "workflow-guide" },
          el("li", {}, el("strong", { text: "Case와 문서를 준비합니다." }), el("span", { text: "원문 hash와 문서 유형을 Backend 원장에 보존" })),
          el("li", {}, el("strong", { text: "Agent가 분석하고 근거를 조회합니다." }), el("span", { text: "분류·추출·검증·Evidence·설명 단계 실행" })),
          el("li", {}, el("strong", { text: "사람이 확인하고 후속 조치를 결정합니다." }), el("span", { text: "maker-checker 승인과 child Run lineage 유지" })),
        ),
      ),
    );
  }

  private renderCase(): HTMLElement {
    const caseItem = this.state.selectedCase;
    if (!caseItem) return empty("Case가 선택되지 않았습니다.");
    const activeStage = this.jobIsActive() ? 2 : this.state.selectedRun ? 3 : 1;
    const step = (index: number, title: string, description: string): HTMLElement =>
      el(
        "li",
        {
          className: `case-step${index < activeStage ? " case-step--complete" : ""}${index === activeStage ? " case-step--active" : ""}`,
          attrs: { "aria-current": index === activeStage ? "step" : "false" },
        },
        el("span", { className: "case-step__number", text: index < activeStage ? "✓" : String(index), attrs: { "aria-hidden": "true" } }),
        el("div", {}, el("strong", { text: title }), el("small", { text: description })),
      );
    return el(
      "div",
      {
        className: "case-workspace",
        attrs: {
          "data-selected-case-id": caseItem.case_id,
          "data-selected-case-external-reference": caseItem.external_reference ?? "",
        },
      },
      el(
        "section",
        { className: "case-heading" },
        el(
          "div",
          { className: "case-heading__title" },
          el("nav", { className: "breadcrumbs", attrs: { "aria-label": "현재 위치" } }, el("span", { text: "심사 업무함" }), el("span", { text: "/" }), el("span", { text: caseItem.external_reference ?? caseItem.case_id })),
          el("h1", { text: caseItem.title }),
          el("p", { text: "문서 준비부터 AI 사전심사, 사람의 최종 검토까지 이 Case의 모든 변경 이력을 관리합니다." }),
        ),
        el(
          "div",
          { className: "case-heading__meta" },
          el("span", { className: `case-status case-status--${caseItem.status}`, text: humanize(caseItem.status) }),
          el("span", { className: "case-meta", text: `Revision ${caseItem.revision}` }),
        ),
      ),
      el(
        "ol",
        { className: "case-stepper", attrs: { "aria-label": "Case 심사 진행 단계" } },
        step(1, "문서 준비", "원문과 요건서류 등록"),
        step(2, "AI 사전심사", "분석·정합성·Evidence 조회"),
        step(3, "검토와 결정", "보고서·HITL·이력 확인"),
      ),
      el("div", { className: "text-only-boundary", text: "현재 Release는 텍스트 문서만 처리합니다. PDF·이미지·OCR 업로드는 차단되어 있습니다." }),
      this.renderInputAndRun(),
      this.state.selectedRun ? this.renderReview(this.state.selectedRun) : this.renderNoRun(),
    );
  }

  private renderInputAndRun(): HTMLElement {
    const reviewDateReady = this.state.uatMetadataVerified
      && this.state.uatMetadata.supported_review_as_of !== null;
    const typeSelect = el(
      "select",
      { attrs: { name: "document_type", required: "", ...disabledUnless(this.canWrite() && !this.state.busy) } },
      ...["CI", "PL", "BL", "CO", "SUPPORTING", "UNKNOWN"].map((value) => el("option", { text: value, attrs: { value } })),
    );
    const primaryDocuments = this.state.documents.filter((document) => document.document_type !== "SUPPORTING");
    const primaryTextCharacters = primaryDocuments.reduce((total, document) => total + document.character_count, 0);
    const form = el(
      "form",
      { className: "document-form", on: { submit: (event) => void this.handleAddDocument(event) } },
      labeledControl("문서 유형", typeSelect),
      labeledControl(
        "파일명",
        el("input", { attrs: { name: "filename", required: "", maxlength: "255", pattern: ".*\\.txt$", placeholder: "commercial-invoice.txt", ...disabledUnless(this.canWrite() && !this.state.busy) } }),
        ".txt 이름만 허용",
      ),
      labeledControl(
        "문서 원문",
        el("textarea", { attrs: { name: "content_text", required: "", maxlength: String(MAX_DOCUMENT_TEXT_CHARACTERS), rows: "8", placeholder: "추출된 텍스트를 입력하세요.", ...disabledUnless(this.canWrite() && !this.state.busy) } }),
        `문서당 최대 ${MAX_DOCUMENT_TEXT_CHARACTERS.toLocaleString()}자`,
      ),
      el("button", { className: "button button--secondary", text: "텍스트 문서 등록", attrs: { type: "submit", ...disabledUnless(this.canWrite() && !this.state.busy) } }),
    );
    const runList = el(
      "div",
      { className: "run-list" },
      ...this.state.runs.map((run) =>
        el(
          "button",
          {
            className: `run-chip${this.state.selectedRun?.review_run_id === run.review_run_id ? " is-selected" : ""}`,
            text: `${run.review_run_id.slice(0, 10)} · ${humanize(run.execution_status)}`,
            attrs: {
              type: "button",
              "data-review-run-id": run.review_run_id,
              ...disabledUnless(!this.state.busy),
            },
            on: { click: () => void this.openRun(run.review_run_id) },
          },
        ),
      ),
    );
    return el(
      "section",
      { className: "input-panel", attrs: { "aria-labelledby": "case-input-title" } },
      el("div", { className: "section-title-row" }, el("h2", { text: "문서와 실행", attrs: { id: "case-input-title" } }), el("button", { className: "button button--primary", text: "새 심사 실행", attrs: { type: "button", ...disabledUnless(this.canWrite() && !this.state.busy && !this.jobIsActive() && reviewDateReady) }, on: { click: () => void this.enqueueReview() } })),
      reviewDateReady
        ? el("p", { className: "section-help", text: `Backend 지원 기준일 ${this.state.uatMetadata.supported_review_as_of}로 고정해 심사합니다.` })
        : el("p", { className: "notice notice--warning", text: "검증된 Backend 지원 기준일이 없어 새 심사를 차단했습니다." }),
      el("p", { className: "section-help", text: `심사 입력 ${primaryDocuments.length}/${MAX_PRIMARY_DOCUMENTS}문서 · ${primaryTextCharacters.toLocaleString()}/${MAX_PRIMARY_TEXT_CHARACTERS.toLocaleString()}자 (SUPPORTING 원문 제외)` }),
      el("details", {}, el("summary", { text: `텍스트 문서 등록 (${this.state.documents.length})` }), form),
      this.renderSupportingDocuments(),
      this.state.job ? this.renderJob(this.state.job) : null,
      this.shouldRenderPendingRecovery() ? this.renderPendingRecovery() : null,
      runList.childElementCount > 0 ? runList : empty("아직 심사 Run이 없습니다."),
    );
  }

  private renderSupportingDocuments(): HTMLElement {
    const sourceDocuments = this.state.documents.filter((document) => document.document_type === "SUPPORTING");
    const sourceSelect = el(
      "select",
      { attrs: { name: "document_id", required: "", ...disabledUnless(this.canWrite() && !this.state.busy && sourceDocuments.length > 0) } },
      ...sourceDocuments.map((document) => el("option", { text: `${document.filename} · ${document.content_sha256.slice(0, 12)}…`, attrs: { value: document.document_id } })),
    );
    const form = el(
      "form",
      { className: "supporting-form", on: { submit: (event) => void this.handleSupportingDocument(event) } },
      labeledControl("원문 SUPPORTING 문서", sourceSelect),
      labeledControl("문서 코드", el("input", { attrs: { name: "document_code", required: "", maxlength: "128", ...disabledUnless(this.canWrite() && !this.state.busy) } })),
      labeledControl("발급기관", el("input", { attrs: { name: "issuer", required: "", maxlength: "512", ...disabledUnless(this.canWrite() && !this.state.busy) } })),
      labeledControl("문서번호", el("input", { attrs: { name: "document_number", required: "", maxlength: "256", ...disabledUnless(this.canWrite() && !this.state.busy) } })),
      labeledControl("발급일", el("input", { attrs: { name: "issued_on", type: "date", required: "", ...disabledUnless(this.canWrite() && !this.state.busy) } })),
      labeledControl("유효기간", el("input", { attrs: { name: "valid_until", type: "date", ...disabledUnless(this.canWrite() && !this.state.busy) } })),
      labeledControl("대상품목 ID", el("input", { attrs: { name: "subject_item_ids", required: "", placeholder: "item-1, item-2", ...disabledUnless(this.canWrite() && !this.state.busy) } }), "쉼표로 구분"),
      labeledControl("HSK", el("input", { attrs: { name: "hs_codes", placeholder: "0303540000", ...disabledUnless(this.canWrite() && !this.state.busy) } }), "쉼표로 구분"),
      el("button", { className: "button button--secondary", text: "요건서류 메타데이터 등록", attrs: { type: "submit", ...disabledUnless(this.canWrite() && !this.state.busy && sourceDocuments.length > 0) } }),
    );
    return el(
      "details",
      { className: "supporting-documents" },
      el("summary", { text: `요건서류 검증 (${this.state.supportingDocuments.length})` }),
      el("p", { className: "section-help", text: "텍스트 원문의 SHA-256과 발급·유효기간·대상품목·HSK를 결박합니다. 문서 코드만 선언한 것은 검증 assertion이 아닙니다." }),
      sourceDocuments.length > 0 ? form : empty("먼저 문서 유형 SUPPORTING으로 원문 텍스트를 등록하세요."),
      ...this.state.supportingDocuments.map((document) => this.renderSupportingDocument(document)),
    );
  }

  private renderSupportingDocument(document: SupportingDocumentRecord): HTMLElement {
    const canAssert = this.canApprove() && document.created_by !== this.state.session?.subject;
    const assertionForm = el(
      "form",
      { className: "assertion-form", on: { submit: (event) => void this.handleSupportingAssertion(event, document.document_id) } },
      el("p", { className: "section-help", text: "검증 출처 hash·승인자·정책 버전은 Backend가 로그인 주체와 SUPPORTING 원문에서 생성합니다." }),
      el("button", { className: "button button--primary", text: "human_approver assertion 기록", attrs: { type: "submit", ...disabledUnless(canAssert && !this.state.busy) } }),
    );
    return el(
      "article",
      { className: "supporting-record" },
      el("strong", { text: `${document.document_code} · ${document.document_number}` }),
      el("p", { text: `${document.issuer} · ${document.issued_on} ~ ${document.valid_until ?? "만료일 없음"}` }),
      el("small", { text: `HSK ${document.hs_codes.join(", ") || "미지정"} · source ${document.source_sha256.slice(0, 12)}…` }),
      document.verification_assertions.length > 0
        ? el("ul", { className: "assertion-list" }, ...document.verification_assertions.map((assertion) =>
            el(
              "li",
              {},
              el("strong", { text: `${assertion.method} · ${assertion.receipt ? "Backend가 제공한 signed receipt" : "서명 없는 진단 기록"}` }),
              el("span", { text: `${assertion.asserted_by} · ${assertion.authority_id}@${assertion.authority_release}` }),
              el("small", { text: `source ${assertion.source_reference_sha256.slice(0, 12)}… · ${formatDate(assertion.asserted_at)}` }),
              assertion.receipt
                ? el(
                    "small",
                    { className: "signed-receipt" },
                    `receipt ${assertion.receipt.key_id} · policy ${assertion.receipt.policy_release} · signed ${formatDate(assertion.receipt.signed_at)} · expires ${formatDate(assertion.receipt.expires_at)} · 브라우저는 서명을 직접 검증하지 않음`,
                  )
                : el("small", { className: "danger-text", text: "Agent trust root에 검증할 receipt가 없으므로 자동완료 근거가 아닙니다." }),
            )))
        : el("p", { className: "notice notice--warning", text: "검증 assertion이 없어 자동완료에 사용할 수 없습니다." }),
      canAssert
        ? assertionForm
        : el("p", { className: "section-help", text: this.canApprove() ? "작성자와 다른 approver가 검증해야 합니다(maker-checker)." : "검증 assertion은 작성자와 다른 approver만 기록할 수 있습니다." }),
    );
  }

  private renderJob(job: JobRecord): HTMLElement {
    const uncertain = job.status === "delivery_uncertain";
    const persistenceUncertain = job.status === "response_persistence_uncertain";
    const rejected = job.status === "response_received_rejected";
    const active = job.status === "queued" || job.status === "running";
    const observationPaused = this.jobObservationPausedReason !== undefined;
    const canReconcile = uncertain && this.canApprove() && this.isTrackedJobForCurrentCase(job);
    const completedStages = this.state.liveStages.filter((stage) => stage.status === "succeeded");
    const currentStage = [...this.state.liveStages]
      .reverse()
      .find((stage) => stage.status === "running" || stage.status === "pending")
      ?? [...this.state.liveStages].reverse().find((stage) => stage.status === "succeeded");
    const createdAtMs = Date.parse(job.created_at);
    const trackingStartedAt = Number.isNaN(createdAtMs)
      ? (this.jobTrackingStartedAtMs ?? Date.now())
      : createdAtMs;
    const observedAt = observationPaused
      ? (this.jobObservationPausedAtMs ?? Date.now())
      : Date.now();
    const elapsed = Math.max(0, observedAt - trackingStartedAt);
    const currentPhase = job.status === "queued"
      ? "실행 대기 및 Worker 연결"
      : job.status === "running"
        ? currentStage
          ? reviewStageLabel(currentStage.stage)
          : job.agent_call_state === "started"
            ? "Claude 문서 분석 및 Agent 심사"
            : "Agent 실행 준비"
        : jobStatusLabel(job.status);
    return el(
      "div",
      {
        className: `job-status${uncertain || persistenceUncertain ? " job-status--uncertain" : ""}${rejected ? " job-status--rejected" : ""}${observationPaused ? " job-status--paused" : ""}`,
        attrs: {
          role: "status",
          "aria-live": "polite",
          "data-review-progress": job.status,
        },
      },
      el(
        "div",
        { className: "job-status__heading" },
        el("div", {},
          el("span", { className: "eyebrow", text: "AI REVIEW STATUS" }),
          el("strong", {
            text: observationPaused
              ? "심사 상태 자동 관측이 중단되었습니다"
              : active
                ? "AI 사전심사를 실행하고 있습니다"
                : jobStatusLabel(job.status),
          }),
        ),
        el("span", {
          className: `job-state-pill job-state-pill--${job.status}`,
          text: observationPaused ? "재연결 필요" : jobStatusLabel(job.status),
        }),
      ),
      observationPaused
        ? el(
            "div",
            {
              className: "notice notice--warning",
              attrs: {
                "data-job-observation": "paused",
                role: "alert",
              },
            },
            el("strong", { text: "마지막으로 확인한 상태 이후의 진행 상황은 아직 확인되지 않았습니다." }),
            el("p", {
              text: this.jobObservationPausedReason
                ?? "상태 관측을 다시 시작하려면 동일 Job을 조회하세요.",
            }),
            el("button", {
              className: "button button--secondary",
              text: "동일 Job 상태 다시 확인",
              attrs: { type: "button", ...disabledUnless(!this.state.busy) },
              on: { click: () => void this.reconcileTrackedJob(job.job_id) },
            }),
          )
        : null,
      active || observationPaused
        ? el(
            "div",
            {
              className: observationPaused
                ? "review-progress-summary review-progress-summary--paused"
                : "review-progress-summary",
            },
            el("div", {}, el("span", { text: observationPaused ? "마지막 확인 단계" : "현재 단계" }), el("strong", { text: currentPhase })),
            el("div", {}, el("span", { text: observationPaused ? "마지막 관측 경과" : "경과 시간" }), el("strong", { text: formatElapsed(elapsed) })),
            el("div", {}, el("span", { text: "일반적인 소요 시간" }), el("strong", { text: REVIEW_TYPICAL_MINUTES })),
            el("div", {}, el("span", { text: observationPaused ? "확인된 완료 단계" : "완료 단계" }), el("strong", { text: `${completedStages.length}개` })),
          )
        : el("p", { className: "job-terminal-explanation", text: jobStatusExplanation(job) }),
      active && !observationPaused
        ? el(
            "div",
            { className: "review-progress-track", attrs: { role: "progressbar", "aria-label": "AI 사전심사 진행 중", "aria-valuetext": currentPhase } },
            el("span", { attrs: { "aria-hidden": "true" } }),
          )
        : null,
      active && !observationPaused
        ? el("p", {
            className: "section-help",
            text: "표시 시간은 실제 경과 시간입니다. 4~7분은 현재 UAT 실행 기록에 따른 범위이며 정확한 완료 시각이나 진행률을 보장하지 않습니다.",
          })
        : null,
      (active || observationPaused) && completedStages.length > 0
        ? el("p", {
            className: "review-progress-completed",
            text: `${observationPaused ? "마지막으로 확인된 완료 단계" : "완료된 단계"}: ${completedStages.map((stage) => reviewStageLabel(stage.stage)).join(" · ")}`,
          })
        : null,
      job.error_code
        ? el("details", { className: "job-error-detail" }, el("summary", { text: "기술 원인 코드" }), el("code", { text: job.error_code }))
        : null,
      uncertain
        ? el("p", { className: "notice notice--warning", text: "Agent 전달 결과를 확정할 수 없어 이 Case의 새 심사를 차단했습니다. 재조회로 다른 운영자가 이미 종결했는지 확인하거나, 독립 증거가 있는 Approver/Admin만 미처리를 확정할 수 있습니다." })
        : null,
      persistenceUncertain
        ? el("p", { className: "notice notice--danger", text: "Agent 응답은 도착했지만 Review Run 저장 완료 여부를 확정할 수 없습니다. 같은 심사를 다시 실행하면 중복 처리될 수 있으므로 새 실행을 차단합니다. 운영자가 Backend 원장과 감사 로그를 확인해야 합니다." })
        : null,
      rejected
        ? el("p", { className: "notice notice--danger", text: "Agent 응답이 Backend 계약 또는 안전 검증을 통과하지 못해 결과를 저장하지 않았습니다. 잘못된 결과는 사용자에게 공개되지 않았으며 원인 수정 후 새 심사를 실행할 수 있습니다." })
        : null,
      uncertain
        ? el("button", {
            className: "button button--secondary",
            text: "저장된 Job 상태 다시 확인",
            attrs: {
              type: "button",
              ...disabledUnless(!this.state.busy),
            },
            on: { click: () => void this.reconcileTrackedJob(job.job_id) },
          })
        : null,
      canReconcile
        ? el(
            "form",
            {
              className: "reconciliation-form",
              attrs: { "aria-label": "Agent 전달 불확실성 운영 대조" },
              on: { submit: (event) => void this.handleDeliveryReconciliation(event, job) },
            },
            el("p", { className: "section-help", text: "Agent가 이 요청을 처리하지 않았다는 독립 운영 증거가 있을 때만 해소할 수 있습니다." }),
            labeledControl(
              "운영 증거 SHA-256",
              el("input", {
                attrs: {
                  name: "evidence_reference_sha256",
                  required: "",
                  minlength: "64",
                  maxlength: "64",
                  pattern: "[a-f0-9]{64}",
                  autocomplete: "off",
                  ...disabledUnless(!this.state.busy),
                },
              }),
            ),
            labeledControl(
              "대조 사유",
              el("textarea", {
                attrs: {
                  name: "reason",
                  required: "",
                  minlength: "10",
                  maxlength: "2000",
                  rows: "3",
                  ...disabledUnless(!this.state.busy),
                },
              }),
            ),
            labeledControl(
              "차단 해제 확인",
              el("input", {
                attrs: {
                  name: "confirmed_not_processed",
                  type: "checkbox",
                  value: "confirmed",
                  required: "",
                  ...disabledUnless(!this.state.busy),
                },
              }),
              "단순 timeout이 아니라 Agent 미수신을 입증하는 증거임을 확인",
            ),
            el("button", {
              className: "button button--danger",
              text: "미처리 증거로 차단 해소",
              attrs: { type: "submit", ...disabledUnless(!this.state.busy) },
            }),
          )
        : uncertain
          ? el("p", { className: "section-help", text: this.canApprove()
            ? "현재 화면의 Job·Case·복구 식별자가 정확히 결박되지 않아 차단 해소를 거절했습니다. 저장된 Job을 다시 불러오세요."
            : "Approver 또는 Admin 권한이 독립 운영 증거를 확인한 뒤에만 차단을 해소할 수 있습니다." })
          : null,
      this.state.liveStages.length > 0
        ? el(
            "ol",
            { className: "live-stages", attrs: { "aria-label": "실시간 심사 진행 단계" } },
            ...this.state.liveStages.map((stage) =>
              el(
                "li",
                { className: `live-stage live-stage--${stage.status}` },
                el("strong", { text: reviewStageLabel(stage.stage) }),
                el("span", { text: `${reviewStageStatusLabel(stage.status)} · ${reviewStageMessage(stage.message)}` }),
              ),
            ),
          )
        : el("span", { className: "section-help", text: "실행 단계 이벤트를 기다리는 중입니다." }),
    );
  }

  private jobIsActive(): boolean {
    const caseId = this.state.selectedCase?.case_id;
    return this.state.job?.status === "queued"
      || this.state.job?.status === "running"
      || this.state.job?.status === "delivery_uncertain"
      || this.state.job?.status === "response_persistence_uncertain"
      || (caseId !== undefined && this.recoveryByCase.has(caseId));
  }

  private jobNeedsPolling(): boolean {
    return this.state.job?.status === "queued" || this.state.job?.status === "running";
  }

  private renderPendingRecovery(): HTMLElement | null {
    const current = this.state.selectedCase;
    if (!current) return null;
    const recovery = this.recoveryByCase.get(current.case_id);
    if (!recovery) return null;
    const revisionMatches = recovery.case_revision === current.revision;
    const hasJob = recovery.job_id !== null;
    return el(
      "div",
      { className: "job-status job-status--uncertain", attrs: { role: "status" } },
      el("strong", { text: hasJob ? `저장된 Job ${recovery.job_id!.slice(0, 12)} 재연결 필요` : "심사 요청 응답 확인 필요" }),
      el("span", { text: `Case revision ${recovery.case_revision}` }),
      el("p", { className: "notice notice--warning", text: revisionMatches
        ? hasJob
          ? "저장된 Job에 일시적으로 재연결하지 못했습니다. 새 Agent 호출은 계속 차단됩니다."
          : "Job ID 수신 전 연결이 끊겼을 수 있습니다. 새 호출을 만들지 않고 기존 Idempotency-Key로만 응답을 재조회합니다."
        : "Case revision이 변경되어 저장된 요청을 자동 재조회할 수 없습니다. 운영 대조가 필요합니다." }),
      el("button", {
        className: "button button--secondary",
        text: hasJob ? "저장된 Job 상태 다시 확인" : "동일 요청 키로 안전하게 재조회",
        attrs: { type: "button", ...disabledUnless(revisionMatches && this.canWrite() && !this.state.busy) },
        on: { click: () => void (hasJob ? this.reconcileTrackedJob(recovery.job_id!) : this.resumePendingReview(recovery)) },
      }),
    );
  }

  private shouldRenderPendingRecovery(): boolean {
    const caseId = this.state.selectedCase?.case_id;
    if (!caseId) return false;
    const recovery = this.recoveryByCase.get(caseId);
    return recovery !== undefined && recovery.job_id !== this.state.job?.job_id;
  }

  private renderNoRun(): HTMLElement {
    return el(
      "section",
      { className: "empty-review" },
      el("h2", { text: "심사 결과 없음" }),
      el("p", { text: "필요한 텍스트 문서를 등록한 뒤 심사를 실행하세요. 실행 결과와 업무 판정은 별도로 표시됩니다." }),
    );
  }

  private renderReview(run: ReviewRun): HTMLElement {
    return el(
      "div",
      { className: "review-stack" },
      el(
        "nav",
        { className: "review-section-nav", attrs: { "aria-label": "심사 결과 섹션" } },
        el("a", { text: "AI 심사 브리핑", attrs: { href: "#review-briefing" } }),
        el("a", { text: "판정 상태", attrs: { href: "#review-summary" } }),
        el("a", { text: "설명 보고서", attrs: { href: "#review-report" } }),
        el("a", { text: "통합 검토", attrs: { href: "#review-workspace" } }),
        el("a", { text: "사람 검토", attrs: { href: "#review-actions" } }),
        el("a", { text: "Case Chat", attrs: { href: "#review-chat" } }),
        el("a", { text: "기술 검증", attrs: { href: "#review-technical" } }),
      ),
      this.renderUserBriefing(run),
      this.renderStatus(run),
      this.renderNarrative(run),
      this.renderRequiredActions(run.required_actions),
      this.renderThreePane(run),
      this.renderHitl(run),
      this.renderChat(run),
      el(
        "details",
        { className: "technical-review-details", attrs: { id: "review-technical" } },
        el("summary", { text: "기술 검증 상세 · UAT·실행 추적·감사 이력" }),
        el("p", {
          className: "section-help",
          text: "아래 정보는 개발·감사 검증용입니다. 사용자의 업무 결론과 이유는 위 AI 심사 브리핑과 설명 보고서에서 먼저 확인하세요.",
        }),
        this.renderUatAssertion(run),
        this.renderActionTimeline(run),
        this.renderModelExecution("Review Claude 실행 증거", run.model_execution_summary),
        this.renderParentChildDiff(run),
        this.renderHistory(run),
      ),
    );
  }

  private renderUserBriefing(run: ReviewRun): HTMLElement {
    const issueCount = run.issues.length;
    const findingCount = run.findings.length;
    const totalConcernCount = issueCount + findingCount;
    const report = run.narrative_report;
    const headline = run.assessment === "no_issue_detected"
      ? "제출 문서와 조회된 규정 범위에서 중대한 문제를 발견하지 못했습니다."
      : run.assessment === "issues_detected"
        ? `담당자 확인이 필요한 문제 ${totalConcernCount}건을 발견했습니다.`
        : "현재 근거만으로는 심사 결론을 확정할 수 없습니다.";
    const disposition = run.review_disposition === "auto_review_complete"
      ? "승인된 자동 사전심사 범위에서 검토가 완료되었습니다."
      : run.review_disposition === "human_review_required"
        ? "AI 사전심사는 끝났지만 최종 업무 처리를 위해 담당자 확인이 필요합니다."
        : "필수 근거 또는 실행 단계가 충족되지 않아 처리가 차단되었습니다.";
    const evidence = run.evidence_retrieval;
    const evidenceMeaning = evidence?.status === "ok" && evidence.coverage === "complete"
      ? `법령 Evidence 조회는 정상 완료됐습니다. 조회 결과 ${evidence.result_count}건이며 요건 발견 여부는 ${evidence.requirements_found === null ? "확정되지 않음" : evidence.requirements_found ? "있음" : "없음"}입니다.`
      : evidence === undefined
        ? "법령 Evidence 조회 상태가 공개 결과에 없어 근거 확인이 필요합니다."
        : `법령 Evidence 조회가 ${humanize(evidence.status)}·${humanize(evidence.coverage)} 상태이므로 사람 검토가 필요합니다.`;
    const reasonItems = [
      ...run.issues.slice(0, 3).map((issue) => ({
        id: issue.issue_id,
        title: issue.code,
        text: issue.message,
        citations: issue.source_ids,
      })),
      ...run.findings.slice(0, Math.max(0, 3 - Math.min(issueCount, 3))).map((finding) => ({
        id: finding.finding_id,
        title: finding.title,
        text: finding.detail,
        citations: [...finding.evidence_ids, ...finding.source_ids],
      })),
    ];
    const actionItems = run.required_actions.length > 0
      ? run.required_actions.slice(0, 3).map((action) => ({
          text: action.description,
          citations: action.source_ids,
        }))
      : [{
          text: run.review_disposition === "human_review_required"
            ? "아래 근거와 추출값을 확인한 뒤 승인 또는 수정 제안을 기록하세요."
            : "현재 Run에 별도의 필수 후속 조치는 없습니다.",
          citations: [] as string[],
        }];
    const summaryClaims = report?.summary ?? [];
    return el(
      "section",
      {
        className: `user-briefing user-briefing--${run.assessment}`,
        attrs: {
          id: "review-briefing",
          "aria-labelledby": "review-briefing-title",
          "data-user-briefing": "ready",
        },
      },
      el("p", { className: "eyebrow", text: "AI REVIEW BRIEFING" }),
      el("div", { className: "user-briefing__heading" },
        el("div", {},
          el("h2", { text: "이번 심사 결과를 쉽게 설명해 드립니다", attrs: { id: "review-briefing-title" } }),
          el("p", { className: "user-briefing__headline", text: headline }),
        ),
        el("span", { className: "user-briefing__disposition", text: run.review_disposition === "auto_review_complete" ? "사전심사 완료" : run.review_disposition === "blocked" ? "처리 차단" : "담당자 확인 필요" }),
      ),
      el("p", { className: "user-briefing__meaning", text: disposition }),
      summaryClaims.length > 0
        ? el(
            "div",
            { className: "user-briefing__summary", attrs: { "aria-label": "Agent 설명 요약" } },
            ...summaryClaims.slice(0, 2).map((claim) =>
              el("div", { className: "briefing-claim" }, el("p", { text: claim.text }), this.renderCitationButtons(claim.citation_ids))),
          )
        : null,
      el(
        "div",
        { className: "user-briefing__grid" },
        el(
          "article",
          {},
          el("h3", { text: "왜 이런 결과가 나왔나요?" }),
          reasonItems.length > 0
            ? el(
                "ol",
                { className: "briefing-list" },
                ...reasonItems.map((item) =>
                  el("li", { attrs: { "data-source-id": item.id, tabindex: "-1" } },
                    el("strong", { text: item.title }),
                    el("p", { text: item.text }),
                    this.renderCitationButtons(item.citations))),
              )
            : el("p", { text: "문서 간 핵심 값 비교와 규정 검토에서 별도의 Issue 또는 Finding이 생성되지 않았습니다." }),
        ),
        el(
          "article",
          {},
          el("h3", { text: "법령 근거는 어떻게 확인됐나요?" }),
          el("p", { text: evidenceMeaning }),
          el("small", {
            text: `현재 Run은 Evidence ${run.evidence.length}건과 원문 근거 ${run.sources.length}건에 결박되어 있습니다.`,
          }),
        ),
        el(
          "article",
          {},
          el("h3", { text: "이제 무엇을 해야 하나요?" }),
          el(
            "ul",
            { className: "briefing-list" },
            ...actionItems.map((item) =>
              el("li", {}, el("p", { text: item.text }), item.citations.length > 0 ? this.renderCitationButtons(item.citations) : null)),
          ),
        ),
      ),
      el("p", {
        className: "user-briefing__boundary",
        text: "이 설명은 현재 Run의 문서·Issue·Finding·Evidence에만 결박된 AI 사전심사 결과이며 통관 승인 또는 법적 판단을 대신하지 않습니다.",
      }),
    );
  }

  private renderRequiredActions(actions: RequiredAction[]): HTMLElement {
    return el(
      "section",
      { className: "card required-actions", attrs: { "aria-labelledby": "required-actions-title" } },
      el("h2", { text: `필수 후속 조치 ${actions.length}건`, attrs: { id: "required-actions-title" } }),
      ...(actions.length === 0
        ? [el("p", { className: "positive-text", text: "현재 Run에 등록된 필수 후속 조치가 없습니다." })]
        : actions.map((action) =>
            el(
              "article",
              { className: `required-action required-action--${action.severity ?? "medium"}`, attrs: { "data-source-id": action.action_id, tabindex: "-1" } },
              el("strong", { text: `${action.code} · ${humanize(action.status ?? "required")}` }),
              el("p", { text: action.description }),
              this.renderCitationButtons(action.source_ids),
            ),
          )),
    );
  }

  private renderStatus(run: ReviewRun): HTMLElement {
    const tone = (value: string | undefined): string => {
      if (value === "succeeded" || value === "no_issue_detected" || value === "auto_review_complete" || value === "production") return "positive";
      if (value === "failed" || value === "blocked" || value === "issues_detected") return "negative";
      return "caution";
    };
    return el(
      "section",
      { className: "status-grid", attrs: { id: "review-summary", "aria-label": "분리된 심사 상태" } },
      badge("Agent 심사 완결성", run.execution_status, tone(run.execution_status)),
      badge("문서·규정 평가", run.assessment, tone(run.assessment)),
      badge("업무 처리", run.review_disposition, tone(run.review_disposition)),
      badge("보증 수준", run.assurance_level, tone(run.assurance_level)),
      el(
        "div",
        { className: "eligibility" },
        el("strong", { text: run.completion_eligibility?.eligible ? "자동 사전심사 가능" : "자동 사전심사 보류" }),
        el("span", { text: run.completion_eligibility?.unmet_reason_codes.map(humanize).join(" · ") || "차단 사유 없음" }),
      ),
      run.execution_status === "partial"
        ? el("p", {
            className: "section-help",
            text: "Agent partial은 Job 실패가 아니라 필수 심사 파이프라인 종료 후, 승인되지 않은 선택 조사 항목을 안전하게 보류했다는 뜻입니다.",
          })
        : run.execution_status === "succeeded"
          ? el("p", {
              className: "section-help",
              text: "Agent succeeded는 필수 심사 단계와 이번 Run에서 선택된 Agent action이 모두 끝났다는 뜻이며, Job 처리 성공이나 통관 승인과는 별도입니다.",
            })
          : null,
    );
  }

  private renderUatAssertion(run: ReviewRun): HTMLElement | null {
    const caseId = this.state.selectedCase?.case_id;
    const bound = caseId ? this.scenarioByCase.get(caseId) : undefined;
    if (!bound) return null;
    const { scenario, variant, evidence_profile: caseProfile } = bound;
    const activeProfile = this.activeUatEvidenceProfile();
    const documentAgentChecks: UatCheck[] = [
      this.uatScenarioManifestCheck(bound),
      {
        label: "Case 생성 Evidence 프로필",
        expected: caseProfile,
        actual: caseProfile,
      },
      {
        label: "현재 실행 프로필",
        expected: caseProfile,
        actual: activeProfile ?? "unverified",
        invalid: activeProfile !== caseProfile,
      },
      {
        label: "Review 기준일 결박",
        expected: activeProfile === caseProfile
          ? this.state.uatMetadata.supported_review_as_of ?? "unavailable"
          : "case-profile-runtime-required",
        actual: run.review_as_of ?? "not_available",
        invalid: activeProfile !== caseProfile,
      },
      ...this.uatRuntimeFunctionalChecks(),
      {
        label: "Agent 심사 완결성",
        expected: variant.expected.document_agent.allowed_execution_statuses.join(" | "),
        actual: run.execution_status,
        matches: variant.expected.document_agent.allowed_execution_statuses.some(
          (status) => status === run.execution_status,
        ),
      },
      {
        label: "평가",
        expected: variant.expected.document_agent.assessment,
        actual: run.assessment ?? "not_available",
      },
      ...this.semanticUatChecks(variant.expected.document_agent.semantic, run),
    ];
    const actualRagChecks: UatCheck[] = [
      ...this.evidenceIdentityChecks(bound, run),
      ...this.semanticUatChecks(variant.expected.actual_rag.semantic, run),
    ];
    const policyChecks: UatCheck[] = [
      {
        label: "Evidence 정책 모드",
        expected: variant.expected.policy_release.evidence_policy_mode,
        actual: activeProfile === caseProfile
          ? this.state.uatMetadata.evidence_policy_mode
          : "current_runtime_differs",
        invalid: activeProfile !== caseProfile,
      },
      {
        label: "자동완료",
        expected: String(variant.expected.policy_release.auto_completion_enabled),
        actual: String(this.state.uatMetadata.auto_completion_enabled),
      },
      {
        label: "Production release",
        expected: String(variant.expected.policy_release.production_release),
        actual: String(this.state.uatMetadata.production_release),
      },
      {
        label: "업무 처리",
        expected: variant.expected.policy_release.disposition,
        actual: run.review_disposition ?? "not_available",
      },
      ...(variant.expected.policy_release.unmet_reason_codes ?? []).map((code) => ({
        label: `차단 ${code}`,
        expected: "present",
        actual: run.completion_eligibility?.unmet_reason_codes.includes(code) ? "present" : "missing",
      })),
      ...this.semanticUatChecks(variant.expected.policy_release.semantic, run),
    ];
    const functionalChecks = [...documentAgentChecks, ...actualRagChecks, ...policyChecks];
    const hasInvalidInput = functionalChecks.some((check) => check.invalid === true);
    const hasFunctionalFailure = functionalChecks.some((check) => (
      check.pending !== true && check.invalid !== true && !uatCheckMatches(check)
    ));
    const hasPendingCheck = functionalChecks.some((check) => check.pending === true);
    const functionalState = hasInvalidInput
      ? "invalid"
      : hasFunctionalFailure
        ? "fail"
        : hasPendingCheck
          ? "pending"
          : "pass";
    const axisCard = (
      axis: "document-agent" | "actual-rag" | "policy-release",
      title: string,
      checks: UatCheck[],
    ): HTMLElement => {
      const invalid = checks.some((check) => check.invalid === true);
      const pending = checks.some((check) => check.pending === true);
      const failed = checks.some((check) => (
        check.pending !== true && check.invalid !== true && !uatCheckMatches(check)
      ));
      const state = invalid ? "invalid" : failed ? "fail" : pending ? "pending" : "pass";
      return el(
        "article",
        {
          className: `uat-axis-card uat-axis-card--${state}`,
          attrs: { "data-uat-axis": axis, "data-axis-result": state },
        },
        el("div", { className: "uat-axis-card__heading" },
          el("h3", { text: title }),
          el("span", { text: state.toUpperCase() }),
        ),
        el("div", { className: "uat-checks", attrs: { "aria-label": `${title} 검증` } },
          ...checks.map((check) => this.renderUatCheck(check)),
        ),
      );
    };
    return el(
      "section",
      {
        className: `uat-assertion uat-assertion--${functionalState}`,
        attrs: {
          role: "status",
          "data-case-evidence-profile": caseProfile,
          "data-scenario-manifest-version": "v2",
        },
      },
      el(
        "div",
        {},
        el("span", { className: "eyebrow", text: "PROFILE-BOUND SCENARIO ASSERTION V2" }),
        el("strong", { text: `시나리오 기능: ${functionalState.toUpperCase()}` }),
        el("small", { text: `${variant.title} · ${caseProfile}` }),
      ),
      el(
        "div",
        { className: "uat-axis-grid", attrs: { "aria-label": "UAT 3축 Scorecard" } },
        axisCard("document-agent", "문서·Agent", documentAgentChecks),
        axisCard("actual-rag", "실제 RAG", actualRagChecks),
        axisCard("policy-release", "정책·Release", policyChecks),
      ),
      el("p", { text: variant.description }),
      el("p", { className: "scenario-observation", text: `확인할 진단 관측값: ${variant.diagnostic_observation}` }),
      variant.production_blocked_reason ? el("p", { className: "notice notice--warning", text: `PRODUCTION BLOCKED: ${variant.production_blocked_reason}` }) : null,
      el("small", { text: "UAT 시나리오 assertion은 제한된 기능 진단이며 실제 법적·Production 품질 승인이 아닙니다." }),
    );
  }

  private evidenceIdentityChecks(
    bound: BoundLocalUatScenario,
    run: ReviewRun,
  ): UatCheck[] {
    const expectation = bound.variant.expected.actual_rag.release_identity;
    const identity = run.release_identity;
    if (!expectation.required) {
      return [{
        label: "Review Evidence identity",
        expected: "optional",
        actual: identity === undefined ? "not_available" : "present",
        matches: true,
      }];
    }
    const sha256 = (value: unknown): boolean => (
      typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
    );
    const provenance = run.evidence_provenance;
    const observedMethods = new Set(
      provenance?.ranked_evidence.flatMap((item) => item.retrieval_methods) ?? [],
    );
    const safeTrace = this.state.uatEvidenceTraceStatus === "available"
      ? this.state.uatEvidenceTrace
      : undefined;
    const scenarioTraceChecks: UatCheck[] = bound.evidence_profile === SCENARIO_EVAL_PROFILE
      ? [
          {
            label: "Backend 안전 RAG trace",
            expected: "run-bound",
            actual: safeTrace === undefined ? "unavailable" : "run-bound",
          },
          {
            label: "Trace Knowledge snapshot",
            expected: identity?.evidence_snapshot_id ?? "missing-release-snapshot",
            actual: safeTrace?.knowledge_snapshot_id ?? "unavailable",
          },
          ...(["structured", "dense", "bm25", "graph"] as const).map((stageName) => {
            const stage = safeTrace?.retrieval[stageName];
            const stageLabel = stageName === "structured"
              ? "PostgreSQL Structured"
              : stageName === "dense"
                ? "Qdrant Dense"
                : stageName === "bm25"
                  ? "Qdrant BM25"
                  : "Neo4j Graph";
            return {
              label: `${stageLabel} 실행`,
              expected: "attempted+succeeded",
              actual: stage?.attempted === true && stage.succeeded === true
                ? "attempted+succeeded"
                : "unavailable-or-failed",
            };
          }),
          {
            label: "Neo4j 실행 경로 성공",
            expected: "confirmed",
            actual: safeTrace?.retrieval.graph.succeeded === true ? "confirmed" : "unconfirmed",
          },
          {
            label: "최종 Top-K Graph 포함",
            expected: "observational",
            actual: safeTrace === undefined
              ? "unavailable"
              : safeTrace.retrieval.graph.top_k_count > 0
                ? "included"
                : "not_included",
            matches: safeTrace !== undefined,
          },
        ]
      : [];
    return [
      {
        label: "Review Evidence identity",
        expected: "run-bound",
        actual: identity === undefined ? "missing" : "run-bound",
      },
      ...(expectation.evidence_snapshot_id_required ? [{
        label: "Knowledge snapshot",
        expected: "present",
        actual: typeof identity?.evidence_snapshot_id === "string"
          && identity.evidence_snapshot_id.length > 0
          ? "present"
          : "missing",
      }] : []),
      ...(expectation.evidence_runtime_v3_sha256_required ? [{
        label: "Evidence runtime V3 SHA-256",
        expected: "exact-format",
        actual: sha256(identity?.evidence_runtime_v3_sha256) ? "exact-format" : "missing-or-invalid",
      }] : []),
      {
        label: "Evidence policy identity",
        expected: "present",
        actual: typeof identity?.policy_id === "string" && identity.policy_id.length > 0
          ? "present"
          : "missing",
      },
      ...(bound.evidence_profile === SCENARIO_EVAL_PROFILE ? [{
        label: "Assertion trust-store SHA-256",
        expected: "exact-format",
        actual: sha256(identity?.assertion_trust_store_sha256) ? "exact-format" : "missing-or-invalid",
      }] : []),
      {
        label: "Evidence request mapping",
        expected: "Review Run ↔ Backend trace exact match",
        actual: provenance?.request_id !== undefined
          && safeTrace?.request_id === provenance.request_id
          ? "Review Run ↔ Backend trace exact match"
          : "missing-or-mismatched",
      },
      {
        label: "Evidence provenance projection",
        expected: "present",
        actual: provenance === undefined ? "missing" : "present",
      },
      {
        label: "관측 retrieval method",
        expected: "observational",
        actual: observedMethods.size === 0 ? "none" : [...observedMethods].sort().join("+"),
        matches: true,
      },
      ...scenarioTraceChecks,
    ];
  }

  private uatScenarioManifestCheck(bound: BoundLocalUatScenario): UatCheck {
    const { scenario, variant, evidence_profile: evidenceProfile } = bound;
    const expectedReference = localUatScenarioExternalReference(scenario, evidenceProfile);
    const caseReference = this.state.selectedCase?.external_reference;
    const actualManifest = this.currentUatInputManifest(variant);
    const expectedHash = localUatInputManifestSha256(
      localUatScenarioInputManifest(scenario, evidenceProfile),
    );
    const actualHash = actualManifest === null ? null : localUatInputManifestSha256(actualManifest);
    const exact = caseReference === expectedReference && actualHash === expectedHash;
    return {
      label: "UAT 입력 manifest",
      expected: "exact",
      actual: exact ? "exact" : "drift",
      invalid: !exact,
    };
  }

  private currentUatInputManifest(variant: LocalUatScenarioVariant): LocalUatInputManifest | null {
    const documents = this.state.documents.map((document) => ({
      document_type: document.document_type,
      filename: document.filename,
      media_type: document.media_type,
      content_sha256: document.content_sha256,
    })).sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
    const expectedSupporting = variant.supporting_document;
    if (expectedSupporting === undefined) {
      if (this.state.supportingDocuments.length !== 0) return null;
      return { documents, supporting_document: null };
    }
    if (this.state.supportingDocuments.length !== 1) return null;
    const supporting = this.state.supportingDocuments[0]!;
    const sourceDocuments = this.state.documents.filter((document) => document.document_id === supporting.document_id);
    const invoiceDocuments = this.state.documents.filter((document) => document.document_type === "CI");
    if (sourceDocuments.length !== 1 || invoiceDocuments.length !== 1) return null;
    const source = sourceDocuments[0]!;
    const invoice = invoiceDocuments[0]!;
    if (
      source.document_type !== "SUPPORTING"
      || supporting.subject_item_ids.length !== 1
      || supporting.subject_item_ids[0] !== `${invoice.document_id}_line_1`
    ) return null;
    return {
      documents,
      supporting_document: {
        filename: source.filename,
        document_code: supporting.document_code,
        issuer: supporting.issuer,
        document_number: supporting.document_number,
        issued_on: supporting.issued_on,
        valid_until: supporting.valid_until ?? "",
        hs_codes: [...supporting.hs_codes].sort(),
        source_sha256: supporting.source_sha256,
        subject_item_selector: "CI#line_1",
      },
    };
  }

  private uatRuntimeFunctionalChecks(): UatCheck[] {
    const metadata = this.state.uatMetadata;
    const verified = this.state.uatMetadataVerified;
    const evidenceProfileKnown = LOCAL_UAT_EVIDENCE_PROFILES.includes(
      metadata.evidence_profile as LocalUatEvidenceProfile,
    );
    const evidenceScopeKnown = [
      "TEST_ONLY_V3",
      "ACTUAL_3_LAW_RAG_3_OF_58",
      "ACTUAL_3_LAW_RAG_SCENARIO_EVAL_3_OF_58",
    ].includes(metadata.evidence_scope);
    const evidencePolicyKnown = [
      "SYNTHETIC_FIXTURE",
      "ACTUAL_CODES_HUMAN_ONLY",
      "SEALED_TEST_ONLY_ACTUAL_CCCT_HUMAN_ONLY",
    ].includes(metadata.evidence_policy_mode);
    const evidenceDataSourceKnown = [
      "SYNTHETIC_V3_NO_RAG_QUALITY",
      "ACTUAL_POSTGRESQL_QDRANT_NEO4J_READ_ONLY",
    ].includes(metadata.evidence_data_source);
    const plannerConfigured = metadata.planner_mode === "shadow"
      || metadata.planner_mode === "diagnostic_active";
    return [
      { label: "UAT runtime identity", expected: "verified", actual: verified ? "verified" : "unverified" },
      { label: "Runtime mode", expected: "local_uat", actual: verified ? metadata.mode : "unknown" },
      {
        label: "Supported review date",
        expected: "configured",
        actual: verified && metadata.supported_review_as_of !== null ? "configured" : "unknown",
      },
      { label: "Claude mode", expected: "actual", actual: verified ? metadata.claude_mode : "unknown" },
      {
        label: "Evidence runtime",
        expected: "configured",
        actual: verified
          && evidenceProfileKnown
          && evidenceScopeKnown
          && evidencePolicyKnown
          && evidenceDataSourceKnown
          ? "configured"
          : "unknown",
      },
      {
        label: "Planner runtime",
        expected: "configured",
        actual: verified && plannerConfigured ? "configured" : "unknown",
      },
      { label: "Input release", expected: "text_only", actual: verified && metadata.text_only ? "text_only" : "unknown" },
      {
        label: "Auto-completion safety",
        expected: "off",
        actual: verified ? (metadata.auto_completion_enabled ? "on" : "off") : "unknown",
      },
      {
        label: "Production release",
        expected: "false",
        actual: verified ? String(metadata.production_release) : "unknown",
      },
    ];
  }

  private renderUatCheck(check: UatCheck): HTMLElement {
    const pass = uatCheckMatches(check);
    const result = check.invalid ? "invalid" : check.pending ? "pending" : pass ? "pass" : "fail";
    return el("span", {
      className: `uat-check--${result}`,
      text: `${check.label}: ${humanize(check.actual)} / expected ${humanize(check.expected)}`,
      attrs: { "data-check-result": result },
    });
  }

  private semanticUatChecks(
    semantic: LocalUatSemanticExpectation,
    run: ReviewRun,
  ): UatCheck[] {
    const checks: UatCheck[] = [];
    const includeCodes = (
      label: string,
      expectedCodes: string[] | undefined,
      actualCodes: string[],
    ): void => {
      for (const code of expectedCodes ?? []) {
        checks.push({
          label: `${label} ${code}`,
          expected: "present",
          actual: actualCodes.includes(code) ? "present" : "missing",
        });
      }
    };
    if (semantic.issues?.count !== undefined) {
      checks.push({ label: "Issue 수", expected: String(semantic.issues.count), actual: String(run.issues.length) });
    }
    includeCodes("Issue", semantic.issues?.include_codes, run.issues.map((item) => item.code));
    if (semantic.findings?.count !== undefined) {
      checks.push({ label: "Finding 수", expected: String(semantic.findings.count), actual: String(run.findings.length) });
    }
    includeCodes("Finding", semantic.findings?.include_codes, run.findings.map((item) => item.code));
    if (semantic.evidence) {
      if (semantic.evidence.count !== undefined) {
        checks.push({ label: "Evidence 수", expected: String(semantic.evidence.count), actual: String(run.evidence.length) });
      }
      if (semantic.evidence.minimum_count !== undefined) {
        checks.push({
          label: "Evidence 최소 수",
          expected: "satisfied",
          actual: run.evidence.length >= semantic.evidence.minimum_count ? "satisfied" : `only_${run.evidence.length}`,
        });
      }
      if (semantic.evidence.retrieval_status !== undefined) {
        checks.push({
          label: "Evidence 조회 상태",
          expected: semantic.evidence.retrieval_status,
          actual: run.evidence_retrieval?.status ?? "not_available",
        });
      }
      if (semantic.evidence.coverage !== undefined) {
        checks.push({
          label: "Evidence coverage",
          expected: semantic.evidence.coverage,
          actual: run.evidence_retrieval?.coverage ?? "not_available",
        });
      }
      if (semantic.evidence.requirements_found !== undefined) {
        checks.push({
          label: "요건 검색 결과",
          expected: String(semantic.evidence.requirements_found),
          actual: run.evidence_retrieval?.requirements_found === null
            || run.evidence_retrieval?.requirements_found === undefined
            ? "not_available"
            : String(run.evidence_retrieval.requirements_found),
        });
      }
      if (semantic.evidence.minimum_result_count !== undefined) {
        const resultCount = run.evidence_retrieval?.result_count ?? 0;
        checks.push({
          label: "Evidence 대상 품목",
          expected: "satisfied",
          actual: resultCount >= semantic.evidence.minimum_result_count ? "satisfied" : `only_${resultCount}`,
        });
      }
    }
    includeCodes(
      "필수 조치",
      semantic.required_actions?.include_codes,
      run.required_actions.map((item) => item.code),
    );
    if (semantic.required_actions?.minimum_count !== undefined) {
      checks.push({
        label: "필수 조치 최소 수",
        expected: "satisfied",
        actual: run.required_actions.length >= semantic.required_actions.minimum_count
          ? "satisfied"
          : `only_${run.required_actions.length}`,
      });
    }
    for (const tool of semantic.action_trace?.include_succeeded_tools ?? []) {
      const matchingActions = run.action_trace.filter((item) => item.tool === tool);
      checks.push({
        label: `Agent Tool ${tool}`,
        expected: "succeeded",
        actual: matchingActions.some((item) => item.status === "succeeded")
          ? "succeeded"
          : matchingActions.length > 0
            ? "not_succeeded"
            : "missing",
      });
    }
    if (
      semantic.action_trace?.allowed_tools !== undefined
      && semantic.action_trace.maximum_unauthorized_tool_count !== undefined
    ) {
      const allowed = new Set(semantic.action_trace.allowed_tools);
      const unauthorized = run.action_trace.filter((item) => !allowed.has(item.tool));
      checks.push({
        label: "Unauthorized Agent Tool 수",
        expected: String(semantic.action_trace.maximum_unauthorized_tool_count),
        actual: String(unauthorized.length),
      });
    }
    for (const stage of semantic.review_stages?.include_completed_stages ?? []) {
      const matchingStages = (run.review_stage_trace ?? []).filter((item) => item.stage === stage);
      checks.push({
        label: `필수 심사 단계 ${stage}`,
        expected: "completed",
        actual: matchingStages.some((item) => item.status === "completed")
          ? "completed"
          : matchingStages.length > 0
            ? "not_completed"
            : "missing",
      });
    }
    includeCodes(
      "기능 차단 사유",
      semantic.completion?.include_unmet_reason_codes,
      run.completion_eligibility?.unmet_reason_codes ?? [],
    );
    if (semantic.model_execution) {
      checks.push(...this.modelExecutionChecks(
        "Review Claude",
        semantic.model_execution,
        run.model_execution_summary,
      ));
    }
    if (semantic.chat) {
      const answered = [...this.state.chat].reverse().find((message) => (
        ("message_id" in message ? message.answer_status : message.status) === semantic.chat?.status
      ));
      if (answered === undefined) {
        checks.push({
          label: "Claude Chat 실행",
          expected: "completed",
          actual: "pending",
          pending: true,
        });
      } else {
        const generationMode = answered.generation_mode;
        const execution = answered.model_execution_summary;
        const citationIds = "message_id" in answered
          ? answered.citations.map((citation) => citation.citation_id ?? citation.evidence_id ?? citation.source_id ?? citation.reference_id)
          : answered.claims.flatMap((claim) => claim.citation_ids);
        const knownIds = new Set([
          ...run.fields.map((item) => item.field_id),
          ...run.issues.map((item) => item.issue_id),
          ...run.evidence.map((item) => item.evidence_id),
          ...run.findings.map((item) => item.finding_id),
          ...run.sources.map((item) => item.source_id),
        ]);
        checks.push({
          label: "Claude Chat answered",
          expected: "present",
          actual: "present",
        });
        checks.push({
          label: "Claude Chat generation",
          expected: semantic.chat.generation_mode,
          actual: generationMode ?? "not_available",
        });
        checks.push({
          label: "Claude Chat grounding",
          expected: "grounded",
          actual: citationIds.length > 0 && citationIds.every((id) => id !== undefined && knownIds.has(id))
            ? "grounded"
            : "not_grounded",
        });
        checks.push(...this.modelExecutionChecks("Chat Claude", semantic.chat.model_execution, execution));
      }
    }
    if (semantic.narrative?.material_citations_complete) {
      checks.push({
        label: "XAI material citation",
        expected: "complete",
        actual: this.materialNarrativeCitationsComplete(run) ? "complete" : "incomplete",
      });
    }
    return checks;
  }

  private modelExecutionChecks(
    label: string,
    expected: LocalUatModelExecutionExpectation,
    summary: ModelExecutionSummary | undefined,
  ): UatCheck[] {
    const minimum = (value: number | undefined, threshold: number): string => (
      value !== undefined && value >= threshold ? "satisfied" : `only_${value ?? 0}`
    );
    return [
      { label: `${label} provider`, expected: expected.provider, actual: summary?.provider ?? "not_available" },
      { label: `${label} model`, expected: "present", actual: summary?.model_id ? "present" : "missing" },
      { label: `${label} text-only`, expected: String(expected.text_only), actual: summary === undefined ? "not_available" : String(summary.text_only) },
      { label: `${label} call count`, expected: "satisfied", actual: minimum(summary?.call_count, expected.minimum_call_count) },
      { label: `${label} input tokens`, expected: "satisfied", actual: minimum(summary?.input_tokens_total, expected.minimum_input_tokens) },
      { label: `${label} output tokens`, expected: "satisfied", actual: minimum(summary?.output_tokens_total, expected.minimum_output_tokens) },
      { label: `${label} prompt hashes`, expected: "complete", actual: summary?.prompt_hashes_complete ? "complete" : "incomplete" },
      { label: `${label} schema hashes`, expected: "complete", actual: summary?.schema_hashes_complete ? "complete" : "incomplete" },
      { label: `${label} runtime identity`, expected: "matched", actual: summary?.runtime_identity_match ? "matched" : "mismatch" },
      { label: `${label} audit`, expected: String(expected.audit_complete), actual: summary === undefined ? "not_available" : String(summary.audit_complete) },
      { label: `${label} unmet reasons`, expected: "none", actual: summary?.unmet_reason_codes.length === 0 ? "none" : (summary?.unmet_reason_codes.join(",") ?? "not_available") },
    ];
  }

  private materialNarrativeCitationsComplete(run: ReviewRun): boolean {
    const report = run.narrative_report;
    if (!report) return false;
    const knownIds = new Set([
      ...run.fields.map((item) => item.field_id),
      ...run.issues.map((item) => item.issue_id),
      ...run.evidence.map((item) => item.evidence_id),
      ...run.findings.map((item) => item.finding_id),
      ...run.sources.map((item) => item.source_id),
    ]);
    const claims = [
      ...report.summary,
      ...report.document_consistency,
      ...report.regulatory_review,
      ...report.impact,
      ...report.recommended_actions,
    ].filter((claim) => claim.material !== false);
    return claims.length > 0 && claims.every((claim) => (
      claim.citation_ids.length > 0
      && claim.citation_ids.every((citationId) => knownIds.has(citationId))
    ));
  }

  private renderActionTimeline(run: ReviewRun): HTMLElement {
    const actions: ActionTrace[] = run.action_trace.length > 0 ? run.action_trace : run.stages.map((stage) => ({
      action_id: stage.event_id,
      cycle: 0,
      tool: stage.stage,
      status: stage.status === "pending" ? "planned" : stage.status,
      reason_code: stage.message,
      input_source_ids: [],
      started_at: stage.occurred_at,
      ...(stage.status === "succeeded" ? { finished_at: stage.occurred_at } : {}),
    }));
    return el(
      "section",
      { className: "card", attrs: { "aria-labelledby": "timeline-title" } },
      el("h2", { text: "Agent 실행 과정", attrs: { id: "timeline-title" } }),
      actions.length === 0
        ? empty("공개 가능한 실행 단계가 없습니다. 숨은 사고과정은 표시하지 않습니다.")
        : el(
            "ol",
            { className: "timeline" },
            ...actions.map((action) =>
              el(
                "li",
                { className: `timeline__item timeline__item--${action.status}` },
                el("strong", { text: action.tool }),
                el("span", { text: humanize(action.reason_code) }),
                el("small", { text: `cycle ${action.cycle} · ${formatDate(action.started_at)}` }),
                action.observation ? el("p", { text: action.observation }) : null,
              ),
            ),
          ),
    );
  }

  private renderModelExecution(title: string, summary: ModelExecutionSummary | undefined): HTMLElement {
    if (!summary) {
      return el(
        "section",
        { className: "card", attrs: { "aria-label": title } },
        el("h2", { text: title }),
        el("p", { className: "notice notice--warning", text: "Backend가 공개한 모델 실행 증거가 없습니다. 실제 Claude 실행으로 판정하지 않습니다." }),
      );
    }
    const state = summary.audit_complete ? "검증 완료" : "검증 미완료";
    return el(
      "section",
      { className: "card", attrs: { "aria-label": title, "data-model-audit": summary.audit_complete ? "complete" : "incomplete" } },
      el("div", { className: "section-title-row" },
        el("h2", { text: title }),
        badge("실행 감사", state, summary.audit_complete ? "positive" : "negative"),
      ),
      el("p", { className: "section-help", text: "토큰 수와 호출 수는 Backend가 원문·credential을 제거해 공개한 실행 증거이며 모델 품질 또는 Production 승인을 뜻하지 않습니다." }),
      el(
        "dl",
        { className: "identity-list" },
        el("dt", { text: "Provider" }), el("dd", { text: summary.provider ?? "없음" }),
        el("dt", { text: "Model" }), el("dd", { text: summary.model_id ?? "없음" }),
        el("dt", { text: "호출 수" }), el("dd", { text: String(summary.call_count) }),
        el("dt", { text: "입력 tokens" }), el("dd", { text: summary.input_tokens_total.toLocaleString() }),
        el("dt", { text: "출력 tokens" }), el("dd", { text: summary.output_tokens_total.toLocaleString() }),
        el("dt", { text: "Text-only" }), el("dd", { text: String(summary.text_only) }),
        el("dt", { text: "Prompt hash" }), el("dd", { text: summary.prompt_hashes_complete ? "complete" : "incomplete" }),
        el("dt", { text: "Schema hash" }), el("dd", { text: summary.schema_hashes_complete ? "complete" : "incomplete" }),
        el("dt", { text: "Runtime identity" }), el("dd", { text: summary.runtime_identity_match ? "matched" : "mismatch" }),
        el("dt", { text: "미충족 사유" }), el("dd", { text: summary.unmet_reason_codes.length === 0 ? "없음" : summary.unmet_reason_codes.map(humanize).join(" · ") }),
      ),
    );
  }

  private renderParentChildDiff(run: ReviewRun): HTMLElement | null {
    if (!run.parent_run_id) return null;
    const parent = this.state.parentRun;
    if (!parent || parent.review_run_id !== run.parent_run_id) {
      return el(
        "section",
        { className: "card", attrs: { "aria-labelledby": "run-diff-title" } },
        el("h2", { text: "부모–자식 Run 변경 비교", attrs: { id: "run-diff-title" } }),
        empty("Backend에서 결박된 부모 Run을 불러오지 못해 변경 비교를 표시할 수 없습니다."),
      );
    }
    const rows = parentChildDiffRows(parent, run);
    return el(
      "section",
      { className: "card run-diff", attrs: { "aria-labelledby": "run-diff-title" } },
      el("div", { className: "section-title-row" },
        el("h2", { text: "부모–자식 Run 변경 비교", attrs: { id: "run-diff-title" } }),
        el("span", { className: "generator-label", text: "결정론적 비교" }),
      ),
      el("p", {
        className: "section-help",
        text: `${parent.review_run_id} → ${run.review_run_id}. 원본 Run은 변경하지 않고 직접 부모와 현재 child의 공개 결과만 비교합니다.`,
      }),
      el(
        "div",
        { className: "run-diff-table-wrap" },
        el(
          "table",
          { className: "run-diff-table" },
          el("thead", {}, el("tr", {}, el("th", { text: "항목", attrs: { scope: "col" } }), el("th", { text: "부모 Run", attrs: { scope: "col" } }), el("th", { text: "현재 child Run", attrs: { scope: "col" } }), el("th", { text: "변화", attrs: { scope: "col" } }))),
          el("tbody", {}, ...rows.map((row) => el(
            "tr",
            { className: row.changed ? "run-diff-row--changed" : "" },
            el("th", { text: row.label, attrs: { scope: "row" } }),
            el("td", { text: row.before }),
            el("td", { text: row.after }),
            el("td", { text: row.changed ? "변경" : "동일" }),
          ))),
        ),
      ),
    );
  }

  private renderThreePane(run: ReviewRun): HTMLElement {
    const selected = this.state.documents.find((document) => document.document_id === this.state.selectedDocumentId) ?? this.state.documents[0];
    const docTabs = el(
      "div",
      { className: "tab-list", attrs: { role: "tablist", "aria-label": "원문 문서" } },
      ...this.state.documents.map((document, index) =>
        el("button", {
          className: `tab${document.document_id === selected?.document_id ? " is-selected" : ""}`,
          text: document.document_type,
          attrs: {
            id: `document-tab-${document.document_id}`,
            type: "button",
            role: "tab",
            "aria-selected": document.document_id === selected?.document_id ? "true" : "false",
            "aria-controls": `document-panel-${document.document_id}`,
            tabindex: document.document_id === selected?.document_id ? "0" : "-1",
          },
          on: {
            click: () => { this.state.selectedDocumentId = document.document_id; this.render(); },
            keydown: (event) => this.handleDocumentTabKey(event, index),
          },
        }),
      ),
    );
    return el(
      "section",
      { className: "three-pane", attrs: { id: "review-workspace", "aria-label": "통합 심사 화면" } },
      el(
        "article",
        { className: "review-pane" },
        el("h2", { text: "1. 문서 원문" }),
        docTabs,
        ...(this.state.documents.length > 0
          ? this.state.documents.map((document) =>
              el(
                "div",
                {
                  attrs: {
                    id: `document-panel-${document.document_id}`,
                    role: "tabpanel",
                    "aria-labelledby": `document-tab-${document.document_id}`,
                    ...(document.document_id === selected?.document_id ? {} : { hidden: "" }),
                  },
                },
                el("p", { className: "document-name", text: `${document.filename} · SHA-256 ${document.content_sha256.slice(0, 12)}…` }),
                el("pre", { className: "source-text", text: document.content_text ?? "Backend가 원문 content endpoint를 제공하지 않았습니다." }),
              ),
            )
          : [empty("등록된 텍스트 문서가 없습니다.")]),
        this.renderSourceLedger(run),
      ),
      el(
        "article",
        { className: "review-pane" },
        el("h2", { text: "2. 추출값·불일치" }),
        this.renderFields(run.fields, selected?.document_id),
        this.renderIssues(run.issues),
      ),
      el(
        "article",
        { className: "review-pane" },
        el("h2", { text: "3. 법령 Evidence" }),
        this.renderEvidence(run),
        run.findings.length > 0 ? el("h3", { text: "규정 Finding" }) : null,
        ...run.findings.map((finding) =>
          el(
            "div",
            { className: `finding finding--${finding.severity}`, attrs: { "data-source-id": finding.finding_id, tabindex: "-1" } },
            el("strong", { text: finding.title }),
            el("p", { text: finding.detail }),
            this.renderCitationButtons([...finding.evidence_ids, ...finding.source_ids]),
          ),
        ),
      ),
    );
  }

  private handleDocumentTabKey(event: Event, currentIndex: number): void {
    if (!(event instanceof KeyboardEvent)) return;
    const count = this.state.documents.length;
    if (count === 0) return;
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % count;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + count) % count;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = count - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    this.state.selectedDocumentId = this.state.documents[nextIndex]?.document_id;
    this.render();
    this.root.querySelector<HTMLElement>(`#document-tab-${CSS.escape(this.state.selectedDocumentId ?? "")}`)?.focus();
  }

  private renderSourceLedger(run: ReviewRun): HTMLElement {
    return el(
      "section",
      { className: "source-ledger", attrs: { "aria-labelledby": "source-ledger-title" } },
      el("h3", { text: "검증된 원문 근거", attrs: { id: "source-ledger-title" } }),
      ...(run.sources.length === 0
        ? [empty("이 Run에 결박된 원문 Source ID가 없습니다.")]
        : run.sources.map((source) =>
            el(
              "article",
              {
                className: "source-ledger__item",
                attrs: {
                  "data-source-id": source.source_id,
                  ...(source.document_id ? { "data-document-id": source.document_id } : {}),
                  tabindex: "-1",
                },
              },
              el("strong", { text: source.label }),
              source.quote ? el("blockquote", { text: source.quote }) : empty("원문 인용문이 제공되지 않았습니다."),
              el("small", {
                text: [source.document_id, source.page === undefined ? undefined : `page ${source.page}`, source.start_offset === undefined ? undefined : `offset ${source.start_offset}-${source.end_offset ?? "?"}`]
                  .filter(Boolean)
                  .join(" · ") || "Source 위치 메타데이터 미제공",
              }),
            ),
          )),
    );
  }

  private renderFields(fields: ExtractedField[], documentId?: string): HTMLElement {
    const visible = documentId ? fields.filter((field) => field.document_id === documentId || field.document_id === "unbound-document") : fields;
    if (visible.length === 0) return empty("선택한 문서의 추출값이 없습니다.");
    return el(
      "dl",
      { className: "field-list" },
      ...visible.flatMap((field) => [
        el("dt", { text: field.name, attrs: { "data-source-id": field.field_id, tabindex: "-1" } }),
        el(
          "dd",
          {},
          el("span", { text: field.value === null ? "null" : String(field.value) }),
          field.confidence === undefined ? null : el("small", { text: `confidence ${Math.round(field.confidence * 100)}%` }),
          this.renderCitationButtons(field.source_ids),
        ),
      ]),
    );
  }

  private renderIssues(issues: ReviewIssue[]): HTMLElement {
    return el(
      "div",
      { className: "issue-list" },
      el("h3", { text: `문서 불일치 ${issues.length}건` }),
      ...(issues.length === 0
        ? [el("p", { className: "positive-text", text: "현재 검증 범위에서 문서 불일치가 발견되지 않았습니다." })]
        : issues.map((issue) =>
            el(
              "div",
              { className: `issue issue--${issue.severity}`, attrs: { "data-source-id": issue.issue_id, tabindex: "-1" } },
              el("strong", { text: `${issue.code} · ${humanize(issue.severity)}` }),
              el("p", { text: issue.message }),
              this.renderCitationButtons(issue.source_ids),
            ),
          )),
    );
  }

  private renderEvidence(run: ReviewRun): HTMLElement {
    const items = run.evidence;
    const provenance = run.evidence_provenance;
    const bound = this.state.selectedCase === undefined
      ? undefined
      : this.scenarioByCase.get(this.state.selectedCase.case_id);
    const evidenceProfile = bound?.evidence_profile ?? this.activeUatEvidenceProfile();
    const actualThreeLawRag = evidenceProfile !== null
      && evidenceProfile !== undefined
      && isActualThreeLawProfile(evidenceProfile);
    const scenarioEval = evidenceProfile === SCENARIO_EVAL_PROFILE;
    const isReleasedForAutomaticReview = run.assurance_level === "production"
      && run.review_disposition === "auto_review_complete";
    const releaseState = isReleasedForAutomaticReview ? "release-bound" : "diagnostic";
    const boundary = isReleasedForAutomaticReview
      ? el(
          "div",
          { className: "evidence-boundary evidence-boundary--release", attrs: { role: "note", "data-evidence-release-state": releaseState } },
          el("strong", { text: "RELEASE-BOUND EVIDENCE" }),
          el("p", { text: "이 Evidence는 현재 Run의 서명된 Agent·Data Release와 자동완료 판정에 결박되어 있습니다." }),
        )
      : el(
          "div",
          { className: "evidence-boundary evidence-boundary--diagnostic", attrs: { role: "alert", "data-evidence-release-state": releaseState } },
          el("strong", { text: "DIAGNOSTIC EVIDENCE — NOT RELEASED" }),
           el("p", { text: "법령 검색 기능 확인용 결과입니다. 법적 판단 또는 Production 자동완료 근거로 사용할 수 없습니다." }),
         );
    const queryPanel = provenance === undefined
      ? el(
          "div",
          {
            className: "rag-provenance rag-provenance--missing",
            attrs: { role: actualThreeLawRag ? "alert" : "note" },
          },
          el("strong", { text: "검색 provenance 미표시" }),
          el("p", {
            text: actualThreeLawRag
              ? "Actual RAG 프로필인데 Backend의 안전한 검색 provenance가 없습니다. 이 Run을 실제 RAG 확인 근거로 사용하지 마세요."
              : "이 Run에는 Backend가 검증한 검색 query·HSK·rank projection이 없습니다.",
          }),
        )
      : el(
          "section",
          {
            className: "rag-provenance",
            attrs: {
              "aria-label": "RAG 검색 provenance",
              "data-rag-provenance": "verified-backend-projection",
            },
          },
          el(
            "div",
            { className: "rag-provenance__heading" },
            el("strong", { text: actualThreeLawRag ? "ACTUAL 3-LAW RAG 실행 근거" : "Evidence 조회 근거" }),
            el("span", { text: `Query intent · ${provenance.query_intent ?? "미제공"}` }),
          ),
          ...provenance.items.map((query) =>
            el(
              "article",
              { className: "rag-query", attrs: { "data-rag-item-id": query.item_id } },
              el("strong", { text: query.query_description }),
              el(
                "dl",
                { className: "rag-query__facts" },
                el("dt", { text: "요청 HS" }),
                el("dd", { text: query.requested_hs_code ?? "없음" }),
                el("dt", { text: "해소 HSK10" }),
                el("dd", { text: query.resolved_hsk10 ?? "해소되지 않음" }),
                el("dt", { text: "Structured 해소" }),
                el("dd", { text: humanize(query.hs_resolution) }),
                el("dt", { text: "Coverage" }),
                el("dd", { text: humanize(query.coverage) }),
                el("dt", { text: "요건서류" }),
                el("dd", { text: query.requirements_found ? "발견됨" : "없음" }),
              ),
            ),
          ),
        );
    const rankedByEvidenceId = new Map(
      provenance?.ranked_evidence.map((item) => [item.evidence_id, item] as const) ?? [],
    );
    const observedMethods = new Set(
      provenance?.ranked_evidence.flatMap((item) => item.retrieval_methods) ?? [],
    );
    const graphTopK = observedMethods.has("graph");
    const safeTrace = scenarioEval && this.state.uatEvidenceTraceStatus === "available"
      ? this.state.uatEvidenceTrace
      : undefined;
    const traceStages = safeTrace === undefined
      ? []
      : (["structured", "dense", "bm25", "graph"] as const).map((stageName) => ({
          stageName,
          stage: safeTrace.retrieval[stageName],
        }));
    const ragRuntimeSummary = actualThreeLawRag
      ? el(
          "dl",
          {
            className: "rag-runtime-summary",
            attrs: {
              "aria-label": "실제 RAG Run 관측값",
              "data-uat-evidence-trace": scenarioEval
                ? this.state.uatEvidenceTraceStatus
                : "not_applicable",
            },
          },
          el("dt", { text: "Case profile" }),
          el("dd", { text: evidenceProfile ?? "unknown" }),
          el("dt", { text: "Knowledge snapshot" }),
          el("dd", { text: run.release_identity?.evidence_snapshot_id ?? "미제공" }),
          el("dt", { text: "Evidence request mapping" }),
          el("dd", { text: provenance?.request_id && safeTrace?.request_id === provenance.request_id
            ? `Review Run request ${provenance.request_id} · Backend 안전 trace exact match`
            : "공개 projection 미제공" }),
          el("dt", { text: "관측 retrieval method" }),
          el("dd", { text: observedMethods.size === 0 ? "없음" : [...observedMethods].sort().join(" · ") }),
          el("dt", { text: "Neo4j 실행 경로 성공" }),
          el("dd", {
            text: scenarioEval
              ? safeTrace?.retrieval.graph.succeeded === true
                ? "Backend 안전 trace로 성공 확인"
                : "Backend 안전 trace 미확인"
              : graphTopK
                ? "Top-K graph 관측으로 확인"
                : "Data trace에서 별도 확인 필요",
          }),
          el("dt", { text: "최종 Top-K Graph 포함" }),
          el("dd", {
            text: scenarioEval && safeTrace !== undefined
              ? safeTrace.retrieval.graph.top_k_count > 0 ? "포함됨" : "포함되지 않음"
              : graphTopK ? "포함됨" : "포함되지 않음",
          }),
          ...(scenarioEval
            ? safeTrace === undefined
              ? [
                  el("dt", { text: "4-Store 검색 trace" }),
                  el("dd", {
                    className: "negative-text",
                    text: "확인 불가 — 이 Run을 Actual-RAG 통과 근거로 사용하지 마세요.",
                  }),
                ]
              : traceStages.flatMap(({ stageName, stage }) => [
                  el("dt", {
                    text: `${stageName === "structured" ? "PostgreSQL Structured" : stageName === "dense" ? "Qdrant Dense" : stageName === "bm25" ? "Qdrant BM25" : "Neo4j Graph"} 실행`,
                  }),
                  el("dd", {
                    text: `성공 · 결과 ${stage.result_count}건 · Top-K ${stage.top_k_count}건 · ${stage.duration_ms}ms`,
                    attrs: {
                      "data-rag-stage": stageName,
                      "data-stage-attempted": String(stage.attempted),
                      "data-stage-succeeded": String(stage.succeeded),
                      "data-stage-top-k-count": String(stage.top_k_count),
                    },
                  }),
                ])
            : []),
          el("dt", { text: "Citation" }),
          el("dd", { text: `${items.length}건 · source URI/version hash 검토` }),
        )
      : null;
    return el(
      "div",
      { className: `evidence-list evidence-list--${releaseState}`, attrs: { "data-evidence-release-state": releaseState } },
      boundary,
      actualThreeLawRag
        ? el(
            "div",
            { className: "actual-rag-warning", attrs: { role: "status" } },
            el("strong", { text: scenarioEval
              ? "ACTUAL 3-LAW RAG SCENARIO EVAL · POSTGRESQL + QDRANT + NEO4J"
              : "ACTUAL 3-LAW RAG · POSTGRESQL + QDRANT + NEO4J" }),
            el("span", { text: scenarioEval
              ? "USER SCENARIO 9/9 · 3 OF 58 · TEST-ONLY POLICY · AUTO OFF"
              : "3 OF 58 · DIAGNOSTIC · AUTO OFF · NOT PRODUCTION" }),
          )
        : el("span", { className: "visually-hidden", text: "Synthetic Evidence profile" }),
      ragRuntimeSummary,
      queryPanel,
      ...(items.length === 0 ? [empty("검증된 Evidence가 없습니다. 자동완료 근거로 사용할 수 없습니다.")] : items.map((item) =>
        (() => {
          const ranked = rankedByEvidenceId.get(item.evidence_id);
          const scoreSummary = ranked === undefined
            ? "score 미표시"
            : [
                ...(ranked.score === null ? [] : [`final ${ranked.score.toFixed(6)}`]),
                ...Object.entries(ranked.raw_scores).map(([method, score]) => `${method} ${score.toFixed(6)}`),
              ].join(" · ") || "score 없음";
          return el(
            "article",
            {
              className: `evidence evidence--${releaseState}`,
              attrs: {
                "data-source-id": item.evidence_id,
                "data-evidence-release-state": releaseState,
                "data-retrieval-rank": ranked === undefined ? "" : String(ranked.rank),
                tabindex: "-1",
              },
            },
            el(
              "div",
              { className: "evidence__heading" },
              el("span", {
                className: "evidence__rank",
                text: ranked === undefined ? "순위 미표시" : `#${ranked.rank}`,
              }),
              el("span", {
                className: "evidence__law",
                text: `${ranked?.law_name ?? ranked?.law_id ?? item.law_id}${
                  (ranked?.article_no ?? item.article)
                    ? ` · ${ranked?.article_no ?? item.article}`
                    : ""
                }`,
              }),
            ),
            el("strong", { text: item.title }),
            ranked === undefined
              ? el("p", { className: "retrieval-methods", text: "검색 방식 provenance 없음" })
              : el(
                  "div",
                  { className: "retrieval-methods", attrs: { "aria-label": "검색 방식" } },
                  ...ranked.retrieval_methods.map((method) =>
                    el("span", { className: `retrieval-method retrieval-method--${method}`, text: method }),
                  ),
                ),
            el("p", { text: item.excerpt }),
            el("small", { className: "evidence__score", text: scoreSummary }),
            el("small", {
              text: `version ${ranked?.version_hash.slice(0, 12) ?? item.source_hash.slice(0, 12)}… · ${item.effective_date ?? "시행일 미표시"}`,
            }),
            el(
              "a",
              {
                className: "evidence__source-link",
                text: "공식 출처 열기",
                attrs: {
                  href: ranked?.source_uri ?? item.source_uri,
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
              },
            ),
          );
        })(),
      )),
    );
  }

  private renderNarrative(run: ReviewRun): HTMLElement {
    const report = run.narrative_report;
    if (!report) return el(
      "section",
      { className: "card", attrs: { id: "review-report", "aria-labelledby": "report-title" } },
      el("h2", { text: "사용자용 XAI 보고서", attrs: { id: "report-title" } }),
      empty("근거 결박 보고서가 생성되지 않았습니다."),
    );
    const section = (title: string, claims: NarrativeClaim[] | undefined): HTMLElement =>
      el(
        "section",
        { className: "report-section" },
        el("h3", { text: title }),
        ...(claims?.length ? claims.map((claim) => el("div", { className: "claim" }, el("p", { text: claim.text }), this.renderCitationButtons(claim.citation_ids))) : [empty("해당 내용 없음")]),
      );
    return el(
      "section",
      { className: "card report", attrs: { id: "review-report", "aria-labelledby": "report-title" } },
      el(
        "div",
        { className: "section-title-row" },
        el("h2", { text: report.title || "사용자용 XAI 보고서", attrs: { id: "report-title" } }),
        el("span", {
          className: "generator-label",
          text: report.generated_by === "claude"
            ? "Claude 표현 · 코드 검증"
            : report.generated_by === "backend_policy_overlay"
              ? "Backend 안전 정책 보정"
              : "안전 템플릿",
        }),
      ),
      section("심사 요약", report.summary),
      section("문서 정합성", report.document_consistency),
      section("적용 규정", report.regulatory_review),
      section("영향", report.impact),
      section("권장 조치", report.recommended_actions),
    );
  }

  private renderCitationButtons(ids: string[]): HTMLElement {
    return el(
      "span",
      { className: "citations", attrs: { "aria-label": "근거 인용" } },
      ...ids.map((id) =>
        el("button", {
          className: "citation",
          text: `[${id}]`,
          attrs: { type: "button", title: `${id} 근거로 이동` },
          on: { click: () => this.focusCitation(id) },
        }),
      ),
    );
  }

  private focusCitation(id: string): void {
    const target = [...this.root.querySelectorAll<HTMLElement>("[data-source-id]")].find((item) => item.dataset.sourceId === id);
    if (!target) {
      this.state.error = `현재 결과에서 인용 근거 ${id}를 찾을 수 없습니다.`;
      this.render();
      return;
    }
    target.focus();
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  private renderHitl(run: ReviewRun): HTMLElement {
    const correctableFields = run.fields.filter((field) => field.document_id !== "unbound-document");
    const confirmableSourceIds = [...new Set(run.fields.flatMap((field) => field.source_ids))]
      .filter((sourceId) => run.sources.some((source) => source.source_id === sourceId));
    const revisionForm = (decision: RevisionAction["decision"]): HTMLElement => {
      const enabled = this.canWrite() && !this.state.busy && !this.jobIsActive()
        && (decision !== "correct_field" || correctableFields.length > 0)
        && (decision !== "confirm_field" || confirmableSourceIds.length > 0)
        && (decision !== "add_supporting_document" || this.state.supportingDocuments.length > 0);
      const labels: Record<RevisionAction["decision"], string> = {
        confirm_field: "원문 대조 확인 제안",
        correct_field: "추출값 수정 제안",
        add_supporting_document: "요건서류 추가 제안",
        approve_review: "심사 승인 제안",
        reject_review: "심사 거절 제안",
      };
      const controls: HTMLElement[] = [];
      if (decision === "correct_field") {
        controls.push(
          labeledControl(
            "수정 대상",
            el(
              "select",
              { attrs: { name: "field", required: "", ...disabledUnless(enabled) } },
              ...correctableFields.map((field) => el("option", { text: `${field.name}: ${String(field.value)}`, attrs: { value: field.field_id } })),
            ),
          ),
          labeledControl("제안값", el("input", { attrs: { name: "new_value", required: "", maxlength: "1000", ...disabledUnless(enabled) } })),
        );
      }
      if (decision === "confirm_field") {
        controls.push(labeledControl(
          "FactLedger 원문 근거",
          el(
            "select",
            { attrs: { name: "confirmed_reference_id", required: "", ...disabledUnless(enabled) } },
            ...confirmableSourceIds.map((sourceId) => {
              const source = run.sources.find((candidate) => candidate.source_id === sourceId);
              return el("option", { text: `${source?.label ?? sourceId} · ${sourceId}`, attrs: { value: sourceId } });
            }),
          ),
        ));
      }
      if (decision === "add_supporting_document") {
        controls.push(labeledControl(
          "추가할 요건서류",
          el(
            "select",
            { attrs: { name: "supporting_document_id", required: "", ...disabledUnless(enabled) } },
            ...this.state.supportingDocuments.map((document) => el("option", {
              text: `${document.document_code} · ${document.document_number}`,
              attrs: { value: document.document_id },
            })),
          ),
          "현재 Run에 이미 포함된 서류는 Backend가 거절합니다.",
        ));
      }
      controls.push(labeledControl(
        "제안 이유",
        el("textarea", { attrs: { name: "reason", required: "", maxlength: "2000", rows: "3", ...disabledUnless(enabled) } }),
      ));
      controls.push(el("button", {
        className: `button button--${decision === "reject_review" ? "danger" : "secondary"}`,
        text: labels[decision],
        attrs: { type: "submit", ...disabledUnless(enabled) },
      }));
      return el(
        "details",
        { className: "revision-action" },
        el("summary", { text: labels[decision] }),
        el("form", {
          className: "hitl-form",
          on: { submit: (event) => void this.handleRevisionProposal(event, run, decision) },
        }, ...controls),
      );
    };
    return el(
      "section",
      { className: "card", attrs: { id: "review-actions", "aria-labelledby": "hitl-title" } },
      el("h2", { text: "사람 검토 · 수정 · 재심사", attrs: { id: "hitl-title" } }),
      el("p", { className: "section-help", text: "원본 Run은 변경하지 않습니다. Reviewer는 확인·수정·서류추가·승인/거절을 typed proposal로만 제안하고, 다른 Approver가 parent digest와 Case revision을 재검증해야 child Run이 생성됩니다." }),
      el(
        "div",
        { className: "revision-action-list" },
        revisionForm("confirm_field"),
        revisionForm("correct_field"),
        revisionForm("add_supporting_document"),
        revisionForm("approve_review"),
        revisionForm("reject_review"),
      ),
      el("h3", { text: `Revision Proposals ${this.state.proposals.length}건` }),
      ...(this.state.proposals.length === 0 ? [empty("등록된 revision 제안이 없습니다.")] : this.state.proposals.map((proposal) => this.renderRevisionProposal(proposal, run))),
      el("p", {
        className: "section-help",
        text: this.canApprove()
          ? "Approver는 위 pending proposal을 제안자와 독립적으로 승인하거나 거절합니다. 승인/거절 자체도 typed action으로만 새 child Run에 적용됩니다."
          : "제안 승인·거절은 제안자와 다른 approver 또는 admin만 수행할 수 있습니다.",
      }),
    );
  }

  private renderRevisionProposal(proposal: CorrectionProposal, run: ReviewRun): HTMLElement {
    const decisionBlockReason = this.proposalDecisionBlockReason(proposal, run);
    const canDecide = decisionBlockReason === undefined;
    const decisionForm = (decision: "approve" | "reject"): HTMLFormElement =>
      el(
        "form",
        { className: "proposal-decision-form", on: { submit: (event) => void this.handleRevisionProposalDecision(event, proposal, run, decision) } },
        labeledControl("결정 사유", el("input", { attrs: { name: "reason", required: "", maxlength: "2000", ...disabledUnless(canDecide && !this.state.busy) } })),
        el("button", { className: `button button--${decision === "approve" ? "primary" : "danger"}`, text: decision === "approve" ? "제안 승인·재심사" : "제안 거절", attrs: { type: "submit", ...disabledUnless(canDecide && !this.state.busy && !this.jobIsActive()) } }),
      );
    return el(
      "article",
      { className: `correction-proposal correction-proposal--${proposal.status}` },
      el("strong", { text: `${proposal.proposal_id} · ${humanize(proposal.status)}` }),
      ...proposal.corrections.map((correction) => el("p", { text: `${correction.document_id} / ${correction.field_path} → ${String(correction.new_value)} · ${correction.reason}` })),
      ...proposal.actions.map((action) => el("p", {
        text: [
          humanize(action.decision),
          action.confirmed_reference_id,
          action.correction ? `${action.correction.document_id} / ${action.correction.field_path} → ${String(action.correction.new_value)}` : undefined,
          action.supporting_document_id,
          action.reason,
        ].filter(Boolean).join(" · "),
      })),
      el("small", { text: `parent ${proposal.parent_result_digest.slice(0, 12)}… · manifest ${proposal.parent_input_manifest_sha256.slice(0, 12)}… · revision ${proposal.case_revision}` }),
      proposal.status === "pending" && canDecide ? el("div", { className: "decision-grid" }, decisionForm("approve"), decisionForm("reject")) : null,
      proposal.status === "pending" && this.canApprove() && !canDecide
        ? el("p", { className: "notice notice--warning", text: decisionBlockReason ?? "현재 Proposal을 안전하게 결정할 수 없습니다." })
        : null,
      proposal.decision_reason ? el("p", { className: "section-help", text: `결정: ${proposal.decision_reason}` }) : null,
    );
  }

  private renderChat(run: ReviewRun): HTMLElement {
    const canChat = this.canChat();
    const request = this.state.chatRequest?.review_run_id === run.review_run_id
      ? this.state.chatRequest
      : undefined;
    const chatBusy = request?.state === "requesting";
    const form = el(
      "form",
      { className: "chat-form", on: { submit: (event) => void this.handleChat(event, run) } },
      labeledControl(
        "Case에 대해 질문",
        el("textarea", {
          attrs: {
            name: "question",
            required: "",
            maxlength: "2000",
            rows: "3",
            placeholder: "왜 사람 검토가 필요한가요?",
            ...disabledUnless(canChat && !this.state.busy && !chatBusy),
          },
        }),
        "현재 Run의 문서·Issue·Finding·법령 Evidence에 근거해 답변합니다.",
      ),
      el("button", {
        className: "button button--primary",
        text: chatBusy ? "근거를 확인하고 있습니다…" : "근거 기반 답변 요청",
        attrs: { type: "submit", ...disabledUnless(canChat && !this.state.busy && !chatBusy) },
      }),
    );
    return el(
      "section",
      {
        className: "card case-chat",
        attrs: {
          id: "review-chat",
          "aria-labelledby": "chat-title",
          "data-chat-state": request?.state ?? "idle",
        },
      },
      el("div", { className: "section-title-row" },
        el("div", {}, el("p", { className: "eyebrow", text: "GROUNDED CASE ASSISTANT" }), el("h2", { text: "심사 결과에 대해 질문하세요", attrs: { id: "chat-title" } })),
        el("span", { className: "chat-status", text: request?.state === "requesting" ? "답변 생성 중" : "현재 Run 근거 사용" }),
      ),
      el("p", { className: "section-help", text: "현재 Run과 Knowledge snapshot 밖의 질문은 안전하게 거절됩니다. Chat은 판정이나 저장된 심사 결과를 변경하지 않습니다." }),
      el(
        "div",
        { className: "chat-log", attrs: { "aria-live": "polite", "data-chat-log": "grounded" } },
        ...this.state.chat.map((message) => this.renderChatMessage(message)),
        request ? this.renderLocalChatRequest(request) : null,
        this.state.chat.length === 0 && !request
          ? empty("아직 질문이 없습니다. 결과의 원인, 법령 근거, 필요한 조치를 질문해 보세요.")
          : null,
      ),
      request?.state === "requesting"
        ? el(
            "div",
            { className: "chat-progress", attrs: { role: "status", "aria-live": "polite" } },
            el("span", { className: "chat-progress__pulse", attrs: { "aria-hidden": "true" } }),
            el("div", {},
              el("strong", { text: "현재 Run의 근거를 확인하고 답변을 검증하고 있습니다." }),
              el("p", { text: `경과 ${formatElapsed(Date.now() - request.started_at_ms)} · 일반적으로 ${CHAT_TYPICAL_SECONDS}` }),
              el("small", { text: "정확한 완료 시각은 보장하지 않으며, 인용 검증이 끝난 답변만 표시합니다." }),
            ),
          )
        : null,
      this.state.busy && !chatBusy
        ? el("p", { className: "notice notice--warning", text: "다른 Case 작업을 처리 중입니다. 작업이 끝난 뒤 질문을 제출해 주세요." })
        : null,
      canChat
        ? form
        : el("p", { className: "section-help", text: "Auditor는 저장된 Chat 이력을 읽을 수 있지만 새 질문을 생성할 수 없습니다." }),
    );
  }

  private renderChatMessage(message: ChatRecord | GroundedAnswer): HTMLElement {
    if ("message_id" in message) {
      return el(
        "article",
        { className: "chat-message", attrs: { "data-chat-message": "completed" } },
        el("div", { className: "chat-turn chat-turn--user" },
          el("span", { text: "질문" }),
          this.renderStructuredText(message.question),
        ),
        el("div", { className: "chat-turn chat-turn--assistant" },
          el("span", { text: "AI 답변" }),
          this.renderStructuredText(message.answer),
        ),
        el("span", { className: "chat-status", text: humanize(message.answer_status) }),
        this.renderCitationButtons(message.citations.map((citation) => citation.citation_id ?? citation.evidence_id ?? citation.source_id ?? citation.reference_id ?? "unbound-citation")),
        el("details", { className: "chat-technical" }, el("summary", { text: "모델 실행 정보" }), this.renderChatExecution(message.generation_mode, message.model_execution_summary)),
      );
    }
    return el(
      "article",
      { className: "chat-message", attrs: { "data-chat-message": "completed" } },
      el("span", { className: "chat-status", text: humanize(message.status) }),
      ...message.claims.map((claim) =>
        el("div", { className: "chat-turn chat-turn--assistant" }, this.renderStructuredText(claim.text), this.renderCitationButtons(claim.citation_ids))),
      el("details", { className: "chat-technical" }, el("summary", { text: "모델 실행 정보" }), this.renderChatExecution(message.generation_mode, message.model_execution_summary)),
    );
  }

  private renderLocalChatRequest(request: NonNullable<WorkbenchState["chatRequest"]>): HTMLElement {
    return el(
      "article",
      {
        className: `chat-message chat-message--${request.state}`,
        attrs: { "data-chat-message": request.state },
      },
      el("div", { className: "chat-turn chat-turn--user" },
        el("span", { text: "질문" }),
        this.renderStructuredText(request.question),
      ),
      request.state === "requesting"
        ? el("p", { className: "chat-pending-copy", text: "질문을 접수했습니다. Case 근거 조회와 답변 인용 검증을 진행하고 있습니다." })
        : request.state === "failed"
          ? el("div", { className: "notice notice--danger" },
              el("strong", { text: "답변 완료 여부를 확인하지 못했습니다." }),
              el("p", { text: request.error ?? "동일 질문으로 안전하게 다시 시도하거나 저장된 Chat 이력을 다시 불러오세요." }))
          : request.answer
            ? el(
                "div",
                { className: "chat-turn chat-turn--assistant" },
                el("span", { text: "AI 답변" }),
                ...request.answer.claims.map((claim) =>
                  el("div", { className: "chat-claim" }, this.renderStructuredText(claim.text), this.renderCitationButtons(claim.citation_ids))),
              )
            : null,
    );
  }

  private renderStructuredText(text: string): HTMLElement {
    const paragraphs = text
      .replaceAll("\r\n", "\n")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
    return el(
      "div",
      { className: "structured-text" },
      ...(paragraphs.length > 0 ? paragraphs : [text]).map((paragraph) => {
        const lines = paragraph.split("\n");
        return el(
          "p",
          {},
          ...lines.flatMap((line, index) => index === 0 ? [line] : [el("br"), line]),
        );
      }),
    );
  }

  private renderChatExecution(
    generationMode: GroundedAnswer["generation_mode"],
    summary: ModelExecutionSummary | undefined,
  ): HTMLElement {
    if (!generationMode || !summary) {
      return el("p", { className: "notice notice--warning", text: "Chat 모델 실행 증거 없음" });
    }
    return el(
      "p",
      {
        className: summary.audit_complete ? "section-help" : "notice notice--warning",
        attrs: { "data-chat-generation": generationMode, "data-chat-model-audit": summary.audit_complete ? "complete" : "incomplete" },
        text: `${humanize(generationMode)} · ${summary.provider ?? "provider 없음"} · ${summary.model_id ?? "model 없음"} · calls ${summary.call_count} · input ${summary.input_tokens_total.toLocaleString()} · output ${summary.output_tokens_total.toLocaleString()} tokens · audit ${summary.audit_complete ? "complete" : "incomplete"}`,
      },
    );
  }

  private renderHistory(run: ReviewRun): HTMLElement {
    return el(
      "section",
      { className: "history-grid", attrs: { id: "review-history" } },
      el(
        "article",
        { className: "card" },
        el("h2", { text: "Run lineage" }),
        el("p", { text: `현재: ${run.review_run_id}` }),
        el("p", { text: `부모: ${run.parent_run_id ?? "최초 Run"}` }),
        el("p", { text: `결과 digest: ${run.result_digest ?? "미제공"}` }),
        el("p", { text: `입력 manifest: ${run.input_manifest_digest ?? "미제공"}` }),
        el("p", { text: `Agent 입력 manifest: ${run.agent_input_manifest_sha256 ?? "미제공"}` }),
        el("p", { text: `Provider 결과 SHA-256: ${run.provider_result_sha256 ?? "미제공"}` }),
        run.release_identity
          ? el("dl", { className: "identity-list" }, ...Object.entries(run.release_identity)
              .sort(([left], [right]) => left.localeCompare(right))
              .flatMap(([key, identityValue]) => [el("dt", { text: key }), el("dd", { text: formatIdentityValue(identityValue) })]))
          : empty("Release identity가 제공되지 않았습니다."),
        el("h3", { text: "사람 결정 이력" }),
        ...(this.state.decisions.length === 0
          ? [empty("이 Run에 기록된 승인·거절 결정이 없습니다.")]
          : this.state.decisions.map((decision) =>
              el("p", {
                text: [
                  humanize(decision.decision),
                  decision.reason,
                  decision.decided_by,
                  decision.proposal_id ? `proposal ${decision.proposal_id}` : undefined,
                  decision.target_revision_id ? `target child ${decision.target_revision_id}` : undefined,
                ].filter(Boolean).join(" · "),
              }),
            )),
      ),
      el(
        "article",
        { className: "card" },
        el("h2", { text: "변경 불가능한 Audit" }),
        this.state.audit.length === 0
          ? empty("Audit event가 없습니다.")
          : el("ol", { className: "audit-list" }, ...this.state.audit.map((event) => el("li", {}, el("strong", { text: event.event_type }), el("span", { text: event.summary }), el("small", { text: `${event.actor_display} · ${formatDate(event.occurred_at)}` })))),
      ),
    );
  }

  private async handleCreateCase(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canWrite() || this.state.busy) return;
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const title = value(data, "title");
    const reference = value(data, "reference");
    await this.act(async () => {
      const created = await this.api.createCase({ title, ...(reference ? { external_reference: reference } : {}) });
      if (created.org_id !== this.requireSession().org_id) throw new Error("생성된 Case가 현재 조직에 결박되지 않았습니다.");
      await this.refreshCases();
      await this.selectCase(created.case_id);
      this.state.notice = "Case가 생성되었습니다.";
    });
  }

  private async handleScenario(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canWrite() || this.state.busy) return;
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const [profileValue, scenarioId] = value(data, "scenario").split("|");
    const profile = LOCAL_UAT_EVIDENCE_PROFILES.includes(profileValue as LocalUatEvidenceProfile)
      ? profileValue as LocalUatEvidenceProfile
      : null;
    const scenario = UAT_SCENARIOS.find((item) => item.scenario_id === scenarioId);
    if (!scenario || profile === null || !localUatScenarioSupportsProfile(scenario, profile)) return;
    if (profile !== this.activeUatEvidenceProfile()) {
      this.state.notice = "현재 process-level Evidence 프로필과 호환되지 않는 시나리오입니다. Harness로 올바른 프로필을 재시작하세요.";
      this.render();
      return;
    }
    await this.createScenarioCase(scenario, profile);
  }

  private async createScenarioCase(
    scenario: LocalUatScenario,
    evidenceProfile: LocalUatEvidenceProfile,
  ): Promise<void> {
    await this.act(async () => {
      const bound = bindLocalUatScenario(scenario, evidenceProfile);
      const variant = bound.variant;
      const externalReference = localUatScenarioExternalReference(scenario, evidenceProfile);
      const created = await this.api.createCase({
        title: `[UAT] ${variant.title}`,
        external_reference: externalReference,
      });
      if (
        created.org_id !== this.requireSession().org_id
        || created.external_reference !== externalReference
      ) throw new Error("생성된 UAT Case가 현재 조직·입력 manifest에 결박되지 않았습니다.");
      const createdDocuments: CaseDocument[] = [];
      for (const document of variant.documents) {
        const createdDocument = await this.api.addDocument(created.case_id, document);
        if (createdDocument.case_id !== created.case_id) throw new Error("생성된 UAT 문서가 요청 Case와 일치하지 않습니다.");
        createdDocuments.push(createdDocument);
      }
      if (variant.supporting_document) {
        const source = createdDocuments.find((document) => document.filename === variant.supporting_document?.filename);
        const invoice = createdDocuments.find((document) => document.document_type === "CI");
        if (!source || !invoice) throw new Error("Production UAT supporting-document source mapping failed");
        await this.api.addSupportingDocument(created.case_id, {
          document_id: source.document_id,
          document_code: variant.supporting_document.document_code,
          issuer: variant.supporting_document.issuer,
          document_number: variant.supporting_document.document_number,
          issued_on: variant.supporting_document.issued_on,
          valid_until: variant.supporting_document.valid_until,
          subject_item_ids: [`${invoice.document_id}_line_1`],
          hs_codes: variant.supporting_document.hs_codes,
          source_sha256: source.content_sha256,
        });
      }
      this.scenarioByCase.set(created.case_id, bound);
      await this.refreshCases();
      await this.selectCase(created.case_id);
      this.state.notice = variant.supporting_document && variant.requires_approver
        ? `profile-bound V2 시나리오를 등록했습니다. 작성자와 다른 approver가 요건서류를 검증한 뒤 실행하세요. 기대 평가: ${humanize(variant.expected.document_agent.assessment)} / ${humanize(variant.expected.policy_release.disposition)}`
        : variant.supporting_document
          ? `profile-bound V2 미신뢰 발급자 시나리오를 등록했습니다. Approver assertion 추가 전에 실행하세요. 기대 평가: ${humanize(variant.expected.document_agent.assessment)} / ${humanize(variant.expected.policy_release.disposition)}`
          : `profile-bound V2 시나리오를 등록했습니다. 기대 평가: ${humanize(variant.expected.document_agent.assessment)} / ${humanize(variant.expected.policy_release.disposition)}`;
    });
  }

  private async handleAddDocument(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canWrite() || this.state.busy) return;
    const current = this.state.selectedCase;
    if (!current) return;
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const payload: AddDocumentRequest = {
      document_type: value(data, "document_type") as AddDocumentRequest["document_type"],
      filename: value(data, "filename"),
      media_type: "text/plain",
      content_text: rawValue(data, "content_text"),
    };
    if (payload.content_text.trim().length === 0) {
      this.state.error = "공백만 있는 문서는 등록할 수 없습니다.";
      this.render();
      return;
    }
    if (payload.document_type !== "SUPPORTING") {
      const primaryDocuments = this.state.documents.filter((document) => document.document_type !== "SUPPORTING");
      const primaryCharacters = primaryDocuments.reduce((total, document) => total + document.character_count, 0);
      if (primaryDocuments.length >= MAX_PRIMARY_DOCUMENTS) {
        this.state.error = `한 심사에는 최대 ${MAX_PRIMARY_DOCUMENTS}개의 일반 문서만 사용할 수 있습니다.`;
        this.render();
        return;
      }
      if (primaryCharacters + payload.content_text.length > MAX_PRIMARY_TEXT_CHARACTERS) {
        this.state.error = `일반 문서 원문 합계는 최대 ${MAX_PRIMARY_TEXT_CHARACTERS.toLocaleString()}자입니다.`;
        this.render();
        return;
      }
    }
    await this.act(async () => {
      await this.api.addDocument(current.case_id, payload);
      await this.selectCase(current.case_id);
      form.reset();
      this.state.notice = "텍스트 문서를 등록했습니다.";
    });
  }

  private async handleSupportingDocument(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canWrite() || this.state.busy) return;
    const current = this.state.selectedCase;
    if (!current) return;
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const documentId = value(data, "document_id");
    const source = this.state.documents.find((document) => document.document_id === documentId && document.document_type === "SUPPORTING");
    if (!source) {
      this.state.error = "등록된 SUPPORTING 원문을 선택해야 합니다.";
      this.render();
      return;
    }
    if (this.state.supportingDocuments.length >= MAX_SUPPORTING_DOCUMENTS) {
      this.state.error = `요건서류 metadata는 한 심사에 최대 ${MAX_SUPPORTING_DOCUMENTS}개까지 등록할 수 있습니다.`;
      this.render();
      return;
    }
    const payload: SupportingDocumentCreate = {
      document_id: documentId,
      document_code: value(data, "document_code"),
      issuer: value(data, "issuer"),
      document_number: value(data, "document_number"),
      issued_on: value(data, "issued_on"),
      ...(value(data, "valid_until") ? { valid_until: value(data, "valid_until") } : {}),
      subject_item_ids: listValue(data, "subject_item_ids"),
      hs_codes: listValue(data, "hs_codes"),
      source_sha256: source.content_sha256,
    };
    await this.act(async () => {
      await this.api.addSupportingDocument(current.case_id, payload);
      this.state.supportingDocuments = await this.api.listSupportingDocuments(current.case_id);
      form.reset();
      this.state.notice = "원문 hash에 결박된 요건서류 메타데이터를 등록했습니다.";
    });
  }

  private async handleSupportingAssertion(event: Event, supportingDocumentId: string): Promise<void> {
    event.preventDefault();
    if (!this.canApprove() || this.state.busy) return;
    const current = this.state.selectedCase;
    if (!current) return;
    const supportingDocument = this.state.supportingDocuments.find((document) => document.document_id === supportingDocumentId);
    if (!supportingDocument || supportingDocument.created_by === this.state.session?.subject) {
      this.state.error = "요건서류 작성자와 다른 approver만 검증 assertion을 기록할 수 있습니다.";
      this.render();
      return;
    }
    const form = event.currentTarget as HTMLFormElement;
    await this.act(async () => {
      await this.api.addSupportingAssertion(current.case_id, supportingDocumentId, {
        method: "human_approver",
      });
      this.state.supportingDocuments = await this.api.listSupportingDocuments(current.case_id);
      form.reset();
      this.state.notice = "승인자 검증 assertion을 변경 불가능한 감사 기록으로 추가했습니다.";
    });
  }

  private async enqueueReview(): Promise<void> {
    const current = this.state.selectedCase;
    if (!current || !this.canWrite() || this.state.busy || this.jobIsActive()) return;
    const primaryDocuments = this.state.documents.filter((document) => document.document_type !== "SUPPORTING");
    const primaryCharacters = primaryDocuments.reduce((total, document) => total + document.character_count, 0);
    if (primaryDocuments.length === 0) {
      this.state.error = "심사할 텍스트 문서를 먼저 등록하세요.";
      this.render();
      return;
    }
    if (primaryDocuments.some((document) => document.character_count < 1 || document.byte_size < 1)) {
      this.state.error = "일반 문서의 권위 크기 metadata를 확인할 수 없어 심사를 시작할 수 없습니다.";
      this.render();
      return;
    }
    if (primaryDocuments.length > MAX_PRIMARY_DOCUMENTS || primaryCharacters > MAX_PRIMARY_TEXT_CHARACTERS) {
      this.state.error = `심사 입력 한도(${MAX_PRIMARY_DOCUMENTS}문서, ${MAX_PRIMARY_TEXT_CHARACTERS.toLocaleString()}자)를 초과했습니다.`;
      this.render();
      return;
    }
    await this.act(async () => {
      const intent = `review:${current.case_id}`;
      const session = this.requireSession();
      const request = this.reviewRequest();
      const recovery: ReviewRecoveryRecord = {
        org_id: session.org_id,
        subject: session.subject,
        case_id: current.case_id,
        case_revision: current.revision,
        job_id: null,
        job_kind: "review",
        parent_run_id: null,
        review_as_of: request.review_as_of,
        request_sha256: await sha256CanonicalJson(request),
        idempotency_key: this.idempotencyKey(intent),
      };
      this.saveRecovery(recovery);
      await this.submitReviewIntent(recovery, request);
    });
  }

  private async resumePendingReview(recovery: ReviewRecoveryRecord): Promise<void> {
    const current = this.state.selectedCase;
    if (!current || recovery.case_id !== current.case_id || recovery.case_revision !== current.revision || recovery.job_id !== null) return;
    await this.act(async () => this.submitReviewIntent(recovery));
  }

  private async submitReviewIntent(
    recovery: ReviewRecoveryRecord,
    request?: BoundReviewRequest,
  ): Promise<void> {
    try {
      const session = this.requireSession();
      const boundRequest = request ?? this.reviewRequest(recovery.review_as_of ?? undefined);
      const supportedReviewAsOf = this.requireSupportedReviewDate();
      if (
        recovery.org_id !== session.org_id
        || recovery.subject !== session.subject
        || recovery.job_kind !== "review"
        || recovery.parent_run_id !== null
        || recovery.review_as_of !== supportedReviewAsOf
        || boundRequest.review_as_of !== supportedReviewAsOf
        || recovery.request_sha256 !== await sha256CanonicalJson(boundRequest)
      ) {
        throw new Error("저장된 Review 요청이 현재 조직·사용자·요청 본문과 정확히 결박되지 않았습니다.");
      }
      const job = await this.api.enqueueReview(
        recovery.case_id,
        boundRequest,
        recovery.idempotency_key,
      );
      this.assertJobRecoveryBinding(job, recovery);
      this.saveRecovery({ ...recovery, job_id: job.job_id });
      const intent = `review:${recovery.case_id}`;
      this.jobIntentById.set(job.job_id, intent);
      this.state.job = job;
      this.transientPollFailures = 0;
      if (job.status === "queued" || job.status === "running") await this.startJobTracking(job.job_id);
      else await this.handleTerminalJob(job);
    } catch (error) {
      if (isDefinitiveRequestRejection(error)) this.removeRecovery(recovery.case_id);
      throw error;
    }
  }

  private requireSupportedReviewDate(): string {
    const date = this.state.uatMetadata.supported_review_as_of;
    if (!this.state.uatMetadataVerified || date === null || !isStrictIsoDate(date)) {
      throw new Error("Backend가 검증한 LOCAL UAT review 기준일이 없어 심사를 시작할 수 없습니다.");
    }
    return date;
  }

  private reviewRequest(reviewAsOf = this.requireSupportedReviewDate()): BoundReviewRequest {
    const supported = this.requireSupportedReviewDate();
    if (reviewAsOf !== supported) {
      throw new Error("저장된 Review 기준일이 현재 Backend 지원 기준일과 일치하지 않습니다.");
    }
    return {
      review_as_of: supported,
      trade_type: "import",
      submitted_document_codes: [],
    };
  }

  private cancelPollTimer(): void {
    if (this.pollTimer === undefined) return;
    window.clearTimeout(this.pollTimer);
    this.pollTimer = undefined;
  }

  private startChatElapsedTimer(): void {
    this.stopChatElapsedTimer();
    this.chatElapsedTimer = window.setInterval(() => {
      if (
        this.destroyed
        || this.state.chatRequest?.state !== "requesting"
      ) {
        this.stopChatElapsedTimer();
        return;
      }
      this.render();
    }, 1_000);
  }

  private stopChatElapsedTimer(): void {
    if (this.chatElapsedTimer === undefined) return;
    window.clearInterval(this.chatElapsedTimer);
    this.chatElapsedTimer = undefined;
  }

  private startJobElapsedTimer(): void {
    if (this.jobElapsedTimer !== undefined) return;
    this.jobElapsedTimer = window.setInterval(() => {
      if (
        this.destroyed
        || this.jobObservationPausedReason !== undefined
        || this.state.job === undefined
        || (this.state.job.status !== "queued" && this.state.job.status !== "running")
      ) {
        this.stopJobElapsedTimer();
        return;
      }
      this.render();
    }, 1_000);
  }

  private stopJobElapsedTimer(): void {
    if (this.jobElapsedTimer === undefined) return;
    window.clearInterval(this.jobElapsedTimer);
    this.jobElapsedTimer = undefined;
  }

  private invalidateJobLifecycle(): number {
    this.lifecycleEpoch += 1;
    this.cancelPollTimer();
    this.streamAbort?.abort();
    this.streamAbort = undefined;
    return this.lifecycleEpoch;
  }

  private isJobLifecycleActive(lifecycleEpoch: number): boolean {
    return !this.destroyed && this.lifecycleEpoch === lifecycleEpoch;
  }

  private schedulePoll(jobId: string, delayMs = 1_000, lifecycleEpoch = this.lifecycleEpoch): void {
    this.cancelPollTimer();
    if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
    const timer = window.setTimeout(() => {
      if (this.pollTimer === timer) this.pollTimer = undefined;
      if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
      void this.pollJob(jobId, lifecycleEpoch).catch((error: unknown) => {
        if (this.isJobLifecycleActive(lifecycleEpoch)) {
          this.pauseJobObservation(
            "권위 Job 상태 조회를 안전하게 완료하지 못해 자동 관측을 중단했습니다. 새 심사를 만들지 않고 같은 Job만 다시 조회합니다.",
            "심사 상태를 더 이상 자동으로 확인할 수 없습니다. 동일 Job 상태를 다시 확인하세요.",
            error,
          );
        }
      });
    }, delayMs);
    this.pollTimer = timer;
  }

  private beginJobTracking(jobId: string, force = false): void {
    this.jobObservationPausedReason = undefined;
    this.jobObservationPausedAtMs = undefined;
    if (force || this.trackedJobId !== jobId || this.jobTrackingStartedAtMs === undefined) {
      this.trackedJobId = jobId;
      this.jobTrackingStartedAtMs = Date.now();
    }
    this.startJobElapsedTimer();
  }

  private resetJobTracking(jobId?: string): void {
    if (jobId !== undefined && this.trackedJobId !== jobId) return;
    this.stopJobElapsedTimer();
    this.jobObservationPausedReason = undefined;
    this.jobObservationPausedAtMs = undefined;
    this.trackedJobId = undefined;
    this.jobTrackingStartedAtMs = undefined;
  }

  private pauseJobObservation(
    reason: string,
    userMessage: string,
    cause?: unknown,
  ): void {
    // Invalidate the complete observation epoch so an already in-flight GET
    // or SSE callback cannot silently resume stale tracking after this pause.
    this.invalidateJobLifecycle();
    this.stopJobElapsedTimer();
    this.jobObservationPausedAtMs ??= Date.now();
    this.jobObservationPausedReason = reason;
    if (cause instanceof ApiError && cause.status === 401) {
      this.showError(cause, false);
    } else {
      const requestSuffix = cause instanceof ApiError && cause.requestId
        ? ` (요청 ${cause.requestId})`
        : "";
      this.state.error = `${userMessage}${requestSuffix}`;
    }
    this.render();
  }

  private stopIfJobTrackingExpired(jobId: string): boolean {
    this.beginJobTracking(jobId);
    if (
      this.jobTrackingStartedAtMs === undefined
      || Date.now() - this.jobTrackingStartedAtMs < JOB_TRACKING_TIMEOUT_MS
    ) {
      return false;
    }
    this.pauseJobObservation(
      "15분 동안 완료 상태를 확인하지 못했습니다. 실행 실패로 단정하지 않으며 같은 Job만 다시 조회합니다.",
      "심사 상태 자동 관측을 일시 중단했습니다. 동일 Job 상태를 다시 확인하세요.",
    );
    return true;
  }

  private idempotencyKey(intent: string): string {
    const existing = this.idempotencyKeys.get(intent);
    if (existing) return existing;
    const created = crypto.randomUUID();
    this.idempotencyKeys.set(intent, created);
    return created;
  }

  private saveRecovery(record: ReviewRecoveryRecord): void {
    const session = this.requireSession();
    if (
      record.org_id !== session.org_id
      || record.subject !== session.subject
      || !/^[a-f0-9]{64}$/.test(record.request_sha256)
      || (record.job_kind === "review") !== (record.parent_run_id === null)
      || (record.job_kind === "review" ? !isStrictIsoDate(record.review_as_of) : record.review_as_of !== null)
      || (record.job_kind === "revision" && record.job_id === null)
    ) {
      throw new Error("Job 복구 상태가 현재 세션과 일치하지 않습니다.");
    }
    const next = new Map(this.recoveryByCase);
    next.set(record.case_id, record);
    writeReviewRecoveries(session, [...next.values()]);
    this.recoveryByCase.set(record.case_id, record);
    if (record.job_id === null) this.idempotencyKeys.set(`review:${record.case_id}`, record.idempotency_key);
  }

  private saveProposalDecisionRecovery(record: ProposalDecisionRecoveryRecord): void {
    const session = this.requireSession();
    if (
      record.org_id !== session.org_id
      || record.subject !== session.subject
      || !validResourceId(record.case_id)
      || !validResourceId(record.review_run_id)
      || !validResourceId(record.proposal_id)
      || !/^[a-f0-9]{64}$/.test(record.parent_result_digest)
      || !/^[a-f0-9]{64}$/.test(record.request_sha256)
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.idempotency_key)
    ) {
      throw new Error("제안 결정 복구 상태가 현재 세션과 일치하지 않습니다.");
    }
    const next = new Map(this.proposalDecisionRecovery);
    next.set(record.proposal_id, record);
    writeProposalDecisionRecoveries(session, [...next.values()]);
    this.proposalDecisionRecovery.set(record.proposal_id, record);
  }

  private removeProposalDecisionRecovery(proposalId: string): void {
    if (!this.proposalDecisionRecovery.has(proposalId)) return;
    const next = new Map(this.proposalDecisionRecovery);
    next.delete(proposalId);
    writeProposalDecisionRecoveries(this.requireSession(), [...next.values()]);
    this.proposalDecisionRecovery.delete(proposalId);
    for (const intent of [`proposal:${proposalId}:approve`, `proposal:${proposalId}:reject`]) {
      this.idempotencyKeys.delete(intent);
    }
  }

  private saveDeliveryReconciliationRecovery(record: DeliveryReconciliationRecoveryRecord): void {
    const session = this.requireSession();
    if (record.org_id !== session.org_id || record.subject !== session.subject) {
      throw new Error("전달 대조 복구 상태가 현재 세션과 일치하지 않습니다.");
    }
    const next = new Map(this.deliveryReconciliationRecovery);
    next.set(record.job_id, record);
    writeDeliveryReconciliationRecoveries(session, [...next.values()]);
    this.deliveryReconciliationRecovery.set(record.job_id, record);
  }

  private removeDeliveryReconciliationRecovery(jobId: string): void {
    if (!this.deliveryReconciliationRecovery.has(jobId)) return;
    const next = new Map(this.deliveryReconciliationRecovery);
    next.delete(jobId);
    writeDeliveryReconciliationRecoveries(this.requireSession(), [...next.values()]);
    this.deliveryReconciliationRecovery.delete(jobId);
  }

  private assertProposalDecisionResponse(
    response: CorrectionProposalDecisionResponse,
    proposal: CorrectionProposal,
    run: ReviewRun,
    current: CaseDetail,
    recovery: ProposalDecisionRecoveryRecord,
    expectedScopedIdempotencyKey: string,
  ): void {
    const session = this.requireSession();
    const approved = recovery.decision === "approve";
    const responseJob = response.job ?? null;
    const childJobId = response.proposal.child_job_id ?? null;
    if (
      response.proposal.proposal_id !== proposal.proposal_id
      || response.proposal.review_run_id !== run.review_run_id
      || response.proposal.case_id !== current.case_id
      || response.proposal.org_id !== session.org_id
      || response.proposal.parent_result_digest !== run.result_digest
      || response.proposal.parent_input_manifest_sha256 !== run.agent_input_manifest_sha256
      || response.proposal.case_revision !== current.revision
      || response.proposal.decided_by !== session.subject
      || response.proposal.decided_at === undefined
      || response.proposal.decided_at === null
      || response.proposal.status !== (approved ? "approved" : "rejected")
      || response.decision.proposal_id !== proposal.proposal_id
      || response.decision.review_run_id !== run.review_run_id
      || response.decision.case_id !== current.case_id
      || response.decision.org_id !== session.org_id
      || response.decision.decided_by !== session.subject
      || response.decision.decision !== recovery.decision
      || response.decision.idempotency_key !== expectedScopedIdempotencyKey
      || response.decision.idempotency_request_digest !== recovery.request_sha256
      || (approved && (responseJob === null || childJobId === null || responseJob.job_id !== childJobId))
      || (!approved && (responseJob !== null || childJobId !== null))
      || (responseJob !== null && (
        responseJob.case_id !== current.case_id
        || responseJob.kind !== "revision"
        || responseJob.created_by !== session.subject
        || responseJob.parent_run_id !== run.review_run_id
      ))
    ) {
      throw new Error("Backend 제안 결정 응답이 현재 Case·Run·조직·Proposal 계보와 일치하지 않습니다.");
    }
  }

  private assertJobRecoveryBinding(job: JobRecord, recovery: ReviewRecoveryRecord): void {
    const session = this.requireSession();
    if (
      recovery.org_id !== session.org_id
      || recovery.subject !== session.subject
      || job.case_id !== recovery.case_id
      || (recovery.job_id !== null && job.job_id !== recovery.job_id)
      || job.kind !== recovery.job_kind
      || job.created_by !== session.subject
      || (job.parent_run_id ?? null) !== recovery.parent_run_id
      || !/^[a-f0-9]{64}$/.test(recovery.request_sha256)
    ) {
      throw new Error("Backend Job이 저장된 조직·사용자·Case·요청 계보와 일치하지 않습니다.");
    }
  }

  private assertChatBinding(answer: GroundedAnswer, run: ReviewRun): void {
    const current = this.state.selectedCase;
    const session = this.requireSession();
    if (
      !current
      || answer.review_run_id !== run.review_run_id
      || answer.case_id !== current.case_id
      || answer.org_id !== session.org_id
      || answer.bound_result_digest !== run.result_digest
      || answer.snapshot_id !== run.result_digest
    ) {
      throw new Error("Backend Chat 응답이 현재 Case·Run·결과 digest와 결박되지 않았습니다.");
    }
  }

  private assertStoredChatBindings(
    messages: Array<ChatRecord | GroundedAnswer>,
    run: ReviewRun,
  ): void {
    const current = this.state.selectedCase;
    const session = this.requireSession();
    if (!current) throw new Error("Chat 이력을 확인할 현재 Case가 없습니다.");
    const knownCitationIds = new Set([
      ...run.fields.map((item) => item.field_id),
      ...run.issues.map((item) => item.issue_id),
      ...run.evidence.map((item) => item.evidence_id),
      ...run.findings.map((item) => item.finding_id),
      ...run.sources.map((item) => item.source_id),
    ]);
    for (const message of messages) {
      if (
        message.review_run_id !== run.review_run_id
        || message.case_id !== current.case_id
        || message.org_id !== session.org_id
        || message.bound_result_digest !== run.result_digest
      ) {
        throw new Error("Backend 저장 Chat이 현재 Case·Run·결과 digest와 일치하지 않습니다.");
      }
      const status = "message_id" in message ? message.answer_status : message.status;
      const citations = "message_id" in message
        ? message.citations.map((citation) => citation.citation_id ?? citation.evidence_id ?? citation.source_id ?? citation.reference_id)
        : message.claims.flatMap((claim) => claim.citation_ids);
      if (status === "answered" && citations.length === 0) {
        throw new Error("Backend가 근거 없는 저장 Chat 답변을 반환했습니다.");
      }
      if (citations.some((citationId) => !citationId || !knownCitationIds.has(citationId))) {
        throw new Error("Backend 저장 Chat이 현재 Run 밖의 근거를 인용했습니다.");
      }
    }
  }

  private removeRecovery(caseId: string, expectedJobId?: string): void {
    const existing = this.recoveryByCase.get(caseId);
    if (!existing || (expectedJobId !== undefined && existing.job_id !== expectedJobId)) return;
    const next = new Map(this.recoveryByCase);
    next.delete(caseId);
    writeReviewRecoveries(this.requireSession(), [...next.values()]);
    this.recoveryByCase.delete(caseId);
    for (const [intent, key] of this.idempotencyKeys) {
      if (key === existing.idempotency_key) this.idempotencyKeys.delete(intent);
    }
  }

  private clearIdempotencyKeysForJob(job: JobRecord): void {
    if (
      job.status !== "succeeded"
      && job.status !== "failed"
      && job.status !== "response_received_rejected"
    ) return;
    const intent = this.jobIntentById.get(job.job_id);
    if (intent) this.idempotencyKeys.delete(intent);
    this.jobIntentById.delete(job.job_id);
    this.removeRecovery(job.case_id, job.job_id);
    this.removeDeliveryReconciliationRecovery(job.job_id);
  }

  private mergeStageEvent(event: ReviewStageEvent, jobId: string, lifecycleEpoch: number): void {
    if (
      !this.isJobLifecycleActive(lifecycleEpoch)
      || this.state.job?.job_id !== jobId
    ) {
      return;
    }
    const existing = this.state.liveStages.findIndex((item) => item.event_id === event.event_id);
    if (existing >= 0) this.state.liveStages[existing] = event;
    else this.state.liveStages.push(event);
    this.state.liveStages.sort((left, right) => (
      left.sequence - right.sequence || left.occurred_at.localeCompare(right.occurred_at)
    ));
    this.render();
  }

  private async startJobTracking(jobId: string): Promise<void> {
    if (this.destroyed) return;
    const lifecycleEpoch = this.invalidateJobLifecycle();
    this.beginJobTracking(jobId);
    this.streamAbort = new AbortController();
    const streamAbort = this.streamAbort;
    try {
      const liveStages = await this.api.listJobEvents(jobId);
      if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
      this.state.liveStages = liveStages;
    } catch (error) {
      if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
      // Stage events are an observability channel. A transient event-endpoint
      // failure must not hide or cancel the authoritative Job state machine.
      if (error instanceof ApiError && error.status === 401) {
        this.pauseJobObservation(
          "인증이 만료되어 권위 Job 상태 관측을 계속할 수 없습니다. 다시 로그인한 뒤 저장된 같은 Job에 재연결해야 합니다.",
          "세션이 만료되어 심사 상태 자동 관측을 중단했습니다.",
          error,
        );
        return;
      }
      this.state.liveStages = [];
    }
    if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
    void this.consumeStageStream(jobId, streamAbort.signal, lifecycleEpoch);
    this.schedulePoll(jobId, 1_000, lifecycleEpoch);
  }

  private async consumeStageStream(
    jobId: string,
    signal: AbortSignal,
    lifecycleEpoch: number,
  ): Promise<void> {
    while (
      this.isJobLifecycleActive(lifecycleEpoch)
      && !signal.aborted
      && this.state.job?.job_id === jobId
      && this.jobNeedsPolling()
    ) {
      try {
        await this.api.streamJobEvents(
          jobId,
          (event) => this.mergeStageEvent(event, jobId, lifecycleEpoch),
          signal,
        );
        if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
      } catch (error) {
        if (!this.isJobLifecycleActive(lifecycleEpoch) || signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          this.pauseJobObservation(
            "인증이 만료되어 권위 Job 상태 관측을 계속할 수 없습니다. 다시 로그인한 뒤 저장된 같은 Job에 재연결해야 합니다.",
            "세션이 만료되어 심사 상태 자동 관측을 중단했습니다.",
            error,
          );
          return;
        }
      }
      if (
        this.isJobLifecycleActive(lifecycleEpoch)
        && !signal.aborted
        && this.jobNeedsPolling()
      ) {
        await new Promise((resolve) => window.setTimeout(resolve, 750));
        if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
      }
    }
  }

  private async pollJob(jobId: string, lifecycleEpoch = this.lifecycleEpoch): Promise<void> {
    this.cancelPollTimer();
    if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
    const existingFlight = this.pollFlight;
    if (
      existingFlight
      && existingFlight.jobId === jobId
      && existingFlight.lifecycleEpoch === lifecycleEpoch
    ) {
      await existingFlight.promise;
      return;
    }
    const promise = this.runPollJob(jobId, lifecycleEpoch);
    const flight = { jobId, lifecycleEpoch, promise };
    this.pollFlight = flight;
    try {
      await promise;
    } finally {
      if (this.pollFlight === flight) this.pollFlight = undefined;
    }
  }

  private async runPollJob(jobId: string, lifecycleEpoch: number): Promise<void> {
    if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
    const selectedCaseId = this.state.selectedCase?.case_id;
    const selectedRecovery = selectedCaseId ? this.recoveryByCase.get(selectedCaseId) : undefined;
    const trackedJobId = this.state.job?.job_id ?? selectedRecovery?.job_id;
    if (!selectedCaseId || trackedJobId !== jobId) return;
    this.beginJobTracking(jobId);
    try {
      const job = await this.api.getJob(jobId);
      if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
      if (job.job_id !== jobId || job.case_id !== selectedCaseId) {
        throw new Error("Backend Job이 현재 Case의 추적 대상과 일치하지 않습니다.");
      }
      const recovery = this.recoveryByCase.get(selectedCaseId);
      if (recovery && recovery.job_id !== null && recovery.job_id !== job.job_id) {
        throw new Error("Backend Job이 저장된 Case 복구 상태와 일치하지 않습니다.");
      }
      if (recovery?.job_id === job.job_id) this.assertJobRecoveryBinding(job, recovery);
      this.state.job = job;
      this.transientPollFailures = 0;
      try {
        const liveStages = await this.api.listJobEvents(jobId);
        if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
        this.state.liveStages = liveStages;
      } catch (error) {
        if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
        if (error instanceof ApiError && error.status === 401) throw error;
        // Polling Job status remains authoritative when the optional event
        // ledger is temporarily unavailable.
      }
      if (job.status === "succeeded") {
        if (!job.review_run_id) {
          this.pauseJobObservation(
            "완료 상태 응답에 Review Run 식별자가 없어 권위 결과를 선택할 수 없습니다. 새 심사를 만들지 않고 같은 Job만 다시 조회합니다.",
            "완료된 Job에 child Review Run ID가 없어 상태 관측을 중단했습니다. 동일 Job 상태를 다시 확인하세요.",
          );
          return;
        }
        await this.handleTerminalJob(job, lifecycleEpoch);
        return;
      }
      if (
        job.status === "failed"
        || job.status === "delivery_uncertain"
        || job.status === "response_received_rejected"
        || job.status === "response_persistence_uncertain"
      ) {
        await this.handleTerminalJob(job, lifecycleEpoch);
        return;
      }
      if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
      if (this.stopIfJobTrackingExpired(jobId)) return;
      this.render();
      this.schedulePoll(jobId, 1_000, lifecycleEpoch);
    } catch (error) {
      if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
      const transient = isTransientJobPollingError(error);
      if (transient && this.stopIfJobTrackingExpired(jobId)) return;
      if (transient && this.transientPollFailures < MAX_TRANSIENT_POLL_FAILURES) {
        this.transientPollFailures += 1;
        const delay = Math.min(2 ** (this.transientPollFailures - 1) * 1_000, MAX_POLL_DELAY_MS);
        this.state.notice = `Job 상태 조회가 일시적으로 실패했습니다. ${Math.ceil(delay / 1_000)}초 후 저장된 Job에 재연결합니다 (${this.transientPollFailures}/${MAX_TRANSIENT_POLL_FAILURES}).`;
        this.render();
        this.schedulePoll(jobId, delay, lifecycleEpoch);
        return;
      }
      if (transient) {
        this.pauseJobObservation(
          "Job 상태 조회의 일시 오류가 반복되어 자동 재연결을 멈췄습니다. 새 심사를 만들지 않고 같은 Job만 다시 조회합니다.",
          "Job 자동 재연결 한도를 소진했습니다. 동일 Job 상태를 다시 확인하세요.",
          error,
        );
        return;
      }
      this.pauseJobObservation(
        "권위 Job 응답의 권한·식별자·계약을 안전하게 검증하지 못해 자동 관측을 중단했습니다. 새 심사를 만들지 않고 같은 Job만 다시 조회합니다.",
        "심사 상태 응답을 안전하게 확인하지 못했습니다. 동일 Job 상태를 다시 확인하세요.",
        error,
      );
    }
  }

  private async handleTerminalJob(job: JobRecord, lifecycleEpoch = this.lifecycleEpoch): Promise<void> {
    if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
    this.cancelPollTimer();
    this.streamAbort?.abort();
    this.resetJobTracking(job.job_id);
    const recovery = this.recoveryByCase.get(job.case_id);
    if (recovery?.job_id === job.job_id) this.assertJobRecoveryBinding(job, recovery);
    if (job.status === "succeeded") {
      this.clearIdempotencyKeysForJob(job);
      // The Job ledger is authoritative. Show its completed state before the
      // larger immutable Run/Presentation aggregate finishes hydrating so a
      // long result load cannot leave a stale "running" card on screen.
      this.render();
      if (job.review_run_id) {
        await this.selectRun(job.review_run_id, lifecycleEpoch);
        if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
        if (this.state.selectedCase) {
          await this.selectCase(this.state.selectedCase.case_id, job.review_run_id);
        }
      }
      return;
    }
    if (job.status === "failed") {
      this.clearIdempotencyKeysForJob(job);
      if (job.agent_call_state === "delivery_reconciled") {
        this.state.error = undefined;
        this.state.notice = "Backend 감사 원장에서 Agent 미처리가 운영 증거로 확정되었습니다. 기존 Job은 실패로 종결되었고 새 심사를 시작할 수 있습니다.";
        this.render();
        return;
      }
      this.state.error = `심사 Job이 실패했습니다: ${job.error_code ?? "원인 코드 없음"}`;
      this.render();
      return;
    }
    if (job.status === "response_received_rejected") {
      this.clearIdempotencyKeysForJob(job);
      this.state.error = "Agent 응답이 도착했지만 Backend의 계약·근거·안전 검증을 통과하지 못했습니다. 결과는 저장하거나 공개하지 않았습니다. 기술 원인을 수정한 뒤 새 심사를 실행하세요.";
      this.render();
      return;
    }
    if (job.status === "response_persistence_uncertain") {
      const existing = this.recoveryByCase.get(job.case_id);
      if (!existing || existing.job_id !== job.job_id) {
        this.state.error = "Agent 응답 저장 상태를 확정할 수 없고 정확한 요청 복구 기록도 없습니다. 중복 실행하지 말고 Backend 원장과 감사 로그를 운영 대조해야 합니다.";
        this.render();
        return;
      }
      this.assertJobRecoveryBinding(job, existing);
      this.saveRecovery(existing);
      this.state.error = "Agent 응답은 도착했지만 Review Run 저장 완료 여부가 불확실합니다. Job과 Idempotency-Key를 보존했으며 운영 대조 전까지 새 Agent 호출을 차단합니다.";
      this.render();
      return;
    }
    if (job.status === "delivery_uncertain") {
      const existing = this.recoveryByCase.get(job.case_id);
      if (!existing || existing.job_id !== job.job_id) {
        this.state.error = "Agent 전달 상태가 불확실하지만 이 Job의 정확한 요청 digest·종류·사용자 계보를 가진 복구 기록이 없습니다. 새 Agent 호출을 만들지 말고 운영 대조가 필요합니다.";
        this.render();
        return;
      }
      this.assertJobRecoveryBinding(job, existing);
      this.saveRecovery(existing);
      this.state.error = "Agent 호출 결과 수신 여부를 확정할 수 없습니다. Job과 Idempotency-Key를 보존했으며 운영 대조 전까지 이 Case의 새 Agent 호출을 차단합니다.";
      this.render();
    }
  }

  private async reconcileTrackedJob(jobId: string): Promise<void> {
    if (this.state.busy) return;
    const current = this.state.selectedCase;
    const recovery = current ? this.recoveryByCase.get(current.case_id) : undefined;
    if (!current || (this.state.job?.job_id !== jobId && recovery?.job_id !== jobId)) {
      this.state.error = "현재 Case에 결박되지 않은 Job은 재조회할 수 없습니다.";
      this.render();
      return;
    }
    this.jobObservationPausedReason = undefined;
    this.beginJobTracking(jobId, true);
    await this.act(async () => this.pollJob(jobId));
  }

  private async handleDeliveryReconciliation(event: Event, job: JobRecord): Promise<void> {
    event.preventDefault();
    if (!this.canApprove() || this.state.busy || job.status !== "delivery_uncertain") return;
    const current = this.state.selectedCase;
    const recovery = current ? this.recoveryByCase.get(current.case_id) : undefined;
    if (
      !current
      || job.case_id !== current.case_id
      || this.state.job?.job_id !== job.job_id
      || recovery?.job_id !== job.job_id
    ) {
      this.state.error = "현재 Case·Job·복구 식별자가 정확히 일치하지 않아 차단 해소를 거절했습니다.";
      this.render();
      return;
    }
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const evidenceReference = value(data, "evidence_reference_sha256");
    const reason = value(data, "reason");
    if (
      data.get("confirmed_not_processed") !== "confirmed"
      || !/^[a-f0-9]{64}$/.test(evidenceReference)
      || reason.length < 10
      || reason.length > 2_000
    ) {
      this.state.error = "Agent 미처리를 입증하는 SHA-256 증거와 10자 이상의 대조 사유를 확인해야 합니다.";
      this.render();
      return;
    }
    const request = {
      resolution: "confirmed_not_processed" as const,
      evidence_reference_sha256: evidenceReference,
      reason,
    };
    const requestSha256 = await sha256CanonicalJson(request);
    const session = this.requireSession();
    const previousAttempt = this.deliveryReconciliationRecovery.get(job.job_id);
    if (previousAttempt && previousAttempt.request_sha256 !== requestSha256) {
      this.state.error = "응답이 확정되지 않은 기존 대조 요청과 다른 내용은 재전송할 수 없습니다. 먼저 같은 증거와 사유로 Backend 상태를 대조하세요.";
      this.render();
      return;
    }
    if (!previousAttempt) {
      try {
        this.saveDeliveryReconciliationRecovery({
          org_id: session.org_id,
          subject: session.subject,
          case_id: current.case_id,
          job_id: job.job_id,
          request_sha256: requestSha256,
          attempted_at: new Date().toISOString(),
        });
      } catch (error) {
        this.showError(error);
        return;
      }
    }
    await this.act(async () => {
      if (previousAttempt) {
        const authoritative = await this.api.getJob(job.job_id);
        if (authoritative.job_id !== job.job_id || authoritative.case_id !== current.case_id) {
          throw new Error("Backend 권위 Job이 저장된 전달 대조 시도의 Case·Job과 일치하지 않습니다.");
        }
        this.state.job = authoritative;
        if (authoritative.status !== "delivery_uncertain") {
          if (authoritative.status === "succeeded" || authoritative.status === "failed") {
            await this.handleTerminalJob(authoritative);
            return;
          }
          throw new Error("Backend 권위 Job이 대조 재전송을 허용할 수 없는 상태로 변경되었습니다.");
        }
      }
      let reconciled: JobRecord;
      try {
        reconciled = await this.api.reconcileDeliveryUncertain(job.job_id, request);
      } catch (error) {
        if (isDefinitiveRequestRejection(error)) this.removeDeliveryReconciliationRecovery(job.job_id);
        throw error;
      }
      if (reconciled.case_id !== current.case_id || reconciled.job_id !== job.job_id) {
        throw new Error("Backend 대조 결과가 현재 Case·Job과 일치하지 않아 적용하지 않았습니다.");
      }
      this.state.job = reconciled;
      if (reconciled.status === "succeeded" || reconciled.status === "failed") {
        await this.handleTerminalJob(reconciled);
      } else if (reconciled.status === "delivery_uncertain") {
        await this.handleTerminalJob(reconciled);
      } else {
        throw new Error("Backend 대조 결과가 허용되지 않은 Job 상태입니다.");
      }
    });
  }

  private isTrackedJobForCurrentCase(job: JobRecord): boolean {
    const current = this.state.selectedCase;
    if (!current || job.case_id !== current.case_id || this.state.job?.job_id !== job.job_id) return false;
    return this.recoveryByCase.get(current.case_id)?.job_id === job.job_id;
  }

  private async handleRevisionProposal(
    event: Event,
    run: ReviewRun,
    decision: RevisionAction["decision"],
  ): Promise<void> {
    event.preventDefault();
    if (!this.canWrite() || this.state.busy || this.jobIsActive()) return;
    const form = event.currentTarget as HTMLFormElement;
    const current = this.state.selectedCase;
    if (!current || !run.result_digest || !run.agent_input_manifest_sha256) {
      this.state.error = "결과·입력 digest가 없어 안전한 Revision Proposal을 만들 수 없습니다.";
      this.render();
      return;
    }
    const data = new FormData(form);
    const reason = value(data, "reason");
    let action: RevisionAction;
    if (decision === "correct_field") {
      const field = run.fields.find((item) => item.field_id === value(data, "field"));
      if (!field || field.document_id === "unbound-document") return;
      const correction: CorrectionOperation = {
        document_id: field.document_id,
        field_path: field.field_path,
        new_value: value(data, "new_value"),
        reason,
        confidence: 1,
      };
      action = { decision, reason, correction };
    } else if (decision === "confirm_field") {
      const confirmedReferenceId = value(data, "confirmed_reference_id");
      const permitted = run.fields.some((field) => field.source_ids.includes(confirmedReferenceId))
        && run.sources.some((source) => source.source_id === confirmedReferenceId);
      if (!permitted) {
        this.state.error = "현재 Run의 FactLedger 필드 근거만 확인할 수 있습니다.";
        this.render();
        return;
      }
      action = { decision, reason, confirmed_reference_id: confirmedReferenceId };
    } else if (decision === "add_supporting_document") {
      const supportingDocumentId = value(data, "supporting_document_id");
      if (!this.state.supportingDocuments.some((document) => document.document_id === supportingDocumentId)) {
        this.state.error = "현재 Case에 등록된 요건서류만 추가할 수 있습니다.";
        this.render();
        return;
      }
      action = { decision, reason, supporting_document_id: supportingDocumentId };
    } else {
      action = { decision, reason };
    }
    const payload: RevisionProposalCreate = {
      parent_result_digest: run.result_digest,
      parent_input_manifest_sha256: run.agent_input_manifest_sha256,
      case_revision: current.revision,
      actions: [action],
    };
    const proposalIdempotencyKey = `proposal_${await sha256CanonicalJson({ review_run_id: run.review_run_id, payload })}`;
    await this.act(async () => {
      await this.api.createRevisionProposal(run.review_run_id, payload, proposalIdempotencyKey);
      this.state.proposals = await this.api.listRevisionProposals(run.review_run_id);
      form.reset();
      this.state.notice = `${humanize(decision)} 제안을 저장했습니다. 독립 Approver 승인 전에는 원문이나 결과에 적용되지 않습니다.`;
    });
  }

  private async handleRevisionProposalDecision(
    event: Event,
    proposal: CorrectionProposal,
    run: ReviewRun,
    decision: "approve" | "reject",
  ): Promise<void> {
    event.preventDefault();
    if (!this.canDecideProposal(proposal, run) || this.state.busy || this.jobIsActive() || proposal.status !== "pending") return;
    const current = this.state.selectedCase;
    if (!current || !run.result_digest) return;
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const intent = `proposal:${proposal.proposal_id}:${decision}`;
    const idempotencyKey = this.idempotencyKey(intent);
    const payload = {
      decision,
      reason: value(data, "reason"),
      parent_result_digest: run.result_digest,
      case_revision: current.revision,
    };
    const session = this.requireSession();
    const recovery: ProposalDecisionRecoveryRecord = {
      org_id: session.org_id,
      subject: session.subject,
      case_id: current.case_id,
      case_revision: current.revision,
      review_run_id: run.review_run_id,
      proposal_id: proposal.proposal_id,
      decision,
      parent_result_digest: run.result_digest,
      request_sha256: await sha256CanonicalJson({ proposal_id: proposal.proposal_id, decision: payload }),
      idempotency_key: idempotencyKey,
    };
    const expectedScopedIdempotencyKey = `idem_${await sha256CanonicalJson({
      endpoint: "revision-proposal.decide/v1",
      actor_id: session.subject,
      org_id: session.org_id,
      case_id: current.case_id,
      supplied_key: idempotencyKey,
    })}`;
    const previous = this.proposalDecisionRecovery.get(proposal.proposal_id);
    if (previous !== undefined && (
      previous.request_sha256 !== recovery.request_sha256
      || previous.idempotency_key !== recovery.idempotency_key
    )) {
      this.state.error = "응답이 확정되지 않은 이전 제안 결정과 다른 내용을 같은 요청으로 재전송할 수 없습니다.";
      this.render();
      return;
    }
    this.saveProposalDecisionRecovery(recovery);
    await this.act(async () => {
      const response = await this.api.decideRevisionProposal(
        proposal.proposal_id,
        payload,
        idempotencyKey,
      );
      this.assertProposalDecisionResponse(
        response,
        proposal,
        run,
        current,
        recovery,
        expectedScopedIdempotencyKey,
      );
      this.state.proposals = await this.api.listRevisionProposals(run.review_run_id);
      const authoritative = this.state.proposals.find((item) => item.proposal_id === proposal.proposal_id);
      const expectedStatus = decision === "approve" ? "approved" : "rejected";
      const expectedChildJobId = response.job?.job_id ?? null;
      if (!authoritative || authoritative.status === "pending") {
        throw new Error("Backend 제안 상태가 결정 응답을 확정하지 않아 복구 기록을 유지합니다.");
      }
      if (
        authoritative.status !== expectedStatus
        || authoritative.decided_by !== session.subject
        || authoritative.decided_at === undefined
        || authoritative.decided_at === null
        || (authoritative.child_job_id ?? null) !== expectedChildJobId
      ) {
        throw new Error("Backend 권위 Proposal이 현재 승인자의 결정·상태·child Job 계보와 일치하지 않습니다.");
      }
      if (response.job) {
        this.saveRecovery({
          org_id: session.org_id,
          subject: session.subject,
          case_id: current.case_id,
          case_revision: current.revision,
          job_id: response.job.job_id,
          job_kind: "revision",
          parent_run_id: run.review_run_id,
          review_as_of: null,
          request_sha256: recovery.request_sha256,
          idempotency_key: idempotencyKey,
        });
        this.jobIntentById.set(response.job.job_id, intent);
        this.state.job = response.job;
        this.transientPollFailures = 0;
        if (response.job.status === "queued" || response.job.status === "running") await this.startJobTracking(response.job.job_id);
        else await this.handleTerminalJob(response.job);
      } else {
        this.idempotencyKeys.delete(intent);
      }
      this.removeProposalDecisionRecovery(proposal.proposal_id);
      this.state.notice = decision === "approve" ? "승인된 제안으로 child 재심사 Job을 생성했습니다." : "Revision 제안을 거절했습니다. 원본 Run은 변경되지 않았습니다.";
    });
  }

  private async handleChat(event: Event, run: ReviewRun): Promise<void> {
    event.preventDefault();
    if (!this.canChat()) {
      this.state.error = "현재 역할은 새 Case Chat 질문을 생성할 수 없습니다.";
      this.render();
      return;
    }
    if (this.state.busy || this.state.chatRequest?.state === "requesting") {
      this.state.notice = this.state.chatRequest?.state === "requesting"
        ? "이미 답변을 생성하고 있습니다. 현재 질문이 끝난 뒤 다음 질문을 제출해 주세요."
        : "다른 Case 작업을 처리 중입니다. 작업이 끝난 뒤 질문을 제출해 주세요.";
      this.render();
      return;
    }
    const form = event.currentTarget as HTMLFormElement;
    if (!run.result_digest) {
      this.state.error = "결과 digest가 없어 현재 snapshot에 질문을 결박할 수 없습니다.";
      this.render();
      return;
    }
    const data = new FormData(form);
    const question = value(data, "question");
    if (question.trim().length === 0) {
      this.state.error = "질문 내용을 입력해 주세요.";
      this.render();
      return;
    }
    const chatIdempotencyKey = `chat_${await sha256CanonicalJson({
      org_id: this.requireSession().org_id,
      subject: this.requireSession().subject,
      review_run_id: run.review_run_id,
      bound_result_digest: run.result_digest,
      question,
    })}`;
    this.state.chatRequest = {
      review_run_id: run.review_run_id,
      question,
      started_at_ms: Date.now(),
      state: "requesting",
    };
    this.state.busy = true;
    this.state.error = undefined;
    this.state.notice = undefined;
    form.reset();
    this.startChatElapsedTimer();
    this.render();
    try {
      const answer = await this.api.answerCaseQuestion(run.review_run_id, {
        question,
        bound_result_digest: run.result_digest!,
      }, chatIdempotencyKey);
      this.assertChatBinding(answer, run);
      const known = new Set([
        ...run.fields.map((item) => item.field_id),
        ...run.issues.map((item) => item.issue_id),
        ...run.evidence.map((item) => item.evidence_id),
        ...run.findings.map((item) => item.finding_id),
        ...run.sources.map((item) => item.source_id),
      ]);
      for (const claim of answer.claims) {
        if (answer.status === "answered" && claim.citation_ids.length === 0) throw new Error("Backend가 근거 없는 Chat 답변을 반환했습니다.");
        if (claim.citation_ids.some((citationId) => !known.has(citationId))) throw new Error("Backend Chat 답변이 현재 Run 밖의 근거를 인용했습니다.");
      }
      this.state.chatRequest = {
        ...this.state.chatRequest!,
        state: "completed",
        answer,
      };
      try {
        const persisted = await this.api.listChat(run.review_run_id);
        this.assertStoredChatBindings(persisted, run);
        const saved = persisted.find((message) => "message_id" in message && message.message_id === answer.answer_id);
        if (saved) {
          this.state.chat = persisted;
          this.state.chatRequest = undefined;
        } else {
          this.state.notice = "답변은 완료됐지만 저장된 Chat 목록 반영을 아직 확인하지 못했습니다. 현재 답변을 유지하며 새로고침 시 Backend 이력을 다시 확인합니다.";
        }
      } catch {
        this.state.notice = "답변은 완료됐지만 저장된 Chat 이력을 다시 읽지 못했습니다. 현재 답변은 표시하며 새로고침 후 Backend 이력을 확인하세요.";
      }
    } catch (error) {
      const timeout = isTimeoutError(error);
      const message = timeout
        ? "2분 동안 응답 완료를 확인하지 못했습니다. Backend 처리는 계속 완료됐을 수 있습니다. 동일 질문은 같은 Idempotency-Key로 안전하게 다시 시도하거나 저장된 Chat 이력을 다시 불러오세요."
        : error instanceof ApiError
          ? `${error.message}${error.requestId ? ` (요청 ${error.requestId})` : ""}`
          : error instanceof Error
            ? error.message
            : "Chat 처리 중 알 수 없는 오류가 발생했습니다.";
      this.state.chatRequest = {
        ...this.state.chatRequest!,
        state: "failed",
        error: message,
      };
      this.state.error = message;
    } finally {
      this.stopChatElapsedTimer();
      if (!this.destroyed) {
        this.state.busy = false;
        this.render();
      }
    }
  }

  private async refreshCases(): Promise<void> {
    const page = await this.api.listCases();
    this.state.cases = page.items;
    const session = this.requireSession();
    if (this.state.cases.some((item) => item.org_id !== session.org_id)) {
      throw new Error("Backend Case 목록에 다른 조직의 항목이 포함되었습니다.");
    }
    for (const item of this.state.cases) this.restoreScenarioMetadata(item);
  }

  private async openCase(caseId: string): Promise<void> {
    if (this.state.busy) return;
    await this.act(async () => this.selectCase(caseId));
  }

  private async openRun(runId: string): Promise<void> {
    if (this.state.busy) return;
    await this.act(async () => this.selectRun(runId));
  }

  private restoreScenarioMetadata(item: CaseSummary): void {
    const bound = restoreBoundLocalUatScenario(item.external_reference);
    if (bound === null) return;
    this.scenarioByCase.set(item.case_id, bound);
  }

  private async selectCase(caseId: string, preferredRunId?: string): Promise<void> {
    if (this.destroyed) return;
    const lifecycleEpoch = this.invalidateJobLifecycle();
    this.state.job = undefined;
    this.state.liveStages = [];
    this.state.uatEvidenceTrace = undefined;
    this.state.uatEvidenceTraceStatus = "not_applicable";
    this.resetJobTracking();
    this.transientPollFailures = 0;
    const [caseDetail, documentRecords, supportingDocuments, runs, audit] = await Promise.all([
      this.api.getCase(caseId),
      this.api.listDocuments(caseId),
      this.api.listSupportingDocuments(caseId),
      this.api.listReviewRuns(caseId),
      this.api.getAuditEvents(caseId),
    ]);
    if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
    const documents = await Promise.all(documentRecords.map(async (record) => {
      if (record.document_type === "SUPPORTING" || record.content_text !== undefined) return record;
      const hydrated = await this.api.getDocumentContent(caseId, record.document_id);
      if (
        hydrated.document_type !== record.document_type
        || hydrated.filename !== record.filename
        || hydrated.media_type !== record.media_type
        || hydrated.content_sha256 !== record.content_sha256
        || hydrated.byte_size !== record.byte_size
        || hydrated.character_count !== record.character_count
        || hydrated.created_by !== record.created_by
        || hydrated.created_at !== record.created_at
      ) {
        throw new Error("Backend 문서 원문이 목록의 권위 metadata와 일치하지 않습니다.");
      }
      return hydrated;
    }));
    if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
    this.assertCaseAggregate(caseId, caseDetail, documents, supportingDocuments, runs, audit);
    const orderedRuns = [...runs].sort((left, right) => {
      const createdOrder = Date.parse(right.created_at) - Date.parse(left.created_at);
      return createdOrder !== 0
        ? createdOrder
        : right.review_run_id.localeCompare(left.review_run_id);
    });
    this.state.selectedCase = { ...caseDetail, documents, runs: orderedRuns };
    this.state.documents = documents;
    this.state.supportingDocuments = supportingDocuments;
    this.state.runs = orderedRuns;
    this.state.audit = audit;
    this.state.selectedDocumentId = documents[0]?.document_id;
    const runId = preferredRunId ?? orderedRuns[0]?.review_run_id;
    if (runId) {
      await this.selectRun(runId, lifecycleEpoch);
      if (!this.isJobLifecycleActive(lifecycleEpoch)) return;
    }
    else {
      this.state.selectedRun = undefined;
      this.state.parentRun = undefined;
      this.state.chat = [];
      this.state.uatEvidenceTrace = undefined;
      this.state.uatEvidenceTraceStatus = "not_applicable";
    }
    await this.restoreCaseRecovery(caseDetail);
  }

  private async restoreCaseRecovery(caseDetail: CaseDetail): Promise<void> {
    const recovery = this.recoveryByCase.get(caseDetail.case_id);
    if (!recovery) return;
    if (recovery.job_id === null) {
      this.state.notice = recovery.case_revision === caseDetail.revision
        ? "이전 심사 요청의 응답이 확정되지 않아 동일 Idempotency-Key로만 재조회할 수 있습니다."
        : "이전 심사 요청 후 Case revision이 변경되어 운영 대조 전까지 새 심사를 차단합니다.";
      return;
    }
    if (recovery.case_revision !== caseDetail.revision) {
      this.state.error = "저장된 Job의 Case revision이 현재 Case와 달라 권위 Job을 자동 결박하지 않았습니다. 운영 대조 전까지 새 심사는 차단됩니다.";
      return;
    }
    try {
      const job = await this.api.getJob(recovery.job_id);
      this.assertJobRecoveryBinding(job, recovery);
      this.state.job = job;
      if (job.status === "queued" || job.status === "running") await this.startJobTracking(job.job_id);
      else await this.handleTerminalJob(job);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.pauseJobObservation(
          "인증이 만료되어 저장된 Job에 재연결하지 못했습니다. 다시 로그인한 뒤 같은 Job을 확인해야 합니다.",
          "세션이 만료되어 저장된 심사 상태를 확인하지 못했습니다.",
          error,
        );
        return;
      }
      if (isTransientJobPollingError(error)) {
        this.transientPollFailures = 1;
        this.state.notice = "저장된 Job에 일시적으로 연결하지 못했습니다. 새 심사는 차단하고 같은 Job을 자동 재조회합니다.";
        this.schedulePoll(recovery.job_id, 1_000);
        return;
      }
      this.pauseJobObservation(
        "저장된 권위 Job 응답의 권한·식별자·계약을 안전하게 검증하지 못했습니다. 새 심사를 만들지 않고 같은 Job만 다시 조회합니다.",
        "저장된 Job 상태를 안전하게 확인하지 못했습니다. 동일 Job 상태를 다시 확인하세요.",
        error,
      );
    }
  }

  private async selectRun(runId: string, lifecycleEpoch?: number): Promise<void> {
    if (
      this.destroyed
      || (lifecycleEpoch !== undefined && !this.isJobLifecycleActive(lifecycleEpoch))
    ) {
      return;
    }
    const run = await this.api.getReviewRun(runId);
    if (
      this.destroyed
      || (lifecycleEpoch !== undefined && !this.isJobLifecycleActive(lifecycleEpoch))
    ) {
      return;
    }
    const current = this.state.selectedCase;
    const session = this.requireSession();
    if (!current || run.review_run_id !== runId || run.case_id !== current.case_id || run.org_id !== session.org_id) {
      throw new Error("Backend Review Run이 현재 Case·조직·URL 식별자와 일치하지 않습니다.");
    }
    const [chat, decisions, proposals, parentRun] = await Promise.all([
      this.listReadableChat(runId),
      this.api.listDecisions(runId),
      this.api.listRevisionProposals(runId),
      run.parent_run_id ? this.api.getReviewRun(run.parent_run_id) : Promise.resolve(undefined),
    ]);
    if (
      this.destroyed
      || (lifecycleEpoch !== undefined && !this.isJobLifecycleActive(lifecycleEpoch))
    ) {
      return;
    }
    if (run.parent_run_id) {
      const parentSummary = this.state.runs.find((item) => item.review_run_id === run.parent_run_id);
      if (
        !parentRun
        || parentRun.review_run_id !== run.parent_run_id
        || parentRun.case_id !== current.case_id
        || parentRun.org_id !== session.org_id
        || parentRun.parent_run_id === run.review_run_id
        || !parentSummary
        || parentSummary.case_id !== current.case_id
        || parentSummary.org_id !== session.org_id
      ) {
        throw new Error("Backend 부모 Run이 현재 child Run의 직접 Case·조직 계보와 일치하지 않습니다.");
      }
    } else if (parentRun !== undefined) {
      throw new Error("최초 Run 응답에 예기치 않은 부모 Run이 결박되었습니다.");
    }
    if (run.review_disposition === "auto_review_complete") {
      const manifest = run.input_document_manifest ?? [];
      const currentPrimary = this.state.documents.filter((document) => document.document_type !== "SUPPORTING");
      const currentById = new Map(currentPrimary.map((document) => [document.document_id, document]));
      if (
        run.case_revision !== current.revision
        || manifest.length !== currentPrimary.length
        || manifest.some((entry) => {
          const document = currentById.get(entry.document_id);
          return document === undefined
            || document.document_type !== entry.document_type
            || document.content_sha256 !== entry.content_sha256;
        })
      ) {
        throw new Error("자동 사전심사 결과의 입력 manifest가 현재 Case revision·문서 hash와 일치하지 않아 검증된 결과로 표시하지 않습니다.");
      }
    }
    if (decisions.some((item) => item.review_run_id !== runId || item.case_id !== current.case_id || item.org_id !== session.org_id)) {
      throw new Error("Backend 판정 목록에 다른 Case·Run·조직 계보가 포함되었습니다.");
    }
    if (proposals.some((item) => item.review_run_id !== runId || item.case_id !== current.case_id || item.org_id !== session.org_id)) {
      throw new Error("Backend Revision Proposal 목록에 다른 Case·Run·조직 계보가 포함되었습니다.");
    }
    this.assertStoredChatBindings(chat, run);
    let uatEvidenceTrace: UatEvidenceTrace | undefined;
    let uatEvidenceTraceStatus: WorkbenchState["uatEvidenceTraceStatus"] = "not_applicable";
    if (isScenarioEvalRuntime(this.state.uatMetadata)) {
      uatEvidenceTraceStatus = "unavailable";
      if (this.api.getUatEvidenceTrace) {
        try {
          const candidate = await this.api.getUatEvidenceTrace(runId);
          if (
            candidate.knowledge_snapshot_id !== run.release_identity?.evidence_snapshot_id
            || candidate.request_id !== run.evidence_provenance?.request_id
            || candidate.request_id.length === 0
          ) {
            throw new Error("Backend Evidence trace가 현재 Review Run identity와 일치하지 않습니다.");
          }
          uatEvidenceTrace = candidate;
          uatEvidenceTraceStatus = "available";
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) throw error;
          // The Review remains inspectable, but the Actual-RAG axis fails
          // closed and visibly reports that the run-bound safe trace is absent.
        }
      }
    }
    if (
      this.destroyed
      || (lifecycleEpoch !== undefined && !this.isJobLifecycleActive(lifecycleEpoch))
    ) {
      return;
    }
    this.state.selectedRun = run;
    this.state.parentRun = parentRun;
    this.state.chat = chat;
    this.state.decisions = decisions;
    this.state.proposals = proposals;
    this.state.uatEvidenceTrace = uatEvidenceTrace;
    this.state.uatEvidenceTraceStatus = uatEvidenceTraceStatus;
    await this.recoverProposalDecisionState(run, proposals, decisions);
    this.render();
  }

  private assertCaseAggregate(
    requestedCaseId: string,
    caseDetail: CaseDetail,
    documents: CaseDocument[],
    supportingDocuments: SupportingDocumentRecord[],
    runs: RunSummary[],
    audit: AuditEvent[],
  ): void {
    const session = this.requireSession();
    if (caseDetail.case_id !== requestedCaseId || caseDetail.org_id !== session.org_id) {
      throw new Error("Backend Case 응답이 URL 식별자와 현재 조직에 일치하지 않습니다.");
    }
    if (documents.some((item) => item.case_id !== requestedCaseId)) {
      throw new Error("Backend 문서 목록에 다른 Case의 문서가 포함되었습니다.");
    }
    if (supportingDocuments.some((item) => item.case_id !== requestedCaseId || item.org_id !== session.org_id)) {
      throw new Error("Backend 요건서류 목록에 다른 Case·조직 계보가 포함되었습니다.");
    }
    if (runs.some((item) => item.case_id !== requestedCaseId || item.org_id !== session.org_id)) {
      throw new Error("Backend Run 목록에 다른 Case·조직 계보가 포함되었습니다.");
    }
    if (audit.some((item) => item.case_id !== requestedCaseId || item.org_id !== session.org_id)) {
      throw new Error("Backend 감사 목록에 다른 Case·조직 계보가 포함되었습니다.");
    }
  }

  private async recoverProposalDecisionState(
    run: ReviewRun,
    proposals: CorrectionProposal[],
    decisions: HumanDecisionRecord[],
  ): Promise<void> {
    const current = this.state.selectedCase;
    const session = this.requireSession();
    if (!current) return;
    for (const recovery of [...this.proposalDecisionRecovery.values()].filter((item) => item.review_run_id === run.review_run_id)) {
      if (
        recovery.org_id !== session.org_id
        || recovery.subject !== session.subject
        || recovery.case_id !== current.case_id
        || recovery.review_run_id !== run.review_run_id
        || recovery.case_revision !== current.revision
        || recovery.parent_result_digest !== run.result_digest
      ) {
        throw new Error("저장된 제안 결정 복구 기록이 현재 Case·Run·조직·결과와 일치하지 않습니다.");
      }
      const proposal = proposals.find((item) => item.proposal_id === recovery.proposal_id);
      if (!proposal) throw new Error("저장된 제안 결정을 Backend 권위 목록에서 찾을 수 없습니다.");
      if (
        proposal.org_id !== session.org_id
        || proposal.case_id !== current.case_id
        || proposal.review_run_id !== run.review_run_id
        || proposal.parent_result_digest !== run.result_digest
        || proposal.parent_input_manifest_sha256 !== run.agent_input_manifest_sha256
        || proposal.case_revision !== current.revision
      ) {
        throw new Error("Backend Proposal이 저장된 현재 사용자 결정 의도의 Case·Run·result·manifest·revision 계보와 일치하지 않습니다.");
      }
      if (proposal.status === "pending") {
        this.state.notice = "이전 Proposal 결정 응답이 확정되지 않았습니다. 같은 내용과 Idempotency-Key로만 재전송하거나 Backend 상태를 확인하세요.";
        continue;
      }
      const expectedScopedIdempotencyKey = `idem_${await sha256CanonicalJson({
        endpoint: "revision-proposal.decide/v1",
        actor_id: session.subject,
        org_id: session.org_id,
        case_id: current.case_id,
        supplied_key: recovery.idempotency_key,
      })}`;
      const exactDecisions = decisions.filter((decision) => (
        decision.proposal_id === recovery.proposal_id
        && decision.review_run_id === recovery.review_run_id
        && decision.case_id === recovery.case_id
        && decision.org_id === recovery.org_id
        && decision.decided_by === recovery.subject
        && decision.decision === recovery.decision
        && decision.idempotency_key === expectedScopedIdempotencyKey
        && decision.idempotency_request_digest === recovery.request_sha256
      ));
      if (exactDecisions.length === 0 || proposal.decided_by !== recovery.subject) {
        this.removeProposalDecisionRecovery(proposal.proposal_id);
        this.state.notice = "이 Proposal은 다른 결정 요청 또는 다른 승인자에 의해 먼저 종결되어 현재 로컬 의도는 superseded 처리했습니다. 해당 child Job에는 현재 raw Idempotency-Key를 결박하지 않습니다.";
        continue;
      }
      const approved = recovery.decision === "approve";
      if (
        exactDecisions.length !== 1
        || proposal.decided_at === undefined
        || proposal.decided_at === null
        || (proposal.status === "approved") !== approved
        || (approved && !proposal.child_job_id)
        || (!approved && proposal.child_job_id !== undefined && proposal.child_job_id !== null)
      ) {
        throw new Error("Backend에 확정된 Proposal 결정이 저장된 현재 사용자 의도와 일관되지 않습니다.");
      }
      if (proposal.status === "approved") {
        if (!proposal.child_job_id) throw new Error("승인된 Proposal에 child Job 계보가 없습니다.");
        const job = await this.api.getJob(proposal.child_job_id);
        if (
          job.job_id !== proposal.child_job_id
          || job.case_id !== current.case_id
          || job.kind !== "revision"
          || job.created_by !== session.subject
          || job.parent_run_id !== run.review_run_id
        ) {
          throw new Error("Proposal child Job이 현재 Case의 Revision 계보와 일치하지 않습니다.");
        }
        this.saveRecovery({
          org_id: session.org_id,
          subject: session.subject,
          case_id: current.case_id,
          case_revision: recovery.case_revision,
          job_id: job.job_id,
          job_kind: "revision",
          parent_run_id: run.review_run_id,
          review_as_of: null,
          request_sha256: recovery.request_sha256,
          idempotency_key: recovery.idempotency_key,
        });
        this.jobIntentById.set(job.job_id, `proposal:${proposal.proposal_id}:approve`);
        this.state.job = job;
        if (job.status === "queued" || job.status === "running") await this.startJobTracking(job.job_id);
        else await this.handleTerminalJob(job);
      }
      this.removeProposalDecisionRecovery(proposal.proposal_id);
    }
  }

  private async listReadableChat(runId: string): Promise<Array<ChatRecord | GroundedAnswer>> {
    try {
      return await this.api.listChat(runId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && this.hasRole("auditor") && !this.canChat()) {
        this.state.notice = "Chat 이력 권한이 아직 적용되지 않아 나머지 Run 상세만 표시합니다.";
        return [];
      }
      throw error;
    }
  }

  private async act(action: () => Promise<void>): Promise<void> {
    if (this.destroyed) return;
    this.state.busy = true;
    this.state.error = undefined;
    this.state.notice = undefined;
    this.render();
    try {
      await action();
    } catch (error) {
      this.showError(error, false);
    } finally {
      if (!this.destroyed) {
        this.state.busy = false;
        this.render();
      }
    }
  }

  private showError(error: unknown, render = true): void {
    if (this.destroyed) return;
    if (error instanceof ApiError) {
      const suffix = error.requestId ? ` (요청 ${error.requestId})` : "";
      this.state.error = `${error.message}${suffix}`;
      if (error.status === 401) {
        this.state.error += " 세션이 만료되었습니다. 다시 로그인하세요.";
        this.state.session = undefined;
        this.streamAbort?.abort();
        void this.auth.clear();
      }
      if (error.status === 409) this.state.error += " Case가 변경되었습니다. 최신 Run을 불러온 뒤 다시 시도하세요.";
      if (error.status === 422) this.state.error += " Evidence·판정 상태는 사용자가 수정할 수 없습니다.";
    } else {
      this.state.error = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    }
    if (render) this.render();
  }
}

function value(data: FormData, key: string): string {
  const item = data.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function rawValue(data: FormData, key: string): string {
  const item = data.get(key);
  return typeof item === "string" ? item : "";
}

function listValue(data: FormData, key: string): string[] {
  return [...new Set(value(data, key).split(",").map((item) => item.trim()).filter(Boolean))].sort();
}

function disabledUnless(enabled: boolean): Record<string, string> {
  return enabled ? {} : { disabled: "", "aria-disabled": "true" };
}

function formatIdentityValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function readReviewRecoveries(session: Session): ReviewRecoveryRecord[] {
  const key = recoveryStorageKey(REVIEW_RECOVERY_STORAGE_PREFIX, session);
  const serialized = window.sessionStorage.getItem(key);
  if (serialized === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error("저장된 Job 복구 상태가 손상되어 안전하게 심사를 시작할 수 없습니다.");
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_RECOVERY_RECORDS) {
    throw new Error("저장된 Job 복구 상태 형식이 올바르지 않습니다.");
  }
  return parsed.map((value, index) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`Job 복구 상태 ${index + 1}번이 올바르지 않습니다.`);
    }
    const raw = value as Record<string, unknown>;
    const keys = Object.keys(raw).sort();
    if (keys.join(",") !== "case_id,case_revision,idempotency_key,job_id,job_kind,org_id,parent_run_id,request_sha256,review_as_of,subject") {
      throw new Error(`Job 복구 상태 ${index + 1}번에 허용되지 않은 필드가 있습니다.`);
    }
    if (
      raw.org_id !== session.org_id
      || raw.subject !== session.subject
      || typeof raw.case_id !== "string"
      || !/^[A-Za-z0-9._:-]{1,160}$/.test(raw.case_id)
      || !Number.isInteger(raw.case_revision)
      || Number(raw.case_revision) < 0
      || (raw.job_id !== null && (typeof raw.job_id !== "string" || !/^[A-Za-z0-9._:-]{1,160}$/.test(raw.job_id)))
      || (raw.job_kind !== "review" && raw.job_kind !== "revision")
      || (raw.parent_run_id !== null && !validResourceId(raw.parent_run_id))
      || (raw.job_kind === "review") !== (raw.parent_run_id === null)
      || (raw.job_kind === "review" ? !isStrictIsoDate(raw.review_as_of) : raw.review_as_of !== null)
      || (raw.job_kind === "review" && raw.request_sha256 !== sha256CanonicalJsonSync({
        review_as_of: raw.review_as_of,
        trade_type: "import",
        submitted_document_codes: [],
      }))
      || (raw.job_kind === "revision" && raw.job_id === null)
      || typeof raw.request_sha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(raw.request_sha256)
      || typeof raw.idempotency_key !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.idempotency_key)
    ) {
      throw new Error(`Job 복구 상태 ${index + 1}번의 값이 올바르지 않습니다.`);
    }
    const parentRunId = typeof raw.parent_run_id === "string" ? raw.parent_run_id : null;
    const jobId = typeof raw.job_id === "string" ? raw.job_id : null;
    return {
      org_id: session.org_id,
      subject: session.subject,
      case_id: raw.case_id,
      case_revision: Number(raw.case_revision),
      job_id: jobId,
      job_kind: raw.job_kind,
      parent_run_id: parentRunId,
      review_as_of: typeof raw.review_as_of === "string" ? raw.review_as_of : null,
      request_sha256: raw.request_sha256,
      idempotency_key: raw.idempotency_key,
    };
  });
}

function writeReviewRecoveries(session: Session, records: ReviewRecoveryRecord[]): void {
  if (records.length > MAX_RECOVERY_RECORDS || records.some((item) => (
    item.org_id !== session.org_id
    || item.subject !== session.subject
    || (item.job_kind === "review" ? !isStrictIsoDate(item.review_as_of) : item.review_as_of !== null)
  ))) {
    throw new Error("Job 복구 기록의 세션 범위 또는 개수 한도가 올바르지 않습니다.");
  }
  const sorted = [...records].sort((left, right) => left.case_id.localeCompare(right.case_id));
  const key = recoveryStorageKey(REVIEW_RECOVERY_STORAGE_PREFIX, session);
  if (sorted.length === 0) window.sessionStorage.removeItem(key);
  else window.sessionStorage.setItem(key, JSON.stringify(sorted));
}

function readProposalDecisionRecoveries(session: Session): ProposalDecisionRecoveryRecord[] {
  const key = recoveryStorageKey(PROPOSAL_DECISION_RECOVERY_STORAGE_PREFIX, session);
  const serialized = window.sessionStorage.getItem(key);
  if (serialized === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error("저장된 Proposal 결정 복구 상태가 손상되었습니다.");
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_RECOVERY_RECORDS) {
    throw new Error("저장된 Proposal 결정 복구 상태 형식이 올바르지 않습니다.");
  }
  return parsed.map((value, index) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`Proposal 결정 복구 상태 ${index + 1}번이 올바르지 않습니다.`);
    }
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).sort().join(",") !== "case_id,case_revision,decision,idempotency_key,org_id,parent_result_digest,proposal_id,request_sha256,review_run_id,subject") {
      throw new Error(`Proposal 결정 복구 상태 ${index + 1}번에 허용되지 않은 필드가 있습니다.`);
    }
    if (
      raw.org_id !== session.org_id
      || raw.subject !== session.subject
      || !validResourceId(raw.case_id)
      || !validResourceId(raw.review_run_id)
      || !validResourceId(raw.proposal_id)
      || !Number.isInteger(raw.case_revision)
      || Number(raw.case_revision) < 0
      || (raw.decision !== "approve" && raw.decision !== "reject")
      || typeof raw.parent_result_digest !== "string"
      || !/^[a-f0-9]{64}$/.test(raw.parent_result_digest)
      || typeof raw.request_sha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(raw.request_sha256)
      || typeof raw.idempotency_key !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.idempotency_key)
    ) {
      throw new Error(`Proposal 결정 복구 상태 ${index + 1}번의 값이 올바르지 않습니다.`);
    }
    return {
      org_id: session.org_id,
      subject: session.subject,
      case_id: String(raw.case_id),
      case_revision: Number(raw.case_revision),
      review_run_id: String(raw.review_run_id),
      proposal_id: String(raw.proposal_id),
      decision: raw.decision,
      parent_result_digest: raw.parent_result_digest,
      request_sha256: raw.request_sha256,
      idempotency_key: raw.idempotency_key,
    };
  });
}

function writeProposalDecisionRecoveries(session: Session, records: ProposalDecisionRecoveryRecord[]): void {
  if (records.length > MAX_RECOVERY_RECORDS || records.some((item) => item.org_id !== session.org_id || item.subject !== session.subject)) {
    throw new Error("Proposal 결정 복구 기록의 세션 범위 또는 개수 한도가 올바르지 않습니다.");
  }
  const key = recoveryStorageKey(PROPOSAL_DECISION_RECOVERY_STORAGE_PREFIX, session);
  const sorted = [...records].sort((left, right) => left.proposal_id.localeCompare(right.proposal_id));
  if (sorted.length === 0) window.sessionStorage.removeItem(key);
  else window.sessionStorage.setItem(key, JSON.stringify(sorted));
}

function readDeliveryReconciliationRecoveries(session: Session): DeliveryReconciliationRecoveryRecord[] {
  const key = recoveryStorageKey(DELIVERY_RECONCILIATION_RECOVERY_STORAGE_PREFIX, session);
  const serialized = window.sessionStorage.getItem(key);
  if (serialized === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error("저장된 전달 대조 복구 상태가 손상되었습니다.");
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_RECOVERY_RECORDS) {
    throw new Error("저장된 전달 대조 복구 상태 형식이 올바르지 않습니다.");
  }
  return parsed.map((value, index) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`전달 대조 복구 상태 ${index + 1}번이 올바르지 않습니다.`);
    }
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).sort().join(",") !== "attempted_at,case_id,job_id,org_id,request_sha256,subject") {
      throw new Error(`전달 대조 복구 상태 ${index + 1}번에 허용되지 않은 필드가 있습니다.`);
    }
    if (
      raw.org_id !== session.org_id
      || raw.subject !== session.subject
      || !validResourceId(raw.case_id)
      || !validResourceId(raw.job_id)
      || typeof raw.request_sha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(raw.request_sha256)
      || typeof raw.attempted_at !== "string"
      || !isStrictIsoTimestamp(raw.attempted_at)
    ) {
      throw new Error(`전달 대조 복구 상태 ${index + 1}번의 값이 올바르지 않습니다.`);
    }
    return {
      org_id: session.org_id,
      subject: session.subject,
      case_id: String(raw.case_id),
      job_id: String(raw.job_id),
      request_sha256: raw.request_sha256,
      attempted_at: raw.attempted_at,
    };
  });
}

function writeDeliveryReconciliationRecoveries(session: Session, records: DeliveryReconciliationRecoveryRecord[]): void {
  if (
    records.length > MAX_RECOVERY_RECORDS
    || records.some((item) => item.org_id !== session.org_id || item.subject !== session.subject)
    || new Set(records.map((item) => item.job_id)).size !== records.length
  ) {
    throw new Error("전달 대조 복구 기록의 세션 범위 또는 개수 한도가 올바르지 않습니다.");
  }
  const key = recoveryStorageKey(DELIVERY_RECONCILIATION_RECOVERY_STORAGE_PREFIX, session);
  const sorted = [...records].sort((left, right) => left.job_id.localeCompare(right.job_id));
  if (sorted.length === 0) window.sessionStorage.removeItem(key);
  else window.sessionStorage.setItem(key, JSON.stringify(sorted));
}

function recoveryStorageKey(prefix: string, session: Session): string {
  if (!validNamespaceValue(session.org_id) || !validNamespaceValue(session.subject)) {
    throw new Error("세션 조직/사용자 식별자를 안전한 복구 namespace로 사용할 수 없습니다.");
  }
  return `${prefix}:${encodeURIComponent(session.org_id)}:${encodeURIComponent(session.subject)}`;
}

function validNamespaceValue(value: string): boolean {
  return value.length >= 1 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value);
}

function validResourceId(value: unknown): boolean {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,160}$/.test(value);
}

function isStrictIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
}

function isStrictIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

async function sha256CanonicalJson(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function sha256CanonicalJsonSync(value: unknown): string {
  return [...nobleSha256(new TextEncoder().encode(canonicalJson(value)))]
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  throw new Error("멱등성 식별자에 직렬화할 수 없는 값이 포함되었습니다.");
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}분 ${String(seconds).padStart(2, "0")}초` : `${seconds}초`;
}

function jobStatusLabel(status: JobRecord["status"]): string {
  switch (status) {
    case "queued": return "실행 대기";
    case "running": return "심사 진행 중";
    case "succeeded": return "심사 결과 저장 완료";
    case "failed": return "심사 실행 실패";
    case "delivery_uncertain": return "Agent 전달 확인 필요";
    case "response_received_rejected": return "Agent 응답 검증 거절";
    case "response_persistence_uncertain": return "결과 저장 확인 필요";
  }
}

function jobStatusExplanation(job: JobRecord): string {
  switch (job.status) {
    case "queued":
      return "심사 요청을 접수했으며 실행 Worker 연결을 기다리고 있습니다.";
    case "running":
      return "Claude 분석, 문서 정합성 검증, 법령 Evidence 조회를 진행하고 있습니다.";
    case "succeeded":
      return "Agent 응답 검증과 Review Run 저장이 모두 완료됐습니다. 아래 사용자 브리핑에서 결과와 이유를 확인하세요.";
    case "failed":
      return job.agent_call_state === "delivery_reconciled"
        ? "운영 증거로 Agent 미처리를 확인해 기존 Job을 안전하게 종결했습니다."
        : "심사 실행을 완료하지 못했습니다. 잘못된 결과는 저장하지 않았습니다.";
    case "delivery_uncertain":
      return "Agent가 요청을 받았는지 확정할 수 없어 중복 호출을 방지하도록 Case를 잠갔습니다.";
    case "response_received_rejected":
      return "Agent 응답은 도착했지만 Backend 안전 검증을 통과하지 못해 결과를 저장하지 않았습니다.";
    case "response_persistence_uncertain":
      return "검증된 Agent 응답의 저장 완료 여부를 확정할 수 없어 중복 처리를 방지하도록 Case를 잠갔습니다.";
  }
}

function reviewStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    queued: "심사 요청 접수",
    input_validation: "입력 문서와 실행 조건 검증",
    agent_analysis: "Claude 문서 분석·Agent 심사·법령 조회",
    result_validation: "근거·계약·결과 안전 검증",
    persistence: "검증된 Review Run 저장",
    document_analysis: "문서별 Claude 분류·추출",
    normalization: "추출값 정규화",
    validation: "문서 간 정합성 검증",
    evidence: "법령 Evidence 조회",
    compliance: "규정 요건 검토",
    report: "사용자 설명 보고서 작성",
    completed: "심사 완료",
    failed: "심사 중단",
  };
  return labels[stage] ?? humanize(stage);
}

function reviewStageStatusLabel(status: ReviewStageEvent["status"]): string {
  switch (status) {
    case "pending": return "대기";
    case "running": return "진행 중";
    case "succeeded": return "완료";
    case "failed": return "실패";
  }
}

function reviewStageMessage(message: string): string {
  const messages: Record<string, string> = {
    "review.queued": "심사 요청을 접수했습니다",
    "revision.queued": "승인된 수정으로 재심사를 접수했습니다",
    "review.input_validation_started": "문서 snapshot과 입력 한도를 확인하고 있습니다",
    "review.input_validation_completed": "입력 검증을 완료했습니다",
    "agent.analysis_started": "Claude와 Agent가 문서 분석·교차검증·Evidence 조회를 실행하고 있습니다",
    "agent.analysis_completed": "Agent 분석과 Evidence 조회를 완료했습니다",
    "agent.response_validation_started": "응답의 근거 결박과 안전 계약을 확인하고 있습니다",
    "agent.response_validation_completed": "응답 안전 검증을 완료했습니다",
    "review.persistence_started": "검증된 결과를 변경 불가능한 Run으로 저장하고 있습니다",
    "review.completed": "심사 결과 저장을 완료했습니다",
    "review.agent_pre_execution_retry_scheduled": "Agent 실행 전 준비 상태를 다시 확인한 뒤 같은 Job으로 재시도합니다",
    "review.agent_pre_execution_retry_exhausted": "Agent 실행 전 준비 상태 확인이 반복 실패해 심사를 중단했습니다",
    "review.delivery_uncertain": "Agent 전달 여부를 확정할 수 없습니다",
    "review.response_received_rejected": "Agent 응답이 Backend 안전 검증을 통과하지 못했습니다",
    "review.response_persistence_uncertain": "Agent 응답 저장 완료 여부를 확정할 수 없습니다",
  };
  return messages[message] ?? humanize(message);
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "TimeoutError" || error.name === "AbortError"
    : error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function isDefinitiveRequestRejection(error: unknown): boolean {
  return error instanceof ApiError
    && error.status >= 400
    && error.status < 500
    && ![408, 409, 425, 429].includes(error.status);
}

function isTransientJobPollingError(error: unknown): boolean {
  return error instanceof TypeError
    || (error instanceof ApiError && [408, 425, 429, 500, 502, 503, 504].includes(error.status));
}

interface ParentChildDiffRow {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

function parentChildDiffRows(parent: ReviewRun, child: ReviewRun): ParentChildDiffRow[] {
  const rows: ParentChildDiffRow[] = [];
  const add = (label: string, before: string | undefined, after: string | undefined, humanReadable = false): void => {
    const safeBefore = before ?? "not_available";
    const safeAfter = after ?? "not_available";
    rows.push({
      label,
      before: humanReadable ? humanize(safeBefore) : safeBefore,
      after: humanReadable ? humanize(safeAfter) : safeAfter,
      changed: safeBefore !== safeAfter,
    });
  };
  add("실행", parent.execution_status, child.execution_status, true);
  add("문서·규정 평가", parent.assessment, child.assessment, true);
  add("업무 처리", parent.review_disposition, child.review_disposition, true);
  add("보증 수준", parent.assurance_level, child.assurance_level, true);

  const summarize = (values: string[]): string => {
    const sorted = [...new Set(values)].sort();
    return sorted.length === 0 ? "없음" : sorted.join(", ");
  };
  add("Issue 코드", summarize(parent.issues.map((item) => item.code)), summarize(child.issues.map((item) => item.code)));
  add("Finding 코드", summarize(parent.findings.map((item) => item.code)), summarize(child.findings.map((item) => item.code)));
  add("Evidence ID", summarize(parent.evidence.map((item) => item.evidence_id)), summarize(child.evidence.map((item) => item.evidence_id)));
  add("필수 조치", summarize(parent.required_actions.map((item) => item.code)), summarize(child.required_actions.map((item) => item.code)));

  const parentFields = new Map(parent.fields.map((field) => [`${field.document_id}\u0000${field.field_path}`, field]));
  const childFields = new Map(child.fields.map((field) => [`${field.document_id}\u0000${field.field_path}`, field]));
  const fieldKeys = [...new Set([...parentFields.keys(), ...childFields.keys()])].sort();
  for (const key of fieldKeys) {
    const before = parentFields.get(key);
    const after = childFields.get(key);
    const beforeValue = before ? formatDiffValue(before.value) : "필드 없음";
    const afterValue = after ? formatDiffValue(after.value) : "필드 없음";
    if (beforeValue === afterValue) continue;
    const displayPath = (after ?? before)?.field_path ?? key.replace("\u0000", " · ");
    add(`추출값 · ${displayPath}`, beforeValue, afterValue);
  }
  return rows;
}

function formatDiffValue(value: ExtractedField["value"]): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  return String(value);
}

export function createWorkbench(root: HTMLElement, api: ApiClient, auth: OidcSession): WorkbenchApp {
  return new WorkbenchApp(root, api, auth);
}
