import { Router } from "express";
import { Prisma, prisma } from "@ledger/db";
import {
  DebtCreateInput,
  DebtUpdateInput,
  DebtsResponse,
  DebtScenariosResponse,
  type Debt as DebtDto,
} from "@ledger/shared-types";
import { computeScenarios } from "../services/payoff.js";
import { fromIso, parseId } from "../services/ownership.js";

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

// ──────────── Mutations (Phase 3) ────────────

debtsRouter.post("/debts", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const input = DebtCreateInput.parse(req.body);
    const created = await prisma.debt.create({
      data: {
        householdId,
        name: input.name,
        type: input.type,
        balance: new Prisma.Decimal(input.balance),
        originalBalance:
          input.originalBalance != null ? new Prisma.Decimal(input.originalBalance) : null,
        creditLimit:
          input.creditLimit != null ? new Prisma.Decimal(input.creditLimit) : null,
        apr: new Prisma.Decimal(input.apr),
        minPayment: new Prisma.Decimal(input.minPayment),
        dueDayOfMonth: input.dueDayOfMonth ?? null,
        payoffDate: fromIso(input.payoffDate ?? null),
        accountId: input.accountId ?? null,
      },
    });
    res.status(201).json(toDto(created));
  } catch (err) {
    next(err);
  }
});

debtsRouter.patch("/debts/:id", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const id = parseId(req.params.id);
    const input = DebtUpdateInput.parse(req.body);

    const existing = await prisma.debt.findFirst({ where: { id, householdId } });
    if (!existing) {
      res.status(404).json({ error: "debt_not_found", id });
      return;
    }

    const data: Prisma.DebtUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if (input.balance !== undefined) data.balance = new Prisma.Decimal(input.balance);
    if (input.originalBalance !== undefined)
      data.originalBalance =
        input.originalBalance != null ? new Prisma.Decimal(input.originalBalance) : null;
    if (input.creditLimit !== undefined)
      data.creditLimit =
        input.creditLimit != null ? new Prisma.Decimal(input.creditLimit) : null;
    if (input.apr !== undefined) data.apr = new Prisma.Decimal(input.apr);
    if (input.minPayment !== undefined) data.minPayment = new Prisma.Decimal(input.minPayment);
    if (input.dueDayOfMonth !== undefined) data.dueDayOfMonth = input.dueDayOfMonth ?? null;
    if (input.payoffDate !== undefined) data.payoffDate = fromIso(input.payoffDate ?? null);
    if (input.accountId !== undefined) data.accountId = input.accountId ?? null;

    const updated = await prisma.debt.update({ where: { id }, data });
    res.json(toDto(updated));
  } catch (err) {
    next(err);
  }
});

debtsRouter.delete("/debts/:id", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const id = parseId(req.params.id);
    const existing = await prisma.debt.findFirst({ where: { id, householdId } });
    if (!existing) {
      res.status(404).json({ error: "debt_not_found", id });
      return;
    }
    // Soft-delete pattern: set isActive=false. Preserves audit trail and
    // keeps any historical Transaction.debtId references intact.
    await prisma.debt.update({ where: { id }, data: { isActive: false } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ──────────── Helpers ────────────

function toDto(d: {
  id: number;
  name: string;
  type: string;
  balance: Prisma.Decimal;
  originalBalance: Prisma.Decimal | null;
  creditLimit: Prisma.Decimal | null;
  apr: Prisma.Decimal;
  minPayment: Prisma.Decimal;
  dueDayOfMonth: number | null;
  payoffDate: Date | null;
}): DebtDto {
  const balance = Number(d.balance);
  const original = d.originalBalance ? Number(d.originalBalance) : null;
  const limit = d.creditLimit ? Number(d.creditLimit) : null;
  return {
    id: d.id,
    name: d.name,
    type: d.type as DebtDto["type"],
    balance: round2(balance),
    originalBalance: original != null ? round2(original) : null,
    creditLimit: limit != null ? round2(limit) : null,
    apr: round2(Number(d.apr)),
    minPayment: round2(Number(d.minPayment)),
    dueDayOfMonth: d.dueDayOfMonth,
    payoffDate: d.payoffDate ? toIsoDate(d.payoffDate) : null,
    paidDownPct:
      original && original > 0 ? round2(((original - balance) / original) * 100) : null,
    utilizationPct: limit && limit > 0 ? round2((balance / limit) * 100) : null,
  };
}

function sum(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
