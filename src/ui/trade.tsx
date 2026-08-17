import { useState } from "react";
import type { DutyRate, HsCandidate, OriginCheckStatus } from "../api/v1/types";
import { EmptyCopy, EmptyState, ExternalSourceLink, Field, Num, RoleBoundaryNote, SectionHeading, Submit } from "./primitives";
import { GoToDocumentsButton } from "./stages";
import { useStore, useWorkbenchState } from "./useStore";

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/* ── 단계 1 · HSK 분류 카드 ──────────────────────────────────── */

export function HsClassificationCard() {
  const store = useStore();
  const state = useWorkbenchState();
  const view = state.hsClassification;
  const [chosen, setChosen] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  if (!state.selectedRun) {
    return (
      <section className="surface">
        <SectionHeading title="HSK 분류" description="문서에서 추출된 HS 코드 근거로 후보를 제시합니다." />
        <EmptyCopy>AI 심사를 실행하면 문서 사실을 근거로 HSK 후보가 표시됩니다.</EmptyCopy>
      </section>
    );
  }
  if (state.hsError) {
    return (
      <section className="surface">
        <SectionHeading title="HSK 분류" description="문서에서 추출된 HS 코드 근거로 후보를 제시합니다." />
        <p className="unsupported-inline">{state.hsError}</p>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="surface">
        <SectionHeading title="HSK 분류" description="문서에서 추출된 HS 코드 근거로 후보를 제시합니다." />
        <EmptyCopy>{state.hsLoading ? "HSK 후보를 불러오는 중…" : "HSK 후보가 아직 없습니다."}</EmptyCopy>
      </section>
    );
  }

  const selection = view.selection ?? null;
  const activeCode = chosen ?? selection?.code ?? null;
  const recommended = view.candidates.find((item) => item.recommended) ?? null;
  const manualOverride = selection !== null && recommended !== null && selection.code !== recommended.code;
  const descriptionOnly =
    view.candidates.length > 0 &&
    view.candidates.every((item) => item.origin === "description_match");

  return (
    <section className="surface" data-hsk-card>
      <SectionHeading
        title="HSK 분류"
        description={`문서에서 추출된 HS 코드 근거로 후보를 제시합니다. 품목명 출처: ${view.reference.source} (${view.reference.as_of} 기준)`}
      />
      {descriptionOnly ? (
        <div className="hsk-note on" data-hsk-description-note>
          문서에서 HS 코드를 찾지 못해 <b>품명 매칭 후보</b>를 제시합니다. 참조표의 품목명과 품명 텍스트를
          대조한 결과일 뿐이므로 반드시 담당자가 검토 후 확정하십시오.
        </div>
      ) : null}
      {view.candidates.length === 0 ? (
        <EmptyCopy>이번 실행의 문서 사실에서 HS 코드와 품명을 찾지 못했습니다. 문서 원문을 보완하십시오.</EmptyCopy>
      ) : (
        <div className="hsk">
          {view.candidates.map((candidate) => (
            <HsCandidateRow
              key={candidate.code}
              candidate={candidate}
              picked={activeCode === candidate.code}
              confirmed={selection?.code === candidate.code}
              onPick={() => setChosen(candidate.code)}
            />
          ))}
        </div>
      )}
      {selection ? (
        <p className="form-hint" data-hsk-selection>
          {`확정 코드 ${selection.code} · ${selection.selected_by} · ${selection.reason}`}
        </p>
      ) : null}
      {manualOverride ? (
        <div className="hsk-note on">
          ⚠ 추천 후보({recommended.code})와 다른 코드로 <b>수동 확정</b>되어 있습니다. 관세 진단의 세율·요건이 확정
          코드 기준으로 재평가됩니다.
        </div>
      ) : null}
      {store.hasRole("reviewer") ? (
        activeCode !== null && activeCode !== selection?.code ? (
          <form
            className="decision-form"
            onSubmit={(event) => {
              event.preventDefault();
              void store.recordHsSelection(activeCode, reason).then(() => {
                setChosen(null);
                setReason("");
              });
            }}
          >
            <Field label={`선택한 코드 ${activeCode} 확정 사유`}>
              <input
                name="hs_reason"
                type="text"
                required
                maxLength={4_000}
                placeholder="예: 문서 3건의 HS 코드가 일치"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
            <Submit label="HSK 분류 확정" disabled={state.busy} />
          </form>
        ) : null
      ) : (
        <RoleBoundaryNote>HSK 분류 확정은 심사자 역할에서만 할 수 있습니다.</RoleBoundaryNote>
      )}
    </section>
  );
}

