# Setup Script for New Features
# Run this after pulling the new code

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "SportVision AI - New Features Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-Not (Test-Path "backend")) {
    Write-Host "Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "[1/3] Running database migration..." -ForegroundColor Yellow
cd backend
python migrate_subscription_coach.py

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Database migration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "✗ Database migration failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above and try again." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/3] Verifying backend setup..." -ForegroundColor Yellow
Write-Host "Checking if all required files exist..." -ForegroundColor Gray

$backendFiles = @(
    "api\routes\admin_coaches.py",
    "migrate_subscription_coach.py"
)

$allFilesExist = $true
foreach ($file in $backendFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file (missing)" -ForegroundColor Red
        $allFilesExist = $false
    }
}

cd ..

Write-Host ""
Write-Host "[3/3] Verifying frontend setup..." -ForegroundColor Yellow
Write-Host "Checking if all required files exist..." -ForegroundColor Gray

$frontendFiles = @(
    "frontend\src\pages\SubscriptionPage.tsx",
    "frontend\src\pages\CoachPendingPage.tsx",
    "frontend\src\pages\AdminCoachApprovalPage.tsx"
)

foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $file (missing)" -ForegroundColor Red
        $allFilesExist = $false
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($allFilesExist) {
    Write-Host "✓ Setup completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "New Features Available:" -ForegroundColor Cyan
    Write-Host "  • Password toggle on login/register pages" -ForegroundColor White
    Write-Host "  • Updated landing page text" -ForegroundColor White
    Write-Host "  • Subscription system (Basic/Silver/Gold)" -ForegroundColor White
    Write-Host "  • Coach approval workflow" -ForegroundColor White
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Start the backend: cd backend && python main.py" -ForegroundColor White
    Write-Host "  2. Start the frontend: cd frontend && npm run dev" -ForegroundColor White
    Write-Host "  3. Read NEW_FEATURES_GUIDE.md for detailed documentation" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✗ Setup incomplete - some files are missing" -ForegroundColor Red
    Write-Host "Please ensure all files were properly created." -ForegroundColor Red
}

Write-Host "========================================" -ForegroundColor Cyan
