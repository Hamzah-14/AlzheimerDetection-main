"""
server.py
=========
FastAPI backend for the Alzheimer's MRI analysis pipeline.

Endpoints
---------
POST /analyze
    Accepts scan files + patient metadata as multipart form.
    Starts the pipeline in a background thread.
    Returns { job_id }

GET /analyze/{job_id}/stream
    Server-Sent Events stream.
    Emits one event per pipeline stage, then a final result event.

GET /health
    Simple liveness check.

Run with:
    uvicorn server:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import json
import os
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import traceback
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# ── Path setup ────────────────────────────────────────────────────────────────
# server.py lives inside ThePipelineComplete/ — anchor everything to here.
BASE_DIR = Path(__file__).resolve().parent

# Patch module-level path constants BEFORE importing pipeline modules.
# This is the single fix for all relative-path bugs across the codebase.
os.environ["PIPELINE_BASE"] = str(BASE_DIR)
sys.path.insert(0, str(BASE_DIR))

# Monkey-patch the TEMPLATE_PATH constant in preprocessing before import
import preprocessing as _pre_mod
_pre_mod.TEMPLATE_PATH = str(BASE_DIR / "MNI_Template" / "MNI152_T1_1mm.nii.gz")

# Patch model dirs in inference before import
import inference as _inf_mod
_inf_mod.TASKS["task1"]["model_dir"] = str(BASE_DIR / "trained_models" / "task1")
_inf_mod.TASKS["task2"]["model_dir"] = str(BASE_DIR / "trained_models" / "task2")
_inf_mod.TASKS["task3"]["model_dir"] = str(BASE_DIR / "trained_models" / "task3")

# Fix task1 feature list path (was incorrectly pointing to task3)
# Both are identical but correctness matters.
# load_task_artifacts() builds the path dynamically from model_dir so the
# above patch already fixes it — no extra action needed.

from glcm import extract_features
from preprocessing import (
    n4_correct, register_to_mni, crop_hippocampus,
    quantize_crops, crops_to_bin_bytes,
)
from data_fusion import compute_temporal_features, build_metadata_array
from inference import run_cascade
import numpy as np

# ── NCC quality thresholds (match training pipeline 0_0_3_MNI.py) ────────────
NCC_FAIL_THRESHOLD = 0.60   # below → reject scan, abort pipeline
NCC_WARN_THRESHOLD = 0.70   # below → continue but flag warning in result
NCC_MIN_VOXELS     = 50_000 # below → NCC unreliable (corrupted/clipped FOV)

def _compute_ncc(template_np: np.ndarray, registered_np: np.ndarray) -> tuple:
    """
    Normalised cross-correlation restricted to voxels nonzero in both
    the MNI template and the registered scan. Matches compute_ncc() in
    0_0_3_MNI.py exactly — same mask, same formula.
    Returns (ncc, n_overlap_voxels).
    """
    mask     = (template_np > 0) & (registered_np > 0)
    n_voxels = int(mask.sum())
    if n_voxels < NCC_MIN_VOXELS:
        return 0.0, n_voxels
    f = template_np[mask].astype(np.float64)
    m = registered_np[mask].astype(np.float64)
    f -= f.mean()
    m -= m.mean()
    denom = np.sqrt((f * f).sum()) * np.sqrt((m * m).sum())
    if denom < 1e-8:
        return 0.0, n_voxels
    return float((f * m).sum() / denom), n_voxels

# ── Job store (in-memory, single process) ─────────────────────────────────────
# Each job_id → dict with keys: status, stages, result, error
_jobs: dict[str, dict[str, Any]] = {}
_job_queues: dict[str, asyncio.Queue] = {}  # per-job SSE event queues

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="NeuroSight Pipeline API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _emit(job_id: str, event: str, data: dict):
    """Thread-safe SSE event push into a job's queue."""
    loop = _jobs[job_id]["loop"]
    queue = _job_queues[job_id]
    payload = json.dumps(data)
    asyncio.run_coroutine_threadsafe(queue.put(f"event: {event}\ndata: {payload}\n\n"), loop)


def _parse_dates(date_strings: list[str]) -> list[float]:
    """Convert ISO date strings to months-from-first-scan floats."""
    dates = [datetime.strptime(d.strip(), "%Y-%m-%d") for d in date_strings]
    dates.sort()
    t0 = dates[0]
    return [round((d - t0).days / 30.44, 2) for d in dates]


# ── Pipeline runner (executed in a thread pool) ────────────────────────────────

