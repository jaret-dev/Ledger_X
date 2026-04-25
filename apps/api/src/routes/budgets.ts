import { Router } from "express";
import { prisma } from "@ledger/db";
import { BudgetsResponse, type BudgetWithProgress } from "@ledger/shared-types";
import { currentPaycheckCycle } from "../services/cycle.js";

export const budgetsRouter: Router = Router();

budgetsRouter.get("/budgets", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const today = new Date();

    const [budgets, primary] = await Promise.all([
      prisma.budget.findMany({
        where: { householdId, isActive: true },
        orderBy: { id: "asc" },
      }),
      prisma.incomeSource.findFirst({
        where: { householdId, isPrimary: true, isActive: true },
      }),
    ]);

    const cycle = currentPaycheckCycle(primary, today);

    // Pull all transactions in this cycle once, group by budgetId.
    const txns = await prisma.transaction.findMany({
      where: {
        householdId,
        date: { gte: cycle.start, lt: cycle.end },
        budgetId: { not: null },
        isHidden: false,
      },
      orderBy: { date: "desc" },
    });

    const txnsByBudget = new Map<number, typeof txns>();
    for (const t of txns) {
      if (!t.budgetId) continue;
      const arr = txnsByBudget.get(t.budgetId) ?? [];
      arr.push(t);
      txnsByBudget.set(t.budgetId, arr);
    }

    const dtos: BudgetWithProgress[] = budgets.map((b) => {
      const tx = txnsByBudget.get(b.id) ?? [];
      const spent = tx.reduce((sum, t) => sum + Math.max(0, Number(t.amount)), 0);
      const allocated = Number(b.amount);
      const remaining = allocated - spent;
      const pctUsed = allocated > 0 ? (spent / allocated) * 100 : 0;
      const status: BudgetWithProgress["status"] =
        pctUsed > 100 ? "over" : pctUsed > 85 ? "warn" : "good";

      return {
        id: b.id,
        name: b.name,
        category: b.category,
        amount: round2(allocated),
        cycleType: b.cycleType as BudgetWithProgress["cycleType"],
        cycleStart: toIsoDate(cycle.start),
        cycleEnd: toIsoDate(cycle.end),
        spentThisCycle: round2(spent),
        remainingThisCycle: round2(remaining),
        pctUsed: round2(pctUsed),
        status,
        recentTransactions: tx.slice(0, 5).map((t) => ({
          id: t.id,
          date: toIsoDate(t.date),
          merchantName: t.merchantName,
          amount: round2(Number(t.amount)),
        })),
      };
    });

    const allocated = round2(dtos.reduce((s, d) => s + d.amount, 0));
    const spent = round2(dtos.reduce((s, d) => s + d.spentThisCycle, 0));

    const payload = BudgetsResponse.parse({
      budgets: dtos,
      cycle: {
        type: cycle.type,
        start: toIsoDate(cycle.start),
        end: toIsoDate(cycle.end),
        daysIn: cycle.daysIn,
        daysTotal: cycle.daysTotal,
        pctElapsed: round2(cycle.pctElapsed),
      },
      totals: {
        allocated,
        spent,
        remaining: round2(allocated - spent),
        pctUsed: allocated > 0 ? round2((spent / allocated) * 100) : 0,
      },
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
