"""
Add profile_image_url column to users table
"""
from database.config import engine
from sqlalchemy import text

def add_profile_image_column():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN profile_image_url VARCHAR"))
            conn.commit()
            print("Added profile_image_url column")
        except Exception as e:
            print(f"profile_image_url column: {e}")

if __name__ == "__main__":
    add_profile_image_column()
    print("\nMigration completed!")
