# Cricket Video Analytics Platform

A web app to upload cricket videos, analyze them, and get feedback from coaches.

## How to Run

### 1. Backend (API)
- Activate virutal environment:
  ```bash
  python -m venv venv
  venv\Scripts\activate
  ```
- Go to the `backend` folder:
  ```bash
  cd backend
  ```
- Install Python packages:
  ```bash
  pip install -r requirements.txt
  ```
- Start the server:
  ```bash
  uvicorn main:app --reload
  ```

### 2. Frontend (Website)
- Go to the `frontend` folder:
  ```bash
  cd frontend
  ```
- Install Node packages:
  ```bash
  npm install
  ```
- Start the website:
  ```bash
  npm run dev
  ```

## Folders
- `frontend/` — The website (React)
- `backend/` — The API and video analysis (FastAPI)

## Requirements
- Python 3.10+
- Node.js 18+

## Database
- Uses PostgreSQL (or Supabase)
- Set your database URL in the backend `.env` file

## Storage
- Videos are stored in `storage/` (local) 
