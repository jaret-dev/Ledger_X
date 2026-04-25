import { Router } from "express";
import { prisma } from "@ledger/db";

export const householdRouter: Router = Router();

/**
 * GET /api/household — basic household + users payload. First endpoint
 * gated by householdAuth, so it doubles as the smoke test for the auth
 * middleware. Phase 2b adds proper Zod-validated response shapes via
 * @ledger/shared-types.
 */
householdRouter.get("/household", async (req, res, next) => {
  try {
    const household = req.household!; // householdAuth guarantees this is set
    const users = await prisma.user.findMany({
      where: { householdId: household.id },
      orderBy: { id: "asc" },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ household, users });
  } catch (err) {
    next(err);
  }
});
