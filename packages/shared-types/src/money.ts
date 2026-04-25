import { z } from "zod";

/**
 * Shared monetary / temporal primitives used across every response schema.
 * Keep these tight — adding to the public surface area means breaking changes
 * for both apps/api and apps/web in lockstep.
 */

// JSON numbers are fine for personal-finance amounts (~15 digits of precision
// is far beyond anything we'll ever store). Values are CAD with two-decimal
// resolution. The DB still uses Prisma.Decimal — apps/api converts at the
// boundary via Number(d).
export const Money = z.number();

// YYYY-MM-DD over the wire. Prisma's @db.Date columns serialize this way
// when we map them through .toISOString().slice(0,10).
export const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Full ISO datetime for audit timestamps.
export const Timestamp = z.string().datetime();
