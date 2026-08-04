import { ApiClient } from "./api/v1/client";
import { userFacingErrorMessage } from "./api/user-facing-errors";
import type {
  CaseDetail,
  CaseDocument,
  CaseSummary,
  DocumentType,
  EnqueueReviewRequest,
  JobRecord,
  ReviewRun,
  Session,
} from "./api/v1/types";
import type { BrowserSession } from "./auth";

export type FrontendRuntimeMode = "local-development" | "functional-uat";

interface WorkbenchState {
  session: Session | null;
  cases: CaseSummary[];
  selectedCase: CaseDetail | null;
  documents: CaseDocument[];
  runs: ReviewRun[];
  selectedRun: ReviewRun | null;
  activeJob: JobRecord | null;
  busy: boolean;
  notice: string | null;
  error: string | null;
}

const DOCUMENT_TYPES: readonly DocumentType[] = ["CI", "PL", "BL", "CO", "UNKNOWN"];
const ACTIVE_JOB_STATES = new Set(["queued", "running"]);

/**
 * Small, API-v1-only workbench used by both team development profiles.
 *
 * It intentionally contains one end-to-end user path: make a case, attach
 * text documents, start a review, and inspect the public Backend result.  It
 * does not make a deployment/approval decision or open a direct Agent/Data
 * connection.
 */