def _run_pipeline(
    job_id: str,
    scan_paths: list[str],          # temp file paths, already sorted by date
    scan_dates_str: list[str],
    patient_data: dict,
):
    """
    Full pipeline:
      Stage 0 — files received (already done before thread starts)
      Stage 1 — preprocess each scan
      Stage 2 — GLCM feature extraction
      Stage 3 — cascade inference
      Stage 4 — report ready
    """
    try:
        # Stage 1 — Preprocess
        _emit(job_id, "stage", {"index": 1, "status": "active", "label": "Preprocess"})

        scan_dates = _parse_dates(scan_dates_str)

        # Preprocess all scans in parallel — each scan gets its own thread.
        # NCC is computed after registration (before cropping) as a quality gate.
        # scan_paths are already sorted by date; we preserve order via index.
        all_bin:      list[bytes] = [b""]  * len(scan_paths)
        all_ncc:      list[float] = [0.0]  * len(scan_paths)
        ncc_warnings: list[str]   = []

        # Load MNI template numpy array once for NCC computation
        import ants as _ants
        _template_np = _ants.image_read(str(BASE_DIR / "MNI_Template" / "MNI152_T1_1mm.nii.gz")).numpy()

        def _preprocess_one(args):
            idx, path = args
            # Step-by-step preprocessing so we can intercept after registration
            img_n4         = n4_correct(path)
            img_registered = register_to_mni(img_n4)

            # ── NCC quality check ───────────────────────────────────────────
            registered_np       = img_registered.numpy()
            ncc, n_overlap      = _compute_ncc(_template_np, registered_np)

            if ncc < NCC_FAIL_THRESHOLD:
                raise ValueError(
                    f"Scan {idx+1} registration failed: NCC={ncc:.3f} "
                    f"(threshold={NCC_FAIL_THRESHOLD}). "
                    f"Overlap voxels: {n_overlap:,}. "
                    f"Check scan orientation or image quality."
                )

            # Crop, quantize, serialise
            crops           = crop_hippocampus(img_registered)
            crops_quantized = quantize_crops(crops)
            bin_bytes       = crops_to_bin_bytes(crops_quantized)

            return idx, bin_bytes, ncc, n_overlap

        with ThreadPoolExecutor(max_workers=len(scan_paths)) as executor:
            futures = {executor.submit(_preprocess_one, (i, p)): i
                       for i, p in enumerate(scan_paths)}
            for future in as_completed(futures):
                idx, bin_bytes, ncc, n_overlap = future.result()
                all_bin[idx] = bin_bytes
                all_ncc[idx] = ncc
                if ncc < NCC_WARN_THRESHOLD:
                    ncc_warnings.append(
                        f"Scan {idx+1}: NCC={ncc:.3f} — registration quality low, "
                        f"results may be less reliable."
                    )

        _emit(job_id, "stage", {"index": 1, "status": "complete", "label": "Preprocess"})

        # Stage 2 — GLCM
        _emit(job_id, "stage", {"index": 2, "status": "active", "label": "Radiomics"})

        all_features = []
        feature_names = None
        for bin_bytes in all_bin:
            feats, names = extract_features(bin_bytes)
            all_features.append(feats)
            feature_names = names

        _emit(job_id, "stage", {"index": 2, "status": "complete", "label": "Radiomics"})

        # Stage 3 — Classify
        _emit(job_id, "stage", {"index": 3, "status": "active", "label": "Classify"})

        temporal_feats, temporal_names = compute_temporal_features(
            all_features, scan_dates, feature_names
        )

        scan_metadata, scan_metadata_names = build_metadata_array(patient_data, prefix="")
        temp_metadata, temp_metadata_names = build_metadata_array(patient_data, prefix="meta_")

        results = run_cascade(
            all_features[-1],
            feature_names,
            temporal_feats,
            temporal_names,
            scan_metadata,
            scan_metadata_names,
            temp_metadata,
            temp_metadata_names,
        )

        _emit(job_id, "stage", {"index": 3, "status": "complete", "label": "Classify"})

        # Stage 4 — Report ready
        _emit(job_id, "stage", {"index": 4, "status": "complete", "label": "Report Ready"})

        # Serialise final result (convert numpy floats → python floats)
        def _clean(obj):
            if isinstance(obj, dict):
                return {k: _clean(v) for k, v in obj.items()}
            if isinstance(obj, float):
                import math
                return None if math.isnan(obj) else round(obj, 4)
            return obj

        # Attach NCC quality metadata to result
        results["registration_qc"] = {
            "ncc_per_scan":   [round(n, 4) for n in all_ncc],
            "ncc_warnings":   ncc_warnings,
            "ncc_pass":       all(n >= NCC_WARN_THRESHOLD for n in all_ncc),
        }

        _emit(job_id, "result", {"status": "success", "data": _clean(results)})
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["result"] = results

    except Exception as exc:
        tb = traceback.format_exc()
        _emit(job_id, "error", {"message": str(exc), "traceback": tb})
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"] = str(exc)

    finally:
        # Signal stream to close
        loop = _jobs[job_id]["loop"]
        asyncio.run_coroutine_threadsafe(
            _job_queues[job_id].put("__DONE__"), loop
        )
        # Clean up temp files
        for path in scan_paths:
            try:
                os.unlink(path)
            except OSError:
                pass


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "base_dir": str(BASE_DIR)}


