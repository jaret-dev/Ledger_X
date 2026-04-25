import { useMemo, useState } from "react";
import { TopBar } from "../components/TopBar";
import {
  PageState,
  StatCard,
  StatGrid,
  MoneyAmount,
  BarTag,
} from "../components/ui";
import { useTransactions, useTransactionsSummary } from "../api/queries";
import { formatCurrency, formatDate } from "../lib/format";
import type { Transaction } from "@ledger/shared-types";

export function Transactions() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const [accountId, setAccountId] = useState<number | undefined>();
  const [limit, setLimit] = useState(50);

  const summary = useTransactionsSummary(30);
  const txns = useTransactions({ search, category, accountId, limit });

  // Group transactions by date for the day-banner pattern in the mockup.
  const grouped = useMemo(() => {
    if (!txns.data) return [];
    const map = new Map<string, Transaction[]>();
    for (const t of txns.data.transactions) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()];
  }, [txns.data]);

  return (
    <>
      <TopBar title="Transactions" subtitle="last 30 days" />

      <PageState query={summary}>
        {(s) => (
          <StatGrid>
            <StatCard label="Money in" value={formatCurrency(s.moneyIn)} tone="success" />
            <StatCard label="Money out" value={formatCurrency(s.moneyOut)} />
            <StatCard
              label="Net"
              value={formatCurrency(s.net, { compact: true })}
              tone={s.net >= 0 ? "success" : "warn"}
            />
            <StatCard label="Daily avg out" value={formatCurrency(s.dailyAvgOut)} />
          </StatGrid>
        )}
      </PageState>

      <PageState query={txns}>
        {(data) => (
          <>
            <div className="mb-4 flex flex-wrap gap-3 border-y border-line bg-bg-2 px-4 py-3">
              <input
                type="search"
                placeholder="Search merchant or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] rounded border border-line bg-card px-3 py-1.5 text-[13px] focus:border-ink focus:outline-none"
              />
              <select
                value={category ?? ""}
                onChange={(e) => setCategory(e.target.value || undefined)}
                className="rounded border border-line bg-card px-3 py-1.5 font-mono text-[11px]"
              >
                <option value="">All categories</option>
                {data.facets.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                value={accountId ?? ""}
                onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : undefined)}
                className="rounded border border-line bg-card px-3 py-1.5 font-mono text-[11px]"
              >
                <option value="">All accounts</option>
                {data.facets.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nickname}
                  </option>
                ))}
              </select>
            </div>

            <div className="border border-line bg-card">
              {grouped.length === 0 && (
                <div className="px-5 py-6 text-[13px] text-ink-3">
                  No transactions match these filters.
                </div>
              )}
              {grouped.map(([date, items]) => {
                const dayTotal = items.reduce((s, t) => s + t.amount, 0);
                return (
                  <div key={date}>
                    <div className="flex items-center justify-between border-b border-line bg-bg-2 px-5 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-3">
                      <span>{formatDate(date, "full")}</span>
                      <MoneyAmount value={dayTotal} className="text-ink" signed />
                    </div>
                    <ul className="divide-y divide-line">
                      {items.map((t) => (
                        <li
                          key={t.id}
                          className="grid grid-cols-[3px_1fr_auto_auto] items-center gap-4 px-5 py-3 mobile:grid-cols-[3px_1fr_auto]"
                        >
                          <BarTag kind={t.amount < 0 ? "income" : kindFromCategory(t.category)} />
                          <div>
                            <div className="text-[13px] text-ink">{t.merchantName ?? t.merchantRaw}</div>
                            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3">
                              {t.category ?? "—"}
                            </div>
                          </div>
                          <span className="font-mono text-[10px] text-ink-3 mobile:hidden">
                            {t.accountNickname}
                          </span>
                          <MoneyAmount
                            value={Math.abs(t.amount)}
                            className={`text-[13px] ${t.amount < 0 ? "text-success" : "text-ink"}`}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {data.pagination.hasMore && (
                <div className="border-t border-line p-4 text-center">
                  <button
                    onClick={() => setLimit((l) => l + 50)}
                    className="border border-line bg-bg-2 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest hover:border-ink hover:bg-bg"
                  >
                    Load more · {data.pagination.total - data.transactions.length} remaining
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </PageState>
    </>
  );
}

function kindFromCategory(category: string | null): "bill" | "budget" | "debt" | "adhoc" {
  if (!category) return "budget";
  if (["debt_payment"].includes(category)) return "debt";
  if (["subscription"].includes(category)) return "bill";
  return "budget";
}
