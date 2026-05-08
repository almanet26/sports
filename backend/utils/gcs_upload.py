"""
Centralised GCS upload helper with per-type size limits.
All file uploads in the app should go through upload_file_to_gcs() or upload_bytes_to_gcs().
"""

import os
import secrets
import logging
from pathlib import Path
from fastapi import HTTPException, UploadFile, status

logger = logging.getLogger(__name__)

GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "")

# Size limits
LIMIT_PROFILE_IMAGE = 1 * 1024 * 1024    # 1 MB
LIMIT_VIDEO         = 10 * 1024 * 1024   # 10 MB
LIMIT_DOCUMENT      = 10 * 1024 * 1024   # 10 MB
LIMIT_THUMBNAIL     = 2 * 1024 * 1024    # 2 MB

_LIMIT_LABELS = {
    LIMIT_PROFILE_IMAGE: "1 MB",
    LIMIT_VIDEO:         "10 MB",
    LIMIT_DOCUMENT:      "10 MB",
    LIMIT_THUMBNAIL:     "2 MB",
}


def _get_gcs_bucket():
    if not GCS_BUCKET_NAME:
        return None
    try:
        from google.cloud import storage as gcs_lib
        client = gcs_lib.Client()
        return client.bucket(GCS_BUCKET_NAME)
    except Exception as e:
        logger.warning("GCS client init failed: %s", e)
        return None


def upload_bytes_to_gcs(
    content: bytes,
    folder: str,
    filename_ext: str,
    content_type: str = "application/octet-stream",
) -> str:
    """
    Upload raw bytes to GCS (or local fallback).
    Returns the public URL (GCS) or static path (local).
    No size/extension validation — caller is responsible.
    """
    unique_filename = f"{secrets.token_urlsafe(16)}{filename_ext}"
    blob_path = f"{folder}/{unique_filename}"

    bucket = _get_gcs_bucket()
    if bucket is not None:
        try:
            blob = bucket.blob(blob_path)
            blob.upload_from_string(content, content_type=content_type)
            url = f"https://storage.googleapis.com/{GCS_BUCKET_NAME}/{blob_path}"
            logger.info("Uploaded to GCS: %s", url)
            return url
        except Exception as e:
            logger.error("GCS upload failed for %s: %s", blob_path, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file to cloud storage.",
            )

    # Local fallback (dev only)
    local_dir = Path(f"storage/{folder}")
    local_dir.mkdir(parents=True, exist_ok=True)
    (local_dir / unique_filename).write_bytes(content)
    logger.info("Saved locally (no GCS): storage/%s/%s", folder, unique_filename)
    return f"/static/{folder}/{unique_filename}"


async def upload_file_to_gcs(
    file: UploadFile,
    folder: str,
    max_bytes: int,
    allowed_extensions: set[str],
) -> str:
    """
    Read, validate, and upload a file to GCS (or local fallback).
    Returns the public URL (GCS) or static path (local).
    Raises HTTPException on validation failure.
    """
    ext = Path(file.filename or "").suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{ext}'. Allowed: {', '.join(sorted(allowed_extensions))}",
        )

    content = await file.read()
    limit_label = _LIMIT_LABELS.get(max_bytes, f"{max_bytes // (1024*1024)} MB")
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {limit_label}.",
        )

    return upload_bytes_to_gcs(
        content=content,
        folder=folder,
        filename_ext=ext,
        content_type=file.content_type or "application/octet-stream",
    )
