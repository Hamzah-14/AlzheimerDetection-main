"""
threshold_calibration.py
========================
Finds the optimal classification threshold for Task 3 (CN vs MCI)
using out-of-fold probability estimates from the trained stacking ensemble.

Problem it solves
-----------------
The current 0.55 threshold was set manually. This script evaluates all
thresholds from 0.30 to 0.80 and finds the one that maximises each of:
  - Youden Index (sensitivity + specificity - 1)  → balanced
  - F1 score for MCI class                         → prioritise MCI recall
  - F1 macro                                       → balanced across classes

Outputs
-------
  - Console table of threshold vs metrics
  - threshold_calibration.png  (precision-recall + ROC curves)
  - Recommended threshold printed clearly at the end

Usage
-----
    python threshold_calibration.py
    python threshold_calibration.py --data path/to/scan_level_final.csv
    python threshold_calibration.py --prioritise mci_recall

Run from ThePipelineComplete/ with the venv active.
"""

import argparse
import os
import sys
import pickle
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import (
    roc_auc_score, f1_score, confusion_matrix,
    precision_recall_curve, roc_curve
)

warnings.filterwarnings("ignore")

# ── Config ────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent
MODEL_DIR  = BASE_DIR / "trained_models" / "task3"
DATA_PATHS = [
    BASE_DIR.parent / "scan_level_final.csv",
    BASE_DIR.parent / "Hippocampus_Crops" / "scan_level_final.csv",
    Path("scan_level_final.csv"),
]

ALWAYS_EXCLUDE = {
    "key", "scan_date", "class", "subject_id", "clinical_diagnosis",
    "mmse_score", "diagnosis_encoded",
}

N_SPLITS     = 5
THRESHOLD_RANGE = np.arange(0.30, 0.81, 0.01)

EPS = 1e-8

def reconstruct_features(df):
    """
    Align column names and reconstruct missing features to match
    the survived feature list the model was trained on.
    """
    # 1. Rename A_ → asym_diff_ (skip if target already exists to avoid duplicate columns)
    rename_map = {c: c.replace("A_", "asym_diff_", 1)
                  for c in df.columns if c.startswith("A_")
                  and c.replace("A_", "asym_diff_", 1) not in df.columns}
    df = df.rename(columns=rename_map)
    # Drop any residual A_* columns whose asym_diff_* counterpart already existed
    leftover_a = [c for c in df.columns if c.startswith("A_")]
    if leftover_a:
        df = df.drop(columns=leftover_a)

    # 2. Rename CSF columns
    csf_map = {
        "ABETA42":        "csf_ABETA42",
        "TAU":            "csf_TAU",
        "PTAU":           "csf_PTAU",
        "ptau_abeta42":   "csf_ptau_abeta42",
        "abeta40_abeta42":"csf_abeta40_abeta42",
    }
    df = df.rename(columns={k: v for k, v in csf_map.items() if k in df.columns})

    # 3. csf_ABETA40 not in data — add as NaN (imputer handles it)
    if "csf_ABETA40" not in df.columns:
        df["csf_ABETA40"] = np.nan

    # 4. Compute asym_ratio_* from L_ and R_ columns
    base_feats = [c.replace("L_", "", 1) for c in df.columns if c.startswith("L_")]
    for feat in base_feats:
        l_col = f"L_{feat}"
        r_col = f"R_{feat}"
        if l_col in df.columns and r_col in df.columns:
            L = df[l_col].values.astype(float)
            R = df[r_col].values.astype(float)
            df[f"asym_ratio_{feat}"] = (L - R) / (np.abs(L) + np.abs(R) + EPS)

    return df
# ── Loaders ───────────────────────────────────────────────────────────────────

def load_artifacts():
    print("Loading Task 3 artifacts...")
    arts = {}
    for name in ["imputer", "scaler", "label_encoder", "meta_learner"]:
        with open(MODEL_DIR / f"{name}.pkl", "rb") as f:
            arts[name] = pickle.load(f)

    base_models = {}
    for path in sorted(MODEL_DIR.glob("base_*.pkl")):
        key = path.stem.replace("base_", "")
        with open(path, "rb") as f:
            base_models[key] = pickle.load(f)
    arts["base_models"] = base_models

    with open(MODEL_DIR / "survived_features_scan_level.txt") as f:
        arts["feature_list"] = [l.strip() for l in f if l.strip()]

    print(f"  {len(base_models)} base models, {len(arts['feature_list'])} features")
    return arts


