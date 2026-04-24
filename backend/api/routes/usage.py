"""
Two routers exported from this module:

  internal_router  — POST /report
    Registered at /internal/usage in main.py.
    Called by the Cloud Tasks worker to report actual consumption after a job
    completes.  Not JWT-protected; uses X-Internal-Secret header instead.

  billing_router   — GET /usage
    Registered at /api/v1/billing in main.py.
    Returns the current user's subscription state and monthly quota snapshot.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.monthly_usage import MonthlyUsage
from database.models.plan_config import PlanConfig
from database.models.subscription import Subscription
from database.models.user import User
from dependencies.feature_gate import get_active_subscription
from dependencies.quota_gate import increment_usage
from services.usage_service import get_or_create_monthly_usage, report_ocr_usage
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

# Loaded once at startup; injected via Secret Manager → env var in Cloud Run.
_INTERNAL_SECRET: str = os.getenv("INTERNAL_API_SECRET", "")

internal_router = APIRouter(tags=["internal"])
billing_router = APIRouter(tags=["billing"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UsageReportRequest(BaseModel):
    user_id: str
    job_id: str
    ocr_hours_actual: Optional[float] = None
    biomech_count_delta: Optional[int] = None


class QuotaSlot(BaseModel):
    used: float
    limit: float


class MonthlySnapshot(BaseModel):
    biomech: QuotaSlot
    ocr_hours: QuotaSlot
    submissions: QuotaSlot


class BillingUsageResponse(BaseModel):
    plan: str
    role: str
    expires_at: Optional[datetime]
    status: str
    current_month: MonthlySnapshot


# ---------------------------------------------------------------------------
# POST /internal/usage/report
# ---------------------------------------------------------------------------

@internal_router.post("/report", status_code=204)
def internal_usage_report(
    body: UsageReportRequest,
    x_internal_secret: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> None:
    """
    Called by the Cloud Tasks worker after a job completes.

    - ocr_hours_actual  → reconcile OCR hours (replaces the estimated reserve)
    - biomech_count_delta → increment biomechanics run counter

    Both fields are optional; omit whichever doesn't apply for the job type.
    Protected by X-Internal-Secret header — set INTERNAL_API_SECRET env var.
    """
    if not _INTERNAL_SECRET:
        logger.error(
            "INTERNAL_API_SECRET not configured — rejecting /internal/usage/report"
        )
        raise HTTPException(status_code=503, detail="Internal secret not configured")

    if x_internal_secret != _INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Invalid internal secret")

    if body.ocr_hours_actual is not None:
        if body.ocr_hours_actual < 0:
            raise HTTPException(
                status_code=422,
                detail="ocr_hours_actual must be >= 0",
            )
        report_ocr_usage(body.user_id, body.ocr_hours_actual, db)
        logger.info(
            "Usage reconciled — user=%s job=%s ocr_hours=%.4f",
            body.user_id,
            body.job_id,
            body.ocr_hours_actual,
        )

    if body.biomech_count_delta is not None:
        if body.biomech_count_delta < 0:
            raise HTTPException(
                status_code=422,
                detail="biomech_count_delta must be >= 0",
            )
        if body.biomech_count_delta > 0:
            import asyncio

            # increment_usage is async def but uses sync DB internally.
            # Run it in the current event loop if available, else sync fallback.
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # Inside an async context (uvicorn) — schedule as a coroutine.
                    # Since this endpoint is a sync def, use run_coroutine_threadsafe.
                    import concurrent.futures

                    future = asyncio.run_coroutine_threadsafe(
                        increment_usage(body.user_id, "biomech_count", body.biomech_count_delta, db),
                        loop,
                    )
                    future.result(timeout=10)
                else:
                    loop.run_until_complete(
                        increment_usage(body.user_id, "biomech_count", body.biomech_count_delta, db)
                    )
            except RuntimeError:
                asyncio.run(
                    increment_usage(body.user_id, "biomech_count", body.biomech_count_delta, db)
                )

            logger.info(
                "Biomech count incremented — user=%s job=%s delta=%d",
                body.user_id,
                body.job_id,
                body.biomech_count_delta,
            )


# ---------------------------------------------------------------------------
# GET /billing/usage
# ---------------------------------------------------------------------------

@billing_router.get("/usage", response_model=BillingUsageResponse)
def get_billing_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BillingUsageResponse:
    """
    Returns the authenticated user's current subscription state and monthly
    quota snapshot.  Creates a monthly_usage row if this is the user's first
    request this month.
    """
    # ── Subscription (lazy expiry handled inside get_active_subscription) ───
    sub: Optional[Subscription] = get_active_subscription(current_user, db)

    if sub is None:
        plan_key = "free"
        role = current_user.role or "free"
        expires_at = None
        status = "inactive"
    else:
        plan_key = sub.plan_key
        role = sub.role
        expires_at = sub.expires_at
        status = sub.status

    # ── Plan limits ─────────────────────────────────────────────────────────
    plan: Optional[PlanConfig] = (
        db.query(PlanConfig)
        .filter(PlanConfig.role == role)
        .first()
    )

    max_biomech: int = plan.max_biomech_per_month if plan else 0
    max_ocr: float = plan.max_ocr_hours_per_month if plan else 0.0
    max_submissions: int = plan.max_submissions_per_month if plan else 0

    # ── Monthly usage ────────────────────────────────────────────────────────
    usage: MonthlyUsage = get_or_create_monthly_usage(current_user.id, db)

    return BillingUsageResponse(
        plan=plan_key,
        role=role,
        expires_at=expires_at,
        status=status,
        current_month=MonthlySnapshot(
            biomech=QuotaSlot(used=usage.biomech_count, limit=max_biomech),
            ocr_hours=QuotaSlot(used=usage.ocr_hours_used, limit=max_ocr),
            submissions=QuotaSlot(used=usage.submission_count, limit=max_submissions),
        ),
    )
