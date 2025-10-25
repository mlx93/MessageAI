#!/bin/bash

# Deploy Action Items UX Improvements
# This script deploys the updated extractActions function with:
# - Removed default assignment logic
# - Smart duplicate detection (pending items only)
# - Resurrection feature for completed/deleted items

echo "🚀 Deploying Action Items UX Improvements..."
echo ""

# Change to functions directory
cd "$(dirname "$0")/../functions" || exit 1

# Build TypeScript
echo "📦 Building TypeScript..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi
echo "✅ Build complete"
echo ""

# Deploy only the extractActions function
echo "🚀 Deploying extractActions function..."
firebase deploy --only functions:extractActions
if [ $? -ne 0 ]; then
  echo "❌ Deployment failed!"
  exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test the new visibility - all users in a conversation should see all action items"
echo "2. Verify personal items are highlighted with blue background"
echo "3. Test resurrection - complete an item, then re-extract it"
echo "4. Check logs: firebase functions:log --only extractActions --limit 50"
echo "5. Look for '♻️ Resurrecting' messages in logs"
echo ""
echo "Expected behavior:"
echo "- Unassigned items stay unassigned (not auto-assigned to current user)"
echo "- All conversation participants see all action items from their conversations"
echo "- Personal items appear first with blue highlight"
echo "- Re-extracting completed items brings them back as pending"
echo ""

