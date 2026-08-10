import { ApiClient } from "./api/v1/client";
import { isCaseCitation, isDocumentSource } from "./api/v1/types";
import { officialGuidanceUrl } from "./official-guidance-url";
import { userFacingErrorMessage } from "./api/user-facing-errors";
import {
  assessmentLabel,
  assistantAnswerSectionDescription,
  assistantAnswerSectionIcon,
  assistantAnswerSectionLabel,
  assistantNarrativeFallback,
  assistantSuggestionLabel,
  casePresentation,
  caseGuidanceResolutionNotice,
  caseReferenceLabel,
  caseStatusLabel,
  citationLabel,
  comparisonRuleLabel,
  comparisonNarrativeFallback,
  comparisonStatusLabel,
  controlledStructuredValue,
  correctionFieldChoices,
  correctionHistoryLabel,
  correctionStatusLabel,
  displayValue,
  documentAnalysisDisplayName,
  documentDisplayName,
  documentTypeLabel,
  executionStatusLabel,
  evidenceDisplayTitle,
  evidenceSourceLabel,
  evidenceSummary,
  fieldLabel,
  fieldValueLabel,
  findingTitle,
  findingNarrativeFallback,
  isFunctionalUatCase,
  jobStatusLabel,
  guidanceCitationTitle,
  guidanceDirectionLabel,
  guidanceScopeLabel,
  knowledgeCoverageLabel,
  knowledgeAnswerBoundaryNotice,
  knowledgeSourceKindLabel,
  knowledgeTradeTypeLabel,
  plannerActionLabel,
  plannerNarrativeFallback,
  reportClaimFallback,
  reportDisclaimerFallback,
  reportSectionDescription,
  reportSectionLabel,
  reportSummaryFallback,
  redactedStructuredVerificationValue,
  requiredActionLabel,
  requiredActionNarrativeFallback,
  reviewerDecisionLabel,
  reviewDispositionLabel,
  reviewRunRelationLabel,
  reviewerNarrative,
  reviewerNarrativeOriginal,
  requiresControlledNarrative,
  roleSummary,
  technicalLine,
  tradeTypeLabel,
  workflowStageLabel,
  workflowNarrativeFallback,
  workflowStatusLabel,
  assistantScopeLabel,
} from "./presentation";
import type { CasePresentation } from "./presentation";
import type {
  AssistantCitation,
  AssistantAnswerSection,
  AssistantConversation,
  AssistantCorrectionDraft,
  AssistantMessage,
  CaseDetail,
  CaseCitation,
  CaseDocument,
  CaseSummary,
  CorrectionProposal,
  CreateCorrectionProposalRequest,
  DocumentType,
  DocumentFact,
  EvidenceItem,
  FindingDecisionRequest,
  GuidanceEvidenceCitation,
  JobRecord,
  KnowledgeConversation,
  KnowledgeMessage,
  KnowledgeTradeType,
  RequiredAction,
  ReviewComparison,
  ReportClaim,
  ReportSection,
  ReviewerDecision,
  ReviewFinding,
  ReviewRun,
  ReviewRunSummary,
  SourceReference,
  Session,
  TradeType,
} from "./api/v1/types";
import {
  supportsDevelopmentRoleSwitch,
  type BrowserSession,
  type LocalDevelopmentActor,
} from "./auth";

export type FrontendRuntimeMode = "local-development" | "functional-uat";
type WorkspaceTab = "documents" | "analysis" | "assistant" | "evidence" | "history";
type CaseFilter = "all" | "open" | "in_review" | "closed" | "functional_uat";
type JobPurpose = "review" | "revision";
type WorkspaceRoute =
  | { kind: "case"; caseId: string | null; tab: WorkspaceTab }
  | { kind: "knowledge" };

interface WorkbenchState {
  session: Session | null;
  cases: CaseSummary[];
  /** Case summaries are never loaded just for the standalone knowledge route. */
  casesLoaded: boolean;
  selectedCase: CaseDetail | null;
  documents: CaseDocument[];
  runs: ReviewRunSummary[];
  selectedRun: ReviewRun | null;
  selectedDocument: (CaseDocument & { content_text: string }) | null;
  sourceFocus: SourceReference | null;
  factFocusId: string | null;
  activeJob: JobRecord | null;
  activeJobPurpose: JobPurpose | null;
  reviewTradeType: TradeType;
  activeTab: WorkspaceTab;
  comparisonFocusId: string | null;
  evidenceFocusId: string | null;
  assistantConversations: AssistantConversation[];
  selectedConversation: AssistantConversation | null;
  assistantMessages: AssistantMessage[];
  assistantLoadedRunId: string | null;
  assistantLoading: boolean;
  assistantSending: boolean;
  assistantDraft: string;
  assistantRetryContent: string | null;
  assistantRetryIdempotencyKey: string | null;
  assistantError: string | null;
  knowledgeConversations: KnowledgeConversation[];
  selectedKnowledgeConversation: KnowledgeConversation | null;
  knowledgeMessages: KnowledgeMessage[];
  knowledgeLoaded: boolean;
  knowledgeLoading: boolean;
  knowledgeSending: boolean;
  knowledgeDraft: string;
  knowledgeRetryContent: string | null;
  knowledgeRetryIdempotencyKey: string | null;
  knowledgeError: string | null;
  knowledgeTradeType: KnowledgeTradeType;
  knowledgeAsOf: string;
  correctionProposals: CorrectionProposal[];
  correctionLoadedRunId: string | null;
  correctionLoading: boolean;
  correctionError: string | null;
  correctionDraft: AssistantCorrectionDraft | null;
  selectedCorrectionProposalIds: Set<string>;
  caseFilter: CaseFilter;
  query: string;
  busy: boolean;
  notice: string | null;
  error: string | null;
}

interface CorrectionFactTarget {
  documentId: string;
  factId: string;
  itemId: string | null;
  fieldName: string;
}

const DOCUMENT_TYPES: readonly DocumentType[] = [
  "CI", "PL", "BL", "CO", "AWB", "EXPORT_DECLARATION", "SUPPORTING_EVIDENCE", "UNKNOWN",
];
const ACTIVE_JOB_STATES = new Set(["queued", "running"]);
const REVIEW_FAILURE_MESSAGE = "심사를 완료하지 못했습니다. 입력 문서와 서비스 상태를 확인한 뒤 다시 시도해 주십시오. 기존 심사 결과는 변경되지 않았습니다.";
const REVISION_FAILURE_MESSAGE = "수정 반영 재심사를 완료하지 못했습니다. 승인된 정정 제안을 다시 선택한 뒤 재시도해 주십시오. 기존 심사 결과는 변경되지 않았습니다.";
const REVIEW_RESULT_VISIBILITY_RETRY_DELAYS_MS = [200, 500, 900] as const;
const REVIEW_RESULT_VISIBILITY_FAILURE_MESSAGE = "심사 결과가 아직 화면에 준비되지 않았습니다. 잠시 후 이력에서 다시 확인해 주십시오. 기존 심사 결과는 변경되지 않았습니다.";
const TABS: readonly { id: WorkspaceTab; label: string }[] = [
  { id: "documents", label: "문서" },
  { id: "analysis", label: "AI 심사" },
  { id: "assistant", label: "AI 도우미" },
  { id: "evidence", label: "근거" },
  { id: "history", label: "이력" },
];

/**
 * Browser-only case workspace. It consumes only the Backend v1 API and makes
 * no direct Agent, Data, database, or provider request.
 */
export class CommercialReviewWorkspace {
  private state: WorkbenchState = {
    session: null,
    cases: [],
    casesLoaded: false,
    selectedCase: null,
    documents: [],
    runs: [],
    selectedRun: null,
    selectedDocument: null,
    sourceFocus: null,
    factFocusId: null,
    activeJob: null,
    activeJobPurpose: null,
    reviewTradeType: "import",
    activeTab: "documents",
    comparisonFocusId: null,
    evidenceFocusId: null,
    assistantConversations: [],
    selectedConversation: null,
    assistantMessages: [],
    assistantLoadedRunId: null,
    assistantLoading: false,
    assistantSending: false,
    assistantDraft: "",
    assistantRetryContent: null,
    assistantRetryIdempotencyKey: null,
    assistantError: null,
    knowledgeConversations: [],
    selectedKnowledgeConversation: null,
    knowledgeMessages: [],
    knowledgeLoaded: false,
    knowledgeLoading: false,
    knowledgeSending: false,
    knowledgeDraft: "",
    knowledgeRetryContent: null,
    knowledgeRetryIdempotencyKey: null,
    knowledgeError: null,
    knowledgeTradeType: "both",
    knowledgeAsOf: "",
    correctionProposals: [],
    correctionLoadedRunId: null,
    correctionLoading: false,
    correctionError: null,
    correctionDraft: null,
    selectedCorrectionProposalIds: new Set(),
    caseFilter: "all",
    query: "",
    busy: false,
    notice: null,
    error: null,
  };
  private jobTimer: number | null = null;
  private destroyed = false;
  private readonly hashChange = () => void this.followRoute();

  constructor(
    private readonly root: HTMLElement,
    private readonly api: ApiClient,
    private readonly auth: BrowserSession,
    private readonly mode: FrontendRuntimeMode,
  ) {}

  async start(): Promise<void> {
    if (!this.auth.isAuthenticated()) throw new Error("브라우저 인증 세션을 시작하지 못했습니다.");
    window.addEventListener("hashchange", this.hashChange);
    await this.withBusy(async () => {
      this.state.session = await this.api.getSession();
      // A global knowledge conversation must not fetch Case summaries, review
      // data, or document data merely because the same workbench owns both
      // routes.  Case data is loaded only after a Case route is selected.
      if (parseRoute(window.location.hash).kind !== "knowledge") await this.refreshCases();
      await this.followRoute(false);
    });
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener("hashchange", this.hashChange);
    if (this.jobTimer !== null) window.clearTimeout(this.jobTimer);
    this.jobTimer = null;
  }

  private hasRole(role: "reviewer" | "approver"): boolean {
    return this.state.session?.roles.includes(role) ?? false;
  }

  private async switchDevelopmentActor(actor: LocalDevelopmentActor): Promise<void> {
    const session = this.auth;
    if (this.mode !== "local-development" || !supportsDevelopmentRoleSwitch(session)) return;
    if (this.hasRole(actor)) return;
    await this.withBusy(async () => {
      await session.switchActor(actor);
      this.state.session = await this.api.getSession();
      if (parseRoute(window.location.hash).kind !== "knowledge") {
        const currentCaseId = this.state.selectedCase?.case_id;
        await this.refreshCases();
        if (currentCaseId) await this.loadCase(currentCaseId);
      } else {
        // Do not retain a previous actor's Case list while the independent
        // knowledge route is active. It will be fetched afresh only if that
        // actor returns to the Case workbench.
        this.state.cases = [];
        this.state.casesLoaded = false;
        this.clearCaseContext();
      }
      this.state.notice = actor === "approver"
        ? "로컬 승인자 세션으로 전환했습니다. 제안 승인·반려와 수정 반영 재심사만 수행할 수 있습니다."
        : "로컬 심사자 세션으로 전환했습니다. 문서·심사·판단·정정 제안을 기록할 수 있습니다.";
    });
  }

  private async refreshCases(): Promise<void> {
    this.state.cases = (await this.api.listCases()).items;
    this.state.casesLoaded = true;
  }

  private async followRoute(render = true): Promise<void> {
    const route = parseRoute(window.location.hash);
    if (route.kind === "knowledge") {
      // Keep the standalone route lean and prevent previously loaded Case
      // summaries from being retained alongside a global knowledge session.
      this.state.cases = [];
      this.state.casesLoaded = false;
      this.clearCaseContext();
      await this.ensureKnowledgeLoaded();
      if (render) this.render();
      return;
    }
    if (!this.state.casesLoaded) await this.refreshCases();
    if (route.caseId === null) {
      this.clearCaseContext();
      if (render) this.render();
      return;
    }
    this.state.activeTab = route.tab;
    if (this.state.selectedCase?.case_id !== route.caseId) await this.loadCase(route.caseId);
    if (route.tab === "assistant") await this.ensureAssistantLoaded();
    if (route.tab === "history") await this.ensureCorrectionProposalsLoaded();
    if (render) this.render();
  }

  private setRoute(caseId: string | null, tab: WorkspaceTab = "documents"): void {
    const target = caseId === null ? "/cases" : `/cases/${encodeURIComponent(caseId)}/${tab}`;
    if (window.location.hash !== `#${target}`) {
      window.location.hash = target;
      return;
    }
    void this.followRoute();
  }

  private setKnowledgeRoute(): void {
    if (window.location.hash !== "#/knowledge") {
      window.location.hash = "/knowledge";
      return;
    }
    void this.followRoute();
  }

  private async openCase(caseId: string, tab: WorkspaceTab = "documents"): Promise<void> {
    await this.withBusy(async () => {
      await this.loadCase(caseId);
      this.state.activeTab = tab;
      this.setRoute(caseId, tab);
    });
  }

  private async loadCase(caseId: string): Promise<void> {
    const [caseDetail, documents, runSummaries] = await Promise.all([
      this.api.getCase(caseId),
      this.api.listDocuments(caseId),
      this.api.listReviewRuns(caseId),
    ]);
    this.state.selectedCase = caseDetail;
    this.state.documents = documents;
    this.state.runs = runSummaries;
    this.state.selectedRun = null;
    this.state.selectedDocument = null;
    this.state.sourceFocus = null;
    this.state.factFocusId = null;
    this.state.activeJob = null;
    this.state.activeJobPurpose = null;
    this.resetRunAttachments();
    if (runSummaries[0]) await this.openRun(runSummaries[0].review_run_id);
  }

  private clearCaseContext(): void {
    this.state.selectedCase = null;
    this.state.documents = [];
    this.state.runs = [];
    this.state.selectedRun = null;
    this.state.selectedDocument = null;
    this.state.sourceFocus = null;
    this.state.factFocusId = null;
    this.state.activeJob = null;
    this.state.activeJobPurpose = null;
    this.resetRunAttachments();
  }

  private async openRun(runId: string): Promise<void> {
    if (this.state.selectedRun?.review_run_id !== runId) this.resetRunAttachments();
    const run = await this.api.getReviewRun(runId);
    if (run.case_id !== this.state.selectedCase?.case_id) {
      throw new Error("심사 결과가 현재 심사 건에 속하지 않습니다.");
    }
    this.state.selectedRun = run;
  }

  private resetRunAttachments(): void {
    this.state.comparisonFocusId = null;
    this.state.evidenceFocusId = null;
    this.state.assistantConversations = [];
    this.state.selectedConversation = null;
    this.state.assistantMessages = [];
    this.state.assistantLoadedRunId = null;
    this.state.assistantLoading = false;
    this.state.assistantSending = false;
    this.state.assistantDraft = "";
    this.state.assistantRetryContent = null;
    this.state.assistantRetryIdempotencyKey = null;
    this.state.assistantError = null;
    this.state.correctionProposals = [];
    this.state.correctionLoadedRunId = null;
    this.state.correctionLoading = false;
    this.state.correctionError = null;
    this.state.correctionDraft = null;
    this.state.selectedCorrectionProposalIds.clear();
  }

  private async ensureAssistantLoaded(): Promise<void> {
    const run = this.state.selectedRun;
    if (!run || this.state.assistantLoadedRunId === run.review_run_id || this.state.assistantLoading) return;
    this.state.assistantLoading = true;
    this.state.assistantError = null;
    this.render();
    try {
      const conversations = await this.api.listAssistantConversations(run.review_run_id);
      this.state.assistantConversations = conversations;
      this.state.selectedConversation = conversations[0] ?? null;
      this.state.assistantMessages = this.state.selectedConversation
        ? await this.api.listAssistantMessages(this.state.selectedConversation.conversation_id)
        : [];
      this.state.assistantLoadedRunId = run.review_run_id;
    } catch (error) {
      this.state.assistantError = userMessage(error, "AI 도우미 대화를 불러오지 못했습니다.");
    } finally {
      this.state.assistantLoading = false;
      this.render();
    }
  }

  private async selectAssistantConversation(conversation: AssistantConversation): Promise<void> {
    if (this.state.assistantLoading || this.state.assistantSending) return;
    this.state.assistantLoading = true;
    this.state.assistantError = null;
    this.render();
    try {
      const messages = await this.api.listAssistantMessages(conversation.conversation_id);
      this.state.selectedConversation = conversation;
      this.state.assistantMessages = messages;
    } catch (error) {
      this.state.assistantError = userMessage(error, "선택한 대화를 열지 못했습니다.");
    } finally {
      this.state.assistantLoading = false;
      this.render();
    }
  }

  private async createAssistantConversation(): Promise<void> {
    const run = this.requireRun();
    if (this.state.assistantLoading || this.state.assistantSending) return;
    this.state.assistantLoading = true;
    this.state.assistantError = null;
    this.render();
    try {
      const conversation = await this.api.createAssistantConversation(run.review_run_id);
      this.state.assistantConversations = [conversation, ...this.state.assistantConversations];
      this.state.selectedConversation = conversation;
      this.state.assistantMessages = [];
      this.state.assistantLoadedRunId = run.review_run_id;
      this.state.assistantDraft = "";
      this.state.assistantRetryContent = null;
      this.state.assistantRetryIdempotencyKey = null;
    } catch (error) {
      this.state.assistantError = userMessage(error, "새 AI 도우미 대화를 만들지 못했습니다.");
    } finally {
      this.state.assistantLoading = false;
      this.render();
    }
  }

  private async sendAssistantMessage(content: string, idempotencyKey: string = crypto.randomUUID()): Promise<void> {
    const text = content.trim();
    if (!text || this.state.assistantSending || this.state.assistantLoading) return;
    const run = this.requireRun();
    this.state.assistantSending = true;
    this.state.assistantError = null;
    this.render();
    try {
      let conversation = this.state.selectedConversation;
      if (!conversation) {
        conversation = await this.api.createAssistantConversation(run.review_run_id, {
          title: text.slice(0, 80),
        });
        this.state.assistantConversations = [conversation, ...this.state.assistantConversations];
        this.state.selectedConversation = conversation;
      }
      const exchange = await this.api.sendAssistantMessage(
        conversation.conversation_id,
        { content: text },
        idempotencyKey,
      );
      this.state.assistantMessages = mergeAssistantMessages(
        this.state.assistantMessages,
        exchange.user_message,
        exchange.assistant_message,
      );
      this.state.assistantDraft = "";
      this.state.assistantRetryContent = null;
      this.state.assistantRetryIdempotencyKey = null;
    } catch (error) {
      this.state.assistantDraft = text;
      this.state.assistantRetryContent = text;
      this.state.assistantRetryIdempotencyKey = idempotencyKey;
      this.state.assistantError = userMessage(error, "AI 도우미 답변을 받지 못했습니다. 질문은 그대로 보존했습니다.");
    } finally {
      this.state.assistantSending = false;
      this.render();
    }
  }

