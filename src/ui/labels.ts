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
  ExtractionJob,
  ExtractionPreview,
  FindingDecisionReasonCode,
  RasterExtractionEnvelope,
  RasterExtractionJob,
  RasterExtractionPreview,
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
  bill_packing_bl_no: "B/L·포장명세서 B/L 번호 비교",
  bill_packing_container: "B/L·포장명세서 컨테이너 번호 비교",
  bill_packing_gross_weight: "B/L·포장명세서 총중량 비교",
  awb_packing_awb_no: "AWB·포장명세서 AWB 번호 비교",
  awb_packing_gross_weight: "AWB·포장명세서 총중량 비교",
  invoice_export_declaration_hs_code: "Invoice·수출신고서 HS 부호 비교",
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

/** The generic category of a finding, shown as a small tag beside its specific title. */
export function findingKindLabel(finding: Pick<ReviewFinding, "kind">): string {
  return finding.kind === "regulatory_finding" ? "법령 요건 확인 사항" : "문서 정합성 확인 사항";
}

/** The first sentence of an Agent message, for use as a title when no rule title exists. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = /^(.+?[.!?。])(?:\s|$)/u.exec(trimmed);
  return (match?.[1] ?? trimmed).replace(/[.!?。]$/u, "").trim();
}

/**
 * Card title: the finding's own rule title → the linked comparison's rule title →
 * the first sentence of the message. Never the generic category.
 */
export function findingDisplayTitle(
  finding: Pick<ReviewFinding, "code" | "kind" | "message">,
  comparison?: Pick<ReviewComparison, "rule_code"> | null,
): string {
  const own = RULE_TITLES[finding.code];
  if (own) return own;
  const linked = comparison ? RULE_TITLES[comparison.rule_code] : undefined;
  if (linked) return linked;
  const sentence = firstSentence(reviewerSentence(finding.message));
  return sentence || findingKindLabel(finding);
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
const FIELD_LABELS: Readonly<Record<string, string>> = {
  quantity: "수량", unit: "단위", amount: "금액", total_amount: "합계 금액", total: "합계", unit_price: "단가", currency: "통화",
  hs_code: "HS 부호", origin_country: "원산지", country_of_origin: "원산지", destination_country: "목적국", description: "품명",
  invoice_number: "Invoice 번호", invoice_no: "Invoice 번호", invoice_date: "Invoice 일자",
  gross_weight: "총중량", gross_weight_kg: "총중량(kg)", net_weight: "순중량", net_weight_kg: "순중량(kg)",
  consignee: "수하인", shipper: "송하인", exporter: "수출자", importer: "수입자", certificate_no: "증명서 번호",
  packing_no: "포장명세서 번호", packing_list_no: "포장명세서 번호", shipping_marks: "선적 표시(Shipping Marks)",
  bl_no: "B/L 번호", awb_no: "AWB 번호", container_numbers: "컨테이너 번호", container_no: "컨테이너 번호",
  port_of_loading: "선적항", port_of_discharge: "양륙항", vessel: "선박명", vessel_name: "선박명",
  incoterms: "인도조건(Incoterms)", payment_terms: "결제 조건", packages: "포장 수", package_count: "포장 수",
  item_no: "품목 번호", awb_number: "AWB 번호", bl_number: "B/L 번호",
};

export function fieldLabel(value: string): string {
  return FIELD_LABELS[value] ?? value.replace(/_/gu, " ");
}

/** The Korean label for a known extraction field key, or null when the value is not a field key. */
export function knownFieldLabel(value: string): string | null {
  return FIELD_LABELS[value.trim()] ?? null;
}

const FIELD_KEY_TOKEN = /(?<![A-Za-z0-9_])[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?![A-Za-z0-9_])/gu;

/**
 * A compared value that is really a field key (`hs_code`, `packing_no`) is shown by its
 * Korean label; every other value is shown as-is (or as "확인 불가" when empty).
 */
export function displayComparisonValue(value: string | null | undefined): string {
  const shown = displayValue(value);
  const known = knownFieldLabel(shown);
  if (known) return known;
  return /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/u.test(shown) ? fieldLabel(shown) : shown;
}

/** Replaces raw field keys inside an Agent sentence with their Korean labels. */
export function humanizeFieldKeys(text: string): string {
  return text.replace(FIELD_KEY_TOKEN, (token) => knownFieldLabel(token) ?? token);
}

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** Whether a noun's last character ends in a final consonant (받침), for particle agreement. */
export function endsWithFinalConsonant(word: string): boolean | null {
  const trimmed = word.replace(/[)\]"'”’]+$/u, "");
  const last = trimmed[trimmed.length - 1];
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code >= HANGUL_START && code <= HANGUL_END) return (code - HANGUL_START) % 28 !== 0;
  if (/[0-9]/u.test(last)) return "013678".includes(last);
  if (/[A-Za-z]/u.test(last)) return /[lmnrLMNR]/u.test(last);
  return null;
}

