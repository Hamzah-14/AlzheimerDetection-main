"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar } from "@/components/ui/sidebar";
import { Topbar } from "@/components/ui/topbar";
import { ThemeProvider } from "@/contexts/theme-context";
import { ToastProvider } from "@/contexts/toast-context";
import { ToastStack } from "@/components/ui/toast";
import { CommandPalette } from "@/components/ui/command-palette";
import { OnboardingTour } from "@/components/ui/onboarding-tour";
import NeuroAssist from "@/components/ui/neuro-assist";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  /* No mousemove handler needed — background animation is CSS-only (compositor). */

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="flex min-h-screen bg-transparent">
          <Sidebar />

          <div className="flex min-h-screen flex-1 flex-col">
            <Topbar />

            {/* ── Page transition wrapper ── */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.main
                key={pathname}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex-1 p-6 pt-6 pb-0"
              >
                {children}
              </motion.main>
            </AnimatePresence>
          </div>
        </div>

        {/* ── Global overlays ── */}
        <CommandPalette />
        <ToastStack />
        <OnboardingTour />
        <NeuroAssist />
      </ToastProvider>
    </ThemeProvider>
  );
}
