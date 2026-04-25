"""
Migration script to update matches table schema.
Run this to migrate existing matches table to new schema.
"""

from database.config import engine
from sqlalchemy import text

def migrate_matches_table():
    """Migrate matches table to new schema."""
    
    with engine.connect() as conn:
        # Drop old table if exists
        conn.execute(text("DROP TABLE IF EXISTS matches CASCADE"))
        conn.commit()
        
        # Create new matches table with updated schema
        conn.execute(text("""
            CREATE TABLE matches (
                id SERIAL PRIMARY KEY,
                created_by VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                opponent VARCHAR NOT NULL,
                match_type VARCHAR NOT NULL,
                match_status VARCHAR DEFAULT 'Upcoming',
                match_date VARCHAR NOT NULL,
                match_time VARCHAR NOT NULL,
                venue VARCHAR NOT NULL,
                location_type VARCHAR DEFAULT 'Home',
                player_role VARCHAR,
                notes TEXT,
                statistics JSONB,
                reminder VARCHAR,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE
            )
        """))
        conn.commit()
        
        # Create indexes
        conn.execute(text("CREATE INDEX idx_matches_created_by ON matches(created_by)"))
        conn.execute(text("CREATE INDEX idx_matches_date ON matches(match_date)"))
        conn.commit()
        
        print("✅ Matches table migrated successfully!")

if __name__ == "__main__":
    migrate_matches_table()
