/**
 * Date helpers used by every service that has to project bills, paychecks,
 * or budget cycles. Always work in UTC date-only — Prisma's @db.Date
 * round-trips dates as midnight-UTC and we don't want any of our cycle
 * math to depend on the server's TZ.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD → Date at UTC midnight. */
export function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Date → YYYY-MM-DD using the UTC parts. */
export function toIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Strip the time portion from a Date (UTC). */
export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Whole days between two dates (b - a). Negative if a > b. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  const targetMonth = r.getUTCMonth() + n;
  r.setUTCMonth(targetMonth);
  // If the day overflowed into the next month (e.g. Jan 31 + 1 = Mar 3),
  // clamp back to the last day of the intended month.
  if (r.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
    r.setUTCDate(0);
  }
  return r;
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

/** Project the next occurrence of `dayOfMonth` strictly after `after`. */
export function nextDayOfMonth(after: Date, dayOfMonth: number): Date {
  const candidate = new Date(
    Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), Math.min(dayOfMonth, 28)),
  );
  if (candidate <= after) {
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  }
  // Clamp dayOfMonth to whatever the target month supports.
  const lastOfMonth = endOfMonth(candidate).getUTCDate();
  candidate.setUTCDate(Math.min(dayOfMonth, lastOfMonth));
  return candidate;
}

/**
 * Project the next N occurrences of a biweekly schedule starting from
 * `seedDate` (the most recent known paydate) and never returning anything
 * <= `after`. Useful for paycheck projections.
 */
export function biweeklyFrom(seedDate: Date, after: Date, count: number): Date[] {
  const out: Date[] = [];
  let cursor = new Date(seedDate);
  // Roll forward until we're strictly past `after`.
  while (cursor <= after) {
    cursor = addDays(cursor, 14);
  }
  for (let i = 0; i < count; i++) {
    out.push(new Date(cursor));
    cursor = addDays(cursor, 14);
  }
  return out;
}
