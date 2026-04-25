import { Router } from "express";
import { prisma } from "@ledger/db";
import { SidebarResponse } from "@ledger/shared-types";

export const sidebarRouter: Router = Router();

/**
 * Single endpoint feeding the sidebar's nav-chip counts. Cheap: 7
 * `count` queries in parallel + 2 latest snapshots for the trend.
 */
sidebarRouter.get("/sidebar", async (req, res, next) => {
  try {
    const householdId = req.household!.id;

    const [
      transactionsCount,
      debtsCount,
      billsCount,
      budgetsCount,
      incomeCount,
      adhocCount,
      latestSnapshots,
    ] = await Promise.all([
      prisma.transaction.count({ where: { householdId, isHidden: false } }),
      prisma.debt.count({ where: { householdId, isActive: true } }),
      prisma.recurringBill.count({ where: { householdId, isActive: true } }),
      prisma.budget.count({ where: { householdId, isActive: true } }),
      prisma.incomeSource.count({ where: { householdId, isActive: true } }),
      prisma.adHocExpense.count({
        where: { householdId, status: { not: "cancelled" } },
      }),
      prisma.netWorthSnapshot.findMany({
        where: { householdId },
        orderBy: { snapshotDate: "desc" },
        take: 2,
      }),
    ]);

    let netWorthTrend: "up" | "flat" | "down" = "flat";
    if (latestSnapshots.length === 2) {
      const latest = Number(latestSnapshots[0]!.netWorth);
      const prev = Number(latestSnapshots[1]!.netWorth);
      const delta = latest - prev;
      if (delta > 100) netWorthTrend = "up";
      else if (delta < -100) netWorthTrend = "down";
    }

    res.json(
      SidebarResponse.parse({
        transactionsCount,
        debtsCount,
        billsCount,
        budgetsCount,
        incomeCount,
        adhocCount,
        netWorthTrend,
      }),
    );
  } catch (err) {
    next(err);
  }
});
