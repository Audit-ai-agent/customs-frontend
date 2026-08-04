import type {
  Assessment,
  DocumentType,
  ExecutionStatus,
  ReviewDisposition,
} from "../api/v1/types";
import type {
  AssistantAnswerScope,
  CitationKind,
  PublicStageEvent,
} from "../api/v2/types";

export const documentTypeLabels: Record<DocumentType, string> = {
  CI: "상업송장(CI)",
  PL: "포장명세서(PL)",
  BL: "선하증권(B/L)",
  CO: "원산지증명서(C/O)",
  SUPPORTING: "요건 증명서",
  UNKNOWN: "확인되지 않은 문서",
};

export const documentTypeBadgeLabels: Record<DocumentType, string> = {
  CI: "송장",
  PL: "포장",
  BL: "운송",
  CO: "원산지",
  SUPPORTING: "요건 증명",
  UNKNOWN: "확인 필요",
};

export const executionStatusLabels: Record<ExecutionStatus, string> = {
  succeeded: "실행 완료",
  partial: "일부 확인 필요",
  failed: "실행 실패",
};

export const assessmentLabels: Record<Assessment, string> = {
  no_issue_detected: "확인된 문제 없음",
  issues_detected: "확인할 사항 발견",
  indeterminate: "판정 보류",
};

export const dispositionLabels: Record<ReviewDisposition, string> = {
  auto_review_complete: "자동 사전심사 완료",
  human_review_required: "담당자 확인 필요",
  blocked: "처리 중단",
};

export const severityLabels = {
  low: "낮음",
  medium: "보통",
  high: "높음",
  critical: "매우 높음",
} as const;

export const caseStatusLabels = {
  open: "접수",
  in_review: "심사 중",
  closed: "종료",
} as const;

const localUatReferencePattern = /^UAT2:[A-Za-z0-9_-]{1,128}:(?:SYN|DIA|EVAL):[a-f0-9]{64}$/u;

export function isLocalUatReference(value: string | null | undefined): boolean {
  return typeof value === "string" && localUatReferencePattern.test(value);
}

export function caseReferenceLabel(value: string | null | undefined): string {
  if (isLocalUatReference(value)) return "검증 시나리오 · 업무 참조번호 없음";
  return value || "업무 참조번호 없음";
}

export function actorRoleLabel(
  actorSubject: string,
  currentSubject: string | undefined,
  role: "심사 담당자" | "승인 담당자",
): string {
  return actorSubject === currentSubject ? `현재 ${role}` : `다른 ${role}`;
}

export const assistantScopeLabels: Record<AssistantAnswerScope, string> = {
  case_grounded: "현재 심사 건 기준 답변",
  evidence_grounded: "법령 근거 기준 답변",
  general_customs_guidance: "일반 통관 안내",
  clarification_needed: "질문 확인 필요",
  insufficient_evidence: "확인 자료 부족",
  out_of_scope: "통관 업무 범위 밖",
};

export const stageLabels: Record<PublicStageEvent["stage_code"], string> = {
  queued: "심사 실행 대기",
  input_validation: "등록 문서와 요청 확인",
  agent_analysis: "AI 심사 분석",
  request_validation: "요청 내용 확인",
  document_analysis: "문서 읽기와 항목 추출",
  normalization: "표현과 단위 정리",
  document_pairing: "문서끼리 연결",
  cross_validation: "문서 간 값 대조",
  adaptive_investigation: "추가 확인이 필요한 부분 조사",
  evidence_retrieval: "법령 근거 검색",
  compliance_review: "규정 요건 검토",
  report_composition: "심사 설명 작성",
  grounding_verification: "설명과 근거 대조",
  result_validation: "최종 결과 안전 확인",
  persistence: "검증 결과 안전 저장",
  completed: "심사 완료",
  failed: "심사 중단",
};

