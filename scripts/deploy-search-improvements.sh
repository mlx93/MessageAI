#!/bin/bash

# Semantic Search Improvements Deployment Script
# This script deploys the updated Cloud Functions for semantic search

set -e  # Exit on error

echo "🚀 Deploying Semantic Search Improvements..."
echo ""

# Change to functions directory
cd "$(dirname "$0")/../functions"

echo "📦 Building TypeScript..."
npm run build

echo ""
echo "🔥 Deploying Cloud Functions..."
echo "   - smartSearch (updated search algorithm)"
echo "   - batchEmbedMessages (enhanced metadata)"
echo ""

firebase deploy --only functions:smartSearch,functions:batchEmbedMessages

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Next Steps:"
echo "   1. Monitor logs: firebase functions:log --follow"
echo "   2. Test search in app (Ava Chat → Search)"
echo "   3. Verify sender names appear correctly"
echo "   4. Check response times (should be 2-3 seconds)"
echo ""
echo "💡 To re-embed all messages with new metadata:"
echo "   - Wait for scheduled function (gradual, 3-5 hours)"
echo "   - OR manually trigger re-embedding (see docs)"
echo ""

