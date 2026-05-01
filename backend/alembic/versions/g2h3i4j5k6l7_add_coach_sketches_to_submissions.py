"""add coach_sketches to submissions

Revision ID: g2h3i4j5k6l7
Revises: f2a3b4c5d6e7
Create Date: 2026-04-30 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'g2h3i4j5k6l7'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade():
    # Add coach_sketches column to video_submissions
    op.add_column('video_submissions', sa.Column('coach_sketches', sa.JSON(), nullable=True))


def downgrade():
    # Remove coach_sketches column from video_submissions
    op.drop_column('video_submissions', 'coach_sketches')
