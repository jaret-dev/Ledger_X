import { TopBar } from "../components/TopBar";
import {
  PageState,
  Panel,
  ProgressBar,
  StatCard,
  StatGrid,
  MoneyAmount,
} from "../components/ui";
import { useOverview } from "../api/queries";
import { formatCurrency, formatDate, formatRelativeDate } from "../lib/format";
import type {
  PaycheckBlock as PaycheckBlockType,
  OverviewDebtRow,
  OverviewBudgetRow,
  OverviewAdhocCard,
} from "@ledger/shared-types";

export function Overview() {
  const query = useOverview();
  return (
    <>
      <TopBar title="Overview" subtitle="your week at a glance" />
      <PageState query={query}>
        {(data) => (
          <>
            <StatGrid>
              <StatCard label="Cash on hand" value={formatCurrency(data.stats.cashOnHand, { compact: true })} />
              <StatCard
                label="Inflow / month"
                value={formatCurrency(data.stats.monthlyInflow, { compact: true })}
                tone="success"
              />
              <StatCard
                label="Outflow / month"
                value={formatCurrency(data.stats.monthlyOutflow, { compact: true })}
              />
              <StatCard
                label="Net worth"
                value={formatCurrency(data.stats.netWorth, { compact: true })}
              />
            </StatGrid>

            <Panel title="Cash flow by paycheck" subtitle={`next ${data.paychecks.length}`} className="mb-7">
              <div className="divide-y divide-line">
                {data.paychecks.length === 0 && (
                  <div className="px-5 py-6 text-[13px] text-ink-3">
                    No upcoming paychecks scheduled.
                  </div>
                )}
                {data.paychecks.map((p, i) => (
                  <PaycheckBlock key={`${p.date}-${i}`} block={p} />
                ))}
              </div>
            </Panel>

            <div className="grid grid-cols-2 gap-6 mb-7 mobile:grid-cols-1">
              <Panel
                title="Debts"
                subtitle={`${formatCurrency(data.debts.totalBalance, { compact: true })} · ${formatCurrency(data.debts.monthlyMinimums)}/mo min`}
              >
                <ul className="divide-y divide-line">
                  {data.debts.rows.map((d) => (
                    <DebtRow key={d.id} debt={d} />
                  ))}
                </ul>
              </Panel>

              <Panel title="Budgets" subtitle={`cycle ends ${formatDate(data.budgets.cycleEnd)}`}>
                <ul className="divide-y divide-line">
                  {data.budgets.rows.map((b) => (
                    <BudgetRow key={b.id} budget={b} />
                  ))}
                </ul>
              </Panel>
            </div>

            {data.upcomingAdhoc.length > 0 && (
              <section>
                <h2 className="mb-3">Upcoming ad-hoc</h2>
                <div className="grid grid-cols-3 gap-4 mobile:grid-cols-1">
                  {data.upcomingAdhoc.map((a) => (
                    <AdHocMiniCard key={a.id} item={a} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </PageState>
    </>
  );
}

function PaycheckBlock({ block }: { block: PaycheckBlockType }) {
  return (
    <article className="grid grid-cols-[140px_1fr_160px] gap-5 px-5 py-5 mobile:grid-cols-1 mobile:gap-3">
      <div>
        <div className="font-serif text-[28px] font-light leading-none">
          {new Date(`${block.date}T00:00:00Z`).getUTCDate()}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
          {new Date(`${block.date}T00:00:00Z`).toLocaleDateString("en-CA", { month: "short", timeZone: "UTC" })}
          {" · "}
          {block.userName}
        </div>
        <div className="mt-1 font-mono text-[12px] text-accent">
          +{formatCurrency(block.amount, { compact: true })}
        </div>
      </div>
      <div className="space-y-1">
        {block.charges.length === 0 && (
          <div className="text-[12px] italic text-ink-3">No charges assigned.</div>
        )}
        {block.charges.map((c, i) => (
          <div
            key={`${c.kind}-${c.label}-${i}`}
            className="flex items-center justify-between gap-3 text-[12px]"
          >
            <span>
              <span
                className={`mr-2 inline-block h-2 w-1 align-middle ${
                  c.kind === "bill"
                    ? "bg-accent-3"
                    : c.kind === "debt"
                      ? "bg-accent-2"
                      : c.kind === "adhoc"
                        ? "bg-accent"
                        : "bg-accent-4"
                }`}
              />
              {c.label}
              {c.sublabel && (
                <span className="ml-2 font-mono text-[10px] text-ink-3">{c.sublabel}</span>
              )}
            </span>
            <MoneyAmount value={c.amount} className="text-[12px]" />
          </div>
        ))}
      </div>
      <div className="border-l border-line pl-5 mobile:border-l-0 mobile:border-t mobile:pl-0 mobile:pt-3">
        <div className="label">Charges</div>
        <MoneyAmount value={block.chargesTotal} className="text-[14px]" />
        <div className="label mt-2">Leftover</div>
        <div
          className={`font-serif text-[24px] font-light ${block.leftover < 0 ? "text-danger" : "text-success"}`}
        >
          {formatCurrency(block.leftover, { compact: true })}
        </div>
      </div>
    </article>
  );
}

function DebtRow({ debt }: { debt: OverviewDebtRow }) {
  return (
    <li className="grid grid-cols-[1fr_60px_80px_auto] items-center gap-3 px-5 py-3">
      <div>
        <div className="text-[13px]">{debt.name}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
          min {formatCurrency(debt.minPayment)}
        </div>
      </div>
      <span
        className={`text-right font-mono text-[12px] ${debt.isHighApr ? "font-semibold text-danger" : "text-ink-2"}`}
      >
        {debt.apr.toFixed(2)}%
      </span>
      <span className="hidden md:inline text-right text-[10px] text-ink-3 mobile:hidden">
        {/* spacer */}
      </span>
      <MoneyAmount value={debt.balance} className="text-[13px] text-accent-2" />
    </li>
  );
}

function BudgetRow({ budget }: { budget: OverviewBudgetRow }) {
  return (
    <li className="px-5 py-3">
      <div className="flex items-baseline justify-between text-[13px]">
        <span>{budget.name}</span>
        <span className="amount">
          {formatCurrency(budget.spent, { compact: true })}{" "}
          <span className="text-ink-3">/ {formatCurrency(budget.allocated, { compact: true })}</span>
        </span>
      </div>
      <div className="mt-1.5">
        <ProgressBar pct={budget.pctUsed} status={budget.status} />
      </div>
    </li>
  );
}

function AdHocMiniCard({ item }: { item: OverviewAdhocCard }) {
  const tone =
    item.daysUntilDue < 7 ? "text-danger" : item.daysUntilDue < 30 ? "text-accent" : "text-ink-3";
  return (
    <article className="flex flex-col gap-1.5 border border-line bg-card p-4">
      <div className={`font-mono text-[10px] uppercase tracking-widest ${tone}`}>
        {formatRelativeDate(item.dueDate)}
      </div>
      <div className="text-[15px] font-medium">{item.name}</div>
      <div className="font-mono text-[10px] text-ink-3">{item.category}</div>
      <div className="mt-1 flex items-center justify-between">
        <MoneyAmount value={item.amount} className="text-[14px]" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
          {item.status}
        </span>
      </div>
    </article>
  );
}
