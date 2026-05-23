# Coach Content Management Feature

## Overview
The "My Content" feature allows coaches to upload and manage their educational content including articles, videos, and images. This content can be used to showcase their expertise and provide value to athletes.

## Features Implemented

### Backend (FastAPI)

1. **Database Model** (`database/models/coach_content.py`)
   - CoachContent model with fields:
     - title, description
     - content_type (article/video/image)
     - article_content (for articles)
     - file_url, thumbnail_url (for videos/images)
     - tags, views, likes
     - timestamps

2. **API Routes** (`api/routes/coach_content.py`)
   - `POST /api/v1/coach/content` - Upload new content
   - `GET /api/v1/coach/content` - Get all content by current coach
   - `GET /api/v1/coach/content/{id}` - Get specific content (increments views)
   - `PUT /api/v1/coach/content/{id}` - Update content
   - `DELETE /api/v1/coach/content/{id}` - Delete content
   - `POST /api/v1/coach/content/{id}/like` - Like content
   - `GET /api/v1/coach/{coach_id}/content` - Get public content from a coach

3. **File Storage**
   - Files stored in `storage/coach_content/{coach_id}/`
   - Thumbnails in `storage/coach_content/{coach_id}/thumbnails/`
   - Static file serving configured in main.py

### Frontend (React + TypeScript)

1. **My Content Page** (`pages/CoachContentPage.tsx`)
   - Upload modal with content type selection (article/video/image)
   - File upload with progress tracking
   - Thumbnail upload support
   - Content filtering by type
   - Grid view with thumbnails
   - View and delete actions
   - Stats dashboard showing content counts

2. **Features**
   - **Articles**: Rich text content with title, description, and tags
   - **Videos**: Video file upload with optional thumbnail
   - **Images**: Image upload with optional thumbnail
   - **Tags**: Comma-separated tags for categorization
   - **Views & Likes**: Track engagement metrics
   - **Responsive Design**: Works on all screen sizes
   - **Dark/Light Theme**: Supports both themes

## Usage

### For Coaches

1. Navigate to "My Content" from the coach dashboard
2. Click "Upload" button
3. Select content type (Article/Video/Image)
4. Fill in details:
   - Title (required)
   - Description (optional)
   - For articles: Write content
   - For videos/images: Upload file
   - Add thumbnail (optional)
   - Add tags (optional)
5. Click "Upload" to publish

### Content Management

- **View**: Click on content cards to see details
- **Delete**: Remove content you no longer want
- **Filter**: Use tabs to filter by content type
- **Stats**: See total items, articles, videos, and images count

## Database Migration

Schema changes are managed via Alembic. After adding the model, run:

```bash
cd backend
alembic upgrade head
```

## API Examples

### Upload Article
```bash
curl -X POST http://localhost:8000/api/v1/coach/content \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Batting Techniques" \
  -F "description=Learn proper batting stance" \
  -F "content_type=article" \
  -F "article_content=Full article text here..." \
  -F "tags=batting,technique,beginner"
```

### Upload Video
```bash
curl -X POST http://localhost:8000/api/v1/coach/content \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Bowling Tutorial" \
  -F "description=Master your bowling action" \
  -F "content_type=video" \
  -F "file=@video.mp4" \
  -F "thumbnail=@thumb.jpg" \
  -F "tags=bowling,tutorial"
```

### Get My Content
```bash
curl http://localhost:8000/api/v1/coach/content \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Future Enhancements

1. **Rich Text Editor**: Add WYSIWYG editor for articles
2. **Video Player**: Embedded video player with controls
3. **Comments**: Allow athletes to comment on content
4. **Sharing**: Share content on social media
5. **Analytics**: Detailed view/engagement analytics
6. **Categories**: Organize content into categories
7. **Search**: Full-text search across content
8. **Drafts**: Save content as drafts before publishing
9. **Scheduling**: Schedule content publication
10. **Monetization**: Premium content for paid subscribers

## Testing

1. Start backend: `uvicorn main:app --reload`
2. Start frontend: `npm run dev`
3. Login as a coach
4. Navigate to `/coach/content`
5. Test uploading different content types
6. Verify file storage and retrieval
7. Test filtering and deletion

## Notes

- Only coaches can create content
- Files are stored locally (can be migrated to cloud storage)
- Content is public by default (can add privacy settings)
- Views are incremented on each GET request
- Likes require separate endpoint call
