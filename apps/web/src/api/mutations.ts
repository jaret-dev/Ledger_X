import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  AccountCreateInput,
  AccountUpdateInput,
  DebtCreateInput,
  DebtUpdateInput,
  RecurringBillCreateInput,
  RecurringBillUpdateInput,
  BudgetCreateInput,
  BudgetUpdateInput,
  IncomeSourceCreateInput,
  IncomeSourceUpdateInput,
  AdHocCreateInput,
  AdHocUpdateInput,
  TransactionUpdateInput,
  TransactionAssignInput,
} from "@ledger/shared-types";
import { apiDelete, apiPatch, apiPost, ApiError } from "./client";
import { useToasts } from "../components/Toaster";

/**
 * One useCreate / useUpdate / useDelete hook per resource. Each:
 *   - calls the corresponding endpoint
 *   - invalidates related React Query caches on success (so every page
 *     showing affected data refetches)
 *   - shows a success / error toast
 *   - returns the mutation handle so the calling component can know
 *     `isPending` and call `mutate({...})` directly
 *
 * The keys we invalidate intentionally over-invalidate — small payloads,
 * cheap refetches, simpler than threading exact dependency graphs.
 */

// Cache keys touched by every resource. The composite endpoints
// (overview, networth, cashflow, sidebar) re-derive from the same
// underlying tables so they all need a refresh on any mutation.
const COMPOSITE_KEYS = ["overview", "networth", "cashflow", "sidebar"];

function useInvalidate(extraKeys: string[]) {
  const qc = useQueryClient();
  return () => {
    for (const k of [...extraKeys, ...COMPOSITE_KEYS]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.body && typeof err.body === "object" && "issues" in err.body) {
      // Zod validation errors — surface the first issue's path + message
      const issues = (err.body as { issues?: { path?: (string | number)[]; message?: string }[] })
        .issues;
      if (issues && issues[0]) {
        const path = issues[0].path?.join(".") ?? "input";
        return `${path}: ${issues[0].message ?? "invalid"}`;
      }
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Unknown error";
}

// ─── Debts ────────────────────────────────────────────────────────────

export function useCreateDebt() {
  const invalidate = useInvalidate(["debts", "debts-scenarios"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (input: DebtCreateInput) => apiPost("/api/debts", input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Debt added" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useUpdateDebt() {
  const invalidate = useInvalidate(["debts", "debts-scenarios"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: DebtUpdateInput }) =>
      apiPatch(`/api/debts/${id}`, input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Debt updated" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useDeleteDebt() {
  const invalidate = useInvalidate(["debts", "debts-scenarios"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/debts/${id}`),
    onSuccess: (_, id) => {
      invalidate();
      push({
        kind: "undo",
        message: "Debt deleted",
        action: {
          label: "Undo",
          onClick: () => apiPatch(`/api/debts/${id}`, { isActive: true } as never).then(invalidate),
        },
      });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

// ─── Bills ────────────────────────────────────────────────────────────

export function useCreateBill() {
  const invalidate = useInvalidate(["bills"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (input: RecurringBillCreateInput) => apiPost("/api/bills", input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Bill added" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useUpdateBill() {
  const invalidate = useInvalidate(["bills"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RecurringBillUpdateInput }) =>
      apiPatch(`/api/bills/${id}`, input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Bill updated" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useDeleteBill() {
  const invalidate = useInvalidate(["bills"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/bills/${id}`),
    onSuccess: (_, id) => {
      invalidate();
      push({
        kind: "undo",
        message: "Bill deleted",
        action: {
          label: "Undo",
          onClick: () => apiPatch(`/api/bills/${id}`, { isActive: true } as never).then(invalidate),
        },
      });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

// ─── Budgets ──────────────────────────────────────────────────────────

export function useCreateBudget() {
  const invalidate = useInvalidate(["budgets"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (input: BudgetCreateInput) => apiPost("/api/budgets", input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Budget envelope created" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useUpdateBudget() {
  const invalidate = useInvalidate(["budgets"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: BudgetUpdateInput }) =>
      apiPatch(`/api/budgets/${id}`, input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Budget updated" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useDeleteBudget() {
  const invalidate = useInvalidate(["budgets"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/budgets/${id}`),
    onSuccess: (_, id) => {
      invalidate();
      push({
        kind: "undo",
        message: "Budget deleted",
        action: {
          label: "Undo",
          onClick: () => apiPatch(`/api/budgets/${id}`, { isActive: true } as never).then(invalidate),
        },
      });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

// ─── Income ───────────────────────────────────────────────────────────

export function useCreateIncome() {
  const invalidate = useInvalidate(["income"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (input: IncomeSourceCreateInput) => apiPost("/api/income", input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Income source added" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useUpdateIncome() {
  const invalidate = useInvalidate(["income"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: IncomeSourceUpdateInput }) =>
      apiPatch(`/api/income/${id}`, input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Income source updated" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useDeleteIncome() {
  const invalidate = useInvalidate(["income"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/income/${id}`),
    onSuccess: (_, id) => {
      invalidate();
      push({
        kind: "undo",
        message: "Income source deleted",
        action: {
          label: "Undo",
          onClick: () => apiPatch(`/api/income/${id}`, { isActive: true } as never).then(invalidate),
        },
      });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

// ─── Ad-hoc ───────────────────────────────────────────────────────────

export function useCreateAdHoc() {
  const invalidate = useInvalidate(["adhoc"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (input: AdHocCreateInput) => apiPost("/api/adhoc", input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Ad-hoc expense added" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useUpdateAdHoc() {
  const invalidate = useInvalidate(["adhoc"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AdHocUpdateInput }) =>
      apiPatch(`/api/adhoc/${id}`, input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Ad-hoc updated" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useDeleteAdHoc() {
  const invalidate = useInvalidate(["adhoc"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/adhoc/${id}`),
    onSuccess: (_, id) => {
      invalidate();
      push({
        kind: "undo",
        message: "Ad-hoc deleted",
        action: {
          label: "Undo",
          onClick: () => apiPatch(`/api/adhoc/${id}`, { status: "planned" } as never).then(invalidate),
        },
      });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

// ─── Accounts (manual only) ──────────────────────────────────────────

export function useCreateManualAccount() {
  const invalidate = useInvalidate(["networth", "accounts"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (input: AccountCreateInput) => apiPost("/api/accounts/manual", input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Account added" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidate(["networth", "accounts"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AccountUpdateInput }) =>
      apiPatch(`/api/accounts/${id}`, input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Account updated" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useDeleteAccount() {
  const invalidate = useInvalidate(["networth", "accounts"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/accounts/${id}`),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Account removed" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

// ─── Transactions ────────────────────────────────────────────────────

export function useUpdateTransaction() {
  const invalidate = useInvalidate(["transactions", "transactions-summary"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TransactionUpdateInput }) =>
      apiPatch(`/api/transactions/${id}`, input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Transaction updated" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}

export function useAssignTransaction() {
  const invalidate = useInvalidate(["transactions", "transactions-summary", "budgets"]);
  const { push } = useToasts();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: TransactionAssignInput }) =>
      apiPost(`/api/transactions/${id}/assign`, input),
    onSuccess: () => {
      invalidate();
      push({ kind: "success", message: "Transaction reassigned" });
    },
    onError: (err) => push({ kind: "error", message: errorMessage(err) }),
  });
}
