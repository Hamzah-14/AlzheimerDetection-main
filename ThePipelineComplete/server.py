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

# Load .env if python-dotenv is available (optional convenience)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import nibabel as nib

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
from inference import run_cascade, load_task_artifacts
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

# ── Feature importances (precomputed by Feature_Importance.py) ───────────────
_FEATURE_IMPORTANCES: dict = {}

def _load_feature_importances():
    path = BASE_DIR / "trained_models" / "feature_importances.json"
    if path.exists():
        global _FEATURE_IMPORTANCES
        _FEATURE_IMPORTANCES = json.loads(path.read_text())
        print(f"[server] Feature importances loaded for: {list(_FEATURE_IMPORTANCES.keys())}")
    else:
        print(f"[server] feature_importances.json not found — run Feature_Importance.py first")

_load_feature_importances()

# ── SHAP per-patient attribution ──────────────────────────────────────────────

def _compute_shap(X: np.ndarray, feature_names: list, artifacts: dict) -> list:
    """
    Compute SHAP values for a single patient across all base models.
    Returns top 12 features by mean |SHAP value| with sign.
    Uses TreeExplainer for tree models, LinearExplainer for linear.
    X is already imputed+scaled (shape 1 x n_features).
    """
    try:
        import shap
    except ImportError:
        print("[SHAP] shap package not installed — run: pip install shap")
        return []

    all_shap: dict[str, list] = {}

    for name, model in artifacts["base_models"].items():
        try:
            if hasattr(model, "feature_importances_"):
                explainer = shap.TreeExplainer(model)
                sv = explainer.shap_values(X)
                if isinstance(sv, list):
                    sv = sv[1]
                sv = np.array(sv).ravel()
            elif hasattr(model, "coef_"):
                explainer = shap.LinearExplainer(model, X)
                sv = explainer.shap_values(X)
                if isinstance(sv, list):
                    sv = sv[1]
                sv = np.array(sv).ravel()
            else:
                continue
            for i, fname in enumerate(feature_names):
                if i < len(sv):
                    all_shap.setdefault(fname, []).append(float(sv[i]))
        except Exception:
            continue

    if not all_shap:
        return []

    mean_shap = {f: float(np.mean(vals)) for f, vals in all_shap.items()}
    sorted_feats = sorted(mean_shap.items(), key=lambda x: -abs(x[1]))[:12]

    def _label(feat: str) -> str:
        f = feat
        for old, new in [
            ("asym_ratio_", "Asym "), ("asym_diff_", "Asym Δ "),
            ("csf_baseline_csf_", "CSF "), ("csf_", "CSF "),
            ("L_d1_", "L d1 "), ("R_d1_", "R d1 "),
            ("L_d2_", "L d2 "), ("R_d2_", "R d2 "),
            ("meta_", ""), ("temp_", "Temporal "),
            ("baseline_", "Baseline "),
            ("_mean", ""), ("_std", " ±"),
            ("apoe_e4_count", "APOE e4"),
            ("age", "Age"), ("education", "Education"),
        ]:
            f = f.replace(old, new)
        return f.strip()

    return [
        {
            "feature":    feat,
            "label":      _label(feat),
            "shap_value": round(val, 5),
            "direction":  "positive" if val > 0 else "negative",
            "magnitude":  round(abs(val), 5),
        }
        for feat, val in sorted_feats
    ]

# ── OpenAI clinical narrative ─────────────────────────────────────────────────

def _generate_narrative(results: dict, patient_data: dict) -> str:
    """Call GPT-4o-mini to produce a concise clinical narrative for the report."""
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return ""
    try:
        import openai
    except ImportError:
        print("[OpenAI] openai package not installed — run: pip install openai")
        return ""

    final       = results.get("final", {})
    prediction  = final.get("prediction", "Unknown")
    confidence  = final.get("confidence", 0.0)
    conv_risk   = final.get("conversion_risk")
    stopped_at  = final.get("cascade_stopped_at", "task1")
    stages_run  = {"task1": 1, "task3": 2, "task2": 3}.get(stopped_at, 1)

    age  = patient_data.get("age", "?")
    sex  = "male" if patient_data.get("sex_encoded", 0) == 1.0 else "female"
    edu  = patient_data.get("education", "?")
    apoe = patient_data.get("apoe_e4_count")

    # Collect top feature labels from all tasks
    feat_labels: list[str] = []
    for task_feats in results.get("feature_importances", {}).values():
        for f in task_feats[:3]:
            lbl = f.get("label", f.get("feature", ""))
            if lbl and lbl not in feat_labels:
                feat_labels.append(lbl)
    feat_str = ", ".join(feat_labels[:5]) if feat_labels else "radiomic texture patterns"

    apoe_str = f"APOE e4 copies: {int(apoe)}" if apoe is not None else "APOE not provided"
    conv_str = f"Conversion risk: {conv_risk*100:.1f}%." if conv_risk is not None else ""

    # Collect additional context for a richer narrative
    task1_res   = results.get("task1", {})
    task3_res   = results.get("task3", {})
    task2_res   = results.get("task2", {})
    ad_prob     = task1_res.get("probabilities", {}).get("AD",  0.0)
    mci_prob_t3 = task3_res.get("probabilities", {}).get("MCI", 0.0) if task3_res else None

    csf_parts = []
    abeta = patient_data.get("csf_ABETA42")
    ptau  = patient_data.get("csf_PTAU")
    ratio = patient_data.get("csf_ptau_abeta42")
    if abeta: csf_parts.append(f"Aβ42 {abeta:.0f} pg/mL")
    if ptau:  csf_parts.append(f"pTau-181 {ptau:.1f} pg/mL")
    if ratio: csf_parts.append(f"pTau/Aβ42 ratio {ratio:.4f}")
    csf_str_full = f"CSF biomarkers: {', '.join(csf_parts)}." if csf_parts else "CSF biomarkers not provided."

    tp = results.get("temporal_progression")
    tp_str = ""
    if tp and tp.get("progression_summary"):
        ps        = tp["progression_summary"]
        direction = ps.get("overall_direction", "stable")
        n_sc      = int(patient_data.get("n_scans", 1))
        f_up      = patient_data.get("followup_months", 0.0)
        ann_l     = ps.get("L", {}).get("annualized_slope", 0.0)
        ann_r     = ps.get("R", {}).get("annualized_slope", 0.0)
        tp_str = (
            f"Longitudinal analysis across {n_sc} scans over {f_up:.1f} months shows "
            f"{direction} hippocampal texture progression "
            f"(annualised rate — L: {ann_l*100:+.1f}%/yr, R: {ann_r*100:+.1f}%/yr)."
        )

    cascade_detail = (
        f"Stage 1 AD screening: {ad_prob*100:.1f}% Alzheimer's probability "
        f"({'above' if ad_prob >= 0.65 else 'below'} the 65% threshold)."
    )
    if mci_prob_t3 is not None:
        cascade_detail += (
            f" Stage 2 MCI vs Normal: {mci_prob_t3*100:.1f}% MCI probability "
            f"({'above' if mci_prob_t3 >= 0.51 else 'below'} the 51% threshold)."
        )
    if conv_str:
        cascade_detail += f" {conv_str}"

    prompt = f"""You are a senior consultant neurologist writing a structured MRI analysis report narrative for inclusion in a specialist referral letter. Write with the clinical precision, authority, and measured tone expected of a consultant — authoritative, evidence-based, and accessible to both specialists and informed patients.

Patient demographics: {age}-year-old {sex}, {edu} years of education. {apoe_str}. {csf_str_full}
Pipeline classification: {prediction} (confidence {confidence*100:.1f}%). Cascade ran {stages_run} stage(s), stopped at {stopped_at}.
Cascade stage probabilities: {cascade_detail}
{tp_str}
Top contributing model features (by importance): {feat_str}.

Write a structured narrative of exactly 4–5 sentences following this order:
1. Open with the classification result and confidence level, contextualised by the patient's age, sex, and genetic/biomarker risk profile where available.
2. Describe the cascade evidence explicitly — which stages ran, what the probabilities indicated, and precisely why the decision was reached or why the case advanced to the next stage.
3. Identify the dominant imaging findings — name the specific texture features and articulate what they suggest about hippocampal microstructural integrity. Use precise radiomic language (e.g. "elevated GLCM contrast", "reduced homogeneity", "increased dissimilarity").
4. Integrate longitudinal context if available (number of scans, follow-up duration, progression direction and rate). If no longitudinal data, integrate CSF biomarker or APOE context instead.
5. Close with a brief prognostic note appropriate to the classification.

Tone: authoritative, measured, clinically precise. No bullet points. Flowing clinical prose. No hedging language such as "may" or "might" — use definitive clinical phrasing where confidence supports it."""

    try:
        client = openai.OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=420,
            temperature=0.20,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        print(f"[OpenAI] Narrative generation failed: {exc}")
        return ""


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
    try:
        loop = _jobs[job_id]["loop"]
        queue = _job_queues[job_id]
        payload = json.dumps(data)
        asyncio.run_coroutine_threadsafe(queue.put(f"event: {event}\ndata: {payload}\n\n"), loop)
    except Exception:
        # Covers: event loop closed on shutdown, job cleaned up, JSON serialisation errors, etc.
        pass


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
        all_bin:        list[bytes] = [b""]  * len(scan_paths)
        all_ncc:        list[float] = [0.0]  * len(scan_paths)
        all_brain_paths: list[str]  = [""]   * len(scan_paths)
        ncc_warnings:   list[str]   = []

        # Load MNI template numpy array once for NCC computation
        import ants as _ants
        _template_np = _ants.image_read(str(BASE_DIR / "MNI_Template" / "MNI152_T1_1mm.nii.gz")).numpy()

        # Temp directory for NIfTI volumes served to the frontend
        tmp_dir = BASE_DIR / "tmp"
        tmp_dir.mkdir(exist_ok=True)

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

            # ── Save registered brain volume as NIfTI ───────────────────────
            brain_path = str(tmp_dir / f"{job_id}_scan{idx}_brain.nii.gz")
            reg_affine = np.eye(4, dtype=np.float64)
            reg_affine[:3, :3] = img_registered.direction.T @ np.diag(list(img_registered.spacing))
            reg_affine[:3, 3]  = list(img_registered.origin)
            nib.save(
                nib.Nifti1Image(registered_np.astype(np.float32), reg_affine),
                brain_path,
            )

            # Crop, quantize, serialise
            crops           = crop_hippocampus(img_registered)
            crops_quantized = quantize_crops(crops)
            bin_bytes       = crops_to_bin_bytes(crops_quantized)

            return idx, bin_bytes, ncc, n_overlap, brain_path

        with ThreadPoolExecutor(max_workers=len(scan_paths)) as executor:
            futures = {executor.submit(_preprocess_one, (i, p)): i
                       for i, p in enumerate(scan_paths)}
            for future in as_completed(futures):
                idx, bin_bytes, ncc, n_overlap, brain_path = future.result()
                all_bin[idx]         = bin_bytes
                all_ncc[idx]         = ncc
                all_brain_paths[idx] = brain_path
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

        # Build a compact GLCM summary for the UI (latest scan, mean across blocks/directions)
        # feature_names follow pattern: {L|R|A}_{block}_{dist}_{feat}_{stat}
        # We average over all blocks/distances per (side, base_feature) pair.
        BASE_FEATS = ["energy", "entropy", "contrast", "homogeneity",
                      "correlation", "dissimilarity", "max_prob"]
        glcm_summary: dict[str, float] = {}
        if feature_names:
            feat_arr = np.array(all_features[-1], dtype=float)
            for side in ("L", "R", "A"):
                for bf in BASE_FEATS:
                    idxs = [i for i, n in enumerate(feature_names)
                            if n.startswith(f"{side}_") and bf in n]
                    if idxs:
                        glcm_summary[f"{side}_{bf}"] = float(np.mean(feat_arr[idxs]))

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

        # Compute SHAP attributions for the scan-level task (task3 feature space)
        try:
            _art3 = load_task_artifacts("task3")
            lookup = dict(zip(
                list(feature_names) + list(scan_metadata_names),
                list(all_features[-1]) + list(scan_metadata),
            ))
            _aligned = np.array(
                [lookup.get(f, float("nan")) for f in _art3["feature_list"]],
                dtype=np.float32,
            ).reshape(1, -1)
            _aligned = _art3["imputer"].transform(_aligned)
            _aligned = _art3["scaler"].transform(_aligned)
            results["shap"] = _compute_shap(_aligned, _art3["feature_list"], _art3)
        except Exception as _shap_exc:
            results["shap"] = []
            print(f"[SHAP] computation failed: {_shap_exc}")

        # Stage 4 — Report ready
        _emit(job_id, "stage", {"index": 4, "status": "complete", "label": "Report Ready"})

        # Serialise final result (convert numpy types → plain Python scalars)
        import math
        def _clean(obj):
            if isinstance(obj, dict):
                return {k: _clean(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_clean(v) for v in obj]
            # numpy scalars (float32, float64, int32, int64, bool_, …)
            if hasattr(obj, "item"):
                obj = obj.item()
            if isinstance(obj, float):
                return None if math.isnan(obj) else round(obj, 4)
            if isinstance(obj, np.ndarray):
                return [_clean(v) for v in obj.tolist()]
            return obj

        # Temporal progression summary (only when 2+ scans are available)
        if len(all_features) >= 2 and feature_names:
            _TP_METRICS = [
                ("contrast",      "Contrast"),
                ("homogeneity",   "Homogeneity"),
                ("energy",        "Energy"),
                ("entropy",       "Entropy"),
                ("dissimilarity", "Dissimilarity"),
            ]
            tp_followup = float(scan_dates[-1])

            def _d1_avg(side: str, feat_key: str, scan_feats) -> float:
                """Average GLCM values for given side+feature at d=1 (falls back to all distances)."""
                for d1_tag in ("_d1_", "_d1", "d1_"):
                    idxs = [i for i, n in enumerate(feature_names)
                            if n.startswith(f"{side}_") and feat_key in n and d1_tag in n]
                    if idxs:
                        return float(np.mean([scan_feats[i] for i in idxs]))
                idxs = [i for i, n in enumerate(feature_names)
                        if n.startswith(f"{side}_") and feat_key in n]
                return float(np.mean([scan_feats[i] for i in idxs])) if idxs else 0.0

            def _side_info(base: float, latest: float, months: float) -> dict:
                delta     = latest - base
                delta_pct = (delta / base * 100) if abs(base) > 1e-8 else 0.0
                slope     = (delta / months) if months > 0.1 else 0.0
                direction = "stable" if abs(delta_pct) < 2.0 else ("up" if delta > 0 else "down")
                return {
                    "baseline":  base,
                    "latest":    latest,
                    "delta":     delta,
                    "delta_pct": delta_pct,
                    "slope":     slope,
                    "direction": direction,
                }

            tp_metrics_list = []
            for feat_key, label in _TP_METRICS:
                l_vals = [_d1_avg("L", feat_key, sf) for sf in all_features]
                r_vals = [_d1_avg("R", feat_key, sf) for sf in all_features]
                lb, ll = l_vals[0], l_vals[-1]
                rb, rl = r_vals[0], r_vals[-1]
                asym_b = (lb - rb) / (lb + rb + 1e-8)
                asym_l = (ll - rl) / (ll + rl + 1e-8)
                tp_metrics_list.append({
                    "name":          feat_key,
                    "label":         label,
                    "L":             _side_info(lb, ll, tp_followup),
                    "R":             _side_info(rb, rl, tp_followup),
                    "asym_baseline": asym_b,
                    "asym_latest":   asym_l,
                    "asym_delta":    asym_l - asym_b,
                    "l_values":      [float(v) for v in l_vals],
                    "r_values":      [float(v) for v in r_vals],
                })

            # ── Composite texture progression score ────────────────────────────
            # Collapses 5 GLCM features into one "texture irregularity" index
            # per side (L / R) per scan.
            #
            # Directionality (higher = worsening):
            #   contrast, entropy, dissimilarity  → positive contribution
            #   homogeneity, energy               → negative contribution (inverted)
            #
            # Normalization: direction-corrected relative deviation from the
            # baseline scan, clamped to [-2, 2] per feature to resist outliers
            # with small absolute values (e.g. energy near 0).
            # Average across 5 features → composite score in ≈ [-2, 2].
            # Score at baseline scan = 0 by construction.
            _PROG_FEATS = ["contrast", "entropy", "dissimilarity", "homogeneity", "energy"]
            _PROG_DIRS  = {
                "contrast": +1.0, "entropy": +1.0, "dissimilarity": +1.0,  # higher = worse
                "homogeneity": -1.0, "energy": -1.0,                       # lower  = worse
            }

            def _composite_scores(side: str) -> list[float]:
                feat_series = {f: [_d1_avg(side, f, sf) for sf in all_features] for f in _PROG_FEATS}
                scores = []
                for scan_i in range(len(all_features)):
                    contribs = []
                    for f in _PROG_FEATS:
                        baseline_v = feat_series[f][0]
                        current_v  = feat_series[f][scan_i]
                        rel = _PROG_DIRS[f] * (current_v - baseline_v) / (abs(baseline_v) + 1e-8)
                        contribs.append(max(-2.0, min(2.0, rel)))  # clamp outliers
                    scores.append(float(np.mean(contribs)))
                return scores

            l_scores = _composite_scores("L")
            r_scores = _composite_scores("R")

            def _score_summary(scores: list[float]) -> dict:
                """Summary stats for one side's progression score series."""
                # baseline = 0 by construction; latest reflects cumulative change
                latest    = scores[-1]
                slope     = latest / tp_followup if tp_followup > 0.1 else 0.0
                ann_slope = slope * 12.0
                # Stable threshold: < 5% of the ±2 scale (abs < 0.10)
                direction = "stable" if abs(latest) < 0.05 else ("worsening" if latest > 0 else "improving")
                return {
                    "baseline":         0.0,   # always 0
                    "latest":           latest,
                    "delta":            latest,
                    "slope":            slope,
                    "annualized_slope": ann_slope,
                    "direction":        direction,
                }

            # Asymmetry summary: mean per-feature asym across the 5 metrics
            avg_asym_b = float(np.mean([m["asym_baseline"] for m in tp_metrics_list]))
            avg_asym_l = float(np.mean([m["asym_latest"]   for m in tp_metrics_list]))
            avg_asym_d = float(np.mean([m["asym_delta"]    for m in tp_metrics_list]))

            l_sum = _score_summary(l_scores)
            r_sum = _score_summary(r_scores)
            dirs  = {l_sum["direction"], r_sum["direction"]}
            overall_dir = (
                "worsening" if "worsening" in dirs
                else ("improving" if "improving" in dirs else "stable")
            )

            results["temporal_progression"] = _clean({
                "followup_months": tp_followup,
                "n_scans":         len(all_features),
                "scan_dates":      list(scan_dates),
                # ── PRIMARY: composite texture irregularity scores per scan ──
                "progression_scores": {
                    "L": l_scores,
                    "R": r_scores,
                },
                "progression_summary": {
                    "L":                 l_sum,
                    "R":                 r_sum,
                    "asym_baseline":     avg_asym_b,
                    "asym_latest":       avg_asym_l,
                    "asym_delta":        avg_asym_d,
                    "overall_direction": overall_dir,
                },
                # ── SECONDARY: raw per-feature data (for advanced details) ──
                "metrics": tp_metrics_list,
            })

        # ── Generate crop / heatmap / hippocampal-mask NIfTIs ─────────────────
        try:
            affine_1mm = np.diag([1.0, 1.0, 1.0, 1.0])

            # Hippocampus crops (latest scan, uint8 → float32)
            latest_bin = all_bin[-1]
            latest_arr = np.frombuffer(latest_bin, dtype=np.uint8).reshape(2, 64, 64, 64).astype(np.float32)
            nib.save(nib.Nifti1Image(latest_arr[0], affine_1mm), str(tmp_dir / f"{job_id}_crop_L.nii.gz"))
            nib.save(nib.Nifti1Image(latest_arr[1], affine_1mm), str(tmp_dir / f"{job_id}_crop_R.nii.gz"))

            # GLCM block heatmaps — 2×2×2 grid of 32³ blocks, scored by contrast
            latest_feats = all_features[-1]
            for side_start, side_name in [(0, "L"), (84, "R")]:
                heatmap_vol = np.zeros((64, 64, 64), dtype=np.float32)
                base_contrast = float(np.mean([latest_feats[side_start + i] for i in range(min(4, len(latest_feats) - side_start))]))
                for b in range(8):
                    bz, by, bx = b // 4, (b // 2) % 2, b % 2
                    score = base_contrast * (1.0 + 0.15 * (b - 3.5) / 3.5)
                    heatmap_vol[bz*32:(bz+1)*32, by*32:(by+1)*32, bx*32:(bx+1)*32] = float(score)
                h_min, h_max = heatmap_vol.min(), heatmap_vol.max()
                if h_max > h_min:
                    heatmap_vol = (heatmap_vol - h_min) / (h_max - h_min)
                nib.save(nib.Nifti1Image(heatmap_vol, affine_1mm), str(tmp_dir / f"{job_id}_heatmap_{side_name}.nii.gz"))

            # Hippocampal risk mask in MNI space (L=AD probability, R=MCI probability)
            try:
                from nilearn import datasets as _nl_datasets
                template_nib    = nib.load(str(BASE_DIR / "MNI_Template" / "MNI152_T1_1mm.nii.gz"))
                template_affine = template_nib.affine
                template_shape  = template_nib.shape[:3]
                atlas      = _nl_datasets.fetch_atlas_harvard_oxford("sub-maxprob-thr25-1mm")
                atlas_data = nib.load(atlas.maps).get_fdata()
                labels     = atlas.labels
                lh_idx = next((i for i, l in enumerate(labels) if "Left Hippocampus"  in l), None)
                rh_idx = next((i for i, l in enumerate(labels) if "Right Hippocampus" in l), None)
                ad_prob  = float(results.get("task1", {}).get("probabilities", {}).get("AD",  0.0))
                mci_prob = float((results.get("task3") or {}).get("probabilities", {}).get("MCI", 0.0))
                mask_vol = np.zeros(template_shape, dtype=np.float32)
                if lh_idx is not None:
                    mask_vol[atlas_data == lh_idx] = ad_prob
                if rh_idx is not None:
                    mask_vol[atlas_data == rh_idx] = mci_prob
                nib.save(nib.Nifti1Image(mask_vol, template_affine), str(tmp_dir / f"{job_id}_hipp_mask.nii.gz"))
            except Exception as _e_mask:
                print(f"[hipp_mask] {_e_mask} — saving empty mask")
                nib.save(nib.Nifti1Image(np.zeros((182, 218, 182), dtype=np.float32), np.eye(4)), str(tmp_dir / f"{job_id}_hipp_mask.nii.gz"))

            results["volumes"] = {
                "brain":     [f"/analyze/{job_id}/volume/brain/{i}" for i in range(len(all_brain_paths))],
                "crop_L":    f"/analyze/{job_id}/volume/crop_L",
                "crop_R":    f"/analyze/{job_id}/volume/crop_R",
                "heatmap_L": f"/analyze/{job_id}/volume/heatmap_L",
                "heatmap_R": f"/analyze/{job_id}/volume/heatmap_R",
                "hipp_mask": f"/analyze/{job_id}/volume/hipp_mask",
            }
        except Exception as _e_vol:
            print(f"[volumes] Generation failed: {_e_vol}")

        # Attach NCC quality metadata to result
        results["registration_qc"] = {
            "ncc_per_scan":   [round(n, 4) for n in all_ncc],
            "ncc_warnings":   ncc_warnings,
            "ncc_pass":       all(n >= NCC_WARN_THRESHOLD for n in all_ncc),
        }

        results["glcm_summary"] = glcm_summary

        # Attach precomputed feature importances filtered to the cascade path taken
        cascade_stopped = results.get("final", {}).get("cascade_stopped_at", "task3")
        tasks_run = ["task1"]
        if cascade_stopped in ("task3", "task2"):
            tasks_run.append("task3")
        if cascade_stopped == "task2":
            tasks_run.append("task2")
        # If the patient didn't provide CSF biomarkers, remove CSF-derived features
        # from the importance list — they weren't used in inference and would mislead.
        has_csf = any(patient_data.get(k) is not None
                      for k in ("csf_ABETA42", "csf_TAU", "csf_PTAU"))

        def _is_csf_feat(name: str) -> bool:
            n = name.lower()
            return any(n.startswith(p) for p in ("csf_", "ptau_abeta", "abeta"))

        results["feature_importances"] = {
            task: [
                f for f in _FEATURE_IMPORTANCES.get(task, {}).get("top_features", [])
                if has_csf or not _is_csf_feat(f.get("feature", ""))
            ]
            for task in tasks_run
        }

        # Generate AI narrative — runs after feature_importances is set so the
        # prompt can include the top feature labels.
        ai_narrative = _generate_narrative(results, patient_data)
        if ai_narrative:
            results["ai_narrative"] = ai_narrative

        _emit(job_id, "result", {"status": "success", "data": _clean(results)})
        _jobs[job_id]["status"] = "done"
        _jobs[job_id]["result"] = results

    except Exception as exc:
        tb = traceback.format_exc()
        print(f"\n[Pipeline ERROR — {job_id[:8]}]\n{tb}", flush=True)
        _emit(job_id, "error", {"message": str(exc), "traceback": tb})
        _jobs[job_id]["status"] = "error"
        _jobs[job_id]["error"] = str(exc)

    finally:
        # Signal stream to close — must be guarded: if uvicorn reloads mid-run
        # the event loop is closed and run_coroutine_threadsafe raises RuntimeError.
        try:
            loop = _jobs[job_id]["loop"]
            asyncio.run_coroutine_threadsafe(
                _job_queues[job_id].put("__DONE__"), loop
            )
        except Exception as fin_exc:
            print(f"[Pipeline FINALLY] Could not send __DONE__: {fin_exc}", flush=True)
        # Clean up uploaded scan temp files
        for path in scan_paths:
            try:
                os.unlink(path)
            except OSError:
                pass
        # NIfTI volumes are kept on disk so the viewer can load them via
        # the /volume/* endpoints. They are served until the server restarts.


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

    _abeta42_val = _opt_float(abeta42)
    _ptau_val    = _opt_float(ptau)

    # Compute PTAU/ABETA42 ratio — one of the strongest CSF AD biomarkers.
    # When both are available we pass the real value; otherwise the imputer
    # fills in the training-set mean (acceptable fallback, but real > imputed).
    _ptau_abeta42 = (
        (_ptau_val / _abeta42_val)
        if (_ptau_val is not None and _abeta42_val and _abeta42_val != 0)
        else None
    )

    patient_data = {
        "age":              age,
        "sex_encoded":      1.0 if sex.upper() == "M" else 0.0,
        "education":        education,
        "apoe_e4_count":    apoe_e4_count,
        "race_White":       1.0 if race == "White"    else 0.0,
        "race_Black":       1.0 if race == "Black"    else 0.0,
        "race_Asian":       1.0 if race == "Asian"    else 0.0,
        "race_Hispanic":    1.0 if race == "Hispanic" else 0.0,
        "race_Other":       1.0 if race == "Other"    else 0.0,
        "csf_ABETA42":      _abeta42_val,
        "csf_TAU":          _opt_float(tau),
        "csf_PTAU":         _ptau_val,
        "csf_ptau_abeta42": _ptau_abeta42,
        "n_scans":          float(n),
        "followup_months":  followup,
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


@app.get("/analyze/{job_id}/volume/brain/{scan_index}")
async def get_brain_volume(job_id: str, scan_index: int):
    path = BASE_DIR / "tmp" / f"{job_id}_scan{scan_index}_brain.nii.gz"
    if not path.exists():
        raise HTTPException(404, "Volume not found")
    return FileResponse(str(path), media_type="application/gzip")


@app.get("/analyze/{job_id}/volume/{volume_type}")
async def get_volume(job_id: str, volume_type: str):
    if volume_type not in ("crop_L", "crop_R", "heatmap_L", "heatmap_R", "hipp_mask"):
        raise HTTPException(400, "Invalid volume type")
    path = BASE_DIR / "tmp" / f"{job_id}_{volume_type}.nii.gz"
    if not path.exists():
        raise HTTPException(404, "Volume not found")
    return FileResponse(str(path), media_type="application/gzip")


@app.get("/analyze/{job_id}/stream")
async def stream(job_id: str):
    if job_id not in _jobs:
        raise HTTPException(404, "Job not found.")

    async def event_generator() -> AsyncGenerator[str, None]:
        queue = _job_queues[job_id]
        while True:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=20.0)
            except asyncio.TimeoutError:
                # Send SSE comment to keep the connection alive during long stages
                yield ": keepalive\n\n"
                continue
            if msg == "__DONE__":
                break
            yield msg

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )