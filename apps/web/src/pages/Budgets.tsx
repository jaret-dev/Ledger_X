import { TopBar } from "../components/TopBar";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function Budgets() {
  return (
    <>
      <TopBar title="Budgets" subtitle="this paycheck" />
      <PagePlaceholder
        page="Budgets"
        sections={[
          "Hero stats (4-col): allocated, spent, remaining, days left in cycle",
          "Cycle progress bar (paycheck cycle)",
          "Budget cards (2-col): per envelope — progress track + recent transactions",
        ]}
      />
    </>
  );
}
