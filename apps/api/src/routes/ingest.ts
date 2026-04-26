import { Router } from "express";
import { z } from "zod";
import { Prisma, prisma } from "@ledger/db";
import {
  IngestAccountsResponse,
  IngestBalancesRequest,
  IngestBalancesResponse,
  IngestLiabilitiesRequest,
  IngestLiabilitiesResponse,
  IngestSyncLogRequest,
  IngestSyncLogResponse,
  IngestTransactionsRequest,
  IngestTransactionsResponse,
} from "@ledger/shared-types";
import { fromIso } from "../services/ownership.js";
import { logger } from "../lib/logger.js";

export const ingestRouter: Router = Router();

// ──────────── GET /api/ingest/accounts ────────────
// Agent calls this to learn which accounts to sync OR which to bootstrap.
// Returns ALL non-manual accounts (linked + unlinked) so the script can:
//   - filter to `plaidAccessToken !== null` for the sync flow
//   - pick the first unlinked one for the sandbox bootstrap flow

ingestRouter.get("/accounts", async (_req, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: {
        isActive: true,
        isManual: false,
      },
      select: {
        id: true,
        householdId: true,
        plaidAccessToken: true,
        plaidItemId: true,
        plaidAccountId: true,
        plaidSyncCursor: true,
        institution: true,
        nickname: true,
        type: true,
        subtype: true,
      },
      orderBy: { id: "asc" },
    });
    res.json(IngestAccountsResponse.parse({ accounts }));
  } catch (err) {
    next(err);
  }
});

// ──────────── POST /api/ingest/accounts/:id/plaid-link ────────────
// One-time call per account when bootstrapping a Plaid item. The agent
// runs Plaid's sandbox public-token-create + exchange dance, gets back
// access_token + item_id + the per-account ids from /accounts/get, then
// POSTs here to attach the linkage to one of the seeded Account rows.
//
// Subsequent /api/ingest/transactions calls match accountPlaidId back to
// this row and write transactions against it.

