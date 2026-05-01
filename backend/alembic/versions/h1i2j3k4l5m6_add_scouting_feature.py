"""add_scouting_feature

Extends player_profiles with scouting-relevant columns and creates the
coach_shortlist table so coaches can bookmark players.

Revision ID: h1i2j3k4l5m6
Revises: 4372a1fe7fff
Create Date: 2026-04-30 18:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h1i2j3k4l5m6"
down_revision: Union[str, Sequence[str], None] = "4372a1fe7fff"
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# Upgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    # ── Extend player_profiles ───────────────────────────────────────────────
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "sqlite":
        # SQLite does not support ADD COLUMN IF NOT EXISTS — use pragma
        cols = {row[1].lower() for row in bind.execute(sa.text("PRAGMA table_info(player_profiles)")).fetchall()}

        new_cols = [
            ("age",                      "INTEGER"),
            ("state",                    "VARCHAR(100)"),
            ("cricket_role",             "VARCHAR(30)"),
            ("experience_level",         "VARCHAR(30)"),
            ("preferred_format",         "VARCHAR(10)"),
            ("total_analyses",           "INTEGER DEFAULT 0"),
            ("profile_image_url",        "VARCHAR(500)"),
            ("best_front_knee_angle",    "DOUBLE PRECISION"),
            ("best_shoulder_rotation",   "DOUBLE PRECISION"),
            ("best_elbow_angle",         "DOUBLE PRECISION"),
            ("best_release_consistency", "DOUBLE PRECISION"),
            ("analyses_last_updated",    "TIMESTAMP WITH TIME ZONE"),
        ]
        for col_name, col_type in new_cols:
            if col_name not in cols:
                bind.execute(sa.text(
                    f"ALTER TABLE player_profiles ADD COLUMN {col_name} {col_type}"
                ))
    else:
        # PostgreSQL supports ADD COLUMN IF NOT EXISTS
        pg_stmts = [
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS age INTEGER",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS state VARCHAR(100)",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS cricket_role VARCHAR(30) "
            "CHECK (cricket_role IN ('batsman','bowler','all_rounder','wicket_keeper'))",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS experience_level VARCHAR(30) "
            "CHECK (experience_level IN ('beginner','intermediate','advanced','professional'))",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS preferred_format VARCHAR(10) "
            "CHECK (preferred_format IN ('T20','ODI','Test','All'))",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS total_analyses INTEGER DEFAULT 0",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500)",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS best_front_knee_angle DOUBLE PRECISION",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS best_shoulder_rotation DOUBLE PRECISION",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS best_elbow_angle DOUBLE PRECISION",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS best_release_consistency DOUBLE PRECISION",
            "ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS analyses_last_updated TIMESTAMPTZ",
        ]
        for stmt in pg_stmts:
            op.execute(stmt)

        # Partial index for scouting directory queries (PostgreSQL only)
        op.execute(
            "CREATE INDEX IF NOT EXISTS idx_player_profiles_scouting "
            "ON player_profiles (city, cricket_role, experience_level, analyses_last_updated) "
            "WHERE scouting_visible = true"
        )

    # ── coach_shortlist ──────────────────────────────────────────────────────
    tables = sa.inspect(bind).get_table_names()
    if "coach_shortlist" not in tables:
        op.create_table(
            "coach_shortlist",
            sa.Column(
                "coach_id",
                sa.String(36),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "player_id",
                sa.String(36),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("note", sa.Text, nullable=True),
            sa.Column(
                "added_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.PrimaryKeyConstraint("coach_id", "player_id"),
        )
        op.create_index(
            "ix_coach_shortlist_coach_id",
            "coach_shortlist",
            ["coach_id"],
        )


# ---------------------------------------------------------------------------
# Downgrade
# ---------------------------------------------------------------------------

def downgrade() -> None:
    op.drop_index("ix_coach_shortlist_coach_id", table_name="coach_shortlist")
    op.drop_table("coach_shortlist")

    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect != "sqlite":
        op.execute("DROP INDEX IF EXISTS idx_player_profiles_scouting")

    # Note: Dropping individual columns from player_profiles is intentionally
    # omitted for safety. If required, handle per dialect.
