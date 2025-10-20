# Setup Issues & Solutions

**Last Updated:** October 20, 2024

---

## 🔧 Troubleshooting Guide

This document captures all issues encountered during MessageAI setup and their solutions. Use this as a reference when encountering similar problems in the future.

---

## 1. Expo Router Entry Point Conflict

### **Issue**
App showed red error screen: "Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: object."

### **Symptoms**
- App displayed for 1-2 seconds
- Then switched to render error
- Error mentioned `withDevTools` function
- Referenced `ReactFabric-dev.js`

### **Root Cause**
Conflict between traditional `App.tsx` entry point and Expo Router's file-based routing system. The `index.ts` file was importing from `App.tsx`, which was trying to import `expo-router/entry`, creating a circular dependency.

### **Solution**
```bash
# 1. Update index.ts to directly import expo-router
# File: index.ts
import 'expo-router/entry';

# 2. Remove conflicting App.tsx
rm App.tsx
```

### **Files Modified**
- `index.ts` - Changed from importing App to importing expo-router directly
- `App.tsx` - Deleted (no longer needed with Expo Router)

### **Prevention**
When using Expo Router, only use `index.ts` as the entry point. Don't create a separate `App.tsx` file.

---

## 2. Physical iPhone Expo Go Connection

### **Issue**
Expo Go on physical iPhone stuck on "Opening project..." screen with message "This is taking much longer than it should. You might want to check your internet connectivity."

### **Symptoms**
- iPhone and Mac on same WiFi network
- QR code scan works
- Loading screen appears
- Stuck indefinitely
- Eventually times out

### **Attempted Solutions**

#### Attempt 1: Direct QR Scan
- Tried scanning QR code with iPhone Camera app
- Resulted in same timeout error
- Not successful

#### Attempt 2: Manual URL Entry
- Looked for manual URL entry in Expo Go
- Feature not easily accessible in Expo Go UI
- Could not find entry point

#### Attempt 3: Tunnel Mode
```bash
# Install ngrok dependency
npm install --save-dev @expo/ngrok --legacy-peer-deps

# Start with tunnel
npx expo start --tunnel
```
- ngrok installation successful
- Tunnel start resulted in: "CommandError: ngrok tunnel took too long to connect"
- Likely network/firewall restrictions
- Not successful

### **Final Solution**
**Skip physical iPhone testing** and use simulators instead.

#### Why This Works:
- iOS Simulator provides full development functionality
- Android Emulator covers Android testing
- Physical device only needed for:
  - Camera feature testing
  - Push notification verification  
  - Final UX testing before launch

#### Benefits of Simulator-Only Development:
- ⚡ Faster (no QR code scanning)
- 🐛 Better debugging tools
- ⌨️ Mac keyboard for input
- 🔄 Instant hot reload
- 📸 Easy screenshots
- 🎯 No network issues

### **When Physical Device IS Needed**
- Testing camera functionality
- Verifying push notifications
- Final user experience testing
- Color accuracy verification
- Performance on actual hardware

---

## 3. NPM Peer Dependency Conflicts

### **Issue**
Error when installing packages: "ERESOLVE could not resolve" with conflicts between React 19.1.0 and 19.2.0.

### **Symptoms**
```
npm ERR! ERESOLVE could not resolve
npm ERR! While resolving: react-dom@19.2.0
npm ERR! Found: react@19.1.0
npm ERR! Could not resolve dependency:
npm ERR! peer react@"^19.2.0" from react-dom@19.2.0
```

### **Root Cause**
- Expo SDK 54 uses React 19.1.0
- Some packages (react-dom, react-server-dom-webpack) want React 19.2.0
- These are web-related dependencies, not needed for mobile

### **Solution**
Use `--legacy-peer-deps` flag for problematic packages:

```bash
# For individual packages
npm install <package-name> --legacy-peer-deps

# Examples that needed this flag:
npm install expo-sqlite @react-native-async-storage/async-storage --legacy-peer-deps
npm install @expo/ngrok --legacy-peer-deps
```

