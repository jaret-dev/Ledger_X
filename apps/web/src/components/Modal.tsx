import { useEffect, type ReactNode } from "react";

/**
 * Simple modal — fixed-position overlay, centered card, escape-to-close.
 * Used for create/edit forms across every page.
 */
type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function Modal({ open, onClose, title, subtitle, children }: Props) {
  // Esc closes; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="my-8 w-full max-w-md border border-line bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between border-b border-line bg-bg-2 px-5 py-3.5">
          <h3 id="modal-title">
            {title}
            {subtitle && <em className="ml-2">{subtitle}</em>}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="font-mono text-[18px] leading-none text-ink-3 hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Form primitives ───────────────────────────────────────────────

/** Standard form footer with Cancel + primary action. */
export function ModalActions({
  onCancel,
  onSubmit,
  primaryLabel = "Save",
  isPending = false,
  destructive = false,
}: {
  onCancel: () => void;
  onSubmit?: () => void;
  primaryLabel?: string;
  isPending?: boolean;
  destructive?: boolean;
}) {
  return (
    <div className="mt-5 flex items-center justify-end gap-2 border-t border-line pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="border border-line bg-card px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-ink-2 hover:border-ink hover:text-ink"
      >
        Cancel
      </button>
      <button
        type="submit"
        onClick={onSubmit}
        disabled={isPending}
        className={`border px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-card disabled:opacity-50 ${
          destructive
            ? "border-danger bg-danger hover:border-danger/80"
            : "border-ink bg-ink hover:border-accent-2 hover:bg-accent-2"
        }`}
      >
        {isPending ? "Working…" : primaryLabel}
      </button>
    </div>
  );
}

/** Field wrapper: label + input slot + optional error text. Avoids
 *  repeating the same wrapper markup in every form. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <label
        htmlFor={htmlFor}
        className="label mb-1 block"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-ink-3">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}

/** Themed text input. Forwards all native props. */
export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-line bg-bg px-3 py-2 text-[13px] focus:border-ink focus:outline-none ${props.className ?? ""}`}
    />
  );
}

/** Themed select. */
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full border border-line bg-bg px-3 py-2 text-[13px] focus:border-ink focus:outline-none ${props.className ?? ""}`}
    />
  );
}

/** Themed textarea. */
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border border-line bg-bg px-3 py-2 text-[13px] focus:border-ink focus:outline-none ${props.className ?? ""}`}
    />
  );
}
