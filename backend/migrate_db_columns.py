import sqlite3

conn = sqlite3.connect('cricket_analytics.db')
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE users ADD COLUMN subscription_plan TEXT DEFAULT 'BASIC'")
    print("Added subscription_plan column")
except sqlite3.OperationalError as e:
    print(f"subscription_plan: {e}")

try:
    cursor.execute("ALTER TABLE users ADD COLUMN coach_status TEXT DEFAULT 'pending'")
    print("Added coach_status column")
except sqlite3.OperationalError as e:
    print(f"coach_status: {e}")

try:
    cursor.execute("ALTER TABLE users ADD COLUMN coach_document_url TEXT")
    print("Added coach_document_url column")
except sqlite3.OperationalError as e:
    print(f"coach_document_url: {e}")

conn.commit()
conn.close()
print("Migration complete!")