def load_data(data_path=None):
    paths = [Path(data_path)] + DATA_PATHS if data_path else DATA_PATHS
    for p in paths:
        if p.exists():
            print(f"Loading data from {p}")
            df = pd.read_csv(p)
            print(f"  {len(df)} rows, {len(df.columns)} columns")
            return df
    raise FileNotFoundError(
        "Data CSV not found. Pass --data path/to/glcm_metadata_fused.csv"
    )


# ── Feature alignment ─────────────────────────────────────────────────────────

def align_features(df, feature_list):
    """Select and order features to match what the model was trained on."""
    available = set(df.columns)
    missing   = [f for f in feature_list if f not in available]
    if missing:
        print(f"  Warning: {len(missing)} features missing from data, will be NaN")

    X = pd.DataFrame(index=df.index)
    for f in feature_list:
        if f not in df.columns:
            X[f] = np.nan
        else:
            col = df[f]
            # Guard against duplicate columns returning a DataFrame
            X[f] = col.iloc[:, 0] if isinstance(col, pd.DataFrame) else col
    return X


# ── Inference ─────────────────────────────────────────────────────────────────

LINEAR_MODELS = {"LogReg_L1", "SGD_log", "Ridge", "SVM_RBF", "ElasticNet"}

def predict_proba_stacking(X_raw, arts):
    """Run full stacking inference and return MCI probability."""
    X = arts["imputer"].transform(X_raw)

    # Base models — linear ones need scaling
    base_probas = []
    for name, model in arts["base_models"].items():
        if name in LINEAR_MODELS:
            Xs = arts["scaler"].transform(X)
            p  = model.predict_proba(Xs)
        else:
            p  = model.predict_proba(X)
        base_probas.append(p)

    base_stack  = np.concatenate(base_probas, axis=1)
    final_proba = arts["meta_learner"].predict_proba(base_stack)

    # MCI is class index 0 (["MCI", "NC"])
    classes = list(arts["label_encoder"].classes_)
    mci_idx = classes.index("MCI")
    return final_proba[:, mci_idx]


# ── Calibration ───────────────────────────────────────────────────────────────

def run_calibration(df, arts, n_splits=N_SPLITS):
    """
    StratifiedGroupKFold cross-validation to get out-of-fold MCI probabilities.
    Mirrors the training split strategy exactly.
    """
    # Reconstruct derived features (asym_ratio_*, asym_diff_*, csf_*) from raw columns
    df = reconstruct_features(df)

    # Filter to CN and MCI only
    target_col = "clinical_diagnosis" if "clinical_diagnosis" in df.columns else "class"
    mask = df[target_col].isin(["NC", "MCI"])
    df   = df[mask].copy()
    print(f"Task 3 subset: {len(df)} rows ({df[target_col].value_counts().to_dict()})")

    # Label encode: MCI=1, CN=0 (we want MCI probability)
    y = (df[target_col].isin(["MCI"])).astype(int).values
    groups = df["subject_id"].values if "subject_id" in df.columns else np.arange(len(df))

    X_df = align_features(df, arts["feature_list"])

    oof_proba  = np.zeros(len(df))
    oof_labels = y.copy()

    sgkf = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=42)

    for fold, (train_idx, val_idx) in enumerate(sgkf.split(X_df, y, groups)):
        print(f"  Fold {fold+1}/{n_splits}...")
        X_val = X_df.iloc[val_idx].values
        oof_proba[val_idx] = predict_proba_stacking(X_val, arts)

    return oof_proba, oof_labels


# ── Threshold sweep ───────────────────────────────────────────────────────────

