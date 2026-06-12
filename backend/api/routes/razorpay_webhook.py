"""
Razorpay webhook handler.

Mount this router in main.py:
    from api.routes.razorpay_webhook import router as razorpay_webhook_router app.include_router(razorpay_webhook_router)

Environment variable required:
  RAZORPAY_WEBHOOK_SECRET — set in the Razorpay dashboard under Webhooks

Handled events:
  payment.captured → activate subscription for the plan_key stored in order notes
"""

import hashlib
import hmac
import json
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from database.config import get_db
from database.models.plan import Plan
from database.models.subscription import Subscription
from services import entitlement_service

router = APIRouter()


def _verify_webhook_signature(body: bytes, received_sig: str) -> bool:
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not secret:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received_sig)


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    sig = request.headers.get("x-razorpay-signature", "")

    if not _verify_webhook_signature(body, sig):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = payload.get("event")

    if event == "payment.captured":
        payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
        notes = payment.get("notes", {})
        plan_key = notes.get("plan_key")
        user_id = notes.get("user_id")
        order_id = payment.get("order_id")
        payment_id = payment.get("id")

        if not plan_key or not user_id:
            # Missing metadata — cannot activate subscription, but return 200 so Razorpay does not keep retrying.
            return {"status": "ignored", "reason": "missing plan_key or user_id in notes"}

        plan = db.query(Plan).filter(Plan.key == plan_key).first()
        if plan is None:
            return {"status": "ignored", "reason": f"unknown plan_key '{plan_key}'"}

        # Idempotency: skip if this payment_id is already recorded
        existing = (
            db.query(Subscription)
            .filter(Subscription.razorpay_payment_id == payment_id)
            .first()
        )
        if existing:
            return {"status": "already_processed"}

        # Close any active subscriptions for this user
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
        entitlement_service.invalidate_user(user_id)

    return {"status": "ok"}
