# Testing Guide

Comprehensive testing strategy for backend and frontend.

---

## 📑 Table of Contents

1. Testing Overview
2. Backend Unit Tests
3. Backend Integration Tests
4. Frontend Unit Tests
5. End-to-End (E2E) Tests
6. Performance Tests
7. Running Tests

---

## 1. Testing Overview

### Test Pyramid

```
         E2E Tests (UI)
          ↑ 
     Integration Tests
        ↑  ↑
    Unit Tests
```

### Testing Tools

**Backend:**
- `pytest` - Test framework
- `pytest-cov` - Coverage reporting
- `pytest-asyncio` - Async test support
- `responses` - Mock HTTP requests

**Frontend:**
- `Vitest` - Fast unit test runner
- `React Testing Library` - Component testing
- `Playwright` - E2E testing

---

## 2. Backend Unit Tests

### Setup

```bash
cd backend
pip install pytest pytest-cov pytest-asyncio
pytest --version
```

### File Structure

```
backend/tests/
├── __init__.py
├── conftest.py              # Shared fixtures
├── test_ocr_logic.py        # OCR engine tests
├── test_event_detection.py  # Event detection tests
├── test_auth.py             # Authentication tests
├── test_videos.py           # Video upload/processing tests
├── test_batting.py          # Batting analysis tests
└── data/                    # Test fixtures & sample data
    └── sample_videos/
```

### Example Test: OCR Logic

**File: `tests/test_ocr_logic.py`**

```python
import pytest
from scripts.ocr_engine import OCREngine, EventDetector
from collections import deque

class TestOCREngine:
    """Test OCR engine state machine and event detection."""
    
    @pytest.fixture
    def ocr_engine(self):
        """Create OCR engine instance."""
        return OCREngine(roi_x=240, roi_y=940, roi_w=170, roi_h=80)
    
    def test_score_increase_detection(self, ocr_engine):
        """Test detecting 4-run increase."""
        
        # Simulate score history: [98, 99, 100, 101, 102]
        scores = [98, 99, 100, 101, 102]
        
        # Process through median filter
        median_score = sorted(scores[2:])  # Middle 3 values
        
        # Detect event
        detected = ocr_engine.detect_event(prev_score=98, curr_score=100)
        
        assert detected == "FOUR"
    
    def test_wicket_detection(self, ocr_engine):
        """Test detecting wicket (score change: 0 or 1)."""
        
        detected = ocr_engine.detect_event(
            prev_runs=100,
            curr_runs=100,
            prev_wickets=4,
            curr_wickets=5
        )
        
        assert detected == "WICKET"
    
    def test_flicker_immunity(self, ocr_engine):
        """Test median smoothing prevents flicker false positives."""
        
        # Simulate flicker: [100, 101, 102, 101, 100]
        # Median should ignore temporary spike
        
        history = deque([100, 101, 102, 101, 100], maxlen=5)
        median = sorted(list(history))[len(history) // 2]
        
        assert median == 101  # Median ignores spike
    
    def test_sanity_check_score_decrease(self, ocr_engine):
        """Test rejecting invalid score decreases."""
        
        detected = ocr_engine.detect_event(
            prev_runs=100,
            curr_runs=99  # Invalid: score shouldn't decrease
        )
        
        assert detected is None
```

### Example Test: Authentication

**File: `tests/test_auth.py`**

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class TestAuthentication:
    """Test auth endpoints."""
    
    def test_register_new_user(self):
        """Test user registration."""
        
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "name": "Test User",
                "password": "SecurePass123!",
                "team": "India"
            }
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["user"]["email"] == "test@example.com"
        assert data["access_token"]
        assert data["refresh_token"]
    
    def test_register_duplicate_email(self):
        """Test registration fails with duplicate email."""
        
        # First registration
        client.post(
            "/api/v1/auth/register",
            json={
                "email": "duplicate@example.com",
                "name": "User 1",
                "password": "Pass123!"
            }
        )
        
        # Second registration with same email
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "duplicate@example.com",
                "name": "User 2",
                "password": "Pass456!"
            }
        )
        
        assert response.status_code == 409  # Conflict
    
    def test_login_success(self):
        """Test successful login."""
        
        # Register first
        client.post(
            "/api/v1/auth/register",
            json={
                "email": "login@example.com",
                "name": "Login User",
                "password": "TestPass123!"
            }
        )
        
        # Login
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "login@example.com",
                "password": "TestPass123!"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["access_token"]
    
    def test_login_invalid_password(self):
        """Test login fails with wrong password."""
        
        response = client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "WrongPass"
            }
        )
        
        assert response.status_code == 401
    
    def test_protected_endpoint_requires_auth(self):
        """Test protected endpoint without token fails."""
        
        response = client.get("/api/v1/videos/my-videos")
        
        assert response.status_code == 401
