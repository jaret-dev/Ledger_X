import express, { type Express, Router } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { householdAuth } from "./middleware/householdAuth.js";
import { healthRouter } from "./routes/health.js";
import { householdRouter } from "./routes/household.js";

// Factory so tests can instantiate without binding a port.
export function createServer(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  // Health is unauthenticated (Railway healthcheck has no header).
  app.use("/api", healthRouter);

  // Everything else requires the x-household-id header (stub) until Phase 5.
  // Mount auth-gated routes on a sub-router so /api/health stays open.
  const apiRouter = Router();
  apiRouter.use(householdAuth);
  apiRouter.use("/", householdRouter);
  // Phase 2b mounts the read-only endpoints (overview, cashflow, debts, etc.)
  // here in the order they're built.
  app.use("/api", apiRouter);

  app.use(errorHandler);

  return app;
}
