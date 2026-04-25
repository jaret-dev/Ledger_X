import { z } from "zod";

/**
 * Lightweight payload for the sidebar nav chips. One small endpoint so
 * Sidebar doesn't have to subscribe to every page's React Query hook
 * just to display counts.
 *
 * `netWorthTrend` powers the unicode arrow shown next to "Net Worth"
 * in the mockup ("↗" for up, "→" for flat, "↘" for down).
 */
export const SidebarResponse = z.object({
  transactionsCount: z.number().int().nonnegative(),
  debtsCount: z.number().int().nonnegative(),
  billsCount: z.number().int().nonnegative(),
  budgetsCount: z.number().int().nonnegative(),
  incomeCount: z.number().int().nonnegative(),
  adhocCount: z.number().int().nonnegative(),
  netWorthTrend: z.enum(["up", "flat", "down"]),
});

export type SidebarResponse = z.infer<typeof SidebarResponse>;
