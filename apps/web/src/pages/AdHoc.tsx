import { TopBar } from "../components/TopBar";
import { PageState, Panel, StatCard, StatGrid, MoneyAmount, StatusPill } from "../components/ui";
import { useAdhoc } from "../api/queries";
import { formatCurrency, formatDate, formatRelativeDate } from "../lib/format";
import type { AdHocExpense } from "@ledger/shared-types";

export function AdHoc() {
  const query = useAdhoc();
  return (
    <>
      <TopBar title="Ad-Hoc" subtitle="known one-offs" />
      <PageState query={query}>
        {(data) => (
          <>
            <StatGrid>
              <StatCard label="Planned total" value={formatCurrency(data.totals.plannedTotal)} />
              <StatCard
                label="Funded"
                value={formatCurrency(data.totals.fundedTotal)}
                tone="success"
              />
              <StatCard label="This cycle" value={formatCurrency(data.totals.thisCycleTotal)} />
              <StatCard label="Next 30d" value={formatCurrency(data.totals.next30dTotal)} />
            </StatGrid>

            <div className="space-y-6">
              <BucketSection title="This cycle" items={data.buckets.thisCycle} emphasized />
              <BucketSection title="Next 30 days" items={data.buckets.next30d} />
              <BucketSection title="Beyond 60 days" items={data.buckets.beyond60d} />
            </div>

            {data.byCategory.length > 0 && (
              <div className="mt-6">
                <Panel title="Category breakdown" subtitle="all upcoming">
                  <ul className="divide-y divide-line">
                    {data.byCategory.map((c) => (
                      <li
                        key={c.category}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3"
                      >
                        <span className="text-[13px]">{c.label}</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                          {c.count} {c.count === 1 ? "item" : "items"}
                        </span>
                        <MoneyAmount value={c.total} className="text-[13px]" />
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            )}
          </>
        )}
      </PageState>
    </>
  );
}

function BucketSection({
  title,
  items,
  emphasized,
}: {
  title: string;
  items: AdHocExpense[];
  emphasized?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className={`mb-3 ${emphasized ? "" : "text-[20px]"}`}>{title}</h2>
      <div className="grid grid-cols-3 gap-4 mobile:grid-cols-1">
        {items.map((a) => (
          <AdhocCardFull key={a.id} item={a} />
        ))}
      </div>
    </section>
  );
}

function AdhocCardFull({ item }: { item: AdHocExpense }) {
  const statusKind: Parameters<typeof StatusPill>[0]["kind"] =
    item.status === "funded"
      ? "funded"
      : item.status === "paid"
        ? "paid"
        : item.status === "planned"
          ? "planned"
          : "manual";
  const dueClass =
    item.daysUntilDue < 0
      ? "text-danger"
      : item.daysUntilDue <= 14
        ? "text-accent"
        : "text-ink-3";
  return (
    <article className="relative flex flex-col gap-2 border border-line bg-card p-5">
      <div className={`font-mono text-[10px] uppercase tracking-widest ${dueClass}`}>
        {formatRelativeDate(item.dueDate)} · {formatDate(item.dueDate)}
      </div>
      <h3 className="text-[20px]">{item.name}</h3>
      {item.description && (
        <p className="text-[12px] text-ink-2">{item.description}</p>
      )}
      <div className="mt-2 flex items-end justify-between">
        <MoneyAmount value={item.amount} className="text-[16px]" />
        <StatusPill kind={statusKind} />
      </div>
    </article>
  );
}
