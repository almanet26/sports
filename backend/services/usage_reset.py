"""
Monthly feature-usage reset.

Numeric quotas (biomechanics analyses, OCR hours, submissions, …) are tracked per calendar month in feature_usage, keyed by period_start (first-of-month). Correctness does not depend on a cron: the quota gate lazily creates a fresh row for the current month, so a new month automatically starts at zero.

This module provides the explicit reset/housekeeping entry point required by the spec - it prunes stale prior-month rows so the table stays small and gives operators a deterministic "balances are reset" signal at the cycle boundary.

Two entry points (mirrors services/subscription_expiry.py):
  - reset_stale_usage(db) - pure, idempotent: deletes feature_usage rows older than the current month.
  - register_usage_reset_endpoint(app) - mounts POST /internal/cron/reset-usage.
"""

from __future__ import annotations

import logging
import os
from datetime import date
from typing import NamedTuple

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_INTERNAL_SECRET: str = os.getenv("INTERNAL_API_SECRET", "")


class UsageResetResult(NamedTuple):
    rows_pruned: int


def _current_period_start() -> date:
    today = date.today()
    return date(today.year, today.month, 1)


def reset_stale_usage(db: Session) -> UsageResetResult:
    """
    Delete feature_usage rows for any month before the current one. Idempotent and safe to run repeatedly — current-month consumption is untouched.
    """
    period = _current_period_start()
    result = db.execute(
        text("DELETE FROM feature_usage WHERE period_start < :period"),
        {"period": period},
    )
    pruned = result.rowcount or 0
    db.commit()
    logger.info("Usage reset complete — pruned %d stale feature_usage rows", pruned)
    return UsageResetResult(pruned)


def register_usage_reset_endpoint(app) -> None:
    """
    Mount POST /internal/cron/reset-usage on `app`.

    Auth (either is sufficient):
      1. X-Internal-Secret header matching INTERNAL_API_SECRET env var.
      2. Bearer JWT with role == "ADMIN".

    Wire to Cloud Scheduler at 00:05 on the 1st of each month:
      Schedule: 5 0 1 * *
    """
    from fastapi import Depends, Header, HTTPException
    from fastapi.responses import JSONResponse
    from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
    from database.config import SessionLocal

    _optional_bearer = HTTPBearer(auto_error=False)

    @app.post("/internal/cron/reset-usage", tags=["internal"])
    def run_usage_reset(
        x_internal_secret: str | None = Header(None),
        credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    ):
        if credentials is not None:
            try:
                from utils.auth import verify_access_token
                payload = verify_access_token(credentials.credentials)
                if payload.get("role") != "ADMIN":
                    raise HTTPException(403, "Only ADMIN may call this endpoint via JWT")
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(401, "Invalid token")
        elif x_internal_secret:
            if not _INTERNAL_SECRET:
                raise HTTPException(503, "INTERNAL_API_SECRET not configured")
            if x_internal_secret != _INTERNAL_SECRET:
                raise HTTPException(401, "Invalid internal secret")
        else:
            raise HTTPException(401, "Authentication required")

        db = SessionLocal()
        try:
            result = reset_stale_usage(db)
            return JSONResponse({"rows_pruned": result.rows_pruned})
        finally:
            db.close()
