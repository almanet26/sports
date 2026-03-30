import sqlite3

conn = sqlite3.connect('cricket_analytics.db')
cursor = conn.cursor()

# List all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables:", tables)

# Check match_requests schema if exists
if ('match_requests',) in tables:
    cursor.execute("PRAGMA table_info(match_requests)")
    columns = cursor.fetchall()
    print("\nmatch_requests columns:")
    for col in columns:
        print(f"  {col}")
else:
    print("\nmatch_requests table does NOT exist - need to create it")
    
conn.close()