```

### Run Tests

```bash
# Run all tests
pytest

# Run specific file
pytest tests/test_auth.py

# Run specific test
pytest tests/test_auth.py::TestAuthentication::test_login_success

# Run with verbose output
pytest -v

# Show print statements
pytest -s

# Generate coverage report
pytest --cov=. --cov-report=html
# Open htmlcov/index.html in browser
```

---

## 3. Backend Integration Tests

### Setup Database for Testing

**File: `tests/conftest.py`**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import app, get_db
from database.config import Base

# Use in-memory SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

@pytest.fixture(scope="function")
def db():
    """Create test database."""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    Base.metadata.create_all(bind=engine)
    
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    
    yield db
    
    db.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db):
    """Create test client with test database."""
    def override_get_db():
        yield db
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield TestClient(app)
    
    app.dependency_overrides.clear()
```

### Integration Test Example

```python
def test_video_ocr_workflow(client, db):
    """Test complete video -> OCR -> events workflow."""
    
    # 1. Register user
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "ocr@test.com", "name": "OCR User", "password": "Pass123!"}
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Upload video
    with open("tests/data/sample_videos/test_match.mp4", "rb") as f:
        resp = client.post(
            "/api/v1/videos/upload",
            headers=headers,
            files={"file": f},
            data={"title": "Test Match"}
        )
    
    video_id = resp.json()["id"]
    assert resp.status_code == 201
    
    # 3. Trigger OCR
    resp = client.post(
        "/api/v1/jobs/trigger",
        headers=headers,
        json={"video_id": video_id}
    )
    
    assert resp.status_code == 202  # Accepted
    
    # 4. Check job status
    resp = client.get(
        f"/api/v1/jobs/{video_id}/status",
        headers=headers
    )
    
    data = resp.json()
    assert data["status"] in ["pending", "processing", "completed"]
    
    # 5. Get results
    resp = client.get(
        f"/api/v1/jobs/{video_id}/result",
        headers=headers
    )
    
    if resp.json()["status"] == "completed":
        assert "events" in resp.json()
        assert "supercut_path" in resp.json()
```

---

## 4. Frontend Unit Tests

### Example: VideoPlayer Component Test

**File: `frontend/src/components/__tests__/VideoPlayer.test.tsx`**

```tsx
import { render, screen, userEvent } from '@testing-library/react';
import { VideoPlayer } from '@/components/VideoPlayer';

describe('VideoPlayer', () => {
  it('renders video player with source', () => {
    render(<VideoPlayer src="test.mp4" />);
    
    const video = screen.getByRole('img', { hidden: true });
    expect(video).toHaveAttribute('src', 'test.mp4');
  });
  
  it('displays event markers when events provided', () => {
    const events = [
      { id: '1', event_type: 'FOUR', timestamp_seconds: 10 },
      { id: '2', event_type: 'SIX', timestamp_seconds: 20 },
    ];
    
    render(<VideoPlayer src="test.mp4" events={events} />);
    
    expect(screen.getByText('FOUR')).toBeInTheDocument();
    expect(screen.getByText('SIX')).toBeInTheDocument();
  });
  
  it('calls onEventClick when event marker clicked', async () => {
    const mockClick = jest.fn();
    const events = [
      { id: '1', event_type: 'FOUR', timestamp_seconds: 10 },
    ];
    
    render(
      <VideoPlayer 
        src="test.mp4" 
        events={events} 
        onEventClick={mockClick}
      />
    );
    
    const marker = screen.getByText('FOUR');
    await userEvent.click(marker);
    
    expect(mockClick).toHaveBeenCalledWith(events[0]);
  });
});
```

### Run Frontend Tests