def sweep_thresholds(proba, labels):
    results = []
    for t in THRESHOLD_RANGE:
        preds = (proba >= t).astype(int)

        tn, fp, fn, tp = confusion_matrix(labels, preds, labels=[0,1]).ravel()
        sensitivity = tp / (tp + fn + 1e-9)   # MCI recall
        specificity = tn / (tn + fp + 1e-9)   # NC recall
        youden      = sensitivity + specificity - 1
        f1_mci      = f1_score(labels, preds, pos_label=1, zero_division=0)
        f1_mac      = f1_score(labels, preds, average="macro", zero_division=0)
        ppv         = tp / (tp + fp + 1e-9)

        results.append({
            "threshold":   round(float(t), 2),
            "sensitivity": round(sensitivity, 4),
            "specificity": round(specificity, 4),
            "youden":      round(youden, 4),
            "f1_mci":      round(f1_mci, 4),
            "f1_macro":    round(f1_mac, 4),
            "ppv":         round(ppv, 4),
            "tp": int(tp), "fp": int(fp),
            "tn": int(tn), "fn": int(fn),
        })

    return pd.DataFrame(results)


def find_optimal(results_df):
    idx_youden = results_df["youden"].idxmax()
    idx_f1_mci = results_df["f1_mci"].idxmax()
    idx_f1_mac = results_df["f1_macro"].idxmax()

    return {
        "youden":   results_df.loc[idx_youden],
        "f1_mci":   results_df.loc[idx_f1_mci],
        "f1_macro": results_df.loc[idx_f1_mac],
    }


# ── Plotting ──────────────────────────────────────────────────────────────────

