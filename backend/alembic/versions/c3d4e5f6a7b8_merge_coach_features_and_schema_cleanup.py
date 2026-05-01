"""merge coach features and schema cleanup

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6, a4c8d1e2f903
Create Date: 2026-04-28
"""

from typing import Sequence, Union


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = (
    "a1b2c3d4e5f6",
    "a4c8d1e2f903",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass