import { z } from "zod";
import { Money, DateOnly } from "./money.js";

/** A single dated event projected forward (paycheck, bill, debt min, adhoc). */
export const CashFlowEvent = z.object({
  date: DateOnly,
  kind: z.enum(["income", "bill", "debt", "adhoc"]),
  label: z.string(),
  amount: Money, // positive = inflow, negative = outflow (mockup convention,
  // INVERTED from Plaid Transaction.amount because cashflow visualization
  // wants to read green=positive)
  sourceId: z.number().int().positive().nullable(),
});

/** One day on the projection chart. */
export const CashFlowDay = z.object({
  date: DateOnly,
  inflow: Money,
  outflow: Money,
  endingBalance: Money,
});

export const CashFlowQuery = z.object({
  days: z.coerce.number().int().min(7).max(365).default(90),
});

export const CashFlowResponse = z.object({
  windowDays: z.number().int().positive(),
  startDate: DateOnly,
  endDate: DateOnly,
  startingBalance: Money,
  totals: z.object({
    inflow: Money,
    outflow: Money,
    net: Money,
    endingBalance: Money,
    minBalance: Money,
    minBalanceDate: DateOnly,
  }),
  daily: z.array(CashFlowDay),
  events: z.array(CashFlowEvent),
});

export type CashFlowEvent = z.infer<typeof CashFlowEvent>;
export type CashFlowDay = z.infer<typeof CashFlowDay>;
export type CashFlowResponse = z.infer<typeof CashFlowResponse>;
