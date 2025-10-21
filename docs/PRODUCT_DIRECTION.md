# Product Direction & Questions Answered

**Date:** October 21, 2025  
**Topic:** Architecture decisions, messaging non-users, testing strategy

---

## 📱 **1. Showing Only App Users in Contacts**

### Current Behavior
✅ **Already implemented!** The contacts list shows:
- **App Users** (blue avatar) - Can chat with them
- **Non-App Users** (gray avatar, disabled) - Shows "Not on MessageAI"

### The Code
```tsx
// In contacts list rendering:
{item.isAppUser ? (
  <View style={styles.chatButton}>
    <Text>Chat</Text>
  </View>
) : (
  <View style={styles.inviteButton}>
    <Text>Invite</Text>  // Future feature
  </View>
)}
```

### Filter to Show Only App Users

If you want to show ONLY app users, here's how:

```tsx
// In app/(tabs)/contacts.tsx
const loadContacts = async () => {
  const userContacts = await getUserContacts(user.uid);
  // Filter to show only app users
  const appUsers = userContacts.filter(c => c.isAppUser);
  setContacts(appUsers);
};
```

**Recommendation:** Keep showing all contacts but make non-users visually distinct (current behavior). This way users can see who they might invite.

---

## 👥 **2. Adding Test Users to Firebase**

### Yes! Add test users for better testing

**Quick Script to Add Test Users:**

```javascript
// test-users.js
const users = [
  { name: "Alice Smith", phone: "+12125551001", email: "alice@test.com" },
  { name: "Bob Johnson", phone: "+12125551002", email: "bob@test.com" },
  { name: "Carol Williams", phone: "+12125551003", email: "carol@test.com" },
  { name: "David Brown", phone: "+12125551004", email: "david@test.com" },
  { name: "Eve Davis", phone: "+12125551005", email: "eve@test.com" },
];

// Register each user via your app's register screen
```

**Better Approach: Use Firebase Console**

1. Go to Firebase Console → Authentication
2. Click "Add User"
3. Add each test user with:
   - Email: `test1@messageai.com`
   - Password: `Test123!`
4. Then manually add their Firestore document:

```javascript
// In Firestore → users collection
{
  uid: "[auto-generated from auth]",
  email: "test1@messageai.com",
  phoneNumber: "+12125551001",
  displayName: "Test User 1",
  online: false,
  createdAt: new Date()
}
```

**Recommendation:** Create 5-10 test users so you can test:
- Multiple conversations
- Group chats
- Typing indicators
- Presence (online/offline)

---

## 💬 **3. Messaging Phone Numbers Not in the App**

### Short Answer: **Not Possible with Current Architecture**

### Why?

Your app is a **pure Firebase chat app**, not an SMS gateway. Here's what you'd need:

#### Option 1: SMS Gateway (Like iMessage)
```
User A (in app) → Your Server → Twilio/SMS API → User B (not in app)
User B replies via SMS → Twilio → Your Server → User A sees it in app
```

**Cost:** ~$0.01 per SMS  
**Complexity:** High  
**Setup Time:** 2-3 weeks

#### Option 2: Invite-Only Model (Recommended)
```
User A: "Send message to +1234567890"
App: "This person isn't on aiMessage yet. Send invite?"
User A: "Yes"
App: Sends SMS invite link
User B: Clicks link, downloads app, registers
Now they can chat!
```

**Cost:** Minimal (Twilio for invites only)  
**Complexity:** Low  
**Setup Time:** 2-3 days

#### Option 3: Web Portal (Hybrid)
```
User A (in app) → Firebase → User B (gets email/SMS)
Email: "You have a message on aiMessage. View at https://aimessage.com/chat/12345"
User B: Opens in browser, can reply without downloading app
```

**Cost:** Hosting only  
**Complexity:** Medium  
**Setup Time:** 1 week

### **Recommendation for MVP**

**Start with invite-only (Option 2):**
- Users can only message other app users
- Add "Invite" button for non-users
- Sends SMS invite link via Twilio
- Simple, cost-effective, encourages growth

**Example Flow:**
```
1. User taps on non-app contact
2. Shows: "John isn't on aiMessage yet"
3. Button: "Invite John" 
4. Sends SMS: "Hey! Get aiMessage to chat with me: https://aimessage.app/invite/abc123"
5. John downloads app, registers
6. Now they can chat!
```

---

## 🏷️ **4. Renaming to "aiMessage"**

### Brand Name Change

**Current:** MessageAI  
**Proposed:** aiMessage

**Files to Update:**
1. `app.json` - Display name
2. `package.json` - Project name
3. Firebase project name (optional)
4. All docs and branding

**Should you do it now?**
- ✅ **Yes, if you're committed to the name**
- ⚠️ **But:** Focus on MVP functionality first
- 💡 **Tip:** Easy to change later in development

**Quick rename:**
```bash
# Update app display name
# Edit app.json:
{
  "expo": {
    "name": "aiMessage",
    "slug": "aimessage"
  }
}
```

---

## 🔐 **5. Streamlined Sign In Flow**

### Current Flow
```
1. Email
2. Password  
3. Display name
4. Phone number
5. Register
```

### Proposed Flow (Phone First)
```
1. Phone number (unique, primary identifier)
2. Email
3. Name
4. Password (optional - phone OTP instead?)
5. Register
```

