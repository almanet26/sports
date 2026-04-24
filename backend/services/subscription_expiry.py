"""
Subscription expiry sweep.

Two entry points:

1. expire_stale_subscriptions(db)  — pure function; run directly or from a
   background task.  Bulk-marks every subscription whose expires_at has passed
   and whose status is still "active" as "expired", then downgrades user.role
   to "free" for each affected user.  Safe to run repeatedly (idempotent).

2. register_expiry_endpoint(app)   — mounts  POST /internal/cron/expire-subscriptions
   on the FastAPI app.  Call this from main.py.  The endpoint is protected by
   the same X-Internal-Secret header as the usage report endpoint.  Wire it to
   Cloud Scheduler (or any cron runner) to execute on a schedule — daily is
   sufficient, since the feature gate also applies lazy expiry per-request.

Why both?
  • Per-request lazy expiry (in feature_gate.py) ensures no user ever gets
    unauthorised access, but only fires when the user makes a request.
  • This sweep ensures User.role in the DB reflects reality even for dormant
    accounts, which matters for admin dashboards, analytics, and any query that
    filters by role without going through require_feature.
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
    users_downgraded: int


def expire_stale_subscriptions(db: Session) -> ExpirySweepResult:
    """
    Single-pass bulk expiry.

    Step 1: Mark subscriptions expired.
      UPDATE subscriptions SET status = 'expired'
      WHERE  status = 'active' AND expires_at < NOW()

    Step 2: Downgrade user.role for every user whose ONLY active subscription
      just expired (i.e., they have no other active subscription).

    Both steps use raw SQL for atomicity and to avoid loading every row into
    Python.  Committed together in a single transaction.
    """
    now_sql = "CURRENT_TIMESTAMP"  # portable across Postgres and SQLite

    # Step 1 — expire overdue subscriptions
    sub_result = db.execute(
        text(
            f"UPDATE subscriptions "
            f"SET    status = 'expired', updated_at = {now_sql} "
            f"WHERE  status = 'active' "
            f"  AND  expires_at < {now_sql}"
        )
    )
    subs_expired: int = sub_result.rowcount

    if subs_expired == 0:
        db.commit()
        return ExpirySweepResult(0, 0)

    # Step 2 — downgrade users who have no remaining active subscription
    # A user keeps their role if they have another active + unexpired subscription.
    user_result = db.execute(
        text(
            f"UPDATE users "
            f"SET    role = 'free', updated_at = {now_sql} "
            f"WHERE  role <> 'free' "
            f"  AND  id NOT IN ("
            f"           SELECT DISTINCT user_id "
            f"           FROM   subscriptions "
            f"           WHERE  status = 'active' "
            f"             AND  expires_at > {now_sql}"
            f"       )"
        )
    )
    users_downgraded: int = user_result.rowcount

    db.commit()

    logger.info(
        "Expiry sweep complete — subscriptions_expired=%d users_downgraded=%d",
        subs_expired,
        users_downgraded,
    )
    return ExpirySweepResult(subs_expired, users_downgraded)


# ---------------------------------------------------------------------------
# Optional FastAPI endpoint — mount via register_expiry_endpoint(app)
# ---------------------------------------------------------------------------

def register_expiry_endpoint(app) -> None:
    """
    Mount POST /internal/cron/expire-subscriptions on `app`.

    Wire to Cloud Scheduler:
      URI:    https://<service>/internal/cron/expire-subscriptions
      Method: POST
      Headers:
        X-Internal-Secret: <INTERNAL_API_SECRET>
      Schedule: 0 2 * * *   (daily at 02:00 UTC)
    """
    from fastapi import Header, HTTPException
    from fastapi.responses import JSONResponse
    from database.config import SessionLocal

    @app.post("/internal/cron/expire-subscriptions", tags=["internal"])
    def run_expiry_sweep(x_internal_secret: str | None = Header(None)):
        if not _INTERNAL_SECRET:
            raise HTTPException(503, "INTERNAL_API_SECRET not configured")
        if x_internal_secret != _INTERNAL_SECRET:
            raise HTTPException(401, "Invalid internal secret")

        db = SessionLocal()
        try:
            result = expire_stale_subscriptions(db)
            return JSONResponse({
                "subscriptions_expired": result.subscriptions_expired,
                "users_downgraded": result.users_downgraded,
            })
        finally:
            db.close()