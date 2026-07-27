import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/v1/client";
import { ExperienceApiError } from "../src/api/v2/client";
import { userFacingErrorMessage } from "../src/api/user-facing-errors";

describe("stable Korean Backend error boundary", () => {
  it("keeps a Backend detail out of the user message and retains it only as technical detail", () => {
    const error = new ApiError(
      "stale revision: expected 7 got 8",
      409,
      "stale_revision",
      "request-1",
    );
    expect(error.message).toContain("최신 내용을 다시 불러온 뒤");
    expect(error.message).not.toContain("expected 7 got 8");
    expect(error.technicalDetail).toContain("expected 7 got 8");
    expect(error.technicalDetail).toContain("request_id=request-1");
  });

  it("maps an enhanced experience dependency failure to stable Korean copy", () => {
    const error = new ExperienceApiError(
      "evidence provider readiness failed at PostgreSQL",
      503,
      "dependency_not_ready",
    );
    expect(error.message).toBe(
      "AI 또는 법령 검색 서비스가 준비되지 않았습니다. 잠시 후 다시 시도해 주십시오.",
    );
    expect(error.message).not.toContain("PostgreSQL");
    expect(error.technicalDetail).toContain("PostgreSQL");
  });

  it("does not expose parser or contract diagnostics through a business screen", () => {
    expect(userFacingErrorMessage(
      new Error("Unexpected token '<' at position 0"),
      "심사 결과를 불러오지 못했습니다.",
    )).toBe("심사 결과를 불러오지 못했습니다.");
    expect(userFacingErrorMessage(
      new Error("현재 심사 회차와 대화가 일치하지 않습니다."),
      "질문을 전달하지 못했습니다.",
    )).toBe("현재 심사 회차와 대화가 일치하지 않습니다.");
  });
});