/**
 * Agent sentences interpolate field labels without particle agreement
 * ("HS 코드을"). Fix 을/를 and 이/가 after the word they attach to.
 */
export function fixParticles(text: string): string {
  return text.replace(/([가-힣A-Za-z0-9)\]]+)(을|를|이|가)(?=[\s.,;:!?]|$)/gu, (whole, word: string, particle: string) => {
    const closed = endsWithFinalConsonant(word);
    if (closed === null) return whole;
    if (particle === "을" || particle === "를") return `${word}${closed ? "을" : "를"}`;
    // "이/가": only swap when the word is clearly a noun ending; leave 이 after a 받침 word as-is.
    return `${word}${closed ? "이" : "가"}`;
  });
}

/** One reviewer-facing sentence: field keys labelled, particles agreed. */
export function reviewerSentence(text: string): string {
  return fixParticles(humanizeFieldKeys(text));
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

/**
 * The finding's fact that belongs to the chosen document, with its line item.
 * A fact from another document would make the proposal target inconsistent, and
 * a line-item fact needs its item so a reordered child extraction still finds it.
 */
export function correctionTargetForFinding(
  run: ReviewRun,
  finding: ReviewFinding,
  documentId: string,
): { fact_id: string; item_id: string | null } | null {
  const analysis = run.document_analyses.find((value) => value.document_id === documentId);
  if (!analysis) return null;
  const fact = analysis.facts.find((value) => finding.fact_ids.includes(value.fact_id));
  if (fact) return { fact_id: fact.fact_id, item_id: null };
  for (const item of analysis.line_items) {
    const itemFact = item.facts.find((value) => finding.fact_ids.includes(value.fact_id));
    if (itemFact) return { fact_id: itemFact.fact_id, item_id: item.item_id };
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

/* ── 법령 근거 출처·통관 요건 표시 ─────────────────────────── */

/** 법제처 국가법령정보센터의 법령명 URL. 조문 라벨("제226조")이 있으면 그 조문으로 바로 간다. */
export function lawPortalHref(lawName: string, articleLabel?: string | null): string {
  const path = [lawName.trim(), articleLabel?.trim()].filter(Boolean).join("/");
  return encodeURI(`https://www.law.go.kr/법령/${path}`);
}

function isDataPortalApi(href: string | null): boolean {
  if (!href) return false;
  const host = new URL(href).hostname;
  return host === "data.go.kr" || host.endsWith(".data.go.kr");
}

/**
 * Where "출처 열기" should take the reviewer. A customs-requirement row cites the
 * public-data API it was ingested from; opening that in a browser shows only a
 * SERVICE_KEY_IS_NULL error page, so the link goes to the law on 법제처 instead.
 * Statute rows already carry a 법제처 URL and are used as-is.
 */
export function evidenceSourceHref(item: { source_uri: string; source_type?: string | null; law_name?: string | null }): string | null {
  const direct = safeExternalHref(item.source_uri);
  const lawName = item.law_name?.trim();
  if (lawName && (item.source_type === "customs_requirement" || isDataPortalApi(direct))) return lawPortalHref(lawName);
  return direct;
}

export function evidenceSourceLabel(item: { source_uri: string; source_type?: string | null; law_name?: string | null }): string {
  const href = evidenceSourceHref(item);
  return href !== null && href !== safeExternalHref(item.source_uri) ? "법제처에서 법령 보기" : "출처 열기";
}

export interface RequirementSummary {
  /** 8504.40-1000 */
  hsCode: string;
  direction: "수입" | "수출";
  lawName: string;
  documentName: string;
  agency: string;
}

/** 10자리 HSK를 8504.40-1000 꼴로 적는다. 자릿수가 다르면 그대로 돌려준다. */
export function formatHsk(code: string): string {
  const digits = code.replace(/\D/gu, "");
  if (digits.length !== 10) return code;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}-${digits.slice(6)}`;
}

const REQUIREMENT_TEXT =
  /^HSK\s+(\d{10})\s+(import|export)\s+요건:\s*(.+?);\s*필요 확인서류\s+(.+?);\s*요건승인기관\s+(.+?)\.?\s*$/u;

/**
 * The Data platform writes every customs-requirement evidence text in one fixed
 * sentence ("HSK 8504401000 import 요건: 법령; 필요 확인서류 서류; 요건승인기관 기관.").
 * This reads the fields back so the screen can show them the way a reviewer reads
 * them. Any other text returns null and is shown unchanged.
 */
export function parseRequirementEvidence(text: string): RequirementSummary | null {
  const match = REQUIREMENT_TEXT.exec(text.trim());
  if (!match) return null;
  const [, hsk, direction, lawName, documentName, agency] = match;
  if (!hsk || !direction || !lawName || !documentName || !agency) return null;
  return {
    hsCode: formatHsk(hsk),
    direction: direction === "import" ? "수입" : "수출",
    lawName: lawName.trim(),
    documentName: documentName.trim(),
    agency: agency.trim(),
  };
}

/** One plain sentence a reviewer can act on, built from the parsed requirement. */
export function requirementSentence(summary: RequirementSummary): string {
  const agency = summary.agency === "기관 미상" ? "요건승인기관" : summary.agency;
  return fixParticles(
    `HSK ${summary.hsCode} 품목을 ${summary.direction}하려면 「${summary.lawName}」에 따라 ${agency}이 확인한 ${summary.documentName}를 세관에 제출해야 합니다.`,
  );
}

/** "대상 품목 · 확인 법령 · …" rows for the requirement card and the printed report. */
export function requirementRows(summary: RequirementSummary): readonly { label: string; value: string }[] {
  return [
    { label: "대상 품목", value: `HSK ${summary.hsCode} · ${summary.direction} 요건` },
    { label: "확인 법령", value: summary.lawName },
    { label: "필요 확인서류", value: summary.documentName },
    { label: "요건승인기관", value: summary.agency },
  ];
}

/* ── Agent 3.3 · 그래프 트레이스 · 신뢰도 · 권고 판정 ───────────── */

export function graphNodeLabel(value: string): string {
  const labels: Record<string, string> = {
    extraction_agent: "추출 에이전트",
    cross_validation_agent: "교차검증 에이전트",
    evidence_retrieval: "법령 근거 조회",
    expert_review_agent: "전문심사 에이전트",
    report_generation: "보고서 생성",
  };
  return labels[value] ?? value;
}

export function loopReasonLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = {
    missing_fields: "필수 필드 누락으로 재판독",
    ungrounded_fields: "원문 인용 미확인 필드 재판독",
    mismatch_reread: "불일치 감지로 재판독",
    llm_reread_request: "교차검증 에이전트의 재판독 요청",
  };
  if (!value) return "재판독 없음";
  return labels[value] ?? value;
}

export function reviewTrackLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = { detailed_review: "상세 검토 트랙", expedited_check: "약식 확인 트랙" };
  if (!value) return "검토 트랙 미기록";
  return labels[value] ?? value;
}

export function verdictLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = { eligible: "적격 권고", ineligible: "부적격 권고", indeterminate: "판단 보류 권고" };
  if (!value) return "권고 없음";
  return labels[value] ?? value;
}

export function errorCategoryLabel(value: string): string {
  const labels: Record<string, string> = {
    value_mismatch: "값 불일치",
    missing_field: "필드 누락",
    unit_or_format: "단위·표기 차이",
    document_type_uncertain: "문서 유형 미확정",
    regulatory_requirement: "법령 요건",
    other: "기타",
  };
  return labels[value] ?? value;
}

export function engineKindLabel(value: string): string {
  const labels: Record<string, string> = {
    deterministic: "결정론 엔진",
    anthropic: "Anthropic",
    openai: "OpenAI",
    claude: "Anthropic(구 표기)",
  };
  return labels[value] ?? value;
}

/** 0.9 → "90%"; keeps one decimal only when it changes the reading. */
export function percentLabel(value: number): string {
  const rounded = Math.round(value * 1000) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

/* ── raster OCR + layout ──────────────────────────────────────── */

export function rasterExtractionStatusLabel(value: RasterExtractionJob["status"]): string {
  const labels: Record<RasterExtractionJob["status"], string> = {
    queued: "OCR+레이아웃 대기",
    running: "OCR+레이아웃 처리 중",
    preview_ready: "OCR+레이아웃 초안 준비됨",
    needs_review: "OCR+레이아웃 추가 확인 필요",
    unavailable: "OCR+레이아웃 초안 제공 불가",
    failed: "OCR+레이아웃 처리 실패",
  };
  return labels[value];
}

export function rasterExtractionNoticeLabel(code: string): string {
  const labels: Readonly<Record<string, string>> = {
    raster_profile_unavailable: "현재 사용할 수 있는 OCR+레이아웃 프로필이 없습니다.",
    raster_profile_superseded: "OCR+레이아웃 프로필이 바뀌어 이전 초안을 사용할 수 없습니다.",
    layout_low_confidence: "표·필드 구조 추정 신뢰도가 낮을 수 있습니다.",
    table_structure_uncertain: "표 구조는 엔진의 추정이므로 원본과 대조가 필요합니다.",
  };
  return labels[code] ?? rasterTextWarningLabel(code);
}

/** Reading-order text of every page; pages are separated by a form feed like the text-only OCR draft. */
export function rasterExtractionDraftText(preview: RasterExtractionPreview | null | undefined): string {
  return [...(preview?.pages ?? [])]
    .sort((left, right) => left.page_number - right.page_number)
    .map((page) => [...page.spans].sort((left, right) => left.reading_order - right.reading_order).map((span) => span.text).join("\n"))
    .join("\n\f\n");
}

export function rasterLayoutSummaryLabel(preview: RasterExtractionPreview): string {
  const spans = preview.pages.flatMap((page) => page.spans);
  const mean = spans.length ? spans.reduce((total, span) => total + span.confidence, 0) / spans.length : null;
  return `페이지 ${preview.pages.length} · 표 ${preview.tables.length} · 텍스트 조각 ${spans.length} · 필드 후보 ${preview.field_candidates.length}`
    + (mean === null ? " · 평균 신뢰도 없음" : ` · 평균 신뢰도 ${percentLabel(mean)}`);
}

export function rasterExtractionNotice(envelope: RasterExtractionEnvelope): string {
  if (envelope.profile_superseded) {
    return "현재 OCR+레이아웃 프로필이 바뀌었습니다. 이전 초안은 등록할 수 없으므로 새 요청을 실행하십시오.";
  }
  const descriptions: Record<RasterExtractionJob["status"], string> = {
    queued: "OCR+레이아웃 작업이 대기열에 등록되었습니다.",
    running: "OCR과 레이아웃 분석을 처리하고 있습니다.",
    preview_ready: "원본과 대조해 수정할 OCR+레이아웃 초안이 준비되었습니다.",
    needs_review: "일부 인식 결과가 불확실할 수 있으므로 원본 대조가 필요합니다.",
    unavailable: "현재 문서의 OCR+레이아웃 초안을 제공할 수 없습니다.",
    failed: "OCR+레이아웃 처리를 완료하지 못했습니다.",
  };
  return `${rasterExtractionStatusLabel(envelope.job.status)}. ${descriptions[envelope.job.status]}`;
}

export function extractionSourceLabel(value: string | null | undefined): string {
  const labels: Record<string, string> = { text_layer: "텍스트 레이어", vlm_ocr: "VLM OCR", raster_ocr: "OCR+레이아웃" };
  if (!value) return "직접 입력 텍스트";
  return labels[value] ?? value;
}
