import { Routes, Route, Navigate } from "react-router-dom";
import { SignIn, SignUp, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
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
    <Routes>
      {/* Public auth surface — Clerk's prebuilt components handle email,
          social, password reset, etc. Theming pass is a Phase 5 polish. */}
      <Route
        path="/sign-in/*"
        element={
          <AuthShell>
            <SignIn routing="path" path="/sign-in" />
          </AuthShell>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <AuthShell>
            <SignUp routing="path" path="/sign-up" />
          </AuthShell>
        }
      />

      {/* Everything else requires a signed-in session. SignedOut users
          get bounced to /sign-in; SignedIn users see the full app. */}
      <Route
        path="/*"
        element={
          <>
            <SignedIn>
              <ProtectedShell />
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        }
      />
    </Routes>
  );
}

function ProtectedShell() {
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
        <Route path="/sign-in" element={<Navigate to="/" replace />} />
        <Route path="/sign-up" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden
            className="font-serif text-[42px] font-light italic leading-none text-accent"
          >
            l
          </span>
          <span className="font-serif text-[28px] font-normal leading-none tracking-tight text-ink">
            Ledger
          </span>
        </div>
        {children}
      </div>
    </main>
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
