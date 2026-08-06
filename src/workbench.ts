import { ApiClient } from "./api/v1/client";
import { userFacingErrorMessage } from "./api/user-facing-errors";
import type {
  CaseDetail,
  CaseDocument,
  CaseSummary,
  DocumentType,
  FindingDecisionRequest,
  JobRecord,
  ReviewComparison,
  ReviewerDecision,
  ReviewFinding,
  ReviewRun,
  ReviewRunSummary,
  SourceReference,
  Session,
} from "./api/v1/types";
import type { BrowserSession } from "./auth";

export type FrontendRuntimeMode = "local-development" | "functional-uat";
type WorkspaceTab = "documents" | "analysis" | "evidence" | "history";
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
  activeJob: JobRecord | null;
  activeTab: WorkspaceTab;
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
    activeJob: null,
    activeTab: "documents",
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
      if (render) this.render();
      return;
    }
    this.state.activeTab = route.tab;
    if (this.state.selectedCase?.case_id !== route.caseId) await this.loadCase(route.caseId);
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
    this.state.activeJob = null;
    if (runSummaries[0]) await this.openRun(runSummaries[0].review_run_id);
  }

  private async openRun(runId: string): Promise<void> {
    const run = await this.api.getReviewRun(runId);
    if (run.case_id !== this.state.selectedCase?.case_id) {
      throw new Error("심사 결과가 현재 Case에 속하지 않습니다.");
    }
    this.state.selectedRun = run;
  }

  private async openDocument(documentId: string, source: SourceReference | null = null): Promise<void> {
    const current = this.requireCase();
    const document = await this.api.getDocumentContent(current.case_id, documentId);
    this.state.selectedDocument = document;
    this.state.sourceFocus = source;
  }

  private async createCase(form: HTMLFormElement): Promise<void> {
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
      createHeader(this.state.session, this.mode, () => void this.auth.logout()),
      createRuntimeNotice(this.mode),
      this.state.error ? message("error", this.state.error) : null,
      this.state.notice ? message("notice", this.state.notice) : null,
      element("main", { className: "review-app", attributes: { id: "main-content", "aria-busy": String(this.state.busy) } },
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
        attributes: { type: "button", "aria-current": this.state.selectedCase?.case_id === item.case_id ? "page" : undefined, disabled: this.state.busy ? "" : undefined },
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

    const form = element("form", { className: "case-create-form", on: { submit: (event) => { event.preventDefault(); void this.createCase(event.currentTarget as HTMLFormElement); } } },
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
      element("details", { className: "new-case-panel", attributes: { open: this.state.cases.length === 0 ? "" : undefined } },
        element("summary", { text: "새 Case 등록" }), form),
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
    return element("section", { className: "case-workspace" },
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
    return element("button", {
      className: "button button--primary",
      text: running ? "심사 진행 중" : "AI 심사 시작",
      attributes: { type: "button", disabled: this.state.busy || !this.activeDocuments().length || running ? "" : undefined },
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
        attributes: { type: "button", role: "tab", "aria-selected": tab.id === this.state.activeTab ? "true" : "false" },
        on: { click: () => this.setRoute(current.case_id, tab.id) },
      }));
    }
    return tabs;
  }

  private createActiveTab(): HTMLElement {
    switch (this.state.activeTab) {
      case "analysis": return this.createAnalysisTab();
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
        attributes: { type: "button", role: "listitem" },
        on: { click: () => void this.withBusy(() => this.openDocument(document.document_id)) },
      },
      element("span", { className: "document-type", text: document.document_type }),
      element("span", { className: "document-name", text: document.filename }),
      element("span", { text: superseded ? "대체됨" : "활성" }),
      element("small", { text: `${document.character_count.toLocaleString()}자` })));
    }
    if (!this.state.documents.length) documents.append(element("p", { className: "empty-copy", text: "등록된 문서가 없습니다." }));

    const active = this.activeDocuments();
    const form = element("form", { className: "document-form", on: { submit: (event) => { event.preventDefault(); void this.addDocument(event.currentTarget as HTMLFormElement); } } },
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
        element("details", { className: "document-add-panel" }, element("summary", { text: "문서 등록 또는 보완" }), form),
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
    const orderedFindings = [...run.findings].sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity));
    return element("section", { className: "analysis-stack" },
      element("section", { className: "surface review-summary" },
        sectionHeading("심사 요약", `${formatDate(run.created_at)} · ${display(run.assessment)}`),
        element("p", { className: "summary-copy", text: run.report.summary }),
        element("p", { className: "disclaimer", text: run.report.disclaimer }),
        element("div", { className: "review-metrics" },
          metric("확인 사항", String(run.findings.length)),
          metric("문서 비교", String(run.comparisons.length)),
          metric("법령 근거", String(run.evidence.length)),
          metric("담당자 판단", String(run.reviewer_decisions.length)),
        ),
      ),
      element("section", { className: "surface" }, sectionHeading("Agent 워크플로우", "완료된 실제 심사 단계만 표시합니다."), this.createWorkflow(run)),
      element("section", { className: "surface" }, sectionHeading("우선 확인 사항", "불일치·누락·모호성은 담당자가 판단해야 합니다."), this.createFindings(orderedFindings)),
      element("section", { className: "surface" }, sectionHeading("문서 간 비교", "일치 결과도 함께 남겨 비교 근거를 확인할 수 있습니다."), this.createComparisons(run.comparisons)),
    );
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
      const card = element("article", { className: `finding-card finding-card--${finding.severity}` },
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
    const form = element("form", { className: "decision-form", on: { submit: (event) => { event.preventDefault(); void this.decideFinding(event.currentTarget as HTMLFormElement, finding.finding_id); } } },
      select("status", [["confirmed", "확인함"], ["needs_information", "추가자료 요청"], ["resolved", "해결됨"]]),
      textarea("reason", { required: true, maxLength: 4_000, placeholder: "판단 사유를 기록하십시오." }),
      submit(decision ? "판단 수정" : "판단 기록", this.state.busy),
    );
    return element("details", { className: "decision-panel", attributes: { open: decision ? undefined : "" } },
      element("summary", { text: decision ? "담당자 판단 보기·수정" : "담당자 판단 기록" }), history, form,
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
        className: `comparison-row comparison-row--${comparison.status}`,
        attributes: { type: "button", role: "row" },
        on: { click: () => void this.focusComparison(comparison) },
      },
      element("span", { text: comparison.rule_code }),
      element("span", { text: comparisonStatusLabel(comparison.status) }),
      element("span", { text: `${displayValue(comparison.left.display_value)} ↔ ${displayValue(comparison.right.display_value)}` }),
      element("span", { text: comparison.message })));
    }
    return table;
  }

  private async focusComparison(comparison: ReviewComparison): Promise<void> {
    const source = sourceForOperand(this.requireRun(), comparison.left) ?? sourceForOperand(this.requireRun(), comparison.right);
    if (source) await this.focusSource(source);
  }

  private async focusSource(source: SourceReference): Promise<void> {
    await this.withBusy(async () => {
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
      evidence.append(element("article", { className: "evidence-card" },
        element("header", {}, element("span", { className: "evidence-type", text: item.source_type }), element("h3", { text: item.title })),
        item.law_name ? element("p", { className: "evidence-law", text: item.law_name }) : null,
        element("p", { text: item.text }),
        element("div", { className: "evidence-footer" },
          element("span", { text: `연결된 확인 사항 ${linked.length}건` }),
          safeExternalLink(item.source_uri),
        ),
      ));
    }
    return element("section", { className: "surface evidence-surface" }, sectionHeading("법령 Evidence", "Agent가 Data Evidence API에서 받은 근거입니다."), evidence);
  }

  private createHistoryTab(): HTMLElement {
    const current = this.requireCase();
    const timeline = element("ol", { className: "history-timeline" });
    for (const run of this.state.runs) {
      timeline.append(element("li", { className: `history-item${this.state.selectedRun?.review_run_id === run.review_run_id ? " is-selected" : ""}` },
        element("button", {
          className: "history-button", attributes: { type: "button" },
          on: { click: () => void this.withBusy(async () => { await this.openRun(run.review_run_id); this.render(); }) },
        },
        element("strong", { text: formatDate(run.created_at) }),
        element("span", { text: `${display(run.assessment)} · 확인 사항 ${run.finding_count}건` }),
        element("small", { text: `담당자 판단 ${run.reviewer_decision_count}건 · revision ${run.review_as_of}` })),
      ));
    }
    if (!this.state.runs.length) timeline.append(element("li", { className: "empty-copy", text: "아직 심사 이력이 없습니다." }));
    return element("section", { className: "history-layout" },
      element("section", { className: "surface" }, sectionHeading("심사 이력", "보완 문서로 재심사하면 이전 결과는 그대로 남습니다."), timeline),
      element("section", { className: "surface history-next" },
        sectionHeading("다음 작업", "문서를 보완한 뒤 새 심사를 실행할 수 있습니다."),
        element("p", { text: "대체 문서는 문서 탭에서 등록하십시오. 새 심사는 대체된 문서를 제외한 활성 문서만 사용합니다." }),
        element("button", { className: "button button--secondary", text: "문서 탭으로 이동", attributes: { type: "button" }, on: { click: () => this.setRoute(current.case_id, "documents") } }),
      ),
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

function createHeader(session: Session | null, mode: FrontendRuntimeMode, onLogout: () => void): HTMLElement {
  return element("header", { className: "topbar" },
    element("a", { className: "brand-lockup", attributes: { href: "#/cases", "aria-label": "통관 AI 사전심사 Case 목록" } },
      element("span", { className: "brand-mark", text: "CA" }),
      element("span", {}, element("strong", { className: "brand", text: "통관 AI 사전심사" }), element("small", { text: mode === "functional-uat" ? "기능 UAT" : "팀 개발" })),
    ),
    element("div", { className: "user-block" },
      element("span", { text: session?.subject ?? "세션 확인 중" }),
      element("small", { text: session?.org_id ?? "" }),
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
  queueMicrotask(() => pre.querySelector("mark")?.scrollIntoView({ block: "center" }));
  return pre;
}

function sourceForFinding(run: ReviewRun, finding: ReviewFinding): SourceReference | null {
  for (const analysis of run.document_analyses) {
    for (const fact of [...analysis.facts, ...analysis.line_items.flatMap((item) => item.facts)]) {
      if (finding.fact_ids.includes(fact.fact_id)) return fact.source;
    }
  }
  const documentId = finding.document_ids[0];
  return documentId ? { document_id: documentId, quote: "", occurrence: 1 } : null;
}

function sourceForOperand(run: ReviewRun, operand: ReviewComparison["left"]): SourceReference | null {
  if (operand.document_id === null) return null;
  for (const analysis of run.document_analyses) {
    if (analysis.document_id !== operand.document_id) continue;
    for (const fact of [...analysis.facts, ...analysis.line_items.flatMap((item) => item.facts)]) {
      if (operand.fact_ids.includes(fact.fact_id)) return fact.source;
    }
  }
  return null;
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
  const match = /^#\/cases\/([^/]+)(?:\/(documents|analysis|evidence|history))?$/u.exec(hash);
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

function textarea(name: string, options: { required?: boolean; maxLength?: number; placeholder?: string }): HTMLTextAreaElement {
  return element("textarea", { attributes: { name, required: options.required ? "" : undefined, maxlength: options.maxLength === undefined ? undefined : String(options.maxLength), placeholder: options.placeholder, rows: "8" } });
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
