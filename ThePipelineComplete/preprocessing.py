#preprocessing.py
"""
n4_correction.py
================
Single-scan N4 bias field correction for inference pipeline.
Returns a corrected ANTsImage in memory — nothing is written to disk.
"""

import ants


# N4 parameters (keep in sync with training pipeline)
N4_SHRINK_FACTOR      = 3
N4_N_ITERATIONS       = [50, 50, 50, 50]
N4_CONVERGENCE_THRESH = 0.0001


def n4_correct(nifti_path: str) -> ants.ANTsImage:
    """
    Applies N4 bias field correction to a single NIfTI scan.

    Parameters
    ----------
    nifti_path : str
        Absolute or relative path to the input .nii / .nii.gz file.

    Returns
    -------
    ants.ANTsImage
        Bias-corrected image in memory. Nothing is written to disk.

    Raises
    ------
    FileNotFoundError
        If nifti_path does not exist.
    RuntimeError
        If ANTs fails to correct the image.
    """
    img  = ants.image_read(nifti_path)
    mask = ants.get_mask(img)

    img_n4 = ants.n4_bias_field_correction(
        img,
        mask              = mask,
        shrink_factor     = N4_SHRINK_FACTOR,
        convergence       = {
            "iters" : N4_N_ITERATIONS,
            "tol"   : N4_CONVERGENCE_THRESH,
        },
        return_bias_field = False,
        verbose           = False,
    )

    return img_n4


"""
mni_registration.py
===================
Single-scan MNI152 registration for inference pipeline.
Takes an ANTsImage (output of n4_correct), returns a registered
ANTsImage in memory — nothing is written to disk.
"""

import ants

# Registration parameters (keep in sync with training pipeline)
TEMPLATE_PATH  = "ThePipelineComplete/MNI_Template/MNI152_T1_1mm.nii.gz"
TRANSFORM_TYPE = "antsRegistrationSyNQuick[a]"
INTERPOLATOR   = "linear"


def register_to_mni(img_n4: ants.ANTsImage) -> ants.ANTsImage:
    """
    Registers a single N4-corrected scan to the MNI152 1mm template.

    Parameters
    ----------
    img_n4 : ants.ANTsImage
        Output of n4_correct(). Must be in native space.

    Returns
    -------
    ants.ANTsImage
        MNI-registered image in memory. Nothing is written to disk.

    Raises
    ------
    RuntimeError
        If ANTs registration fails.
    """
    fixed = ants.image_read(TEMPLATE_PATH)

    reg = ants.registration(
        fixed             = fixed,
        moving            = img_n4,
        type_of_transform = TRANSFORM_TYPE,
        verbose           = False,
    )

    warped = ants.apply_transforms(
        fixed         = fixed,
        moving        = img_n4,
        transformlist = reg["fwdtransforms"],
        interpolator  = INTERPOLATOR,
    )

    return warped



"""
atlas_cropping.py
=================
Single-scan hippocampus ROI cropping for inference pipeline.
Takes an ANTsImage (output of register_to_mni), returns a
(2, 64, 64, 64) float32 numpy array in memory — nothing written to disk.

  Channel 0 = Left hippocampus
  Channel 1 = Right hippocampus
"""

import ants
import nibabel as nib
import numpy as np
from nilearn import datasets

# ─────────────────────────────────────────────
# CONFIGURATION (keep in sync with training pipeline)
# ─────────────────────────────────────────────
CUBE_SIZE = 64
HALF      = CUBE_SIZE // 2


def _ras_to_lps(mm_ras):
    x, y, z = mm_ras
    return (-x, -y, z)


def _is_in_bounds(center, vol_shape):
    cx, cy, cz = map(int, center)
    sx, sy, sz = vol_shape
    return (HALF <= cx < sx - HALF and
            HALF <= cy < sy - HALF and
            HALF <= cz < sz - HALF)


def _crop_cube(vol, center):
    cx, cy, cz = map(int, center)
    return vol[
        cx - HALF : cx + HALF,
        cy - HALF : cy + HALF,
        cz - HALF : cz + HALF
    ].copy()


def _load_atlas_centroids():
    """
    Loads Harvard-Oxford atlas and computes left/right hippocampus
    centroids in LPS mm (ANTs convention). Isolated so the caller
    can cache the result across requests if needed.
    """
    ho          = datasets.fetch_atlas_harvard_oxford("sub-maxprob-thr25-2mm")
    atlas_img   = ho.maps
    atlas_data  = atlas_img.get_fdata().astype(np.int16)
    labels      = ho.labels

    left_label  = next(i for i, n in enumerate(labels) if "left hippocampus"  in str(n).lower())
    right_label = next(i for i, n in enumerate(labels) if "right hippocampus" in str(n).lower())

    left_vox    = np.argwhere(atlas_data == left_label).mean(axis=0)
    right_vox   = np.argwhere(atlas_data == right_label).mean(axis=0)

    left_lps    = _ras_to_lps(nib.affines.apply_affine(atlas_img.affine, left_vox))
    right_lps   = _ras_to_lps(nib.affines.apply_affine(atlas_img.affine, right_vox))

    return left_lps, right_lps


