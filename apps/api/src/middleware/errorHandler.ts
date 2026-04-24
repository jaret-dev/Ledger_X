import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

// Catch-all error middleware. Keeps responses consistently shaped
// and never leaks stack traces to clients.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "validation_error",
      issues: err.issues,
    });
    return;
  }

  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "internal_error" });
};
