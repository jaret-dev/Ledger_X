import { TopBar } from "../components/TopBar";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function Overview() {
  return (
    <>
      <TopBar title="Overview" subtitle="your week at a glance" />
      <PagePlaceholder
        page="Overview"
        sections={[
          "Top stats (cash on hand, monthly inflow/outflow, net worth)",
          "Cash Flow by paycheck — timeline of next 4 paychecks",
          "Debts panel + Budgets panel (2-col)",
          "Upcoming ad-hoc expenses (3-col grid)",
        ]}
      />
    </>
  );
}
