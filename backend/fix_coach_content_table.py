"""
Fix coach_id column type in coach_content table
"""
from database.config import SessionLocal
from sqlalchemy import text

def migrate():
    db = SessionLocal()
    try:
        print("Fixing coach_id column type...")
        
        # Drop and recreate the table with correct type
        db.execute(text("DROP TABLE IF EXISTS coach_content CASCADE"))
        db.execute(text("""
            CREATE TABLE coach_content (
                id SERIAL PRIMARY KEY,
                coach_id VARCHAR(36) REFERENCES users(id),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                content_type VARCHAR(20) NOT NULL,
                article_content TEXT,
                file_url VARCHAR(500),
                thumbnail_url VARCHAR(500),
                tags VARCHAR(500),
                views INTEGER DEFAULT 0,
                likes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        
        db.commit()
        print("✅ Table recreated successfully!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
