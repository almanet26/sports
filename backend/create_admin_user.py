"""
Create admin user.
"""

import uuid
from database.models.user import User
from database.config import SessionLocal

def create_admin():
    db = SessionLocal()
    try:
        # Check if admin exists
        existing = db.query(User).filter(User.email == 'admin@sportvision.com').first()
        if existing:
            print("❌ Admin already exists: admin@sportvision.com")
            print("Updating password...")
            existing.set_password('Admin@123')
            existing.role = 'ADMIN'
            existing.coach_verification_status = 'APPROVED'
            db.commit()
            print("✅ Admin password updated!")
        else:
            # Create new admin
            admin = User(
                id=str(uuid.uuid4()),
                email='admin@sportvision.com',
                name='Admin User',
                role='ADMIN',
                coach_verification_status='APPROVED'
            )
            admin.set_password('Admin@123')
            
            db.add(admin)
            db.commit()
            print("✅ Admin user created!")
        
        print("\nLogin credentials:")
        print("  Email: admin@sportvision.com")
        print("  Password: Admin@123")
        print("\nGo to: http://localhost:5173/login")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
