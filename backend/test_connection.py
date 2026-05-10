import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        print("Connected to Supabase PostgreSQL")
        print(f"Version: {result.fetchone()[0]}")
except Exception as e:
    print(f"Connection failed: {e}")
