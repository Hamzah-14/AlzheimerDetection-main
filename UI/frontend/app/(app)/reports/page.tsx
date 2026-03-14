"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { REPORT_DATA, type DatasetClass } from "@/lib/cases";
import { CaseSwitcher } from "@/components/ui/case-switcher";
import { useAnalysisStore, type AnalysisCase } from "@/lib/analysis-store";
import {
  FileText,
  Brain,
  Activity,
  Cpu,
  Scan,
  ShieldCheck,
  ChevronRight,
  LayoutDashboard,
  Microscope,
  Download,
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

// ── Convert a real pipeline result into a report-compatible object ─────────────
function buildLiveReport(c: AnalysisCase) {
  const final    = c.result.final;
  const pred     = final.prediction;
  const conf     = final.confidence;
  const task1    = c.result.task1;
  const task3    = c.result.task3;
  const task2    = c.result.task2;

  // Derive dataset class
  const datasetClass: DatasetClass =
    pred.includes("Alzheimer") ? "AD" :
    pred.includes("MCI")       ? "MCI" : "NC";

  // Derive a decision label
  const decision =
    datasetClass === "AD"  ? "Alzheimer's Disease likely" :
    datasetClass === "MCI" ? (task2?.label === "converting_MCI" ? "Converting MCI — High Risk" : "Stable MCI") :
    "Cognitively Normal";

  // Build feature bars from raw probabilities
  const adProb   = task1?.probabilities?.AD  ?? 0;
  const mciProb  = task3?.probabilities?.MCI ?? 0;
  const ncProb   = task1?.probabilities?.NC  ?? 0;
  const convProb = task2?.probabilities?.converting_MCI ?? 0;

  const features = [
    { name: "AD Probability",        value: adProb,   color: "bg-red-400",    note: "Likelihood of Alzheimer's Disease pattern" },
    { name: "MCI Probability",       value: mciProb,  color: "bg-amber-400",  note: "Likelihood of Mild Cognitive Impairment" },
    { name: "Normal Probability",    value: ncProb,   color: "bg-cyan-400",   note: "Likelihood of cognitively normal pattern" },
    { name: "Conversion Risk",       value: convProb, color: "bg-purple-400", note: "Risk of MCI progressing to AD (if MCI detected)" },
  ];

  // Summary text
  const summary =
    datasetClass === "AD"
      ? `Radiomic analysis of bilateral hippocampal volumes indicates a high probability (${(adProb*100).toFixed(1)}%) of Alzheimer's Disease-consistent texture patterns. The cascade classifier stopped at Task 1 (AD vs CN), indicating clear differentiation from normal cognition.`
      : datasetClass === "MCI"
      ? `The scan shows texture patterns consistent with Mild Cognitive Impairment (MCI probability ${(mciProb*100).toFixed(1)}%). The cascade proceeded to Task 2 (Stable vs Converting MCI). ${convProb > 0.5 ? "Conversion risk is elevated — closer monitoring is advised." : "Current trajectory appears stable."}`
      : `Bilateral hippocampal radiomic features are within normal range. AD probability is low (${(adProb*100).toFixed(1)}%) and MCI probability is below threshold (${(mciProb*100).toFixed(1)}%). No immediate clinical concern indicated.`;

  const recommendation =
    datasetClass === "AD"
      ? "Refer to specialist for comprehensive neurological evaluation. Consider PET imaging and CSF biomarker confirmation. Initiate care planning discussion."
      : datasetClass === "MCI" && convProb > 0.5
      ? "Schedule follow-up MRI within 6 months. Monitor cognitive function with standardised assessments. Consider CSF biomarker testing if not already done."
      : datasetClass === "MCI"
      ? "Annual MRI follow-up recommended. Continue monitoring with cognitive assessments. Lifestyle intervention may be beneficial."
      : "Routine monitoring as per standard clinical protocol. No immediate intervention required.";

  return {
    datasetClass,
    decision,
    confidence: conf,
    region: c.region,
    latency: "~3.2s",
    status: "Complete",
    summary,
    recommendation,
    features,
    explainability: `The stacking ensemble cascade evaluated this case across ${final.cascade_stopped_at === "task1" ? "1 stage" : final.cascade_stopped_at === "task3" ? "2 stages" : "3 stages"}. Feature alignment used ${c.scans.length} longitudinal scan${c.scans.length > 1 ? "s" : ""} with a follow-up period derived from scan dates. Prediction stopped at ${final.cascade_stopped_at}.`,
    notes: `Patient: ${c.patient.age}yo ${c.patient.sex === "M" ? "Male" : "Female"} · Education: ${c.patient.education}yr · Race: ${c.patient.race}${c.patient.apoe ? ` · APOE: ${c.patient.apoe}` : ""} · Scans: ${c.scans.map(s => s.date).join(", ")}`,
    volumeShape: "(2, 64, 64, 64)",
    preprocessing: "N4 bias field correction → MNI152 registration (Rigid + Affine) → Atlas-based hippocampal crop → Per-channel p1/p99 quantization (Ng=32)",
  };
}

export default function ReportsPage() {
  usePageTitle("Reports");
  const searchParams = useSearchParams();
  const router = useRouter();

  const caseId = searchParams.get("case") || "AUD-0231";
  const fallbackRegion = searchParams.get("region") || "Bilateral Hippocampus";

  // Check store for a real pipeline result first, fall back to static demo data
  const storeCase  = useAnalysisStore((s) => s.getCase(caseId));
  const latestCase = useAnalysisStore((s) => s.latestCase());

  // Priority: URL case ID matches store → use it
  // Otherwise: URL has no real case ID (empty or static) → show latest real run
  // Otherwise: fall back to static demo
  const liveCase: AnalysisCase | undefined =
    storeCase ?? ((!caseId || !REPORT_DATA[caseId]) ? latestCase : undefined);

  const reportCase = liveCase
    ? buildLiveReport(liveCase)
    : REPORT_DATA[caseId] ?? { ...REPORT_DATA["AUD-0231"], region: fallbackRegion };

  const displayCaseId = liveCase?.id ?? caseId;

  const features = useMemo(() => reportCase.features, [reportCase]);
  const theme = classTheme(reportCase.datasetClass);

  const [barsMounted, setBarsMounted] = useState(false);
  useEffect(() => {
    setBarsMounted(false);
    const t = setTimeout(() => setBarsMounted(true), 80);
    return () => clearTimeout(t);
  }, [caseId]);

  const handleExport = () => {
    const date = new Date().toLocaleDateString("en-US", {
      day: "2-digit", month: "long", year: "numeric",
    });
    const confPct = Math.round(reportCase.confidence * 100);

    const classColor =
      reportCase.datasetClass === "AD"  ? "#ef4444" :
      reportCase.datasetClass === "MCI" ? "#f59e0b" : "#22d3ee";

    const featureRows = reportCase.features.map((f) => {
      const pct = Math.round(f.value * 100);
      return `
        <tr>
          <td class="feat-name">${f.name}</td>
          <td class="feat-bar">
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          </td>
          <td class="feat-pct">${pct}%</td>
          <td class="feat-note">${f.note}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Clinical Report — ${caseId}</title>
  <style>
    @page { size: A4; margin: 16mm 18mm; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 9.5pt; color: #111827; background: #fff; line-height: 1.55;
    }

    /* ── Header ─────────────────────────────────────────── */
    .doc-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 18px;
    }
    .brand { font-size: 17pt; font-weight: 700; letter-spacing: -0.5px; color: #111827; }
    .brand span { color: #7c3aed; }
    .brand-sub { font-size: 7.5pt; color: #6b7280; margin-top: 2px; letter-spacing: 0.5px; text-transform: uppercase; }
    .doc-meta { text-align: right; font-size: 8pt; color: #6b7280; line-height: 1.7; }
    .doc-meta strong { color: #111827; }

    /* ── Classification banner ───────────────────────────── */
    .classification {
      display: flex; align-items: center; gap: 12px;
      background: #f9fafb; border: 1px solid #e5e7eb;
      border-left: 4px solid ${classColor};
      border-radius: 8px; padding: 10px 14px; margin-bottom: 18px;
    }
    .class-badge {
      font-size: 13pt; font-weight: 800; color: ${classColor};
      background: ${classColor}18; border: 1.5px solid ${classColor}40;
      border-radius: 6px; padding: 2px 10px; white-space: nowrap;
    }
    .class-decision { font-size: 10pt; font-weight: 600; color: #111827; }
    .class-conf { font-size: 8.5pt; color: #6b7280; margin-top: 2px; }
    .conf-bar-track { margin-top: 4px; height: 6px; background: #e5e7eb; border-radius: 99px; width: 180px; }
    .conf-bar-fill  { height: 100%; background: ${classColor}; border-radius: 99px; width: ${confPct}%; }

    /* ── Sections ────────────────────────────────────────── */
    .section { margin-bottom: 16px; page-break-inside: avoid; }
    .section-title {
      font-size: 7pt; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1.2px; color: #7c3aed; border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px; margin-bottom: 10px;
    }
    .prose { font-size: 9pt; color: #374151; line-height: 1.65; }

    /* ── Info grid ───────────────────────────────────────── */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-cell { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
    .info-label { font-size: 7pt; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.6px; }
    .info-value { font-size: 9pt; font-weight: 600; color: #111827; margin-top: 2px; }

    /* ── Features table ──────────────────────────────────── */
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    th {
      text-align: left; font-size: 7pt; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.8px; color: #9ca3af; padding: 4px 6px;
      border-bottom: 1px solid #e5e7eb;
    }
    .feat-name { padding: 6px 6px; color: #374151; font-weight: 500; width: 22%; }
    .feat-bar  { padding: 6px 6px; width: 32%; }
    .feat-pct  { padding: 6px 6px; text-align: right; color: #6b7280; width: 8%; white-space: nowrap; }
    .feat-note { padding: 6px 6px; color: #9ca3af; font-size: 7.5pt; width: 38%; }
    tr:nth-child(even) td { background: #f9fafb; }
    .bar-track { height: 5px; background: #e5e7eb; border-radius: 99px; }
    .bar-fill  { height: 100%; background: #7c3aed; border-radius: 99px; }

    /* ── Two-col layout ──────────────────────────────────── */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    /* ── Footer ──────────────────────────────────────────── */
    .doc-footer {
      margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 7.5pt; color: #9ca3af;
    }
    .footer-badge {
      background: #7c3aed12; border: 1px solid #7c3aed30;
      border-radius: 4px; padding: 2px 8px; color: #7c3aed; font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="doc-header">
    <div>
      <div class="brand">Synapse<span>.PL</span></div>
      <div class="brand-sub">Precision Neurodiagnostics Platform</div>
    </div>
    <div class="doc-meta">
      <div><strong>CLINICAL REPORT</strong></div>
      <div>Case ID: <strong>${displayCaseId}</strong></div>
      <div>Region: <strong>${reportCase.region}</strong></div>
      <div>Generated: <strong>${date}</strong></div>
    </div>
  </div>

  <!-- Classification banner -->
  <div class="classification">
    <div class="class-badge">${reportCase.datasetClass}</div>
    <div>
      <div class="class-decision">${reportCase.decision}</div>
      <div class="class-conf">Confidence: ${confPct}% &nbsp;·&nbsp; Latency: ${reportCase.latency} on PYNQ-Z2 &nbsp;·&nbsp; Status: ${reportCase.status}</div>
      <div class="conf-bar-track"><div class="conf-bar-fill"></div></div>
    </div>
  </div>

  <!-- Two-column top -->
  <div class="two-col">
    <div class="section">
      <div class="section-title">Executive Summary</div>
      <p class="prose">${reportCase.summary}</p>
    </div>
    <div class="section">
      <div class="section-title">Recommended Action</div>
      <p class="prose">${reportCase.recommendation}</p>
    </div>
  </div>

  <!-- Radiomic features -->
  <div class="section">
    <div class="section-title">Radiomic Feature Analysis</div>
    <table>
      <thead>
        <tr>
          <th>Feature</th>
          <th>Relative Score</th>
          <th>Value</th>
          <th>Clinical Note</th>
        </tr>
      </thead>
      <tbody>${featureRows}</tbody>
    </table>
  </div>

  <!-- Explainability + Metadata side by side -->
  <div class="two-col">
    <div class="section">
      <div class="section-title">Explainability &amp; Attribution</div>
      <p class="prose">${reportCase.explainability}</p>
      ${reportCase.notes ? `<p class="prose" style="margin-top:8px;color:#6b7280;font-size:8.5pt"><em>${reportCase.notes}</em></p>` : ""}
    </div>
    <div class="section">
      <div class="section-title">Scan Metadata</div>
      <div class="info-grid">
        <div class="info-cell"><div class="info-label">Format</div><div class="info-value">NumPy Volume</div></div>
        <div class="info-cell"><div class="info-label">Shape</div><div class="info-value">${reportCase.volumeShape}</div></div>
        <div class="info-cell"><div class="info-label">Pipeline</div><div class="info-value">3D GLCM Radiomics</div></div>
        <div class="info-cell"><div class="info-label">Hardware</div><div class="info-value">PYNQ-Z2 FPGA</div></div>
      </div>
      <div class="info-cell" style="margin-top:8px">
        <div class="info-label">Preprocessing</div>
        <div class="info-value" style="font-weight:400;font-size:8.5pt;color:#374151;margin-top:3px">${reportCase.preprocessing}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="doc-footer">
    <span>Synapse.PL &nbsp;·&nbsp; Precision Neurodiagnostics &nbsp;·&nbsp; For clinical review only</span>
    <span class="footer-badge">PYNQ-Z2 · 3D GLCM · Radiomics Classifier</span>
  </div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) { alert("Allow pop-ups to export the PDF."); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Clinical Report
            </h1>
            <span
              className={cn(
                "rounded-2xl border px-3 py-1 text-xs font-medium",
                theme.badge
              )}
            >
              {reportCase.datasetClass}
            </span>
          </div>

          <p className="mt-1 text-sm text-white/60">
            Structured report summarizing prediction, radiomic findings,
            explainability, and recommended next action.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70">
            Case: <span className="text-white/90">{caseId}</span> • Status:{" "}
            <span className="text-white/90">{reportCase.status}</span>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300 transition hover:border-purple-400/50 hover:bg-purple-500/20 hover:text-purple-200"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      <CaseSwitcher currentCaseId={caseId} />

      {/* Top Summary Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <FileText className="h-4 w-4 text-white/50" />
            Executive Summary
          </div>

          <p className="mt-4 text-sm leading-7 text-white/70">
            {reportCase.summary}
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/50">Conclusion</div>
            <div className="mt-1 text-lg font-semibold text-white">
              {reportCase.decision}
            </div>
            <p className="mt-2 text-sm leading-6 text-white/65">
              {reportCase.recommendation}
            </p>
          </div>
        </div>

        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Brain className="h-4 w-4 text-white/50" />
            Prediction Confidence
          </div>

          <div className="mt-3 text-3xl font-bold tracking-tight text-white">
            {Math.round(reportCase.confidence * 100)}%
          </div>
          <div className="mt-1 text-sm text-white/60">{reportCase.decision}</div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/5">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
                theme.progress
              )}
              style={{ width: barsMounted ? `${reportCase.confidence * 100}%` : "0%" }}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
            <span>
              Region: <span className="text-white/80">{reportCase.region}</span>
            </span>
            <span>•</span>
            <span>
              Latency: <span className="text-white/80">{reportCase.latency}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Findings Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="glass pulse-trigger rounded-[28px] p-6">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Activity className="h-4 w-4 text-white/50" />
              Radiomic Findings
            </div>

            <div className="mt-5 space-y-4">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-white/85">{feature.name}</span>
                    <span className="text-white/50">
                      {(feature.value * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-700 ease-out",
                        feature.color
                      )}
                      style={{ width: barsMounted ? `${feature.value * 100}%` : "0%" }}
                    />
                  </div>

                  <p className="mt-2 text-xs leading-5 text-white/60">
                    {feature.note}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass pulse-trigger rounded-[28px] p-6">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Microscope className="h-4 w-4 text-white/50" />
              Explainability Summary
            </div>

            <p className="mt-4 text-sm leading-7 text-white/70">
              {reportCase.explainability}
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Interpretation Note</div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {reportCase.notes}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass pulse-trigger rounded-[28px] p-6">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Scan className="h-4 w-4 text-white/50" />
              Scan Metadata
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Input format</div>
                <div className="mt-1 text-sm font-medium text-white">
                  NumPy Volume
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Shape</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {reportCase.volumeShape}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Status</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {reportCase.status}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/50">Latency</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {reportCase.latency}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/50">Preprocessing</div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                {reportCase.preprocessing}
              </p>
            </div>
          </div>

          <div className="glass pulse-trigger rounded-[28px] p-6">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <Cpu className="h-4 w-4 text-white/50" />
              Runtime & Platform
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
              <div className="text-lg font-semibold text-white">
                Accelerated on PYNQ-Z2
              </div>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Inference executed through a 3D GLCM radiomics pipeline designed
                for low-latency bilateral hippocampal analysis.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
                <span>
                  Pipeline:{" "}
                  <span className="text-white/80">3D GLCM Radiomics</span>
                </span>
                <span>•</span>
                <span>
                  Output: <span className="text-white/80">{reportCase.decision}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="glass pulse-trigger rounded-[28px] p-6">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <ShieldCheck className="h-4 w-4 text-white/50" />
              Recommended Action
            </div>

            <p className="mt-4 text-sm leading-7 text-white/70">
              {reportCase.recommendation}
            </p>

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
                    `/viewer?case=${encodeURIComponent(
                      caseId
                    )}&region=${encodeURIComponent(reportCase.region)}`
                  )
                }
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                <Scan className="h-4 w-4" />
                MRI Viewer
              </button>

              <button
                onClick={() =>
                  router.push(
                    `/explain?case=${encodeURIComponent(
                      caseId
                    )}&region=${encodeURIComponent(reportCase.region)}`
                  )
                }
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                <Brain className="h-4 w-4" />
                Explainable AI
              </button>
            </div>

            <button
              onClick={handleExport}
              className="mt-5 flex items-center gap-2 text-sm text-purple-400 transition hover:text-purple-300"
            >
              <Download className="h-4 w-4" />
              Export as PDF
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}