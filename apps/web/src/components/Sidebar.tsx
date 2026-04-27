import { NavLink } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { useSidebar } from "../api/queries";

/**
 * Sidebar — fixed-width nav, two sections (View / Manage). Counts are
 * sourced from /api/sidebar on a single small query so the chips stay
 * in sync with mutations elsewhere in the app (Phase 3 invalidates the
 * "sidebar" query key after every successful mutation).
 *
 * Mobile: rendered as a fixed-position overlay, controlled by AppLayout.
 */

type Props = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const ARROW_BY_TREND: Record<"up" | "flat" | "down", string> = {
  up: "↗",
  flat: "→",
  down: "↘",
};

export function Sidebar({ mobileOpen, onCloseMobile }: Props) {
  const { data } = useSidebar();

  const viewItems = [
    { to: "/", label: "Overview", count: "—" },
    { to: "/cash-flow", label: "Cash Flow", count: "90d" },
    {
      to: "/transactions",
      label: "Transactions",
      count: data ? String(data.transactionsCount) : "—",
    },
    {
      to: "/net-worth",
      label: "Net Worth",
      count: data ? ARROW_BY_TREND[data.netWorthTrend] : "↗",
    },
  ];

  const manageItems = [
    { to: "/debts", label: "Debts", count: data ? String(data.debtsCount) : "—" },
    {
      to: "/bills",
      label: "Recurring Bills",
      count: data ? String(data.billsCount) : "—",
    },
    { to: "/budgets", label: "Budgets", count: data ? String(data.budgetsCount) : "—" },
    { to: "/income", label: "Income", count: data ? String(data.incomeCount) : "—" },
    { to: "/ad-hoc", label: "Ad-Hoc", count: data ? String(data.adhocCount) : "—" },
  ];

  // Visibility: always shown on desktop; on mobile only when mobileOpen.
  // Apply mobile overlay positioning conditionally.
  const visibilityClass = mobileOpen
    ? "mobile:fixed mobile:inset-y-0 mobile:left-0 mobile:z-40 mobile:shadow-2xl"
    : "mobile:hidden";

  return (
    <aside
      className={`sticky top-0 flex h-screen w-[220px] shrink-0 flex-col gap-8 overflow-y-auto border-r border-line bg-bg-2 px-5 py-7 ${visibilityClass}`}
    >
      <Wordmark />
      <NavSection title="View" items={viewItems} onNavigate={onCloseMobile} />
      <NavSection title="Manage" items={manageItems} onNavigate={onCloseMobile} />
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

function NavSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: Array<{ to: string; label: string; count: string }>;
  onNavigate: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      <div className="label px-2 pb-2">{title}</div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
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
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
      <div className="text-[10px] text-ink-3">
        <div className="font-mono uppercase tracking-widest">Phase 5</div>
        <div className="mt-1 text-[11px]">Auth · live</div>
      </div>
      <UserButton
        appearance={{
          elements: {
            avatarBox: "w-8 h-8 rounded-full border border-line",
            userButtonPopoverCard: "bg-card border border-line",
            userButtonPopoverFooter: "hidden",
          },
        }}
      />
    </div>
  );
}
