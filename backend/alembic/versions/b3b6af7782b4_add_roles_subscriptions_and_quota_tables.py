"""add_roles_subscriptions_and_quota_tables

Revision ID: b3b6af7782b4
Revises: 9ecb64449fbe
Create Date: 2026-04-16 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b3b6af7782b4"
down_revision: Union[str, Sequence[str], None] = "9ecb64449fbe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLE_VALUES = (
    "free",
    "coach_free",
    "basic",
    "platinum",
    "coach_starter",
    "coach_pro",
    "academy",
)

STATUS_VALUES = (
    "active",
    "inactive",
    "past_due",
    "expired",
)


def _role_in_sql() -> str:
    return ", ".join(f"'{value}'" for value in ROLE_VALUES)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "users" in table_names:
        # Drop legacy role checks so the new tier role check can be applied safely.
        for check in inspector.get_check_constraints("users"):
            check_name = check.get("name")
            sql_text = (check.get("sqltext") or "").lower()
            if check_name and "role" in sql_text:
                op.drop_constraint(check_name, "users", type_="check")

        op.execute(
            f"UPDATE users SET role = 'free' WHERE role IS NULL OR role NOT IN ({_role_in_sql()})"
        )
        op.execute("UPDATE users SET is_active = true WHERE is_active IS NULL")

        op.alter_column(
            "users",
            "role",
            existing_type=sa.String(),
            type_=sa.Enum(*ROLE_VALUES, name="user_role_enum", native_enum=False),
            nullable=False,
            server_default="free",
        )
        op.alter_column(
            "users",
            "is_active",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        )
        op.create_check_constraint(
            "ck_users_role_tier_enum",
            "users",
            "role IN ('free', 'coach_free', 'basic', 'platinum', 'coach_starter', 'coach_pro', 'academy')",
        )

    # Replace any legacy subscriptions table with the target schema.
    if "subscriptions" in table_names:
        op.drop_table("subscriptions")
        # Refresh inspector after drop to reflect latest state
        inspector = sa.inspect(op.get_bind())
        table_names = set(inspector.get_table_names())

    if "subscriptions" not in table_names:
        op.create_table(
            "subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("plan_key", sa.String(length=50), nullable=False),
        sa.Column(
            "role",
            sa.Enum(*ROLE_VALUES, name="subscription_role_enum", native_enum=False),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum(*STATUS_VALUES, name="subscription_status_enum", native_enum=False),
            nullable=False,
            server_default="inactive",
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("razorpay_order_id", sa.String(length=255), nullable=True),
        sa.Column("razorpay_payment_id", sa.String(length=255), nullable=True),
        sa.Column("razorpay_customer_id", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_subscriptions_user_id"),
        )
        op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"], unique=False)

    if "monthly_usage" not in table_names:
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
        op.create_index("ix_monthly_usage_user_id", "monthly_usage", ["user_id"], unique=False)

    if "plan_config" not in table_names:
        op.create_table(
            "plan_config",
            sa.Column("plan_key", sa.String(length=50), nullable=False),
            sa.Column(
                "role",
                sa.Enum(*ROLE_VALUES, name="plan_config_role_enum", native_enum=False),
                nullable=False,
            ),
            sa.Column("display_name", sa.String(length=100), nullable=False),
            sa.Column("price_inr", sa.Integer(), nullable=False),
            sa.Column("duration_days", sa.Integer(), nullable=False),
            sa.Column("max_biomech_per_month", sa.Integer(), nullable=False),
            sa.Column("max_ocr_hours_per_month", sa.Float(), nullable=False),
            sa.Column("max_submissions_per_month", sa.Integer(), nullable=False),
            sa.Column("max_players_in_dashboard", sa.Integer(), nullable=False),
            sa.PrimaryKeyConstraint("plan_key"),
        )

    # Always ensure plan_config has all required rows (using raw SQL for reliability)
    op.execute("DELETE FROM plan_config")
    
    op.execute("""
        INSERT INTO plan_config (plan_key, role, display_name, price_inr, duration_days, max_biomech_per_month, max_ocr_hours_per_month, max_submissions_per_month, max_players_in_dashboard)
        VALUES
        ('free', 'free', 'Free', 0, 36500, 3, 0.0, 0, 0),
        ('coach_free', 'coach_free', 'Coach Free', 0, 36500, 0, 0.0, 0, 0),
        ('basic', 'basic', 'Basic', 20000, 90, 15, 0.0, 5, 0),
        ('platinum', 'platinum', 'Platinum', 50000, 365, 50, 0.0, 0, 0),
        ('coach_starter', 'coach_starter', 'Coach Starter', 199900, 90, 999, 50.0, 150, 10),
        ('coach_pro', 'coach_pro', 'Coach Pro', 499900, 180, 999, 150.0, 600, 0),
        ('academy', 'academy', 'Academy', 1499900, 365, 999, 500.0, 1500, 0)
    """)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "plan_config" in table_names:
        op.drop_table("plan_config")

    if "monthly_usage" in table_names:
        op.drop_index("ix_monthly_usage_user_id", table_name="monthly_usage")
        op.drop_table("monthly_usage")

    if "subscriptions" in table_names:
        op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
        op.drop_table("subscriptions")

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("plan_id", sa.Integer(), nullable=True),
        sa.Column("start_date", sa.DateTime(), nullable=True),
        sa.Column("end_date", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    # Remove the tier role check and revert role to plain string.
    user_checks = {c.get("name") for c in inspector.get_check_constraints("users") if c.get("name")}
    if "ck_users_role_tier_enum" in user_checks:
        op.drop_constraint("ck_users_role_tier_enum", "users", type_="check")

    op.alter_column(
        "users",
        "role",
        existing_type=sa.Enum(*ROLE_VALUES, name="user_role_enum", native_enum=False),
        type_=sa.String(),
        nullable=False,
        server_default=None,
    )
    op.alter_column(
        "users",
        "is_active",
        existing_type=sa.Boolean(),
        nullable=True,
        server_default=None,
    )
