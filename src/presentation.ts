import type {
  AssistantAnswerSection,
  AssistantMessage,
  CaseCitation,
  CaseDocument,
  CaseSummary,
  CorrectionProposal,
  DocumentAnalysis,
  DocumentFact,
  DocumentType,
  JobStatus,
  KnowledgeAnswerScope,
  KnowledgeCoverage,
  GuidanceEvidenceCitation,
  KnowledgeTradeType,
  ReviewComparison,
  ReviewFinding,
  ReportSectionName,
  ReviewRunSummary,
  ReviewerDecision,
  SourceReference,
  TradeType,
} from "./api/v1/types";

/**
 * Browser-only presentation policy for the Korean commercial workbench.
 *
 * The Backend contract deliberately keeps stable machine identifiers.  They
 * remain useful for requests, links, and local verification, but never make a
 * good default label for a reviewer.  This module is the single translation
 * boundary between those identifiers and the user-facing workbench.
 */

export type CasePresentationKind = "business" | "functional-uat";

export interface CasePresentation {
  kind: CasePresentationKind;
  title: string;
  scenarioLabel?: string;
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CI: "상업송장",
  PL: "포장명세서",
  BL: "선하증권",
  CO: "원산지증명서",
  AWB: "항공화물운송장",
  EXPORT_DECLARATION: "수출신고필증",
  SUPPORTING_EVIDENCE: "요건·보완 증빙",
  UNKNOWN: "문서 유형 확인 필요",
};

const ANALYSIS_DOCUMENT_TYPE_LABELS: Record<DocumentAnalysis["document_type"], string> = {
  invoice: "상업송장",
  packing_list: "포장명세서",
  bill_of_lading: "선하증권",
  certificate_of_origin: "원산지증명서",
  air_waybill: "항공화물운송장",
  export_declaration: "수출신고필증",
  supporting_evidence: "요건·보완 증빙",
  unknown: "문서 유형 확인 필요",
};

const FIELD_LABELS: Record<string, string> = {
  invoice_no: "송장 번호",
  invoice_number: "송장 번호",
  invoice_date: "송장 일자",
  packing_no: "포장명세서 번호",
  certificate_no: "원산지증명서 번호",
  bl_no: "선하증권 번호",
  shipment_id: "선적 식별번호",
  hs_code: "HS 코드",
  hs_codes: "HS 코드",
  description: "품명",
  goods_description: "품명",
  quantity: "수량",
  unit: "단위",
  unit_price: "단가",
  amount: "품목 금액",
  total_amount: "총액",
  currency: "통화",
  origin_country: "원산지",
  country_of_origin: "원산지",
  container_numbers: "컨테이너 번호",
  gross_weight: "총중량",
  gross_weight_kg: "총중량",
  total_gross_weight_kg: "총중량",
  net_weight_kg: "순중량",
  total_net_weight_kg: "순중량",
  package_count: "포장 수량",
  packages: "포장 수량",
  package_type: "포장 단위",
  item_no: "품목 번호",
  seller: "판매자",
  buyer: "구매자",
  exporter: "수출자",
  importer: "수입자",
  consignee: "수하인",
  vessel: "선박명",
  voyage_no: "항차",
  port_of_loading: "선적항",
  port_of_discharge: "양륙항",
  place_of_delivery: "인도 장소",
  seal_numbers: "봉인 번호",
  measurement_cbm: "용적",
  total_measurement_cbm: "총용적",
  payment_terms: "결제 조건",
  incoterms: "인코텀즈",
};

const COMPARISON_RULE_LABELS: Record<string, string> = {
  document_type_classification: "문서 유형 확인",
  document_pair_selection: "비교 대상 문서 확인",
  required_field_presence: "필수 항목 확인",
  hs_code_presence: "HS 코드 확인",
  invoice_packing_quantity_unit: "송장·포장명세서 수량과 단위 확인",
  invoice_packing_item_match: "송장·포장명세서 품목 대응 확인",
  invoice_line_amount: "송장 품목 금액 확인",
  invoice_total_amount: "송장 총액 확인",
  invoice_certificate_origin: "송장·원산지증명서 원산지 확인",
  bill_packing_bl_no: "선하증권·포장명세서 번호 확인",
  bill_packing_container: "선하증권·포장명세서 컨테이너 번호 확인",
  bill_packing_gross_weight: "선하증권·포장명세서 총중량 확인",
  qty_mismatch_invoice_packing: "송장·포장명세서 수량 확인",
};