  private retryAssistantMessage(): void {
    const retry = this.state.assistantRetryContent;
    const idempotencyKey = this.state.assistantRetryIdempotencyKey;
    if (retry && idempotencyKey) void this.sendAssistantMessage(retry, idempotencyKey);
  }

  private updateAssistantDraft(value: string): void {
    this.state.assistantDraft = value.slice(0, 4_000);
  }

  private handleAssistantKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    const input = event.currentTarget;
    if (input instanceof HTMLTextAreaElement) void this.sendAssistantMessage(input.value);
  }

  /**
   * The knowledge assistant is intentionally Case-independent.  It only uses
   * the Backend's dedicated knowledge boundary, never a selected Case or
   * Review Run, so a general question cannot accidentally inherit case facts.
   */
  private async ensureKnowledgeLoaded(): Promise<void> {
    if (this.state.knowledgeLoaded || this.state.knowledgeLoading) return;
    this.state.knowledgeLoading = true;
    this.state.knowledgeError = null;
    this.render();
    try {
      const conversations = await this.api.listKnowledgeConversations();
      this.state.knowledgeConversations = conversations;
      this.state.selectedKnowledgeConversation = conversations[0] ?? null;
      this.state.knowledgeMessages = this.state.selectedKnowledgeConversation
        ? await this.api.listKnowledgeMessages(this.state.selectedKnowledgeConversation.conversation_id)
        : [];
      this.state.knowledgeLoaded = true;
    } catch (error) {
      this.state.knowledgeError = userMessage(error, "통관 지식 대화를 불러오지 못했습니다.");
    } finally {
      this.state.knowledgeLoading = false;
      this.render();
    }
  }

  private async selectKnowledgeConversation(conversation: KnowledgeConversation): Promise<void> {
    if (this.state.knowledgeLoading || this.state.knowledgeSending) return;
    this.state.knowledgeLoading = true;
    this.state.knowledgeError = null;
    this.render();
    try {
      this.state.knowledgeMessages = await this.api.listKnowledgeMessages(conversation.conversation_id);
      this.state.selectedKnowledgeConversation = conversation;
      this.state.knowledgeTradeType = conversation.trade_type;
      this.state.knowledgeAsOf = conversation.as_of;
    } catch (error) {
      this.state.knowledgeError = userMessage(error, "선택한 통관 지식 대화를 열지 못했습니다.");
    } finally {
      this.state.knowledgeLoading = false;
      this.render();
    }
  }

  private async createKnowledgeConversation(title?: string): Promise<KnowledgeConversation | null> {
    if (this.state.knowledgeLoading || this.state.knowledgeSending) return null;
    this.state.knowledgeLoading = true;
    this.state.knowledgeError = null;
    this.render();
    try {
      const conversation = await this.api.createKnowledgeConversation({
        ...(title ? { title } : {}),
        trade_type: this.state.knowledgeTradeType,
        ...(this.state.knowledgeAsOf ? { as_of: this.state.knowledgeAsOf } : {}),
      });
      this.state.knowledgeConversations = [conversation, ...this.state.knowledgeConversations];
      this.state.selectedKnowledgeConversation = conversation;
      this.state.knowledgeMessages = [];
      this.state.knowledgeLoaded = true;
      this.state.knowledgeDraft = "";
      this.state.knowledgeRetryContent = null;
      this.state.knowledgeRetryIdempotencyKey = null;
      return conversation;
    } catch (error) {
      this.state.knowledgeError = userMessage(error, "새 통관 지식 대화를 만들지 못했습니다.");
      return null;
    } finally {
      this.state.knowledgeLoading = false;
      this.render();
    }
  }

  /**
   * Starts an unsaved global conversation locally.  The selected trade type
   * and date are applied only when the next question creates its dedicated
   * Backend conversation; changing them never mutates an existing one.
   */
  private beginNewKnowledgeConversation(
    resetSettings = true,
    render = true,
  ): void {
    if (this.state.knowledgeLoading || this.state.knowledgeSending) return;
    this.state.selectedKnowledgeConversation = null;
    this.state.knowledgeMessages = [];
    this.state.knowledgeDraft = "";
    this.state.knowledgeRetryContent = null;
    this.state.knowledgeRetryIdempotencyKey = null;
    this.state.knowledgeError = null;
    if (resetSettings) {
      this.state.knowledgeTradeType = "both";
      this.state.knowledgeAsOf = "";
    }
    if (render) this.render();
  }

  private async sendKnowledgeMessage(content: string, idempotencyKey: string = crypto.randomUUID()): Promise<void> {
    // The standalone official-knowledge channel deliberately accepts one
    // question line only.  Keeping pasted line breaks intact lets the
    // Backend/Agent identify document-shaped input; normalising them here
    // would turn a multi-field document into an apparently harmless line.
    if (/[\r\n\u000b\u000c\u001c-\u001e\u0085\u2028\u2029]/u.test(content)) {
      this.state.knowledgeRetryContent = null;
      this.state.knowledgeRetryIdempotencyKey = null;
      this.state.knowledgeError = "통관 지식 도우미에는 일반 통관 질문을 한 줄로 입력해 주세요.";
      this.render();
      return;
    }
    const text = content.trim();
    if (!text || this.state.knowledgeSending || this.state.knowledgeLoading) return;
    this.state.knowledgeSending = true;
    this.state.knowledgeError = null;
    this.render();
    try {
      let conversation = this.state.selectedKnowledgeConversation;
      if (!conversation) {
        // The first question must never become durable title text.  A global
        // thread gets a small, direction-based topic title instead, so an
        // accidental pasted document cannot be retained through this field.
        conversation = await this.api.createKnowledgeConversation({
          title: knowledgeConversationTitle(this.state.knowledgeTradeType),
          trade_type: this.state.knowledgeTradeType,
          ...(this.state.knowledgeAsOf ? { as_of: this.state.knowledgeAsOf } : {}),
        });
        this.state.knowledgeConversations = [conversation, ...this.state.knowledgeConversations];
        this.state.selectedKnowledgeConversation = conversation;
        this.state.knowledgeLoaded = true;
      }
      const exchange = await this.api.sendKnowledgeMessage(
        conversation.conversation_id,
        { content: text },
        idempotencyKey,
      );
      this.state.knowledgeMessages = mergeKnowledgeMessages(
        this.state.knowledgeMessages,
        exchange.user_message,
        exchange.assistant_message,
      );
      this.state.knowledgeDraft = "";
      this.state.knowledgeRetryContent = null;
      this.state.knowledgeRetryIdempotencyKey = null;
    } catch (error) {
      this.state.knowledgeDraft = text;
      this.state.knowledgeRetryContent = text;
      this.state.knowledgeRetryIdempotencyKey = idempotencyKey;
      this.state.knowledgeError = userMessage(error, "통관 지식 답변을 받지 못했습니다. 질문은 그대로 보존했습니다.");
    } finally {
      this.state.knowledgeSending = false;
      this.render();
    }
  }

  private retryKnowledgeMessage(): void {
    const retry = this.state.knowledgeRetryContent;
    const idempotencyKey = this.state.knowledgeRetryIdempotencyKey;
    if (retry && idempotencyKey) void this.sendKnowledgeMessage(retry, idempotencyKey);
  }

  private updateKnowledgeDraft(value: string): void {
    this.state.knowledgeDraft = value.slice(0, 4_000);
  }

  private handleKnowledgeKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    const input = event.currentTarget;
    if (input instanceof HTMLTextAreaElement) void this.sendKnowledgeMessage(input.value);
  }

  private async ensureCorrectionProposalsLoaded(): Promise<void> {
    const run = this.state.selectedRun;
    if (!run || this.state.correctionLoadedRunId === run.review_run_id || this.state.correctionLoading) return;
    this.state.correctionLoading = true;
    this.state.correctionError = null;
    this.render();
    try {
      this.state.correctionProposals = await this.api.listCorrectionProposals(run.review_run_id);
      this.reconcileCorrectionProposalSelection();
      this.state.correctionLoadedRunId = run.review_run_id;
    } catch (error) {
      this.state.correctionError = userMessage(error, "정정 제안을 불러오지 못했습니다.");
    } finally {
      this.state.correctionLoading = false;
      this.render();
    }
  }

  private async createCorrectionProposal(form: HTMLFormElement): Promise<void> {
    if (!this.hasRole("reviewer")) throw new Error("정정 제안은 심사자 역할에서만 기록할 수 있습니다.");
    const run = this.requireRun();
    const data = new FormData(form);
    const payload: CreateCorrectionProposalRequest = {
      document_id: stringValue(data, "document_id"),
      field_name: stringValue(data, "field_name"),
      new_value: stringValue(data, "new_value"),
      reason: stringValue(data, "reason"),
      ...(stringValue(data, "item_id") ? { item_id: stringValue(data, "item_id") } : {}),
      ...(stringValue(data, "fact_id") ? { fact_id: stringValue(data, "fact_id") } : {}),
      ...(stringValue(data, "unit") ? { unit: stringValue(data, "unit") } : {}),
      ...(stringValue(data, "finding_id") ? { finding_id: stringValue(data, "finding_id") } : {}),
    };
    await this.withBusy(async () => {
      const proposal = await this.api.createCorrectionProposal(run.review_run_id, payload);
      const wasLoaded = this.state.correctionLoadedRunId === run.review_run_id;
      this.state.correctionProposals = [proposal, ...this.state.correctionProposals];
      if (!wasLoaded) this.state.correctionLoadedRunId = null;
      this.state.correctionDraft = null;
      this.state.notice = "정정 제안을 기록했습니다. 승인 전에는 원래 심사 결과가 바뀌지 않습니다.";
      form.reset();
    });
  }

  private async decideCorrectionProposal(
    proposal: CorrectionProposal,
    form: HTMLFormElement,
  ): Promise<void> {
    if (!this.hasRole("approver")) throw new Error("정정 제안의 승인·반려는 승인자 역할에서만 할 수 있습니다.");
    if (proposal.created_by === this.state.session?.subject) {
      throw new Error("제안자는 자신의 정정 제안을 승인하거나 반려할 수 없습니다.");
    }
    const data = new FormData(form);
    const status = stringValue(data, "status") as "approved" | "rejected";
    const reason = stringValue(data, "reason");
    await this.withBusy(async () => {
      const updated = await this.api.decideCorrectionProposal(proposal.correction_proposal_id, { status, reason });
      this.state.correctionProposals = this.state.correctionProposals.map((item) =>
        item.correction_proposal_id === updated.correction_proposal_id ? updated : item,
      );
      this.reconcileCorrectionProposalSelection();
      this.state.notice = status === "approved"
        ? "정정 제안을 승인했습니다. 아래에서 승인된 제안으로 재심사를 시작할 수 있습니다."
        : "정정 제안을 반려했습니다. 원래 심사 결과는 유지됩니다.";
    });
  }

  private async startRevision(): Promise<void> {
    if (!this.hasRole("approver")) throw new Error("승인된 정정으로 재심사하는 작업은 승인자 역할에서만 할 수 있습니다.");
    const run = this.requireRun();
    const proposalIds = this.selectedEligibleCorrectionProposalIds();
    if (!proposalIds.length) throw new Error("재심사에 반영할 승인된 정정 제안을 한 건 이상 선택하십시오.");
    await this.withBusy(async () => {
      const job = await this.api.enqueueRevision(run.review_run_id, { proposal_ids: proposalIds }, crypto.randomUUID());
      this.state.selectedCorrectionProposalIds.clear();
      this.state.activeJob = job;
      this.state.activeJobPurpose = "revision";
      if (job.status === "succeeded") await this.showSucceededReview(job);
      else if (ACTIVE_JOB_STATES.has(job.status)) {
        this.state.notice = "승인된 정정 제안을 반영하는 수정 반영 재심사를 요청했습니다. 완료되면 새 심사 이력으로 이동합니다.";
        this.scheduleJobPoll(job);
      } else {
        this.showFailedJob(job);
      }
    });
  }

  private eligibleCorrectionProposals(): CorrectionProposal[] {
    return this.state.correctionProposals.filter((proposal) => proposal.status === "approved" && !proposal.applied_review_run_id);
  }

  private selectedEligibleCorrectionProposalIds(): string[] {
    const eligible = new Set(this.eligibleCorrectionProposals().map((proposal) => proposal.correction_proposal_id));
    return [...this.state.selectedCorrectionProposalIds].filter((proposalId) => eligible.has(proposalId));
  }

  private reconcileCorrectionProposalSelection(): void {
    const eligible = new Set(this.eligibleCorrectionProposals().map((proposal) => proposal.correction_proposal_id));
    for (const proposalId of this.state.selectedCorrectionProposalIds) {
      if (!eligible.has(proposalId)) this.state.selectedCorrectionProposalIds.delete(proposalId);
    }
  }

  private setCorrectionProposalSelected(proposalId: string, selected: boolean): void {
    const eligible = this.eligibleCorrectionProposals().some((proposal) => proposal.correction_proposal_id === proposalId);
    if (!eligible) return;
    if (selected) this.state.selectedCorrectionProposalIds.add(proposalId);
    else this.state.selectedCorrectionProposalIds.delete(proposalId);
    this.render();
  }

  private useCorrectionDraft(draft: AssistantCorrectionDraft): void {
    if (!this.hasRole("reviewer")) {
      this.state.notice = "AI 도우미의 수정 초안은 심사자 역할에서만 정정 제안으로 기록할 수 있습니다.";
      this.render();
      return;
    }
    this.state.correctionDraft = draft;
    this.state.notice = "AI 도우미의 정정 제안을 심사 결과의 정정 양식에 채웠습니다. 내용을 확인한 뒤에만 기록하십시오.";
    this.setRoute(this.requireCase().case_id, "analysis");
  }

  private async openDocument(documentId: string, source: SourceReference | null = null): Promise<void> {
    const current = this.requireCase();
    const document = await this.api.getDocumentContent(current.case_id, documentId);
    this.state.selectedDocument = document;
    this.state.sourceFocus = source;
  }

  private async createCase(form: HTMLFormElement): Promise<void> {
    if (!this.hasRole("reviewer")) throw new Error("심사 건 등록은 심사자 역할에서만 할 수 있습니다.");
    const data = new FormData(form);
    const title = stringValue(data, "title");
    if (!title) throw new Error("심사 건 제목을 입력해 주십시오.");
    const reference = stringValue(data, "reference");
    await this.withBusy(async () => {
      const created = await this.api.createCase({ title, external_reference: reference || null });
      await this.refreshCases();
      await this.loadCase(created.case_id);
      this.state.activeTab = "documents";
      this.state.notice = "새 심사 건을 등록했습니다. 텍스트 문서를 등록해 심사를 시작할 수 있습니다.";
      form.reset();
      this.setRoute(created.case_id, "documents");
    });
  }

  private async addDocument(form: HTMLFormElement): Promise<void> {
    if (!this.hasRole("reviewer")) throw new Error("문서 등록과 보완은 심사자 역할에서만 할 수 있습니다.");
    const current = this.requireCase();
    const data = new FormData(form);
    const documentType = stringValue(data, "document_type") as DocumentType;
    if (!DOCUMENT_TYPES.includes(documentType)) throw new Error("허용되지 않은 문서 유형입니다.");
    let content = stringValue(data, "content_text");
    let filename = stringValue(data, "filename");
    const fileInput = form.elements.namedItem("text_file");
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : undefined;
    if (!content.trim() && file) {
      if (!file.name.toLocaleLowerCase().endsWith(".txt")) throw new Error("텍스트(.txt) 파일만 읽을 수 있습니다.");
      content = await file.text();
      if (!filename) filename = file.name;
    }
    if (!content.trim()) throw new Error("문서 원문을 붙여넣거나 .txt 파일을 선택하십시오.");
    if (!filename.toLocaleLowerCase().endsWith(".txt")) throw new Error("텍스트 문서는 .txt 파일명으로 등록하십시오.");
    const replaces = stringValue(data, "replaces_document_id");
    await this.withBusy(async () => {
      await this.api.addDocument(current.case_id, {
        document_type: documentType,
        filename,
        media_type: "text/plain",
        content_text: content,
        ...(replaces ? { replaces_document_id: replaces } : {}),
      });
      await this.loadCase(current.case_id);
      this.state.notice = replaces
        ? "보완 문서를 등록했습니다. 이전 문서는 새 심사 입력에서 제외됩니다."
        : "텍스트 문서를 등록했습니다.";
      form.reset();
    });
  }

  private async startReview(): Promise<void> {
    if (!this.hasRole("reviewer")) throw new Error("AI 심사 실행은 심사자 역할에서만 할 수 있습니다.");
    const current = this.requireCase();
    if (!this.activeDocuments().length) throw new Error("심사를 시작하려면 활성 텍스트 문서를 하나 이상 등록해야 합니다.");
    await this.withBusy(async () => {
      const job = await this.api.enqueueReview(current.case_id, { trade_type: this.state.reviewTradeType }, crypto.randomUUID());
      this.state.activeJob = job;
      this.state.activeJobPurpose = "review";
      if (job.status === "succeeded") {
        await this.showSucceededReview(job);
      } else if (ACTIVE_JOB_STATES.has(job.status)) {
        this.state.notice = "심사를 요청했습니다. 완료 상태가 확인되면 결과를 표시합니다.";
        this.scheduleJobPoll(job);
      } else {
        this.showFailedJob(job);
      }
    });
  }

  private scheduleJobPoll(job: JobRecord): void {
    if (this.destroyed || !ACTIVE_JOB_STATES.has(job.status)) return;
    if (this.jobTimer !== null) window.clearTimeout(this.jobTimer);
    this.jobTimer = window.setTimeout(() => void this.pollJob(job.job_id), 1_000);
  }

  private async pollJob(jobId: string): Promise<void> {
    if (this.destroyed) return;
    try {
      const job = await this.api.getJob(jobId);
      this.state.activeJob = job;
      if (ACTIVE_JOB_STATES.has(job.status)) this.scheduleJobPoll(job);
      else if (job.status === "succeeded") await this.showSucceededReview(job);
      else this.showFailedJob(job);
    } catch (error) {
      this.state.error = userMessage(error, "심사 진행 상태를 확인하지 못했습니다. 잠시 후 이력에서 다시 확인해 주십시오.");
    } finally {
      this.render();
    }
  }

  private async showSucceededReview(job: JobRecord): Promise<void> {
    await this.loadVisibleSucceededReview(job);
    this.state.activeTab = "analysis";
    this.state.notice = "심사가 완료되었습니다. 결과는 자동 승인되지 않으며 담당자 검토가 필요합니다.";
    this.setRoute(job.case_id, "analysis");
  }

  private async loadVisibleSucceededReview(job: JobRecord): Promise<void> {
    for (const delay of [...REVIEW_RESULT_VISIBILITY_RETRY_DELAYS_MS, null]) {
      try {
        await this.loadCase(job.case_id);
        await this.openRun(job.review_run_id);
        return;
      } catch {
        if (delay === null) break;
        await delayForVisibleReview(delay);
      }
    }
    throw new Error(REVIEW_RESULT_VISIBILITY_FAILURE_MESSAGE);
  }

  private showFailedJob(job: JobRecord): void {
    const purpose = this.state.activeJobPurpose;
    this.state.notice = null;
    if (purpose === "revision") {
      this.state.activeJob = null;
      this.state.activeJobPurpose = null;
      this.state.error = REVISION_FAILURE_MESSAGE;
      return;
    }
    this.state.activeJob = job;
    this.state.error = null;
  }

  private async decideFinding(form: HTMLFormElement, findingId: string): Promise<void> {
    if (!this.hasRole("reviewer")) throw new Error("확인 사항 판단은 심사자 역할에서만 기록할 수 있습니다.");
    const run = this.requireRun();
    const data = new FormData(form);
    const status = stringValue(data, "status") as FindingDecisionRequest["status"];
    const reason = stringValue(data, "reason");
    await this.withBusy(async () => {
      const decision = await this.api.setFindingDecision(run.review_run_id, findingId, { status, reason });
      this.mergeDecision(decision);
      this.state.notice = "담당자 판단과 사유를 기록했습니다. 이 판단은 자동 승인으로 이어지지 않습니다.";
    });
  }

  private mergeDecision(decision: ReviewerDecision): void {
    const run = this.requireRun();
    this.state.selectedRun = {
      ...run,
      reviewer_decisions: [
        ...run.reviewer_decisions.filter((item) => item.finding_id !== decision.finding_id),
        decision,
      ],
    };
  }

  private activeDocuments(): CaseDocument[] {
    return this.state.documents.filter((document) => !document.superseded_by_document_id);
  }

  private async withBusy(action: () => Promise<void>): Promise<void> {
    if (this.state.busy) return;
    this.state.busy = true;
    this.state.error = null;
    this.render();
    try {
      await action();
    } catch (error) {
      this.state.error = userMessage(error, "요청을 처리하지 못했습니다.");
    } finally {
      this.state.busy = false;
      this.render();
    }
  }

  private requireCase(): CaseDetail {
    if (!this.state.selectedCase) throw new Error("먼저 심사 건을 선택해 주십시오.");
    return this.state.selectedCase;
  }

  private requireRun(): ReviewRun {
    if (!this.state.selectedRun) throw new Error("먼저 심사 결과를 선택해 주십시오.");
    return this.state.selectedRun;
  }

  private render(): void {
    if (this.destroyed) return;
    const route = parseRoute(window.location.hash);
    const isKnowledgeRoute = route.kind === "knowledge";
    const children = [
      createHeader(
        this.state.session,
        this.mode,
        () => void this.auth.logout(),
        this.mode === "local-development" && supportsDevelopmentRoleSwitch(this.auth)
          ? (actor) => void this.switchDevelopmentActor(actor)
          : undefined,
        this.state.busy,
        () => this.setKnowledgeRoute(),
      ),
      createRuntimeNotice(this.mode),
      this.state.error ? message("error", this.state.error) : null,
      this.state.notice ? message("notice", this.state.notice) : null,
      element("main", { className: `review-app${isKnowledgeRoute ? " review-app--knowledge" : ""}`, attributes: { id: "main-content", "aria-busy": String(this.state.busy), "data-e2e": isKnowledgeRoute ? "knowledge-workspace-root" : "workspace-root" } },
        isKnowledgeRoute ? this.createKnowledgeWorkspace() : this.createQueue(),
        isKnowledgeRoute ? null : (this.state.selectedCase ? this.createWorkspace() : this.createWelcome()),
      ),
    ].filter((item): item is HTMLElement => item !== null);
    this.root.replaceChildren(...children);
  }

  private createQueue(): HTMLElement {
    const queryMatched = this.state.cases.filter((item) => {
      const candidate = `${item.title} ${item.external_reference ?? ""} ${item.case_id}`.toLocaleLowerCase();
      return candidate.includes(this.state.query.toLocaleLowerCase());
    });
    const businessCases = queryMatched.filter((item) => !isFunctionalUatCase(item));
    const functionalCases = queryMatched.filter(isFunctionalUatCase);
    const showingFunctionalRecords = this.state.caseFilter === "functional_uat";
    const listedCases = showingFunctionalRecords
      ? functionalCases
      : businessCases.filter((item) => this.state.caseFilter === "all" || item.status === this.state.caseFilter);
    const list = this.createCaseList(listedCases, showingFunctionalRecords ? "검증 사례 목록" : "업무 심사 목록");
    if (!listedCases.length) {
      list.append(element("p", {
        className: "empty-copy",
        text: showingFunctionalRecords ? "조건에 맞는 검증 사례가 없습니다." : "조건에 맞는 업무 심사 건이 없습니다.",
      }));
    }

    const filters = element("div", { className: "queue-filters" },
      input("search", { placeholder: "사건명 또는 참조번호 검색", value: this.state.query, ariaLabel: "심사 건 검색", onInput: (event) => this.updateQuery((event.currentTarget as HTMLInputElement).value) }),
      select("case_filter", [
        ["all", "전체"], ["open", "진행 전"], ["in_review", "검토 진행 중"], ["closed", "검토 종료"], ["functional_uat", "검증 사례"],
      ], this.state.caseFilter, (event) => { this.state.caseFilter = (event.currentTarget as HTMLSelectElement).value as CaseFilter; this.render(); }),
    );

    const form = element("form", { className: "case-create-form", attributes: { "data-e2e": "case-create-form" }, on: { submit: (event) => { event.preventDefault(); void this.createCase(event.currentTarget as HTMLFormElement); } } },
      field("심사 건 제목", input("title", { required: true, maxLength: 200, placeholder: "예: 8월 수입 신고 서류 검토" })),
      field("업무 참조번호", input("reference", { maxLength: 200, placeholder: "선택 입력" })),
      submit("새 심사 건 등록", this.state.busy),
    );

    return element("aside", { className: "case-queue", attributes: { "aria-label": "심사 업무함" } },
      element("div", { className: "queue-heading" },
        element("p", { className: "eyebrow", text: "심사 업무" }),
        element("h2", { text: "심사 업무함" }),
        element("p", { text: showingFunctionalRecords ? `검증 사례 ${functionalCases.length}건` : `업무 심사 ${listedCases.length}건` }),
      ),
      filters,
      list,
      showingFunctionalRecords
        ? element("p", { className: "role-boundary-note", text: "검증 사례는 기능 확인을 위해 만든 시스템 기록입니다. 일반 심사 건과 분리해 읽기 전용으로 표시합니다." })
        : this.hasRole("reviewer")
        ? element("details", { className: "new-case-panel", attributes: { open: businessCases.length === 0 ? "" : undefined, "data-e2e": "case-create-panel" } },
          element("summary", { text: "새 심사 건 등록" }), form)
        : element("p", { className: "role-boundary-note", text: "승인 담당자는 심사 건을 읽고 정정 제안을 독립적으로 승인·반려할 수 있습니다. 새 심사 건 등록은 심사 담당자 역할에서만 가능합니다." }),
    );
  }

  private createCaseList(items: CaseSummary[], label: string): HTMLElement {
    const list = element("nav", { className: "case-list", attributes: { "aria-label": label } });
    for (const item of items) {
      const presentation = casePresentation(item);
      list.append(element("button", {
        className: `case-card${this.state.selectedCase?.case_id === item.case_id ? " is-selected" : ""}${presentation.kind === "functional-uat" ? " case-card--functional" : ""}`,
        attributes: {
          type: "button",
          "aria-current": this.state.selectedCase?.case_id === item.case_id ? "page" : undefined,
          disabled: this.state.busy ? "" : undefined,
          "data-e2e": "case-card",
          "data-case-id": item.case_id,
        },
        on: { click: () => void this.openCase(item.case_id).catch((error) => this.showError(error)) },
      },
      element("strong", { text: presentation.title }),
      element("span", { text: caseReferenceLabel(item) }),
      element("div", { className: "case-card__meta" },
        statusChip(caseStatusLabel(item.status), item.status),
        element("small", { text: `수정 ${formatDate(item.updated_at)}` }),
      )));
    }
    return list;
  }

  private createWelcome(): HTMLElement {
    return element("section", { className: "workspace-welcome" },
      element("div", { className: "welcome-graphic", text: "AI" }),
      element("p", { className: "eyebrow", text: "통관 서류 심사" }),
      element("h1", { text: "문서와 근거를 한 화면에서 검토합니다." }),
      element("p", { text: "심사 건을 선택하면 텍스트 문서, AI 심사 결과, 문서 간 비교, 법령 근거와 담당자 판단 이력을 연결해 확인할 수 있습니다." }),
      element("ol", { className: "welcome-steps" },
        element("li", {}, element("strong", { text: "문서 등록" }), element("span", { text: "상업송장, 포장명세서, 선하증권, 원산지증명서의 텍스트를 등록합니다." })),
        element("li", {}, element("strong", { text: "AI 사전심사" }), element("span", { text: "AI가 문서 정보와 문서 간 확인 결과, 법령 근거를 정리합니다." })),
        element("li", {}, element("strong", { text: "사람 검토" }), element("span", { text: "담당자가 판단과 사유를 기록하고 필요하면 보완 후 재심사합니다." })),
      ),
    );
  }

  private createKnowledgeWorkspace(): HTMLElement {
    const loading = this.state.knowledgeLoading;
    const conversations = element("nav", { className: "assistant-conversations", attributes: { "aria-label": "통관 지식 대화 목록" } });
    for (const conversation of this.state.knowledgeConversations) {
      conversations.append(element("button", {
        className: `assistant-conversation${this.state.selectedKnowledgeConversation?.conversation_id === conversation.conversation_id ? " is-selected" : ""}`,
        attributes: {
          type: "button",
          "aria-current": this.state.selectedKnowledgeConversation?.conversation_id === conversation.conversation_id ? "page" : undefined,
          disabled: loading || this.state.knowledgeSending ? "" : undefined,
          "data-e2e": "knowledge-conversation",
        },
        on: { click: () => void this.selectKnowledgeConversation(conversation) },
      },
      element("strong", { text: reviewerNarrative(conversation.title ?? "제목 없는 통관 지식 대화", "제목 없는 통관 지식 대화") }),
      element("small", { text: `${knowledgeTradeTypeLabel(conversation.trade_type)} · ${formatDate(conversation.updated_at)}` })));
    }
    if (!this.state.knowledgeConversations.length && !loading) {
      conversations.append(element("p", { className: "empty-copy", text: "아직 만든 통관 지식 대화가 없습니다." }));
    }

    const conversationSettingsNote = this.state.selectedKnowledgeConversation
      ? "현재 대화의 무역 방향과 지식 스냅샷 기준일은 고정되어 있습니다. 새 값을 선택하면 새 지식 대화를 준비합니다."
      : "아래 무역 방향과 지식 스냅샷 기준일은 새 지식 대화에만 적용됩니다.";
    const conversationProvenance = this.state.selectedKnowledgeConversation
      ? element("div", { className: "knowledge-conversation-provenance" },
        element("p", { className: "role-boundary-note", text: `지식 스냅샷 기준일 ${this.state.selectedKnowledgeConversation.as_of} · 개별 법령의 적용·효력 판단은 아닙니다.` }),
        verificationDetails([
          technicalLine("지식 스냅샷 식별번호", this.state.selectedKnowledgeConversation.snapshot_id),
        ], undefined, "현재 대화의 검증 상세"),
      )
      : null;
    const sidebar = element("aside", { className: "surface assistant-sidebar knowledge-sidebar" },
      sectionHeading(
        "통관 지식 도우미",
        "사건 심사와 분리된 공식 통관 지식 안내입니다. 답변은 선택한 무역 방향과 지식 스냅샷 기준일의 공개 근거를 바탕으로 제공합니다. 이 날짜만으로 개별 법령의 적용·효력을 확정하지 않으며, 공식 원문과 담당자 확인이 필요합니다.",
      ),
      field("무역 방향", select("knowledge_trade_type", [
        ["both", "수입·수출 공통"], ["import", "수입"], ["export", "수출"],
      ], this.state.knowledgeTradeType, (event) => {
        if (this.state.selectedKnowledgeConversation) this.beginNewKnowledgeConversation(false, false);
        this.state.knowledgeTradeType = (event.currentTarget as HTMLSelectElement).value as KnowledgeTradeType;
        this.render();
      }, "knowledge-trade-type")),
      field("지식 스냅샷 기준일", input("knowledge_as_of", {
        type: "date",
        value: this.state.knowledgeAsOf,
        ariaLabel: "지식 스냅샷 기준일",
        onInput: (event) => {
          if (this.state.selectedKnowledgeConversation) this.beginNewKnowledgeConversation(false, false);
          this.state.knowledgeAsOf = (event.currentTarget as HTMLInputElement).value;
        },
      })),
      element("p", { className: "role-boundary-note", text: conversationSettingsNote }),
      conversationProvenance,
      element("button", {
        className: "button button--secondary",
        text: "새 지식 대화 시작",
        attributes: { type: "button", disabled: loading || this.state.knowledgeSending ? "" : undefined, "data-e2e": "knowledge-new-conversation" },
        on: { click: () => this.beginNewKnowledgeConversation() },
      }),
      conversations,
    );
    const panel = element("section", { className: "surface assistant-panel knowledge-panel" },
      sectionHeading("공식 통관 지식에 질문하기", "이 대화는 특정 심사 건·문서 원문·심사 결과를 자동으로 사용하거나 전달하지 않습니다. 사건 문서 원문이나 개인정보는 이 대화에 붙여 넣지 마십시오. 사건 판단은 각 심사 건의 AI 도우미에서 확인하십시오."),
      this.state.knowledgeError ? element("div", { className: "assistant-error", attributes: { role: "alert" } },
        element("p", { text: this.state.knowledgeError }),
        this.state.knowledgeRetryContent ? element("button", { className: "text-link", text: "같은 질문 다시 보내기", attributes: { type: "button" }, on: { click: () => this.retryKnowledgeMessage() } }) : null,
        !this.state.knowledgeLoaded ? element("button", { className: "text-link", text: "대화 다시 불러오기", attributes: { type: "button" }, on: { click: () => { this.state.knowledgeLoaded = false; void this.ensureKnowledgeLoaded(); } } }) : null,
      ) : null,
      loading ? assistantLoadingState("통관 지식 대화 준비 중") : this.createKnowledgeConversationPanel(),
    );
    return element("section", { className: "assistant-layout knowledge-layout", attributes: { "data-e2e": "knowledge-workspace" } }, sidebar, panel);
  }

  private createKnowledgeConversationPanel(): HTMLElement {
    const conversation = this.state.selectedKnowledgeConversation;
    if (!conversation) {
      return element("div", { className: "assistant-empty" },
        element("h3", { text: "공식 통관 지식에 질문해 보십시오." }),
        element("p", { text: "예: ‘수출 신고 전에 확인할 기본 서류를 알려줘’처럼 수입·수출 공통 안내를 질문할 수 있습니다." }),
        element("button", { className: "button button--primary", text: "첫 지식 대화 만들기", attributes: { type: "button", "data-e2e": "knowledge-create" }, on: { click: () => void this.createKnowledgeConversation() } }),
      );
    }
    const messageList = element("ol", { className: "assistant-message-list", attributes: { "aria-live": "polite", "aria-label": "통관 지식 도우미 메시지" } });
    for (const item of this.state.knowledgeMessages) messageList.append(this.createKnowledgeMessage(item));
    if (!this.state.knowledgeMessages.length) {
      messageList.append(element("li", { className: "assistant-empty-message" },
        element("strong", { text: "이 대화에는 아직 메시지가 없습니다." }),
        element("span", { text: "아래에 질문을 입력하면 공식 통관 지식 스냅샷을 기준으로 답합니다." }),
      ));
    }
    if (this.state.knowledgeSending) {
      messageList.append(element("li", { className: "assistant-message assistant-message--assistant assistant-message--loading", attributes: { role: "status" } },
        element("strong", { text: "통관 지식 도우미" }), element("span", { text: "공식 근거를 확인해 답변을 준비하고 있습니다…" }),
      ));
    }
    const form = element("form", {
      className: "assistant-composer", attributes: { "data-e2e": "knowledge-form" },
      on: { submit: (event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget as HTMLFormElement).get("knowledge_message");
        void this.sendKnowledgeMessage(typeof value === "string" ? value : "");
      } },
    },
    field("질문", textarea("knowledge_message", {
      value: this.state.knowledgeDraft,
      maxLength: 4_000,
      placeholder: "수입·수출 절차, 제출 서류 또는 공식 통관 요건에 관해 질문하십시오.",
      onInput: (event) => this.updateKnowledgeDraft((event.currentTarget as HTMLTextAreaElement).value),
      onKeydown: (event) => this.handleKnowledgeKeydown(event as KeyboardEvent),
    })),
    element("div", { className: "assistant-composer__hint" },
      element("span", { text: "한 줄 질문 · Enter 전송" }),
      submit(this.state.knowledgeSending ? "답변 준비 중" : "질문 보내기", this.state.knowledgeSending),
    ));
    return element("div", { className: "assistant-conversation-panel" }, messageList, form);
  }

  private createKnowledgeMessage(item: KnowledgeMessage): HTMLElement {
    const isAssistant = item.role === "assistant";
    const answerSections = item.answer_sections ?? [];
    const guidanceResolution = isAssistant ? item.guidance_resolution ?? null : null;
    // A standalone answer is persisted both as the legacy-compatible
    // `content`/`direct_answer` projection and as its labelled guidance
    // section.  When those two projections are exactly the same, show the
    // labelled section once instead of repeating the answer body.
    const hidesDuplicateDirectAnswer = isAssistant
      && answerSections.length === 1
      && answerSections[0]?.kind === "general_guidance"
      && answerSections[0].content === item.content;
    const scope = isAssistant && item.answer_scope
      ? element("span", {
        className: "assistant-scope",
        attributes: { "data-e2e": "knowledge-answer-scope" },
        text: assistantScopeLabel(item.answer_scope),
      })
      : null;
    const resolvedCoverage = item.knowledge_coverage ?? guidanceResolution?.coverage;
    const coverage = isAssistant && resolvedCoverage
      ? element("span", { className: "assistant-scope assistant-scope--knowledge-coverage", attributes: { "data-e2e": "knowledge-coverage" }, text: knowledgeCoverageLabel(resolvedCoverage) })
      : null;
    const boundaryNotice = isAssistant && item.answer_scope
      ? knowledgeAnswerBoundaryNotice(item.answer_scope, item.citations, resolvedCoverage)
      : null;
    const provenance = isAssistant
      ? verificationDetails([
        technicalLine("지식 스냅샷 식별번호", item.knowledge_snapshot_id ?? guidanceResolution?.snapshot_id),
      ], undefined, "답변의 검증 상세")
      : null;
    const suggestions = isAssistant && item.suggested_questions.length
      ? element("div", { className: "assistant-message-suggestions", attributes: { "aria-label": "추천 질문" } },
        ...item.suggested_questions.map((question) => element("button", {
          className: "text-link", text: assistantSuggestionLabel(question), attributes: { type: "button", disabled: this.state.knowledgeSending ? "" : undefined },
          on: { click: () => void this.sendKnowledgeMessage(assistantSuggestionLabel(question)) },
        })),
      )
      : null;
    return element("li", { className: `assistant-message assistant-message--${item.role}`, attributes: { "data-e2e": "knowledge-message", "data-message-role": item.role } },
      element("header", {},
        element("strong", { text: isAssistant ? "통관 지식 도우미" : "나" }),
        scope,
        coverage,
        element("small", { text: `${formatDate(item.created_at)}${item.knowledge_as_of ?? guidanceResolution?.as_of ? ` · 지식 스냅샷 기준일 ${item.knowledge_as_of ?? guidanceResolution?.as_of}` : ""}` }),
      ),
      hidesDuplicateDirectAnswer
        ? null
        : reviewerNarrativeElement("p", "assistant-message__content", item.content, isAssistant ? "공식 통관 지식 근거를 바탕으로 안내를 준비했습니다." : undefined),
      boundaryNotice ? element("p", { className: "role-boundary-note knowledge-answer-boundary", attributes: { role: "status" }, text: boundaryNotice }) : null,
      guidanceResolution ? element("p", {
        className: "role-boundary-note knowledge-answer-boundary",
        attributes: { "data-e2e": "knowledge-guidance-resolution" },
        text: `${guidanceScopeLabel(guidanceResolution.scope)} · ${guidanceDirectionLabel(guidanceResolution.applicable_directions)}`,
      }) : null,
      isAssistant ? this.createAnswerSections(answerSections) : null,
      isAssistant ? this.createAssistantCitationList(citationsOutsideSections(item.citations, answerSections), "추가 근거") : null,
      provenance,
      suggestions,
    );
  }

  private createAnswerSections(sections: AssistantAnswerSection[]): HTMLElement | null {
    if (!sections.length) return null;
    return element("section", { className: "assistant-answer-sections", attributes: { "aria-label": "답변 구분과 공식 근거" } },
      ...sections.map((section) => element("section", { className: `assistant-answer-section assistant-answer-section--${section.kind}`, attributes: { "data-e2e": `answer-section-${section.kind}` } },
        element("header", {},
          element("strong", { className: "assistant-answer-section__label" },
            element("span", { className: "assistant-answer-section__icon", attributes: { "aria-hidden": "true" }, text: assistantAnswerSectionIcon(section.kind) }),
            element("span", { text: assistantAnswerSectionLabel(section.kind) }),
          ),
          element("span", { text: reviewerNarrative(section.title, assistantAnswerSectionDescription(section.kind)) }),
          element("small", { text: assistantAnswerSectionDescription(section.kind) }),
        ),
        reviewerNarrativeElement("p", undefined, section.content, "공식 근거 범위에서 추가 확인이 필요합니다."),
        this.createAssistantCitationList(section.citations, `${assistantAnswerSectionLabel(section.kind)} 근거`)
          ?? element("p", { className: "role-boundary-note", text: "이 안내에는 연결된 공식 근거가 아직 준비되지 않았습니다. 담당자가 공식 출처를 추가로 확인해야 합니다." }),
      )),
    );
  }

  private createAssistantCitationList(citations: AssistantCitation[], label: string): HTMLElement | null {
    if (!citations.length) return null;
    const caseCitations = citations.filter(isCaseCitation);
    const guidanceCitations = citations.filter((citation): citation is GuidanceEvidenceCitation => !isCaseCitation(citation));
    return element("div", { className: "assistant-citation-groups", attributes: { "aria-label": label } },
      caseCitations.length ? element("div", { className: "assistant-citations" },
        element("span", { text: "심사 근거" }),
        ...caseCitations.map((citation) => element("button", {
          className: "citation-chip", text: citationLabel(citation), attributes: { type: "button" },
          on: { click: () => void this.openAssistantCitation(citation).catch((error) => this.showError(error)) },
        })),
      ) : null,
      guidanceCitations.length ? element("ul", { className: "knowledge-citation-list", attributes: { "aria-label": "공식 안내 근거" } },
        ...guidanceCitations.map((citation) => this.createGuidanceCitation(citation)),
      ) : null,
    );
  }

  private createGuidanceCitation(citation: GuidanceEvidenceCitation): HTMLElement {
    const title = reviewerNarrative(guidanceCitationTitle(citation), "공식 통관 근거");
    return element("li", { className: "knowledge-citation" },
      element("strong", { text: title }),
      element("div", { className: "knowledge-citation__meta" },
        element("span", { text: knowledgeSourceKindLabel(citation.source_kind) }),
        element("span", { text: knowledgeCoverageLabel(citation.coverage) }),
        element("span", { text: `지식 스냅샷 기준일 ${citation.as_of}` }),
        safeOfficialGuidanceLink(citation.source_uri, title),
      ),
      element("p", { className: "role-boundary-note", text: "공식 자료를 조회한 지식 스냅샷 기준이며, 개별 법령의 적용·효력 판단은 아닙니다." }),
      verificationDetails([
        technicalLine("지식 스냅샷 식별번호", citation.snapshot_id),
      ]),
    );
  }

  private createWorkspace(): HTMLElement {
    const current = this.requireCase();
    const presentation = casePresentation(current);
    return element("section", { className: "workspace-shell", attributes: { "data-e2e": "case-workspace" } },
      element("section", { className: "case-workspace" },
      element("header", { className: "case-heading" },
        element("div", {},
          element("p", { className: "eyebrow", text: "심사 작업대" }),
          element("h1", { text: presentation.title }),
          element("div", { className: "case-meta" },
            element("span", { text: caseReferenceLabel(current) }),
            statusChip(caseStatusLabel(current.status), current.status),
            element("span", { text: `활성 문서 ${this.activeDocuments().length}건` }),
          ),
        ),
        element("div", { className: "case-actions" },
          element("span", { className: "human-review-badge", text: "담당자 확인 필요" }),
          this.createReviewButton(),
        ),
      ),
      this.createJobStatusNotice(),
      this.createTabs(),
      this.createActiveTab(),
      ),
      this.createCaseContext(current, presentation.kind),
    );
  }

  private createJobStatusNotice(): HTMLElement | null {
    const job = this.state.activeJob;
    if (!job) return null;
    if (ACTIVE_JOB_STATES.has(job.status)) {
      return element("section", { className: "processing-notice", attributes: { role: "status" } },
        element("strong", { text: "심사 요청 처리 중" }),
        element("span", { text: `${jobStatusLabel(job.status)}입니다. 실제 완료 결과가 도착한 뒤 심사 진행 과정을 표시합니다.` }),
      );
    }
    if (job.status !== "failed") return null;
    const canRetry = this.hasRole("reviewer") && this.activeDocuments().length > 0 && !this.state.busy;
    return element("section", { className: "review-failure-notice", attributes: { role: "alert", "data-e2e": "review-failure" } },
      element("div", {},
        element("strong", { text: "심사 결과를 만들지 못했습니다." }),
        element("span", { text: REVIEW_FAILURE_MESSAGE }),
      ),
      canRetry ? element("button", {
        className: "button button--secondary",
        text: "다시 심사하기",
        attributes: { type: "button", "data-e2e": "review-retry" },
        on: { click: () => void this.startReview() },
      }) : null,
    );
  }

  private createCaseContext(current: CaseDetail, kind: CasePresentation["kind"]): HTMLElement {
    const run = this.state.selectedRun;
    const runSummary = run ? this.state.runs.find((item) => item.review_run_id === run.review_run_id) : undefined;
    const status = run ? assessmentLabel(run.assessment) : "심사 전";
    const verification = verificationDetails([
      technicalLine("심사 건 식별번호", current.case_id),
      technicalLine("저장된 제목", current.title),
      technicalLine("변경 번호", String(current.revision)),
      run ? technicalLine("심사 실행 식별번호", run.review_run_id) : null,
      runSummary ? technicalLine("결과 해시", runSummary.result_digest) : null,
    ]);
    return element("aside", { className: "surface case-context", attributes: { "aria-label": "심사 현황" } },
      sectionHeading("심사 현황", kind === "functional-uat"
        ? "이 기록은 실제 서비스 기능을 확인하기 위해 생성된 기능 검증 기록입니다."
        : "자동 완료하지 않으며, 담당자가 문서와 법령 근거를 함께 확인합니다."),
      element("dl", { className: "case-context__facts" },
        definition("현재 상태", caseStatusLabel(current.status)),
        definition("활성 문서", `${this.activeDocuments().length}건`),
        definition("최근 심사", status),
        definition("담당자 판단", run ? `${run.reviewer_decisions.length}건` : "아직 없음"),
      ),
      element("section", { className: "case-context__guide" },
        element("h3", { text: "검토 순서" }),
        element("ol", {},
          element("li", { text: "문서 원문과 추출 정보를 확인합니다." }),
          element("li", { text: "문서 간 비교와 법령 근거를 확인합니다." }),
          element("li", { text: "확인 결과와 사유를 담당자 판단으로 남깁니다." }),
        ),
      ),
      verification,
    );
  }

  private createReviewButton(): HTMLElement {
    const running = this.state.activeJob !== null && ACTIVE_JOB_STATES.has(this.state.activeJob.status);
    const canReview = this.hasRole("reviewer");
    return element("div", { className: "review-control" },
      field("심사 업무", select("review_trade_type", [
        ["import", tradeTypeLabel("import")], ["export", tradeTypeLabel("export")],
      ], this.state.reviewTradeType, (event) => {
        this.state.reviewTradeType = (event.currentTarget as HTMLSelectElement).value as TradeType;
        this.render();
      }, "review-trade-type")),
      element("button", {
        className: "button button--primary",
        text: running ? "심사 진행 중" : canReview ? `AI ${tradeTypeLabel(this.state.reviewTradeType)} 심사 시작` : "심사자 역할에서 실행",
        attributes: {
          type: "button",
          disabled: this.state.busy || !this.activeDocuments().length || running || !canReview ? "" : undefined,
          title: canReview ? undefined : "AI 심사 실행은 심사자 역할에서만 가능합니다.",
          "data-e2e": "review-start",
        },
        on: { click: () => void this.startReview() },
      }),
    );
  }

  private createTabs(): HTMLElement {
    const current = this.requireCase();
    const tabs = element("nav", { className: "workspace-tabs", attributes: { role: "tablist", "aria-label": "심사 작업 영역" } });
    for (const tab of TABS) {
      tabs.append(element("button", {
        className: `workspace-tab${tab.id === this.state.activeTab ? " is-active" : ""}`,
        text: tab.label,
        attributes: {
          id: `workspace-tab-${tab.id}`,
          type: "button",
          role: "tab",
          tabindex: tab.id === this.state.activeTab ? "0" : "-1",
          "aria-selected": tab.id === this.state.activeTab ? "true" : "false",
          "aria-controls": `workspace-panel-${tab.id}`,
          "data-e2e": `workspace-tab-${tab.id}`,
        },
        on: {
          click: () => this.setRoute(current.case_id, tab.id),
          keydown: (event) => this.handleTabKeydown(event as KeyboardEvent, current.case_id, tab.id),
        },
      }));
    }
    return tabs;
  }

  private handleTabKeydown(event: KeyboardEvent, caseId: string, tab: WorkspaceTab): void {
    const currentIndex = TABS.findIndex((item) => item.id === tab);
    if (currentIndex < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1
      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length;
    const next = TABS[nextIndex];
    if (!next) return;
    this.setRoute(caseId, next.id);
    queueMicrotask(() => this.root.querySelector<HTMLElement>(`[data-e2e="workspace-tab-${next.id}"]`)?.focus());
  }

  private createActiveTab(): HTMLElement {
    const content = (() => {
      switch (this.state.activeTab) {
        case "analysis": return this.createAnalysisTab();
        case "assistant": return this.createAssistantTab();
        case "evidence": return this.createEvidenceTab();
        case "history": return this.createHistoryTab();
        default: return this.createDocumentsTab();
      }
    })();
    return element("section", {
      className: "workspace-panel",
      attributes: {
        id: `workspace-panel-${this.state.activeTab}`,
        role: "tabpanel",
        "aria-labelledby": `workspace-tab-${this.state.activeTab}`,
        tabindex: "0",
      },
    }, content);
  }

  private createDocumentsTab(): HTMLElement {
    const documents = element("div", { className: "document-table", attributes: { role: "list" } });
    for (const [index, document] of this.state.documents.entries()) {
      const superseded = Boolean(document.superseded_by_document_id);
      documents.append(element("button", {
        className: `document-row${this.state.selectedDocument?.document_id === document.document_id ? " is-selected" : ""}${superseded ? " is-superseded" : ""}`,
        attributes: { type: "button", role: "listitem", "data-e2e": "document-row", "data-document-id": document.document_id },
        on: { click: () => void this.withBusy(() => this.openDocument(document.document_id)) },
      },
      element("span", { className: "document-type", text: documentDisplayName(document) }),
      element("span", { className: "document-name", text: `${documentDisplayName(document)} · ${index + 1}번째 등록` }),
      element("span", { text: superseded ? "대체됨" : "활성" }),
      element("small", { text: `${document.character_count.toLocaleString()}자` })));
    }
    if (!this.state.documents.length) documents.append(element("p", { className: "empty-copy", text: "등록된 문서가 없습니다." }));

    const active = this.activeDocuments();
    const form = element("form", { className: "document-form", attributes: { "data-e2e": "document-form" }, on: { submit: (event) => { event.preventDefault(); void this.addDocument(event.currentTarget as HTMLFormElement); } } },
      element("p", { className: "form-hint", text: "텍스트 붙여넣기 또는 .txt 파일만 지원합니다. PDF·이미지·OCR은 이 기능 범위에 포함되지 않습니다." }),
      element("div", { className: "form-grid" },
        field("문서 유형", select("document_type", DOCUMENT_TYPES.map((type): [string, string] => [type, documentTypeLabel(type)]))),
        field("파일명", input("filename", { required: true, maxLength: 255, placeholder: "상업송장.txt" })),
      ),
      field("대체할 활성 문서", select("replaces_document_id", [["", "새 문서로 등록"], ...active.map((document): [string, string] => [document.document_id, documentDisplayName(document)])])),
      field("텍스트 파일(.txt)", input("text_file", { type: "file", accept: ".txt,text/plain" })),
      field("문서 원문", textarea("content_text", { maxLength: 200_000, placeholder: "문서에서 추출한 텍스트를 붙여넣으십시오." })),
      submit("텍스트 문서 등록", this.state.busy),
    );

    return element("section", { className: "tab-layout documents-layout" },
      element("section", { className: "surface document-panel" },
        sectionHeading("문서", "활성 문서는 다음 심사 입력에 포함됩니다."),
        documents,
        this.hasRole("reviewer")
          ? element("details", { className: "document-add-panel", attributes: { "data-e2e": "document-add-panel" } }, element("summary", { text: "문서 등록 또는 보완" }), form)
          : element("p", { className: "role-boundary-note", text: "승인 담당자는 원문과 심사 이력을 읽을 수 있지만 문서를 등록하거나 보완할 수는 없습니다." }),
      ),
      element("section", { className: "surface document-preview" }, this.createDocumentPreview()),
    );
  }

  private createDocumentPreview(): HTMLElement {
    const document = this.state.selectedDocument;
    if (!document) return emptyState("문서 미리보기", "왼쪽 목록에서 문서를 선택하면 원문과 인용 위치를 확인할 수 있습니다.");
    const details = verificationDetails([
      technicalLine("문서 식별번호", document.document_id),
      technicalLine("원본 파일명", document.filename),
      technicalLine("내용 해시", document.content_sha256),
      technicalLine("파일 형식", document.media_type),
    ], renderDocumentText(document.content_text, this.state.sourceFocus), "문서 원문 및 검증 상세");
    return element("div", {},
      sectionHeading(documentDisplayName(document), `${document.character_count.toLocaleString()}자 · ${document.superseded_by_document_id ? "대체된 문서" : "현재 심사에 사용 중"}`),
      element("p", { className: "document-preview__hint", text: "원문 인용 위치와 등록 정보는 아래 상세를 열어 확인할 수 있습니다." }),
      details,
    );
  }

  private createAnalysisTab(): HTMLElement {
    const run = this.state.selectedRun;
    if (!run) return emptyState("아직 심사 결과가 없습니다.", "활성 텍스트 문서를 등록한 뒤 AI 심사를 시작하십시오.");
    const executionStatus = statusChip(executionStatusLabel(run.execution_status), run.execution_status);
    executionStatus.setAttribute("data-e2e", "review-execution-status");
    executionStatus.setAttribute("data-review-execution-status", run.execution_status);
    const reviewDisposition = statusChip(reviewDispositionLabel(run.review_disposition), run.review_disposition);
    reviewDisposition.setAttribute("data-e2e", "review-disposition");
    reviewDisposition.setAttribute("data-review-disposition", run.review_disposition);
    const sections = run.report.sections.map((section, index) =>
      this.createAgentReportSection(run, section, index),
    );
    return element("section", { className: "analysis-stack grounded-report", attributes: { "data-e2e": "analysis-content" } },
      element("header", { className: "surface report-intro" },
        element("p", { className: "eyebrow", text: "AI 심사 결과" }),
        element("h2", { text: "근거 기반 심사 보고서" }),
        element("div", { className: "report-intro__status" }, executionStatus, reviewDisposition),
        reviewerNarrativeElement("p", "summary-copy", run.report.summary, reportSummaryFallback(run.assessment, run.findings.length)),
        reviewerNarrativeElement("p", "disclaimer", run.report.disclaimer, reportDisclaimerFallback()),
        element("p", { className: "report-source-note", text: "아래 항목은 이번 심사에서 확인한 내용과 근거를 연결해 보여줍니다. 근거 버튼을 누르면 문서 사실, 문서 비교 또는 법령 근거로 이동합니다." }),
      ),
      ...sections,
      element("section", { className: "surface report-supporting-data" },
        sectionHeading("심사 근거 상세", "보고서의 각 근거 참조를 더 자세히 확인할 수 있습니다."),
        element("div", { className: "review-metrics" },
          metric("확인 사항", String(run.findings.length)),
          metric("문서 비교", String(run.comparisons.length)),
          metric("법령 근거", String(groupEvidenceForDisplay(run.evidence).length)),
          metric("담당자 판단", String(run.reviewer_decisions.length)),
        ),
        this.createReportDocuments(run),
        this.createReportFacts(run),
        this.createComparisons(run.comparisons),
        this.createReportEvidence(run),
        this.createFindings([...run.findings].sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity))),
        this.createWorkflow(run),
        this.createNextSteps(run),
      ),
    );
  }

  private createAgentReportSection(run: ReviewRun, section: ReportSection, index: number): HTMLElement {
    const claims = element("ol", { className: "report-claim-list", attributes: { "data-report-claim-section": section.section } });
    for (const claim of section.claims) claims.append(this.createReportClaim(run, section, claim));
    return reportSection(
      String(index + 1).padStart(2, "0"),
      reportSectionLabel(section.section),
      reportSectionDescription(section.section),
      claims,
      section.section,
    );
  }

  private createReportClaim(run: ReviewRun, section: ReportSection, claim: ReportClaim): HTMLElement {
    const citations = groundedCitations(claim);
    const citationControls = element("div", { className: "report-claim-citations", attributes: { "aria-label": "보고서 주장 근거" } },
      element("span", { text: "근거" }),
      ...citations.map((citation) => element("button", {
        className: "citation-chip",
        text: citationLabel(citation),
        attributes: { type: "button" },
        on: { click: () => void this.openGroundedCitation(citation).catch((error) => this.showError(error)) },
      })),
    );
    return element("li", { className: "report-claim", attributes: { "data-report-claim-id": claim.claim_id } },
      reviewerNarrativeElement(
        "p",
        undefined,
        claim.text,
        reportClaimFallback(section.section, run.assessment, run.findings.length, claim.comparison_ids.length, claim.evidence_ids.length),
      ),
      citationControls,
    );
  }

  private createReportDocuments(run: ReviewRun): HTMLElement {
    if (!run.document_analyses.length) return element("p", { className: "empty-copy", text: "분석 결과에 문서 정보가 없습니다." });
    const list = element("div", { className: "report-document-list" });
    for (const analysis of run.document_analyses) {
      list.append(element("button", {
        className: "report-document-row",
        attributes: { type: "button" },
        on: { click: () => void this.focusSource({ source_kind: "document", document_id: analysis.document_id, quote: "", occurrence: 0 }) },
      },
      element("strong", { text: documentAnalysisDisplayName(analysis) }),
      element("span", { text: analysis.extraction_status === "complete" ? "문서 정보 확인 완료" : "문서 정보 추가 확인 필요" }),
      element("small", { text: "문서 탭에서 원문과 인용 위치를 확인할 수 있습니다." })));
    }
    return list;
  }

  private createReportFacts(run: ReviewRun): HTMLElement {
    const facts = run.document_analyses.flatMap((analysis) => [
      ...analysis.facts.map((fact) => ({ analysis, fact })),
      ...analysis.line_items.flatMap((item) => item.facts.map((fact) => ({ analysis, fact }))),
    ]);
    if (!facts.length) return element("p", { className: "empty-copy", text: "이번 실행에서는 화면에 표시할 추출 사실이 없습니다. 문서 원문과 확인 사항을 직접 검토하십시오." });
    const list = element("dl", { className: "report-fact-list" });
    for (const { analysis, fact } of facts) {
      const source = fact.source;
      const value = factValuePresentation(fact);
      const item = element("div", { className: "report-fact" },
        element("dt", { text: `${documentAnalysisDisplayName(analysis)} · ${fieldValueLabel(fact)}` }),
        element("dd", {}, element("span", { text: value.text, attributes: { "data-e2e": "reviewer-structured-value" } }), value.details),
        isDocumentSource(source)
          ? element("button", { className: "text-link", text: "원문 인용 보기", attributes: { type: "button" }, on: { click: () => void this.focusSource(source) } })
          : element("small", { className: "human-provided-fact", text: `담당자 제공 값 · ${source.reason} · 원문 인용은 변경하지 않습니다.` }),
      );
      item.dataset.factId = fact.fact_id;
      if (this.state.factFocusId === fact.fact_id) item.classList.add("is-focused");
      list.append(item);
    }
    if (this.state.factFocusId) {
      const focusedFactId = this.state.factFocusId;
      queueMicrotask(() => scrollIntoViewIfAvailable(Array.from(this.root.querySelectorAll<HTMLElement>("[data-fact-id]")).find(
        (item) => item.dataset.factId === focusedFactId,
      )));
    }
    return list;
  }

  private createReportEvidence(run: ReviewRun): HTMLElement {
    if (!run.evidence.length) return element("p", { className: "empty-copy", text: "이번 실행에서 연결된 법령 근거가 없습니다." });
    const list = element("div", { className: "report-evidence-list" });
    for (const group of groupEvidenceForDisplay(run.evidence)) {
      const evidence = group.representative;
      list.append(element("button", {
        className: "report-evidence-row",
        attributes: { type: "button" },
        on: { click: () => this.focusEvidence(evidence.evidence_id) },
      },
      element("strong", { text: evidenceDisplayTitle(evidence) }),
      element("span", { text: evidenceSummary(evidence) }),
      element("small", { text: group.items.length > 1 ? `같은 요건 ${group.items.length}건을 묶어 표시합니다.` : "법령 근거 탭에서 상세를 확인할 수 있습니다." })));
    }
    return list;
  }

  private createNextSteps(run: ReviewRun): HTMLElement {
    const list = element("ol", { className: "next-step-list" });
    const actions = run.required_actions.length
      ? run.required_actions
      : [{ action_code: "human_review_required", message: "자동 완료하지 않습니다. 담당자가 문서와 법령 근거를 확인해야 합니다.", finding_ids: [] }];
    for (const actionGroup of groupRequiredActions(run, actions)) {
      if (actionGroup.kind === "regulatory") {
        const linkedDocuments = documentLabelsForFindings(run, actionGroup.findings);
        const requirement = regulatoryRequirementLabel(run, actionGroup.findings);
        list.append(element("li", {
          className: "next-step-list__regulatory",
          attributes: { "data-e2e": "regulatory-required-action" },
        },
        element("strong", { text: "수입 요건 확인" }),
        element("span", { text: `${requirement ? `필수 확인 항목: ${requirement}. ` : ""}${linkedDocuments.length ? `${linkedDocuments.join("·")}의 ` : "연결된 문서의 "}수입 요건과 제출 자료를 한 번에 확인하십시오.` })));
        continue;
      }
      const action = actionGroup.actions[0];
      if (!action) continue;
      list.append(element("li", {},
        element("strong", { text: requiredActionLabel(action.action_code) }),
        reviewerNarrativeElement("span", undefined, action.message, requiredActionNarrativeFallback(action.action_code)),
      ));
    }
    const assist = element("button", {
      className: "button button--secondary",
      text: "AI 도우미에게 근거 질문하기",
      attributes: { type: "button" },
      on: { click: () => this.setRoute(this.requireCase().case_id, "assistant") },
    });
    return element("div", { className: "next-step-stack" }, list, assist);
  }

  private createAssistantTab(): HTMLElement {
    const run = this.state.selectedRun;
    if (!run) return emptyState("아직 질문할 심사 결과가 없습니다.", "심사를 실행한 뒤 문서, 문서 비교, 법령 근거에 대해 질문할 수 있습니다.");
    const loading = this.state.assistantLoading;
    const conversations = element("nav", { className: "assistant-conversations", attributes: { "aria-label": "AI 도우미 대화 목록" } });
    for (const conversation of this.state.assistantConversations) {
      conversations.append(element("button", {
        className: `assistant-conversation${this.state.selectedConversation?.conversation_id === conversation.conversation_id ? " is-selected" : ""}`,
        attributes: {
          type: "button",
          "aria-current": this.state.selectedConversation?.conversation_id === conversation.conversation_id ? "page" : undefined,
          disabled: loading || this.state.assistantSending ? "" : undefined,
        },
        on: { click: () => void this.selectAssistantConversation(conversation) },
      },
      element("strong", { text: conversation.title ?? "제목 없는 대화" }),
      element("small", { text: formatDate(conversation.updated_at) })));
    }
    if (!this.state.assistantConversations.length && !loading) {
      conversations.append(element("p", { className: "empty-copy", text: "아직 만든 대화가 없습니다." }));
    }

    const sidebar = element("aside", { className: "surface assistant-sidebar" },
      sectionHeading("AI 도우미", "심사 건 관련 답변은 이번 심사의 문서, 문서 비교, 법령 근거만 사용합니다. 일반 통관 안내는 사건별 판단이 아닙니다."),
      element("button", {
        className: "button button--secondary",
        text: "새 대화",
        attributes: { type: "button", disabled: loading || this.state.assistantSending ? "" : undefined, "data-e2e": "assistant-new-conversation" },
        on: { click: () => void this.createAssistantConversation() },
      }),
      conversations,
    );
    const panel = element("section", { className: "surface assistant-panel" },
      sectionHeading("심사 결과에 질문하기", "답변의 근거를 누르면 문서 원문, 문서 비교, 법령 근거로 바로 이동합니다. 일반 안내에는 사건별 결론을 넣지 않습니다."),
      this.state.assistantError ? element("div", { className: "assistant-error", attributes: { role: "alert" } },
        element("p", { text: this.state.assistantError }),
        this.state.assistantRetryContent ? element("button", { className: "text-link", text: "같은 질문 다시 보내기", attributes: { type: "button" }, on: { click: () => this.retryAssistantMessage() } }) : null,
        !this.state.assistantLoadedRunId ? element("button", { className: "text-link", text: "대화 다시 불러오기", attributes: { type: "button" }, on: { click: () => { this.state.assistantLoadedRunId = null; void this.ensureAssistantLoaded(); } } }) : null,
      ) : null,
      loading ? assistantLoadingState("AI 도우미 대화 준비 중") : this.createAssistantConversationPanel(run),
    );
    return element("section", { className: "assistant-layout" }, sidebar, panel);
  }

  private createAssistantConversationPanel(run: ReviewRun): HTMLElement {
    const conversation = this.state.selectedConversation;
    if (!conversation) {
      return element("div", { className: "assistant-empty" },
        element("h3", { text: "새 대화를 시작해 보십시오." }),
        element("p", { text: "예: ‘수량 불일치가 나온 문서와 실제 값을 알려줘’처럼 현재 심사 결과에 대해 질문할 수 있습니다." }),
        element("button", { className: "button button--primary", text: "첫 대화 만들기", attributes: { type: "button", "data-e2e": "assistant-create" }, on: { click: () => void this.createAssistantConversation() } }),
      );
    }
    const messageList = element("ol", { className: "assistant-message-list", attributes: { "aria-live": "polite", "aria-label": "AI 도우미 메시지" } });
    for (const item of this.state.assistantMessages) messageList.append(this.createAssistantMessage(item));
    if (!this.state.assistantMessages.length) {
      messageList.append(element("li", { className: "assistant-empty-message" },
        element("strong", { text: "이 대화에는 아직 메시지가 없습니다." }),
        element("span", { text: "아래에 질문을 입력하면 현재 심사 결과와 연결된 근거로 답합니다." }),
      ));
    }
    if (this.state.assistantSending) {
      messageList.append(element("li", { className: "assistant-message assistant-message--assistant assistant-message--loading", attributes: { role: "status" } },
        element("strong", { text: "AI 도우미" }), element("span", { text: "근거를 확인해 답변을 준비하고 있습니다…" }),
      ));
    }
    const form = element("form", {
      className: "assistant-composer", attributes: { "data-e2e": "assistant-form" },
      on: { submit: (event) => { event.preventDefault(); const formData = new FormData(event.currentTarget as HTMLFormElement); void this.sendAssistantMessage(stringValue(formData, "assistant_message")); } },
    },
    field("질문", textarea("assistant_message", {
      value: this.state.assistantDraft,
      maxLength: 4_000,
      placeholder: "현재 심사 결과, 문서 사실, 문서 비교, 법령 근거 또는 일반 통관 안내에 관해 질문하십시오.",
      onInput: (event) => this.updateAssistantDraft((event.currentTarget as HTMLTextAreaElement).value),
      onKeydown: (event) => this.handleAssistantKeydown(event as KeyboardEvent),
    })),
      element("div", { className: "assistant-composer__hint" },
      element("span", { text: "Enter 전송 · Shift+Enter 줄바꿈 · 붙여넣은 문서 원문은 새 심사 근거가 아닙니다." }),
      submit(this.state.assistantSending ? "답변 준비 중" : "질문 보내기", this.state.assistantSending),
    ));
    const suggestions = assistantSuggestions(run, this.state.assistantMessages);
    return element("div", { className: "assistant-conversation-panel" },
      messageList,
      suggestions.length ? element("div", { className: "assistant-suggestions", attributes: { "aria-label": "추천 질문" } },
        element("span", { text: "추천 질문" }),
        ...suggestions.map((question) => element("button", {
          className: "text-link", text: assistantSuggestionLabel(question), attributes: { type: "button", disabled: this.state.assistantSending ? "" : undefined },
          on: { click: () => void this.sendAssistantMessage(assistantSuggestionLabel(question)) },
        })),
      ) : null,
      form,
    );
  }

  private createAssistantMessage(item: AssistantMessage): HTMLElement {
    const label = item.role === "user" ? "나" : "AI 도우미";
    const answerSections = item.answer_sections ?? [];
    const hidesDuplicateDirectAnswer = item.role === "assistant"
      && answerSections[0]?.kind === "case_analysis"
      && answerSections[0].content === item.content;
    const metadata = item.role === "assistant" && item.answer_scope
      ? element("span", { className: "assistant-scope", text: assistantScopeLabel(item.answer_scope) })
      : null;
    const guidanceResolution = item.role === "assistant" ? item.guidance_resolution ?? null : null;
    const guidanceCoverage = guidanceResolution
      ? element("span", {
        className: "assistant-scope assistant-scope--knowledge-coverage",
        attributes: { "data-e2e": "case-guidance-coverage" },
        text: knowledgeCoverageLabel(guidanceResolution.coverage),
      })
      : null;
    const guidanceNotice = guidanceResolution ? caseGuidanceResolutionNotice(guidanceResolution) : null;
    const caseInputNotice = item.role === "assistant" && item.case_input_notice === "unregistered_document_text"
      ? "붙여넣은 문서 원문은 새 심사 근거로 사용하지 않았습니다. 반영하려면 문서를 등록하거나 교체한 뒤 새 Review Run으로 재심사하십시오."
      : null;
    const guidanceDetails = guidanceResolution
      ? verificationDetails(
        [technicalLine("지식 스냅샷 식별번호", guidanceResolution.snapshot_id)],
        undefined,
        "일반 통관 안내 검증 상세",
      )
      : null;
    const citations = item.role === "assistant"
      ? this.createAssistantCitationList(citationsOutsideSections(item.citations, item.answer_sections ?? []), "추가 근거")
      : null;
    const suggestions = item.role === "assistant" && item.suggested_questions.length
      ? element("div", { className: "assistant-message-suggestions" },
        ...item.suggested_questions.map((question) => element("button", {
          className: "text-link", text: assistantSuggestionLabel(question), attributes: { type: "button", disabled: this.state.assistantSending ? "" : undefined },
          on: { click: () => void this.sendAssistantMessage(assistantSuggestionLabel(question)) },
        })),
      ) : null;
    const correction = item.role === "assistant" && item.correction_draft
      ? this.hasRole("reviewer")
        ? element("button", {
          className: "button button--secondary assistant-correction-import",
          text: "수정 제안으로 가져오기",
          attributes: { type: "button" },
          on: { click: () => this.useCorrectionDraft(item.correction_draft as AssistantCorrectionDraft) },
        })
        : element("small", { className: "role-boundary-note", text: "정정 제안 초안은 심사자 역할에서만 기록할 수 있습니다." })
      : null;
    return element("li", { className: `assistant-message assistant-message--${item.role}`, attributes: { "data-e2e": "assistant-message", "data-message-role": item.role } },
      element("header", {},
        element("strong", { text: label }),
        metadata,
        guidanceCoverage,
        element("small", { text: `${formatDate(item.created_at)}${guidanceResolution ? ` · 지식 스냅샷 기준일 ${guidanceResolution.as_of}` : ""}` }),
      ),
      hidesDuplicateDirectAnswer
        ? null
        : reviewerNarrativeElement(
          "p",
          "assistant-message__content",
          item.content,
          item.role === "assistant"
            ? assistantNarrativeFallback(item.answer_scope ?? "case_grounded")
            : undefined,
        ),
      item.role === "assistant" ? this.createAnswerSections(answerSections) : null,
      guidanceResolution ? element("p", {
        className: "role-boundary-note knowledge-answer-boundary",
        attributes: { "data-e2e": "case-guidance-resolution" },
        text: `${guidanceScopeLabel(guidanceResolution.scope)} · ${guidanceDirectionLabel(guidanceResolution.applicable_directions)}${guidanceNotice ? ` · ${guidanceNotice}` : ""}`,
      }) : null,
      caseInputNotice ? element("p", { className: "role-boundary-note", attributes: { "data-e2e": "case-input-notice", role: "status" }, text: caseInputNotice }) : null,
      citations,
      guidanceDetails,
      suggestions,
      correction,
    );
  }

  private async openAssistantCitation(citation: CaseCitation): Promise<void> {
    await this.openGroundedCitation(citation);
  }

  private async openGroundedCitation(citation: CaseCitation): Promise<void> {
    const run = this.requireRun();
    if (citation.kind === "fact") {
      const fact = findFact(run, citation.reference_id);
      if (!fact) throw new Error("이 답변의 문서 사실을 찾지 못했습니다.");
      if (isDocumentSource(fact.source)) await this.focusSource(fact.source);
      else this.focusFact(fact.fact_id);
      return;
    }
    if (citation.kind === "comparison") {
      const comparison = run.comparisons.find((item) => item.comparison_id === citation.reference_id);
      if (!comparison) throw new Error("이 답변의 문서 비교 결과를 찾지 못했습니다.");
      this.state.comparisonFocusId = comparison.comparison_id;
      this.setRoute(this.requireCase().case_id, "analysis");
      return;
    }
    if (!run.evidence.some((item) => item.evidence_id === citation.reference_id)) {
      throw new Error("이 답변의 법령 근거를 찾지 못했습니다.");
    }
    this.focusEvidence(citation.reference_id);
  }

  private focusFact(factId: string): void {
    this.state.factFocusId = factId;
    this.setRoute(this.requireCase().case_id, "analysis");
  }

  private focusEvidence(evidenceId: string): void {
    const run = this.state.selectedRun;
    const representative = run
      ? groupEvidenceForDisplay(run.evidence).find((group) => group.items.some((item) => item.evidence_id === evidenceId))?.representative
      : undefined;
    this.state.evidenceFocusId = representative?.evidence_id ?? evidenceId;
    this.setRoute(this.requireCase().case_id, "evidence");
  }

  private createWorkflow(run: ReviewRun): HTMLElement {
    const list = element("ol", { className: "workflow-list" });
    for (const stage of run.workflow.stages) {
      list.append(element("li", { className: `workflow-step workflow-step--${stage.status}` },
        element("span", { className: "workflow-dot", attributes: { "aria-hidden": "true" } }),
        element("div", {},
          element("strong", { text: workflowStageLabel(stage.stage) }),
          reviewerNarrativeElement("p", undefined, stage.summary, workflowNarrativeFallback(stage.stage, stage.status)),
          element("small", { text: `처리 상태: ${workflowStatusLabel(stage.status)} · 확인 ${stage.attempt_count}회` }),
        ),
      ));
    }
    list.append(element("li", { className: "workflow-planner", attributes: { "data-planner-trace": "true" } },
      element("strong", { text: `제한형 심사 계획 · ${run.workflow.planner.cycle_count}회 순서` }),
      element("ol", { className: "planner-action-list" }, ...run.workflow.planner.actions.map((action) =>
        element("li", { className: `planner-action planner-action--${action.status}` },
          element("span", { text: `${action.cycle}차` }),
          element("strong", { text: plannerActionLabel(action.action) }),
          reviewerNarrativeElement("span", undefined, action.summary, plannerNarrativeFallback(action.action, action.status)),
          action.correction_proposal_ids.length
            ? element("small", { text: `반영한 정정 제안 ${action.correction_proposal_ids.length}건` })
            : null,
        ),
      )),
    ));
    if (run.workflow.reextractions.length) {
      list.append(element("li", { className: "workflow-retry" },
        element("strong", { text: "제한 재추출" }),
        element("span", { text: `${run.workflow.reextractions.length}개 문서에서 누락 필드 확인을 한 번만 재시도했습니다.` }),
      ));
    }
    return list;
  }

  private createFindings(findings: ReviewFinding[]): HTMLElement {
    if (!findings.length) return emptyState("등록된 확인 사항이 없습니다.", "그래도 결과는 자동 완료되지 않으며 담당자 검토가 필요합니다.");
    const run = this.requireRun();
    const list = element("div", { className: "finding-list" });
    for (const group of groupFindingsForDisplay(run, findings)) {
      if (group.kind === "regulatory") {
        list.append(this.createRegulatoryRequirementCard(group.findings));
      } else {
        const finding = group.findings[0];
        if (finding) list.append(this.createFindingCard(finding));
      }
    }
    return list;
  }

  private createFindingCard(finding: ReviewFinding): HTMLElement {
    const run = this.requireRun();
    const decision = run.reviewer_decisions.find((item) => item.finding_id === finding.finding_id);
    const comparison = finding.comparison_id ? run.comparisons.find((item) => item.comparison_id === finding.comparison_id) : undefined;
    const source = sourceForFinding(run, finding);
    return element("article", { className: `finding-card finding-card--${finding.severity}`, attributes: { "data-e2e": "finding-card", "data-finding-id": finding.finding_id } },
      element("header", { className: "finding-heading" },
        element("span", { className: `severity severity--${finding.severity}`, text: severityLabel(finding.severity) }),
        element("div", {}, element("strong", { text: findingTitle(finding) }), reviewerNarrativeElement("p", undefined, finding.message, findingNarrativeFallback(finding))),
      ),
      comparison ? this.createComparisonDetail(comparison) : null,
      source ? element("button", {
        className: "text-link", text: "문서 원문 인용 보기", attributes: { type: "button" },
        on: { click: () => void this.focusSource(source) },
      }) : null,
      finding.evidence_ids.length ? element("button", {
        className: "text-link", text: `법령 근거 보기 · ${finding.evidence_ids.length}건`, attributes: { type: "button" },
        on: { click: () => this.setRoute(this.requireCase().case_id, "evidence") },
      }) : null,
      this.createDecisionPanel(finding, decision),
      this.createCorrectionProposalPanel(finding, source),
    );
  }

  private createRegulatoryRequirementCard(findings: readonly ReviewFinding[]): HTMLElement {
    const run = this.requireRun();
    const linkedDocuments = documentLabelsForFindings(run, findings);
    const requirement = regulatoryRequirementLabel(run, findings);
    const evidenceCount = new Set(findings.flatMap((finding) => finding.evidence_ids)).size;
    const severity = findings.reduce((current, finding) =>
      severityWeight(finding.severity) > severityWeight(current) ? finding.severity : current,
    findings[0]?.severity ?? "medium");
    const detailItems = findings.map((finding) => {
      const decision = run.reviewer_decisions.find((item) => item.finding_id === finding.finding_id);
      const source = sourceForFinding(run, finding);
      return element("section", { className: "regulatory-requirement-details__item" },
        element("strong", { text: findingTitle(finding) }),
        reviewerNarrativeElement("p", undefined, finding.message, findingNarrativeFallback(finding)),
        this.createDecisionPanel(finding, decision),
        this.createCorrectionProposalPanel(finding, source),
      );
    });
    return element("article", {
      className: `finding-card finding-card--${severity} regulatory-requirement-card`,
      attributes: { "data-e2e": "regulatory-requirement-card" },
    },
    element("header", { className: "finding-heading" },
      element("span", { className: `severity severity--${severity}`, text: severityLabel(severity) }),
      element("div", {},
        element("strong", { text: "수입 요건 확인 필요" }),
        element("p", { text: `${requirement ? `필수 확인 항목은 ${requirement}입니다. ` : ""}같은 법령 근거에 연결된 확인 사항을 하나로 묶었습니다. 담당자가 제출 자료와 연결 문서를 함께 확인해야 합니다.` }),
      ),
    ),
    linkedDocuments.length ? element("p", { className: "regulatory-requirement-card__documents", text: `연결 문서: ${linkedDocuments.join(" · ")}` }) : null,
    evidenceCount ? element("button", {
      className: "text-link", text: `법령 근거 보기 · ${evidenceCount}건`, attributes: { type: "button" },
      on: { click: () => this.setRoute(this.requireCase().case_id, "evidence") },
    }) : null,
    element("details", { className: "regulatory-requirement-details" },
      element("summary", { text: `연결된 개별 확인 사항 ${findings.length}건` }),
      ...detailItems,
    ),
    );
  }

  private createComparisonDetail(comparison: ReviewComparison): HTMLElement {
    const expected = comparison.expected_value ?? comparison.left.display_value;
    const observed = comparison.observed_value ?? comparison.right.display_value;
    return element("div", { className: `comparison-detail comparison-detail--${comparison.status}` },
      element("span", { text: `${comparisonRuleLabel(comparison.rule_code)} · ${comparisonStatusLabel(comparison.status)}` }),
      reviewerNarrativeElement("p", undefined, comparison.message, comparisonNarrativeFallback(comparison)),
      element("dl", { className: "comparison-values" },
        structuredDefinition("기준", controlledStructuredValue(expected)),
        structuredDefinition("관측", controlledStructuredValue(observed)),
        comparison.unit ? structuredDefinition("단위", controlledStructuredValue(comparison.unit, "단위 확인 필요")) : null,
      ),
      protectedStructuredDetails([
        ["기준 원본 값", expected],
        ["관측 원본 값", observed],
        ["단위 원본 값", comparison.unit],
      ]),
    );
  }

  private createDecisionPanel(finding: ReviewFinding, decision: ReviewerDecision | undefined): HTMLElement {
    const history = decision ? element("div", { className: "decision-history" },
      element("div", { className: "decision-current" },
        element("strong", { text: `담당자 판단: ${reviewerDecisionLabel(decision.status)}` }),
        element("p", { text: decision.reason }),
        element("small", { text: `담당자 기록 · ${formatDate(decision.decided_at)}` }),
      ),
      decision.history.length > 1 ? element("ol", { className: "decision-history-list" }, ...decision.history.slice(0, -1).reverse().map((entry) =>
        element("li", {}, element("strong", { text: reviewerDecisionLabel(entry.status) }), element("span", { text: entry.reason }), element("small", { text: `담당자 · ${formatDate(entry.decided_at)}` })),
      )) : null,
    ) : element("p", { className: "decision-empty", text: "아직 담당자 판단이 기록되지 않았습니다." });
    const form = this.hasRole("reviewer")
      ? element("form", { className: "decision-form", attributes: { "data-e2e": "finding-decision" }, on: { submit: (event) => { event.preventDefault(); void this.decideFinding(event.currentTarget as HTMLFormElement, finding.finding_id); } } },
        select("status", [["confirmed", "확인함"], ["needs_information", "추가 자료 요청"], ["resolved", "해결됨"]]),
        textarea("reason", { required: true, maxLength: 4_000, placeholder: "판단 사유를 기록하십시오." }),
        submit(decision ? "판단 수정" : "판단 기록", this.state.busy),
      )
      : element("p", { className: "role-boundary-note", text: "확인 사항 판단은 심사자 역할에서만 기록할 수 있습니다." });
    return element("details", { className: "decision-panel", attributes: { open: decision ? undefined : "" } },
      element("summary", { text: decision ? "담당자 판단 보기·수정" : "담당자 판단 기록" }), history, form,
    );
  }

  private createCorrectionProposalPanel(
    finding: ReviewFinding,
    source: SourceReference | null,
  ): HTMLElement | null {
    if (!this.hasRole("reviewer")) {
      return element("p", { className: "role-boundary-note", text: "정정 제안은 심사자 역할에서만 만들 수 있습니다. 승인자 역할에서는 이력 탭에서 다른 사람이 만든 제안을 독립적으로 결정할 수 있습니다." });
    }
    const draft = this.state.correctionDraft;
    const matchesDraft = draft !== null && (!source || draft.document_id === source.document_id) &&
      (!source || !draft.fact_id || finding.fact_ids.includes(draft.fact_id));
    const target = matchesDraft ? draft : null;
    const factTarget = correctionFactTargetForFinding(this.requireRun(), finding);
    const documentId = target?.document_id ?? factTarget?.documentId ?? source?.document_id;
    if (!documentId) {
      return element("p", { className: "muted", text: "이 확인 사항에는 정정할 문서 사실이 연결되어 있지 않습니다. 문서 원문을 보완하거나 AI 도우미의 근거 있는 정정 제안을 사용하십시오." });
    }
    const factId = target?.fact_id ?? factTarget?.factId ?? "";
    const itemId = target?.item_id ?? factTarget?.itemId ?? "";
    const fieldName = target?.field_name ?? factTarget?.fieldName ?? "";
    const fieldIsBound = Boolean(factId && fieldName);
    const form = element("form", {
      className: "correction-proposal-form", attributes: { "data-e2e": "correction-proposal" },
      on: { submit: (event) => { event.preventDefault(); void this.createCorrectionProposal(event.currentTarget as HTMLFormElement); } },
    },
    input("document_id", { type: "hidden", value: documentId }),
    input("finding_id", { type: "hidden", value: finding.finding_id }),
    input("fact_id", { type: "hidden", value: factId }),
    input("item_id", { type: "hidden", value: itemId }),
    ...(fieldIsBound
      ? [
        input("field_name", { type: "hidden", value: fieldName, readOnly: true }),
        field("정정할 항목", input("field_display", { value: fieldLabel(fieldName), readOnly: true })),
      ]
      : [field("정정할 항목", select("field_name", correctionFieldChoices()))]),
    fieldIsBound ? element("p", { className: "form-hint", text: "이 확인 사항과 연결된 문서 사실의 필드를 사용합니다." }) : null,
    field("제안 값", textarea("new_value", { required: true, maxLength: 2_000, value: target?.new_value ?? "", placeholder: "문서 원문을 기준으로 제안 값을 입력하십시오." })),
    field("단위", input("unit", { maxLength: 64, value: target?.unit ?? "", placeholder: "선택 입력" })),
    field("제안 근거", textarea("reason", { required: true, maxLength: 2_000, value: target?.reason ?? "", placeholder: "왜 이 값으로 정정해야 하는지 문서 근거를 적으십시오." })),
    submit("정정 제안 기록", this.state.busy),
    );
    return element("details", { className: "correction-proposal-panel", attributes: { open: matchesDraft ? "" : undefined } },
      element("summary", { text: matchesDraft ? "AI 도우미 제안 검토·기록" : "정정 제안 만들기" }),
      element("p", { className: "form-hint", text: "이 제안은 원문이나 기존 결과를 바꾸지 않습니다. 담당자 승인 후에만 수정 반영 재심사에 적용할 수 있습니다." }),
      form,
    );
  }

  private createComparisons(comparisons: ReviewComparison[]): HTMLElement {
    if (!comparisons.length) return emptyState("비교 결과가 없습니다.", "문서 유형과 필드가 충분하면 비교 결과가 표시됩니다.");
    const table = element("div", { className: "comparison-table", attributes: { role: "table", "aria-label": "문서 비교 결과" } });
    table.append(element("div", { className: "comparison-table__header", attributes: { role: "row" } },
      element("span", { text: "검사" }), element("span", { text: "상태" }), element("span", { text: "비교값" }), element("span", { text: "설명" }), element("span", { text: "문서" }),
    ));
    for (const comparison of comparisons) {
      const hasLinkedSource = sourceForOperand(this.requireRun(), comparison.left) !== null || sourceForOperand(this.requireRun(), comparison.right) !== null;
      const left = controlledStructuredValue(comparison.left.display_value);
      const right = controlledStructuredValue(comparison.right.display_value);
      table.append(element("div", {
        className: `comparison-row comparison-row--${comparison.status}${this.state.comparisonFocusId === comparison.comparison_id ? " is-focused" : ""}`,
        attributes: { role: "row", "data-comparison-id": comparison.comparison_id },
      },
      element("span", { text: comparisonRuleLabel(comparison.rule_code) }),
      element("span", { text: comparisonStatusLabel(comparison.status) }),
      element("span", {},
        element("span", { text: `${left} ↔ ${right}`, attributes: { "data-e2e": "reviewer-structured-value" } }),
        protectedStructuredDetails([
          ["왼쪽 비교 원본 값", comparison.left.display_value],
          ["오른쪽 비교 원본 값", comparison.right.display_value],
        ]),
      ),
      reviewerNarrativeElement("span", undefined, comparison.message, comparisonNarrativeFallback(comparison)),
      hasLinkedSource
        ? element("button", { className: "text-link comparison-row__source", text: "연결 문서 보기", attributes: { type: "button" }, on: { click: () => void this.focusComparison(comparison) } })
        : element("span", { className: "muted", text: "연결 문서 없음" })));
    }
    if (this.state.comparisonFocusId) {
      const focusedId = this.state.comparisonFocusId;
      queueMicrotask(() => scrollIntoViewIfAvailable(Array.from(this.root.querySelectorAll<HTMLElement>("[data-comparison-id]")).find(
        (item) => item.dataset.comparisonId === focusedId,
      )));
    }
    return table;
  }

  private async focusComparison(comparison: ReviewComparison): Promise<void> {
    const source = sourceForOperand(this.requireRun(), comparison.left) ?? sourceForOperand(this.requireRun(), comparison.right);
    if (source) await this.focusSource(source);
  }

  private async focusSource(source: SourceReference): Promise<void> {
    await this.withBusy(async () => {
      this.state.factFocusId = null;
      await this.openDocument(source.document_id, source);
      this.state.activeTab = "documents";
      this.setRoute(this.requireCase().case_id, "documents");
    });
  }

  private createEvidenceTab(): HTMLElement {
    const run = this.state.selectedRun;
    if (!run) return emptyState("아직 법령 근거가 없습니다.", "심사를 완료하면 AI가 법령 근거를 연결합니다.");
    const retrievalStatus = this.createEvidenceRetrievalStatus(run);
    const temporalContext = this.createEvidenceTemporalContext(run);
    if (!run.evidence.length) {
      return element("section", { className: "surface evidence-surface", attributes: { "data-e2e": "evidence-content" } },
        sectionHeading("법령 근거", "이번 심사 항목과 연결된 법령·수입 요건을 확인합니다."),
        retrievalStatus,
        temporalContext,
        element("p", { className: "empty-copy", text: "현재 문서와 품목 기준으로 연결된 법령 근거가 없습니다." }),
      );
    }
    const evidence = element("div", { className: "evidence-list" });
    for (const group of groupEvidenceForDisplay(run.evidence)) {
      const item = group.representative;
      const itemIds = new Set(group.items.map((evidenceItem) => evidenceItem.evidence_id));
      const linked = run.findings.filter((finding) => finding.evidence_ids.some((id) => itemIds.has(id)));
      const linkedDocuments = documentLabelsForFindings(run, linked);
      evidence.append(element("article", {
        className: `evidence-card${this.state.evidenceFocusId === item.evidence_id ? " is-focused" : ""}`,
        attributes: { "data-e2e": "evidence-card", "data-evidence-id": item.evidence_id },
      },
        element("header", {}, element("span", { className: "evidence-type", text: evidenceSourceLabel(item.source_type) }), element("h3", { text: evidenceDisplayTitle(item) })),
        element("p", { className: "evidence-law", text: evidenceSummary(item) }),
        element("div", { className: "evidence-footer" },
          element("span", { text: linkedDocuments.length ? `연결 문서 ${linkedDocuments.join(" · ")}` : `연결된 확인 사항 ${linked.length}건` }),
          safeExternalLink(item.source_uri),
        ),
        group.items.length > 1 ? element("p", { className: "evidence-card__group-note", text: `같은 수입 요건 ${group.items.length}건을 하나로 묶어 표시합니다.` }) : null,
        verificationDetails([
          technicalLine("원본 제목", item.title),
          technicalLine("원본 법령명", item.law_name),
          technicalLine("원본 내용", item.text),
        ]),
      ));
    }
    if (this.state.evidenceFocusId) {
      const focusedId = this.state.evidenceFocusId;
      queueMicrotask(() => scrollIntoViewIfAvailable(Array.from(this.root.querySelectorAll<HTMLElement>("[data-evidence-id]")).find(
        (item) => item.dataset.evidenceId === focusedId,
      )));
    }
    return element("section", { className: "surface evidence-surface", attributes: { "data-e2e": "evidence-content" } },
      sectionHeading("법령 근거", "이번 심사 항목과 연결된 법령·수입 요건을 확인합니다."),
      retrievalStatus,
      temporalContext,
      evidence,
    );
  }

  private createEvidenceTemporalContext(run: ReviewRun): HTMLElement | null {
    const context = run.temporal_context;
    if (!context) return null;
    return element("aside", {
      className: "evidence-temporal-context",
      attributes: { "data-e2e": "evidence-temporal-context", "aria-label": "법령 근거 기준 시점" },
    },
    element("strong", { text: "법령 근거 기준 시점" }),
    element("p", { text: "아래는 이 심사에서 조회한 자료의 기준 시점이며, 개별 법령의 최종 적용·효력 판단은 아닙니다." }),
    element("dl", { className: "evidence-temporal-context__list" },
      temporalContextDefinition("법령 기준일", context.law_as_of, "law"),
      temporalContextDefinition("HSK 품목 기준 스냅샷 기준일", context.hsk_snapshot_as_of, "hsk"),
      temporalContextDefinition("수입·수출 요건 스냅샷 기준일", context.requirements_snapshot_as_of, "requirements"),
    ));
  }

  private createEvidenceRetrievalStatus(run: ReviewRun): HTMLElement {
    const retrieval = run.workflow.stages.find((stage) => stage.stage === "retrieve_evidence");
    const hasHsInputGap = hasDocumentHsInputGap(run);
    const dataFailure = retrieval?.status === "failed";
    const dataPartial = retrieval?.status === "needs_review"
      || (retrieval === undefined && run.execution_status === "partial" && !hasHsInputGap);
    const semantics = dataFailure && hasHsInputGap
      ? "input-hs-and-retrieval-failed"
      : dataFailure
        ? "retrieval-failed"
        : dataPartial && hasHsInputGap
          ? "input-hs-and-retrieval-partial"
          : dataPartial
            ? "retrieval-partial"
            : hasHsInputGap
              ? "input-hs-insufficient"
              : "retrieval-complete";
    const messages: string[] = [];
    if (hasHsInputGap) {
      messages.push("일부 문서에서 HS 코드를 확인할 수 없어 해당 문서의 수입 요건을 확인하지 못했습니다. 문서를 보완한 뒤 다시 심사하십시오.");
    }
    if (dataFailure) {
      messages.push("법령 근거 조회를 완료하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도하거나 담당자가 직접 확인하십시오.");
    } else if (dataPartial) {
      messages.push("일부 품목의 법령 근거를 확인하지 못했습니다. 담당자가 입력 정보와 법령 근거를 함께 확인해야 합니다.");
    }
    if (!messages.length) messages.push("법령 근거 조회를 완료했습니다. 연결된 수입 요건과 제출 자료를 함께 확인하십시오.");
    return element("div", {
      className: `evidence-retrieval-status evidence-retrieval-status--${semantics}`,
      attributes: { "data-e2e": "data-retrieval-status", "data-retrieval-semantics": semantics },
    }, ...messages.map((messageText) => element("p", { text: messageText })));
  }

  private createHistoryTab(): HTMLElement {
    const current = this.requireCase();
    const selectedRun = this.state.selectedRun;
    const timeline = element("ol", { className: "history-timeline" });
    for (const run of this.state.runs) {
      const relation = reviewRunRelationLabel(run);
      timeline.append(element("li", {
        className: `history-item${this.state.selectedRun?.review_run_id === run.review_run_id ? " is-selected" : ""}`,
        attributes: {
          "data-e2e": "review-run",
          "data-review-run-id": run.review_run_id,
          "data-parent-review-run-id": run.parent_review_run_id ?? undefined,
        },
      },
        element("button", {
          className: "history-button", attributes: { type: "button" },
          on: { click: () => void this.withBusy(async () => { await this.openRun(run.review_run_id); await this.ensureCorrectionProposalsLoaded(); }) },
        },
        element("strong", { text: formatDate(run.created_at) }),
        element("span", { text: `${assessmentLabel(run.assessment)} · 확인 사항 ${run.finding_count}건` }),
        element("small", { text: `${relation} · 담당자 판단 ${run.reviewer_decision_count}건` })),
      ));
    }
    if (!this.state.runs.length) timeline.append(element("li", { className: "empty-copy", text: "아직 심사 이력이 없습니다." }));
    const lineage = selectedRun ? this.createRunLineage(selectedRun) : null;
    const corrections = this.createCorrectionProposalHistory();
    const approvedCorrectionCount = this.eligibleCorrectionProposals().length;
    const selectedCorrectionCount = this.selectedEligibleCorrectionProposalIds().length;
    const canRevise = this.hasRole("approver");
    return element("section", { className: "history-layout", attributes: { "data-e2e": "history-content" } },
      element("section", { className: "surface history-main" },
        sectionHeading("심사 이력", "원래 심사 결과를 덮어쓰지 않고, 승인된 정정 제안은 수정 반영 재심사로 남깁니다."),
        lineage,
        timeline,
        corrections,
      ),
      element("section", { className: "surface history-next" },
        sectionHeading("다음 작업", "문서 보완 또는 선택한 승인 정정 제안을 반영한 재심사를 진행할 수 있습니다."),
        element("p", { text: "대체 문서는 문서 탭에서 등록하십시오. 정정 제안은 승인돼도 원래 심사를 바꾸지 않으며, 선택한 항목만 새 재심사에 반영됩니다." }),
        element("button", { className: "button button--secondary", text: "문서 탭으로 이동", attributes: { type: "button" }, on: { click: () => this.setRoute(current.case_id, "documents") } }),
        canRevise && approvedCorrectionCount
          ? element("p", { className: "correction-selection-summary", text: `재심사에 반영할 승인된 제안을 선택하십시오. 선택 ${selectedCorrectionCount}건 / 승인 ${approvedCorrectionCount}건` })
          : null,
        element("button", {
          className: "button button--primary",
          text: canRevise ? "선택한 정정으로 재심사" : "승인자 역할에서 재심사",
          attributes: {
            type: "button",
            disabled: !selectedCorrectionCount || this.state.busy || !canRevise ? "" : undefined,
            title: canRevise ? undefined : "수정 반영 재심사는 승인 담당자 역할에서만 가능합니다.",
            "data-e2e": "revision-start",
          },
          on: { click: () => void this.startRevision().catch((error) => this.showError(error)) },
        }),
        !canRevise ? element("p", { className: "role-boundary-note", text: "승인 담당자 역할에서 승인된 제안을 선택해 수정 반영 재심사를 실행할 수 있습니다." }) : null,
      ),
    );
  }

  private createRunLineage(run: ReviewRun): HTMLElement {
    const lines = element("ul", { className: "run-lineage" });
    if (run.parent_review_run_id) {
      lines.append(element("li", {},
        element("strong", { text: "이전 심사" }),
        element("button", { className: "text-link", text: "이전 심사 보기", attributes: { type: "button" }, on: { click: () => void this.withBusy(async () => { await this.openRun(run.parent_review_run_id as string); await this.ensureCorrectionProposalsLoaded(); }) } }),
      ));
    } else {
      lines.append(element("li", {}, element("strong", { text: "기준 심사" }), element("span", { text: "이 실행은 이전 정정 제안을 반영하지 않은 기준 심사입니다." })));
    }
    if (run.applied_correction_proposal_ids?.length) {
      lines.append(element("li", {}, element("strong", { text: "반영된 정정 제안" }), element("span", { text: `${run.applied_correction_proposal_ids.length}건` })));
    }
    const childCount = this.state.runs.filter((item) => item.parent_review_run_id === run.review_run_id).length;
    if (childCount) lines.append(element("li", {}, element("strong", { text: "후속 수정 반영 재심사" }), element("span", { text: `${childCount}건` })));
    return element("section", { className: "run-lineage-panel" }, element("h3", { text: "정정 반영 계보" }), lines);
  }

  private createCorrectionProposalHistory(): HTMLElement {
    if (this.state.correctionLoading) return assistantLoadingState("정정 제안 불러오는 중");
    if (this.state.correctionError) {
      return element("section", { className: "correction-history" },
        element("h3", { text: "정정 제안" }),
        element("p", { className: "assistant-error", text: this.state.correctionError }),
        element("button", { className: "text-link", text: "다시 불러오기", attributes: { type: "button" }, on: { click: () => { this.state.correctionLoadedRunId = null; void this.ensureCorrectionProposalsLoaded(); } } }),
      );
    }
    const list = element("div", { className: "correction-proposal-list" });
    for (const proposal of this.state.correctionProposals) list.append(this.createCorrectionProposalCard(proposal));
    if (!this.state.correctionProposals.length) list.append(element("p", { className: "empty-copy", text: "이 심사 실행에는 기록된 정정 제안이 없습니다." }));
    return element("section", { className: "correction-history" },
      sectionHeading("정정 제안", this.hasRole("approver")
        ? "제안 → 담당자 승인 또는 반려 → 승인된 항목 선택 → 수정 반영 재심사의 순서로 진행됩니다."
        : "제안 → 담당자 승인 또는 반려 → 선택된 항목의 수정 반영 재심사 순서로 진행됩니다."),
      list,
    );
  }

  private createCorrectionProposalCard(proposal: CorrectionProposal): HTMLElement {
    const selfProposed = proposal.created_by === this.state.session?.subject;
    const canDecide = proposal.status === "proposed" && this.hasRole("approver") && !selfProposed;
    const decisionForm = canDecide
      ? element("form", { className: "correction-decision-form", attributes: { "data-e2e": "correction-decision" }, on: { submit: (event) => { event.preventDefault(); void this.decideCorrectionProposal(proposal, event.currentTarget as HTMLFormElement); } } },
        select("status", [["approved", "승인"], ["rejected", "반려"]]),
        textarea("reason", { required: true, maxLength: 2_000, placeholder: "승인 또는 반려 사유를 기록하십시오." }),
        submit("결정 기록", this.state.busy),
      )
      : null;
    const decisionBoundary = proposal.status === "proposed" && !canDecide
      ? element("p", { className: "role-boundary-note", text: selfProposed
        ? "제안자는 자신의 제안을 승인하거나 반려할 수 없습니다. 다른 승인자가 결정해야 합니다."
        : "제안의 승인·반려는 승인자 역할에서만 기록할 수 있습니다." })
      : null;
    const childLink = proposal.applied_review_run_id
      ? element("button", { className: "text-link", text: "수정 반영 재심사 열기", attributes: { type: "button" }, on: { click: () => void this.withBusy(async () => { await this.openRun(proposal.applied_review_run_id as string); this.setRoute(this.requireCase().case_id, "analysis"); }) } })
      : null;
    const canSelectForRevision = this.hasRole("approver") && proposal.status === "approved" && !proposal.applied_review_run_id;
    const selectedForRevision = this.state.selectedCorrectionProposalIds.has(proposal.correction_proposal_id);
    const revisionSelection = canSelectForRevision
      ? this.createCorrectionProposalSelection(proposal, selectedForRevision)
      : null;
    return element("article", { className: `correction-proposal-card correction-proposal-card--${proposal.status}`, attributes: { "data-e2e": "correction-card" } },
      element("header", {}, element("span", { className: "correction-status", text: correctionStatusLabel(proposal.status) }), element("small", { text: formatDate(proposal.created_at) })),
      element("h4", { text: `${fieldLabel(proposal.field_name)}: ${proposal.new_value}${proposal.unit ? ` ${proposal.unit}` : ""}` }),
      element("p", { text: proposal.reason }),
      element("small", { text: "연결된 문서 사실을 기준으로 작성된 제안입니다." }),
      proposal.decision ? element("div", { className: "correction-decision" }, element("strong", { text: correctionStatusLabel(proposal.decision.status) }), element("p", { text: proposal.decision.reason }), proposal.decision.decided_at ? element("small", { text: formatDate(proposal.decision.decided_at) }) : null) : null,
      proposal.history.length ? element("ol", { className: "correction-history-list" }, ...proposal.history.map((entry) =>
        element("li", {},
          element("strong", { text: correctionHistoryLabel(entry.event) }),
          element("span", { text: entry.reason }),
          element("small", { text: `담당자 · ${formatDate(entry.occurred_at)}` }),
        ),
      )) : null,
      decisionForm,
      decisionBoundary,
      revisionSelection,
      childLink,
      verificationDetails([
        technicalLine("정정 제안 식별번호", proposal.correction_proposal_id),
        technicalLine("문서 식별번호", proposal.document_id),
        technicalLine("문서 사실 식별번호", proposal.fact_id),
        technicalLine("생성자", proposal.created_by),
      ]),
    );
  }

  private createCorrectionProposalSelection(proposal: CorrectionProposal, selected: boolean): HTMLElement {
    const checkbox = element("input", {
      attributes: {
        type: "checkbox",
        "data-correction-proposal-id": proposal.correction_proposal_id,
        "data-e2e": "correction-select",
        "aria-label": `${fieldLabel(proposal.field_name)} 정정을 수정 반영 재심사에 적용`,
      },
      on: {
        change: (event) => {
          const target = event.currentTarget;
          if (target instanceof HTMLInputElement) this.setCorrectionProposalSelected(proposal.correction_proposal_id, target.checked);
        },
      },
    });
    checkbox.checked = selected;
    return element("label", { className: "correction-proposal-select" },
      checkbox,
      element("span", { text: "이 정정을 수정 반영 재심사에 적용" }),
    );
  }

  private showError(error: unknown): void {
    this.state.error = userMessage(error, "요청을 처리하지 못했습니다.");
    this.render();
  }

  private updateQuery(value: string): void {
    this.state.query = value;
    this.render();
    const replacement = this.root.querySelector<HTMLInputElement>('input[name="search"]');
    replacement?.focus();
    replacement?.setSelectionRange(value.length, value.length);
  }
}

