"""add_coach_profile_fields

Revision ID: 9ecb64449fbe
Revises: 
Create Date: 2026-03-31 15:18:03.062246

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9ecb64449fbe'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add coach profile fields to users table."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Add gender column (if not exists)
    if 'gender' not in columns:
        op.add_column('users', sa.Column('gender', sa.String(), nullable=True))
    
    # Add coach branding fields (if not exist)
    if 'certifications' not in columns:
        op.add_column('users', sa.Column('certifications', sa.JSON(), nullable=True))
    if 'specialization' not in columns:
        op.add_column('users', sa.Column('specialization', sa.JSON(), nullable=True))
    if 'intro_video_url' not in columns:
        op.add_column('users', sa.Column('intro_video_url', sa.String(), nullable=True))
    if 'profile_image_url' not in columns:
        op.add_column('users', sa.Column('profile_image_url', sa.String(), nullable=True))
    if 'coach_category' not in columns:
        op.add_column('users', sa.Column('coach_category', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema - Remove coach profile fields from users table."""
    # Remove coach branding fields
    op.drop_column('users', 'coach_category')
    op.drop_column('users', 'profile_image_url')
    op.drop_column('users', 'intro_video_url')
    op.drop_column('users', 'specialization')
    op.drop_column('users', 'certifications')
    
    # Remove gender column
    op.drop_column('users', 'gender')
