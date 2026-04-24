"""
Add article_content column to coach_content table
"""
from database.config import SessionLocal, engine
from sqlalchemy import text

def migrate():
    db = SessionLocal()
    try:
        # Check if column exists
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='coach_content' AND column_name='article_content'
        """))
        
        if result.fetchone() is None:
            print("Adding article_content column...")
            db.execute(text("ALTER TABLE coach_content ADD COLUMN article_content TEXT"))
            db.commit()
            print("✅ Column added successfully!")
        else:
            print("✅ Column already exists!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
