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
    validate_documents: "정합성 검사", reextract_documents: "제한 재추출", retrieve_evidence: "법령 Evidence 조회", generate_result: "검토 결과 생성",
  };
  return labels[value] ?? value;
}

export function plannerActionLabel(value: string): string {
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

export function reportSectionDescription(section: ReportSection["section"]): string {
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
    evidence_grounded: "Evidence 근거 답변",
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
    evidence: "Evidence",
  };
  return `${labels[citation.kind]} · ${citation.reference_id.slice(0, 18)}`;
}

export function assistantSuggestions(run: ReviewRun, messages: AssistantMessage[]): string[] {
  const fromLatestAnswer = [...messages].reverse().find((item) => item.role === "assistant")?.suggested_questions ?? [];
  if (fromLatestAnswer.length) return fromLatestAnswer;
  const suggestions: string[] = [];
  if (run.findings.length) suggestions.push("가장 우선해서 확인할 항목과 그 근거를 알려줘");
  if (run.comparisons.length) suggestions.push("문서 간 비교에서 확인이 필요한 값은 무엇이야?");
  if (run.evidence.length) suggestions.push("연결된 법령 Evidence가 이 Case와 어떻게 관련되는지 알려줘");
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

/** Joins the preview spans into the editable text the reviewer confirms. */
export function extractionPreviewText(preview: ExtractionPreview): string {
  return [...preview.pages]
    .sort((left, right) => left.page_number - right.page_number)
    .flatMap((page) => [...page.spans].sort((a, b) => a.reading_order - b.reading_order || a.ordinal - b.ordinal))
    .map((span) => span.text)
    .join("\n");
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
