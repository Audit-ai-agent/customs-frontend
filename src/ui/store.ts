import type { ApiClient } from "../api/v1/client";
import type {
  AssistantConversation,
  AssistantCitation,
  AssistantCorrectionDraft,
  AssistantMessage,
  CaseDetail,
  CaseDocument,
  CaseSummary,
  CorrectionProposal,
  CreateCorrectionProposalRequest,
  DocumentAsset,
  DocumentAssetMediaType,
  DocumentType,
  DutyAssessment,
  ExtractionJob,
  FindingDecisionRequest,
  HsClassification,
  JobRecord,
  OriginVerification,
  ReviewComparison,
  ReviewerDecision,
  ReviewFinding,
  ReviewRun,
  ReviewRunSummary,
  Session,
  SourceReference,
} from "../api/v1/types";
import { isDocumentSource } from "../api/v1/types";
import {
  supportsDevelopmentRoleSwitch,
  type BrowserSession,
  type LocalDevelopmentActor,
} from "../auth";
import {
  ACTIVE_JOB_STATES,
  DOCUMENT_TYPES,
  STAGE_IDS,
  parseRoute,
  type CaseFilter,
  type CaseSortKey,
  type FontScale,
  type FrontendRuntimeMode,
  type StageView,
  type WorkspaceView,
} from "./constants";
import {
  findFact,
  mergeAssistantMessages,
  severityWeight,
  sourceForFinding,
  sourceForOperand,
  userMessage,
} from "./labels";

/** One uploaded binary and its latest extraction job, keyed for the upload panel. */
export interface AssetWorkbenchEntry {
  /** True once this session confirmed the extracted text into a document. */
  confirmed?: boolean;
  asset: DocumentAsset;
  extraction: ExtractionJob | null;
  extracting: boolean;
}

export interface WorkbenchState {
  session: Session | null;
  cases: CaseSummary[];
  selectedCase: CaseDetail | null;
  documents: CaseDocument[];
  documentAssets: AssetWorkbenchEntry[];
  uploadingAsset: boolean;
  runs: ReviewRunSummary[];
  selectedRun: ReviewRun | null;
  selectedDocument: (CaseDocument & { content_text: string }) | null;
  sourceFocus: SourceReference | null;
  factFocusId: string | null;
  activeJob: JobRecord | null;
  activeView: WorkspaceView;
  documentModalOpen: boolean;
  traceRailOpen: boolean;
  caseSort: { key: CaseSortKey; ascending: boolean };
  comparisonFocusId: string | null;
  evidenceFocusId: string | null;
  findingFocusId: string | null;
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
  selectedCorrectionProposalIds: ReadonlySet<string>;
  hsClassification: HsClassification | null;
  hsLoadedRunId: string | null;
  hsLoading: boolean;
  hsError: string | null;
  originVerification: OriginVerification | null;
  originLoadedRunId: string | null;
  originLoading: boolean;
  originError: string | null;
  dutyAssessment: DutyAssessment | null;
  dutyLoadedRunId: string | null;
  dutyLoading: boolean;
  dutyError: string | null;
  caseFilter: CaseFilter;
  query: string;
  fontScale: FontScale;
  createCaseOpen: boolean;
  busy: boolean;
  notice: string | null;
  error: string | null;
}

export interface AddDocumentInput {
  documentType: DocumentType;
  filename: string;
  contentText: string;
  file: File | null;
  replacesDocumentId: string;
}

const INITIAL_STATE: WorkbenchState = {
  session: null,
  cases: [],
  selectedCase: null,
  documents: [],
  documentAssets: [],
  uploadingAsset: false,
  runs: [],
  selectedRun: null,
  selectedDocument: null,
  sourceFocus: null,
  factFocusId: null,
  activeJob: null,
  activeView: "documents",
  findingFocusId: null,
  documentModalOpen: false,
  traceRailOpen: true,
  caseSort: { key: "updated", ascending: false },
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
  selectedCorrectionProposalIds: new Set<string>(),
  hsClassification: null,
  hsLoadedRunId: null,
  hsLoading: false,
  hsError: null,
  originVerification: null,
  originLoadedRunId: null,
  originLoading: false,
  originError: null,
  dutyAssessment: null,
  dutyLoadedRunId: null,
  dutyLoading: false,
  dutyError: null,
  caseFilter: "all",
  query: "",
  fontScale: 1,
  createCaseOpen: false,
  busy: false,
  notice: null,
  error: null,
};

/** Fields cleared whenever the selected review run changes. */
const RUN_ATTACHMENT_RESET = {
  comparisonFocusId: null,
  evidenceFocusId: null,
  findingFocusId: null,
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
  selectedCorrectionProposalIds: new Set<string>(),
  hsClassification: null,
  hsLoadedRunId: null,
  hsLoading: false,
  hsError: null,
  originVerification: null,
  originLoadedRunId: null,
  originLoading: false,
  originError: null,
  dutyAssessment: null,
  dutyLoadedRunId: null,
  dutyLoading: false,
  dutyError: null,
} satisfies Partial<WorkbenchState>;

/**
 * Browser-only case workspace state. It consumes only the Backend v1 API and makes
 * no direct Agent, Data, database, or provider request. React subscribes to this
 * store through useSyncExternalStore; the store itself has no view dependency.
 */
