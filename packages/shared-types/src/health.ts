import { z } from "zod";

export const HealthResponse = z.object({
  status: z.literal("ok"),
  db: z.enum(["connected", "disconnected"]),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponse>;
