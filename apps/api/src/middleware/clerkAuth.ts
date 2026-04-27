import type { RequestHandler } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { prisma } from "@ledger/db";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

/**
 * Clerk-based authentication for `/api/*` (read + mutation routes).
 * Replaces the Phase 1-4 stub that trusted `x-household-id`.
 *
 * Flow per request:
 *   1. Clerk's `clerkMiddleware()` (mounted globally in server.ts) verifies
 *      the bearer token and populates `req.auth` with `{ userId, sessionId, ... }`
 *      — or leaves it unset for unauthenticated requests.
 *   2. This middleware reads `req.auth.userId` and finds the matching `User`
 *      row by `clerkId`. If none exists yet (first sign-in), tries to
 *      auto-link by email — pulls the user's email from Clerk's API and
 *      looks up an existing `User` row with the same address. The seed
 *      pre-creates Jaret + Sarah by email, so first-time sign-in by either
 *      of them links cleanly.
 *   3. New users without a matching seed-row email go through the invite
 *      flow (Clerk invitation includes `publicMetadata: { householdId }`).
 *      Provisional auto-create uses that metadata; absent the metadata,
 *      the request is rejected (no orphan accounts). See §invite below.
 *   4. Looks up the linked `Household` and attaches both to `req` so
 *      handlers can read `req.user` and `req.household`.
 *
 * `/api/health` (no auth) and `/api/ingest/*` (agent-key auth) bypass
 * this entirely — they're mounted before/separate from the protected
 * `/api/*` sub-tree.
 *
 * In dev/test where `CLERK_SECRET_KEY` isn't set, this middleware
 * preserves the stub `x-household-id` header behavior so the Vitest
 * suite + local-dev workflows keep working without a Clerk account.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      household?: { id: number; name: string };
      user?: { id: number; clerkId: string | null; email: string; name: string; role: string };
    }
  }
}

export const clerkAuth: RequestHandler = async (req, res, next) => {
  // ─── Dev/test fallback: stub header still works when CLERK_SECRET_KEY ───
  // unset. Lets contributors hit the API without a Clerk account.
  if (!env.CLERK_SECRET_KEY) {
    return stubAuthByHouseholdHeader(req, res, next);
  }

  // ─── Clerk path ─────────────────────────────────────────────────────
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "unauthenticated", message: "Sign in required" });
    return;
  }

  try {
    // Look up our User row by Clerk ID.
    let user = await prisma.user.findUnique({ where: { clerkId: auth.userId } });

    if (!user) {
      // First sign-in for this Clerk user. Try to link by email — Clerk
      // is the source of the email; we ask it.
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      const primaryEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress;

      if (primaryEmail) {
        const byEmail = await prisma.user.findUnique({ where: { email: primaryEmail } });
        if (byEmail && !byEmail.clerkId) {
          // Existing seeded user — link in place.
          user = await prisma.user.update({
            where: { id: byEmail.id },
            data: { clerkId: auth.userId },
          });
          logger.info({ userId: user.id, email: primaryEmail }, "Linked Clerk to existing User");
        }
      }

      // Still no user row? Try the invite path: Clerk invitations carry
      // `publicMetadata.householdId` set when "Invite Sarah" was clicked.
      if (!user) {
        const householdId = (clerkUser.publicMetadata as { householdId?: number })?.householdId;
        const role = (clerkUser.publicMetadata as { role?: string })?.role ?? "member";
        if (householdId && primaryEmail) {
          const household = await prisma.household.findUnique({ where: { id: householdId } });
          if (household) {
            user = await prisma.user.create({
              data: {
                clerkId: auth.userId,
                email: primaryEmail,
                name: clerkUser.firstName ?? primaryEmail.split("@")[0]!,
                role,
                householdId,
              },
            });
            logger.info({ userId: user.id, householdId }, "Auto-created User via invite metadata");
          }
        }
      }

      // Out of options — Clerk knows them, we don't, no metadata to claim
      // them with. Reject explicitly so they don't see other households'
      // data.
      if (!user) {
        res.status(403).json({
          error: "user_not_provisioned",
          message:
            "Your account exists in Clerk but isn't linked to a Ledger household yet. Ask an admin for an invite.",
        });
        return;
      }
    }

    const household = await prisma.household.findUnique({
      where: { id: user.householdId },
      select: { id: true, name: true },
    });
    if (!household) {
      // Should be impossible given FK constraint, but defensive — User
      // row's householdId points nowhere, treat as broken provisioning.
      res.status(500).json({ error: "household_orphaned", userId: user.id });
      return;
    }

    req.user = {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    req.household = household;
    next();
  } catch (err) {
    logger.error({ err }, "clerkAuth middleware failure");
    next(err);
  }
};

/** Pre-Clerk fallback used in dev/test only. Reads `x-household-id` and
 *  attaches the household + a fake "user" pretending to be primary. */
async function stubAuthByHouseholdHeader(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  next: Parameters<RequestHandler>[2],
): Promise<void> {
  const raw = req.header("x-household-id");
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    res.status(401).json({
      error: "missing_household_id",
      message: "x-household-id header must be a positive integer (dev mode)",
    });
    return;
  }

  const household = await prisma.household.findUnique({
    where: { id: parsed },
    select: { id: true, name: true },
  });
  if (!household) {
    res.status(404).json({ error: "household_not_found", message: `No household with id ${parsed}` });
    return;
  }
  // Pick the household's primary user as the "current" user in dev.
  const user = await prisma.user.findFirst({
    where: { householdId: parsed, role: "primary" },
  });
  req.household = household;
  if (user) {
    req.user = {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
  next();
}
