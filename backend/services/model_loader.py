"""
Download ONNX model weights from GCS at runtime.

Environment variables
---------------------
GCS_MODEL_BUCKET    GCS bucket that holds the ONNX weight files.
                    If not set the bundled rapidocr-onnxruntime defaults are used.
OCR_DET_MODEL_BLOB  Blob path to the text-detection ONNX model inside the bucket.
                    Default: ocr_models/ch_PP-OCRv4_det_infer.onnx
OCR_REC_MODEL_BLOB  Blob path to the text-recognition ONNX model inside the bucket.
                    Default: ocr_models/en_PP-OCRv4_rec_infer.onnx
MODEL_CACHE_DIR     Local directory for downloaded weights (default: /tmp/models).
                    Already lives in RAM on Cloud Run's tmpfs.

Upload your ONNX weights once with:
    gsutil cp ch_PP-OCRv4_det_infer.onnx  gs://<bucket>/ocr_models/
    gsutil cp en_PP-OCRv4_rec_infer.onnx  gs://<bucket>/ocr_models/
"""

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_GCS_MODEL_BUCKET: str = os.getenv("GCS_MODEL_BUCKET", "")
_OCR_DET_BLOB: str = os.getenv("OCR_DET_MODEL_BLOB", "ocr_models/ch_PP-OCRv4_det_infer.onnx")
_OCR_REC_BLOB: str = os.getenv("OCR_REC_MODEL_BLOB", "ocr_models/en_PP-OCRv4_rec_infer.onnx")
_MODEL_CACHE_DIR: Path = Path(os.getenv("MODEL_CACHE_DIR", "/tmp/models"))

# Process-level cache — download happens at most once per container instance.
_cached: tuple[str | None, str | None] | None = None


def _download_blob(bucket, blob_name: str, dest: Path) -> None:
    """Stream a GCS blob to *dest*; skips when the file is already cached."""
    if dest.exists():
        logger.debug("Model cache hit — skipping download: %s", dest.name)
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    logger.info(
        "Downloading ONNX model  gs://%s/%s  →  %s",
        _GCS_MODEL_BUCKET, blob_name, dest,
    )
    bucket.blob(blob_name).download_to_filename(str(dest))
    logger.info(
        "Model ready  %s  (%.1f MB)",
        dest.name,
        dest.stat().st_size / (1024 * 1024),
    )


def get_ocr_model_paths() -> tuple[str | None, str | None]:
    """
    Return *(det_model_path, rec_model_path)* for RapidOCR.

    On the first call the models are downloaded from GCS and cached on the local
    filesystem (*/tmp/models/* by default).  Subsequent calls within the same
    process return the cached paths immediately.

    When *GCS_MODEL_BUCKET* is not set both values are *None*, signalling
    RapidOCR to fall back to its bundled default ONNX weights.
    """
    global _cached
    if _cached is not None:
        return _cached

    if not _GCS_MODEL_BUCKET:
        logger.info(
            "GCS_MODEL_BUCKET not configured — RapidOCR will use bundled default weights"
        )
        _cached = (None, None)
        return _cached

    try:
        from google.cloud import storage as gcs  # already in requirements.txt

        bucket = gcs.Client().bucket(_GCS_MODEL_BUCKET)

        det_dest = _MODEL_CACHE_DIR / Path(_OCR_DET_BLOB).name
        rec_dest = _MODEL_CACHE_DIR / Path(_OCR_REC_BLOB).name

        _download_blob(bucket, _OCR_DET_BLOB, det_dest)
        _download_blob(bucket, _OCR_REC_BLOB, rec_dest)

        _cached = (str(det_dest), str(rec_dest))
        logger.info("OCR models ready — det=%s  rec=%s", det_dest.name, rec_dest.name)

    except Exception as exc:
        logger.warning(
            "GCS model download failed (%s) — falling back to bundled RapidOCR weights", exc
        )
        _cached = (None, None)

    return _cached
