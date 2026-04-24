import { Router } from "express";
import { HealthResponse } from "@ledger/shared-types";
import { prisma } from "@ledger/db";

export const healthRouter: Router = Router();

// GET /api/health
// Done-when criterion from BUILD_PLAN §3: returns { status, db, timestamp }.
// `db` flips to "disconnected" if Postgres is unreachable so Railway's
// healthcheck can surface a failing DB independently of the API process.
healthRouter.get("/health", async (_req, res, next) => {
  try {
    let db: "connected" | "disconnected" = "disconnected";
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "connected";
    } catch {
      db = "disconnected";
    }

    const payload = HealthResponse.parse({
      status: "ok",
      db,
      timestamp: new Date().toISOString(),
    });

    res.json(payload);
  } catch (err) {
    next(err);
  }
});
