import type { ReactNode } from "react";
import { Fragment, useState } from "react";
import { evidenceSourceHref, evidenceSourceLabel, requirementRows, requirementSentence, safeExternalHref } from "./labels";
import type { RequirementSummary } from "./labels";
import { useCountUp } from "./motion";

/** Counts a number up on change. Formatting stays with the caller. */
export function Num({
  value,
  format = (n: number) => n.toLocaleString("en-US"),
  duration,
  decimals,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  decimals?: number;
}) {
  const current = useCountUp(value, {
    ...(duration === undefined ? {} : { duration }),
    ...(decimals === undefined ? {} : { decimals }),
  });
  return <>{format(current)}</>;
}

export function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="section-heading">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

/** A card that starts collapsed, for reference material that would otherwise bury the task. */
export function CollapsibleSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <details className="surface collapsible">
      <summary className="collapsible__summary">
        <span className="collapsible__title">{title}</span>
        <span className="collapsible__hint">{description}</span>
      </summary>
      <div className="collapsible__body">{children}</div>
    </details>
  );
}

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className="mono">
        <Num value={value} />
      </strong>
    </div>
  );
}

export function TraceCount({ value, label }: { value: number; label: string }) {
  return (
    <div className="trace-count">
      <strong className="mono">
        <Num value={value} duration={700} />
      </strong>
      <span>{label}</span>
    </div>
  );
}

export function DashStat({
  label,
  value,
  hint,
  tone,
  onClick,
  active,
  filterId,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: string;
  /** When given, the card is a filter button rather than a passive number. */
  onClick?: () => void;
  active?: boolean;
  filterId?: string;
}) {
  const className = `dash-stat${tone ? ` dash-stat--${tone}` : ""}${onClick ? " dash-stat--filter" : ""}${active ? " is-active" : ""}`;
  const body = (
    <>
      <span className="dash-stat__label">{label}</span>
      <strong className="dash-stat__value mono">
        <Num value={value} />
      </strong>
      <span className="dash-stat__hint">{hint}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        aria-pressed={active ?? false}
        {...(filterId ? { "data-case-filter": filterId } : {})}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

export function EmptyState({ title, copy, children }: { title: string; copy: string; children?: ReactNode }) {
  return (
    <section className="surface empty-state">
      <h2>{title}</h2>
      <p>{copy}</p>
      {children}
    </section>
  );
}

export function EmptyCopy({ children }: { children: ReactNode }) {
  return <p className="empty-copy">{children}</p>;
}

export function Message({ kind, text }: { kind: "error" | "notice"; text: string }) {
  return (
    <section className={`notice notice--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <p>{text}</p>
    </section>
  );
}

export function AssistantLoading({ label }: { label: string }) {
  return (
    <div className="assistant-loading" role="status">
      <span className="assistant-loading__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

export function Submit({ label, disabled, primary = false }: { label: string; disabled: boolean; primary?: boolean }) {
  return (
    <button className={primary ? "button button--primary" : "button button--secondary"} type="submit" disabled={disabled}>
      {label}
    </button>
  );
}

/** Says why a disabled control is disabled, right next to it. */
export function DisabledReason({ children }: { children: ReactNode }) {
  return (
    <p className="disabled-reason" role="note">
      {children}
    </p>
  );
}

export function RoleBoundaryNote({ children }: { children: ReactNode }) {
  return <p className="role-boundary-note">{children}</p>;
}

export function ReportSectionCard({
  index,
  title,
  description,
  sectionName,
  children,
}: {
  index: string;
  title: string;
  description: string;
  sectionName?: string;
  children: ReactNode;
}) {
  return (
    <section className="surface report-section" data-report-section={sectionName ?? index}>
      <header className="report-section__heading">
        <span className="report-section__index">{index}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

/** Copies a reference code (e.g. HS code) for portals that cannot deep-link to it. */
export function CopyValueButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="text-link copy-value"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
    >
      {copied ? "복사됨 ✓" : label}
    </button>
  );
}

/** Only http(s) sources become links; anything else says so instead of rendering a dead link. */
export function ExternalSourceLink({ uri, label = "출처 열기" }: { uri: string; label?: string }) {
  const href = safeExternalHref(uri);
  if (!href) return <span className="muted">출처 URL을 표시할 수 없습니다.</span>;
  return (
    <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

/**
 * "출처 열기" for a review evidence item. Requirement rows point at 법제처 rather
 * than the public-data API they were ingested from (see evidenceSourceHref).
 */
export function EvidenceSourceLink({ item }: { item: { source_uri: string; source_type?: string | null; law_name?: string | null } }) {
  const href = evidenceSourceHref(item);
  if (!href) return <span className="muted">출처 URL을 표시할 수 없습니다.</span>;
  return (
    <a className="text-link" href={href} target="_blank" rel="noopener noreferrer" data-evidence-source>
      {evidenceSourceLabel(item)}
    </a>
  );
}

/**
 * A customs requirement the way a reviewer reads it: one actionable sentence,
 * the four fields, and the Data platform's original wording folded away.
 */
export function RequirementSummaryView({ summary, rawText }: { summary: RequirementSummary; rawText: string }) {
  return (
    <div className="evidence-requirement" data-evidence-requirement>
      <p>{requirementSentence(summary)}</p>
      <dl className="evidence-requirement__fields">
        {requirementRows(summary).map((row) => (
          <Fragment key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </Fragment>
        ))}
      </dl>
      <details className="evidence-requirement__raw">
        <summary>원문 표기 보기</summary>
        <p>{rawText}</p>
      </details>
    </div>
  );
}
