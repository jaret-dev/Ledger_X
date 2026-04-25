import type { ReactNode } from "react";
import { formatCurrency } from "../lib/format";

/**
 * Atomic primitives reused across pages. Grouped in one file because
 * each is small (10-30 lines) and they have no dependencies between
 * them — splitting per file would be more imports than code.
 */

// ─── StatCard ────────────────────────────────────────────────────────
// Big number + uppercase label. The mockup's `.stat` block.

type StatCardProps = {
  label: string;
  value: string;
  delta?: { text: string; tone: "positive" | "negative" | "neutral" };
  tone?: "default" | "debt" | "warn" | "success";
};

export function StatCard({ label, value, delta, tone = "default" }: StatCardProps) {
  const valueClass =
    tone === "debt"
      ? "text-accent-2"
      : tone === "warn"
        ? "text-danger"
        : tone === "success"
          ? "text-success"
          : "text-ink";
  const deltaClass = delta
    ? delta.tone === "positive"
      ? "text-success"
      : delta.tone === "negative"
        ? "text-danger"
        : "text-ink-3"
    : "";
  return (
    <div className="flex flex-col gap-1 px-5 py-5">
      <div className="label">{label}</div>
      <div className={`font-serif text-stat font-light ${valueClass}`}>{value}</div>
      {delta && <div className={`font-mono text-[11px] ${deltaClass}`}>{delta.text}</div>}
    </div>
  );
}

// ─── StatGrid ────────────────────────────────────────────────────────
// 4-column grid of StatCards. Mockup uses 1px-gap with a colored
// background showing through to draw the grid lines.

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mb-7 grid grid-cols-4 gap-px bg-line border border-line mobile:grid-cols-2">
      {/* Each child sits on a `bg-card` so the bg-line shows as a 1px hairline */}
      {childrenWithBg(children)}
    </div>
  );
}

function childrenWithBg(children: ReactNode): ReactNode {
  // We can't restyle <StatCard /> from outside without a wrapper, so wrap
  // each child in a div that paints the card background.
  if (!Array.isArray(children)) return <div className="bg-card">{children}</div>;
  return children.map((c, i) => (
    <div key={i} className="bg-card">
      {c}
    </div>
  ));
}

// ─── Panel ───────────────────────────────────────────────────────────
// Card with a header bar. Mockup `.panel` + `.panel-head`.

type PanelProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, subtitle, action, children, className = "" }: PanelProps) {
  return (
    <section className={`border border-line bg-card ${className}`}>
      <div className="flex items-center justify-between border-b border-line bg-bg-2 px-5 py-3.5">
        <h3>
          {title}
          {subtitle && <em className="ml-2">{subtitle}</em>}
        </h3>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

// ─── BarTag ──────────────────────────────────────────────────────────
// 3px vertical color bar used as a leading icon on rows.

type BarKind = "income" | "debt" | "bill" | "budget" | "adhoc";

const BAR_COLOR: Record<BarKind, string> = {
  income: "bg-success",
  debt: "bg-accent-2",
  bill: "bg-accent-3",
  budget: "bg-accent-4",
  adhoc: "bg-accent",
};

export function BarTag({ kind }: { kind: BarKind }) {
  return <span className={`block h-5 w-[3px] rounded-sm ${BAR_COLOR[kind]}`} />;
}

// ─── ProgressBar ─────────────────────────────────────────────────────
// Horizontal track with a fill width and an optional pace marker.

type ProgressBarProps = {
  pct: number; // 0-100+ (over-budget allowed; clamps fill at 100% but stripes red over)
  marker?: number; // 0-100 — vertical line showing where you "should be"
  status?: "good" | "warn" | "over";
};

export function ProgressBar({ pct, marker, status = "good" }: ProgressBarProps) {
  const fillPct = Math.min(100, Math.max(0, pct));
  const fillColor =
    status === "over" ? "bg-danger" : status === "warn" ? "bg-accent-3" : "bg-accent-4";
  return (
    <div className="relative h-2 w-full bg-bg-2">
      <div className={`h-full ${fillColor}`} style={{ width: `${fillPct}%` }} />
      {marker != null && marker >= 0 && marker <= 100 && (
        <div
          className="absolute top-0 h-full w-px bg-ink"
          style={{ left: `${marker}%` }}
          aria-label="pace marker"
        />
      )}
    </div>
  );
}

// ─── StatusPill ──────────────────────────────────────────────────────
// Small uppercase mono badge — auto / manual / paid / upcoming.

type StatusPillProps = { kind: "auto" | "manual" | "paid" | "upcoming" | "over" | "funded" | "planned" };

const PILL_STYLE: Record<StatusPillProps["kind"], string> = {
  auto: "bg-bg-2 text-ink-2 border-line",
  manual: "bg-bg-2 text-accent-3 border-accent-3",
  paid: "bg-bg-2 text-ink-3 border-line line-through",
  upcoming: "bg-bg-2 text-accent border-accent",
  over: "bg-bg-2 text-danger border-danger",
  funded: "bg-bg-2 text-success border-success",
  planned: "bg-bg-2 text-ink-2 border-line",
};

export function StatusPill({ kind }: StatusPillProps) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${PILL_STYLE[kind]}`}
    >
      {kind}
    </span>
  );
}

// ─── PageState ───────────────────────────────────────────────────────
// Wraps a React Query result in consistent loading / error states. Use
// inside every page so we don't repeat the same skeleton everywhere.

type PageStateProps<T> = {
  query: { data: T | undefined; isPending: boolean; isError: boolean; error: unknown };
  children: (data: T) => ReactNode;
};

export function PageState<T>({ query, children }: PageStateProps<T>) {
  if (query.isPending) {
    return (
      <div className="rounded border border-line bg-card p-6 text-[13px] text-ink-3">
        Loading…
      </div>
    );
  }
  if (query.isError || !query.data) {
    const msg = query.error instanceof Error ? query.error.message : "Unknown error";
    return (
      <div className="rounded border border-danger bg-card p-6 text-[13px] text-danger">
        Failed to load: {msg}
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

// ─── MoneyAmount ─────────────────────────────────────────────────────
// Inline currency value rendered with the .amount class so columns of
// numbers align via tabular nums.

export function MoneyAmount({
  value,
  className = "",
  signed = false,
}: {
  value: number;
  className?: string;
  signed?: boolean;
}) {
  const formatted = signed && value !== 0
    ? `${value > 0 ? "+" : "−"}${formatCurrency(Math.abs(value))}`
    : formatCurrency(value);
  return <span className={`amount ${className}`}>{formatted}</span>;
}
