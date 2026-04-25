import { z } from "zod";
import { Money, DateOnly } from "./money.js";

export const Debt = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  type: z.enum(["credit_card", "line_of_credit", "loan", "student_loan", "mortgage"]),
  balance: Money,
  originalBalance: Money.nullable(),
  creditLimit: Money.nullable(),
  apr: Money,
  minPayment: Money,
  dueDayOfMonth: z.number().int().min(1).max(31).nullable(),
  payoffDate: DateOnly.nullable(),
  // Computed: percentage paid down (only meaningful with originalBalance)
  paidDownPct: z.number().min(0).max(100).nullable(),
  // Computed: utilization percentage for revolving credit (cards / LOC)
  utilizationPct: z.number().min(0).max(150).nullable(),
});

export const DebtsResponse = z.object({
  debts: z.array(Debt),
  totals: z.object({
    balance: Money,
    creditLimit: Money,
    minPaymentMonthly: Money,
    weightedApr: Money,
    revolvingUtilizationPct: z.number(),
  }),
});

/**
 * Payoff scenarios computed server-side per BUILD_PLAN §5. All three
 * scenarios assume the same total monthly outlay (sum of minimums); they
 * differ only in how the *order* of payoff is decided.
 */
export const PayoffScenario = z.object({
  name: z.enum(["minimums", "avalanche", "snowball"]),
  label: z.string(), // user-facing copy
  monthsToPayoff: z.number().int().nonnegative(),
  yearsToPayoff: z.number().nonnegative(),
  totalInterestPaid: Money,
  monthlyOutlay: Money,
  // Per-debt payoff order with month each debt clears
  schedule: z.array(
    z.object({
      debtId: z.number().int().positive(),
      debtName: z.string(),
      monthCleared: z.number().int().nonnegative(),
    }),
  ),
});

export const DebtScenariosResponse = z.object({
  scenarios: z.array(PayoffScenario),
  // Convenience: best scenario by total interest, with savings vs minimums
  recommendation: z.object({
    scenario: PayoffScenario.shape.name,
    interestSavedVsMinimums: Money,
    monthsSavedVsMinimums: z.number().int(),
  }),
});

export type Debt = z.infer<typeof Debt>;
export type DebtsResponse = z.infer<typeof DebtsResponse>;
export type PayoffScenario = z.infer<typeof PayoffScenario>;
export type DebtScenariosResponse = z.infer<typeof DebtScenariosResponse>;
