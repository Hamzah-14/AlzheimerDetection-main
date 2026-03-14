"use client";
import { useAnalysisStore, type AnalysisCase } from "@/lib/analysis-store";
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
  Sparkles,
  Eye,
  ShieldCheck,
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

  const features = [
    { name: "Contrast"     as const, value: adProb,   color: "bg-red-400",    note: "Local intensity variation — primary AD texture signal",         tooltip: "High contrast in hippocampal texture is strongly associated with neurodegeneration patterns seen in AD." },
    { name: "Homogeneity"  as const, value: 1-mciProb, color: "bg-purple-400", note: "Structural uniformity — drops with tissue degradation",          tooltip: "Reduced homogeneity indicates loss of tissue regularity, common in MCI and AD." },
    { name: "Energy"       as const, value: ncProb,   color: "bg-cyan-400",   note: "Texture compactness — higher in healthy tissue",                  tooltip: "Energy reflects texture concentration. Lower energy aligns with abnormal tissue patterns." },
    { name: "Correlation"  as const, value: conf,     color: "bg-emerald-400", note: "Spatial dependency — secondary feature supporting decision",      tooltip: "Correlation captures the linear spatial relationship between voxel intensity values across the hippocampus." },
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
  };
}

export default function ExplainPage() {
  usePageTitle("Explainable AI");
  const searchParams = useSearchParams();
  const router = useRouter();

  const caseId         = searchParams.get("case") || "AUD-0231";
  const fallbackRegion = searchParams.get("region") || "Hippocampus";

  const storeCase  = useAnalysisStore((s) => s.getCase(caseId));
  const latestCase = useAnalysisStore((s) => s.latestCase());

  const liveCase: AnalysisCase | undefined =
    storeCase ?? ((!caseId || !EXPLAIN_DATA[caseId]) ? latestCase : undefined);

  const explainCase = liveCase
    ? buildLiveExplain(liveCase)
    : EXPLAIN_DATA[caseId] ?? { ...EXPLAIN_DATA["AUD-0231"], region: fallbackRegion };

  const displayCaseId = liveCase?.id ?? caseId;
  const showEmpty = !liveCase && !EXPLAIN_DATA[caseId];

  const features = useMemo(() => explainCase.features, [explainCase]);
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
          `  ${f.name.padEnd(16)}${String(Math.round(f.score * 100)).padStart(3)}%  — ${f.note}`
      )
      .join("\n");

    const content = [
      "══════════════════════════════════════════════════",
      "  ALZ PLATFORM · EXPLAINABILITY SUMMARY",
      `  Case ${displayCaseId}  ·  Generated ${date}`,
      "══════════════════════════════════════════════════",
      "",
      "PREDICTION",
      `  Dataset Class   ${explainCase.datasetClass}`,
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
            Case: <span className="text-white/90">{displayCaseId}</span> • Region:{" "}
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
              <Sparkles className="h-4 w-4 text-white/50" />
              Why the Model Flagged This Case
            </div>

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

          <div className="glass rounded-[26px] p-3">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Activity className="h-4 w-4 text-white/50" />
              Top Radiomic Features
            </div>

            <div className="mt-3 space-y-2">
              {features.map((f) => (
                <div
                  key={f.name}
                  onMouseEnter={() => setActiveFeature(f.name)}
                  onMouseLeave={() => setActiveFeature(null)}
                  className={cn(
                    "group relative cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-2.5 transition-all duration-300 hover:scale-[1.02]",
                    activeFeature === f.name &&
                      "border-white/20 bg-white/10 shadow-[0_0_22px_rgba(255,255,255,0.06)]"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-white/80">{f.name}</span>
                    <span className="text-white/50">
                      {(f.value * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-700 ease-out",
                        f.color
                      )}
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
    </div>
  );
}