### **Why This Is Safe**
- React 19.1.0 vs 19.2.0 is a minor version difference
- Conflicts are for web packages (react-dom)
- We're building mobile-only (no web)
- All mobile packages work fine with 19.1.0
- Expo SDK 54 officially supports 19.1.0

### **Affected Packages**
- `@react-native-async-storage/async-storage`
- `@expo/ngrok`
- Any future packages with similar conflicts

### **Prevention**
- Always use Expo's package manager when possible: `npx expo install <package>`
- For non-Expo packages, be prepared to use `--legacy-peer-deps`
- Don't upgrade React manually; wait for Expo SDK updates

---

## 4. Git Author Configuration

### **Issue**
Initial commit used incorrect author name: "Myles Lewis High School" instead of desired "mlx93".

### **Symptoms**
- First commit had wrong author
- Needed to match GitHub identity
- Wanted consistent commit history

### **Solution**
```bash
# 1. Set global Git config
git config --global user.name "mlx93"
git config --global user.email "mylesethan93@gmail.com"

# 2. Amend the last commit with new author
git commit --amend --reset-author --no-edit

# 3. Force push to update remote history
git push --force origin main
```

### **Verification**
```bash
# Check Git config
git config user.name  # Should show: mlx93
git config user.email  # Should show: mylesethan93@gmail.com

# Check commit author
git log --format="%an <%ae>" -1
```

### **Prevention**
Set Git config before first commit:
```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### **Warning**
`git push --force` rewrites history. Only use on:
- Personal repositories
- Branches you own
- Before others have pulled

---

## 5. Firebase Credentials Security

### **Issue**
Firebase configuration files contain sensitive API keys and should not be committed to Git.

### **Symptoms**
- `firebaseConfig.md` with API keys
- `google-services.json` for Android
- `GoogleService-Info.plist` for iOS
- Risk of accidental commit

### **Solution**
```bash
# 1. Create creds directory
mkdir creds

# 2. Move all Firebase config files there
mv firebaseConfig.md creds/
mv google-services.json creds/
mv GoogleService-Info.plist creds/

# 3. Add to .gitignore
echo "creds/" >> .gitignore

# 4. Update app.json to reference new paths
# ios.googleServicesFile: "./creds/GoogleService-Info.plist"
# android.googleServicesFile: "./creds/google-services.json"
```

### **.gitignore Configuration**
```gitignore
# Credentials folder - NEVER commit these!
creds/

# Also ignore other sensitive files
.env
.env.local
firebase-debug.log
```

### **Verification**
```bash
# Check that creds/ is ignored
git status
# Should NOT show creds/ folder

# Verify files exist locally
ls creds/
# Should list: firebaseConfig.md, google-services.json, GoogleService-Info.plist
```

### **Prevention**
- Always create `creds/` folder before adding Firebase files
- Add to `.gitignore` immediately
- Never commit sensitive keys directly to code
- Use environment variables for production

---

## 6. Android Studio SDK Setup

### **Issue**
Android Studio downloaded but SDK components not automatically installed.

### **Symptoms**
- Android Studio installed
- No Android SDK available
- Cannot create virtual devices
- SDK tools missing

### **Solution**
```bash
# 1. Open Android Studio
# 2. Follow setup wizard:
#    - Choose "Standard" installation
#    - Accept license agreements
#    - Wait for SDK download (5-10 minutes, ~5-8GB)

# 3. Verify SDK location
ls ~/Library/Android/sdk/

# 4. Create Virtual Device:
#    - Tools → Device Manager
#    - Create Device
#    - Select hardware (Pixel 9 Pro)
#    - Download system image (Android 16)
#    - Finish setup
```

### **SDK Location**
- **Default:** `~/Library/Android/sdk/`
- **Emulator Binary:** `~/Library/Android/sdk/emulator/emulator`
- **AVD Storage:** `~/.android/avd/`

### **List Available Emulators**
```bash
~/Library/Android/sdk/emulator/emulator -list-avds
```

### **Start Emulator from Terminal**
```bash
~/Library/Android/sdk/emulator/emulator -avd Pixel_9_Pro
```

---

## 7. Xcode License Agreement

### **Issue**
"You have not agreed to the Xcode license agreements" error when running Git commands.

### **Symptoms**
- Xcode installed but not configured
- License agreement not accepted
- Build tools unavailable

### **Solution**
```bash
# Accept license via terminal
sudo xcodebuild -license

