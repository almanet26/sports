# 🧪 Complete Testing Guide - Coach Approval with Document Upload

## Prerequisites

1. Backend running on http://localhost:8000
2. Frontend running on http://localhost:5173
3. Admin account created

---

## Step 1: Create Admin Account

```powershell
cd C:\Users\krati\Desktop\practice\sports\backend
python create_admin.py
```

**Admin Credentials:**
- Email: `admin@test.com`
- Password: `Admin123!`

---

## Step 2: Register as Coach with Document

### 2.1 Navigate to Registration
1. Open browser: http://localhost:5173/register

### 2.2 Fill Coach Registration Form
```
Name: John Doe
Email: coach@test.com
Password: Coach123!
Confirm Password: Coach123!
Role: Select "Coach" (click the Coach button)
```

### 2.3 Upload Document (NEW!)
1. You'll see a new field: "Verification Document *"
2. Click the upload area
3. Select any file:
   - PDF document (certificate.pdf)
   - Word document (resume.docx)
   - Image (id_card.jpg)
4. ✅ Green checkmark appears when uploaded
5. File name shows in the upload area

### 2.4 Fill Additional Coach Fields
```
Phone Number: +1234567890 (optional)
Team/Organization: Test Academy (optional)
```

### 2.5 Submit Registration
1. Click "Create Account"
2. ✅ Success message appears
3. Redirected to login page

---

## Step 3: Coach Tries to Login (Pending Status)

### 3.1 Attempt Login
1. Navigate to: http://localhost:5173/login
2. Enter credentials:
   - Email: `coach@test.com`
   - Password: `Coach123!`
3. Click "Sign In"

### 3.2 Verify Pending Page
✅ **Expected Result**: Redirected to http://localhost:5173/coach-pending

**You should see:**
```
┌─────────────────────────────────────────┐
│         🕐 (Large Clock Icon)           │
│                                         │
│    Account Pending Verification         │
│                                         │
│  Your coach account is currently under  │
│  review. Please wait until the Admin    │
│  reviews your documents.                │
│                                         │
│  ℹ️  What happens next?                 │
│     Admin reviews in 24-48 hours        │
│                                         │
│  ✅  Once approved                      │
│     You'll receive email notification   │
│                                         │
│  📧  Need help?                         │
│     Contact support@sportvision.ai      │
│                                         │
│  🟡 Status: Pending Review              │
│                                         │
│  [Back to Home]  [Try Login Again]     │
└─────────────────────────────────────────┘
```

**Key Points:**
- ❌ Coach CANNOT access dashboard
- ✅ Beautiful pending page with info
- ✅ Pulsing status indicator
- ✅ Animated background

---

## Step 4: Admin Reviews and Approves

### 4.1 Login as Admin
1. Logout (if logged in as coach)
2. Navigate to: http://localhost:5173/login
3. Enter admin credentials:
   - Email: `admin@test.com`
   - Password: `Admin123!`
4. Click "Sign In"
5. ✅ Redirected to admin dashboard

### 4.2 Navigate to Coach Approvals
1. Look at sidebar
2. Click "Coach Approvals" (with user-check icon)
3. ✅ Opens: http://localhost:5173/admin/coaches

### 4.3 View Admin Approval Page

**You should see:**
```
┌─────────────────────────────────────────────────┐
│  ✅ Coach Approvals                             │
│  Review and approve pending coach applications  │
├─────────────────────────────────────────────────┤
│  🕐 1 Pending  |  ✅ 0 Approved  |  ❌ 0 Rejected │
├─────────────────────────────────────────────────┤
│  Pending Applications                           │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  [JD] John Doe                            │ │
│  │       📧 coach@test.com                   │ │
│  │       📱 +1234567890                      │ │
│  │       👥 Test Academy                     │ │
│  │       📅 Applied: [Today's Date]          │ │
│  │                                           │ │
│  │  [View Document] [✅ Approve] [❌ Reject] │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 4.4 View Uploaded Document (NEW!)
1. Click "View Document" button
2. ✅ Document opens in new browser tab
3. Review the uploaded certificate/ID
4. Close the document tab

### 4.5 Approve the Coach
1. Click "✅ Approve" button
2. Confirmation dialog appears: "Are you sure you want to approve this coach?"
3. Click "OK"
4. ✅ Success alert: "Coach approved successfully!"
5. ✅ Coach card disappears from pending list
6. ✅ Pending count changes from 1 to 0

---

## Step 5: Coach Logs In Successfully

### 5.1 Logout from Admin
1. Click logout button in sidebar

### 5.2 Login as Approved Coach
1. Navigate to: http://localhost:5173/login
2. Enter coach credentials:
   - Email: `coach@test.com`
   - Password: `Coach123!`
3. Click "Sign In"

### 5.3 Verify Successful Login
✅ **Expected Result**: Redirected to http://localhost:5173/coach

**You should see:**
- ✅ Coach Dashboard
- ✅ Sidebar with coach menu items
- ✅ Welcome message
- ❌ NO redirect to pending page

---

## Complete Workflow Summary

```
1. Coach Registers + Uploads Document
   ↓
