"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { VIEWER_DATA, type DatasetClass, type Plane } from "@/lib/cases";
import { CaseSwitcher } from "@/components/ui/case-switcher";
import { useAnalysisStore, type AnalysisCase } from "@/lib/analysis-store";
import {
  Brain,
  Layers3,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Activity,
  Cpu,
  ChevronRight,
  Scan,
  Crosshair,
  Microscope,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";

// Types and data imported from @/lib/cases
type CaseInfo = import("@/lib/cases").ViewerCase;

function buildLiveViewer(c: AnalysisCase): CaseInfo {
  const final    = c.result.final;
  const pred     = final.prediction;
  const conf     = final.confidence;
  const task1    = c.result.task1;
  const task3    = c.result.task3;
  const task2    = c.result.task2;

  const datasetClass: DatasetClass =
    pred.includes("Alzheimer") ? "AD" :
    pred.includes("MCI")       ? "MCI" : "NC";

  const decision =
    datasetClass === "AD"  ? "Alzheimer's Disease likely" :
    datasetClass === "MCI" ? (task2?.label === "converting_MCI" ? "Converting MCI — High Risk" : "Stable MCI") :
    "Cognitively Normal";

  const adProb   = task1?.probabilities?.AD  ?? 0;
  const mciProb  = task3?.probabilities?.MCI ?? 0;
  const ncProb   = task1?.probabilities?.NC  ?? 0;
  const convProb = task2?.probabilities?.converting_MCI ?? 0;

  const recommendation =
    datasetClass === "AD"
      ? "Refer to specialist. Consider PET imaging and CSF biomarker confirmation."
      : datasetClass === "MCI"
      ? "Schedule 6-month follow-up MRI. Monitor with standardised cognitive assessments."
      : "Routine monitoring as per standard clinical protocol.";

  const summary =
    `AD probability: ${(adProb*100).toFixed(1)}%, MCI probability: ${(mciProb*100).toFixed(1)}%. ` +
    `Cascade stopped at ${final.cascade_stopped_at}. Final classification: ${pred}.`;

  const notes =
    `Patient: ${c.patient.age}yo ${c.patient.sex === "M" ? "male" : "female"}, ` +
    `${c.patient.race || "race not recorded"}, ` +
    `${c.patient.education} years education, APOE ${c.patient.apoe ?? "unknown"}. ` +
    `${c.scans.length} longitudinal scan${c.scans.length > 1 ? "s" : ""} submitted.`;

  return {
    datasetClass,
    decision,
    confidence: conf,
    region: c.region,
    latency: "~3.2s",
    status: "Complete",
    summary,
    notes,
    recommendation,
    defaultPlane: "Axial",
    defaultSlice: 32,
    defaultOverlayOpacity: 0.7,
    // Only show tasks that actually ran — each bar is one cascade stage's output,
    // not a combined budget. "Normal Probability" is removed because it is simply
    // 1 − adProb from the same Task 1 classifier and adds no new information.
    features: [
      { name: "Task 1 — AD probability",    value: adProb,   color: "bg-red-400"    },
      ...(task3 ? [{ name: "Task 3 — MCI probability",  value: mciProb,  color: "bg-amber-400"  }] : []),
      ...(task2 ? [{ name: "Task 2 — Conversion risk",  value: convProb, color: "bg-purple-400" }] : []),
    ],
  };
}

function riskTheme(datasetClass: DatasetClass) {
  if (datasetClass === "AD") {
    return {
      badge: "border-red-400/20 bg-red-400/10 text-red-200",
      glow:
        "bg-[radial-gradient(circle_at_38%_48%,rgba(239,68,68,0.55),transparent_10%),radial-gradient(circle_at_62%_48%,rgba(249,115,22,0.42),transparent_13%),radial-gradient(circle_at_50%_58%,rgba(168,85,247,0.22),transparent_16%)]",
      bar: "from-red-400 via-orange-400 to-amber-300",
    };
  }
  if (datasetClass === "MCI") {
    return {
      badge: "border-amber-400/20 bg-amber-400/10 text-amber-200",
      glow:
        "bg-[radial-gradient(circle_at_40%_48%,rgba(249,115,22,0.38),transparent_11%),radial-gradient(circle_at_60%_48%,rgba(168,85,247,0.28),transparent_13%),radial-gradient(circle_at_50%_58%,rgba(59,130,246,0.14),transparent_17%)]",
      bar: "from-amber-400 via-orange-400 to-purple-400",
    };
  }
  return {
    badge: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200",
    glow:
      "bg-[radial-gradient(circle_at_42%_50%,rgba(34,211,238,0.24),transparent_12%),radial-gradient(circle_at_58%_50%,rgba(59,130,246,0.18),transparent_14%),radial-gradient(circle_at_50%_56%,rgba(168,85,247,0.10),transparent_16%)]",
    bar: "from-cyan-400 via-sky-400 to-emerald-400",
  };
}

function FakeHippocampusCanvas({
  side,
  plane,
  slice,
  datasetClass,
  showRegion,
  showHeatmap,
  showCrosshair,
  overlayOpacity,
}: {
  side: "Left" | "Right";
  plane: Plane;
  slice: number;
  datasetClass: DatasetClass;
  showRegion: boolean;
  showHeatmap: boolean;
  showCrosshair: boolean;
  overlayOpacity: number;
}) {
  const planeLabel =
    plane === "Axial" ? "AX" : plane === "Coronal" ? "CO" : "SA";

  const sideMirror = side === "Left" ? "" : "scale-x-[-1]";

  const transformClass =
    plane === "Axial"
      ? ""
      : plane === "Coronal"
      ? "scale-y-[0.97]"
      : "scale-x-[0.97]";

  const theme = riskTheme(datasetClass);

  const sliceBandTop =
    plane === "Axial"
      ? 12 + (slice % 20) * 2.3
      : plane === "Coronal"
      ? 16 + (slice % 18) * 2.5
      : 14 + (slice % 16) * 2.8;

  return (
    <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_0_40px_rgba(0,0,0,0.42)]">
      <div className={cn("absolute inset-0", transformClass, sideMirror)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.16),rgba(255,255,255,0.05)_24%,rgba(0,0,0,0.96)_62%)]" />
        <div className="absolute inset-0 opacity-[0.16] mix-blend-overlay bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:4px_4px]" />

        <div className="absolute inset-[10%] rounded-full border border-white/10 opacity-25" />
        <div className="absolute inset-[18%] rounded-full border border-white/10 opacity-18" />
        <div className="absolute inset-[28%] rounded-full border border-white/10 opacity-12" />

        <div className="absolute left-[21%] top-[24%] h-[48%] w-[25%] rounded-full bg-white/10 blur-[7px]" />
        <div className="absolute right-[21%] top-[24%] h-[48%] w-[25%] rounded-full bg-white/10 blur-[7px]" />
        <div className="absolute left-[35%] top-[42%] h-[15%] w-[10%] rounded-full bg-white/8 blur-[4px]" />
        <div className="absolute right-[35%] top-[42%] h-[15%] w-[10%] rounded-full bg-white/8 blur-[4px]" />
        <div className="absolute left-[45%] top-[38%] h-[24%] w-[10%] rounded-full bg-white/6 blur-[8px]" />

        <div
          className="absolute left-0 right-0 h-[10%] bg-white/6 blur-[12px]"
          style={{ top: `${sliceBandTop}%` }}
        />
      </div>

      {showRegion && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ opacity: overlayOpacity * 0.82 }}
        >
          <div className="absolute left-[34%] top-[43%] h-[16%] w-[12%] rounded-full border border-white/20 bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.08)]" />
          <div className="absolute right-[34%] top-[43%] h-[16%] w-[12%] rounded-full border border-white/20 bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.08)]" />
        </div>
      )}

      {showHeatmap && (
        <div
          className="pointer-events-none absolute inset-0 transition-all duration-300"
          style={{ opacity: overlayOpacity }}
        >
          <div className={cn("absolute inset-0 mix-blend-screen", theme.glow)} />
        </div>
      )}

      <div className="absolute left-4 top-4 rounded-xl border border-white/10 bg-black/45 px-3 py-1 text-[11px] text-white/70 backdrop-blur-md">
        {side} Hippocampus
      </div>

      <div className="absolute right-4 top-4 rounded-xl border border-white/10 bg-black/45 px-3 py-1 text-[11px] text-white/70 backdrop-blur-md">
        {planeLabel} • Slice {slice + 1}
      </div>

      {showCrosshair && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[14%] bottom-[14%] w-px -translate-x-1/2 bg-white/12" />
          <div className="absolute top-1/2 left-[14%] right-[14%] h-px -translate-y-1/2 bg-white/12" />
        </div>
      )}
    </div>
  );
}

