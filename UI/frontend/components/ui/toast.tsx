"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import { useToast, type ToastType } from "@/contexts/toast-context";
import { Portal } from "@/components/ui/portal";

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const ACCENT: Record<ToastType, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  info: "text-blue-400",
  warning: "text-amber-400",
};

const BORDER: Record<ToastType, string> = {
  success: "border-emerald-500/25",
  error: "border-red-500/25",
  info: "border-blue-500/25",
  warning: "border-amber-500/25",
};

export function ToastStack() {
  const { toasts, dismiss } = useToast();

  return (
    <Portal>
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col-reverse gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.92 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-auto flex w-[340px] items-start gap-3 rounded-2xl border ${BORDER[t.type]} bg-black/85 p-4 shadow-2xl backdrop-blur-xl`}
            >
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${ACCENT[t.type]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-white/55">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded-lg p-1 text-white/35 transition hover:text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
    </Portal>
  );
}
