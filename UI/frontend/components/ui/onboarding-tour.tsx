"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { useTourStore } from "@/lib/tour-store";
import { Portal } from "@/components/ui/portal";

const DONE_KEY = "synapse-tour-done";
const PENDING_KEY = "synapse-show-tour"; // set by landing page before routing
const PAD = 10;

/* 5 steps --- command-hint merged into topbar-search */
const STEPS = [
  {
    selector: "[data-tour='sidebar-header']",
    title: "Your Control Panel",
    desc: "Navigate between Dashboard, MRI Viewer, Explainability, Analytics, Reports and more --- everything lives in the sidebar.",
  },
  {
    selector: "[data-tour='topbar-search']",
    title: "Search & Command Palette",
    desc: "Click here or press ---K (Mac) / Ctrl+K (Windows) to open the command palette --- search cases, jump to any page, or trigger actions instantly.",
  },
  {
    selector: "[data-tour='fpga-status']",
    title: "Live FPGA Metrics",
    desc: "Real-time stats from the PYNQ-Z2 board --- utilisation, inference latency, and system status update every second.",
  },
  {
    selector: "[data-tour='theme-toggle']",
    title: "Light & Dark Mode",
    desc: "Toggle between light and dark themes. Your preference is saved automatically and persists across sessions.",
  },
  {
    selector: "[data-tour='new-case']",
    title: "Start an Analysis",
    desc: "Upload a new MRI scan here. The FPGA-accelerated pipeline will pre-process and score it in under 500 ms.",
  },
];

interface SpotRect { top: number; left: number; width: number; height: number; }

export function OnboardingTour() {
  const { active, step, start, setStep, end } = useTourStore();
  const [rect, setRect] = useState<SpotRect | null>(null);

  /* Auto-start is handled by dashboard/page.tsx --- nothing to do here */

  /* ------ Compute target bounding rect --------------------------------------------------------------------------------------- */
  const computeRect = useCallback(() => {
    const selector = STEPS[step]?.selector;
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useEffect(() => {
    if (!active) { setRect(null); return; }
    const t = setTimeout(computeRect, 80);
    window.addEventListener("resize", computeRect);
    window.addEventListener("scroll", computeRect, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", computeRect);
      window.removeEventListener("scroll", computeRect, true);
    };
  }, [active, step, computeRect]);

  /* ------ Keyboard nav ------------------------------------------------------------------------------------------------------------------------------------------ */
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleEnd();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleEnd = () => {
    end();
    try { localStorage.setItem(DONE_KEY, "1"); } catch {}
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleEnd();
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!active || !rect) return null;

  const spotTop  = rect.top  - PAD;
  const spotLeft = rect.left - PAD;
  const spotW    = rect.width  + PAD * 2;
  const spotH    = rect.height + PAD * 2;

  const TOOLTIP_H = 240;
  const TOOLTIP_W = 310;
  const spaceBelow = window.innerHeight - (rect.top + rect.height + PAD);
  const spaceAbove = rect.top - PAD;
  const above = spaceBelow < TOOLTIP_H + 24 && spaceAbove >= TOOLTIP_H + 24;

  const tooltipTopRaw = above
    ? spotTop - TOOLTIP_H - 16
    : spotTop + spotH + 16;

  /* Always keep tooltip inside viewport */
  const tooltipTop = Math.max(
    PAD,
    Math.min(tooltipTopRaw, window.innerHeight - TOOLTIP_H - PAD)
  );

  const tooltipLeft = Math.max(
    16,
    Math.min(spotLeft, window.innerWidth - TOOLTIP_W - 16)
  );

  return (
    <Portal>
      <AnimatePresence mode="wait">
        {active && (
          <>
            {/* ------ Spotlight --------------------------------------------------------------------------------------------------------------------- */}
            <motion.div
              key={`spot-${step}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                position: "fixed",
                top: spotTop,
                left: spotLeft,
                width: spotW,
                height: spotH,
                borderRadius: 16,
                zIndex: 9980,
                pointerEvents: "none",
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
                outline: "2px solid rgba(168, 85, 247, 0.55)",
              }}
            />

            {/* ------ Tooltip --------------------------------------------------------------------------------------------------------------------------- */}
            <motion.div
              key={`tip-${step}`}
              initial={{ opacity: 0, y: above ? 10 : -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed",
                top: tooltipTop,
                left: tooltipLeft,
                width: TOOLTIP_W,
                zIndex: 9981,
              }}
              className="rounded-2xl border border-white/10 bg-[#0f0d1e]/96 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">
                    {step + 1} of {STEPS.length}
                  </span>
                </div>
                <button
                  onClick={handleEnd}
                  className="rounded-lg p-1 text-white/35 transition hover:text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h3 className="mb-2 text-[15px] font-semibold text-white">
                {STEPS[step].title}
              </h3>
              <p className="text-sm leading-relaxed text-white/50">
                {STEPS[step].desc}
              </p>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {STEPS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === step
                          ? "w-5 bg-purple-400"
                          : i < step
                          ? "w-1.5 bg-purple-400/40"
                          : "w-1.5 bg-white/15"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {step > 0 && (
                    <button
                      onClick={handlePrev}
                      className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-1 rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-purple-500"
                  >
                    {step === STEPS.length - 1 ? "Done" : "Next"}
                    {step < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}
