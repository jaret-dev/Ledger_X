import { z } from "zod";
import { Money, DateOnly } from "./money.js";

/**
 * Mutation input schemas. Every POST/PATCH endpoint in apps/api parses
 * its request body against one of these. PATCH inputs are the create
 * input wrapped in `.partial()` so any subset of writable fields is
 * accepted; readonly fields (id, householdId, computed columns,
 * createdAt/updatedAt) are not exposed here.
 */

// ──────────── Account (manual only — Plaid creates real ones) ────────────

export const AccountCreateInput = z.object({
  institution: z.string().min(1).max(100),
  nickname: z.string().min(1).max(100),
  type: z.enum(["depository", "credit", "loan", "investment"]),
  subtype: z.string().max(50).nullable().optional(),
  currentBalance: Money.nullable().optional(),
  creditLimit: Money.nullable().optional(),
  currency: z.string().length(3).default("CAD"),
});

export const AccountUpdateInput = AccountCreateInput.partial();

// ──────────── Debt ────────────

export const DebtCreateInput = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["credit_card", "line_of_credit", "loan", "student_loan", "mortgage"]),
  balance: Money,
  originalBalance: Money.nullable().optional(),
  creditLimit: Money.nullable().optional(),
  apr: Money,
  minPayment: Money,
  dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  payoffDate: DateOnly.nullable().optional(),
  accountId: z.number().int().positive().nullable().optional(),
});

export const DebtUpdateInput = DebtCreateInput.partial();

// ──────────── RecurringBill ────────────

export const RecurringBillCreateInput = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  amount: Money,
  amountVariable: z.boolean().default(false),
  frequency: z.enum(["monthly", "biweekly", "quarterly", "annual"]),
  dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  nextDueDate: DateOnly,
  autopay: z.boolean().default(true),
  paymentAccountId: z.number().int().positive().nullable().optional(),
  paymentMethod: z.string().max(100).nullable().optional(),
});

export const RecurringBillUpdateInput = RecurringBillCreateInput.partial();

// ──────────── Budget ────────────

export const BudgetCreateInput = z.object({
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(50),
  amount: Money,
  cycleType: z.enum(["paycheck", "monthly", "biweekly"]).default("paycheck"),
  cycleStartDay: z.number().int().min(1).max(31).nullable().optional(),
});

export const BudgetUpdateInput = BudgetCreateInput.partial();

// ──────────── IncomeSource ────────────

export const IncomeSourceCreateInput = z.object({
  userId: z.number().int().positive(),
  name: z.string().min(1).max(100),
  type: z.enum(["salary", "self_employed", "bonus", "other"]),
  amount: Money,
  amountVariable: z.boolean().default(false),
  frequency: z.enum(["biweekly", "monthly", "annual", "variable"]),
  payDayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  nextPayDate: DateOnly.nullable().optional(),
  depositAccountId: z.number().int().positive().nullable().optional(),
  isPrimary: z.boolean().default(false),
});

export const IncomeSourceUpdateInput = IncomeSourceCreateInput.partial();

// ──────────── AdHocExpense ────────────

export const AdHocCreateInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  category: z.enum(["travel", "gifts", "auto", "medical", "home", "other"]),
  amount: Money,
  dueDate: DateOnly,
  paymentAccountId: z.number().int().positive().nullable().optional(),
  status: z.enum(["planned", "funded", "paid", "cancelled"]).default("planned"),
  assignedPaycheckDate: DateOnly.nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const AdHocUpdateInput = AdHocCreateInput.partial();

// ──────────── Transaction (PATCH only — creation is via Plaid sync) ────────────

export const TransactionUpdateInput = z.object({
  category: z.string().min(1).max(50).nullable().optional(),
  categorySource: z.enum(["llm", "user", "rule", "plaid"]).optional(),
  budgetId: z.number().int().positive().nullable().optional(),
  billId: z.number().int().positive().nullable().optional(),
  debtId: z.number().int().positive().nullable().optional(),
  adhocId: z.number().int().positive().nullable().optional(),
  incomeSourceId: z.number().int().positive().nullable().optional(),
  isHidden: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional(),
});

/**
 * Convenience endpoint: POST /api/transactions/:id/assign — pin a
 * transaction to one of the four assignable categories. The handler
 * clears the other three so a transaction never claims to fulfill
 * multiple commitments simultaneously.
 */
export const TransactionAssignInput = z.object({
  kind: z.enum(["bill", "debt", "adhoc", "budget", "income", "none"]),
  id: z.number().int().positive().nullable().optional(),
});

// Inferred TS types — handy on the frontend forms

export type AccountCreateInput = z.infer<typeof AccountCreateInput>;
export type AccountUpdateInput = z.infer<typeof AccountUpdateInput>;
export type DebtCreateInput = z.infer<typeof DebtCreateInput>;
export type DebtUpdateInput = z.infer<typeof DebtUpdateInput>;
export type RecurringBillCreateInput = z.infer<typeof RecurringBillCreateInput>;
export type RecurringBillUpdateInput = z.infer<typeof RecurringBillUpdateInput>;
export type BudgetCreateInput = z.infer<typeof BudgetCreateInput>;
export type BudgetUpdateInput = z.infer<typeof BudgetUpdateInput>;
export type IncomeSourceCreateInput = z.infer<typeof IncomeSourceCreateInput>;
export type IncomeSourceUpdateInput = z.infer<typeof IncomeSourceUpdateInput>;
export type AdHocCreateInput = z.infer<typeof AdHocCreateInput>;
export type AdHocUpdateInput = z.infer<typeof AdHocUpdateInput>;
export type TransactionUpdateInput = z.infer<typeof TransactionUpdateInput>;
export type TransactionAssignInput = z.infer<typeof TransactionAssignInput>;
