"""add_admin_audit_log

Adds the admin_audit_log table for tracking all admin actions (plan edits,
subscription overrides, impersonation).

Revision ID: f2a3b4c5d6e7
Revises: e9f1a2b3c4d5
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa

revision = "f2a3b4c5d6e7"
down_revision = "e9f1a2b3c4d5"
branch_labels = None
depends_on = None


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


def _index_exists(index: str) -> bool:
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :i"),
        {"i": index},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    if not _table_exists("admin_audit_log"):
        op.create_table(
            "admin_audit_log",
            sa.Column("id", sa.String(36), primary_key=True, nullable=False),
            sa.Column(
                "admin_id",
                sa.String(36),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("action", sa.String(100), nullable=False),
            sa.Column("target_type", sa.String(50), nullable=False),
            sa.Column("target_id", sa.String(255), nullable=True),
            sa.Column("before_value", sa.JSON, nullable=True),
            sa.Column("after_value", sa.JSON, nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    if not _index_exists("ix_admin_audit_log_admin_id"):
        op.create_index(
            "ix_admin_audit_log_admin_id",
            "admin_audit_log",
            ["admin_id"],
        )
    if not _index_exists("ix_admin_audit_log_created_at"):
        op.create_index(
            "ix_admin_audit_log_created_at",
            "admin_audit_log",
            ["created_at"],
        )


def downgrade() -> None:
    op.drop_index("ix_admin_audit_log_created_at", table_name="admin_audit_log")
    op.drop_index("ix_admin_audit_log_admin_id", table_name="admin_audit_log")
    op.drop_table("admin_audit_log")