ingestRouter.post("/accounts/:id/plaid-link", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "invalid_account_id" });
      return;
    }

    const Body = z.object({
      plaidAccessToken: z.string().min(1),
      plaidItemId: z.string().min(1),
      plaidAccountId: z.string().min(1),
    });
    const input = Body.parse(req.body);

    const existing = await prisma.account.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "account_not_found", id });
      return;
    }
    if (existing.isManual) {
      res.status(400).json({
        error: "account_is_manual",
        message: "Manual-entry accounts (e.g. OSAP) can't be Plaid-linked",
      });
      return;
    }

    const updated = await prisma.account.update({
      where: { id },
      data: {
        plaidAccessToken: input.plaidAccessToken,
        plaidItemId: input.plaidItemId,
        plaidAccountId: input.plaidAccountId,
        // Reset the cursor when re-linking; sync starts fresh.
        plaidSyncCursor: null,
        lastSyncedAt: null,
      },
      select: { id: true, nickname: true, plaidAccountId: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ──────────── POST /api/ingest/transactions ────────────
// Atomic: write transactions + advance cursor in a single Prisma tx.
// Idempotent on plaidTransactionId.

ingestRouter.post("/transactions", async (req, res, next) => {
  try {
    const input = IngestTransactionsRequest.parse(req.body);

    const account = await prisma.account.findUnique({
      where: { plaidAccountId: input.accountPlaidId },
      select: { id: true, householdId: true },
    });
    if (!account) {
      res.status(404).json({
        error: "account_not_found",
        accountPlaidId: input.accountPlaidId,
      });
      return;
    }

    let created = 0;
    let updated = 0;
    const skipped = 0; // reserved for future "didn't move forward" branch

    await prisma.$transaction(async (tx) => {
      for (const t of input.transactions) {
        const existing = await tx.transaction.findUnique({
          where: { plaidTransactionId: t.plaidTransactionId },
          select: { id: true, categorySource: true },
        });
        if (existing) {
          // Don't clobber a user's manual category — only the LLM/rule
          // owners can be overwritten.
          const categoryOwnedByAgent =
            existing.categorySource !== "user" && existing.categorySource !== "rule";
          await tx.transaction.update({
            where: { plaidTransactionId: t.plaidTransactionId },
            data: {
              date: fromIso(t.date)!,
              amount: new Prisma.Decimal(t.amount),
              merchantName: t.merchantName,
              merchantRaw: t.merchantRaw,
              description: t.description,
              isPending: t.isPending,
              ...(categoryOwnedByAgent && t.suggestedCategory
                ? {
                    category: t.suggestedCategory,
                    categorySource:
                      t.categoryConfidence != null && t.categoryConfidence < 0.7
                        ? "llm_uncertain"
                        : "llm",
                    categoryConfidence:
                      t.categoryConfidence != null
                        ? new Prisma.Decimal(t.categoryConfidence)
                        : null,
                  }
                : {}),
            },
          });
          updated++;
        } else {
          await tx.transaction.create({
            data: {
              householdId: account.householdId,
              accountId: account.id,
              plaidTransactionId: t.plaidTransactionId,
              date: fromIso(t.date)!,
              amount: new Prisma.Decimal(t.amount),
              merchantName: t.merchantName,
              merchantRaw: t.merchantRaw,
              description: t.description,
              category: t.suggestedCategory,
              categorySource:
                t.suggestedCategory == null
                  ? "llm"
                  : t.categoryConfidence != null && t.categoryConfidence < 0.7
                    ? "llm_uncertain"
                    : "llm",
              categoryConfidence:
                t.categoryConfidence != null
                  ? new Prisma.Decimal(t.categoryConfidence)
                  : null,
              isPending: t.isPending,
              isHidden: false,
            },
          });
          created++;
        }
      }

      // Advance the cursor only if every txn was written (atomic with
      // the writes above thanks to $transaction).
      if (input.nextCursor !== undefined && input.nextCursor !== null) {
        await tx.account.update({
          where: { id: account.id },
          data: {
            plaidSyncCursor: input.nextCursor,
            lastSyncedAt: new Date(),
          },
        });
      }
    });

    void skipped; // placeholder for the future "didn't move" branch
    res.json(
      IngestTransactionsResponse.parse({
        created,
        updated,
        skipped,
        cursorAdvanced: input.nextCursor != null,
      }),
    );
  } catch (err) {
    next(err);
  }
});

// ──────────── POST /api/ingest/balances ────────────

ingestRouter.post("/balances", async (req, res, next) => {
  try {
    const input = IngestBalancesRequest.parse(req.body);
    let written = 0;

    await prisma.$transaction(async (tx) => {
      for (const s of input.snapshots) {
        const account = await tx.account.findUnique({
          where: { plaidAccountId: s.accountPlaidId },
          select: { id: true },
        });
        if (!account) {
          logger.warn(
            { accountPlaidId: s.accountPlaidId },
            "Balance snapshot for unknown account, skipping",
          );
          continue;
        }
        // Update the live balance + write a historical snapshot row so
        // the trend chart on Net Worth has data over time.
        await tx.account.update({
          where: { id: account.id },
          data: {
            currentBalance: new Prisma.Decimal(s.currentBalance),
            availableBalance:
              s.availableBalance != null ? new Prisma.Decimal(s.availableBalance) : null,
            creditLimit:
              s.creditLimit != null ? new Prisma.Decimal(s.creditLimit) : null,
            lastSyncedAt: new Date(),
          },
        });
        await tx.accountBalanceSnapshot.create({
          data: {
            accountId: account.id,
            balance: new Prisma.Decimal(s.currentBalance),
            recordedAt: new Date(s.recordedAt),
          },
        });
        written++;
      }
    });

    res.json(IngestBalancesResponse.parse({ written }));
  } catch (err) {
    next(err);
  }
});

// ──────────── POST /api/ingest/liabilities ────────────
// Updates the matching Debt row with fresh Plaid liability data.
// Skips accounts that don't have a Debt record (manual debts, OSAP).

ingestRouter.post("/liabilities", async (req, res, next) => {
  try {
    const input = IngestLiabilitiesRequest.parse(req.body);
    let updated = 0;
    let skipped = 0;

    await prisma.$transaction(async (tx) => {
      for (const l of input.liabilities) {
        const account = await tx.account.findUnique({
          where: { plaidAccountId: l.accountPlaidId },
          select: { id: true },
        });
        if (!account) {
          skipped++;
          continue;
        }
        const debt = await tx.debt.findFirst({
          where: { accountId: account.id, isActive: true },
        });
        if (!debt) {
          skipped++;
          continue;
        }
        await tx.debt.update({
          where: { id: debt.id },
          data: {
            balance: new Prisma.Decimal(l.balance),
            apr: new Prisma.Decimal(l.apr),
            minPayment: new Prisma.Decimal(l.minPayment),
            dueDayOfMonth: l.dueDayOfMonth,
          },
        });
        updated++;
      }
    });

    res.json(IngestLiabilitiesResponse.parse({ updated, skipped }));
  } catch (err) {
    next(err);
  }
});

// ──────────── POST /api/ingest/sync-log ────────────
// Audit trail for every agent run. Lets us tell at a glance whether
// last night's sync succeeded, and surfaces errors via the SyncLog page
// (Phase 6 will read this for the in-app health indicator).

ingestRouter.post("/sync-log", async (req, res, next) => {
  try {
    const input = IngestSyncLogRequest.parse(req.body);
    const created = await prisma.syncLog.create({
      data: {
        source: input.source,
        status: input.status,
        itemsProcessed: input.itemsProcessed,
        errorMessage: input.errorMessage ?? null,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
        startedAt: new Date(input.startedAt),
        completedAt: new Date(input.completedAt),
      },
    });
    res.json(IngestSyncLogResponse.parse({ id: created.id }));
  } catch (err) {
    next(err);
  }
});
