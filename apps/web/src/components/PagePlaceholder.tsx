/**
 * Placeholder shown on every page during chunk 2a of Phase 2. Each page's
 * real content lands in chunk 2c. Visible at /<route> on the deployed
 * Vercel build so we can sanity-check routing + layout before pages exist.
 */
type Props = {
  page: string;
  sections: string[];
};

export function PagePlaceholder({ page, sections }: Props) {
  return (
    <section className="rounded border border-line bg-card p-6">
      <div className="label mb-3">{page} — coming next</div>
      <p className="mb-4 text-[13px] text-ink-2">
        This page is scaffolded but not yet ported from the mockup. Chunk 2c of Phase 2 fills in
        the real content. Expected sections (from <code className="font-mono">design/mockups/</code>):
      </p>
      <ul className="space-y-1 text-[13px] text-ink-2">
        {sections.map((s) => (
          <li key={s} className="flex gap-2">
            <span className="text-ink-3">·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
