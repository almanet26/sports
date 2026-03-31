#!/usr/bin/env python3
"""
Add upvotes/downvotes support to match_requests table

Run this migration script to update the database schema:
    python scripts/migrate_add_upvotes.py
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.config import engine
from sqlalchemy import text

def migrate():
    """Add upvotes, downvotes columns to match_requests and vote_type to user_votes"""
    
    print("Starting migration: Add upvotes/downvotes support...")
    
    with engine.connect() as conn:
        # Check if columns exist
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='match_requests' AND column_name IN ('upvotes', 'downvotes')
        """))
        existing_columns = {row[0] for row in result}
        
        if 'upvotes' not in existing_columns:
            print("  Adding 'upvotes' column to match_requests...")
            conn.execute(text("""
                ALTER TABLE match_requests 
                ADD COLUMN upvotes INTEGER DEFAULT 0
            """))
            conn.commit()
            print("  ✓ Added 'upvotes' column")
        else:
            print("  ⏭ 'upvotes' column already exists")
        
        if 'downvotes' not in existing_columns:
            print("  Adding 'downvotes' column to match_requests...")
            conn.execute(text("""
                ALTER TABLE match_requests 
                ADD COLUMN downvotes INTEGER DEFAULT 0
            """))
            conn.commit()
            print("  ✓ Added 'downvotes' column")
        else:
            print("  ⏭ 'downvotes' column already exists")
        
        # Check user_votes table
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='user_votes' AND column_name='vote_type'
        """))
        has_vote_type = len(list(result)) > 0
        
        if not has_vote_type:
            print("  Adding 'vote_type' column to user_votes...")
            conn.execute(text("""
                ALTER TABLE user_votes 
                ADD COLUMN vote_type VARCHAR(10) DEFAULT 'up'
            """))
            conn.commit()
            print("  ✓ Added 'vote_type' column")
        else:
            print("  ⏭ 'vote_type' column already exists")
        
        # Initialize upvotes from vote_count for existing records
        print("  Initializing upvotes from vote_count...")
        conn.execute(text("""
            UPDATE match_requests 
            SET upvotes = vote_count, downvotes = 0 
            WHERE upvotes = 0 AND downvotes = 0
        """))
        conn.commit()
        print("  ✓ Initialized upvotes/downvotes")
    
    print("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        sys.exit(1)
