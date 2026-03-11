# 📄 Coach Document Upload - Setup Guide

## What's New?

Coaches can now upload verification documents (certificates, IDs, credentials) during registration!

---

## Setup Steps

### 1. Create Admin Account

Run this command in the backend directory:

```powershell
cd C:\Users\krati\Desktop\practice\sports\backend
python create_admin.py
```

**Admin Credentials:**
- Email: `admin@test.com`
- Password: `Admin123!`

---

## How It Works

### For Coaches (Registration)

1. Go to `/register`
2. Select "Coach" role
3. Fill in all required fields
4. **Upload Document**: Click "Upload coaching certificate or ID"
5. Select file (PDF, DOC, DOCX, JPG, PNG)
6. See green checkmark when uploaded
7. Complete registration

**Accepted File Types:**
- PDF documents (.pdf)
- Word documents (.doc, .docx)
- Images (.jpg, .jpeg, .png)

### For Admins (Review)

1. Login as admin
2. Go to "Coach Approvals" in sidebar
3. See pending coaches with their documents
4. Click "View Document" to open the uploaded file
5. Review and approve/reject

---

## Testing

### Test Coach Registration with Document

1. Navigate to http://localhost:5173/register
2. Fill in:
   - Name: Test Coach
   - Email: coach@test.com
   - Password: Coach123!
   - Confirm Password: Coach123!
   - Role: Select "Coach"
3. Click "Upload coaching certificate or ID"
4. Select any PDF or image file
5. Verify green checkmark appears
6. Fill in Phone and Team (optional)
7. Click "Create Account"
8. Verify success message

### Test Admin Review

1. Login as admin (admin@test.com / Admin123!)
2. Click "Coach Approvals" in sidebar
3. See the test coach in pending list
4. Click "View Document" button
5. Verify document opens in new tab
6. Click "Approve" to approve the coach

### Test Approved Coach Login

1. Logout from admin
2. Login with coach credentials (coach@test.com / Coach123!)
3. Verify successful login to coach dashboard

---

## File Storage

Documents are stored in:
```
backend/storage/coach_documents/
```

Each file gets a unique name for security.

---

## Features

✅ File upload during registration
✅ Only for coaches (not players)
✅ Required field for coaches
✅ Multiple file types supported
✅ Secure file storage
✅ Admin can view documents
✅ Document URL stored in database

---

## UI/UX

### Registration Page (Coach)
```
┌─────────────────────────────────────┐
│ Verification Document *             │
│ ┌─────────────────────────────────┐ │
│ │ 📤 Upload coaching certificate  │ │
│ │    or ID                        │ │
│ │                            ✅   │ │
│ └─────────────────────────────────┘ │
│ Upload your coaching certificate,   │
│ ID, or credentials (PDF, DOC, Image)│
└─────────────────────────────────────┘
```

### Admin Approval Page
```
┌─────────────────────────────────────┐
│ [JD] John Doe                       │
│      📧 john@email.com              │
│      📱 +1234567890                 │
│                                     │
│ [View Document] [✅ Approve] [❌ Reject] │
└─────────────────────────────────────┘
```

---

## Troubleshooting

### Issue: File not uploading
**Solution**: Check file size (max 10MB) and file type

### Issue: Document not showing in admin
**Solution**: Verify file was saved in `storage/coach_documents/`

### Issue: Can't view document
**Solution**: Check backend is serving static files correctly

---

## Security

- ✅ Files stored with unique random names
- ✅ Only admins can view documents
- ✅ File type validation
- ✅ Secure file paths
- ✅ No direct file access without authentication

---

## Summary

**Coach Registration Flow:**
1. Register as coach
2. Upload verification document ✨ NEW
3. Submit registration
4. Wait for admin approval

**Admin Approval Flow:**
1. View pending coaches
2. Click "View Document" to review ✨ NEW
3. Approve or reject
4. Coach can login if approved

---

**Document upload feature is now complete and ready to use!** 📄✅
