"use client";
import { useAnalysisStore, type AnalysisCase, type FeatureImportanceEntry, type CascadeResult } from "@/lib/analysis-store";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { EXPLAIN_DATA } from "@/lib/cases";
import { CaseSwitcher } from "@/components/ui/case-switcher";
import {
  Brain,
  Activity,
  ChevronRight,
  Cpu,
  Eye,
  ShieldCheck,
  GitBranch,
} from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";
import { EmptyState } from "@/components/ui/empty-state";

type OverlayMode = "Saliency" | "Contrast" | "Homogeneity" | "Energy";
type FeatureName =
  | "Contrast"
  | "Homogeneity"
  | "Energy"
  | "Correlation"
  | null;

// EXPLAIN_DATA imported from @/lib/cases

function FakeExplainHeatmap({
  confidence,
  overlayMode,
  activeFeature,
}: {
  confidence: number;
  overlayMode: OverlayMode;
  activeFeature: FeatureName;
}) {
  const overlayClass =
    overlayMode === "Contrast"
      ? "bg-[radial-gradient(circle_at_37%_50%,rgba(255,80,80,0.64),transparent_10%),radial-gradient(circle_at_63%_50%,rgba(255,140,50,0.50),transparent_12%)]"
      : overlayMode === "Homogeneity"
      ? "bg-[radial-gradient(circle_at_43%_50%,rgba(168,85,247,0.48),transparent_12%),radial-gradient(circle_at_57%_50%,rgba(192,132,252,0.40),transparent_14%)]"
      : overlayMode === "Energy"
      ? "bg-[radial-gradient(circle_at_40%_50%,rgba(16,185,129,0.48),transparent_12%),radial-gradient(circle_at_60%_50%,rgba(74,222,128,0.34),transparent_14%)]"
      : "bg-[radial-gradient(circle_at_38%_50%,rgba(255,60,90,0.52),transparent_10%),radial-gradient(circle_at_62%_50%,rgba(255,150,40,0.38),transparent_12%),radial-gradient(circle_at_50%_58%,rgba(168,85,247,0.22),transparent_18%)]";

  const featureGlow =
    activeFeature === "Contrast"
      ? "bg-[radial-gradient(circle_at_36%_50%,rgba(255,90,90,0.90),transparent_9%),radial-gradient(circle_at_64%_50%,rgba(255,140,70,0.72),transparent_11%)]"
      : activeFeature === "Homogeneity"
      ? "bg-[radial-gradient(circle_at_50%_56%,rgba(192,132,252,0.78),transparent_12%),radial-gradient(circle_at_46%_49%,rgba(168,85,247,0.56),transparent_10%)]"
      : activeFeature === "Energy"
      ? "bg-[radial-gradient(circle_at_38%_50%,rgba(52,211,153,0.72),transparent_11%),radial-gradient(circle_at_62%_50%,rgba(74,222,128,0.58),transparent_13%)]"
      : activeFeature === "Correlation"
      ? "bg-[radial-gradient(circle_at_35%_44%,rgba(96,165,250,0.62),transparent_12%),radial-gradient(circle_at_65%_58%,rgba(59,130,246,0.56),transparent_14%)]"
      : "";

  const featureLabel = activeFeature ? ` • ${activeFeature} focus` : "";

  return (
    <div className="relative aspect-[1.12] w-full overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_0_25px_rgba(255,255,255,0.05)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.14),rgba(255,255,255,0.04)_24%,rgba(0,0,0,0.96)_62%)]" />
      <div className="absolute inset-0 opacity-[0.16] mix-blend-overlay bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:4px_4px]" />

      <div className="absolute inset-[12%] rounded-full border border-white/10 opacity-20" />
      <div className="absolute inset-[22%] rounded-full border border-white/10 opacity-15" />

      <div className="absolute left-[24%] top-[24%] h-[48%] w-[22%] rounded-full bg-white/10 blur-[7px]" />
      <div className="absolute right-[24%] top-[24%] h-[48%] w-[22%] rounded-full bg-white/10 blur-[7px]" />
      <div className="absolute left-[39%] top-[43%] h-[12%] w-[8%] rounded-full bg-white/8 blur-[5px]" />
      <div className="absolute right-[39%] top-[43%] h-[12%] w-[8%] rounded-full bg-white/8 blur-[5px]" />

      <div
        className="absolute inset-0 mix-blend-screen transition-all duration-300"
        style={{ opacity: Math.max(0.35, confidence) }}
      >
        <div className={cn("absolute inset-0", overlayClass)} />
      </div>

      {activeFeature && (
        <div className="absolute inset-0 mix-blend-screen transition-all duration-300">
          <div className={cn("absolute inset-0", featureGlow)} />
        </div>
      )}

      {activeFeature && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[30%] top-[48%] h-5 w-5 rounded-full border border-white/40 bg-white/10 shadow-[0_0_18px_rgba(255,255,255,0.28)]" />
          <div className="absolute right-[30%] top-[48%] h-5 w-5 rounded-full border border-white/40 bg-white/10 shadow-[0_0_18px_rgba(255,255,255,0.28)]" />
        </div>
      )}

      <div className="absolute left-3 top-3 rounded-xl border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur-md">
        Model Attention Map{featureLabel}
      </div>
    </div>
  );
}

