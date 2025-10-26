#!/bin/bash

# Ava Unified Context Integration - Deployment Script
# This script deploys the new avaUnifiedSearch Cloud Function

set -e  # Exit on any error

echo "🚀 Deploying Ava Unified Context Integration..."
echo ""

# Step 1: Build TypeScript
echo "📦 Building Cloud Functions..."
cd functions
npm run build

# Step 2: Deploy only the new function
echo ""
echo "☁️  Deploying avaUnifiedSearch function..."
firebase deploy --only functions:avaUnifiedSearch

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "📝 Next Steps:"
echo "1. Test with: 'What did we decide about the database and who's working on it?'"
echo "2. Monitor logs: firebase functions:log --only avaUnifiedSearch"
echo "3. Check cost: firebase functions:log --only avaUnifiedSearch | grep 'Processing query'"
echo ""
echo "🎉 Ava can now synthesize information from messages, action items, and decisions!"

