import express, { type Express, Router } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env, isOriginAllowed } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { householdAuth } from "./middleware/householdAuth.js";
import { healthRouter } from "./routes/health.js";
import { householdRouter } from "./routes/household.js";
import { sidebarRouter } from "./routes/sidebar.js";
import { overviewRouter } from "./routes/overview.js";
import { transactionsRouter } from "./routes/transactions.js";
import { debtsRouter } from "./routes/debts.js";
import { billsRouter } from "./routes/bills.js";
import { budgetsRouter } from "./routes/budgets.js";
import { incomeRouter } from "./routes/income.js";
import { adhocRouter } from "./routes/adhoc.js";
import { networthRouter } from "./routes/networth.js";
import { cashflowRouter } from "./routes/cashflow.js";
import { accountsRouter } from "./routes/accounts.js";

// Factory so tests can instantiate without binding a port.
export function createServer(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(
    cors({
      // Function form so we can match wildcard / regex entries from
      // CORS_ORIGIN (parsed in env.ts) — Vercel preview URLs change per PR.
      // Same-origin requests have no Origin header — accept those too.
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (isOriginAllowed(origin, env.CORS_ORIGIN)) return callback(null, true);
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  // Health is unauthenticated (Railway healthcheck has no header).
  app.use("/api", healthRouter);

  // All read endpoints sit behind the stub householdAuth middleware until
  // Phase 5 wires Clerk. Order doesn't matter beyond that — each router's
  // paths are unique.
  const apiRouter = Router();
  apiRouter.use(householdAuth);
  apiRouter.use("/", householdRouter);
  apiRouter.use("/", sidebarRouter);
  apiRouter.use("/", overviewRouter);
  apiRouter.use("/", transactionsRouter);
  apiRouter.use("/", debtsRouter);
  apiRouter.use("/", billsRouter);
  apiRouter.use("/", budgetsRouter);
  apiRouter.use("/", incomeRouter);
  apiRouter.use("/", adhocRouter);
  apiRouter.use("/", networthRouter);
  apiRouter.use("/", cashflowRouter);
  apiRouter.use("/", accountsRouter);
  app.use("/api", apiRouter);

  app.use(errorHandler);

  return app;
}
