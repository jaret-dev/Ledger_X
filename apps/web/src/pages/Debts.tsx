import { TopBar } from "../components/TopBar";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function Debts() {
  return (
    <>
      <TopBar title="Debts" subtitle="payoff in motion" />
      <PagePlaceholder
        page="Debts"
        sections={[
          "Hero stats (4-col): total balance, weighted APR, monthly minimums, payoff ETA",
          "Debt cards (one per debt): balance, APR, min payment, progress bar",
          "Payoff scenarios (3-col): Minimums vs Avalanche vs Snowball",
        ]}
      />
    </>
  );
}
