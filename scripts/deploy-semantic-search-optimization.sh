#!/bin/bash

# Deploy Semantic Search Performance Optimization
# This script deploys the optimized smartSearch function with targeted Firestore queries

set -e

echo "🚀 Deploying Semantic Search Performance Optimization..."
echo ""
echo "📊 Expected improvements:"
echo "  - Q&A Context: 90-95% faster (3-5s → 100-300ms)"
echo "  - Context Messages: 90-95% faster (3-5s → 100-300ms)"
echo "  - Total Search: 70-80% faster (10-15s → 2-4s)"
echo "  - Data Transfer: 98% reduction (500+ → 5-8 messages)"
echo "  - Firebase Costs: 99% reduction for context operations"
echo ""

# Check if we're in the project root
if [ ! -f "firebase.json" ]; then
    echo "❌ Error: firebase.json not found. Please run this script from the project root."
    exit 1
fi

# Confirm deployment
read -p "Deploy smartSearch function? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled."
    exit 1
fi

# Deploy the function
echo ""
echo "📦 Deploying smartSearch function..."
firebase deploy --only functions:smartSearch

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Test semantic search in the app"
echo "  2. Monitor performance logs:"
echo "     firebase functions:log --only smartSearch"
echo "  3. Look for timing improvements in logs:"
echo "     - '[Q&A Context] Returning X answer messages in Yms'"
echo "     - '[Context] Returning X relevant context messages in Yms'"
echo ""
echo "🎯 Expected timing:"
echo "  - Q&A Context: 100-300ms (was 3-5s)"
echo "  - Context Messages: 100-300ms (was 3-5s)"
echo "  - Total search: 2-4s (was 10-15s)"
echo ""

