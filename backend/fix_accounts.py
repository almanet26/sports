import warnings
warnings.filterwarnings('ignore')
from database.config import SessionLocal
from database.models.user import User
from passlib.context import CryptContext

pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
new_hash = pwd.hash('1234567890')
db = SessionLocal()

accounts = [
    ('admin@test.com', 'ADMIN'),
    ('coach@test.com', 'COACH'),
    ('player@test.com', 'PLAYER'),
]

for email, role in accounts:
    u = db.query(User).filter(User.email == email).first()
    if u:
        u.password_hash = new_hash
        u.role = role
        u.is_active = True
        print(f"Updated: {email} | {role}")
    else:
        # Create if not exists
        u = User(
            email=email,
            name=email.split('@')[0].replace('.', ' ').title(),
            role=role,
            password_hash=new_hash,
            is_active=True,
            is_verified=True,
            subscription_plan='BASIC',
            coach_status='verified' if role == 'COACH' else None,
        )
        db.add(u)
        print(f"Created: {email} | {role}")

db.commit()
db.close()
print("Done - all 3 accounts ready with password: 1234567890")