const LEGACY_FUNCTIONAL_SCENARIOS: Record<string, string> = {
  "all-documents-match": "문서 간 일치 확인",
  "all-comparison-mismatches": "문서 간 불일치 확인",
  "unit-needs-review": "단위 확인 필요",
  "ambiguous-item-needs-review": "품목 대응 확인 필요",
  "missing-hs-and-injection": "HS 코드 누락 확인",
  "no-evidence": "법령 근거 부족 확인",
};

const KNOWN_TECHNICAL_NARRATIVES: Record<string, string> = {
  "review incomplete - evidence and hs code validation required": "심사 결과 확인 필요",
  "document review cannot be finalized because certificate of origin lacks required hs code and food safety import confirmation evidence is not yet available": "원산지증명서의 HS 코드 또는 식품 안전 수입 요건 근거가 충분하지 않아 담당자 확인이 필요합니다.",
  "human review required": "담당자 확인 필요",
  "no issues detected": "주요 확인 사항 없음",
  "evidence를 열었습니다": "법령 근거를 열었습니다.",
};

const SAFE_ACRONYMS = new Set([
  "AI", "BL", "CO", "HS", "KG", "OCR", "PDF", "PL", "USD",
]);
// Do not use `\b`: JavaScript word boundaries are ASCII-oriented, so a
// Korean postposition immediately after `.txt` would otherwise evade it.
const RAW_FILENAME = /[^\s()]+\.txt(?=$|[^A-Za-z0-9_.-])/iu;
const INTERNAL_REFERENCE = /\b(?:case|claim|comparison|document|evidence|fact|finding|inspect|job|run)(?:[-_][a-z0-9]+){1,}\b/iu;
const OPAQUE_IDENTIFIER = /\b[a-f0-9]{16,}\b/iu;
const UUID_IDENTIFIER = /\b[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}\b/iu;
const SECRET_ASSIGNMENT = /(api[ _-]?key|authorization|cookie|dsn|password|secret|token)\b\s*[:=]\s*[^\s,;]+/giu;
const BEARER_CREDENTIAL = /\bbearer\s+[^\s,;]+/giu;
const CONNECTION_STRING = /\b(?:postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?)?:\/\/[^\s,;]+/giu;
const KNOWN_API_KEY = /\b(?:sk-ant-|sk-|api[_-]?key[-_:])[A-Za-z0-9_\-]{8,}\b/giu;
const JWT_CREDENTIAL = /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/gu;
const PROVIDER_ERROR = /(?:\b(?:anthropic|claude|openai|provider)[^\r\n]{0,120}\b(?:error|exception|failed|failure|status(?:\s*code)?|request[ _-]?id)\b|\b(?:provider[ _-]?error|model[ _-]?provider[ _-]?error)\b)/iu;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function narrativeKey(value: string): string {
  return normalized(value)
    .replace(/[‐‑‒–—]/gu, "-")
    .replace(/\s*-\s*/gu, " - ")
    .replace(/\s+/gu, " ")
    .replace(/[.!]$/u, "");
}

function labelOrReview(labels: Readonly<Record<string, string>>, value: string): string {
  return labels[normalized(value)] ?? "추가 확인 필요";
}

function knownFunctionalScenario(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return LEGACY_FUNCTIONAL_SCENARIOS[value];
}

export function casePresentation(caseItem: CaseSummary): CasePresentation {
  const metadata = caseItem.metadata;
  if (metadata?.system_case_kind === "functional_uat_matrix") {
    const scenarioLabel = knownFunctionalScenario(metadata.system_scenario);
    return {
      kind: "functional-uat",
      title: scenarioLabel ? `기능 검증 · ${scenarioLabel}` : "기능 검증 기록",
      ...(scenarioLabel === undefined ? {} : { scenarioLabel }),
    };
  }

  const legacyScenario = /^Functional matrix: ([^\r\n]+)$/u.exec(caseItem.title)?.[1]?.trim();
  if (legacyScenario !== undefined) {
    const legacyLabel = knownFunctionalScenario(legacyScenario);
    return legacyLabel === undefined
      ? { kind: "functional-uat", title: "기능 검증 기록" }
      : { kind: "functional-uat", title: `기능 검증 · ${legacyLabel}`, scenarioLabel: legacyLabel };
  }
  return { kind: "business", title: caseItem.title };
}

