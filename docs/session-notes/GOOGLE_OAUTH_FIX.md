# Google OAuth Configuration Fix

## Problem
Getting 404 error when using Google Sign-In in Expo Go.

## Root Cause
Expo Go has dynamic redirect URIs that change, making it difficult to configure Google OAuth properly for development.

## Solution for MVP Testing

### Option 1: Use Web Client ID Only (Recommended for Expo Go)
Simplify the configuration to use only `webClientId`:

```typescript
const [request, response, promptAsync] = Google.useAuthRequest({
  webClientId: '290630072291-c5m9hc72nk0lvh6g9j9mfvb6fqjb0h8v.apps.googleusercontent.com',
});
```

**Status:** ✅ Applied in code

### Option 2: Add Redirect URI to Google Cloud Console

If Option 1 doesn't work, you need to add Expo's redirect URI to Google Cloud:

1. Go to https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Web Client ID
3. Under “Authorized redirect URIs”, add:
   ```
   https://auth.expo.io/@messageai-mlx93/messageai-mlx93
   exp://localhost:19000/--/
   ```
4. Click “Save”

### Option 3: Create Development Build (Best for Production-Like Testing)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Create development build
eas build --profile development --platform ios

# Or for Android
eas build --profile development --platform android
```

Development builds use your actual bundle ID, so OAuth works properly.

## Apple Sign-In Issue

**Error:** `The audience in ID Token [host.exp.Exponent] does not match the expected audience com.mlx93.messagingapp`

**Reason:** Expo Go uses bundle ID `host.exp.Exponent`, but Firebase expects `com.mlx93.messagingapp`

**Solutions:**
1. **For MVP Testing:** Skip Apple Sign-In, use Email/Password and Google
2. **For Production:** Create development build or test on physical device with native build

**Status:** Added helpful alert in code explaining this limitation

## Testing Steps

After applying fixes:

1. **Restart Expo:**
   ```bash
   # Stop current server (Ctrl+C)
   npm start
   ```

2. **Press 'i' for iOS Simulator**

3. **Get back to app if stuck in Settings:**
   - Press `Cmd + Shift + H` (Home button)
   - Tap on MessageAI app to reopen

4. **Test Google Sign-In:**
   - Should now work without 404
   - Simplified config is more reliable in Expo Go

5. **Apple Sign-In:**
   - Will show informative alert
   - Skip for MVP testing
   - Test before App Store submission

## Why This Happens

### Expo Go Limitations:
- Uses its own bundle ID (`host.exp.Exponent`)
- Dynamic redirect URIs
- Not suitable for production OAuth testing
- Great for development, limited for social auth

### Development Build:
- Uses your actual bundle ID
- OAuth works as expected
- Better for testing production features
- Required for App Store submission anyway

## Recommendation for MVP

**For Now (MVP Testing):**
- ✅ Use Email/Password (works perfectly)
- ✅ Use Google Sign-In with simplified config
- ⏸️ Skip Apple Sign-In (test later)

**Before Production:**
- Create development build
- Test all social auth methods
- Verify on physical devices
- Submit to App Store

## Files Changed

- `app/auth/login.tsx` - Simplified Google config, added Apple alert
- `docs/GOOGLE_OAUTH_FIX.md` - This documentation

## Next Steps

1. Test Google Sign-In with new config
2. If still 404, try Option 2 (add redirect URI to Google Cloud)
3. Continue MVP development with working auth methods
4. Schedule Apple Sign-In testing for later (Hour 20+ polish phase)

