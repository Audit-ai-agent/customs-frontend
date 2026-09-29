// Dev-only design preview. Mounts the real workbench against an in-memory stub
// Backend so the KRDS screen can be reviewed without Backend/OIDC running.
// Not part of the production build (index.html is the only build entry).
import "../src/styles.css";
import { LightweightWorkbench } from "../src/workbench";

const NOW = "2026-08-05T09:12:00Z";
const hex = (character: string) => character.repeat(64);

const documentAnalysis = {
  document_id: "doc-1",
  filename: "commercial-invoice.txt",
  declared_type: "invoice",
  document_type: "invoice",
  classification_source: { source_kind: "document", document_id: "doc-1", quote: "COMMERCIAL INVOICE", occurrence: 0 },
  extraction_status: "complete",
  facts: [
    { fact_id: "fact-1", name: "invoice_no", raw_value: "CI-2026-0001", normalized_value: "CI-2026-0001", unit: null, source: { source_kind: "document", document_id: "doc-1", quote: "Invoice No: CI-2026-0001", occurrence: 0 } },
    { fact_id: "fact-2", name: "quantity", raw_value: "120", normalized_value: "120", unit: "EA", source: { source_kind: "document", document_id: "doc-1", quote: "Quantity: 120 EA", occurrence: 0 } },
    { fact_id: "fact-3", name: "total_amount", raw_value: "12,400.00", normalized_value: "12400.00", unit: "USD", source: { source_kind: "document", document_id: "doc-1", quote: "Total: 12,400.00 USD", occurrence: 0 } },
  ],
  line_items: [],
  warnings: [],
};

