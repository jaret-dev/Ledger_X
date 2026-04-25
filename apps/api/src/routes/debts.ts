import { Router } from "express";
import { prisma } from "@ledger/db";
import {
  DebtsResponse,
  DebtScenariosResponse,
  type Debt as DebtDto,
} from "@ledger/shared-types";
import { computeScenarios } from "../services/payoff.js";

export const debtsRouter: Router = Router();

debtsRouter.get("/debts", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const debts = await prisma.debt.findMany({
      where: { householdId, isActive: true },
      orderBy: [{ apr: "desc" }, { balance: "desc" }],
    });

    const dtos: DebtDto[] = debts.map((d) => {
      const balance = Number(d.balance);
      const original = d.originalBalance ? Number(d.originalBalance) : null;
      const limit = d.creditLimit ? Number(d.creditLimit) : null;
      return {
        id: d.id,
        name: d.name,
        type: d.type as DebtDto["type"],
        balance,
        originalBalance: original,
        creditLimit: limit,
        apr: Number(d.apr),
        minPayment: Number(d.minPayment),
        dueDayOfMonth: d.dueDayOfMonth,
        payoffDate: d.payoffDate ? toIsoDate(d.payoffDate) : null,
        paidDownPct: original && original > 0 ? round2(((original - balance) / original) * 100) : null,
        utilizationPct: limit && limit > 0 ? round2((balance / limit) * 100) : null,
      };
    });

    const totalBalance = sum(dtos.map((d) => d.balance));
    const totalLimit = sum(dtos.map((d) => d.creditLimit ?? 0));
    const totalRevolvingBalance = sum(
      dtos.filter((d) => d.creditLimit != null).map((d) => d.balance),
    );
    const totalRevolvingLimit = sum(
      dtos.filter((d) => d.creditLimit != null).map((d) => d.creditLimit ?? 0),
    );
    const minPaymentMonthly = sum(dtos.map((d) => d.minPayment));
    const weightedApr = totalBalance
      ? round2(sum(dtos.map((d) => d.balance * d.apr)) / totalBalance)
      : 0;

    const payload = DebtsResponse.parse({
      debts: dtos,
      totals: {
        balance: round2(totalBalance),
        creditLimit: round2(totalLimit),
        minPaymentMonthly: round2(minPaymentMonthly),
        weightedApr,
        revolvingUtilizationPct: totalRevolvingLimit
          ? round2((totalRevolvingBalance / totalRevolvingLimit) * 100)
          : 0,
      },
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

debtsRouter.get("/debts/scenarios", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const debts = await prisma.debt.findMany({
      where: { householdId, isActive: true },
    });

    const scenarios = computeScenarios(debts);
    const minimums = scenarios.find((s) => s.name === "minimums")!;
    const best = scenarios.reduce((b, s) =>
      s.totalInterestPaid < b.totalInterestPaid ? s : b,
    );

    const payload = DebtScenariosResponse.parse({
      scenarios,
      recommendation: {
        scenario: best.name,
        interestSavedVsMinimums: round2(minimums.totalInterestPaid - best.totalInterestPaid),
        monthsSavedVsMinimums: minimums.monthsToPayoff - best.monthsToPayoff,
      },
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
