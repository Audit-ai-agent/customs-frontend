import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  UAT_SCENARIOS,
  bindLocalUatScenario,
  localUatScenarioExternalReference,
  type LocalUatEvidenceProfile,
} from "../../uat/scenarios";
import { useWorkbench } from "../context";
import { Icon } from "../icons";

const PROFILE: LocalUatEvidenceProfile = "preserved-3law-v3-scenario-eval";

const categoryLabels = {
  clean: "정상 흐름",
  mismatch: "문서 불일치",
  missing: "요건 누락",
  security: "안전성",
} as const;

export function TestLabPage(): React.ReactElement {
  const { api, refreshCases } = useWorkbench();
  const navigate = useNavigate();
  const scenarios = useMemo(() => UAT_SCENARIOS.map((scenario) => bindLocalUatScenario(scenario, PROFILE)), []);
  const [selectedId, setSelectedId] = useState(scenarios[0]?.scenario.scenario_id ?? "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = scenarios.find((item) => item.scenario.scenario_id === selectedId) ?? scenarios[0];

  const createScenario = async (): Promise<void> => {
    if (!selected) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.createCase({
        title: `[UAT] ${selected.variant.title}`,
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
      setError(reason instanceof Error ? reason.message : "테스트 시나리오를 준비하지 못했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-stack" data-testid="test-lab">
      <header className="page-heading">
        <div>
          <p className="overline">시나리오 테스트</p>
          <h1>실제 3법령 RAG 흐름을 직접 확인합니다.</h1>
          <p>합성 통관 문서를 선택하면 실제 Claude와 PostgreSQL·Qdrant·Neo4j 검색 경로로 심사를 실행할 수 있습니다.</p>
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
              onClick={() => setSelectedId(item.scenario.scenario_id)}
              data-testid={`scenario-${item.scenario.scenario_id}`}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><small>{categoryLabels[item.scenario.category]}</small><strong>{item.variant.title}</strong></div>
              <Icon name="arrow" />
            </button>
            </li>
          ))}
        </ul>
        {selected ? (
          <article className="scenario-detail">
            <div className="scenario-detail__hero">
              <p className="overline">{categoryLabels[selected.scenario.category]}</p>
              <h2>{selected.variant.title}</h2>
              <p>{selected.variant.description}</p>
            </div>
            <div className="scenario-journey">
              <h3>이 시나리오에서 확인하는 흐름</h3>
              <ol>
                <li><span>1</span><p><strong>문서 분석</strong>실제 Claude가 합성 텍스트 문서를 분류하고 값을 추출합니다.</p></li>
                <li><span>2</span><p><strong>문서 대조</strong>Agent가 수량·금액·원산지 등 핵심 항목을 규칙으로 검증합니다.</p></li>
                <li><span>3</span><p><strong>실제 법령 검색</strong>3개 저장소를 이용해 제한된 3종 법령의 관련 근거를 찾습니다.</p></li>
                <li><span>4</span><p><strong>설명과 조치</strong>근거에 묶인 보고서와 담당자의 다음 행동을 제공합니다.</p></li>
              </ol>
            </div>
            <div className="scenario-expectation">
              <h3>예상 확인 결과</h3>
              <p>{selected.variant.diagnostic_observation}</p>
              <span>모든 결과는 담당자 확인으로 종료되며 자동 처리되지 않습니다.</span>
            </div>
            {selected.variant.requires_approver ? (
              <p className="scenario-approver-note">
                이 시나리오는 문서를 등록한 사람과 다른 승인 담당자의 요건 증명서 확인이 필요합니다.
              </p>
            ) : null}
            {error ? <p className="form-alert" role="alert">{error}</p> : null}
            <button
              className="commercial-button commercial-button--primary commercial-button--wide"
              type="button"
              onClick={() => void createScenario()}
              disabled={creating}
            >
              {creating ? "테스트 문서 준비 중" : "이 시나리오로 심사 건 만들기"}<Icon name="arrow" />
            </button>
          </article>
        ) : null}
      </section>
    </div>
  );
}
