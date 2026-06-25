"""
Two routers exported from this module:
  - internal_router  — POST /report 
  Registered at /internal/usage in main.py.  Called by the Cloud Tasks workerto report actual consumption after a job completes.  Auth viaX-Internal-Secret header (or ADMIN JWT).

  - billing_router   — POST /create-order, POST /verify-payment, GET /usage
    Registered at /api/v1/billing in main.py.  User-facing billing + the entitlement/quota snapshot consumed by the frontend.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.plan import Plan
from database.models.subscription import Subscription
from database.models.user import User
from dependencies.feature_gate import get_active_subscription
from dependencies.quota_gate import increment_usage
from services import entitlement_service
from services.usage_service import get_monthly_usage_map, report_ocr_usage
from utils.auth import get_current_user, verify_access_token

_optional_bearer = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)

_INTERNAL_SECRET: str = os.getenv("INTERNAL_API_SECRET", "")

internal_router = APIRouter(tags=["internal"])
billing_router = APIRouter(tags=["billing"])

# Account type → plan user_type.
_ACCOUNT_TO_USER_TYPE = {"PLAYER": "player", "COACH": "coach"}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CreateOrderRequest(BaseModel):
    plan_key: str


class VerifyPaymentRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str
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
    entitlements: dict
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

    Auth (either is sufficient):
      1. X-Internal-Secret header matching INTERNAL_API_SECRET env var.
      2. Bearer JWT with role == "ADMIN".
    """
    if credentials is not None:
        try:
            payload = verify_access_token(credentials.credentials)
            if payload.get("role") != "ADMIN":
                raise HTTPException(status_code=403, detail="Only ADMIN may call this endpoint via JWT")
        except HTTPException:
            raise
        except Exception:
            pass  # fall through to secret check
    elif x_internal_secret:
        if not _INTERNAL_SECRET:
            logger.error("INTERNAL_API_SECRET not configured — rejecting /internal/usage/report")
            raise HTTPException(status_code=503, detail="Internal secret not configured")
        if x_internal_secret != _INTERNAL_SECRET:
            raise HTTPException(status_code=401, detail="Invalid internal secret")
    else:
        raise HTTPException(status_code=401, detail="Authentication required")

    if body.ocr_hours_actual is not None:
        if body.ocr_hours_actual < 0:
            raise HTTPException(status_code=422, detail="ocr_hours_actual must be >= 0")
        report_ocr_usage(body.user_id, body.ocr_hours_actual, db)
        logger.info(
            "Usage reconciled — user=%s job=%s ocr_hours=%.4f",
            body.user_id, body.job_id, body.ocr_hours_actual,
        )

    if body.biomech_count_delta is not None:
        if body.biomech_count_delta < 0:
            raise HTTPException(status_code=422, detail="biomech_count_delta must be >= 0")
        if body.biomech_count_delta > 0:
            import asyncio

            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
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
                body.user_id, body.job_id, body.biomech_count_delta,
            )


# ---------------------------------------------------------------------------
# POST /billing/create-order
# ---------------------------------------------------------------------------

def _resolve_purchasable_plan(plan_key: str, current_user: User, db: Session) -> Plan:
    plan = db.query(Plan).filter(Plan.key == plan_key, Plan.is_active.is_(True)).first()
    if plan is None:
        raise HTTPException(status_code=404, detail=f"Plan '{plan_key}' not found")

    if current_user.role == "ADMIN":
        raise HTTPException(status_code=403, detail="Admins do not require a subscription")

    expected = _ACCOUNT_TO_USER_TYPE.get(current_user.role)
    if expected is not None and plan.user_type != expected:
        raise HTTPException(
            status_code=403,
            detail=f"This plan is not available for {current_user.role} accounts",
        )
    return plan