// Kept as the public bootstrap/test name while the UI is now a full workspace.
export const LightweightWorkbench = CommercialReviewWorkspace;

function createHeader(
  session: Session | null,
  mode: FrontendRuntimeMode,
  onLogout: () => void,
  onSwitchActor?: (actor: LocalDevelopmentActor) => void,
  busy = false,
  onOpenKnowledge?: () => void,
): HTMLElement {
  const roleSwitch = onSwitchActor
    ? element("div", { className: "local-role-switch", attributes: { "aria-label": "로컬 개발 역할 전환" } },
      element("span", { text: "개발 역할" }),
      element("button", {
        className: `button button--quiet${session?.roles.includes("reviewer") ? " is-selected" : ""}`,
        text: "심사자",
        attributes: { type: "button", disabled: busy || session?.roles.includes("reviewer") ? "" : undefined },
        on: { click: () => onSwitchActor("reviewer") },
      }),
      element("button", {
        className: `button button--quiet${session?.roles.includes("approver") ? " is-selected" : ""}`,
        text: "승인자",
        attributes: { type: "button", disabled: busy || session?.roles.includes("approver") ? "" : undefined },
        on: { click: () => onSwitchActor("approver") },
      }),
    )
    : null;
  return element("header", { className: "topbar" },
    element("a", { className: "brand-lockup", attributes: { href: "#/cases", "aria-label": "통관 AI 사전심사 심사 건 목록" } },
      element("span", { className: "brand-mark", text: "CA" }),
      element("span", {}, element("strong", { className: "brand", text: "통관 AI 사전심사" }), element("small", { text: mode === "functional-uat" ? "기능 확인 환경" : "팀 개발" })),
    ),
    element("div", { className: "user-block" },
      element("button", {
        className: "button button--quiet topbar-knowledge-link",
        text: "통관 지식 도우미",
        attributes: { type: "button", disabled: busy ? "" : undefined, "data-e2e": "open-knowledge" },
        on: { click: () => onOpenKnowledge?.() },
      }),
      element("span", { text: session ? roleSummary(session.roles) : "세션 확인 중" }),
      element("small", { text: session ? "현재 로그인 역할" : "" }),
      roleSwitch,
      element("button", { className: "button button--quiet", text: "로그아웃", attributes: { type: "button" }, on: { click: onLogout } }),
    ),
  );
}

