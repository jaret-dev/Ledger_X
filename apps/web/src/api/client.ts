/**
 * fetch wrappers used by every React Query hook (queries + mutations).
 *
 * Phase 5+: every request carries a Clerk-issued bearer token. The token
 * is fetched fresh on each call via `getSessionToken()` (set during app
 * boot by `<ClerkTokenBridge>` in App-side code). Clerk's client SDK
 * returns short-lived JWTs from a session cookie — we don't store them.
 *
 * In dev/test where Clerk isn't configured, the bridge function returns
 * null and we fall back to the legacy `x-household-id` header. The
 * backend's clerkAuth middleware mirrors this fallback symmetrically.
 */

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

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

// ─── Token bridge ─────────────────────────────────────────────────
// React's hooks live in components, but our fetch helpers don't. We
// connect them with a setter the App-level provider calls on mount.

type TokenGetter = () => Promise<string | null>;
let getSessionToken: TokenGetter = async () => null;

export function setSessionTokenGetter(getter: TokenGetter): void {
  getSessionToken = getter;
}

// ─── Internal fetch helper ────────────────────────────────────────

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = await getSessionToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    // Dev/test fallback to the Phase 1-4 stub. The backend's clerkAuth
    // middleware accepts this when CLERK_SECRET_KEY isn't set.
    headers["x-household-id"] = "1";
  }
  return headers;
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
  const headers = await buildHeaders();
  const res = await fetch(`${API_URL}${path}`, { headers });
  return handle<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers = await buildHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const headers = await buildHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const headers = await buildHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers,
  });
  return handle<T>(res);
}
