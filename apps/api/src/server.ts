import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";

// Factory so tests can instantiate without binding a port.
export function createServer(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", healthRouter);

  app.use(errorHandler);

  return app;
}