// ── Cascade Decision Pathway ──────────────────────────────────────────────
function CascadeFlow({ result }: { result: CascadeResult }) {
  const { task1, task3, task2, final } = result;
  const stopped = final.cascade_stopped_at;

  const adPct  = Math.round((task1?.probabilities?.AD  ?? 0) * 100);
  const nadPct = Math.round((task1?.probabilities?.NC  ?? 0) * 100);
  const mciPct = Math.round((task3?.probabilities?.MCI ?? 0) * 100);
  const ncPct  = Math.round((task3?.probabilities?.NC  ?? 0) * 100);

  // task2 class names vary by model — grab first two entries
  const t2entries = Object.entries(task2?.probabilities ?? {});
  const [t2la, t2pa] = t2entries[0] ?? ["Converting", 0];
  const [t2lb, t2pb] = t2entries[1] ?? ["Stable",     0];
  const t2pctA = Math.round(Number(t2pa) * 100);
  const t2pctB = Math.round(Number(t2pb) * 100);

  const outcomeColor =
    final.prediction.includes("Alzheimer") ? "red" :
    final.prediction.includes("MCI")       ? "amber" : "cyan";

  return (
    <div className="space-y-2">
      {/* Stage 1 */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-white/50">Stage 1 · AD Screening</span>
          <span className={cn("rounded-md px-2 py-0.5 text-[10px]",
            stopped === "task1"
              ? "bg-red-400/15 text-red-300"
              : "bg-emerald-400/10 text-emerald-400"
          )}>
            {stopped === "task1" ? "Decision made" : "Passed ✓"}
          </span>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <div className="text-[10px] text-white/40">Alzheimer's</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-red-400/70" style={{ width: `${adPct}%` }} />
            </div>
            <div className="text-[11px] font-medium text-red-300">{adPct}%</div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="text-[10px] text-white/40">Non-AD</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${nadPct}%` }} />
            </div>
            <div className="text-[11px] font-medium text-cyan-300">{nadPct}%</div>
          </div>
        </div>
      </div>

      {/* Connector */}
      <div className="flex items-center gap-2 px-3">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-[10px] text-white/30">
          {stopped === "task1" ? "AD ≥ 65% → stopped" : "Non-AD → continue"}
        </span>
        <div className="h-px flex-1 bg-white/8" />
      </div>

      {/* Stage 3 (if ran) */}
      {(stopped === "task3" || stopped === "task2") && (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">Stage 3 · MCI vs Normal</span>
              <span className={cn("rounded-md px-2 py-0.5 text-[10px]",
                stopped === "task3"
                  ? "bg-amber-400/15 text-amber-300"
                  : "bg-emerald-400/10 text-emerald-400"
              )}>
                {stopped === "task3" ? "Decision made" : "MCI → continue ✓"}
              </span>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <div className="text-[10px] text-white/40">MCI</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${mciPct}%` }} />
                </div>
                <div className="text-[11px] font-medium text-amber-300">{mciPct}%</div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="text-[10px] text-white/40">Normal</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${ncPct}%` }} />
                </div>
                <div className="text-[11px] font-medium text-cyan-300">{ncPct}%</div>
              </div>
            </div>
          </div>

          {/* Stage 2 (if ran) */}
          {stopped === "task2" && (
            <>
              <div className="flex items-center gap-2 px-3">
                <div className="h-px flex-1 bg-white/8" />
                <span className="text-[10px] text-white/30">MCI ≥ 55% → progression check</span>
                <div className="h-px flex-1 bg-white/8" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/50">Stage 2 · MCI Progression</span>
                  <span className="rounded-md bg-purple-400/15 px-2 py-0.5 text-[10px] text-purple-300">Final stage</span>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="text-[10px] text-white/40">{t2la}</div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-red-400/70" style={{ width: `${t2pctA}%` }} />
                    </div>
                    <div className="text-[11px] font-medium text-red-300">{t2pctA}%</div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="text-[10px] text-white/40">{t2lb}</div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-green-400/70" style={{ width: `${t2pctB}%` }} />
                    </div>
                    <div className="text-[11px] font-medium text-green-300">{t2pctB}%</div>
                  </div>
                </div>
                {final.conversion_risk !== undefined && (
                  <div className="mt-2 text-[10px] text-white/40">
                    Conversion risk: <span className="text-amber-300">{Math.round(final.conversion_risk * 100)}%</span>
                    {final.mci_status && <span className="ml-2 text-white/50">· {final.mci_status}</span>}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Final outcome */}
      <div className={cn("flex items-center gap-3 rounded-2xl border p-3",
        outcomeColor === "red"   ? "border-red-400/25 bg-red-500/8" :
        outcomeColor === "amber" ? "border-amber-400/25 bg-amber-500/8" :
        "border-cyan-400/25 bg-cyan-500/8"
      )}>
        <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full",
          outcomeColor === "red"   ? "bg-red-400" :
          outcomeColor === "amber" ? "bg-amber-400" : "bg-cyan-400"
        )} />
        <div className="flex-1">
          <div className={cn("text-sm font-semibold",
            outcomeColor === "red"   ? "text-red-300" :
            outcomeColor === "amber" ? "text-amber-300" : "text-cyan-300"
          )}>
            {final.prediction}
          </div>
          <div className="mt-0.5 text-[10px] text-white/35">
            {Math.round(final.confidence * 100)}% confidence · stopped at {stopped}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── L–R Asymmetry Panel ───────────────────────────────────────────────────
const GLCM_METRICS = [
  { key: "contrast",    label: "Contrast",    note: "Local intensity variation" },
  { key: "homogeneity", label: "Homogeneity", note: "Texture uniformity" },
  { key: "energy",      label: "Energy",      note: "Texture compactness" },
  { key: "correlation", label: "Correlation", note: "Spatial dependency" },
] as const;

function AsymmetryPanel({ glcm }: { glcm: Record<string, number> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, []);

  const pairs = GLCM_METRICS.map((m) => {
    const L = glcm[`L_${m.key}`] ?? 0;
    const R = glcm[`R_${m.key}`] ?? 0;
    const maxLR = Math.max(L, R, 1e-9);
    const avg   = (L + R) / 2 || 1e-9;
    const asymPct = ((L - R) / avg) * 100;
    return { ...m, L, R, maxLR, asymPct };
  }).filter((m) => m.L !== 0 || m.R !== 0);

  if (pairs.length === 0) return null;

  return (
    <div className="glass rounded-[26px] p-4">
      <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
        <Activity className="h-4 w-4 text-white/50" />
        L–R Hippocampal Asymmetry
      </div>
      <p className="mb-3 text-xs text-white/40">
        Bilateral GLCM comparison — texture asymmetry between hemispheres is a key neurodegeneration biomarker.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {pairs.map((p) => {
          const lPct   = Math.round((p.L / p.maxLR) * 100);
          const rPct   = Math.round((p.R / p.maxLR) * 100);
          const absAsym = Math.abs(p.asymPct);
          const asymColor =
            absAsym > 20 ? "text-red-400" :
            absAsym > 10 ? "text-amber-400" : "text-cyan-400";
          const dominant = p.L > p.R ? "L" : p.R > p.L ? "R" : "—";
          return (
            <div key={p.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-white/70">{p.label}</span>
                <span className={cn("text-[11px] font-semibold", asymColor)}>
                  {absAsym.toFixed(1)}% {dominant !== "—" && <span className="font-normal text-white/40">({dominant} dom.)</span>}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 text-[10px] text-blue-400">L</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-blue-400/70 transition-[width] duration-500 ease-out"
                      style={{ width: mounted ? `${lPct}%` : "0%" }}
                    />
                  </div>
                  <span className="w-7 text-right text-[10px] text-white/45">{lPct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 text-[10px] text-purple-400">R</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-purple-400/70 transition-[width] duration-500 ease-out"
                      style={{ width: mounted ? `${rPct}%` : "0%" }}
                    />
                  </div>
                  <span className="w-7 text-right text-[10px] text-white/45">{rPct}%</span>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-white/30">{p.note}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildLiveExplain(c: AnalysisCase) {
  const final    = c.result.final;
  const pred     = final.prediction;
  const conf     = final.confidence;
  const task1    = c.result.task1;
  const task3    = c.result.task3;

  const datasetClass: "AD" | "MCI" | "NC" =
    pred.includes("Alzheimer") ? "AD" :
    pred.includes("MCI")       ? "MCI" : "NC";

  const adProb  = task1?.probabilities?.AD  ?? 0;
  const mciProb = task3?.probabilities?.MCI ?? 0;
  const ncProb  = task1?.probabilities?.NC  ?? 0;
  const glcm    = c.result.glcm_summary ?? {};

  // Normalise real GLCM values to 0–1 using approximate population ranges.
  // Falls back to probability-derived value only when glcm_summary is absent
  // (older store entries that pre-date the glcm_summary field).
  const norm = (key: string, lo: number, hi: number, fallback: number) => {
    const v = glcm[key];
    return v !== undefined ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : fallback;
  };

  const features = [
    {
      name: "Contrast" as const, color: "bg-red-400",
      value: norm("L_contrast", 0, 80, adProb),
      note: "Mean bilateral GLCM contrast (L hippocampus, all blocks & distances)",
      tooltip: "Higher contrast indicates greater local intensity variation — a key texture marker elevated in neurodegeneration.",
    },
    {
      name: "Homogeneity" as const, color: "bg-purple-400",
      value: norm("L_homogeneity", 0.3, 1.0, 1 - mciProb),
      note: "Mean bilateral GLCM homogeneity (L hippocampus)",
      tooltip: "Homogeneity measures texture uniformity. Values drop with tissue degradation typical of MCI and AD.",
    },
    {
      name: "Energy" as const, color: "bg-cyan-400",
      value: norm("L_energy", 0, 0.5, ncProb),
      note: "Mean bilateral GLCM energy (L hippocampus)",
      tooltip: "Energy captures texture compactness. Healthy hippocampal tissue tends to show higher energy values.",
    },
    {
      name: "Correlation" as const, color: "bg-emerald-400",
      value: norm("L_correlation", -0.2, 1.0, conf),
      note: "Mean bilateral GLCM correlation (L hippocampus)",
      tooltip: "Correlation reflects spatial linear dependency between voxel intensities across hippocampal sub-regions.",
    },
  ];

  const decision =
    datasetClass === "AD"  ? "Alzheimer's Disease likely" :
    datasetClass === "MCI" ? "Mild Cognitive Impairment detected" :
    "Cognitively Normal";

  const action =
    datasetClass === "AD"
      ? "Refer to specialist. Consider PET imaging and CSF biomarker confirmation."
      : datasetClass === "MCI"
      ? "Schedule 6-month follow-up MRI. Monitor with standardised cognitive assessments."
      : "Routine monitoring as per standard clinical protocol.";

  const rationale = [
    `AD probability ${(adProb*100).toFixed(1)}% — ${adProb > 0.5 ? "above" : "below"} the 65% cascade threshold.`,
    `MCI probability ${(mciProb*100).toFixed(1)}% — ${mciProb > 0.55 ? "above" : "below"} the 55% threshold. Cascade stopped at ${final.cascade_stopped_at}.`,
    `Based on ${c.scans.length} longitudinal scan${c.scans.length > 1 ? "s" : ""}. Follow-up: ${c.patient.age}yo ${c.patient.sex === "M" ? "male" : "female"}, APOE ${c.patient.apoe ?? "unknown"}.`,
  ];

  return {
    datasetClass,
    decision,
    confidence: conf,
    region: c.region,
    summary: `Radiomic analysis of bilateral hippocampal volumes. AD probability: ${(adProb*100).toFixed(1)}%, MCI probability: ${(mciProb*100).toFixed(1)}%. Final classification: ${pred}.`,
    saliency: `The model's attention is concentrated in the bilateral hippocampal regions. The dominant signal drivers are texture contrast and homogeneity asymmetry between left and right hemispheres.`,
    action,
    rationale,
    features,
    featureImportances: c.result.feature_importances ?? {},
  };
}

