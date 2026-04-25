import { Router } from "express";
import { Prisma, prisma } from "@ledger/db";
import {
  TransactionsQuery,
  TransactionsResponse,
  TransactionsSummaryQuery,
  TransactionsSummaryResponse,
  TransactionUpdateInput,
  TransactionAssignInput,
  type Transaction as TxnDto,
} from "@ledger/shared-types";
import { addDays, daysBetween, toIso } from "../services/dates.js";
import { parseId } from "../services/ownership.js";

export const transactionsRouter: Router = Router();

transactionsRouter.get("/transactions", async (req, res, next) => {
  try {
    const query = TransactionsQuery.parse(req.query);
    const householdId = req.household!.id;

    const where: Prisma.TransactionWhereInput = {
      householdId,
      ...(query.includeHidden ? {} : { isHidden: false }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.startDate || query.endDate
        ? {
            date: {
              ...(query.startDate ? { gte: new Date(`${query.startDate}T00:00:00Z`) } : {}),
              ...(query.endDate ? { lte: new Date(`${query.endDate}T23:59:59Z`) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { merchantName: { contains: query.search, mode: "insensitive" } },
              { merchantRaw: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total, accountFacets, categoryFacets] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { account: { select: { nickname: true } } },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.transaction.count({ where }),
      prisma.account.findMany({
        where: { householdId, isActive: true },
        select: { id: true, nickname: true },
        orderBy: { nickname: "asc" },
      }),
      prisma.transaction.findMany({
        where: { householdId, category: { not: null } },
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
      }),
    ]);

    const dtos: TxnDto[] = rows.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      accountNickname: t.account.nickname,
      date: toIso(t.date),
      amount: round2(Number(t.amount)),
      merchantName: t.merchantName,
      merchantRaw: t.merchantRaw,
      description: t.description,
      category: t.category,
      categorySource: t.categorySource as TxnDto["categorySource"],
      categoryConfidence: t.categoryConfidence ? Number(t.categoryConfidence) : null,
      budgetId: t.budgetId,
      billId: t.billId,
      debtId: t.debtId,
      adhocId: t.adhocId,
      incomeSourceId: t.incomeSourceId,
      isPending: t.isPending,
      isHidden: t.isHidden,
      notes: t.notes,
      createdAt: t.createdAt.toISOString(),
    }));

    const payload = TransactionsResponse.parse({
      transactions: dtos,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + dtos.length < total,
      },
      facets: {
        accounts: accountFacets,
        categories: categoryFacets.map((c) => c.category!).filter(Boolean),
      },
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.get("/transactions/summary", async (req, res, next) => {
  try {
    const query = TransactionsSummaryQuery.parse(req.query);
    const householdId = req.household!.id;
    const today = new Date();
    const start = addDays(today, -query.days);

    const rows = await prisma.transaction.findMany({
      where: {
        householdId,
        isHidden: false,
        date: { gte: start, lte: today },
      },
      select: { amount: true },
    });

    let moneyIn = 0;
    let moneyOut = 0;
    for (const r of rows) {
      const amt = Number(r.amount);
      if (amt < 0) moneyIn += -amt;
      else moneyOut += amt;
    }
    const net = moneyIn - moneyOut;
    const dailyAvgOut = query.days > 0 ? moneyOut / query.days : 0;

    const payload = TransactionsSummaryResponse.parse({
      windowDays: query.days,
      startDate: toIso(start),
      endDate: toIso(today),
      moneyIn: round2(moneyIn),
      moneyOut: round2(moneyOut),
      net: round2(net),
      txnCount: rows.length,
      dailyAvgOut: round2(dailyAvgOut),
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// ──────────── Mutations ────────────

transactionsRouter.patch("/transactions/:id", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const id = parseId(req.params.id);
    const input = TransactionUpdateInput.parse(req.body);

    const existing = await prisma.transaction.findFirst({ where: { id, householdId } });
    if (!existing) {
      res.status(404).json({ error: "transaction_not_found", id });
      return;
    }

    const data: Prisma.TransactionUpdateInput = {};
    if (input.category !== undefined) data.category = input.category ?? null;
    if (input.categorySource !== undefined) data.categorySource = input.categorySource;
    if (input.budgetId !== undefined)
      data.budget = input.budgetId ? { connect: { id: input.budgetId } } : { disconnect: true };
    if (input.billId !== undefined)
      data.bill = input.billId ? { connect: { id: input.billId } } : { disconnect: true };
    if (input.debtId !== undefined)
      data.debt = input.debtId ? { connect: { id: input.debtId } } : { disconnect: true };
    if (input.adhocId !== undefined)
      data.adhoc = input.adhocId ? { connect: { id: input.adhocId } } : { disconnect: true };
    if (input.incomeSourceId !== undefined)
      data.incomeSource = input.incomeSourceId
        ? { connect: { id: input.incomeSourceId } }
        : { disconnect: true };
    if (input.isHidden !== undefined) data.isHidden = input.isHidden;
    if (input.notes !== undefined) data.notes = input.notes ?? null;

    const updated = await prisma.transaction.update({ where: { id }, data });
    res.json({ id: updated.id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/transactions/:id/assign
 * Pin one transaction to one commitment (bill / debt / adhoc / budget /
 * income), clearing the other four. Avoids ambiguous "this transaction
 * counts toward two budgets" states.
 */
transactionsRouter.post("/transactions/:id/assign", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const id = parseId(req.params.id);
    const input = TransactionAssignInput.parse(req.body);

    const existing = await prisma.transaction.findFirst({ where: { id, householdId } });
    if (!existing) {
      res.status(404).json({ error: "transaction_not_found", id });
      return;
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        budgetId: input.kind === "budget" ? input.id ?? null : null,
        billId: input.kind === "bill" ? input.id ?? null : null,
        debtId: input.kind === "debt" ? input.id ?? null : null,
        adhocId: input.kind === "adhoc" ? input.id ?? null : null,
        incomeSourceId: input.kind === "income" ? input.id ?? null : null,
        categorySource: "user",
      },
    });
    res.json({ id: updated.id });
  } catch (err) {
    next(err);
  }
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Suppress unused import warning when daysBetween isn't referenced.
void daysBetween;
