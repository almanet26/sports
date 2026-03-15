# Backend Setup Script for Windows PowerShell

Write-Host "🚀 Setting up Cricket Analytics Backend..." -ForegroundColor Green

# Remove old virtual environment if it exists
if (Test-Path "venv") {
    Write-Host "Removing old virtual environment..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force venv
}

# Create new virtual environment
Write-Host "Creating virtual environment..." -ForegroundColor Cyan
python -m venv venv

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& ".\venv\Scripts\Activate.ps1"

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip

# Install requirements
Write-Host "Installing dependencies..." -ForegroundColor Cyan
pip install -r requirements.txt

# Run database migrations
Write-Host "Running database migrations..." -ForegroundColor Cyan
python migrate_db.py

Write-Host "✅ Backend setup complete!" -ForegroundColor Green
Write-Host "To start the server, run: uvicorn main:app --reload" -ForegroundColor Yellow
