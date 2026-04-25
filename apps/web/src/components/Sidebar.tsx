import { NavLink } from "react-router-dom";

/**
 * Sidebar — fixed-width nav, two sections (View / Manage), matches the
 * mockup's structure exactly. Counts are placeholders for now; chunk 2c
 * wires them to the React Query hooks once the endpoints exist.
 */

type NavItem = {
  to: string;
  label: string;
  count: string; // mockup chips are mixed strings ("142", "90d", "↗", "—") so we type wide
};

const VIEW_ITEMS: NavItem[] = [
  { to: "/", label: "Overview", count: "—" },
  { to: "/cash-flow", label: "Cash Flow", count: "90d" },
  { to: "/transactions", label: "Transactions", count: "—" },
  { to: "/net-worth", label: "Net Worth", count: "↗" },
];

const MANAGE_ITEMS: NavItem[] = [
  { to: "/debts", label: "Debts", count: "—" },
  { to: "/bills", label: "Recurring Bills", count: "—" },
  { to: "/budgets", label: "Budgets", count: "—" },
  { to: "/income", label: "Income", count: "—" },
  { to: "/ad-hoc", label: "Ad-Hoc", count: "—" },
];

export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col gap-8 overflow-y-auto border-r border-line bg-bg-2 px-5 py-7 mobile:hidden">
      <Wordmark />
      <NavSection title="View" items={VIEW_ITEMS} />
      <NavSection title="Manage" items={MANAGE_ITEMS} />
      <Footer />
    </aside>
  );
}

function Wordmark() {
  return (
    <div className="flex items-baseline gap-1.5 px-2">
      <span
        aria-hidden
        className="font-serif text-[34px] font-light italic leading-none text-accent"
      >
        l
      </span>
      <span className="font-serif text-[20px] font-normal leading-none tracking-tight text-ink">
        Ledger
      </span>
    </div>
  );
}

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <nav className="flex flex-col gap-1">
      <div className="label px-2 pb-2">{title}</div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            [
              "flex items-center justify-between rounded px-2 py-2 text-[13px] transition-colors",
              isActive
                ? "bg-ink text-card [&_.count]:text-bg-2"
                : "text-ink hover:bg-bg [&_.count]:text-ink-3",
            ].join(" ")
          }
        >
          <span>{item.label}</span>
          <span className="count font-mono text-[10px] tracking-wide">{item.count}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Footer() {
  return (
    <div className="mt-auto border-t border-line pt-4 text-[10px] text-ink-3">
      <div className="font-mono uppercase tracking-widest">Phase 1</div>
      <div className="mt-1 text-[11px]">Mock data · seeded</div>
    </div>
  );
}
