import { z } from "zod";
import { Money, DateOnly, Timestamp } from "./money.js";

/**
 * Ingest contract — the OpenClaw Ledger agent (in
 * ~/.openclaw/scripts/pulls/ledger-plaid-sync.mjs) POSTs against these.
 *
 * All ingest endpoints sit behind the `x-agent-key` header — separate
 * from `x-household-id` so an end-user JWT can never write here. The
 * agent is implicitly scoped to all households (Phase 4 has only one;
 * future-proofs for shared households).
 *
 * Convention:
 *   - `accountPlaidId` is Plaid's account_id (matched to Account.plaidAccountId)
 *   - Money values are JSON numbers in CAD
 *   - All POSTs are idempotent on plaidTransactionId / accountPlaidId
 */

// ──────────── GET /api/ingest/accounts ────────────
// Agent calls this first to enumerate which accounts to sync. Returns
// the encrypted access token (Phase 7 encrypts at rest; for Phase 4
// sandbox the column holds plaintext sandbox tokens).

export const IngestAccount = z.object({
  id: z.number().int().positive(),
  householdId: z.number().int().positive(),
  plaidAccessToken: z.string().nullable(),
  plaidItemId: z.string().nullable(),
  plaidAccountId: z.string().nullable(),
  plaidSyncCursor: z.string().nullable(),
  institution: z.string(),
  nickname: z.string(),
  type: z.string(),
  subtype: z.string().nullable(),
});

export const IngestAccountsResponse = z.object({
  accounts: z.array(IngestAccount),
});

// ──────────── POST /api/ingest/transactions ────────────

export const IngestTransaction = z.object({
  plaidTransactionId: z.string().min(1),
  date: DateOnly,
  amount: Money, // positive = outflow (Plaid convention)
  merchantName: z.string().nullable(),
  merchantRaw: z.string(),
  description: z.string().nullable(),
  isPending: z.boolean(),
  // Filled by the agent's LLM categorization step before POSTing
  suggestedCategory: z.string().nullable(),
  categoryConfidence: z.number().min(0).max(1).nullable(),
});

export const IngestTransactionsRequest = z.object({
  source: z.enum(["plaid", "manual"]).default("plaid"),
  accountPlaidId: z.string().min(1),
  // Atomic: server writes transactions AND advances cursor in one tx.
  // Skip if your sync didn't get a cursor back (initial historical pull).
  nextCursor: z.string().nullable().optional(),
  transactions: z.array(IngestTransaction),
});

export const IngestTransactionsResponse = z.object({
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  cursorAdvanced: z.boolean(),
});

// ──────────── POST /api/ingest/balances ────────────

export const IngestBalanceSnapshot = z.object({
  accountPlaidId: z.string().min(1),
  currentBalance: Money,
  availableBalance: Money.nullable(),
  creditLimit: Money.nullable(),
  recordedAt: Timestamp,
});

export const IngestBalancesRequest = z.object({
  source: z.enum(["plaid", "manual"]).default("plaid"),
  snapshots: z.array(IngestBalanceSnapshot),
});

export const IngestBalancesResponse = z.object({
  written: z.number().int().nonnegative(),
});

// ──────────── POST /api/ingest/liabilities ────────────

export const IngestLiability = z.object({
  accountPlaidId: z.string().min(1),
  balance: Money,
  apr: Money,
  minPayment: Money,
  dueDayOfMonth: z.number().int().min(1).max(31).nullable(),
});

export const IngestLiabilitiesRequest = z.object({
  source: z.enum(["plaid"]).default("plaid"),
  liabilities: z.array(IngestLiability),
});

export const IngestLiabilitiesResponse = z.object({
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
});

// ──────────── POST /api/ingest/sync-log ────────────

export const IngestSyncLogRequest = z.object({
  source: z.string().min(1), // "plaid" / "llm_categorize" / etc
  status: z.enum(["success", "partial", "failed"]),
  itemsProcessed: z.number().int().nonnegative().default(0),
  errorMessage: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  startedAt: Timestamp,
  completedAt: Timestamp,
});

export const IngestSyncLogResponse = z.object({
  id: z.number().int().positive(),
});

// ─── Inferred types ──────────────────────────────────────────────

export type IngestAccount = z.infer<typeof IngestAccount>;
export type IngestAccountsResponse = z.infer<typeof IngestAccountsResponse>;
export type IngestTransaction = z.infer<typeof IngestTransaction>;
export type IngestTransactionsRequest = z.infer<typeof IngestTransactionsRequest>;
export type IngestTransactionsResponse = z.infer<typeof IngestTransactionsResponse>;
export type IngestBalanceSnapshot = z.infer<typeof IngestBalanceSnapshot>;
export type IngestBalancesRequest = z.infer<typeof IngestBalancesRequest>;
export type IngestBalancesResponse = z.infer<typeof IngestBalancesResponse>;
export type IngestLiability = z.infer<typeof IngestLiability>;
export type IngestLiabilitiesRequest = z.infer<typeof IngestLiabilitiesRequest>;
export type IngestLiabilitiesResponse = z.infer<typeof IngestLiabilitiesResponse>;
export type IngestSyncLogRequest = z.infer<typeof IngestSyncLogRequest>;
export type IngestSyncLogResponse = z.infer<typeof IngestSyncLogResponse>;
