# Phone Authentication via Cloud Functions

**Date:** October 21, 2025  
**Status:** ✅ Implemented & Deployed  
**Purpose:** Custom OTP phone authentication using Firebase Cloud Functions

---

## 🎯 **Why Cloud Functions Instead of Firebase Phone Auth?**

Firebase's web SDK (`firebase` package) **doesn't support phone authentication on React Native**. The `PhoneAuthProvider.verifyPhoneNumber()` method requires a reCAPTCHA verifier which only works in web browsers.

### Options Considered:
1. ❌ **@react-native-firebase/auth** - Requires native module installation, more complex
2. ✅ **Custom OTP with Cloud Functions** - Full control, works immediately, Twilio-ready

---

## 🏗️ **Architecture**

### Flow Diagram:
```
User enters phone → sendPhoneVerificationCode() Cloud Function
                     ↓
                  Generate 6-digit code
                     ↓
                  Store in Firestore (expires in 5 min)
                     ↓
                  Return verificationId to client
                     ↓
User enters code → verifyPhoneCode() Cloud Function
                     ↓
                  Verify code matches
                     ↓
                  Create/get user in Firestore
                     ↓
                  Generate custom token
                     ↓
                  Client signs in with custom token
```

---

## 📱 **Cloud Functions**

### 1. `sendPhoneVerificationCode`
**Purpose:** Generate and store OTP code

**Input:**
```typescript
{
  phoneNumber: "+15551234567" // E.164 format
}
```

**Output:**
```typescript
{
  verificationId: "abc123xyz",
  testCode: "123456" // Only for test numbers (650-555-xxxx)
}
```

**Logic:**
- Test numbers (+1650555xxxx): Always returns code `123456`
- Real numbers: Generates random 6-digit code
- Stores in `verifications/{verificationId}` with 5-minute expiration
- **Production:** Can integrate Twilio to send SMS

### 2. `verifyPhoneCode`
**Purpose:** Verify code and authenticate user

**Input:**
```typescript
{
  verificationId: "abc123xyz",
  code: "123456"
}
```

**Output:**
```typescript
{
  success: true,
  userId: "uid123",
  phoneNumber: "+15551234567",
  customToken: "firebase-custom-token"
}
```

**Logic:**
- Checks code matches and hasn't expired
- Creates new user if phone number is new
- Returns existing user if phone number exists
- Generates Firebase custom token for authentication
- Marks verification as used

### 3. `cleanupExpiredVerifications`
**Purpose:** Remove expired verification codes

**Schedule:** Runs every 1 hour  
**Logic:** Deletes verifications older than expiration time

---

## 🧪 **Testing**

### Test Phone Numbers:
Use any phone number starting with `+1650555`:

```
+1 650-555-1234 → Code: 123456
+1 650-555-5678 → Code: 123456
+1 650-555-9999 → Code: 123456
```

**Benefits:**
- ✅ Works instantly (no SMS needed)
- ✅ Always uses code `123456`
- ✅ Free (no SMS costs)
- ✅ Perfect for development

### Testing Steps:
1. Launch app on iOS simulator
2. Tap "Continue with Phone Number"
3. Enter: `(650) 555-1234`
4. Tap "Send Code"
5. Check console for: `📱 Test phone number - Use code: 123456`
6. Enter code: `123456`
7. ✅ Signed in!

---

## 🔐 **Security**

### Firestore Rules:
```javascript
// Verifications collection - Cloud Functions only
match /verifications/{verificationId} {
  allow read, write: if false;
}
```

Clients **cannot** read/write verifications directly - only via Cloud Functions.

### Code Expiration:
- Codes expire after **5 minutes**
- Expired codes are automatically cleaned up every hour
- Each code can only be used **once**

### Rate Limiting:
Currently no rate limiting. For production, consider:
- Cloud Functions: Use Firebase App Check
- Custom: Track attempts in Firestore
- Twilio: Built-in rate limiting