export class LightweightWorkbench {
  private state: WorkbenchState = {
    session: null,
    cases: [],
    selectedCase: null,
    documents: [],
    runs: [],
    selectedRun: null,
    activeJob: null,
    busy: false,
    notice: null,
    error: null,
  };
  private jobTimer: number | null = null;
  private destroyed = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly api: ApiClient,
    private readonly auth: BrowserSession,
    private readonly mode: FrontendRuntimeMode,
  ) {}

  async start(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("브라우저 인증 세션을 시작하지 못했습니다.");
    }
    await this.withBusy(async () => {
      this.state.session = await this.api.getSession();
      await this.refreshCases();
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.jobTimer !== null) window.clearTimeout(this.jobTimer);
    this.jobTimer = null;
  }

  private async refreshCases(): Promise<void> {
    const response = await this.api.listCases();
    this.state.cases = response.items;
  }

  private async openCase(caseId: string): Promise<void> {
    await this.withBusy(() => this.loadCase(caseId));
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
    this.state.activeJob = null;
    if (runSummaries[0]) await this.openRun(runSummaries[0].review_run_id);
  }

  private async openRun(runId: string): Promise<void> {
    const run = await this.api.getReviewRun(runId);
    if (run.case_id !== this.state.selectedCase?.case_id) {
      throw new Error("심사 결과가 현재 Case에 속하지 않습니다.");
    }
    const previous = this.state.runs.filter((item) => item.review_run_id !== run.review_run_id);
    this.state.runs = [run, ...previous];
    this.state.selectedRun = run;
  }

  private async createCase(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const title = stringValue(data, "title");
    if (!title) throw new Error("Case 제목을 입력해 주십시오.");
    const reference = stringValue(data, "reference");
    await this.withBusy(async () => {
      const created = await this.api.createCase({
        title,
        external_reference: reference || null,
      });
      await this.refreshCases();
      await this.loadCase(created.case_id);
      this.state.notice = "새 Case를 만들었습니다. 텍스트 문서를 등록해 심사를 시작하십시오.";
      form.reset();
    });
  }

  private async addDocument(form: HTMLFormElement): Promise<void> {
    const current = this.requireCase();
    const data = new FormData(form);
    const content = stringValue(data, "content_text");
    if (!content.trim()) throw new Error("문서 원문은 비워 둘 수 없습니다.");
    const documentType = stringValue(data, "document_type") as DocumentType;
    if (!DOCUMENT_TYPES.includes(documentType)) throw new Error("허용되지 않은 문서 유형입니다.");
    const filename = stringValue(data, "filename");
    if (!filename.endsWith(".txt")) throw new Error("텍스트 문서는 .txt 파일명으로 등록하십시오.");
    await this.withBusy(async () => {
      await this.api.addDocument(current.case_id, {
        document_type: documentType,
        filename,
        media_type: "text/plain",
        content_text: content,
      });
      await this.loadCase(current.case_id);
      this.state.notice = "텍스트 문서를 등록했습니다.";
      form.reset();
    });
  }

  private async startReview(): Promise<void> {
    const current = this.requireCase();
    if (this.state.documents.length === 0) {
      throw new Error("심사를 시작하려면 텍스트 문서를 하나 이상 등록해야 합니다.");
    }
    await this.withBusy(async () => {
      // `review_as_of` is intentionally absent. Backend selects the local
      // development date or enforces the functional-UAT date itself.
      const request = {
        trade_type: "import",
      } as EnqueueReviewRequest;
      const job = await this.api.enqueueReview(current.case_id, request, crypto.randomUUID());
      this.state.activeJob = job;
      this.state.notice = "심사를 시작했습니다. 현재 Job 상태를 확인하고 있습니다.";
      this.scheduleJobPoll(job);
    });
  }

  private scheduleJobPoll(job: JobRecord): void {
    if (this.destroyed || !ACTIVE_JOB_STATES.has(job.status)) return;
    if (this.jobTimer !== null) window.clearTimeout(this.jobTimer);
    this.jobTimer = window.setTimeout(() => {
      void this.pollJob(job.job_id);
    }, 1_000);
  }

  private async pollJob(jobId: string): Promise<void> {
    if (this.destroyed) return;
    try {
      const job = await this.api.getJob(jobId);
      this.state.activeJob = job;
      if (ACTIVE_JOB_STATES.has(job.status)) {
        this.scheduleJobPoll(job);
      } else if (job.status === "succeeded" && job.review_run_id) {
        await this.loadCase(job.case_id);
        await this.openRun(job.review_run_id);
        this.state.notice = "심사가 완료되었습니다. 결과는 항상 사람 검토 대상으로 표시됩니다.";
      } else {
        this.state.error = "심사가 완료되지 않았습니다. Job 상태와 서비스 로그를 확인하십시오.";
      }
    } catch (error) {
      this.state.error = userMessage(error, "Job 상태를 확인하지 못했습니다.");
    } finally {
      this.render();
    }
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

  private render(): void {
    if (this.destroyed) return;
    const children = [
      createHeader(this.state.session, this.mode, () => void this.auth.logout()),
      createRuntimeNotice(this.mode),
      this.state.error ? message("error", this.state.error) : null,
      this.state.notice ? message("notice", this.state.notice) : null,
      element("main", { className: "lightweight-workbench", attributes: { id: "main-content", "aria-busy": String(this.state.busy) } },
        this.createQueue(),
        this.state.selectedCase ? this.createCaseWorkspace() : this.createWelcome(),
      ),
    ].filter((item): item is HTMLElement => item !== null);
    this.root.replaceChildren(...children);
  }

  private createQueue(): HTMLElement {
    const list = element("nav", { className: "case-list", attributes: { "aria-label": "Case 목록" } });
    for (const item of this.state.cases) {
      list.append(element("button", {
        className: `case-card${this.state.selectedCase?.case_id === item.case_id ? " is-selected" : ""}`,
        text: `${item.title}\n${item.external_reference ?? item.case_id}\n${display(item.status)} · ${formatDate(item.updated_at)}`,
        attributes: { type: "button", disabled: this.state.busy ? "" : undefined },
        on: { click: () => void this.openCase(item.case_id).catch((error) => this.showError(error)) },
      }));
    }
    if (this.state.cases.length === 0) list.append(element("p", { text: "등록된 Case가 없습니다." }));

    const form = element("form", {
      className: "compact-form",
      on: { submit: (event) => { event.preventDefault(); void this.createCase(event.currentTarget as HTMLFormElement); } },
    },
    field("Case 제목", input("title", { required: true, maxLength: 200 })),
    field("업무 참조번호", input("reference", { maxLength: 200 })),
    submit("Case 만들기", this.state.busy));

    return element("aside", { className: "sidebar", attributes: { "aria-label": "심사 업무함" } },
      element("div", {}, element("p", { className: "eyebrow", text: "REVIEW QUEUE" }), element("h2", { text: "심사 업무함" })),
      list,
      element("details", { className: "sidebar-panel", attributes: { open: this.state.cases.length === 0 ? "" : undefined } },
        element("summary", { text: "새 Case" }), form),
    );
  }

  private createWelcome(): HTMLElement {
    return element("section", { className: "welcome" },
      element("p", { className: "eyebrow", text: "TEAM DEVELOPMENT" }),
      element("h1", { text: "Case를 만들고 실제 서비스 흐름을 확인합니다." }),
      element("p", { text: "문서를 등록하면 Backend가 Agent와 Data를 HTTP로 호출합니다. 결과는 자동 처리되지 않으며 항상 담당자 검토가 필요합니다." }),
      element("ol", { className: "workflow-guide" },
        element("li", { text: "Case를 만들고 텍스트 문서를 등록합니다." }),
        element("li", { text: "심사를 시작해 Backend → Agent → Data 흐름을 확인합니다." }),
        element("li", { text: "반환된 문서 비교·법령 근거·후속 조치를 사람이 확인합니다." }),
      ),
    );
  }

  private createCaseWorkspace(): HTMLElement {
    const current = this.requireCase();
    const addForm = element("form", {
      className: "document-form",
      on: { submit: (event) => { event.preventDefault(); void this.addDocument(event.currentTarget as HTMLFormElement); } },
    },
    field("문서 유형", select("document_type", DOCUMENT_TYPES)),
    field("파일명", input("filename", { required: true, maxLength: 255, placeholder: "commercial-invoice.txt" })),
    field("문서 원문", textarea("content_text", { required: true, maxLength: 200_000 })),
    submit("텍스트 문서 등록", this.state.busy));

    const documents = element("ul", { className: "document-list" });
    for (const document of this.state.documents) {
      documents.append(element("li", { text: `${document.document_type} · ${document.filename} · ${document.character_count.toLocaleString()}자` }));
    }
    if (!this.state.documents.length) documents.append(element("li", { text: "등록된 문서가 없습니다." }));

    const runButton = element("button", {
      className: "button button--primary",
      text: this.state.activeJob && ACTIVE_JOB_STATES.has(this.state.activeJob.status) ? "심사 진행 중" : "심사 시작",
      attributes: { type: "button", disabled: this.state.busy || this.state.documents.length === 0 || Boolean(this.state.activeJob && ACTIVE_JOB_STATES.has(this.state.activeJob.status)) ? "" : undefined },
      on: { click: () => void this.startReview() },
    });

    const runList = element("div", { className: "run-list" });
    for (const run of this.state.runs) {
      runList.append(element("button", {
        className: `run-chip${this.state.selectedRun?.review_run_id === run.review_run_id ? " is-selected" : ""}`,
        text: `${formatDate(run.created_at)} · ${display(run.execution_status)}`,
        attributes: { type: "button" },
        on: { click: () => void this.openRun(run.review_run_id).then(() => this.render()).catch((error) => this.showError(error)) },
      }));
    }

    return element("section", { className: "case-workspace" },
      element("header", { className: "case-heading" },
        element("div", {},
          element("p", { className: "eyebrow", text: "CASE" }),
          element("h1", { text: current.title }),
          element("p", { text: `${current.external_reference ?? current.case_id} · ${display(current.status)}` }),
        )),
      element("section", { className: "card" },
        element("h2", { text: "1. 텍스트 문서" }),
        element("p", { text: "PDF, 이미지, OCR 파일은 이 개발/UAT 범위에서 처리하지 않습니다." }),
        addForm,
        documents,
      ),
      element("section", { className: "card" },
        element("h2", { text: "2. AI 사전심사" }),
        element("p", { text: "현재 프로필의 Backend가 심사 기준일을 관리합니다. 브라우저는 날짜·모델·법령 데이터를 임의로 설정하지 않습니다." }),
        runButton,
        this.state.activeJob ? element("p", { className: "job-status", text: `Job ${this.state.activeJob.job_id.slice(0, 12)} · ${display(this.state.activeJob.status)}` }) : null,
        runList.childElementCount ? runList : null,
      ),
      this.state.selectedRun ? renderRun(this.state.selectedRun) : null,
    );
  }

  private showError(error: unknown): void {
    this.state.error = userMessage(error, "요청을 처리하지 못했습니다.");
    this.render();
  }
}

