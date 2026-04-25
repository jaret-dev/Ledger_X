import { Router } from "express";
import { prisma } from "@ledger/db";
import { BillsResponse, type RecurringBill as BillDto } from "@ledger/shared-types";
import { billMonthlyAmount } from "../services/cycle.js";
import { addDays, daysBetween } from "../services/dates.js";

export const billsRouter: Router = Router();

const CATEGORY_LABELS: Record<string, string> = {
  housing: "Housing",
  utilities: "Utilities",
  insurance: "Insurance",
  subscription: "Subscriptions",
  transport: "Transportation",
  other: "Other",
};

billsRouter.get("/bills", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const bills = await prisma.recurringBill.findMany({
      where: { householdId, isActive: true },
      orderBy: [{ category: "asc" }, { dueDayOfMonth: "asc" }],
    });

    const dtos: BillDto[] = bills.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      amount: Number(b.amount),
      amountVariable: b.amountVariable,
      frequency: b.frequency as BillDto["frequency"],
      dueDayOfMonth: b.dueDayOfMonth,
      nextDueDate: toIsoDate(b.nextDueDate),
      autopay: b.autopay,
      paymentAccountId: b.paymentAccountId,
      paymentMethod: b.paymentMethod,
    }));

    // Group by category, preserving CATEGORY_LABELS order
    const knownOrder = Object.keys(CATEGORY_LABELS);
    const groupsMap = new Map<string, BillDto[]>();
    for (const b of dtos) {
      const arr = groupsMap.get(b.category) ?? [];
      arr.push(b);
      groupsMap.set(b.category, arr);
    }
    const groups = [...groupsMap.entries()]
      .sort(([a], [b]) => {
        const ai = knownOrder.indexOf(a);
        const bi = knownOrder.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
      .map(([category, list]) => ({
        category,
        label: CATEGORY_LABELS[category] ?? capitalize(category),
        bills: list,
        monthlyTotal: round2(
          list.reduce((sum, b) => sum + billMonthlyAmount(b), 0),
        ),
      }));

    const monthlyTotal = round2(bills.reduce((sum, b) => sum + billMonthlyAmount(b), 0));
    const autopayCount = bills.filter((b) => b.autopay).length;
    const today = new Date();
    const oneWeek = addDays(today, 7);
    const dueThisWeek = bills.filter(
      (b) => b.nextDueDate >= today && b.nextDueDate <= oneWeek,
    ).length;
    const nextDue = bills
      .map((b) => b.nextDueDate)
      .filter((d) => daysBetween(today, d) >= 0)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const payload = BillsResponse.parse({
      groups,
      totals: {
        monthlyTotal,
        autopayCount,
        manualCount: bills.length - autopayCount,
        dueThisWeek,
        nextDueDate: nextDue ? toIsoDate(nextDue) : null,
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
