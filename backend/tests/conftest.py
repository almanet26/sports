"""
Shared pytest fixtures for the backend test suite.

Creates an in-memory SQLite database per session and tears it down after all
tests. Each test function gets a fresh session with per-test user/subscription
data rolled back after the test, while the session-scoped plan_config seed
persists across all tests in the run.

Plans seeded:
  free          → max_biomech=3,  max_ocr=0,   max_submissions=0
  basic         → max_biomech=10, max_ocr=0,   max_submissions=0
  platinum      → max_biomech=50, max_ocr=0,   max_submissions=0
  coach_free    → max_biomech=0,  max_ocr=0,   max_submissions=0
  coach_starter → max_biomech=5,  max_ocr=5.0, max_submissions=50
"""

import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database.config import Base
from database.models.monthly_usage import MonthlyUsage  # noqa: F401
from database.models.plan_config import PlanConfig  # noqa: F401
from database.models.subscription import Subscription  # noqa: F401
from database.models.user import User  # noqa: F401

# ---------------------------------------------------------------------------
# Test engine — isolated in-memory SQLite, never touches production.
# ---------------------------------------------------------------------------

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


# ---------------------------------------------------------------------------
# Session-scoped: create tables once, seed plan_config once.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    Base.metadata.create_all(TEST_ENGINE)
    yield
    Base.metadata.drop_all(TEST_ENGINE)


@pytest.fixture(scope="session")
def _seed_plans(_create_tables):
    """
    Insert plan_config rows matching the production values in main.py
    _ensure_plan_config().  Tests rely on the row that matters for their
    scenario; unused columns (e.g. max_players for quota tests) mirror
    production so no fixture drifts silently.
    """
    db = TestingSessionLocal()
    rows = [
        PlanConfig(
            plan_key="free",
            role="free",
            display_name="Free",
            price_inr=0,
            duration_days=36500,
            max_biomech_per_month=3,
            max_ocr_hours_per_month=0.0,
            max_submissions_per_month=0,
            max_players_in_dashboard=0,
        ),
        PlanConfig(
            plan_key="coach_free",
            role="coach_free",
            display_name="Coach Free",
            price_inr=0,
            duration_days=36500,
            max_biomech_per_month=0,
            max_ocr_hours_per_month=0.0,
            max_submissions_per_month=0,
            max_players_in_dashboard=0,
        ),
        PlanConfig(
            plan_key="basic",
            role="basic",
            display_name="Basic",
            price_inr=499,
            duration_days=90,
            max_biomech_per_month=15,
            max_ocr_hours_per_month=0.0,
            max_submissions_per_month=5,
            max_players_in_dashboard=0,
        ),
        PlanConfig(
            plan_key="platinum",
            role="platinum",
            display_name="Platinum",
            price_inr=1499,
            duration_days=180,
            max_biomech_per_month=50,
            max_ocr_hours_per_month=0.0,
            max_submissions_per_month=15,
            max_players_in_dashboard=0,
        ),
        PlanConfig(
            plan_key="coach_starter",
            role="coach_starter",
            display_name="Coach Starter",
            price_inr=1999,
            duration_days=90,
            max_biomech_per_month=999,
            max_ocr_hours_per_month=50.0,
            max_submissions_per_month=150,
            max_players_in_dashboard=10,
        ),
        PlanConfig(
            plan_key="coach_pro",
            role="coach_pro",
            display_name="Coach Pro",
            price_inr=4999,
            duration_days=180,
            max_biomech_per_month=999,
            max_ocr_hours_per_month=150.0,
            max_submissions_per_month=600,
            max_players_in_dashboard=100,
        ),
        PlanConfig(
            plan_key="academy",
            role="academy",
            display_name="Academy",
            price_inr=14999,
            duration_days=365,
            max_biomech_per_month=999,
            max_ocr_hours_per_month=500.0,
            max_submissions_per_month=1500,
            max_players_in_dashboard=-1,
        ),
    ]
    for row in rows:
        if not db.query(PlanConfig).filter_by(plan_key=row.plan_key).first():
            db.add(row)
    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# Function-scoped: fresh session, cleaned up after each test.
# ---------------------------------------------------------------------------

@pytest.fixture
def db(_seed_plans):
    """
    Yields a database session. User/subscription/usage data written during a
    test is wiped after it runs; plan_config rows survive (seeded once above).
    """
    session = TestingSessionLocal()
    yield session
    session.rollback()
    session.query(MonthlyUsage).delete()
    session.query(Subscription).delete()
    session.query(User).delete()
    session.commit()
    session.close()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(account_type: str, sub_role: str) -> User:
    """
    account_type: "PLAYER", "COACH", or "ADMIN" (Gate 1/2 checks)
    sub_role:     subscription tier ("free", "basic", "platinum", etc.)
    """
    return User(
        id=str(uuid.uuid4()),
        name=f"Test {account_type} ({sub_role})",
        email=f"{account_type.lower()}_{sub_role}_{uuid.uuid4().hex[:6]}@test.invalid",
        password_hash="$2b$12$placeholder",
        role=account_type,
        subscription_plan="BASIC",
        is_active=True,
        is_verified=True,
    )


def _make_active_subscription(user_id: str, role: str) -> Subscription:
    now = datetime.now(timezone.utc)
    return Subscription(
        user_id=user_id,
        plan_key=role,
        role=role,
        status="active",
        started_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=89),
    )


def _persist_user_with_sub(db, account_type: str, sub_role: str) -> User:
    user = _make_user(account_type, sub_role)
    db.add(user)
    db.flush()
    db.add(_make_active_subscription(user.id, sub_role))
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# User fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def free_user(db):
    """PLAYER account on the free tier."""
    return _persist_user_with_sub(db, "PLAYER", "free")


@pytest.fixture
def basic_player_user(db):
    """PLAYER account on the basic tier (satisfies ai_chat player requirement)."""
    return _persist_user_with_sub(db, "PLAYER", "basic")


@pytest.fixture
def platinum_user(db):
    """PLAYER account on the platinum tier."""
    return _persist_user_with_sub(db, "PLAYER", "platinum")


@pytest.fixture
def coach_free_user(db):
    """COACH account on the coach_free tier (below coach_starter)."""
    return _persist_user_with_sub(db, "COACH", "coach_free")


@pytest.fixture
def coach_starter_user(db):
    """COACH account on the coach_starter tier (satisfies ai_chat coach requirement)."""
    return _persist_user_with_sub(db, "COACH", "coach_starter")


@pytest.fixture
def admin_user(db):
    """ADMIN account — no subscription needed, bypasses all gates."""
    user = _make_user("ADMIN", "free")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
