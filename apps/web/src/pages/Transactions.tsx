import { TopBar } from "../components/TopBar";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function Transactions() {
  return (
    <>
      <TopBar title="Transactions" subtitle="last 30 days" />
      <PagePlaceholder
        page="Transactions"
        sections={[
          "Summary stats (4-col): money in, money out, net, daily avg",
          "Filter bar: search, category chips, account/date dropdowns",
          "Transaction table grouped by date with day totals",
          "Load-more pagination",
        ]}
      />
    </>
  );
}
