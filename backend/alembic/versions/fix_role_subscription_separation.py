"""fix role and subscription separation

Revision ID: fix_role_subscription
Revises: 9ecb64449fbe
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fix_role_subscription'
down_revision = '9ecb64449fbe'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the CHECK constraint on role column
    op.drop_constraint('ck_users_role_tier_enum', 'users', type_='check')
    
    # Add new user_role column for actual user roles
    op.add_column('users', sa.Column('user_role', sa.String(), nullable=True))
    
    # Migrate data: Map subscription tiers to user roles
    # If subscription_plan exists and contains 'coach', set user_role to 'COACH', else 'PLAYER'
    op.execute("""
        UPDATE users 
        SET user_role = CASE 
            WHEN role IN ('coach_starter', 'coach_pro', 'academy') THEN 'COACH'
            WHEN role IN ('free', 'basic', 'platinum') THEN 'PLAYER'
            WHEN email LIKE '%admin%' THEN 'ADMIN'
            ELSE 'PLAYER'
        END
    """)
    
    # Copy role values to subscription_plan if subscription_plan is NULL or doesn't match
    op.execute("""
        UPDATE users 
        SET subscription_plan = CASE 
            WHEN role IN ('free', 'basic', 'platinum', 'coach_starter', 'coach_pro', 'academy') THEN role
            ELSE COALESCE(subscription_plan, 'free')
        END
    """)
    
    # Drop old role column
    op.drop_column('users', 'role')
    
    # Rename user_role to role
    op.alter_column('users', 'user_role', new_column_name='role')
    
    # Make role NOT NULL
    op.alter_column('users', 'role', nullable=False)
    
    # Add CHECK constraint for proper role values
    op.create_check_constraint(
        'ck_users_role_enum',
        'users',
        "role IN ('PLAYER', 'COACH', 'ADMIN')"
    )
    
    # Make subscription_plan NOT NULL with default
    op.execute("UPDATE users SET subscription_plan = 'free' WHERE subscription_plan IS NULL")
    op.alter_column('users', 'subscription_plan', nullable=False, server_default='free')


def downgrade():
    # Remove role constraint
    op.drop_constraint('ck_users_role_enum', 'users', type_='check')
    
    # Add temp column
    op.add_column('users', sa.Column('old_role', sa.String(), nullable=True))
    
    # Migrate back: use subscription_plan as role
    op.execute("UPDATE users SET old_role = subscription_plan")
    
    # Drop role column
    op.drop_column('users', 'role')
    
    # Rename old_role to role
    op.alter_column('users', 'old_role', new_column_name='role')
    
    # Make role NOT NULL
    op.alter_column('users', 'role', nullable=False)
    
    # Restore old CHECK constraint
    op.create_check_constraint(
        'ck_users_role_tier_enum',
        'users',
        "role IN ('free', 'basic', 'platinum', 'coach_starter', 'coach_pro', 'academy')"
    )
    
    # Make subscription_plan nullable again
    op.alter_column('users', 'subscription_plan', nullable=True, server_default=None)
