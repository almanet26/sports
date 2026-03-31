"""
Add gender column to users table
"""
from database.config import engine
from sqlalchemy import text

def add_gender_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR"))
            conn.commit()
            print("Added gender column")
        except Exception as e:
            print(f"gender column: {e}")

if __name__ == "__main__":
    add_gender_column()
    print("\nMigration completed!")
