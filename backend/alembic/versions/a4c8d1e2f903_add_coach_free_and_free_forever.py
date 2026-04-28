"""add_coach_free_and_free_forever

Revision ID: a4c8d1e2f903
Revises: f2a3b4c5d6e7
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa


revision = "a4c8d1e2f903"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Ensure check constraints allow the new coach_free tier in plan/subscription role columns.
    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE table_name='plan_config' AND constraint_name='plan_config_role_enum'
              ) THEN
                ALTER TABLE plan_config DROP CONSTRAINT plan_config_role_enum;
              END IF;
            END $$;
            """
        )
    )
    conn.execute(
        sa.text(
            """
            ALTER TABLE plan_config
            ADD CONSTRAINT plan_config_role_enum
            CHECK (role IN ('free','coach_free','basic','platinum','coach_starter','coach_pro','academy'));
            """
        )
    )

    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE table_name='subscriptions' AND constraint_name='subscription_role_enum'
              ) THEN
                ALTER TABLE subscriptions DROP CONSTRAINT subscription_role_enum;
              END IF;
            END $$;
            """
        )
    )
    conn.execute(
        sa.text(
            """
            ALTER TABLE subscriptions
            ADD CONSTRAINT subscription_role_enum
            CHECK (role IN ('free','coach_free','basic','platinum','coach_starter','coach_pro','academy'));
            """
        )
    )

    # 1) Add missing coach_free plan.
    conn.execute(
        sa.text(
            """
            INSERT INTO plan_config (
              plan_key, role, display_name, price_inr, duration_days,
              max_biomech_per_month, max_ocr_hours_per_month,
              max_submissions_per_month, max_players_in_dashboard
            )
            VALUES (
              'coach_free', 'coach_free', 'Coach Free', 0, 36500,
              0, 0, 0, 0
            )
            ON CONFLICT (plan_key) DO UPDATE SET
              role = EXCLUDED.role,
              display_name = EXCLUDED.display_name,
              price_inr = EXCLUDED.price_inr,
              duration_days = EXCLUDED.duration_days,
              max_biomech_per_month = EXCLUDED.max_biomech_per_month,
              max_ocr_hours_per_month = EXCLUDED.max_ocr_hours_per_month,
              max_submissions_per_month = EXCLUDED.max_submissions_per_month,
              max_players_in_dashboard = EXCLUDED.max_players_in_dashboard;
            """
        )
    )

    # 2) Free tiers are effectively never-expiring.
    conn.execute(
        sa.text(
            """
            UPDATE plan_config
            SET duration_days = 36500
            WHERE plan_key IN ('free', 'coach_free');
            """
        )
    )


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        sa.text(
            """
            UPDATE plan_config
            SET duration_days = 90
            WHERE plan_key = 'free';
            """
        )
    )
    conn.execute(
        sa.text(
            """
            DELETE FROM plan_config
            WHERE plan_key = 'coach_free';
            """
        )
    )

    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE table_name='plan_config' AND constraint_name='plan_config_role_enum'
              ) THEN
                ALTER TABLE plan_config DROP CONSTRAINT plan_config_role_enum;
              END IF;
            END $$;
            """
        )
    )
    conn.execute(
        sa.text(
            """
            ALTER TABLE plan_config
            ADD CONSTRAINT plan_config_role_enum
            CHECK (role IN ('free','basic','platinum','coach_starter','coach_pro','academy'));
            """
        )
    )

    conn.execute(
        sa.text(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1
                FROM information_schema.table_constraints
                WHERE table_name='subscriptions' AND constraint_name='subscription_role_enum'
              ) THEN
                ALTER TABLE subscriptions DROP CONSTRAINT subscription_role_enum;
              END IF;
            END $$;
            """
        )
    )
    conn.execute(
        sa.text(
            """
            ALTER TABLE subscriptions
            ADD CONSTRAINT subscription_role_enum
            CHECK (role IN ('free','basic','platinum','coach_starter','coach_pro','academy'));
            """
        )
    )
