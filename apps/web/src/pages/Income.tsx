import { TopBar } from "../components/TopBar";
import { PageState, Panel, StatCard, StatGrid, MoneyAmount, BarTag } from "../components/ui";
import { useIncome } from "../api/queries";
import { formatCurrency, formatDate } from "../lib/format";

export function Income() {
  const query = useIncome();
  return (
    <>
      <TopBar title="Income" subtitle="who's bringing what in" />
      <PageState query={query}>
        {(data) => {
          const jaret = data.totals.perPerson.find((p) => p.userName === "Jaret");
          const sarah = data.totals.perPerson.find((p) => p.userName === "Sarah");
          return (
            <>
              <StatGrid>
                <StatCard label="Combined / month" value={formatCurrency(data.totals.monthlyCombined)} />
                <StatCard label="Jaret" value={formatCurrency(jaret?.monthlyTotal ?? 0)} />
                <StatCard label="Sarah" value={formatCurrency(sarah?.monthlyTotal ?? 0)} />
                <StatCard label="YTD combined" value={formatCurrency(data.totals.ytdCombined)} />
              </StatGrid>

              <Panel title="Sources" subtitle={`${data.sources.length} active`}>
                <ul className="divide-y divide-line">
                  {data.sources.map((src) => (
                    <li
                      key={src.id}
                      className="grid grid-cols-[3px_1fr_auto] items-center gap-4 px-5 py-4"
                    >
                      <BarTag kind="income" />
                      <div>
                        <div className="text-[14px] font-medium text-ink">{src.name}</div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                          {src.userName} · {src.frequency}
                          {src.amountVariable ? " · variable" : ""}
                          {src.upcomingPaydates[0]
                            ? ` · next ${formatDate(src.upcomingPaydates[0])}`
                            : ""}
                        </div>
                      </div>
                      <MoneyAmount value={src.amount} className="text-[14px]" />
                    </li>
                  ))}
                </ul>
              </Panel>

              <div className="mt-6 grid grid-cols-2 gap-6 mobile:grid-cols-1">
                <Panel title="Next 30 days" subtitle={`${data.upcoming30d.length} deposits`}>
                  <ul className="divide-y divide-line">
                    {data.upcoming30d.length === 0 && (
                      <li className="px-5 py-4 text-[13px] text-ink-3">No deposits scheduled.</li>
                    )}
                    {data.upcoming30d.map((d, idx) => (
                      <li
                        key={`${d.date}-${d.sourceId}-${idx}`}
                        className="grid grid-cols-[80px_1fr_auto] items-center gap-3 px-5 py-3"
                      >
                        <span className="font-mono text-[11px] text-ink-3">
                          {formatDate(d.date)}
                        </span>
                        <span className="text-[13px]">
                          {d.sourceName} <span className="text-ink-3">· {d.userName}</span>
                        </span>
                        <MoneyAmount value={d.amount} className="text-[13px]" />
                      </li>
                    ))}
                  </ul>
                </Panel>

                <Panel title="6-month projection" subtitle="combined">
                  <ul className="divide-y divide-line">
                    {data.projection6mo.map((m) => (
                      <li
                        key={m.month}
                        className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3"
                      >
                        <span className="font-mono text-[11px] uppercase tracking-widest text-ink-3">
                          {m.label}
                        </span>
                        <MoneyAmount
                          value={m.jaret}
                          className="text-[12px] text-ink-2 mobile:hidden"
                        />
                        <MoneyAmount
                          value={m.sarah}
                          className="text-[12px] text-ink-2 mobile:hidden"
                        />
                        <MoneyAmount value={m.total} className="text-[13px]" />
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </>
          );
        }}
      </PageState>
    </>
  );
}
