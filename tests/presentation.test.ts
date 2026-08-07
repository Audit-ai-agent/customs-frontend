import { describe, expect, it } from "vitest";
import {
  casePresentation,
  comparisonRuleLabel,
  evidenceDisplayTitle,
  fieldLabel,
  findingTitle,
  isFunctionalUatCase,
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
});
