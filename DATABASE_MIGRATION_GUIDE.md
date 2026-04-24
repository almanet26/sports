# Database Migration Guide - Coach Content Feature

## Overview
This guide will help you set up the database schema for the Coach Content feature in production (Supabase).

## Prerequisites
- Access to Supabase dashboard
- Database connection credentials
- SQL editor access

## Migration Steps

### Option 1: Using Supabase SQL Editor (Recommended)

1. **Login to Supabase Dashboard**
   - Go to https://supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run Migration SQL**

```sql
-- Step 1: Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'coach_content'
);

-- Step 2: If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS coach_content (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    coach_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('article', 'video', 'image')),
    article_body TEXT,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    thumbnail_url VARCHAR(500),
    tags TEXT,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_coach_content_coach_id ON coach_content(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_content_is_public ON coach_content(is_public);
CREATE INDEX IF NOT EXISTS idx_coach_content_content_type ON coach_content(content_type);
CREATE INDEX IF NOT EXISTS idx_coach_content_created_at ON coach_content(created_at DESC);

-- Step 4: Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_coach_content_updated_at 
    BEFORE UPDATE ON coach_content 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Verify table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'coach_content'
ORDER BY ordinal_position;
```

4. **Click "Run"** to execute the migration

5. **Verify Success**
   - You should see "Success. No rows returned" or similar
   - Check the table structure in the output

### Option 2: Using Python Migration Script

If you prefer to run migrations from your local machine:

1. **Update Database Connection**
   Edit `backend/.env` with your production credentials:
   ```env
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

2. **Create Migration Script**
   Save this as `backend/migrate_production.py`:

```python
from database.config import SessionLocal
from sqlalchemy import text

def migrate():
    db = SessionLocal()
    try:
        print("Creating coach_content table...")
        
        # Create table
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS coach_content (
                id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                coach_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('article', 'video', 'image')),
                article_body TEXT,
                file_url VARCHAR(500),
                file_name VARCHAR(255),
                file_size INTEGER,
                mime_type VARCHAR(100),
                thumbnail_url VARCHAR(500),
                tags TEXT,
                is_public BOOLEAN NOT NULL DEFAULT TRUE,
                views INTEGER NOT NULL DEFAULT 0,
                likes INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        
        # Create indexes
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_coach_content_coach_id ON coach_content(coach_id)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_coach_content_is_public ON coach_content(is_public)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_coach_content_content_type ON coach_content(content_type)"))
        db.execute(text("CREATE INDEX IF NOT EXISTS idx_coach_content_created_at ON coach_content(created_at DESC)"))
        
        db.commit()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
```

3. **Run Migration**
   ```bash
   cd backend
   python migrate_production.py
   ```

## Rollback (If Needed)

If something goes wrong, you can rollback:

```sql
-- Drop the table and all related objects
DROP TABLE IF EXISTS coach_content CASCADE;

-- Drop indexes (if they exist separately)
DROP INDEX IF EXISTS idx_coach_content_coach_id;
DROP INDEX IF EXISTS idx_coach_content_is_public;
DROP INDEX IF EXISTS idx_coach_content_content_type;
DROP INDEX IF EXISTS idx_coach_content_created_at;

-- Drop trigger
DROP TRIGGER IF EXISTS update_coach_content_updated_at ON coach_content;
```

## Verification

After migration, verify everything is working:

### 1. Check Table Exists
```sql
SELECT * FROM coach_content LIMIT 1;
```

### 2. Check Indexes
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'coach_content';
```

### 3. Test Insert
```sql
INSERT INTO coach_content (
    coach_id, title, content_type, is_public
) VALUES (
    (SELECT id FROM users WHERE role = 'COACH' LIMIT 1),
    'Test Content',
    'article',
    true
) RETURNING *;
```

### 4. Test Query
```sql
SELECT id, title, content_type, is_public, views, likes, created_at
FROM coach_content
ORDER BY created_at DESC;
```

### 5. Clean Up Test Data
```sql
DELETE FROM coach_content WHERE title = 'Test Content';
```

## Troubleshooting

### Issue: Foreign Key Constraint Fails
**Error**: `violates foreign key constraint "coach_content_coach_id_fkey"`

**Solution**: Ensure the `users` table has coaches with UUID ids:
```sql
SELECT id, email, role FROM users WHERE role = 'COACH' LIMIT 5;
```

### Issue: Column Already Exists
**Error**: `column "tags" of relation "coach_content" already exists`

**Solution**: The table already has the column. Check if you need to add missing columns:
```sql
-- Check existing columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'coach_content';

-- Add only missing columns
ALTER TABLE coach_content ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE coach_content ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
```

### Issue: Type Mismatch
**Error**: `column "is_public" is of type boolean but expression is of type integer`

**Solution**: Update the column type:
```sql
ALTER TABLE coach_content 
ALTER COLUMN is_public TYPE BOOLEAN 
USING is_public::boolean;
```

## Post-Migration Checklist

- [ ] Table `coach_content` exists
- [ ] All columns present (id, coach_id, title, description, content_type, article_body, file_url, file_name, file_size, mime_type, thumbnail_url, tags, is_public, views, likes, created_at, updated_at)
- [ ] Indexes created
- [ ] Foreign key constraint to `users` table working
- [ ] Default values set correctly
- [ ] Trigger for `updated_at` working
- [ ] Test insert successful
- [ ] Test query successful
- [ ] Backend API endpoints working
- [ ] Frontend pages loading

## Support

If you encounter issues:
1. Check Supabase logs
2. Verify database connection
3. Check user permissions
4. Review error messages carefully
5. Contact support if needed

---

**Status**: Ready for production migration
**Estimated Time**: 5-10 minutes
**Risk Level**: Low (non-destructive, creates new table)
