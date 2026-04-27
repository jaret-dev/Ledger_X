import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { setSessionTokenGetter } from "../api/client";

/**
 * AppLayout — sidebar + main shell. Mirrors the mockup's body { display:
 * flex } + main { max-width: 1400px; padding: 32px 40px 60px } rules.
 *
 * Mobile (<900px): the sidebar is hidden by default and revealed as a
 * fixed overlay when the hamburger button is tapped.
 *
 * Phase 5: also wires Clerk's session token into the API client so every
 * fetch carries a fresh bearer JWT.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useClerkTokenBridge();

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <Sidebar mobileOpen={menuOpen} onCloseMobile={() => setMenuOpen(false)} />
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-ink/40 mobile:block hidden"
        />
      )}
      <main className="mx-auto w-full max-w-main flex-1 px-10 pb-[60px] pt-8 mobile:px-4 mobile:pb-10 mobile:pt-5">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="hidden mobile:flex mb-4 items-center gap-2 border border-line bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-2 hover:border-ink hover:text-ink"
          aria-label="Open menu"
        >
          <span aria-hidden>☰</span> Menu
        </button>
        {children}
      </main>
    </div>
  );
}

/** Connect Clerk's `useAuth().getToken()` to the API client's token
 *  getter. Runs once when AppLayout mounts inside a SignedIn route, and
 *  invalidates React Query cache when the user changes (sign out / in
 *  as different account) so we never serve another user's data. */
function useClerkTokenBridge(): void {
  const { isSignedIn, userId, getToken } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    setSessionTokenGetter(async () => {
      if (!isSignedIn) return null;
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    // When the signed-in identity flips, drop every cached query — they
    // were fetched as the previous user and may show stale/wrong data.
    queryClient.invalidateQueries();
  }, [isSignedIn, userId, getToken, queryClient]);
}

