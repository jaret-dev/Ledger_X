import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Minimal toast system — global context that any component can dispatch
 * into. Three kinds:
 *   - success: green check, auto-dismiss in 3s
 *   - error:   red bar, sticky until dismissed
 *   - undo:    bordered, has an action button + 5s countdown (BUILD_PLAN
 *              §6 done-when: "Undo works for destructive actions").
 */

export type ToastKind = "success" | "error" | "undo";

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
};

type Ctx = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `t-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { ...t, id }]);
      return id;
    },
    [],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToasts(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within <ToasterProvider>");
  return ctx;
}

// ─── Viewport ───────────────────────────────────────────────────────

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-[360px] flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  const defaultDuration =
    toast.kind === "error" ? Number.POSITIVE_INFINITY : toast.kind === "undo" ? 5000 : 3000;
  const duration = toast.durationMs ?? defaultDuration;

  // Countdown bar for undo toasts gives a clear visual deadline.
  const [remaining, setRemaining] = useState(duration);
  useEffect(() => {
    if (!Number.isFinite(duration)) return;
    const tick = 100;
    const interval = setInterval(() => {
      setRemaining((r) => {
        const next = r - tick;
        if (next <= 0) {
          clearInterval(interval);
          dismiss(toast.id);
          return 0;
        }
        return next;
      });
    }, tick);
    return () => clearInterval(interval);
  }, [toast.id, duration, dismiss]);

  const tone =
    toast.kind === "success"
      ? "border-success bg-card text-ink"
      : toast.kind === "error"
        ? "border-danger bg-card text-danger"
        : "border-line bg-card text-ink";

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden border ${tone} px-4 py-3 shadow-sm`}
      role={toast.kind === "error" ? "alert" : "status"}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px]">{toast.message}</span>
        <div className="flex items-center gap-2">
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action!.onClick();
                dismiss(toast.id);
              }}
              className="font-mono text-[10px] uppercase tracking-widest text-accent hover:underline"
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
            className="font-mono text-[14px] leading-none text-ink-3 hover:text-ink"
          >
            ×
          </button>
        </div>
      </div>
      {Number.isFinite(duration) && (
        <div
          className="absolute bottom-0 left-0 h-px bg-ink-3"
          style={{ width: `${(remaining / duration) * 100}%` }}
        />
      )}
    </div>
  );
}
