#!/bin/bash
echo "🔍 Fetching latest OTP codes from Firebase..."
echo ""
firebase functions:log --only sendPhoneVerificationCode --lines 10 | grep "Generated OTP"
echo ""
echo "✅ Use the 6-digit code shown above in your app!"
