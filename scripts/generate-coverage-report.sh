#!/bin/bash

# MessageAI Test Coverage Report Generator
# Generates comprehensive coverage report with HTML output

set -e

echo "🧪 MessageAI Test Coverage Report Generator"
echo "============================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found. Running npm install..."
    npm install
fi

echo "📊 Step 1: Running all tests with coverage..."
echo ""

# Run tests with coverage
npm run test:coverage

echo ""
echo "✅ Coverage report generated!"
echo ""
echo "📈 Coverage Summary:"
echo "-------------------"

# Display coverage summary (if available)
if [ -f "coverage/coverage-summary.json" ]; then
    cat coverage/coverage-summary.json | grep -A 3 "total"
else
    echo "Coverage summary not found. Check coverage/index.html for details."
fi

echo ""
echo "📁 Coverage Reports Generated:"
echo "  • Terminal: See output above"
echo "  • HTML: coverage/index.html"
echo "  • JSON: coverage/coverage-summary.json"
echo ""
echo "🌐 To view HTML report, run:"
echo "  open coverage/index.html"
echo ""

# Check coverage thresholds
echo "🎯 Coverage Target: 70%+"
echo ""

# Offer to open HTML report
read -p "Open HTML coverage report in browser? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open coverage/index.html
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open coverage/index.html
    else
        echo "Please open coverage/index.html manually"
    fi
fi

echo ""
echo "✨ Done!"

