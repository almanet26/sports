"""
Add date_of_birth and years_of_experience columns to users table
"""
from database.config import SessionLocal
from sqlalchemy import text

def add_coach_profile_fields():
    db = SessionLocal()
    try:
        # Add date_of_birth column
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(10)"))
        
        # Add years_of_experience column
        db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS years_of_experience INTEGER"))
        
        db.commit()
        print("Successfully added date_of_birth and years_of_experience columns")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    add_coach_profile_fields()
