import { z } from "zod";
import { Money, DateOnly } from "./money.js";

export const AdHocExpense = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.enum(["travel", "gifts", "auto", "medical", "home", "other"]),
  amount: Money,
  dueDate: DateOnly,
  paymentAccountId: z.number().int().positive().nullable(),
  status: z.enum(["planned", "funded", "paid", "cancelled"]),
  assignedPaycheckDate: DateOnly.nullable(),
  notes: z.string().nullable(),
  // Computed: how many days until due (negative = overdue)
  daysUntilDue: z.number().int(),
});

export const AdHocResponse = z.object({
  // Time-bucketed for the mockup's "this cycle / next 30d / beyond 60d" sections
  buckets: z.object({
    thisCycle: z.array(AdHocExpense),
    next30d: z.array(AdHocExpense),
    beyond60d: z.array(AdHocExpense),
  }),
  // Flat list for the timeline strip (sorted by dueDate ascending)
  timeline: z.array(AdHocExpense),
  totals: z.object({
    plannedTotal: Money,
    fundedTotal: Money,
    thisCycleTotal: Money,
    next30dTotal: Money,
  }),
  // Category breakdown for the side panel
  byCategory: z.array(
    z.object({
      category: z.string(),
      label: z.string(),
      total: Money,
      count: z.number().int().nonnegative(),
    }),
  ),
});

export type AdHocExpense = z.infer<typeof AdHocExpense>;
export type AdHocResponse = z.infer<typeof AdHocResponse>;
