import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";

/**
 * AppLayout — sidebar + main shell. Mirrors the mockup's body { display:
 * flex } + main { max-width: 1400px; padding: 32px 40px 60px } rules.
 *
 * Mobile (<900px): the sidebar is hidden by default and revealed as a
 * fixed overlay when the hamburger button is tapped. The button itself
 * is rendered at the top-left of `<main>` only on mobile, since on
 * desktop the sidebar is always visible.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

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
