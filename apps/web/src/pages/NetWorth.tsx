import { TopBar } from "../components/TopBar";
import { PageState, Panel, ProgressBar, MoneyAmount, BarTag } from "../components/ui";
import {
  useNetWorth,
  useNetWorthAllocation,
  useNetWorthMilestones,
} from "../api/queries";
import { formatCurrency } from "../lib/format";

export function NetWorth() {
  const networth = useNetWorth();
  const allocation = useNetWorthAllocation();
  const milestones = useNetWorthMilestones();
  return (
    <>
      <TopBar title="Net Worth" subtitle="composition + trajectory" />
      <PageState query={networth}>
        {(data) => (
          <>
            <section className="mb-7 grid grid-cols-[1fr_2fr] gap-8 border border-line bg-card p-6 mobile:grid-cols-1">
              <div>
                <div className="label">Net worth</div>
                <div className="font-serif text-[64px] font-light leading-none mobile:text-[48px]">
                  {formatCurrency(data.current.netWorth, { compact: true })}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <div className="label">Assets</div>
                    <MoneyAmount value={data.current.totalAssets} className="text-ink" />
                  </div>
                  <div>
                    <div className="label">Liabilities</div>
                    <MoneyAmount
                      value={data.current.totalLiabilities}
                      className="text-accent-2"
                    />
                  </div>
                </div>
              </div>
              <TrajectoryChart history={data.history} />
            </section>

            <div className="grid grid-cols-2 gap-6 mb-7 mobile:grid-cols-1">
              <Panel title="Assets" subtitle={`${data.assets.length} accounts`}>
                <ul className="divide-y divide-line">
                  {data.assets.map((a) => (
                    <li
                      key={a.accountId}
                      className="grid grid-cols-[3px_1fr_auto] items-center gap-3 px-5 py-3"
                    >
                      <BarTag kind="income" />
                      <div>
                        <div className="text-[13px]">{a.nickname}</div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                          {a.institution} · {a.subtype ?? "—"}
                        </div>
                      </div>
                      <MoneyAmount value={a.balance} className="text-[13px]" />
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="Liabilities" subtitle={`${data.liabilities.length} accounts`}>
                <ul className="divide-y divide-line">
                  {data.liabilities.map((l) => (
                    <li
                      key={l.debtId}
                      className="grid grid-cols-[3px_1fr_auto] items-center gap-3 px-5 py-3"
                    >
                      <BarTag kind="debt" />
                      <div>
                        <div className="text-[13px]">{l.name}</div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                          {l.type.replace(/_/g, " ")}
                        </div>
                      </div>
                      <MoneyAmount value={l.balance} className="text-[13px] text-accent-2" />
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <PageState query={allocation}>
              {(alloc) => (
                <Panel title="Allocation" subtitle={formatCurrency(alloc.total, { compact: true })} className="mb-7">
                  <div className="px-5 py-4">
                    <div className="flex h-3 overflow-hidden border border-line">
                      {alloc.slices.map((s, i) => (
                        <div
                          key={s.bucket}
                          className={
                            i === 0
                              ? "bg-success"
                              : i === 1
                                ? "bg-accent-4"
                                : i === 2
                                  ? "bg-accent-5"
                                  : "bg-accent-3"
                          }
                          style={{ width: `${s.pct}%` }}
                          title={`${s.label} · ${s.pct}%`}
                        />
                      ))}
                    </div>
                    <ul className="mt-3 grid grid-cols-3 gap-4 mobile:grid-cols-1">
                      {alloc.slices.map((s, i) => (
                        <li key={s.bucket} className="text-[12px]">
                          <span
                            className={`mr-2 inline-block h-2 w-2 ${
                              i === 0
                                ? "bg-success"
                                : i === 1
                                  ? "bg-accent-4"
                                  : i === 2
                                    ? "bg-accent-5"
                                    : "bg-accent-3"
                            }`}
                          />
                          {s.label} · <span className="amount">{s.pct.toFixed(0)}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Panel>
              )}
            </PageState>

            <PageState query={milestones}>
              {(m) => (
                <Panel title="Milestones" subtitle="goals on the horizon">
                  <ul className="divide-y divide-line">
                    {m.milestones.map((ms) => (
                      <li key={ms.key} className="px-5 py-4">
                        <div className="mb-2 flex items-baseline justify-between gap-3">
                          <h4 className="text-[16px]">{ms.label}</h4>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                            ETA {ms.etaLabel}
                          </span>
                        </div>
                        <ProgressBar pct={ms.pctComplete} status="good" />
                        <div className="mt-2 flex justify-between font-mono text-[11px]">
                          <span className="text-ink-3">
                            {formatCurrency(ms.current, { compact: true })} of{" "}
                            {formatCurrency(ms.target, { compact: true })}
                          </span>
                          <span className="text-ink">{ms.pctComplete.toFixed(0)}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </PageState>
          </>
        )}
      </PageState>
    </>
  );
}

function TrajectoryChart({
  history,
}: {
  history: Array<{ date: string; netWorth: number }>;
}) {
  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center text-[12px] text-ink-3">
        Trajectory builds over time — only one snapshot so far.
      </div>
    );
  }
  // Simple SVG line through netWorth values, padded to fit.
  const w = 480;
  const h = 120;
  const pad = 12;
  const min = Math.min(...history.map((h) => h.netWorth));
  const max = Math.max(...history.map((h) => h.netWorth));
  const range = max - min || 1;
  const points = history.map((p, i) => {
    const x = pad + (i / (history.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.netWorth - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="var(--accent-2)"
        strokeWidth={2}
      />
      {points.map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--accent-2)" />;
      })}
    </svg>
  );
}
