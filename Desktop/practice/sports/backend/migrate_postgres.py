"""
PostgreSQL migration to add youtube_url column to match_requests table.
Run this script to update the production database.
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def main():
    print(f"Connecting to PostgreSQL database...")
    
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Check if youtube_url column exists
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'match_requests' AND column_name = 'youtube_url'
    """)
    
    if cursor.fetchone():
        print("youtube_url column already exists!")
    else:
        print("Adding youtube_url column to match_requests...")
        cursor.execute("""
            ALTER TABLE match_requests 
            ADD COLUMN youtube_url VARCHAR(500)
        """)
        print("youtube_url column added successfully!")
    
    # Make match_title nullable if it's not already
    cursor.execute("""
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'match_requests' AND column_name = 'match_title'
    """)
    result = cursor.fetchone()
    if result and result[0] == 'NO':
        print("Making match_title nullable...")
        cursor.execute("""
            ALTER TABLE match_requests 
            ALTER COLUMN match_title DROP NOT NULL
        """)
        print("match_title is now nullable!")
    else:
        print("match_title is already nullable or doesn't exist")
    
    # Verify the changes
    cursor.execute("""
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'match_requests'
        ORDER BY ordinal_position
    """)
    
    print("\nCurrent match_requests schema:")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} {'NULL' if row[2] == 'YES' else 'NOT NULL'}")
    
    cursor.close()
    conn.close()
    print("\nMigration complete!")

if __name__ == '__main__':
    main()
