import { Router } from "express";
import { prisma } from "@ledger/db";
import {
  CashFlowQuery,
  CashFlowResponse,
  type CashFlowEvent,
  type CashFlowDay,
} from "@ledger/shared-types";
import { addDays, daysBetween, toIso } from "../services/dates.js";
import { projectBillDueDates, projectPaydates } from "../services/cycle.js";

export const cashflowRouter: Router = Router();

cashflowRouter.get("/cashflow", async (req, res, next) => {
  try {
    const query = CashFlowQuery.parse(req.query);
    const householdId = req.household!.id;
    const today = new Date();
    const horizonEnd = addDays(today, query.days);

    const [accounts, incomeSources, bills, debts, adhoc] = await Promise.all([
      prisma.account.findMany({
        where: { householdId, isActive: true, type: { in: ["depository"] } },
        select: { currentBalance: true },
      }),
      prisma.incomeSource.findMany({ where: { householdId, isActive: true } }),
      prisma.recurringBill.findMany({ where: { householdId, isActive: true } }),
      prisma.debt.findMany({ where: { householdId, isActive: true } }),
      prisma.adHocExpense.findMany({
        where: {
          householdId,
          status: { not: "cancelled" },
          dueDate: { gte: today, lte: horizonEnd },
        },
      }),
    ]);

    const startingBalance = accounts.reduce(
      (s, a) => s + Number(a.currentBalance ?? 0),
      0,
    );

    const events: CashFlowEvent[] = [];

    // Income — project paydates per source
    for (const src of incomeSources) {
      const dates = projectPaydates(src, today, Math.ceil(query.days / 7) + 4);
      for (const date of dates) {
        if (date > horizonEnd) break;
        events.push({
          date: toIso(date),
          kind: "income",
          label: src.name,
          amount: Number(src.amount), // positive = inflow per CashFlowEvent convention
          sourceId: src.id,
        });
      }
    }

    // Bills — project due dates per bill
    for (const bill of bills) {
      const dates = projectBillDueDates(bill, addDays(today, -1), Math.ceil(query.days / 28) + 4);
      for (const date of dates) {
        if (date < today || date > horizonEnd) continue;
        events.push({
          date: toIso(date),
          kind: "bill",
          label: bill.name,
          amount: -Number(bill.amount),
          sourceId: bill.id,
        });
      }
    }

    // Debt minimums — assume one charge per month on dueDayOfMonth
    for (const debt of debts) {
      if (!debt.dueDayOfMonth) continue;
      let cursor = new Date(today);
      while (cursor <= horizonEnd) {
        const due = new Date(
          Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), Math.min(debt.dueDayOfMonth, 28)),
        );
        if (due >= today && due <= horizonEnd) {
          events.push({
            date: toIso(due),
            kind: "debt",
            label: `${debt.name} · min`,
            amount: -Number(debt.minPayment),
            sourceId: debt.id,
          });
        }
        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
      }
    }

    // Ad-hoc — only if status isn't already "paid"
    for (const a of adhoc) {
      if (a.status === "paid") continue;
      events.push({
        date: toIso(a.dueDate),
        kind: "adhoc",
        label: a.name,
        amount: -Number(a.amount),
        sourceId: a.id,
      });
    }

    events.sort((a, b) => a.date.localeCompare(b.date));

    // Daily projection — fold events into a per-day inflow/outflow + running balance
    const daily: CashFlowDay[] = [];
    const eventsByDay = new Map<string, CashFlowEvent[]>();
    for (const e of events) {
      const arr = eventsByDay.get(e.date) ?? [];
      arr.push(e);
      eventsByDay.set(e.date, arr);
    }
    let balance = round2(startingBalance);
    let minBalance = balance;
    let minBalanceDate = toIso(today);
    for (let i = 0; i < query.days; i++) {
      const day = addDays(today, i);
      const iso = toIso(day);
      const todays = eventsByDay.get(iso) ?? [];
      let inflow = 0;
      let outflow = 0;
      for (const e of todays) {
        if (e.amount > 0) inflow += e.amount;
        else outflow += -e.amount;
      }
      balance = round2(balance + inflow - outflow);
      if (balance < minBalance) {
        minBalance = balance;
        minBalanceDate = iso;
      }
      daily.push({
        date: iso,
        inflow: round2(inflow),
        outflow: round2(outflow),
        endingBalance: balance,
      });
    }

    const totalInflow = round2(daily.reduce((s, d) => s + d.inflow, 0));
    const totalOutflow = round2(daily.reduce((s, d) => s + d.outflow, 0));

    const payload = CashFlowResponse.parse({
      windowDays: query.days,
      startDate: toIso(today),
      endDate: toIso(horizonEnd),
      startingBalance: round2(startingBalance),
      totals: {
        inflow: totalInflow,
        outflow: totalOutflow,
        net: round2(totalInflow - totalOutflow),
        endingBalance: balance,
        minBalance: round2(minBalance),
        minBalanceDate,
      },
      daily,
      events,
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

void daysBetween;
