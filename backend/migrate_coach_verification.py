"""
Add coach verification columns to users table.
"""

import sqlite3

def migrate():
    conn = sqlite3.connect('cricket_analytics.db')
    cursor = conn.cursor()
    
    print("Adding coach verification columns...")
    
    columns_to_add = [
        ("coach_verification_status", "VARCHAR(20) DEFAULT 'PENDING'"),
        ("coach_document_path", "VARCHAR(500)"),
        ("coach_verification_notes", "TEXT"),
        ("verified_by_admin_id", "VARCHAR(36)"),
        ("verified_at", "TIMESTAMP"),
    ]
    
    for col_name, col_type in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            print(f"✓ Added {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column" in str(e).lower():
                print(f"- {col_name} already exists")
            else:
                raise
    
    conn.commit()
    conn.close()
    print("\n✅ Migration completed!")

if __name__ == "__main__":
    migrate()
