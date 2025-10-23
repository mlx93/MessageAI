#!/bin/bash

echo "🧹 Cleaning MessageAI caches and restarting..."
echo ""

# Kill all processes
echo "1️⃣ Killing processes..."
lsof -ti:8081 | xargs kill -9 2>/dev/null
lsof -ti:19000 | xargs kill -9 2>/dev/null
lsof -ti:19001 | xargs kill -9 2>/dev/null
killall node 2>/dev/null
echo "   ✅ Processes killed"

# Clear caches
echo ""
echo "2️⃣ Clearing caches..."
rm -rf .expo
rm -rf node_modules/.cache
watchman watch-del-all 2>/dev/null || true
echo "   ✅ Caches cleared"

# Start fresh
echo ""
echo "3️⃣ Starting Expo with clean cache..."
echo ""
echo "⏳ Wait for 'Metro waiting on exp://...' message"
echo "📱 Then press 'i' for iOS Simulator"
echo ""

npx expo start --clear

