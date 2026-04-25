import { Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { Overview } from "./pages/Overview";
import { CashFlow } from "./pages/CashFlow";
import { Transactions } from "./pages/Transactions";
import { NetWorth } from "./pages/NetWorth";
import { Debts } from "./pages/Debts";
import { Bills } from "./pages/Bills";
import { Budgets } from "./pages/Budgets";
import { Income } from "./pages/Income";
import { AdHoc } from "./pages/AdHoc";

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/cash-flow" element={<CashFlow />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/net-worth" element={<NetWorth />} />
        <Route path="/debts" element={<Debts />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/income" element={<Income />} />
        <Route path="/ad-hoc" element={<AdHoc />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function NotFound() {
  return (
    <section className="rounded border border-line bg-card p-6">
      <h2 className="mb-2">Page not found</h2>
      <p className="text-[13px] text-ink-2">Try a link in the sidebar.</p>
    </section>
  );
}
