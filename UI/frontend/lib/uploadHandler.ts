// lib/uploadHandler.ts
// Separates all backend communication logic from the React component.
// The upload page just calls runAnalysis() and reacts to callbacks.

import {
  type CascadeResult,
  type AnalysisCase,
  generateCaseId,
  deriveRisk,
} from "./analysis-store";

const BACKEND_URL = "http://localhost:8000";

// -- Types ---------------------------------------------------------------------

export interface ScanEntry {
  file: File;
  date: string;   // YYYY-MM-DD
}

export interface PatientData {
  age: number;
  sex: "M" | "F";
  education: number;
  race: string;
  apoe?: string;
  abeta42?: number;
  tau?: number;
  ptau?: number;
}

export interface AnalysisCallbacks {
  onStage:  (index: number, status: "active" | "complete") => void;
  onResult: (analysisCase: AnalysisCase) => void;
  onError:  (message: string) => void;
}

// -- Main function -------------------------------------------------------------

export async function runAnalysis(
  scans: ScanEntry[],
  patient: PatientData,
  callbacks: AnalysisCallbacks,
): Promise<void> {
  const { onStage, onResult, onError } = callbacks;

  // -- 1. Build multipart form ------------------------------------------------
  const form = new FormData();

  // Sort by date before sending
  const sorted = [...scans].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  sorted.forEach((s) => form.append("scans", s.file, s.file.name));
  form.append("scan_dates", JSON.stringify(sorted.map((s) => s.date)));

  form.append("age",       String(patient.age));
  form.append("sex",       patient.sex);
  form.append("education", String(patient.education));
  form.append("race",      patient.race);

  if (patient.apoe)    form.append("apoe",    patient.apoe);
  if (patient.abeta42) form.append("abeta42", String(patient.abeta42));
  if (patient.tau)     form.append("tau",     String(patient.tau));
  if (patient.ptau)    form.append("ptau",    String(patient.ptau));

  // -- 2. Submit job ----------------------------------------------------------
  let job_id: string;
  try {
    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `Server error ${res.status}`);
    }

    const data = await res.json();
    job_id = data.job_id;
  } catch (err) {
    onError(err instanceof Error ? err.message : "Failed to connect to backend");
    return;
  }

  // -- 3. Stream progress via SSE ---------------------------------------------
  return new Promise((resolve) => {
    const evtSource = new EventSource(`${BACKEND_URL}/analyze/${job_id}/stream`);

    evtSource.addEventListener("stage", (e: MessageEvent) => {
      const { index, status } = JSON.parse(e.data) as {
        index: number;
        status: "active" | "complete";
      };
      onStage(index, status);
    });

    evtSource.addEventListener("result", (e: MessageEvent) => {
      const payload = JSON.parse(e.data) as {
        status: string;
        data: CascadeResult;
      };

      // Build the AnalysisCase object that gets saved to the store
      const analysisCase: AnalysisCase = {
        id:        generateCaseId(),
        job_id,
        timestamp: new Date().toISOString(),
        patient: {
          age:       patient.age,
          sex:       patient.sex,
          education: patient.education,
          race:      patient.race,
          apoe:      patient.apoe,
        },
        scans: sorted.map((s) => ({
          filename: s.file.name,
          date:     s.date,
        })),
        result:     payload.data,
        risk:       deriveRisk(payload.data),
        confidence: `${(payload.data.final.confidence * 100).toFixed(1)}%`,
        region:     "Bilateral Hippocampus",
      };

      evtSource.close();
      onResult(analysisCase);
      resolve();
    });

    evtSource.addEventListener("error", (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as { message: string };
        onError(payload.message ?? "Pipeline failed");
      } catch {
        onError("Pipeline failed --- check server logs");
      }
      evtSource.close();
      resolve();
    });

    evtSource.onerror = () => {
      onError("Lost connection to server");
      evtSource.close();
      resolve();
    };
  });
}