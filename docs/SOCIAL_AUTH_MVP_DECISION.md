# Social Authentication MVP Decision

**Date:** October 21, 2025  
**Decision:** Skip Google and Apple Sign-In for MVP Testing

---

## 🎯 Current Situation

### Apple Sign-In
- **Status:** ❌ Not working in Expo Go (expected)
- **Error:** Bundle ID mismatch (`host.exp.Exponent` vs `com.mlx93.messagingapp`)
- **Solution:** Requires development build or physical device
- **Decision:** ✅ Informative alert added - skip for MVP

### Google Sign-In  
- **Status:** ❌ 404 error - redirect URI not configured
- **Error:** "The requested URL was not found on this server"
- **Cause:** Need to add Expo redirect URI to Google Cloud Console
- **Complexity:** Requires Google Cloud Console access and configuration

---

## 📋 Decision: Focus on Email/Password for MVP

### Reasons:

1. **Email/Password Works Perfectly** ✅
   - Registration works
   - Login works
   - Profile creation works
   - No configuration needed

2. **Time Investment vs Value**
   - Fixing Google OAuth: ~30-60 minutes (Google Cloud Console configuration)
   - Apple Sign-In: Requires development build or physical device
   - MVP testing can proceed with email/password only

3. **Social Auth is Not Core to MVP**
   - Primary goal: Test messaging functionality
   - Social auth is a convenience feature
   - Can be tested in production build before App Store

4. **Development Build Required Anyway**
   - For production: Will need EAS build
   - Social auth will work properly in production
   - Expo Go is not meant for production OAuth

---

## ✅ What's Working (Use for MVP Testing)

### Email/Password Authentication
- ✅ Register new users
- ✅ Login existing users  
- ✅ Profile creation
- ✅ Sign out
- ✅ Session persistence

**Testing Credentials:**
- Email: Jodiedavidson92@gmail.com
- Phone: +13059782428
- Created successfully!

---

## 🔧 To Fix Google OAuth (Optional - After MVP)

If you want to fix Google Sign-In later:

### Step 1: Get Expo Auth URL
```bash
npx expo start
# Look in terminal for auth URL, something like:
# https://auth.expo.io/@your-username/your-app-slug
```

### Step 2: Add to Google Cloud Console
1. Go to https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. Under "Authorized redirect URIs", add:
   ```
   https://auth.expo.io/@messageai-mlx93/messageai-mlx93
   ```
4. Also add:
   ```
   exp://localhost:19000/--/
   ```
5. Save changes

### Step 3: Test Again
- Restart Expo
- Try Google Sign-In
- Should work now

**Time Estimate:** 15-30 minutes

---

## 🚀 Recommended MVP Path Forward

### Phase 1: MVP Testing (Current - Hours 3-12)
**Use:** Email/Password only
**Focus on:**
- ✅ Contact management
- ✅ Conversation creation  
- ✅ Messaging
- ✅ Media sharing
- ✅ Real-time features
- ✅ Offline support

### Phase 2: Pre-Production (Hours 20-24)
**Build:** Development build with EAS
```bash
eas build --profile development --platform ios
```
**Test:** All social auth methods on device

### Phase 3: App Store Submission
**Requirement:** Apple Sign-In MUST work
**Test:** All auth flows on production build

---

## 📝 Summary

### What We Learned:
1. Expo Go has limitations for social OAuth
2. Apple Sign-In requires matching bundle IDs
3. Google OAuth needs redirect URI configuration
4. Email/Password is the most reliable for development

### What We're Doing:
1. ✅ Skip social auth for MVP testing
2. ✅ Use email/password authentication
3. ✅ Continue with core messaging features
4. ⏸️ Test social auth in production build later

### Why This Makes Sense:
- MVP goal is to test messaging, not authentication
- Email/password is sufficient for development
- Social auth will work in production builds
- Saves 1-2 hours of OAuth debugging
- Can proceed immediately with Hour 3-4 tasks

---

## 🎯 Next Steps

1. **Continue MVP Development:**
   - Move to Hour 3-4: Contact Management
   - Use existing test user (Jodie Davidson)
   - Focus on core messaging features

2. **Document for Production:**
   - Social auth will be tested before App Store
   - Development build required for proper testing
   - All configuration documented for later

3. **Test Email/Password Thoroughly:**
   - Multiple users
   - Different devices
   - Various scenarios

---

**Decision Approved:** Use email/password for MVP testing  
**Social Auth Status:** Deferred to production build testing  
**MVP Progress:** Continue to Hour 3-4 (Contacts)

---

**Last Updated:** October 21, 2025  
**Next Review:** Before production build (Hour 20+)

