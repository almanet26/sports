"""
Pre-deployment integration audit for CORS, feature gates, and quota controls.

Run this against the local backend when needed:
    pytest backend/tests/test_predeploy_audit.py -q

Live CORS checks talk to http://localhost:8000 by default. If the backend is not running, those tests skip cleanly.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta

import pytest
import requests
from fastapi import HTTPException

from database.models.subscription import Subscription
from database.models.user import User
from dependencies.feature_gate import require_feature
from dependencies.quota_gate import increment_usage_atomic, quota_check
from tests.conftest import get_feature_usage


BASE_URL = os.getenv("LOCAL_BASE_URL", "http://localhost:8000").rstrip("/")

MATCHING_VERCEL_ORIGIN = "https://sports-demo-almanets-projects-17904779.vercel.app"
NON_MATCHING_VERCEL_ORIGIN = "https://anything.vercel.app"


def _live_backend_is_up() -> bool:
    try:
        response = requests.get(f"{BASE_URL}/api/v1/health", timeout=2)
        return response.ok
    except requests.RequestException:
        return False


def _preflight(origin: str, path: str = "/api/v1/auth/login") -> requests.Response:
    return requests.options(
        f"{BASE_URL}{path}",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
        timeout=5,
    )


def _make_user(role: str) -> User:
    return User(
        id=f"user-{role}-{os.urandom(6).hex()}",
        name=f"Test {role}",
        email=f"{role.lower()}-{os.urandom(4).hex()}@test.invalid",
        password_hash="$2b$12$placeholder",
        role=role,
        subscription_plan="BASIC",
        is_active=True,
        is_verified=True,
    )


def _add_active_subscription(db, user_id: str, tier: str) -> None:
    from database.models.plan import Plan
    now = datetime.utcnow()
    plan = db.query(Plan).filter(Plan.key == tier).first()
    db.add(
        Subscription(
            user_id=user_id,
            plan_id=plan.id if plan else None,
            plan_key=tier,
            role=tier,
            status="active",
            started_at=now - timedelta(days=1),
            expires_at=now + timedelta(days=89),
        )
    )


def _make_coach_user(db, tier: str = "coach_platinum") -> User:
    user = _make_user("COACH")
    db.add(user)
    db.flush()
    _add_active_subscription(db, user.id, tier)
    db.commit()
    db.refresh(user)
    return user


def _make_player_user(db, tier: str = "bronze") -> User:
    user = _make_user("PLAYER")
    db.add(user)
    db.flush()
    _add_active_subscription(db, user.id, tier)
    db.commit()
    db.refresh(user)
    return user


def test_cors_accepts_matching_vercel_preview_origin():
    if not _live_backend_is_up():
        pytest.skip("Local backend is not running on localhost:8000")

    response = _preflight(MATCHING_VERCEL_ORIGIN)

    assert response.status_code in (200, 204)
    assert response.headers.get("access-control-allow-origin") == MATCHING_VERCEL_ORIGIN
    assert response.headers.get("access-control-allow-credentials") == "true"
    allow_methods = response.headers.get("access-control-allow-methods", "")
    assert "POST" in allow_methods


def test_cors_rejects_non_matching_vercel_origin():
    if not _live_backend_is_up():
        pytest.skip("Local backend is not running on localhost:8000")

    response = _preflight(NON_MATCHING_VERCEL_ORIGIN)

    assert response.status_code == 400
    assert response.headers.get("access-control-allow-origin") != NON_MATCHING_VERCEL_ORIGIN


def test_free_user_blocked_from_pdf_report(free_user, db):
    # Bronze (free) does not grant pdf_report.
    gate = require_feature("pdf_report")

    with pytest.raises(HTTPException) as exc_info:
        gate(user=free_user, db=db)

    exc = exc_info.value
    assert exc.status_code == 403
    assert exc.detail["error"] == "feature_not_available"


def test_player_does_not_get_coach_only_feature(platinum_user, db):
    # A player's plan never grants coach_submission_inbox → 403.
    gate = require_feature("coach_submission_inbox")

    with pytest.raises(HTTPException) as exc_info:
        gate(user=platinum_user, db=db)

    exc = exc_info.value
    assert exc.status_code == 403
    assert exc.detail["error"] == "feature_not_available"


def test_coach_basic_can_access_coach_only_gate(db):
    coach = _make_coach_user(db, tier="coach_basic")
    gate = require_feature("coach_submission_inbox")

    result = gate(user=coach, db=db)

    assert result.id == coach.id
    assert result.role == "COACH"


def test_biomech_quota_atomic_increment_then_429_for_free_tier(free_user, db):
    first = increment_usage_atomic(free_user.id, "biomech_count", "max_biomech_per_month", 1, db)
    second = increment_usage_atomic(free_user.id, "biomech_count", "max_biomech_per_month", 1, db)
    third = increment_usage_atomic(free_user.id, "biomech_count", "max_biomech_per_month", 1, db)
    fourth = increment_usage_atomic(free_user.id, "biomech_count", "max_biomech_per_month", 1, db)

    assert first is True
    assert second is True
    assert third is True
    assert fourth is False

    assert get_feature_usage(db, free_user.id, "biomechanics_analysis") == 3

    gate = quota_check("biomechanics_analysis")
    with pytest.raises(HTTPException) as exc_info:
        gate(user=free_user, db=db)

    exc = exc_info.value
    assert exc.status_code == 429
    assert exc.detail["error"] == "quota_exceeded"
    assert exc.detail["used"] == 3
    assert exc.detail["limit"] == 3


def test_quota_check_creates_row_when_missing(free_user, db):
    gate = quota_check("biomechanics_analysis")
    result_user, result_usage = gate(user=free_user, db=db)

    assert result_user.id == free_user.id
    assert result_usage.used == 0