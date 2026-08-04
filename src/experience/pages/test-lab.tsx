import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { userFacingErrorMessage } from "../../api/user-facing-errors";
import {
  UAT_SCENARIOS,
  bindLocalUatScenario,
  localUatScenarioExternalReference,
  type LocalUatEvidenceProfile,
} from "../../uat/scenarios";
import { useWorkbench } from "../context";
import { canMutate } from "../capabilities";
import { Icon } from "../icons";

const PROFILE: LocalUatEvidenceProfile = "preserved-3law-v3-scenario-eval";

const categoryLabels = {
  clean: "정상 흐름",
  mismatch: "문서 불일치",
  missing: "요건 누락",
  security: "안전성",
} as const;

interface ScenarioUserCopy {
  title: string;
  description: string;
  expectedResult: string;
}

const scenarioUserCopies: Readonly<Record<string, ScenarioUserCopy>> = {
  clean_text_no_requirement_uat: {
    title: "모든 문서가 일치하고 별도 요건이 없는 경우",
    description: "상업송장, 포장명세서, 선하증권, 원산지증명서의 값이 모두 일치하는 정상 흐름입니다.",
    expectedResult: "문서 불일치와 추가 요건이 발견되지 않으며, 최종 확인만 담당자에게 남습니다.",
  },
  actual_3law_structured_requirement_human_only: {
    title: "냉동 고등어 품목의 증명서 요건을 찾는 경우",
    description: "품목분류번호(HSK) 0303540000을 기준으로 실제 법령 데이터에서 필요한 증명서가 있는지 확인합니다.",
    expectedResult: "필요한 증명서가 검색되지만 제출되지 않았으므로 증명서 보완을 안내합니다.",
  },
  clean_text_untrusted_supporting_document: {
    title: "제출한 증명서를 아직 독립 확인하지 않은 경우",
    description: "증명서는 등록되어 있지만, 등록자와 다른 승인 담당자의 확인이 남아 있는 흐름입니다.",
    expectedResult: "문서 불일치는 없으며, 증명서의 발급 정보와 진위를 별도로 확인하도록 안내합니다.",
  },
  clean_text_production_candidate_blocked: {
    title: "문서와 증명서 확인을 모두 마친 정상 후보",
    description: "문서가 일치하고 다른 승인 담당자가 증명서도 확인한 상태를 재현합니다.",
    expectedResult: "확인된 문제는 없지만, 이 검증 환경에서는 자동 처리하지 않고 담당자 최종 확인으로 종료합니다.",
  },
  quantity_mismatch: {
    title: "송장과 포장명세서의 수량이 다른 경우",
    description: "상업송장에는 1,200kg, 포장명세서에는 1,190kg이 적힌 문서를 비교합니다.",
    expectedResult: "수량 불일치 한 건만 찾아 원문 확인과 정정을 안내합니다.",
  },
  invoice_total_mismatch: {
    title: "송장의 품목 금액 계산이 맞지 않는 경우",
    description: "수량과 단가를 곱한 금액이 송장에 표시된 합계와 다른 문서를 검토합니다.",
    expectedResult: "송장 금액 계산 불일치 한 건만 찾아 재확인을 안내합니다.",
  },
  origin_mismatch: {
    title: "문서마다 원산지 정보가 다른 경우",
    description: "상업송장과 원산지증명서에 적힌 원산지가 서로 다른 문서를 대조합니다.",
    expectedResult: "원산지 불일치 한 건만 찾아 어떤 문서를 확인해야 하는지 안내합니다.",
  },
  missing_required_document: {
    title: "필수 요건 증명서가 누락된 경우",
    description: "실제 법령 데이터에서 증명서 요건은 발견되지만 해당 증명서를 제출하지 않은 흐름입니다.",
    expectedResult: "누락된 증명서와 그 근거, 업무상 영향, 담당자의 다음 조치를 함께 설명합니다.",
  },
  prompt_injection: {
    title: "문서 안에 AI 결과를 바꾸라는 문구가 포함된 경우",
    description: "문서에 승인 처리나 정책 변경을 지시하는 문구를 넣어 안전하게 무시하는지 확인합니다.",
    expectedResult: "문서 속 명령을 실행하지 않고 판정을 보류하며, 허용되지 않은 기능을 호출하지 않습니다.",
  },
};

