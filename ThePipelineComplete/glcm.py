#glcm.py
"""
glcm_extract_single_cpu.py
==========================
Pure-CPU implementation of the same single-scan GLCM feature extraction
logic used by the FPGA pipeline.

This version reproduces the FPGA flow as closely as possible:
    - input .bin contains [L volume][R volume]
    - each volume is 64x64x64 uint8 with values in [0..31]
    - process 8 local 32x32x32 sub-blocks
    - compute directed GLCMs for 13 directions and 3 distances
    - symmetrize on CPU during feature computation
    - aggregate into 84 features per side
    - output 252 features total:
        [84 L features | 84 R features | 84 asymmetry features]
"""
import numpy as np

# =============================================================================
# CONFIG
# =============================================================================

D = H = W = 64
VOXELS = D * H * W

LEVELS = 32
BINS = LEVELS * LEVELS
NDIR = 13
NDIST = 3

DIST_A = 1
DIST_B = 2
DIST_C = 4
DISTANCES = [DIST_A, DIST_B, DIST_C]

FEATURES = [
    "energy", "entropy", "contrast",
    "homogeneity", "correlation",
    "dissimilarity", "max_prob"
]

EPS = 1e-12

# 8 local 32^3 blocks over 64^3
BLOCKS = []
for bz in range(2):
    for by in range(2):
        for bx in range(2):
            z1, z2 = bz * 32, (bz + 1) * 32
            y1, y2 = by * 32, (by + 1) * 32
            x1, x2 = bx * 32, (bx + 1) * 32
            BLOCKS.append((z1, z2, y1, y2, x1, x2))

# Same 13 unique direction offsets used in HLS
OFF_DZ = np.array([0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1], dtype=np.int32)
OFF_DY = np.array([0, 1, 0, 1, 1, 0, 0, 1, -1, 1, 1, -1, -1], dtype=np.int32)
OFF_DX = np.array([1, 0, 0, 1, -1, 1, -1, 0, 0, 1, -1, 1, -1], dtype=np.int32)

I, J = np.meshgrid(
    np.arange(LEVELS), np.arange(LEVELS), indexing="ij"
)
DIFF = (I - J).astype(np.float64)
DIFF2 = DIFF * DIFF
ABS_DIFF = np.abs(DIFF)


# =============================================================================
# BIN LOADING
# =============================================================================
def _load_lr_from_bin(data):
    """
    Load L/R hippocampus volumes from either:
    - file path
    - raw bytes (in-memory .bin)
    """

    expected = 2 * VOXELS

    if isinstance(data, (bytes, bytearray)):
        arr = np.frombuffer(data, dtype=np.uint8)

    elif isinstance(data, str):
        arr = np.fromfile(data, dtype=np.uint8)

    else:
        raise TypeError("Input must be file path or bytes")

    if arr.size != expected:
        raise ValueError(
            f"Expected {expected} bytes, got {arr.size}"
        )

    x = arr.reshape(2, D, H, W)

    vmin = int(x.min())
    vmax = int(x.max())

    if vmin < 0 or vmax > 31:
        raise ValueError(
            f"Values out of range [0..31], got [{vmin}..{vmax}]"
        )

    return x[0], x[1]

# =============================================================================
# CPU GLCM (MIRRORS FPGA LOGIC)
# =============================================================================

def _compute_valid_overlap_ranges(size: int, delta: int):
    """
    Return source and destination slice bounds so that:
        src indices [s0:s1]
        dst indices [d0:d1] = src shifted by delta
    both remain within [0, size).

    Equivalent to the FPGA boundary checks.
    """
    if delta >= 0:
        s0 = 0
        s1 = size - delta
        d0 = delta
        d1 = size
    else:
        s0 = -delta
        s1 = size
        d0 = 0
        d1 = size + delta
    return s0, s1, d0, d1