function createHeader(session: Session | null, mode: FrontendRuntimeMode, onLogout: () => void): HTMLElement {
  return element("header", { className: "topbar" },
    element("div", { className: "brand-lockup" },
      element("span", { className: "brand-mark", text: "CA" }),
      element("div", {}, element("strong", { className: "brand", text: "통관 AI 사전심사" }), element("small", { text: mode === "functional-uat" ? "실제 기능 UAT" : "팀 개발" }))),
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
    element("span", {
      text: functional
        ? "실제 관세 3법·Data 저장소·Claude를 사용합니다. 모든 결과는 human review only이며 배포·승인 증거가 아닙니다."
        : "합성 Evidence와 결정론 Agent를 사용합니다. Docker·모델·Law API·Claude 키가 필요 없고 자동 완료는 없습니다.",
    }),
  );
}

function renderRun(run: ReviewRun): HTMLElement {
  return element("section", { className: "review-result" },
    element("header", { className: "section-title-row" },
      element("h2", { text: "3. 심사 결과" }),
      element("span", { className: "human-review-badge", text: "사람 검토 필요" }),
    ),
    element("div", { className: "status-grid" },
      status("실행", run.execution_status),
      status("평가", run.assessment),
      status("처리", run.review_disposition),
    ),
    reportSection("심사 요약", [run.report.summary, run.report.disclaimer]),
    listSection(
      "확인 사항",
      run.findings.map((item) => `${item.severity} · ${item.code}: ${item.message}`),
      "등록된 확인 사항이 없습니다.",
    ),
    listSection(
      "법령 Evidence",
      run.evidence.map((item) => `${item.title}${item.law_name ? ` · ${item.law_name}` : ""}: ${item.text}`),
      "반환된 Evidence가 없습니다.",
    ),
    listSection(
      "필수 후속 조치",
      run.required_actions.map((item) => `${item.action_code} · ${item.message}`),
      "등록된 후속 조치가 없습니다.",
    ),
    element("p", { className: "result-boundary", text: "이 결과는 현재 Case와 문서에 대한 AI 사전심사 보조 정보입니다. 통관 승인·법적 판단·자동 완료를 의미하지 않습니다." }),
  );
}

