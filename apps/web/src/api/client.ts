// Tiny fetch wrapper. Phase 2 will expand this with x-household-id header
// and typed response parsing. Keeping it minimal for Phase 1.

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