@billing_router.post("/create-order")
def create_billing_order(
    body: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Create a Razorpay order for a paid plan after validating eligibility."""
    plan = _resolve_purchasable_plan(body.plan_key, current_user, db)

    if plan.price_inr == 0:
        raise HTTPException(
            status_code=400,
            detail="Free plans do not require payment. Use POST /subscriptions/subscribe instead.",
        )

    try:
        from services.razorpay_service import create_razorpay_order
        order = create_razorpay_order(plan, current_user)
    except (RuntimeError, ImportError) as exc:
        # Razorpay keys / SDK not configured on this environment.
        logger.error("Razorpay not configured: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Online payments are not available right now. Please try again later.",
        )
    except Exception:
        logger.exception("Razorpay order creation failed")
        raise HTTPException(
            status_code=502,
            detail="Could not create the payment order. Please try again.",
        )

    return {
        "order_id": order["id"],
        "amount": order["amount"],
        "currency": order["currency"],
        "plan_key": plan.key,
        "razorpay_key": os.getenv("RAZORPAY_KEY_ID", ""),
    }


# ---------------------------------------------------------------------------
# POST /billing/verify-payment
# ---------------------------------------------------------------------------

def _activate_subscription(user_id: str, plan: Plan, db: Session, *, order_id=None, payment_id=None) -> Subscription:
    """Expire any active subscriptions and create a fresh active one for `plan`."""
    db.query(Subscription).filter(
        Subscription.user_id == user_id,
        Subscription.status == "active",
    ).update({"status": "expired"})

    now = datetime.now(timezone.utc)
    if plan.price_inr == 0:
        duration_days = 36500
    elif plan.billing_period == "annual":
        duration_days = 365
    else:
        duration_days = 30

    sub = Subscription(
        user_id=user_id,
        plan_id=plan.id,
        plan_key=plan.key,
        role=plan.key,
        status="active",
        started_at=now,
        expires_at=now + timedelta(days=duration_days),
        razorpay_order_id=order_id,
        razorpay_payment_id=payment_id,
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    entitlement_service.invalidate_user(user_id)
    return sub


@billing_router.post("/verify-payment")
def verify_payment(
    body: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Verify the Razorpay signature and activate the subscription."""
    try:
        from services.razorpay_service import verify_payment_signature
        valid = verify_payment_signature(body.order_id, body.payment_id, body.signature)
    except (RuntimeError, ImportError) as exc:
        logger.error("Razorpay not configured: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Online payments are not available right now. Please try again later.",
        )

    if not valid:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    plan = _resolve_purchasable_plan(body.plan_key, current_user, db)
    sub = _activate_subscription(
        current_user.id, plan, db, order_id=body.order_id, payment_id=body.payment_id
    )
    return {
        "plan_key": sub.plan_key,
        "role": sub.role,
        "status": sub.status,
        "started_at": sub.started_at.isoformat(),
        "expires_at": sub.expires_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# GET /billing/usage
# ---------------------------------------------------------------------------

@billing_router.get("/usage", response_model=BillingUsageResponse)
def get_billing_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BillingUsageResponse:
    """
    Returns the user's subscription state, resolved entitlements (for frontend
    gating), and the current-month numeric quota snapshot.
    """
    sub: Optional[Subscription] = get_active_subscription(current_user, db)

    if sub is None or sub.status != "active":
        role = "coach_basic" if current_user.role == "COACH" else "bronze"
        plan_key = role
        expires_at = None
        status = "inactive"
    else:
        plan_key = sub.plan_key
        role = sub.role
        expires_at = sub.expires_at
        status = sub.status

    entitlements = entitlement_service.get_user_entitlements(current_user, db)
    used_map = get_monthly_usage_map(current_user.id, db)

    def _limit(feature_key: str) -> float:
        ent = entitlements.get(feature_key)
        return float(ent["value"]) if ent and ent["type"] == "numeric" else 0.0

    # Flat {feature_key: value} for the frontend entitlement gate.
    flat = {k: v["value"] for k, v in entitlements.items()}

    return BillingUsageResponse(
        plan=plan_key,
        role=role,
        expires_at=expires_at,
        status=status,
        entitlements=flat,
        current_month=MonthlySnapshot(
            biomech=QuotaSlot(used=used_map.get("biomechanics_analysis", 0.0), limit=_limit("biomechanics_analysis")),
            ocr_hours=QuotaSlot(used=used_map.get("ocr_highlights", 0.0), limit=_limit("ocr_highlights")),
            submissions=QuotaSlot(used=used_map.get("player_submission", 0.0), limit=_limit("player_submission")),
        ),
    )
