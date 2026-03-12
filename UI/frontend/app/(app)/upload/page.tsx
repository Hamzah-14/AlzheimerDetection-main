"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Scan,
  Cpu,
  Zap,
  Brain,
  FileText,
  Upload,
  CheckCircle2,
  CircleDashed,
  ChevronRight,
} from "lucide-react";
import { usePageTitle } from "@/lib/use-page-title";

type PipelineStage = {
  label: string;
  sub: string;
  icon: React.ElementType;
  duration: number;
  fpga?: boolean;
};

const STAGES: PipelineStage[] = [
  {
    label: "Upload",
    sub: "MRI volume received and registered",
    icon: Scan,
    duration: 700,
  },
  {
    label: "Preprocess",
    sub: "NumPy conversion · bilateral hippocampal crop",
    icon: Cpu,
    duration: 1400,
  },
  {
    label: "Radiomics",
    sub: "3D GLCM feature extraction on PYNQ-Z2",
    icon: Zap,
    duration: 2100,
    fpga: true,
  },
  {
    label: "Classify",
    sub: "SVM / RF classifier inference",
    icon: Brain,
    duration: 900,
  },
  {
    label: "Report Ready",
    sub: "Clinical summary generated",
    icon: FileText,
    duration: 500,
  },
];

type PipelineState = "idle" | "running" | "done";

