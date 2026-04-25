import { TopBar } from "../components/TopBar";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function CashFlow() {
  return (
    <>
      <TopBar title="Cash Flow" subtitle="next 90 days" />
      <PagePlaceholder
        page="Cash Flow"
        sections={[
          "Summary rail (3-col): inflow, outflow, projected ending balance",
          "Projection chart (SVG line, 90-day horizon)",
          "3-month calendar with color-coded events (income / bills / debt / ad-hoc)",
        ]}
      />
    </>
  );
}
