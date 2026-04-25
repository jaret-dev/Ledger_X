import { Router } from "express";
import { prisma } from "@ledger/db";
import { AdHocResponse, type AdHocExpense } from "@ledger/shared-types";
import { addDays, daysBetween, toIso } from "../services/dates.js";
import { currentPaycheckCycle } from "../services/cycle.js";

export const adhocRouter: Router = Router();

const CATEGORY_LABELS: Record<string, string> = {
  travel: "Travel",
  gifts: "Gifts",
  auto: "Auto",
  medical: "Medical",
  home: "Home",
  other: "Other",
};

adhocRouter.get("/adhoc", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const today = new Date();

    const [items, primary] = await Promise.all([
      prisma.adHocExpense.findMany({
        where: { householdId, status: { not: "cancelled" } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.incomeSource.findFirst({
        where: { householdId, isPrimary: true, isActive: true },
      }),
    ]);

    const cycle = currentPaycheckCycle(primary, today);
    const next30 = addDays(today, 30);
    const next60 = addDays(today, 60);

    const dtos: AdHocExpense[] = items.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      category: a.category as AdHocExpense["category"],
      amount: round2(Number(a.amount)),
      dueDate: toIso(a.dueDate),
      paymentAccountId: a.paymentAccountId,
      status: a.status as AdHocExpense["status"],
      assignedPaycheckDate: a.assignedPaycheckDate ? toIso(a.assignedPaycheckDate) : null,
      notes: a.notes,
      daysUntilDue: daysBetween(today, a.dueDate),
    }));

    const thisCycle = dtos.filter((a) => {
      const d = new Date(`${a.dueDate}T00:00:00Z`);
      return d >= cycle.start && d < cycle.end;
    });
    const next30d = dtos.filter((a) => {
      const d = new Date(`${a.dueDate}T00:00:00Z`);
      return d >= cycle.end && d <= next30;
    });
    const beyond60d = dtos.filter((a) => {
      const d = new Date(`${a.dueDate}T00:00:00Z`);
      return d > next60;
    });

    const byCategoryMap = new Map<string, { total: number; count: number }>();
    for (const a of dtos) {
      const cur = byCategoryMap.get(a.category) ?? { total: 0, count: 0 };
      cur.total += a.amount;
      cur.count += 1;
      byCategoryMap.set(a.category, cur);
    }
    const byCategory = [...byCategoryMap.entries()]
      .map(([category, v]) => ({
        category,
        label: CATEGORY_LABELS[category] ?? capitalize(category),
        total: round2(v.total),
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total);

    const payload = AdHocResponse.parse({
      buckets: { thisCycle, next30d, beyond60d },
      timeline: dtos,
      totals: {
        plannedTotal: round2(dtos.reduce((s, a) => s + a.amount, 0)),
        fundedTotal: round2(
          dtos.filter((a) => a.status === "funded" || a.status === "paid").reduce((s, a) => s + a.amount, 0),
        ),
        thisCycleTotal: round2(thisCycle.reduce((s, a) => s + a.amount, 0)),
        next30dTotal: round2(next30d.reduce((s, a) => s + a.amount, 0)),
      },
      byCategory,
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
