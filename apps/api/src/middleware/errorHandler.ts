import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger.js";

/**
 * Catch-all error middleware. Keeps responses consistently shaped and
 * never leaks stack traces to clients. The log line includes the
 * actual error message + stack so Railway log viewers (which often
 * collapse pino's nested objects) surface the cause, not just the
 * generic "unhandled error" string.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "validation_error",
      issues: err.issues,
    });
    return;
  }

  // Pull message + stack out of err so Railway's log viewer (which
  // sometimes truncates the nested `err` object in pino's serialized
  // output) shows them in the top-level message line.
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(
    {
      err,
      errMessage: message,
      errName: err instanceof Error ? err.name : undefined,
      stack,
      method: req.method,
      url: req.originalUrl,
    },
    `unhandled error: ${message}`,
  );
  res.status(500).json({ error: "internal_error" });
};
