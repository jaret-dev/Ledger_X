import { z } from "zod";

/**
 * Parse one CORS allowlist entry. Supports three forms so a single env
 * var can cover production + every Vercel preview without redeploys:
 *   - exact string:        https://ledger-x-web.vercel.app
 *   - wildcard:            https://ledger-x-web-*.vercel.app
 *   - explicit regex:      /^https:\/\/ledger.*$/
 */
export type OriginMatcher = string | RegExp;

function parseOrigin(raw: string): OriginMatcher {
  const trimmed = raw.trim();
  if (trimmed.startsWith("/") && trimmed.endsWith("/") && trimmed.length > 2) {
    return new RegExp(trimmed.slice(1, -1));
  }
  if (trimmed.includes("*")) {
    // Escape regex metacharacters EXCEPT *, then turn * into .*
    const escaped = trimmed
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`);
  }
  return trimmed;
}

// Fail fast if a required env var is missing or malformed. Each phase
// adds its own vars; keep this list aligned with BUILD_PLAN §11 and
// apps/api/.env.example.
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((s) =>
      s
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
        .map(parseOrigin),
    ),
  DATABASE_URL: z.string().url(),
  LEDGER_AGENT_KEY: z.string().min(1).default("dev-agent-key"),
  // Phase 5+: BOTH keys required in production for Clerk JWT verification.
  // - secretKey: lets the backend call Clerk's API (e.g. users.getUser)
  // - publishableKey: encodes the Clerk instance's frontend domain that
  //   issues the tokens; backend uses it to know what to verify against
  // Both optional in dev/test so contributors can run the test suite
  // without a Clerk account; clerkAuth's stub fallback covers that case.
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);

/** Returns true if `origin` matches any allowlist entry. */
export function isOriginAllowed(origin: string, allowlist: OriginMatcher[]): boolean {
  return allowlist.some((m) => (typeof m === "string" ? m === origin : m.test(origin)));
}
