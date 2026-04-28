"""Seed one test user per tier role and print JWT access tokens.

Usage:
    cd backend
    python scripts/seed_roles.py
"""

from __future__ import annotations

import os
import sys
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from database.config import SessionLocal
from database.models.user import User
from database.models.subscription import Subscription
from database.models.plan_config import PlanConfig
from utils.auth import get_password_hash, create_access_token


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


TEST_PASSWORD = "Test@12345"
PLAN_ORDER = [
    "free",
    "coach_free",
    "basic",
    "platinum",
    "coach_starter",
    "coach_pro",
    "academy",
]


def _build_email(plan_key: str) -> str:
    return f"{plan_key}.test@sports.com"


def _build_name(plan_key: str) -> str:
    return f"{plan_key.replace('_', ' ').title()} Test User"


def _ensure_user_and_subscription(db: Session, plan: PlanConfig) -> Dict[str, str]:
    now = datetime.now(timezone.utc)
    email = _build_email(plan.plan_key)

    account_type = "COACH" if plan.role.startswith("coach_") or plan.role == "academy" else "PLAYER"
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            email=email,
            password_hash=get_password_hash(TEST_PASSWORD),
            name=_build_name(plan.plan_key),
            role=account_type,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.flush()
    else:
        user.password_hash = get_password_hash(TEST_PASSWORD)
        user.name = _build_name(plan.plan_key)
        user.role = account_type
        user.is_active = True
        user.is_verified = True

    expires_at = now + timedelta(days=plan.duration_days)
    subscription = db.query(Subscription).filter(Subscription.user_id == user.id).first()

    if subscription is None:
        subscription = Subscription(
            user_id=user.id,
            plan_key=plan.plan_key,
            role=plan.role,
            status="active",
            started_at=now,
            expires_at=expires_at,
        )
        db.add(subscription)
    else:
        subscription.plan_key = plan.plan_key
        subscription.role = plan.role
        subscription.status = "active"
        subscription.started_at = now
        subscription.expires_at = expires_at
        subscription.razorpay_order_id = None
        subscription.razorpay_payment_id = None
        subscription.razorpay_customer_id = None

    token = create_access_token({"sub": user.email, "role": user.role})
    return {
        "plan_key": plan.plan_key,
        "user_id": str(user.id),
        "email": user.email,
        "token": token,
    }


def seed_roles() -> None:
    logger.info("Seeding role users and active subscriptions...")
    db = SessionLocal()

    try:
        plan_rows = db.query(PlanConfig).all()
        plan_map = {row.plan_key: row for row in plan_rows}

        missing = [plan_key for plan_key in PLAN_ORDER if plan_key not in plan_map]
        if missing:
            missing_csv = ", ".join(missing)
            raise RuntimeError(
                f"Missing plan_config rows for: {missing_csv}. Run Alembic migration first."
            )

        results: List[Dict[str, str]] = []
        for plan_key in PLAN_ORDER:
            results.append(_ensure_user_and_subscription(db, plan_map[plan_key]))

        db.commit()

        print("\nSeeded role users (password is same for all):")
        print(f"PASSWORD: {TEST_PASSWORD}\n")
        for row in results:
            print(f"PLAN:  {row['plan_key']}")
            print(f"EMAIL: {row['email']}")
            print(f"USER_ID: {row['user_id']}")
            print(f"JWT: {row['token']}")
            print("-" * 80)

        logger.info("Role seed completed successfully.")
    except Exception:
        db.rollback()
        logger.exception("Role seed failed.")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_roles()
