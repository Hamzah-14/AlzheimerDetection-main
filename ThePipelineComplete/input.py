"""
patient_input_prototype.py
===========================
Simple command-line prototype for receiving patient metadata.
No UI — just print/input for testing the data collection flow.
 
Collects:
    - MRI scan file paths + dates (2 minimum)
    - Demographics: age, sex, education, race
    - APOE genotype (optional)
    - CSF biomarkers (optional)
 
Then prints a summary of what was collected and what
will be imputed (median) for missing optional fields.
"""
 
from datetime import datetime
 
 
# =============================================================================
# HELPERS
# =============================================================================
 
def separator(title=""):
    if title:
        print(f"\n{'─'*50}")
        print(f"  {title}")
        print(f"{'─'*50}")
    else:
        print(f"{'─'*50}")
 
 
def ask(prompt, required=True, dtype=float,
        options=None, allow_skip=False):
    """
    Generic input helper.
    - required: if True, keeps asking until valid input
    - dtype: float, int, or str
    - options: list of valid string choices
    - allow_skip: if True, empty input returns None
    """
    while True:
        raw = input(f"  {prompt} ").strip()
 
        # Handle optional skip
        if raw == "" and allow_skip:
            return None
 
        if raw == "" and required:
            print("    ⚠  This field is required. Please enter a value.")
            continue
 
        # Validate against options
        if options:
            if raw.upper() in [o.upper() for o in options]:
                return raw.upper()
            print(f"    ⚠  Please enter one of: {', '.join(options)}")
            continue
 
        # Type conversion
        if dtype in (float, int):
            try:
                val = dtype(raw)
                return val
            except ValueError:
                print(f"    ⚠  Please enter a valid number.")
                continue
 
        return raw  # str
 
 
def ask_date(prompt, required=True):
    """Ask for a date in YYYY-MM-DD format."""
    while True:
        raw = input(f"  {prompt} ").strip()
        if raw == "" and not required:
            return None
        try:
            dt = datetime.strptime(raw, "%Y-%m-%d")
            return dt
        except ValueError:
            print("    ⚠  Please use format YYYY-MM-DD "
                  "(e.g. 2023-06-15)")
 
 
# =============================================================================
# COLLECTION FUNCTIONS
# =============================================================================
 
def collect_scans():
    """Collect MRI scan file paths and dates. Minimum 2."""
    separator("MRI SCANS")
    print("  Accepted formats: .nii, .nii.gz")
    print("  Minimum 2 scans required.\n")
 
    scans = []
    scan_num = 1
 
    while True:
        required = scan_num <= 2
        label    = f"Scan {scan_num}"
 
        if scan_num > 2:
            add_more = input(
                f"\n  Add another scan? (y/n): ").strip().lower()
            if add_more != "y":
                break
 
        print(f"\n  [{label}]")
 
        path = ask(
            f"File path (.nii or .nii.gz):",
            required=required, dtype=str)
 
        if path is None:
            break
 
        date = ask_date(
            f"Scan date (YYYY-MM-DD):",
            required=required)
 
        scans.append({"scan_num": scan_num,
                      "path": path,
                      "date": date})
        print(f"    ✓  Scan {scan_num} recorded: "
              f"{path}  [{date.strftime('%Y-%m-%d')}]")
        scan_num += 1
 
    return scans
 
from pathlib import Path

from datetime import datetime

def scans_to_lists(scans):
    """
    Convert collect_scans() output into:
        scan_files : list[str]
        scan_dates : list[float] (months from first scan)

    Parameters
    ----------
    scans : list[dict]
        Output of collect_scans()

    Returns
    -------
    scan_files : list[str]
    scan_dates : list[float]
    """

    if len(scans) < 2:
        raise ValueError("At least 2 scans are required.")

    # Sort by scan date
    scans_sorted = sorted(scans, key=lambda s: s["date"])

    # First scan date
    t0 = scans_sorted[0]["date"]

    scan_files = []
    scan_dates = []

    for s in scans_sorted:
        scan_files.append(s["path"])

        # Convert timedelta to months
        delta_days = (s["date"] - t0).days
        months = delta_days / 30.44   # average days/month
        scan_dates.append(round(months, 2))

    return scan_files, scan_dates

