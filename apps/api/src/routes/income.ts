import { Router } from "express";
import { Prisma, prisma } from "@ledger/db";
import {
  IncomeResponse,
  IncomeSourceCreateInput,
  IncomeSourceUpdateInput,
  type IncomeSource,
  type UpcomingDeposit,
  type MonthlyProjection,
} from "@ledger/shared-types";
import { incomeMonthlyAmount, projectPaydates } from "../services/cycle.js";
import { addDays, addMonths, startOfMonth, toIso } from "../services/dates.js";
import { fromIso, parseId } from "../services/ownership.js";

export const incomeRouter: Router = Router();

incomeRouter.get("/income", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const today = new Date();

    const sources = await prisma.incomeSource.findMany({
      where: { householdId, isActive: true },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });

    const sourceDtos: IncomeSource[] = sources.map((s) => ({
      id: s.id,
      userId: s.userId,
      userName: s.user.name,
      name: s.name,
      type: s.type as IncomeSource["type"],
      amount: round2(Number(s.amount)),
      amountVariable: s.amountVariable,
      frequency: s.frequency as IncomeSource["frequency"],
      payDayOfWeek: s.payDayOfWeek,
      nextPayDate: s.nextPayDate ? toIso(s.nextPayDate) : null,
      isPrimary: s.isPrimary,
      upcomingPaydates: projectPaydates(s, today, 4).map(toIso),
    }));

    // Upcoming 30d deposits — flatten projected paydates for every source
    // that has a schedule we can project.
    const horizon = addDays(today, 30);
    const upcoming30d: UpcomingDeposit[] = [];
    for (const s of sources) {
      const projected = projectPaydates(s, today, 8);
      for (const date of projected) {
        if (date > horizon) break;
        upcoming30d.push({
          date: toIso(date),
          sourceId: s.id,
          sourceName: s.name,
          userName: s.user.name,
          amount: round2(Number(s.amount)),
          amountVariable: s.amountVariable,
        });
      }
    }
    upcoming30d.sort((a, b) => a.date.localeCompare(b.date));

    // 6-month projection — sum each source's expected monthly amount,
    // bucket by user (Jaret / Sarah).
    const projection6mo: MonthlyProjection[] = [];
    for (let i = 0; i < 6; i++) {
      const month = startOfMonth(addMonths(today, i));
      let jaret = 0;
      let sarah = 0;
      for (const s of sources) {
        const monthly = incomeMonthlyAmount(s);
        if (s.user.name === "Jaret") jaret += monthly;
        else if (s.user.name === "Sarah") sarah += monthly;
      }
      projection6mo.push({
        month: toIso(month),
        label: month.toLocaleDateString("en-CA", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }),
        jaret: round2(jaret),
        sarah: round2(sarah),
        total: round2(jaret + sarah),
      });
    }

    const monthlyCombined = round2(
      sources.reduce((sum, s) => sum + incomeMonthlyAmount(s), 0),
    );
    const biweeklyCombined = round2(
      sources
        .filter((s) => s.frequency === "biweekly")
        .reduce((sum, s) => sum + Number(s.amount), 0),
    );

    const perPersonMap = new Map<number, { userId: number; userName: string; total: number }>();
    for (const s of sources) {
      const cur = perPersonMap.get(s.userId) ?? {
        userId: s.userId,
        userName: s.user.name,
        total: 0,
      };
      cur.total += incomeMonthlyAmount(s);
      perPersonMap.set(s.userId, cur);
    }

    // YTD: months elapsed this year × monthlyCombined (best effort given
    // we don't have actual deposit history wired up yet — Phase 4 fills
    // that in via the agent).
    const monthsElapsed = today.getUTCMonth() + 1; // 1-based
    const ytdCombined = round2(monthlyCombined * monthsElapsed);

    const payload = IncomeResponse.parse({
      sources: sourceDtos,
      upcoming30d,
      projection6mo,
      totals: {
        biweeklyCombined,
        monthlyCombined,
        ytdCombined,
        perPerson: [...perPersonMap.values()].map((p) => ({
          userId: p.userId,
          userName: p.userName,
          monthlyTotal: round2(p.total),
        })),
      },
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// ──────────── Mutations ────────────

incomeRouter.post("/income", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const input = IncomeSourceCreateInput.parse(req.body);

    // Verify the user belongs to this household before linking
    const user = await prisma.user.findFirst({
      where: { id: input.userId, householdId },
    });
    if (!user) {
      res.status(400).json({ error: "user_not_in_household", userId: input.userId });
      return;
    }

    const created = await prisma.incomeSource.create({
      data: {
        householdId,
        userId: input.userId,
        name: input.name,
        type: input.type,
        amount: new Prisma.Decimal(input.amount),
        amountVariable: input.amountVariable,
        frequency: input.frequency,
        payDayOfWeek: input.payDayOfWeek ?? null,
        nextPayDate: fromIso(input.nextPayDate ?? null),
        depositAccountId: input.depositAccountId ?? null,
        isPrimary: input.isPrimary,
      },
    });
    res.status(201).json({ id: created.id });
  } catch (err) {
    next(err);
  }
});

incomeRouter.patch("/income/:id", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const id = parseId(req.params.id);
    const input = IncomeSourceUpdateInput.parse(req.body);

    const existing = await prisma.incomeSource.findFirst({ where: { id, householdId } });
    if (!existing) {
      res.status(404).json({ error: "income_not_found", id });
      return;
    }

    const data: Prisma.IncomeSourceUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if (input.amount !== undefined) data.amount = new Prisma.Decimal(input.amount);
    if (input.amountVariable !== undefined) data.amountVariable = input.amountVariable;
    if (input.frequency !== undefined) data.frequency = input.frequency;
    if (input.payDayOfWeek !== undefined) data.payDayOfWeek = input.payDayOfWeek ?? null;
    if (input.nextPayDate !== undefined) data.nextPayDate = fromIso(input.nextPayDate ?? null);
    if (input.depositAccountId !== undefined)
      data.depositAccountId = input.depositAccountId ?? null;
    if (input.isPrimary !== undefined) data.isPrimary = input.isPrimary;

    const updated = await prisma.incomeSource.update({ where: { id }, data });
    res.json({ id: updated.id });
  } catch (err) {
    next(err);
  }
});

incomeRouter.delete("/income/:id", async (req, res, next) => {
  try {
    const householdId = req.household!.id;
    const id = parseId(req.params.id);
    const existing = await prisma.incomeSource.findFirst({ where: { id, householdId } });
    if (!existing) {
      res.status(404).json({ error: "income_not_found", id });
      return;
    }
    await prisma.incomeSource.update({ where: { id }, data: { isActive: false } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