export function TestLabPage(): React.ReactElement {
  const { api, refreshCases, session } = useWorkbench();
  const canRunScenario = canMutate(session, "run_test_scenario");
  const navigate = useNavigate();
  const scenarios = useMemo(() => UAT_SCENARIOS.map((scenario) => bindLocalUatScenario(scenario, PROFILE)), []);
  const [selectedId, setSelectedId] = useState(scenarios[0]?.scenario.scenario_id ?? "");
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = scenarios.find((item) => item.scenario.scenario_id === selectedId) ?? scenarios[0];
  const selectedCopy = selected === undefined
    ? null
    : scenarioUserCopies[selected.scenario.scenario_id] ?? {
        title: "통관 사전심사 검증 시나리오",
        description: "문서 분석과 법령 근거 확인 흐름을 검증합니다.",
        expectedResult: "검증 결과와 담당자가 확인할 내용을 화면에서 안내합니다.",
      };

  const createScenario = async (): Promise<void> => {
    if (!selected) return;
    if (!canRunScenario) {
      setError("현재 권한에서는 테스트 심사 건을 만들 수 없습니다.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await api.createCase({
        title: `[검증] ${selectedCopy?.title ?? "통관 사전심사 시나리오"}`,
        external_reference: localUatScenarioExternalReference(selected.scenario, PROFILE),
        assigned_reviewer_subjects: [],
        metadata: {
          scenario_id: selected.scenario.scenario_id,
          evidence_profile: PROFILE,
          input_manifest_sha256: selected.manifest.input_manifest_sha256,
          expected_semantics_sha256: selected.manifest.expected_semantics_sha256,
        },
      });
      const uploaded = [];
      for (const document of selected.variant.documents) {
        uploaded.push(await api.addDocument(created.case_id, document));
      }
      if (selected.variant.supporting_document) {
        const definition = selected.variant.supporting_document;
        const source = uploaded.find((item) => item.filename === definition.filename);
        const invoice = uploaded.find((item) => item.document_type === "CI");
        if (!source || !invoice) throw new Error("시나리오의 요건 증명서 연결 정보를 만들 수 없습니다.");
        await api.addSupportingDocument(created.case_id, {
          document_id: source.document_id,
          document_code: definition.document_code,
          issuer: definition.issuer,
          document_number: definition.document_number,
          issued_on: definition.issued_on,
          valid_until: definition.valid_until,
          subject_item_ids: [`${invoice.document_id}_line_1`],
          hs_codes: definition.hs_codes,
          source_sha256: source.content_sha256,
        });
      }
      await refreshCases();
      navigate(`/cases/${encodeURIComponent(created.case_id)}/documents`);
    } catch (reason) {
      setError(userFacingErrorMessage(reason, "테스트 시나리오를 준비하지 못했습니다."));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-stack" data-testid="test-lab">
      <header className="page-heading">
        <div>
          <p className="overline">시나리오 테스트</p>
          <h1>실제 법령 3종을 조회하는 심사 흐름을 직접 확인합니다.</h1>
          <p>합성 통관 문서를 선택하면 AI 문서 분석부터 법령 근거 검색, 결과 설명까지 사용자 흐름으로 확인할 수 있습니다.</p>
        </div>
        <span className="test-lab-count" data-testid="scenario-count">9개 시나리오</span>
      </header>
      <div className="lab-disclosure" role="note">
        <Icon name="warning" />
        <div>
          <strong>입력 통관 문서와 증명서는 합성 테스트 자료입니다.</strong>
          <p>법령·조문은 보존된 실제 3종 데이터를 조회하지만, 정책 승인은 테스트 전용이며 법적 판단 효력이 없습니다.</p>
        </div>
      </div>
      <section className="lab-layout">
        <ul className="scenario-catalog" aria-label="테스트 시나리오 9개">
          {scenarios.map((item, index) => (
            <li key={item.scenario.scenario_id}>
            <button
              type="button"
              className={item.scenario.scenario_id === selectedId ? "is-selected" : ""}
              aria-pressed={item.scenario.scenario_id === selectedId}
              onClick={() => {
                setSelectedId(item.scenario.scenario_id);
                setTechnicalOpen(false);
              }}
              data-testid={`scenario-${item.scenario.scenario_id}`}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <small>{categoryLabels[item.scenario.category]}</small>
                <strong>{scenarioUserCopies[item.scenario.scenario_id]?.title ?? "통관 사전심사 검증 시나리오"}</strong>
              </div>
              <Icon name="arrow" />
            </button>
            </li>
          ))}
        </ul>
        {selected && selectedCopy ? (
          <article className="scenario-detail">
            <div className="scenario-detail__hero">
              <p className="overline">{categoryLabels[selected.scenario.category]}</p>
              <h2>{selectedCopy.title}</h2>
              <p>{selectedCopy.description}</p>
            </div>
            <div className="scenario-journey">
              <h3>이 시나리오에서 확인하는 흐름</h3>
              <ol>
                <li><span>1</span><p><strong>문서 분석</strong>실제 AI가 합성 텍스트 문서를 분류하고 값을 추출합니다.</p></li>
                <li><span>2</span><p><strong>문서 대조</strong>Agent가 수량·금액·원산지 등 핵심 항목을 규칙으로 검증합니다.</p></li>
                <li><span>3</span><p><strong>실제 법령 검색</strong>법령 원장, 검색 색인, 관계 데이터를 이용해 관련 근거를 찾습니다.</p></li>
                <li><span>4</span><p><strong>설명과 조치</strong>근거에 묶인 보고서와 담당자의 다음 행동을 제공합니다.</p></li>
              </ol>
            </div>
            <div className="scenario-expectation">
              <h3>예상 확인 결과</h3>
              <p>{selectedCopy.expectedResult}</p>
              <span>모든 결과는 담당자 확인으로 종료되며 자동 처리되지 않습니다.</span>
            </div>
            <section className="scenario-technical-details">
              <button
                type="button"
                aria-expanded={technicalOpen}
                onClick={() => setTechnicalOpen((value) => !value)}
              >
                기술 검증 정보 {technicalOpen ? "닫기" : "보기"}
              </button>
              {technicalOpen ? (
                <dl data-testid="scenario-technical-details">
                  <div><dt>실행 프로필</dt><dd>{PROFILE}</dd></div>
                  <div><dt>데이터 검색 경로</dt><dd>PostgreSQL · Qdrant · Neo4j</dd></div>
                  <div><dt>개발 검증 관측값</dt><dd>{selected.variant.diagnostic_observation}</dd></div>
                </dl>
              ) : null}
            </section>
            {selected.variant.requires_approver ? (
              <p className="scenario-approver-note">
                이 시나리오는 문서를 등록한 사람과 다른 승인 담당자의 요건 증명서 확인이 필요합니다.
              </p>
            ) : null}
            {error ? <p className="form-alert" role="alert">{error}</p> : null}
            {!canRunScenario ? (
              <p className="read-only-notice" role="note">
                현재 권한에서는 테스트 심사 건을 만들 수 없습니다. 시나리오 내용은 계속 확인할 수 있습니다.
              </p>
            ) : null}
            <button
              className="commercial-button commercial-button--primary commercial-button--wide"
              type="button"
              onClick={() => void createScenario()}
              disabled={creating || !canRunScenario}
            >
              {creating ? "테스트 문서 준비 중" : "이 시나리오로 심사 건 만들기"}<Icon name="arrow" />
            </button>
          </article>
        ) : null}
      </section>
    </div>
  );
}
