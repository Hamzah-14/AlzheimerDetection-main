"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search, Bell, Plus, Activity, Cpu, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/theme-context";
import { useCommandPaletteStore } from "@/lib/command-palette-store";

export function Topbar() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const openCP = useCommandPaletteStore((s) => s.setOpen);
  const [tick, setTick] = useState(0);

  /* ------ Live FPGA ticker --------------------------------------------------------------------------------------------------------------------------------- */
  useEffect(() => {
    const id = setInterval(() => {
      setTick((v) => (v + 1) % 100);
    }, 1200);
    return () => clearInterval(id);
  }, []);

  const liveUtil = 62 + (tick % 4) * 6;
  const liveLatency = 0.42 + ((tick % 3) - 1) * 0.02;

  /* Detect platform for shortcut label */
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-black/45 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(900px_220px_at_30%_0%,rgba(168,85,247,0.14),transparent_60%)]" />

      <div className="relative flex items-center gap-2 px-4 py-3">
        {/* ------ Command palette trigger (replaces old search input) ------ */}
        <button
          data-tour="topbar-search"
          onClick={() => openCP(true)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-left transition",
            "text-white/40 hover:border-white/15 hover:bg-white/[0.08] hover:text-white/60"
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-white/35" />
          <span className="flex-1 truncate text-sm">
            Search cases, pages, actions---
          </span>
          <kbd className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">
            {isMac ? "---K" : "Ctrl+K"}
          </kbd>
        </button>

        {/* ------ Live status pills --------------------------------------------------------------------------------------------------------- */}
        <div className="hidden items-center gap-2 xl:flex" data-tour="fpga-status">
          <span className="flex h-9 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs text-white/70 whitespace-nowrap">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            Status: <span className="text-emerald-300">Online</span>
          </span>

          <span className="flex h-9 items-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs text-white/70 whitespace-nowrap">
            FPGA: <span className="ml-1 text-white/90">PYNQ-Z2</span>
          </span>

          <span className="flex h-9 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs text-white/70 whitespace-nowrap">
            <Activity className="h-3.5 w-3.5 text-purple-300" />
            Inference: <span className="text-white/90">{liveLatency.toFixed(2)}s</span>
          </span>

          <div className="w-[128px] rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-[10px] text-white/55">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Cpu className="h-3 w-3 text-emerald-300" />
                FPGA
              </span>
              <span className="text-white/75">{liveUtil}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-purple-400 transition-all duration-700"
                style={{ width: `${liveUtil}%` }}
              />
            </div>
          </div>
        </div>

        {/* ------ Theme toggle --------------------------------------------------------------------------------------------------------------- */}
        <button
          data-tour="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle light/dark mode"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-2xl border transition",
            "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
          )}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        <Button variant="outline" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <Button data-tour="new-case" onClick={() => router.push("/upload")}>
          <Plus className="mr-2 h-4 w-4" />
          New Case
        </Button>
      </div>
    </header>
  );
}
