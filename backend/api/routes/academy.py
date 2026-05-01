"""
Academy Branding — Academy+

POST /academy/branding    upload / overwrite branding config (logo, colors, footer)
GET  /academy/branding    fetch current branding config
"""

from __future__ import annotations

import base64
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.academy_branding import AcademyBranding
from database.models.user import User
from dependencies.feature_gate import require_feature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/academy", tags=["academy"])

_GCS_BUCKET: str = os.getenv("GCS_BUCKET_NAME", "")

_gcs = None


def _get_gcs():
    global _gcs
    if _gcs is not None:
        return _gcs
    if not _GCS_BUCKET:
        return None
    try:
        from services.gcs_storage_service import GCSStorageManager
        _gcs = GCSStorageManager(_GCS_BUCKET)
    except Exception as exc:
        logger.warning("Academy GCS init failed: %s", exc)
    return _gcs


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class BrandingUpload(BaseModel):
    logo_base64: Optional[str] = None   # base64-encoded PNG/JPG
    primary_color: str = "#1a73e8"
    report_footer_text: Optional[str] = None


class BrandingResponse(BaseModel):
    academy_id: str
    logo_gcs_path: Optional[str]
    logo_signed_url: Optional[str]
    primary_color: str
    report_footer_text: Optional[str]

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _upload_logo(academy_id: str, logo_base64: str) -> str:
    """Decode base64 logo, upload to GCS, return blob path."""
    try:
        logo_bytes = base64.b64decode(logo_base64)
    except Exception:
        raise HTTPException(status_code=422, detail="logo_base64 is not valid base64")

    blob_name = f"branding/{academy_id}/logo.png"
    gcs = _get_gcs()
    if gcs is None:
        # Dev fallback: store locally under storage/branding/
        local_dir = f"storage/branding/{academy_id}"
        os.makedirs(local_dir, exist_ok=True)
        local_path = f"{local_dir}/logo.png"
        with open(local_path, "wb") as f:
            f.write(logo_bytes)
        logger.info("Academy logo stored locally at %s (GCS not configured)", local_path)
        return local_path

    bucket = gcs.bucket
    blob = bucket.blob(blob_name)
    blob.upload_from_string(logo_bytes, content_type="image/png")
    logger.info("Academy logo uploaded to gs://%s/%s", _GCS_BUCKET, blob_name)
    return f"gs://{_GCS_BUCKET}/{blob_name}"


def _sign_logo(gcs_path: Optional[str]) -> Optional[str]:
    if not gcs_path:
        return None
    if gcs_path.startswith("/") or not gcs_path.startswith("gs://"):
        return gcs_path  # local dev path
    gcs = _get_gcs()
    if gcs is None:
        return gcs_path
    # Extract blob name from gs://bucket/blob
    after = gcs_path[5:]
    slash = after.find("/")
    blob_name = after[slash + 1:] if slash != -1 else after
    try:
        return gcs.get_signed_url(blob_name, expiration_minutes=60)
    except Exception as exc:
        logger.warning("Could not sign logo URL: %s", exc)
        return gcs_path


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/branding", response_model=BrandingResponse, status_code=200)
def upsert_branding(
    body: BrandingUpload,
    current_user: User = Depends(require_feature("white_label_reports")),
    db: Session = Depends(get_db),
) -> BrandingResponse:
    branding = db.query(AcademyBranding).filter(AcademyBranding.academy_id == current_user.id).first()

    logo_path: Optional[str] = branding.logo_gcs_path if branding else None

    if body.logo_base64:
        logo_path = _upload_logo(current_user.id, body.logo_base64)

    if branding is None:
        branding = AcademyBranding(
            academy_id=current_user.id,
            logo_gcs_path=logo_path,
            primary_color=body.primary_color,
            report_footer_text=body.report_footer_text,
        )
        db.add(branding)
    else:
        if logo_path is not None:
            branding.logo_gcs_path = logo_path
        branding.primary_color = body.primary_color
        if body.report_footer_text is not None:
            branding.report_footer_text = body.report_footer_text

    db.commit()
    db.refresh(branding)
    logger.info("Academy %s updated branding", current_user.id)

    return BrandingResponse(
        academy_id=branding.academy_id,
        logo_gcs_path=branding.logo_gcs_path,
        logo_signed_url=_sign_logo(branding.logo_gcs_path),
        primary_color=branding.primary_color,
        report_footer_text=branding.report_footer_text,
    )


@router.get("/branding", response_model=BrandingResponse)
def get_branding(
    current_user: User = Depends(require_feature("white_label_reports")),
    db: Session = Depends(get_db),
) -> BrandingResponse:
    branding = db.query(AcademyBranding).filter(AcademyBranding.academy_id == current_user.id).first()
    if not branding:
        raise HTTPException(status_code=404, detail="No branding configured yet")

    return BrandingResponse(
        academy_id=branding.academy_id,
        logo_gcs_path=branding.logo_gcs_path,
        logo_signed_url=_sign_logo(branding.logo_gcs_path),
        primary_color=branding.primary_color,
        report_footer_text=branding.report_footer_text,
    )