export class WorkbenchStore {
  private state: WorkbenchState = INITIAL_STATE;
  private readonly listeners = new Set<() => void>();
  private jobTimer: number | null = null;
  private destroyed = false;
  private readonly hashChange = () => void this.followRoute();

  constructor(
    private readonly api: ApiClient,
    private readonly auth: BrowserSession,
    readonly mode: FrontendRuntimeMode,
  ) {}

  /* ── external store plumbing ─────────────────────────────────── */

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): WorkbenchState => this.state;

  private patch(next: Partial<WorkbenchState>): void {
    if (this.destroyed) return;
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }

  /* ── lifecycle ───────────────────────────────────────────────── */

  async start(): Promise<void> {
    if (!this.auth.isAuthenticated()) throw new Error("브라우저 인증 세션을 시작하지 못했습니다.");
    // The main workbench home is the default landing: an absent or unknown
    // hash becomes the explicit dashboard route. A deep link into a case is
    // still honored so reloading mid-review does not lose the place.
    if (parseRoute(window.location.hash).caseId === null && window.location.hash !== "#/cases") {
      history.replaceState(null, "", "#/cases");
    }
    window.addEventListener("hashchange", this.hashChange);
    await this.withBusy(async () => {
      this.patch({ session: await this.api.getSession() });
      await this.refreshCases();
      await this.followRoute();
    });
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener("hashchange", this.hashChange);
    if (this.jobTimer !== null) window.clearTimeout(this.jobTimer);
    this.jobTimer = null;
    this.listeners.clear();
  }

  /* ── derived reads ───────────────────────────────────────────── */

  hasRole(role: "reviewer" | "approver"): boolean {
    return this.state.session?.roles.includes(role) ?? false;
  }

  canSwitchRole(): boolean {
    return this.mode === "local-development" && supportsDevelopmentRoleSwitch(this.auth);
  }

  activeDocuments(): CaseDocument[] {
    return this.state.documents.filter((document) => !document.superseded_by_document_id);
  }

  /** Findings the reviewer has not recorded a judgement for yet. */
  openFindings(): ReviewFinding[] {
    const run = this.state.selectedRun;
    if (!run) return [];
    const decided = new Set(run.reviewer_decisions.map((decision) => decision.finding_id));
    return run.findings.filter((finding) => !decided.has(finding.finding_id));
  }

  /** Completion reflects real progress in the case, not merely where the user is standing. */
  stageComplete(stage: StageView): boolean {
    const run = this.state.selectedRun;
    switch (stage) {
      case "documents": return this.activeDocuments().length > 0;
      case "crosscheck": return run !== null;
      case "review": return run !== null && this.openFindings().length === 0;
      case "duty": return run !== null && this.state.dutyAssessment?.status === "estimated";
      default: return false;
    }
  }

  caseCounts(): Record<CaseFilter, number> {
    return {
      all: this.state.cases.length,
      open: this.state.cases.filter((item) => item.status === "open").length,
      in_review: this.state.cases.filter((item) => item.status === "in_review").length,
      closed: this.state.cases.filter((item) => item.status === "closed").length,
    };
  }

  visibleCases(): CaseSummary[] {
    const keyword = this.state.query.trim().toLocaleLowerCase();
    const rows = this.state.cases.filter((item) => {
      const matchesFilter = this.state.caseFilter === "all" || item.status === this.state.caseFilter;
      const candidate = `${item.title} ${item.external_reference ?? ""} ${item.case_id}`.toLocaleLowerCase();
      return matchesFilter && candidate.includes(keyword);
    });
    const { key, ascending } = this.state.caseSort;
    const direction = ascending ? 1 : -1;
    return [...rows].sort((left, right) => {
      const compared = key === "updated"
        ? left.updated_at.localeCompare(right.updated_at)
        : (left.external_reference ?? left.case_id).localeCompare(right.external_reference ?? right.case_id);
      return compared * direction;
    });
  }

  eligibleCorrectionProposals(): CorrectionProposal[] {
    return this.state.correctionProposals.filter((proposal) => proposal.status === "approved" && !proposal.applied_review_run_id);
  }

  selectedEligibleCorrectionProposalIds(): string[] {
    const eligible = new Set(this.eligibleCorrectionProposals().map((proposal) => proposal.correction_proposal_id));
    return [...this.state.selectedCorrectionProposalIds].filter((proposalId) => eligible.has(proposalId));
  }

  /* ── view state ──────────────────────────────────────────────── */

  setFontScale(scale: FontScale): void {
    if (this.state.fontScale === scale) return;
    this.patch({ fontScale: scale });
  }

  setCaseFilter(filter: CaseFilter): void {
    this.patch({ caseFilter: filter });
  }

  setQuery(value: string): void {
    this.patch({ query: value });
  }

  toggleCaseSort(key: CaseSortKey): void {
    const current = this.state.caseSort;
    this.patch({ caseSort: { key, ascending: current.key === key ? !current.ascending : true } });
  }

  setTraceRailOpen(open: boolean): void {
    this.patch({ traceRailOpen: open });
  }

  setCreateCaseOpen(open: boolean): void {
    this.patch({ createCaseOpen: open });
  }

  updateAssistantDraft(value: string): void {
    this.patch({ assistantDraft: value.slice(0, 4_000) });
  }

  dismissNotice(): void {
    this.patch({ notice: null });
  }

  dismissError(): void {
    this.patch({ error: null });
  }

  showError(error: unknown): void {
    this.patch({ error: userMessage(error, "요청을 처리하지 못했습니다.") });
  }

  /* ── routing ─────────────────────────────────────────────────── */

  setRoute(caseId: string | null, view: WorkspaceView = "documents"): void {
    const target = caseId === null ? "/cases" : `/cases/${encodeURIComponent(caseId)}/${view}`;
    if (window.location.hash !== `#${target}`) {
      window.location.hash = target;
      return;
    }
    void this.followRoute();
  }

  /** Mockup shortcuts: `1`–`4` and arrows move between stages. */
  moveStage(delta: number): void {
    const current = this.state.selectedCase;
    if (!current) return;
    const index = STAGE_IDS.indexOf(this.state.activeView as StageView);
    if (index < 0) return;
    const next = STAGE_IDS[index + delta];
    if (next) this.setRoute(current.case_id, next);
  }

  goToStageNumber(step: number): void {
    const current = this.state.selectedCase;
    const stage = STAGE_IDS[step - 1];
    if (current && stage) this.setRoute(current.case_id, stage);
  }

  private async followRoute(): Promise<void> {
    const route = parseRoute(window.location.hash);
    if (route.caseId === null) {
      this.patch({
        selectedCase: null,
        documents: [],
        runs: [],
        selectedRun: null,
        selectedDocument: null,
        sourceFocus: null,
        factFocusId: null,
        documentModalOpen: false,
        ...RUN_ATTACHMENT_RESET,
        selectedCorrectionProposalIds: new Set<string>(),
      });
      return;
    }
    // A route change is a navigation: the source overlay must not survive it.
    this.patch({
      ...(this.state.activeView !== route.view ? { documentModalOpen: false } : {}),
      activeView: route.view,
    });
    if (this.state.selectedCase?.case_id !== route.caseId) await this.loadCase(route.caseId);
    if (route.view === "assistant") await this.ensureAssistantLoaded();
    if (route.view === "history") await this.ensureCorrectionProposalsLoaded();
    if (route.view === "documents") await this.ensureHsClassificationLoaded();
    if (route.view === "crosscheck") await this.ensureOriginVerificationLoaded();
    if (route.view === "duty") await this.ensureDutyAssessmentLoaded();
  }

  /* ── session ─────────────────────────────────────────────────── */

  async switchDevelopmentActor(actor: LocalDevelopmentActor): Promise<void> {
    const session = this.auth;
    if (this.mode !== "local-development" || !supportsDevelopmentRoleSwitch(session)) return;
    if (this.hasRole(actor)) return;
    await this.withBusy(async () => {
      await session.switchActor(actor);
      this.patch({ session: await this.api.getSession() });
      const currentCaseId = this.state.selectedCase?.case_id;
      await this.refreshCases();
      if (currentCaseId) await this.loadCase(currentCaseId);
      // loadCase drops the per-run attachments, so the current view must reload its own.
      if (this.state.activeView === "assistant") await this.ensureAssistantLoaded();
      if (this.state.activeView === "history") await this.ensureCorrectionProposalsLoaded();
      this.patch({
        notice: actor === "approver"
          ? "로컬 승인자 세션으로 전환했습니다. 제안 승인·반려와 자식 심사만 수행할 수 있습니다."
          : "로컬 심사자 세션으로 전환했습니다. 문서·심사·판단·정정 제안을 기록할 수 있습니다.",
      });
    });
  }

  logout(): void {
    void this.auth.logout();
  }

  /* ── cases ───────────────────────────────────────────────────── */

  private async refreshCases(): Promise<void> {
    this.patch({ cases: (await this.api.listCases()).items });
  }

  async openCase(caseId: string, view: WorkspaceView = "documents"): Promise<void> {
    await this.withBusy(async () => {
      await this.loadCase(caseId);
      this.patch({ activeView: view });
      this.setRoute(caseId, view);
    });
  }

  private async loadCase(caseId: string): Promise<void> {
    const [caseDetail, documents, assets, runSummaries] = await Promise.all([
      this.api.getCase(caseId),
      this.api.listDocuments(caseId),
      this.api.listDocumentAssets(caseId),
      this.api.listReviewRuns(caseId),
    ]);
    // The Backend does not return extraction state on the asset list, so a
    // same-case reload keeps what this session already knows — otherwise a
    // confirmed upload would fall back to "추출 전" with a rerun button.
    const knownEntries = this.state.selectedCase?.case_id === caseId ? this.state.documentAssets : [];
    this.patch({
      selectedCase: caseDetail,
      documents,
      documentAssets: assets.map((asset) => {
        const known = knownEntries.find((entry) => entry.asset.asset_id === asset.asset_id);
        return known ? { ...known, asset } : { asset, extraction: null, extracting: false, confirmed: false };
      }),
      uploadingAsset: false,
      runs: runSummaries,
      selectedRun: null,
      selectedDocument: null,
      sourceFocus: null,
      factFocusId: null,
      activeJob: null,
      ...RUN_ATTACHMENT_RESET,
      selectedCorrectionProposalIds: new Set<string>(),
    });
    if (runSummaries[0]) await this.openRun(runSummaries[0].review_run_id);
  }

  async openRun(runId: string): Promise<void> {
    if (this.state.selectedRun?.review_run_id !== runId) {
      this.patch({ ...RUN_ATTACHMENT_RESET, selectedCorrectionProposalIds: new Set<string>() });
    }
    const run = await this.api.getReviewRun(runId);
    if (run.case_id !== this.state.selectedCase?.case_id) {
      throw new Error("심사 결과가 현재 Case에 속하지 않습니다.");
    }
    this.patch({ selectedRun: run });
  }

  async selectRun(runId: string): Promise<void> {
    await this.withBusy(async () => {
      await this.openRun(runId);
      await this.ensureCorrectionProposalsLoaded();
    });
  }

  async createCase(input: { title: string; reference: string }): Promise<void> {
    if (!this.hasRole("reviewer")) {
      this.showError(new Error("Case 등록은 심사자 역할에서만 할 수 있습니다."));
      return;
    }
    if (!input.title) {
      this.showError(new Error("Case 제목을 입력해 주십시오."));
      return;
    }
    await this.withBusy(async () => {
      const created = await this.api.createCase({ title: input.title, external_reference: input.reference || null });
      await this.refreshCases();
      await this.loadCase(created.case_id);
      this.patch({
        activeView: "documents",
        createCaseOpen: false,
        notice: "새 Case를 만들었습니다. 원본 파일을 올리거나 텍스트 문서를 등록해 심사를 시작할 수 있습니다.",
      });
      this.setRoute(created.case_id, "documents");
    });
  }

  /* ── documents ───────────────────────────────────────────────── */

  async addDocument(input: AddDocumentInput): Promise<void> {
    if (!this.hasRole("reviewer")) {
      this.showError(new Error("문서 등록과 보완은 심사자 역할에서만 할 수 있습니다."));
      return;
    }
    const current = this.state.selectedCase;
    if (!current) {
      this.showError(new Error("먼저 Case를 선택해 주십시오."));
      return;
    }
    await this.withBusy(async () => {
      if (!DOCUMENT_TYPES.includes(input.documentType)) throw new Error("허용되지 않은 문서 유형입니다.");
      let content = input.contentText;
      let filename = input.filename;
      if (!content.trim() && input.file) {
        if (!input.file.name.toLocaleLowerCase().endsWith(".txt")) throw new Error("텍스트(.txt) 파일만 읽을 수 있습니다.");
        content = await input.file.text();
        if (!filename) filename = input.file.name;
      }
      if (!content.trim()) throw new Error("문서 원문을 붙여넣거나 .txt 파일을 선택하십시오.");
      if (!filename.toLocaleLowerCase().endsWith(".txt")) throw new Error("텍스트 문서는 .txt 파일명으로 등록하십시오.");
      await this.api.addDocument(current.case_id, {
        document_type: input.documentType,
        filename,
        media_type: "text/plain",
        content_text: content,
        ...(input.replacesDocumentId ? { replaces_document_id: input.replacesDocumentId } : {}),
      });
      await this.loadCase(current.case_id);
      this.patch({
        notice: input.replacesDocumentId
          ? "보완 문서를 등록했습니다. 이전 문서는 새 심사 입력에서 제외됩니다."
          : "텍스트 문서를 등록했습니다.",
      });
    });
  }

  /* ── binary upload and the extraction preview (HITL) ─────────── */

  private patchAssetEntry(assetId: string, update: Partial<AssetWorkbenchEntry>): void {
    this.patch({
      documentAssets: this.state.documentAssets.map((entry) =>
        entry.asset.asset_id === assetId ? { ...entry, ...update } : entry,
      ),
    });
  }

  /** Uploads one PDF/JPEG/PNG source file, then runs its extraction preview. */
  async uploadDocumentAsset(input: { documentType: DocumentType; file: File }): Promise<void> {
    if (!this.hasRole("reviewer")) {
      this.showError(new Error("서류 파일 업로드는 심사자 역할에서만 할 수 있습니다."));
      return;
    }
    const current = this.state.selectedCase;
    if (!current) return;
    const mediaType = assetMediaType(input.file);
    if (!mediaType) {
      this.showError(new Error("PDF·JPG·PNG 파일만 업로드할 수 있습니다."));
      return;
    }
    this.patch({ uploadingAsset: true, error: null });
    try {
      const asset = await this.api.addDocumentAsset(current.case_id, {
        documentType: input.documentType,
        filename: input.file.name,
        mediaType,
        body: input.file,
      });
      this.patch({
        documentAssets: [{ asset, extraction: null, extracting: false }, ...this.state.documentAssets],
        notice: "원본 파일을 등록했습니다. 자동 추출을 실행한 뒤 추출 텍스트를 검수해 확정하십시오.",
      });
      await this.runExtraction(asset.asset_id);
    } catch (error) {
      this.patch({ error: userMessage(error, "서류 파일을 업로드하지 못했습니다.") });
    } finally {
      this.patch({ uploadingAsset: false });
    }
  }

  /** Starts (or polls) the Agent extraction preview for one uploaded file. */
  async runExtraction(assetId: string): Promise<void> {
    const current = this.state.selectedCase;
    const entry = this.state.documentAssets.find((item) => item.asset.asset_id === assetId);
    if (!current || !entry || entry.extracting) return;
    this.patchAssetEntry(assetId, { extracting: true });
    try {
      let envelope = await this.api.startExtraction(current.case_id, assetId);
      let attempts = 0;
      while (envelope.job.status === "queued" && attempts < 30 && !this.destroyed) {
        await delay(700);
        envelope = await this.api.getExtraction(current.case_id, assetId, envelope.job.extraction_job_id);
        attempts += 1;
      }
      this.patchAssetEntry(assetId, { extraction: envelope.job });
      if (envelope.job.status === "unavailable") {
        this.patch({
          notice:
            "이 파일에는 읽을 수 있는 텍스트 레이어가 없어 자동 추출을 제공하지 않습니다. 아래 텍스트 등록 양식으로 원문을 직접 등록하십시오.",
        });
      }
    } catch (error) {
      this.patch({ error: userMessage(error, "자동 추출을 실행하지 못했습니다.") });
    } finally {
      this.patchAssetEntry(assetId, { extracting: false });
    }
  }

  /** Human-confirmed extracted text becomes a normal text document for review. */
  async confirmExtractedText(input: {
    assetId: string;
    extractionJobId: string;
    contentText: string;
    filename: string;
  }): Promise<void> {
    if (!this.hasRole("reviewer")) {
      this.showError(new Error("추출 텍스트 확정은 심사자 역할에서만 할 수 있습니다."));
      return;
    }
    const current = this.state.selectedCase;
    if (!current) return;
    await this.withBusy(async () => {
      await this.api.confirmExtractedText(current.case_id, input.assetId, {
        extraction_job_id: input.extractionJobId,
        content_text: input.contentText,
        filename: input.filename,
      });
      this.patchAssetEntry(input.assetId, { confirmed: true });
      await this.loadCase(current.case_id);
      this.patch({
        notice: "검수한 추출 텍스트를 문서로 등록했습니다. 활성 문서가 준비되면 AI 심사를 시작할 수 있습니다.",
      });
    });
  }

  async openDocumentModal(documentId: string, source: SourceReference | null = null): Promise<void> {
    const current = this.state.selectedCase;
    if (!current) return;
    await this.withBusy(async () => {
      const document = await this.api.getDocumentContent(current.case_id, documentId);
      this.patch({ selectedDocument: document, sourceFocus: source, documentModalOpen: true });
    });
  }

  closeDocumentModal(): void {
    this.patch({ documentModalOpen: false });
  }

  /** Citations open the source overlay in place instead of navigating away. */
  async focusSource(source: SourceReference): Promise<void> {
    this.patch({ factFocusId: null });
    await this.openDocumentModal(source.document_id, source);
  }

  focusFact(factId: string): void {
    const current = this.state.selectedCase;
    this.patch({ factFocusId: factId });
    if (current) this.setRoute(current.case_id, "crosscheck");
  }

  focusEvidence(evidenceId: string): void {
    const current = this.state.selectedCase;
    this.patch({ evidenceFocusId: evidenceId });
    if (current) this.setRoute(current.case_id, "review");
  }

  focusFinding(findingId: string): void {
    const current = this.state.selectedCase;
    this.patch({ findingFocusId: findingId });
    if (current) this.setRoute(current.case_id, "review");
  }

  async focusComparison(comparison: ReviewComparison): Promise<void> {
    const run = this.state.selectedRun;
    if (!run) return;
    const source = sourceForOperand(run, comparison.left) ?? sourceForOperand(run, comparison.right);
    if (source) await this.focusSource(source);
  }

  /* ── review runs ─────────────────────────────────────────────── */

  async startReview(): Promise<void> {
    if (!this.hasRole("reviewer")) {
      this.showError(new Error("AI 심사 실행은 심사자 역할에서만 할 수 있습니다."));
      return;
    }
    const current = this.state.selectedCase;
    if (!current) return;
    if (!this.activeDocuments().length) {
      this.showError(new Error("심사를 시작하려면 활성 텍스트 문서를 하나 이상 등록해야 합니다."));
      return;
    }
    await this.withBusy(async () => {
      const job = await this.api.enqueueReview(current.case_id, { trade_type: "import" }, crypto.randomUUID());
      this.patch({ activeJob: job });
      if (job.status === "succeeded") {
        await this.showSucceededReview(job);
      } else {
        this.patch({ notice: "심사를 요청했습니다. 완료 상태가 확인되면 결과를 표시합니다." });
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
      this.patch({ activeJob: job });
      if (ACTIVE_JOB_STATES.has(job.status)) this.scheduleJobPoll(job);
      else if (job.status === "succeeded") await this.showSucceededReview(job);
      else this.patch({ error: "심사가 완료되지 않았습니다. Job 상태와 서비스 로그를 확인하십시오." });
    } catch (error) {
      this.patch({ error: userMessage(error, "Job 상태를 확인하지 못했습니다.") });
    }
  }

  private async showSucceededReview(job: JobRecord): Promise<void> {
    await this.loadCase(job.case_id);
    await this.openRun(job.review_run_id);
    this.patch({
      activeView: "review",
      notice: "심사가 완료되었습니다. 결과는 자동 승인되지 않으며 담당자 검토가 필요합니다.",
    });
    this.setRoute(job.case_id, "review");
  }

  async decideFinding(findingId: string, decision: { status: FindingDecisionRequest["status"]; reason: string }): Promise<void> {
    if (!this.hasRole("reviewer")) {
      this.showError(new Error("확인 사항 판단은 심사자 역할에서만 기록할 수 있습니다."));
      return;
    }
    const run = this.state.selectedRun;
    if (!run) return;
    await this.withBusy(async () => {
      const recorded = await this.api.setFindingDecision(run.review_run_id, findingId, decision);
      this.mergeDecision(recorded);
      this.patch({ notice: "기록했습니다." });
    });
  }

  private mergeDecision(decision: ReviewerDecision): void {
    const run = this.state.selectedRun;
    if (!run) return;
    this.patch({
      selectedRun: {
        ...run,
        reviewer_decisions: [
          ...run.reviewer_decisions.filter((item) => item.finding_id !== decision.finding_id),
          decision,
        ],
      },
    });
  }

  /** The finding whose severity most deserves attention among the undecided ones. */
  highestOpenFinding(): ReviewFinding | undefined {
    return [...this.openFindings()].sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity))[0];
  }

  sourceForFinding(finding: ReviewFinding): SourceReference | null {
    const run = this.state.selectedRun;
    return run ? sourceForFinding(run, finding) : null;
  }

  /* ── assistant ───────────────────────────────────────────────── */

  private async ensureAssistantLoaded(): Promise<void> {
    const run = this.state.selectedRun;
    if (!run || this.state.assistantLoadedRunId === run.review_run_id || this.state.assistantLoading) return;
    this.patch({ assistantLoading: true, assistantError: null });
    try {
      const conversations = await this.api.listAssistantConversations(run.review_run_id);
      const selected = conversations[0] ?? null;
      this.patch({
        assistantConversations: conversations,
        selectedConversation: selected,
        assistantMessages: selected ? await this.api.listAssistantMessages(selected.conversation_id) : [],
        assistantLoadedRunId: run.review_run_id,
      });
    } catch (error) {
      this.patch({ assistantError: userMessage(error, "AI 도우미 대화를 불러오지 못했습니다.") });
    } finally {
      this.patch({ assistantLoading: false });
    }
  }

  reloadAssistant(): void {
    this.patch({ assistantLoadedRunId: null });
    void this.ensureAssistantLoaded();
  }

  async selectAssistantConversation(conversation: AssistantConversation): Promise<void> {
    if (this.state.assistantLoading || this.state.assistantSending) return;
    this.patch({ assistantLoading: true, assistantError: null });
    try {
      const messages = await this.api.listAssistantMessages(conversation.conversation_id);
      this.patch({ selectedConversation: conversation, assistantMessages: messages });
    } catch (error) {
      this.patch({ assistantError: userMessage(error, "선택한 대화를 열지 못했습니다.") });
    } finally {
      this.patch({ assistantLoading: false });
    }
  }

  async createAssistantConversation(): Promise<void> {
    const run = this.state.selectedRun;
    if (!run || this.state.assistantLoading || this.state.assistantSending) return;
    this.patch({ assistantLoading: true, assistantError: null });
    try {
      const conversation = await this.api.createAssistantConversation(run.review_run_id);
      this.patch({
        assistantConversations: [conversation, ...this.state.assistantConversations],
        selectedConversation: conversation,
        assistantMessages: [],
        assistantLoadedRunId: run.review_run_id,
        assistantDraft: "",
        assistantRetryContent: null,
        assistantRetryIdempotencyKey: null,
      });
    } catch (error) {
      this.patch({ assistantError: userMessage(error, "새 AI 도우미 대화를 만들지 못했습니다.") });
    } finally {
      this.patch({ assistantLoading: false });
    }
  }

  async sendAssistantMessage(content: string, idempotencyKey: string = crypto.randomUUID()): Promise<void> {
    const text = content.trim();
    if (!text || this.state.assistantSending || this.state.assistantLoading) return;
    const run = this.state.selectedRun;
    if (!run) return;
    this.patch({ assistantSending: true, assistantError: null });
    try {
      let conversation = this.state.selectedConversation;
      if (!conversation) {
        conversation = await this.api.createAssistantConversation(run.review_run_id, { title: text.slice(0, 80) });
        this.patch({
          assistantConversations: [conversation, ...this.state.assistantConversations],
          selectedConversation: conversation,
        });
      }
      const exchange = await this.api.sendAssistantMessage(conversation.conversation_id, { content: text }, idempotencyKey);
      this.patch({
        assistantMessages: mergeAssistantMessages(this.state.assistantMessages, exchange.user_message, exchange.assistant_message),
        assistantDraft: "",
        assistantRetryContent: null,
        assistantRetryIdempotencyKey: null,
      });
    } catch (error) {
      this.patch({
        assistantDraft: text,
        assistantRetryContent: text,
        assistantRetryIdempotencyKey: idempotencyKey,
        assistantError: userMessage(error, "AI 도우미 답변을 받지 못했습니다. 질문은 그대로 보존했습니다."),
      });
    } finally {
      this.patch({ assistantSending: false });
    }
  }

  retryAssistantMessage(): void {
    const retry = this.state.assistantRetryContent;
    const idempotencyKey = this.state.assistantRetryIdempotencyKey;
    if (retry && idempotencyKey) void this.sendAssistantMessage(retry, idempotencyKey);
  }

  /** Citations jump to the fact, comparison, or evidence the answer was grounded on. */
  async openGroundedCitation(citation: AssistantCitation): Promise<void> {
    const run = this.state.selectedRun;
    const current = this.state.selectedCase;
    if (!run || !current) return;
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
      this.patch({ comparisonFocusId: comparison.comparison_id });
      this.setRoute(current.case_id, "crosscheck");
      return;
    }
    if (!run.evidence.some((item) => item.evidence_id === citation.reference_id)) {
      throw new Error("이 답변의 Evidence를 찾지 못했습니다.");
    }
    this.focusEvidence(citation.reference_id);
  }

  /* ── Backend-derived trade views (HSK / CO / duty) ───────────── */

  private async ensureHsClassificationLoaded(): Promise<void> {
    const run = this.state.selectedRun;
    if (!run || this.state.hsLoadedRunId === run.review_run_id || this.state.hsLoading) return;
    this.patch({ hsLoading: true, hsError: null });
    try {
      const view = await this.api.getHsClassification(run.review_run_id);
      this.patch({ hsClassification: view, hsLoadedRunId: run.review_run_id });
    } catch (error) {
      this.patch({ hsError: userMessage(error, "HSK 분류 후보를 불러오지 못했습니다.") });
    } finally {
      this.patch({ hsLoading: false });
    }
  }

  private async ensureOriginVerificationLoaded(): Promise<void> {
    const run = this.state.selectedRun;
    if (!run || this.state.originLoadedRunId === run.review_run_id || this.state.originLoading) return;
    this.patch({ originLoading: true, originError: null });
    try {
      const view = await this.api.getOriginVerification(run.review_run_id);
      this.patch({ originVerification: view, originLoadedRunId: run.review_run_id });
    } catch (error) {
      this.patch({ originError: userMessage(error, "원산지 검증 결과를 불러오지 못했습니다.") });
    } finally {
      this.patch({ originLoading: false });
    }
  }

  private async ensureDutyAssessmentLoaded(): Promise<void> {
    const run = this.state.selectedRun;
    if (!run || this.state.dutyLoadedRunId === run.review_run_id || this.state.dutyLoading) return;
    this.patch({ dutyLoading: true, dutyError: null });
    try {
      const view = await this.api.getDutyAssessment(run.review_run_id);
      this.patch({ dutyAssessment: view, dutyLoadedRunId: run.review_run_id });
    } catch (error) {
      this.patch({ dutyError: userMessage(error, "관세 진단을 불러오지 못했습니다.") });
    } finally {
      this.patch({ dutyLoading: false });
    }
  }

  /** True when the latest run exists and every finding carries a decision. */
  caseClosable(): boolean {
    const current = this.state.selectedCase;
    return (
      current !== null &&
      current.status !== "closed" &&
      this.state.selectedRun !== null &&
      this.openFindings().length === 0
    );
  }

  async closeCase(disposition: "cleared" | "returned", reason: string): Promise<void> {
    if (!this.hasRole("reviewer")) {
      this.showError(new Error("심사 종료는 심사자 역할에서만 할 수 있습니다."));
      return;
    }
    const current = this.state.selectedCase;
    if (!current) return;
    await this.withBusy(async () => {
      const closed = await this.api.closeCase(current.case_id, { disposition, reason });
      this.patch({
        selectedCase: closed,
        cases: this.state.cases.map((item) => (item.case_id === closed.case_id ? closed : item)),
        notice: disposition === "cleared"
          ? "심사를 종료했습니다. 이 Case는 검토 종결 상태로 기록되었습니다."
          : "심사를 종료했습니다. 이 Case는 반려·보완 요청 상태로 기록되었습니다.",
      });
    });
  }

  async recordHsSelection(code: string, reason: string): Promise<void> {
    if (!this.hasRole("reviewer")) {
      this.showError(new Error("HSK 분류 확정은 심사자 역할에서만 할 수 있습니다."));
      return;
    }
    const run = this.state.selectedRun;
    if (!run) return;
    await this.withBusy(async () => {
      const selection = await this.api.recordHsSelection(run.review_run_id, { code, reason });
      this.patch({
        ...(this.state.hsClassification === null
          ? {}
          : { hsClassification: { ...this.state.hsClassification, selection } }),
        // The duty ladder depends on the confirmed code; refetch on next visit.
        dutyAssessment: null,
        dutyLoadedRunId: null,
        notice: "HSK 분류를 확정했습니다. 관세 진단에 확정 코드가 반영됩니다.",
      });
    });
  }

  /* ── correction proposals ────────────────────────────────────── */

  private async ensureCorrectionProposalsLoaded(): Promise<void> {
    const run = this.state.selectedRun;
    if (!run || this.state.correctionLoadedRunId === run.review_run_id || this.state.correctionLoading) return;
    this.patch({ correctionLoading: true, correctionError: null });
    try {
      const proposals = await this.api.listCorrectionProposals(run.review_run_id);
      this.patch({ correctionProposals: proposals, correctionLoadedRunId: run.review_run_id });
      this.reconcileCorrectionProposalSelection();
    } catch (error) {
      this.patch({ correctionError: userMessage(error, "정정 제안을 불러오지 못했습니다.") });
    } finally {
      this.patch({ correctionLoading: false });
    }
  }

  reloadCorrectionProposals(): void {
    this.patch({ correctionLoadedRunId: null });
    void this.ensureCorrectionProposalsLoaded();
  }

  async createCorrectionProposal(payload: CreateCorrectionProposalRequest): Promise<void> {
    if (!this.hasRole("reviewer")) {
      this.showError(new Error("정정 제안은 심사자 역할에서만 기록할 수 있습니다."));
      return;
    }
    const run = this.state.selectedRun;
    if (!run) return;
    await this.withBusy(async () => {
      const proposal = await this.api.createCorrectionProposal(run.review_run_id, payload);
      const wasLoaded = this.state.correctionLoadedRunId === run.review_run_id;
      this.patch({
        correctionProposals: [proposal, ...this.state.correctionProposals],
        ...(wasLoaded ? {} : { correctionLoadedRunId: null }),
        correctionDraft: null,
        notice: "정정 제안을 기록했습니다. 승인 전에는 원래 심사 결과가 바뀌지 않습니다.",
      });
    });
  }

  async decideCorrectionProposal(
    proposal: CorrectionProposal,
    decision: { status: "approved" | "rejected"; reason: string },
  ): Promise<void> {
    if (!this.hasRole("approver")) {
      this.showError(new Error("정정 제안의 승인·반려는 승인자 역할에서만 할 수 있습니다."));
      return;
    }
    if (proposal.created_by === this.state.session?.subject) {
      this.showError(new Error("제안자는 자신의 정정 제안을 승인하거나 반려할 수 없습니다."));
      return;
    }
    await this.withBusy(async () => {
      const updated = await this.api.decideCorrectionProposal(proposal.correction_proposal_id, decision);
      this.patch({
        correctionProposals: this.state.correctionProposals.map((item) =>
          item.correction_proposal_id === updated.correction_proposal_id ? updated : item,
        ),
        notice: decision.status === "approved"
          ? "정정 제안을 승인했습니다. 아래에서 승인된 제안으로 재심사를 시작할 수 있습니다."
          : "정정 제안을 반려했습니다. 원래 심사 결과는 유지됩니다.",
      });
      this.reconcileCorrectionProposalSelection();
    });
  }

  private reconcileCorrectionProposalSelection(): void {
    const eligible = new Set(this.eligibleCorrectionProposals().map((proposal) => proposal.correction_proposal_id));
    const next = new Set([...this.state.selectedCorrectionProposalIds].filter((proposalId) => eligible.has(proposalId)));
    if (next.size !== this.state.selectedCorrectionProposalIds.size) this.patch({ selectedCorrectionProposalIds: next });
  }

  setCorrectionProposalSelected(proposalId: string, selected: boolean): void {
    const eligible = this.eligibleCorrectionProposals().some((proposal) => proposal.correction_proposal_id === proposalId);
    if (!eligible) return;
    const next = new Set(this.state.selectedCorrectionProposalIds);
    if (selected) next.add(proposalId);
    else next.delete(proposalId);
    this.patch({ selectedCorrectionProposalIds: next });
  }

  useCorrectionDraft(draft: AssistantCorrectionDraft): void {
    const current = this.state.selectedCase;
    if (!this.hasRole("reviewer")) {
      this.patch({ notice: "AI 도우미의 수정 초안은 심사자 역할에서만 정정 제안으로 기록할 수 있습니다." });
      return;
    }
    this.patch({
      correctionDraft: draft,
      notice: "AI 도우미의 정정 제안을 심사 결과의 정정 양식에 채웠습니다. 내용을 확인한 뒤에만 기록하십시오.",
    });
    if (current) this.setRoute(current.case_id, "review");
  }

  async startRevision(): Promise<void> {
    if (!this.hasRole("approver")) {
      this.showError(new Error("승인된 정정으로 재심사하는 작업은 승인자 역할에서만 할 수 있습니다."));
      return;
    }
    const run = this.state.selectedRun;
    if (!run) return;
    const proposalIds = this.selectedEligibleCorrectionProposalIds();
    if (!proposalIds.length) {
      this.showError(new Error("재심사에 반영할 승인된 정정 제안을 한 건 이상 선택하십시오."));
      return;
    }
    await this.withBusy(async () => {
      const job = await this.api.enqueueRevision(run.review_run_id, { proposal_ids: proposalIds }, crypto.randomUUID());
      this.patch({ selectedCorrectionProposalIds: new Set<string>(), activeJob: job });
      if (job.status === "succeeded") await this.showSucceededReview(job);
      else {
        this.patch({ notice: "승인된 정정 제안을 반영하는 자식 심사를 요청했습니다. 완료되면 새 심사 이력으로 이동합니다." });
        this.scheduleJobPoll(job);
      }
    });
  }

  async openAppliedRevision(reviewRunId: string): Promise<void> {
    const current = this.state.selectedCase;
    await this.withBusy(async () => {
      await this.openRun(reviewRunId);
      if (current) this.setRoute(current.case_id, "review");
    });
  }

  /* ── shared request wrapper ──────────────────────────────────── */

  private async withBusy(action: () => Promise<void>): Promise<void> {
    if (this.state.busy) return;
    this.patch({ busy: true, error: null });
    try {
      await action();
    } catch (error) {
      this.patch({ error: userMessage(error, "요청을 처리하지 못했습니다.") });
    } finally {
      this.patch({ busy: false });
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Validates the upload's media type from its extension and browser-declared type. */
function assetMediaType(file: File): DocumentAssetMediaType | null {
  const name = file.name.toLocaleLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (file.type === "application/pdf" || file.type === "image/jpeg" || file.type === "image/png") {
    return file.type;
  }
  return null;
}