def plot_results(proba, labels, results_df, optimal, out_path="threshold_calibration.png"):
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    fig.patch.set_facecolor("#0a0a0a")
    for ax in axes:
        ax.set_facecolor("#111111")
        ax.tick_params(colors="white")
        ax.xaxis.label.set_color("white")
        ax.yaxis.label.set_color("white")
        ax.title.set_color("white")
        for spine in ax.spines.values():
            spine.set_edgecolor("#333333")

    # ── Plot 1: Threshold vs metrics ──
    ax = axes[0]
    ax.plot(results_df["threshold"], results_df["sensitivity"], color="#f87171", label="MCI Recall (sensitivity)")
    ax.plot(results_df["threshold"], results_df["specificity"], color="#67e8f9", label="NC Recall (specificity)")
    ax.plot(results_df["threshold"], results_df["youden"],      color="#a78bfa", label="Youden Index", linewidth=2)
    ax.plot(results_df["threshold"], results_df["f1_mci"],      color="#fbbf24", label="F1 MCI",       linestyle="--")
    ax.axvline(optimal["youden"]["threshold"],  color="#a78bfa", linestyle=":", alpha=0.7)
    ax.axvline(0.55, color="white", linestyle=":", alpha=0.4, label="Current (0.55)")
    ax.set_xlabel("Threshold")
    ax.set_ylabel("Score")
    ax.set_title("Threshold vs Metrics")
    ax.legend(fontsize=7, labelcolor="white", facecolor="#1a1a1a")
    ax.set_xlim(0.30, 0.80)

    # ── Plot 2: ROC curve ──
    ax = axes[1]
    fpr, tpr, roc_thresh = roc_curve(labels, proba)
    auc = roc_auc_score(labels, proba)
    ax.plot(fpr, tpr, color="#a78bfa", linewidth=2, label=f"AUC = {auc:.3f}")
    ax.plot([0,1],[0,1], color="#333333", linestyle="--")
    # Mark current and optimal thresholds
    for thresh, color, label in [
        (0.55,                              "white",   "Current 0.55"),
        (optimal["youden"]["threshold"],    "#fbbf24", "Optimal (Youden)"),
        (optimal["f1_mci"]["threshold"],    "#f87171", "Optimal (F1 MCI)"),
    ]:
        diffs = np.abs(roc_thresh - thresh)
        idx   = diffs.argmin()
        ax.scatter(fpr[idx], tpr[idx], color=color, zorder=5, s=60, label=label)
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title(f"ROC Curve (AUC={auc:.3f})")
    ax.legend(fontsize=7, labelcolor="white", facecolor="#1a1a1a")

    # ── Plot 3: Precision-Recall ──
    ax = axes[2]
    prec, rec, pr_thresh = precision_recall_curve(labels, proba)
    ax.plot(rec, prec, color="#34d399", linewidth=2)
    ax.set_xlabel("Recall (MCI sensitivity)")
    ax.set_ylabel("Precision (PPV)")
    ax.set_title("Precision-Recall Curve")
    # Mark thresholds
    for thresh, color, label in [
        (0.55,                           "white",   "Current 0.55"),
        (optimal["youden"]["threshold"], "#fbbf24", "Optimal (Youden)"),
    ]:
        diffs = np.abs(pr_thresh - thresh)
        idx   = diffs.argmin()
        ax.scatter(rec[idx], prec[idx], color=color, zorder=5, s=60, label=label)
    ax.legend(fontsize=7, labelcolor="white", facecolor="#1a1a1a")

    plt.tight_layout()
    plt.savefig(out_path, dpi=150, bbox_inches="tight", facecolor=fig.get_facecolor())
    print(f"\nPlot saved to {out_path}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data",        type=str, default=None, help="Path to scan_level_final.csv")
    parser.add_argument("--prioritise",  type=str, default="youden",
                        choices=["youden", "f1_mci", "f1_macro"],
                        help="Which metric to optimise for final recommendation")
    parser.add_argument("--folds",       type=int, default=N_SPLITS)
    args = parser.parse_args()

    print("\n" + "="*55)
    print("  Task 3 Threshold Calibration — CN vs MCI")
    print("="*55 + "\n")

    arts    = load_artifacts()
    df      = load_data(args.data)
    proba, labels = run_calibration(df, arts, n_splits=args.folds)

    auc = roc_auc_score(labels, proba)
    print(f"\nOut-of-fold AUC: {auc:.4f}")

    print("\nSweeping thresholds 0.30 → 0.80...")
    results_df = sweep_thresholds(proba, labels)
    optimal    = find_optimal(results_df)

    # ── Print table (every 0.05) ──
    print("\n" + "-"*75)
    print(f"{'Thresh':>7}  {'Sensitivity':>12}  {'Specificity':>12}  {'Youden':>7}  {'F1-MCI':>7}  {'F1-Mac':>7}")
    print("-"*75)
    for _, row in results_df[results_df["threshold"] % 0.05 < 0.005].iterrows():
        marker = " ◄" if abs(row["threshold"] - 0.55) < 0.005 else ""
        print(f"  {row['threshold']:.2f}    {row['sensitivity']:.4f}        {row['specificity']:.4f}     "
              f"{row['youden']:.4f}   {row['f1_mci']:.4f}   {row['f1_macro']:.4f}{marker}")
    print("-"*75)

    # ── Print optimal per metric ──
    print("\nOptimal thresholds:")
    for metric, row in optimal.items():
        print(f"  {metric:<10} → threshold={row['threshold']:.2f}  "
              f"sensitivity={row['sensitivity']:.3f}  specificity={row['specificity']:.3f}  "
              f"youden={row['youden']:.3f}  f1_mci={row['f1_mci']:.3f}")

    # ── Recommendation ──
    rec = optimal[args.prioritise]
    current_row = results_df[results_df["threshold"] == 0.55]
    if len(current_row):
        curr = current_row.iloc[0]
        delta_sens = rec["sensitivity"] - curr["sensitivity"]
        delta_spec = rec["specificity"] - curr["specificity"]
    else:
        delta_sens = delta_spec = 0.0

    print("\n" + "="*55)
    print(f"  RECOMMENDATION (optimising: {args.prioritise})")
    print("="*55)
    print(f"  Current threshold : 0.55")
    print(f"  Recommended       : {rec['threshold']:.2f}")
    print(f"  MCI sensitivity   : {rec['sensitivity']:.3f}  ({delta_sens:+.3f} vs current)")
    print(f"  NC specificity    : {rec['specificity']:.3f}  ({delta_spec:+.3f} vs current)")
    print(f"  Youden index      : {rec['youden']:.3f}")
    print(f"  F1 MCI            : {rec['f1_mci']:.3f}")
    print()
    print(f"  To apply: in inference.py, change")
    print(f"    MCI_THRESHOLD = 0.55")
    print(f"  to")
    print(f"    MCI_THRESHOLD = {rec['threshold']:.2f}")
    print("="*55 + "\n")

    plot_results(proba, labels, results_df, optimal)

if __name__ == "__main__":
    main()