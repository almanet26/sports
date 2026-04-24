"""
Check coach content in database
"""
from database.config import SessionLocal
from database.models.coach_content import CoachContent
from sqlalchemy import text

def check_content():
    db = SessionLocal()
    try:
        # Check if table exists
        print("Checking if coach_content table exists...")
        result = db.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'coach_content'
            )
        """))
        exists = result.fetchone()[0]
        
        if not exists:
            print("ERROR: Table does not exist!")
            return
        
        print("SUCCESS: Table exists")
        
        # Count total content
        count = db.query(CoachContent).count()
        print(f"\nTotal content items: {count}")
        
        if count == 0:
            print("\nWARNING: No content found in database!")
            print("You need to upload content as a coach first.")
            return
        
        # Show all content
        contents = db.query(CoachContent).all()
        print("\nContent in database:")
        print("-" * 80)
        for content in contents:
            print(f"ID: {content.id}")
            print(f"Title: {content.title}")
            print(f"Type: {content.content_type}")
            print(f"Coach ID: {content.coach_id}")
            print(f"Public: {content.is_public}")
            print(f"Views: {content.views}")
            print(f"Likes: {content.likes}")
            print(f"Created: {content.created_at}")
            print("-" * 80)
            
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_content()
