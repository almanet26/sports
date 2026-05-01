# Contributing to Cricket Analytics Platform

Thank you for contributing! This guide explains how to set up your development environment, write code, and submit changes.

---

## 📋 Table of Contents
1. Code of Conduct
2. Development Setup
3. Code Style & Standards
4. Git Workflow
5. Testing
6. Submitting PRs

---

## 1. Code of Conduct

- Be respectful and inclusive
- Report bugs responsibly
- Help others learn
- Respect privacy & data

---

## 2. Development Setup

### Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1          # Windows
# source venv/bin/activate            # Mac/Linux

pip install -r requirements.txt
pip install pytest pytest-cov black flake8   # Dev tools
cp .env.example .env
# Edit .env with local PostgreSQL URL
python migrate_db.py
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Database Setup
```bash
# Local PostgreSQL
psql -U postgres
CREATE DATABASE sports_dev;
```

---

## 3. Code Style & Standards

### Backend (Python)

**Type Hints (Mandatory):**
```python
# ✅ Correct
def process_video(file_path: str, roi: dict) -> dict:
    pass

# ❌ Wrong
def process_video(file_path, roi):
    pass
```

**Logging (No print())**
```python
import logging
logger = logging.getLogger(__name__)

# ✅ Correct
logger.info("Processing video: %s", file_path)

# ❌ Wrong
print("Processing video:", file_path)
```

**Docstrings (Google Style)**
```python
def analyze_batting(video_path: str) -> dict:
    """Analyze batting video using MediaPipe.
    
    Args:
        video_path: Path to video file
        
    Returns:
        Dictionary with biometrics and detected flaws
        
    Raises:
        FileNotFoundError: If video not found
        ValueError: If video invalid
    """
    pass
```

**Error Handling**
```python
# ✅ Correct - Strict try/except
try:
    result = ocr_engine.extract_frames(video)
except OCRError as e:
    logger.error("OCR failed: %s", e)
    raise HTTPException(status_code=500, detail="Analysis failed")

# ❌ Wrong - Bare except
try:
    result = ocr_engine.extract_frames(video)
except:
    pass
```

**Run Linters Before Commit**
```bash
# Format code
black backend/

# Check style
flake8 backend/ --max-line-length=120

# Type check
mypy backend/
```

### Frontend (TypeScript/React)

**ESLint Config:**
```bash
npm run lint     # Check
npm run lint:fix # Fix
```

**Component Structure:**
```tsx
// ✅ Correct - Functional component with hooks
import { useState } from 'react';
import { VideoPlayer } from '@/components/VideoPlayer';

interface BattingAnalysisProps {
  videoUrl: string;
  onAnalysisComplete: (data: AnalysisResult) => void;
}

export const BattingAnalysis: React.FC<BattingAnalysisProps> = ({
  videoUrl,
  onAnalysisComplete,
}) => {
  const [loading, setLoading] = useState(false);
  
  return <VideoPlayer src={videoUrl} />;
};
```

---

## 4. Git Workflow

### Branch Naming
```
feature/batting-analysis-improvements
bugfix/ocr-roi-calibration
docs/api-reference-update
refactor/video-upload-handler
```

### Commit Messages
```
[FEATURE] Add batting stride analysis
[BUGFIX] Fix OCR scoreboard detection in low light
[DOCS] Update API reference for submissions endpoint
[REFACTOR] Simplify OCR state machine logic
[TEST] Add integration tests for batting engine
```

### Creating a PR
```bash
git checkout -b feature/your-feature
# ... make changes ...
git add .
git commit -m "[FEATURE] Description here"
git push origin feature/your-feature
# Create PR on GitHub
```

**PR Checklist:**
- [ ] Tests pass locally (`pytest` / `npm test`)
- [ ] Code formatted (`black`, `eslint`)
- [ ] Docstrings updated
- [ ] API docs updated (if new endpoints)
- [ ] Database migrations added (if schema changes)

---

## 5. Testing

### Backend Tests

**Run Tests:**
```bash
cd backend
pytest                          # All tests
pytest tests/test_ocr_logic.py  # Specific file
pytest -v                       # Verbose
pytest --cov=.                  # Coverage report
```

**Write Tests:**
```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_video_upload():
    """Test video upload with valid file."""
    response = client.post(
        "/api/v1/videos/upload",
        headers={"Authorization": "Bearer valid_token"},
        files={"file": ("test.mp4", b"video_data")},
        data={"title": "Test Match"}
    )
    assert response.status_code == 201
    assert response.json()["id"]
    
def test_video_upload_unauthorized():
    """Test video upload fails without auth."""
    response = client.post("/api/v1/videos/upload")
    assert response.status_code == 401
```

### Frontend Tests

**Run Tests:**
```bash
cd frontend
npm test                    # All tests
npm test -- --coverage      # Coverage report
```

**Write Tests (Vitest/React Testing Library):**
```typescript
import { render, screen, userEvent } from '@testing-library/react';
import { BattingAnalysis } from '@/pages/BattingAnalysis';

describe('BattingAnalysis', () => {
  it('displays loading state during analysis', async () => {
    render(<BattingAnalysis />);
    const uploadButton = screen.getByRole('button', { name: /upload/i });
    
    await userEvent.click(uploadButton);
    expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
  });
});
```

---

## 6. Submitting PRs

### PR Title Format
```
[COMPONENT] Brief description (50 chars max)

Examples:
[OCR] Fix scoreboard detection lag in high-speed footage
[API] Add WebSocket endpoint for real-time job progress
[UI] Improve batting analysis report readability
```

### PR Description Template
```markdown
## What?
Brief description of changes.

## Why?
Problem being solved or feature requested.

## How?
Technical implementation details.

## Testing
- [ ] Unit tests added
- [ ] Integration tests passing
- [ ] Manual testing on local/staging

## Linked Issues
Closes #123
Related to #456

## Screenshots (if UI change)
[Include before/after screenshots]
```

### Code Review Process
1. **Automated Checks:**
   - Tests pass ✅
   - Linting passes ✅
   - Coverage maintained ✅

2. **Peer Review:**
   - At least 1 approval from maintainers
   - All comments addressed

3. **Merge:**
   - Squash commits (for cleaner history)
   - Delete branch after merge

---

## 📚 Additional Resources

- **Python Standards:** [PEP 8](https://pep8.org/), [Google Python Style](https://google.github.io/styleguide/pyguide.html)
- **TypeScript:** [Google TypeScript Style](https://google.github.io/styleguide/tsguide.html)
- **React Best Practices:** [React Docs](https://react.dev)
- **FastAPI:** [FastAPI Docs](https://fastapi.tiangolo.com)

---

## ❓ Questions?

- Open a GitHub issue
- Check existing documentation in `/docs`
- Reach out to maintainers

Thank you for contributing! 🙏
