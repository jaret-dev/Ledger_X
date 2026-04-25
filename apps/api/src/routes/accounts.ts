import { Router } from "express";
import { Prisma, prisma } from "@ledger/db";
import {
  AccountCreateInput,
  AccountUpdateInput,
  type Account as AccountDto,
} from "@ledger/shared-types";
import { parseId } from "../services/ownership.js";

export const accountsRouter: Router = Router();

/**
 * Manual-account CRUD for accounts not connected via Plaid (the
 * mockup's OSAP entry is the canonical example). Plaid-connected
 * accounts get created automatically by the OpenClaw Ledger agent
 * in Phase 4 — this endpoint forces `isManual: true` so a user
 * can't accidentally clobber a Plaid-managed row through here.
 */

// LIST + GET routes are unnecessary for Phase 3 — accounts are exposed
// via /api/networth and /api/sidebar already. Add them later if a
// dedicated "Accounts" page lands.

accountsRouter.post("/accounts/manual", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const input = AccountCreateInput.parse(req.body);
    const created = await prisma.account.create({
      data: {
        householdId,
        institution: input.institution,
        nickname: input.nickname,
        type: input.type,
        subtype: input.subtype ?? null,
        currentBalance:
          input.currentBalance != null ? new Prisma.Decimal(input.currentBalance) : null,
        creditLimit:
          input.creditLimit != null ? new Prisma.Decimal(input.creditLimit) : null,
        currency: input.currency,
        isManual: true,
        isActive: true,
      },
    });
    res.status(201).json(toDto(created));
  } catch (err) {
    next(err);
  }
});

accountsRouter.patch("/accounts/:id", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const id = parseId(req.params.id);
    const input = AccountUpdateInput.parse(req.body);

    const existing = await prisma.account.findFirst({ where: { id, householdId } });
    if (!existing) {
      res.status(404).json({ error: "account_not_found", id });
      return;
    }
    if (!existing.isManual) {
      res.status(400).json({
        error: "account_not_manual",
        message: "Plaid-managed accounts can't be edited via this endpoint",
      });
      return;
    }

    const data: Prisma.AccountUpdateInput = {};
    if (input.institution !== undefined) data.institution = input.institution;
    if (input.nickname !== undefined) data.nickname = input.nickname;
    if (input.type !== undefined) data.type = input.type;
    if (input.subtype !== undefined) data.subtype = input.subtype ?? null;
    if (input.currentBalance !== undefined)
      data.currentBalance =
        input.currentBalance != null ? new Prisma.Decimal(input.currentBalance) : null;
    if (input.creditLimit !== undefined)
      data.creditLimit =
        input.creditLimit != null ? new Prisma.Decimal(input.creditLimit) : null;
    if (input.currency !== undefined) data.currency = input.currency;

    const updated = await prisma.account.update({ where: { id }, data });
    res.json(toDto(updated));
  } catch (err) {
    next(err);
  }
});

accountsRouter.delete("/accounts/:id", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const id = parseId(req.params.id);
    const existing = await prisma.account.findFirst({ where: { id, householdId } });
    if (!existing) {
      res.status(404).json({ error: "account_not_found", id });
      return;
    }
    if (!existing.isManual) {
      res.status(400).json({
        error: "account_not_manual",
        message: "Plaid-managed accounts can't be deleted via this endpoint",
      });
      return;
    }
    await prisma.account.update({ where: { id }, data: { isActive: false } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

function toDto(a: {
  id: number;
  nickname: string;
  institution: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalance: Prisma.Decimal | null;
  availableBalance: Prisma.Decimal | null;
  creditLimit: Prisma.Decimal | null;
  currency: string;
  isManual: boolean;
  lastSyncedAt: Date | null;
}): AccountDto {
  return {
    id: a.id,
    nickname: a.nickname,
    institution: a.institution,
    mask: a.mask,
    type: a.type as AccountDto["type"],
    subtype: a.subtype,
    currentBalance: a.currentBalance ? Number(a.currentBalance) : null,
    availableBalance: a.availableBalance ? Number(a.availableBalance) : null,
    creditLimit: a.creditLimit ? Number(a.creditLimit) : null,
    currency: a.currency,
    isManual: a.isManual,
    lastSyncedAt: a.lastSyncedAt ? a.lastSyncedAt.toISOString() : null,
  };
}