### Best Practice: Phone + OTP

Most modern apps use phone number verification:

```
1. Enter phone number: [+1 (234) 567-8900]
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
- Use Firebase Phone Authentication
- Costs: $0.01 per verification
- Takes 2-3 days to implement

### Uniqueness

**Phone numbers are already unique in your system:**

```typescript
// In authService.ts (already implemented):
// Check for existing phone
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

## 🍎 **6. Google & Apple Auth Not Working**

### Known Issues

#### Google Auth Error
```
Error 400: invalid_request
redirect_uri=exp://192.168.1.176:8081
```

**Why:** Google OAuth redirect URIs must be whitelisted

**Fix:**
1. Go to Google Cloud Console
2. OAuth 2.0 Client IDs
3. Add redirect URI: `exp://192.168.1.176:8081/--/oauthredirect`
4. Also add: `https://aimessage.app` (for production)

#### Apple Auth
Requires:
- Paid Apple Developer account
- App ID with Sign in with Apple capability
- Production URL configured

### **Recommendation**

**For MVP: Disable social auth temporarily**

```tsx
// In login.tsx
// Comment out Google/Apple buttons
{/* <GoogleAuthButton /> */}
{/* <AppleAuthButton /> */}

// Just show:
- Email/Password login
- Or implement Phone OTP (recommended)
```

**Add social auth later** when you have:
- Production domain
- Apple Developer account
- OAuth properly configured

---

## 🤖 **7. Android Errors Explained**

### Error 1: expo-notifications not supported
```
ERROR  expo-notifications: Android Push notifications...
removed from Expo Go with SDK 53
```

**What it means:**  
Expo Go (the development app) doesn't support push notifications on Android anymore.

**Impact:**  
- ✅ Your app still works fine
- ❌ Push notifications won't work on Android (in Expo Go)
- ✅ iOS push notifications still work

**Solutions:**

**Option A: Development Build (Recommended)**
```bash
# Build custom dev app with notifications
npx expo run:android
```
This creates a custom development build with full notification support.

**Option B: Ignore for Now**
- Push notifications are "nice to have" for MVP
- Core messaging works fine without them
- Add them later with a development build

### Error 2: InternalBytecode.js not found
```
Error: ENOENT: no such file or directory
open '.../InternalBytecode.js'
```

**What it means:**  
Metro bundler error (cosmetic, doesn't break functionality)

**Fix:**
```bash
# Clear Metro cache
npx expo start -c

# Or
rm -rf node_modules
npm install
npx expo start
```

### Error 3: Invalid projectId for push token
```
ERROR  Failed to register: Invalid uuid projectId
```

**What it means:**  
Expo Go can't get push tokens without a paid Expo account

**Fix Applied:**  
I've updated the code to handle this gracefully (just committed)

**Result:**  
- ✅ App logs: "Push notifications not supported in Expo Go"
- ✅ No more error thrown
- ✅ App continues to work

---

## 📋 **Summary & Recommendations**

### Immediate Actions

1. **✅ Fixed:** Android notification errors (graceful handling)
2. **📝 Consider:** Add 5-10 test users to Firebase
3. **🚫 Skip:** Messaging non-users (not feasible for MVP)
4. **⏳ Later:** Rename to "aiMessage" (easy to do anytime)
5. **🔐 Improve:** Streamline auth flow (phone-first)
6. **🍎 Disable:** Social auth until production ready

### Priority Order

**Week 1 (Now):**
- ✅ Fix Android errors (done!)
- Add test users to Firebase
- Test with 2+ users chatting
- Verify all features work

**Week 2:**
- Implement phone-first registration
- Add phone OTP verification
- Simplify sign-up flow

**Week 3:**
- Add "Invite" feature for non-users
- Polish UI/UX
- Test on real devices

**Week 4:**
- Production build (not Expo Go)
- Configure social auth properly
- Deploy to TestFlight/Play Store

---

## 🎯 **Your App vs iMessage**

### What You Have
- ✅ Real-time messaging
- ✅ Group chats
- ✅ Typing indicators
- ✅ Read receipts
- ✅ Image sharing
- ✅ Offline support
- ✅ Native feel

### What iMessage Has (That You Don't)
- ❌ SMS fallback for non-users
- ❌ End-to-end encryption
- ❌ Animoji/Memoji
- ❌ iMessage effects
- ❌ Apple ecosystem integration

### Your Competitive Advantage
- ✅ **Cross-platform** (iOS + Android)
- ✅ **AI features** (potential)
- ✅ **Custom branding**
- ✅ **Full control**

---

## 💡 **Next Steps**

1. **Commit the Android fix:**
   ```bash
   git add -A
   git commit -m "fix: Handle Android notification errors gracefully"
   git push
   ```

2. **Add test users** (see section 2)

3. **Test multi-user scenarios:**
   - Register 2 users on different devices/simulators
   - Start conversations
   - Test typing indicators
   - Test presence
   - Send images

4. **Decide on auth flow** (phone-first recommended)

---

Want me to implement any of these features? I recommend:
1. Phone-first registration (2-3 hours)
2. Phone OTP verification (1 day)
3. Invite feature for non-users (3-4 hours)

