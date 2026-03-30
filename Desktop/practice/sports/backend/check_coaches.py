import sqlite3

conn = sqlite3.connect('cricket_analytics.db')
cursor = conn.cursor()

cursor.execute("SELECT id, name, email, coach_document_url FROM users WHERE role='COACH'")
coaches = cursor.fetchall()

print("Coaches in database:")
for coach in coaches:
    print(f"ID: {coach[0]}")
    print(f"Name: {coach[1]}")
    print(f"Email: {coach[2]}")
    print(f"Document URL: {coach[3]}")
    print("-" * 50)

conn.close()
