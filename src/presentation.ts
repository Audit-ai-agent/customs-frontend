import type {
  AssistantCitation,
  AssistantMessage,
  CaseDocument,
  CaseSummary,
  CorrectionProposal,
  DocumentAnalysis,
  DocumentFact,
  DocumentType,
  JobStatus,
  ReviewComparison,
  ReviewFinding,
  ReviewRunSummary,
  ReviewerDecision,
  SourceReference,
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
  UNKNOWN: "문서 유형 확인 필요",
};

const ANALYSIS_DOCUMENT_TYPE_LABELS: Record<DocumentAnalysis["document_type"], string> = {
  invoice: "상업송장",
  packing_list: "포장명세서",
  bill_of_lading: "선하증권",
  certificate_of_origin: "원산지증명서",
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

export function citationLabel(citation: AssistantCitation): string {
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
 * Keeps a few known legacy fixture/runtime messages out of the reviewer UI.
 * New Agent prose remains untouched here: translating a legal conclusion in
 * the browser would be unsafe, so that responsibility stays with the Agent.
 */
export function reviewerNarrative(value: string): string {
  return KNOWN_TECHNICAL_NARRATIVES[narrativeKey(value)] ?? value;
}
