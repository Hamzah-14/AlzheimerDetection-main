"use client";
import {
  useAnalysisStore,
  type AnalysisCase,
  type FeatureImportanceEntry,
  type CascadeResult,
  type ShapEntry,
} from "@/lib/analysis-store";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { EXPLAIN_DATA } from "@/lib/cases";
import { CaseSwitcher } from "@/components/ui/case-switcher";
import {
  Brain,
  Activity,
  ChevronRight,
  ShieldCheck,
  GitBranch,
  Sparkles,
  MapPin,
  FlaskConical,
} from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";
import { EmptyState } from "@/components/ui/empty-state";

type OverlayMode = "Saliency" | "Contrast" | "Homogeneity" | "Energy";
type FeatureName = "Contrast" | "Homogeneity" | "Energy" | "Correlation" | null;

// -- Cascade Decision Pathway --------------------------------------------------
function CascadeFlow({ result }: { result: CascadeResult }) {
  const { task1, task3, task2, final } = result;
  const stopped = final.cascade_stopped_at;

  const adPct  = Math.round((task1?.probabilities?.AD  ?? 0) * 100);
  const nadPct = Math.round((task1?.probabilities?.NC  ?? 0) * 100);
  const mciPct = Math.round((task3?.probabilities?.MCI ?? 0) * 100);
  const ncPct  = Math.round((task3?.probabilities?.NC  ?? 0) * 100);

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
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-white/50">Stage 1 -- AD Screening</span>
          <span className={cn("rounded-md px-2 py-0.5 text-[10px]",
            stopped === "task1" ? "bg-red-400/15 text-red-300" : "bg-emerald-400/10 text-emerald-400"
          )}>
            {stopped === "task1" ? "Decision made" : "Passed ---"}
          </span>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <div className="text-[10px] text-white/40">Alzheimer&apos;s</div>
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

      <div className="flex items-center gap-2 px-3">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-[10px] text-white/30">
          {stopped === "task1" ? "AD --- 65% --- stopped" : "Non-AD --- continue"}
        </span>
        <div className="h-px flex-1 bg-white/8" />
      </div>

      {(stopped === "task3" || stopped === "task2") && (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-white/50">Stage 3 -- MCI vs Normal</span>
              <span className={cn("rounded-md px-2 py-0.5 text-[10px]",
                stopped === "task3" ? "bg-amber-400/15 text-amber-300" : "bg-emerald-400/10 text-emerald-400"
              )}>
                {stopped === "task3" ? "Decision made" : "MCI --- continue ---"}
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

          {stopped === "task2" && (
            <>
              <div className="flex items-center gap-2 px-3">
                <div className="h-px flex-1 bg-white/8" />
                <span className="text-[10px] text-white/30">MCI --- 51% --- progression check</span>
                <div className="h-px flex-1 bg-white/8" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/50">Stage 2 -- MCI Progression</span>
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
                    {final.mci_status && <span className="ml-2 text-white/50">-- {final.mci_status}</span>}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      <div className={cn("flex items-center gap-3 rounded-2xl border p-3",
        outcomeColor === "red"   ? "border-red-400/25 bg-red-500/8" :
        outcomeColor === "amber" ? "border-amber-400/25 bg-amber-500/8" :
        "border-cyan-400/25 bg-cyan-500/8"
      )}>
        <div className={cn("h-2.5 w-2.5 shrink-0 rounded-full",
          outcomeColor === "red" ? "bg-red-400" : outcomeColor === "amber" ? "bg-amber-400" : "bg-cyan-400"
        )} />
        <div className="flex-1">
          <div className={cn("text-sm font-semibold",
            outcomeColor === "red" ? "text-red-300" : outcomeColor === "amber" ? "text-amber-300" : "text-cyan-300"
          )}>
            {final.prediction}
          </div>
          <div className="mt-0.5 text-[10px] text-white/35">
            {Math.round(final.confidence * 100)}% confidence -- stopped at {stopped}
          </div>
        </div>
      </div>
    </div>
  );
}

// -- L---R Asymmetry Panel -------------------------------------------------------
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
        L---R Hippocampal Asymmetry
      </div>
      <p className="mb-3 text-xs text-white/40">
        Bilateral GLCM comparison --- texture asymmetry between hemispheres is a key neurodegeneration biomarker.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {pairs.map((p) => {
          const lPct    = Math.round((p.L / p.maxLR) * 100);
          const rPct    = Math.round((p.R / p.maxLR) * 100);
          const absAsym = Math.abs(p.asymPct);
          const asymColor =
            absAsym > 20 ? "text-red-400" :
            absAsym > 10 ? "text-amber-400" : "text-cyan-400";
          const dominant = p.L > p.R ? "L" : p.R > p.L ? "R" : "---";
          return (
            <div key={p.key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-white/70">{p.label}</span>
                <span className={cn("text-[11px] font-semibold", asymColor)}>
                  {absAsym.toFixed(1)}% {dominant !== "---" && <span className="font-normal text-white/40">({dominant} dom.)</span>}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 text-[10px] text-blue-400">L</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-blue-400/70 transition-[width] duration-500 ease-out"
                      style={{ width: mounted ? `${lPct}%` : "0%" }} />
                  </div>
                  <span className="w-7 text-right text-[10px] text-white/45">{lPct}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 text-[10px] text-purple-400">R</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full bg-purple-400/70 transition-[width] duration-500 ease-out"
                      style={{ width: mounted ? `${rPct}%` : "0%" }} />
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

// -- buildLiveExplain ----------------------------------------------------------
function buildLiveExplain(c: AnalysisCase) {
  const final    = c.result.final;
  const pred     = final.prediction;
  const conf     = final.confidence;
  const task1    = c.result.task1;
  const task2    = c.result.task2;
  const task3    = c.result.task3;

  const datasetClass: "AD" | "MCI" | "NC" =
    pred.includes("Alzheimer") ? "AD" :
    pred.includes("MCI")       ? "MCI" : "NC";

  const adProb  = task1?.probabilities?.AD  ?? 0;
  const mciProb = task3?.probabilities?.MCI ?? 0;
  const ncProb  = task1?.probabilities?.NC  ?? 0;
  const glcm    = c.result.glcm_summary ?? {};

  const norm = (key: string, lo: number, hi: number, fallback: number) => {
    const v = glcm[key];
    return v !== undefined ? Math.min(1, Math.max(0, (v - lo) / (hi - lo))) : fallback;
  };

  const features = [
    { name: "Contrast" as const,    color: "bg-red-400",     value: norm("L_contrast",    0, 80,  adProb),     note: "Mean bilateral GLCM contrast (L hippocampus, all blocks & distances)",        tooltip: "Higher contrast indicates greater local intensity variation --- a key texture marker elevated in neurodegeneration." },
    { name: "Homogeneity" as const, color: "bg-purple-400",  value: norm("L_homogeneity", 0.3, 1.0, 1 - mciProb), note: "Mean bilateral GLCM homogeneity (L hippocampus)",                             tooltip: "Homogeneity measures texture uniformity. Values drop with tissue degradation typical of MCI and AD." },
    { name: "Energy" as const,      color: "bg-cyan-400",    value: norm("L_energy",      0, 0.5, ncProb),     note: "Mean bilateral GLCM energy (L hippocampus)",                                 tooltip: "Energy captures texture compactness. Healthy hippocampal tissue tends to show higher energy values." },
    { name: "Correlation" as const, color: "bg-emerald-400", value: norm("L_correlation", -0.2, 1.0, conf),    note: "Mean bilateral GLCM correlation (L hippocampus)",                            tooltip: "Correlation reflects spatial linear dependency between voxel intensities across hippocampal sub-regions." },
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
    `AD probability ${(adProb*100).toFixed(1)}% --- ${adProb > 0.5 ? "above" : "below"} the 65% cascade threshold.`,
    `MCI probability ${(mciProb*100).toFixed(1)}% --- ${mciProb > 0.55 ? "above" : "below"} the 55% threshold. Cascade stopped at ${final.cascade_stopped_at}.`,
    `Based on ${c.scans.length} longitudinal scan${c.scans.length > 1 ? "s" : ""}. Follow-up: ${c.patient.age}yo ${c.patient.sex === "M" ? "male" : "female"}, APOE ${c.patient.apoe ?? "unknown"}.`,
  ];

  return {
    datasetClass,
    decision,
    confidence: conf,
    region: c.region,
    summary: [
      `Task 1 (AD Screening): ${(adProb*100).toFixed(1)}% AD probability --- ${adProb > 0.65 ? "above threshold, cascade stopped" : "below threshold, cascade continued"}.`,
      task3 ? `Task 3 (MCI vs NC): ${(mciProb*100).toFixed(1)}% MCI probability --- ${mciProb > 0.55 ? "MCI pattern detected" : "normal pattern"}.` : null,
      task2 ? `Task 2 (Conversion): ${((task2.probabilities?.converting_MCI ?? 0)*100).toFixed(1)}% conversion risk.` : null,
    ].filter(Boolean).join(" ") + ` Classification: ${pred} (${(conf*100).toFixed(1)}% confidence).`,
    saliency: c.result.ai_narrative ?? [
      `The cascade classifier ran ${final.cascade_stopped_at === "task1" ? "one stage" : final.cascade_stopped_at === "task3" ? "two stages" : "three stages"}.`,
      `AD screening (Task 1) returned ${(adProb*100).toFixed(1)}% --- ${adProb > 0.65 ? "above the 65% AD threshold, decision made at this stage." : "below the AD threshold, case advanced to MCI screening."}`,
      task3 ? `MCI vs NC (Task 3) returned ${(mciProb*100).toFixed(1)}% MCI probability${task2 ? ", triggering the conversion risk stage." : "."}` : null,
      task2 ? `Conversion risk (Task 2): ${((task2.probabilities?.converting_MCI ?? 0)*100).toFixed(1)}% probability of MCI progressing to Alzheimer's.` : null,
    ].filter(Boolean).join(" "),
    action,
    rationale,
    features,
    featureImportances: c.result.feature_importances ?? {},
  };
}

// -- Helpers -------------------------------------------------------------------
const featColor = (label: string) => {
  if (label.startsWith("CSF"))       return "bg-red-400";
  if (label.startsWith("Asymmetry")) return "bg-amber-400";
  if (label.startsWith("Temporal"))  return "bg-purple-400";
  return "bg-cyan-400";
};

const featDescription = (feature: string): { title: string; desc: string } => {
  const f = feature.toLowerCase();
  if (f.includes("ptau_abeta") || f.includes("ptau/abeta"))
    return { title: "CSF pTau / A--42 ratio", desc: "The strongest single Alzheimer's biomarker. Low A--42 indicates amyloid plaque formation; high pTau reflects neurofibrillary tangles. The ratio amplifies both signals." };
  if (f.includes("csf_ptau") || f === "ptau")
    return { title: "pTau-181 (CSF)", desc: "Phosphorylated tau in cerebrospinal fluid. Highly specific to Alzheimer's neurofibrillary tangle pathology --- elevated levels strongly suggest AD." };
  if (f.includes("csf_tau") || f === "tau")
    return { title: "Total Tau (CSF)", desc: "Total tau protein in CSF. Elevated levels indicate active neuronal damage, though not specific to Alzheimer's --- any neurodegenerative process can raise it." };
  if (f.includes("abeta") || f.includes("abeta42"))
    return { title: "Amyloid-beta 42 (CSF)", desc: "A--42 in CSF decreases as amyloid plaques accumulate in the brain, trapping the protein. One of the earliest detectable Alzheimer's changes." };
  if (f === "age")
    return { title: "Patient age", desc: "The single strongest non-modifiable risk factor. Risk roughly doubles every 5 years after age 65." };
  if (f.includes("educ"))
    return { title: "Years of education", desc: "A proxy for cognitive reserve. Higher education correlates with delayed symptom onset." };
  if (f.includes("sex"))
    return { title: "Biological sex", desc: "Influences risk profiles and CSF biomarker baselines." };
  if (f.includes("apoe"))
    return { title: "APOE e4 allele count", desc: "The strongest known genetic risk factor for late-onset AD. Each e4 copy roughly doubles risk." };
  if (f.startsWith("temp_")) {
    const side = f.includes("_l_") ? "left" : f.includes("_r_") ? "right" : "asymmetry";
    if (f.includes("contrast"))    return { title: `Temporal contrast slope (${side})`, desc: `Rate of change in hippocampal GLCM contrast across visits (${side}). A rising slope indicates progressive texture heterogeneity.` };
    if (f.includes("homogeneity")) return { title: `Temporal homogeneity slope (${side})`, desc: `Rate of change in texture uniformity across visits (${side}). Declining homogeneity over time suggests increasing microstructural disorganisation.` };
    if (f.includes("energy"))      return { title: `Temporal energy slope (${side})`, desc: `Rate of change in textural regularity across visits (${side}). Falling energy indicates progressive loss of ordered hippocampal microstructure.` };
    if (f.includes("entropy"))     return { title: `Temporal entropy slope (${side})`, desc: `Rate of change in texture disorder across visits (${side}). Increasing entropy signals growing microstructural complexity.` };
    return { title: `Temporal GLCM slope (${side})`, desc: `Longitudinal rate of change in a hippocampal radiomic feature (${side}).` };
  }
  const side = f.startsWith("l_") ? "left hippocampus" : f.startsWith("r_") ? "right hippocampus" : f.startsWith("a_") ? "L/R asymmetry" : "hippocampus";
  if (f.includes("contrast"))      return { title: `GLCM contrast (${side})`,      desc: `Local intensity variation in the ${side}. Higher values indicate more heterogeneous tissue texture.` };
  if (f.includes("homogeneity"))   return { title: `GLCM homogeneity (${side})`,   desc: `Texture uniformity in the ${side}. Lower homogeneity suggests irregular microstructure.` };
  if (f.includes("energy"))        return { title: `GLCM energy (${side})`,        desc: `Textural regularity in the ${side}. Declining energy reflects increasing disorganisation.` };
  if (f.includes("correlation"))   return { title: `GLCM correlation (${side})`,   desc: `Linear texture dependencies in the ${side}.` };
  if (f.includes("entropy"))       return { title: `GLCM entropy (${side})`,       desc: `Texture disorder in the ${side}. Higher entropy signals increasing microstructural irregularity.` };
  if (f.includes("dissimilarity")) return { title: `GLCM dissimilarity (${side})`, desc: `A linear contrast variant in the ${side}. High values indicate irregular texture.` };
  return { title: feature, desc: "Radiomic feature extracted from hippocampal MRI used by the ensemble classifier." };
};

// -- Regional Attribution ------------------------------------------------------
// Derives L / R / Temporal / Clinical attribution weights from feature importances.
// Assumes L_ / R_ prefix indicates anatomical side; temp_ prefix = temporal features.
function computeRegionalAttribution(importances: Record<string, FeatureImportanceEntry[]>) {
  let L = 0, R = 0, temporal = 0, clinical = 0;
  const all = Object.values(importances).flat();
  for (const f of all) {
    const name = f.feature.toLowerCase();
    const imp  = f.importance;
    if (name.startsWith("temp_") || name.startsWith("baseline_temp")) {
      temporal += imp;
    } else if (["csf_", "meta_csf", "age", "sex_encoded", "apoe", "education", "race", "n_scans", "followup"].some(p => name.includes(p))) {
      clinical += imp;
    } else if (name.startsWith("l_") || name.startsWith("baseline_l") || (name.includes("_l_") && !name.includes("_r_"))) {
      L += imp;
    } else if (name.startsWith("r_") || name.startsWith("baseline_r") || (name.includes("_r_") && !name.includes("_l_"))) {
      R += imp;
    } else {
      // Asymmetry or unknown --- split evenly
      L += imp / 2;
      R += imp / 2;
    }
  }
  const total = L + R + temporal + clinical || 1;
  const lPct  = L / total;
  const rPct  = R / total;
  return {
    L: lPct, R: rPct, temporal: temporal / total, clinical: clinical / total,
    dominant: lPct > rPct + 0.06 ? "Left-weighted" : rPct > lPct + 0.06 ? "Right-weighted" : "Bilateral",
    primarySource: temporal / total > 0.3 ? "Longitudinal change" : (L + R) / total > 0.5 ? "Hippocampal texture" : "Clinical factors",
  };
}

// -- Feature plain-language translation ---------------------------------------
const PLAIN_TRANSLATIONS: [string, string][] = [
  ["ptau_abeta",    "CSF pTau/A--42 ratio deviation"],
  ["ptau",          "Elevated phosphorylated tau (CSF)"],
  ["abeta",         "Reduced amyloid-beta 42 (CSF)"],
  ["csf_",          "CSF biomarker signal"],
  ["apoe",          "APOE e4 genetic risk factor"],
  ["age",           "Patient age risk factor"],
  ["education",     "Cognitive reserve (education)"],
  ["dissimilarity", "Heterogeneous neighbouring tissue"],
  ["contrast",      "Elevated local intensity variation"],
  ["homogeneity",   "Reduced tissue uniformity"],
  ["energy",        "Loss of textural regularity"],
  ["entropy",       "Increased texture disorder"],
  ["correlation",   "Altered spatial intensity pattern"],
  ["asym",          "Left---right hippocampal asymmetry"],
  ["temp_",         "Longitudinal texture change rate"],
  ["slope",         "Progressive change over time"],
];

function toPlainLanguage(feature: string): string {
  const f = feature.toLowerCase();
  for (const [key, label] of PLAIN_TRANSLATIONS) {
    if (f.includes(key)) return label;
  }
  return feature;
}

// -- SHAP Waterfall ------------------------------------------------------------
function ShapWaterfall({ entries }: { entries: ShapEntry[] }) {
  const maxMag = Math.max(...entries.map((e) => e.magnitude), 1e-9);
  return (
    <div className="glass rounded-[26px] p-4">
      <div className="flex items-center gap-2 text-sm text-white/70">
        <Sparkles className="h-4 w-4 text-white/50" />
        SHAP Feature Attribution
      </div>
      <p className="mt-0.5 text-[14px] text-white/35">How each feature pushed this prediction</p>

      <div className="mt-3 flex items-center gap-2">
        <div className="w-[38%] shrink-0" />
        <div className="flex flex-1 justify-between text-[14px] text-white/25">
          <span>--- NC</span>
          <span>MCI/AD ---</span>
        </div>
        <div className="w-14 shrink-0" />
      </div>

      <div className="mt-1 space-y-1.5">
        {entries.map((e) => {
          const barPct = (e.magnitude / maxMag) * 100;
          const isPos  = e.direction === "positive";
          return (
            <div key={e.feature} className="flex items-center gap-2">
              <div className="w-[38%] shrink-0 truncate text-right text-[14px] text-white/50">{e.label}</div>
              <div className="relative flex h-5 flex-1 items-center">
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
                {isPos ? (
                  <div className="absolute left-1/2 h-3 rounded-r-full bg-red-400/60" style={{ width: `${barPct / 2}%` }} />
                ) : (
                  <div className="absolute right-1/2 h-3 rounded-l-full bg-cyan-400/50" style={{ width: `${barPct / 2}%` }} />
                )}
              </div>
              <div className={cn("w-14 shrink-0 text-right font-mono text-[14px]", isPos ? "text-red-400" : "text-cyan-400")}>
                {e.shap_value > 0 ? "+" : ""}{e.shap_value.toFixed(3)}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[14px] leading-5 text-white/30">
        SHAP values show the marginal contribution of each feature to this patient&apos;s prediction. Positive = toward disease, negative = toward normal.
      </p>
    </div>
  );
}

// -- GLCM Signal Interpretation Grid ------------------------------------------
const GLCM_SIGNALS = [
  {
    key: "contrast", label: "Contrast", icon: "---", direction: "Elevated = concern",
    color: "text-red-400", activeBorder: "border-red-400/20 bg-red-400/5",
    plain: "Greater local intensity variation between neighbouring brain cells.",
    clinical: "Higher values in the hippocampus suggest increasingly heterogeneous tissue --- a microstructural pattern associated with progressive neurodegeneration as ordered cellular architecture breaks down.",
  },
  {
    key: "dissimilarity", label: "Dissimilarity", icon: "---", direction: "Elevated = concern",
    color: "text-red-400", activeBorder: "border-red-400/20 bg-red-400/5",
    plain: "More heterogeneous neighbouring tissue patterns.",
    clinical: "A linear measure of textural contrast capturing how different adjacent voxel intensities are. Rising dissimilarity indicates irregular hippocampal tissue architecture consistent with progressive atrophy.",
  },
  {
    key: "homogeneity", label: "Homogeneity", icon: "---", direction: "Reduced = concern",
    color: "text-amber-400", activeBorder: "border-amber-400/20 bg-amber-400/5",
    plain: "Loss of tissue uniformity and structural organisation.",
    clinical: "Reflects how uniformly organised hippocampal tissue appears. Declining homogeneity is one of the earliest structural signs of hippocampal degeneration, as ordered neuronal columns are progressively replaced by irregular, atrophied tissue.",
  },
  {
    key: "energy", label: "Energy", icon: "---", direction: "Reduced = concern",
    color: "text-amber-400", activeBorder: "border-amber-400/20 bg-amber-400/5",
    plain: "Less regular and compact texture structure.",
    clinical: "Also known as Angular Second Moment --- measures textural regularity. Decreasing energy indicates loss of the tight, organised microstructure that characterises healthy hippocampal tissue, reflecting progressive microstructural disorganisation.",
  },
  {
    key: "entropy", label: "Entropy", icon: "---", direction: "Elevated = concern",
    color: "text-red-400", activeBorder: "border-red-400/20 bg-red-400/5",
    plain: "Greater texture complexity and disorder.",
    clinical: "Quantifies disorder and complexity in the texture pattern. Increasing entropy reflects growing microstructural irregularity --- often paralleling progressive hippocampal atrophy and consistent with MCI-to-AD conversion pathology.",
  },
] as const;

// -- Main Page -----------------------------------------------------------------
export default function ExplainPage() {
  usePageTitle("Explainable AI");
  const searchParams = useSearchParams();
  const router       = useRouter();

  const caseId         = searchParams.get("case") || "AUD-0231";
  const fallbackRegion = searchParams.get("region") || "Hippocampus";

  const [storeReady,  setStoreReady]  = useState(false);
  const [barsMounted, setBarsMounted] = useState(false);

  useEffect(() => { setStoreReady(true); }, []);
  useEffect(() => {
    setBarsMounted(false);
    const t = setTimeout(() => setBarsMounted(true), 80);
    return () => clearTimeout(t);
  }, [caseId]);

  const storeCase  = useAnalysisStore((s) => s.getCase(caseId));
  const latestCase = useAnalysisStore((s) => s.latestCase());

  const liveCase: AnalysisCase | undefined = !storeReady ? undefined
    : storeCase ?? ((!caseId || !EXPLAIN_DATA[caseId]) ? latestCase : undefined);

  const explainCase = liveCase
    ? buildLiveExplain(liveCase)
    : EXPLAIN_DATA[caseId] ?? { ...EXPLAIN_DATA["AUD-0231"], region: fallbackRegion };

  const displayCaseId = liveCase?.id ?? caseId;
  const showEmpty     = !liveCase && !EXPLAIN_DATA[caseId];

  // Real feature importances --- flattened, deduplicated, top 8
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

  // Regional attribution (derived from importances)
  const regionAttr = useMemo(() => {
    if (!hasRealFeats) return null;
    return computeRegionalAttribution(rawImportances);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCase]);

  // Which GLCM signals are active in this case
  const activeSignalKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const f of realFeats) {
      const n = f.feature.toLowerCase();
      for (const s of GLCM_SIGNALS) { if (n.includes(s.key)) keys.add(s.key); }
    }
    return keys;
  }, [realFeats]);

  // Cascade outcome styling
  const final       = liveCase?.result?.final ?? { prediction: explainCase.decision, confidence: explainCase.confidence, cascade_stopped_at: "task1" as const };
  const pred        = final.prediction;
  const conf        = final.confidence;
  const stopped     = final.cascade_stopped_at;
  const outcomeColor =
    pred.includes("Alzheimer") ? "red" :
    pred.includes("MCI")       ? "amber" : "cyan";

  const confidenceBarClass =
    conf >= 0.75 ? "bg-gradient-to-r from-red-400 via-rose-400 to-orange-400" :
    conf >= 0.5  ? "bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400" :
                   "bg-gradient-to-r from-blue-400 via-cyan-400 to-sky-400";

  const confidenceAccentClass =
    conf >= 0.75 ? "border-red-400/20 bg-gradient-to-br from-red-500/10 to-white/5" :
    conf >= 0.5  ? "border-purple-400/20 bg-gradient-to-br from-purple-500/10 to-white/5" :
                   "border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-white/5";

  const handleExport = () => {
    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const content = [
      "------------------------------------------------------------------------------------------------------------------------------------------------------",
      "  ALZ PLATFORM -- EXPLAINABILITY SUMMARY",
      `  Case ${displayCaseId}  --  Generated ${date}`,
      "------------------------------------------------------------------------------------------------------------------------------------------------------",
      "",
      "PREDICTION",
      `  Decision        ${explainCase.decision}`,
      `  Confidence      ${Math.round(explainCase.confidence * 100)}%`,
      `  Region          ${explainCase.region}`,
      "",
      "SUMMARY",
      `  ${explainCase.summary}`,
      "",
      "------------------------------------------------------------------------------------------------------------------------------------------------------",
      "  Pipeline: 3D GLCM Radiomics  --  NeuroSight Platform",
      "------------------------------------------------------------------------------------------------------------------------------------------------------",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `explainability-${displayCaseId}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  if (showEmpty) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Explainable AI</h1>
          <p className="mt-1 text-sm text-white/60">Model reasoning, feature attribution, and clinician-friendly interpretation.</p>
        </div>
        <EmptyState icon={Brain} title="No analysis available"
          description="Upload and run a scan to see live explainability results."
          action={{ label: "Upload a Case", onClick: () => router.push("/upload") }} />
      </div>
    );
  }

  const task1r  = liveCase?.result?.task1;
  const task3r  = liveCase?.result?.task3;
  const adPct   = Math.round((task1r?.probabilities?.AD  ?? 0) * 100);
  const mciPct  = Math.round((task3r?.probabilities?.MCI ?? 0) * 100);
  const ncPct   = Math.round((task3r?.probabilities?.NC  ?? 0) * 100);

  const cascadeText = !liveCase ? explainCase.summary
    : stopped === "task1"
    ? `AD screening returned ${adPct}% --- above the 65% threshold. Classification made at Stage 1.`
    : stopped === "task3"
    ? `AD screening returned ${adPct}% (below AD threshold). MCI vs Normal returned ${mciPct}% MCI / ${ncPct}% Normal --- classification made at Stage 2.`
    : `All three stages ran. AD: ${adPct}%. MCI probability of ${mciPct}% triggered conversion risk analysis at Stage 3.`;

  const actionBullets: string[] =
    explainCase.datasetClass === "AD"  ? ["Refer to neurology specialist", "Consider PET / CSF biomarker confirmation", "Follow-up MRI in 6---12 months"] :
    explainCase.datasetClass === "MCI" ? ["Schedule 6-month follow-up MRI", "Monitor with cognitive assessments (MoCA/MMSE)", "Consider CSF biomarker screening"] :
    ["Continue routine monitoring", "Next scan in 12---18 months unless symptoms develop"];

  const verdictColorClass = {
    red:   "text-red-300",
    amber: "text-amber-300",
    cyan:  "text-cyan-300",
  }[outcomeColor];

  return (
    <div className="space-y-5">
      {/* -- Header -- */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Explainable AI</h1>
          <p className="mt-1 text-sm text-white/60">Feature attribution, cascade evidence, and clinician-friendly interpretation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
            Case: <span className="text-white/90">{displayCaseId}</span> -- ROI: <span className="text-white/90">{explainCase.region}</span>
          </div>
          <button onClick={handleExport} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15">
            Export Summary
          </button>
        </div>
      </div>

      <CaseSwitcher currentCaseId={caseId} />

      {/* -- Row 1: Compact 3-col summary -- */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* Card 1: Case Verdict */}
        <div className={cn("glass rounded-[26px] border p-4", confidenceAccentClass)}>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/35">
            <Brain className="h-3 w-3" />
            Classification -- {displayCaseId}
          </div>
          <h2 className={cn("mt-2 text-xl font-bold tracking-tight leading-tight", verdictColorClass)}>
            {pred}
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-white/45">
            {hasRealFeats
              ? `Top driver: ${toPlainLanguage(realFeats[0]?.feature ?? "")}`
              : cascadeText.split(".")[0] + "."}
          </p>
          <button
            onClick={() => router.push(`/viewer?case=${encodeURIComponent(caseId)}&region=${encodeURIComponent(explainCase.region)}`)}
            className="mt-3 flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70"
          >
            Inspect in MRI Viewer <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Card 2: Confidence + Cascade */}
        <div className="glass rounded-[26px] p-4">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Brain className="h-4 w-4 text-white/40" />
            Confidence
          </div>
          <div className="mt-1.5 flex items-end gap-2">
            <span className="text-3xl font-bold tracking-tight text-white">{Math.round(conf * 100)}%</span>
            <span className="mb-1 text-xs text-white/35">model confidence</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", confidenceBarClass)}
              style={{ width: barsMounted ? `${conf * 100}%` : "0%" }} />
          </div>
          <p className="mt-3 text-xs leading-5 text-white/50">{cascadeText}</p>
        </div>

        {/* Card 3: Recommended Action */}
        <div className="glass rounded-[26px] p-4">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <ShieldCheck className="h-4 w-4 text-white/40" />
            Recommended Action
          </div>
          <p className="mt-2 text-sm leading-5 text-white/70">{explainCase.action}</p>
          <ul className="mt-3 space-y-1.5">
            {actionBullets.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-white/45">
                <span className="mt-[3px] text-white/20">--</span>{b}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* AI clinical narrative --- compact full-width strip when available */}
      {liveCase?.result?.ai_narrative && (
        <div className="glass rounded-[26px] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/30">
              <Sparkles className="h-3 w-3" /> Clinical Narrative
            </p>
            <span className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-300">
              AI-generated -- may make mistakes -- not a substitute for clinical judgement
            </span>
          </div>
          <p className="text-sm italic leading-7 text-white/70">{liveCase.result.ai_narrative}</p>
        </div>
      )}

      {/* -- Row 2: Top Model Features (wide) + Regional Attribution (narrow) -- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">

        {/* Left: Top Model Features + SHAP stacked */}
        <div className="space-y-4">
          {hasRealFeats ? (
            <div className="glass rounded-[26px] p-4 overflow-visible relative z-20 hover:z-50">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Activity className="h-4 w-4 text-white/50" />
                Top Model Features
              </div>
              <p className="mt-0.5 text-xs text-white/35">Hover each row for a clinical explanation.</p>
              <div className="mt-3 space-y-2 overflow-visible">
                {realFeats.map((f) => {
                  const tip = featDescription(f.feature);
                  return (
                    <div key={f.feature}
                      className="group relative rounded-2xl border border-white/10 bg-white/5 p-2.5 transition-all duration-300 hover:scale-[1.02] hover:border-white/20 hover:bg-white/10"
                    >
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="truncate pr-2 text-white/80">{f.label}</span>
                        <span className="shrink-0 text-white/50">{(f.importance * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/5">
                        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", featColor(f.label))}
                          style={{ width: barsMounted ? `${f.importance * 100}%` : "0%" }} />
                      </div>
                      <div className="pointer-events-none absolute left-1/2 top-0 z-[200] hidden w-80 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-2xl border border-white/10 bg-[#0f0f18] px-4 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.8)] backdrop-blur-md group-hover:block">
                        <p className="mb-1.5 text-xs font-semibold text-white">{tip.title}</p>
                        <p className="text-[11px] leading-relaxed text-white/60">{tip.desc}</p>
                        <div className="mt-2 font-mono text-[10px] text-white/25">{f.feature}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="glass rounded-[26px] p-4">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Activity className="h-4 w-4 text-white/50" />
                GLCM Texture Features
                <span className="ml-auto rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/35">Demo</span>
              </div>
              <div className="mt-3 space-y-2">
                {explainCase.features.map((f) => (
                  <div key={f.name} className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-white/80">{f.name}</span>
                      <span className="text-white/50">{(f.value * 100).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/5">
                      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", f.color)}
                        style={{ width: barsMounted ? `${f.value * 100}%` : "0%" }} />
                    </div>
                    <div className="mt-1 text-xs text-white/40">{f.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SHAP waterfall stacked below features when available */}
          {liveCase?.result?.shap && liveCase.result.shap.length > 0 && (
            <ShapWaterfall entries={liveCase.result.shap} />
          )}
        </div>

        {/* Right: Regional Attribution (compact) */}
        {regionAttr ? (
          <div className="glass rounded-[26px] p-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <MapPin className="h-4 w-4 text-white/50" />
              Regional Attribution
            </div>
            <p className="mt-0.5 mb-3 text-xs text-white/35">Which anatomical region drove the decision.</p>

            <div className="flex h-2.5 w-full overflow-hidden rounded-full">
              {[
                { pct: regionAttr.L,        color: "bg-cyan-400/70" },
                { pct: regionAttr.R,        color: "bg-purple-400/70" },
                { pct: regionAttr.temporal, color: "bg-amber-400/60" },
                { pct: regionAttr.clinical, color: "bg-white/25" },
              ].filter(s => s.pct > 0.02).map((s, i) => (
                <div key={i} className={cn("h-full", s.color)} style={{ width: `${s.pct * 100}%` }} />
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {[
                { label: "Left hippocampus",  pct: regionAttr.L,        color: "bg-cyan-400/70",   text: "text-cyan-300" },
                { label: "Right hippocampus", pct: regionAttr.R,        color: "bg-purple-400/70", text: "text-purple-300" },
                { label: "Temporal change",   pct: regionAttr.temporal, color: "bg-amber-400/60",  text: "text-amber-300" },
                { label: "Clinical factors",  pct: regionAttr.clinical, color: "bg-white/25",      text: "text-white/50" },
              ].filter(s => s.pct > 0.02).map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.color)} />
                  <span className="text-xs text-white/45 truncate">{s.label}</span>
                  <span className={cn("ml-auto text-xs font-mono font-semibold shrink-0", s.text)}>{(s.pct * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-white/[0.05] pt-3">
              <p className="text-xs leading-5 text-white/50">
                <span className="font-medium text-white/65">{regionAttr.dominant}</span> --- primary signal from{" "}
                <span className="font-medium text-white/65">{regionAttr.primarySource}</span>.
                {regionAttr.L > regionAttr.R + 0.1 && " Left hippocampus contributed more."}
                {regionAttr.R > regionAttr.L + 0.1 && " Right hippocampus contributed more."}
                {Math.abs(regionAttr.L - regionAttr.R) <= 0.1 && regionAttr.L + regionAttr.R > 0.3 && " Both hippocampi contributed equally."}
              </p>
              <p className="mt-1 text-[11px] text-white/20">Estimated from feature importance weights.</p>
            </div>
          </div>
        ) : (
          /* Demo --- no attribution available; show a placeholder */
          <div className="glass rounded-[26px] p-4">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <MapPin className="h-4 w-4 text-white/50" />
              Regional Attribution
            </div>
            <p className="mt-2 text-xs text-white/35">Available after running a live scan with feature importances.</p>
          </div>
        )}
      </div>

      {/* -- Row 3: Radiomic Signal Interpretation -- */}
      <div className="glass rounded-[26px] p-4">
        <div className="mb-1 flex items-center gap-2 text-sm text-white/70">
          <FlaskConical className="h-4 w-4 text-white/50" />
          Radiomic Signal Interpretation
        </div>
        <p className="mb-4 text-xs text-white/35">
          What each texture signal means clinically. Highlighted signals appeared as top contributors in this case.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {GLCM_SIGNALS.map((sig) => {
            const active = activeSignalKeys.has(sig.key);
            return (
              <div key={sig.key} className={cn(
                "rounded-2xl border p-3 transition-all",
                active ? sig.activeBorder : "border-white/[0.07] bg-white/[0.03]"
              )}>
                <div className="mb-2 flex items-center justify-between">
                  <span className={cn("text-sm font-semibold", active ? "text-white/90" : "text-white/75")}>{sig.label}</span>
                  <span className={cn("text-sm font-bold", active ? sig.color : "text-white/40")}>{sig.icon}</span>
                </div>
                <p className={cn("mb-1 text-xs font-medium leading-5", active ? "text-white/75" : "text-white/60")}>
                  {sig.plain}
                </p>
                <p className={cn("text-xs leading-5", active ? "text-white/55" : "text-white/48")}>{sig.clinical}</p>
                {active && (
                  <div className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-1">
                    <p className="text-[10px] text-white/45">Active contributor</p>
                  </div>
                )}
                <p className={cn("mt-1.5 text-[11px]", active ? "text-white/40" : "text-white/35")}>{sig.direction}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* -- Row 4: Cascade Decision Pathway (2-column) -- */}
      <div className="glass rounded-[26px] p-4">
        <div className="mb-4 flex items-center gap-2 text-sm text-white/70">
          <GitBranch className="h-4 w-4 text-white/50" />
          Cascade Decision Pathway
        </div>
        {liveCase ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Left: Stage-by-stage pathway */}
            <CascadeFlow result={liveCase.result} />

            {/* Right: Decision logic summary */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/30">Why the cascade stopped here</p>
                <p className="text-sm leading-6 text-white/65">{cascadeText}</p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-white/30">Threshold logic</p>
                <div className="space-y-2">
                  {[
                    { label: "Stage 1 AD threshold",   value: "--- 65%",  met: stopped === "task1" },
                    { label: "Stage 3 MCI threshold",  value: "--- 51%",  met: stopped === "task3" || stopped === "task2" },
                    { label: "Stage 2 conversion",     value: "If MCI --- continue", met: stopped === "task2" },
                    { label: "Cascade stopped at",     value: stopped,  met: true },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-xs">
                      <span className={cn("text-white/40", row.met && "text-white/65")}>{row.label}</span>
                      <span className={cn("font-mono text-white/30", row.met && "text-white/70")}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/30">Routing summary</p>
                <p className="text-xs leading-5 text-white/50">
                  {stopped === "task1"
                    ? "Case was flagged as high-confidence AD at the first screening stage. No further cascade stages were required."
                    : stopped === "task3"
                    ? "Case passed the AD screening threshold and was routed to MCI vs Normal differentiation, where a final classification was made."
                    : "Case traversed all three cascade stages, with MCI probability at Stage 3 triggering the full conversion risk assessment."}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {explainCase.rationale.map((item, index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Reason {index + 1}</div>
                <p className="mt-2 text-sm leading-6 text-white/70">{item}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -- Row 5: L---R Asymmetry -- */}
      {liveCase && Object.keys(liveCase.result.glcm_summary ?? {}).length > 0 && (
        <AsymmetryPanel glcm={liveCase.result.glcm_summary!} />
      )}
    </div>
  );
}