function HsCandidateRow({
  candidate,
  picked,
  confirmed,
  onPick,
}: {
  candidate: HsCandidate;
  picked: boolean;
  confirmed: boolean;
  onPick: () => void;
}) {
  const breadcrumbs = candidate.ancestors.map((item) => item.name_ko).join(" › ");
  return (
    <div
      className={`cand${picked ? " pick" : ""}`}
      role="button"
      tabIndex={0}
      data-hsk-candidate-code={candidate.code}
      onClick={onPick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPick();
        }
      }}
    >
      <div className="code">{candidate.code}</div>
      <div className="desc">
        {candidate.name_ko ?? "품목명 정보 없음 (참조표 밖의 코드)"}
        <small>
          {breadcrumbs || "분류 경로 없음"}
          {` · 근거 문서 ${new Set(candidate.basis.map((item) => item.document_id)).size}건`}
        </small>
      </div>
      <div className="conf-bar">
        <div className="track">
          <div className="fill" style={{ width: `${Math.round(candidate.confidence * 100)}%` }} />
        </div>
        <div className="pct">{candidate.confidence.toFixed(2)}</div>
      </div>
      <span className="pin">
        {confirmed
          ? "확정"
          : candidate.recommended
            ? "추천"
            : candidate.origin === "description_match"
              ? "품명 기반"
              : "후보"}
      </span>
    </div>
  );
}

/* ── 단계 2 · 원산지(CO) 검증 카드 ───────────────────────────── */

const ORIGIN_STATUS_LABELS: Record<string, string> = {
  verified: "원산지 일치 확인",
  mismatch: "원산지 불일치",
  missing_certificate: "원산지증명서 없음",
  needs_review: "검수 필요",
};

const ORIGIN_FIELD_LABELS: Record<string, string> = {
  certificate_no: "증명서 번호",
  origin_country: "원산지 국가",
  hs_code: "HS 코드",
};

const CHECK_STATUS_LABELS: Record<OriginCheckStatus, string> = {
  match: "일치",
  mismatch: "불일치",
  missing: "값 없음",
};

