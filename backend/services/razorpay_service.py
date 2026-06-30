"""
Razorpay integration helpers.

Environment variables required:
  RAZORPAY_KEY_ID      — Razorpay API key ID (rzp_live_... or rzp_test_...)
  RAZORPAY_KEY_SECRET  — Razorpay API key secret
"""

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from database.models.plan import Plan
    from database.models.user import User


def _client():
    import razorpay  # noqa: PLC0415 — lazy import keeps startup fast when Razorpay is unused

    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    if not key_id or not key_secret:
        raise RuntimeError(
            "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in the environment."
        )
    return razorpay.Client(auth=(key_id, key_secret))


def create_razorpay_order(plan: "Plan", user: "User") -> dict:
    """
    Create a Razorpay order for a subscription plan purchase.

    Returns the raw Razorpay order dict:
      { id, amount, currency, receipt, status, ... }
    """
    client = _client()
    order = client.order.create({
        "amount": plan.price_inr,  # already in paise
        "currency": "INR",
        "receipt": f"sub_{user.id[:8]}_{plan.key}",
        "notes": {
            "plan_key": plan.key,
            "user_id": user.id,
        },
    })
    return order


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """
    Verify the Razorpay payment signature returned by the checkout modal.

    Returns True on valid signature, False on invalid.
    """
    import razorpay.errors  # noqa: PLC0415

    client = _client()
    try:
        client.utility.verify_payment_signature({
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        })
        return True
    except razorpay.errors.SignatureVerificationError:
        return False
