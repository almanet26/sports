"""
Add coach_category column to users table
"""
from database.config import engine
from sqlalchemy import text

def add_coach_category_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN coach_category VARCHAR"))
            conn.commit()
            print("Added coach_category column")
        except Exception as e:
            print(f"coach_category column: {e}")

if __name__ == "__main__":
    add_coach_category_column()
    print("\nMigration completed!")
