import { z } from "zod";
import { Money, DateOnly } from "./money.js";

/**
 * Per-paycheck summary block on the Overview page. Each block shows the
 * paycheck date + amount, then breaks down what's "charged" against it
 * (assigned bills, debt mins, ad-hoc). Leftover = paycheck − charges.
 */
export const PaycheckBlock = z.object({
  date: DateOnly,
  userName: z.string(), // "Jaret" / "Sarah"
  sourceName: z.string(), // "Mojo Food Group" / "GAP Inc."
  amount: Money,
  charges: z.array(
    z.object({
      kind: z.enum(["bill", "debt", "adhoc", "budget"]),
      label: z.string(),
      sublabel: z.string().nullable(),
      amount: Money,
    }),
  ),
  chargesTotal: Money,
  leftover: Money,
});

/**
 * Lightweight summary of one debt for the Overview's Debts panel. The
 * full debt list lives at /api/debts; this is a trimmed subset.
 */
export const OverviewDebtRow = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  apr: Money,
  minPayment: Money,
  balance: Money,
  isHighApr: z.boolean(), // mockup highlights APR ≥ 20% in --danger
});

/**
 * Lightweight summary of one budget for the Overview's Budgets panel.
 */
export const OverviewBudgetRow = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  category: z.string(),
  allocated: Money,
  spent: Money,
  remaining: Money,
  pctUsed: z.number().min(0),
  status: z.enum(["good", "warn", "over"]),
});

/**
 * Lightweight summary of one ad-hoc event for the Overview's Ad-hoc
 * grid (top 3-4 nearest in time).
 */
export const OverviewAdhocCard = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  category: z.string(),
  amount: Money,
  dueDate: DateOnly,
  daysUntilDue: z.number().int(),
  status: z.string(),
});

export const OverviewResponse = z.object({
  asOf: DateOnly, // today, server clock
  stats: z.object({
    cashOnHand: Money,
    monthlyInflow: Money,
    monthlyOutflow: Money,
    netWorth: Money,
  }),
  paychecks: z.array(PaycheckBlock), // next 4
  debts: z.object({
    rows: z.array(OverviewDebtRow), // top 5 by balance
    totalBalance: Money,
    monthlyMinimums: Money,
  }),
  budgets: z.object({
    rows: z.array(OverviewBudgetRow), // all envelopes for current cycle
    cycleEnd: DateOnly,
  }),
  upcomingAdhoc: z.array(OverviewAdhocCard), // next 3-6 by date
});

export type PaycheckBlock = z.infer<typeof PaycheckBlock>;
export type OverviewResponse = z.infer<typeof OverviewResponse>;
