"""drop_subscription_unique_add_partial_idx

Removes the UNIQUE(user_id) constraint from subscriptions so that a user can
have a full subscription history (past and future plans stored as separate rows).

Also adds a partial index on (user_id, started_at DESC) WHERE status = 'active'
so that get_active_subscription() queries are O(log N) even with many rows.

Revision ID: f1e2d3c4b5a6
Revises: d7e9c3f1a842
Create Date: 2026-04-23 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f1e2d3c4b5a6"
down_revision: Union[str, Sequence[str], None] = "d7e9c3f1a842"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # ── Drop the unique constraint ────────────────────────────────────────────
    # The constraint was named "uq_subscriptions_user_id" in the previous migration.  SQLite does not support DROP CONSTRAINT; it requires recreating the table.  Since this app targets Supabase in production we handle PostgreSQL first and provide a SQLite no-op (the constraint is harmless in a development SQLite database).
    if dialect == "postgresql":
        op.drop_constraint("uq_subscriptions_user_id", "subscriptions", type_="unique")

        # ── Partial index for fast active-subscription lookup ─────────────────
        # Supports the canonical query:
        #   SELECT * FROM subscriptions
        #   WHERE  user_id = $1
        #     AND  status  = 'active'
        #   ORDER  BY started_at DESC
        #   LIMIT  1;
        # Partial indexes are a PostgreSQL feature; skip on SQLite.
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_subscriptions_active_user "
                "ON subscriptions (user_id, started_at DESC) "
                "WHERE status = 'active'"
            )
        )
    # SQLite: the UNIQUE constraint was created inline on the column, not as a named constraint, and cannot be dropped without recreating the table. In development this is acceptable; the constraint only becomes a problem when Razorpay renewals are integrated and new subscription rows are inserted.


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.execute(
            sa.text("DROP INDEX IF EXISTS ix_subscriptions_active_user")
        )
        # Re-add unique constraint.  This will fail if any user already has multiple subscription rows — clean up duplicates first.
        op.create_unique_constraint(
            "uq_subscriptions_user_id", "subscriptions", ["user_id"]
        )