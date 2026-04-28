import express, { type Express, Router, type RequestHandler } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { env, isOriginAllowed } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { clerkAuth } from "./middleware/clerkAuth.js";
import { agentAuth } from "./middleware/agentAuth.js";
import { healthRouter } from "./routes/health.js";
import { ingestRouter } from "./routes/ingest.js";
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
  // Mounted before any auth middleware so it never goes through Clerk
  // or any token-extraction layer that could throw.
  app.use("/api", healthRouter);

  // /api/ingest/* — agent-key auth. Mounted as a separate sub-tree so the
  // OpenClaw Ledger agent never needs (and can never accidentally use)
  // the user-facing Clerk JWT. Distinct from clerkAuth so rotating
  // either secret never breaks the other.
  const ingestRoot = Router();
  ingestRoot.use(agentAuth);
  ingestRoot.use("/", ingestRouter);
  app.use("/api/ingest", ingestRoot);

  // All read + mutation endpoints sit behind clerkAuth, which verifies
  // the Clerk JWT and attaches req.user + req.household. In dev/test
  // (no CLERK_SECRET_KEY), it transparently falls back to the legacy
  // x-household-id header so the test suite + local-dev workflows keep
  // working. Order doesn't matter beyond that — each router's paths
  // are unique.
  //
  // clerkMiddleware is scoped to THIS sub-tree only (not global) — that
  // way `/api/health` and `/api/ingest/*` never touch any Clerk code
  // path. A misconfigured Clerk secret previously took down the
  // healthcheck along with the rest of the API; this isolates the
  // failure mode.
  const apiRouter = Router();
  if (env.CLERK_SECRET_KEY && env.CLERK_PUBLISHABLE_KEY) {
    // Both keys are required: secretKey for backend calls, publishableKey
    // for JWT verification (encodes the Clerk instance's frontend domain).
    apiRouter.use(
      clerkMiddleware({
        secretKey: env.CLERK_SECRET_KEY,
        publishableKey: env.CLERK_PUBLISHABLE_KEY,
      }),
    );
  } else if (env.CLERK_SECRET_KEY || env.CLERK_PUBLISHABLE_KEY) {
    // Half-configured Clerk is a configuration bug — better to fail loud
    // at boot than silently serve every request with an "unhandled error"
    // 500 from the verification path.
    throw new Error(
      "Clerk requires BOTH CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY env vars. " +
        "Set both, or unset both to use the dev/test stub fallback.",
    );
  }
  apiRouter.use(clerkAuth);
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
