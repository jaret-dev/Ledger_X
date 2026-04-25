import type { RequestHandler } from "express";
import { z } from "zod";
import { prisma } from "@ledger/db";

/**
 * Stub authentication for Phase 1-4. The frontend sends `x-household-id`
 * on every request; this middleware validates it's a positive integer
 * pointing at an existing Household and attaches the row to `req`.
 *
 * Phase 5 replaces this with Clerk JWT verification — the route handlers
 * keep reading `req.household`, only this file changes.
 *
 * `/api/health` deliberately bypasses this middleware (mounted before it
 * in server.ts) so Railway's healthcheck doesn't need an auth header.
 *
 * `/api/ingest/*` (Phase 4 OpenClaw agent endpoints) will use a separate
 * `x-agent-key` header, not this household check.
 */

const HouseholdIdSchema = z.coerce.number().int().positive();

// Augment Express's Request so route handlers can read `req.household`
// after the middleware runs.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      household?: { id: number; name: string };
    }
  }
}

export const householdAuth: RequestHandler = async (req, res, next) => {
  const headerValue = req.header("x-household-id");
  const parsed = HouseholdIdSchema.safeParse(headerValue);

  if (!parsed.success) {
    res.status(401).json({
      error: "missing_household_id",
      message: "x-household-id header must be a positive integer",
    });
    return;
  }

  const household = await prisma.household.findUnique({
    where: { id: parsed.data },
    select: { id: true, name: true },
  });

  if (!household) {
    res.status(404).json({
      error: "household_not_found",
      message: `No household with id ${parsed.data}`,
    });
    return;
  }

  req.household = household;
  next();
};
