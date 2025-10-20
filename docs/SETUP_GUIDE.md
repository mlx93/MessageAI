# Complete Setup Guide - MessageAI MVP
**Updated with your decisions: Always-on read receipts, phone normalization, index-based uniqueness**

---

## 🎯 What We're Setting Up

1. Development environment (Node.js, Xcode, Android Studio, Expo CLI)
2. Firebase project with all services
3. GitHub repository
4. Firebase Emulators for testing
5. iOS Simulator and Android Emulator

**Total Setup Time:** ~2-3 hours (mostly installation/downloads)

---

## ✅ Step 1: Verify Node.js Installation

Let's check if Node.js is installed and what version:

```bash
node --version
npm --version
```

**Requirements:** Node.js 18+ (20.x recommended)

**If not installed or version is too old:**
```bash
# Install via Homebrew (recommended for macOS)
brew install node

# Verify again
node --version  # Should show v18.x or v20.x
```

---

## ✅ Step 2: Install Watchman (Required by React Native)

```bash
brew install watchman
watchman --version
```

---

## ✅ Step 3: Install Xcode & iOS Simulator

### 3.1 Install Xcode
1. Open **Mac App Store**
2. Search for **Xcode** (it's free, ~15GB download)
3. Click **Get** → **Install**
4. ⏰ **This takes 30-60 minutes** depending on your internet

### 3.2 Install Command Line Tools
```bash
xcode-select --install
```

### 3.3 Install CocoaPods
```bash
sudo gem install cocoapods
pod --version
```

### 3.4 Open Xcode Once
1. Open **Xcode** from Applications
2. Accept license agreement
3. Let it install additional components
4. Go to **Preferences** → **Components** → Install **iOS 16.4 Simulator** (or latest)

### 3.5 Verify Simulators
```bash
xcrun simctl list devices available
```

You should see a list of iOS simulators (iPhone 14, iPhone 15, etc.)

---

## ✅ Step 4: Install Android Studio & Android Emulator

### 4.1 Download Android Studio
1. Go to https://developer.android.com/studio
2. Download **Android Studio**
3. Open the `.dmg` file and drag to Applications
4. ⏰ **Initial download: ~1GB, then ~5-10GB more components**

### 4.2 Initial Setup Wizard
1. Open **Android Studio**
2. Choose **Standard** installation
3. Make sure these are selected:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device (AVD)
4. Let it download everything (this takes 15-30 minutes)

### 4.3 Configure Environment Variables
Open your shell config file:
```bash
nano ~/.zshrc
```

Add these lines at the end:
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Save (Ctrl+O, Enter, Ctrl+X) and reload:
```bash
source ~/.zshrc
```

### 4.4 Create Android Virtual Device
1. In Android Studio, click **More Actions** → **Virtual Device Manager**
2. Click **Create Device**
3. Select **Pixel 6** (or any recent phone)
4. Click **Next**
5. Download system image: **Android 13 (Tiramisu)** with Google APIs
6. Click **Next** → **Finish**

### 4.5 Verify Emulator
```bash
emulator -list-avds
```

You should see your created AVD (e.g., `Pixel_6_API_33`)

---

## ✅ Step 5: Install Expo CLI & Firebase CLI

```bash
# Install Expo CLI
npm install -g expo-cli eas-cli

# Install Firebase CLI
npm install -g firebase-tools

# Verify installations
expo --version
firebase --version
```

---

## ✅ Step 6: Create Firebase Project

### 6.1 Sign in to Firebase
1. Go to https://console.firebase.google.com
2. Sign in with your Google account

### 6.2 Create New Project
1. Click **"Add project"**
2. **Project name:** `messaging-app-mvp`
3. Click **Continue**
4. **Google Analytics:** Toggle OFF (we don't need it for MVP)
5. Click **Create project**
6. Wait ~30 seconds for project creation
7. Click **Continue** when ready

### 6.3 Enable Firebase Authentication
1. In left sidebar, click **Build** → **Authentication**
2. Click **Get started**
3. Enable **Email/Password**:
   - Click on "Email/Password"
   - Toggle **Enable**
   - Click **Save**
4. Enable **Google**:
   - Click on "Google"
   - Toggle **Enable**
   - Enter support email: [your email]
   - Click **Save**
5. Enable **Apple**:
   - Click on "Apple"
   - Toggle **Enable**
   - Click **Save**

### 6.4 Create Firestore Database
1. In left sidebar, click **Build** → **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (we'll add security rules later)
4. **Location:** Choose closest to you:
   - US: `us-central1`
   - Europe: `europe-west1`
   - Asia: `asia-east1`
5. Click **Enable**
6. Wait ~30 seconds for database creation

### 6.5 Enable Cloud Storage
1. In left sidebar, click **Build** → **Storage**
2. Click **Get started**
3. Choose **Start in test mode**
4. Use **same location** as Firestore
5. Click **Done**

### 6.6 Verify Cloud Messaging (Auto-enabled)
1. In left sidebar, click **Build** → **Cloud Messaging**
2. Should show as enabled (Firebase automatically enables this)

---

## ✅ Step 7: Register Apps in Firebase

### 7.1 Register iOS App
1. In Firebase Console, go to **Project Overview**
2. Click **Add app** → **iOS**
3. **Apple bundle ID:** `com.yourcompany.messagingapp`
   - (Replace `yourcompany` with your name or company)
4. **App nickname:** `Messaging App iOS`
5. Click **Register app**
6. **Download** `GoogleService-Info.plist`
   - Save to your `Downloads` folder
7. Click **Next** → **Next** → **Continue to console**

### 7.2 Register Android App
1. Click **Add app** → **Android**
2. **Android package name:** `com.yourcompany.messagingapp`
   - (Use SAME name as iOS, just different format)
3. **App nickname:** `Messaging App Android`
4. Click **Register app**
5. **Download** `google-services.json`
   - Save to your `Downloads` folder
6. Click **Next** → **Next** → **Continue to console**

### 7.3 Get Web Configuration
1. Click **Add app** → **Web** (⚙️ icon)
2. **App nickname:** `Messaging App Web`
3. Click **Register app**
4. **Copy the firebaseConfig object** - it looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```
5. **Save this to a text file** (we'll use it in code)
6. Click **Continue to console**

---

## ✅ Step 8: Initialize Cloud Functions

```bash
# Login to Firebase
firebase login

# This will open a browser - sign in with the same Google account
```

After successful login:
```bash
# Create a directory for your project
mkdir messaging-app-mvp
cd messaging-app-mvp

# Initialize Firebase Functions
firebase init functions

# Answer the prompts:
# - "Please select an option:" → Use an existing project
# - Select your project: messaging-app-mvp
# - "What language would you like to use?" → JavaScript
# - "Do you want to use ESLint?" → No (for MVP simplicity)
# - "Do you want to install dependencies now?" → Yes
```

This creates a `functions/` folder with `index.js`.

---

## ✅ Step 9: Initialize Firebase Emulators

Still in the `messaging-app-mvp` directory:

```bash
firebase init emulators

# Answer the prompts:
# - Select emulators: (use spacebar to select, enter to confirm)
#   [x] Authentication Emulator
#   [x] Firestore Emulator
#   [x] Functions Emulator
# - Authentication port: 9099 (default)
# - Firestore port: 8080 (default)
# - Functions port: 5001 (default)
# - Would you like to download emulators now? → Yes
```

### Verify Emulators
```bash
firebase emulators:start
```

You should see:
```
✔ All emulators ready!
┌─────────────────────────────────────────────┐
│ ✔  All emulators started!                   │
│ View Emulator UI at http://localhost:4000   │
└─────────────────────────────────────────────┘
```

Press **Ctrl+C** to stop emulators (we'll use them later during testing).

---

## ✅ Step 10: Create GitHub Repository

### 10.1 Create on GitHub.com
1. Go to https://github.com/mlx93
2. Click the **+** in top-right → **New repository**
3. **Repository name:** `messaging-app-mvp`
4. **Description:** "WhatsApp-style messaging app MVP - React Native + Firebase"
5. **Visibility:** Private (recommended for now)
6. **DO NOT** initialize with README, .gitignore, or license (we'll create these)
7. Click **Create repository**

### 10.2 Note Your Repository URL
Your repo URL will be: `https://github.com/mlx93/messaging-app-mvp.git`

We'll connect it after creating the Expo project.

---

## ✅ Step 11: Project Checklist - Are We Ready to Code?

Before we start coding, verify everything:

### Development Environment
- [ ] Node.js 18+ installed
- [ ] Watchman installed
- [ ] Xcode installed with iOS Simulator
- [ ] Android Studio installed with Emulator
- [ ] Expo CLI installed globally
- [ ] Firebase CLI installed globally

### Firebase Backend
- [ ] Firebase project created (`messaging-app-mvp`)
- [ ] Authentication enabled (Email, Google, Apple)
- [ ] Firestore database created
- [ ] Cloud Storage enabled
- [ ] Firebase config files downloaded:
  - [ ] `GoogleService-Info.plist`
  - [ ] `google-services.json`
  - [ ] `firebaseConfig` object saved
- [ ] Cloud Functions initialized
- [ ] Firebase Emulators configured

### GitHub
- [ ] Repository created: `messaging-app-mvp`
- [ ] Repository URL noted

### Test Development Environment
Run these to verify:
```bash
# Test iOS Simulator
open -a Simulator

# Test Android Emulator
emulator -avd Pixel_6_API_33

# Test Firebase
firebase projects:list
```

---

## 🎯 Next Steps: Start Building!

Once all checkboxes above are complete, we're ready to:

1. **Create the Expo project** (Task 1.1 from your task list)
2. **Install dependencies** (Task 1.2)
3. **Configure Firebase** (Task 1.7)
4. **Start coding!**

---

## 📞 Troubleshooting

### iOS Simulator Won't Start
```bash
# Reset simulators
xcrun simctl erase all
xcrun simctl boot "iPhone 15"
```

### Android Emulator Issues
```bash
# Check if AVD exists
emulator -list-avds

# Start specific AVD
emulator @Pixel_6_API_33

# If stuck, open Android Studio → Virtual Device Manager → Wipe Data
```

### Firebase CLI Login Issues
```bash
# Logout and login again
firebase logout
firebase login --reauth
```

### Port Already in Use (Emulators)
```bash
# Kill processes on ports 4000, 5001, 8080, 9099
lsof -ti:4000 | xargs kill
lsof -ti:5001 | xargs kill
lsof -ti:8080 | xargs kill
lsof -ti:9099 | xargs kill
```

---

## ⏱️ Estimated Time Breakdown

| Task | Time | Can Do While Waiting |
|------|------|---------------------|
| Xcode download/install | 60-90 min | ✅ Do other steps |
| Android Studio setup | 30-45 min | ✅ Do Firebase setup |
| Firebase project setup | 15 min | ❌ Focus needed |
| Emulator setup | 20 min | ✅ Can multitask |
| GitHub repo creation | 5 min | ❌ Quick |

**Total active time:** ~45 minutes  
**Total waiting time:** ~90 minutes (downloads)

---

## 🚀 Ready to Build?

Once you complete this setup guide, come back and say:

> "Setup complete! Ready to start Task 1.1 - Create Expo Project"

And we'll begin building your messaging app! 🎉

