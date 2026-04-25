import { z } from "zod";
import { Money, DateOnly } from "./money.js";

/**
 * BudgetWithProgress — a Budget row enriched with this-cycle math.
 * The cycle is the period the user is currently spending against; for
 * paycheck-based budgets it spans paycheck-to-paycheck.
 */
export const BudgetWithProgress = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  category: z.string(),
  amount: Money, // cycle limit
  cycleType: z.enum(["paycheck", "monthly", "biweekly"]),
  cycleStart: DateOnly,
  cycleEnd: DateOnly,
  spentThisCycle: Money,
  remainingThisCycle: Money,
  pctUsed: z.number().min(0), // can exceed 100 when over-budget
  status: z.enum(["good", "warn", "over"]),
  // Recent transactions counted against this budget (for the BudgetCard
  // "recent charges" footer in the mockup)
  recentTransactions: z.array(
    z.object({
      id: z.number().int().positive(),
      date: DateOnly,
      merchantName: z.string().nullable(),
      amount: Money,
    }),
  ),
});

export const BudgetsResponse = z.object({
  budgets: z.array(BudgetWithProgress),
  cycle: z.object({
    type: z.enum(["paycheck", "monthly", "biweekly"]),
    start: DateOnly,
    end: DateOnly,
    daysIn: z.number().int().nonnegative(),
    daysTotal: z.number().int().positive(),
    pctElapsed: z.number().min(0).max(100),
  }),
  totals: z.object({
    allocated: Money,
    spent: Money,
    remaining: Money,
    pctUsed: z.number().min(0),
  }),
});

export type BudgetWithProgress = z.infer<typeof BudgetWithProgress>;
export type BudgetsResponse = z.infer<typeof BudgetsResponse>;
