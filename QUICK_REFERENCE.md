# 🚀 Quick Reference Card

## Setup (First Time)
```powershell
# 1. Run migration
cd backend
python migrate_subscription_coach.py

# 2. Start backend
python main.py

# 3. Start frontend (new terminal)
cd ../frontend
npm run dev
```

## URLs
- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Test Accounts

### Create Admin (if needed)
```python
# In Python shell or script
from database.models.user import User
from database.config import SessionLocal
from utils.auth import get_password_hash

db = SessionLocal()
admin = User(
    email="admin@test.com",
    password_hash=get_password_hash("Admin123!"),
    name="Admin User",
    role="ADMIN"
)
db.add(admin)
db.commit()
```

### Test Users
- **Admin**: admin@test.com / Admin123!
- **Player**: player@test.com / Player123!
- **Coach**: coach@test.com / Coach123!

## Quick Tests

### 1. Password Toggle
```
1. Go to /login
2. Type password
3. Click eye icon
4. ✅ Password visible
```

### 2. Landing Page
```
1. Go to /
2. Find "Get Started" button
3. ✅ Text below says "Cricket specialist..."
```

### 3. Subscription
```
1. Register as PLAYER
2. Go to /player/subscription
3. ✅ See 3 plans (Basic active)
```

### 4. Coach Approval
```
1. Register as COACH
2. Try login
3. ✅ Redirected to /coach-pending
4. Login as ADMIN
5. Go to /admin/coaches
6. ✅ See pending coach
7. Click Approve
8. ✅ Coach can now login
```

## Database Quick Check
```sql
-- Check subscriptions
SELECT email, role, subscription_plan FROM users WHERE role='PLAYER';

-- Check coach status
SELECT email, role, coach_status FROM users WHERE role='COACH';

-- Check all new fields
SELECT email, role, subscription_plan, coach_status FROM users;
```

## API Quick Test
```bash
# Get pending coaches (need admin token)
curl -X GET http://localhost:8000/api/v1/admin/coaches/pending \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Approve coach
curl -X POST http://localhost:8000/api/v1/admin/coaches/COACH_ID/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## File Locations

### Frontend Pages
```
src/pages/
├── SubscriptionPage.tsx       # /player/subscription
├── CoachPendingPage.tsx       # /coach-pending
└── AdminCoachApprovalPage.tsx # /admin/coaches
```

### Backend Routes
```
api/routes/
└── admin_coaches.py           # Admin coach endpoints
```

### Database
```
database/models/
└── user.py                    # User model with new fields
```

## Common Commands

### Backend
```powershell
# Run server
python main.py

# Run migration
python migrate_subscription_coach.py

# Check database
python check_db.py
```

### Frontend
```powershell
# Dev server
npm run dev

# Build
npm run build

# Preview build
npm run preview
```

## Troubleshooting

### Migration Error
```powershell
# Check database connection
cd backend
python -c "from database.config import engine; print(engine)"
```

### Import Error
```powershell
# Reinstall dependencies
cd backend
pip install -r requirements.txt
```

### Port Already in Use
```powershell
# Kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

## Feature Flags

All features are enabled by default. No configuration needed.

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@localhost/dbname
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000
```

## Documentation Files

| File | Purpose |
|------|---------|
| IMPLEMENTATION_COMPLETE.md | Master overview |
| NEW_FEATURES_GUIDE.md | Detailed guide |
| FEATURES_SUMMARY.md | Quick summary |
| TESTING_CHECKLIST.md | Testing guide |
| VISUAL_GUIDE.md | UI/UX design |
| QUICK_REFERENCE.md | This file |

## Status Indicators

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete & Working |
| 🟢 | Production Ready |
| 🟡 | In Progress |
| 🔴 | Issue/Error |

## Support

1. Check console logs
2. Review documentation
3. Test API in /docs
4. Verify database migration

---

**Keep this card handy for quick reference!** 📌
