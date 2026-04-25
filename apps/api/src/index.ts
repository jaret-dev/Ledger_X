import { createServer } from "./server.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";

const app = createServer();

// Bind explicitly to 0.0.0.0 so Railway's healthcheck reaches us — Node's
// default host varies by platform and can default to IPv6-only on some
// Docker base images, which Railway's internal HTTP healthcheck won't hit.
const HOST = "0.0.0.0";

const server = app.listen(env.PORT, HOST, () => {
  logger.info(
    { port: env.PORT, host: HOST, corsOrigins: env.CORS_ORIGIN, nodeEnv: env.NODE_ENV },
    "@ledger/api listening",
  );
});

// Graceful shutdown so Railway's rolling deploys don't drop in-flight requests.
const shutdown = (signal: NodeJS.Signals) => {
  logger.info({ signal }, "shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
