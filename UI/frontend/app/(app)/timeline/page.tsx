"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartTooltip, ReferenceLine, ReferenceArea,
} from "recharts";
import { useAnalysisStore, type AnalysisCase, type TemporalProgression, type TemporalMetricSide, type ProgressionSummary } from "@/lib/analysis-store";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  TIMELINE_DATA,
  type DatasetClass,
  type TimelineStatus,
  type TimelineEvent,
} from "@/lib/cases";
import { CaseSwitcher } from "@/components/ui/case-switcher";
import {
  Activity,
  Clock3,
  Brain,
  Scan,
  Cpu,
  FileText,
  ShieldCheck,
  LayoutDashboard,
  ChevronRight,
  CheckCircle2,
  CircleDashed,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";
import { EmptyState } from "@/components/ui/empty-state";

// -- Temporal Progression Panel ---------------------------------------------

const METRIC_SENTIMENT: Record<string, "good_up" | "bad_up" | "neutral"> = {
  Contrast:      "bad_up",
  Dissimilarity: "bad_up",
  Homogeneity:   "good_up",
  Energy:        "good_up",
  Entropy:       "neutral",
};

// Clinical-friendly labels for each GLCM feature
const FEATURE_FRIENDLY: Record<string, string> = {
  Contrast:      "Local structural variability",
  Entropy:       "Texture complexity",
  Dissimilarity: "Neighboring heterogeneity",
  Homogeneity:   "Tissue uniformity",
  Energy:        "Pattern regularity",
};

function ChangeCell({ side, label }: { side: TemporalMetricSide; label: string }) {
  if (side.direction === "stable") return <span className="text-white/30">---</span>;
  const s = METRIC_SENTIMENT[label] ?? "neutral";
  const color =
    s === "neutral"  ? "text-amber-400" :
    s === "good_up"  ? (side.direction === "up" ? "text-emerald-400" : "text-red-400") :
    /* bad_up */       (side.direction === "up" ? "text-red-400"     : "text-emerald-400");
  const arrow = side.direction === "up" ? "---" : "---";
  const sign  = side.delta_pct > 0 ? "+" : "";
  return <span className={color}>{arrow} {sign}{side.delta_pct.toFixed(1)}%</span>;
}

// -- Interpretation helpers --------------------------------------------------

type SeverityTier   = "stable" | "mild" | "progressive";
type ConfidenceLevel = "low" | "moderate" | "high";
type AsymClass      = "minimal" | "mild" | "notable";

function deriveSeverity(ps: ProgressionSummary): SeverityTier {
  const maxAbs = Math.max(Math.abs(ps.L.latest), Math.abs(ps.R.latest));
  if (maxAbs < 0.10) return "stable";
  if (maxAbs < 0.40) return "mild";
  return "progressive";
}

function deriveConfidence(nScans: number, months: number): ConfidenceLevel {
  if (nScans <= 2 || months < 6)  return "low";
  if (nScans <= 4 || months < 18) return "moderate";
  return "high";
}

function deriveAsymClass(asymDelta: number): AsymClass {
  const a = Math.abs(asymDelta);
  if (a < 0.05) return "minimal";
  if (a < 0.15) return "mild";
  return "notable";
}

function generateInterpretation(
  tp: TemporalProgression,
  severity: SeverityTier,
  asymClass: AsymClass,
): { clinician: string; patient: string } {
  const ps     = tp.progression_summary;
  const n      = tp.n_scans;
  const months = tp.followup_months.toFixed(1);
  const lAnn   = (ps.L.annualized_slope * 100).toFixed(1);
  const rAnn   = (ps.R.annualized_slope * 100).toFixed(1);
  const lAbs   = Math.abs(ps.L.latest);
  const rAbs   = Math.abs(ps.R.latest);
  const dominant = lAbs > rAbs * 1.2 ? "left" : rAbs > lAbs * 1.2 ? "right" : null;

  let clinician = "";
  let patient   = "";

  if (severity === "stable") {
    clinician =
      `Across ${n} MRI scan${n !== 1 ? "s" : ""} over ${months} months, both left and right hippocampal composite texture scores remained within stable variation (< 10% deviation from baseline). ` +
      (asymClass === "minimal"
        ? `Side-to-side divergence was minimal (asymmetry --: ${(ps.asym_delta * 100).toFixed(1)}%). `
        : `Mild side asymmetry was noted (--: ${(ps.asym_delta * 100).toFixed(1)}%), but absolute magnitudes remained within stable bounds. `) +
      `The observed longitudinal variation is more consistent with scan-to-scan variability than with progressive neurodegenerative texture change. Review alongside clinical assessment.`;
    patient =
      `Your hippocampus scan patterns have remained largely unchanged over the ${months}-month follow-up period. ` +
      `The measurements taken from each of your ${n} scan${n !== 1 ? "s" : ""} are consistent with stability --- there is no clear evidence of progressive change in this analysis.`;
  } else if (severity === "mild") {
    clinician =
      `Across ${n} MRI scan${n !== 1 ? "s" : ""} over ${months} months, hippocampal texture irregularity showed mild longitudinal change (composite index --- L: ${parseFloat(lAnn) >= 0 ? "+" : ""}${lAnn}%/yr, R: ${parseFloat(rAnn) >= 0 ? "+" : ""}${rAnn}%/yr). ` +
      (dominant ? `The ${dominant} hippocampus showed relatively greater longitudinal progression. ` : `Both sides progressed at a comparable pace. `) +
      `This pattern is consistent with early-phase texture irregularity evolution. Clinical follow-up and correlation with CSF biomarker data is recommended.`;
    patient =
      `Your hippocampus scan patterns show a mild change over your ${months}-month follow-up period across ${n} scan${n !== 1 ? "s" : ""}. ` +
      `This is a subtle shift that your clinical team will monitor over time. Regular follow-up scans help track whether this trend continues, stabilises, or reverses.`;
  } else {
    clinician =
      `Across ${n} MRI scan${n !== 1 ? "s" : ""} over ${months} months, hippocampal texture progression exceeded the provisional moderate-change threshold, with sustained increases in the composite texture irregularity index (L: ${parseFloat(lAnn) >= 0 ? "+" : ""}${lAnn}%/yr, R: ${parseFloat(rAnn) >= 0 ? "+" : ""}${rAnn}%/yr). ` +
      (dominant ? `The ${dominant} hippocampus showed more pronounced longitudinal deterioration. ` : "") +
      `This pattern warrants clinical attention and correlation with neuropsychological assessments, volumetric analysis, and biomarker panels.`;
    patient =
      `Your scan patterns have shown a more notable change over your ${months}-month follow-up. ` +
      `Your clinical team will review this alongside other test results to better understand what this means for you. This analysis is one piece of a larger clinical picture --- please discuss these results directly with your doctor.`;
  }

  return { clinician, patient };
}

// -- Temporal Progression Panel --- 5-layer redesign --------------------------

function TemporalProgressionPanel({ tp }: { tp: TemporalProgression }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const ps = tp.progression_summary;

  const severity   = deriveSeverity(ps);
  const confidence = deriveConfidence(tp.n_scans, tp.followup_months);
  const asymClass  = deriveAsymClass(ps.asym_delta);
  const { clinician, patient } = generateInterpretation(tp, severity, asymClass);

  // Scale composite scores --100 for % readability; score = 0 at baseline by construction
  const chartData = tp.scan_dates.map((month, i) => ({
    month,
    L: +(tp.progression_scores.L[i] * 100).toFixed(3),
    R: +(tp.progression_scores.R[i] * 100).toFixed(3),
  }));

  // Per-scan mean L---R asymmetry derived from raw feature l/r values
  const asymData = tp.scan_dates.map((month, i) => {
    const meanAsym = tp.metrics.length > 0
      ? tp.metrics.reduce((sum, m) => {
          const l = m.l_values?.[i] ?? 0;
          const r = m.r_values?.[i] ?? 0;
          return sum + (l - r) / (Math.abs(l + r) + 1e-8);
        }, 0) / tp.metrics.length
      : 0;
    return { month, asym: +(meanAsym * 100).toFixed(3) };
  });

  const dirColor = (dir: string) =>
    dir === "stable" ? "text-white/50" : dir === "worsening" ? "text-red-400" : "text-emerald-400";

  const fmtRate = (v: number) =>
    `${(v * 100) >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%/yr`;

  // Badge styles per tier
  const severityStyle: Record<SeverityTier, string> = {
    stable:      "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    mild:        "border-amber-400/25 bg-amber-400/10 text-amber-300",
    progressive: "border-red-400/25 bg-red-400/10 text-red-300",
  };
  const severityLabel: Record<SeverityTier, string> = {
    stable: "Stable", mild: "Mild Change", progressive: "Progressive Change",
  };
  const confidenceStyle: Record<ConfidenceLevel, string> = {
    low:      "border-white/15 bg-white/5 text-white/50",
    moderate: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    high:     "border-violet-400/25 bg-violet-400/10 text-violet-300",
  };
  const asymStyle: Record<AsymClass, string> = {
    minimal: "border-white/15 bg-white/5 text-white/50",
    mild:    "border-amber-400/20 bg-amber-400/10 text-amber-300/70",
    notable: "border-orange-400/25 bg-orange-400/10 text-orange-300",
  };
  const asymLabel: Record<AsymClass, string> = {
    minimal: "Symmetric", mild: "Mild Asymmetry", notable: "Notable Asymmetry",
  };

  return (
    <div className="space-y-4">

      {/* -- LAYER 1: Clinical Summary --------------------------------------- */}
      <div className="glass pulse-trigger rounded-[28px] p-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-white/50" />
          <span className="text-sm font-medium text-white/80">Hippocampal Texture Progression</span>
        </div>
        <p className="mt-0.5 text-[11px] text-white/35">
          {tp.followup_months.toFixed(1)} months follow-up -- {tp.n_scans} scan{tp.n_scans !== 1 ? "s" : ""}
        </p>

        {/* Status badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={cn("rounded-2xl border px-3 py-1 text-xs font-semibold", severityStyle[severity])}>
            {severityLabel[severity]}
          </span>
          <span className={cn("rounded-2xl border px-3 py-1 text-xs font-medium", confidenceStyle[confidence])}>
            {confidence.charAt(0).toUpperCase() + confidence.slice(1)} Confidence
          </span>
          <span className={cn("rounded-2xl border px-3 py-1 text-xs font-medium", asymStyle[asymClass])}>
            {asymLabel[asymClass]}
          </span>
        </div>

        {/* Key stats row */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Follow-up",   value: `${tp.followup_months.toFixed(1)} mo`, cls: "text-white/70" },
            { label: "Scans",       value: `${tp.n_scans}`,                       cls: "text-white/70" },
            { label: "Left Change", value: `${ps.L.delta >= 0 ? "+" : ""}${(ps.L.delta * 100).toFixed(1)}%`,  cls: dirColor(ps.L.direction) },
            { label: "Right Change",value: `${ps.R.delta >= 0 ? "+" : ""}${(ps.R.delta * 100).toFixed(1)}%`,  cls: dirColor(ps.R.direction) },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-[10px] text-white/30">{label}</div>
              <div className={cn("mt-1 font-mono text-sm font-semibold", cls)}>{value}</div>
            </div>
          ))}
        </div>

        {/* Interpretation paragraphs */}
        <div className="mt-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-white/50 mb-1">Clinical Summary</p>
            <p className="text-sm leading-7 text-white/75">{clinician}</p>
          </div>
          <div className="border-t border-white/[0.05] pt-3">
            <p className="text-[11px] font-semibold text-white/35 mb-1">Patient Summary</p>
            <p className="text-sm leading-7 text-white/55">{patient}</p>
          </div>
        </div>
      </div>

      {/* -- LAYER 2: Main Progression Chart -------------------------------- */}
      <div className="glass pulse-trigger rounded-[28px] p-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-white/80">Composite Irregularity Index</p>
          <span className={cn("rounded-2xl border px-2.5 py-1 text-[11px] font-medium", severityStyle[severity])}>
            {severityLabel[severity]}
          </span>
        </div>
        <p className="text-[11px] text-white/35 mb-4">Left vs. Right hippocampus over time. Score = 0 at baseline by construction.</p>

        {/* Chart legend */}
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-[11px] text-white/45">
            <span className="inline-block h-0.5 w-5 rounded-full bg-cyan-400" />
            Left hippocampus
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/45">
            <span className="inline-block h-0.5 w-5 rounded-full bg-purple-400" />
            Right hippocampus
          </div>
          <span className="ml-auto text-[10px] italic text-white/20">Rising = increasing texture irregularity vs. baseline</span>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />

            {/* Interpretation zones --- provisional thresholds, not validated clinical cutoffs */}
            <ReferenceArea y1={-10}  y2={10}   fill="rgba(255,255,255,0.025)" strokeOpacity={0} />
            <ReferenceArea y1={10}   y2={40}   fill="rgba(251,191,36,0.04)"  strokeOpacity={0} />
            <ReferenceArea y1={40}   y2={200}  fill="rgba(239,68,68,0.05)"   strokeOpacity={0} />
            <ReferenceArea y1={-40}  y2={-10}  fill="rgba(52,211,153,0.04)"  strokeOpacity={0} />
            <ReferenceArea y1={-200} y2={-40}  fill="rgba(52,211,153,0.05)"  strokeOpacity={0} />

            <XAxis
              dataKey="month"
              tickFormatter={(v) => `${(v as number).toFixed(1)}mo`}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.28)" }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.28)" }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => `${(v as number).toFixed(0)}%`}
              width={44}
            />
            <ReferenceLine
              y={0}
              stroke="rgba(255,255,255,0.20)"
              strokeDasharray="5 3"
              label={{ value: "baseline", position: "insideTopLeft", fontSize: 9, fill: "rgba(255,255,255,0.22)" }}
            />
            <RechartTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const maxVal = Math.max(...payload.map((p) => Math.abs(p.value as number)));
                const zone = maxVal < 10 ? "Stable variation" : maxVal < 40 ? "Mild change zone" : "Progressive change zone";
                return (
                  <div className="rounded-xl border border-white/10 bg-[#0f0f18] px-3 py-2.5 text-xs shadow-xl">
                    <p className="mb-2 text-white/35">{(label as number).toFixed(1)} months from baseline</p>
                    {payload.map((p) => (
                      <p key={p.dataKey as string} className="flex items-center gap-2">
                        <span className="inline-block h-1.5 w-4 rounded-full" style={{ background: p.color }} />
                        <span className="text-white/55">{p.dataKey === "L" ? "Left" : "Right"}:</span>
                        <span className="font-mono text-white/85">
                          {(p.value as number) >= 0 ? "+" : ""}{(p.value as number).toFixed(1)}%
                        </span>
                      </p>
                    ))}
                    <p className="mt-1.5 border-t border-white/[0.06] pt-1.5 text-[10px] text-white/25">{zone}</p>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="L" stroke="#22d3ee" strokeWidth={2.5}
              dot={{ r: 4, fill: "#22d3ee", strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: "rgba(34,211,238,0.4)", strokeWidth: 4 }}
            />
            <Line type="monotone" dataKey="R" stroke="#c084fc" strokeWidth={2.5}
              dot={{ r: 4, fill: "#c084fc", strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: "rgba(192,132,252,0.4)", strokeWidth: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Zone key */}
        <div className="mt-3 flex flex-wrap gap-4 border-t border-white/[0.04] pt-3">
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <span className="h-2 w-3 rounded-sm bg-white/10" />Stable variation (--10%)
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <span className="h-2 w-3 rounded-sm bg-amber-400/30" />Mild change (10---40%)
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
            <span className="h-2 w-3 rounded-sm bg-red-400/30" />Progressive change (&gt;40%)
          </div>
          <span className="ml-auto text-[10px] italic text-white/15">Provisional thresholds --- not validated clinical cutoffs</span>
        </div>
      </div>

      {/* -- LAYER 3: Rate of Change & Asymmetry ---------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* Left Rate */}
        <div className="glass pulse-trigger rounded-[24px] p-4">
          <div className="text-[11px] text-white/35 mb-2">Left Annualized Rate</div>
          <div className={cn("text-2xl font-mono font-semibold", dirColor(ps.L.direction))}>
            {fmtRate(ps.L.annualized_slope)}
          </div>
          <div className="mt-1 text-[11px] text-white/35">
            {ps.L.direction === "stable" ? "No meaningful trend" :
             ps.L.direction === "worsening" ? "Increasing irregularity" : "Decreasing irregularity"}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className={cn("h-full rounded-full transition-all", ps.L.direction === "worsening" ? "bg-red-400" : ps.L.direction === "improving" ? "bg-emerald-400" : "bg-white/20")}
              style={{ width: `${Math.min(Math.abs(ps.L.annualized_slope * 100) / 50 * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Right Rate */}
        <div className="glass pulse-trigger rounded-[24px] p-4">
          <div className="text-[11px] text-white/35 mb-2">Right Annualized Rate</div>
          <div className={cn("text-2xl font-mono font-semibold", dirColor(ps.R.direction))}>
            {fmtRate(ps.R.annualized_slope)}
          </div>
          <div className="mt-1 text-[11px] text-white/35">
            {ps.R.direction === "stable" ? "No meaningful trend" :
             ps.R.direction === "worsening" ? "Increasing irregularity" : "Decreasing irregularity"}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className={cn("h-full rounded-full transition-all", ps.R.direction === "worsening" ? "bg-red-400" : ps.R.direction === "improving" ? "bg-emerald-400" : "bg-white/20")}
              style={{ width: `${Math.min(Math.abs(ps.R.annualized_slope * 100) / 50 * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Asymmetry Delta */}
        <div className="glass pulse-trigger rounded-[24px] p-4">
          <div className="text-[11px] text-white/35 mb-2">Side Asymmetry --</div>
          <div className={cn("text-2xl font-mono font-semibold",
            asymClass === "minimal" ? "text-white/55" :
            asymClass === "mild"    ? "text-amber-400" : "text-orange-400")}>
            {ps.asym_delta >= 0 ? "+" : ""}{(ps.asym_delta * 100).toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-white/35">{asymLabel[asymClass]}</div>
          <div className="mt-3 text-[10px] text-white/20">
            Baseline: {(ps.asym_baseline * 100).toFixed(1)}% --- Latest: {(ps.asym_latest * 100).toFixed(1)}%
          </div>
        </div>

        {/* Asymmetry trend chart */}
        <div className="glass pulse-trigger rounded-[24px] p-4">
          <div className="text-[11px] text-white/35 mb-2">Asymmetry Over Time</div>
          <ResponsiveContainer width="100%" height={72}>
            <LineChart data={asymData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 2" />
              <RechartTooltip
                contentStyle={{ background: "#0f0f18", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 10 }}
                formatter={(v) => [`${(v as number) >= 0 ? "+" : ""}${(v as number).toFixed(1)}%`, "L --- R Asymmetry"]}
                labelFormatter={(l) => `${l}mo`}
              />
              <Line type="monotone" dataKey="asym" stroke="#fb923c" strokeWidth={1.5}
                dot={{ r: 2.5, fill: "#fb923c", strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-1 text-[10px] text-white/20">L --- R asymmetry index over time</div>
        </div>
      </div>

      {/* -- LAYER 4: How to read this chart -------------------------------- */}
      <div className="glass pulse-trigger rounded-[28px] p-6">
        <p className="text-[14px] font-bold text-white mb-2">How to read this chart</p>
        <p className="text-[14px] leading-7 text-white/60">
          The score tracks how the texture of your hippocampus (the region responsible for memory) has changed since your first scan.
          A score of 0% means no change from baseline. A rising score means the tissue texture is becoming more irregular ---
          a pattern seen in early progression towards Alzheimer&apos;s. Left and Right refer to the two sides of the hippocampus.
          The coloured background bands show whether the observed change falls within stable variation (grey), mild change (amber), or
          progressive change (red) --- these are provisional internal reference zones and are not validated clinical cutoffs.
        </p>
      </div>

      {/* -- LAYER 5: Advanced Radiomic Metrics (collapsible) --------------- */}
      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-white/[0.05] px-4 py-2.5 text-xs text-white/30 transition hover:border-white/10 hover:text-white/50"
      >
        <span>Advanced Radiomic Metrics --- per-feature GLCM details</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showAdvanced && "rotate-180")} />
      </button>

      {showAdvanced && tp.metrics.length > 0 && (
        <div className="glass pulse-trigger rounded-[28px] p-6 space-y-4">
          <p className="text-xs text-white/35">
            The five raw GLCM texture features that contribute to the composite score above.
            Each measures a different aspect of hippocampal tissue texture.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-white/35">
                  <th className="pb-2 text-left font-medium">Feature</th>
                  <th className="pb-2 pl-2 text-left font-normal italic text-white/20">Clinical meaning</th>
                  <th className="pb-2 pr-4 text-right font-medium">L --</th>
                  <th className="pb-2 pr-4 text-right font-medium">R --</th>
                  <th className="pb-2 text-right font-medium">Asym --</th>
                </tr>
              </thead>
              <tbody>
                {tp.metrics.map((m) => {
                  const asymAbs   = Math.abs(m.asym_delta);
                  const asymColor = asymAbs < 0.02 ? "text-white/40" : asymAbs < 0.05 ? "text-amber-400" : "text-red-400";
                  return (
                    <tr key={m.name} className="border-b border-white/[0.04] last:border-0">
                      <td className="py-2.5 font-medium text-white/65">{m.label}</td>
                      <td className="py-2.5 pl-2 italic text-white/25">{FEATURE_FRIENDLY[m.label] ?? ""}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold"><ChangeCell side={m.L} label={m.label} /></td>
                      <td className="py-2.5 pr-4 text-right font-semibold"><ChangeCell side={m.R} label={m.label} /></td>
                      <td className={cn("py-2.5 text-right font-mono", asymColor)}>
                        {m.asym_delta >= 0 ? "+" : ""}{(m.asym_delta * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {tp.scan_dates.length >= 2 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tp.metrics.map((m) => {
                const data = tp.scan_dates.map((month, i) => ({
                  month,
                  L: m.l_values?.[i] ?? 0,
                  R: m.r_values?.[i] ?? 0,
                }));
                return (
                  <div key={m.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="mb-0.5 flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-medium text-white/55">{m.label}</span>
                        <span className="ml-1.5 text-[10px] italic text-white/20">{FEATURE_FRIENDLY[m.label] ?? ""}</span>
                      </div>
                      <div className="flex shrink-0 gap-2 text-[10px]">
                        <ChangeCell side={m.L} label={m.label} />
                        <span className="text-white/15">/</span>
                        <ChangeCell side={m.R} label={m.label} />
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={70}>
                      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                        <XAxis dataKey="month" tickFormatter={(v) => `${v}mo`} tick={{ fontSize: 8, fill: "rgba(255,255,255,0.18)" }} axisLine={false} tickLine={false} />
                        <YAxis hide domain={["auto", "auto"]} />
                        <RechartTooltip contentStyle={{ background: "#0f0f18", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 10 }} formatter={(v) => [(v as number).toFixed(4)]} labelFormatter={(l) => `${l}mo`} />
                        <Line type="monotone" dataKey="L" stroke="#22d3ee" strokeWidth={1.5} dot={{ r: 2, fill: "#22d3ee", strokeWidth: 0 }} />
                        <Line type="monotone" dataKey="R" stroke="#c084fc" strokeWidth={1.5} dot={{ r: 2, fill: "#c084fc", strokeWidth: 0 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- Clinical context copy ---------------------------------------------------

const CLINICAL_CONTEXT: Record<DatasetClass, { title: string; body: string }> = {
  AD: {
    title: "What 'Alzheimer's Disease likely' means",
    body:  "The AI model detected radiomic texture patterns in the hippocampus that are strongly associated with Alzheimer's Disease in the training cohort. This is not a standalone diagnosis --- it is a decision-support signal that should be reviewed by a neurologist alongside clinical history, neuropsychological testing, and biomarker data.",
  },
  MCI: {
    title: "What 'MCI detected' means",
    body:  "Mild Cognitive Impairment (MCI) indicates measurable changes in hippocampal texture that fall between normal aging and Alzheimer's Disease. Approximately 10---15% of MCI patients progress to dementia annually, though many remain stable. Clinical follow-up and cognitive screening are recommended.",
  },
  NC: {
    title: "What 'Cognitively Normal' means",
    body:  "No significant radiomic patterns associated with early neurodegeneration were detected. This result reflects the hippocampal texture profile at the time of scanning and should be interpreted in the context of the patient's full clinical picture and longitudinal follow-up.",
  },
};

const NEXT_STEPS: Record<DatasetClass, string[]> = {
  AD: [
    "Refer to neurology for clinical evaluation and confirmatory testing",
    "Consider neuropsychological assessment and CSF biomarker panel",
    "Discuss pharmacological options (cholinesterase inhibitors, memantine)",
    "Schedule follow-up MRI in 6---12 months to monitor progression",
    "Initiate caregiver planning and patient support resources",
  ],
  MCI: [
    "Annual cognitive assessment (MoCA or MMSE recommended)",
    "Consider neuropsychological testing to characterize deficit domains",
    "Lifestyle modification: aerobic exercise, Mediterranean diet, sleep hygiene",
    "Review medications for anticholinergic or sedating agents",
    "Follow-up MRI in 12 months; sooner if symptoms worsen",
  ],
  NC: [
    "Continue routine cognitive health monitoring",
    "Next scan recommended in 12---18 months unless symptoms develop",
    "Encourage cardiovascular risk factor management",
    "No immediate intervention indicated",
  ],
};

// Event plain-language descriptions per pipeline step
const EVENT_PLAIN: Record<string, string> = {
  "Scans Uploaded":
    "Your brain scans were received and verified. Each scan gives the AI a snapshot of your hippocampus at a specific point in time.",
  "Preprocessing":
    "Your scans were cleaned and aligned to a standard brain atlas. This ensures the AI measures the exact same brain region consistently across all scans.",
  "GLCM Radiomics":
    "The texture of your hippocampus was measured in fine detail. Healthy tissue has smooth, regular patterns; early neurodegeneration subtly alters these textures in ways invisible to the naked eye but detectable by the AI.",
  "Cascade Classification":
    "Three AI models reviewed your results in sequence --- each adding deeper analysis before passing to the next. The cascade stops as soon as the model is confident enough to issue a result.",
  "Report Generated":
    "Your analysis report was compiled, including the final classification, confidence score, and all supporting evidence for clinical review.",
};

// -- Page helpers ---------------------------------------------------------------

function classTheme(datasetClass: DatasetClass) {
  if (datasetClass === "AD") {
    return {
      badge: "border-red-400/20 bg-red-400/10 text-red-200",
      progress: "from-red-400 via-orange-400 to-amber-300",
    };
  }
  if (datasetClass === "MCI") {
    return {
      badge: "border-amber-400/20 bg-amber-400/10 text-amber-200",
      progress: "from-amber-400 via-orange-400 to-purple-400",
    };
  }
  return {
    badge: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    progress: "from-cyan-400 via-sky-400 to-emerald-400",
  };
}

function statusTheme(status: TimelineStatus) {
  if (status === "Complete") {
    return {
      dot: "bg-emerald-400",
      badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
      Icon: CheckCircle2,
    };
  }
  if (status === "Active") {
    return {
      dot: "bg-cyan-400",
      badge: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
      Icon: CircleDashed,
    };
  }
  return {
    dot: "bg-amber-400",
    badge: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    Icon: AlertTriangle,
  };
}

function eventIcon(icon: TimelineEvent["icon"]) {
  switch (icon) {
    case "upload":
      return Scan;
    case "preprocess":
      return Cpu;
    case "radiomics":
      return Activity;
    case "classify":
      return Brain;
    case "report":
      return FileText;
    case "review":
      return ShieldCheck;
    default:
      return Activity;
  }
}
function buildLiveTimeline(c: AnalysisCase) {
  const final = c.result.final;
  const pred  = final.prediction;
  const conf  = final.confidence;

  const datasetClass: DatasetClass =
    pred.includes("Alzheimer") ? "AD" :
    pred.includes("MCI")       ? "MCI" : "NC";

  const decision =
    datasetClass === "AD"  ? "Alzheimer's Disease likely" :
    datasetClass === "MCI" ? (c.result.task2?.label === "converting_MCI" ? "Converting MCI" : "Stable MCI") :
    "Cognitively Normal";

  const scanDates = c.scans.map(s => s.date).join(" --- ");

  const events = [
    { title: "Scans Uploaded",       time: c.scans[0]?.date ?? "---", icon: "upload"     as const, status: "Complete" as const, description: `${c.scans.length} NIfTI scan${c.scans.length > 1 ? "s" : ""} received. Dates: ${scanDates}.` },
    { title: "Preprocessing",        time: "N4 + MNI",               icon: "preprocess" as const, status: "Complete" as const, description: "N4 bias field correction applied. Registered to MNI152 1mm standard space. Bilateral hippocampal crops extracted (64-- voxels each side)." },
    { title: "GLCM Radiomics",       time: "CPU (FPGA pending)",      icon: "radiomics"  as const, status: "Complete" as const, description: "3D GLCM features extracted across 13 directions, distances 1---4, Ng=32. 252 features total including L/R asymmetry." },
    { title: "Cascade Classification", time: `Stopped at ${final.cascade_stopped_at}`, icon: "classify" as const, status: "Complete" as const, description: `AD probability: ${((c.result.task1?.probabilities?.AD ?? 0) * 100).toFixed(1)}%. MCI probability: ${((c.result.task3?.probabilities?.MCI ?? 0) * 100).toFixed(1)}%. Final: ${pred}.` },
    { title: "Report Generated",     time: new Date(c.timestamp).toLocaleDateString(), icon: "report" as const, status: "Complete" as const, description: `Classification complete. Confidence: ${(conf * 100).toFixed(1)}%. Case ID: ${c.id}.` },
  ].map((e) => ({ ...e, plain: EVENT_PLAIN[e.title] ?? "" }));

  return {
    datasetClass,
    decision,
    confidence: conf,
    region: c.region,
    latency: "~3.2s",
    status: "Complete",
    summary: `Longitudinal analysis of ${c.scans.length} MRI scan${c.scans.length > 1 ? "s" : ""}. Patient: ${c.patient.age}yo ${c.patient.sex === "M" ? "male" : "female"}, ${c.patient.education}yr education, ${c.patient.race}${c.patient.apoe ? `, APOE ${c.patient.apoe}` : ""}. Result: ${pred} (${(conf * 100).toFixed(1)}% confidence).`,
    events,
  };
}

export default function TimelinePage() {
  usePageTitle("Timeline");
  const searchParams = useSearchParams();  
  const router = useRouter();
  const caseId        = searchParams.get("case") || "AUD-0231";
  const fallbackRegion = searchParams.get("region") || "Bilateral Hippocampus";
  const [storeReady, setStoreReady] = useState(false);
  useEffect(() => { setStoreReady(true); }, []);

  const storeCase  = useAnalysisStore((s) => s.getCase(caseId));
  const latestCase = useAnalysisStore((s) => s.latestCase());

  const liveCase: AnalysisCase | undefined = !storeReady ? undefined
    : storeCase ?? ((!caseId || !TIMELINE_DATA[caseId]) ? latestCase : undefined);

  const caseInfo = liveCase
    ? buildLiveTimeline(liveCase)
    : TIMELINE_DATA[caseId] ?? { ...TIMELINE_DATA["AUD-0231"], region: fallbackRegion };

  const displayCaseId = liveCase?.id ?? caseId;
  const showEmpty = !liveCase && !TIMELINE_DATA[caseId];

  const theme = classTheme(caseInfo.datasetClass);

  const completedCount = useMemo(
    () => caseInfo.events.filter((e) => e.status === "Complete").length,
    [caseInfo.events]
  );

  const handleExport = () => {
    const date = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const eventLines = caseInfo.events
      .map(
        (e) =>
          `  [${e.status.toUpperCase().padEnd(8)}]  ${e.time.padEnd(14)}  ${e.title}\n                              ${e.description}`
      )
      .join("\n\n");

    const content = [
      "------------------------------------------------------------------------------------------------------------------------------------------------------",
      "  ALZ PLATFORM -- CASE TIMELINE",
      `  Case ${caseId}  --  Generated ${date}`,
      "------------------------------------------------------------------------------------------------------------------------------------------------------",
      "",
      "CASE OVERVIEW",
      `  Dataset Class   ${caseInfo.datasetClass}`,
      `  Decision        ${caseInfo.decision}`,
      `  Confidence      ${Math.round(caseInfo.confidence * 100)}%`,
      `  Region          ${caseInfo.region}`,
      `  Latency         ${caseInfo.latency}  (PYNQ-Z2)`,
      `  Status          ${caseInfo.status}`,
      `  Progress        ${completedCount}/${caseInfo.events.length} stages complete`,
      "",
      "SUMMARY",
      `  ${caseInfo.summary}`,
      "",
      "PIPELINE EVENTS",
      eventLines,
      "",
      "------------------------------------------------------------------------------------------------------------------------------------------------------",
      "  Pipeline: 3D GLCM Radiomics  --  Hardware: PYNQ-Z2",
      "------------------------------------------------------------------------------------------------------------------------------------------------------",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline-${displayCaseId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (showEmpty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Case Timeline</h1>
          <p className="mt-1 text-sm text-white/60">Workflow history showing how a case moved through preprocessing, radiomics, classification, and reporting.</p>
        </div>
        <EmptyState
          icon={Activity}
          title="No timeline available"
          description="Run a scan to see the full processing timeline for a case."
          action={{ label: "Upload a Case", onClick: () => router.push("/upload") }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Case Timeline
            </h1>
            <span
              className={cn(
                "rounded-2xl border px-3 py-1 text-xs font-medium",
                theme.badge
              )}
            >
              {caseInfo.datasetClass}
            </span>
          </div>

          <p className="mt-1 text-sm text-white/60">
            Workflow history showing how this case moved through preprocessing,
            radiomics, classification, reporting, and review.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
            Case: <span className="text-white/90">{displayCaseId}</span> --- Status:{" "}
            <span className="text-white/90">{caseInfo.status}</span>
          </div>
          <button
            onClick={handleExport}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
          >
            Export Timeline
          </button>
        </div>
      </div>

      <CaseSwitcher currentCaseId={caseId} />

      {/* Summary row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Brain className="h-4 w-4 text-white/50" />
            AI Classification
          </div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {caseInfo.decision}
          </div>
          <div className="mt-1 text-sm text-white/60">
            Confidence: {Math.round(caseInfo.confidence * 100)}%
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/5">
            <div
              className={cn("h-full rounded-full bg-gradient-to-r", theme.progress)}
              style={{ width: `${caseInfo.confidence * 100}%` }}
            />
          </div>
          {liveCase && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                Age {liveCase.patient.age} -- {liveCase.patient.sex === "M" ? "Male" : "Female"}
              </span>
              <span className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                Edu: {liveCase.patient.education} yr
              </span>
              {liveCase.patient.apoe && (
                <span className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-2.5 py-1 text-[11px] text-amber-300/80">
                  APOE {liveCase.patient.apoe}
                </span>
              )}
              <span className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                {liveCase.scans.length} scan{liveCase.scans.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Clock3 className="h-4 w-4 text-white/50" />
            Workflow Progress
          </div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {completedCount}/{caseInfo.events.length}
          </div>
          <div className="mt-2 text-sm text-white/60">
            Stages completed in the current analysis workflow.
          </div>
          <div className="mt-4 flex gap-1.5">
            {caseInfo.events.map((e, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  e.status === "Complete" ? "bg-emerald-400/70" : e.status === "Active" ? "bg-cyan-400/70 animate-pulse" : "bg-white/10"
                )}
              />
            ))}
          </div>
        </div>

        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Cpu className="h-4 w-4 text-white/50" />
            Runtime
          </div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {caseInfo.latency}
          </div>
          <div className="mt-2 text-sm text-white/60">
            FPGA-linked inference latency for the final prediction pipeline.
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Timeline */}
        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Activity className="h-4 w-4 text-white/50" />
            Processing Timeline
          </div>

          <div className="mt-6 space-y-5">
            {caseInfo.events.map((event, index) => {
              const status = statusTheme(event.status);
              const Icon = status.Icon;
              const StageIcon = eventIcon(event.icon);

              return (
                <div key={`${event.title}-${index}`} className="relative pl-14">
                  {index !== caseInfo.events.length - 1 && (
                    <div className="absolute left-[18px] top-10 h-[calc(100%+10px)] w-px bg-white/10" />
                  )}

                  <div
                    className={cn(
                      "absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-2xl border",
                      event.status === "Complete"
                        ? "border-emerald-400/20 bg-emerald-400/10"
                        : event.status === "Active"
                        ? "border-cyan-400/20 bg-cyan-400/10"
                        : "border-amber-400/20 bg-amber-400/10"
                    )}
                  >
                    <StageIcon className="h-4 w-4 text-white/85" />
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {event.title}
                        </div>
                        <div className="mt-1 text-xs text-white/50">
                          {event.time}
                        </div>
                      </div>

                      <div
                        className={cn(
                          "inline-flex items-center gap-2 rounded-2xl border px-3 py-1 text-xs font-medium",
                          status.badge
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {event.status}
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-5 text-white/50 font-mono">
                      {event.description}
                    </p>
                    {event.plain && (
                      <p className="mt-2 text-sm leading-6 text-white/70 border-t border-white/[0.05] pt-2">
                        {event.plain}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side cards */}
        <div className="space-y-6">
          <div className="glass pulse-trigger rounded-[28px] p-6">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <FileText className="h-4 w-4 text-white/50" />
              Case Summary
            </div>

            <p className="mt-4 text-sm leading-7 text-white/70">
              {caseInfo.summary}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Region</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {caseInfo.region}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Dataset class</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {caseInfo.datasetClass}
                </div>
              </div>
            </div>
          </div>

          <div className="glass pulse-trigger rounded-[28px] p-6">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <ShieldCheck className="h-4 w-4 text-white/50" />
              Clinical Context
            </div>
            {(() => {
              const ctx = CLINICAL_CONTEXT[caseInfo.datasetClass];
              return (
                <div className="mt-4 space-y-3">
                  <p className="text-sm font-semibold text-white/85">{ctx.title}</p>
                  <p className="text-sm leading-7 text-white/65">{ctx.body}</p>
                  <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2.5">
                    <p className="text-[11px] text-amber-300/70">
                      This analysis is AI-assisted and is intended to support, not replace, clinical judgement.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="glass pulse-trigger rounded-[28px] p-6">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <ChevronRight className="h-4 w-4 text-white/50" />
              Recommended Next Steps
            </div>
            <ul className="mt-4 space-y-2.5">
              {NEXT_STEPS[caseInfo.datasetClass].map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[9px] text-white/40">
                    {i + 1}
                  </span>
                  <span className="text-sm leading-6 text-white/65">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass pulse-trigger rounded-[28px] p-6">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <LayoutDashboard className="h-4 w-4 text-white/50" />
              Quick Actions
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white transition hover:bg-white/15"
              >
                Dashboard
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/viewer?case=${encodeURIComponent(
                      caseId
                    )}&region=${encodeURIComponent(caseInfo.region)}`
                  )
                }
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10"
              >
                Open MRI Viewer
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/explain?case=${encodeURIComponent(
                      caseId
                    )}&region=${encodeURIComponent(caseInfo.region)}`
                  )
                }
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10"
              >
                Open Explainable AI
                <ChevronRight className="h-4 w-4" />
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/reports?case=${encodeURIComponent(
                      caseId
                    )}&region=${encodeURIComponent(caseInfo.region)}`
                  )
                }
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10"
              >
                Open Report
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Temporal Progression --- live cases only */}
      {liveCase && liveCase.result.temporal_progression?.progression_summary && (
        <TemporalProgressionPanel tp={liveCase.result.temporal_progression} />
      )}
    </div>
  );
}