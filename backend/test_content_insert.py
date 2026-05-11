"""
Test coach content creation
"""
from database.config import SessionLocal
from database.models.coach_content import CoachContent, ContentType
from sqlalchemy import text

def test_insert():
    db = SessionLocal()
    try:
        # First, check the schema
        print("Checking table schema...")
        result = db.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'coach_content'
            ORDER BY ordinal_position
        """))
        
        columns = result.fetchall()
        print("\nTable columns:")
        for col in columns:
            print(f"  {col[0]}: {col[1]} (nullable: {col[2]})")
        
        # Get a test user ID
        print("\nFetching test user...")
        user_result = db.execute(text("SELECT id, email, role FROM users WHERE role = 'COACH' LIMIT 1"))
        user = user_result.fetchone()
        
        if not user:
            print("ERROR: No coach user found in database")
            return
        
        print(f"Found coach: {user[1]} (ID: {user[0]})")
        
        # Try to create a test content
        print("\nAttempting to create test content...")
        test_content = CoachContent(
            coach_id=user[0],
            title="Test Article",
            description="Test description",
            content_type=ContentType.ARTICLE,
            article_body="This is test content",
            tags="test",
            is_public=True,
            views=0,
            likes=0
        )
        
        db.add(test_content)
        db.commit()
        db.refresh(test_content)
        
        print(f"SUCCESS! Created content with ID: {test_content.id}")
        
        # Clean up
        db.delete(test_content)
        db.commit()
        print("Test content cleaned up")
        
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test_insert()
