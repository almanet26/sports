"""
Subscription expiry sweep.

Two entry points:

1. expire_stale_subscriptions(db)  — pure function; run directly or from a
   background task.  Bulk-marks every subscription whose expires_at has passed
   and whose status is still "active" as "expired".
   Safe to run repeatedly (idempotent).

   NOTE: users.role is the PERMANENT account type (PLAYER|COACH|ADMIN) and is
   NEVER modified by this sweep.  Subscription tier is stored exclusively in
   subscriptions.role.  Per-request lazy expiry in feature_gate.py handles the
   gate enforcement; this sweep only updates the subscriptions table so that
   reporting and admin dashboards see consistent status values.

2. register_expiry_endpoint(app)   — mounts  POST /internal/cron/expire-subscriptions
   on the FastAPI app.  Call this from main.py.  The endpoint is protected by
   the same X-Internal-Secret header as the usage report endpoint.  Wire it to
   Cloud Scheduler (or any cron runner) to execute on a schedule — daily is
   sufficient, since the feature gate also applies lazy expiry per-request.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import NamedTuple

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_INTERNAL_SECRET: str = os.getenv("INTERNAL_API_SECRET", "")


# ---------------------------------------------------------------------------
# Core sweep
# ---------------------------------------------------------------------------

class ExpirySweepResult(NamedTuple):
    subscriptions_expired: int


def expire_stale_subscriptions(db: Session) -> ExpirySweepResult:
    """
    Single-pass bulk expiry.

    Marks every subscription whose expires_at has passed and whose status is
    still "active" as "expired".

    users.role is the PERMANENT account type (PLAYER|COACH|ADMIN) and must
    NEVER be modified here.  Subscription tier lives in subscriptions.role only.
    Per-request lazy expiry in feature_gate.py enforces access control;
    this sweep keeps subscriptions.status accurate for admin views and analytics.
    """
    now_sql = "CURRENT_TIMESTAMP"  # portable across Postgres and SQLite

    sub_result = db.execute(
        text(
            f"UPDATE subscriptions "
            f"SET    status = 'expired', updated_at = {now_sql} "
            f"WHERE  status = 'active' "
            f"  AND  expires_at < {now_sql}"
        )
    )
    subs_expired: int = sub_result.rowcount
    db.commit()

    logger.info(
        "Expiry sweep complete — subscriptions_expired=%d",
        subs_expired,
    )
    return ExpirySweepResult(subs_expired)


# ---------------------------------------------------------------------------
# Optional FastAPI endpoint — mount via register_expiry_endpoint(app)
# ---------------------------------------------------------------------------

def register_expiry_endpoint(app) -> None:
    """
    Mount POST /internal/cron/expire-subscriptions on `app`.

    Auth options (either is sufficient):
      1. X-Internal-Secret header matching INTERNAL_API_SECRET env var.
      2. Bearer JWT with role == "ADMIN".

    Wire to Cloud Scheduler:
      URI:    https://<service>/internal/cron/expire-subscriptions
      Method: POST
      Headers:
        X-Internal-Secret: <INTERNAL_API_SECRET>
      Schedule: 0 2 * * *   (daily at 02:00 UTC)
    """
    from fastapi import Depends, Header, HTTPException
    from fastapi.responses import JSONResponse
    from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
    from database.config import SessionLocal

    _optional_bearer = HTTPBearer(auto_error=False)

    @app.post("/internal/cron/expire-subscriptions", tags=["internal"])
    def run_expiry_sweep(
        x_internal_secret: str | None = Header(None),
        credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    ):
        # Allow admin JWT as an alternative to the internal secret
        if credentials is not None:
            try:
                from utils.auth import verify_access_token
                payload = verify_access_token(credentials.credentials)
                if payload.get("role") != "ADMIN":
                    raise HTTPException(403, "Only ADMIN may call this endpoint via JWT")
                # Admin authenticated — proceed
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
            result = expire_stale_subscriptions(db)
            return JSONResponse({
                "subscriptions_expired": result.subscriptions_expired,
            })
        finally:
            db.close()