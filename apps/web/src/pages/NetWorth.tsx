import { TopBar } from "../components/TopBar";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function NetWorth() {
  return (
    <>
      <TopBar title="Net Worth" subtitle="composition + trajectory" />
      <PagePlaceholder
        page="Net Worth"
        sections={[
          "Hero: large net worth value + SVG trajectory chart",
          "Composition (2-col): assets panel + liabilities panel",
          "Allocation bar: cash / investments / crypto split",
          "Milestones: emergency fund, debt-free, $100K, house down payment",
        ]}
      />
    </>
  );
}
