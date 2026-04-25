import { createServer } from "./server.js";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";

const app = createServer();

const server = app.listen(env.PORT, () => {
  logger.info(`@ledger/api listening on http://localhost:${env.PORT}`);
});

// Graceful shutdown so Railway's rolling deploys don't drop in-flight requests.
const shutdown = (signal: NodeJS.Signals) => {
  logger.info({ signal }, "shutting down");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
