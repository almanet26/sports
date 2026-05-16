import React from "react";
import { useToastStore } from "../../store/toastStore";

const VARIANT_CLASSES: Record<
  "error" | "success" | "info",
  { border: string; bg: string; text: string; icon: string }
> = {
  error: {
    border: "border-red-500/40",
    bg: "bg-red-500/15",
    text: "text-red-200",
    icon: "fas fa-exclamation-circle",
  },
  success: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/15",
    text: "text-emerald-200",
    icon: "fas fa-check-circle",
  },
  info: {
    border: "border-blue-500/40",
    bg: "bg-blue-500/15",
    text: "text-blue-200",
    icon: "fas fa-info-circle",
  },
};

export default function ToastHost() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2">
      {toasts.map((toast) => {
        const style = VARIANT_CLASSES[toast.variant] ?? VARIANT_CLASSES.info;
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur ${style.border} ${style.bg} ${style.text}`}
          >
            <i className={`${style.icon} mt-0.5`} />
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="ml-1 text-xs opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
