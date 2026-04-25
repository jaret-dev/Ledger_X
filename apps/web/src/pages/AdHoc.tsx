import { TopBar } from "../components/TopBar";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function AdHoc() {
  return (
    <>
      <TopBar title="Ad-Hoc" subtitle="known one-offs" />
      <PagePlaceholder
        page="Ad-Hoc"
        sections={[
          "Hero stats (4-col): planned total, funded, this cycle, next 30d",
          "60-day timeline strip with positioned events",
          "Time-grouped cards: this cycle, next 30d, beyond 60d",
          "Category breakdown + quick-add form (form lives behind Phase 3)",
        ]}
      />
    </>
  );
}
