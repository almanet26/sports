"""
Add missing tags column to coach_content table
"""
from database.config import SessionLocal
from sqlalchemy import text

def add_tags_column():
    db = SessionLocal()
    try:
        print("Adding tags column to coach_content table...")
        
        # Add tags column
        db.execute(text("""
            ALTER TABLE coach_content 
            ADD COLUMN IF NOT EXISTS tags TEXT
        """))
        
        db.commit()
        print("SUCCESS! Tags column added")
        
        # Verify
        result = db.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'coach_content'
            ORDER BY ordinal_position
        """))
        
        columns = result.fetchall()
        print("\nUpdated table structure:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]}")
            
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    add_tags_column()
