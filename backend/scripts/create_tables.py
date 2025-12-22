"""
Database Table Creation Script
Run this script to create all tables in your PostgreSQL database.
Usage: python create_tables.py
"""

from database.config import Base, engine
from database.models import User, UserSession


def create_tables():
    """Create all tables defined in SQLAlchemy models"""
    try:
        print("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("All tables created successfully!")
        print("\nCreated tables:")
        for table in Base.metadata.sorted_tables:
            print(f"  - {table.name}")
    except Exception as e:
        print(f"Error creating tables: {e}")
        raise


if __name__ == "__main__":
    create_tables()
