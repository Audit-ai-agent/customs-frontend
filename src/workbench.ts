import { ApiClient } from "./api/v1/client";
import { isDocumentSource } from "./api/v1/types";
import { userFacingErrorMessage } from "./api/user-facing-errors";
import type {
  AssistantCitation,
  AssistantConversation,
  AssistantCorrectionDraft,
  AssistantMessage,
  CaseDetail,
  CaseDocument,
  CaseSummary,
  CorrectionDecision,
  CorrectionProposal,
  CreateCorrectionProposalRequest,
  DocumentType,
  DocumentFact,
  FindingDecisionRequest,
  JobRecord,
  ReviewComparison,
  ReportClaim,
  ReportSection,
  ReviewerDecision,
  ReviewFinding,
  ReviewRun,
  ReviewRunSummary,
  SourceReference,
  Session,
} from "./api/v1/types";
import {
  supportsDevelopmentRoleSwitch,
  type BrowserSession,
  type LocalDevelopmentActor,
} from "./auth";

export type FrontendRuntimeMode = "local-development" | "functional-uat";
type WorkspaceTab = "documents" | "analysis" | "assistant" | "evidence" | "history";
type CaseFilter = "all" | "open" | "in_review" | "closed";

interface WorkbenchState {
  session: Session | null;
  cases: CaseSummary[];
  selectedCase: CaseDetail | null;
  documents: CaseDocument[];
  runs: ReviewRunSummary[];
  selectedRun: ReviewRun | null;
  selectedDocument: (CaseDocument & { content_text: string }) | null;
  sourceFocus: SourceReference | null;
  factFocusId: string | null;
  activeJob: JobRecord | null;
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

const DOCUMENT_TYPES: readonly DocumentType[] = ["CI", "PL", "BL", "CO", "UNKNOWN"];
const ACTIVE_JOB_STATES = new Set(["queued", "running"]);
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
    selectedCase: null,
    documents: [],
    runs: [],
    selectedRun: null,
    selectedDocument: null,
    sourceFocus: null,
    factFocusId: null,
    activeJob: null,
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
      await this.refreshCases();
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
      const currentCaseId = this.state.selectedCase?.case_id;
      await this.refreshCases();
      if (currentCaseId) await this.loadCase(currentCaseId);
      this.state.notice = actor === "approver"
        ? "로컬 승인자 세션으로 전환했습니다. 제안 승인·반려와 자식 심사만 수행할 수 있습니다."
        : "로컬 심사자 세션으로 전환했습니다. 문서·심사·판단·정정 제안을 기록할 수 있습니다.";
    });
  }

  private async refreshCases(): Promise<void> {
    this.state.cases = (await this.api.listCases()).items;
  }

  private async followRoute(render = true): Promise<void> {
    const route = parseRoute(window.location.hash);
    if (route.caseId === null) {
      this.state.selectedCase = null;
      this.state.documents = [];
      this.state.runs = [];
      this.state.selectedRun = null;
      this.state.selectedDocument = null;
      this.state.sourceFocus = null;
      this.state.factFocusId = null;
      this.resetRunAttachments();
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
    this.resetRunAttachments();
    if (runSummaries[0]) await this.openRun(runSummaries[0].review_run_id);
  }

  private async openRun(runId: string): Promise<void> {
    if (this.state.selectedRun?.review_run_id !== runId) this.resetRunAttachments();
    const run = await this.api.getReviewRun(runId);
    if (run.case_id !== this.state.selectedCase?.case_id) {
      throw new Error("심사 결과가 현재 Case에 속하지 않습니다.");
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
      if (job.status === "succeeded") await this.showSucceededReview(job);
      else {
        this.state.notice = "승인된 정정 제안을 반영하는 자식 심사를 요청했습니다. 완료되면 새 심사 이력으로 이동합니다.";
        this.scheduleJobPoll(job);
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
    if (!this.hasRole("reviewer")) throw new Error("Case 등록은 심사자 역할에서만 할 수 있습니다.");
    const data = new FormData(form);
    const title = stringValue(data, "title");
    if (!title) throw new Error("Case 제목을 입력해 주십시오.");
    const reference = stringValue(data, "reference");
    await this.withBusy(async () => {
      const created = await this.api.createCase({ title, external_reference: reference || null });
      await this.refreshCases();
      await this.loadCase(created.case_id);
      this.state.activeTab = "documents";
      this.state.notice = "새 Case를 만들었습니다. 텍스트 문서를 등록해 심사를 시작할 수 있습니다.";
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
      const job = await this.api.enqueueReview(current.case_id, { trade_type: "import" }, crypto.randomUUID());
      this.state.activeJob = job;
      if (job.status === "succeeded") {
        await this.showSucceededReview(job);
      } else {
        this.state.notice = "심사를 요청했습니다. 완료 상태가 확인되면 결과를 표시합니다.";
        this.scheduleJobPoll(job);
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
      else this.state.error = "심사가 완료되지 않았습니다. Job 상태와 서비스 로그를 확인하십시오.";
    } catch (error) {
      this.state.error = userMessage(error, "Job 상태를 확인하지 못했습니다.");
    } finally {
      this.render();
    }
  }

  private async showSucceededReview(job: JobRecord): Promise<void> {
    await this.loadCase(job.case_id);
    await this.openRun(job.review_run_id);
    this.state.activeTab = "analysis";
    this.state.notice = "심사가 완료되었습니다. 결과는 자동 승인되지 않으며 담당자 검토가 필요합니다.";
    this.setRoute(job.case_id, "analysis");
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
    if (!this.state.selectedCase) throw new Error("먼저 Case를 선택해 주십시오.");
    return this.state.selectedCase;
  }

  private requireRun(): ReviewRun {
    if (!this.state.selectedRun) throw new Error("먼저 심사 결과를 선택해 주십시오.");
    return this.state.selectedRun;
  }

  private render(): void {
    if (this.destroyed) return;
    const children = [
      createHeader(
        this.state.session,
        this.mode,
        () => void this.auth.logout(),
        this.mode === "local-development" && supportsDevelopmentRoleSwitch(this.auth)
          ? (actor) => void this.switchDevelopmentActor(actor)
          : undefined,
        this.state.busy,
      ),
      createRuntimeNotice(this.mode),
      this.state.error ? message("error", this.state.error) : null,
      this.state.notice ? message("notice", this.state.notice) : null,
      element("main", { className: "review-app", attributes: { id: "main-content", "aria-busy": String(this.state.busy), "data-e2e": "workspace-root" } },
        this.createQueue(),
        this.state.selectedCase ? this.createWorkspace() : this.createWelcome(),
      ),
    ].filter((item): item is HTMLElement => item !== null);
    this.root.replaceChildren(...children);
  }

  private createQueue(): HTMLElement {
    const visible = this.state.cases.filter((item) => {
      const matchesFilter = this.state.caseFilter === "all" || item.status === this.state.caseFilter;
      const candidate = `${item.title} ${item.external_reference ?? ""} ${item.case_id}`.toLocaleLowerCase();
      return matchesFilter && candidate.includes(this.state.query.toLocaleLowerCase());
    });
    const list = element("nav", { className: "case-list", attributes: { "aria-label": "Case 목록" } });
    for (const item of visible) {
      list.append(element("button", {
        className: `case-card${this.state.selectedCase?.case_id === item.case_id ? " is-selected" : ""}`,
        attributes: {
          type: "button",
          "aria-current": this.state.selectedCase?.case_id === item.case_id ? "page" : undefined,
          disabled: this.state.busy ? "" : undefined,
          "data-e2e": "case-card",
          "data-case-id": item.case_id,
        },
        on: { click: () => void this.openCase(item.case_id).catch((error) => this.showError(error)) },
      },
      element("strong", { text: item.title }),
      element("span", { text: item.external_reference ?? item.case_id }),
      element("small", { text: `${display(item.status)} · 수정 ${formatDate(item.updated_at)}` })));
    }
    if (!visible.length) list.append(element("p", { className: "empty-copy", text: "조건에 맞는 Case가 없습니다." }));

    const filters = element("div", { className: "queue-filters" },
      input("search", { placeholder: "Case명 또는 참조번호 검색", value: this.state.query, ariaLabel: "Case 검색", onInput: (event) => this.updateQuery((event.currentTarget as HTMLInputElement).value) }),
      select("case_filter", [
        ["all", "전체"], ["open", "진행 전"], ["in_review", "사람 검토 중"], ["closed", "종료"],
      ], this.state.caseFilter, (event) => { this.state.caseFilter = (event.currentTarget as HTMLSelectElement).value as CaseFilter; this.render(); }),
    );

    const form = element("form", { className: "case-create-form", attributes: { "data-e2e": "case-create-form" }, on: { submit: (event) => { event.preventDefault(); void this.createCase(event.currentTarget as HTMLFormElement); } } },
      field("Case 제목", input("title", { required: true, maxLength: 200, placeholder: "예: 8월 수입 신고 검토" })),
      field("업무 참조번호", input("reference", { maxLength: 200, placeholder: "선택 입력" })),
      submit("새 Case 만들기", this.state.busy),
    );

    return element("aside", { className: "case-queue", attributes: { "aria-label": "심사 업무함" } },
      element("div", { className: "queue-heading" },
        element("p", { className: "eyebrow", text: "REVIEW QUEUE" }),
        element("h2", { text: "심사 업무함" }),
        element("p", { text: `현재 ${this.state.cases.length}건` }),
      ),
      filters,
      list,
      this.hasRole("reviewer")
        ? element("details", { className: "new-case-panel", attributes: { open: this.state.cases.length === 0 ? "" : undefined, "data-e2e": "case-create-panel" } },
          element("summary", { text: "새 Case 등록" }), form)
        : element("p", { className: "role-boundary-note", text: "승인자 역할은 Case를 읽고 정정 제안을 독립적으로 승인·반려할 수 있습니다. 새 Case 등록은 심사자 역할에서만 가능합니다." }),
    );
  }

  private createWelcome(): HTMLElement {
    return element("section", { className: "workspace-welcome" },
      element("div", { className: "welcome-graphic", text: "AI" }),
      element("p", { className: "eyebrow", text: "CUSTOMS REVIEW WORKSPACE" }),
      element("h1", { text: "문서와 근거를 한 화면에서 검토합니다." }),
      element("p", { text: "Case를 선택하면 텍스트 문서, AI 심사 결과, 문서 간 비교, 법령 Evidence, 담당자 판단 이력을 연결해 확인할 수 있습니다." }),
      element("ol", { className: "welcome-steps" },
        element("li", {}, element("strong", { text: "문서 등록" }), element("span", { text: "Invoice, Packing List, B/L, C/O 텍스트를 등록합니다." })),
        element("li", {}, element("strong", { text: "AI 사전심사" }), element("span", { text: "Agent가 문서 사실과 정합성·법령 근거를 정리합니다." })),
        element("li", {}, element("strong", { text: "사람 검토" }), element("span", { text: "담당자가 판단과 사유를 기록하고 필요하면 보완 후 재심사합니다." })),
      ),
    );
  }

  private createWorkspace(): HTMLElement {
    const current = this.requireCase();
    return element("section", { className: "case-workspace", attributes: { "data-e2e": "case-workspace" } },
      element("header", { className: "case-heading" },
        element("div", {},
          element("p", { className: "eyebrow", text: "CASE WORKSPACE" }),
          element("h1", { text: current.title }),
          element("p", { className: "case-meta", text: `${current.external_reference ?? current.case_id} · ${display(current.status)} · 문서 ${this.activeDocuments().length}건` }),
        ),
        element("div", { className: "case-actions" },
          element("span", { className: "human-review-badge", text: "항상 사람 검토 필요" }),
          this.createReviewButton(),
        ),
      ),
      this.state.activeJob ? element("section", { className: "processing-notice", attributes: { role: "status" } },
        element("strong", { text: "심사 요청 처리 중" }),
        element("span", { text: `Job ${this.state.activeJob.job_id.slice(0, 12)} · ${display(this.state.activeJob.status)}. 실제 완료 결과가 도착한 뒤 워크플로우를 표시합니다.` }),
      ) : null,
      this.createTabs(),
      this.createActiveTab(),
    );
  }

  private createReviewButton(): HTMLElement {
    const running = this.state.activeJob !== null && ACTIVE_JOB_STATES.has(this.state.activeJob.status);
    const canReview = this.hasRole("reviewer");
    return element("button", {
      className: "button button--primary",
      text: running ? "심사 진행 중" : canReview ? "AI 심사 시작" : "심사자 역할에서 실행",
      attributes: {
        type: "button",
        disabled: this.state.busy || !this.activeDocuments().length || running || !canReview ? "" : undefined,
        title: canReview ? undefined : "AI 심사 실행은 심사자 역할에서만 가능합니다.",
        "data-e2e": "review-start",
      },
      on: { click: () => void this.startReview() },
    });
  }

  private createTabs(): HTMLElement {
    const current = this.requireCase();
    const tabs = element("nav", { className: "workspace-tabs", attributes: { "aria-label": "Case 작업 영역" } });
    for (const tab of TABS) {
      tabs.append(element("button", {
        className: `workspace-tab${tab.id === this.state.activeTab ? " is-active" : ""}`,
        text: tab.label,
        attributes: { type: "button", role: "tab", "aria-selected": tab.id === this.state.activeTab ? "true" : "false", "data-e2e": `workspace-tab-${tab.id}` },
        on: { click: () => this.setRoute(current.case_id, tab.id) },
      }));
    }
    return tabs;
  }

  private createActiveTab(): HTMLElement {
    switch (this.state.activeTab) {
      case "analysis": return this.createAnalysisTab();
      case "assistant": return this.createAssistantTab();
      case "evidence": return this.createEvidenceTab();
      case "history": return this.createHistoryTab();
      default: return this.createDocumentsTab();
    }
  }

  private createDocumentsTab(): HTMLElement {
    const documents = element("div", { className: "document-table", attributes: { role: "list" } });
    for (const document of this.state.documents) {
      const superseded = Boolean(document.superseded_by_document_id);
      documents.append(element("button", {
        className: `document-row${this.state.selectedDocument?.document_id === document.document_id ? " is-selected" : ""}${superseded ? " is-superseded" : ""}`,
        attributes: { type: "button", role: "listitem", "data-e2e": "document-row", "data-document-id": document.document_id },
        on: { click: () => void this.withBusy(() => this.openDocument(document.document_id)) },
      },
      element("span", { className: "document-type", text: document.document_type }),
      element("span", { className: "document-name", text: document.filename }),
      element("span", { text: superseded ? "대체됨" : "활성" }),
      element("small", { text: `${document.character_count.toLocaleString()}자` })));
    }
    if (!this.state.documents.length) documents.append(element("p", { className: "empty-copy", text: "등록된 문서가 없습니다." }));

    const active = this.activeDocuments();
    const form = element("form", { className: "document-form", attributes: { "data-e2e": "document-form" }, on: { submit: (event) => { event.preventDefault(); void this.addDocument(event.currentTarget as HTMLFormElement); } } },
      element("p", { className: "form-hint", text: "텍스트 붙여넣기 또는 .txt 파일만 지원합니다. PDF·이미지·OCR은 이 기능 범위에 포함되지 않습니다." }),
      element("div", { className: "form-grid" },
        field("문서 유형", select("document_type", DOCUMENT_TYPES.map((type): [string, string] => [type, documentTypeLabel(type)]))),
        field("파일명", input("filename", { required: true, maxLength: 255, placeholder: "commercial-invoice.txt" })),
      ),
      field("대체할 활성 문서", select("replaces_document_id", [["", "새 문서로 등록"], ...active.map((document): [string, string] => [document.document_id, `${document.document_type} · ${document.filename}`])])),
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
          : element("p", { className: "role-boundary-note", text: "승인자 역할은 원문과 심사 이력을 읽을 수 있지만 문서를 등록하거나 보완할 수는 없습니다." }),
      ),
      element("section", { className: "surface document-preview" }, this.createDocumentPreview()),
    );
  }

  private createDocumentPreview(): HTMLElement {
    const document = this.state.selectedDocument;
    if (!document) return emptyState("문서 미리보기", "왼쪽 목록에서 문서를 선택하면 원문과 인용 위치를 확인할 수 있습니다.");
    return element("div", {},
      sectionHeading(document.filename, `${document.document_type} · ${document.character_count.toLocaleString()}자 · ${document.superseded_by_document_id ? "대체된 문서" : "활성 문서"}`),
      renderDocumentText(document.content_text, this.state.sourceFocus),
    );
  }

  private createAnalysisTab(): HTMLElement {
    const run = this.state.selectedRun;
    if (!run) return emptyState("아직 심사 결과가 없습니다.", "활성 텍스트 문서를 등록한 뒤 AI 심사를 시작하십시오.");
    const sections = run.report.sections.map((section, index) =>
      this.createAgentReportSection(run, section, index),
    );
    return element("section", { className: "analysis-stack grounded-report", attributes: { "data-e2e": "analysis-content" } },
      element("header", { className: "surface report-intro" },
        element("p", { className: "eyebrow", text: "GROUNDED REVIEW REPORT" }),
        element("h2", { text: "근거 기반 심사 보고서" }),
        element("p", { className: "summary-copy", text: run.report.summary }),
        element("p", { className: "disclaimer", text: run.report.disclaimer }),
        element("p", { className: "report-source-note", text: "아래 8개 구역은 Agent가 이 심사 실행에서 반환한 주장과 근거 참조를 그대로 표시합니다. 근거 버튼을 누르면 해당 문서 사실, 비교 결과, Evidence로 이동합니다." }),
      ),
      ...sections,
      element("section", { className: "surface report-supporting-data" },
        sectionHeading("심사 근거 상세", "보고서의 각 근거 참조를 더 자세히 확인할 수 있습니다."),
        element("div", { className: "review-metrics" },
          metric("확인 사항", String(run.findings.length)),
          metric("문서 비교", String(run.comparisons.length)),
          metric("법령 근거", String(run.evidence.length)),
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
    for (const claim of section.claims) claims.append(this.createReportClaim(claim));
    return reportSection(
      String(index + 1).padStart(2, "0"),
      section.title,
      reportSectionDescription(section.section),
      claims,
      section.section,
    );
  }

  private createReportClaim(claim: ReportClaim): HTMLElement {
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
      element("p", { text: claim.text }),
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
      element("strong", { text: analysis.filename }),
      element("span", { text: `${documentAnalysisLabel(analysis.document_type)} · ${analysis.extraction_status === "complete" ? "사실 추출 완료" : "추가 확인 필요"}` }),
      element("small", { text: analysis.declared_type ? `등록 유형: ${analysis.declared_type}` : "등록 유형 없음" })));
    }
    return list;
  }

  private createReportFacts(run: ReviewRun): HTMLElement {
    const facts = run.document_analyses.flatMap((analysis) => [
      ...analysis.facts.map((fact) => ({ filename: analysis.filename, fact })),
      ...analysis.line_items.flatMap((item) => item.facts.map((fact) => ({ filename: analysis.filename, fact }))),
    ]);
    if (!facts.length) return element("p", { className: "empty-copy", text: "이번 실행에서는 화면에 표시할 추출 사실이 없습니다. 문서 원문과 확인 사항을 직접 검토하십시오." });
    const list = element("dl", { className: "report-fact-list" });
    for (const { filename, fact } of facts) {
      const source = fact.source;
      const item = element("div", { className: "report-fact" },
        element("dt", { text: `${filename} · ${fact.name}` }),
        element("dd", { text: `${fact.raw_value}${fact.normalized_value && fact.normalized_value !== fact.raw_value ? ` → ${fact.normalized_value}` : ""}${fact.unit ? ` ${fact.unit}` : ""}` }),
        isDocumentSource(source)
          ? element("button", { className: "text-link", text: "원문 인용 보기", attributes: { type: "button" }, on: { click: () => void this.focusSource(source) } })
          : element("small", { className: "human-provided-fact", text: `사람 제공 값 · 정정 제안 ${source.correction_proposal_id} · ${source.reason}` }),
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
    if (!run.evidence.length) return element("p", { className: "empty-copy", text: "이번 실행에서 연결된 법령 Evidence가 없습니다." });
    const list = element("div", { className: "report-evidence-list" });
    for (const evidence of run.evidence) {
      list.append(element("button", {
        className: "report-evidence-row",
        attributes: { type: "button" },
        on: { click: () => this.focusEvidence(evidence.evidence_id) },
      },
      element("strong", { text: evidence.title }),
      element("span", { text: evidence.law_name ?? evidence.source_type }),
      element("small", { text: `source hash ${evidence.source_hash.slice(0, 12)}…` })));
    }
    return list;
  }

  private createNextSteps(run: ReviewRun): HTMLElement {
    const list = element("ol", { className: "next-step-list" });
    const actions = run.required_actions.length
      ? run.required_actions
      : [{ action_code: "human_review_required", message: "자동 완료하지 않습니다. 담당자가 문서와 Evidence를 확인하십시오.", finding_ids: [] }];
    for (const action of actions) {
      list.append(element("li", {}, element("strong", { text: action.action_code }), element("span", { text: action.message })));
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
    if (!run) return emptyState("아직 질문할 심사 결과가 없습니다.", "심사를 실행한 뒤 문서·비교·Evidence에 대해 질문할 수 있습니다.");
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
      sectionHeading("AI 도우미", "사건 답변은 이 심사 실행의 문서·비교·Evidence만 사용합니다. 일반 통관 안내는 허용된 주제의 일반 설명이며 사건별 판단이 아닙니다."),
      element("button", {
        className: "button button--secondary",
        text: "새 대화",
        attributes: { type: "button", disabled: loading || this.state.assistantSending ? "" : undefined, "data-e2e": "assistant-new-conversation" },
        on: { click: () => void this.createAssistantConversation() },
      }),
      conversations,
    );
    const panel = element("section", { className: "surface assistant-panel" },
      sectionHeading("심사 결과에 질문하기", "사건 답변의 인용을 누르면 문서 원문, 비교 결과, Evidence로 바로 이동합니다. 일반 안내에는 사건별 결론을 넣지 않습니다."),
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
        element("span", { text: "아래에 질문을 입력하면 심사 실행 ID와 연결된 근거로 답합니다." }),
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
      placeholder: "현재 심사 결과·문서 사실·비교 결과·Evidence 또는 제한된 일반 통관 안내에 관해 질문하십시오.",
      onInput: (event) => this.updateAssistantDraft((event.currentTarget as HTMLTextAreaElement).value),
      onKeydown: (event) => this.handleAssistantKeydown(event as KeyboardEvent),
    })),
    element("div", { className: "assistant-composer__hint" },
      element("span", { text: "Enter 전송 · Shift+Enter 줄바꿈" }),
      submit(this.state.assistantSending ? "답변 준비 중" : "질문 보내기", this.state.assistantSending),
    ));
    const suggestions = assistantSuggestions(run, this.state.assistantMessages);
    return element("div", { className: "assistant-conversation-panel" },
      messageList,
      suggestions.length ? element("div", { className: "assistant-suggestions", attributes: { "aria-label": "추천 질문" } },
        element("span", { text: "추천 질문" }),
        ...suggestions.map((question) => element("button", {
          className: "text-link", text: question, attributes: { type: "button", disabled: this.state.assistantSending ? "" : undefined },
          on: { click: () => void this.sendAssistantMessage(question) },
        })),
      ) : null,
      form,
    );
  }

  private createAssistantMessage(item: AssistantMessage): HTMLElement {
    const label = item.role === "user" ? "나" : "AI 도우미";
    const metadata = item.role === "assistant" && item.answer_scope
      ? element("span", { className: "assistant-scope", text: assistantScopeLabel(item.answer_scope) })
      : null;
    const citations = item.role === "assistant" && item.citations.length
      ? element("div", { className: "assistant-citations", attributes: { "aria-label": "답변 근거" } },
        element("span", { text: "근거" }),
        ...item.citations.map((citation) => element("button", {
          className: "citation-chip", text: citationLabel(citation), attributes: { type: "button" },
          on: { click: () => void this.openAssistantCitation(citation).catch((error) => this.showError(error)) },
        })),
      ) : null;
    const suggestions = item.role === "assistant" && item.suggested_questions.length
      ? element("div", { className: "assistant-message-suggestions" },
        ...item.suggested_questions.map((question) => element("button", {
          className: "text-link", text: question, attributes: { type: "button", disabled: this.state.assistantSending ? "" : undefined },
          on: { click: () => void this.sendAssistantMessage(question) },
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
      element("header", {}, element("strong", { text: label }), metadata, element("small", { text: formatDate(item.created_at) })),
      element("p", { className: "assistant-message__content", text: item.content }),
      citations,
      suggestions,
      correction,
    );
  }

  private async openAssistantCitation(citation: AssistantCitation): Promise<void> {
    await this.openGroundedCitation(citation);
  }

  private async openGroundedCitation(citation: AssistantCitation): Promise<void> {
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
      throw new Error("이 답변의 Evidence를 찾지 못했습니다.");
    }
    this.focusEvidence(citation.reference_id);
  }

  private focusFact(factId: string): void {
    this.state.factFocusId = factId;
    this.setRoute(this.requireCase().case_id, "analysis");
  }

  private focusEvidence(evidenceId: string): void {
    this.state.evidenceFocusId = evidenceId;
    this.setRoute(this.requireCase().case_id, "evidence");
  }

  private createWorkflow(run: ReviewRun): HTMLElement {
    const list = element("ol", { className: "workflow-list" });
    for (const stage of run.workflow.stages) {
      list.append(element("li", { className: `workflow-step workflow-step--${stage.status}` },
        element("span", { className: "workflow-dot", attributes: { "aria-hidden": "true" } }),
        element("div", {},
          element("strong", { text: workflowLabel(stage.stage) }),
          element("p", { text: stage.summary }),
          element("small", { text: `상태: ${display(stage.status)} · 실행 ${stage.attempt_count}회` }),
        ),
      ));
    }
    list.append(element("li", { className: "workflow-planner", attributes: { "data-planner-trace": "true" } },
      element("strong", { text: `제한형 계획 · ${run.workflow.planner.cycle_count}회 cycle` }),
      element("ol", { className: "planner-action-list" }, ...run.workflow.planner.actions.map((action) =>
        element("li", { className: `planner-action planner-action--${action.status}` },
          element("span", { text: `${action.cycle}차` }),
          element("strong", { text: plannerActionLabel(action.action) }),
          element("span", { text: action.summary }),
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
    for (const finding of findings) {
      const decision = run.reviewer_decisions.find((item) => item.finding_id === finding.finding_id);
      const comparison = finding.comparison_id ? run.comparisons.find((item) => item.comparison_id === finding.comparison_id) : undefined;
      const source = sourceForFinding(run, finding);
      const card = element("article", { className: `finding-card finding-card--${finding.severity}`, attributes: { "data-e2e": "finding-card", "data-finding-id": finding.finding_id } },
        element("header", { className: "finding-heading" },
          element("span", { className: `severity severity--${finding.severity}`, text: severityLabel(finding.severity) }),
          element("div", {}, element("strong", { text: finding.code }), element("p", { text: finding.message })),
        ),
        comparison ? this.createComparisonDetail(comparison) : null,
        source ? element("button", {
          className: "text-link", text: "문서 원문 인용 보기", attributes: { type: "button" },
          on: { click: () => void this.focusSource(source) },
        }) : null,
        finding.evidence_ids.length ? element("button", {
          className: "text-link", text: `연결된 법령 근거 ${finding.evidence_ids.length}건`, attributes: { type: "button" },
          on: { click: () => this.setRoute(this.requireCase().case_id, "evidence") },
        }) : null,
        this.createDecisionPanel(finding, decision),
        this.createCorrectionProposalPanel(finding, source),
      );
      list.append(card);
    }
    return list;
  }

  private createComparisonDetail(comparison: ReviewComparison): HTMLElement {
    return element("div", { className: `comparison-detail comparison-detail--${comparison.status}` },
      element("span", { text: `${comparison.rule_code} · ${comparisonStatusLabel(comparison.status)}` }),
      element("p", { text: comparison.message }),
      element("dl", { className: "comparison-values" },
        definition("기준", displayValue(comparison.expected_value ?? comparison.left.display_value)),
        definition("관측", displayValue(comparison.observed_value ?? comparison.right.display_value)),
        comparison.unit ? definition("단위", comparison.unit) : null,
      ),
    );
  }

  private createDecisionPanel(finding: ReviewFinding, decision: ReviewerDecision | undefined): HTMLElement {
    const history = decision ? element("div", { className: "decision-history" },
      element("div", { className: "decision-current" },
        element("strong", { text: `담당자 판단: ${decisionStatusLabel(decision.status)}` }),
        element("p", { text: decision.reason }),
        element("small", { text: `${decision.decided_by} · ${formatDate(decision.decided_at)}` }),
      ),
      decision.history.length > 1 ? element("ol", { className: "decision-history-list" }, ...decision.history.slice(0, -1).reverse().map((entry) =>
        element("li", {}, element("strong", { text: decisionStatusLabel(entry.status) }), element("span", { text: entry.reason }), element("small", { text: `${entry.decided_by} · ${formatDate(entry.decided_at)}` })),
      )) : null,
    ) : element("p", { className: "decision-empty", text: "아직 담당자 판단이 기록되지 않았습니다." });
    const form = this.hasRole("reviewer")
      ? element("form", { className: "decision-form", attributes: { "data-e2e": "finding-decision" }, on: { submit: (event) => { event.preventDefault(); void this.decideFinding(event.currentTarget as HTMLFormElement, finding.finding_id); } } },
        select("status", [["confirmed", "확인함"], ["needs_information", "추가자료 요청"], ["resolved", "해결됨"]]),
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
    const documentId = target?.document_id ?? source?.document_id;
    if (!documentId) {
      return element("p", { className: "muted", text: "이 확인 사항에는 정정할 문서 사실이 연결되어 있지 않습니다. 문서 원문을 보완하거나 AI 도우미의 근거 있는 정정 제안을 사용하십시오." });
    }
    const form = element("form", {
      className: "correction-proposal-form", attributes: { "data-e2e": "correction-proposal" },
      on: { submit: (event) => { event.preventDefault(); void this.createCorrectionProposal(event.currentTarget as HTMLFormElement); } },
    },
    input("document_id", { type: "hidden", value: documentId }),
    input("finding_id", { type: "hidden", value: finding.finding_id }),
    input("fact_id", { type: "hidden", value: target?.fact_id ?? finding.fact_ids[0] ?? "" }),
    input("item_id", { type: "hidden", value: target?.item_id ?? "" }),
    field("정정할 필드", input("field_name", { required: true, maxLength: 64, value: target?.field_name ?? "", placeholder: "예: quantity" })),
    field("제안 값", textarea("new_value", { required: true, maxLength: 2_000, value: target?.new_value ?? "", placeholder: "문서 원문을 기준으로 제안 값을 입력하십시오." })),
    field("단위", input("unit", { maxLength: 64, value: target?.unit ?? "", placeholder: "선택 입력" })),
    field("제안 근거", textarea("reason", { required: true, maxLength: 2_000, value: target?.reason ?? "", placeholder: "왜 이 값으로 정정해야 하는지 문서 근거를 적으십시오." })),
    submit("정정 제안 기록", this.state.busy),
    );
    return element("details", { className: "correction-proposal-panel", attributes: { open: matchesDraft ? "" : undefined } },
      element("summary", { text: matchesDraft ? "AI 도우미 제안 검토·기록" : "정정 제안 만들기" }),
      element("p", { className: "form-hint", text: "이 제안은 원문이나 기존 결과를 바꾸지 않습니다. 담당자 승인 후에만 자식 심사 실행에 반영할 수 있습니다." }),
      form,
    );
  }

  private createComparisons(comparisons: ReviewComparison[]): HTMLElement {
    if (!comparisons.length) return emptyState("비교 결과가 없습니다.", "문서 유형과 필드가 충분하면 비교 결과가 표시됩니다.");
    const table = element("div", { className: "comparison-table", attributes: { role: "table", "aria-label": "문서 비교 결과" } });
    table.append(element("div", { className: "comparison-table__header", attributes: { role: "row" } },
      element("span", { text: "검사" }), element("span", { text: "상태" }), element("span", { text: "비교값" }), element("span", { text: "설명" }),
    ));
    for (const comparison of comparisons) {
      table.append(element("button", {
        className: `comparison-row comparison-row--${comparison.status}${this.state.comparisonFocusId === comparison.comparison_id ? " is-focused" : ""}`,
        attributes: { type: "button", role: "row", "data-comparison-id": comparison.comparison_id },
        on: { click: () => void this.focusComparison(comparison) },
      },
      element("span", { text: comparison.rule_code }),
      element("span", { text: comparisonStatusLabel(comparison.status) }),
      element("span", { text: `${displayValue(comparison.left.display_value)} ↔ ${displayValue(comparison.right.display_value)}` }),
      element("span", { text: comparison.message })));
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
    if (!run) return emptyState("아직 법령 근거가 없습니다.", "심사를 완료하면 Agent가 Data Evidence를 연결합니다.");
    if (!run.evidence.length) return emptyState("반환된 법령 Evidence가 없습니다.", "현재 문서와 품목 기준으로 반환된 근거가 없었습니다.");
    const evidence = element("div", { className: "evidence-list" });
    for (const item of run.evidence) {
      const linked = run.findings.filter((finding) => finding.evidence_ids.includes(item.evidence_id));
      evidence.append(element("article", {
        className: `evidence-card${this.state.evidenceFocusId === item.evidence_id ? " is-focused" : ""}`,
        attributes: { "data-e2e": "evidence-card", "data-evidence-id": item.evidence_id },
      },
        element("header", {}, element("span", { className: "evidence-type", text: item.source_type }), element("h3", { text: item.title })),
        item.law_name ? element("p", { className: "evidence-law", text: item.law_name }) : null,
        element("p", { text: item.text }),
        element("div", { className: "evidence-footer" },
          element("span", { text: `연결된 확인 사항 ${linked.length}건` }),
          safeExternalLink(item.source_uri),
        ),
      ));
    }
    if (this.state.evidenceFocusId) {
      const focusedId = this.state.evidenceFocusId;
      queueMicrotask(() => scrollIntoViewIfAvailable(Array.from(this.root.querySelectorAll<HTMLElement>("[data-evidence-id]")).find(
        (item) => item.dataset.evidenceId === focusedId,
      )));
    }
    return element("section", { className: "surface evidence-surface", attributes: { "data-e2e": "evidence-content" } }, sectionHeading("법령 Evidence", "Agent가 Data Evidence API에서 받은 근거입니다."), evidence);
  }

  private createHistoryTab(): HTMLElement {
    const current = this.requireCase();
    const selectedRun = this.state.selectedRun;
    const timeline = element("ol", { className: "history-timeline" });
    for (const run of this.state.runs) {
      const relation = run.parent_review_run_id
        ? `정정 반영 자식 실행 · 부모 ${run.parent_review_run_id.slice(0, 10)}`
        : "기준 심사 실행";
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
        element("span", { text: `${display(run.assessment)} · 확인 사항 ${run.finding_count}건` }),
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
        sectionHeading("심사 이력", "원래 심사 결과를 덮어쓰지 않고, 승인된 정정 제안은 자식 심사 실행으로 남깁니다."),
        lineage,
        timeline,
        corrections,
      ),
      element("section", { className: "surface history-next" },
        sectionHeading("다음 작업", "문서 보완 또는 선택한 승인 정정 제안을 반영한 재심사를 진행할 수 있습니다."),
        element("p", { text: "대체 문서는 문서 탭에서 등록하십시오. 정정 제안은 승인돼도 원래 실행을 바꾸지 않으며, 선택한 항목만 새 자식 심사에 반영됩니다." }),
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
            title: canRevise ? undefined : "자식 심사 실행은 승인자 역할에서만 가능합니다.",
            "data-e2e": "revision-start",
          },
          on: { click: () => void this.startRevision().catch((error) => this.showError(error)) },
        }),
        !canRevise ? element("p", { className: "role-boundary-note", text: "승인자 역할에서 승인된 제안을 선택해 자식 심사를 실행할 수 있습니다." }) : null,
      ),
    );
  }

  private createRunLineage(run: ReviewRun): HTMLElement {
    const lines = element("ul", { className: "run-lineage" });
    if (run.parent_review_run_id) {
      lines.append(element("li", {},
        element("strong", { text: "부모 심사" }),
        element("button", { className: "text-link", text: run.parent_review_run_id, attributes: { type: "button" }, on: { click: () => void this.withBusy(async () => { await this.openRun(run.parent_review_run_id as string); await this.ensureCorrectionProposalsLoaded(); }) } }),
      ));
    } else {
      lines.append(element("li", {}, element("strong", { text: "기준 심사" }), element("span", { text: "이 실행은 이전 정정 제안을 반영한 자식 실행이 아닙니다." })));
    }
    if (run.applied_correction_proposal_ids?.length) {
      lines.append(element("li", {}, element("strong", { text: "반영된 정정 제안" }), element("span", { text: `${run.applied_correction_proposal_ids.length}건` })));
    }
    const childCount = this.state.runs.filter((item) => item.parent_review_run_id === run.review_run_id).length;
    if (childCount) lines.append(element("li", {}, element("strong", { text: "후속 자식 실행" }), element("span", { text: `${childCount}건` })));
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
        ? "제안 → 담당자 승인 또는 반려 → 승인된 항목 선택 → 자식 심사 실행의 순서로 진행됩니다."
        : "제안 → 담당자 승인 또는 반려 → 선택된 항목의 자식 심사 실행 순서로 진행됩니다."),
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
      ? element("button", { className: "text-link", text: "반영된 자식 심사 열기", attributes: { type: "button" }, on: { click: () => void this.withBusy(async () => { await this.openRun(proposal.applied_review_run_id as string); this.setRoute(this.requireCase().case_id, "analysis"); }) } })
      : null;
    const canSelectForRevision = this.hasRole("approver") && proposal.status === "approved" && !proposal.applied_review_run_id;
    const selectedForRevision = this.state.selectedCorrectionProposalIds.has(proposal.correction_proposal_id);
    const revisionSelection = canSelectForRevision
      ? this.createCorrectionProposalSelection(proposal, selectedForRevision)
      : null;
    return element("article", { className: `correction-proposal-card correction-proposal-card--${proposal.status}`, attributes: { "data-e2e": "correction-card" } },
      element("header", {}, element("span", { className: "correction-status", text: correctionStatusLabel(proposal.status) }), element("small", { text: formatDate(proposal.created_at) })),
      element("h4", { text: `${proposal.field_name}: ${proposal.new_value}${proposal.unit ? ` ${proposal.unit}` : ""}` }),
      element("p", { text: proposal.reason }),
      element("small", { text: `문서 ${proposal.document_id}${proposal.fact_id ? ` · 사실 ${proposal.fact_id}` : ""}` }),
      proposal.decision ? element("div", { className: "correction-decision" }, element("strong", { text: correctionStatusLabel(proposal.decision.status) }), element("p", { text: proposal.decision.reason }), proposal.decision.decided_at ? element("small", { text: formatDate(proposal.decision.decided_at) }) : null) : null,
      proposal.history.length ? element("ol", { className: "correction-history-list" }, ...proposal.history.map((entry) =>
        element("li", {},
          element("strong", { text: correctionHistoryLabel(entry.event) }),
          element("span", { text: entry.reason }),
          element("small", { text: `${entry.actor} · ${formatDate(entry.occurred_at)}` }),
        ),
      )) : null,
      decisionForm,
      decisionBoundary,
      revisionSelection,
      childLink,
    );
  }

  private createCorrectionProposalSelection(proposal: CorrectionProposal, selected: boolean): HTMLElement {
    const checkbox = element("input", {
      attributes: {
        type: "checkbox",
        "data-correction-proposal-id": proposal.correction_proposal_id,
        "data-e2e": "correction-select",
        "aria-label": `${proposal.field_name} 정정을 자식 심사에 반영`,
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
      element("span", { text: "이 정정을 자식 심사에 반영" }),
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
    element("a", { className: "brand-lockup", attributes: { href: "#/cases", "aria-label": "통관 AI 사전심사 Case 목록" } },
      element("span", { className: "brand-mark", text: "CA" }),
      element("span", {}, element("strong", { className: "brand", text: "통관 AI 사전심사" }), element("small", { text: mode === "functional-uat" ? "기능 UAT" : "팀 개발" })),
    ),
    element("div", { className: "user-block" },
      element("span", { text: session?.subject ?? "세션 확인 중" }),
      element("small", { text: `${session?.org_id ?? ""}${session?.roles.length ? ` · ${session.roles.join(", ")}` : ""}` }),
      roleSwitch,
      element("button", { className: "button button--quiet", text: "로그아웃", attributes: { type: "button" }, on: { click: onLogout } }),
    ),
  );
}

function createRuntimeNotice(mode: FrontendRuntimeMode): HTMLElement {
  const functional = mode === "functional-uat";
  return element("section", { className: "runtime-notice", attributes: { role: "status" } },
    element("strong", { text: functional ? "실제 기능 UAT" : "기본 개발" }),
    element("span", { text: functional
      ? "실제 관세 3법·Data 저장소·Claude를 사용합니다. 결과는 항상 담당자 검토 대상이며 배포·승인 판단이 아닙니다."
      : "합성 Evidence와 결정론 Agent를 사용합니다. Docker·모델·Law API·Claude 키 없이 전체 업무 흐름을 확인할 수 있습니다." }),
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

function emptyState(title: string, copy: string): HTMLElement {
  return element("section", { className: "surface empty-state" }, element("h2", { text: title }), element("p", { text: copy }));
}

function message(kind: "error" | "notice", text: string): HTMLElement {
  return element("section", { className: `notice notice--${kind}`, attributes: { role: kind === "error" ? "alert" : "status" } }, element("p", { text }));
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

function sourceForFinding(run: ReviewRun, finding: ReviewFinding): SourceReference | null {
  for (const analysis of run.document_analyses) {
    for (const fact of [...analysis.facts, ...analysis.line_items.flatMap((item) => item.facts)]) {
      if (finding.fact_ids.includes(fact.fact_id) && isDocumentSource(fact.source)) return fact.source;
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

function safeExternalLink(value: string): HTMLElement {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("unsupported URL");
    return element("a", { className: "text-link", text: "출처 열기", attributes: { href: url.href, target: "_blank", rel: "noopener noreferrer" } });
  } catch {
    return element("span", { className: "muted", text: "출처 URL을 표시할 수 없습니다." });
  }
}

function parseRoute(hash: string): { caseId: string | null; tab: WorkspaceTab } {
  const match = /^#\/cases\/([^/]+)(?:\/(documents|analysis|assistant|evidence|history))?$/u.exec(hash);
  if (!match) return { caseId: null, tab: "documents" };
  try {
    const caseId = decodeURIComponent(match[1] ?? "");
    return caseId ? { caseId, tab: (match[2] as WorkspaceTab | undefined) ?? "documents" } : { caseId: null, tab: "documents" };
  } catch {
    return { caseId: null, tab: "documents" };
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

function display(value: string): string {
  const labels: Record<string, string> = {
    open: "진행 전", in_review: "사람 검토 중", closed: "종료", queued: "대기", running: "처리 중", succeeded: "완료", failed: "실패",
    partial: "부분 완료", no_issue_detected: "주요 이슈 없음", issues_detected: "확인 사항 있음", indeterminate: "판단 보류",
    human_review_required: "사람 검토 필요", blocked: "차단됨", completed: "완료", skipped: "건너뜀", needs_review: "검토 필요",
  };
  return labels[value] ?? value;
}

function workflowLabel(value: string): string {
  const labels: Record<string, string> = {
    classify_documents: "문서 유형 판별", extract_facts: "문서 사실 추출", normalize_facts: "값 정규화", match_documents: "문서·품목 대응",
    validate_documents: "정합성 검사", reextract_documents: "제한 재추출", retrieve_evidence: "법령 Evidence 조회", generate_result: "검토 결과 생성",
  };
  return labels[value] ?? value;
}

function plannerActionLabel(value: string): string {
  const labels: Record<string, string> = {
    analyze_documents: "문서 분석",
    apply_human_corrections: "승인된 사람 수정 반영",
    compare_documents: "문서·품목 비교",
    reextract_documents: "제한 재추출",
    retrieve_evidence: "Evidence 일괄 조회",
    generate_report: "근거 기반 보고서 생성",
  };
  return labels[value] ?? value;
}

function reportSectionDescription(section: ReportSection["section"]): string {
  const labels: Record<ReportSection["section"], string> = {
    conclusion: "현재 심사 실행의 결론과 사람 검토 경계를 설명합니다.",
    execution_process: "실제로 수행한 제한형 Agent workflow를 설명합니다.",
    document_comparison: "문서·품목 대응과 코드 기반 비교 결과를 설명합니다.",
    issues_and_causes: "확인 사항과 판단 보류가 필요한 원인을 설명합니다.",
    legal_evidence: "연결된 Evidence가 어떤 근거인지 설명합니다.",
    impact: "현재 결과가 업무 검토에 미치는 영향을 설명합니다.",
    next_actions: "사람이 이어서 수행할 조치를 설명합니다.",
    limitations: "입력·근거·텍스트 범위의 한계를 설명합니다.",
  };
  return labels[section];
}

function groundedCitations(claim: ReportClaim): AssistantCitation[] {
  const citations: AssistantCitation[] = [
    ...claim.fact_ids.map((reference_id): AssistantCitation => ({ kind: "fact", reference_id })),
    ...claim.comparison_ids.map((reference_id): AssistantCitation => ({ kind: "comparison", reference_id })),
    ...claim.evidence_ids.map((reference_id): AssistantCitation => ({ kind: "evidence", reference_id })),
  ];
  const seen = new Set<string>();
  return citations.filter((citation) => {
    const key = `${citation.kind}:${citation.reference_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function documentAnalysisLabel(value: string): string {
  const labels: Record<string, string> = {
    invoice: "Commercial Invoice",
    packing_list: "Packing List",
    bill_of_lading: "Bill of Lading",
    certificate_of_origin: "Certificate of Origin",
    unknown: "문서 유형 확인 필요",
  };
  return labels[value] ?? value;
}

function assistantScopeLabel(value: NonNullable<AssistantMessage["answer_scope"]>): string {
  const labels: Record<NonNullable<AssistantMessage["answer_scope"]>, string> = {
    case_grounded: "Case 근거 답변",
    evidence_grounded: "Evidence 근거 답변",
    general_customs_guidance: "일반 통관 안내 · 사건 판단 아님",
    clarification_needed: "추가 확인 필요",
    insufficient_evidence: "근거 부족",
    out_of_scope: "답변 범위 밖",
  };
  return labels[value];
}

function citationLabel(citation: AssistantCitation): string {
  const labels: Record<AssistantCitation["kind"], string> = {
    fact: "문서 사실",
    comparison: "문서 비교",
    evidence: "Evidence",
  };
  return `${labels[citation.kind]} · ${citation.reference_id.slice(0, 18)}`;
}

function assistantSuggestions(run: ReviewRun, messages: AssistantMessage[]): string[] {
  const fromLatestAnswer = [...messages].reverse().find((item) => item.role === "assistant")?.suggested_questions ?? [];
  if (fromLatestAnswer.length) return fromLatestAnswer;
  const suggestions: string[] = [];
  if (run.findings.length) suggestions.push("가장 우선해서 확인할 항목과 그 근거를 알려줘");
  if (run.comparisons.length) suggestions.push("문서 간 비교에서 확인이 필요한 값은 무엇이야?");
  if (run.evidence.length) suggestions.push("연결된 법령 Evidence가 이 Case와 어떻게 관련되는지 알려줘");
  return suggestions.slice(0, 3);
}

function documentTypeLabel(value: DocumentType): string {
  const labels: Record<DocumentType, string> = { CI: "Commercial Invoice", PL: "Packing List", BL: "Bill of Lading", CO: "Certificate of Origin", UNKNOWN: "미분류" };
  return labels[value];
}

function severityLabel(value: ReviewFinding["severity"]): string {
  const labels: Record<ReviewFinding["severity"], string> = { critical: "긴급", high: "높음", medium: "보통", low: "낮음" };
  return labels[value];
}

function severityWeight(value: ReviewFinding["severity"]): number {
  return ({ critical: 4, high: 3, medium: 2, low: 1 })[value];
}

function comparisonStatusLabel(value: ReviewComparison["status"]): string {
  const labels: Record<ReviewComparison["status"], string> = { pass: "일치", skip: "비교 제외", mismatch: "불일치", needs_review: "검토 필요" };
  return labels[value];
}

function decisionStatusLabel(value: ReviewerDecision["status"]): string {
  const labels: Record<ReviewerDecision["status"], string> = { confirmed: "확인함", needs_information: "추가자료 요청", resolved: "해결됨" };
  return labels[value];
}

function correctionStatusLabel(value: CorrectionProposal["status"] | CorrectionDecision["status"]): string {
  const labels: Record<CorrectionProposal["status"] | CorrectionDecision["status"], string> = {
    proposed: "제안됨",
    approved: "승인됨",
    rejected: "반려됨",
  };
  return labels[value];
}

function correctionHistoryLabel(value: CorrectionProposal["history"][number]["event"]): string {
  const labels: Record<CorrectionProposal["history"][number]["event"], string> = {
    proposed: "제안 기록",
    approved: "승인",
    rejected: "반려",
    applied: "자식 심사 반영",
  };
  return labels[value];
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "확인 불가";
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function userMessage(error: unknown, fallback: string): string {
  return userFacingErrorMessage(error, fallback);
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
  options: { type?: string; required?: boolean; maxLength?: number; placeholder?: string; value?: string; accept?: string; ariaLabel?: string; onInput?: EventListener } = {},
): HTMLInputElement {
  return element("input", {
    attributes: {
      name, type: options.type ?? "text", required: options.required ? "" : undefined,
      maxlength: options.maxLength === undefined ? undefined : String(options.maxLength), placeholder: options.placeholder,
      value: options.value, accept: options.accept, "aria-label": options.ariaLabel,
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

function select(name: string, options: ReadonlyArray<readonly [string, string]>, value?: string, onChange?: EventListener): HTMLSelectElement {
  const node = element("select", { attributes: { name }, ...(onChange ? { on: { change: onChange } } : {}) });
  for (const [optionValue, label] of options) node.append(element("option", { text: label, attributes: { value: optionValue, selected: value === optionValue ? "" : undefined } }));
  return node;
}

function field(label: string, control: HTMLElement): HTMLElement {
  return element("label", { className: "field" }, element("span", { className: "field__label", text: label }), control);
}

function submit(label: string, disabled: boolean): HTMLButtonElement {
  return element("button", { className: "button button--secondary", text: label, attributes: { type: "submit", disabled: disabled ? "" : undefined } });
}
