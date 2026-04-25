import { z } from "zod";
import { Money, DateOnly } from "./money.js";

export const IncomeSource = z.object({
  id: z.number().int().positive(),
  userId: z.number().int().positive(),
  userName: z.string(), // joined for display
  name: z.string(),
  type: z.enum(["salary", "self_employed", "bonus", "other"]),
  amount: Money,
  amountVariable: z.boolean(),
  frequency: z.enum(["biweekly", "monthly", "annual", "variable"]),
  payDayOfWeek: z.number().int().min(0).max(6).nullable(),
  nextPayDate: DateOnly.nullable(),
  isPrimary: z.boolean(),
  // Computed: the next 4 projected paydates from this source
  upcomingPaydates: z.array(DateOnly),
});

export const UpcomingDeposit = z.object({
  date: DateOnly,
  sourceId: z.number().int().positive(),
  sourceName: z.string(),
  userName: z.string(),
  amount: Money,
  amountVariable: z.boolean(),
});

export const MonthlyProjection = z.object({
  month: DateOnly, // first of month
  label: z.string(), // "May 2026"
  jaret: Money,
  sarah: Money,
  total: Money,
});

export const IncomeResponse = z.object({
  sources: z.array(IncomeSource),
  upcoming30d: z.array(UpcomingDeposit),
  projection6mo: z.array(MonthlyProjection),
  totals: z.object({
    biweeklyCombined: Money, // sum of biweekly sources, normalized
    monthlyCombined: Money, // all sources normalized to monthly
    ytdCombined: Money,
    perPerson: z.array(
      z.object({
        userId: z.number().int().positive(),
        userName: z.string(),
        monthlyTotal: Money,
      }),
    ),
  }),
});

export type IncomeSource = z.infer<typeof IncomeSource>;
export type UpcomingDeposit = z.infer<typeof UpcomingDeposit>;
export type MonthlyProjection = z.infer<typeof MonthlyProjection>;
export type IncomeResponse = z.infer<typeof IncomeResponse>;
