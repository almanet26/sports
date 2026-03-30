# ========================================
# Quick Setup Script for Windows
# Usage: .\setup.ps1
# ========================================

Write-Host "`n🏏 Cricket Highlight Generator - Setup Script`n" -ForegroundColor Cyan

# Step 1: Check Python version
Write-Host "[1/5] Checking Python version..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
if ($pythonVersion -match "Python 3\.(1[0-9]|[2-9][0-9])") {
    Write-Host "✅ $pythonVersion detected" -ForegroundColor Green
} else {
    Write-Host "❌ Python 3.10+ required. Found: $pythonVersion" -ForegroundColor Red
    exit 1
}

# Step 2: Create virtual environment
Write-Host "`n[2/5] Creating virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "⚠️  venv/ already exists, skipping..." -ForegroundColor Yellow
} else {
    python -m venv venv
    Write-Host "✅ Virtual environment created" -ForegroundColor Green
}

# Step 3: Activate virtual environment
Write-Host "`n[3/5] Activating virtual environment..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"
Write-Host "✅ Virtual environment activated" -ForegroundColor Green

# Step 4: Install dependencies
Write-Host "`n[4/5] Installing Python dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet --disable-pip-version-check
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ All dependencies installed" -ForegroundColor Green
} else {
    Write-Host "❌ Dependency installation failed" -ForegroundColor Red
    exit 1
}

# Step 5: Check FFmpeg
Write-Host "`n[5/5] Checking for FFmpeg..." -ForegroundColor Yellow
$ffmpegCheck = ffmpeg -version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ FFmpeg is installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  FFmpeg not found. Install with: choco install ffmpeg" -ForegroundColor Yellow
}

# Summary
Write-Host "🎉 Setup Complete!" -ForegroundColor Green

Write-Host "📖 Full documentation: README.md`n" -ForegroundColor Gray
