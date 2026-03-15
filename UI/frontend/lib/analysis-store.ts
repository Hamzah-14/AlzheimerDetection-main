// lib/analysis-store.ts
// Global store for completed pipeline results.
// Any page can read from this — dashboard, reports, timeline.

import { create } from "zustand";
import { persist } from "zustand/middleware";

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

export interface FeatureImportanceEntry {
  rank:       number;
  feature:    string;
  label:      string;
  importance: number;
}

export interface CascadeResult {
  task1?: TaskResult;
  task2?: TaskResult;
  task3?: TaskResult;
  final: FinalResult;
  /** Mean GLCM values per side+feature, keyed as "L_contrast", "R_homogeneity", etc. */
  glcm_summary?: Record<string, number>;
  /** Consensus feature importances for each cascade task that ran, top 15 each. */
  feature_importances?: Record<string, FeatureImportanceEntry[]>;
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

export function generateCaseId(): string {
  // Base the number on the highest ID already in the store so page
  // reloads never produce a duplicate (module-level counters reset to 233).
  const existing = useAnalysisStore.getState().cases;
  const max = existing.reduce((m, c) => {
    const n = parseInt(c.id.replace(/\D/g, ""), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 232);
  return `AUD-0${max + 1}`;
}

export function deriveRisk(result: CascadeResult): "High" | "Medium" | "Low" {
  const pred = result.final.prediction;
  if (pred.includes("Alzheimer")) return "High";
  if (pred.includes("MCI"))       return "Medium";
  return "Low";
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAnalysisStore = create<AnalysisStore>()(
  persist(
    (set, get) => ({
      cases: [],

      addCase: (c) =>
        set((state) => ({ cases: [c, ...state.cases] })),   // newest first

      clearCases: () => set({ cases: [] }),

      getCase: (id) => get().cases.find((c) => c.id === id),

      latestCase: () => get().cases[0],
    }),
    {
      name: "neurosight-analysis-store",   // localStorage key
      // Only persist the cases array, not functions
      partialize: (state) => ({ cases: state.cases }),
    }
  )
);