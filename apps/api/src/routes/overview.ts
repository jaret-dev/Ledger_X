import { Router } from "express";
import { prisma } from "@ledger/db";
import {
  OverviewResponse,
  type PaycheckBlock,
  type OverviewDebtRow,
  type OverviewBudgetRow,
  type OverviewAdhocCard,
} from "@ledger/shared-types";
import {
  billMonthlyAmount,
  currentPaycheckCycle,
  incomeMonthlyAmount,
  projectBillDueDates,
  projectPaydates,
} from "../services/cycle.js";
import { addDays, daysBetween, toIso } from "../services/dates.js";

export const overviewRouter: Router = Router();

overviewRouter.get("/overview", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const today = new Date();

    const [accounts, snapshot, debts, bills, budgets, adhoc, incomeSources, recentTxns] =
      await Promise.all([
        prisma.account.findMany({
          where: { householdId, isActive: true, type: { in: ["depository"] } },
          select: { currentBalance: true },
        }),
        prisma.netWorthSnapshot.findFirst({
          where: { householdId },
          orderBy: { snapshotDate: "desc" },
        }),
        prisma.debt.findMany({
          where: { householdId, isActive: true },
          orderBy: [{ apr: "desc" }, { balance: "desc" }],
        }),
        prisma.recurringBill.findMany({
          where: { householdId, isActive: true },
        }),
        prisma.budget.findMany({
          where: { householdId, isActive: true },
        }),
        prisma.adHocExpense.findMany({
          where: { householdId, status: { not: "cancelled" }, dueDate: { gte: today } },
          orderBy: { dueDate: "asc" },
          take: 6,
        }),
        prisma.incomeSource.findMany({
          where: { householdId, isActive: true },
          include: { user: { select: { name: true } } },
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        }),
        prisma.transaction.findMany({
          where: { householdId, isHidden: false, budgetId: { not: null } },
          orderBy: [{ date: "desc" }, { id: "desc" }],
          take: 200,
        }),
      ]);

    const cashOnHand = round2(accounts.reduce((s, a) => s + Number(a.currentBalance ?? 0), 0));
    const monthlyInflow = round2(incomeSources.reduce((s, i) => s + incomeMonthlyAmount(i), 0));
    const monthlyOutflow = round2(
      bills.reduce((s, b) => s + billMonthlyAmount(b), 0) +
        debts.reduce((s, d) => s + Number(d.minPayment), 0),
    );
    const netWorth = snapshot ? round2(Number(snapshot.netWorth)) : 0;

    // Build the next 4 paycheck blocks. Combine projected dates from every
    // income source, sort, take the soonest 4.
    type Projected = { date: Date; source: (typeof incomeSources)[number] };
    const projected: Projected[] = [];
    for (const src of incomeSources) {
      for (const date of projectPaydates(src, today, 6)) {
        projected.push({ date, source: src });
      }
    }
    projected.sort((a, b) => a.date.getTime() - b.date.getTime());
    const nextFour = projected.slice(0, 4);

    // For each paycheck, charge bills + debt mins + adhoc whose due date
    // falls between this paycheck (inclusive) and the next paycheck
    // (exclusive). Per BUILD_PLAN §6 hybrid auto-assignment.
    const paychecks: PaycheckBlock[] = [];
    for (let i = 0; i < nextFour.length; i++) {
      const cur = nextFour[i]!;
      const nextDate = nextFour[i + 1]?.date ?? addDays(cur.date, 14);

      const charges: PaycheckBlock["charges"] = [];

      // Bills falling within this paycheck's window
      for (const bill of bills) {
        const upcoming = projectBillDueDates(bill, addDays(today, -1), 4);
        for (const due of upcoming) {
          if (due >= cur.date && due < nextDate) {
            charges.push({
              kind: "bill",
              label: bill.name,
              sublabel: toIso(due),
              amount: round2(Number(bill.amount)),
            });
          }
        }
      }
      // Debt minimums
      for (const debt of debts) {
        if (!debt.dueDayOfMonth) continue;
        const due = nextDayOfMonthLocal(cur.date, debt.dueDayOfMonth);
        if (due >= cur.date && due < nextDate) {
          charges.push({
            kind: "debt",
            label: `${debt.name} · min`,
            sublabel: toIso(due),
            amount: round2(Number(debt.minPayment)),
          });
        }
      }
      // Adhoc
      for (const a of adhoc) {
        if (a.dueDate >= cur.date && a.dueDate < nextDate) {
          charges.push({
            kind: "adhoc",
            label: a.name,
            sublabel: toIso(a.dueDate),
            amount: round2(Number(a.amount)),
          });
        }
      }

      const chargesTotal = round2(charges.reduce((s, c) => s + c.amount, 0));
      paychecks.push({
        date: toIso(cur.date),
        userName: cur.source.user.name,
        sourceName: cur.source.name,
        amount: round2(Number(cur.source.amount)),
        charges,
        chargesTotal,
        leftover: round2(Number(cur.source.amount) - chargesTotal),
      });
    }

    // Debts panel — top 5 by balance
    const debtRows: OverviewDebtRow[] = debts.slice(0, 5).map((d) => ({
      id: d.id,
      name: d.name,
      apr: round2(Number(d.apr)),
      minPayment: round2(Number(d.minPayment)),
      balance: round2(Number(d.balance)),
      isHighApr: Number(d.apr) >= 20,
    }));

    // Budgets panel — all envelopes for the current cycle
    const primary = incomeSources.find((i) => i.isPrimary) ?? null;
    const cycle = currentPaycheckCycle(primary, today);
    const txnsByBudget = new Map<number, number>();
    for (const t of recentTxns) {
      if (!t.budgetId) continue;
      if (t.date < cycle.start || t.date >= cycle.end) continue;
      const cur = txnsByBudget.get(t.budgetId) ?? 0;
      txnsByBudget.set(t.budgetId, cur + Math.max(0, Number(t.amount)));
    }
    const budgetRows: OverviewBudgetRow[] = budgets.map((b) => {
      const allocated = round2(Number(b.amount));
      const spent = round2(txnsByBudget.get(b.id) ?? 0);
      const remaining = round2(allocated - spent);
      const pct = allocated > 0 ? (spent / allocated) * 100 : 0;
      return {
        id: b.id,
        name: b.name,
        category: b.category,
        allocated,
        spent,
        remaining,
        pctUsed: round2(pct),
        status: pct > 100 ? "over" : pct > 85 ? "warn" : "good",
      };
    });

    // Upcoming ad-hoc cards — next 4
    const upcomingAdhoc: OverviewAdhocCard[] = adhoc.slice(0, 4).map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      amount: round2(Number(a.amount)),
      dueDate: toIso(a.dueDate),
      daysUntilDue: daysBetween(today, a.dueDate),
      status: a.status,
    }));

    const totalDebtBalance = round2(debts.reduce((s, d) => s + Number(d.balance), 0));
    const totalDebtMinimums = round2(debts.reduce((s, d) => s + Number(d.minPayment), 0));

    const payload = OverviewResponse.parse({
      asOf: toIso(today),
      stats: {
        cashOnHand,
        monthlyInflow,
        monthlyOutflow,
        netWorth,
      },
      paychecks,
      debts: {
        rows: debtRows,
        totalBalance: totalDebtBalance,
        monthlyMinimums: totalDebtMinimums,
      },
      budgets: {
        rows: budgetRows,
        cycleEnd: toIso(cycle.end),
      },
      upcomingAdhoc,
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

function nextDayOfMonthLocal(after: Date, dayOfMonth: number): Date {
  const candidate = new Date(
    Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), Math.min(dayOfMonth, 28)),
  );
  if (candidate <= after) {
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  }
  return candidate;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
