"""
Add coach branding columns to users table
"""
from database.config import engine
from sqlalchemy import text

def add_coach_branding_columns():
    with engine.connect() as conn:
        # Add certifications column
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN certifications JSON"))
            conn.commit()
            print("✓ Added certifications column")
        except Exception as e:
            print(f"certifications column: {e}")
        
        # Add specialization column
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN specialization JSON"))
            conn.commit()
            print("✓ Added specialization column")
        except Exception as e:
            print(f"specialization column: {e}")
        
        # Add intro_video_url column
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN intro_video_url VARCHAR"))
            conn.commit()
            print("✓ Added intro_video_url column")
        except Exception as e:
            print(f"intro_video_url column: {e}")

if __name__ == "__main__":
    add_coach_branding_columns()
    print("\nMigration completed!")
