import { useState } from "react";
import { TopBar } from "../components/TopBar";
import { PageState, Panel, StatCard, StatGrid, StatusPill, MoneyAmount, BarTag } from "../components/ui";
import { useBills } from "../api/queries";
import { useDeleteBill } from "../api/mutations";
import { Modal } from "../components/Modal";
import { BillForm } from "../components/forms";
import { RowActions } from "../components/RowActions";
import { formatCurrency, formatDate } from "../lib/format";
import type { RecurringBill } from "@ledger/shared-types";

export function Bills() {
  const query = useBills();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringBill | null>(null);
  const del = useDeleteBill();

  return (
    <>
      <TopBar title="Recurring Bills" subtitle="every month, on rails" />
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="border border-ink bg-ink px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-card hover:border-accent-2 hover:bg-accent-2"
        >
          + Add bill
        </button>
      </div>
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
                        className="grid grid-cols-[16px_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 mobile:grid-cols-[16px_1fr_auto]"
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
                        <RowActions
                          onEdit={() => setEditing(bill)}
                          onDelete={() => del.mutate(bill.id)}
                          pending={del.isPending}
                        />
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          </>
        )}
      </PageState>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add recurring bill">
        <BillForm onClose={() => setAddOpen(false)} />
      </Modal>
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit · ${editing?.name ?? ""}`}
      >
        {editing && <BillForm initial={editing} onClose={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