```bash
cd frontend
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

---

## 5. End-to-End (E2E) Tests

### Example: Upload & Analyze Workflow

**File: `frontend/tests/e2e/video-workflow.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Video Upload & OCR Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('http://localhost:5173');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button:has-text("Login")');
    
    // Wait for redirect to dashboard
    await page.waitForURL('http://localhost:5173/dashboard');
  });
  
  test('Upload video and trigger OCR', async ({ page }) => {
    // Navigate to upload page
    await page.click('a:has-text("Upload")');
    
    // Fill form
    await page.fill('input[placeholder="Video title"]', 'Test Match');
    
    // Upload file
    const fileInput = await page.$('input[type="file"]');
    await fileInput!.setInputFiles('tests/fixtures/sample_video.mp4');
    
    // Submit
    await page.click('button:has-text("Upload")');
    
    // Wait for upload to complete
    await page.waitForSelector('text=Upload complete');
    
    // Trigger OCR
    await page.click('button:has-text("Analyze")');
    
    // Monitor progress
    await expect(page.locator('text=Processing...')).toBeVisible();
    
    // Wait for completion
    await page.waitForSelector('text=Analysis complete', { timeout: 60000 });
    
    // Verify events displayed
    const eventCount = await page.locator('.event-marker').count();
    expect(eventCount).toBeGreaterThan(0);
  });
});
```

### Run E2E Tests

```bash
# Install Playwright
npm install -D @playwright/test

# Run E2E tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test
npx playwright test video-workflow
```

---

## 6. Performance Tests

### Load Test with Locust

**File: `tests/load/locustfile.py`**

```python
from locust import HttpUser, task, between
import random

class SportsAPIUser(HttpUser):
    wait_time = between(1, 5)
    
    def on_start(self):
        """Login before starting tasks."""
        response = self.client.post("/api/v1/auth/login", json={
            "email": "load@test.com",
            "password": "TestPass123!"
        })
        self.token = response.json()["access_token"]
    
    @task(3)
    def get_videos(self):
        """Get video list."""
        self.client.get(
            "/api/v1/videos/public",
            headers={"Authorization": f"Bearer {self.token}"}
        )
    
    @task(1)
    def get_video_details(self):
        """Get single video details."""
        video_id = random.choice(self.available_videos)
        self.client.get(
            f"/api/v1/videos/{video_id}",
            headers={"Authorization": f"Bearer {self.token}"}
        )
    
    @task(2)
    def get_events(self):
        """Get events for video."""
        video_id = random.choice(self.available_videos)
        self.client.get(
            f"/api/v1/videos/{video_id}/events",
            headers={"Authorization": f"Bearer {self.token}"}
        )
```

**Run Load Test:**
```bash
pip install locust

locust -f tests/load/locustfile.py --host http://localhost:8000 --users 100 --spawn-rate 10
# Opens Locust UI at http://localhost:8089
```

---

## 7. Running Tests

### Full Test Suite

```bash
# Backend
cd backend
pytest --cov=. --cov-report=html

# Frontend
cd frontend
npm test -- --coverage

# E2E
cd frontend
npx playwright test
```

### CI/CD Integration

**GitHub Actions: `.github/workflows/tests.yml`**

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: 3.10
      
      - run: pip install -r backend/requirements.txt
      - run: cd backend && pytest --cov

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: 18
      
      - run: cd frontend && npm install
      - run: cd frontend && npm test -- --coverage
      - run: cd frontend && npx playwright test
```

---

## Best Practices

1. **Test Naming:** `test_<what>_<condition>_<expected_result>`
   - ✅ `test_login_with_invalid_password_returns_401`
   - ❌ `test_login`

2. **Arrange-Act-Assert (AAA):**
   ```python
   # Arrange: Setup
   user = create_test_user()
   
   # Act: Execute
   result = user.login("wrong_password")
   
   # Assert: Verify
   assert result.error == "Invalid credentials"
   ```

3. **Test Independence:** Each test should be independent
   - No shared state between tests
   - Clean up after each test

4. **Meaningful Assertions:**
   ```python
   # ✅ Good
   assert response.status_code == 401
   assert "Invalid credentials" in response.json()["message"]
   
   # ❌ Bad
   assert response  # Too vague
   ```

---

**Last Updated:** March 16, 2026
