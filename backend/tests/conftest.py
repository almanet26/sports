"""
Shared pytest fixtures for the backend test suite.

Creates an in-memory SQLite database per session and tears it down after all tests.  Each test function gets a fresh session with per-test user / subscription / usage data wiped after it runs, while the session-scoped entitlement catalog (plans, features, plan_entitlements) persists across the run.

Baseline plans seeded (from config/default_entitlements.py via
scripts.seed_entitlements.sync_entitlement_catalog):
  bronze         → biomechanics_analysis=3,  player_submission=0
  silver         → biomechanics_analysis=15, player_submission=5,  ai_chat, pdf_report, ad_free
  gold           → biomechanics_analysis=50, player_submission=15, + pro_benchmarking, scouting_visibility, ...
  coach_basic    → ocr_highlights=10, player_submission=5,  player_roster=5,  coach_submission_inbox
  coach_platinum → ocr_highlights=50, player_submission=100, player_roster=25, + video_annotation, csv_export, ...
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
import database.models  # noqa: F401  — registers every model with Base.metadata
from database.models.feature_usage import FeatureUsage  # noqa: F401
from database.models.plan import Plan  # noqa: F401
from database.models.subscription import Subscription  # noqa: F401
from database.models.user import User  # noqa: F401
from scripts.seed_entitlements import sync_entitlement_catalog
from services import entitlement_service

# ---------------------------------------------------------------------------
# Test engine — isolated in-memory SQLite, never touches production.
# ---------------------------------------------------------------------------

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


# ---------------------------------------------------------------------------
# Session-scoped: create tables once, seed the entitlement catalog once.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    Base.metadata.create_all(TEST_ENGINE)
    yield
    Base.metadata.drop_all(TEST_ENGINE)


@pytest.fixture(scope="session")
def _seed_plans(_create_tables):
    """Seed the baseline plans/features/entitlements (production values)."""
    db = TestingSessionLocal()
    try:
        sync_entitlement_catalog(db)
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Function-scoped: fresh session, cleaned up after each test.
# ---------------------------------------------------------------------------

@pytest.fixture
def db(_seed_plans):
    """
    Yields a database session. User/subscription/usage data written during a test is wiped afterward; the entitlement catalog persists. The entitlement cache is cleared before and after each test so stale per-user entries from a prior test never leak.
    """
    entitlement_service.invalidate_all()
    session = TestingSessionLocal()
    yield session
    session.rollback()
    session.query(FeatureUsage).delete()
    session.query(Subscription).delete()
    session.query(User).delete()
    session.commit()
    session.close()
    entitlement_service.invalidate_all()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(account_type: str, plan_key: str) -> User:
    """
    account_type: "PLAYER", "COACH", or "ADMIN" (account-type gate).
    plan_key:     subscription plan key ("bronze", "silver", "coach_platinum", …).
    """
    return User(
        id=str(uuid.uuid4()),
        name=f"Test {account_type} ({plan_key})",
        email=f"{account_type.lower()}_{plan_key}_{uuid.uuid4().hex[:6]}@test.invalid",
        password_hash="$2b$12$placeholder",
        role=account_type,
        subscription_plan="BASIC",
        is_active=True,
        is_verified=True,
    )


def _make_active_subscription(db, user_id: str, plan_key: str) -> Subscription:
    now = datetime.now(timezone.utc)
    plan = db.query(Plan).filter(Plan.key == plan_key).first()
    return Subscription(
        user_id=user_id,
        plan_id=plan.id if plan else None,
        plan_key=plan_key,
        role=plan_key,
        status="active",
        started_at=now - timedelta(days=1),
        expires_at=now + timedelta(days=89),
    )


def _persist_user_with_sub(db, account_type: str, plan_key: str) -> User:
    user = _make_user(account_type, plan_key)
    db.add(user)
    db.flush()
    db.add(_make_active_subscription(db, user.id, plan_key))
    db.commit()
    db.refresh(user)
    entitlement_service.invalidate_user(user.id)
    return user


def seed_feature_usage(db, user_id: str, feature_key: str, used: float):
    """Create/replace this month's feature_usage row for a user × feature."""
    from datetime import date
    from database.models.feature import Feature

    feature = db.query(Feature).filter(Feature.key == feature_key).first()
    assert feature is not None, f"feature '{feature_key}' not seeded"
    period = date.today().replace(day=1)
    row = (
        db.query(FeatureUsage)
        .filter(
            FeatureUsage.user_id == user_id,
            FeatureUsage.feature_id == feature.id,
            FeatureUsage.period_start == period,
        )
        .first()
    )
    if row is None:
        row = FeatureUsage(user_id=user_id, feature_id=feature.id, period_start=period, used=used)
        db.add(row)
    else:
        row.used = used
    db.commit()
    return row


def get_feature_usage(db, user_id: str, feature_key: str) -> float:
    """Return this month's recorded usage for a user × feature (0.0 if none)."""
    from datetime import date
    from database.models.feature import Feature

    feature = db.query(Feature).filter(Feature.key == feature_key).first()
    if feature is None:
        return 0.0
    period = date.today().replace(day=1)
    row = (
        db.query(FeatureUsage)
        .filter(
            FeatureUsage.user_id == user_id,
            FeatureUsage.feature_id == feature.id,
            FeatureUsage.period_start == period,
        )
        .first()
    )
    return float(row.used) if row else 0.0


# ---------------------------------------------------------------------------
# User fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def free_user(db):
    """PLAYER account on the bronze (free) tier."""
    return _persist_user_with_sub(db, "PLAYER", "bronze")


@pytest.fixture
def bronze_user(db):
    """PLAYER account on the bronze (free) tier."""
    return _persist_user_with_sub(db, "PLAYER", "bronze")


@pytest.fixture
def silver_user(db):
    """PLAYER account on the silver tier."""
    return _persist_user_with_sub(db, "PLAYER", "silver")


@pytest.fixture
def gold_user(db):
    """PLAYER account on the gold tier."""
    return _persist_user_with_sub(db, "PLAYER", "gold")


# Legacy aliases kept so existing tests that reference old names don't break immediately.
@pytest.fixture
def basic_player_user(db):
    """PLAYER account on the silver tier (legacy alias for basic)."""
    return _persist_user_with_sub(db, "PLAYER", "silver")


@pytest.fixture
def platinum_user(db):
    """PLAYER account on the gold tier (legacy alias for platinum)."""
    return _persist_user_with_sub(db, "PLAYER", "gold")


@pytest.fixture
def coach_free_user(db):
    """COACH account on the coach_basic (free) tier."""
    return _persist_user_with_sub(db, "COACH", "coach_basic")


@pytest.fixture
def coach_basic_user(db):
    """COACH account on the coach_basic (free) tier."""
    return _persist_user_with_sub(db, "COACH", "coach_basic")


@pytest.fixture
def coach_platinum_user(db):
    """COACH account on the coach_platinum tier."""
    return _persist_user_with_sub(db, "COACH", "coach_platinum")


# Legacy alias
@pytest.fixture
def coach_starter_user(db):
    """COACH account on the coach_platinum tier (legacy alias for coach_starter)."""
    return _persist_user_with_sub(db, "COACH", "coach_platinum")


@pytest.fixture
def admin_user(db):
    """ADMIN account — no subscription needed, bypasses all gates."""
    user = _make_user("ADMIN", "bronze")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
