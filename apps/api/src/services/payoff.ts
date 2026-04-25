import type { Debt as PrismaDebt } from "@ledger/db";
import type { PayoffScenario } from "@ledger/shared-types";

/**
 * Debt payoff scenario engine. Three strategies — minimums, avalanche
 * (highest APR first), snowball (smallest balance first) — each assuming
 * the same total monthly outlay (sum of all minimum payments). The
 * "extra" beyond the minimum on the focus debt is what differs.
 *
 * Math: standard amortization. Each month:
 *   interest = balance * (apr / 12 / 100)
 *   principal = payment - interest (clamped to remaining balance)
 *   balance -= principal
 * Capped at 600 months (50 years) to prevent runaway loops on bad input.
 */

const MAX_MONTHS = 600;

type DebtState = {
  id: number;
  name: string;
  balance: number;
  apr: number;
  minPayment: number;
  monthCleared: number | null;
};

function makeStates(debts: PrismaDebt[]): DebtState[] {
  return debts.map((d) => ({
    id: d.id,
    name: d.name,
    balance: Number(d.balance),
    apr: Number(d.apr),
    minPayment: Number(d.minPayment),
    monthCleared: null,
  }));
}

/**
 * Run a scenario where each month every debt receives its minimum
 * payment, plus `pickFocus` selects one active debt to receive the
 * leftover-from-cleared minimums on top.
 */
function runScenario(
  debts: PrismaDebt[],
  pickFocus: (active: DebtState[]) => DebtState | null,
): {
  monthsToPayoff: number;
  totalInterestPaid: number;
  monthlyOutlay: number;
  schedule: { debtId: number; debtName: string; monthCleared: number }[];
} {
  const states = makeStates(debts);
  const monthlyOutlay = states.reduce((sum, d) => sum + d.minPayment, 0);
  let totalInterest = 0;
  let month = 0;

  while (month < MAX_MONTHS) {
    const active = states.filter((s) => s.balance > 0);
    if (active.length === 0) break;
    month++;

    // Accrue interest on every active debt.
    for (const s of active) {
      const interest = s.balance * (s.apr / 100 / 12);
      s.balance += interest;
      totalInterest += interest;
    }

    // Allocate minimum payments. Anything from already-paid debts becomes
    // "freed" budget for the focus debt this month (snowball / avalanche).
    let freed = 0;
    for (const s of states) {
      if (s.balance <= 0 && !s.monthCleared) continue; // already done
      if (s.balance <= 0) continue;
      const pay = Math.min(s.minPayment, s.balance);
      s.balance -= pay;
      freed += s.minPayment - pay;
      if (s.balance <= 0.005) {
        s.balance = 0;
        s.monthCleared = month;
      }
    }
    // Add freed minimums from already-cleared debts.
    for (const s of states) {
      if (s.monthCleared && s.monthCleared < month) {
        freed += s.minPayment;
      }
    }

    // Apply the focus bonus.
    if (freed > 0) {
      const remainingActive = states.filter((s) => s.balance > 0);
      const focus = pickFocus(remainingActive);
      if (focus) {
        const extra = Math.min(freed, focus.balance);
        focus.balance -= extra;
        if (focus.balance <= 0.005) {
          focus.balance = 0;
          focus.monthCleared = month;
        }
      }
    }
  }

  // Anything still unpaid: mark as MAX so totals are bounded.
  for (const s of states) {
    if (!s.monthCleared && s.balance > 0) s.monthCleared = MAX_MONTHS;
  }

  return {
    monthsToPayoff: month,
    totalInterestPaid: round2(totalInterest),
    monthlyOutlay: round2(monthlyOutlay),
    schedule: states
      .map((s) => ({ debtId: s.id, debtName: s.name, monthCleared: s.monthCleared! }))
      .sort((a, b) => a.monthCleared - b.monthCleared),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeScenarios(debts: PrismaDebt[]): PayoffScenario[] {
  const minimums = runScenario(debts, () => null);
  const avalanche = runScenario(debts, (active) =>
    active.length === 0
      ? null
      : active.reduce((max, d) => (d.apr > max.apr ? d : max), active[0]!),
  );
  const snowball = runScenario(debts, (active) =>
    active.length === 0
      ? null
      : active.reduce((min, d) => (d.balance < min.balance ? d : min), active[0]!),
  );

  return [
    {
      name: "minimums",
      label: "Minimums only",
      monthsToPayoff: minimums.monthsToPayoff,
      yearsToPayoff: round2(minimums.monthsToPayoff / 12),
      totalInterestPaid: minimums.totalInterestPaid,
      monthlyOutlay: minimums.monthlyOutlay,
      schedule: minimums.schedule,
    },
    {
      name: "avalanche",
      label: "Avalanche · highest APR first",
      monthsToPayoff: avalanche.monthsToPayoff,
      yearsToPayoff: round2(avalanche.monthsToPayoff / 12),
      totalInterestPaid: avalanche.totalInterestPaid,
      monthlyOutlay: avalanche.monthlyOutlay,
      schedule: avalanche.schedule,
    },
    {
      name: "snowball",
      label: "Snowball · smallest balance first",
      monthsToPayoff: snowball.monthsToPayoff,
      yearsToPayoff: round2(snowball.monthsToPayoff / 12),
      totalInterestPaid: snowball.totalInterestPaid,
      monthlyOutlay: snowball.monthlyOutlay,
      schedule: snowball.schedule,
    },
  ];
}
