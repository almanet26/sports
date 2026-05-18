"""
Verify and fix coach_content table schema
"""
from database.config import SessionLocal
from sqlalchemy import text

def verify_and_fix():
    db = SessionLocal()
    try:
        # Check current table structure
        print("Checking current table structure...")
        result = db.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'coach_content'
            ORDER BY ordinal_position
        """))
        
        columns = result.fetchall()
        print("\nCurrent columns:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]}")
        
        # Check if article_content exists
        column_names = [col[0] for col in columns]
        
        if 'article_content' not in column_names:
            print("\n❌ article_content column is MISSING!")
            print("\nDropping and recreating table...")
            
            # Drop and recreate with correct schema
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
            
            # Verify again
            result = db.execute(text("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'coach_content'
                ORDER BY ordinal_position
            """))
            columns = result.fetchall()
            print("\nNew table structure:")
            for col in columns:
                print(f"  - {col[0]}: {col[1]}")
        else:
            print("\n✅ article_content column exists!")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    verify_and_fix()