export const presentationSectionLabels = {
  conclusion: "한눈에 보는 결론",
  process: "Agent가 수행한 검토 과정",
  document_comparison: "문서 대조 결과",
  issues_and_causes: "발견된 문제와 원인",
  regulatory_meaning: "법령 근거와 이 심사 건에서의 의미",
  business_impact: "업무상 영향",
  next_actions: "담당자가 다음으로 할 일",
  scope_and_limits: "검토 범위와 한계",
} as const;

const citationKindLabels: Record<CitationKind, string> = {
  field_source: "문서 원문 근거",
  issue: "문서 확인 사항",
  finding: "규정 확인 사항",
  evidence: "법령 근거",
  outcome: "최종 판정 근거",
};

export function citationLabel(kind: CitationKind): string {
  return citationKindLabels[kind];
}

const agentToolLabels: Readonly<Record<string, string>> = {
  "document.reread_span/v1": "문서 원문 범위 재확인",
  "evidence.retrieve/v3": "동일 법령 데이터에서 근거 재조회",
  "human.request/v1": "담당자 확인 요청",
  "explanation.compose/v2": "사용자용 결과 설명 구성",
};

const agentToolReasonLabels: Readonly<Record<string, string>> = {
  field_uncertainty: "추출한 값의 확신이 충분하지 않아 원문을 다시 확인했습니다.",
  evidence_incomplete: "첫 법령 검색의 근거가 충분하지 않아 같은 범위에서 다시 조회했습니다.",
  agent_budget_exhausted: "허용된 추가 확인 한도에 도달해 담당자 확인으로 전환했습니다.",
};

export function agentToolLabel(tool: string): string {
  return agentToolLabels[tool] ?? "허용된 추가 확인";
}

export function agentToolReasonLabel(reasonCode: string): string {
  return agentToolReasonLabels[reasonCode] ?? "심사 결과를 확정하기 전에 추가 확인이 필요했습니다.";
}

export function agentToolStatusLabel(status: string): string {
  const values: Readonly<Record<string, string>> = {
    planned: "확인 예정",
    running: "확인 중",
    succeeded: "확인 완료",
    failed: "확인 실패",
    denied: "허용되지 않음",
    deferred: "담당자 확인 필요",
  };
  return values[status] ?? "상태 확인 필요";
}

const issueLabels: Readonly<Record<string, string>> = {
  INVOICE_NO_MISMATCH: "상업송장과 포장명세서의 송장 번호가 일치하지 않습니다.",
  QTY_MISMATCH_INVOICE_PACKING: "상업송장과 포장명세서의 수량이 일치하지 않습니다.",
  INV_LINE_AMOUNT_MISMATCH: "상업송장 품목 금액 계산이 합계와 일치하지 않습니다.",
  ORIGIN_MISMATCH: "문서 사이의 원산지 정보가 일치하지 않습니다.",
  AMBIGUOUS_DOCUMENT_SET: "같은 종류의 문서가 둘 이상이라 자동으로 선택할 수 없습니다.",
};

const auditEventLabels: Readonly<Record<string, string>> = {
  "case.created": "심사 건이 생성되었습니다.",
  "document.added": "심사 문서가 등록되었습니다.",
  "document.registered": "심사 문서가 등록되었습니다.",
  "review.enqueued": "AI 사전심사가 실행 대기열에 등록되었습니다.",
  "review.started": "AI 사전심사가 시작되었습니다.",
  "review.requested": "AI 사전심사가 요청되었습니다.",
  "review.completed": "AI 사전심사 결과가 저장되었습니다.",
  "assistant_conversation.created": "AI 심사 도우미 대화가 시작되었습니다.",
  "assistant.conversation.created": "AI 심사 도우미 대화가 시작되었습니다.",
  "assistant_message.enqueued": "담당자의 질문이 접수되었습니다.",
  "assistant_message.completed": "근거 검증을 마친 답변이 저장되었습니다.",
  "assistant.message.accepted": "담당자의 질문이 접수되었습니다.",
  "assistant.answer.completed": "근거 검증을 마친 답변이 저장되었습니다.",
  "correction_proposal.created": "추출값 수정 제안이 등록되었습니다.",
  "revision_proposal.created": "추출값 수정 제안이 등록되었습니다.",
  "correction_proposal.decided": "다른 승인 담당자가 수정 제안을 결정했습니다.",
  "revision.review.requested": "승인된 수정값으로 재심사가 요청되었습니다.",
  "revision.review.completed": "수정값을 반영한 재심사가 완료되었습니다.",
};

