# Pull Request: Coach Profile Enhancements & Button Functionality

## 📋 Summary
Enhanced coach dashboard with profile management, session type selection, functional buttons across all coach pages, and updated branding with PitchVision logo.

## 🎯 Changes Made

### 1. **Coach Profile Page Enhancements** (`ProfilePage.tsx`)
- ✅ Added **Session Type** field for coaches to select:
  - Virtual Only
  - In-Field Only
  - Both (Virtual & In-Field)
- ✅ Removed Account Settings section from coach profile
- ✅ Profile completion tracking includes session type
- ✅ Session type saved to backend via API

### 2. **Button Functionality** (All Coach Pages)

#### **CoachDashboard.tsx**
- ✅ Upload Video → navigates to `/upload`
- ✅ Library → navigates to `/library`
- ✅ Athlete cards → navigate to `/coach/players`

#### **CoachPlayersPage.tsx**
- ✅ Add Player → shows alert notification
- ✅ View button → navigates to `/coach/players`
- ✅ Message button → navigates to `/coach/inbox`

#### **CoachSessionsPage.tsx**
- ✅ New Session → triggers modal (state ready)
- ✅ Edit → shows alert with session ID
- ✅ Cancel → confirms and updates session status to cancelled
- ✅ View Details → shows alert with session ID

#### **CoachVideoReviewsPage.tsx**
- ✅ Review Now → shows alert to open video review
- ✅ Publish → confirms and updates submission status to published
- ✅ View → shows alert to view published video

### 3. **Logo Integration** (`DashboardLayout.tsx`)
- ✅ Replaced placeholder with PitchVision logo
- ✅ Logo size increased to 56px (w-14 h-14)
- ✅ Logo displayed in:
  - Desktop sidebar
  - Mobile header
  - Mobile sidebar
- ✅ Removed unused logo import

## 📁 Files Modified

```
frontend/src/pages/
├── ProfilePage.tsx              # Added session type field, removed account settings
├── CoachDashboard.tsx           # Fixed navigation links
├── CoachPlayersPage.tsx         # Added button handlers and navigation
├── CoachSessionsPage.tsx        # Added edit, cancel, view handlers
└── CoachVideoReviewsPage.tsx    # Added review, publish, view handlers

frontend/src/components/layout/
└── DashboardLayout.tsx          # Updated logo integration

frontend/public/
└── logo.png                     # PitchVision logo (to be added)
```

## 🔧 Technical Details

### New State Variables
```typescript
// ProfilePage.tsx
sessionType: userProfile?.session_type || ''
```

### New Handler Functions
```typescript
// CoachSessionsPage.tsx
handleEditSession(sessionId: string)
handleCancelSession(sessionId: string)
handleViewDetails(sessionId: string)

// CoachVideoReviewsPage.tsx
handleReviewVideo(submissionId: string)
handlePublishVideo(submissionId: string)
handleViewVideo(submissionId: string)
```

### API Updates Required
```typescript
// Backend needs to support:
updateData.session_type = formData.sessionType;
```

## 🎨 UI/UX Improvements
- ✅ All buttons now provide user feedback
- ✅ Confirmation dialogs for destructive actions (cancel, publish)
- ✅ Consistent navigation patterns across pages
- ✅ Larger, more visible logo
- ✅ Session type clearly displayed in profile

## 🧪 Testing Checklist
- [ ] Session type dropdown saves correctly
- [ ] All navigation buttons redirect properly
- [ ] Cancel session shows confirmation dialog
- [ ] Publish video shows confirmation dialog
- [ ] Logo displays correctly on all screen sizes
- [ ] Profile completion percentage updates with session type
- [ ] Mobile sidebar shows logo correctly

## 📝 Backend Requirements
Add `session_type` column to users table:
```sql
ALTER TABLE users ADD COLUMN session_type VARCHAR(50);
```

Update API endpoint:
```python
# backend/api/routes/auth.py
# Add session_type to PUT /auth/me endpoint
```

## 🚀 Deployment Notes
1. Save PitchVision logo to `frontend/public/logo.png`
2. Run database migration for `session_type` column
3. Update backend API to accept `session_type` parameter
4. Test all button functionality in staging
5. Verify logo displays on all devices

## 📸 Screenshots
- Coach Profile with Session Type field
- Updated sidebar with PitchVision logo
- Functional buttons on all coach pages

## 🔗 Related Issues
- Coach profile enhancement
- Button functionality implementation
- Logo integration

## ✅ Checklist
- [x] Code follows project style guidelines
- [x] All buttons are functional
- [x] Session type field added
- [x] Logo integrated
- [x] Account settings removed from coach profile
- [x] Navigation links updated
- [x] Confirmation dialogs added for critical actions
- [ ] Backend API updated
- [ ] Database migration created
- [ ] Logo file added to public folder

## 👥 Reviewers
@team-lead @backend-dev @ui-designer

---

**Note**: Please ensure the PitchVision logo is saved to `frontend/public/logo.png` before merging.
