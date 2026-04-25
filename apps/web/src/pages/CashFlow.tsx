import { TopBar } from "../components/TopBar";
import { PageState, Panel, StatCard, StatGrid, MoneyAmount } from "../components/ui";
import { useCashFlow } from "../api/queries";
import { formatCurrency, formatDate } from "../lib/format";
import type { CashFlowDay, CashFlowEvent } from "@ledger/shared-types";

export function CashFlow() {
  const query = useCashFlow(90);
  return (
    <>
      <TopBar title="Cash Flow" subtitle="next 90 days" />
      <PageState query={query}>
        {(data) => (
          <>
            <StatGrid>
              <StatCard label="Inflow (90d)" value={formatCurrency(data.totals.inflow, { compact: true })} tone="success" />
              <StatCard label="Outflow (90d)" value={formatCurrency(data.totals.outflow, { compact: true })} />
              <StatCard
                label="Projected ending"
                value={formatCurrency(data.totals.endingBalance, { compact: true })}
                tone={data.totals.endingBalance >= data.startingBalance ? "success" : "warn"}
              />
              <StatCard
                label="Min balance"
                value={formatCurrency(data.totals.minBalance, { compact: true })}
                delta={{ text: formatDate(data.totals.minBalanceDate), tone: "neutral" }}
                tone={data.totals.minBalance < 1000 ? "warn" : "default"}
              />
            </StatGrid>

            <Panel title="Projection" subtitle={`from ${formatCurrency(data.startingBalance, { compact: true })}`} className="mb-7">
              <ProjectionChart daily={data.daily} />
            </Panel>

            <Panel title="Upcoming events" subtitle={`${data.events.length} in 90d`}>
              <ul className="divide-y divide-line">
                {data.events.slice(0, 40).map((e, i) => (
                  <EventRow key={`${e.date}-${e.kind}-${i}`} event={e} />
                ))}
                {data.events.length > 40 && (
                  <li className="bg-bg-2 px-5 py-2 text-center font-mono text-[10px] text-ink-3">
                    + {data.events.length - 40} more events further out
                  </li>
                )}
              </ul>
            </Panel>
          </>
        )}
      </PageState>
    </>
  );
}

function EventRow({ event }: { event: CashFlowEvent }) {
  const colorClass =
    event.kind === "income"
      ? "bg-success"
      : event.kind === "debt"
        ? "bg-accent-2"
        : event.kind === "bill"
          ? "bg-accent-3"
          : "bg-accent";
  return (
    <li className="grid grid-cols-[3px_80px_1fr_auto] items-center gap-4 px-5 py-2.5">
      <span className={`block h-5 w-[3px] ${colorClass}`} />
      <span className="font-mono text-[11px] text-ink-3">{formatDate(event.date)}</span>
      <span className="text-[13px]">{event.label}</span>
      <MoneyAmount
        value={Math.abs(event.amount)}
        signed={false}
        className={`text-[13px] ${event.amount >= 0 ? "text-success" : "text-ink"}`}
      />
    </li>
  );
}

function ProjectionChart({ daily }: { daily: CashFlowDay[] }) {
  if (daily.length === 0) return null;
  const w = 800;
  const h = 220;
  const pad = 20;
  const balances = daily.map((d) => d.endingBalance);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const range = max - min || 1;
  const xScale = (i: number) => pad + (i / (daily.length - 1)) * (w - pad * 2);
  const yScale = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);

  const points = daily.map((d, i) => `${xScale(i)},${yScale(d.endingBalance)}`).join(" ");
  const areaPath = `M ${xScale(0)},${yScale(min)} L ${points
    .split(" ")
    .join(" L ")} L ${xScale(daily.length - 1)},${yScale(min)} Z`;

  return (
    <div className="px-5 py-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <line
          x1={pad}
          y1={h - pad}
          x2={w - pad}
          y2={h - pad}
          stroke="var(--line)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <path d={areaPath} fill="var(--accent-2)" fillOpacity={0.08} />
        <polyline points={points} fill="none" stroke="var(--accent-2)" strokeWidth={2} />
      </svg>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-ink-3">
        <span>{formatDate(daily[0]!.date)}</span>
        <span>min {formatCurrency(min, { compact: true })}</span>
        <span>max {formatCurrency(max, { compact: true })}</span>
        <span>{formatDate(daily[daily.length - 1]!.date)}</span>
      </div>
    </div>
  );
}