export function isFunctionalUatCase(caseItem: CaseSummary): boolean {
  return casePresentation(caseItem).kind === "functional-uat";
}

export function caseReferenceLabel(caseItem: Pick<CaseSummary, "external_reference">): string {
  return caseItem.external_reference?.trim() ? `참조번호 ${caseItem.external_reference}` : "참조번호 없음";
}

export function caseStatusLabel(value: CaseSummary["status"]): string {
  return ({ open: "접수됨", in_review: "검토 진행 중", closed: "검토 종료" })[value];
}

export function tradeTypeLabel(value: TradeType): string {
  return value === "import" ? "수입" : "수출";
}

export function knowledgeTradeTypeLabel(value: KnowledgeTradeType): string {
  return value === "both" ? "수입·수출 공통" : tradeTypeLabel(value);
}

export function knowledgeSourceKindLabel(value: GuidanceEvidenceCitation["source_kind"]): string {
  return {
    official_law: "공식 법령 근거",
    official_law_catalog: "공식 법령 정보",
    official_agency_guidance: "관계기관 공식 안내",
    official_requirement_reference: "공식 수출입 요건 안내",
    official_public_guidance: "공공기관 무역 안내",
    development_fixture: "개발용 예시 근거",
  }[value];
}

export function jobStatusLabel(value: JobStatus): string {
  return ({ queued: "요청 접수", running: "심사 진행 중", succeeded: "심사 결과 확인", failed: "심사 확인 필요" })[value];
}

export function executionStatusLabel(value: ReviewRunSummary["execution_status"]): string {
  return ({ succeeded: "심사 결과 확인", partial: "일부 항목 확인 필요", failed: "심사 확인 필요" })[value];
}

export function assessmentLabel(value: ReviewRunSummary["assessment"]): string {
  return ({ no_issue_detected: "주요 확인 사항 없음", issues_detected: "확인 사항 있음", indeterminate: "판단 보류" })[value];
}

export function reviewDispositionLabel(value: "human_review_required" | "blocked"): string {
  return value === "human_review_required" ? "담당자 확인 필요" : "심사 진행 확인 필요";
}

export function workflowStatusLabel(value: "completed" | "skipped" | "needs_review" | "failed"): string {
  return ({ completed: "확인됨", skipped: "대상 없음", needs_review: "확인 필요", failed: "처리 확인 필요" })[value];
}

export function workflowStageLabel(value: string): string {
  return labelOrReview({
    classify_documents: "문서 유형 확인",
    extract_facts: "문서 정보 추출",
    normalize_facts: "값 형식 정리",
    match_documents: "문서와 품목 연결",
    validate_documents: "문서 간 확인",
    reextract_documents: "필요 항목 다시 확인",
    retrieve_evidence: "법령 근거 조회",
    generate_result: "심사 결과 정리",
  }, value);
}

export function plannerActionLabel(value: string): string {
  return labelOrReview({
    analyze_documents: "문서 정보 확인",
    apply_human_corrections: "승인된 수정 반영",
    compare_documents: "문서 간 비교",
    reextract_documents: "필요 항목 다시 확인",
    retrieve_evidence: "법령 근거 조회",
    generate_report: "심사 보고서 정리",
  }, value);
}

export function documentTypeLabel(value: DocumentType): string {
  return DOCUMENT_TYPE_LABELS[value];
}

export function documentAnalysisTypeLabel(value: DocumentAnalysis["document_type"]): string {
  return ANALYSIS_DOCUMENT_TYPE_LABELS[value];
}

export function documentDisplayName(document: Pick<CaseDocument, "document_type">): string {
  return documentTypeLabel(document.document_type);
}

export function documentAnalysisDisplayName(document: Pick<DocumentAnalysis, "document_type">): string {
  return documentAnalysisTypeLabel(document.document_type);
}