export default function ViewerPage() {
  usePageTitle("MRI Viewer");
  const searchParams = useSearchParams();
  const router = useRouter();

  const caseId         = searchParams.get("case") || "AUD-0231";
  const fallbackRegion = searchParams.get("region") || "Bilateral Hippocampus";

  const [storeReady, setStoreReady] = useState(false);
  useEffect(() => { setStoreReady(true); }, []);

  const storeCase  = useAnalysisStore((s) => s.getCase(caseId));
  const latestCase = useAnalysisStore((s) => s.latestCase());

  const liveCase: AnalysisCase | undefined = !storeReady ? undefined
    : storeCase ?? ((!caseId || !VIEWER_DATA[caseId]) ? latestCase : undefined);

  const caseInfo: CaseInfo = liveCase
    ? buildLiveViewer(liveCase)
    : VIEWER_DATA[caseId] ?? { ...VIEWER_DATA["AUD-0231"], region: fallbackRegion };

  const displayCaseId = liveCase?.id ?? caseId;

  const [plane, setPlane] = useState<Plane>(caseInfo.defaultPlane);
  const [slice, setSlice] = useState(caseInfo.defaultSlice);
  const [showRegion, setShowRegion] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(
    caseInfo.defaultOverlayOpacity
  );
  const [barsMounted, setBarsMounted] = useState(false);

  useEffect(() => {
    setPlane(caseInfo.defaultPlane);
    setSlice(caseInfo.defaultSlice);
    setOverlayOpacity(caseInfo.defaultOverlayOpacity);
    setShowRegion(true);
    setShowHeatmap(true);
    setShowCrosshair(true);
    setBarsMounted(false);
    const t = setTimeout(() => setBarsMounted(true), 80);
    return () => clearTimeout(t);
  }, [
    caseId,
    caseInfo.defaultPlane,
    caseInfo.defaultSlice,
    caseInfo.defaultOverlayOpacity,
  ]);

  const theme = riskTheme(caseInfo.datasetClass);
  const features = useMemo(() => caseInfo.features, [caseInfo]);

  const onWheelSlices = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 1 : -1;
    setSlice((prev) => Math.max(0, Math.min(63, prev + direction)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              MRI Viewer
            </h1>
            <span
              className={cn(
                "rounded-2xl border px-3 py-1 text-xs font-medium",
                theme.badge
              )}
            >
              Dataset Class: {caseInfo.datasetClass}
            </span>
          </div>

          <p className="mt-1 text-sm text-white/60">
            Dual-hippocampus slice viewer with AI overlays, radiomic insight,
            and FPGA-linked inference context.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
            Case: <span className="text-white/90">{displayCaseId}</span> • Volume:{" "}
            <span className="text-white/90">2 × 64 × 64 × 64</span>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-2 text-xs text-emerald-200/80">
            Accelerated on <span className="text-emerald-100">PYNQ-Z2</span> •{" "}
            <span className="text-emerald-100">{caseInfo.latency}</span>
          </div>
        </div>
      </div>

      <CaseSwitcher currentCaseId={displayCaseId} />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="space-y-5">
          <div className="glass pulse-trigger rounded-[28px] p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {(["Axial", "Coronal", "Sagittal"] as Plane[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlane(p)}
                    className={cn(
                      "rounded-2xl border px-4 py-2 text-sm transition",
                      plane === p
                        ? "border-white/15 bg-white/10 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowRegion((v) => !v)}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  {showRegion ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  AI Region
                </button>

                <button
                  onClick={() => setShowHeatmap((v) => !v)}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  {showHeatmap ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  Heatmap
                </button>

                <button
                  onClick={() => setShowCrosshair((v) => !v)}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
                >
                  <Crosshair className="h-4 w-4" />
                  Crosshair
                </button>
              </div>
            </div>

            <div
              className="grid grid-cols-1 gap-4 lg:grid-cols-2"
              onWheel={onWheelSlices}
            >
              <FakeHippocampusCanvas
                side="Left"
                plane={plane}
                slice={slice}
                datasetClass={caseInfo.datasetClass}
                showRegion={showRegion}
                showHeatmap={showHeatmap}
                showCrosshair={showCrosshair}
                overlayOpacity={overlayOpacity}
              />

              <FakeHippocampusCanvas
                side="Right"
                plane={plane}
                slice={slice}
                datasetClass={caseInfo.datasetClass}
                showRegion={showRegion}
                showHeatmap={showHeatmap}
                showCrosshair={showCrosshair}
                overlayOpacity={overlayOpacity}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-white/70">
                  <Layers3 className="h-4 w-4 text-white/50" />
                  Slice position
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-8 text-xs text-white/50">1</span>
                  <input
                    type="range"
                    min={0}
                    max={63}
                    value={slice}
                    onChange={(e) => setSlice(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <span className="w-8 text-right text-xs text-white/50">
                    64
                  </span>
                </div>

                <div className="mt-2 text-xs text-white/50">
                  Current slice: <span className="text-white/80">{slice + 1}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm text-white/70">
                  <SlidersHorizontal className="h-4 w-4 text-white/50" />
                  Overlay intensity
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-8 text-xs text-white/50">0</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(overlayOpacity * 100)}
                    onChange={(e) =>
                      setOverlayOpacity(Number(e.target.value) / 100)
                    }
                    className="w-full accent-cyan-400"
                  />
                  <span className="w-8 text-right text-xs text-white/50">
                    100
                  </span>
                </div>

                <div className="mt-2 text-xs text-white/50">
                  Heatmap opacity:{" "}
                  <span className="text-white/80">
                    {Math.round(overlayOpacity * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass pulse-trigger rounded-[28px] p-5">
            <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
              <Microscope className="h-4 w-4 text-white/50" />
              Clinical Notes
            </div>

            <p className="text-sm leading-7 text-white/65">{caseInfo.notes}</p>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/explain?case=${encodeURIComponent(
                      displayCaseId
                    )}&region=${encodeURIComponent(caseInfo.region)}`
                  )
                }
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                <Brain className="h-4 w-4" />
                Explainable AI
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/reports?case=${encodeURIComponent(
                      displayCaseId
                    )}&region=${encodeURIComponent(caseInfo.region)}`
                  )
                }
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                <FileText className="h-4 w-4" />
                Reports
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass pulse-trigger rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Brain className="h-4 w-4 text-white/50" />
              Prediction Summary
            </div>

            <div className="mt-3 text-3xl font-bold tracking-tight text-white">
              {Math.round(caseInfo.confidence * 100)}%
            </div>
            <div className="mt-1 text-sm text-white/60">{caseInfo.decision}</div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
                  theme.bar
                )}
                style={{ width: barsMounted ? `${caseInfo.confidence * 100}%` : "0%" }}
              />
            </div>

            <p className="mt-4 text-sm leading-6 text-white/65">
              {caseInfo.summary}
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Recommended Action</div>
              <p className="mt-2 text-sm leading-6 text-white/70">
                {caseInfo.recommendation}
              </p>
            </div>
          </div>

          <div className="glass pulse-trigger rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Activity className="h-4 w-4 text-white/50" />
              Classification Probabilities
            </div>

            <div className="mt-4 space-y-4">
              {features.map((f) => (
                <div key={f.name}>
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
                </div>
              ))}
            </div>
          </div>

          <div className="glass pulse-trigger rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Scan className="h-4 w-4 text-white/50" />
              Scan Metadata
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Input format</div>
                <div className="mt-1 text-sm font-medium text-white">
                  NumPy Volume
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Shape</div>
                <div className="mt-1 text-sm font-medium text-white">
                  2 × 64 × 64 × 64
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Target ROI</div>
                <div className="mt-1 text-sm font-medium text-white">
                  Bilateral Hippocampi
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Latency</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {caseInfo.latency}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Status</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {caseInfo.status}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Pipeline</div>
                <div className="mt-1 text-sm font-medium text-white">
                  3D GLCM Radiomics
                </div>
              </div>
            </div>
          </div>

          <div className="glass pulse-trigger rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Cpu className="h-4 w-4 text-white/50" />
              Runtime Badge
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
              <div className="text-sm font-semibold text-white">
                Accelerated on PYNQ-Z2
              </div>
              <div className="mt-2 text-sm text-white/70">
                Volume-ready inference pipeline for bilateral hippocampal
                analysis with feature-driven interpretability.
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
                <span>
                  Latency: <span className="text-white/85">{caseInfo.latency}</span>
                </span>
                <span>•</span>
                <span>
                  Plane: <span className="text-white/85">{plane}</span>
                </span>
                <span>•</span>
                <span>
                  Slice: <span className="text-white/85">{slice + 1}</span>
                </span>
              </div>

              <button
                onClick={() =>
                  router.push(
                    `/explain?case=${encodeURIComponent(
                      displayCaseId
                    )}&region=${encodeURIComponent(caseInfo.region)}`
                  )
                }
                className="mt-4 flex items-center gap-2 text-sm text-cyan-300 transition hover:text-cyan-200"
              >
                Open Explainable AI Report
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}