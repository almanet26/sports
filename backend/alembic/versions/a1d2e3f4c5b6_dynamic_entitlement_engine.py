"""Dynamic billing & entitlement engine

Replaces the static plan_config + monthly_usage schema with a normalized, admin-editable entitlement model:
  plans              — sellable subscription plans (metadata only)
  features           — master catalog of enforceable capabilities
  plan_entitlements  — plan x feature → value (join table)
  feature_usage      — normalized per-feature monthly consumption

Also:
  - adds subscriptions.plan_id (FK → plans, ON DELETE RESTRICT) and backfills it
  - copies monthly_usage counters into feature_usage
  - seeds the baseline 5 plans / feature catalog / entitlements
  - drops plan_config and monthly_usage

The seed block below is intentionally inlined (self-contained migration). It mirrors backend/config/default_entitlements.py; the startup upsert in main.py is the authoritative, idempotent source so the two always converge.

The legacy-key backfill below maps every historical tier name (free/basic/platinum/coach_free/coach_starter/coach_pro/academy and bronze/silver/gold) onto the 5 canonical plans, so this migration is self-sufficient and chains directly off the main head (h1i2j3k4l5m6) - no intermediate tier-rename step is required.

Revision ID: a1d2e3f4c5b6
Revises: h1i2j3k4l5m6
Create Date: 2026-06-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1d2e3f4c5b6"
down_revision: Union[str, Sequence[str], None] = "h1i2j3k4l5m6"
branch_labels = None
depends_on = None


# ── Baseline seed (mirrors config/default_entitlements.py) ───────────────────
_FEATURES = [
    ("biomechanics_analysis", "Biomechanical Analyses", "numeric"),
    ("player_submission", "Coach Submissions", "numeric"),
    ("ocr_highlights", "OCR Match Hours", "numeric"),
    ("player_roster", "Athlete Roster Size", "numeric"),
    ("pdf_report", "Professional PDF Reports", "boolean"),
    ("ad_free", "Ad-Free Experience", "boolean"),
    ("streak_counters", "Streaks & Milestone Badges", "boolean"),
    ("ai_chat", "AI Coach Chat", "boolean"),
    ("pro_benchmarking", "Pro Benchmarking", "boolean"),
    ("injury_risk_alerts", "Injury Risk Alerts", "boolean"),
    ("scouting_visibility", "Scouting Visibility", "boolean"),
    ("scouting_access", "Scouting Directory Access", "boolean"),
    ("coach_submission_inbox", "Submission Inbox", "boolean"),
    ("video_annotation", "Video Annotation Tools", "boolean"),
    ("player_dashboard", "Multi-Player Dashboard", "boolean"),
    ("csv_export", "CSV Data Export", "boolean"),
    ("white_label_reports", "White-Label Reporting", "boolean"),
    ("priority_processing", "Priority Processing", "boolean"),
    ("training_plans", "Athlete Training Plans", "boolean"),
    ("training_calendar", "Training Schedule Calendar", "boolean"),
    ("leaderboard", "Leaderboard Access", "boolean"),
]

# key, display_name, user_type, price_inr, billing_period, sort_order, {feature: value}
_PLANS = [
    ("bronze", "Bronze", "player", 0, "monthly", 0, {
        "biomechanics_analysis": "3", "player_submission": "0", "streak_counters": "true",
    }),
    ("silver", "Silver", "player", 20000, "monthly", 1, {
        "biomechanics_analysis": "15", "player_submission": "5", "streak_counters": "true",
        "ad_free": "true", "pdf_report": "true", "ai_chat": "true",
    }),
    ("gold", "Gold", "player", 50000, "monthly", 2, {
        "biomechanics_analysis": "50", "player_submission": "15", "streak_counters": "true",
        "ad_free": "true", "pdf_report": "true", "ai_chat": "true",
        "pro_benchmarking": "true", "injury_risk_alerts": "true", "scouting_visibility": "true",
    }),
    ("coach_basic", "Coach Basic", "coach", 0, "annual", 0, {
        "ocr_highlights": "10", "player_submission": "5", "player_roster": "5",
        "player_dashboard": "true", "coach_submission_inbox": "true",
    }),
    ("coach_platinum", "Coach Platinum", "coach", 120000, "annual", 1, {
        "ocr_highlights": "50", "player_submission": "100", "player_roster": "25",
        "player_dashboard": "true", "coach_submission_inbox": "true", "video_annotation": "true",
        "ai_chat": "true", "csv_export": "true", "priority_processing": "true",
        "white_label_reports": "true", "scouting_access": "true", "training_plans": "true",
        "training_calendar": "true", "leaderboard": "true",
    }),
]

# Legacy tier (plan_key/role) → new plan key, for subscriptions.plan_id backfill.
_LEGACY_PLAN_KEY_MAP = {
    "bronze": "bronze", "silver": "silver", "gold": "gold",
    "coach_basic": "coach_basic", "coach_platinum": "coach_platinum",
    # Older keys that may still linger in dev data:
    "free": "bronze", "basic": "silver", "platinum": "gold",
    "coach_free": "coach_basic", "coach_starter": "coach_platinum",
    "coach_pro": "coach_platinum", "academy": "coach_platinum",
    "basic_90d": "silver", "platinum_180d": "gold",
}


def _has_table(inspector, name: str) -> bool:
    return name in set(inspector.get_table_names())


def _drop_role_check(bind) -> None:
    """Drop any CHECK constraint on subscriptions.role (names vary by history)."""
    inspector = sa.inspect(bind)
    try:
        checks = inspector.get_check_constraints("subscriptions")
    except Exception:
        return
    for c in checks:
        name = c.get("name") or ""
        sqltext = (c.get("sqltext") or "").lower()
        if "role" in name.lower() or "role" in sqltext:
            op.drop_constraint(name, "subscriptions", type_="check")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── 1. Create plans ──────────────────────────────────────────────────────
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("user_type", sa.String(length=10), nullable=False),
        sa.Column("price_inr", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("billing_period", sa.String(length=10), nullable=False, server_default="monthly"),
        sa.Column("razorpay_plan_id", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_plans_key"),
        sa.CheckConstraint("user_type IN ('player', 'coach')", name="ck_plans_user_type"),
        sa.CheckConstraint("billing_period IN ('monthly', 'annual')", name="ck_plans_billing_period"),
    )
    op.create_index("ix_plans_key", "plans", ["key"], unique=True)

    # ── 2. Create features ───────────────────────────────────────────────────
    op.create_table(
        "features",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=10), nullable=False, server_default="boolean"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key", name="uq_features_key"),
        sa.CheckConstraint("type IN ('boolean', 'numeric')", name="ck_features_type"),
    )
    op.create_index("ix_features_key", "features", ["key"], unique=True)

    # ── 3. Create plan_entitlements ──────────────────────────────────────────
    op.create_table(
        "plan_entitlements",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("feature_id", sa.Integer(), nullable=False),
        sa.Column("value", sa.String(length=50), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["feature_id"], ["features.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plan_id", "feature_id", name="uq_plan_entitlement_plan_feature"),
    )
    op.create_index("ix_plan_entitlements_plan_id", "plan_entitlements", ["plan_id"])
    op.create_index("ix_plan_entitlements_feature_id", "plan_entitlements", ["feature_id"])

    # ── 4. Create feature_usage ──────────────────────────────────────────────
    op.create_table(
        "feature_usage",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("feature_id", sa.Integer(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("used", sa.Float(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["feature_id"], ["features.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "feature_id", "period_start", name="uq_feature_usage_user_feature_period"),
    )
    op.create_index("ix_feature_usage_user_period", "feature_usage", ["user_id", "period_start"])

    # ── 5. Add subscriptions.plan_id + relax role to a free-form mirror ──────
    op.add_column("subscriptions", sa.Column("plan_id", sa.Integer(), nullable=True))
    op.create_index("ix_subscriptions_plan_id", "subscriptions", ["plan_id"])
    op.create_index("ix_subscriptions_user_status", "subscriptions", ["user_id", "status"])
    # FK added after seeding so backfill can reference seeded plans.

    # role/plan_key are now denormalized mirrors of any (possibly admin-created) plan key, so drop the 5-value CHECK and widen role to VARCHAR(50).
    if bind.dialect.name == "postgresql":
        _drop_role_check(bind)
        op.alter_column(
            "subscriptions", "role",
            existing_type=sa.String(length=14),
            type_=sa.String(length=50),
            existing_nullable=False,
        )

    # ── 6. Seed features ─────────────────────────────────────────────────────
    for key, display_name, ftype in _FEATURES:
        op.execute(
            sa.text(
                "INSERT INTO features (key, display_name, type) VALUES (:k, :d, :t)"
            ).bindparams(k=key, d=display_name, t=ftype)
        )

    # ── 7. Seed plans ────────────────────────────────────────────────────────
    for key, display_name, user_type, price, period, sort_order, _ent in _PLANS:
        op.execute(
            sa.text(
                "INSERT INTO plans (key, display_name, user_type, price_inr, billing_period, is_active, sort_order) "
                "VALUES (:k, :d, :u, :p, :b, :a, :s)"
            ).bindparams(k=key, d=display_name, u=user_type, p=price, b=period, a=True, s=sort_order)
        )

    # ── 8. Seed entitlements ─────────────────────────────────────────────────
    for plan_key, _dn, _ut, _pr, _bp, _so, entitlements in _PLANS:
        for feature_key, value in entitlements.items():
            op.execute(
                sa.text(
                    "INSERT INTO plan_entitlements (plan_id, feature_id, value) "
                    "SELECT p.id, f.id, :v FROM plans p, features f "
                    "WHERE p.key = :pk AND f.key = :fk"
                ).bindparams(v=value, pk=plan_key, fk=feature_key)
            )

    # ── 9. Backfill subscriptions.plan_id from legacy plan_key/role ──────────
    for legacy_key, new_key in _LEGACY_PLAN_KEY_MAP.items():
        op.execute(
            sa.text(
                "UPDATE subscriptions SET plan_id = (SELECT id FROM plans WHERE key = :nk) "
                "WHERE plan_id IS NULL AND (plan_key = :lk OR role = :lk)"
            ).bindparams(nk=new_key, lk=legacy_key)
        )

    # ── 10. Copy monthly_usage → feature_usage ───────────────────────────────
    if _has_table(inspector, "monthly_usage"):
        # year/month → first-of-month date string.  Map each hardcoded column to its feature.  printf/► date construction differs per dialect, so build the period_start with a portable expression.
        dialect = bind.dialect.name
        if dialect == "postgresql":
            period_expr = "make_date(mu.year, mu.month, 1)"
        else:  # sqlite
            period_expr = (
                "date(printf('%04d-%02d-01', mu.year, mu.month))"
            )
        for column, feature_key in (
            ("biomech_count", "biomechanics_analysis"),
            ("ocr_hours_used", "ocr_highlights"),
            ("submission_count", "player_submission"),
        ):
            op.execute(
                sa.text(
                    f"INSERT INTO feature_usage (user_id, feature_id, period_start, used) "
                    f"SELECT mu.user_id, f.id, {period_expr}, mu.{column} "
                    f"FROM monthly_usage mu, features f "
                    f"WHERE f.key = :fk AND mu.{column} <> 0"
                ).bindparams(fk=feature_key)
            )

    # ── 11. Add the FK on subscriptions.plan_id (RESTRICT) ───────────────────
    # SQLite cannot ALTER ADD CONSTRAINT; skip there (dev only).  PostgreSQL is production (Supabase) and gets the real referential guard.
    if bind.dialect.name == "postgresql":
        op.create_foreign_key(
            "fk_subscriptions_plan_id",
            "subscriptions",
            "plans",
            ["plan_id"],
            ["id"],
            ondelete="RESTRICT",
        )

    # ── 12. Drop legacy tables ───────────────────────────────────────────────
    if _has_table(inspector, "monthly_usage"):
        op.drop_table("monthly_usage")
    if _has_table(inspector, "plan_config"):
        op.drop_table("plan_config")


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Recreate plan_config (minimal) so older code can run again.
    op.create_table(
        "plan_config",
        sa.Column("plan_key", sa.String(length=50), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("price_inr", sa.Integer(), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_biomech_per_month", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_ocr_hours_per_month", sa.Float(), nullable=False, server_default="0"),
        sa.Column("max_submissions_per_month", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_players_in_dashboard", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("plan_key"),
    )
    op.create_table(
        "monthly_usage",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("biomech_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ocr_hours_used", sa.Float(), nullable=False, server_default="0"),
        sa.Column("submission_count", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "year", "month", name="uq_monthly_usage_user_year_month"),
    )
    op.create_index("ix_monthly_usage_user_id", "monthly_usage", ["user_id"])

    if dialect == "postgresql":
        op.drop_constraint("fk_subscriptions_plan_id", "subscriptions", type_="foreignkey")
    op.drop_index("ix_subscriptions_user_status", table_name="subscriptions")
    op.drop_index("ix_subscriptions_plan_id", table_name="subscriptions")
    op.drop_column("subscriptions", "plan_id")

    op.drop_index("ix_feature_usage_user_period", table_name="feature_usage")
    op.drop_table("feature_usage")
    op.drop_index("ix_plan_entitlements_feature_id", table_name="plan_entitlements")
    op.drop_index("ix_plan_entitlements_plan_id", table_name="plan_entitlements")
    op.drop_table("plan_entitlements")
    op.drop_index("ix_features_key", table_name="features")
    op.drop_table("features")
    op.drop_index("ix_plans_key", table_name="plans")
    op.drop_table("plans")