export function fieldLabel(value: string): string {
  return FIELD_LABELS[normalized(value)] ?? "추출 항목";
}

export function correctionFieldChoices(): Array<[string, string]> {
  return [
    ["quantity", "수량"],
    ["unit", "단위"],
    ["unit_price", "단가"],
    ["amount", "품목 금액"],
    ["total_amount", "총액"],
    ["hs_code", "HS 코드"],
    ["origin_country", "원산지"],
    ["bl_no", "선하증권 번호"],
    ["container_numbers", "컨테이너 번호"],
    ["gross_weight_kg", "총중량"],
  ];
}

export function comparisonRuleLabel(value: string): string {
  return labelOrReview(COMPARISON_RULE_LABELS, value);
}

export function comparisonStatusLabel(value: ReviewComparison["status"]): string {
  return ({ pass: "일치", skip: "비교 대상 없음", mismatch: "불일치", needs_review: "확인 필요" })[value];
}

export function findingTitle(finding: Pick<ReviewFinding, "code" | "comparison_id">): string {
  const code = normalized(finding.code);
  if (code === "hs_code_not_found" || code === "hs_code_presence" || code.includes("hs_code")) return "HS 코드 확인 필요";
  if (code === "missing_required_field" || code === "required_field_presence") return "필수 항목 확인 필요";
  if (code === "document_type_unknown" || code === "document_type_classification") return "문서 유형 확인 필요";
  if (code.includes("quantity") || code.includes("qty")) return "수량 확인 필요";
  if (code.includes("amount")) return "금액 확인 필요";
  if (code.includes("origin")) return "원산지 확인 필요";
  if (code.includes("container")) return "컨테이너 번호 확인 필요";
  if (code.includes("weight")) return "중량 확인 필요";
  if (code.includes("bl_no")) return "선하증권 번호 확인 필요";
  if (code.includes("item_match") || code.includes("pair_selection")) return "품목·문서 대응 확인 필요";
  if (code.includes("require") || code.includes("data_")) return "수입 요건 확인 필요";
  return finding.comparison_id ? "문서 비교 확인 필요" : "추가 확인 필요";
}

export function requiredActionLabel(value: string): string {
  const code = normalized(value);
  if (code === "human_review_required") return "담당자 검토";
  if (code.includes("hs_code")) return "HS 코드 확인";
  if (code.includes("quantity") || code.includes("qty")) return "수량 확인";
  if (code.includes("amount")) return "금액 확인";
  if (code.includes("origin")) return "원산지 확인";
  if (code.includes("container")) return "컨테이너 번호 확인";
  if (code.includes("weight")) return "중량 확인";
  if (code.includes("bl_no")) return "선하증권 번호 확인";
  if (code.startsWith("inspect_")) return "문서 확인";
  return "추가 확인";
}

export function evidenceSourceLabel(value: string): string {
  return labelOrReview({
    law_article: "법령 조문",
    customs_requirement: "수입 요건",
    hsk_entry: "HS 품목 기준",
    notice: "고시·안내",
    law: "법령 조문",
  }, value);
}

export function evidenceDisplayTitle(item: { source_type: string; law_name?: string | null }): string {
  if (normalized(item.source_type) === "law_article" && isReadableLawName(item.law_name)) {
    return `${item.law_name?.trim()} 관련 조문`;
  }
  return evidenceSourceLabel(item.source_type);
}

export function evidenceSummary(item: { source_type: string; law_name?: string | null }): string {
  const lawName = isReadableLawName(item.law_name) ? `관련 법령: ${item.law_name?.trim()}` : null;
  return lawName ?? `${evidenceSourceLabel(item.source_type)}가 이 심사 항목에 연결되었습니다.`;
}

function isReadableLawName(value: string | null | undefined): value is string {
  if (!value || value.length > 160) return false;
  const trimmed = value.trim();
  const hangulCount = (trimmed.match(/[가-힣]/gu) ?? []).length;
  const latinCount = (trimmed.match(/[a-z]/giu) ?? []).length;
  return hangulCount >= 2 && latinCount <= Math.ceil(hangulCount / 3) && !/[a-z]+(?:[_-][a-z0-9]+)+/iu.test(trimmed);
}

export function reportSectionLabel(value: string): string {
  return labelOrReview({
    conclusion: "검토 결론",
    execution_process: "심사 진행 과정",
    document_comparison: "문서 간 비교",
    issues_and_causes: "확인 사항과 원인",
    legal_evidence: "법령 근거",
    impact: "업무 영향",
    next_actions: "다음 조치",
    limitations: "검토 범위와 한계",
  }, value);
}

export function reportSectionDescription(value: string): string {
  return labelOrReview({
    conclusion: "현재 심사 결과와 담당자 확인이 필요한 범위를 정리합니다.",
    execution_process: "문서와 법령 근거를 어떤 순서로 확인했는지 보여줍니다.",
    document_comparison: "문서 사이에서 확인한 값과 차이를 보여줍니다.",
    issues_and_causes: "추가로 확인해야 할 항목과 이유를 정리합니다.",
    legal_evidence: "심사 항목에 연결된 법령 근거를 보여줍니다.",
    impact: "현재 결과를 업무에 활용할 때의 유의사항을 안내합니다.",
    next_actions: "담당자가 이어서 할 일을 안내합니다.",
    limitations: "텍스트 문서와 현재 근거 기준의 검토 범위를 안내합니다.",
  }, value);
}

export function assistantScopeLabel(value: NonNullable<AssistantMessage["answer_scope"]>): string {
  return ({
    case_grounded: "현재 심사 결과 기반",
    evidence_grounded: "법령 근거 기반",
    general_customs_guidance: "일반 통관 안내",
    clarification_needed: "추가 확인 필요",
    insufficient_evidence: "근거 부족",
    out_of_scope: "안내 범위 밖",
  })[value];
}

export function assistantAnswerSectionLabel(value: AssistantAnswerSection["kind"]): string {
  return value === "case_analysis" ? "현재 심사 결과" : "일반 통관 안내";
}

export function assistantAnswerSectionDescription(value: AssistantAnswerSection["kind"]): string {
  return value === "case_analysis"
    ? "현재 심사 건의 문서, 비교 결과와 연결된 근거를 바탕으로 정리한 내용입니다."
    : "공식 지식 스냅샷을 바탕으로 한 일반 안내이며, 현재 심사 건의 결론은 아닙니다.";
}

export function knowledgeCoverageLabel(value: KnowledgeCoverage): string {
  return ({
    covered: "근거 범위 확인됨",
    no_coverage: "해당 근거 없음",
    partial: "일부 근거 확인됨",
    unavailable: "근거 조회 불가",
  })[value];
}

/**
 * Coverage is provenance, not a hidden machine status.  Make the practical
 * limit explicit before a reviewer treats a general knowledge answer as a
 * complete operational conclusion.
 */
export function knowledgeAnswerBoundaryNotice(
  scope: KnowledgeAnswerScope,
  citations: readonly GuidanceEvidenceCitation[],
  resolvedCoverage?: KnowledgeCoverage | null,
): string | null {
  const coverage = new Set(citations.map((citation) => citation.coverage));
  if (resolvedCoverage) coverage.add(resolvedCoverage);
  if (scope === "out_of_scope") {
    return "이 질문은 현재 통관 지식 안내 범위를 벗어납니다. 구체적인 사실관계는 담당자와 공식 출처로 확인해야 합니다.";
  }
  if (scope === "clarification_needed") {
    return "무역 방향, 기준일 또는 대상 절차를 조금 더 구체적으로 알려 주시면 공식 근거 범위를 확인할 수 있습니다.";
  }
  if (coverage.has("unavailable")) {
    return "현재 공식 근거 조회 결과를 사용할 수 없습니다. 이 답변만으로 업무 판단을 확정하지 말고 잠시 후 다시 확인하십시오.";
  }
  if (coverage.has("no_coverage")) {
    return "선택한 무역 방향과 기준일에 맞는 공식 근거를 찾지 못했습니다. 일반 안내로 추정하지 않고 담당자가 공식 출처를 추가로 확인해야 합니다.";
  }
  if (scope === "insufficient_evidence") {
    return "현재 공개 근거만으로는 질문에 대한 확인 가능한 답을 만들기 어렵습니다. 필요한 사실이나 공식 출처를 보완해 주십시오.";
  }
  if (coverage.has("partial")) {
    return "일부 범위의 공식 근거만 확인되었습니다. 누락된 범위는 담당자가 공식 출처에서 추가로 확인해야 합니다.";
  }
  return null;
}

export function guidanceCitationTitle(citation: Pick<GuidanceEvidenceCitation, "source_title">): string {
  return citation.source_title;
}

export function citationLabel(citation: CaseCitation): string {
  return ({ fact: "문서 사실 보기", comparison: "문서 비교 보기", evidence: "법령 근거 보기" })[citation.kind];
}

export function reviewerDecisionLabel(value: ReviewerDecision["status"]): string {
  return ({ confirmed: "확인함", needs_information: "추가 자료 요청", resolved: "해결됨" })[value];
}

export function correctionStatusLabel(value: CorrectionProposal["status"]): string {
  return ({ proposed: "검토 대기", approved: "승인됨", rejected: "반려됨" })[value];
}

export function correctionHistoryLabel(value: CorrectionProposal["history"][number]["event"]): string {
  return ({ proposed: "정정 제안 등록", approved: "정정 제안 승인", rejected: "정정 제안 반려", applied: "수정 반영 재심사" })[value];
}

export function fieldValueLabel(fact: Pick<DocumentFact, "name">): string {
  return fieldLabel(fact.name);
}

export function sourceDocumentLabel(source: SourceReference, documents: readonly CaseDocument[]): string {
  const document = documents.find((item) => item.document_id === source.document_id);
  return document ? documentDisplayName(document) : "연결 문서";
}

export function reviewRunRelationLabel(run: Pick<ReviewRunSummary, "parent_review_run_id">): string {
  return run.parent_review_run_id ? "수정 반영 재심사" : "기준 심사";
}

export function roleLabel(value: "reviewer" | "approver"): string {
  return value === "reviewer" ? "심사 담당자" : "승인 담당자";
}

export function roleSummary(roles: readonly ("reviewer" | "approver")[]): string {
  if (!roles.length) return "역할 확인 중";
  return roles.map(roleLabel).join(" · ");
}

export function technicalLine(label: string, value: string | null | undefined): [string, string] | null {
  return value && value.trim() ? [label, value] : null;
}

export function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "확인 불가";
}

/**
 * Structured facts and comparison values can legitimately be numeric values,
 * currencies, units, or business document numbers.  Unlike a narrative, they
 * do not need Korean prose, but they still must not leak a file name, an
 * internal identifier, a credential-shaped value, or arbitrary English text.
 */
export function controlledStructuredValue(
  value: string | null | undefined,
  fallback = "추가 확인 필요",
): string {
  const displayed = displayValue(value);
  return requiresControlledStructuredValue(displayed) ? fallback : displayed;
}

/** A protected rendering for a collapsed verification detail; never raw. */
export function redactedStructuredVerificationValue(value: string | null | undefined): string {
  const displayed = displayValue(value);
  return requiresControlledStructuredValue(displayed) ? "표시 제한된 값" : reviewerNarrativeOriginal(displayed);
}

/**
 * Keeps legacy fixture/runtime messages and unsafe legacy prose out of the
 * primary reviewer UI. New Korean Agent prose remains untouched. The Browser
 * never translates a legal conclusion; it only substitutes a bounded Korean
 * status statement when the stored text is not safe to present as-is.
 */
export function reviewerNarrative(value: string, fallback = "이번 심사 결과의 근거를 바탕으로 담당자 확인이 필요합니다."): string {
  const known = KNOWN_TECHNICAL_NARRATIVES[narrativeKey(value)];
  if (known) return known;
  return requiresControlledNarrative(value) ? fallback : value;
}

/**
 * User-visible report and assistant text must not expose legacy file names,
 * machine references, or unreviewed English prose.  The raw value remains in
 * the caller's collapsed "이전 실행 원문" area whenever this returns true.
 */
export function requiresControlledNarrative(value: string): boolean {
  if (
    RAW_FILENAME.test(value)
    || INTERNAL_REFERENCE.test(value)
    || OPAQUE_IDENTIFIER.test(value)
    || UUID_IDENTIFIER.test(value)
    || hasSensitiveNarrative(value)
  ) return true;
  const englishWords = value.match(/\b[A-Za-z]{3,}\b/gu) ?? [];
  if (englishWords.some((word) => !SAFE_ACRONYMS.has(word.toUpperCase()))) return true;
  return value.trim().length > 0 && !/[가-힣]/u.test(value);
}

export function requiresControlledStructuredValue(value: string): boolean {
  if (
    RAW_FILENAME.test(value)
    || INTERNAL_REFERENCE.test(value)
    || OPAQUE_IDENTIFIER.test(value)
    || UUID_IDENTIFIER.test(value)
    || hasSensitiveNarrative(value)
  ) return true;
  const englishWords = value.match(/\b[A-Za-z]{3,}\b/gu) ?? [];
  return englishWords.some((word) => !isSafeStructuredWord(word));
}

function isSafeStructuredWord(word: string): boolean {
  if (SAFE_ACRONYMS.has(word.toUpperCase())) return true;
  // Business identifiers such as INV-001 or BL-MATCH-001 are useful values,
  // unlike a lower-case internal code or a prose phrase.
  return /^[A-Z]{2,8}$/.test(word);
}

/**
 * A persisted legacy result can contain a provider error or credential-shaped
 * value. Keep its Korean fallback, but never render that raw body in a
 * collapsed detail either.
 */
export function reviewerNarrativeOriginal(value: string): string {
  if (PROVIDER_ERROR.test(value)) return "외부 AI 제공자 오류 원문은 화면에 표시하지 않습니다.";
  return value
    .replace(SECRET_ASSIGNMENT, "$1: [비공개]")
    .replace(BEARER_CREDENTIAL, "Bearer [비공개]")
    .replace(CONNECTION_STRING, "[연결 정보 비공개]")
    .replace(KNOWN_API_KEY, "[API 키 비공개]")
    .replace(JWT_CREDENTIAL, "[인증 정보 비공개]");
}

function hasSensitiveNarrative(value: string): boolean {
  return matches(SECRET_ASSIGNMENT, value)
    || matches(BEARER_CREDENTIAL, value)
    || matches(CONNECTION_STRING, value)
    || matches(KNOWN_API_KEY, value)
    || matches(JWT_CREDENTIAL, value)
    || matches(PROVIDER_ERROR, value);
}

function matches(expression: RegExp, value: string): boolean {
  expression.lastIndex = 0;
  const matched = expression.test(value);
  expression.lastIndex = 0;
  return matched;
}

/** Keep stored legacy suggestion text out of the normal chat surface. */
export function assistantSuggestionLabel(value: string): string {
  if (!requiresControlledNarrative(value)) return value;
  return "현재 심사 결과에서 확인이 필요한 항목을 설명해 주세요.";
}

export function reportSummaryFallback(
  assessment: "no_issue_detected" | "issues_detected" | "indeterminate",
  findingCount: number,
): string {
  if (assessment === "no_issue_detected") return "주요 문서 비교 결과는 확인되었지만, 자동 완료하지 않고 담당자 검토가 필요합니다.";
  if (assessment === "indeterminate") return "현재 입력과 연결된 근거만으로는 심사 결과를 확정하기 어렵습니다. 담당자 확인이 필요합니다.";
  return findingCount > 0
    ? `심사 결과에서 담당자 확인이 필요한 항목이 ${findingCount}건 있습니다.`
    : "심사 결과에서 담당자 확인이 필요한 항목이 있습니다.";
}

export function reportDisclaimerFallback(): string {
  return "이 결과는 등록된 텍스트 문서와 연결된 법령 근거를 기준으로 한 사전심사 보조 정보이며, 자동 승인으로 이어지지 않습니다.";
}

