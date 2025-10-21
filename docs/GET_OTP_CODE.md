# How to Get Your OTP Code for Real Phone Numbers

**For Development:** Since Twilio isn't configured yet, SMS won't be sent to real phone numbers. But the code is generated and logged in Firebase Cloud Functions.

---

## 🔍 **Method 1: Check Firebase Logs**

### Step 1: Enter Your Phone Number in App
Enter your phone number (e.g., 832-655-9250) and tap "Send Code"

### Step 2: Check Cloud Function Logs

Run this command in terminal:
```bash
cd /Users/mylessjs/Desktop/MessageAI
firebase functions:log --only sendPhoneVerificationCode --lines 10
```

### Step 3: Find Your Code

Look for a line like:
```
? sendphoneverificationcode: Generated OTP for +18326559250: 372817
```

The 6-digit number (e.g., **372817**) is your code!

### Step 4: Enter Code in App
Enter the 6-digit code in the verification screen.

---

## ⏱️ **Important: Code Expiration**

- Codes expire after **5 minutes**
- If expired, tap "Resend code" and get the new code from logs
- Test numbers (650-555-xxxx) always use code **123456** and never expire

---

## 🎯 **Quick Test Commands**

### Get latest code for YOUR phone:
```bash
firebase functions:log --only sendPhoneVerificationCode --lines 5
```

### Watch logs in real-time:
```bash
firebase functions:log --only sendPhoneVerificationCode
```
(Press Ctrl+C to stop)

---

## ✅ **For Production (Later)**

Once you set up Twilio:
1. Real SMS will be sent automatically
2. No need to check logs
3. Users get code on their phone instantly

**Cost:** $0.0079 per SMS (~$8 per 1,000 verifications)

---

## 🚀 **Testing Your Account**

**Your Details:**
- Phone: +1 832-655-9250
- Email: myles93@sbcglobal.net

**Steps:**
1. Sign out from test account
2. Enter: (832) 655-9250
3. Run: `firebase functions:log --only sendPhoneVerificationCode --lines 5`
4. Find your 6-digit code
5. Enter code in app
6. Complete profile (First Name, Last Name, Email)
7. Start messaging! 🎉

---

**Note:** This is only for development. In production with Twilio, users get SMS instantly!

