# Public/Private Content Access Control

## Overview
Coaches can now control who sees their content by marking it as **Public** or **Private**.

## Access Rules

### Public Content (🌐)
- **Visible to**: Everyone (all players, coaches, and admins)
- **Use case**: General educational content, tips, techniques that any player can benefit from
- **Examples**: 
  - "Top 10 Batting Tips"
  - "How to Bowl a Perfect Yorker"
  - "Fielding Drills for Beginners"

### Private Content (🔒)
- **Visible to**: Only the coach who created it
- **Use case**: Draft content, work-in-progress, or content meant for specific players (when coach-player relationships are implemented)
- **Examples**:
  - Draft articles not ready for publication
  - Personalized training videos for specific players
  - Internal coaching notes

## How It Works

### For Coaches:

#### Creating Content
1. Navigate to "My Content" in sidebar
2. Click "Upload" button
3. Fill in content details
4. **Choose visibility**:
   - Click "Public" button → Everyone can see
   - Click "Private" button → Only you can see
5. Upload and submit

#### Viewing Content
- Coaches can see:
  - ✅ All public content from all coaches
  - ✅ Their own private content
  - ❌ Other coaches' private content

#### Managing Content
- Coaches can toggle content between public/private anytime
- Private content shows an orange "🔒 Private" badge
- Public content shows a green "🌐 Public" badge

### For Players:

#### Browsing Content
1. Navigate to "Learning Hub" in sidebar
2. Browse all available content
3. Players can see:
   - ✅ All public content from all coaches
   - ❌ Private content (hidden completely)

#### Viewing Content
- If a player tries to access private content directly (via URL), they get:
  - **403 Forbidden**: "This content is private. Only the coach can view it."

### For Admins:

- Same access as players:
  - ✅ All public content
  - ❌ Private content from coaches

## Visual Indicators

### Content Cards
- **Public**: Green badge with globe icon (🌐 Public)
- **Private**: Orange badge with lock icon (🔒 Private)

### Content Detail Page
- Visibility badge shown next to the title
- Clear indication of content accessibility

## Database Schema

```sql
coach_content table:
- is_public: BOOLEAN (default: TRUE)
  - TRUE = Public content (everyone can see)
  - FALSE = Private content (only coach can see)
```

## API Endpoints

### Get All Content (Browse)
```
GET /api/v1/coach/content/public
```
**Returns**:
- All public content
- User's own private content (if user is a coach)

### Get Specific Content
```
GET /api/v1/coach/content/{content_id}
```
**Access Control**:
- Public content: Anyone can view
- Private content: Only the coach who created it
- Returns 403 if unauthorized

### Create Content
```
POST /api/v1/coach/content
```
**Parameters**:
- `is_public`: boolean (true/false)

### Update Content
```
PUT /api/v1/coach/content/{content_id}
```
**Parameters**:
- `is_public`: boolean (optional) - can toggle visibility

## Future Enhancements

### Coach-Player Relationships (Coming Soon)
When coach-player relationships are implemented, private content will be visible to:
- The coach who created it
- Players assigned to that coach

This will enable:
- Personalized content for specific players
- Team-specific training materials
- Private coaching sessions content

### Implementation Plan:
1. Add `coach_id` field to User model (for players)
2. Create coach-player relationship table
3. Update access control logic to check relationships
4. Add "Share with my players" option

## Testing

### Test as Coach:
1. Create public content → Verify it appears in Learning Hub
2. Create private content → Verify it only shows in "My Content"
3. Toggle content from public to private → Verify visibility changes

### Test as Player:
1. Browse Learning Hub → Should see all public content
2. Try to access private content URL → Should get 403 error
3. Verify no private content appears in browse list

### Test as Admin:
1. Browse Learning Hub → Should see all public content
2. Same restrictions as players

## Summary

| User Type | Public Content | Own Private Content | Others' Private Content |
|-----------|---------------|---------------------|------------------------|
| Coach     | ✅ Can view   | ✅ Can view         | ❌ Cannot view         |
| Player    | ✅ Can view   | N/A                 | ❌ Cannot view         |
| Admin     | ✅ Can view   | N/A                 | ❌ Cannot view         |

**Default**: All new content is created as **Public** unless coach explicitly marks it as Private.
