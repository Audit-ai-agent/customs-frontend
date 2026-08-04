import { describe, expect, it } from "vitest";

import { auditEventLabel, issueLabel } from "../src/experience/labels";

describe("commercial Korean labels", () => {
  it("explains the invoice-number mismatch without exposing the internal code", () => {
    expect(issueLabel("INVOICE_NO_MISMATCH"))
      .toBe("상업송장과 포장명세서의 송장 번호가 일치하지 않습니다.");
  });

  it("uses a Korean audit catalog and hides unknown technical summaries", () => {
    expect(auditEventLabel("case.created", "case.created"))
      .toBe("심사 건이 생성되었습니다.");
    expect(auditEventLabel("unknown.event", "internal_event_payload"))
      .toBe("심사 업무 기록이 추가되었습니다.");
    expect(auditEventLabel("unknown.event", "담당자 확인이 완료되었습니다."))
      .toBe("담당자 확인이 완료되었습니다.");
  });
});