const run = {
  review_run_id: "run-001",
  case_id: "case-1",
  org_id: "org-1",
  job_id: "job-001",
  case_revision: 1,
  review_as_of: "2026-08-05",
  trade_type: "import",
  execution_status: "succeeded",
  assessment: "issues_detected",
  review_disposition: "human_review_required",
  completion_eligibility: { eligible: false, unmet_reason_codes: ["human_review_required"] },
  agent_schema_version: "3.2",
  agent_status: "needs_review",
  agent_engine: { kind: "deterministic", model_id: "fixture" },
  agent_confidence: {
    overall: 0.893, threshold: 0.8, review_track: "expedited_check", method: "deterministic_signals",
    components: { extraction: 1, comparison: 0.733, evidence: 1 },
  },
  agent_eligibility_verdict: {
    verdict: "indeterminate", advisory: true, source: "rule",
    reasons: [
      { code: "document_mismatch", message: "Invoice와 Packing List의 수량이 일치하지 않습니다.", finding_ids: ["finding-1"], evidence_ids: [] },
      { code: "requirement_check", message: "필수 확인 항목: 전기용품 및 생활용품 요건확인서", finding_ids: [], evidence_ids: ["evidence-3"] },
    ],
  },
  report: {
    overall_status: "needs_review",
    summary: "Invoice와 Packing List의 수량이 달라 담당자 확인이 필요합니다.",
    disclaimer: "이 결과는 자동 완료되지 않으며 반드시 담당자가 검토해야 합니다.",
    sections: [
      ["conclusion", "심사 결론", "수량 불일치 1건이 확인되어 사람 검토가 필요합니다."],
      ["execution_process", "처리 과정과 실행 상태", "문서 분류·사실 추출·비교·Evidence 조회를 제한된 순서로 수행했습니다."],
      ["document_comparison", "문서 간 비교", "Invoice 수량 120 EA와 Packing List 수량 100 EA가 다릅니다."],
      ["issues_and_causes", "문제와 원인", "두 문서의 수량 표기가 서로 다르게 기재되어 있습니다."],
      ["legal_evidence", "법령 근거", "전기용품 안전확인 요건과 관세율 적용 조문을 연결했습니다."],
      ["impact", "영향", "요건이 확인되지 않으면 통관 검토가 보류될 수 있습니다."],
      ["next_actions", "담당자 판단 기록", "담당자가 원문을 확인하고 판단 사유를 기록해야 합니다."],
      ["limitations", "한계", "텍스트로 등록된 문서에 있는 사실만 확인했습니다."],
    ].map(([section, title, text], index) => ({
      section,
      title,
      claims: [{
        claim_id: `claim-${index + 1}`,
        text,
        fact_ids: index === 4 ? [] : ["fact-2"],
        comparison_ids: index === 2 || index === 3 ? ["comparison-1"] : [],
        evidence_ids: index === 4 ? ["evidence-1", "evidence-2"] : [],
      }],
    })),
  },
  workflow: {
    status: "completed",
    stages: [
      { stage: "classify_documents", status: "completed", attempt_count: 1, summary: "문서 2건의 유형을 판별했습니다." },
      { stage: "extract_facts", status: "completed", attempt_count: 1, summary: "문서 사실 3건을 추출했습니다." },
      { stage: "validate_documents", status: "needs_review", attempt_count: 1, summary: "수량 비교에서 불일치가 확인되었습니다." },
      { stage: "retrieve_evidence", status: "completed", attempt_count: 1, summary: "법령 Evidence 2건을 연결했습니다." },
      { stage: "generate_result", status: "completed", attempt_count: 1, summary: "근거 기반 보고서를 생성했습니다." },
    ],
    reextractions: [],
    planner: {
      cycle_count: 1,
      actions: [
        { cycle: 1, action: "analyze_documents", status: "completed", summary: "문서를 분석했습니다.", correction_proposal_ids: [] },
        { cycle: 1, action: "compare_documents", status: "completed", summary: "품목과 값을 비교했습니다.", correction_proposal_ids: [] },
        { cycle: 1, action: "generate_report", status: "completed", summary: "보고서를 작성했습니다.", correction_proposal_ids: [] },
      ],
    },
  },
  document_analyses: [documentAnalysis],
  comparisons: [{
    comparison_id: "comparison-1",
    rule_code: "invoice_packing_quantity_unit",
    status: "mismatch",
    left: { document_id: "doc-1", item_id: null, fact_ids: ["fact-2"], display_value: "120" },
    right: { document_id: "doc-2", item_id: null, fact_ids: [], display_value: "100" },
    expected_value: "120",
    observed_value: "100",
    unit: "EA",
    message: "Invoice와 Packing List의 수량이 일치하지 않습니다.",
  }],
  evidence: [
    { evidence_id: "evidence-1", item_id: "item-1", title: "수입 요건 확인", text: "전기용품은 수입 전 안전확인 신고확인증이 필요하다.", source_uri: "https://law.example/1", source_type: "law", source_hash: hex("c"), law_id: "LAW-1", law_name: "전기용품 및 생활용품 안전관리법" },
    { evidence_id: "evidence-2", item_id: "item-2", title: "관세율 적용", text: "관세율은 수입신고 당시의 법령에 따라 적용한다.", source_uri: "https://law.example/2", source_type: "law", source_hash: hex("d"), law_id: "LAW-2", law_name: "관세법" },
    {
      evidence_id: "evidence-3", item_id: "item-1", source_type: "customs_requirement", source_hash: hex("e"),
      title: "전기용품 및 생활용품 안전관리법 — 전기용품 및 생활용품 요건확인서",
      text: "HSK 8504401000 import 요건: 전기용품 및 생활용품 안전관리법; 필요 확인서류 전기용품 및 생활용품 요건확인서; 요건승인기관 국가기술표준원.",
      source_uri: "https://apis.data.go.kr/1220000/retrieveCcctLworCd/getRetrieveCcctLworCd?hsSgn=8504401000&imexTpcd=2",
      law_id: "K01", law_name: "전기용품 및 생활용품 안전관리법",
    },
  ],
  findings: [
    { finding_id: "finding-1", code: "invoice_packing_quantity_unit", message: "Invoice와 Packing List의 수량이 일치하지 않습니다.", kind: "validation_issue", severity: "high", comparison_id: "comparison-1", document_ids: ["doc-1", "doc-2"], fact_ids: ["fact-2"], evidence_ids: ["evidence-1"] },
    { finding_id: "finding-2", code: "hs_code_presence", message: "HS 부호가 문서에 기재되어 있지 않습니다.", kind: "validation_issue", severity: "medium", comparison_id: null, document_ids: ["doc-1"], fact_ids: [], evidence_ids: [] },
  ],
  required_actions: [
    { action_code: "human_review_required", message: "Invoice와 Packing List의 수량이 일치하지 않습니다.", finding_ids: ["finding-1"] },
    { action_code: "human_review_required", message: "HS 부호가 문서에 기재되어 있지 않습니다.", finding_ids: ["finding-2"] },
    { action_code: "human_review_required", message: "자동 완료하지 않습니다. 담당자가 판단을 기록해야 합니다.", finding_ids: [] },
  ],
  reviewer_decisions: [
    { finding_id: "finding-2", status: "needs_information", reason_code: "supplement_requested", reason: "신고인에게 보완 자료 요청", decided_by: "local-reviewer", decided_at: NOW,
      history: [{ status: "needs_information", reason_code: "supplement_requested", reason: "신고인에게 보완 자료 요청", decided_by: "local-reviewer", decided_at: NOW }] },
  ],
  created_by: "local-reviewer",
  created_at: NOW,
};

