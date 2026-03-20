#inference.py
import pickle
import numpy as np

# =============================================================================
# TASK DEFINITIONS
# =============================================================================

TASKS = {
    "task1": {
        "name"       : "AD vs CN",
        "model_dir"  : "ThePipelineComplete/trained_models/task1",
        "needs_temporal": False,   # scan-level
    },
    "task3": {
        "name"       : "CN vs MCI",
        "model_dir"  : "ThePipelineComplete/trained_models/task3",
        "needs_temporal": False,   # scan-level
    },
    "task2": {
        "name"       : "Stable vs Converting MCI",
        "model_dir"  : "ThePipelineComplete/trained_models/task2",
        "needs_temporal": True,    # subject-level
    },
}

AD_THRESHOLD  = 0.65
MCI_THRESHOLD = 0.51

# =============================================================================
# MODEL LOADER
# =============================================================================

def load_task_artifacts(task_key):
    task      = TASKS[task_key]
    model_dir = task["model_dir"]

    # task1 and task3 are scan-level, task2 is subject-level.
    # Each task reads its OWN feature list from its own model_dir.
    if task_key in ("task1", "task3"):
        feature_list_path = f"{model_dir}/survived_features_scan_level.txt"
    else:
        feature_list_path = f"{model_dir}/survived_features_subject_level.txt"

    with open(feature_list_path, "r") as f:
        feature_list = [l.strip() for l in f if l.strip()]

    with open(f"{model_dir}/imputer.pkl",       "rb") as f:
        imputer = pickle.load(f)

    with open(f"{model_dir}/scaler.pkl",        "rb") as f:
        scaler = pickle.load(f)

    with open(f"{model_dir}/label_encoder.pkl", "rb") as f:
        label_encoder = pickle.load(f)

    # Load base models + meta learner
    import os, glob
    base_models = {}
    for path in glob.glob(f"{model_dir}/base_*.pkl"):
        name = os.path.basename(path).replace(".pkl","").replace("base_","")
        with open(path, "rb") as f:
            base_models[name] = pickle.load(f)

    with open(f"{model_dir}/meta_learner.pkl", "rb") as f:
        meta_learner = pickle.load(f)

    return {
        "feature_list" : feature_list,
        "imputer"      : imputer,
        "scaler"       : scaler,
        "label_encoder": label_encoder,
        "base_models"  : base_models,
        "meta_learner" : meta_learner,
    }


# =============================================================================
# INFERENCE
# =============================================================================

def run_inference(full_features, full_names, artifacts):
    """
    Align, impute, scale, and run stacking ensemble.
    Returns predicted label and probability dict.
    """
    # Align
    lookup  = dict(zip(full_names, full_features))
    aligned = [lookup.get(f, float('nan'))
               for f in artifacts["feature_list"]]
    X = np.array(aligned, dtype=np.float32).reshape(1, -1)

    # Impute + scale
    X = artifacts["imputer"].transform(X)
    X = artifacts["scaler"].transform(X)

    # Base model predictions
    base_probas = np.concatenate([
        m.predict_proba(X)
        for m in artifacts["base_models"].values()
    ], axis=1)

    # Meta learner
    final_proba  = artifacts["meta_learner"].predict_proba(base_probas)[0]
    final_label  = artifacts["label_encoder"].inverse_transform(
        [np.argmax(final_proba)])[0]

    classes      = artifacts["label_encoder"].classes_
    proba_dict   = dict(zip(classes, final_proba))

    return final_label, proba_dict


# =============================================================================
# CASCADED PIPELINE
# =============================================================================

def run_cascade(scan_features,
                scan_names,
                temporal_features,
                temporal_names,
                scan_metadata,        # no meta_ prefix → task1 and task3
                scan_metadata_names,
                temp_metadata,        # meta_ prefix → task2
                temp_metadata_names):

    results = {}

    # scan + scan_metadata → task1 and task3
    scan_full       = np.concatenate([scan_features, scan_metadata])
    scan_full_names = scan_names + scan_metadata_names

    # temporal + temp_metadata → task2
    temp_full       = np.concatenate([temporal_features, temp_metadata])
    temp_full_names = temporal_names + temp_metadata_names

    # ── Step 1: AD vs CN ──────────────────────────────
    print("\n── Step 1: AD vs CN ─────────────────────")
    art1          = load_task_artifacts("task1")
    label1, prob1 = run_inference(scan_full, scan_full_names, art1)
    results["task1"] = {"label": label1, "probabilities": prob1}

    ad_prob = prob1.get("AD", 0.0)
    print(f"  AD probability : {ad_prob:.1%}")

    if ad_prob >= AD_THRESHOLD:
        print(f"  → AD likely. Stopping cascade.")
        results["final"] = {
            "prediction"         : "Alzheimer's Disease likely",
            "confidence"         : ad_prob,
            "cascade_stopped_at" : "task1"
        }
        return results

    # ── Step 2: CN vs MCI ─────────────────────────────
    print("\n── Step 2: CN vs MCI ────────────────────")
    art3          = load_task_artifacts("task3")
    label3, prob3 = run_inference(scan_full, scan_full_names, art3)
    results["task3"] = {"label": label3, "probabilities": prob3}

    mci_prob = prob3.get("MCI", 0.0)
    print(f"  MCI probability: {mci_prob:.1%}")

    if mci_prob < MCI_THRESHOLD:
        print(f"  → Cognitively Normal likely. Stopping cascade.")
        results["final"] = {
            "prediction"         : "Cognitively Normal",
            "confidence"         : 1 - mci_prob,
            "cascade_stopped_at" : "task3"
        }
        return results

    # ── Step 3: Stable vs Converting MCI ──────────────
    print("\n── Step 3: Stable vs Converting MCI ────")
    art2          = load_task_artifacts("task2")
    label2, prob2 = run_inference(temp_full, temp_full_names, art2)
    results["task2"] = {"label": label2, "probabilities": prob2}

    conv_prob = prob2.get("converting_MCI", 0.0)
    print(f"  Conversion risk: {conv_prob:.1%}")

    results["final"] = {
        "prediction"         : "MCI detected",
        "conversion_risk"    : conv_prob,
        "mci_status"         : label2,
        "confidence"         : conv_prob if label2 == "converting_MCI"
                               else 1 - conv_prob,
        "cascade_stopped_at" : "task2"
    }

    return results