import { Router } from "express";
import { prisma } from "@ledger/db";
import {
  NetWorthResponse,
  NetWorthAllocationResponse,
  NetWorthMilestonesResponse,
  type NetWorthSnapshot as SnapshotDto,
  type AssetBreakdown,
  type LiabilityBreakdown,
  type Milestone,
} from "@ledger/shared-types";
import { toIso } from "../services/dates.js";

export const networthRouter: Router = Router();

const ALLOCATION_LABELS: Record<string, string> = {
  cash_and_savings: "Cash & savings",
  investments_tfsa_rrsp: "Investments (TFSA / RRSP)",
  crypto: "Crypto",
};

networthRouter.get("/networth", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const [snapshots, accounts, debts] = await Promise.all([
      prisma.netWorthSnapshot.findMany({
        where: { householdId },
        orderBy: { snapshotDate: "asc" },
      }),
      prisma.account.findMany({
        where: { householdId, isActive: true, type: { in: ["depository", "investment"] } },
        orderBy: [{ type: "asc" }, { currentBalance: "desc" }],
      }),
      prisma.debt.findMany({
        where: { householdId, isActive: true },
        orderBy: { balance: "desc" },
      }),
    ]);

    if (snapshots.length === 0) {
      res.status(404).json({ error: "no_snapshots", message: "No net worth snapshots yet" });
      return;
    }

    const history = snapshots.map(toSnapshotDto);
    const current = history[history.length - 1]!;

    const assets: AssetBreakdown[] = accounts.map((a) => ({
      accountId: a.id,
      nickname: a.nickname,
      institution: a.institution,
      subtype: a.subtype,
      balance: round2(Number(a.currentBalance ?? 0)),
    }));

    const liabilities: LiabilityBreakdown[] = debts.map((d) => ({
      debtId: d.id,
      name: d.name,
      type: d.type,
      balance: round2(Number(d.balance)),
    }));

    res.json(NetWorthResponse.parse({ current, history, assets, liabilities }));
  } catch (err) {
    next(err);
  }
});

networthRouter.get("/networth/allocation", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const snapshot = await prisma.netWorthSnapshot.findFirst({
      where: { householdId },
      orderBy: { snapshotDate: "desc" },
    });
    if (!snapshot) {
      res.status(404).json({ error: "no_snapshots" });
      return;
    }

    const breakdown = snapshot.breakdown as Record<string, number>;
    const total = Number(snapshot.totalAssets);
    const slices = Object.entries(breakdown).map(([bucket, amount]) => ({
      bucket,
      label: ALLOCATION_LABELS[bucket] ?? bucket.replace(/_/g, " "),
      amount: round2(Number(amount)),
      pct: total > 0 ? round2((Number(amount) / total) * 100) : 0,
    }));

    res.json(NetWorthAllocationResponse.parse({ total: round2(total), slices }));
  } catch (err) {
    next(err);
  }
});

/**
 * Milestones — currently hardcoded targets (mockup-spec'd values). Will
 * become user-editable in a later phase. For each, compute "current"
 * dynamically from latest snapshot + accounts + debts.
 */
networthRouter.get("/networth/milestones", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const [snapshot, accounts, debts] = await Promise.all([
      prisma.netWorthSnapshot.findFirst({
        where: { householdId },
        orderBy: { snapshotDate: "desc" },
      }),
      prisma.account.findMany({
        where: { householdId, isActive: true, type: "depository" },
      }),
      prisma.debt.findMany({
        where: {
          householdId,
          isActive: true,
          type: { in: ["credit_card", "line_of_credit"] },
        },
      }),
    ]);

    if (!snapshot) {
      res.status(404).json({ error: "no_snapshots" });
      return;
    }

    const cashAndSavings = accounts.reduce(
      (s, a) => s + Number(a.currentBalance ?? 0),
      0,
    );
    const highInterestDebt = debts.reduce((s, d) => s + Number(d.balance), 0);
    const netWorth = Number(snapshot.netWorth);

    const milestones: Milestone[] = [
      {
        key: "emergency_fund",
        label: "6-month emergency fund",
        current: round2(cashAndSavings),
        target: 18000,
        pctComplete: round2(Math.min(100, (cashAndSavings / 18000) * 100)),
        etaLabel: "Jan 2027",
        remaining: round2(Math.max(0, 18000 - cashAndSavings)),
      },
      {
        key: "debt_free_high_interest",
        label: "Debt-free (high-interest)",
        // Progress = paid-off so far / starting balance. We don't have a
        // historical baseline, so use max(current, mockup-spec) as the
        // anchor — guarantees pctComplete stays in [0, 100].
        current: round2(Math.max(0, Math.max(highInterestDebt, 30000) - highInterestDebt)),
        target: round2(Math.max(highInterestDebt, 30000)),
        pctComplete: round2(
          Math.max(
            0,
            Math.min(
              100,
              ((Math.max(highInterestDebt, 30000) - highInterestDebt) /
                Math.max(highInterestDebt, 30000)) *
                100,
            ),
          ),
        ),
        etaLabel: "Sep 2027",
        remaining: round2(highInterestDebt),
      },
      {
        key: "net_worth_100k",
        label: "Net worth → $100K",
        current: round2(Math.max(0, netWorth)),
        target: 100000,
        pctComplete: round2(Math.min(100, Math.max(0, netWorth / 100000) * 100)),
        etaLabel: "Q2 2028",
        remaining: round2(Math.max(0, 100000 - netWorth)),
      },
      {
        key: "house_down_payment",
        label: "House down payment (20%)",
        current: round2(Math.min(60000, cashAndSavings * 0.5)),
        target: 60000,
        pctComplete: round2(Math.min(100, (cashAndSavings * 0.5 / 60000) * 100)),
        etaLabel: "2029+",
        remaining: round2(Math.max(0, 60000 - cashAndSavings * 0.5)),
      },
    ];

    res.json(NetWorthMilestonesResponse.parse({ milestones }));
  } catch (err) {
    next(err);
  }
});

function toSnapshotDto(s: {
  snapshotDate: Date;
  totalAssets: unknown;
  totalLiabilities: unknown;
  netWorth: unknown;
  breakdown: unknown;
}): SnapshotDto {
  return {
    date: toIso(s.snapshotDate),
    totalAssets: round2(Number(s.totalAssets)),
    totalLiabilities: round2(Number(s.totalLiabilities)),
    netWorth: round2(Number(s.netWorth)),
    breakdown: Object.fromEntries(
      Object.entries(s.breakdown as Record<string, number>).map(([k, v]) => [
        k,
        round2(Number(v)),
      ]),
    ),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
