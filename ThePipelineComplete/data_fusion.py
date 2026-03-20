#data_fusion.py
from scipy import stats
import numpy as np

def compute_temporal_features(all_features, scan_dates, feature_names):
    """
    all_features : list of (252,) arrays, one per scan
    scan_dates   : list of floats, months from first scan
    feature_names: list of 252 feature name strings

    Returns:
        temporal_features : 1D numpy array
        temporal_names    : list of feature name strings
    """
    stack      = np.stack(all_features)   # shape (n_scans, 252)
    times      = np.array(scan_dates, dtype=np.float64)
    n_scans    = stack.shape[0]

    temporal_values = []
    temporal_names  = []

    for i, name in enumerate(feature_names):
        values = stack[:, i]   # this feature across all scans

        baseline = values[0]
        delta    = values[-1] - values[0]
        mean     = float(np.mean(values))
        std      = float(np.std(values, ddof=0))

        # slope and r2
        if n_scans >= 3:
            slope, _, r, _, _ = stats.linregress(times, values)
            slope = float(slope)
            r2    = float(r ** 2)
        else:
            # 2 scans: approximate slope as delta / time gap
            dt    = times[-1] - times[0]
            slope = float(delta / (dt + 1e-8))
            r2    = float('nan')   # not meaningful for 2 points

        temporal_values.extend([baseline, delta, slope, r2, mean, std])
        temporal_names.extend([
            f"baseline_{name}",
            f"temp_{name}_delta",
            f"temp_{name}_slope",
            f"temp_{name}_r2",
            f"temp_{name}_mean",
            f"temp_{name}_std",
        ])

    return np.array(temporal_values, dtype=np.float32), temporal_names



def build_metadata_array(patient_data, prefix=""):
    is_subject_level = prefix == "meta_"
    
    csf_prefix = "csf_baseline_csf_" if is_subject_level else "csf_"

    metadata = {
        f"{prefix}age"                 : patient_data["age"],
        f"{prefix}sex_encoded"         : patient_data["sex_encoded"],
        f"{prefix}education"           : patient_data["education"],
        f"{prefix}apoe_e4_count"       : patient_data["apoe_e4_count"],
        f"{prefix}race_White"          : patient_data["race_White"],
        f"{prefix}race_Black"          : patient_data["race_Black"],
        f"{prefix}race_Asian"          : patient_data["race_Asian"],
        f"{prefix}race_Hispanic"       : patient_data["race_Hispanic"],
        f"{prefix}race_Other"          : patient_data["race_Other"],
        f"{csf_prefix}ABETA42"         : patient_data.get("csf_ABETA42"),
        f"{csf_prefix}TAU"             : patient_data.get("csf_TAU"),
        f"{csf_prefix}PTAU"            : patient_data.get("csf_PTAU"),
        # PTAU/ABETA42 ratio — strong AD biomarker; computed when both are present.
        f"{csf_prefix}ptau_abeta42"    : patient_data.get("csf_ptau_abeta42"),
        "n_scans"                      : patient_data["n_scans"],
        "followup_months"              : patient_data["followup_months"],
    }
    values = []
    names  = []
    for k, v in metadata.items():
        values.append(float(v) if v is not None else float('nan'))
        names.append(k)
    return np.array(values, dtype=np.float32), names