const findingLabels: Readonly<Record<string, string>> = {
  REQUIRED_CERT_MISSING: "해당 품목에 필요한 요건 증명서가 등록되지 않았습니다.",
};

const actionLabels: Readonly<Record<string, string>> = {
  verify_supporting_document: "요건 증명서의 발급 정보와 진위를 확인합니다.",
  provide_required_certificate: "필요한 요건 증명서를 추가합니다.",
  review_document_mismatch: "불일치한 값을 원문과 대조해 확인합니다.",
  human_review: "담당자가 심사 결과와 근거를 확인합니다.",
};

const unmetReasonLabels: Readonly<Record<string, string>> = {
  backend_auto_completion_disabled: "이 검증 환경에서는 자동 처리를 사용하지 않습니다.",
  llm_extraction_uncalibrated: "문서 추출 모델의 운영 보정 검증이 아직 완료되지 않았습니다.",
  supporting_document_verification_incomplete: "요건 증명서의 독립 확인이 완료되지 않았습니다.",
  rag_release_unapproved: "법령 데이터의 운영 승인이 완료되지 않았습니다.",
  human_review_required: "담당자 확인이 필요한 심사 건입니다.",
};

const fieldLabels: Readonly<Record<string, string>> = {
  invoice_no: "송장 번호",
  invoice_date: "송장 발행일",
  issue_date: "발행일",
  seller: "판매자",
  buyer: "구매자",
  exporter: "수출자",
  importer: "수입자",
  shipper: "송하인",
  consignee: "수하인",
  notify_party: "통지처",
  total_amount: "총 금액",
  currency: "통화",
  origin_country: "원산지",
  vessel: "선박명",
  voyage: "항차",
  port_of_loading: "선적항",
  port_of_discharge: "양륙항",
  quantity: "수량",
  unit_price: "단가",
  amount: "품목 금액",
  hs_code: "품목분류번호(HSK)",
  description: "품목 설명",
  net_weight: "순중량",
  gross_weight: "총중량",
  cbm: "부피(CBM)",
  container_no: "컨테이너 번호",
  seal_no: "봉인 번호",
  package_count: "포장 수량",
  marks: "화인",
};

export function fieldLabel(name: string, fieldPath: string): string {
  const lastPath = fieldPath.split(".").at(-1) ?? "";
  return fieldLabels[name] ?? fieldLabels[lastPath] ?? "확인할 추출 항목";
}

export function issueLabel(code: string): string {
  return issueLabels[code] ?? "해석되지 않은 문서 확인 항목입니다.";
}

export function auditEventLabel(eventType: string, serverSummary: string): string {
  return auditEventLabels[eventType]
    ?? (/^[\p{Script=Hangul}\p{N}\p{P}\p{Zs}]+$/u.test(serverSummary)
      ? serverSummary
      : "심사 업무 기록이 추가되었습니다.");
}

export function findingLabel(code: string): string {
  return findingLabels[code] ?? "해석되지 않은 규정 확인 항목입니다.";
}

export function actionLabel(code: string): string {
  return actionLabels[code] ?? "담당자가 내용을 확인해야 합니다.";
}

export function unmetReasonLabel(code: string): string {
  return unmetReasonLabels[code] ?? "현재 검증 범위에서 자동 처리가 허용되지 않습니다.";
}

export function formatKoreanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 확인 필요";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}초`;
  return `${minutes}분 ${remainder}초`;
}
