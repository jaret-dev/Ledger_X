import { z } from "zod";

export const Household = z.object({
  id: z.number().int().positive(),
  name: z.string(),
});

export const User = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
});

export const HouseholdResponse = z.object({
  household: Household,
  users: z.array(User),
});

export type Household = z.infer<typeof Household>;
export type User = z.infer<typeof User>;
export type HouseholdResponse = z.infer<typeof HouseholdResponse>;