const runSummary = {
  review_run_id: "run-001", case_id: "case-1", job_id: "job-001", review_as_of: "2026-08-05",
  trade_type: "import", execution_status: "succeeded", assessment: "issues_detected",
  review_disposition: "human_review_required", result_digest: hex("b"), finding_count: 2,
  reviewer_decision_count: 0, created_at: NOW,
};

const conversation = {
  conversation_id: "conversation-1", review_run_id: "run-001", title: "수량 불일치 확인",
  created_by: "local-reviewer", created_at: NOW, updated_at: NOW,
};

const messages = [
  { message_id: "message-1", conversation_id: "conversation-1", role: "user", content: "수량 불일치가 나온 문서와 실제 값을 알려줘", citations: [], suggested_questions: [], created_by: "local-reviewer", created_at: NOW },
  { message_id: "message-2", conversation_id: "conversation-1", role: "assistant", content: "Commercial Invoice는 120 EA, Packing List는 100 EA로 기재되어 있습니다.\n두 문서의 원문 인용을 함께 확인하십시오.", answer_scope: "case_grounded", citations: [{ kind: "fact", reference_id: "fact-2" }, { kind: "comparison", reference_id: "comparison-1" }], suggested_questions: ["원문 인용을 보여줘", "연결된 법령 근거를 알려줘"], created_by: "agent", created_at: NOW },
];

const proposal = {
  correction_proposal_id: "proposal-1", review_run_id: "run-001", finding_id: "finding-1",
  document_id: "doc-1", fact_id: "fact-2", field_name: "quantity", new_value: "100", unit: "EA",
  reason: "Packing List 원문 확인 결과 100 EA가 맞습니다.", status: "proposed",
  created_by: "local-reviewer", created_at: NOW,
  history: [{ event: "proposed", reason: "Packing List 원문 확인 결과 100 EA가 맞습니다.", actor: "local-reviewer", occurred_at: NOW }],
};

const cases = [
  { case_id: "case-1", org_id: "org-1", title: "전자부품 수입 건 (2026-08)", external_reference: "IMP-2026-0812", status: "in_review", revision: 1, updated_at: NOW },
  { case_id: "case-2", org_id: "org-1", title: "섬유 완제품 수입 건", external_reference: "IMP-2026-0771", status: "open", revision: 2, updated_at: NOW },
  { case_id: "case-3", org_id: "org-1", title: "기계부품 수입 건 (완료)", external_reference: "IMP-2026-0654", status: "closed", revision: 4, updated_at: NOW },
];

const documents = [
  { document_id: "doc-1", case_id: "case-1", document_type: "CI", filename: "commercial-invoice.txt", media_type: "text/plain", content_sha256: hex("a"), byte_size: 96, character_count: 96, created_by: "local-reviewer", created_at: NOW },
  { document_id: "doc-2", case_id: "case-1", document_type: "PL", filename: "packing-list.txt", media_type: "text/plain", content_sha256: hex("f"), byte_size: 42, character_count: 42, created_by: "local-reviewer", created_at: NOW },
];

const contents: Record<string, string> = {
  "doc-1": "COMMERCIAL INVOICE\n\nInvoice No: CI-2026-0001\nSeller: Example Components Co., Ltd.\nBuyer: 한바다 무역\nHS: 8517.62-1000\nQuantity: 120 EA\nUnit Price: 103.33 USD\nTotal: 12,400.00 USD\nIncoterms: FOB Shenzhen",
  "doc-2": "PACKING LIST\n\nInvoice No: CI-2026-0001\nQuantity: 100 EA\nGross Weight: 480 KG\nCartons: 10",
};

