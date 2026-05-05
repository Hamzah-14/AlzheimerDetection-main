"""
run_patient7.py — Local pipeline run for Patient 7 (MCI) with precise GLCM timing.
"""
import os, sys, time
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
os.environ["PIPELINE_BASE"] = str(BASE_DIR)

import preprocessing as _pre
_pre.TEMPLATE_PATH = str(BASE_DIR / "MNI_Template" / "MNI152_T1_1mm.nii.gz")

import inference as _inf
for t in ("task1", "task2", "task3"):
    _inf.TASKS[t]["model_dir"] = str(BASE_DIR / "trained_models" / t)

from preprocessing import n4_correct, register_to_mni, crop_hippocampus, quantize_crops, crops_to_bin_bytes
from glcm import extract_features
from data_fusion import compute_temporal_features, build_metadata_array
from inference import run_cascade

SCAN_DIR = BASE_DIR / "scans" / "MCI" / "Patient 7"
SCANS = sorted([
    str(SCAN_DIR / "082_S_0832_20080407.nii.gz"),
    str(SCAN_DIR / "082_S_0832_20081023.nii.gz"),
    str(SCAN_DIR / "082_S_0832_20101216.nii.gz"),
])
SCAN_DATES_STR = ["2008-04-07", "2008-10-23", "2010-12-16"]

from datetime import datetime
def parse_dates(ds):
    dates = [datetime.strptime(d, "%Y-%m-%d") for d in ds]
    t0 = dates[0]
    return [round((d - t0).days / 30.44, 2) for d in dates]

SCAN_DATES = parse_dates(SCAN_DATES_STR)

PATIENT = {
    "age":             66.0,
    "sex_encoded":     1.0,
    "education":       20.0,
    "apoe_e4_count":   0.0,
    "race_White":      1.0,
    "race_Black":      0.0,
    "race_Asian":      0.0,
    "race_Hispanic":   0.0,
    "race_Other":      0.0,
    "csf_ABETA42":     None,
    "csf_TAU":         None,
    "csf_PTAU":        None,
    "csf_ptau_abeta42": None,
    "n_scans":         3.0,
    "followup_months": SCAN_DATES[-1],
}

print("=" * 60)
print("Patient 7 (MCI) — 082_S_0832")
print(f"Scans: {len(SCANS)}  |  Follow-up: {SCAN_DATES[-1]:.1f} months")
print("=" * 60)

t_pipeline_start = time.perf_counter()

all_bin   = []
all_glcm_times = []

for i, path in enumerate(SCANS):
    print(f"\n[Scan {i+1}/3] {Path(path).name}")

    # ── Preprocessing ────────────────────────────────────────
    t0 = time.perf_counter()
    print("  N4 bias correction...", flush=True)
    img_n4 = n4_correct(path)
    t_n4 = time.perf_counter() - t0

    t0 = time.perf_counter()
    print("  MNI registration...", flush=True)
    img_reg = register_to_mni(img_n4)
    t_reg = time.perf_counter() - t0

    t0 = time.perf_counter()
    print("  Hippocampus crop...", flush=True)
    crops = crop_hippocampus(img_reg)
    t_crop = time.perf_counter() - t0

    t0 = time.perf_counter()
    crops_q = quantize_crops(crops)      # downsample float32 → uint8 [0..31]
    t_quant = time.perf_counter() - t0

    t0 = time.perf_counter()
    bin_bytes = crops_to_bin_bytes(crops_q)
    t_serial = time.perf_counter() - t0

    all_bin.append(bin_bytes)
    print(f"  Preprocessing done — N4: {t_n4:.2f}s  Reg: {t_reg:.2f}s  "
          f"Crop: {t_crop*1000:.1f}ms  Downsample: {t_quant*1000:.1f}ms  Serialize: {t_serial*1000:.1f}ms")

    # ── GLCM (texture analysis — after downsampling to uint8) ─
    print("  GLCM texture analysis (on downsampled uint8 volume)...", flush=True)
    t_glcm_start = time.perf_counter()
    feats, names = extract_features(bin_bytes)
    t_glcm = time.perf_counter() - t_glcm_start
    all_glcm_times.append(t_glcm)

    print(f"  *** GLCM latency (post-downsample): {t_glcm*1000:.1f} ms  ({len(names)} features) ***")

# ── Inference ────────────────────────────────────────────────
print("\n[Cascade Inference]")
all_features  = []
feature_names = None
for b in all_bin:
    f, n = extract_features(b)
    all_features.append(f)
    feature_names = n

temporal_feats, temporal_names = compute_temporal_features(all_features, SCAN_DATES, feature_names)
scan_meta,  scan_meta_names  = build_metadata_array(PATIENT, prefix="")
temp_meta,  temp_meta_names  = build_metadata_array(PATIENT, prefix="meta_")

results = run_cascade(
    all_features[-1], feature_names,
    temporal_feats,   temporal_names,
    scan_meta,        scan_meta_names,
    temp_meta,        temp_meta_names,
)

t_total = time.perf_counter() - t_pipeline_start

# ── Summary ──────────────────────────────────────────────────
print("\n" + "=" * 60)
print("RESULTS")
print("=" * 60)
final = results["final"]
print(f"  Prediction  : {final['prediction']}")
print(f"  Confidence  : {final['confidence']*100:.1f}%")
if "conversion_risk" in final:
    print(f"  Conv. risk  : {final['conversion_risk']*100:.1f}%")
print(f"  Stopped at  : {final.get('cascade_stopped_at')}")

t1 = results.get("task1", {})
t3 = results.get("task3", {})
if t1:
    print(f"\n  Task1 (AD vs CN) probs : {t1['probabilities']}")
if t3:
    print(f"  Task3 (CN vs MCI) probs: {t3['probabilities']}")

print("\n" + "=" * 60)
print("TIMING")
print("=" * 60)
for i, gt in enumerate(all_glcm_times):
    print(f"  Scan {i+1} GLCM   : {gt*1000:7.1f} ms")
print(f"  Mean GLCM       : {sum(all_glcm_times)/len(all_glcm_times)*1000:7.1f} ms")
print(f"  Total GLCM      : {sum(all_glcm_times)*1000:7.1f} ms")
print(f"  Full pipeline   : {t_total:.2f} s")
print("=" * 60)
