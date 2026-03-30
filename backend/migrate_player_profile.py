"""
Run once to add new columns to player_profiles:
  python migrate_player_profile.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database.config import engine
from sqlalchemy import text

SQLITE_COLUMNS = [
    ("education_type",    "VARCHAR(50)"),
    ("institution_name",  "VARCHAR(255)"),
    ("has_cricket_club",  "BOOLEAN"),
    ("cricket_club_name", "VARCHAR(255)"),
]

POSTGRES_COLUMNS = [
    ("education_type",    "VARCHAR(50)"),
    ("institution_name",  "VARCHAR(255)"),
    ("has_cricket_club",  "BOOLEAN"),
    ("cricket_club_name", "VARCHAR(255)"),
]

with engine.connect() as conn:
    dialect = engine.dialect.name

    if dialect == "sqlite":
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(player_profiles)")).fetchall()}
        for col, col_type in SQLITE_COLUMNS:
            if col not in existing:
                conn.execute(text(f"ALTER TABLE player_profiles ADD COLUMN {col} {col_type}"))
                print(f"[ADDED] {col} ({col_type})")
            else:
                print(f"[EXISTS] {col}")
        conn.commit()
    else:
        for col, col_type in POSTGRES_COLUMNS:
            conn.execute(text(f"ALTER TABLE player_profiles ADD COLUMN IF NOT EXISTS {col} {col_type}"))
            print(f"[OK] {col}")
        conn.commit()

print("Migration complete.")
