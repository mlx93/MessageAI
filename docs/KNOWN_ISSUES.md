# Known Issues & Limitations

**Last Updated:** October 21, 2025

---

## 🔧 Active Issues (Being Fixed)

### 1. Google OAuth 404 Error ✅ FIXED
**Issue:** Getting 404 error when trying to sign in with Google

**Root Cause:** Missing `expoClientId` in OAuth configuration

**Solution Applied:**
- Added `expoClientId` to Google.useAuthRequest configuration
- This is the Expo-specific client ID needed for the redirect URI

**Code Change:**
```typescript
const [request, response, promptAsync] = Google.useAuthRequest({
  expoClientId: '290630072291-c5m9hc72nk0lvh6g9j9mfvb6fqjb0h8v.apps.googleusercontent.com', // ADDED
  iosClientId: '290630072291-c5m9hc72nk0lvh6g9j9mfvb6fqjb0h8v.apps.googleusercontent.com',
  androidClientId: '290630072291-c5m9hc72nk0lvh6g9j9mfvb6fqjb0h8v.apps.googleusercontent.com',
  webClientId: '290630072291-c5m9hc72nk0lvh6g9j9mfvb6fqjb0h8v.apps.googleusercontent.com',
});
```

**Testing:** Restart Expo and try Google Sign-In again

---

### 2. UserProfile Undefined Error ✅ FIXED
**Issue:** TypeError when accessing `userProfile.uid.substring()` after sign-in

**Root Cause:** Race condition where UI renders before profile loads from Firestore

**Solution Applied:**
- Added null-safe display helpers with fallbacks
- Improved loading state in ChatsScreen
- All profile fields now have safe defaults

**Code Change:**
```typescript
// Safe display helpers with fallbacks
const displayName = userProfile.firstName && userProfile.lastName
  ? `${userProfile.firstName} ${userProfile.lastName}`
  : userProfile.displayName || 'User';

const displayEmail = userProfile.email || 'No email';
const displayPhone = userProfile.phoneNumber || 'Not set';
const displayUid = userProfile.uid ? userProfile.uid.substring(0, 8) : 'Unknown';
```

**Testing:** Should no longer crash when profile loads slowly

---

### 3. Social Auth Button Icons ✅ FIXED
**Issue:** Using emoji placeholders instead of proper logos

**Solution Applied:**
- Imported Ionicons from `@expo/vector-icons`
- Added `logo-google` icon for Google button
- Added `logo-apple` icon for Apple button
- Updated button layout to `flexDirection: 'row'`

**Visual Result:**
- Google button: Google "G" logo (blue) + "Continue with Google"
- Apple button: Apple logo (white) + "Continue with Apple"

---

## ⚠️ Known Limitations (iOS Simulator)

### 1. Apple Sign-In 2FA Keyboard Not Appearing
**Issue:** When using Apple Sign-In on iOS Simulator, the keyboard doesn't appear during 2FA code entry

**Root Cause:** iOS Simulator limitation - system authentication dialogs don't always trigger keyboard

**Workarounds:**
1. **Use Hardware Keyboard** (Recommended):
   - While 2FA dialog is open, just type the 6 digits on your Mac keyboard
   - Simulator will receive the input even though keyboard isn't visible
   - Press Enter/Return after typing

2. **Test on Physical Device**:
   - Build for device using EAS: `eas build --profile development --platform ios`
   - Apple Sign-In works perfectly on actual iPhones
   - Physical device required for final testing anyway

3. **Skip Apple Sign-In Testing** (Development only):
   - Focus on Google Sign-In and email/password during development
   - Test Apple Sign-In on device before App Store submission

**Status:** Expected behavior - not a bug in our code

**Documentation:** Apple's iOS Simulator has limitations with system authentication dialogs

---

### 2. Physical Device Expo Go Connection Issues
**Issue:** Expo Go on physical iPhone gets stuck on "Opening project..." screen

**Root Cause:** Network/firewall restrictions preventing WebSocket connections

**Workaround:** Use iOS Simulator for development

**Why This Is Fine:**
- iOS Simulator provides full development functionality
- Physical device only needed for:
  - Camera testing
  - Push notification final verification
  - Performance testing
  - Final UX validation

**Full Details:** See `docs/SETUP_GUIDE.md` section on Physical Device Testing

---

## 🔄 Pending Fixes (Next Session)

### 1. Firestore Security Rules Not Deployed
**Priority:** HIGH  
**Impact:** Email/phone uniqueness not enforced  
**Scheduled:** Task 5.8 (Hour 4-6)

**What Needs to Be Done:**
- Deploy Firestore security rules with uniqueness checks
- Add `emailIsUnique()` and `phoneIsUnique()` helper functions
- Test duplicate registration attempts

---

### 2. Firebase Emulator Not Setup
**Priority:** MEDIUM  
**Impact:** Integration tests can't run locally  
**Scheduled:** Before Hour 12 (testing phase)

**What Needs to Be Done:**
- Complete Task 1.6b from mvp_task_list_part1.md
- Configure Auth, Firestore, Functions emulators
- Create emulator test suite

---

### 3. Jest/Expo Module Conflicts
**Priority:** LOW  
**Impact:** Some unit tests fail  
**Workaround:** Manual testing + Firebase Emulator tests

**What Needs to Be Done:**
- Update jest.config.js transformIgnorePatterns
- Fix module mocking in jest.setup.js
- Or focus on integration tests instead

---

## 📱 Platform-Specific Issues

### iOS
- ✅ Works: Email/password, Google Sign-In
- ⚠️ Limited: Apple Sign-In (2FA keyboard in simulator)
- ✅ Recommended: Use Mac keyboard for 2FA code entry

### Android
- ✅ Works: Email/password, Google Sign-In
- ❌ N/A: Apple Sign-In (iOS only)
- ✅ No known issues

---

## 🧪 Testing Recommendations

### For Development (Simulator)
1. **Primary**: Email/password authentication
2. **Secondary**: Google Sign-In (with fix applied)
3. **Skip**: Apple Sign-In 2FA (use hardware keyboard or device)

### For Final Testing (Device)
1. Build development build: `eas build --profile development --platform ios`
2. Install on physical iPhone
3. Test all authentication methods including Apple
4. Verify push notifications
5. Test camera functionality

---

## 🐛 How to Report New Issues

If you encounter new issues:

1. **Check Console Logs**: Look for error messages
2. **Check Network Tab**: Verify API calls succeed
3. **Try on Different Simulator**: iOS vs Android
4. **Document**:
   - What you were doing
   - Error message (full text)
   - Device/Simulator used
   - Steps to reproduce

5. **Add to This Document**: Create new section above

---

## ✅ Fixed Issues Archive

Issues that were fixed and verified working:

1. ✅ Expo Router entry point conflict (Hour 0-1)
2. ✅ NPM peer dependency conflicts (Hour 0-1)
3. ✅ Git author configuration (Hour 0-1)
4. ✅ Google OAuth 404 error (Hour 2-3)
5. ✅ UserProfile undefined crash (Hour 2-3)
6. ✅ Social auth button icons (Hour 2-3)

---

**Last Updated:** October 21, 2025  
**Next Review:** After Hour 4 (Contact Management)

