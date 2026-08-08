"""enable row level security on public tables exposed via Supabase PostgREST

Revision ID: k7l8m9n0o1p2
Revises: j4k5l6m7n8o9
Create Date: 2026-07-30 00:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'k7l8m9n0o1p2'
down_revision = 'j4k5l6m7n8o9'
branch_labels = None
depends_on = None

# Tables flagged by Supabase's linter as publicly reachable via the auto-generated PostgREST API with RLS disabled. The app itself never talks to Postgres through PostgREST (it connects directly via DATABASE_URL as the table owner, which RLS does not restrict), so enabling RLS with no policies fully closes the anon/authenticated PostgREST path without touching app behavior.
TABLES = [
    "player_badges",
    "password_reset_requests",
    "player_streaks",
    "coach_shortlist",
    "plans",
    "plan_entitlements",
    "features",
    "feature_usage",
]


def upgrade():
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" ENABLE ROW LEVEL SECURITY;')


def downgrade():
    for table in TABLES:
        op.execute(f'ALTER TABLE public."{table}" DISABLE ROW LEVEL SECURITY;')
