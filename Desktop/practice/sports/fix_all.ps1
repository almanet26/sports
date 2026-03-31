# Fix all TypeScript errors

# Navigate to frontend
cd frontend

# Run build to verify
npm run build

# If successful, commit
if ($LASTEXITCODE -eq 0) {
    cd ..
    git add .
    git commit -m "fix: Resolve all TypeScript build errors and add logo"
    git push
    Write-Host "All fixes applied and pushed successfully!"
} else {
    Write-Host "Build failed. Please check errors."
}