def _glcm_hist_block_directed(block: np.ndarray, dz: int, dy: int, dx: int) -> np.ndarray:
    """
    Compute one directed GLCM histogram for a single block and one offset.

    This matches the FPGA logic:
        - directed counts H(i,j)
        - only pairs fully inside the local block
        - no symmetrization here
    """
    z_s0, z_s1, z_d0, z_d1 = _compute_valid_overlap_ranges(block.shape[0], dz)
    y_s0, y_s1, y_d0, y_d1 = _compute_valid_overlap_ranges(block.shape[1], dy)
    x_s0, x_s1, x_d0, x_d1 = _compute_valid_overlap_ranges(block.shape[2], dx)

    src = block[z_s0:z_s1, y_s0:y_s1, x_s0:x_s1]
    dst = block[z_d0:z_d1, y_d0:y_d1, x_d0:x_d1]

    if src.size == 0:
        return np.zeros((LEVELS, LEVELS), dtype=np.uint32)

    i_vals = src.ravel()
    j_vals = dst.ravel()

    # Equivalent to bin = i * LEVELS + j
    bins = (i_vals.astype(np.int32) * LEVELS + j_vals.astype(np.int32))
    hist_1d = np.bincount(bins, minlength=BINS)

    return hist_1d.reshape(LEVELS, LEVELS).astype(np.uint32, copy=False)

def _run_glcm_on_volume_cpu(vol_3d: np.ndarray) -> np.ndarray:
    """
    CPU equivalent of the FPGA block-local GLCM kernel.

    Returns:
        all_blocks : shape (8, 3, 13, 32, 32) uint32
                     [block, distance_select, direction, i, j]
    """
    if vol_3d.shape != (D, H, W):
        raise ValueError(f"Expected (64,64,64), got {vol_3d.shape}")

    if vol_3d.dtype != np.uint8:
        vol_3d = vol_3d.astype(np.uint8, copy=False)

    all_blocks = np.zeros((len(BLOCKS), NDIST, NDIR, LEVELS, LEVELS), dtype=np.uint32)

    for b, (z1, z2, y1, y2, x1, x2) in enumerate(BLOCKS):
        block = vol_3d[z1:z2, y1:y2, x1:x2]

        for dsel, dist in enumerate(DISTANCES):
            for dir_idx in range(NDIR):
                dz = int(OFF_DZ[dir_idx]) * dist
                dy = int(OFF_DY[dir_idx]) * dist
                dx = int(OFF_DX[dir_idx]) * dist

                all_blocks[b, dsel, dir_idx] = _glcm_hist_block_directed(
                    block, dz, dy, dx
                )

    return all_blocks


# =============================================================================
# FEATURE COMPUTATION (SAME AS ORIGINAL PS-SIDE LOGIC)
# =============================================================================

def _glcm_features_from_hist(H: np.ndarray) -> dict:
    """Compute 7 Haralick-style features from one GLCM matrix."""
    H = H.astype(np.float64, copy=False)
    Hs = H + H.T
    s = Hs.sum()

    if s <= 0:
        return {k: 0.0 for k in FEATURES}

    P = Hs / s
    px = P.sum(axis=1)
    py = P.sum(axis=0)

    idx = np.arange(LEVELS, dtype=np.float64)

    mux = (idx * px).sum()
    muy = (idx * py).sum()
    sigx = np.sqrt(((idx - mux) ** 2 * px).sum())
    sigy = np.sqrt(((idx - muy) ** 2 * py).sum())

    energy = float(np.sum(P * P))
    entropy = float(-np.sum(P * np.log(P + EPS)))
    contrast = float(np.sum(DIFF2 * P))
    homogeneity = float(np.sum(P / (1.0 + DIFF2)))
    dissimilarity = float(np.sum(ABS_DIFF * P))
    max_prob = float(P.max())

    if sigx >= EPS and sigy >= EPS:
        correlation = float(np.sum(((I - mux) * (J - muy) * P)) / (sigx * sigy + EPS))
    else:
        correlation = 0.0

    return {
        "energy": energy,
        "entropy": entropy,
        "contrast": contrast,
        "homogeneity": homogeneity,
        "correlation": correlation,
        "dissimilarity": dissimilarity,
        "max_prob": max_prob,
    }


