import { Router } from "express";
import { Prisma, prisma } from "@ledger/db";
import {
  BillsResponse,
  RecurringBillCreateInput,
  RecurringBillUpdateInput,
  type RecurringBill as BillDto,
} from "@ledger/shared-types";
import { billMonthlyAmount } from "../services/cycle.js";
import { addDays, daysBetween } from "../services/dates.js";
import { fromIso, parseId } from "../services/ownership.js";

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

// ──────────── Mutations ────────────

billsRouter.post("/bills", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const input = RecurringBillCreateInput.parse(req.body);
    const created = await prisma.recurringBill.create({
      data: {
        householdId,
        name: input.name,
        category: input.category,
        amount: new Prisma.Decimal(input.amount),
        amountVariable: input.amountVariable,
        frequency: input.frequency,
        dueDayOfMonth: input.dueDayOfMonth ?? null,
        nextDueDate: fromIso(input.nextDueDate)!,
        autopay: input.autopay,
        paymentAccountId: input.paymentAccountId ?? null,
        paymentMethod: input.paymentMethod ?? null,
      },
    });
    res.status(201).json(toBillDto(created));
  } catch (err) {
    next(err);
  }
});

billsRouter.patch("/bills/:id", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const id = parseId(req.params.id);
    const input = RecurringBillUpdateInput.parse(req.body);

    const existing = await prisma.recurringBill.findFirst({ where: { id, householdId } });
    if (!existing) {
      res.status(404).json({ error: "bill_not_found", id });
      return;
    }

    const data: Prisma.RecurringBillUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.category !== undefined) data.category = input.category;
    if (input.amount !== undefined) data.amount = new Prisma.Decimal(input.amount);
    if (input.amountVariable !== undefined) data.amountVariable = input.amountVariable;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.dueDayOfMonth !== undefined) data.dueDayOfMonth = input.dueDayOfMonth ?? null;
    if (input.nextDueDate !== undefined) data.nextDueDate = fromIso(input.nextDueDate)!;
    if (input.autopay !== undefined) data.autopay = input.autopay;
    if (input.paymentAccountId !== undefined)
      data.paymentAccountId = input.paymentAccountId ?? null;
    if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod ?? null;

    const updated = await prisma.recurringBill.update({ where: { id }, data });
    res.json(toBillDto(updated));
  } catch (err) {
    next(err);
  }
});

billsRouter.delete("/bills/:id", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const id = parseId(req.params.id);
    const existing = await prisma.recurringBill.findFirst({ where: { id, householdId } });
    if (!existing) {
      res.status(404).json({ error: "bill_not_found", id });
      return;
    }
    await prisma.recurringBill.update({ where: { id }, data: { isActive: false } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ──────────── Helpers ────────────

function toBillDto(b: {
  id: number;
  name: string;
  category: string;
  amount: Prisma.Decimal;
  amountVariable: boolean;
  frequency: string;
  dueDayOfMonth: number | null;
  nextDueDate: Date;
  autopay: boolean;
  paymentAccountId: number | null;
  paymentMethod: string | null;
}): BillDto {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    amount: round2(Number(b.amount)),
    amountVariable: b.amountVariable,
    frequency: b.frequency as BillDto["frequency"],
    dueDayOfMonth: b.dueDayOfMonth,
    nextDueDate: toIsoDate(b.nextDueDate),
    autopay: b.autopay,
    paymentAccountId: b.paymentAccountId,
    paymentMethod: b.paymentMethod,
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