2. Coach Status = "pending"
   ↓
3. Coach Tries Login → Redirected to Pending Page ❌
   ↓
4. Admin Logs In
   ↓
5. Admin Goes to "Coach Approvals"
   ↓
6. Admin Views Uploaded Document 📄
   ↓
7. Admin Clicks "Approve" ✅
   ↓
8. Coach Status = "verified"
   ↓
9. Coach Logs In → Access to Dashboard ✅
```

---

## Testing Rejection Flow (Optional)

### Register Another Coach
1. Register second coach: coach2@test.com
2. Upload document
3. Complete registration

### Admin Rejects
1. Login as admin
2. Go to Coach Approvals
3. Click "❌ Reject" on coach2
4. Confirm rejection
5. ✅ Coach removed from list

### Verify Rejected Coach Cannot Login
1. Try to login as coach2@test.com
2. ✅ Error message: "Your coach application has been rejected"
3. ❌ Cannot access dashboard

---

## Verification Checklist

### Registration
- [ ] Coach role shows document upload field
- [ ] Player role does NOT show document upload field
- [ ] File upload works (PDF, DOC, Image)
- [ ] Green checkmark appears after upload
- [ ] File name displays in upload area
- [ ] Registration succeeds with document

### Pending Status
- [ ] Coach cannot login before approval
- [ ] Redirected to /coach-pending page
- [ ] Pending page shows clock icon
- [ ] Status badge shows "Pending Review"
- [ ] Pulsing animation works
- [ ] "Try Login Again" button works

### Admin Approval
- [ ] "Coach Approvals" link in admin sidebar
- [ ] Pending count shows correct number
- [ ] Coach card displays all information
- [ ] "View Document" button appears
- [ ] Document opens in new tab
- [ ] Document is the correct uploaded file
- [ ] "Approve" button works
- [ ] Success message appears
- [ ] Coach removed from pending list

### Post-Approval
- [ ] Coach can login successfully
- [ ] Redirected to coach dashboard
- [ ] No pending page redirect
- [ ] Full access to coach features

---

## Database Verification

Check the database to verify status changes:

```sql
-- Check coach status
SELECT email, role, coach_status, coach_document_url 
FROM users 
WHERE role = 'COACH';

-- Expected results:
-- coach@test.com | COACH | verified | /static/coach_documents/[random].pdf
-- coach2@test.com | COACH | rejected | /static/coach_documents/[random].pdf
```

---

## Troubleshooting

### Issue: Document not uploading
**Check:**
- File size < 10MB
- File type is PDF, DOC, DOCX, JPG, or PNG
- Browser console for errors

### Issue: "View Document" button not showing
**Check:**
- Document was uploaded during registration
- `coach_document_url` field in database is not null
- Backend is serving static files

### Issue: Document link broken
**Check:**
- Backend is running
- File exists in `backend/storage/coach_documents/`
- Static file mount is configured in main.py

### Issue: Coach can still login when pending
**Check:**
- Database: `coach_status` should be 'pending'
- Backend auth.py has status check
- Clear browser cache and try again

---

## Success Criteria

✅ All features working:
1. Document upload during registration
2. Pending status prevents login
3. Beautiful pending page displays
4. Admin can view uploaded documents
5. Admin can approve/reject coaches
6. Approved coaches can login
7. Rejected coaches cannot login

---

## Quick Test Commands

### Create Admin
```powershell
cd backend
python create_admin.py
```

### Check Database
```powershell
cd backend
python -c "from database.config import SessionLocal; from database.models.user import User; db = SessionLocal(); coaches = db.query(User).filter(User.role=='COACH').all(); [print(f'{c.email}: {c.coach_status}') for c in coaches]"
```

### View Uploaded Documents
```powershell
dir backend\storage\coach_documents
```

---

**Follow this guide step-by-step to test the complete coach approval workflow!** ✅
