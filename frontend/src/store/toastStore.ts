import { create } from "zustand";

export type ToastVariant = "error" | "success" | "info";

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  pushToast: (message: string, variant?: ToastVariant, timeoutMs?: number) => void;
  removeToast: (id: number) => void;
  clear: () => void;
}

const DEFAULT_TIMEOUT_MS = 4500;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  pushToast: (message, variant = "error", timeoutMs = DEFAULT_TIMEOUT_MS) => {
    if (!message) return;
    const id = Date.now() + Math.floor(Math.random() * 1000);
    set((state) => ({
      toasts: [...state.toasts, { id, message, variant }],
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, timeoutMs);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  clear: () => set({ toasts: [] }),
}));
