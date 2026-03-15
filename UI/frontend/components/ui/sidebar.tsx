"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Upload,
  Scan,
  Brain,
  BrainCircuit,
  Activity,
  BarChart3,
  FileText,
  Settings,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { useTourStore } from "@/lib/tour-store";
import { useAnalysisStore } from "@/lib/analysis-store";

type NavItem = { label: string; href: string; icon: React.ElementType };
type NavGroup = { id: string; heading: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    id: "cases",
    heading: "Cases",
    items: [
      { label: "Upload MRI", href: "/upload",   icon: Upload   },
      { label: "MRI Viewer", href: "/viewer",   icon: Scan     },
    ],
  },
  {
    id: "intelligence",
    heading: "Intelligence",
    items: [
      { label: "Explainable AI", href: "/explain",   icon: BrainCircuit },
      { label: "Timeline",       href: "/timeline",  icon: Activity },
      { label: "Analytics",      href: "/analytics", icon: BarChart3},
      { label: "Reports",        href: "/reports",   icon: FileText },
    ],
  },
];

/* ── Shared nav-link renderer ───────────────────────────────── */
function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-active={active ? "true" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition-colors",
        active ? "text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
      )}
    >
      {/* Animated sliding pill — shared layoutId across all items */}
      {active && (
        <motion.div
          layoutId="sidebar-pill"
          className="absolute inset-0 rounded-2xl border border-white/10 bg-white/10"
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
        />
      )}

      <div
        data-active-icon={active ? "true" : undefined}
        className={cn(
          "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
          active
            ? "border-white/15 bg-white/10"
            : "border-transparent bg-transparent group-hover:border-white/10 group-hover:bg-white/5"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      {!collapsed && (
        <span className="relative z-10 font-medium">{item.label}</span>
      )}
    </Link>
  );
}

/* ── Main sidebar ────────────────────────────────────────────── */
// Pages that should deep-link to the latest real case when one exists
const CASE_PAGES = new Set(["/viewer", "/explain", "/timeline", "/reports"]);

export function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const startTour = useTourStore((s) => s.start);
  const latestCase = useAnalysisStore((s) => s.latestCase());

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [collapsed,  setCollapsed]  = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(GROUPS.map((g) => [g.id, true]))
  );

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  // Build a href that deep-links to the latest real case (if any).
  // Only applied after mount so SSR and initial client render agree.
  const smartHref = (base: string) => {
    if (mounted && latestCase && CASE_PAGES.has(base)) {
      return `${base}?case=${encodeURIComponent(latestCase.id)}&region=${encodeURIComponent(latestCase.region)}`;
    }
    return base;
  };

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        "flex min-h-screen self-stretch shrink-0 flex-col border-r border-white/10 bg-black/60 backdrop-blur transition-[width] duration-200",
        collapsed ? "w-20" : "w-72"
      )}
    >
      <div className="flex min-h-screen flex-1 flex-col">

        {/* ── Header ────────────────────────────────────────── */}
        <div
          data-tour="sidebar-header"
          className={cn("px-3 py-4", collapsed && "space-y-3")}
        >
          <div className={cn("flex items-center", collapsed ? "flex-col gap-3" : "justify-between")}>
            <Link
              href="/"
              className={cn("group flex items-center gap-3", collapsed && "flex-col")}
              title="Back to home"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 transition group-hover:border-purple-400/40 group-hover:bg-purple-500/15">
                <Brain className="h-5 w-5 text-white transition group-hover:text-purple-300" />
              </div>
              {!collapsed && (
                <div className="leading-tight">
                  <div className="font-semibold text-white transition group-hover:text-purple-200">
                    Synapse<span className="text-purple-400">.PL</span>
                  </div>
                  <div className="text-xs text-white/50 tracking-wide">
                    Precision Neurodiagnostics
                  </div>
                </div>
              )}
            </Link>

            <button
              onClick={() => setCollapsed((v) => !v)}
              className={cn(
                "rounded-xl p-2 transition hover:bg-white/10",
                collapsed && "flex h-10 w-10 items-center justify-center"
              )}
              aria-label="Toggle sidebar"
            >
              {collapsed
                ? <PanelLeftOpen  className="h-5 w-5 text-white/80" />
                : <PanelLeftClose className="h-5 w-5 text-white/80" />}
            </button>
          </div>
        </div>

        {/* ── Nav ───────────────────────────────────────────── */}
        <nav className="flex-1 px-2 py-2">
          {/* Dashboard — always visible, no group header */}
          <div className="mb-2">
            <NavLink
              item={{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }}
              active={pathname === "/dashboard"}
              collapsed={collapsed}
            />
          </div>

          {/* Collapsible groups */}
          {GROUPS.map((group) => {
            const isOpen = openGroups[group.id];

            return (
              <div key={group.id} className="mb-1">
                {/* Section header — hidden when collapsed */}
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30 transition hover:text-white/55"
                  >
                    {group.heading}
                    <motion.span
                      animate={{ rotate: isOpen ? 0 : -90 }}
                      transition={{ duration: 0.18 }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </motion.span>
                  </button>
                )}

                {/* Items — animated height collapse */}
                <AnimatePresence initial={false}>
                  {(collapsed || isOpen) && (
                    <motion.div
                      key={group.id + "-items"}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-0.5 pb-1">
                        {group.items.map((item) => (
                          <NavLink
                            key={item.href}
                            item={{ ...item, href: smartHref(item.href) }}
                            active={pathname === item.href}
                            collapsed={collapsed}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* ── Footer ────────────────────────────────────────── */}
        <div className="mt-auto border-t border-white/10 p-3">
          <NavLink
            item={{ label: "About", href: "/about", icon: Info }}
            active={pathname === "/about"}
            collapsed={collapsed}
          />
          <NavLink
            item={{ label: "Settings", href: "/settings", icon: Settings }}
            active={pathname === "/settings"}
            collapsed={collapsed}
          />

          {!collapsed && (
            <div className="mt-3 space-y-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => router.push("/upload")}
              >
                New Case
              </Button>
              <button
                onClick={() => {
                  localStorage.removeItem("synapse-tour-done");
                  startTour();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] py-2 text-xs text-white/40 transition hover:bg-white/[0.06] hover:text-white/60"
              >
                <MapPin className="h-3.5 w-3.5" />
                Take a tour
              </button>
            </div>
          )}
        </div>

      </div>
    </aside>
  );
}
