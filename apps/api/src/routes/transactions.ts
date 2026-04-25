import { Router } from "express";
import { Prisma, prisma } from "@ledger/db";
import {
  TransactionsQuery,
  TransactionsResponse,
  TransactionsSummaryQuery,
  TransactionsSummaryResponse,
  type Transaction as TxnDto,
} from "@ledger/shared-types";
import { addDays, daysBetween, toIso } from "../services/dates.js";

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Suppress unused import warning when daysBetween isn't referenced.
void daysBetween;
