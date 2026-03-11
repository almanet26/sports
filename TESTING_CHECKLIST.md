# 🧪 Testing Checklist

## Pre-Testing Setup

- [ ] Run database migration: `python backend/migrate_subscription_coach.py`
- [ ] Backend is running on port 8000
- [ ] Frontend is running on port 5173
- [ ] Database is accessible
- [ ] No console errors on startup

---

## Feature 1: Password Toggle

### Login Page
- [ ] Navigate to `/login`
- [ ] Enter any text in password field
- [ ] Verify password shows as dots (••••)
- [ ] Click eye icon
- [ ] Verify password text is now visible
- [ ] Verify icon changed to slashed eye
- [ ] Click icon again
- [ ] Verify password is hidden again
- [ ] Verify icon changed back to regular eye
- [ ] Check hover effect on icon (opacity change)
- [ ] Verify icon is vertically centered

### Registration Page
- [ ] Navigate to `/register`
- [ ] Test password field toggle (same as above)
- [ ] Test confirm password field toggle
- [ ] Verify both fields work independently
- [ ] Enter different passwords in each field
- [ ] Toggle both to verify they show different text

**Expected Result**: ✅ Eye icon toggles password visibility smoothly

---

## Feature 2: Landing Page Text

- [ ] Navigate to `/` (homepage)
- [ ] Scroll to "Get Started" button
- [ ] Look at text below the button
- [ ] Verify it says: "Cricket specialist is ready and many more games are coming soon"
- [ ] Verify font size matches the theme
- [ ] Verify text color is consistent with design

**Expected Result**: ✅ Text is updated and styled correctly

---

## Feature 3: Subscription System

### Initial Setup
- [ ] Register a new PLAYER account
- [ ] Login successfully
- [ ] Verify "Subscription" link appears in sidebar
- [ ] Click "Subscription" link

### Subscription Page UI
- [ ] Verify page title: "Subscription Plans"
- [ ] Verify "Current Plan" badge shows "BASIC Plan"
- [ ] Verify "Active" status badge is green
- [ ] Verify 3 pricing cards are displayed

### Basic Plan Card
- [ ] Verify gray gradient design
- [ ] Verify "Free forever" pricing
- [ ] Verify user icon
- [ ] Verify "Current Plan" badge at top
- [ ] Verify "Active Plan" button (disabled, green)
- [ ] Verify feature list with checkmarks and X marks
- [ ] Count features: Should have 7 items

### Silver Plan Card
- [ ] Verify metallic silver gradient
- [ ] Verify "Most Popular" badge at top
- [ ] Verify "$19/month" pricing
- [ ] Verify medal icon
- [ ] Verify "Upgrade to Silver" button (enabled, blue-purple)
- [ ] Hover over card - verify scale and lift effect
- [ ] Click "Upgrade" button
- [ ] Verify alert appears: "Upgrade to SILVER plan - Payment integration coming soon!"

### Gold Plan Card
- [ ] Verify premium gold gradient
- [ ] Verify "$49/month" pricing
- [ ] Verify crown icon
- [ ] Verify "Upgrade to Gold" button (enabled, gold gradient)
- [ ] Verify shadow/glow effect
- [ ] Hover over card - verify animations
- [ ] Click "Upgrade" button
- [ ] Verify alert appears

### FAQ Section
- [ ] Scroll to bottom
- [ ] Verify FAQ section exists
- [ ] Verify 3 questions are displayed
- [ ] Read through questions and answers

**Expected Result**: ✅ All 3 plans display correctly with proper styling and functionality

---

## Feature 4: Coach Approval Workflow

### Part A: Coach Registration & Pending Status

#### Register as Coach
- [ ] Logout if logged in
- [ ] Navigate to `/register`
- [ ] Fill in all fields
- [ ] Select "Coach" role
- [ ] Submit registration
- [ ] Verify redirect to login page
- [ ] Verify success message

#### Attempt Login as Pending Coach
- [ ] Navigate to `/login`
- [ ] Enter coach credentials
- [ ] Click "Sign In"
- [ ] Verify redirect to `/coach-pending` page
- [ ] Verify NO access to dashboard

#### Coach Pending Page
- [ ] Verify large clock icon (animated)
- [ ] Verify title: "Account Pending Verification"
- [ ] Verify message about admin review
- [ ] Verify info box with 3 sections:
  - [ ] "What happens next?" with info icon
  - [ ] "Once approved" with check icon
  - [ ] "Need help?" with envelope icon
- [ ] Verify status badge: "Status: Pending Review"
- [ ] Verify pulsing animation on status badge
- [ ] Verify "Back to Home" button works
- [ ] Verify "Try Login Again" button works
- [ ] Check animated background blobs
- [ ] Check decorative blur elements

### Part B: Admin Approval Process

#### Login as Admin
- [ ] Logout
- [ ] Login with admin credentials
- [ ] Verify redirect to `/admin` dashboard
- [ ] Verify "Coach Approvals" link in sidebar

#### Admin Coach Approval Page
- [ ] Click "Coach Approvals" in sidebar
- [ ] Verify page title: "Coach Approvals"
- [ ] Verify 3 stat cards at top:
  - [ ] Pending count (should be 1+)
  - [ ] Approved Today (should be 0)
  - [ ] Rejected Today (should be 0)

#### Review Pending Coach
- [ ] Verify pending coach card appears
- [ ] Verify coach avatar with initials
- [ ] Verify coach name is displayed
- [ ] Verify email is displayed
- [ ] Verify phone (if provided)
- [ ] Verify team (if provided)
- [ ] Verify application date
- [ ] Verify 3 action buttons:
  - [ ] "View Document" (if document exists)
  - [ ] "Approve" (green)
  - [ ] "Reject" (red)

#### Approve Coach
- [ ] Click "Approve" button
- [ ] Verify confirmation dialog appears
- [ ] Click "OK" to confirm
- [ ] Verify success alert: "Coach approved successfully!"
- [ ] Verify coach card is removed from list
- [ ] Verify pending count decreased by 1

#### Verify Approved Coach Can Login
- [ ] Logout from admin
- [ ] Login with the approved coach credentials
- [ ] Verify successful login
- [ ] Verify redirect to `/coach` dashboard
- [ ] Verify NO redirect to pending page

### Part C: Rejection Flow (Optional)

#### Register Another Coach
- [ ] Register a second coach account
- [ ] Verify pending status

#### Login as Admin
- [ ] Login as admin
- [ ] Navigate to Coach Approvals

#### Reject Coach
- [ ] Click "Reject" button on second coach
- [ ] Verify confirmation dialog
- [ ] Click "OK"
- [ ] Verify rejection alert
- [ ] Verify coach removed from list

#### Verify Rejected Coach Cannot Login
- [ ] Logout
- [ ] Try to login with rejected coach credentials
- [ ] Verify error message about rejection
- [ ] Verify NO access to dashboard

**Expected Result**: ✅ Complete workflow from registration → pending → approval → login works perfectly

---

## Database Verification

### Check User Table
```sql
SELECT id, name, email, role, subscription_plan, coach_status 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;
```

- [ ] Verify PLAYER users have `subscription_plan = 'BASIC'`
- [ ] Verify new COACH users have `coach_status = 'pending'`
- [ ] Verify approved coaches have `coach_status = 'verified'`
- [ ] Verify rejected coaches have `coach_status = 'rejected'`

---

## API Endpoint Testing

### Test Admin Endpoints (using Postman or curl)

#### Get Pending Coaches
```bash
GET http://localhost:8000/api/v1/admin/coaches/pending
Authorization: Bearer {admin_token}
```
- [ ] Returns list of pending coaches
- [ ] Status code: 200

#### Approve Coach
```bash
POST http://localhost:8000/api/v1/admin/coaches/{coach_id}/approve
Authorization: Bearer {admin_token}
```
- [ ] Returns success message
- [ ] Status code: 200
- [ ] Coach status updated in database

#### Reject Coach
```bash
POST http://localhost:8000/api/v1/admin/coaches/{coach_id}/reject
Authorization: Bearer {admin_token}
```
- [ ] Returns success message
- [ ] Status code: 200
- [ ] Coach status updated in database

---

## Cross-Browser Testing

### Chrome
- [ ] All features work
- [ ] No console errors
- [ ] Animations smooth

### Firefox
- [ ] All features work
- [ ] No console errors
- [ ] Animations smooth

### Safari (if available)
- [ ] All features work
- [ ] No console errors
- [ ] Animations smooth

### Edge
- [ ] All features work
- [ ] No console errors
- [ ] Animations smooth

---

## Responsive Testing

### Mobile (375px)
- [ ] Password toggle works
- [ ] Landing page text readable
- [ ] Subscription cards stack vertically
- [ ] Coach pending page looks good
- [ ] Admin page is usable

### Tablet (768px)
- [ ] All features work
- [ ] Layout adjusts properly
- [ ] Cards display in 2 columns

### Desktop (1920px)
- [ ] All features work
- [ ] Layout looks professional
- [ ] Cards display in 3 columns

---

## Performance Testing

- [ ] Page load time < 2 seconds
- [ ] No memory leaks
- [ ] Smooth animations (60fps)
- [ ] API responses < 500ms
- [ ] Database queries optimized

---

## Security Testing

- [ ] Non-admin cannot access admin endpoints
- [ ] Pending coaches cannot access dashboard
- [ ] Rejected coaches cannot login
- [ ] Password is properly hashed
- [ ] JWT tokens are validated
- [ ] CORS is properly configured

---

## Edge Cases

### Subscription
- [ ] What if user is already on Gold plan?
- [ ] What if payment fails? (future)
- [ ] Can user downgrade? (future)

### Coach Approval
- [ ] What if coach is already approved?
- [ ] What if coach ID doesn't exist?
- [ ] What if admin approves twice?
- [ ] What if no pending coaches exist?

---

## Final Verification

- [ ] All 4 features working perfectly
- [ ] No console errors
- [ ] No broken links
- [ ] All buttons functional
- [ ] All animations smooth
- [ ] Database properly updated
- [ ] API endpoints secure
- [ ] Documentation complete

---

## Sign-Off

**Tester Name**: ___________________
**Date**: ___________________
**Overall Status**: ⬜ Pass  ⬜ Fail
**Notes**: 
___________________________________
___________________________________
___________________________________

---

**If all checkboxes are checked, the features are ready for production!** ✅