export default function UploadPage() {
  usePageTitle("Upload Case");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [caseId, setCaseId] = useState("AUD-0232");
  const [region, setRegion] = useState("Bilateral Hippocampus");
  const [notes, setNotes] = useState("");

  const [pipelineState, setPipelineState] = useState<PipelineState>("idle");
  const [activeStage, setActiveStage] = useState(-1);
  const [completedStages, setCompletedStages] = useState<number[]>([]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const runPipeline = () => {
    if (pipelineState === "running") return;
    setPipelineState("running");
    setActiveStage(0);
    setCompletedStages([]);

    let elapsed = 0;
    STAGES.forEach((stage, i) => {
      setTimeout(() => setActiveStage(i), elapsed);
      elapsed += stage.duration;
      setTimeout(() => {
        setCompletedStages((prev) => [...prev, i]);
        if (i === STAGES.length - 1) {
          setPipelineState("done");
          setActiveStage(-1);
        }
      }, elapsed);
    });
  };

  const stageStatus = (i: number) => {
    if (completedStages.includes(i)) return "complete";
    if (activeStage === i) return "active";
    return "pending";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Upload MRI Scan
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Submit a bilateral hippocampal volume for preprocessing,
          FPGA-accelerated radiomics, and classification.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* ── Left: form ─────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "glass pulse-trigger cursor-pointer rounded-[28px] border-2 border-dashed p-10 text-center transition-all duration-200",
              dragOver
                ? "border-purple-400/60 bg-purple-400/10"
                : file
                ? "border-emerald-400/40 bg-emerald-400/[0.05]"
                : "border-white/15 hover:border-white/25 hover:bg-white/[0.07]"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".bin,.npy,.nii,.gz"
              className="hidden"
              onChange={handleFileSelect}
            />

            {file ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {file.name}
                  </div>
                  <div className="mt-0.5 text-xs text-white/50">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · Click to
                    replace
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Upload
                    className={cn(
                      "h-6 w-6 transition",
                      dragOver ? "text-purple-300" : "text-white/50"
                    )}
                  />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {dragOver
                      ? "Drop to upload"
                      : "Drag & drop or click to browse"}
                  </div>
                  <div className="mt-0.5 text-xs text-white/50">
                    Accepts .bin · .npy · .nii · .nii.gz
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Metadata fields */}
          <div className="glass pulse-trigger space-y-4 rounded-[28px] p-6">
            <div className="text-sm text-white/70">Case Metadata</div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-white/50">
                  Case ID
                </label>
                <input
                  type="text"
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/25 focus:bg-white/[0.08]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-white/50">
                  Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/25 focus:bg-white/[0.08] [&>option]:bg-[#0d0d12]"
                >
                  <option>Bilateral Hippocampus</option>
                  <option>Left Hippocampus</option>
                  <option>Right Hippocampus</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-white/50">
                Notes (optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any relevant clinical context..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-white/25 focus:bg-white/[0.08]"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={runPipeline}
            disabled={pipelineState === "running"}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",
              pipelineState === "running"
                ? "cursor-not-allowed border-white/10 bg-white/5 text-white/40"
                : "border-white/10 bg-white/10 text-white hover:bg-white/15"
            )}
          >
            {pipelineState === "running" ? (
              <>
                <CircleDashed className="h-4 w-4 animate-spin" />
                Running pipeline…
              </>
            ) : pipelineState === "done" ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Pipeline complete — run again
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Run Analysis Pipeline
              </>
            )}
          </button>
        </div>

        {/* ── Right: pipeline visualization ──────────────────────── */}
        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="text-sm text-white/70">Analysis Pipeline</div>

            {pipelineState === "done" && (
              <button
                onClick={() =>
                  router.push(
                    `/reports?case=${encodeURIComponent(caseId)}&region=${encodeURIComponent(region)}`
                  )
                }
                className="flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-400/15"
              >
                View Report
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-1">
            {STAGES.map((stage, i) => {
              const status = stageStatus(i);
              const Icon = stage.icon;
              const isLast = i === STAGES.length - 1;

              return (
                <div key={stage.label}>
                  {/* Stage card */}
                  <div
                    className={cn(
                      "relative rounded-[20px] border p-4 transition-all duration-500",
                      status === "complete"
                        ? "border-emerald-400/20 bg-emerald-400/[0.06]"
                        : status === "active"
                        ? stage.fpga
                          ? "border-purple-400/30 bg-purple-400/[0.08]"
                          : "border-cyan-400/20 bg-cyan-400/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500",
                          status === "complete"
                            ? "border-emerald-400/25 bg-emerald-400/15"
                            : status === "active"
                            ? stage.fpga
                              ? "border-purple-400/30 bg-purple-400/15"
                              : "border-cyan-400/25 bg-cyan-400/15"
                            : "border-white/10 bg-white/5"
                        )}
                      >
                        {status === "complete" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Icon
                            className={cn(
                              "h-4 w-4 transition-all duration-500",
                              status === "active"
                                ? stage.fpga
                                  ? "text-purple-300"
                                  : "text-cyan-300"
                                : "text-white/30"
                            )}
                          />
                        )}
                      </div>

                      {/* Labels */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-medium transition-all duration-500",
                              status === "complete"
                                ? "text-emerald-200"
                                : status === "active"
                                ? "text-white"
                                : "text-white/35"
                            )}
                          >
                            {stage.label}
                          </span>
                          {stage.fpga && (
                            <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-1.5 py-0.5 text-[10px] text-purple-300">
                              FPGA
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 text-xs transition-all duration-500",
                            status === "active"
                              ? "text-white/60"
                              : "text-white/25"
                          )}
                        >
                          {stage.sub}
                        </div>
                      </div>

                      {/* Status dot */}
                      <div className="shrink-0">
                        {status === "complete" && (
                          <span className="text-xs text-emerald-400/70">
                            Done
                          </span>
                        )}
                        {status === "active" && (
                          <span
                            className={cn(
                              "block h-2 w-2 animate-pulse rounded-full",
                              stage.fpga ? "bg-purple-400" : "bg-cyan-400"
                            )}
                          />
                        )}
                      </div>
                    </div>

                    {/* Progress bar — animates for the active stage duration */}
                    {status === "active" && (
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className={cn(
                            "h-full rounded-full bg-gradient-to-r",
                            stage.fpga
                              ? "from-purple-400 to-violet-400"
                              : "from-cyan-400 to-sky-400"
                          )}
                          style={{
                            animation: `fill-bar ${stage.duration}ms linear forwards`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className={cn(
                        "mx-[22px] my-1 h-3 w-px transition-colors duration-700",
                        completedStages.includes(i)
                          ? "bg-emerald-400/30"
                          : "bg-white/8"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {pipelineState === "idle" && (
            <p className="mt-5 text-center text-xs text-white/30">
              Submit a scan above to begin the analysis pipeline.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
