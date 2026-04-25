import type { ReactNode } from "react";
import { formatDate } from "../lib/format";

/**
 * TopBar — page header. Each page passes its own title (and optional
 * italic subtitle + right-side meta). Border-bottom + padding match the
 * mockup's `<div class="topbar">` rule.
 *
 * On mobile (<900px) the title and meta stack vertically — otherwise
 * long subtitles ("known one-offs", "your week at a glance") wrap into
 * the meta column and produce broken-looking double-wrap layout.
 */
type Props = {
  title: string;
  subtitle?: string; // becomes the italic-serif <em> in the h1, per mockup
  meta?: ReactNode; // arbitrary right-side content (date, counts, dropdowns)
};

export function TopBar({ title, subtitle, meta }: Props) {
  return (
    <div className="mb-7 flex items-end justify-between gap-4 border-b border-line pb-5 mobile:flex-col mobile:items-start mobile:gap-3">
      <h1 className="leading-[1.05]">
        {title}
        {subtitle && <em className="ml-3 whitespace-nowrap mobile:ml-2">{subtitle}</em>}
      </h1>
      <div className="whitespace-nowrap text-right text-[11px] text-ink-3 mobile:text-left">
        {meta ?? <DefaultMeta />}
      </div>
    </div>
  );
}

function DefaultMeta() {
  return <span className="font-mono uppercase tracking-widest">{formatDate(new Date(), "full")}</span>;
}
