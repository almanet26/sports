"""
Production Seed Script - Insert Admin and Player users directly into database.

This script bypasses the API and inserts users directly into the database.
Useful for emergency access or when the API registration is broken.

Usage:
    cd backend
    python scripts/seed_prod_users.py

Requirements:
    - DATABASE_URL must be set in .env
    - Tables must already exist
"""

import sys
import os
import uuid
from datetime import datetime

# Add backend root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from passlib.context import CryptContext
from database.config import SessionLocal
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Password hashing (same config as the app)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return pwd_context.hash(password)


# Production users to seed
PROD_USERS = [
    {
        "role": "ADMIN",
        "name": "Admin User",
        "email": "admin@cricket.com",
        "password": "1234567890",
    },
    {
        "role": "PLAYER",
        "name": "Player User",
        "email": "player@cricket.com",
        "password": "1234567890",
    },
]


def seed_prod_users():
    """Insert production users directly into the database."""
    print("\n🚀 Starting Production User Seed Script")
    print("=" * 50)
    
    db = SessionLocal()
    inserted_count = 0
    skipped_count = 0
    
    try:
        for user_data in PROD_USERS:
            # Check if user already exists
            existing = db.execute(
                text("SELECT id FROM users WHERE email = :email"),
                {"email": user_data["email"]}
            ).fetchone()
            
            if existing:
                print(f"⏭️  SKIPPED: {user_data['email']} (already exists)")
                skipped_count += 1
                continue
            
            # Hash the password
            password_hash = hash_password(user_data["password"])
            
            # Generate UUID
            user_id = str(uuid.uuid4())
            
            # Insert user directly into database
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
                    "is_verified": True,  # Pre-verified for immediate login
                    "created_at": datetime.utcnow(),
                }
            )
            db.commit()
            
            print(f"✅ INSERTED: {user_data['role']:6} | {user_data['email']:25} | Password: {user_data['password']}")
            inserted_count += 1
        
        print("\n" + "=" * 50)
        print(f"📊 Results: {inserted_count} inserted, {skipped_count} skipped")
        print("\n🎉 Production user seeding complete!")
        print("\n📋 Login Credentials:")
        print("-" * 40)
        for user in PROD_USERS:
            print(f"   {user['role']:6} | Email: {user['email']}")
            print(f"          | Password: {user['password']}")
            print("-" * 40)
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_prod_users()
