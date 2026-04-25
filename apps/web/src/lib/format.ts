/**
 * Shared formatters used across pages. Centralized so currency/date
 * formatting stays consistent (and so the locale flip is one place
 * if we ever need anything other than en-CA / CAD).
 */

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const CAD_NO_CENTS = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number | string, options?: { compact?: boolean }): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  return options?.compact ? CAD_NO_CENTS.format(n) : CAD.format(n);
}

/** Signed delta: "+$120.00" / "−$45.10". Used for income/spend deltas. */
export function formatSignedCurrency(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "—";
  const formatted = CAD.format(Math.abs(n));
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `−${formatted}`;
  return formatted;
}

const SHORT_DATE = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" });
const FULL_DATE = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(date: Date | string, variant: "short" | "full" = "short"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return variant === "full" ? FULL_DATE.format(d) : SHORT_DATE.format(d);
}

/** "in 3 days" / "tomorrow" / "yesterday" / "in 2 weeks". */
export function formatRelativeDate(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";

  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((d.getTime() - now.getTime()) / dayMs);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays > 1 && diffDays < 14) return `in ${diffDays} days`;
  if (diffDays < -1 && diffDays > -14) return `${Math.abs(diffDays)} days ago`;
  if (diffDays >= 14 && diffDays < 60) return `in ${Math.round(diffDays / 7)} weeks`;
  if (diffDays <= -14 && diffDays > -60) return `${Math.round(Math.abs(diffDays) / 7)} weeks ago`;
  return formatDate(d, "short");
}
