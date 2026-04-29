import warnings
warnings.filterwarnings('ignore')
from database.config import SessionLocal
from database.models.user import User
from passlib.context import CryptContext

pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
new_hash = pwd.hash('1234567890')
db = SessionLocal()

# Reset all users to password 1234567890
users = db.query(User).all()
for u in users:
    u.password_hash = new_hash

db.commit()
print(f"Reset passwords for {len(users)} users to: 1234567890")

# Show key accounts
for email in ['admin@test.com', 'coach@test.com', 'player@test.com', 'player@cricket.com']:
    u = db.query(User).filter(User.email==email).first()
    if u:
        print(f"  {u.email} | {u.role}")

db.close()
