"""
Shared GCS upload helper.
All file uploads (videos, PDFs, photos, documents) go through here.
"""
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "")

_bucket = None
try:
    if GCS_BUCKET_NAME:
        from google.cloud import storage as _gcs
        _bucket = _gcs.Client().bucket(GCS_BUCKET_NAME)
        logger.info("GCS helper ready — bucket '%s'", GCS_BUCKET_NAME)
except Exception as _e:
    logger.warning("GCS helper init failed: %s", _e)


def upload_to_gcs(local_path: Path, blob_name: str, content_type: str = "application/octet-stream") -> str | None:
    """
    Upload a local file to GCS and return its public HTTPS URL.
    Returns None if GCS is not configured — caller falls back to local /static/ URL.
    """
    if _bucket is None:
        return None
    try:
        blob = _bucket.blob(blob_name)
        blob.upload_from_filename(str(local_path), content_type=content_type)
        url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{blob_name}"
        logger.info("Uploaded to GCS: %s", url)
        return url
    except Exception as exc:
        logger.warning("GCS upload failed for %s: %s", blob_name, exc)
        return None


def upload_bytes_to_gcs(data: bytes, blob_name: str, content_type: str = "application/octet-stream") -> str | None:
    """Upload raw bytes to GCS. Returns public URL or None."""
    if _bucket is None:
        return None
    try:
        blob = _bucket.blob(blob_name)
        blob.upload_from_string(data, content_type=content_type)
        url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{blob_name}"
        logger.info("Uploaded bytes to GCS: %s", url)
        return url
    except Exception as exc:
        logger.warning("GCS bytes upload failed for %s: %s", blob_name, exc)
        return None


def gcs_available() -> bool:
    return _bucket is not None