export function OriginVerificationCard() {
  const state = useWorkbenchState();
  const view = state.originVerification;

  if (!state.selectedRun) return null;
  if (state.originError) {
    return (
      <section className="surface">
        <SectionHeading title="원산지 검증 (CO)" description="원산지증명서와 다른 서류의 값을 대조합니다." />
        <p className="unsupported-inline">{state.originError}</p>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="surface">
        <SectionHeading title="원산지 검증 (CO)" description="원산지증명서와 다른 서류의 값을 대조합니다." />
        <EmptyCopy>{state.originLoading ? "원산지 검증 결과를 불러오는 중…" : "검증 결과가 아직 없습니다."}</EmptyCopy>
      </section>
    );
  }

  const tone = view.status === "verified" ? "b-ok" : "b-bad";
  return (
    <section className="surface" data-origin-card>
      <SectionHeading
        title="원산지 검증 (CO)"
        description="원산지증명서의 번호·원산지·HS 코드를 다른 서류의 값과 대조한 결과입니다."
      />
      <p>
        <span className={`badge ${tone}`}>{ORIGIN_STATUS_LABELS[view.status] ?? view.status}</span>
        {view.certificate ? (
          <span className="form-hint">{` ${view.certificate.filename} 기준`}</span>
        ) : (
          <span className="form-hint"> 활성 문서 중 Certificate of Origin이 없습니다.</span>
        )}
      </p>
      {view.checks.length > 0 ? (
        <div className="sheet">
          <div className="sheet-body">
            {view.checks.map((check) => (
              <div className="row" key={check.field} data-origin-check={check.field}>
                <span className="k">{ORIGIN_FIELD_LABELS[check.field] ?? check.field}</span>
                <span className="v">
                  {`CO: ${check.certificate_value ?? "—"}`}
                  {check.field === "certificate_no" ? "" : ` · 대조: ${check.reference_value ?? "—"}`}
                  {"  "}
                  <span className={`badge ${check.status === "match" ? "b-ok" : "b-bad"}`}>
                    {CHECK_STATUS_LABELS[check.status]}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="form-hint" data-origin-fta>
        {view.fta_hints.map((hint) => (
          <p key={hint.agreement_code}>
            {`${hint.agreement_name} — ${hint.origin_covered ? "원산지 대상국" : "대상국 아님"} · 필요 서식: ${hint.certificate_form} `}
            <ExternalSourceLink uri={hint.source_uri} />
          </p>
        ))}
      </div>
    </section>
  );
}

/* ── 단계 4 · 관세 진단 화면 ─────────────────────────────────── */

const DUTY_REQUIREMENT_LABELS: Record<string, string> = {
  origin_in_agreement: "협정 대상국 원산지",
  certificate_present: "원산지증명서 제출",
  certificate_origin_match: "증명서 원산지 일치",
};

const DUTY_UNAVAILABLE_COPY: Record<string, { title: string; copy: string }> = {
  hs_code_unavailable: {
    title: "HS 코드를 찾지 못했습니다.",
    copy: "문서 사실에서 10자리 HS 코드를 찾지 못해 세율을 조회할 수 없습니다. 1단계에서 HSK 분류를 확인하십시오.",
  },
  rates_unavailable: {
    title: "이 HS 코드의 세율 스냅샷이 없습니다.",
    copy: "참조 세율 데이터에 이 코드의 항목이 없어 금액을 표시하지 않습니다. 실제 세율은 UNI-PASS에서 확인하십시오.",
  },
  value_unavailable: {
    title: "과세가격 근거를 찾지 못했습니다.",
    copy: "송장 총액(total_amount) 사실이 없어 금액 계산을 표시하지 않습니다. 송장 문서를 확인하십시오.",
  },
};

export function DutyDiagnosisStage() {
  const state = useWorkbenchState();
  const run = state.selectedRun;
  const view = state.dutyAssessment;

  if (!run) {
    return (
      <EmptyState title="아직 관세 진단이 없습니다." copy="활성 텍스트 문서를 등록한 뒤 AI 심사를 시작하십시오.">
        <GoToDocumentsButton />
      </EmptyState>
    );
  }
  if (state.dutyError) {
    return (
      <section className="surface">
        <SectionHeading title="관세 메리트 진단" description="확정 HS 코드와 문서 근거로 세율을 진단합니다." />
        <p className="unsupported-inline">{state.dutyError}</p>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="surface">
        <SectionHeading title="관세 메리트 진단" description="확정 HS 코드와 문서 근거로 세율을 진단합니다." />
        <EmptyCopy>{state.dutyLoading ? "관세 진단을 불러오는 중…" : "관세 진단이 아직 없습니다."}</EmptyCopy>
      </section>
    );
  }

  if (view.status !== "estimated") {
    const copy = DUTY_UNAVAILABLE_COPY[view.status];
    return (
      <section className="stage-view" data-duty-stage>
        <section className="surface">
          <SectionHeading title="관세 메리트 진단" description={view.reference.disclaimer} />
          <EmptyState title={copy?.title ?? "관세 진단을 표시할 수 없습니다."} copy={copy?.copy ?? ""} />
          {view.rates.length > 0 ? <RateLadder rates={view.rates} appliedKind={null} /> : null}
        </section>
      </section>
    );
  }

  const applied = view.applied;
  const savings = view.savings;
  const dutiable = view.dutiable_value;
  const bestBlocked = view.rates.find((rate) => !rate.applicable && rate.requirements.length > 0);
  const currency = dutiable?.currency ?? "USD";

  return (
    <section className="stage-view" data-duty-stage>
      <section className="surface">
        <SectionHeading
          title="관세 메리트 진단"
          description={`확정 HSK ${view.hs_code?.code ?? "—"}${view.hs_code?.name_ko ? ` (${view.hs_code.name_ko})` : ""} · 원산지 ${view.origin_country ?? "미확인"} 기준. ${view.reference.disclaimer}`}
        />
        <div className="merit-hero">
          <div className="ladder">
            <h3>적용 가능 세율 사다리</h3>
            <div className="cap">
              {dutiable ? `과세가격 ${formatMoney(dutiable.amount, currency)} (송장 통화 기준) · 세율 낮은 순 우선` : "세율 낮은 순 우선"}
            </div>
            <RateLadderRows rates={view.rates} appliedKind={applied?.rate_kind ?? null} appliedAgreement={applied?.agreement_code ?? null} />
            <div className="cap" style={{ marginTop: 12, marginBottom: 0 }}>
              ⚖ 세율 스냅샷 {view.reference.as_of} 기준 · 요건 충족 세율만 적용
            </div>
          </div>

          <div className="sim">
            <h3>예상 세액 (서버 계산)</h3>
            <div className="sim-out">
              <div className="so-row">
                <span className="k">과세가격</span>
                <span className="v">{dutiable ? formatMoney(dutiable.amount, currency) : "—"}</span>
              </div>
              <div className="so-row">
                <span className="k">{`적용 세율 (${applied ? `${applied.rate_pct}%` : "—"})`}</span>
                <span className="v">{applied ? <Num value={applied.duty_amount} format={(n) => formatMoney(n, currency)} /> : "—"}</span>
              </div>
              <div className="so-row sub">
                <span className="k">{`부가세 ${applied?.vat_rate_pct ?? 10}%`}</span>
                <span className="v">{applied ? formatMoney(applied.vat_amount, currency) : "—"}</span>
              </div>
              <div className="so-total">
                <span className="k">예상 세액 합계</span>
                <span className="v">{applied ? formatMoney(applied.total_estimated, currency) : "—"}</span>
              </div>
            </div>
          </div>

          <div className="saving">
            <div className="lab">
              {savings && savings.vs_basic_duty > 0
                ? "협정세율 적용으로 기본세율 대비 절감된 관세"
                : "요건 충족 시 절감 가능한 관세 (현재 기본세율 적용)"}
            </div>
            <div className="amt">
              <Num
                value={savings ? (savings.vs_basic_duty > 0 ? savings.vs_basic_duty : potentialSaving(view.rates, dutiable?.amount ?? 0)) : 0}
                format={(n) => formatMoney(n, currency)}
                duration={1100}
              />
            </div>
            <div className="sub">
              {savings && savings.vs_basic_duty > 0
                ? `기본세율 대비 · ${applied?.agreement_code ?? ""}`
                : savings && savings.blocked_requirements.length > 0
                  ? `미충족 요건: ${savings.blocked_requirements.map((code) => DUTY_REQUIREMENT_LABELS[code] ?? code).join(", ")}`
                  : "추가 절감 여지가 없습니다"}
            </div>
          </div>
        </div>
      </section>

      {bestBlocked ? (
        <section className="surface">
          <div className="section-lbl">
            <span className="bar" />
            {`${bestBlocked.label} ${bestBlocked.rate_pct}%를 받으려면 — 요건 체크`}
          </div>
          <div className="unlock">
            <div className="unlock-top">
              <div className="k">
                협정관세 적용 요건<small>세율 스냅샷 {view.reference.as_of} 기준</small>
              </div>
              <span className="goal">{`목표 ${bestBlocked.rate_pct}%`}</span>
            </div>
            {bestBlocked.requirements.map((requirement) => (
              <div className={`req ${requirement.satisfied ? "have" : "need"}`} key={requirement.code}>
                <div className="box">{requirement.satisfied ? "✓" : "!"}</div>
                <div className="rq">
                  <div className="t">
                    {DUTY_REQUIREMENT_LABELS[requirement.code] ?? requirement.code}
                    <span className="st">{requirement.satisfied ? "충족" : "미충족"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface">
        <SectionHeading title="세율 출처" description={`${view.reference.source} · ${view.reference.as_of} 기준`} />
        <ul className="unsupported-stage__list">
          {view.rates.map((rate) => (
            <li key={`${rate.rate_kind}:${rate.agreement_code ?? "basic"}`}>
              {`${rate.label} ${rate.rate_pct}% `}
              <ExternalSourceLink uri={rate.source_uri} />
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

function potentialSaving(rates: DutyRate[], amount: number): number {
  if (!rates.length || amount <= 0) return 0;
  const basic = rates.find((rate) => rate.rate_kind === "basic");
  const best = rates.reduce((left, right) => (left.rate_pct <= right.rate_pct ? left : right));
  if (!basic) return 0;
  return Math.round((amount * (basic.rate_pct - best.rate_pct)) / 100 * 100) / 100;
}

function RateLadder({ rates, appliedKind }: { rates: DutyRate[]; appliedKind: string | null }) {
  return (
    <div className="ladder">
      <h3>이 코드의 세율 스냅샷</h3>
      <RateLadderRows rates={rates} appliedKind={appliedKind} appliedAgreement={null} />
    </div>
  );
}

function RateLadderRows({
  rates,
  appliedKind,
  appliedAgreement,
}: {
  rates: DutyRate[];
  appliedKind: string | null;
  appliedAgreement: string | null;
}) {
  const maxRate = Math.max(...rates.map((rate) => rate.rate_pct), 1);
  const lowest = Math.min(...rates.map((rate) => rate.rate_pct));
  const ordered = [...rates].sort((left, right) => left.rate_pct - right.rate_pct);
  return (
    <>
      {ordered.map((rate, index) => {
        const isApplied =
          appliedKind !== null &&
          rate.rate_kind === appliedKind &&
          (rate.rate_kind === "basic" || rate.agreement_code === appliedAgreement);
        const isBest = rate.rate_pct === lowest;
        return (
          <div
            className={`rate${isBest ? " best" : isApplied ? " applied" : ""}`}
            key={`${rate.rate_kind}:${rate.agreement_code ?? "basic"}`}
            data-duty-rate={rate.rate_kind === "basic" ? "basic" : rate.agreement_code ?? "fta"}
          >
            <div className="nm">
              <span className="rk">{index + 1}</span>
              {rate.label}
            </div>
            <div className="track">
              <div className="fill" style={{ width: `${Math.max(6, Math.round((rate.rate_pct / maxRate) * 100))}%` }} />
            </div>
            <div className="pct">{rate.rate_pct}%</div>
            <span className="flag">
              {isApplied ? "현재 적용" : rate.applicable ? "적용 가능" : "요건 미충족"}
            </span>
          </div>
        );
      })}
    </>
  );
}
