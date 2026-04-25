import type { IncomeSource, RecurringBill } from "@ledger/db";
import { addDays, addMonths, biweeklyFrom, daysBetween, nextDayOfMonth, toIso } from "./dates.js";

/**
 * A spending cycle. Budgets attach to one of these. We currently support
 * paycheck cycles only — monthly/biweekly fall through the same shape.
 */
export type Cycle = {
  start: Date; // inclusive
  end: Date; // exclusive
  type: "paycheck" | "monthly" | "biweekly";
  daysIn: number;
  daysTotal: number;
  pctElapsed: number; // 0-100
};

/**
 * Compute the current paycheck cycle for the household. Defined as the
 * period between the most-recent primary paycheck (inclusive) and the
 * next primary paycheck (exclusive). If there's no primary income source,
 * fall back to a monthly cycle starting on the first.
 */
export function currentPaycheckCycle(
  primaryIncome: IncomeSource | null,
  today: Date,
): Cycle {
  if (!primaryIncome || !primaryIncome.nextPayDate) {
    return monthlyCycle(today);
  }

  // The schema's `nextPayDate` is the *upcoming* paydate. The cycle started
  // 14 days before it (for biweekly schedules — the Jaret + Sarah case).
  const next = primaryIncome.nextPayDate;
  const cycleLength = primaryIncome.frequency === "biweekly" ? 14 : 30;
  const start = addDays(next, -cycleLength);
  const end = next;

  const daysTotal = daysBetween(start, end);
  const daysIn = Math.max(0, Math.min(daysTotal, daysBetween(start, today)));
  const pctElapsed = daysTotal > 0 ? (daysIn / daysTotal) * 100 : 0;

  return {
    start,
    end,
    type: "paycheck",
    daysIn,
    daysTotal,
    pctElapsed,
  };
}

function monthlyCycle(today: Date): Cycle {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = addMonths(start, 1);
  const daysTotal = daysBetween(start, end);
  const daysIn = daysBetween(start, today);
  return {
    start,
    end,
    type: "monthly",
    daysIn,
    daysTotal,
    pctElapsed: (daysIn / daysTotal) * 100,
  };
}

/**
 * Normalize any amount to its per-month equivalent given a frequency string.
 * Accepts either a Prisma row (amount: Decimal) or a DTO (amount: number).
 */
function toMonthly(amount: number | { toString(): string }, frequency: string): number {
  const n = typeof amount === "number" ? amount : Number(amount);
  switch (frequency) {
    case "monthly":
      return n;
    case "biweekly":
      return n * (26 / 12); // 26 biweekly periods / year ÷ 12 months
    case "quarterly":
      return n / 3;
    case "annual":
      return n / 12;
    case "variable":
      return n;
    default:
      return n;
  }
}

export function billMonthlyAmount(bill: {
  amount: number | { toString(): string };
  frequency: string;
}): number {
  return toMonthly(bill.amount, bill.frequency);
}

export function incomeMonthlyAmount(source: {
  amount: number | { toString(): string };
  frequency: string;
}): number {
  return toMonthly(source.amount, source.frequency);
}

/** Project the next N paydates for a single income source. */
export function projectPaydates(
  source: Pick<IncomeSource, "frequency" | "nextPayDate" | "payDayOfWeek">,
  after: Date,
  count: number,
): Date[] {
  if (!source.nextPayDate) return [];
  switch (source.frequency) {
    case "biweekly":
      return biweeklyFrom(source.nextPayDate, after, count);
    case "monthly": {
      const out: Date[] = [];
      let cursor = source.nextPayDate;
      while (cursor <= after) cursor = addMonths(cursor, 1);
      for (let i = 0; i < count; i++) {
        out.push(cursor);
        cursor = addMonths(cursor, 1);
      }
      return out;
    }
    case "annual":
      return source.nextPayDate > after ? [source.nextPayDate] : [];
    default:
      return [];
  }
}

/** Project the next N due dates for a recurring bill. */
export function projectBillDueDates(
  bill: Pick<RecurringBill, "frequency" | "nextDueDate" | "dueDayOfMonth">,
  after: Date,
  count: number,
): Date[] {
  const out: Date[] = [];
  let cursor = bill.nextDueDate;
  // Skip past anything already in the past.
  if (cursor <= after && bill.dueDayOfMonth) {
    cursor = nextDayOfMonth(after, bill.dueDayOfMonth);
  }
  for (let i = 0; i < count; i++) {
    out.push(new Date(cursor));
    switch (bill.frequency) {
      case "biweekly":
        cursor = addDays(cursor, 14);
        break;
      case "quarterly":
        cursor = addMonths(cursor, 3);
        break;
      case "annual":
        cursor = addMonths(cursor, 12);
        break;
      case "monthly":
      default:
        cursor = addMonths(cursor, 1);
        break;
    }
  }
  return out;
}

/** Re-export so route files don't need to import dates.ts directly. */
export { toIso };
