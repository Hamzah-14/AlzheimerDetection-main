"use client";

import { useEffect, useMemo, useRef, useState, memo } from "react";
import { useRouter } from "next/navigation";
import { useTourStore } from "@/lib/tour-store";
import { usePageTitle } from "@/lib/use-page-title";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DASHBOARD_CASES, HEATMAP_CASES, type DashboardCase, type HeatmapCase } from "@/lib/cases";
import { useAnalysisStore } from "@/lib/analysis-store";
import {
  Brain,
  Activity,
  Scan,
  ShieldCheck,
  Cpu,
  Zap,
  ArrowUpRight,
  Upload,
  FileText,
  GitBranch,
  Microscope,
  TrendingUp,
  TrendingDown,
  Minus,
  MapPin,
} from "lucide-react";

type CaseRow = DashboardCase;

function useCountUp(to: number, decimals = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const dur = 700;
    const start = performance.now();
    let rafId: number;
    function tick(now: number) {
      const t = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setVal(parseFloat((eased * to).toFixed(decimals)));
      if (t < 1) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId); // cancel on unmount or prop change
  }, [to, decimals]);
  return val;
}

type HoverPreviewState = {
  caseData: CaseRow;
  top: number;
  left: number;
};

const SparkBars = memo(function SparkBars({
  data,
  tint = "purple",
}: {
  data: number[];
  tint?: "purple" | "green" | "white";
}) {
  const safe = data.length ? data : [1, 1, 1, 1, 1, 1, 1];
  const max = Math.max(...safe, 1);

  const tintClass =
    tint === "green"
      ? "bg-emerald-400/45"
      : tint === "white"
      ? "bg-white/35"
      : "bg-purple-400/45";

  return (
    <div className="relative mt-2 h-10">
      <div className="flex h-full items-end gap-1">
        {safe.map((v, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-full ${tintClass}`}
            style={{
              height: `${Math.max(10, Math.round((v / max) * 40))}px`,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-[#07070a]/35 to-transparent" />
    </div>
  );
});

const StatCard = memo(function StatCard({
  title,
  numericValue,
  unit = "",
  decimals = 0,
  sub,
  icon: Icon,
  spark = [],
  tint = "purple",
  trend,
  loading = false,
}: {
  title: string;
  numericValue: number;
  unit?: string;
  decimals?: number;
  sub: string;
  icon: React.ElementType;
  spark?: number[];
  tint?: "purple" | "green" | "white";
  /** positive = up (green), negative = down (red), 0 = flat (gray) */
  trend?: number;
  loading?: boolean;
}) {
  const count = useCountUp(numericValue, decimals);

  const tintClass =
    tint === "green"
      ? "bg-emerald-400/80"
      : tint === "white"
      ? "bg-white/70"
      : "bg-purple-400/80";

  const TrendIcon =
    trend === undefined ? null
    : trend > 0 ? TrendingUp
    : trend < 0 ? TrendingDown
    : Minus;

  const trendColor =
    trend === undefined ? ""
    : trend > 0 ? "text-emerald-400"
    : trend < 0 ? "text-red-400"
    : "text-white/40";

  const trendBg =
    trend === undefined ? ""
    : trend > 0 ? "bg-emerald-400/10 border-emerald-400/20"
    : trend < 0 ? "bg-red-400/10 border-red-400/20"
    : "bg-white/5 border-white/10";

  if (loading) {
    return (
      <Card className="glass relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="h-3 w-32 animate-pulse rounded-full bg-white/10" />
          <div className="h-10 w-10 animate-pulse rounded-2xl bg-white/5" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="h-8 w-20 animate-pulse rounded-xl bg-white/10" />
          <div className="h-3 w-28 animate-pulse rounded-full bg-white/5" />
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <div className="h-2 w-16 animate-pulse rounded-full bg-white/10" />
            <div className="mt-3 flex items-end gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 animate-pulse rounded-full bg-white/10"
                  style={{ height: `${16 + Math.random() * 24}px` }}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass glow-hover pulse-trigger relative">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-white/70">{title}</CardTitle>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <Icon className="h-5 w-5 text-white/90" />
        </div>
      </CardHeader>

      <CardContent className="space-y-1">
        <div className="flex items-end gap-2">
          <div className="text-3xl font-bold tracking-tight text-white">
            {count}{unit}
          </div>
          {TrendIcon && trend !== undefined && (
            <span
              className={`mb-1 flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[11px] font-medium ${trendColor} ${trendBg}`}
            >
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div className="text-xs text-white/50">{sub}</div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] text-white/50">Last 7 days</div>

          {spark.length === 0 ? (
            <div className="mt-2 h-10 rounded-xl border border-white/10 bg-white/5" />
          ) : (
            <div className="mt-2">
              <SparkBars data={spark} tint={tint} />
              <div className={`mt-2 h-[2px] w-10 rounded-full ${tintClass}`} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

const MiniHoverPreviewMRI = memo(function MiniHoverPreviewMRI({
  risk,
}: {
  risk: "High" | "Medium" | "Low";
}) {
  const overlayClass =
    risk === "High"
      ? "bg-[radial-gradient(circle_at_36%_48%,rgba(239,68,68,0.52),transparent_10%),radial-gradient(circle_at_64%_48%,rgba(249,115,22,0.40),transparent_12%)]"
      : risk === "Medium"
      ? "bg-[radial-gradient(circle_at_40%_48%,rgba(249,115,22,0.34),transparent_10%),radial-gradient(circle_at_60%_48%,rgba(168,85,247,0.24),transparent_12%)]"
      : "bg-[radial-gradient(circle_at_50%_52%,rgba(59,130,246,0.16),transparent_12%),radial-gradient(circle_at_44%_48%,rgba(168,85,247,0.12),transparent_14%)]";

  return (
    <div data-mri-preview className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.16),rgba(255,255,255,0.05)_24%,rgba(0,0,0,0.96)_62%)]" />
      <div className="absolute inset-0 opacity-[0.16] mix-blend-overlay bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:4px_4px]" />

      <div className="absolute inset-[12%] rounded-full border border-white/10 opacity-20" />
      <div className="absolute inset-[22%] rounded-full border border-white/10 opacity-15" />
      <div className="absolute left-[23%] top-[27%] h-[44%] w-[24%] rounded-full bg-white/10 blur-[6px]" />
      <div className="absolute right-[23%] top-[27%] h-[44%] w-[24%] rounded-full bg-white/10 blur-[6px]" />
      <div className="absolute left-[36%] top-[42%] h-[14%] w-[10%] rounded-full bg-white/8 blur-[4px]" />
      <div className="absolute right-[36%] top-[42%] h-[14%] w-[10%] rounded-full bg-white/8 blur-[4px]" />

      <div className={cn("absolute inset-0 mix-blend-screen", overlayClass)} />

      <div className="absolute left-2.5 top-2.5 rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-[10px] text-white/75 backdrop-blur-md">
        MRI Preview
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute bottom-[16%] left-1/2 top-[16%] w-px -translate-x-1/2 bg-white/10" />
        <div className="absolute left-[16%] right-[16%] top-1/2 h-px -translate-y-1/2 bg-white/10" />
      </div>
    </div>
  );
});

/* ── Risk Stratification Heatmap ─────────────────────────────────────────── */
const REGIONS = ["Hippocampus", "Entorhinal", "Temporal", "Prefrontal", "Parietal", "Frontal"] as const;

const RISK_DOT: Record<string, { fill: string; ring: string; label: string }> = {
  High:   { fill: "bg-red-400",    ring: "ring-red-400/30",    label: "text-red-300"    },
  Medium: { fill: "bg-amber-400",  ring: "ring-amber-400/30",  label: "text-amber-300"  },
  Low:    { fill: "bg-cyan-400",   ring: "ring-cyan-400/30",   label: "text-cyan-300"   },
};

function RiskHeatmap({ cases }: { cases: HeatmapCase[] }) {
  const [hovered, setHovered] = useState<HeatmapCase | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDotEnter = (e: React.MouseEvent, c: HeatmapCase) => {
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    const dr = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipPos({
      x: dr.left - cr.left + dr.width / 2,
      y: dr.top  - cr.top,
    });
    setHovered(c);
  };

  const counts = { High: 0, Medium: 0, Low: 0 };
  cases.forEach(c => { counts[c.risk]++; });

  return (
    <Card className="glass glow-hover pulse-trigger">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-purple-300" />
          <CardTitle>Risk Stratification Map</CardTitle>
        </div>

        {/* legend + counts */}
        <div className="flex items-center gap-4 text-xs">
          {(["High","Medium","Low"] as const).map(r => (
            <span key={r} className={`flex items-center gap-1.5 ${RISK_DOT[r].label}`}>
              <span className={`inline-block h-2 w-2 rounded-full ${RISK_DOT[r].fill}`} />
              {r} · {counts[r]}
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <div ref={containerRef} className="relative select-none">
          {/* ── background risk zones ── */}
          <div className="pointer-events-none absolute inset-x-10 bottom-6 top-0 overflow-hidden rounded-xl">
            <div className="absolute inset-x-0 top-0 h-[28%] bg-gradient-to-b from-red-500/10 to-transparent" />
            <div className="absolute inset-x-0 top-[28%] h-[30%] bg-gradient-to-b from-amber-500/6 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 h-[42%] bg-gradient-to-t from-cyan-500/8 to-transparent" />
          </div>

          {/* ── threshold lines ── */}
          <div className="pointer-events-none absolute inset-x-10 bottom-6 top-0">
            {/* High / Medium boundary at 68% */}
            <div className="absolute inset-x-0 border-t border-dashed border-red-400/20" style={{ top: "32%" }}>
              <span className="absolute -top-3 right-0 text-[9px] text-red-400/50">High risk ≥ 68%</span>
            </div>
            {/* Medium / Low boundary at 45% */}
            <div className="absolute inset-x-0 border-t border-dashed border-amber-400/20" style={{ top: "55%" }}>
              <span className="absolute -top-3 right-0 text-[9px] text-amber-400/50">Med ≥ 45%</span>
            </div>
          </div>

          {/* ── plot area ── */}
          <div className="relative h-52 pl-10 pb-6">
            {/* Y-axis labels */}
            <div className="pointer-events-none absolute left-0 top-0 flex h-full flex-col justify-between pb-1 text-[9px] text-white/30">
              {["100%", "75%", "50%", "25%", "0%"].map(l => <span key={l}>{l}</span>)}
            </div>

            {/* region columns */}
            <div className="relative flex h-full items-stretch gap-1">
              {REGIONS.map(region => {
                const regionCases = cases.filter(c => c.region === region);
                return (
                  <div key={region} data-heatmap-col className="relative flex-1 border-r border-white/[0.05] last:border-r-0">
                    {regionCases.map(c => {
                      const topPct = (1 - c.confidence) * 100;
                      const dot = RISK_DOT[c.risk];
                      return (
                        <button
                          key={c.id}
                          className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full ${dot.fill} ring-2 ${dot.ring} transition-transform duration-150 hover:scale-150 hover:z-10 focus:outline-none`}
                          style={{ top: `${topPct}%` }}
                          onMouseEnter={e => handleDotEnter(e, c)}
                          onMouseLeave={() => setHovered(null)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* X-axis region labels */}
            <div className="absolute bottom-0 left-0 right-0 flex pl-10">
              {REGIONS.map(r => (
                <div key={r} className="flex-1 text-center text-[9px] text-white/35 truncate px-1">{r}</div>
              ))}
            </div>
          </div>

          {/* ── hover tooltip ── */}
          {hovered && (
            <div
              data-heatmap-tooltip
              className="pointer-events-none absolute z-20 w-44 -translate-x-1/2 -translate-y-full rounded-xl border border-white/10 bg-black/90 p-3 text-xs shadow-2xl backdrop-blur-xl"
              style={{ left: tooltipPos.x, top: tooltipPos.y - 8 }}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-semibold text-white">{hovered.id}</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                  hovered.risk === "High"   ? "bg-red-400/15 text-red-300" :
                  hovered.risk === "Medium" ? "bg-amber-400/15 text-amber-300" :
                  "bg-cyan-400/15 text-cyan-300"
                }`}>{hovered.risk}</span>
              </div>
              <div className="space-y-1 text-white/55">
                <div className="flex justify-between">
                  <span>Region</span>
                  <span className="text-white/80">{hovered.region}</span>
                </div>
                <div className="flex justify-between">
                  <span>Confidence</span>
                  <span className="text-white/80">{Math.round(hovered.confidence * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Top feature</span>
                  <span className="text-white/80">{hovered.feature}</span>
                </div>
                <div className="flex justify-between">
                  <span>Latency</span>
                  <span className="text-white/80">{hovered.latency}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="mt-2 text-[11px] text-white/35">
          Each dot is one case. Y = AI confidence · X = brain region. Hover to inspect.
        </p>
      </CardContent>
    </Card>
  );
}

const DONE_KEY   = "synapse-tour-done";
const PENDING_KEY = "synapse-show-tour";

export default function DashboardPage() {
  usePageTitle("Dashboard");
  const router = useRouter();
  const start = useTourStore((s) => s.start);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountPreviewRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── One-time tour auto-start when coming from the landing page ──
   *  Strict Mode runs effects twice; the flag is consumed on the first
   *  invocation so the second invocation is always a no-op.
   *  No cleanup is returned intentionally — see onboarding-tour.tsx note.
   * ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem(PENDING_KEY);
      if (!pending) return;
      sessionStorage.removeItem(PENDING_KEY); // consume — Strict Mode run-2 sees null → no-op
    } catch {
      return;
    }
    // 1500 ms gives sidebar/topbar animations time to finish before measuring rects
    setTimeout(() => start(), 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // [] = once on mount; start() is a stable Zustand ref

  const storeCases = useAnalysisStore((s) => s.cases);

  // Convert real pipeline results to DashboardCase shape, prepend to static demo cases
  const realCases: DashboardCase[] = useMemo(() => storeCases.map((c) => {
    const pred = c.result.final.prediction;
    const conf = c.result.final.confidence;
    return {
      id:             c.id,
      region:         c.region,
      risk:           c.risk,
      lat:            "~3.2s",
      status:         "Complete",
      confidence:     `${(conf * 100).toFixed(1)}%`,
      feature:        pred.includes("Alzheimer") ? "High AD texture signal" : pred.includes("MCI") ? "Asymmetric hippocampal texture" : "Normal texture pattern",
      note:           pred,
      recommendation: pred.includes("Alzheimer") ? "Refer to specialist" : pred.includes("MCI") ? "Monitor closely" : "Routine follow-up",
    };
  }), [storeCases]);

  const cases: CaseRow[] = useMemo(
    () => [...realCases, ...DASHBOARD_CASES],
    [realCases]
  );

  const totalProcessed = realCases.length + 28; // 28 = demo baseline
  const highRisk       = realCases.filter(c => c.risk === "High").length + 6;
  const inQueue        = Math.max(0, 3 - realCases.length);

  /* ── Throughput chart ─────────────────────────────────────────── */
  const throughput = [10, 12, 14, 13, 16, 18, 28];
  const maxThroughput = Math.max(...throughput);
  const dayLabels = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return days[d.getDay()];
    });
  }, []);
  const [chartMounted, setChartMounted] = useState(false);
  const [cardsLoaded, setCardsLoaded] = useState(false);

  const [hoveredPreview, setHoveredPreview] = useState<HoverPreviewState | null>(
    null
  );
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setChartMounted(true), 200);
    const t2 = setTimeout(() => setCardsLoaded(true), 650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (unmountPreviewRef.current) clearTimeout(unmountPreviewRef.current);
    };
  }, []);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (unmountPreviewRef.current) {
      clearTimeout(unmountPreviewRef.current);
      unmountPreviewRef.current = null;
    }
  };

  const scheduleHide = () => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setPreviewVisible(false);

      unmountPreviewRef.current = setTimeout(() => {
        setHoveredPreview(null);
      }, 160);
    }, 100);
  };

  const handleRowEnter = (
    e: React.MouseEvent<HTMLTableRowElement>,
    caseData: CaseRow
  ) => {
    clearHideTimer();

    const rowRect = e.currentTarget.getBoundingClientRect();

    const previewHeight = 320;
    const viewportPadding = 16;
    const left = Math.max(viewportPadding, rowRect.right - 200);

    let top = rowRect.top + rowRect.height / 2 - previewHeight / 2;

    if (top + previewHeight > window.innerHeight - viewportPadding) {
      top = window.innerHeight - previewHeight - viewportPadding;
    }

    if (top < viewportPadding) {
      top = viewportPadding;
    }

    setHoveredPreview({
      caseData,
      left,
      top,
    });

    requestAnimationFrame(() => {
      setPreviewVisible(true);
    });
  };

  return (
    <div className="flex h-[calc(100vh-88px)] flex-col overflow-y-auto p-6 pb-6">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-white/60">
            Hybrid AI + Clinical overview of recent scans and model outputs.
          </p>
        </div>

        {/* ── Quick Actions ──────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => router.push("/upload")}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
          >
            <Upload className="h-4 w-4" />
            Upload New Case
          </button>
          <button
            onClick={() => router.push("/reports")}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            <FileText className="h-4 w-4" />
            Reports
          </button>
          <button
            onClick={() => router.push("/explain")}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            <Microscope className="h-4 w-4" />
            Explainable AI
          </button>
          <button
            onClick={() => router.push("/timeline")}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            <GitBranch className="h-4 w-4" />
            Timeline
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Cases processed (7d)"
          numericValue={totalProcessed}
          sub="vs last week"
          trend={12}
          icon={Activity}
          spark={[10, 12, 14, 13, 16, 18, totalProcessed]}
          tint="purple"
          loading={!cardsLoaded}
        />
        <StatCard
          title="Avg inference latency"
          numericValue={0.42}
          unit=" s"
          decimals={2}
          sub="CPU baseline: 1.1 s"
          trend={-62}
          icon={ShieldCheck}
          spark={[1.1, 0.9, 0.7, 0.6, 0.52, 0.46, 0.42]}
          tint="white"
          loading={!cardsLoaded}
        />
        <StatCard
          title="High-risk flagged"
          numericValue={highRisk}
          sub="Needs clinician review"
          trend={50}
          icon={Brain}
          spark={[1, 2, 1, 3, 2, 4, 6]}
          tint="purple"
          loading={!cardsLoaded}
        />
        <StatCard
          title="Scans in queue"
          numericValue={inQueue}
          sub="Upload → preprocess → infer"
          trend={-25}
          icon={Scan}
          spark={[6, 5, 5, 4, 4, 3, 3]}
          tint="green"
          loading={!cardsLoaded}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="glass glow-hover pulse-trigger flex flex-col xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Cases</CardTitle>
            <div className="hidden text-xs text-white/50 sm:block">
              Last updated: <span className="text-white/80">just now</span>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col">
            <div
              className="overflow-hidden rounded-2xl border border-white/10"
              onMouseLeave={scheduleHide}
            >
              <table className="w-full text-sm text-white/90">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Case ID</th>
                    <th className="px-4 py-3 text-left font-medium">Region</th>
                    <th className="px-4 py-3 text-left font-medium">Risk</th>
                    <th className="px-4 py-3 text-left font-medium">Latency</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {cases.map((r) => (
                    <tr
                      key={r.id}
                      onMouseEnter={(e) => handleRowEnter(e, r)}
                      onClick={() =>
                        router.push(
                          `/viewer?case=${encodeURIComponent(
                            r.id
                          )}&region=${encodeURIComponent(r.region)}`
                        )
                      }
                      className="cursor-pointer transition duration-150 hover:bg-white/5"
                    >
                      <td className="px-4 py-3">{r.id}</td>
                      <td className="px-4 py-3 text-white/80">{r.region}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            "rounded-xl border px-2.5 py-1 text-xs font-medium " +
                            (r.risk === "High"
                              ? "border-red-400/20 bg-red-400/10 text-red-200"
                              : r.risk === "Medium"
                              ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
                              : "border-cyan-400/20 bg-cyan-400/10 text-cyan-200")
                          }
                        >
                          {r.risk}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/80">{r.lat}</td>
                      <td className="px-4 py-3 text-white/70">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-white/50">
              Hover a case to preview details. Click a row to open MRI Viewer.
            </p>
          </CardContent>
        </Card>

        <Card className="glass glow-hover pulse-trigger flex flex-col">
          <CardHeader>
            <CardTitle>Analytics & Model</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 pb-4">
            {/* ── Throughput chart ────────────────────────────────── */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between text-xs text-white/50">
                <span>Weekly Throughput</span>
                <span className="text-white/75">{throughput[throughput.length - 1]} cases today</span>
              </div>

              <div className="flex h-14 items-end gap-1">
                {throughput.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="relative w-full overflow-hidden rounded-t bg-white/5" style={{ height: "44px" }}>
                      <div
                        className="absolute bottom-0 w-full rounded-t bg-gradient-to-t from-purple-400/70 to-purple-300/25 transition-all duration-700 ease-out"
                        style={{
                          height: chartMounted
                            ? `${Math.round((v / maxThroughput) * 100)}%`
                            : "0%",
                          transitionDelay: `${i * 55}ms`,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-white/35">{dayLabels[i]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Model info ──────────────────────────────────────── */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Cpu className="h-4 w-4 text-white/50" />
                Pipeline
              </div>
              <div className="mt-1 font-semibold">
                3D GLCM → Radiomics → Classifier
              </div>
              <div className="mt-1 text-xs text-white/55">
                Contrast · Energy · Homogeneity (13-dir)
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Zap className="h-4 w-4 text-white/50" />
                Deployment
              </div>
              <div className="mt-1 font-semibold">Edge-ready · PYNQ-Z2</div>
              <div className="mt-1 text-xs text-white/55">
                Heatmap + Feature Attribution overlays
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Risk Stratification Heatmap ─────────────────────── */}
      <div className="mt-4 pb-6">
        <RiskHeatmap cases={HEATMAP_CASES} />
      </div>

      {hoveredPreview && (
        <div
          className="fixed z-[9999] w-[560px] transition-all duration-150 ease-out"
          style={{
            top: hoveredPreview.top,
            left: hoveredPreview.left,
            opacity: previewVisible ? 1 : 0,
            transform: previewVisible
              ? "translateY(0px) scale(1)"
              : "translateY(8px) scale(0.98)",
            transformOrigin: "left center",
          }}
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
        >
          <div data-hover-preview className="rounded-[24px] border border-white/10 bg-[rgba(8,8,12,0.96)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.62)] backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-medium text-white">
                Quick Preview
              </div>
              <div className="text-[11px] text-white/50">
                {hoveredPreview.caseData.id}
              </div>
            </div>

            <div className="grid grid-cols-[190px_1fr] gap-4">
              <MiniHoverPreviewMRI risk={hoveredPreview.caseData.risk} />

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="text-[11px] text-white/50">Confidence</div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {hoveredPreview.caseData.confidence}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="text-[11px] text-white/50">
                      Dominant Feature
                    </div>
                    <div className="mt-1 text-sm font-medium text-white">
                      {hoveredPreview.caseData.feature}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[11px] text-white/50">Quick Insight</div>
                  <p className="mt-1 text-xs leading-5 text-white/72">
                    {hoveredPreview.caseData.note}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[11px] text-white/50">
                    Recommendation
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/72">
                    {hoveredPreview.caseData.recommendation}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      router.push(
                        `/viewer?case=${encodeURIComponent(
                          hoveredPreview.caseData.id
                        )}&region=${encodeURIComponent(
                          hoveredPreview.caseData.region
                        )}`
                      )
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-purple-300 transition hover:bg-white/[0.1] hover:text-purple-200"
                  >
                    MRI Viewer
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      router.push(
                        `/timeline?case=${encodeURIComponent(
                          hoveredPreview.caseData.id
                        )}&region=${encodeURIComponent(
                          hoveredPreview.caseData.region
                        )}`
                      )
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.1] hover:text-white/90"
                  >
                    Timeline
                    <GitBranch className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}