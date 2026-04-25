import { useState } from "react";

/**
 * Small inline row-level controls — edit / delete buttons used at the
 * end of every list row. Delete prompts for confirmation inline so we
 * don't need a separate AlertDialog primitive.
 *
 * Compact by design: matches the mockup's `.menu` 24px-wide column.
 */
type Props = {
  onEdit: () => void;
  onDelete: () => void;
  deleteLabel?: string; // override e.g. "Cancel" for adhoc
  pending?: boolean;
};

export function RowActions({ onEdit, onDelete, deleteLabel = "Delete", pending = false }: Props) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="font-mono text-[10px] uppercase tracking-widest text-ink-3 hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            onDelete();
            setConfirming(false);
          }}
          className="border border-danger px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-danger hover:bg-danger hover:text-card disabled:opacity-50"
        >
          {pending ? "…" : `Confirm ${deleteLabel.toLowerCase()}`}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit"
        className="border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-2 hover:border-ink hover:text-ink"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={deleteLabel}
        className="border border-line px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink-3 hover:border-danger hover:text-danger"
      >
        {deleteLabel}
      </button>
    </div>
  );
}