---

## 🚀 **Production Setup (Twilio)**

### To enable SMS for real phone numbers:

1. **Sign up for Twilio:**
   - https://www.twilio.com/try-twilio
   - Get $15 free credit

2. **Configure Firebase Functions:**
   ```bash
   firebase functions:config:set \
     twilio.account_sid="ACxxxxxx" \
     twilio.auth_token="your-token" \
     twilio.phone_number="+15551234567"
   ```

3. **Update Cloud Function:**
   In `functions/src/index.ts`, replace the TODO comment with:
   ```typescript
   // Install: npm install twilio
   const twilio = require('twilio');
   const client = twilio(
     functions.config().twilio.account_sid,
     functions.config().twilio.auth_token
   );
   
   await client.messages.create({
     body: `Your MessageAI verification code is: ${code}`,
     from: functions.config().twilio.phone_number,
     to: phoneNumber
   });
   ```

4. **Deploy:**
   ```bash
   cd functions
   npm install twilio
   cd ..
   firebase deploy --only functions
   ```

### Costs:
- Phone number: **$1/month**
- SMS (US): **$0.0079 per message**
- Example: 1,000 verifications = **$8.90/month**

---

## 📊 **Database Schema**

### `verifications` Collection:
```typescript
{
  verificationId: string;       // Document ID
  phoneNumber: string;          // E.164 format
  code: string;                 // 6-digit code
  createdAt: Timestamp;
  expiresAt: Timestamp;         // 5 minutes from creation
  verified: boolean;            // true after successful verification
  verifiedAt?: Timestamp;       // When code was used
}
```

### `users` Collection:
```typescript
{
  uid: string;                  // Document ID (matches Firebase Auth)
  phoneNumber: string;          // E.164 format
  displayName: string;          // Set during profile setup
  email: string;                // Optional
  createdAt: Timestamp;
}
```

---

## 🐛 **Troubleshooting**

### Error: "Phone number must be in E.164 format"
**Fix:** Ensure phone number starts with `+` and country code
```typescript
❌ "5551234567"
❌ "1-555-123-4567"
✅ "+15551234567"
```

### Error: "Code expired"
**Fix:** Request a new code (codes expire after 5 minutes)

### Error: "Invalid verification code"
**Fix:** Double-check the 6-digit code  
**Note:** For test numbers (650-555-xxxx), code is always `123456`

### Error: "Verification not found"
**Fix:** The verification may have expired or been cleaned up

---

## 🎉 **Benefits of This Approach**

1. ✅ **Works on React Native** - No native modules needed
2. ✅ **Full control** - Customize SMS content, expiration, limits
3. ✅ **Test-friendly** - Test numbers work instantly
4. ✅ **Twilio-ready** - Easy to add SMS in production
5. ✅ **Secure** - Custom tokens, code expiration, Firestore rules
6. ✅ **Scalable** - Cloud Functions auto-scale
7. ✅ **Cost-effective** - Only pay for SMS sent

---

## 📝 **Files Modified**

1. **`functions/src/index.ts`** - Added phone auth Cloud Functions
2. **`services/authService.ts`** - Updated to call Cloud Functions
3. **`firestore.rules`** - Added verifications collection rules
4. **`app/auth/phone-login.tsx`** - Uses sendPhoneVerificationCode
5. **`app/auth/verify-otp.tsx`** - Uses verifyPhoneCode

---

## 🔗 **Related Documentation**

- `docs/FIREBASE_PHONE_AUTH_SETUP.md` - Original phone auth guide
- `docs/TWILIO_SMS_SETUP.md` - Twilio integration guide
- `docs/DEPLOYMENT_GUIDE.md` - Deployment instructions

---

**Status:** ✅ Deployed to Firebase  
**Next Steps:** Test phone auth on iOS simulator  
**Production:** Add Twilio for real SMS delivery

---

