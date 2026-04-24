import { useHealth } from "./api/queries";

export function App() {
  const { data, isPending, isError, error } = useHealth();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-3xl font-semibold mb-6">Ledger</h1>
      <section className="max-w-md w-full rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h2 className="text-sm uppercase tracking-widest text-black/50 mb-3">API health</h2>
        {isPending && <p className="text-black/70">Checking /api/health…</p>}
        {isError && (
          <p className="text-red-600">
            Failed to reach API: {error instanceof Error ? error.message : "unknown error"}
          </p>
        )}
        {data && (
          <dl className="text-left grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-black/50">status</dt>
            <dd className="font-mono">{data.status}</dd>
            <dt className="text-black/50">db</dt>
            <dd className="font-mono">{data.db}</dd>
            <dt className="text-black/50">timestamp</dt>
            <dd className="font-mono text-xs">{data.timestamp}</dd>
          </dl>
        )}
      </section>
      <p className="mt-6 text-xs text-black/40">
        Phase 1 scaffold. The mockups in <code>design/mockups/</code> land in Phase 2.
      </p>
    </main>
  );
}
