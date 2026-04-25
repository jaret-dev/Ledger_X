import { TopBar } from "../components/TopBar";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function Bills() {
  return (
    <>
      <TopBar title="Recurring Bills" subtitle="every month, on rails" />
      <PagePlaceholder
        page="Recurring Bills"
        sections={[
          "Hero stats (4-col): monthly total, autopay coverage, due this week, next due date",
          "Bills grouped by category: Housing, Utilities, Insurance, Subscriptions",
          "Per row: name, frequency, due, payment method, amount, status pill",
        ]}
      />
    </>
  );
}
