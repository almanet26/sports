"""schema_cleanup_v2

Consolidates account-type fields, removes dead columns and tables, adds missing
indexes, and enforces correct CHECK constraints.  Covers steps 1-12 of the
schema cleanup plan (2026-04-26).

Revision ID: e9f1a2b3c4d5
Revises: f1e2d3c4b5a6
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa

revision = "e9f1a2b3c4d5"
down_revision = "f1e2d3c4b5a6"
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    )
    return result.fetchone() is not None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = :t"
        ),
        {"t": table},
    )
    return result.fetchone() is not None


def _constraint_exists(table: str, constraint: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_name = :t AND constraint_name = :c"
        ),
        {"t": table, "c": constraint},
    )
    return result.fetchone() is not None


def _index_exists(index: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes WHERE indexname = :i"
        ),
        {"i": index},
    )
    return result.fetchone() is not None


# ---------------------------------------------------------------------------
# upgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    conn = op.get_bind()

    # ── STEP 1 — Consolidate account type into users.role ───────────────────
    #
    # Before: users.role held subscription tier (free|basic|…) OR identity
    #         (PLAYER|COACH|ADMIN) depending on which code wrote the row.
    #         users.platform_role held identity (PLAYER|COACH|ADMIN).
    # After:  users.role = identity only.  platform_role is dropped.
    #         Subscription tier lives exclusively in subscriptions.role.

    # 1-a. Back-fill: where platform_role is already populated use it;
    #      where role already holds a valid identity keep it;
    #      otherwise default to PLAYER.
    if _column_exists("users", "platform_role"):
        conn.execute(sa.text("""
            UPDATE users
            SET role = CASE
                WHEN platform_role IN ('PLAYER','COACH','ADMIN') THEN platform_role
                WHEN role        IN ('PLAYER','COACH','ADMIN') THEN role
                ELSE 'PLAYER'
            END
        """))

    # 1-b. For any remaining rows whose role is a subscription tier, map to PLAYER.
    conn.execute(sa.text("""
        UPDATE users
        SET role = 'PLAYER'
        WHERE role NOT IN ('PLAYER','COACH','ADMIN')
    """))

    # 1-c. Update the Postgres enum type for users.role.
    #      SQLAlchemy creates native_enum=False (VARCHAR + CHECK), so we only
    #      need to update the CHECK constraint, not a pg enum type.
    if _constraint_exists("users", "user_role_enum"):
        op.drop_constraint("user_role_enum", "users", type_="check")
    op.create_check_constraint(
        "user_role_enum",
        "users",
        "role IN ('PLAYER','COACH','ADMIN')",
    )

    # 1-d. Drop platform_role column.
    if _column_exists("users", "platform_role"):
        op.drop_column("users", "platform_role")

    # ── STEP 2 — Remove subscription_plan from users ────────────────────────
    if _column_exists("users", "subscription_plan"):
        op.drop_column("users", "subscription_plan")

    # ── STEP 4 — Seed missing free subscriptions ────────────────────────────
    #   Any user who has no subscription row yet (registered before Step 4A
    #   was deployed) gets a free / 100-year subscription inserted now.
    conn.execute(sa.text("""
        INSERT INTO subscriptions (user_id, plan_key, role, status, started_at, expires_at, created_at, updated_at)
        SELECT
            u.id,
            'free',
            'free',
            'active',
            NOW(),
            NOW() + INTERVAL '36500 days',
            NOW(),
            NOW()
        FROM users u
        WHERE u.role IN ('PLAYER','COACH')
          AND NOT EXISTS (
              SELECT 1 FROM subscriptions s WHERE s.user_id = u.id
          )
    """))

    # ADMINs get academy tier.
    conn.execute(sa.text("""
        INSERT INTO subscriptions (user_id, plan_key, role, status, started_at, expires_at, created_at, updated_at)
        SELECT
            u.id,
            'academy_365d',
            'academy',
            'active',
            NOW(),
            NOW() + INTERVAL '36500 days',
            NOW(),
            NOW()
        FROM users u
        WHERE u.role = 'ADMIN'
          AND NOT EXISTS (
              SELECT 1 FROM subscriptions s WHERE s.user_id = u.id
          )
    """))

    # ── STEP 5 — monthly_usage unique constraint + lookup index ─────────────
    if not _constraint_exists("monthly_usage", "uq_monthly_usage_user_year_month"):
        op.create_unique_constraint(
            "uq_monthly_usage_user_year_month",
            "monthly_usage",
            ["user_id", "year", "month"],
        )

    if not _index_exists("idx_monthly_usage_lookup"):
        op.create_index(
            "idx_monthly_usage_lookup",
            "monthly_usage",
            ["user_id", "year", "month"],
        )

    # ── STEP 6 — Drop stripe_customer_id ────────────────────────────────────
    if _column_exists("users", "stripe_customer_id"):
        op.drop_column("users", "stripe_customer_id")

    # ── STEP 7 — Consolidate reviews → coach_reviews ────────────────────────
    if _table_exists("reviews"):
        if not _column_exists("coach_reviews", "updated_at"):
            op.add_column(
                "coach_reviews",
                sa.Column(
                    "updated_at",
                    sa.DateTime(timezone=True),
                    server_default=sa.text("NOW()"),
                    nullable=True,
                ),
            )
        conn.execute(sa.text("""
            INSERT INTO coach_reviews (id, coach_id, player_id, rating, comment, created_at)
            SELECT id, coach_id, player_id, rating, comment, created_at
            FROM reviews
            ON CONFLICT (id) DO NOTHING
        """))
        op.drop_table("reviews")

    # ── STEP 8 — Drop dead tables ────────────────────────────────────────────

    # 8-a. plans (superseded by plan_config)
    if _table_exists("plans"):
        op.drop_table("plans")

    # 8-b. coach_feedback_and_suggestions (casing-typo duplicate)
    if _table_exists("coach_feedback_and_suggestions"):
        op.drop_table("coach_feedback_and_suggestions")

    # 8-c. player_profiles_legacy
    if _table_exists("player_profiles_legacy"):
        op.drop_table("player_profiles_legacy")

    # ── STEP 9 — Drop processing_jobs (superseded by highlight_jobs) ─────────
    if _table_exists("processing_jobs"):
        op.drop_table("processing_jobs")

    # ── STEP 10 — Clean up transactions table ───────────────────────────────
    # transactions stores direct coach-player session payments (different from
    # platform subscriptions).  Add Razorpay columns; drop old reference_id.
    if _table_exists("transactions"):
        if not _column_exists("transactions", "razorpay_order_id"):
            op.add_column(
                "transactions",
                sa.Column("razorpay_order_id", sa.String(255), nullable=True),
            )
        if not _column_exists("transactions", "razorpay_payment_id"):
            op.add_column(
                "transactions",
                sa.Column("razorpay_payment_id", sa.String(255), nullable=True),
            )
        if _column_exists("transactions", "reference_id"):
            op.drop_column("transactions", "reference_id")

    # ── STEP 12 — Missing indexes ────────────────────────────────────────────

    if not _index_exists("idx_chat_history_session"):
        op.create_index(
            "idx_chat_history_session",
            "chat_history",
            ["user_id", "session_id", sa.text("created_at DESC")],
        )

    if not _index_exists("idx_subscriptions_user"):
        op.create_index(
            "idx_subscriptions_user",
            "subscriptions",
            ["user_id", "status"],
        )

    if not _index_exists("idx_highlight_jobs_video"):
        op.create_index(
            "idx_highlight_jobs_video",
            "highlight_jobs",
            ["video_id", "status"],
        )

    if not _index_exists("idx_player_submissions_coach"):
        op.create_index(
            "idx_player_submissions_coach",
            "player_submissions",
            ["coach_id", "status"],
        )

    if not _index_exists("idx_video_annotations_video"):
        op.create_index(
            "idx_video_annotations_video",
            "video_annotations",
            ["video_id", "coach_id"],
        )


# ---------------------------------------------------------------------------
# downgrade
# ---------------------------------------------------------------------------

def downgrade() -> None:
    conn = op.get_bind()

    # ── STEP 12 — remove indexes ─────────────────────────────────────────────
    for idx in [
        "idx_video_annotations_video",
        "idx_player_submissions_coach",
        "idx_highlight_jobs_video",
        "idx_subscriptions_user",
        "idx_chat_history_session",
        "idx_monthly_usage_lookup",
    ]:
        if _index_exists(idx):
            op.drop_index(idx)

    # ── STEP 10 — restore reference_id, drop razorpay columns ───────────────
    if _table_exists("transactions"):
        if _column_exists("transactions", "razorpay_order_id"):
            op.drop_column("transactions", "razorpay_order_id")
        if _column_exists("transactions", "razorpay_payment_id"):
            op.drop_column("transactions", "razorpay_payment_id")
        if not _column_exists("transactions", "reference_id"):
            op.add_column(
                "transactions",
                sa.Column("reference_id", sa.String(255), nullable=True),
            )

    # ── STEP 6 — restore stripe_customer_id ─────────────────────────────────
    if not _column_exists("users", "stripe_customer_id"):
        op.add_column(
            "users",
            sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        )

    # ── STEP 5 — remove unique constraint ───────────────────────────────────
    if _constraint_exists("monthly_usage", "uq_monthly_usage_user_year_month"):
        op.drop_constraint("uq_monthly_usage_user_year_month", "monthly_usage", type_="unique")

    # ── STEP 2 — restore subscription_plan ──────────────────────────────────
    if not _column_exists("users", "subscription_plan"):
        op.add_column(
            "users",
            sa.Column(
                "subscription_plan",
                sa.String(50),
                nullable=False,
                server_default="BASIC",
            ),
        )

    # ── STEP 1 — restore platform_role, revert role CHECK ───────────────────
    if not _column_exists("users", "platform_role"):
        op.add_column(
            "users",
            sa.Column(
                "platform_role",
                sa.String(20),
                nullable=False,
                server_default="PLAYER",
            ),
        )
        conn.execute(sa.text("UPDATE users SET platform_role = role"))

    if _constraint_exists("users", "user_role_enum"):
        op.drop_constraint("user_role_enum", "users", type_="check")
    op.create_check_constraint(
        "user_role_enum",
        "users",
        "role IN ('free','basic','platinum','coach_starter','coach_pro','academy',"
        "'PLAYER','COACH','ADMIN')",
    )
