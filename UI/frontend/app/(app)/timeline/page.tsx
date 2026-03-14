"use client";
import { useAnalysisStore, type AnalysisCase } from "@/lib/analysis-store";
import { useMemo } from "react";
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
} from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";

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

  const scanDates = c.scans.map(s => s.date).join(" → ");

  const events = [
    { title: "Scans Uploaded",       time: c.scans[0]?.date ?? "—", icon: "upload"     as const, status: "Complete" as const, description: `${c.scans.length} NIfTI scan${c.scans.length > 1 ? "s" : ""} received. Dates: ${scanDates}.` },
    { title: "Preprocessing",        time: "N4 + MNI",               icon: "preprocess" as const, status: "Complete" as const, description: "N4 bias field correction applied. Registered to MNI152 1mm standard space. Bilateral hippocampal crops extracted (64³ voxels each side)." },
    { title: "GLCM Radiomics",       time: "CPU (FPGA pending)",      icon: "radiomics"  as const, status: "Complete" as const, description: "3D GLCM features extracted across 13 directions, distances 1–4, Ng=32. 252 features total including L/R asymmetry." },
    { title: "Cascade Classification", time: `Stopped at ${final.cascade_stopped_at}`, icon: "classify" as const, status: "Complete" as const, description: `AD probability: ${((c.result.task1?.probabilities?.AD ?? 0) * 100).toFixed(1)}%. MCI probability: ${((c.result.task3?.probabilities?.MCI ?? 0) * 100).toFixed(1)}%. Final: ${pred}.` },
    { title: "Report Generated",     time: new Date(c.timestamp).toLocaleDateString(), icon: "report" as const, status: "Complete" as const, description: `Classification complete. Confidence: ${(conf * 100).toFixed(1)}%. Case ID: ${c.id}.` },
  ];

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
  const storeCase  = useAnalysisStore((s) => s.getCase(caseId));
  const latestCase = useAnalysisStore((s) => s.latestCase());

  const liveCase: AnalysisCase | undefined =
    storeCase ?? ((!caseId || !TIMELINE_DATA[caseId]) ? latestCase : undefined);

  const caseInfo = liveCase
    ? buildLiveTimeline(liveCase)
    : TIMELINE_DATA[caseId] ?? { ...TIMELINE_DATA["AUD-0231"], region: fallbackRegion };

  const displayCaseId = liveCase?.id ?? caseId;

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
      "══════════════════════════════════════════════════",
      "  ALZ PLATFORM · CASE TIMELINE",
      `  Case ${caseId}  ·  Generated ${date}`,
      "══════════════════════════════════════════════════",
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
      "══════════════════════════════════════════════════",
      "  Pipeline: 3D GLCM Radiomics  ·  Hardware: PYNQ-Z2",
      "══════════════════════════════════════════════════",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline-${displayCaseId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            Case: <span className="text-white/90">{displayCaseId}</span> • Status:{" "}
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
            Prediction
          </div>
          <div className="mt-3 text-2xl font-semibold text-white">
            {caseInfo.decision}
          </div>
          <div className="mt-2 text-sm text-white/60">
            Confidence: {Math.round(caseInfo.confidence * 100)}%
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
            <div
              className={cn("h-full rounded-full bg-gradient-to-r", theme.progress)}
              style={{ width: `${caseInfo.confidence * 100}%` }}
            />
          </div>
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

                    <p className="mt-3 text-sm leading-6 text-white/65">
                      {event.description}
                    </p>
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
              Current State
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Case status</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {caseInfo.status}
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {caseInfo.status === "Reviewed"
                  ? "This case has already been reviewed and linked to the final recommendation."
                  : caseInfo.status === "Pending"
                  ? "This case completed automated processing and is waiting for final confirmation."
                  : "This case completed processing within the routine workflow."}
              </p>
            </div>
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
    </div>
  );
}