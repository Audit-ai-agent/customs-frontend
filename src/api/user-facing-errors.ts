export function stableApiErrorMessage(
  status: number,
  code: string | undefined,
  fallback = "요청을 안전하게 처리하지 못했습니다.",
): string {
  const normalizedCode = code?.toLowerCase() ?? "";
  if (normalizedCode.includes("stale") || normalizedCode.includes("revision_conflict")) {
    return "다른 담당자의 변경이 먼저 반영되었습니다. 최신 내용을 다시 불러온 뒤 시도해 주십시오.";
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
