import { describe, expect, it } from "vitest";
import {
  casePresentation,
  comparisonRuleLabel,
  evidenceDisplayTitle,
  fieldLabel,
  findingTitle,
  isFunctionalUatCase,
  reviewerNarrative,
  reviewerNarrativeOriginal,
  requiresControlledNarrative,
  assistantSuggestionLabel,
  controlledStructuredValue,
  redactedStructuredVerificationValue,
} from "../src/presentation";

describe("Korean commercial presentation policy", () => {
  it("keeps documented functional-UAT records separate from ordinary business cases", () => {
    const metadataCase = {
      case_id: "case-functional", org_id: "local-org", external_reference: null, title: "내부 검증", status: "closed" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z",
      metadata: { system_case_kind: "functional_uat_matrix", system_scenario: "all-documents-match" },
    };
    const legacyCase = {
      case_id: "case-legacy", org_id: "local-org", external_reference: null, title: "Functional matrix: all-documents-match", status: "closed" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z",
    };
    const unknownLegacyCase = {
      case_id: "case-legacy-unknown", org_id: "local-org", external_reference: null, title: "Functional matrix: future-case", status: "closed" as const, revision: 1, updated_at: "2026-08-05T00:00:00Z",
    };

    expect(casePresentation(metadataCase)).toMatchObject({ kind: "functional-uat", title: "기능 검증 · 문서 간 일치 확인" });
    expect(casePresentation(legacyCase)).toMatchObject({ kind: "functional-uat", title: "기능 검증 · 문서 간 일치 확인" });
    expect(casePresentation(unknownLegacyCase)).toMatchObject({ kind: "functional-uat", title: "기능 검증 기록" });
    expect(isFunctionalUatCase(metadataCase)).toBe(true);
  });

  it("replaces machine labels with reviewer language and fails safely for unknown codes", () => {
    expect(fieldLabel("hs_code")).toBe("HS 코드");
    expect(comparisonRuleLabel("invoice_packing_quantity_unit")).toBe("송장·포장명세서 수량과 단위 확인");
    expect(comparisonRuleLabel("unrecognized_rule")).toBe("추가 확인 필요");
    expect(findingTitle({ code: "inspect_hs_code_not_found_da3be97", comparison_id: null })).toBe("HS 코드 확인 필요");
    expect(evidenceDisplayTitle({ source_type: "customs_requirement", law_name: "cusstom_requireHSK 40000 import 요건" })).toBe("수입 요건");
  });

  it("keeps legacy English prose, raw file names, and machine references out of the primary reviewer surface", () => {
    const legacy = "Document validation for matching-origin.txt failed at comparison-1515e58.";
    expect(requiresControlledNarrative(legacy)).toBe(true);
    expect(reviewerNarrative(legacy, "원산지증명서의 확인 사항을 담당자가 검토해야 합니다.")).toBe("원산지증명서의 확인 사항을 담당자가 검토해야 합니다.");
    expect(assistantSuggestionLabel("matching-origin.txt의 HS 코드를 확인해 주세요.")).toBe("현재 심사 결과에서 확인이 필요한 항목을 설명해 주세요.");
    expect(requiresControlledNarrative("원산지증명서.txt의 HS 코드 기재 여부를 확인해 주세요.")).toBe(true);
    expect(requiresControlledNarrative("검토 식별값 ca3647b4a24e64fc3a12c04a를 확인하십시오.")).toBe(true);
    expect(requiresControlledNarrative("검토 식별값 123e4567-e89b-12d3-a456-426614174000을 확인하십시오.")).toBe(true);
    expect(requiresControlledNarrative("B/L 번호와 HS 코드를 확인했습니다.")).toBe(false);
  });

  it("never exposes a credential-shaped value or provider error in collapsed legacy prose", () => {
    const syntheticToken = ["sk", "ant", "super", "secret", "token"].join("-");
    const providerError = `Anthropic provider_error: Authorization: Bearer ${syntheticToken} request id req_123`;
    expect(requiresControlledNarrative(providerError)).toBe(true);
    expect(reviewerNarrativeOriginal(providerError)).toBe("외부 AI 제공자 오류 원문은 화면에 표시하지 않습니다.");
    const syntheticDsn = ["postgresql", "://", "reviewer", ":", "not-a-real-password", "@127.0.0.1:5432/customs"].join("");
    const credential = `연결 정보: ${syntheticDsn}`;
    expect(requiresControlledNarrative(credential)).toBe(true);
    expect(reviewerNarrativeOriginal(credential)).not.toContain("password");
    expect(reviewerNarrativeOriginal(credential)).not.toContain("postgresql://");
    const environmentStyleKey = `ANTHROPIC_API_KEY=${"sk-ant-"}example-redacted-value`;
    expect(requiresControlledNarrative(environmentStyleKey)).toBe(true);
    expect(reviewerNarrativeOriginal(environmentStyleKey)).not.toContain(environmentStyleKey.split("=")[1] ?? "");
  });

  it("keeps useful structured business values while protecting unsafe structured values", () => {
    expect(controlledStructuredValue("10")).toBe("10");
    expect(controlledStructuredValue("USD 20")).toBe("USD 20");
    expect(controlledStructuredValue("INV-001")).toBe("INV-001");
    expect(controlledStructuredValue("원산지증명서.txt의")).toBe("추가 확인 필요");
    expect(controlledStructuredValue("comparison-1515e58")).toBe("추가 확인 필요");
    const syntheticDsn = ["postgresql", "://", "reviewer", ":", "not-a-real-password", "@127.0.0.1:5432/customs"].join("");
    expect(controlledStructuredValue(syntheticDsn)).toBe("추가 확인 필요");
    expect(redactedStructuredVerificationValue("원산지증명서.txt의")).toBe("표시 제한된 값");
    expect(redactedStructuredVerificationValue(syntheticDsn)).toBe("표시 제한된 값");
  });
});
