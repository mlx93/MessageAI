#!/bin/bash

# Deploy Decision Semantic Deduplication
# This script deploys the updated extractDecisions function with semantic deduplication

echo "🚀 Deploying Decision Semantic Deduplication..."
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

# Deploy only the extractDecisions function
echo "🚀 Deploying extractDecisions function..."
firebase deploy --only functions:extractDecisions
if [ $? -ne 0 ]; then
  echo "❌ Deployment failed!"
  exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test with a conversation that has duplicate decisions"
echo "2. Check logs: firebase functions:log --only extractDecisions --limit 50"
echo "3. Look for '[Deduplication]' messages in logs"
echo ""
echo "Expected behavior:"
echo "- 'Use PostgreSQL for analytics' + 'Postgres SQL chosen' = 1 decision"
echo "- 'Simplify mobile charts...' + 'Finalize mobile charts...' = 1 decision"
echo ""

