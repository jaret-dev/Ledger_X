import { z } from "zod";
import { Money, Timestamp } from "./money.js";

export const Account = z.object({
  id: z.number().int().positive(),
  nickname: z.string(),
  institution: z.string(),
  mask: z.string().nullable(),
  type: z.enum(["depository", "credit", "loan", "investment"]),
  subtype: z.string().nullable(),
  currentBalance: Money.nullable(),
  availableBalance: Money.nullable(),
  creditLimit: Money.nullable(),
  currency: z.string(),
  isManual: z.boolean(),
  lastSyncedAt: Timestamp.nullable(),
});

export type Account = z.infer<typeof Account>;