function status(label: string, value: string): HTMLElement {
  return element("div", { className: "status-badge" }, element("span", { text: label }), element("strong", { text: display(value) }));
}

function reportSection(title: string, values: string[]): HTMLElement {
  return listSection(title, values, "제공된 설명이 없습니다.");
}

function listSection(title: string, values: string[], empty: string): HTMLElement {
  const list = element("ul", { className: "result-list" });
  for (const value of values) list.append(element("li", { text: value }));
  if (!values.length) list.append(element("li", { text: empty }));
  return element("section", { className: "card" }, element("h3", { text: title }), list);
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
  for (const [event, listener] of Object.entries(options.on ?? {})) {
    if (listener) node.addEventListener(event, listener);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function input(name: string, options: { required?: boolean; maxLength?: number; placeholder?: string }): HTMLInputElement {
  return element("input", {
    attributes: {
      name,
      type: "text",
      ...(options.required ? { required: "" } : {}),
      ...(options.maxLength ? { maxlength: String(options.maxLength) } : {}),
      ...(options.placeholder ? { placeholder: options.placeholder } : {}),
    },
  });
}

function textarea(name: string, options: { required?: boolean; maxLength?: number }): HTMLTextAreaElement {
  return element("textarea", {
    attributes: {
      name,
      rows: "8",
      ...(options.required ? { required: "" } : {}),
      ...(options.maxLength ? { maxlength: String(options.maxLength) } : {}),
    },
  });
}

function select(name: string, values: readonly string[]): HTMLSelectElement {
  return element("select", { attributes: { name } }, ...values.map((value) => element("option", { text: value, attributes: { value } })));
}

function field(label: string, control: HTMLElement): HTMLElement {
  const id = crypto.randomUUID();
  control.id = id;
  return element("label", { className: "field", attributes: { for: id } }, element("span", { className: "field__label", text: label }), control);
}

function submit(label: string, disabled: boolean): HTMLButtonElement {
  return element("button", { className: "button button--secondary", text: label, attributes: { type: "submit", disabled: disabled ? "" : undefined } });
}

function message(kind: "error" | "notice", text: string): HTMLElement {
  return element("p", { className: `notice notice--${kind}`, text, attributes: { role: kind === "error" ? "alert" : "status" } });
}

function stringValue(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function display(value: string): string {
  return value.replaceAll("_", " ");
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}

function userMessage(error: unknown, fallback: string): string {
  return userFacingErrorMessage(error, fallback);
}
