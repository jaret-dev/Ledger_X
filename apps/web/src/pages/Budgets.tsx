import { TopBar } from "../components/TopBar";
import { PageState, ProgressBar, StatCard, StatGrid, MoneyAmount } from "../components/ui";
import { useBudgets } from "../api/queries";
import { formatCurrency, formatDate } from "../lib/format";
import type { BudgetWithProgress } from "@ledger/shared-types";

export function Budgets() {
  const query = useBudgets();
  return (
    <>
      <TopBar title="Budgets" subtitle="this paycheck" />
      <PageState query={query}>
        {(data) => (
          <>
            <StatGrid>
              <StatCard label="Allocated" value={formatCurrency(data.totals.allocated)} />
              <StatCard label="Spent" value={formatCurrency(data.totals.spent)} />
              <StatCard
                label="Remaining"
                value={formatCurrency(data.totals.remaining)}
                tone={data.totals.remaining < 0 ? "warn" : "success"}
              />
              <StatCard
                label="Days left"
                value={String(Math.max(0, data.cycle.daysTotal - data.cycle.daysIn))}
              />
            </StatGrid>

            <div className="mb-6 border border-line bg-card px-5 py-4">
              <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-ink-3">
                <span>Cycle · {data.cycle.type}</span>
                <span>
                  {formatDate(data.cycle.start)} → {formatDate(data.cycle.end)}
                </span>
              </div>
              <div className="mt-2">
                <ProgressBar pct={data.cycle.pctElapsed} status="good" />
              </div>
              <div className="mt-1 font-mono text-[10px] text-ink-3">
                {data.cycle.pctElapsed.toFixed(0)}% elapsed
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mobile:grid-cols-1">
              {data.budgets.map((b) => (
                <BudgetCard key={b.id} budget={b} pace={data.cycle.pctElapsed} />
              ))}
            </div>
          </>
        )}
      </PageState>
    </>
  );
}

function BudgetCard({ budget, pace }: { budget: BudgetWithProgress; pace: number }) {
  return (
    <article className="flex flex-col gap-3 border border-line bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-[20px]">{budget.name}</h4>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-3">
            {budget.category}
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif text-[24px] font-light leading-none">
            {formatCurrency(budget.spentThisCycle, { compact: true })}
          </div>
          <div className="font-mono text-[10px] text-ink-3">
            of {formatCurrency(budget.amount, { compact: true })}
          </div>
        </div>
      </div>

      <ProgressBar pct={budget.pctUsed} marker={pace} status={budget.status} />

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="label">Used</div>
          <div className="amount text-ink">{budget.pctUsed.toFixed(0)}%</div>
        </div>
        <div>
          <div className="label">Remaining</div>
          <MoneyAmount
            value={budget.remainingThisCycle}
            className={budget.remainingThisCycle < 0 ? "text-danger" : "text-ink"}
          />
        </div>
        <div>
          <div className="label">Pace</div>
          <div className="amount text-ink">{pace.toFixed(0)}%</div>
        </div>
      </div>

      {budget.recentTransactions.length > 0 && (
        <div className="border-t border-line pt-2">
          <div className="label mb-1">Recent</div>
          <ul className="space-y-1">
            {budget.recentTransactions.slice(0, 3).map((t) => (
              <li
                key={t.id}
                className="grid grid-cols-[1fr_auto] gap-2 text-[12px] text-ink-2"
              >
                <span className="truncate">
                  {formatDate(t.date)} · {t.merchantName ?? "—"}
                </span>
                <MoneyAmount value={t.amount} className="text-ink" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
