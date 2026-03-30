"""
Seed script to insert test users with properly hashed passwords.

Run this AFTER the schema has been created:
    python database/seed_users.py
"""

import sys
import uuid
from datetime import datetime
from sqlalchemy import text
from database.config import SessionLocal
from utils.auth import get_password_hash

# Test users
TEST_USERS = [
    {
        "role": "ADMIN",
        "name": "Platform Admin",
        "email": "admin@test.com",
        "password": "1234567890",
    },
    {
        "role": "COACH",
        "name": "Coach User",
        "email": "coach@test.com",
        "password": "1234567890",
    },
    {
        "role": "PLAYER",
        "name": "Player User",
        "email": "player@test.com",
        "password": "1234567890",
    },
]


def seed_users():
    """Insert test users into database."""
    db = SessionLocal()
    
    try:
        for user_data in TEST_USERS:
            # Check if user already exists
            existing = db.execute(
                text("SELECT id FROM users WHERE email = :email"),
                {"email": user_data["email"]}
            ).fetchone()
            
            if existing:
                print(f"⏭️  Skipping {user_data['email']} (already exists)")
                continue
            
            # Hash password
            password_hash = get_password_hash(user_data["password"])
            
            # Insert user
            user_id = str(uuid.uuid4())
            db.execute(
                text("""
                    INSERT INTO users 
                    (id, role, name, email, password_hash, is_active, is_verified, created_at)
                    VALUES (:id, :role, :name, :email, :password_hash, :is_active, :is_verified, :created_at)
                """),
                {
                    "id": user_id,
                    "role": user_data["role"],
                    "name": user_data["name"],
                    "email": user_data["email"],
                    "password_hash": password_hash,
                    "is_active": True,
                    "is_verified": True,
                    "created_at": datetime.utcnow(),
                }
            )
            db.commit()
            
            print(f"✅ Inserted {user_data['role']:6} | {user_data['email']:20} | Password: {user_data['password']}")
        
        print("\n🎉 Seeding complete!")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = seed_users()
    sys.exit(0 if success else 1)
