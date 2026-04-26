import express, { type Express, Router, type RequestHandler } from "express";
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

/**
 * Reject disallowed CORS origins with a clear 403 BEFORE the cors()
 * middleware ever runs. Two reasons:
 *   1. Previous behaviour passed an Error to cors's callback, which
 *      cascaded through the errorHandler and returned a misleading
 *      `{"error":"internal_error"}` 500. Now the user (or future me
 *      reading the log) immediately sees `origin_not_allowed`.
 *   2. cors() then handles only allowed origins, which simplifies its
 *      job — pass the parsed allowlist directly as a (string|RegExp)[].
 *
 * Same-origin and curl-style requests have no Origin header — those
 * pass straight through.
 */
const enforceCorsOrigin: RequestHandler = (req, res, next) => {
  const origin = req.header("origin");
  if (!origin) return next();
  if (isOriginAllowed(origin, env.CORS_ORIGIN)) return next();
  logger.warn({ origin, allowlist: env.CORS_ORIGIN }, "CORS rejection");
  res.status(403).json({
    error: "origin_not_allowed",
    origin,
    hint: "Add this origin (or a wildcard like https://your-domain-*.vercel.app) to the API's CORS_ORIGIN env var.",
  });
};

// Factory so tests can instantiate without binding a port.
export function createServer(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(enforceCorsOrigin);
  app.use(
    cors({
      // env.CORS_ORIGIN is already parsed into (string | RegExp)[]; cors
      // accepts that shape natively. enforceCorsOrigin above has already
      // rejected anything that won't match here.
      origin: env.CORS_ORIGIN,
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
