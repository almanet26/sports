"""merge chat and coach sketch heads

Revision ID: 4372a1fe7fff
Revises: c3d4e5f6a7b8, g2h3i4j5k6l7
Create Date: 2026-04-30 11:37:06.889389

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4372a1fe7fff'
down_revision: Union[str, Sequence[str], None] = ('c3d4e5f6a7b8', 'g2h3i4j5k6l7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