export default function ExplainPage() {
  usePageTitle("Explainable AI");
  const searchParams = useSearchParams();
  const router = useRouter();

  const caseId         = searchParams.get("case") || "AUD-0231";
  const fallbackRegion = searchParams.get("region") || "Hippocampus";

  const [storeReady, setStoreReady] = useState(false);
  useEffect(() => { setStoreReady(true); }, []);

  const storeCase  = useAnalysisStore((s) => s.getCase(caseId));
  const latestCase = useAnalysisStore((s) => s.latestCase());

  const liveCase: AnalysisCase | undefined = !storeReady ? undefined
    : storeCase ?? ((!caseId || !EXPLAIN_DATA[caseId]) ? latestCase : undefined);

  const explainCase = liveCase
    ? buildLiveExplain(liveCase)
    : EXPLAIN_DATA[caseId] ?? { ...EXPLAIN_DATA["AUD-0231"], region: fallbackRegion };

  const displayCaseId = liveCase?.id ?? caseId;
  const showEmpty = !liveCase && !EXPLAIN_DATA[caseId];

  const features = useMemo(() => explainCase.features, [explainCase]);

  // Real feature importances from the model — flattened across tasks, deduplicated, top 8
  const rawImportances = liveCase?.result?.feature_importances ?? {};
  const realFeats = useMemo<FeatureImportanceEntry[]>(() => {
    const seen = new Set<string>();
    const all: FeatureImportanceEntry[] = [];
    for (const task of ["task1", "task3", "task2"]) {
      for (const e of rawImportances[task] ?? []) {
        if (!seen.has(e.feature)) { seen.add(e.feature); all.push(e); }
      }
    }
    return all.sort((a, b) => b.importance - a.importance).slice(0, 8);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCase]);
  const hasRealFeats = realFeats.length > 0;

  const featColor = (label: string) => {
    if (label.startsWith("CSF"))       return "bg-red-400";
    if (label.startsWith("Asymmetry")) return "bg-amber-400";
    if (label.startsWith("Temporal"))  return "bg-purple-400";
    return "bg-cyan-400";
  };

  const [overlayMode, setOverlayMode] = useState<OverlayMode>("Saliency");
  const [activeFeature, setActiveFeature] = useState<FeatureName>(null);
  const [barsMounted, setBarsMounted] = useState(false);

  useEffect(() => {
    setBarsMounted(false);
    const t = setTimeout(() => setBarsMounted(true), 80);
    return () => clearTimeout(t);
  }, [caseId]);

  const handleExport = () => {
    const date = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const featureLines = features
      .map(
        (f) =>
          `  ${f.name.padEnd(16)}${String(Math.round(f.value * 100)).padStart(3)}%  — ${f.note}`
      )
      .join("\n");

    const content = [
      "══════════════════════════════════════════════════",
      "  ALZ PLATFORM · EXPLAINABILITY SUMMARY",
      `  Case ${displayCaseId}  ·  Generated ${date}`,
      "══════════════════════════════════════════════════",
      "",
      "PREDICTION",
      `  Dataset Class   ${explainCase.datasetClass ?? "Unknown"}`,
      `  Decision        ${explainCase.decision}`,
      `  Confidence      ${Math.round(explainCase.confidence * 100)}%`,
      `  Region          ${explainCase.region}`,
      "",
      "SUMMARY",
      `  ${explainCase.summary}`,
      "",
      "FEATURE ATTRIBUTION",
      featureLines,
      "",
      "══════════════════════════════════════════════════",
      "  Pipeline: 3D GLCM Radiomics  ·  Hardware: PYNQ-Z2",
      "══════════════════════════════════════════════════",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `explainability-${displayCaseId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (showEmpty) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Explainable AI</h1>
          <p className="mt-1 text-sm text-white/60">Case-specific feature attribution, saliency reasoning, and clinician-friendly interpretation.</p>
        </div>
        <EmptyState
          icon={Brain}
          title="No analysis available"
          description="Upload and run a scan to see live explainability results."
          action={{ label: "Upload a Case", onClick: () => router.push("/upload") }}
        />
      </div>
    );
  }

  const confidenceBarClass =
    explainCase.confidence >= 0.75
      ? "bg-gradient-to-r from-red-400 via-rose-400 to-orange-400"
      : explainCase.confidence >= 0.5
      ? "bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400"
      : "bg-gradient-to-r from-blue-400 via-cyan-400 to-sky-400";

  const confidenceAccentClass =
    explainCase.confidence >= 0.75
      ? "border-red-400/20 bg-gradient-to-br from-red-500/10 to-white/5"
      : explainCase.confidence >= 0.5
      ? "border-purple-400/20 bg-gradient-to-br from-purple-500/10 to-white/5"
      : "border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-white/5";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Explainable AI
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Case-specific feature attribution, saliency reasoning, and
            clinician-friendly interpretation.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
            Case: <span className="text-white/90">{displayCaseId}</span> • Target ROI:{" "}
            <span className="text-white/90">{explainCase.region}</span>
          </div>
          <button
            onClick={handleExport}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
          >
            Export Summary
          </button>
        </div>
      </div>

      <CaseSwitcher currentCaseId={caseId} />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.05fr_1fr]">
        {/* Left */}
        <div className="space-y-4">
          <div className="glass rounded-[26px] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
              <Eye className="h-4 w-4 text-white/50" />
              Saliency Overview
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {(
                ["Saliency", "Contrast", "Homogeneity", "Energy"] as OverlayMode[]
              ).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setOverlayMode(mode)}
                  className={cn(
                    "rounded-2xl border px-3 py-2 text-xs transition",
                    overlayMode === mode
                      ? "border-white/15 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[290px_1fr]">
              {/* Left sub-column */}
              <div className="space-y-4">
                <FakeExplainHeatmap
                  confidence={explainCase.confidence}
                  overlayMode={overlayMode}
                  activeFeature={activeFeature}
                />

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() =>
                        router.push(
                          `/viewer?case=${encodeURIComponent(
                            caseId
                          )}&region=${encodeURIComponent(explainCase.region)}`
                        )
                      }
                      className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
                    >
                      Open MRI Viewer
                      <ChevronRight className="h-4 w-4" />
                    </button>

                    <button className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10">
                      Export Summary
                      <Cpu className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right sub-column */}
              <div className="space-y-3">
                <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-br from-purple-500/10 to-white/5 p-4">
                  <div className="text-sm text-white/70">Decision</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {explainCase.decision}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {explainCase.summary}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-white/70">
                    {activeFeature
                      ? `${activeFeature} Interpretation`
                      : `${overlayMode} Summary`}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {activeFeature === "Contrast" &&
                      "Contrast focus highlights sharper local intensity transitions, showing where textural irregularity most strongly contributes to the model’s high-risk assessment."}
                    {activeFeature === "Homogeneity" &&
                      "Homogeneity focus emphasizes reduced structural uniformity, helping explain why the model interprets this region as less consistent with lower-risk reference scans."}
                    {activeFeature === "Energy" &&
                      "Energy focus highlights texture compactness and concentration, showing moderate but meaningful support to the final decision."}
                    {activeFeature === "Correlation" &&
                      "Correlation focus highlights spatial dependency patterns in the texture map, acting as a secondary feature that refines the model’s interpretation."}
                    {!activeFeature &&
                      overlayMode === "Saliency" &&
                      explainCase.saliency}
                    {!activeFeature &&
                      overlayMode === "Contrast" &&
                      "Contrast view emphasizes regions with stronger local texture variation, helping explain why the classifier separates abnormal tissue from lower-risk patterns."}
                    {!activeFeature &&
                      overlayMode === "Homogeneity" &&
                      "Homogeneity view highlights structural consistency shifts. Lower uniformity in the hippocampal texture supports the abnormal classification outcome."}
                    {!activeFeature &&
                      overlayMode === "Energy" &&
                      "Energy view reflects texture compactness and distribution strength. Moderate energy concentration supports separation but is not the primary decision driver."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-[26px] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
              <GitBranch className="h-4 w-4 text-white/50" />
              Cascade Decision Pathway
            </div>

            {liveCase ? (
              <CascadeFlow result={liveCase.result} />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {explainCase.rationale.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="text-xs text-white/50">
                      Reason {index + 1}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/70">{item}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <div className={cn("glass rounded-[26px] border p-3", confidenceAccentClass)}>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Brain className="h-4 w-4 text-white/50" />
              Decision Confidence
            </div>

            <div className="mt-2 text-3xl font-bold tracking-tight text-white">
              {Math.round(explainCase.confidence * 100)}%
            </div>

            <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/5">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  confidenceBarClass
                )}
                style={{ width: barsMounted ? `${explainCase.confidence * 100}%` : "0%" }}
              />
            </div>

            <p className="mt-2 text-sm leading-6 text-white/65">
              {explainCase.action}
            </p>
          </div>

          {/* Show real model feature importances when available.
              For live cases without importances, hide this panel entirely.
              For static demo cases, show illustrative GLCM bars. */}
          {hasRealFeats ? (
            <div className="glass rounded-[26px] p-3">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Activity className="h-4 w-4 text-white/50" />
                Top Model Features
              </div>
              <div className="mt-3 space-y-2">
                {realFeats.map((f) => (
                  <div
                    key={f.feature}
                    title={f.feature}
                    className="group relative rounded-2xl border border-white/10 bg-white/5 p-2.5 transition-all duration-300 hover:scale-[1.02] hover:border-white/20 hover:bg-white/10"
                  >
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate pr-2 text-white/80">{f.label}</span>
                      <span className="shrink-0 text-white/50">{(f.importance * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", featColor(f.label))}
                        style={{ width: barsMounted ? `${f.importance * 100}%` : "0%" }}
                      />
                    </div>
                    <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-56 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl border border-white/10 bg-black/85 px-3 py-2 text-[11px] leading-5 text-white/75 shadow-[0_0_20px_rgba(0,0,0,0.35)] backdrop-blur-md group-hover:block">
                      {f.feature}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !liveCase ? (
            /* Demo case — illustrative GLCM bars */
            <div className="glass rounded-[26px] p-3">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Activity className="h-4 w-4 text-white/50" />
                GLCM Texture Features
                <span className="ml-auto rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/35">Demo</span>
              </div>
              <div className="mt-3 space-y-2">
                {features.map((f) => (
                  <div
                    key={f.name}
                    onMouseEnter={() => setActiveFeature(f.name)}
                    onMouseLeave={() => setActiveFeature(null)}
                    className={cn(
                      "group relative cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-2.5 transition-all duration-300 hover:scale-[1.02]",
                      activeFeature === f.name && "border-white/20 bg-white/10 shadow-[0_0_22px_rgba(255,255,255,0.06)]"
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-white/80">{f.name}</span>
                      <span className="text-white/50">{(f.value * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", f.color)}
                        style={{ width: barsMounted ? `${f.value * 100}%` : "0%" }}
                      />
                    </div>
                    <div className="mt-1.5 text-xs text-white/55">{f.note}</div>
                    <div className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-56 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl border border-white/10 bg-black/85 px-3 py-2 text-[11px] leading-5 text-white/75 shadow-[0_0_20px_rgba(0,0,0,0.35)] backdrop-blur-md group-hover:block">
                      {f.tooltip}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null /* live case but no importances — panel omitted */}

          <div className="glass rounded-[26px] bg-gradient-to-br from-white/10 to-white/5 p-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <ShieldCheck className="h-4 w-4 text-white/50" />
              Recommended Action
            </div>

            <p className="mt-2 text-sm leading-6 text-white/65">
              {explainCase.action}
            </p>

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3.5">
              <div className="text-xs text-white/50">Suggested workflow</div>
              <ul className="mt-2 space-y-2 text-sm text-white/70">
                <li>• Review the explainability overlay for regional emphasis.</li>
                <li>• Open the MRI Viewer and verify slice-level saliency.</li>
                <li>• Cross-check findings with clinician judgment before conclusion.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* L–R Asymmetry — full width, live cases with GLCM data only */}
      {liveCase && Object.keys(liveCase.result.glcm_summary ?? {}).length > 0 && (
        <AsymmetryPanel glcm={liveCase.result.glcm_summary!} />
      )}
    </div>
  );
}