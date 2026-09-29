import { useEffect, useState, type FormEvent } from "react";
import type { DemoFallbackMode, LlmProvider, LlmSettingsUpdate, LlmSettingsView, ReviewRunSummary } from "../api/v1/types";
import { formatDate, providerLabel } from "./labels";
import { EmptyCopy, Field, RoleBoundaryNote, SectionHeading, Submit } from "./primitives";
import { useStore, useWorkbenchState } from "./useStore";

/* ── 관리자 설정 (#/admin) ───────────────────────────────────────
 * 주소를 직접 입력해야만 열리는 운영자 화면. 전역 메뉴·홈 카드·안내에는
 * 링크가 없다. 표시는 누구나 볼 수 있지만 변경·연결 테스트는 승인자
 * 역할에서만 가능하고, Backend도 같은 역할을 다시 검사한다. 값은 서버
 * (Agent)에만 저장되며 브라우저에는 남기지 않는다. */

/** Suggestions only — any provider-valid model name may be typed. */
const MODEL_SUGGESTIONS: readonly { provider: LlmProvider; model: string }[] = [
  { provider: "openai", model: "gpt-5.6-luna" },
  { provider: "openai", model: "gpt-5.5" },
  { provider: "openai", model: "gpt-5.4-mini" },
  { provider: "openai", model: "gpt-4.1-mini" },
  { provider: "openai", model: "gpt-4.1" },
  { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  { provider: "anthropic", model: "claude-sonnet-4-5" },
];

interface FormValues {
  provider: LlmProvider;
  model: string;
  maxTokens: string;
  timeoutSeconds: string;
}

function formFrom(view: LlmSettingsView): FormValues {
  return {
    provider: view.provider,
    model: view.model,
    maxTokens: String(view.max_tokens),
    timeoutSeconds: String(view.timeout_seconds),
  };
}

/**
 * Builds the sparse update: only fields that differ from the active view are
 * sent, so a provider switch with an untouched model lets the Agent pick that
 * provider's default model instead of rejecting a mismatched name.
 */
function buildUpdate(form: FormValues, view: LlmSettingsView): { update: LlmSettingsUpdate; error: string | null } {
  const update: LlmSettingsUpdate = {};
  const providerChanged = form.provider !== view.provider;
  if (providerChanged) update.provider = form.provider;
  const model = form.model.trim();
  if (model !== view.model) {
    if (!model) {
      if (!providerChanged) return { update, error: "모델 이름을 입력해 주십시오." };
    } else if (model.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(model)) {
      return { update, error: "모델 이름은 영문·숫자·. _ : - 만 사용해 128자 이내로 입력해 주십시오." };
    } else {
      update.model = model;
    }
  }
  const maxTokens = Number(form.maxTokens);
  if (form.maxTokens.trim() === "" || !Number.isInteger(maxTokens) || maxTokens < 256 || maxTokens > 16_384) {
    return { update, error: "최대 출력 토큰은 256 이상 16384 이하의 정수로 입력해 주십시오." };
  }
  if (maxTokens !== view.max_tokens) update.max_tokens = maxTokens;
  const timeout = Number(form.timeoutSeconds);
  if (form.timeoutSeconds.trim() === "" || !Number.isFinite(timeout) || timeout < 1 || timeout > 300) {
    return { update, error: "응답 제한 시간은 1초 이상 300초 이하로 입력해 주십시오." };
  }
  if (timeout !== view.timeout_seconds) update.timeout_seconds = timeout;
  return { update, error: null };
}

export function AdminPage() {
  const store = useStore();
  const state = useWorkbenchState();
  const view = state.llmSettings;
  const isApprover = store.hasRole("approver");

  if (state.llmSettingsError !== null && view === null) {
    return (
      <section className="page-grid" data-admin-page>
        <section className="surface">
          <SectionHeading title="LLM 설정" description="AI 심사에 쓰는 제공자·모델·응답 한도입니다." />
          <p className="unsupported-inline">{state.llmSettingsError}</p>
          <button className="btn" type="button" onClick={() => void store.refreshLlmSettings()}>다시 시도</button>
        </section>
      </section>
    );
  }
  if (view === null) {
    return (
      <section className="page-grid" data-admin-page>
        <section className="surface">
          <SectionHeading title="LLM 설정" description="AI 심사에 쓰는 제공자·모델·응답 한도입니다." />
          <EmptyCopy>LLM 설정을 불러오는 중…</EmptyCopy>
        </section>
      </section>
    );
  }

  return (
    <section className="page-grid" data-admin-page>
      <CurrentSettingsCard view={view} />
      {isApprover ? (
        <SettingsForm view={view} />
      ) : (
        <section className="surface">
          <SectionHeading title="설정 변경" description="" />
          <RoleBoundaryNote>
            LLM 설정 변경과 연결 테스트는 승인자 역할에서만 가능합니다. 현재 세션은 읽기만 할 수 있습니다.
          </RoleBoundaryNote>
        </section>
      )}
      <ConnectionTestCard />
      <DemoFallbackCard />
    </section>
  );
}

/* ── 시연 폴백 ───────────────────────────────────────────────────
 * 현장 시연 중 LLM 제공자가 죽어도 심사가 멈추지 않도록, 완료된 심사
 * 실행을 Case별로 여러 개 미리 등록해 둔다. 같은 서류(내용 해시가 같은
 * 확정 문서 집합)로 심사를 걸면 모드에 따라 Agent 대신 등록된 결과를
 * 그대로 재사용한다. 자동: Agent 호출이 실패했을 때만. 항상: 무조건. */

const MODE_LABELS: Record<DemoFallbackMode, { label: string; help: string }> = {
  off: { label: "끄기", help: "항상 Agent(LLM)를 호출합니다." },
  auto: { label: "자동", help: "Agent 호출이 실패하면 같은 서류로 등록된 결과를 대신 씁니다." },
  always: { label: "항상", help: "같은 서류가 등록돼 있으면 Agent를 부르지 않고 등록된 결과를 씁니다(리허설용)." },
};

function DemoFallbackCard() {
  const store = useStore();
  const state = useWorkbenchState();
  const view = state.demoFallback;
  const isApprover = store.hasRole("approver");
  const [delay, setDelay] = useState("");
  const [name, setName] = useState("");
  const [caseId, setCaseId] = useState("");
  const [runs, setRuns] = useState<ReviewRunSummary[]>([]);
  const [runId, setRunId] = useState("");
  const [runsError, setRunsError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (view !== null) setDelay(String(view.settings.delay_seconds));
  }, [view]);

  // Picking a case lists its completed runs; the newest one is preselected.
  useEffect(() => {
    if (!caseId) {
      setRuns([]);
      setRunId("");
      return;
    }
    let cancelled = false;
    store
      .listRunsForDemoFallback(caseId)
      .then((items) => {
        if (cancelled) return;
        const completed = items.filter((item) => !item.parent_review_run_id);
        setRuns(completed);
        setRunId(completed[0]?.review_run_id ?? "");
        setRunsError(completed.length ? null : "이 Case에는 등록할 수 있는 완료된 심사 실행이 없습니다.");
      })
      .catch(() => {
        if (cancelled) return;
        setRuns([]);
        setRunId("");
        setRunsError("심사 실행 목록을 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, store]);

  if (!isApprover) {
    return (
      <section className="surface" data-admin-fallback>
        <SectionHeading title="시연 폴백" description="LLM 제공자 장애에 대비해 미리 등록한 심사 결과를 재사용하는 설정입니다." />
        <RoleBoundaryNote>시연 폴백 설정은 승인자 역할에서만 볼 수 있습니다.</RoleBoundaryNote>
      </section>
    );
  }
  if (state.demoFallbackError !== null && view === null) {
    return (
      <section className="surface" data-admin-fallback>
        <SectionHeading title="시연 폴백" description="LLM 제공자 장애에 대비해 미리 등록한 심사 결과를 재사용하는 설정입니다." />
        <p className="unsupported-inline">{state.demoFallbackError}</p>
        <button className="btn" type="button" onClick={() => void store.refreshDemoFallback()}>다시 시도</button>
      </section>
    );
  }
  if (view === null) {
    return (
      <section className="surface" data-admin-fallback>
        <SectionHeading title="시연 폴백" description="LLM 제공자 장애에 대비해 미리 등록한 심사 결과를 재사용하는 설정입니다." />
        <EmptyCopy>시연 폴백 설정을 불러오는 중…</EmptyCopy>
      </section>
    );
  }

  const busy = state.demoFallbackSaving;
  const onSaveDelay = () => {
    const value = Number(delay);
    if (delay.trim() === "" || !Number.isFinite(value) || value < 0 || value > 60) {
      setFormError("재생 대기 시간은 0초 이상 60초 이하로 입력해 주십시오.");
      return;
    }
    setFormError(null);
    void store.saveDemoFallbackSettings({ delay_seconds: value });
  };
  const onRegister = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("세트 이름을 입력해 주십시오.");
      return;
    }
    if (!runId) {
      setFormError("등록할 심사 실행을 선택해 주십시오.");
      return;
    }
    setFormError(null);
    void store.registerDemoFallbackSet({ name, review_run_id: runId }).then(() => setName(""));
  };

  return (
    <section className="surface" data-admin-fallback>
      <div className="dash-head">
        <SectionHeading
          title="시연 폴백"
          description="LLM 제공자가 응답하지 않아도 시연이 멈추지 않도록, 완료된 심사 실행을 Case별로 여러 개 등록해 두고 같은 서류로 심사할 때 그 결과를 재사용합니다. AI HSK 추출 결과도 함께 재사용됩니다."
        />
        <button className="btn" type="button" disabled={state.demoFallbackLoading} onClick={() => void store.refreshDemoFallback()}>
          {state.demoFallbackLoading ? "불러오는 중…" : "새로 고침"}
        </button>
      </div>
      {state.demoFallbackError !== null ? <p className="unsupported-inline">{state.demoFallbackError}</p> : null}
      <fieldset className="admin-fallback__modes" data-admin-fallback-mode>
        <legend>모드</legend>
        {(Object.keys(MODE_LABELS) as DemoFallbackMode[]).map((mode) => (
          <label key={mode} className={`admin-fallback__mode${view.settings.mode === mode ? " on" : ""}`}>
            <input
              type="radio"
              name="demo-fallback-mode"
              value={mode}
              checked={view.settings.mode === mode}
              disabled={busy}
              onChange={() => void store.saveDemoFallbackSettings({ mode })}
            />
            <b>{MODE_LABELS[mode].label}</b>
            <span>{MODE_LABELS[mode].help}</span>
          </label>
        ))}
      </fieldset>
      <div className="admin-form admin-fallback__delay">
        <Field label="재생 대기 시간 (초, 0–60)">
          <input type="number" inputMode="decimal" min={0} max={60} step={1} value={delay} disabled={busy} onChange={(event) => setDelay(event.target.value)} />
        </Field>
        <div className="admin-form__actions">
          <button className="btn" type="button" disabled={busy} onClick={onSaveDelay} data-admin-fallback-delay>
            대기 시간 저장
          </button>
        </div>
      </div>
      <p className="form-hint">
        {`현재 모드 ${MODE_LABELS[view.settings.mode].label} · 마지막 변경 ${view.settings.updated_at === null ? "—" : `${formatDate(view.settings.updated_at)} (${view.settings.updated_by ?? ""})`}`}
      </p>

      <SectionHeading title="등록된 세트" description="같은 서류(확정 문서 집합)로 새 Case를 만들어 심사하면 이 결과가 재사용됩니다. 여러 Case를 등록할 수 있습니다." />
      {view.sets.length === 0 ? (
        <EmptyCopy>등록된 세트가 없습니다. 아래에서 완료된 심사 실행을 골라 등록하십시오.</EmptyCopy>
      ) : (
        <table className="admin-fallback__table" data-admin-fallback-sets>
          <thead>
            <tr>
              <th>이름</th>
              <th>원본 Case</th>
              <th>서류</th>
              <th>확인 사항</th>
              <th>AI HSK</th>
              <th>사용</th>
              <th>등록</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {view.sets.map((set) => (
              <tr key={set.fallback_id} data-admin-fallback-set={set.fallback_id}>
                <td>{set.name}</td>
                <td>
                  {set.source_case_title || set.source_case_id}
                  <small className="mono">{set.source_review_run_id}</small>
                </td>
                <td>
                  {set.documents.length}건
                  <small>{set.documents.map((document) => `${document.document_type} ${document.filename}`).join(", ")}</small>
                </td>
                <td className="mono">{set.finding_count}</td>
                <td>{set.has_hs_ranking ? "있음" : "없음"}</td>
                <td className="mono">
                  {set.used_count}회{set.last_used_at === null ? "" : ` · ${formatDate(set.last_used_at)}`}
                </td>
                <td>{formatDate(set.created_at)}</td>
                <td>
                  <button
                    className="btn"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`세트 「${set.name}」를 삭제합니다. 계속하시겠습니까?`)) void store.deleteDemoFallbackSet(set.fallback_id);
                    }}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form className="admin-form admin-fallback__register" onSubmit={onRegister} data-admin-fallback-register>
        <Field label="세트 이름">
          <input type="text" value={name} maxLength={120} disabled={busy} placeholder="예: 시연 1 · 티셔츠 수입" onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Case">
          <select value={caseId} disabled={busy} onChange={(event) => setCaseId(event.target.value)}>
            <option value="">Case 선택</option>
            {state.cases.map((item) => (
              <option key={item.case_id} value={item.case_id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="심사 실행">
          <select value={runId} disabled={busy || runs.length === 0} onChange={(event) => setRunId(event.target.value)}>
            {runs.length === 0 ? <option value="">Case를 먼저 선택</option> : null}
            {runs.map((run) => (
              <option key={run.review_run_id} value={run.review_run_id}>
                {`${formatDate(run.created_at)} · 확인 사항 ${run.finding_count}건 · ${run.review_run_id}`}
              </option>
            ))}
          </select>
        </Field>
        {runsError !== null ? <p className="unsupported-inline admin-form__error">{runsError}</p> : null}
        {formError !== null ? <p className="unsupported-inline admin-form__error">{formError}</p> : null}
        <div className="admin-form__actions">
          <Submit label={busy ? "저장 중…" : "세트 등록"} disabled={busy} />
        </div>
      </form>
    </section>
  );
}

function CurrentSettingsCard({ view }: { view: LlmSettingsView }) {
  const store = useStore();
  const state = useWorkbenchState();
  return (
    <section className="surface" data-admin-current>
      <div className="dash-head">
        <SectionHeading
          title="현재 설정"
          description="Agent 서비스가 지금 사용하는 값입니다. 변경은 재시작 없이 다음 AI 심사부터 적용됩니다."
        />
        <button className="btn" type="button" disabled={state.llmSettingsLoading} onClick={() => void store.refreshLlmSettings()}>
          {state.llmSettingsLoading ? "불러오는 중…" : "새로 고침"}
        </button>
      </div>
      {state.llmSettingsError !== null ? <p className="unsupported-inline">{state.llmSettingsError}</p> : null}
      {!view.adjustable ? (
        <p className="unsupported-inline">
          현재 서비스 모드({view.service_mode})에서는 결정론 분석기를 사용하므로 이 설정을 변경할 수 없습니다.
        </p>
      ) : null}
      {view.error_code !== null ? (
        <p className="unsupported-inline">서버의 LLM 환경 설정에 문제가 있습니다 (code={view.error_code}). 표시된 값은 기본값입니다.</p>
      ) : null}
      <dl className="admin-kv">
        <dt>제공자</dt>
        <dd>{providerLabel(view.provider)}</dd>
        <dt>모델</dt>
        <dd className="mono">{view.model}</dd>
        <dt>최대 출력 토큰</dt>
        <dd className="mono">{view.max_tokens.toLocaleString("en-US")}</dd>
        <dt>응답 제한 시간</dt>
        <dd className="mono">{view.timeout_seconds.toLocaleString("en-US")}초</dd>
        <dt>설정 출처</dt>
        <dd>{view.source === "override" ? "운영자 변경" : "서버 환경값"}</dd>
        <dt>마지막 변경</dt>
        <dd>{view.updated_at === null ? "—" : formatDate(view.updated_at)}</dd>
        <dt>설정 버전</dt>
        <dd className="mono">{view.version}</dd>
        <dt>서비스 모드</dt>
        <dd className="mono">{view.service_mode}</dd>
      </dl>
      <p className="admin-providers">
        {view.providers.map((entry) => (
          <span key={entry.provider} className={`admin-provider${entry.credential_present ? "" : " admin-provider--missing"}`}>
            {providerLabel(entry.provider)} · {entry.credential_present ? "API 키 있음" : "API 키 없음"}
          </span>
        ))}
      </p>
    </section>
  );
}

function SettingsForm({ view }: { view: LlmSettingsView }) {
  const store = useStore();
  const state = useWorkbenchState();
  const [form, setForm] = useState<FormValues>(() => formFrom(view));
  const [formError, setFormError] = useState<string | null>(null);

  // A save or reset replaces the view; refill the form so it shows what is active.
  useEffect(() => {
    setForm(formFrom(view));
    setFormError(null);
  }, [view]);

  const busy = state.llmSettingsSaving || state.llmTestRunning;
  const disabled = busy || !view.adjustable;
  const providerChanged = form.provider !== view.provider;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { update, error } = buildUpdate(form, view);
    if (error !== null) {
      setFormError(error);
      return;
    }
    if (Object.keys(update).length === 0) {
      setFormError("변경된 값이 없습니다.");
      return;
    }
    setFormError(null);
    void store.saveLlmSettings(update);
  };

  const onTest = () => {
    const { update, error } = buildUpdate(form, view);
    if (error !== null) {
      setFormError(error);
      return;
    }
    setFormError(null);
    void store.testLlmSettings(Object.keys(update).length === 0 ? null : update);
  };

  const onReset = () => {
    if (!window.confirm("운영자 변경을 모두 지우고 서버 환경 기본값으로 되돌립니다. 계속하시겠습니까?")) return;
    void store.resetLlmSettings();
  };

  return (
    <section className="surface" data-admin-form>
      <SectionHeading
        title="설정 변경"
        description="제공자를 바꾸고 모델을 비워 두면 그 제공자의 기본 모델이 적용됩니다. 저장 전 연결 테스트로 확인할 수 있습니다."
      />
      <form className="admin-form" onSubmit={onSubmit}>
        <Field label="제공자">
          <select
            value={form.provider}
            disabled={disabled}
            onChange={(event) => {
              const provider = event.target.value as LlmProvider;
              // Switching provider clears a model that belongs to the previous one.
              setForm((current) => ({ ...current, provider, model: provider === view.provider ? view.model : "" }));
            }}
          >
            {view.providers.map((entry) => (
              <option key={entry.provider} value={entry.provider} disabled={!entry.credential_present}>
                {providerLabel(entry.provider)}{entry.credential_present ? "" : " (키 없음)"}
              </option>
            ))}
          </select>
        </Field>
        <Field label={providerChanged ? "모델 (비우면 기본 모델)" : "모델"}>
          <input
            type="text"
            list="admin-model-suggestions"
            value={form.model}
            disabled={disabled}
            placeholder={providerChanged ? view.providers.find((entry) => entry.provider === form.provider)?.default_model ?? "" : ""}
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
          />
          <datalist id="admin-model-suggestions">
            {MODEL_SUGGESTIONS.filter((entry) => entry.provider === form.provider).map((entry) => (
              <option key={entry.model} value={entry.model} />
            ))}
          </datalist>
        </Field>
        <Field label="최대 출력 토큰 (256–16384)">
          <input
            type="number"
            inputMode="numeric"
            min={256}
            max={16_384}
            step={1}
            value={form.maxTokens}
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, maxTokens: event.target.value }))}
          />
        </Field>
        <Field label="응답 제한 시간 (초, 1–300)">
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={300}
            step={1}
            value={form.timeoutSeconds}
            disabled={disabled}
            onChange={(event) => setForm((current) => ({ ...current, timeoutSeconds: event.target.value }))}
          />
        </Field>
        {formError !== null ? <p className="unsupported-inline admin-form__error">{formError}</p> : null}
        <div className="admin-form__actions">
          <Submit label={state.llmSettingsSaving ? "저장 중…" : "저장"} disabled={disabled} />
          <button className="btn" type="button" disabled={disabled} onClick={onTest} data-admin-test>
            {state.llmTestRunning ? "테스트 중…" : "연결 테스트"}
          </button>
          <button className="btn" type="button" disabled={disabled || view.source !== "override"} onClick={onReset} data-admin-reset>
            환경 기본값으로 되돌리기
          </button>
        </div>
      </form>
    </section>
  );
}

function ConnectionTestCard() {
  const state = useWorkbenchState();
  const result = state.llmTestResult;
  return (
    <section className="surface" data-admin-test-result>
      <SectionHeading
        title="연결 테스트 결과"
        description="선택한 제공자·모델로 아주 짧은 요청을 한 번 보내고 응답 여부만 확인합니다. 응답 내용은 저장하지 않습니다."
      />
      {state.llmTestRunning ? <EmptyCopy>연결을 확인하는 중…</EmptyCopy> : null}
      {!state.llmTestRunning && result === null ? <EmptyCopy>아직 실행한 테스트가 없습니다.</EmptyCopy> : null}
      {!state.llmTestRunning && result !== null ? (
        <dl className="admin-kv">
          <dt>결과</dt>
          <dd className={result.ok ? "admin-test--ok" : "admin-test--fail"}>{result.ok ? "성공" : "실패"}</dd>
          <dt>제공자</dt>
          <dd>{result.provider === null ? "—" : providerLabel(result.provider)}</dd>
          <dt>모델</dt>
          <dd className="mono">{result.model ?? "—"}</dd>
          <dt>응답 시간</dt>
          <dd className="mono">{result.latency_ms === null ? "—" : `${result.latency_ms.toLocaleString("en-US")} ms`}</dd>
          {result.error_code !== null ? (
            <>
              <dt>오류</dt>
              <dd>{testErrorMessage(result.error_code)} <span className="mono">({result.error_code})</span></dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}

function testErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    provider_request_failed: "제공자 요청이 실패했습니다. 모델 이름·API 키·네트워크를 확인해 주십시오.",
    provider_sdk_unavailable: "서버에 해당 제공자 SDK가 설치되어 있지 않습니다.",
    provider_response_invalid: "제공자가 올바른 응답을 돌려주지 않았습니다.",
    llm_configuration_invalid: "서버의 LLM 환경 설정이 올바르지 않습니다.",
    llm_credential_missing: "해당 제공자의 API 키가 서버에 없습니다.",
    llm_settings_invalid: "설정 값이 올바르지 않습니다.",
  };
  return messages[code] ?? "연결을 확인하지 못했습니다.";
}
