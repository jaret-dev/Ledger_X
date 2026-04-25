import { z } from "zod";
import { Money, DateOnly, Timestamp } from "./money.js";

export const Transaction = z.object({
  id: z.number().int().positive(),
  accountId: z.number().int().positive(),
  accountNickname: z.string(), // joined for display
  date: DateOnly,
  amount: Money, // positive = outflow, negative = inflow (Plaid convention)
  merchantName: z.string().nullable(),
  merchantRaw: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  categorySource: z.enum(["llm", "user", "rule", "plaid", "llm_uncertain"]),
  categoryConfidence: Money.nullable(),
  budgetId: z.number().int().positive().nullable(),
  billId: z.number().int().positive().nullable(),
  debtId: z.number().int().positive().nullable(),
  adhocId: z.number().int().positive().nullable(),
  incomeSourceId: z.number().int().positive().nullable(),
  isPending: z.boolean(),
  isHidden: z.boolean(),
  notes: z.string().nullable(),
  createdAt: Timestamp,
});

/**
 * Filter shape accepted by GET /api/transactions. All fields optional;
 * apps/api parses query string against this. Pagination via limit/offset.
 */
export const TransactionsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().optional(),
  search: z.string().optional(),
  accountId: z.coerce.number().int().positive().optional(),
  startDate: DateOnly.optional(),
  endDate: DateOnly.optional(),
  includeHidden: z.coerce.boolean().default(false),
});

export const TransactionsResponse = z.object({
  transactions: z.array(Transaction),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  }),
  // Lookup tables for the filter dropdowns on the Transactions page
  facets: z.object({
    accounts: z.array(z.object({ id: z.number(), nickname: z.string() })),
    categories: z.array(z.string()),
  }),
});

export const TransactionsSummaryQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const TransactionsSummaryResponse = z.object({
  windowDays: z.number().int().positive(),
  startDate: DateOnly,
  endDate: DateOnly,
  moneyIn: Money,
  moneyOut: Money,
  net: Money,
  txnCount: z.number().int().nonnegative(),
  dailyAvgOut: Money,
});

export type Transaction = z.infer<typeof Transaction>;
export type TransactionsQuery = z.infer<typeof TransactionsQuery>;
export type TransactionsResponse = z.infer<typeof TransactionsResponse>;
export type TransactionsSummaryResponse = z.infer<typeof TransactionsSummaryResponse>;
