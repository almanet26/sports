from database.config import SessionLocal
from database.models.user import User
from utils.auth import get_password_hash

db = SessionLocal()

admin_email = "admin@sports.com"
admin_password = "Admin@123"

existing = db.query(User).filter(User.email == admin_email).first()
if existing:
    print(f"Admin user already exists: {admin_email}")
else:
    admin = User(
        email=admin_email,
        password_hash=get_password_hash(admin_password),
        name="Admin User",
        role="ADMIN",
        is_verified=True
    )
    db.add(admin)
    db.commit()
    print(f"Admin user created: {admin_email}")
    print(f"Password: {admin_password}")

db.close()
