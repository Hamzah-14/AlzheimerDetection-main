// lib/analysis-store.ts
// Global store for completed pipeline results.
// Any page can read from this — dashboard, reports, timeline.

import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CascadeStage = "task1" | "task2" | "task3";
export type Prediction   = "Alzheimer's Disease likely" | "Cognitively Normal" | "MCI detected";

export interface TaskResult {
  label: string;
  probabilities: Record<string, number>;
}

export interface FinalResult {
  prediction: string;
  confidence: number;
  cascade_stopped_at: CascadeStage;
  conversion_risk?: number;
  mci_status?: string;
}

export interface CascadeResult {
  task1?: TaskResult;
  task2?: TaskResult;
  task3?: TaskResult;
  final: FinalResult;
}

export interface AnalysisCase {
  id: string;                   // e.g. "AUD-0233"
  job_id: string;               // UUID from backend
  timestamp: string;            // ISO string
  patient: {
    age: number;
    sex: "M" | "F";
    education: number;
    race: string;
    apoe?: string;
  };
  scans: {
    filename: string;
    date: string;               // YYYY-MM-DD
  }[];
  result: CascadeResult;
  // Derived for dashboard display
  risk: "High" | "Medium" | "Low";
  confidence: string;           // e.g. "75.6%"
  region: string;
}

interface AnalysisStore {
  cases: AnalysisCase[];
  addCase: (c: AnalysisCase) => void;
  clearCases: () => void;
  getCase: (id: string) => AnalysisCase | undefined;
  latestCase: () => AnalysisCase | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _caseCounter = 233; // starts at AUD-0233 so it doesn't clash with static demo data

export function generateCaseId(): string {
  return `AUD-0${_caseCounter++}`;
}

export function deriveRisk(result: CascadeResult): "High" | "Medium" | "Low" {
  const pred = result.final.prediction;
  if (pred.includes("Alzheimer")) return "High";
  if (pred.includes("MCI"))       return "Medium";
  return "Low";
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  cases: [],

  addCase: (c) =>
    set((state) => ({ cases: [c, ...state.cases] })),   // newest first

  clearCases: () => set({ cases: [] }),

  getCase: (id) => get().cases.find((c) => c.id === id),

  latestCase: () => get().cases[0],
}));