def collect_demographics():
    """Collect required patient demographics."""
    separator("PATIENT DEMOGRAPHICS")
    print("  All fields in this section are required.\n")
 
    data = {}
 
    # Age
    data["age"] = ask(
        "Age (years):", dtype=float)
 
    # Sex
    data["sex"] = ask(
        "Sex (M/F):",
        dtype=str,
        options=["M","F"])
 
    # Education
    data["education"] = ask(
        "Years of education (e.g. 16):",
        dtype=float)
 
    # Race
    print("\n  Race options:")
    print("    1. White")
    print("    2. Black")
    print("    3. Asian")
    print("    4. Hispanic")
    print("    5. Other")
    race_map = {
        "1": "White", "2": "Black",
        "3": "Asian", "4": "Hispanic", "5": "Other"
    }
    while True:
        choice = input("  Enter number (1-5): ").strip()
        if choice in race_map:
            data["race"] = race_map[choice]
            break
        print("    ⚠  Please enter a number between 1 and 5.")
 
    return data
 
 
def collect_apoe():
    """Collect optional APOE genotype."""
    separator("APOE GENOTYPE  (Optional — press Enter to skip)")
    print("  If the patient's APOE genotype is not available,")
    print("  press Enter to skip. The model will use the")
    print("  population average for this field.\n")
 
    print("  APOE options:")
    options = ["e2/e2","e2/e3","e2/e4",
               "e3/e3","e3/e4","e4/e4"]
    for i, o in enumerate(options, 1):
        print(f"    {i}. {o}")
 
    apoe_map = {str(i): o for i, o in enumerate(options, 1)}
 
    while True:
        choice = input(
            "\n  Enter number (1-6) or press Enter to skip: "
        ).strip()
 
        if choice == "":
            print("  → APOE genotype skipped. "
                  "Will use population median.")
            return None
 
        if choice in apoe_map:
            selected = apoe_map[choice]
            # Convert to e4 count for model
            e4_count = selected.count("e4")
            print(f"  ✓  APOE: {selected}  "
                  f"(e4 count = {e4_count})")
            return {"genotype": selected,
                    "e4_count": e4_count}
 
        print("  ⚠  Please enter a number between 1 and 6, "
              "or press Enter to skip.")
 
 
def collect_csf():
    """Collect optional CSF biomarkers."""
    separator("CSF BIOMARKERS  (Optional — press Enter to skip each)")
    print("  CSF values significantly improve prediction accuracy.")
    print("  Enter any available values. "
          "Missing values will be imputed.\n")
 
    data = {}
    fields = [
        ("csf_ABETA42", "Abeta42 (pg/mL)",   "Normal > 1000"),
        ("csf_TAU",     "Total Tau (pg/mL)",  "Normal < 300"),
        ("csf_PTAU",    "pTau-181 (pg/mL)",   "Normal < 27"),
    ]
 
    any_entered = False
    for key, label, reference in fields:
        print(f"  {label}  [{reference}]")
        val = ask(
            f"  Value (or Enter to skip):",
            required=False,
            dtype=float,
            allow_skip=True)
 
        if val is not None:
            data[key] = val
            any_entered = True
            print(f"    ✓  {label}: {val}")
        else:
            data[key] = None
            print(f"    → Skipped. Will use population median.")
 
    if not any_entered:
        print("\n  No CSF values entered. "
              "Model will use population medians.")
 
    return data
 
 
# =============================================================================
# SUMMARY + VALIDATION
# =============================================================================
 
def compute_time_gaps(scans):
    """Compute months between consecutive scans."""
    gaps = []
    for i in range(1, len(scans)):
        delta = (scans[i]["date"] - scans[i-1]["date"]).days
        months = delta / 30.44
        gaps.append(months)
    return gaps
 
 
def print_summary(scans, demographics, apoe, csf):
    """Print full summary of collected data."""
    separator("INPUT SUMMARY")
 
    # Scans
    print(f"\n  MRI Scans: {len(scans)}")
    gaps = compute_time_gaps(scans)
    for s in scans:
        print(f"    Scan {s['scan_num']}: "
              f"{s['path']}  "
              f"[{s['date'].strftime('%Y-%m-%d')}]")
    if gaps:
        print(f"\n  Inter-scan intervals:")
        for i, g in enumerate(gaps):
            print(f"    Scan {i+1} → Scan {i+2}: "
                  f"{g:.1f} months")
        print(f"  Total follow-up: "
              f"{sum(gaps):.1f} months")
 
    # Demographics
    print(f"\n  Demographics:")
    print(f"    Age       : {demographics['age']:.0f} years")
    print(f"    Sex       : {demographics['sex']}")
    print(f"    Education : {demographics['education']:.0f} years")
    print(f"    Race      : {demographics['race']}")
 
    # APOE
    print(f"\n  APOE Genotype:")
    if apoe:
        print(f"    {apoe['genotype']}  "
              f"(e4 count = {apoe['e4_count']})")
    else:
        print(f"    Not provided → will impute")
 
    # CSF
    print(f"\n  CSF Biomarkers:")
    csf_labels = {
        "csf_ABETA42": "Abeta42",
        "csf_TAU":     "Total Tau",
        "csf_PTAU":    "pTau-181",
    }
    for key, label in csf_labels.items():
        val = csf.get(key)
        if val is not None:
            print(f"    {label:<12}: {val:.1f} pg/mL")
        else:
            print(f"    {label:<12}: Not provided → will impute")
 
    # Readiness check
    separator("READINESS CHECK")
    issues = []
 
    if len(scans) < 2:
        issues.append("❌  Minimum 2 MRI scans required")
 
    if gaps and min(gaps) < 3:
        issues.append("⚠   Some scans are less than 3 months apart "
                      "— slope estimate may be unreliable")
 
    if gaps and sum(gaps) < 6:
        issues.append("⚠   Total follow-up is less than 6 months "
                      "— prediction confidence will be lower")
 
    csf_count = sum(1 for k in csf_labels
                    if csf.get(k) is not None)
    if csf_count == 0:
        issues.append("ℹ   No CSF values provided — "
                      "prediction based on MRI + demographics only")
 
    if apoe is None:
        issues.append("ℹ   APOE genotype not provided — "
                      "will use population median")
 
    if issues:
        for issue in issues:
            print(f"  {issue}")
    else:
        print("  ✅  All inputs valid. Ready for prediction.")
 
    return len([i for i in issues if i.startswith("❌")]) == 0
 
 
