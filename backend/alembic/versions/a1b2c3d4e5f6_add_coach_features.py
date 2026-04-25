"""add_coach_features

Phase 5 coach-facing tables:
  - video_annotations   (coach video markup tool)
  - coach_players       (private multi-player roster)
  - player_submissions  (lightweight player → coach job inbox)
  - academy_branding    (white-label PDF branding config)

Revision ID: a1b2c3d4e5f6
Revises: f1e2d3c4b5a6
Create Date: 2026-04-24 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f1e2d3c4b5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # ── video_annotations ────────────────────────────────────────────────────
    op.create_table(
        "video_annotations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "video_id",
            sa.String(36),
            sa.ForeignKey("videos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "coach_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("timestamp_ms", sa.Integer, nullable=False),
        sa.Column("annotation_type", sa.String(20), nullable=False),
        sa.Column("coordinates", sa.JSON, nullable=False),
        sa.Column("label", sa.String(500), nullable=True),
        sa.Column("color", sa.String(20), nullable=False, server_default="#FF0000"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_video_annotations_video_id", "video_annotations", ["video_id"])
    op.create_index("ix_video_annotations_coach_id", "video_annotations", ["coach_id"])

    # ── coach_players ─────────────────────────────────────────────────────────
    op.create_table(
        "coach_players",
        sa.Column("coach_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("player_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("coach_id", "player_id"),
    )
    op.create_index("ix_coach_players_coach_id", "coach_players", ["coach_id"])

    # ── player_submissions ────────────────────────────────────────────────────
    # Create enum type for PostgreSQL
    if dialect == "postgresql":
        op.execute(
            sa.text(
                "CREATE TYPE player_submission_status_enum AS ENUM "
                "('pending', 'reviewed', 'dismissed')"
            )
        )

    op.create_table(
        "player_submissions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "player_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "coach_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("highlight_jobs.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_player_submissions_player_id", "player_submissions", ["player_id"])
    op.create_index("ix_player_submissions_coach_id", "player_submissions", ["coach_id"])
    op.create_index("ix_player_submissions_status", "player_submissions", ["status"])

    # ── academy_branding ──────────────────────────────────────────────────────
    op.create_table(
        "academy_branding",
        sa.Column(
            "academy_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("logo_gcs_path", sa.String(512), nullable=True),
        sa.Column("primary_color", sa.String(20), nullable=False, server_default="#1a73e8"),
        sa.Column("report_footer_text", sa.Text, nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.drop_table("academy_branding")
    op.drop_index("ix_player_submissions_status", table_name="player_submissions")
    op.drop_index("ix_player_submissions_coach_id", table_name="player_submissions")
    op.drop_index("ix_player_submissions_player_id", table_name="player_submissions")
    op.drop_table("player_submissions")

    if dialect == "postgresql":
        op.execute(sa.text("DROP TYPE IF EXISTS player_submission_status_enum"))

    op.drop_index("ix_coach_players_coach_id", table_name="coach_players")
    op.drop_table("coach_players")

    op.drop_index("ix_video_annotations_coach_id", table_name="video_annotations")
    op.drop_index("ix_video_annotations_video_id", table_name="video_annotations")
    op.drop_table("video_annotations")