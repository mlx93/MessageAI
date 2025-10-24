# Product Direction & Post-MVP Planning

**Last Updated:** October 21, 2025  
**Status:** MVP Complete - Planning Next Phase  
**Source:** `docs/PRODUCT_DIRECTION.md`

---

## 🎯 Current State

### What We Have
- ✅ **Real-time messaging** with < 1 second delivery
- ✅ **Group chats** with unlimited participants
- ✅ **Typing indicators** with animated bubbles
- ✅ **Read receipts** (delivered/read status)
- ✅ **Image sharing** with compression
- ✅ **Offline support** with queue
- ✅ **Phone + OTP auth** (WhatsApp style)
- ✅ **Presence system** (online/offline)
- ✅ **Contact management** with native picker
- ✅ **iMessage-style UI** with gesture support
- ✅ **Native feel** on iOS and Android

### Competitive Position
**vs. iMessage:**
- ✅ Cross-platform (iOS + Android)
- ✅ Full control over features
- ✅ Custom branding
- ❌ No SMS fallback
- ❌ No end-to-end encryption (yet)

---

## 📱 Contact Display Strategy

### Current Implementation ✅
Contacts list shows:
- **App Users** (blue avatar) → Can chat immediately
- **Non-App Users** (gray avatar, disabled) → Shows "Not on MessageAI"

### Option: Filter to Show Only App Users
```tsx
// In app/(tabs)/contacts.tsx
const loadContacts = async () => {
  const userContacts = await getUserContacts(user.uid);
  const appUsers = userContacts.filter(c => c.isAppUser);
  setContacts(appUsers);
};
```

### Recommendation
**Keep current behavior** - showing all contacts but making non-users visually distinct allows users to see who they might invite.

---

## 👥 Test Users Strategy

### Recommendation: Add 5-10 Test Users

**Quick Setup via Firebase Console:**
1. Go to Firebase Console → Authentication
2. Click "Add User"
3. Add test users:
   ```
   Email: test1@aimessage.com, Password: Test123!
   Email: test2@aimessage.com, Password: Test123!
   Email: test3@aimessage.com, Password: Test123!
   ```
4. Manually add Firestore documents:
   ```javascript
   // In Firestore → users collection
   {
     uid: "[from auth]",
     email: "test1@aimessage.com",
     phoneNumber: "+12125551001",
     displayName: "Alice Test",
     online: false,
     createdAt: new Date()
   }
   ```

**Why Multiple Test Users:**
- Test multiple conversations
- Test group chats
- Test typing indicators
- Test presence (online/offline)
- Test notification delivery

---

## 💬 Messaging Non-Users: Product Decision

### Short Answer: **Not Possible with Current Architecture**

### Why?
aiMessage is a **pure Firebase chat app**, not an SMS gateway.

### Three Options:

#### Option 1: SMS Gateway (Like iMessage)
```
User A (in app) → Server → Twilio → User B (SMS)
User B replies → Twilio → Server → User A (in app)
```
**Cost:** ~$0.01 per SMS  
**Complexity:** High  
**Time:** 2-3 weeks  
**Status:** Not recommended for MVP

---

#### Option 2: Invite-Only Model ✅ RECOMMENDED
```
User A: "Send message to +1234567890"
App: "This person isn't on aiMessage yet. Send invite?"
User A: "Yes"
App: Sends SMS invite link
User B: Downloads app, registers
Now they can chat!
```
**Cost:** Minimal (Twilio for invites only)  
**Complexity:** Low  
**Time:** 2-3 days  
**Benefits:**
- Simple to implement
- Cost-effective
- Encourages organic growth
- Maintains app-only communication

**Example Flow:**
1. User taps non-app contact
2. Shows: "John isn't on aiMessage yet"
3. Button: "Invite John"
4. Sends SMS: "Get aiMessage to chat with me: https://aimessage.app/invite/abc123"
5. John downloads app, registers
6. Now they can chat!

---

#### Option 3: Web Portal (Hybrid)
```
User A (in app) → Firebase → User B (email/SMS)
Email: "View message: https://aimessage.com/chat/12345"
User B: Opens browser, can reply without downloading
```
**Cost:** Hosting only  
**Complexity:** Medium  
**Time:** 1 week  
**Status:** Future consideration

---

### MVP Recommendation
**Start with invite-only (Option 2):**
- Implement "Invite" button for non-users
- Use Twilio to send SMS invites
- Include referral tracking for growth metrics
- Defer SMS gateway to future phase

---

## 🏷️ Branding: "aiMessage" vs "MessageAI"

### Current Status
**Project Name:** MessageAI  
**Proposed Name:** aiMessage

