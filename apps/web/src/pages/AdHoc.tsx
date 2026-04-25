import { useState } from "react";
import { TopBar } from "../components/TopBar";
import { PageState, Panel, StatCard, StatGrid, MoneyAmount, StatusPill } from "../components/ui";
import { useAdhoc } from "../api/queries";
import { useDeleteAdHoc } from "../api/mutations";
import { Modal } from "../components/Modal";
import { AdHocForm } from "../components/forms";
import { RowActions } from "../components/RowActions";
import { formatCurrency, formatDate, formatRelativeDate } from "../lib/format";
import type { AdHocExpense } from "@ledger/shared-types";

export function AdHoc() {
  const query = useAdhoc();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdHocExpense | null>(null);
  const del = useDeleteAdHoc();

  return (
    <>
      <TopBar title="Ad-Hoc" subtitle="known one-offs" />
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="border border-ink bg-ink px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-card hover:border-accent-2 hover:bg-accent-2"
        >
          + Add ad-hoc
        </button>
      </div>
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
              <BucketSection
                title="This cycle"
                items={data.buckets.thisCycle}
                onEdit={setEditing}
                onDelete={(id) => del.mutate(id)}
                deletingId={del.isPending ? del.variables : null}
              />
              <BucketSection
                title="Next 30 days"
                items={data.buckets.next30d}
                onEdit={setEditing}
                onDelete={(id) => del.mutate(id)}
                deletingId={del.isPending ? del.variables : null}
              />
              <BucketSection
                title="Beyond 60 days"
                items={data.buckets.beyond60d}
                onEdit={setEditing}
                onDelete={(id) => del.mutate(id)}
                deletingId={del.isPending ? del.variables : null}
              />
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add ad-hoc expense">
        <AdHocForm onClose={() => setAddOpen(false)} />
      </Modal>
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit · ${editing?.name ?? ""}`}
      >
        {editing && <AdHocForm initial={editing} onClose={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function BucketSection({
  title,
  items,
  onEdit,
  onDelete,
  deletingId,
}: {
  title: string;
  items: AdHocExpense[];
  onEdit: (a: AdHocExpense) => void;
  onDelete: (id: number) => void;
  deletingId: number | null | undefined;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-[20px]">{title}</h2>
      <div className="grid grid-cols-3 gap-4 mobile:grid-cols-1">
        {items.map((a) => (
          <AdhocCardFull
            key={a.id}
            item={a}
            onEdit={() => onEdit(a)}
            onDelete={() => onDelete(a.id)}
            deleting={deletingId === a.id}
          />
        ))}
      </div>
    </section>
  );
}

function AdhocCardFull({
  item,
  onEdit,
  onDelete,
  deleting,
}: {
  item: AdHocExpense;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
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
      {item.description && <p className="text-[12px] text-ink-2">{item.description}</p>}
      <div className="mt-2 flex items-end justify-between">
        <MoneyAmount value={item.amount} className="text-[16px]" />
        <StatusPill kind={statusKind} />
      </div>
      <div className="mt-1 flex justify-end border-t border-line pt-2">
        <RowActions
          onEdit={onEdit}
          onDelete={onDelete}
          deleteLabel="Cancel"
          pending={deleting}
        />
      </div>
    </article>
  );
}
