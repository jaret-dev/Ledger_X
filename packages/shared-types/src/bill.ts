import { z } from "zod";
import { Money, DateOnly } from "./money.js";

export const RecurringBill = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  category: z.string(),
  amount: Money,
  amountVariable: z.boolean(),
  frequency: z.enum(["monthly", "biweekly", "quarterly", "annual"]),
  dueDayOfMonth: z.number().int().min(1).max(31).nullable(),
  nextDueDate: DateOnly,
  autopay: z.boolean(),
  paymentAccountId: z.number().int().positive().nullable(),
  paymentMethod: z.string().nullable(),
});

export const BillCategoryGroup = z.object({
  category: z.string(),
  label: z.string(), // capitalized label for headers
  bills: z.array(RecurringBill),
  monthlyTotal: Money, // normalized to per-month for grouping math
});

export const BillsResponse = z.object({
  groups: z.array(BillCategoryGroup),
  totals: z.object({
    monthlyTotal: Money,
    autopayCount: z.number().int().nonnegative(),
    manualCount: z.number().int().nonnegative(),
    dueThisWeek: z.number().int().nonnegative(),
    nextDueDate: DateOnly.nullable(),
  }),
});

export type RecurringBill = z.infer<typeof RecurringBill>;
export type BillCategoryGroup = z.infer<typeof BillCategoryGroup>;
export type BillsResponse = z.infer<typeof BillsResponse>;