function createRuntimeNotice(mode: FrontendRuntimeMode): HTMLElement {
  const functional = mode === "functional-uat";
  return element("section", { className: "runtime-notice", attributes: { role: "status" } },
    element("strong", { text: functional ? "실제 기능 확인 환경" : "기본 개발" }),
    element("span", { text: functional
      ? "실제 관세 3법·Data 저장소·Claude를 사용합니다. 결과는 항상 담당자 검토 대상이며 배포·승인 판단이 아닙니다."
      : "합성 법령 근거와 결정론 AI 심사를 사용합니다. Docker·모델·Law API·Claude 키 없이 전체 업무 흐름을 확인할 수 있습니다." }),
  );
}

function sectionHeading(title: string, description: string): HTMLElement {
  return element("header", { className: "section-heading" }, element("h2", { text: title }), element("p", { text: description }));
}

function reportSection(
  index: string,
  title: string,
  description: string,
  content: HTMLElement,
  sectionName?: string,
): HTMLElement {
  return element("section", { className: "surface report-section", attributes: { "data-report-section": sectionName ?? index } },
    element("header", { className: "report-section__heading" },
      element("span", { className: "report-section__index", text: index }),
      element("div", {}, element("h3", { text: title }), element("p", { text: description })),
    ),
    content,
  );
}