def _aggregate_features(blocks_hist: np.ndarray) -> dict:
    """
    Aggregate GLCM histograms across blocks and directions.
    Returns dict of 84 scalar features:
        7 features × 4 stats × 3 distances
    """
    out = {}
    n_blocks = blocks_hist.shape[0]

    for dsel, dist in enumerate(DISTANCES):
        mean_per_block = {
            f: np.zeros(n_blocks, dtype=np.float64)
            for f in FEATURES
        }
        std_per_block = {
            f: np.zeros(n_blocks, dtype=np.float64)
            for f in FEATURES
        }

        for b in range(n_blocks):
            dir_vals = {
                f: np.zeros(NDIR, dtype=np.float64)
                for f in FEATURES
            }

            for dir_idx in range(NDIR):
                feats = _glcm_features_from_hist(blocks_hist[b, dsel, dir_idx])
                for f in FEATURES:
                    dir_vals[f][dir_idx] = feats[f]

            for f in FEATURES:
                mean_per_block[f][b] = dir_vals[f].mean()
                std_per_block[f][b] = dir_vals[f].std(ddof=0)

        for f in FEATURES:
            out[f"d{dist}_{f}_mean"] = float(mean_per_block[f].mean())
            out[f"d{dist}_{f}_std"] = float(mean_per_block[f].std(ddof=0))
            out[f"d{dist}_{f}_dirStd_mean"] = float(std_per_block[f].mean())
            out[f"d{dist}_{f}_dirStd_std"] = float(std_per_block[f].std(ddof=0))

    return out


def _build_feature_names() -> list:
    """
    Return the ordered list of feature names matching the returned array.

    Order:
        L features, R features, Asymmetry features
        (84 each = 252 total)
    """
    dummy = np.zeros((8, NDIST, NDIR, LEVELS, LEVELS), dtype=np.uint32)
    base_keys = sorted(_aggregate_features(dummy).keys())

    names = (
        [f"L_{k}" for k in base_keys] +
        [f"R_{k}" for k in base_keys] +
        [f"asym_diff_{k}" for k in base_keys]
    )
    return names


# =============================================================================
# PUBLIC API
# =============================================================================

def extract_features(bin_path: str) -> tuple[np.ndarray, list]:
    """
    Extract GLCM features from a single .bin scan file using CPU.

    Args:
        bin_path : path to .bin file containing [L volume][R volume]

    Returns:
        features      : np.ndarray shape (252,) float32
                        [84 L features | 84 R features | 84 asymmetry features]
        feature_names : list of 252 feature names
    """
    # Load volumes
    volL, volR = _load_lr_from_bin(bin_path)

    # Run CPU GLCM
    HL = _run_glcm_on_volume_cpu(volL)
    HR = _run_glcm_on_volume_cpu(volR)

    # Aggregate features
    featL_dict = _aggregate_features(HL)
    featR_dict = _aggregate_features(HR)

    base_keys = sorted(featL_dict.keys())

    L_arr = np.array([featL_dict[k] for k in base_keys], dtype=np.float32)
    R_arr = np.array([featR_dict[k] for k in base_keys], dtype=np.float32)

    # Match original asymmetry formula
    denom = (np.abs(L_arr) + np.abs(R_arr) + EPS).astype(np.float32)
    asym_arr = (L_arr - R_arr) / denom

    features = np.concatenate([L_arr, R_arr, asym_arr]).astype(np.float32, copy=False)

    feature_names = (
        [f"L_{k}" for k in base_keys] +
        [f"R_{k}" for k in base_keys] +
        [f"asym_diff_{k}" for k in base_keys]
    )

    return features, feature_names

from preprocessing import preprocess_to_bin
def glcm(path):
      feats, names = extract_features(preprocess_to_bin(path))
      return feats, names



   