def build_model_input(scans, demographics, apoe, csf):
    """
    Build the final dictionary that will be passed to the model.
    This maps collected data to the exact feature names the model expects.
    """
    gaps   = compute_time_gaps(scans)
    n      = len(scans)
 
    record = {
        # Demographics
        "age":            demographics["age"],
        "sex_encoded":    1.0 if demographics["sex"] == "M" else 0.0,
        "education":      demographics["education"],
 
        # Race one-hot
        "race_White":     1.0 if demographics["race"] == "White"    else 0.0,
        "race_Black":     1.0 if demographics["race"] == "Black"    else 0.0,
        "race_Asian":     1.0 if demographics["race"] == "Asian"    else 0.0,
        "race_Hispanic":  1.0 if demographics["race"] == "Hispanic" else 0.0,
        "race_Other":     1.0 if demographics["race"] == "Other"    else 0.0,
 
        # APOE
        "apoe_e4_count":  float(apoe["e4_count"]) if apoe else None,
 
        # CSF
        "csf_ABETA42":    csf.get("csf_ABETA42"),
        "csf_TAU":        csf.get("csf_TAU"),
        "csf_PTAU":       csf.get("csf_PTAU"),
 
        # Scan metadata
        "n_scans":           float(n),
        "followup_months":   float(sum(gaps)) if gaps else 0.0,
 
        # NOTE: GLCM texture features and temporal slope/delta
        # will be computed from the uploaded NIfTI files
        # by the FPGA extraction pipeline and added here
        # before passing to the model.
        "_scans_pending_glcm_extraction": [
            s["path"] for s in scans
        ],
        "_scan_dates": [
            s["date"].strftime("%Y-%m-%d") for s in scans
        ],
    }
 
    return record
 
 
# =============================================================================
# MAIN
# =============================================================================
from glcm import glcm
from data_fusion import compute_temporal_features, build_metadata_array
from inference import run_cascade

import numpy as np
def main():
    print("\n" + "="*50)
    print("  MCI Conversion Risk Assessment")
    print("  Patient Data Collection")
    print("="*50)
    print("\n  This tool collects patient data for prediction")
    print("  of MCI conversion risk from longitudinal MRI.")
    print("  Minimum 2 MRI scans required.\n")
 
    # Collect all inputs
    scans        = collect_scans()
    demographics = collect_demographics()
    apoe         = collect_apoe()
    csf          = collect_csf()


    # Summary and validation
    ready = print_summary(scans, demographics, apoe, csf)
 
    if ready:
        separator("NEXT STEP")
        model_input = build_model_input(
            scans, demographics, apoe, csf)
        
        #metadata, metadata_names = build_metadata_array(model_input)
        scan_metadata, scan_metadata_names = build_metadata_array(model_input, prefix="")
        temp_metadata, temp_metadata_names = build_metadata_array(model_input, prefix="meta_")

        scan_files, dates = scans_to_lists(scans)

        all_features = []
        for path in scan_files:          # use scan_files not scans
            feats, names = glcm(path)
            all_features.append(feats)

        temporal_feats, temporal_names = compute_temporal_features(all_features, dates, names)
    


        results = run_cascade(
            all_features[-1], names,        # most recent scan for task1/task3
            temporal_feats,   temporal_names,
            scan_metadata,    scan_metadata_names,
            temp_metadata,    temp_metadata_names
        )

        print(results["final"])
 
 
if __name__ == "__main__":
    main()