function assistantLoadingState(label: string): HTMLElement {
  return element("div", { className: "assistant-loading", attributes: { role: "status" } },
    element("span", { className: "assistant-loading__dot", attributes: { "aria-hidden": "true" } }),
    element("span", { text: label }),
  );
}

function metric(label: string, value: string): HTMLElement {
  return element("div", { className: "metric" }, element("span", { text: label }), element("strong", { text: value }));
}

function definition(label: string, value: string): HTMLElement {
  return element("div", {}, element("dt", { text: label }), element("dd", { text: value }));
}

function structuredDefinition(label: string, value: string): HTMLElement {
  return element("div", {},
    element("dt", { text: label }),
    element("dd", {}, element("span", { text: value, attributes: { "data-e2e": "reviewer-structured-value" } })),
  );
}

function factValuePresentation(fact: DocumentFact): { text: string; details: HTMLElement | null } {
  const raw = controlledStructuredValue(fact.raw_value);
  const normalized = fact.normalized_value && fact.normalized_value !== fact.raw_value
    ? controlledStructuredValue(fact.normalized_value)
    : null;
  const unit = fact.unit ? controlledStructuredValue(fact.unit, "단위 확인 필요") : null;
  return {
    text: `${raw}${normalized ? ` → ${normalized}` : ""}${unit ? ` ${unit}` : ""}`,
    details: protectedStructuredDetails([
      ["추출 원본 값", fact.raw_value],
      ["정규화 원본 값", fact.normalized_value],
      ["단위 원본 값", fact.unit],
    ]),
  };
}

/**
 * Basic reviewer surfaces never render an unsafe structured value.  If one is
 * present, the collapsed detail records only that a value was protected; it
 * does not reveal a filename, internal ID, credential, or arbitrary prose.
 */
function protectedStructuredDetails(
  entries: Array<readonly [string, string | null | undefined]>,
): HTMLElement | null {
  const protectedEntries = entries.flatMap(([label, value]) => {
    const displayed = displayValue(value);
    return controlledStructuredValue(value) === displayed
      ? []
      : [[label, redactedStructuredVerificationValue(value)] as const];
  });
  return verificationDetails(protectedEntries, undefined, "검증 상세");
}

function statusChip(label: string, technicalStatus: string): HTMLElement {
  const tone = technicalStatus === "closed" || technicalStatus === "succeeded" || technicalStatus === "completed"
    ? "success"
    : technicalStatus === "in_review" || technicalStatus === "needs_review" || technicalStatus === "partial"
      ? "warning"
      : technicalStatus === "failed" || technicalStatus === "blocked"
        ? "danger"
        : "neutral";
  return element("span", { className: `status-chip status-chip--${tone}`, text: label });
}

function reviewerNarrativeElement(
  tag: "p" | "span",
  className: string | undefined,
  value: string,
  fallback: string | undefined = undefined,
): HTMLElement {
  const displayed = reviewerNarrative(value, fallback);
  const original = reviewerNarrativeOriginal(value);
  const primary = element(tag, {
    ...(className === undefined ? {} : { className }),
    text: displayed,
    attributes: { "data-e2e": "reviewer-narrative" },
  });
  if (displayed === value && original === value) return primary;
  return element("div", { className: "legacy-narrative" },
    primary,
    element("details", { className: "legacy-execution-original" },
      element("summary", { text: "이전 실행 원문" }),
      element("pre", { className: "legacy-execution-original__text", text: original }),
    ),
  );
}

function verificationDetails(
  entries: Array<readonly [string, string] | null>,
  content: HTMLElement | undefined = undefined,
  summary = "검증 상세",
): HTMLElement | null {
  const available = entries.filter((entry): entry is readonly [string, string] => entry !== null);
  if (!available.length && !content) return null;
  return element("details", { className: "verification-details" },
    element("summary", { text: summary }),
    available.length
      ? element("dl", { className: "verification-details__list" }, ...available.map(([label, value]) => verificationDefinition(label, value)))
      : null,
    content ?? null,
  );
}

function temporalContextDefinition(label: string, value: string, kind: "law" | "hsk" | "requirements"): HTMLElement {
  return element("div", { attributes: { "data-e2e": `evidence-temporal-context-${kind}` } },
    element("dt", { text: label }),
    element("dd", { text: value }),
  );
}

function verificationDefinition(label: string, value: string): HTMLElement {
  const status = element("span", { className: "technical-copy-status", attributes: { role: "status", "aria-live": "polite" } });
  const copy = element("button", {
    className: "technical-copy",
    text: "복사",
    attributes: { type: "button", "aria-label": `${label} 복사` },
    on: {
      click: () => void copyTechnicalValue(value, copy, status),
    },
  });
  return element("div", {},
    element("dt", { text: label }),
    element("dd", {}, element("code", { text: value }), copy, status),
  );
}

