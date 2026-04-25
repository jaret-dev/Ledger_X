/**
 * Tiny fetch wrappers used by every React Query hook (queries + mutations).
 *
 * Always sends `x-household-id: 1` until Phase 5 wires Clerk auth — this
 * matches the API's stub middleware. Production CORS is enforced at the
 * server.
 */

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

const STUB_HOUSEHOLD_ID = "1"; // Phase 1-4 only — Clerk replaces in Phase 5

const baseHeaders = {
  "Content-Type": "application/json",
  "x-household-id": STUB_HOUSEHOLD_ID,
};

/** ApiError is thrown by every helper below so toast handling can pull
 *  out a clean message + the parsed error body for richer UX. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const message =
      (parsed && typeof parsed === "object" && parsed && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `HTTP ${res.status}`) ?? `HTTP ${res.status}`;
    throw new ApiError(message, res.status, parsed);
  }
  return parsed as T;
}

export async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: baseHeaders });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: baseHeaders,
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: baseHeaders,
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: baseHeaders,
  });
  return handle<T>(res);
}
