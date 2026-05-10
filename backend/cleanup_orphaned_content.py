"""
Clean up orphaned coach content records where files don't exist
"""
import os
from database.config import SessionLocal
from database.models.coach_content import CoachContent

def cleanup_orphaned_content():
    db = SessionLocal()
    try:
        # Get all content records
        all_content = db.query(CoachContent).all()
        
        deleted_count = 0
        for content in all_content:
            # Skip articles (no file)
            if content.content_type == 'article':
                continue
            
            # Check if file exists
            if content.file_url:
                # Convert URL to file path
                if content.file_url.startswith('/static/'):
                    file_path = content.file_url.replace('/static/', 'storage/')
                    file_path = file_path.replace('/', os.sep)
                    
                    if not os.path.exists(file_path):
                        print(f"Deleting orphaned record: {content.id} - {content.title}")
                        print(f"  Missing file: {file_path}")
                        db.delete(content)
                        deleted_count += 1
        
        db.commit()
        print(f"\nCleanup complete. Deleted {deleted_count} orphaned records.")
        
    except Exception as e:
        db.rollback()
        print(f"Error during cleanup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    print("Starting cleanup of orphaned coach content records...")
    cleanup_orphaned_content()
