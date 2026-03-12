"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  LayoutDashboard,
  Upload,
  Scan,
  Brain,
  Activity,
  BarChart3,
  FileText,
  Settings,
  Plus,
  Sun,
  Map,
  ArrowRight,
  CornerDownLeft,
} from "lucide-react";
import { useCommandPaletteStore } from "@/lib/command-palette-store";
import { useTourStore } from "@/lib/tour-store";
import { useTheme } from "@/contexts/theme-context";
import { DASHBOARD_CASES } from "@/lib/cases";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal";

/* ── Item definitions ─────────────────────────────────────── */
interface CPItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  group: "navigate" | "action" | "case";
  onSelect: () => void;
  shortcut?: string;
}

const GROUP_LABELS: Record<string, string> = {
  navigate: "Pages",
  action: "Actions",
  case: "Recent Cases",
};

/* Detect modifier key label client-side */
function useModKey() {
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) {
      setMod("⌘");
    }
  }, []);
  return mod;
}

function highlight(text: string, query: string) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-purple-500/30 text-purple-200 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface AnchorRect { top: number; left: number; width: number; height: number; }

export function CommandPalette() {
  const { open, setOpen } = useCommandPaletteStore();
  const { toggleTheme } = useTheme();
  const tourStore = useTourStore();
  const router = useRouter();
  const modKey = useModKey();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [anchor, setAnchor] = useState<AnchorRect>({ top: 0, left: 0, width: 600, height: 40 });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* Snap to topbar search button position when opening */
  useEffect(() => {
    if (!open) return;
    const el = document.querySelector("[data-tour='topbar-search']");
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [open]);

  /* Build items */
  const navItems: CPItem[] = [
    { id: "dashboard",   label: "Dashboard",      icon: LayoutDashboard, group: "navigate", onSelect: () => router.push("/dashboard") },
    { id: "upload",      label: "Upload MRI",     icon: Upload,          group: "navigate", onSelect: () => router.push("/upload") },
    { id: "viewer",      label: "MRI Viewer",     icon: Scan,            group: "navigate", onSelect: () => router.push("/viewer") },
    { id: "explain",     label: "Explainable AI", icon: Brain,           group: "navigate", onSelect: () => router.push("/explain") },
    { id: "timeline",    label: "Timeline",       icon: Activity,        group: "navigate", onSelect: () => router.push("/timeline") },
    { id: "analytics",   label: "Analytics",      icon: BarChart3,       group: "navigate", onSelect: () => router.push("/analytics") },
    { id: "reports",     label: "Reports",        icon: FileText,        group: "navigate", onSelect: () => router.push("/reports") },
    { id: "settings",    label: "Settings",       icon: Settings,        group: "navigate", onSelect: () => router.push("/settings") },
  ];

  const actionItems: CPItem[] = [
    { id: "new-case",    label: "New Case",       description: "Upload a new MRI scan",     icon: Plus,   group: "action", onSelect: () => router.push("/upload"),     shortcut: "N" },
    { id: "theme",       label: "Toggle Theme",   description: "Switch light / dark mode",  icon: Sun,    group: "action", onSelect: () => toggleTheme() },
    { id: "tour",        label: "Start Tour",     description: "Guided platform walkthrough", icon: Map,  group: "action", onSelect: () => { tourStore.start(); } },
  ];

  /* When no query: show 4 recent cases. When filtering: search ALL cases */
  const casePool = query.trim() ? DASHBOARD_CASES : DASHBOARD_CASES.slice(0, 4);
  const caseItems: CPItem[] = casePool.map((c) => ({
    id: `case-${c.id}`,
    label: c.id,
    description: `${c.region} · Risk: ${c.risk}`,
    icon: Scan,
    group: "case" as const,
    onSelect: () => router.push(`/viewer?case=${encodeURIComponent(c.id)}&region=${encodeURIComponent(c.region)}`),
  }));

  const allItems = [...navItems, ...actionItems, ...caseItems];

  /* Filter */
  const filtered = query.trim()
    ? allItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  /* Group filtered items */
  const grouped = (["navigate", "action", "case"] as const)
    .map((group) => ({
      group,
      items: filtered.filter((i) => i.group === group),
    }))
    .filter((g) => g.items.length > 0);

  /* Flat list for keyboard nav */
  const flatItems = grouped.flatMap((g) => g.items);

  /* Open / close */
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, [setOpen]);

  /* Global ⌘K / Ctrl+K */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        useCommandPaletteStore.getState().toggle();
        setQuery("");
        setCursor(0);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* Focus input when opens */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  /* Keyboard navigation inside palette */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flatItems[cursor]?.onSelect();
      close();
    } else if (e.key === "Escape") {
      close();
    }
  };

  /* Scroll cursor item into view */
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cursor="true"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  /* Reset cursor on query change */
  useEffect(() => setCursor(0), [query]);

  return (
    <Portal>
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cp-backdrop"
            data-cp-backdrop
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[8888] bg-black/60 backdrop-blur-sm"
            onClick={close}
          />

          {/* Panel — anchored to topbar search bar */}
          <motion.div
            key="cp-panel"
            data-cp-panel
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "fixed",
              top: anchor.top,
              left: anchor.left,
              width: anchor.width,
              zIndex: 8889,
            }}
            className="overflow-hidden rounded-2xl border border-white/15 bg-[#0b0a18]/98 shadow-2xl shadow-black/60 backdrop-blur-2xl"
            onKeyDown={onKeyDown}
          >
            {/* Search row — same height as the topbar button it replaces */}
            <div
              className="flex items-center gap-3 border-b border-white/[0.07] px-4"
              style={{ height: anchor.height }}
            >
              <Search className="h-4 w-4 shrink-0 text-purple-400/80" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, actions, cases…"
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
              />
              <div className="flex items-center gap-1.5">
                <kbd className="rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/35">
                  {modKey}K
                </kbd>
                <kbd className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/35">
                  Esc
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[380px] overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-white/35">
                  No results for &ldquo;{query}&rdquo;
                </div>
              ) : (
                grouped.map(({ group, items }) => {
                  return (
                    <div key={group} className="mb-1">
                      <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                        {GROUP_LABELS[group]}
                      </div>
                      {items.map((item) => {
                        const flatIdx = flatItems.indexOf(item);
                        const active = flatIdx === cursor;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            data-cursor={active ? "true" : undefined}
                            onClick={() => { item.onSelect(); close(); }}
                            onMouseEnter={() => setCursor(flatIdx)}
                            className={cn(
                              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition",
                              active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                            )}
                          >
                            <div className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition",
                              active
                                ? "border-purple-500/30 bg-purple-500/15 text-purple-300"
                                : "border-white/[0.07] bg-white/[0.04] text-white/50"
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-white/85">
                                {highlight(item.label, query)}
                              </div>
                              {item.description && (
                                <div className="text-xs text-white/40">
                                  {highlight(item.description, query)}
                                </div>
                              )}
                            </div>

                            {item.shortcut && (
                              <kbd className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/35">
                                {item.shortcut}
                              </kbd>
                            )}

                            {active && (
                              <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-white/25" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer hint */}
            <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center gap-4 text-[10px] text-white/25">
              <span className="flex items-center gap-1"><kbd className="rounded border border-white/10 px-1 py-0.5">↑↓</kbd> Navigate</span>
              <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> Select</span>
              <span className="flex items-center gap-1"><kbd className="rounded border border-white/10 px-1 py-0.5">Esc</kbd> Close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </Portal>
  );
}