@app.post("/analyze")
async def analyze(
    # Files
    scans: list[UploadFile] = File(...),

    # Scan metadata
    scan_dates: str = Form(...),        # JSON array of "YYYY-MM-DD" strings

    # Demographics (required)
    age: float       = Form(...),
    sex: str         = Form(...),       # "M" or "F"
    education: float = Form(...),
    race: str        = Form(...),

    # Optional biomarkers (send empty string to skip)
    apoe: str   = Form(""),            # e.g. "e3/e4" or ""
    abeta42: str = Form(""),
    tau: str    = Form(""),
    ptau: str   = Form(""),
):
    if len(scans) < 2:
        raise HTTPException(400, "At least 2 scan files are required.")

    dates_list: list[str] = json.loads(scan_dates)
    if len(dates_list) != len(scans):
        raise HTTPException(400, "Number of scan_dates must match number of scans.")

    # Sort files by date
    pairs = sorted(zip(dates_list, scans), key=lambda x: x[0])
    sorted_dates = [p[0] for p in pairs]
    sorted_files = [p[1] for p in pairs]

    # Save uploads to temp files
    tmp_paths: list[str] = []
    for upload in sorted_files:
        suffix = Path(upload.filename or "scan.nii.gz").suffix
        if upload.filename and upload.filename.endswith(".nii.gz"):
            suffix = ".nii.gz"
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, "wb") as f:
            f.write(await upload.read())
        tmp_paths.append(tmp_path)

    # Build patient_data dict (mirrors build_model_input output)
    def _opt_float(s: str):
        s = s.strip()
        return float(s) if s else None

    apoe_e4_count = None
    if apoe.strip():
        apoe_e4_count = float(apoe.count("e4"))

    n = len(scans)
    dates_dt = [datetime.strptime(d, "%Y-%m-%d") for d in sorted_dates]
    gaps = [(dates_dt[i] - dates_dt[0]).days / 30.44 for i in range(n)]
    followup = gaps[-1] if len(gaps) > 1 else 0.0

    patient_data = {
        "age":           age,
        "sex_encoded":   1.0 if sex.upper() == "M" else 0.0,
        "education":     education,
        "apoe_e4_count": apoe_e4_count,
        "race_White":    1.0 if race == "White"    else 0.0,
        "race_Black":    1.0 if race == "Black"    else 0.0,
        "race_Asian":    1.0 if race == "Asian"    else 0.0,
        "race_Hispanic": 1.0 if race == "Hispanic" else 0.0,
        "race_Other":    1.0 if race == "Other"    else 0.0,
        "csf_ABETA42":   _opt_float(abeta42),
        "csf_TAU":       _opt_float(tau),
        "csf_PTAU":      _opt_float(ptau),
        "n_scans":       float(n),
        "followup_months": followup,
    }

    # Create job
    job_id = str(uuid.uuid4())
    loop = asyncio.get_event_loop()
    _job_queues[job_id] = asyncio.Queue()
    _jobs[job_id] = {
        "status": "running",
        "result": None,
        "error":  None,
        "loop":   loop,
    }

    # Emit stage 0 (Upload received) immediately
    await _job_queues[job_id].put(
        f'event: stage\ndata: {json.dumps({"index": 0, "status": "complete", "label": "Upload"})}\n\n'
    )
    await _job_queues[job_id].put(
        f'event: stage\ndata: {json.dumps({"index": 1, "status": "active",   "label": "Preprocess"})}\n\n'
    )

    # Kick off pipeline in background thread (CPU-bound, can't use async)
    thread = threading.Thread(
        target=_run_pipeline,
        args=(job_id, tmp_paths, sorted_dates, patient_data),
        daemon=True,
    )
    thread.start()

    return {"job_id": job_id}


@app.get("/analyze/{job_id}/stream")
async def stream(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, "Job not found.")

    async def event_generator() -> AsyncGenerator[str, None]:
        queue = _job_queues[job_id]
        while True:
            msg = await queue.get()
            if msg == "__DONE__":
                break
            yield msg
            # Small sleep to avoid tight loop
            await asyncio.sleep(0.01)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )