"""
patient_lookup.py
=================
Quick lookup tool for testing the inference pipeline.

Given a patient ID (e.g. 002_S_4270), reads scan_level_final.csv
and prints all clinically relevant metadata — demographics, biomarkers,
genotype, diagnosis — in a clean format ready to copy into the web UI.

Excludes GLCM, asymmetry, and other imaging features.

Usage
-----
    python patient_lookup.py
    python patient_lookup.py --id 002_S_4270
    python patient_lookup.py --csv path/to/scan_level_final.csv --id 002_S_4270
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# ── Default CSV location ──────────────────────────────────────────────────────
DEFAULT_CSV = Path(__file__).resolve().parent.parent / "scan_level_final.csv"

# ── Columns to display ────────────────────────────────────────────────────────
META_COLS = [
    # Identity
    "key", "subject_id", "scan_date",
    # Diagnosis
    "class", "clinical_diagnosis", "diagnosis_date", "diagnosis_gap_days",
    # Demographics
    "age", "sex", "education", "race",
    # APOE
    "apoe_genotype", "apoe_e4_count",
    # CSF biomarkers
    "csf_ABETA42", "csf_ABETA40", "csf_TAU", "csf_PTAU",
    "csf_ptau_abeta42", "csf_abeta40_abeta42", "csf_gap_days",
    # Cognitive scores
    "mmse_score", "mmse_gap_days",
    "moca_moca_total", "moca_moca_memory", "moca_moca_executive",
    "moca_moca_language", "moca_moca_attention", "moca_moca_visuospatial",
    "moca_moca_naming", "moca_moca_orientation", "moca_gap_days",
    # Coverage flags
    "has_csf", "has_moca",
]

# ── Human-readable labels ─────────────────────────────────────────────────────
LABELS = {
    "key":                    "Scan key",
    "subject_id":             "Subject ID",
    "scan_date":              "Scan date",
    "class":                  "Dataset class (training label)",
    "clinical_diagnosis":     "Clinical diagnosis (per visit)",
    "diagnosis_date":         "Diagnosis date",
    "diagnosis_gap_days":     "Diagnosis → scan gap (days)",
    "age":                    "Age (years)",
    "sex":                    "Sex",
    "education":              "Education (years)",
    "race":                   "Race",
    "apoe_genotype":          "APOE genotype",
    "apoe_e4_count":          "APOE e4 copies",
    "csf_ABETA42":            "CSF Aβ42 (pg/mL)  [normal >1000]",
    "csf_ABETA40":            "CSF Aβ40 (pg/mL)",
    "csf_TAU":                "CSF Total Tau (pg/mL)  [normal <300]",
    "csf_PTAU":               "CSF pTau-181 (pg/mL)  [normal <27]",
    "csf_ptau_abeta42":       "pTau/Aβ42 ratio  [higher → AD risk]",
    "csf_abeta40_abeta42":    "Aβ40/Aβ42 ratio",
    "csf_gap_days":           "CSF → scan gap (days)",
    "mmse_score":             "MMSE score  [normal 24-30]",
    "mmse_gap_days":          "MMSE → scan gap (days)",
    "moca_moca_total":        "MoCA total  [normal ≥26]",
    "moca_moca_memory":       "MoCA memory",
    "moca_moca_executive":    "MoCA executive",
    "moca_moca_language":     "MoCA language",
    "moca_moca_attention":    "MoCA attention",
    "moca_moca_visuospatial": "MoCA visuospatial",
    "moca_moca_naming":       "MoCA naming",
    "moca_moca_orientation":  "MoCA orientation",
    "moca_gap_days":          "MoCA → scan gap (days)",
    "has_csf":                "CSF available",
    "has_moca":               "MoCA available",
}

# ── Sections for display grouping ─────────────────────────────────────────────
SECTIONS = {
    "Identity & Diagnosis": [
        "key", "subject_id", "scan_date",
        "class", "clinical_diagnosis",
        "diagnosis_date", "diagnosis_gap_days",
    ],
    "Demographics": [
        "age", "sex", "education", "race",
        "apoe_genotype", "apoe_e4_count",
    ],
    "CSF Biomarkers": [
        "csf_ABETA42", "csf_ABETA40",
        "csf_TAU", "csf_PTAU",
        "csf_ptau_abeta42", "csf_abeta40_abeta42",
        "csf_gap_days",
    ],
    "Cognitive Scores": [
        "mmse_score", "mmse_gap_days",
        "moca_moca_total", "moca_moca_memory", "moca_moca_executive",
        "moca_moca_language", "moca_moca_attention",
        "moca_moca_visuospatial", "moca_moca_naming",
        "moca_moca_orientation", "moca_gap_days",
    ],
    "Coverage Flags": ["has_csf", "has_moca"],
}

# ── UI input summary (what to type into the web form) ─────────────────────────
UI_FIELDS = [
    "age", "sex", "education", "race",
    "apoe_genotype",
    "csf_ABETA42", "csf_TAU", "csf_PTAU",
]


def fmt_val(col: str, val) -> str:
    if pd.isna(val):
        return "— (not available)"
    if isinstance(val, float):
        if val == int(val):
            return str(int(val))
        return f"{val:.4g}"
    return str(val)


def print_scan(row: pd.Series, scan_num: int, total: int):
    print(f"\n  {'─'*52}")
    print(f"  Scan {scan_num}/{total}")
    print(f"  {'─'*52}")

    for section, cols in SECTIONS.items():
        has_data = any(
            col in row.index and not pd.isna(row[col])
            for col in cols
        )
        if not has_data:
            continue

        print(f"\n  ┌─ {section}")
        for col in cols:
            if col not in row.index:
                continue
            val = row[col]
            label = LABELS.get(col, col)
            print(f"  │  {label:<45} {fmt_val(col, val)}")
        print(f"  └{'─'*52}")


def print_ui_summary(scans: pd.DataFrame):
    """Print what to type into the web UI form."""
    # Use most recent scan for demographics (stable across scans)
    latest = scans.iloc[-1]

    print(f"\n  {'═'*52}")
    print(f"  WEB UI INPUT — copy these values")
    print(f"  {'═'*52}")

    age   = fmt_val("age",   latest.get("age",   np.nan))
    sex   = fmt_val("sex",   latest.get("sex",   np.nan))
    edu   = fmt_val("education", latest.get("education", np.nan))
    race  = fmt_val("race",  latest.get("race",  np.nan))
    apoe  = fmt_val("apoe_genotype", latest.get("apoe_genotype", np.nan))

    print(f"\n  Demographics:")
    print(f"    Age         : {age}")
    print(f"    Sex         : {sex}")
    print(f"    Education   : {edu} years")
    print(f"    Race        : {race}")
    print(f"    APOE        : {apoe}")

    print(f"\n  Scan dates (for upload page):")
    for i, (_, row) in enumerate(scans.iterrows(), 1):
        sd = fmt_val("scan_date", row.get("scan_date", np.nan))
        # Format YYYYMMDD → YYYY-MM-DD if needed
        if sd.isdigit() and len(sd) == 8:
            sd = f"{sd[:4]}-{sd[4:6]}-{sd[6:]}"
        diag = fmt_val("clinical_diagnosis", row.get("clinical_diagnosis", np.nan))
        print(f"    Scan {i}: {sd}  [{diag}]")

    print(f"\n  CSF Biomarkers (leave blank if —):")
    # Find scan with CSF data closest to last scan
    csf_scan = scans[scans["has_csf"] == 1.0] if "has_csf" in scans.columns else pd.DataFrame()
    src = csf_scan.iloc[-1] if len(csf_scan) else latest

    for col, label, unit in [
        ("csf_ABETA42", "Abeta42", "pg/mL"),
        ("csf_TAU",     "Total Tau", "pg/mL"),
        ("csf_PTAU",    "pTau-181",  "pg/mL"),
    ]:
        val = fmt_val(col, src.get(col, np.nan))
        print(f"    {label:<12}: {val}  {unit if val != '— (not available)' else ''}")

    print(f"\n  Ground truth (not entered in UI, for validation):")
    classes = scans["class"].unique() if "class" in scans.columns else []
    diags   = scans["clinical_diagnosis"].unique() if "clinical_diagnosis" in scans.columns else []
    print(f"    Dataset class    : {', '.join(str(c) for c in classes)}")
    print(f"    Clinical diagnoses: {', '.join(str(d) for d in diags)}")
    print(f"  {'═'*52}\n")


def lookup(csv_path: Path, patient_id: str):
    print(f"\n  Loading: {csv_path}")
    df = pd.read_csv(csv_path, low_memory=False)

    # Extract subject_id from key if subject_id column missing
    if "subject_id" not in df.columns:
        df["subject_id"] = df["key"].apply(
            lambda k: "_".join(str(k).split("_")[:3])
        )

    # Filter to this patient
    mask  = df["subject_id"].astype(str).str.strip() == patient_id.strip()
    scans = df[mask].copy()

    if len(scans) == 0:
        # Try partial match
        partial = df[df["subject_id"].astype(str).str.contains(
            patient_id.strip(), na=False)]
        if len(partial) == 0:
            print(f"\n  ✗ No scans found for patient: {patient_id}")
            print(f"    Total subjects in CSV: {df['subject_id'].nunique()}")
            print(f"    Sample IDs: {df['subject_id'].unique()[:5].tolist()}")
            return

        print(f"\n  Partial matches found:")
        for pid in partial["subject_id"].unique():
            print(f"    {pid}")
        print(f"\n  Use exact ID above with --id flag")
        return

    # Sort by scan date
    if "scan_date" in scans.columns:
        scans = scans.sort_values("scan_date").reset_index(drop=True)

    print(f"\n  {'═'*52}")
    print(f"  Patient: {patient_id}")
    print(f"  Scans found: {len(scans)}")
    print(f"  {'═'*52}")

    # Print each scan
    for i, (_, row) in enumerate(scans.iterrows(), 1):
        print_scan(row, i, len(scans))

    # Print UI summary
    print_ui_summary(scans)


def main():
    parser = argparse.ArgumentParser(
        description="Look up patient metadata from scan_level_final.csv"
    )
    parser.add_argument(
        "--csv", type=Path, default=DEFAULT_CSV,
        help="Path to scan_level_final.csv"
    )
    parser.add_argument(
        "--id", type=str, default=None,
        help="Patient ID e.g. 002_S_4270"
    )
    args = parser.parse_args()

    if not args.csv.exists():
        # Try searching common locations
        candidates = [
            Path("scan_level_final.csv"),
            Path("enriched/scan_level_final.csv"),
            Path("../scan_level_final.csv"),
        ]
        found = next((p for p in candidates if p.exists()), None)
        if found:
            args.csv = found
        else:
            print(f"\n  ✗ CSV not found at: {args.csv}")
            print(f"    Pass the path with: --csv path/to/scan_level_final.csv")
            sys.exit(1)

    patient_id = args.id
    if not patient_id:
        patient_id = input("\n  Enter patient ID (e.g. 002_S_4270): ").strip()

    if not patient_id:
        print("  No patient ID provided.")
        sys.exit(1)

    lookup(args.csv, patient_id)


if __name__ == "__main__":
    main()