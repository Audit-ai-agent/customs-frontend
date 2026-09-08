/**
 * Pure display helpers shared by the workspace components. Nothing here touches the
 * DOM or the API client, so every one of these stays trivially testable.
 */
import { isDocumentSource } from "../api/v1/types";
import { userFacingErrorMessage } from "../api/user-facing-errors";
import type {
  AssistantCitation,
  AssistantMessage,
  CorrectionDecision,
  CorrectionProposal,
  DocumentFact,
  DocumentType,
  FindingDecisionReasonCode,
  ExtractionJob,
  ExtractionPreview,
  RasterTextExtractionEnvelope,
  RasterTextExtractionJob,
  RasterTextExtractionPreview,
  ReportClaim,
  ReportSection,
  ReviewComparison,
  ReviewFinding,
  ReviewRun,
  ReviewerDecision,
  SourceReference,
} from "../api/v1/types";

export function roleLabel(value: string): string {
  const labels: Record<string, string> = { reviewer: "심사자", approver: "승인자" };
  return labels[value] ?? value;
}

export function providerLabel(value: string): string {
  const labels: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic (Claude)" };
  return labels[value] ?? value;
}

export function display(value: string): string {
  const labels: Record<string, string> = {
    open: "진행 전", in_review: "검토 중", closed: "종료", queued: "대기", running: "처리 중", succeeded: "완료", failed: "실패",
    partial: "부분 완료", no_issue_detected: "주요 이슈 없음", issues_detected: "확인 사항 있음", indeterminate: "판단 보류",
    human_review_required: "사람 검토 필요", blocked: "차단됨", completed: "완료", skipped: "건너뜀", needs_review: "검토 필요",
  };
  return labels[value] ?? value;
}

export function workflowLabel(value: string): string {
  const labels: Record<string, string> = {
    classify_documents: "문서 유형 판별", extract_facts: "문서 사실 추출", normalize_facts: "값 정규화", match_documents: "문서·품목 대응",
    validate_documents: "정합성 검사", reextract_documents: "제한 재추출", retrieve_evidence: "법령정보 조회", generate_result: "검토 결과 생성",
  };
  return labels[value] ?? value;
}

export function plannerActionLabel(value: string): string {
  const labels: Record<string, string> = {
    analyze_documents: "문서 분석",
    apply_human_corrections: "승인된 사람 수정 반영",
    compare_documents: "문서·품목 비교",
    reextract_documents: "제한 재추출",
    retrieve_evidence: "법령정보 일괄 조회",
    generate_report: "근거 기반 보고서 생성",
  };
  return labels[value] ?? value;
}

export function reportSectionDescription(section: ReportSection["section"]): string {
  const labels: Record<ReportSection["section"], string> = {
    conclusion: "현재 심사 실행의 결론과 사람 검토 경계를 설명합니다.",
    execution_process: "실제로 수행한 제한형 Agent workflow를 설명합니다.",
    document_comparison: "문서·품목 대응과 코드 기반 비교 결과를 설명합니다.",
    issues_and_causes: "확인 사항과 판단 보류가 필요한 원인을 설명합니다.",
    legal_evidence: "연결된 법령정보가 어떤 근거인지 설명합니다.",
    impact: "현재 결과가 업무 검토에 미치는 영향을 설명합니다.",
    next_actions: "사람이 이어서 수행할 조치를 설명합니다.",
    limitations: "입력·근거·텍스트 범위의 한계를 설명합니다.",
  };
  return labels[section];
}

export function documentAnalysisLabel(value: string): string {
  const labels: Record<string, string> = {
    invoice: "Commercial Invoice",
    packing_list: "Packing List",
    bill_of_lading: "Bill of Lading",
    certificate_of_origin: "Certificate of Origin",
    air_waybill: "Air Waybill",
    export_declaration: "수출신고서",
    supporting_evidence: "보완 증빙",
    unknown: "문서 유형 확인 필요",
  };
  return labels[value] ?? value;
}

export function assistantScopeLabel(value: NonNullable<AssistantMessage["answer_scope"]>): string {
  const labels: Record<NonNullable<AssistantMessage["answer_scope"]>, string> = {
    case_grounded: "Case 근거 답변",
    evidence_grounded: "법령정보 근거 답변",
    general_customs_guidance: "일반 통관 안내 · 사건 판단 아님",
    clarification_needed: "추가 확인 필요",
    insufficient_evidence: "근거 부족",
    out_of_scope: "답변 범위 밖",
  };
  return labels[value];
}

export function citationLabel(citation: AssistantCitation): string {
  const labels: Record<AssistantCitation["kind"], string> = {
    fact: "문서 사실",
    comparison: "문서 비교",
    evidence: "법령정보",
  };
  return `${labels[citation.kind]} · ${citation.reference_id.slice(0, 18)}`;
}

export function assistantSuggestions(run: ReviewRun, messages: AssistantMessage[]): string[] {
  const fromLatestAnswer = [...messages].reverse().find((item) => item.role === "assistant")?.suggested_questions ?? [];
  if (fromLatestAnswer.length) return fromLatestAnswer;
  const suggestions: string[] = [];
  if (run.findings.length) suggestions.push("가장 우선해서 확인할 항목과 그 근거를 알려줘");
  if (run.comparisons.length) suggestions.push("문서 간 비교에서 확인이 필요한 값은 무엇이야?");
  if (run.evidence.length) suggestions.push("연결된 법령정보가 이 Case와 어떻게 관련되는지 알려줘");
  return suggestions.slice(0, 3);
}

export function documentTypeLabel(value: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    CI: "Commercial Invoice",
    PL: "Packing List",
    BL: "Bill of Lading",
    CO: "Certificate of Origin",
    AWB: "Air Waybill",
    EXPORT_DECLARATION: "수출신고서",
    SUPPORTING_EVIDENCE: "보완 증빙",
    UNKNOWN: "미분류",
  };
  return labels[value];
}

export function extractionStatusLabel(value: ExtractionJob["status"]): string {
  const labels: Record<ExtractionJob["status"], string> = {
    queued: "추출 대기",
    preview_ready: "추출 완료 · 검수 필요",
    needs_review: "부분 추출 · 검수 필요",
    unavailable: "자동 추출 불가",
    failed: "추출 실패",
  };
  return labels[value];
}

/**
 * "unavailable" covers two very different situations: the Agent's extraction
 * engine is not activated in this environment (warning code
 * `preview_engine_unavailable`), or an active engine found no readable text in
 * this specific file. Blaming the file for an environment gate misleads users.
 */
export function extractionUnavailableMessage(warnings: readonly string[] | undefined): string {
  if (warnings?.includes("preview_engine_unavailable")) {
    return "이 환경에는 자동 추출 엔진이 아직 활성화되지 않았습니다. 파일 문제가 아닙니다. 아래 텍스트 등록 양식으로 원문을 직접 등록하십시오.";
  }
  return "이 파일에서 읽을 수 있는 텍스트를 찾지 못했습니다. 스캔·이미지 OCR은 제공하지 않으므로, 아래 텍스트 등록 양식으로 원문을 직접 등록하십시오.";
}

/** Joins the preview spans into the editable text the reviewer confirms. */
export function extractionPreviewText(preview: ExtractionPreview): string {
  return [...preview.pages]
    .sort((left, right) => left.page_number - right.page_number)
    .flatMap((page) => [...page.spans].sort((a, b) => a.reading_order - b.reading_order || a.ordinal - b.ordinal))
    .map((span) => span.text)
    .join("\n");
}

export function rasterTextExtractionStatusLabel(value: RasterTextExtractionJob["status"]): string {
  const labels: Record<RasterTextExtractionJob["status"], string> = {
    queued: "OCR 대기",
    running: "OCR 처리 중",
    preview_ready: "OCR 초안 준비됨",
    needs_review: "OCR 추가 확인 필요",
    unavailable: "OCR 초안 제공 불가",
    failed: "OCR 처리 실패",
  };
  return labels[value];
}

