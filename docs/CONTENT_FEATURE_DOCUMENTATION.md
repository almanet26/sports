# Coach Content Feature - Complete Flow Documentation

## Overview
This feature allows coaches to upload educational content (articles, videos, images) that players and admins can browse, view, and like. Views and likes are automatically tracked.

## User Roles & Access

### 1. COACHES
**What they can do:**
- Upload content (articles, videos, images) at `/coach/content`
- Add titles, descriptions, tags, and thumbnails
- View their own content statistics (views, likes)
- Delete their own content
- Update their content

**How to access:**
- Navigate to "My Content" in the coach sidebar
- Click "Upload" button to create new content

### 2. PLAYERS
**What they can do:**
- Browse all public content from all coaches at `/browse-content`
- Search and filter content by type (article/video/image)
- View detailed content at `/content/:id`
- Like content (once per item, tracked in localStorage)
- Views are automatically counted when they open content

**How to access:**
- Navigate to "Learning Hub" in the player sidebar
- Click on any content card to view details
- Click the "Like" button to like content

### 3. ADMINS
**What they can do:**
- Same as players - browse and view all content
- Access via "Learning Hub" in admin sidebar

## How Views & Likes Work

### Views Counter
**When it increments:**
- Every time someone opens the content detail page (`/content/:id`)
- The backend endpoint `GET /api/v1/coach/content/{id}` automatically increments the view count
- No authentication required - anyone can view

**Backend logic:**
```python
@router.get("/content/{content_id}")
def get_content(content_id: str, db: Session):
    content = db.query(CoachContent).filter(CoachContent.id == content_id).first()
    
    # Increment views automatically
    content.views += 1
    db.commit()
    
    return content
```

### Likes Counter
**When it increments:**
- When a user clicks the "Like" button on the content detail page
- Each user can only like once per content item (tracked in browser localStorage)
- The backend endpoint `POST /api/v1/coach/content/{id}/like` increments the like count

**Frontend logic:**
```typescript
const handleLike = async () => {
  if (!id || liked) return; // Prevent duplicate likes
  
  const response = await api.post(`/coach/content/${id}/like`);
  setContent(prev => ({ ...prev, likes: response.data.likes }));
  setLiked(true);
  localStorage.setItem(`liked_${id}`, 'true'); // Remember user liked this
};
```

**Backend logic:**
```python
@router.post("/content/{content_id}/like")
def like_content(content_id: str, db: Session):
    content = db.query(CoachContent).filter(CoachContent.id == content_id).first()
    
    content.likes += 1
    db.commit()
    
    return {"likes": content.likes}
```

## Complete User Journey

### For Coaches (Content Creation):
1. Login as COACH
2. Navigate to "My Content" in sidebar
3. Click "Upload" button
4. Select content type (Article/Video/Image)
5. Fill in title, description, tags
6. For articles: Write content in textarea
7. For videos/images: Upload file
8. Optionally upload thumbnail
9. Click "Upload" - content is saved to database
10. View content in their list with stats

### For Players/Admins (Content Consumption):
1. Login as PLAYER or ADMIN
2. Navigate to "Learning Hub" in sidebar
3. Browse all available content
4. Use search bar to find specific content
5. Filter by type (All/Articles/Videos/Images)
6. Click on any content card
7. **View count increments automatically**
8. Read article / watch video / view image
9. Click "Like" button if they enjoyed it
10. **Like count increments** (can only like once)
11. Click "Back to Browse" to see more content

## Database Schema

```sql
CREATE TABLE coach_content (
    id VARCHAR(36) PRIMARY KEY,              -- UUID
    coach_id VARCHAR(36) REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(20) NOT NULL,       -- 'article', 'video', 'image'
    article_body TEXT,                       -- For articles
    file_url VARCHAR(500),                   -- For videos/images
    file_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    thumbnail_url VARCHAR(500),
    tags TEXT,                               -- Comma-separated
    is_public BOOLEAN DEFAULT TRUE,
    views INTEGER DEFAULT 0,                 -- Auto-incremented on view
    likes INTEGER DEFAULT 0,                 -- Incremented on like
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
```

## API Endpoints

### Public Endpoints (No auth required):
- `GET /api/v1/coach/content/public` - Get all public content
- `GET /api/v1/coach/content/{id}` - View specific content (increments views)
- `POST /api/v1/coach/content/{id}/like` - Like content

### Coach-Only Endpoints (Requires COACH role):
- `POST /api/v1/coach/content` - Create new content
- `GET /api/v1/coach/content` - Get coach's own content
- `PUT /api/v1/coach/content/{id}` - Update content
- `DELETE /api/v1/coach/content/{id}` - Delete content

## Frontend Routes

- `/browse-content` - Browse all content (Players & Admins)
- `/content/:id` - View content details (All users)
- `/coach/content` - Manage own content (Coaches only)

## Features

### Search & Filter
- Search by title, description, or tags
- Filter by content type (article/video/image)
- Real-time filtering

### Content Types
1. **Articles**: Text-based content with rich formatting
2. **Videos**: Uploaded video files with player
3. **Images**: Image files with zoom capability

### Analytics for Coaches
- Total views per content
- Total likes per content
- Creation date
- Content type breakdown

### User Experience
- Responsive design (mobile & desktop)
- Dark/Light theme support
- Smooth animations
- Thumbnail previews
- Tag system for categorization

## Testing the Feature

1. **Create content as coach:**
   ```
   Login as coach → My Content → Upload → Fill form → Submit
   ```

2. **View as player:**
   ```
   Login as player → Learning Hub → Click content → View increments
   ```

3. **Like content:**
   ```
   On content detail page → Click "Like" button → Like count increases
   ```

4. **Verify stats:**
   ```
   Login as coach → My Content → See updated views/likes
   ```

## Notes

- Views increment on every page load (no duplicate prevention)
- Likes are limited to once per browser (localStorage)
- Content is public by default (is_public = true)
- Files are stored in `storage/coach_content/{coach_id}/`
- Thumbnails are stored in `storage/coach_content/{coach_id}/thumbnails/`
