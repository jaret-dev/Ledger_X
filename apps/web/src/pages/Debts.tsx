import { useState } from "react";
import { TopBar } from "../components/TopBar";
import { PageState, Panel, ProgressBar, StatCard, StatGrid, MoneyAmount } from "../components/ui";
import { useDebts, useDebtScenarios } from "../api/queries";
import { useDeleteDebt } from "../api/mutations";
import { Modal } from "../components/Modal";
import { DebtForm } from "../components/forms";
import { RowActions } from "../components/RowActions";
import { formatCurrency } from "../lib/format";
import type { Debt, PayoffScenario } from "@ledger/shared-types";

export function Debts() {
  const debts = useDebts();
  const scenarios = useDebtScenarios();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const del = useDeleteDebt();
  return (
    <>
      <TopBar title="Debts" subtitle="payoff in motion" />
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="border border-ink bg-ink px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-card hover:border-accent-2 hover:bg-accent-2"
        >
          + Add debt
        </button>
      </div>
      <PageState query={debts}>
        {(data) => (
          <>
            <StatGrid>
              <StatCard
                label="Total balance"
                value={formatCurrency(data.totals.balance, { compact: true })}
                tone="debt"
              />
              <StatCard
                label="Weighted APR"
                value={`${data.totals.weightedApr.toFixed(2)}%`}
                tone={data.totals.weightedApr >= 15 ? "warn" : "default"}
              />
              <StatCard
                label="Monthly minimums"
                value={formatCurrency(data.totals.minPaymentMonthly)}
              />
              <StatCard
                label="Revolving utilization"
                value={`${data.totals.revolvingUtilizationPct.toFixed(0)}%`}
                tone={data.totals.revolvingUtilizationPct >= 80 ? "warn" : "default"}
              />
            </StatGrid>

            <div className="grid grid-cols-2 gap-4 mb-7 mobile:grid-cols-1">
              {data.debts.map((d) => (
                <DebtCard
                  key={d.id}
                  debt={d}
                  onEdit={() => setEditing(d)}
                  onDelete={() => del.mutate(d.id)}
                  deleting={del.isPending}
                />
              ))}
            </div>

            <PageState query={scenarios}>
              {(s) => (
                <Panel
                  title="Payoff scenarios"
                  subtitle={`recommendation: ${s.recommendation.scenario}`}
                >
                  <div className="grid grid-cols-3 gap-px bg-line mobile:grid-cols-1">
                    {s.scenarios.map((sc) => (
                      <ScenarioCard
                        key={sc.name}
                        scenario={sc}
                        recommended={sc.name === s.recommendation.scenario}
                      />
                    ))}
                  </div>
                  <div className="bg-bg-2 px-5 py-3 text-[12px] text-ink-2">
                    {s.recommendation.scenario === "minimums" ? (
                      <>Already on minimums — there's no faster path without extra payments.</>
                    ) : (
                      <>
                        Avalanche saves <MoneyAmount value={s.recommendation.interestSavedVsMinimums} className="text-ink" /> in interest and{" "}
                        <span className="text-ink">{s.recommendation.monthsSavedVsMinimums} months</span> versus minimums only.
                      </>
                    )}
                  </div>
                </Panel>
              )}
            </PageState>
          </>
        )}
      </PageState>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add debt">
        <DebtForm onClose={() => setAddOpen(false)} />
      </Modal>
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit · ${editing?.name ?? ""}`}
      >
        {editing && <DebtForm initial={editing} onClose={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function DebtCard({
  debt,
  onEdit,
  onDelete,
  deleting,
}: {
  debt: Debt;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <article className="flex flex-col gap-3 border border-line bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-[20px]">{debt.name}</h4>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-3">
            {debt.type.replace(/_/g, " ")}
            {debt.dueDayOfMonth ? ` · due day ${debt.dueDayOfMonth}` : ""}
          </div>
        </div>
        <MoneyAmount value={debt.balance} className="text-[16px]" />
      </div>

      {debt.paidDownPct != null && (
        <div className="space-y-1">
          <ProgressBar pct={debt.paidDownPct} status="good" />
          <div className="flex justify-between font-mono text-[10px] text-ink-3">
            <span>{debt.paidDownPct.toFixed(0)}% paid</span>
            <span>{formatCurrency(debt.originalBalance ?? 0, { compact: true })} original</span>
          </div>
        </div>
      )}
      {debt.utilizationPct != null && (
        <div className="space-y-1">
          <ProgressBar
            pct={debt.utilizationPct}
            status={debt.utilizationPct >= 80 ? "over" : debt.utilizationPct >= 50 ? "warn" : "good"}
          />
          <div className="flex justify-between font-mono text-[10px] text-ink-3">
            <span>{debt.utilizationPct.toFixed(0)}% used</span>
            <span>{formatCurrency(debt.creditLimit ?? 0, { compact: true })} limit</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div>
          <div className="label">APR</div>
          <div
            className={`font-mono text-[14px] font-semibold ${debt.apr >= 20 ? "text-danger" : "text-ink"}`}
          >
            {debt.apr.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="label">Min payment</div>
          <MoneyAmount value={debt.minPayment} className="text-[14px]" />
        </div>
      </div>

      <div className="flex justify-end border-t border-line pt-3">
        <RowActions onEdit={onEdit} onDelete={onDelete} pending={deleting} />
      </div>
    </article>
  );
}

function ScenarioCard({
  scenario,
  recommended,
}: {
  scenario: PayoffScenario;
  recommended?: boolean;
}) {
  return (
    <article className={`bg-card p-5 ${recommended ? "ring-1 ring-accent-2" : ""}`}>
      <div className="label mb-1">{scenario.label}</div>
      <div className="font-serif text-[28px] font-light leading-none">
        {scenario.yearsToPayoff.toFixed(1)} <span className="text-[14px] text-ink-3">yrs</span>
      </div>
      <div className="mt-2 space-y-1 font-mono text-[11px] text-ink-2">
        <div className="flex justify-between">
          <span>Interest paid</span>
          <MoneyAmount value={scenario.totalInterestPaid} />
        </div>
        <div className="flex justify-between">
          <span>Monthly outlay</span>
          <MoneyAmount value={scenario.monthlyOutlay} />
        </div>
        <div className="flex justify-between">
          <span>Months to clear</span>
          <span className="amount">{scenario.monthsToPayoff}</span>
        </div>
      </div>
    </article>
  );
}
