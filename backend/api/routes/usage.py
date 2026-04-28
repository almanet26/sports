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
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
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
from utils.auth import get_current_user, verify_access_token

_optional_bearer = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)

# Loaded once at startup; injected via Secret Manager → env var in Cloud Run.
_INTERNAL_SECRET: str = os.getenv("INTERNAL_API_SECRET", "")

internal_router = APIRouter(tags=["internal"])
billing_router = APIRouter(tags=["billing"])

# Plan key → subscription role mapping (single source of truth for billing)
_PLAN_KEY_TO_ROLE: dict[str, str] = {
    "free":               "free",
    "coach_free":         "coach_free",
    "basic_90d":          "basic",
    "basic":              "basic",
    "platinum_180d":      "platinum",
    "platinum":           "platinum",
    "coach_starter_180d": "coach_starter",
    "coach_starter":      "coach_starter",
    "coach_pro_365d":     "coach_pro",
    "coach_pro":          "coach_pro",
    "academy_365d":       "academy",
    "academy":            "academy",
}
_PLAYER_ROLES = frozenset({"free", "basic", "platinum"})
_COACH_ROLES  = frozenset({"coach_free", "coach_starter", "coach_pro", "academy"})


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateOrderRequest(BaseModel):
    plan_key: str


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
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
    db: Session = Depends(get_db),
) -> None:
    """
    Called by the Cloud Tasks worker after a job completes.

    Auth options (either is sufficient):
      1. X-Internal-Secret header matching INTERNAL_API_SECRET env var.
      2. Bearer JWT with role == "ADMIN".

    Protected by X-Internal-Secret header — set INTERNAL_API_SECRET env var.
    """
    # Allow admin JWT as an alternative to the internal secret
    if credentials is not None:
        try:
            payload = verify_access_token(credentials.credentials)
            if payload.get("role") == "ADMIN":
                pass  # authenticated as admin — proceed
            else:
                raise HTTPException(status_code=403, detail="Only ADMIN may call this endpoint via JWT")
        except HTTPException:
            raise
        except Exception:
            pass  # fall through to secret check
    elif x_internal_secret:
        if not _INTERNAL_SECRET:
            logger.error(
                "INTERNAL_API_SECRET not configured — rejecting /internal/usage/report"
            )
            raise HTTPException(status_code=503, detail="Internal secret not configured")
        if x_internal_secret != _INTERNAL_SECRET:
            raise HTTPException(status_code=401, detail="Invalid internal secret")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

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
# POST /billing/create-order
# ---------------------------------------------------------------------------

@billing_router.post("/create-order")
def create_billing_order(
    body: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """
    Validates account-type eligibility before creating a Razorpay order.

    Players   → may only purchase: free, basic, platinum
    Coaches   → may only purchase: coach_free, coach_starter, coach_pro, academy
    """
    tier = _PLAN_KEY_TO_ROLE.get(body.plan_key)
    if tier is None:
        raise HTTPException(status_code=422, detail=f"Unknown plan key: {body.plan_key!r}")

    account_type = current_user.role  # PLAYER | COACH | ADMIN

    if account_type == "ADMIN":
        raise HTTPException(status_code=403, detail="Admins do not require a subscription")

    if account_type == "PLAYER" and tier in _COACH_ROLES:
        raise HTTPException(
            status_code=403,
            detail="This plan is not available for player accounts",
        )

    if account_type == "COACH" and tier in _PLAYER_ROLES:
        raise HTTPException(
            status_code=403,
            detail="This plan is not available for coach accounts",
        )

    # Phase 9: create Razorpay order here and return order_id / amount / key_id.
    raise HTTPException(status_code=501, detail="Payment integration not yet available")


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
        if current_user.role == "COACH":
            plan_key = "coach_free"
            role = "coach_free"
        elif current_user.role == "ADMIN":
            plan_key = "academy_365d"
            role = "academy"
        else:
            plan_key = "free"
            role = "free"
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
