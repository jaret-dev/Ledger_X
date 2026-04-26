import type { RequestHandler } from "express";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

/**
 * Agent-key authentication for /api/ingest/* endpoints. The OpenClaw
 * Ledger agent (running on Jaret's laptop) sends LEDGER_AGENT_KEY as
 * the `x-agent-key` header. The server compares to its own copy of the
 * env var with a constant-time check.
 *
 * Distinct from `householdAuth` (used by the human-facing API) so:
 *   - rotating the agent key never logs out users
 *   - rotating the user JWT signing key (Phase 5) never breaks the agent
 *   - frontend code can never accidentally leak this key into a browser
 */
export const agentAuth: RequestHandler = (req, res, next) => {
  const provided = req.header("x-agent-key");
  if (!provided) {
    res.status(401).json({ error: "missing_agent_key" });
    return;
  }
  if (!constantTimeEquals(provided, env.LEDGER_AGENT_KEY)) {
    logger.warn({ ip: req.ip }, "Invalid agent key attempt");
    res.status(403).json({ error: "invalid_agent_key" });
    return;
  }
  next();
};

/** Compare two strings without leaking length-of-match via timing. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
