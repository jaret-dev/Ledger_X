import { z } from "zod";

// Fail fast if a required env var is missing or malformed. Each phase
// adds its own vars; keep this list aligned with BUILD_PLAN §11 and
// apps/api/.env.example.
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  DATABASE_URL: z.string().url(),
  LEDGER_AGENT_KEY: z.string().min(1).default("dev-agent-key"),
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
