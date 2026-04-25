import type { ReactNode } from "react";
import { formatDate } from "../lib/format";

/**
 * TopBar — page header. Each page passes its own title (and optional
 * italic subtitle + right-side meta). Border-bottom + padding match the
 * mockup's `<div class="topbar">` rule.
 */
type Props = {
  title: string;
  subtitle?: string; // becomes the italic-serif <em> in the h1, per mockup
  meta?: ReactNode; // arbitrary right-side content (date, counts, dropdowns)
};

export function TopBar({ title, subtitle, meta }: Props) {
  return (
    <div className="mb-7 flex items-end justify-between border-b border-line pb-5">
      <h1>
        {title}
        {subtitle && <em className="ml-3">{subtitle}</em>}
      </h1>
      <div className="text-right text-[11px] text-ink-3">{meta ?? <DefaultMeta />}</div>
    </div>
  );
}

function DefaultMeta() {
  return <span className="font-mono uppercase tracking-widest">{formatDate(new Date(), "full")}</span>;
}