export function rasterTextPreviewText(preview: RasterTextExtractionPreview | null | undefined): string {
  if (preview?.canonical_text?.trim()) return preview.canonical_text;
  return [...(preview?.pages ?? [])]
    .sort((left, right) => left.page_number - right.page_number)
    .map((page) => page.text)
    .join("\n\f\n");
}

export function rasterTextWarningLabel(code: string): string {
  const labels: Readonly<Record<string, string>> = {
    human_confirmation_required: "원본과 대조한 사람 확인이 필요합니다.",
    ocr_low_confidence: "일부 글자 인식 신뢰도가 낮을 수 있습니다.",
    raster_text_profile_unavailable: "현재 사용할 수 있는 OCR 텍스트 프로필이 없습니다.",
    raster_text_profile_superseded: "OCR 프로필이 바뀌어 이전 초안을 사용할 수 없습니다.",
    unsupported_document_type: "현재 OCR 지원 범위 밖의 문서 유형입니다.",
    multi_page_pdf_unsupported: "현재 OCR은 단일 페이지 PDF만 지원합니다.",
    jpeg_exif_orientation_unsupported: "회전 정보가 있는 JPEG는 안전하게 처리하지 않습니다.",
  };
  return labels[code] ?? "OCR 텍스트 초안에 추가 확인이 필요합니다.";
}

export function rasterTextExtractionNotice(envelope: RasterTextExtractionEnvelope): string {
  if (envelope.profile_superseded) {
    return "현재 OCR 프로필이 바뀌었습니다. 이전 초안은 등록할 수 없으므로 새 OCR 요청을 실행하십시오.";
  }
  const descriptions: Record<RasterTextExtractionJob["status"], string> = {
    queued: "OCR 작업이 대기열에 등록되었습니다.",
    running: "OCR 텍스트를 처리하고 있습니다.",
    preview_ready: "원본과 대조해 수정할 OCR 텍스트 초안이 준비되었습니다.",
    needs_review: "일부 OCR 텍스트가 불확실할 수 있으므로 원본 대조가 필요합니다.",
    unavailable: "현재 문서의 OCR 텍스트 초안을 제공할 수 없습니다.",
    failed: "OCR 텍스트 처리를 완료하지 못했습니다.",
  };
  return `${rasterTextExtractionStatusLabel(envelope.job.status)}. ${descriptions[envelope.job.status]}`;
}

/**
 * Reviewer-facing titles for the Agent's rule and finding codes. The code
 * itself is an internal identifier; it never becomes the card title. Unknown
 * codes fall back to a neutral Korean title rather than the raw token.
 */
const RULE_TITLES: Readonly<Record<string, string>> = {
  document_type_classification: "문서 유형 판별 확인",
  document_pair_selection: "비교 대상 문서 선택 확인",
  invoice_packing_item_match: "Invoice·Packing List 품목 대응",
  invoice_packing_quantity_unit: "Invoice·Packing List 수량·단위 비교",
  invoice_line_amount: "Invoice 품목 금액 계산 확인",
  invoice_total_amount: "Invoice 합계 금액 확인",
  invoice_certificate_origin: "Invoice·원산지증명서 원산지 비교",
  export_declaration_presence: "수출신고서 유무 확인",
  export_declaration_destination_country: "수출신고서 목적국 비교",
  export_destination_country_missing: "수출 목적국 정보 누락",
  invoice_export_declaration_item_match: "Invoice·수출신고서 품목 대응",
  invoice_export_declaration_quantity_unit: "Invoice·수출신고서 수량·단위 비교",
  hs_code_presence: "HS 부호 기재 확인",
  required_field_presence: "필수 기재 항목 누락",
  field_source_invalid: "추출 값 원문 근거 확인",
  line_item_field_source_invalid: "품목 값 원문 근거 확인",
  line_item_source_invalid: "품목 원문 근거 확인",
  classification_source_invalid: "문서 유형 원문 근거 확인",
  data_readiness_invalid: "법령 데이터 준비 상태 확인",
  data_contract_invalid: "법령 데이터 계약 확인",
  guidance_contract_invalid: "안내 자료 계약 확인",
  guidance_registry_version_mismatch: "안내 자료 버전 불일치",
};

export function ruleTitle(code: string): string {
  return RULE_TITLES[code] ?? "담당자 확인 사항";
}

export function findingTitle(finding: Pick<ReviewFinding, "code" | "kind">): string {
  const known = RULE_TITLES[finding.code];
  if (known) return known;
  return finding.kind === "regulatory_finding" ? "법령 요건 확인 사항" : "문서 정합성 확인 사항";
}

export function actionLabel(code: string): string {
  const labels: Readonly<Record<string, string>> = {
    human_review_required: "담당자 검토 필요",
    inspect_quantity: "수량 확인",
  };
  return labels[code] ?? "담당자 조치";
}

export function evidenceSourceTypeLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    law: "법령",
    customs_requirement: "통관 요건",
    guidance: "공식 안내",
  };
  return labels[value] ?? "참고 자료";
}

/** Reviewer-facing name for a document field the Agent extracted. */
export function fieldLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    quantity: "수량", unit: "단위", amount: "금액", total_amount: "합계 금액", unit_price: "단가", currency: "통화",
    hs_code: "HS 부호", origin_country: "원산지", destination_country: "목적국", description: "품명",
    invoice_number: "Invoice 번호", invoice_date: "Invoice 일자", gross_weight: "총중량", net_weight: "순중량",
    consignee: "수하인", shipper: "송하인", certificate_no: "증명서 번호",
  };
  return labels[value] ?? value.replace(/_/gu, " ");
}

export const DECISION_REASON_OPTIONS: ReadonlyArray<{ code: FindingDecisionReasonCode; label: string }> = [
  { code: "document_verified", label: "원본 서류 대조 결과 이상 없음" },
  { code: "notation_difference", label: "표기·단위·반올림 차이로 실질 불일치 아님" },
  { code: "supplement_requested", label: "신고인에게 보완 자료 요청" },
  { code: "correction_proposed", label: "정정 제안으로 처리" },
  { code: "requirement_satisfied", label: "법령 요건 충족 확인" },
  { code: "requirement_not_applicable", label: "해당 요건 미적용 대상" },
  { code: "other", label: "기타 (직접 기재)" },
];

export function decisionReasonLabel(code: FindingDecisionReasonCode | null | undefined): string | null {
  if (!code) return null;
  return DECISION_REASON_OPTIONS.find((option) => option.code === code)?.label ?? null;
}

export function severityLabel(value: ReviewFinding["severity"]): string {
  const labels: Record<ReviewFinding["severity"], string> = { critical: "긴급", high: "높음", medium: "보통", low: "낮음" };
  return labels[value];
}

export function severityWeight(value: ReviewFinding["severity"]): number {
  return ({ critical: 4, high: 3, medium: 2, low: 1 })[value];
}

/** The mockup's four-level severity chip. Maps the API severity onto the KRDS tone. */
export function severityTone(value: ReviewFinding["severity"]): "hi" | "md" | "ok" {
  if (value === "critical" || value === "high") return "hi";
  if (value === "medium") return "md";
  return "ok";
}

export function comparisonStatusLabel(value: ReviewComparison["status"]): string {
  const labels: Record<ReviewComparison["status"], string> = { pass: "일치", skip: "비교 제외", mismatch: "불일치", needs_review: "검토 필요" };
  return labels[value];
}

export function decisionStatusLabel(value: ReviewerDecision["status"]): string {
  const labels: Record<ReviewerDecision["status"], string> = { confirmed: "확인함", needs_information: "추가자료 요청", resolved: "해결됨" };
  return labels[value];
}

export function correctionStatusLabel(value: CorrectionProposal["status"] | CorrectionDecision["status"]): string {
  const labels: Record<CorrectionProposal["status"] | CorrectionDecision["status"], string> = {
    proposed: "제안됨",
    approved: "승인됨",
    rejected: "반려됨",
  };
  return labels[value];
}

export function correctionHistoryLabel(value: CorrectionProposal["history"][number]["event"]): string {
  const labels: Record<CorrectionProposal["history"][number]["event"], string> = {
    proposed: "제안 기록",
    approved: "승인",
    rejected: "반려",
    applied: "자식 심사 반영",
  };
  return labels[value];
}

export function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "확인 불가";
}

export function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

/** A calendar date such as the review basis date, without a time of day. */
export function formatDay(value: string): string {
  const parsed = /^\d{4}-\d{2}-\d{2}$/u.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(parsed);
}

export function userMessage(error: unknown, fallback: string): string {
  return userFacingErrorMessage(error, fallback);
}

export function sourceForFinding(run: ReviewRun, finding: ReviewFinding): SourceReference | null {
  for (const analysis of run.document_analyses) {
    for (const fact of [...analysis.facts, ...analysis.line_items.flatMap((item) => item.facts)]) {
      if (finding.fact_ids.includes(fact.fact_id) && isDocumentSource(fact.source)) return fact.source;
    }
  }
  return null;
}

export function sourceForOperand(run: ReviewRun, operand: ReviewComparison["left"]): SourceReference | null {
  if (operand.document_id === null) return null;
  for (const analysis of run.document_analyses) {
    if (analysis.document_id !== operand.document_id) continue;
    for (const fact of [...analysis.facts, ...analysis.line_items.flatMap((item) => item.facts)]) {
      if (operand.fact_ids.includes(fact.fact_id) && isDocumentSource(fact.source)) return fact.source;
    }
  }
  return null;
}

export function findFact(run: ReviewRun, factId: string): DocumentFact | null {
  for (const analysis of run.document_analyses) {
    for (const fact of [...analysis.facts, ...analysis.line_items.flatMap((item) => item.facts)]) {
      if (fact.fact_id === factId) return fact;
    }
  }
  return null;
}

export function mergeAssistantMessages(
  current: AssistantMessage[],
  userMessageItem: AssistantMessage,
  assistantMessage: AssistantMessage,
): AssistantMessage[] {
  const byId = new Map(current.map((item) => [item.message_id, item]));
  byId.set(userMessageItem.message_id, userMessageItem);
  byId.set(assistantMessage.message_id, assistantMessage);
  return [...byId.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export function groundedCitations(claim: ReportClaim): AssistantCitation[] {
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

/** Index of the nth occurrence of `quote`, or -1 when the document no longer contains it. */
export function occurrenceIndex(content: string, quote: string, occurrence: number): number {
  let offset = -1;
  for (let index = 0; index <= occurrence; index += 1) {
    offset = content.indexOf(quote, offset + 1);
    if (offset < 0) return -1;
  }
  return offset;
}

export function scrollIntoViewIfAvailable(element: Element | null | undefined): void {
  const target = element as (Element & { scrollIntoView?: (options?: ScrollIntoViewOptions) => void }) | null | undefined;
  if (typeof target?.scrollIntoView === "function") target.scrollIntoView({ block: "center" });
}

/**
 * Scrolls the node carrying `attribute="value"` into view. Matching by attribute value
 * rather than a selector keeps identifiers with CSS-significant characters working.
 */
export function focusDataTarget(container: Element | null, attribute: string, value: string): void {
  if (!container) return;
  const match = Array.from(container.querySelectorAll<HTMLElement>(`[${attribute}]`))
    .find((node) => node.getAttribute(attribute) === value);
  scrollIntoViewIfAvailable(match);
}

/** Only http(s) sources become links; anything else is reported as undisplayable. */
export function safeExternalHref(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.href;
  } catch {
    return null;
  }
}
