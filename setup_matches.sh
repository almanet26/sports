#!/bin/bash

# Dynamic Matches Feature - Quick Setup Script
# Run this script to deploy the matches feature

echo "🚀 Setting up Dynamic Matches Feature..."
echo ""

# Step 1: Run database migration
echo "📊 Step 1: Running database migration..."
cd backend
python migrate_matches.py

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully!"
else
    echo "❌ Database migration failed. Please check the error above."
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Restart your backend server:"
echo "   cd backend"
echo "   uvicorn main:app --reload"
echo ""
echo "2. Your frontend should automatically work with the new API"
echo ""
echo "3. Test by:"
echo "   - Login to the application"
echo "   - Navigate to Matches page"
echo "   - Click 'Schedule Match' and create a new match"
echo ""
echo "📖 For detailed documentation, see MATCHES_DEPLOYMENT.md"
