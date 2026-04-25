import { z } from "zod";
import { Money, DateOnly } from "./money.js";

export const NetWorthSnapshot = z.object({
  date: DateOnly,
  totalAssets: Money,
  totalLiabilities: Money,
  netWorth: Money,
  // Free-form per-bucket breakdown (cash, investments, crypto, etc).
  // Mockup uses { cash_and_savings, investments_tfsa_rrsp, crypto } but
  // anything is permitted so future buckets don't break the contract.
  breakdown: z.record(z.string(), Money),
});

/** Liability row for the Net Worth page's right-side panel. */
export const LiabilityBreakdown = z.object({
  debtId: z.number().int().positive(),
  name: z.string(),
  type: z.string(),
  balance: Money,
});

/** Asset row for the Net Worth page's left-side panel. */
export const AssetBreakdown = z.object({
  accountId: z.number().int().positive(),
  nickname: z.string(),
  institution: z.string(),
  subtype: z.string().nullable(),
  balance: Money,
});

export const NetWorthResponse = z.object({
  current: NetWorthSnapshot,
  history: z.array(NetWorthSnapshot), // monthly snapshots, ascending
  assets: z.array(AssetBreakdown),
  liabilities: z.array(LiabilityBreakdown),
});

export const AllocationSlice = z.object({
  bucket: z.string(),
  label: z.string(), // capitalized
  amount: Money,
  pct: z.number().min(0).max(100),
});

export const NetWorthAllocationResponse = z.object({
  total: Money,
  slices: z.array(AllocationSlice),
});

export const Milestone = z.object({
  key: z.enum([
    "emergency_fund",
    "debt_free_high_interest",
    "net_worth_100k",
    "house_down_payment",
  ]),
  label: z.string(),
  current: Money,
  target: Money,
  pctComplete: z.number().min(0).max(100),
  etaLabel: z.string(), // e.g. "Jan 2027" or "Q2 2028" or "2029+"
  remaining: Money,
});

export const NetWorthMilestonesResponse = z.object({
  milestones: z.array(Milestone),
});

export type NetWorthSnapshot = z.infer<typeof NetWorthSnapshot>;
export type NetWorthResponse = z.infer<typeof NetWorthResponse>;
export type AssetBreakdown = z.infer<typeof AssetBreakdown>;
export type LiabilityBreakdown = z.infer<typeof LiabilityBreakdown>;
export type AllocationSlice = z.infer<typeof AllocationSlice>;
export type NetWorthAllocationResponse = z.infer<typeof NetWorthAllocationResponse>;
export type Milestone = z.infer<typeof Milestone>;
export type NetWorthMilestonesResponse = z.infer<typeof NetWorthMilestonesResponse>;