def crop_hippocampus(img_registered: ants.ANTsImage) -> np.ndarray:
    """
    Crops left and right hippocampus ROIs from an MNI-registered scan.

    Parameters
    ----------
    img_registered : ants.ANTsImage
        Output of register_to_mni(). Must be in MNI152 space.

    Returns
    -------
    np.ndarray
        Shape (2, 64, 64, 64), dtype float32.
        Channel 0 = left hippocampus, Channel 1 = right hippocampus.

    Raises
    ------
    ValueError
        If either hippocampus centroid falls outside the volume bounds,
        or if the resulting crop shape is not (64, 64, 64).
    """
    left_lps, right_lps = _load_atlas_centroids()

    vol           = img_registered.numpy()
    left_center   = ants.transform_physical_point_to_index(img_registered, left_lps)
    right_center  = ants.transform_physical_point_to_index(img_registered, right_lps)

    for label, center in [("left", left_center), ("right", right_center)]:
        if not _is_in_bounds(center, vol.shape):
            raise ValueError(
                f"{label} hippocampus centroid {center} is out of bounds "
                f"for volume shape {vol.shape}. Registration may have failed."
            )

    left_crop  = _crop_cube(vol, left_center)
    right_crop = _crop_cube(vol, right_center)

    if left_crop.shape != (CUBE_SIZE, CUBE_SIZE, CUBE_SIZE) or \
       right_crop.shape != (CUBE_SIZE, CUBE_SIZE, CUBE_SIZE):
        raise ValueError(
            f"Unexpected crop shape: L={left_crop.shape} R={right_crop.shape}"
        )

    return np.stack([left_crop, right_crop], axis=0).astype(np.float32)



"""
quantize_crops.py
=================
Single-scan hippocampus crop quantization for inference pipeline.
Takes a (2, 64, 64, 64) float32 numpy array (output of crop_hippocampus),
returns a (2, 64, 64, 64) uint8 numpy array in memory — nothing written to disk.

Quantization policy (locked — must match training pipeline):
  - Per-channel p1/p99 percentile clipping (non-zero voxels only)
  - Fixed 32 levels → uint8 values 0-31
"""

import numpy as np

# Quantization policy — DO NOT CHANGE without retraining
LEVELS       = 32
P_LOW        = 1.0
P_HIGH       = 99.0
IGNORE_ZEROS = True
MIN_NZ       = 5000
EPS_RANGE    = 1e-6


def _quantize_channel(vol: np.ndarray) -> np.ndarray:
    """
    Quantizes a single (64, 64, 64) float32 channel to uint8 (0-31).

    Raises
    ------
    ValueError
        If the channel is too sparse (< MIN_NZ non-zero voxels) or has
        insufficient intensity range — both indicate a bad crop that
        should not be passed to the model.
    """
    v  = vol.astype(np.float32)
    nz = v[v > 0] if IGNORE_ZEROS else v.ravel()

    if nz.size < MIN_NZ:
        raise ValueError(
            f"Channel too sparse: only {nz.size} non-zero voxels "
            f"(minimum {MIN_NZ}). Crop or registration likely failed."
        )

    lo = float(np.percentile(nz, P_LOW))
    hi = float(np.percentile(nz, P_HIGH))

    if (hi - lo) <= EPS_RANGE:
        raise ValueError(
            f"Channel intensity range too low: [{lo:.4f}, {hi:.4f}]. "
            f"Scan may be empty or corrupted."
        )

    v_clip = np.clip(v, lo, hi)
    v_norm = (v_clip - lo) / (hi - lo)
    q      = np.floor(v_norm * (LEVELS - 1)).astype(np.uint8)

    if IGNORE_ZEROS:
        q[v <= 0] = 0

    return np.clip(q, 0, LEVELS - 1).astype(np.uint8)


def quantize_crops(crops: np.ndarray) -> np.ndarray:
    """
    Quantizes left and right hippocampus crops to uint8 (0-31).

    Parameters
    ----------
    crops : np.ndarray
        Shape (2, 64, 64, 64), dtype float32.
        Output of crop_hippocampus().
        Channel 0 = left hippocampus, Channel 1 = right hippocampus.

    Returns
    -------
    np.ndarray
        Shape (2, 64, 64, 64), dtype uint8, values in [0, 31].

    Raises
    ------
    ValueError
        If input shape is wrong, or if either channel fails quantization
        (too sparse or flat intensity). Both indicate upstream failure.
    """
    if crops.ndim != 4 or crops.shape != (2, 64, 64, 64):
        raise ValueError(
            f"Expected shape (2, 64, 64, 64), got {crops.shape}."
        )

    q0 = _quantize_channel(crops[0])
    q1 = _quantize_channel(crops[1])

    return np.stack([q0, q1], axis=0)

def crops_to_bin_bytes(crops_quantized: np.ndarray) -> bytes:
    """
    Converts quantized crops to raw .bin byte format in memory.

    Input
    -----
    crops_quantized : np.ndarray
        Shape (2, 64, 64, 64), dtype uint8

    Output
    ------
    bytes
        Raw byte stream identical to a saved .bin file:
        [all L voxels][all R voxels]
    """

    if crops_quantized.shape != (2, 64, 64, 64):
        raise ValueError("Expected shape (2,64,64,64)")

    if crops_quantized.dtype != np.uint8:
        raise ValueError("Expected dtype uint8")

    return crops_quantized.reshape(-1).tobytes()

def preprocess_to_bin(nifti_path):

    img_n4         = n4_correct(nifti_path)
    img_registered = register_to_mni(img_n4)

    crops          = crop_hippocampus(img_registered)
    crops_quantized = quantize_crops(crops)

    bin_bytes = crops_to_bin_bytes(crops_quantized)

    return bin_bytes


