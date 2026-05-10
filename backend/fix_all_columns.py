"""
Add all missing columns to coach_content table
"""
from database.config import SessionLocal
from sqlalchemy import text

def fix_all_columns():
    db = SessionLocal()
    try:
        print("Adding missing columns to coach_content table...")
        
        # Add likes column
        db.execute(text("""
            ALTER TABLE coach_content 
            ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0
        """))
        
        db.commit()
        print("SUCCESS! All missing columns added")
        
        # Verify final structure
        result = db.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'coach_content'
            ORDER BY ordinal_position
        """))
        
        columns = result.fetchall()
        print("\nFinal table structure:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]} (nullable: {col[2]})")
            
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_all_columns()
