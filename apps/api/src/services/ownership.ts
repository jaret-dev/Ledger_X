import { z } from "zod";

/**
 * Tiny helpers shared by every mutation route. Centralizing them keeps
 * each handler short and ensures the household-ownership check is
 * performed identically everywhere.
 */

const IdParam = z.coerce.number().int().positive();

/** Parse `:id` from `req.params`. Throws ZodError on bad input — the
 *  errorHandler middleware catches that and returns 400. */
export function parseId(value: unknown): number {
  return IdParam.parse(value);
}

/** Convert a Decimal | number | string | null to number (or null). */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Format a Date to YYYY-MM-DD using UTC. */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Date | null → YYYY-MM-DD | null */
export function toIsoDateOrNull(d: Date | null | undefined): string | null {
  return d ? toIsoDate(d) : null;
}

/** YYYY-MM-DD → Date at UTC midnight. Pass-through if already a Date. */
export function fromIso(iso: string | Date | null | undefined): Date | null {
  if (!iso) return null;
  if (iso instanceof Date) return iso;
  return new Date(`${iso}T00:00:00Z`);
}

/** Express HTTP status helpers — keep route handlers tidy. */
export function notFound(resource: string, id: number) {
  return { status: 404, body: { error: `${resource}_not_found`, id } } as const;
}
