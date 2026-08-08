"""add split boundaries/wickets supercut paths to highlight_jobs

Revision ID: j4k5l6m7n8o9
Revises: a1d2e3f4c5b6
Create Date: 2026-07-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'j4k5l6m7n8o9'
down_revision = 'a1d2e3f4c5b6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('highlight_jobs', sa.Column('boundaries_supercut_path', sa.String(500), nullable=True))
    op.add_column('highlight_jobs', sa.Column('wickets_supercut_path', sa.String(500), nullable=True))


def downgrade():
    op.drop_column('highlight_jobs', 'wickets_supercut_path')
    op.drop_column('highlight_jobs', 'boundaries_supercut_path')
