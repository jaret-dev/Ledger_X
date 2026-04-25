import { useQuery } from "@tanstack/react-query";
import {
  HealthResponse,
  HouseholdResponse,
  SidebarResponse,
  OverviewResponse,
  TransactionsResponse,
  TransactionsSummaryResponse,
  DebtsResponse,
  DebtScenariosResponse,
  BillsResponse,
  BudgetsResponse,
  IncomeResponse,
  AdHocResponse,
  NetWorthResponse,
  NetWorthAllocationResponse,
  NetWorthMilestonesResponse,
  CashFlowResponse,
} from "@ledger/shared-types";
import { apiFetch } from "./client";

/**
 * One React Query hook per endpoint. Each runs the response through the
 * shared Zod schema so a contract drift between web and api fails loud,
 * at the page render, with a clear error — not silently as `undefined`.
 */

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => HealthResponse.parse(await apiFetch("/api/health")),
  });
}

export function useHousehold() {
  return useQuery({
    queryKey: ["household"],
    queryFn: async () => HouseholdResponse.parse(await apiFetch("/api/household")),
  });
}

export function useSidebar() {
  return useQuery({
    queryKey: ["sidebar"],
    queryFn: async () => SidebarResponse.parse(await apiFetch("/api/sidebar")),
  });
}

export function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: async () => OverviewResponse.parse(await apiFetch("/api/overview")),
  });
}

export function useTransactions(filters?: {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
  accountId?: number;
  startDate?: string;
  endDate?: string;
}) {
  const qs = filters ? new URLSearchParams(toRecord(filters)).toString() : "";
  return useQuery({
    queryKey: ["transactions", filters ?? {}],
    queryFn: async () =>
      TransactionsResponse.parse(await apiFetch(`/api/transactions${qs ? `?${qs}` : ""}`)),
  });
}

export function useTransactionsSummary(days = 30) {
  return useQuery({
    queryKey: ["transactions-summary", days],
    queryFn: async () =>
      TransactionsSummaryResponse.parse(
        await apiFetch(`/api/transactions/summary?days=${days}`),
      ),
  });
}

export function useDebts() {
  return useQuery({
    queryKey: ["debts"],
    queryFn: async () => DebtsResponse.parse(await apiFetch("/api/debts")),
  });
}

export function useDebtScenarios() {
  return useQuery({
    queryKey: ["debts-scenarios"],
    queryFn: async () =>
      DebtScenariosResponse.parse(await apiFetch("/api/debts/scenarios")),
  });
}

export function useBills() {
  return useQuery({
    queryKey: ["bills"],
    queryFn: async () => BillsResponse.parse(await apiFetch("/api/bills")),
  });
}

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async () => BudgetsResponse.parse(await apiFetch("/api/budgets")),
  });
}

export function useIncome() {
  return useQuery({
    queryKey: ["income"],
    queryFn: async () => IncomeResponse.parse(await apiFetch("/api/income")),
  });
}

export function useAdhoc() {
  return useQuery({
    queryKey: ["adhoc"],
    queryFn: async () => AdHocResponse.parse(await apiFetch("/api/adhoc")),
  });
}

export function useNetWorth() {
  return useQuery({
    queryKey: ["networth"],
    queryFn: async () => NetWorthResponse.parse(await apiFetch("/api/networth")),
  });
}

export function useNetWorthAllocation() {
  return useQuery({
    queryKey: ["networth-allocation"],
    queryFn: async () =>
      NetWorthAllocationResponse.parse(await apiFetch("/api/networth/allocation")),
  });
}

export function useNetWorthMilestones() {
  return useQuery({
    queryKey: ["networth-milestones"],
    queryFn: async () =>
      NetWorthMilestonesResponse.parse(await apiFetch("/api/networth/milestones")),
  });
}

export function useCashFlow(days = 90) {
  return useQuery({
    queryKey: ["cashflow", days],
    queryFn: async () =>
      CashFlowResponse.parse(await apiFetch(`/api/cashflow?days=${days}`)),
  });
}

function toRecord(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = String(v);
  }
  return out;
}
