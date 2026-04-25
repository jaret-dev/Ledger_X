import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

/**
 * AppLayout — sidebar + main shell. Mirrors the mockup's body { display:
 * flex } + main { max-width: 1400px; padding: 32px 40px 60px } rules.
 * On <900px the sidebar hides and main padding tightens.
 */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <Sidebar />
      <main className="mx-auto w-full max-w-main flex-1 px-10 pb-[60px] pt-8 mobile:px-4 mobile:pb-10 mobile:pt-5">
        {children}
      </main>
    </div>
  );
}