// The role switch is live so the approver-only affordances can be reviewed too.
let actor: "reviewer" | "approver" = "reviewer";

const LLM_SETTINGS_BASELINE = {
  provider: "openai" as const,
  model: "gpt-5.6-luna",
  max_tokens: 16384,
  timeout_seconds: 90,
  source: "environment" as const,
  version: 1,
  updated_at: null as string | null,
  error_code: null as string | null,
  service_mode: "functional-uat",
  adjustable: true,
  providers: [
    { provider: "openai" as const, credential_present: true, default_model: "gpt-4.1-mini" },
    { provider: "anthropic" as const, credential_present: false, default_model: "claude-haiku-4-5-20251001" },
  ],
};
let llmSettings = { ...LLM_SETTINGS_BASELINE };

const previewRasterAsset = {
  asset_id: "asset-raster-preview",
  case_id: "case-1",
  document_type: "CI",
  filename: "invoice-scan.png",
  media_type: "image/png",
  byte_size: 68,
  page_count: 1,
  pixel_count: 1,
  created_by: "local-reviewer",
  created_at: NOW,
};

const previewRasterTextEnvelope = {
  asset: previewRasterAsset,
  job: {
    raster_text_extraction_job_id: "raster-text-preview-job",
    asset_id: previewRasterAsset.asset_id,
    case_id: previewRasterAsset.case_id,
    profile_revision: "synthetic-raster-text-v1:preview",
    status: "needs_review",
    attempt_count: 1,
    result: {
      status: "needs_review",
      pages: [{ page_number: 1, text: "COMMERCIAL INVOICE\nInvoice No: CI-2026-0001\nTotal: USD 12,400.00", confidence: 0.976 }],
      canonical_text: "COMMERCIAL INVOICE\nInvoice No: CI-2026-0001\nTotal: USD 12,400.00",
      warnings: ["human_confirmation_required"],
      needs_review_reasons: ["ocr_low_confidence"],
    },
    created_by: "local-reviewer",
    created_at: NOW,
    updated_at: NOW,
  },
  idempotency_reused: false,
  current_profile_revision: "synthetic-raster-text-v1:preview",
  profile_superseded: false,
};

