"""add_player_features

Adds three tables required by Phase 4 player-facing features:
  - chat_history       (AI coaching chat log)
  - pro_benchmarks     (reference pro keypoints, seeded below)
  - player_profiles    (scouting visibility + worker-written stats)

Revision ID: d7e9c3f1a842
Revises: b3b6af7782b4
Create Date: 2026-04-22 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d7e9c3f1a842"
down_revision: Union[str, Sequence[str], None] = "b3b6af7782b4"
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# Seed data for pro_benchmarks
# ---------------------------------------------------------------------------

_BENCH_SEED = [
    # ── Batsmen ─────────────────────────────────────────────────────────────
    {
        "id": "pb-bat-001",
        "pro_name": "Aggressive Top-Order Batsman",
        "role": "batsman",
        "source_video_url": None,
        "keypoints_json": {
            "angles": {
                "front_knee_angle": 158.0,
                "shoulder_rotation": 48.5,
                "head_alignment": 97.2,
                "stride_length": 38.5,
                "backlift_height": 28.3,
                "hip_rotation": 42.0,
                "elbow_angle": 145.0,
            }
        },
    },
    {
        "id": "pb-bat-002",
        "pro_name": "Classical Defensive Batsman",
        "role": "batsman",
        "source_video_url": None,
        "keypoints_json": {
            "angles": {
                "front_knee_angle": 170.5,
                "shoulder_rotation": 35.0,
                "head_alignment": 96.5,
                "stride_length": 25.0,
                "backlift_height": 22.0,
                "hip_rotation": 30.5,
                "elbow_angle": 150.0,
            }
        },
    },
    {
        "id": "pb-bat-003",
        "pro_name": "T20 Power Hitter",
        "role": "batsman",
        "source_video_url": None,
        "keypoints_json": {
            "angles": {
                "front_knee_angle": 145.0,
                "shoulder_rotation": 62.0,
                "head_alignment": 94.0,
                "stride_length": 45.0,
                "backlift_height": 35.0,
                "hip_rotation": 58.0,
                "elbow_angle": 138.0,
            }
        },
    },
    # ── Bowlers ──────────────────────────────────────────────────────────────
    {
        "id": "pb-bowl-001",
        "pro_name": "Right-arm Fast Bowler",
        "role": "bowler",
        "source_video_url": None,
        "keypoints_json": {
            "angles": {
                "elbow_angle": 175.0,
                "shoulder_rotation": 65.0,
                "hip_rotation": 55.0,
                "front_knee_angle": 160.0,
                "back_knee_angle": 145.0,
                "release_consistency": 88.0,
                "wrist_angle": 85.0,
            }
        },
    },
    {
        "id": "pb-bowl-002",
        "pro_name": "Right-arm Off-spin Bowler",
        "role": "bowler",
        "source_video_url": None,
        "keypoints_json": {
            "angles": {
                "elbow_angle": 165.0,
                "shoulder_rotation": 45.0,
                "hip_rotation": 40.0,
                "front_knee_angle": 155.0,
                "back_knee_angle": 150.0,
                "release_consistency": 78.0,
                "wrist_angle": 72.0,
            }
        },
    },
]


# ---------------------------------------------------------------------------
# Upgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    # ── chat_history ─────────────────────────────────────────────────────────
    op.create_table(
        "chat_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("session_id", sa.String(100), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_chat_history_user_session_created",
        "chat_history",
        ["user_id", "session_id", "created_at"],
    )

    # ── pro_benchmarks ───────────────────────────────────────────────────────
    op.create_table(
        "pro_benchmarks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("pro_name", sa.String(150), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("keypoints_json", sa.JSON, nullable=False),
        sa.Column("source_video_url", sa.String(512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )

    # Seed benchmark rows
    bench_table = sa.table(
        "pro_benchmarks",
        sa.column("id", sa.String),
        sa.column("pro_name", sa.String),
        sa.column("role", sa.String),
        sa.column("keypoints_json", sa.JSON),
        sa.column("source_video_url", sa.String),
    )
    op.bulk_insert(bench_table, _BENCH_SEED)

    # ── player_profiles ──────────────────────────────────────────────────────
    op.create_table(
        "player_profiles",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("display_name", sa.String(150), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("bat_style", sa.String(50), nullable=True),
        sa.Column("bowl_style", sa.String(80), nullable=True),
        sa.Column("avg_bat_speed", sa.Float, nullable=True),
        sa.Column("peak_bat_speed", sa.Float, nullable=True),
        sa.Column("avg_release_height", sa.Float, nullable=True),
        sa.Column("avg_wrist_speed", sa.Float, nullable=True),
        sa.Column(
            "scouting_visible",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )


# ---------------------------------------------------------------------------
# Downgrade
# ---------------------------------------------------------------------------

def downgrade() -> None:
    op.drop_table("player_profiles")
    op.drop_index("ix_chat_history_user_session_created", table_name="chat_history")
    op.drop_table("pro_benchmarks")
    op.drop_table("chat_history")