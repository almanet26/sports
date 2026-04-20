"""
Shared pytest fixtures for the backend test suite.

Creates an in-memory SQLite database per session and tears it down after all
tests. Each test function gets a fresh session with per-test user/subscription
data rolled back after the test, while the session-scoped plan_config seed
persists across all tests in the run.
"""

import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Make the backend root importable regardless of how pytest is invoked.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Import models so they register with Base.metadata before create_all().
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
    """Insert plan_config rows that the quota and feature-gate tests depend on."""
    db = TestingSessionLocal()
    rows = [
        PlanConfig(
            plan_key="free",
            role="free",
            display_name="Free",
            price_inr=0,
            duration_days=90,
            max_biomech_per_month=3,
            max_ocr_hours_per_month=0.0,
            max_submissions_per_month=0,
            max_players_in_dashboard=0,
        ),
        PlanConfig(
            plan_key="platinum",
            role="platinum",
            display_name="Platinum",
            price_inr=599,
            duration_days=90,
            max_biomech_per_month=50,
            max_ocr_hours_per_month=0.0,
            max_submissions_per_month=0,
            max_players_in_dashboard=0,
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
    Yields a database session.  User/subscription/usage data written during a
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

def _make_user(role: str) -> User:
    return User(
        id=str(uuid.uuid4()),
        name=f"Test {role}",
        email=f"{role.replace('_', '')}_{uuid.uuid4().hex[:6]}@test.invalid",
        password_hash="$2b$12$placeholder",
        role=role,
        subscription_plan="BASIC",
        is_active=True,
        is_verified=True,
    )


def _make_active_subscription(user_id: str, role: str) -> Subscription:
    now = datetime.utcnow()
    return Subscription(
        user_id=user_id,
        plan_key=role,
        role=role,
        status="active",
        started_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=89),
    )


# ---------------------------------------------------------------------------
# User fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def free_user(db):
    user = _make_user("free")
    db.add(user)
    db.flush()
    db.add(_make_active_subscription(user.id, "free"))
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def platinum_user(db):
    user = _make_user("platinum")
    db.add(user)
    db.flush()
    db.add(_make_active_subscription(user.id, "platinum"))
    db.commit()
    db.refresh(user)
    return user
