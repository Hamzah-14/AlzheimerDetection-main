"use client";

import { useState } from "react";
import { Monitor, Bell, Shield, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/lib/use-page-title";

/* ── Primitives ─────────────────────────────────────────────────── */

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border transition-all duration-300",
        enabled
          ? "border-emerald-400/30 bg-emerald-400/20"
          : "border-white/15 bg-white/10"
      )}
      aria-pressed={enabled}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full transition-all duration-300",
          enabled ? "left-[calc(100%-18px)] bg-emerald-400" : "left-0.5 bg-white/40"
        )}
      />
    </button>
  );
}

function SettingRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="min-w-0">
        <div className="text-sm text-white/85">{label}</div>
        {sub && <div className="mt-0.5 text-xs text-white/45">{sub}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SettingSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/85 outline-none transition focus:border-white/20 [&>option]:bg-[#0d0d12]"
    >
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function SettingsPage() {
  usePageTitle("Settings");
  /* Display */
  const [neuralBg, setNeuralBg] = useState(true);
  const [motionEffects, setMotionEffects] = useState(true);

  /* Notifications */
  const [caseAlerts, setCaseAlerts] = useState(true);
  const [exportAlerts, setExportAlerts] = useState(true);
  const [reviewReminders, setReviewReminders] = useState(false);

  /* Access */
  const [sessionLogging, setSessionLogging] = useState(true);
  const [exportProtection, setExportProtection] = useState("Standard");

  /* System */
  const [inferenceTarget, setInferenceTarget] = useState("PYNQ-Z2");
  const [viewerMode, setViewerMode] = useState("Dual Hippocampus");
  const [explainOverlays, setExplainOverlays] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/60">
          Manage platform preferences, interface behaviour, and system options.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Display Preferences */}
        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Monitor className="h-4 w-4 text-white/50" />
            Display Preferences
          </div>

          <div className="mt-5 space-y-3">
            <SettingRow label="Theme" sub="Interface colour scheme">
              <SettingSelect
                value="Dark"
                onChange={() => {}}
                options={["Dark"]}
              />
            </SettingRow>

            <SettingRow
              label="Neural background"
              sub="Animated grid overlay on the canvas"
            >
              <Toggle enabled={neuralBg} onChange={setNeuralBg} />
            </SettingRow>

            <SettingRow
              label="Motion effects"
              sub="Transitions, hover glows, bar animations"
            >
              <Toggle enabled={motionEffects} onChange={setMotionEffects} />
            </SettingRow>
          </div>
        </div>

        {/* Notifications */}
        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Bell className="h-4 w-4 text-white/50" />
            Notifications
          </div>

          <div className="mt-5 space-y-3">
            <SettingRow
              label="Case alerts"
              sub="Notify when a new case completes inference"
            >
              <Toggle enabled={caseAlerts} onChange={setCaseAlerts} />
            </SettingRow>

            <SettingRow
              label="Report export alerts"
              sub="Notify on successful PDF or data export"
            >
              <Toggle enabled={exportAlerts} onChange={setExportAlerts} />
            </SettingRow>

            <SettingRow
              label="Review reminders"
              sub="Periodic reminders for pending cases"
            >
              <Toggle
                enabled={reviewReminders}
                onChange={setReviewReminders}
              />
            </SettingRow>
          </div>
        </div>

        {/* Access & Privacy */}
        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Shield className="h-4 w-4 text-white/50" />
            Access & Privacy
          </div>

          <div className="mt-5 space-y-3">
            <SettingRow label="Role" sub="Current permission level">
              <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                Research Demo
              </span>
            </SettingRow>

            <SettingRow
              label="Session logging"
              sub="Record activity for audit trail"
            >
              <Toggle enabled={sessionLogging} onChange={setSessionLogging} />
            </SettingRow>

            <SettingRow
              label="Export protection"
              sub="Controls applied to exported reports"
            >
              <SettingSelect
                value={exportProtection}
                onChange={setExportProtection}
                options={["Standard", "Strict", "None"]}
              />
            </SettingRow>
          </div>
        </div>

        {/* System Defaults */}
        <div className="glass pulse-trigger rounded-[28px] p-6">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Cpu className="h-4 w-4 text-white/50" />
            System Defaults
          </div>

          <div className="mt-5 space-y-3">
            <SettingRow
              label="Inference target"
              sub="Hardware used for the radiomics pipeline"
            >
              <SettingSelect
                value={inferenceTarget}
                onChange={setInferenceTarget}
                options={["PYNQ-Z2", "CPU (fallback)"]}
              />
            </SettingRow>

            <SettingRow
              label="Default viewer mode"
              sub="Which hippocampal crop loads first"
            >
              <SettingSelect
                value={viewerMode}
                onChange={setViewerMode}
                options={[
                  "Dual Hippocampus",
                  "Left only",
                  "Right only",
                ]}
              />
            </SettingRow>

            <SettingRow
              label="Explainability overlays"
              sub="Show saliency and feature heatmaps by default"
            >
              <Toggle
                enabled={explainOverlays}
                onChange={setExplainOverlays}
              />
            </SettingRow>
          </div>
        </div>
      </div>
    </div>
  );
}