export function reportClaimFallback(
  section: ReportSectionName,
  assessment: "no_issue_detected" | "issues_detected" | "indeterminate",
  findingCount: number,
  comparisonCount: number,
  evidenceCount: number,
): string {
  switch (section) {
    case "conclusion":
      return reportSummaryFallback(assessment, findingCount);
    case "execution_process":
      return "문서 정보 추출, 값 정리, 문서·품목 대응, 문서 간 비교와 법령 근거 조회를 정해진 순서로 수행했습니다.";
    case "document_comparison":
      return comparisonCount
        ? "연결된 문서의 비교 결과를 확인했습니다. 세부 값과 상태는 아래 문서 비교에서 확인할 수 있습니다."
        : "비교할 수 있는 문서 정보가 충분한지 담당자가 확인해야 합니다.";
    case "issues_and_causes":
      return "문서 정보 또는 비교 결과에서 추가 확인이 필요한 항목이 있습니다.";
    case "legal_evidence":
      return evidenceCount
        ? "이번 심사 항목과 연결된 법령 근거를 확인했습니다. 세부 수입 요건은 법령 근거 탭에서 확인할 수 있습니다."
        : "현재 입력 기준으로 연결된 법령 근거를 확인하지 못했습니다.";
    case "impact":
      return "담당자 확인이 끝날 때까지 이 심사 결과는 자동으로 완료되지 않습니다.";
    case "next_actions":
      return "확인 사항과 법령 근거를 검토한 뒤 필요한 문서 보완 여부를 결정해야 합니다.";
    case "limitations":
      return "이번 심사는 등록된 텍스트 문서와 현재 연결된 법령 근거 범위에서만 수행했습니다.";
  }
}

export function comparisonNarrativeFallback(comparison: Pick<ReviewComparison, "rule_code" | "status">): string {
  const label = comparisonRuleLabel(comparison.rule_code);
  return ({
    pass: `${label} 결과가 일치합니다.`,
    mismatch: `${label} 결과가 일치하지 않아 담당자 확인이 필요합니다.`,
    needs_review: `${label}에 필요한 값 또는 대응 관계를 추가로 확인해야 합니다.`,
    skip: `${label}의 비교 대상이 충분하지 않아 이번 심사에서는 비교하지 않았습니다.`,
  })[comparison.status];
}

export function findingNarrativeFallback(finding: Pick<ReviewFinding, "code" | "comparison_id">): string {
  return `${findingTitle(finding)} 항목을 담당자가 문서와 연결된 근거를 기준으로 확인해야 합니다.`;
}

export function requiredActionNarrativeFallback(actionCode: string): string {
  return `${requiredActionLabel(actionCode)}을 진행한 뒤 담당자 판단을 기록하십시오.`;
}

export function workflowNarrativeFallback(stage: string, status: "completed" | "skipped" | "needs_review" | "failed"): string {
  const stageLabel = workflowStageLabel(stage);
  return ({
    completed: `${stageLabel}을 완료했습니다.`,
    skipped: `${stageLabel} 대상이 없어 이번 심사에서는 진행하지 않았습니다.`,
    needs_review: `${stageLabel} 결과를 담당자가 추가로 확인해야 합니다.`,
    failed: `${stageLabel}을 완료하지 못했습니다. 입력 정보와 연결 상태를 확인한 뒤 다시 시도하십시오.`,
  })[status];
}

export function plannerNarrativeFallback(action: string, status: "completed" | "skipped" | "needs_review" | "failed"): string {
  const actionLabel = plannerActionLabel(action);
  return ({
    completed: `${actionLabel}을 수행했습니다.`,
    skipped: `${actionLabel} 대상이 없어 진행하지 않았습니다.`,
    needs_review: `${actionLabel} 결과를 추가로 확인해야 합니다.`,
    failed: `${actionLabel}을 완료하지 못했습니다.`,
  })[status];
}

export function assistantNarrativeFallback(scope: NonNullable<AssistantMessage["answer_scope"]>): string {
  return ({
    case_grounded: "현재 심사 결과에 연결된 문서와 비교 결과를 바탕으로 담당자 확인이 필요합니다.",
    evidence_grounded: "현재 심사 항목과 연결된 법령 근거를 바탕으로 담당자 확인이 필요합니다.",
    general_customs_guidance: "일반 통관 안내입니다. 현재 사건의 판단이나 결론에는 직접 적용되지 않습니다.",
    clarification_needed: "질문의 대상 문서, 비교 항목 또는 법령 근거를 조금 더 구체적으로 알려주십시오.",
    insufficient_evidence: "현재 심사 입력과 연결된 근거만으로는 이 내용을 확인할 수 없습니다.",
    out_of_scope: "현재 AI 도우미가 안내할 수 있는 범위를 벗어난 질문입니다.",
  })[scope];
}