### Files to Update for Rebrand
1. `app.json` - Display name, slug
2. `package.json` - Project name
3. Firebase project name (optional)
4. All docs and UI text

### Recommendation
✅ **Do it now if committed to the name**  
⚠️ **Or:** Focus on features first, rebrand later  
💡 **Note:** Easy to change anytime before production

**Quick Rename:**
```json
// app.json
{
  "expo": {
    "name": "aiMessage",
    "slug": "aimessage"
  }
}
```

---

## 🔐 Streamlined Sign-In Flow

### Current Flow
```
1. Email
2. Password
3. Display name
4. Phone number
5. Register
```

### Recommended: Phone-First + OTP ✅ IMPLEMENTED
```
1. Enter phone: [+1 (234) 567-8900]
2. Tap "Continue"
3. Enter 6-digit code: [_ _ _ _ _ _]
4. Tap "Verify"
5. Enter name: [John Smith]
6. (Optional) Add email for recovery
7. Done!
```

**Benefits:**
- ✅ Seamless (no password to remember)
- ✅ Phone verified automatically
- ✅ Unique by design
- ✅ Industry standard (WhatsApp, Signal, Telegram)

**Implementation:**
- Uses Firebase Phone Authentication
- Costs: $0.01 per verification
- **Status:** ✅ Already implemented!

### Phone Number Uniqueness
**Already enforced** via Firestore queries:
```typescript
// In authService.ts
const phoneQuery = query(
  collection(db, 'users'),
  where('phoneNumber', '==', normalizedPhone)
);
const phoneSnapshot = await getDocs(phoneQuery);
if (!phoneSnapshot.empty) {
  throw new Error('Phone number already registered');
}
```

---

## 🍎 Social Auth Status & Issues

### Google Sign-In

#### Error 400: Invalid Request
```
redirect_uri=exp://192.168.1.176:8081
```

**Why:** Redirect URIs must be whitelisted in Google Cloud Console

**Fix for Production:**
1. Go to Google Cloud Console
2. OAuth 2.0 Client IDs
3. Add redirect URIs:
   - `exp://192.168.1.176:8081/--/oauthredirect`
   - `https://aimessage.app` (production)
4. Ensure app is in "Testing" mode with test users added

**Current Status:** ⏸️ Code complete, OAuth config deferred to production build

---

### Apple Sign-In

#### Requirements:
- ✅ Paid Apple Developer account
- ✅ App ID with Sign in with Apple capability
- ✅ Production URL configured
- ❌ Not testable in Expo Go (bundle ID mismatch)

**Current Status:** ⏸️ Code complete, requires development build to test

---

### MVP Decision for Social Auth
**Temporarily disabled** for MVP testing:
```tsx
// In login.tsx (commented out)
{/* <GoogleAuthButton /> */}
{/* <AppleAuthButton /> */}
```

**Use instead:**
- Email/Password login
- Phone + OTP (recommended)

**Add social auth later** when ready for:
- Production domain setup
- Apple Developer account enrollment
- OAuth properly configured
- Development build testing

---

## 🤖 Android Known Issues

### Issue 1: Push Notifications Not Supported in Expo Go
```
ERROR: expo-notifications: Android Push notifications
removed from Expo Go with SDK 53
```

**What it means:**
- Expo Go doesn't support push notifications on Android
- iOS push notifications still work
- Core app functionality unaffected

**Solutions:**

#### Option A: Development Build (Recommended)
```bash
npx expo run:android
```
Creates custom dev app with full notification support.

#### Option B: Ignore for MVP
- Push notifications are "nice to have"
- Core messaging works without them
- Add in production build phase

---

### Issue 2: InternalBytecode.js Not Found
```
Error: ENOENT: no such file or directory
open '.../InternalBytecode.js'
```

**What it means:** Metro bundler cosmetic error

**Fix:**
```bash
# Clear Metro cache
npx expo start -c

# Or reinstall
rm -rf node_modules
npm install
npx expo start
```

---

### Issue 3: Invalid projectId for Push Token
```
ERROR: Failed to register: Invalid uuid projectId
```

**What it means:** Expo Go can't get push tokens without paid account

**Fix Applied:** ✅ Code updated to handle gracefully
```typescript
// App logs: "Push notifications not supported in Expo Go"
// No error thrown, app continues
```

---

## 📋 Immediate Action Items

### Priority 1: Testing
1. ✅ Add 5-10 test users to Firebase
2. ✅ Test with 2+ users chatting
3. ✅ Verify all features work
4. ⏸️ Multi-device testing (2 simulators)

### Priority 2: Production Prep
1. ⏸️ Create development build (EAS)
2. ⏸️ Configure social auth properly
3. ⏸️ Test push notifications on real devices
4. ⏸️ Deploy to TestFlight/Play Store

