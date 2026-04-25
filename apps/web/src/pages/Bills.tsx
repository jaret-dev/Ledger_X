import { TopBar } from "../components/TopBar";
import { PageState, Panel, StatCard, StatGrid, StatusPill, MoneyAmount, BarTag } from "../components/ui";
import { useBills } from "../api/queries";
import { formatCurrency, formatDate } from "../lib/format";

export function Bills() {
  const query = useBills();
  return (
    <>
      <TopBar title="Recurring Bills" subtitle="every month, on rails" />
      <PageState query={query}>
        {(data) => (
          <>
            <StatGrid>
              <StatCard label="Monthly total" value={formatCurrency(data.totals.monthlyTotal)} />
              <StatCard
                label="Autopay coverage"
                value={`${data.totals.autopayCount}/${data.totals.autopayCount + data.totals.manualCount}`}
              />
              <StatCard label="Due this week" value={String(data.totals.dueThisWeek)} />
              <StatCard
                label="Next due"
                value={data.totals.nextDueDate ? formatDate(data.totals.nextDueDate) : "—"}
              />
            </StatGrid>

            <div className="space-y-6">
              {data.groups.map((group) => (
                <Panel
                  key={group.category}
                  title={group.label}
                  subtitle={`${group.bills.length} · ${formatCurrency(group.monthlyTotal)}/mo`}
                >
                  <ul className="divide-y divide-line">
                    {group.bills.map((bill) => (
                      <li
                        key={bill.id}
                        className="grid grid-cols-[16px_1fr_auto_auto] items-center gap-4 px-5 py-3 mobile:grid-cols-[16px_1fr_auto]"
                      >
                        <BarTag kind="bill" />
                        <div>
                          <div className="text-[13px] font-medium text-ink">{bill.name}</div>
                          <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                            {bill.frequency} · day {bill.dueDayOfMonth ?? "—"}
                            {bill.paymentMethod ? ` · ${bill.paymentMethod}` : ""}
                          </div>
                        </div>
                        <div className="hidden mobile:hidden md:block">
                          <StatusPill kind={bill.autopay ? "auto" : "manual"} />
                        </div>
                        <MoneyAmount value={bill.amount} className="text-[13px]" />
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          </>
        )}
      </PageState>
    </>
  );
}
