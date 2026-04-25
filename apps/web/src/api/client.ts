/**
 * Minimal fetch wrapper used by every React Query hook in src/api/queries.ts.
 *
 * Always sends `x-household-id: 1` until Phase 5 wires Clerk auth — this
 * matches the API's stub middleware. The backend ignores any value the
 * frontend sends except for development; in production it derives the
 * household from the authenticated user.
 */

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const STUB_HOUSEHOLD_ID = "1"; // Phase 1-4 only — Clerk replaces this in Phase 5.

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-household-id": STUB_HOUSEHOLD_ID,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