### Priority 3: Feature Enhancements
1. ⏸️ Add "Invite" feature for non-users (2-3 days)
2. ⏸️ Implement message reactions (1-2 days)
3. ⏸️ Add message search (2-3 days)
4. ⏸️ Voice messages (1 week)

---

## 📅 Development Roadmap

### Week 1 (Current) ✅
- ✅ Fix Android errors (done)
- ✅ Add test users to Firebase
- ✅ Test with 2+ users chatting
- ✅ Verify all features work

### Week 2
- [ ] Implement phone-first registration (if not done)
- [ ] Add phone OTP verification (if not done)
- [ ] Polish sign-up flow
- [ ] Test on real devices

### Week 3
- [ ] Add "Invite" feature for non-users
- [ ] Polish UI/UX
- [ ] Performance optimization
- [ ] Comprehensive testing

### Week 4
- [ ] Create production build
- [ ] Configure social auth properly
- [ ] Deploy to TestFlight (iOS)
- [ ] Deploy to Play Store (Android)

---

## 💰 Cost Estimates

### Firebase (Blaze Plan)
**Free Tier:**
- Firestore: 50K reads/day, 20K writes/day
- Storage: 5GB
- Cloud Functions: 2M invocations/month

**Paid Costs:**
- Reads: $0.06 per 100K
- Writes: $0.18 per 100K
- Storage: $0.026/GB
- Functions: $0.40 per million

### Estimated Monthly Costs
- **100 active users:** ~$5-10/month
- **1,000 active users:** ~$50-100/month
- **10,000 active users:** ~$500-1000/month

### Additional Services (Optional)
- **Twilio SMS:** $0.0079 per SMS (for invites)
- **Phone verification:** $0.01 per verification
- **App Store:** $99/year
- **Play Store:** $25 one-time

---

## 🎯 Success Criteria

### Technical
- ✅ Real-time delivery < 1 second
- ✅ Offline support working
- ✅ 60 FPS animations
- ✅ No critical bugs
- ✅ Clean architecture

### User Experience
- ✅ Onboarding < 60 seconds
- ✅ Send message in 2 taps
- ✅ Beautiful UI (iMessage quality)
- ✅ Works offline
- ✅ Native feel

### Business
- [ ] Deploy to app stores
- [ ] 100+ beta testers
- [ ] < 1% crash rate
- [ ] Positive user feedback
- [ ] Sustainable costs

---

## 🚀 Next Steps - Production Checklist

### Before Production Release
1. **Create Development Build:**
   ```bash
   eas build --profile development --platform ios
   eas build --profile development --platform android
   ```

2. **Test Social Auth:**
   - Google Sign-In in dev build
   - Apple Sign-In on real iOS device
   - Verify all OAuth flows

3. **Final Configuration:**
   - Add production SHA-1 for Android
   - Verify all redirect URIs
   - Test consent screen flow
   - Add team as test users

4. **App Store Requirements:**
   - Privacy policy (required)
   - App Store screenshots
   - App description and keywords
   - Support URL
   - Terms of service

5. **Production Build:**
   ```bash
   eas build --profile production --platform all
   eas submit --platform ios
   eas submit --platform android
   ```

---

## 💡 Key Learnings & Recommendations

### What Works Well
1. **Phone-first auth** - Best UX for messaging apps
2. **Offline-first** - SQLite provides instant loads
3. **Custom UI** - Full control over design
4. **Firebase** - Scales automatically
5. **iMessage patterns** - Users already know them

### What to Watch
1. **Firestore costs** - Monitor read/write operations
2. **SQLite growth** - Implement cleanup strategy
3. **Image storage** - Compress aggressively
4. **Push notifications** - Test thoroughly on both platforms
5. **OAuth complexity** - Document setup carefully

### Strategic Recommendations
1. **Start with invite-only** - Don't build SMS gateway yet
2. **Focus on core experience** - Messaging should be perfect
3. **Monitor costs early** - Set up billing alerts
4. **Test with real users** - Beta program before launch
5. **Build web portal eventually** - Expands reach significantly

---

## 📚 References

- **Product Decisions:** `docs/PRODUCT_DIRECTION.md`
- **MVP Summary:** `docs/MVP_COMPLETE_SUMMARY.md`
- **Firebase Setup:** `docs/FIREBASE_PHONE_AUTH_SETUP.md`
- **Deployment Guide:** `docs/DEPLOYMENT_GUIDE.md` (if exists)
- **Testing Guide:** `docs/TESTING_GUIDE.md` (if exists)

---

**Last Updated:** October 21, 2025  
**Status:** MVP Complete - Ready for Production Prep  
**Next Phase:** Week 2 - Polish & Real Device Testing