# Type 'agree' when prompted
# Enter your password
```

### **Alternative**
- Open Xcode application
- Agreement prompt appears automatically
- Click "Agree"

### **Verification**
```bash
# Check command line tools path
xcode-select -p
# Should show: /Applications/Xcode.app/Contents/Developer

# List available simulators
xcrun simctl list devices
```

---

## 8. Metro Bundler Port Already in Use

### **Issue** (Potential)
"Port 8081 already in use" when starting Expo.

### **Symptoms**
- Previous Expo process still running
- Port conflict
- Cannot start new dev server

### **Solution**
```bash
# Kill process on port 8081
lsof -ti:8081 | xargs kill -9

# Or kill all Expo processes
pkill -f "expo start"

# Then restart
npx expo start
```

### **Prevention**
Always use `Ctrl+C` to stop Expo dev server gracefully.

---

## 9. Simulator Performance Issues

### **Issue** (Potential)
Simulator running slowly or laggy.

### **Symptoms**
- High CPU usage
- Slow animations
- Delayed input response

### **Solutions**

#### For iOS Simulator
```bash
# Disable unnecessary features
# In Simulator menu:
# - Debug → Graphics Quality Override → Low
# - Hardware → Erase All Content and Settings (if cluttered)
```

#### For Android Emulator
```bash
# Use ARM64 system image if on M1/M2 Mac
# Enable hardware acceleration
# Close other emulators
# Allocate more RAM in AVD settings
```

### **System Requirements**
- **RAM:** 16GB recommended (8GB minimum)
- **Storage:** 50GB free space
- **CPU:** Multi-core recommended

---

## 10. npm Deprecation Warnings

### **Issue**
Warnings during package installation: "npm WARN deprecated..."

### **Examples**
```
npm WARN deprecated inflight@1.0.6
npm WARN deprecated abab@2.0.6
npm WARN deprecated uuid@3.4.0
```

### **Analysis**
- These are dependency warnings
- Often from nested dependencies
- Not directly used in our code
- Safe to ignore in most cases

### **When to Act**
- If security vulnerability reported
- If functionality breaks
- If package maintainer recommends action

### **Prevention**
- Keep packages updated
- Run `npm audit` regularly
- Monitor for security advisories

---

## 📚 Quick Reference Commands

### **Check Environment**
```bash
node --version          # Should be v22+
npm --version           # Should be 9+
firebase --version      # Should be 14+
expo --version          # Expo CLI version
xcode-select -p        # Xcode path
```

### **Fix Common Issues**
```bash
# Clear npm cache
npm cache clean --force

# Clear Expo cache
npx expo start --clear

# Reset Metro bundler
npx react-native start --reset-cache

# Kill port 8081
lsof -ti:8081 | xargs kill -9

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### **Git Fixes**
```bash
# Reset to remote state
git fetch origin
git reset --hard origin/main

# Unstage files
git reset HEAD <file>

# Amend last commit
git commit --amend --no-edit
```

---

## 💡 General Troubleshooting Tips

### **When Something Doesn't Work:**

1. **Check the Terminal**
   - Look for error messages
   - Read the full error (don't skip details)
   - Google the error code

2. **Clear Caches**
   - Expo cache: `npx expo start --clear`
   - npm cache: `npm cache clean --force`
   - Metro bundler: Stop and restart

3. **Restart Services**
   - Stop Expo server (Ctrl+C)
   - Close simulators
   - Restart simulators
   - Start Expo again

4. **Check Versions**
   - Ensure compatible package versions
   - Verify Expo SDK compatibility
   - Check React Native version

5. **Read Documentation**
   - Expo docs: https://docs.expo.dev
   - Firebase docs: https://firebase.google.com/docs
   - React Native docs: https://reactnative.dev/docs

6. **Ask for Help**
   - Include full error message
   - Share relevant code
   - Describe steps to reproduce

---

**Last Updated:** October 20, 2024