const api = {
  getSession: async () => ({
    subject: actor === "approver" ? "local-approver" : "local-reviewer",
    org_id: "local-org",
    roles: [actor],
  }),
  listCases: async () => ({ items: cases }),
  getCase: async (caseId: string) => cases.find((item) => item.case_id === caseId) ?? cases[0],
  // case-2 is deliberately empty so the empty states can be reviewed too.
  listDocuments: async (caseId: string) => caseId === "case-2" ? [] : documents,
  getDocumentContent: async (_caseId: string, documentId: string) => ({
    ...documents.find((item) => item.document_id === documentId),
    content_text: contents[documentId] ?? "",
  }),
  listDocumentAssets: async (caseId: string) => caseId === "case-1" ? [previewRasterAsset] : [],
  requestRasterTextExtraction: async () => previewRasterTextEnvelope,
  getRasterTextExtraction: async () => previewRasterTextEnvelope,
  getDocumentAssetSource: async () => {
    const encoded = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    return new Blob([Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))], { type: "image/png" });
  },
  confirmExtractedText: async () => documents[0],
  deleteCase: async () => undefined,
  listReviewRuns: async (caseId: string) => caseId === "case-2" ? [] : [runSummary],
  getReviewRun: async () => run,
  listAssistantConversations: async () => [conversation],
  listAssistantMessages: async () => messages,
  createAssistantConversation: async () => conversation,
  sendAssistantMessage: async () => ({ user_message: messages[0], assistant_message: messages[1] }),
  listCorrectionProposals: async () => [proposal],
  createCorrectionProposal: async () => proposal,
  decideCorrectionProposal: async () => proposal,
  enqueueRevision: async () => ({ job_id: "job-002", case_id: "case-1", review_run_id: "run-001", status: "succeeded", created_by: "local-approver", created_at: NOW, updated_at: NOW }),
  createCase: async () => cases[0],
  addDocument: async () => documents[0],
  enqueueReview: async () => ({ job_id: "job-001", case_id: "case-1", review_run_id: "run-001", status: "succeeded", created_by: "local-reviewer", created_at: NOW, updated_at: NOW }),
  getJob: async () => ({ job_id: "job-001", case_id: "case-1", review_run_id: "run-001", status: "succeeded", created_by: "local-reviewer", created_at: NOW, updated_at: NOW }),
  setFindingDecision: async (_runId: string, findingId: string, payload: { status: string; reason_code?: string | null; reason: string }) => {
    const reason = payload.reason || "표기·단위·반올림 차이로 실질 불일치 아님";
    const entry = { status: payload.status, reason_code: payload.reason_code ?? null, reason, decided_by: "local-reviewer", decided_at: NOW };
    return { finding_id: findingId, ...entry, history: [entry] };
  },
  getDemoFallback: async () => ({
    settings: { mode: "auto" as const, delay_seconds: 4, updated_by: "local-approver", updated_at: NOW },
    sets: [
      {
        fallback_id: "fallback-001", name: "시연 1 · 티셔츠 수입", source_case_id: "case-1", source_case_title: "입항 서류 검토 · 티셔츠",
        source_review_run_id: "run-001",
        documents: [
          { document_id: "doc-1", filename: "C0001_INV.pdf", document_type: "CI", content_sha256: "a".repeat(64) },
          { document_id: "doc-2", filename: "C0001_PL.pdf", document_type: "PL", content_sha256: "b".repeat(64) },
          { document_id: "doc-3", filename: "C0001_BL.pdf", document_type: "BL", content_sha256: "c".repeat(64) },
          { document_id: "doc-4", filename: "C0001_CO.pdf", document_type: "CO", content_sha256: "d".repeat(64) },
        ],
        has_hs_ranking: true, finding_count: 4, created_by: "local-approver", created_at: NOW, used_count: 2, last_used_at: NOW,
      },
      {
        fallback_id: "fallback-002", name: "시연 2 · 다품목", source_case_id: "case-2", source_case_title: "다품목 송장",
        source_review_run_id: "run-002",
        documents: [
          { document_id: "doc-5", filename: "M0001_INV.pdf", document_type: "CI", content_sha256: "e".repeat(64) },
          { document_id: "doc-6", filename: "M0001_PL.pdf", document_type: "PL", content_sha256: "f".repeat(64) },
        ],
        has_hs_ranking: false, finding_count: 6, created_by: "local-approver", created_at: NOW, used_count: 0, last_used_at: null,
      },
    ],
  }),
  updateDemoFallback: async (update: { mode?: "off" | "auto" | "always"; delay_seconds?: number }) => ({
    settings: { mode: update.mode ?? ("auto" as const), delay_seconds: update.delay_seconds ?? 4, updated_by: "local-approver", updated_at: NOW },
    sets: [],
  }),
  registerDemoFallbackSet: async () => ({ settings: { mode: "auto" as const, delay_seconds: 4, updated_by: null, updated_at: null }, sets: [] }),
  deleteDemoFallbackSet: async () => ({ settings: { mode: "auto" as const, delay_seconds: 4, updated_by: null, updated_at: null }, sets: [] }),
  getCaseHsClassification: async () => ({
    case_id: "case-1",
    basis_kind: "agent_ranked" as const,
    agent_ranked_at: NOW,
    reference: { as_of: "2026-01-01", source: "관세청 HS부호 단위별 품목명 (미리보기 고정값)" },
    candidates: [],
    items: [
      {
        item_id: "item-tshirts",
        description: "MEN'S COTTON T-SHIRTS",
        document_ids: ["doc-1"],
        cited_hs_codes: [],
        candidates: [
          {
            code: "6109101000", name_ko: "티셔츠·싱글리트와 그 밖의 조끼(면으로 만든 것)", name_en: "T-shirts, of cotton",
            ancestors: [{ level: 2, code: "61", name_ko: "의류와 그 부속품(메리야스 편물이나 뜨개질 편물로 한정한다)" }, { level: 4, code: "6109", name_ko: "티셔츠·싱글리트와 그 밖의 조끼" }],
            confidence: 0.93, in_reference: true, recommended: true, origin: "llm_match" as const,
            explanation: "면 소재의 남성용 티셔츠로 메리야스 편물 의류에 해당합니다.",
            basis: [{ document_id: "doc-1", fact_id: "agent-item-1", fact_name: "description", raw_value: "MEN'S COTTON T-SHIRTS" }],
          },
          {
            code: "6105100000", name_ko: "셔츠(면으로 만든 것)", name_en: "Shirts, of cotton",
            ancestors: [{ level: 2, code: "61", name_ko: "의류와 그 부속품" }, { level: 4, code: "6105", name_ko: "남자용이나 소년용 셔츠" }],
            confidence: 0.31, in_reference: true, recommended: false, origin: "llm_match" as const,
            explanation: "칼라·단추가 있는 셔츠라면 해당하나 서류 품명은 티셔츠입니다.",
            basis: [{ document_id: "doc-1", fact_id: "agent-item-1", fact_name: "description", raw_value: "MEN'S COTTON T-SHIRTS" }],
          },
        ],
      },
      {
        item_id: "item-mackerel",
        description: "FROZEN MACKEREL, WHOLE",
        document_ids: ["doc-1"],
        cited_hs_codes: ["030354"],
        candidates: [
          {
            code: "0303540000", name_ko: "고등어(냉동한 것)", name_en: "Mackerel, frozen",
            ancestors: [{ level: 2, code: "03", name_ko: "어류·갑각류·연체동물" }, { level: 4, code: "0303", name_ko: "냉동 어류" }],
            confidence: 0.97, in_reference: true, recommended: true, origin: "llm_match" as const,
            explanation: "통째로 냉동한 고등어입니다.",
            basis: [{ document_id: "doc-1", fact_id: "agent-item-2", fact_name: "description", raw_value: "FROZEN MACKEREL, WHOLE" }],
          },
        ],
        selection: {
          code: "0303540000", reason: "AI 추천 1순위 확정", selected_by: "local-reviewer", selected_at: NOW,
          history: [{ code: "0303540000", reason: "AI 추천 1순위 확정", selected_by: "local-reviewer", selected_at: NOW }],
          item_id: "item-mackerel", description: "FROZEN MACKEREL, WHOLE",
        },
      },
    ],
  }),
  recordCaseHsSelection: async (_caseId: string, payload: { code: string; reason: string; item_id?: string; description?: string }) => ({
    code: payload.code,
    reason: payload.reason,
    selected_by: "local-reviewer",
    selected_at: NOW,
    history: [{ code: payload.code, reason: payload.reason, selected_by: "local-reviewer", selected_at: NOW }],
    ...(payload.item_id ? { item_id: payload.item_id, description: payload.description ?? "" } : {}),
  }),
  getHsClassification: async () => ({
    review_run_id: "run-001",
    case_id: "case-1",
    reference: { as_of: "2026-01-01", source: "관세청 HS부호 단위별 품목명 (미리보기 고정값)" },
    candidates: [
      {
        code: "8517621000",
        name_ko: "유선 송신용 기기",
        name_en: "Wired transmission apparatus",
        ancestors: [
          { level: 2, code: "85", name_ko: "전기기기와 그 부분품" },
          { level: 4, code: "8517", name_ko: "전화기와 기타 음성·영상 송수신 기기" },
        ],
        confidence: 1,
        in_reference: true,
        recommended: true,
        basis: [{ document_id: "doc-1", fact_id: "fact-hs", fact_name: "hs_code", raw_value: "8517.62-1000" }],
      },
    ],
  }),
  searchLaws: async (query: string) => ({
    query: query.trim(),
    as_of: "2026-08-05",
    results: [
      {
        law_id: "LAW-226",
        law_name: "관세법",
        article_no: "제226조",
        title: "관세법 제226조(허가ㆍ승인 등의 증명 및 확인)",
        text: "수출입을 할 때 허가ㆍ승인 등의 조건을 갖출 필요가 있는 물품은 이를 증명하여야 한다. (미리보기 고정값)",
        source_uri: "https://www.law.go.kr/법령/관세법/제226조",
        valid_from: "2024-01-01",
        valid_to: null,
        score: 0.91,
      },
    ],
  }),
  getLawCatalog: async () => ({
    as_of: "2026-08-05",
    laws: [
      { law_id: "LAW-226", law_name: "관세법", hierarchy: "법률", article_count: 280 },
      { law_id: "LAW-DEC", law_name: "관세법 시행령", hierarchy: "대통령령", article_count: 190 },
      { law_id: "LAW-FTA", law_name: "자유무역협정의 이행을 위한 관세법의 특례에 관한 법률", hierarchy: "법률", article_count: 46 },
    ],
  }),
  // Hidden #/admin page: mutable so 저장/되돌리기 reflect in the preview.
  getLlmSettings: async () => ({ ...llmSettings }),
  updateLlmSettings: async (update: { provider?: "openai" | "anthropic"; model?: string; max_tokens?: number; timeout_seconds?: number }) => {
    const provider = update.provider ?? llmSettings.provider;
    const providerChanged = provider !== llmSettings.provider;
    llmSettings = {
      ...llmSettings,
      provider,
      model: update.model ?? (providerChanged ? llmSettings.providers.find((entry) => entry.provider === provider)?.default_model ?? llmSettings.model : llmSettings.model),
      max_tokens: update.max_tokens ?? llmSettings.max_tokens,
      timeout_seconds: update.timeout_seconds ?? llmSettings.timeout_seconds,
      source: "override" as const,
      version: llmSettings.version + 1,
      updated_at: new Date().toISOString(),
    };
    return { ...llmSettings };
  },
  resetLlmSettings: async () => {
    llmSettings = { ...LLM_SETTINGS_BASELINE, version: llmSettings.version + 1 };
    return { ...llmSettings };
  },
  testLlmSettings: async (update: { model?: string } = {}) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const model = update.model ?? llmSettings.model;
    const ok = !model.includes("bad");
    return { ok, provider: llmSettings.provider, model, latency_ms: ok ? 842 : 1203, error_code: ok ? null : "provider_request_failed" };
  },
  getOperationsMetrics: async () => ({
    generated_at: NOW,
    cases: { total: 3, open: 1, in_review: 1, closed: 1 },
    reviews: { total: 4, revisions: 1, no_issue_detected: 1, issues_detected: 3, indeterminate: 0, succeeded: 4, partial: 0, failed: 0 },
    findings: { total: 2, decided: 1, open: 1 },
    closures: { cleared: 1, returned: 0 },
    review_load: {
      cases_with_findings: 2,
      cases_without_findings: 1,
      comparisons: { total: 14, passed: 9, mismatch: 3, needs_review: 1, skipped: 1 },
      findings_by_code: [
        { code: "invoice_packing_quantity_unit", count: 3 },
        { code: "hs_code_presence", count: 2 },
        { code: "invoice_total_amount", count: 1 },
      ],
      decision_statuses: { confirmed: 2, needs_information: 1, resolved: 1 },
      decision_reason_codes: [
        { code: "notation_difference", count: 2 },
        { code: "supplement_requested", count: 1 },
        { code: "uncoded", count: 1 },
      ],
    },
    daily_reviews: [
      "2026-07-23", "2026-07-24", "2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29",
      "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05",
    ].map((date, index) => ({ date, count: [0, 1, 0, 0, 2, 0, 1, 0, 0, 0, 1, 0, 0, 3][index] ?? 0 })),
  }),
  searchHskReference: async (query: string) => {
    const trimmed = query.trim();
    const compact = trimmed.replace(/ /gu, "");
    const isCode = /^[0-9]{1,10}$/u.test(compact);
    const rows = [
      { code: "8517621000", name_ko: "유선 송신용 기기", name_en: "Wired transmission apparatus", ancestors: [{ level: 2, code: "85", name_ko: "전기기기와 그 부분품" }, { level: 4, code: "8517", name_ko: "전화기와 기타 음성·영상 송수신 기기" }] },
      { code: "8517629000", name_ko: "기타 송수신 기기", name_en: "Other transmission apparatus", ancestors: [{ level: 2, code: "85", name_ko: "전기기기와 그 부분품" }, { level: 4, code: "8517", name_ko: "전화기와 기타 음성·영상 송수신 기기" }] },
      { code: "6109101000", name_ko: "티셔츠", name_en: "T-shirts", ancestors: [{ level: 2, code: "61", name_ko: "의류(편물제)" }, { level: 4, code: "6109", name_ko: "티셔츠·싱글리트와 그 밖의 조끼" }] },
      { code: "0303540000", name_ko: "고등어", name_en: "Mackerel", ancestors: [{ level: 2, code: "03", name_ko: "어류·갑각류" }, { level: 4, code: "0303", name_ko: "냉동어류" }] },
    ];
    // Mirrors the Backend's two phases: rows matching every word first,
    // otherwise rows matching any word with the view flagged partial.
    const tokens = trimmed.toLowerCase().split(/\s+/u).filter(Boolean);
    const rowText = (row: { name_ko: string; name_en: string }) => `${row.name_ko} ${row.name_en}`.toLowerCase();
    let results: typeof rows;
    let partial = false;
    if (isCode) {
      results = rows.filter((row) => row.code.startsWith(compact));
    } else {
      results = rows.filter((row) => tokens.every((token) => rowText(row).includes(token)));
      if (results.length === 0) {
        results = rows.filter((row) => tokens.some((token) => rowText(row).includes(token)));
        partial = results.length > 0;
      }
    }
    return {
      query: trimmed,
      mode: isCode ? "code_prefix" : "name",
      results: results.slice(0, 12),
      truncated: results.length > 12,
      partial,
      reference: { as_of: "2026-01-01", source: "관세청 HS부호 단위별 품목명 (미리보기 고정값)" },
    };
  },
  recordHsSelection: async (_runId: string, payload: { code: string; reason: string }) => ({
    code: payload.code,
    reason: payload.reason,
    selected_by: "local-reviewer",
    selected_at: NOW,
    history: [{ code: payload.code, reason: payload.reason, selected_by: "local-reviewer", selected_at: NOW }],
  }),
  getOriginVerification: async () => ({
    review_run_id: "run-001",
    case_id: "case-1",
    status: "missing_certificate",
    origin_country: "CN",
    checks: [],
    fta_hints: [
      {
        agreement_code: "KR-CN",
        agreement_name: "한-중 FTA",
        origin_covered: true,
        certificate_form: "원산지증명서 (한-중 FTA 서식)",
        source_uri: "https://www.customs.go.kr/ftaportalkor/main.do",
      },
    ],
  }),
  getDutyAssessment: async () => ({
    review_run_id: "run-001",
    case_id: "case-1",
    status: "estimated",
    reference: {
      as_of: "2026-01-01",
      source: "관세율 스냅샷 (미리보기 고정값)",
      disclaimer: "참조용 스냅샷 세율입니다. 실제 적용 세율은 UNI-PASS에서 확인해야 합니다.",
    },
    hs_code: { code: "8517621000", source: "document_fact", name_ko: "유선 송신용 기기" },
    origin_country: "CN",
    dutiable_value: { amount: 12400, currency: "USD", basis: "invoice_total_amount", document_id: "doc-1" },
    rates: [
      {
        rate_kind: "basic",
        label: "기본세율",
        rate_pct: 8,
        source_uri: "https://unipass.customs.go.kr/clip/index.do",
        requirements: [],
        applicable: true,
      },
      {
        rate_kind: "fta",
        agreement_code: "KR-CN",
        label: "한-중 FTA 협정세율",
        rate_pct: 0,
        source_uri: "https://unipass.customs.go.kr/clip/index.do",
        requirements: [
          { code: "origin_in_agreement", satisfied: true },
          { code: "certificate_present", satisfied: false },
          { code: "certificate_origin_match", satisfied: false },
        ],
        applicable: false,
      },
    ],
    applied: {
      rate_kind: "basic",
      rate_pct: 8,
      duty_amount: 992,
      vat_rate_pct: 10,
      vat_amount: 1339.2,
      total_estimated: 2331.2,
      currency: "USD",
    },
    savings: { vs_basic_duty: 0, currency: "USD", blocked_requirements: ["certificate_present", "certificate_origin_match"] },
  }),
};

const auth = {
  isAuthenticated: () => true,
  freshAccessToken: async () => "preview-token",
  logout: async () => undefined,
  switchActor: async (next: "reviewer" | "approver") => { actor = next; },
};

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("preview root is missing");
const app = new LightweightWorkbench(root, api as never, auth, "local-development");
void app.start();
