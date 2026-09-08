/** Admin LLM settings surface: stable codes from the Agent, shown as-is to the operator. */
const LLM_SETTINGS_MESSAGES: Readonly<Record<string, string>> = {
  llm_settings_invalid: "설정 값이 올바르지 않습니다. 제공자에 맞는 모델 이름과 허용 범위 안의 숫자를 입력해 주십시오.",
  llm_credential_missing: "해당 제공자의 API 키가 서버에 없습니다. 서버 환경 설정에 키를 추가한 뒤 다시 시도해 주십시오.",
  llm_settings_unavailable: "로컬 개발 모드에서는 LLM 설정을 변경할 수 없습니다.",
  llm_configuration_invalid: "서버의 LLM 환경 설정이 올바르지 않아 현재 설정을 확인할 수 없습니다.",
  provider_request_failed: "LLM 제공자 요청이 실패했습니다. 모델 이름·API 키·네트워크 상태를 확인해 주십시오.",
  provider_sdk_unavailable: "서버에 해당 제공자 SDK가 설치되어 있지 않습니다.",
  provider_response_invalid: "LLM 제공자가 올바른 응답을 돌려주지 않았습니다.",
};

export function stableApiErrorMessage(
  status: number,
  code: string | undefined,
  fallback = "요청을 안전하게 처리하지 못했습니다.",
): string {
  const normalizedCode = code?.toLowerCase() ?? "";
  const llmSettingsMessage = LLM_SETTINGS_MESSAGES[normalizedCode];
  if (llmSettingsMessage !== undefined) return llmSettingsMessage;
  if (normalizedCode.includes("knowledge_input")) {
    return "통관 지식 도우미에는 사건 문서·식별정보·원문을 입력할 수 없습니다. 일반 통관 질문만 입력해 주세요.";
  }
  if (normalizedCode.includes("stale") || normalizedCode.includes("revision_conflict")) {
    return "다른 담당자의 변경이 먼저 반영되었습니다. 최신 내용을 다시 불러온 뒤 시도해 주십시오.";
  }
  if (
    normalizedCode === "raster_ocr_unavailable"
    || normalizedCode === "raster_text_ocr_unavailable"
    || normalizedCode === "raster_text_extraction_unavailable"
  ) {
    return "Raster OCR 텍스트 profile이 아직 활성화되지 않았거나 현재 사용할 수 없습니다. 기존 심사 문서는 변경되지 않았습니다.";
  }
  if (normalizedCode === "raster_profile_superseded" || normalizedCode === "raster_text_profile_superseded") {
    return "현재 OCR 텍스트 profile이 바뀌어 이전 텍스트 초안 등록을 중단했습니다. 새 Raster OCR 텍스트 요청을 사용하십시오.";
  }
  if (
    normalizedCode.includes("response_rejected")
    || normalizedCode.includes("validation")
    || normalizedCode.includes("contract")
  ) {
    return "받은 결과가 안전 검증을 통과하지 못해 표시하지 않았습니다. 기존 심사 결과는 변경되지 않았습니다.";
  }
  const byStatus: Readonly<Record<number, string>> = {
    400: "입력한 내용을 확인해 주십시오.",
    401: "로그인 정보가 만료되었습니다. 다시 로그인해 주십시오.",
    403: "이 작업을 수행할 권한이 없습니다.",
    404: "요청한 심사 정보가 없거나 현재 접근할 수 없습니다.",
    409: "심사 정보가 변경되었습니다. 최신 내용을 다시 불러온 뒤 시도해 주십시오.",
    412: "검증 환경의 버전 정보가 일치하지 않아 요청을 중단했습니다.",
    413: "입력한 문서나 요청의 크기가 허용 범위를 초과했습니다.",
    422: "입력 내용이나 결과의 안전 검증을 통과하지 못했습니다.",
    429: "요청이 많아 잠시 처리할 수 없습니다. 잠시 후 다시 시도해 주십시오.",
    500: "서비스 내부 처리 중 문제가 발생했습니다. 기존 심사 결과는 변경되지 않았습니다.",
    502: "AI 또는 법령 검색 서비스의 응답을 확인하지 못했습니다.",
    503: "AI 또는 법령 검색 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해 주십시오.",
    504: "처리 시간이 길어 연결이 종료되었습니다. 이력에서 작업 상태를 확인해 주십시오.",
  };
  return byStatus[status] ?? fallback;
}

export function technicalApiErrorDetail({
  detail,
  status,
  code,
  requestId,
}: {
  detail: string;
  status: number;
  code?: string;
  requestId?: string;
}): string {
  return [
    `HTTP ${status}`,
    code ? `code=${code}` : null,
    requestId ? `request_id=${requestId}` : null,
    detail ? `detail=${detail}` : null,
  ].filter((value): value is string => value !== null).join(" · ");
}

/**
 * Keeps transport/contract diagnostics out of the normal user surface.
 * ApiError already carries a stable Korean message while preserving its raw
 * diagnostic in `technicalDetail`. Locally authored Korean validation errors
 * may be shown as-is; every other Error is reduced to the action-specific
 * fallback.
 */
export function userFacingErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (
    error.name === "ApiError"
    && /[가-힣]/u.test(error.message)
  ) {
    return error.message;
  }
  return /[가-힣]/u.test(error.message) ? error.message : fallback;
}