async function copyTechnicalValue(value: string, button: HTMLButtonElement, status: HTMLElement): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
    await navigator.clipboard.writeText(value);
    button.textContent = "복사됨";
    status.textContent = "값을 클립보드에 복사했습니다.";
  } catch {
    button.textContent = "복사 실패";
    status.textContent = "브라우저에서 복사하지 못했습니다. 값을 선택해 직접 복사하십시오.";
  }
  window.setTimeout(() => {
    button.textContent = "복사";
    status.textContent = "";
  }, 2_500);
}

function emptyState(title: string, copy: string): HTMLElement {
  return element("section", { className: "surface empty-state" }, element("h2", { text: title }), element("p", { text: copy }));
}

function message(kind: "error" | "notice", text: string): HTMLElement {
  return element("section", { className: `notice notice--${kind}`, attributes: { role: kind === "error" ? "alert" : "status" } }, element("p", { text }));
}

function delayForVisibleReview(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function renderDocumentText(content: string, source: SourceReference | null): HTMLElement {
  const pre = element("pre", { className: "document-text", attributes: { tabindex: "0", "aria-label": "문서 원문" } });
  if (!source || !source.quote) {
    pre.textContent = content;
    return pre;
  }
  const index = occurrenceIndex(content, source.quote, source.occurrence);
  if (index < 0) {
    pre.textContent = content;
    return pre;
  }
  pre.append(document.createTextNode(content.slice(0, index)));
  pre.append(element("mark", { text: content.slice(index, index + source.quote.length), attributes: { "data-source-focus": "true" } }));
  pre.append(document.createTextNode(content.slice(index + source.quote.length)));
  queueMicrotask(() => scrollIntoViewIfAvailable(pre.querySelector("mark")));
  return pre;
}

type FindingDisplayGroup = {
  readonly kind: "regular" | "regulatory";
  readonly findings: readonly ReviewFinding[];
};

type RequiredActionDisplayGroup = {
  readonly kind: "regular" | "regulatory";
  readonly actions: readonly RequiredAction[];
  readonly findings: readonly ReviewFinding[];
};

type EvidenceDisplayGroup = {
  readonly representative: EvidenceItem;
  readonly items: readonly EvidenceItem[];
};

function groupFindingsForDisplay(run: ReviewRun, findings: readonly ReviewFinding[]): FindingDisplayGroup[] {
  const groups = new Map<string, ReviewFinding[]>();
  for (const finding of findings) {
    const key = finding.kind === "regulatory_finding"
      ? `regulatory:${regulatoryRequirementKey(run, finding)}`
      : `regular:${finding.finding_id}`;
    const existing = groups.get(key) ?? [];
    existing.push(finding);
    groups.set(key, existing);
  }
  return [...groups.values()].map((group) => ({
    kind: group.every((finding) => finding.kind === "regulatory_finding") ? "regulatory" : "regular",
    findings: group,
  }));
}

function groupRequiredActions(
  run: ReviewRun,
  actions: readonly RequiredAction[],
): RequiredActionDisplayGroup[] {
  const findingsById = new Map(run.findings.map((finding) => [finding.finding_id, finding]));
  const groups = new Map<string, RequiredActionDisplayGroup>();
  for (const action of actions) {
    const linked = action.finding_ids
      .map((findingId) => findingsById.get(findingId))
      .filter((finding): finding is ReviewFinding => finding !== undefined);
    const regulatory = linked.length > 0 && linked.every((finding) => finding.kind === "regulatory_finding");
    const key = regulatory
      ? `regulatory:${[...new Set(linked.map((finding) => regulatoryRequirementKey(run, finding)))].sort().join("|")}`
      : `regular:${action.action_code}:${action.finding_ids.join("|")}`;
    const existing = groups.get(key);
    if (existing) {
      groups.set(key, { ...existing, actions: [...existing.actions, action], findings: [...existing.findings, ...linked] });
      continue;
    }
    groups.set(key, { kind: regulatory ? "regulatory" : "regular", actions: [action], findings: linked });
  }
  return [...groups.values()].map((group) => ({
    ...group,
    findings: uniqueFindings(group.findings),
  }));
}

function groupEvidenceForDisplay(items: readonly EvidenceItem[]): EvidenceDisplayGroup[] {
  const groups = new Map<string, EvidenceItem[]>();
  for (const item of items) {
    const key = [
      item.source_type.trim().toLocaleLowerCase(),
      item.law_id?.trim().toLocaleLowerCase() ?? "",
      item.title.trim().toLocaleLowerCase(),
      item.text.trim().toLocaleLowerCase(),
    ].join("\u001f");
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }
  return [...groups.values()].map((group) => ({ representative: group[0] as EvidenceItem, items: group }));
}

function regulatoryRequirementKey(run: ReviewRun, finding: ReviewFinding): string {
  const evidenceById = new Map(run.evidence.map((item) => [item.evidence_id, item]));
  const evidenceKeys = finding.evidence_ids
    .map((evidenceId) => evidenceById.get(evidenceId))
    .filter((item): item is EvidenceItem => item !== undefined)
    .map((item) => [
      item.source_type.trim().toLocaleLowerCase(),
      item.law_id?.trim().toLocaleLowerCase() ?? "",
      item.title.trim().toLocaleLowerCase(),
      item.text.trim().toLocaleLowerCase(),
    ].join("\u001f"))
    .sort();
  if (evidenceKeys.length) return evidenceKeys.join("|");
  return finding.code.trim().toLocaleLowerCase().replace(/(?:[-_][a-z0-9]{6,})+$/iu, "");
}

function documentLabelsForFindings(run: ReviewRun, findings: readonly ReviewFinding[]): string[] {
  const analyses = new Map(run.document_analyses.map((analysis) => [analysis.document_id, analysis]));
  const labels = findings.flatMap((finding) => finding.document_ids)
    .map((documentId) => analyses.get(documentId))
    .filter((analysis): analysis is NonNullable<typeof analysis> => analysis !== undefined)
    .map((analysis) => documentAnalysisDisplayName(analysis));
  return [...new Set(labels)];
}

function regulatoryRequirementLabel(run: ReviewRun, findings: readonly ReviewFinding[]): string | null {
  const evidenceById = new Map(run.evidence.map((item) => [item.evidence_id, item]));
  for (const evidenceId of findings.flatMap((finding) => finding.evidence_ids)) {
    const title = evidenceById.get(evidenceId)?.title?.trim();
    if (title && /[가-힣]/u.test(title) && !requiresControlledNarrative(title)) return title;
  }
  return null;
}

function hasDocumentHsInputGap(run: ReviewRun): boolean {
  const analyses = new Map(run.document_analyses.map((analysis) => [analysis.document_id, analysis]));
  const documentIds = run.findings
    .filter((finding) => finding.kind === "validation_issue" && /hs[_-]?code/iu.test(finding.code))
    .flatMap((finding) => finding.document_ids);
  return documentIds.some((documentId) => {
    const analysis = analyses.get(documentId);
    if (!analysis) return false;
    const facts = [...analysis.facts, ...analysis.line_items.flatMap((item) => item.facts)];
    return !facts.some((fact) => /^hs_codes?$/iu.test(fact.name) && Boolean(fact.normalized_value?.trim() || fact.raw_value.trim()));
  });
}

function uniqueFindings(findings: readonly ReviewFinding[]): ReviewFinding[] {
  const byId = new Map(findings.map((finding) => [finding.finding_id, finding]));
  return [...byId.values()];
}

function sourceForFinding(run: ReviewRun, finding: ReviewFinding): SourceReference | null {
  for (const analysis of run.document_analyses) {
    for (const fact of [...analysis.facts, ...analysis.line_items.flatMap((item) => item.facts)]) {
      if (finding.fact_ids.includes(fact.fact_id) && isDocumentSource(fact.source)) return fact.source;
    }
  }
  return null;
}

function correctionFactTargetForFinding(run: ReviewRun, finding: ReviewFinding): CorrectionFactTarget | null {
  for (const analysis of run.document_analyses) {
    const directFact = analysis.facts.find((fact) => finding.fact_ids.includes(fact.fact_id) && isDocumentSource(fact.source));
    if (directFact) {
      return { documentId: analysis.document_id, factId: directFact.fact_id, itemId: null, fieldName: directFact.name };
    }
    for (const item of analysis.line_items) {
      const itemFact = item.facts.find((fact) => finding.fact_ids.includes(fact.fact_id) && isDocumentSource(fact.source));
      if (itemFact) {
        return { documentId: analysis.document_id, factId: itemFact.fact_id, itemId: item.item_id, fieldName: itemFact.name };
      }
    }
  }
  return null;
}

function sourceForOperand(run: ReviewRun, operand: ReviewComparison["left"]): SourceReference | null {
  if (operand.document_id === null) return null;
  for (const analysis of run.document_analyses) {
    if (analysis.document_id !== operand.document_id) continue;
    for (const fact of [...analysis.facts, ...analysis.line_items.flatMap((item) => item.facts)]) {
      if (operand.fact_ids.includes(fact.fact_id) && isDocumentSource(fact.source)) return fact.source;
    }
  }
  return null;
}

function findFact(run: ReviewRun, factId: string): DocumentFact | null {
  for (const analysis of run.document_analyses) {
    for (const fact of [...analysis.facts, ...analysis.line_items.flatMap((item) => item.facts)]) {
      if (fact.fact_id === factId) return fact;
    }
  }
  return null;
}

function mergeAssistantMessages(
  current: AssistantMessage[],
  userMessage: AssistantMessage,
  assistantMessage: AssistantMessage,
): AssistantMessage[] {
  const byId = new Map(current.map((item) => [item.message_id, item]));
  byId.set(userMessage.message_id, userMessage);
  byId.set(assistantMessage.message_id, assistantMessage);
  return [...byId.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

function mergeKnowledgeMessages(
  current: KnowledgeMessage[],
  userMessage: KnowledgeMessage,
  assistantMessage: KnowledgeMessage,
): KnowledgeMessage[] {
  const byId = new Map(current.map((item) => [item.message_id, item]));
  byId.set(userMessage.message_id, userMessage);
  byId.set(assistantMessage.message_id, assistantMessage);
  return [...byId.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

/** Avoid duplicating a canonical message citation already shown inside a section. */
function citationsOutsideSections(
  citations: AssistantCitation[],
  sections: AssistantAnswerSection[],
): AssistantCitation[] {
  const sectionKeys = new Set(sections.flatMap((section) => section.citations).map(citationKey));
  return citations.filter((citation) => !sectionKeys.has(citationKey(citation)));
}

function citationKey(citation: AssistantCitation): string {
  return citation.kind === "guidance_evidence"
    ? `${citation.kind}:${citation.source_id}`
    : `${citation.kind}:${citation.reference_id}`;
}

function safeExternalLink(value: string, sourceTitle = "공식 출처"): HTMLElement {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported URL");
    return element("a", { className: "text-link", text: "출처 열기", attributes: { href: url.href, target: "_blank", rel: "noopener noreferrer", "aria-label": `${sourceTitle} 출처 열기` } });
  } catch {
    return element("span", { className: "muted", text: "출처 URL을 표시할 수 없습니다." });
  }
}

function safeOfficialGuidanceLink(value: string, sourceTitle: string): HTMLElement {
  const url = officialGuidanceUrl(value);
  if (url === null) {
    return element("span", { className: "muted", text: "공식 출처 URL을 표시할 수 없습니다." });
  }
  return element("a", {
    className: "text-link",
    text: "출처 열기",
    attributes: {
      href: url.href,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": `${sourceTitle} 출처 열기`,
    },
  });
}

function parseRoute(hash: string): WorkspaceRoute {
  if (hash === "#/knowledge") return { kind: "knowledge" };
  const match = /^#\/cases\/([^/]+)(?:\/(documents|analysis|assistant|evidence|history))?$/u.exec(hash);
  if (!match) return { kind: "case", caseId: null, tab: "documents" };
  try {
    const caseId = decodeURIComponent(match[1] ?? "");
    return caseId
      ? { kind: "case", caseId, tab: (match[2] as WorkspaceTab | undefined) ?? "documents" }
      : { kind: "case", caseId: null, tab: "documents" };
  } catch {
    return { kind: "case", caseId: null, tab: "documents" };
  }
}

function occurrenceIndex(content: string, quote: string, occurrence: number): number {
  let offset = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    offset = content.indexOf(quote, offset + 1);
    if (offset < 0) return -1;
  }
  return offset;
}

function scrollIntoViewIfAvailable(element: Element | null | undefined): void {
  const target = element as (Element & { scrollIntoView?: (options?: ScrollIntoViewOptions) => void }) | null | undefined;
  if (typeof target?.scrollIntoView === "function") target.scrollIntoView({ block: "center" });
}

function groundedCitations(claim: ReportClaim): CaseCitation[] {
  const citations: CaseCitation[] = [
    ...claim.fact_ids.map((reference_id): CaseCitation => ({ kind: "fact", reference_id })),
    ...claim.comparison_ids.map((reference_id): CaseCitation => ({ kind: "comparison", reference_id })),
    ...claim.evidence_ids.map((reference_id): CaseCitation => ({ kind: "evidence", reference_id })),
  ];
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.kind}:${citation.reference_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assistantSuggestions(run: ReviewRun, messages: AssistantMessage[]): string[] {
  const fromLatestAnswer = [...messages].reverse().find((item) => item.role === "assistant")?.suggested_questions ?? [];
  if (fromLatestAnswer.length) return fromLatestAnswer;
  const suggestions: string[] = [];
  if (run.findings.length) suggestions.push("가장 우선해서 확인할 항목과 그 근거를 알려줘");
  if (run.comparisons.length) suggestions.push("문서 간 비교에서 확인이 필요한 값은 무엇이야?");
  if (run.evidence.length) suggestions.push("연결된 법령 근거가 이 심사 건과 어떻게 관련되는지 알려줘");
  return suggestions.slice(0, 3);
}

function severityLabel(value: ReviewFinding["severity"]): string {
  const labels: Record<ReviewFinding["severity"], string> = { critical: "긴급", high: "높음", medium: "보통", low: "낮음" };
  return labels[value];
}

function severityWeight(value: ReviewFinding["severity"]): number {
  return ({ critical: 4, high: 3, medium: 2, low: 1 })[value];
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function userMessage(error: unknown, fallback: string): string {
  return userFacingErrorMessage(error, fallback);
}

function knowledgeConversationTitle(tradeType: KnowledgeTradeType): string {
  const titles: Record<KnowledgeTradeType, string> = {
    import: "수입 통관 지식 대화",
    export: "수출 통관 지식 대화",
    both: "통관 지식 대화",
  };
  return titles[tradeType];
}

function stringValue(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: {
    className?: string;
    text?: string;
    attributes?: Record<string, string | undefined>;
    on?: Partial<Record<keyof HTMLElementEventMap, EventListener>>;
  } = {},
  ...children: Array<Node | null>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    if (value !== undefined) node.setAttribute(name, value);
  }
  for (const [name, handler] of Object.entries(options.on ?? {})) {
    if (handler) node.addEventListener(name, handler as EventListener);
  }
  node.append(...children.filter((child): child is Node => child !== null));
  return node;
}

function input(
  name: string,
  options: { type?: string; required?: boolean; maxLength?: number; placeholder?: string; value?: string; accept?: string; ariaLabel?: string; readOnly?: boolean; onInput?: EventListener } = {},
): HTMLInputElement {
  return element("input", {
    attributes: {
      name, type: options.type ?? "text", required: options.required ? "" : undefined,
      maxlength: options.maxLength === undefined ? undefined : String(options.maxLength), placeholder: options.placeholder,
      value: options.value, accept: options.accept, "aria-label": options.ariaLabel, readonly: options.readOnly ? "" : undefined,
    },
    ...(options.onInput ? { on: { input: options.onInput } } : {}),
  });
}

function textarea(
  name: string,
  options: {
    required?: boolean;
    maxLength?: number;
    placeholder?: string;
    value?: string;
    onInput?: EventListener;
    onKeydown?: EventListener;
  },
): HTMLTextAreaElement {
  return element("textarea", {
    attributes: {
      name,
      required: options.required ? "" : undefined,
      maxlength: options.maxLength === undefined ? undefined : String(options.maxLength),
      placeholder: options.placeholder,
      rows: "8",
    },
    on: {
      ...(options.onInput ? { input: options.onInput } : {}),
      ...(options.onKeydown ? { keydown: options.onKeydown } : {}),
    },
    ...(options.value === undefined ? {} : { text: options.value }),
  });
}

function select(
  name: string,
  options: ReadonlyArray<readonly [string, string]>,
  value?: string,
  onChange?: EventListener,
  dataE2E?: string,
): HTMLSelectElement {
  const node = element("select", { attributes: { name, "data-e2e": dataE2E }, ...(onChange ? { on: { change: onChange } } : {}) });
  for (const [optionValue, label] of options) node.append(element("option", { text: label, attributes: { value: optionValue, selected: value === optionValue ? "" : undefined } }));
  return node;
}

function field(label: string, control: HTMLElement): HTMLElement {
  return element("label", { className: "field" }, element("span", { className: "field__label", text: label }), control);
}

function submit(label: string, disabled: boolean): HTMLButtonElement {
  return element("button", { className: "button button--secondary", text: label, attributes: { type: "submit", disabled: disabled ? "" : undefined } });
}
