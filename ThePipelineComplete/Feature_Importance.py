"""
extract_feature_importances.py
==============================
One-time script that loads all trained base models and extracts feature
importances, saving them to feature_importances.json in the trained_models
directory.

Run once from ThePipelineComplete/ with the venv active:
    python extract_feature_importances.py

Output: trained_models/feature_importances.json
    {
        "task1": {
            "top_features": [
                {"rank": 1, "feature": "age", "importance": 0.043, "model": "XGBoost"},
                ...
            ],
            "by_model": {
                "XGBoost": [{"feature": ..., "importance": ...}, ...],
                ...
            }
        },
        "task2": { ... },
        "task3": { ... }
    }

The server reads this file at startup and attaches top features to every
result payload — no recomputation needed per request.
"""

import json
import pickle
import glob
import os
import sys
import numpy as np
from pathlib import Path

BASE_DIR  = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "trained_models"
OUT_PATH  = MODEL_DIR / "feature_importances.json"

TASKS = {
    "task1": {"feature_file": "survived_features_scan_level.txt"},
    "task2": {"feature_file": "survived_features_subject_level.txt"},
    "task3": {"feature_file": "survived_features_scan_level.txt"},
}

TOP_N = 15  # top features to keep per model and per task

# Linear models — use abs(coef_) as importance proxy
LINEAR_MODELS = {"LogReg_L1", "SGD_log", "Ridge", "SVM_RBF", "ElasticNet"}


def extract_importances(model, model_name: str, feature_names: list) -> list:
    """
    Extract feature importances from a model.
    Returns list of (feature_name, importance) tuples, sorted descending.
    """
    n = len(feature_names)

    if hasattr(model, "feature_importances_"):
        fi = np.array(model.feature_importances_).ravel()
        if len(fi) != n:
            print(f"    Warning: {model_name} has {len(fi)} importances but {n} features")
            fi = fi[:n] if len(fi) > n else np.pad(fi, (0, n - len(fi)))
        return [(feature_names[i], float(fi[i])) for i in np.argsort(fi)[::-1]]

    elif hasattr(model, "coef_"):
        coef = np.array(model.coef_).ravel()
        if len(coef) != n:
            print(f"    Warning: {model_name} coef shape {coef.shape} vs {n} features")
            coef = coef[:n] if len(coef) > n else np.pad(coef, (0, n - len(coef)))
        fi = np.abs(coef)
        return [(feature_names[i], float(fi[i])) for i in np.argsort(fi)[::-1]]

    return []


def human_readable(feature_name: str) -> str:
    """Convert internal feature name to a readable label."""
    n = feature_name
    n = n.replace("asym_diff_", "Asymmetry Δ ")
    n = n.replace("asym_ratio_", "Asymmetry ")
    n = n.replace("csf_", "CSF ")
    n = n.replace("meta_", "")
    n = n.replace("temp_", "Temporal ")
    n = n.replace("baseline_", "Baseline ")
    n = n.replace("L_d1_", "L d=1 ").replace("L_d2_", "L d=2 ").replace("L_d4_", "L d=4 ")
    n = n.replace("R_d1_", "R d=1 ").replace("R_d2_", "R d=2 ").replace("R_d4_", "R d=4 ")
    n = n.replace("_dirStd_mean", " dirStd↓").replace("_dirStd_std", " dirStd↕")
    n = n.replace("_mean", " mean").replace("_std", " std")
    n = n.replace("apoe_e4_count", "APOE e4 count")
    n = n.replace("sex_encoded", "Sex")
    n = n.replace("race_White", "Race: White").replace("race_Black", "Race: Black")
    n = n.replace("race_Asian", "Race: Asian").replace("race_Hispanic", "Race: Hispanic")
    n = n.replace("followup_months", "Follow-up (months)")
    n = n.replace("n_scans", "N scans")
    n = n.replace("ABETA42", "Aβ42").replace("PTAU", "pTau").replace("TAU", "Tau")
    n = n.replace("ptau_abeta42", "pTau/Aβ42").replace("abeta40_abeta42", "Aβ40/Aβ42")
    return n.strip()


def main():
    print("\n" + "="*55)
    print("  Feature Importance Extraction")
    print("="*55 + "\n")

    output = {}

    for task_key, task_cfg in TASKS.items():
        task_dir     = MODEL_DIR / task_key
        feature_path = task_dir / task_cfg["feature_file"]

        if not feature_path.exists():
            print(f"[{task_key}] Feature list not found: {feature_path}")
            continue

        features = feature_path.read_text().splitlines()
        features = [f.strip() for f in features if f.strip()]
        print(f"[{task_key}] {len(features)} features")

        task_result = {"by_model": {}, "top_features": [], "consensus": []}
        all_scores  = {}  # feature → list of normalised importances across models

        # Load each base model
        for pkl_path in sorted(task_dir.glob("base_*.pkl")):
            model_name = pkl_path.stem.replace("base_", "")
            try:
                with open(pkl_path, "rb") as f:
                    model = pickle.load(f)
            except Exception as e:
                print(f"  [{task_key}] {model_name}: load error — {e}")
                continue

            pairs = extract_importances(model, model_name, features)
            if not pairs:
                print(f"  [{task_key}] {model_name}: no importances available")
                continue

            # Normalise to [0,1]
            vals  = np.array([v for _, v in pairs])
            vmax  = vals.max()
            if vmax > 0:
                norm  = vals / vmax
            else:
                norm  = vals

            top = [
                {
                    "feature":       feat,
                    "label":         human_readable(feat),
                    "importance":    round(float(imp), 6),
                    "importance_norm": round(float(norm[i]), 4),
                }
                for i, (feat, imp) in enumerate(pairs[:TOP_N])
            ]
            task_result["by_model"][model_name] = top
            print(f"  [{task_key}] {model_name}: top={pairs[0][0]} ({pairs[0][1]:.4f})")

            # Accumulate for consensus
            for i, (feat, _) in enumerate(pairs):
                if feat not in all_scores:
                    all_scores[feat] = []
                all_scores[feat].append(float(norm[i]))

        # Consensus: mean normalised importance across models
        if all_scores:
            consensus = sorted(
                [(f, np.mean(scores)) for f, scores in all_scores.items()],
                key=lambda x: -x[1]
            )
            task_result["consensus"] = [
                {
                    "rank":       i + 1,
                    "feature":    feat,
                    "label":      human_readable(feat),
                    "importance": round(float(imp), 4),
                }
                for i, (feat, imp) in enumerate(consensus[:TOP_N])
            ]
            print(f"  [{task_key}] Consensus top-3: "
                  f"{[x['feature'] for x in task_result['consensus'][:3]]}")

        # Top features = consensus top N for easy access
        task_result["top_features"] = task_result["consensus"][:TOP_N]
        output[task_key] = task_result

    # Save
    OUT_PATH.write_text(json.dumps(output, indent=2))
    print(f"\nSaved -> {OUT_PATH}")
    print(f"Tasks: {list(output.keys())}")

    # Quick sanity print
    for task_key, data in output.items():
        top = data.get("top_features", [])
        if top:
            print(f"\n  {task_key} top 5:")
            for item in top[:5]:
                print(f"    {item['rank']}. {item['label']:<40} {item['importance']:.4f}")


if __name__ == "__main__":
    main()