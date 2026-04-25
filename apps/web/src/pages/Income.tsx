import { TopBar } from "../components/TopBar";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function Income() {
  return (
    <>
      <TopBar title="Income" subtitle="who's bringing what in" />
      <PagePlaceholder
        page="Income"
        sections={[
          "Hero stats (4-col): combined biweekly, Jaret, Sarah, YTD",
          "Source list with per-source schedule + next-pay mini-timeline",
          "6-month projection grid",
          "Upcoming deposits (next 30 days)",
        ]}
      />
    </>
  );
}
