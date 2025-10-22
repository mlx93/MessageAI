# MessageAI - Complete Rebuild Guide

**Last Updated:** October 22, 2025  
**Version:** 1.0 (MVP Complete + Testing)  
**Purpose:** Step-by-step instructions to rebuild MessageAI from scratch

---

## 📋 Table of Contents

1. [Prerequisites & Environment Setup](#hour-0-prerequisites--environment-setup)
2. [Project Initialization](#hour-05-project-initialization)
3. [Firebase Configuration](#hour-1-firebase-configuration)
4. [File Structure & Config](#hour-15-file-structure--configuration)
5. [Feature Implementation](#hour-2-20-feature-implementation)
6. [Testing Setup](#hour-20-22-testing-setup)
7. [Deployment](#hour-22-24-deployment)
8. [Appendices](#appendices)

**Total Time Estimate:** 24 hours (MVP complete with testing)

---

## 🎯 How to Use This Guide

### If You're Starting from Scratch:
Follow **Hour 0 → Hour 24** in exact order. Each step builds on the previous one.

### If You Have Some Setup Done:
Jump to the relevant hour section. Check the appendices for complete config files.

### If You Hit Errors:
See **Appendix B: Troubleshooting** for 20+ common errors with solutions.

---

## Hour 0: Prerequisites & Environment Setup

**Goal:** Install all required tools and verify your development environment  
**Time:** 2-3 hours (mostly downloads and installations)

### 0.1 System Requirements

- **Operating System:** macOS 13+ (Ventura or later)
- **RAM:** Minimum 8GB (16GB+ recommended)
- **Disk Space:** ~50GB free
- **Apple Account:** For iOS development
- **Google Account:** For Firebase

---

### 0.2 Install Homebrew (if not already installed)

```bash
# Check if Homebrew is installed
which brew

# If not installed, install it:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

### 0.3 Install Node.js v22

```bash
# Install Node.js via Homebrew
brew install node@22

# Verify installation
node --version  # Should show v22.x.x
npm --version   # Should show 10.x.x or higher
```

**Required Version:** Node.js v22.18.0 or higher (for Cloud Functions compatibility)

---

### 0.4 Install Watchman

```bash
# Required by React Native for file watching
brew install watchman
watchman --version
```

---

### 0.5 Install Git & Configure

```bash
# Check if Git is installed
git --version

# Configure Git (replace with your info)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Verify
git config --list
```

---

### 0.6 Install Xcode & iOS Simulator

#### Step 1: Install Xcode
1. Open **Mac App Store**
2. Search for **Xcode** (free, ~15GB download)
3. Click **Get** → **Install**
4. ⏰ **Wait 30-60 minutes** for download

#### Step 2: Accept License & Install Components
```bash
# Accept Xcode license (one-time)
sudo xcodebuild -license accept

# Install Command Line Tools
xcode-select --install

# Verify
xcode-select --print-path
# Should show: /Applications/Xcode.app/Contents/Developer
```

#### Step 3: Open Xcode & Install Simulators
1. Open **Xcode** from Applications
2. Go to **Settings** (Cmd+,) → **Platforms**
3. Install **iOS 17.0** or latest
4. Close Xcode

#### Step 4: Verify Simulators
```bash
xcrun simctl list devices available | grep iPhone
```

You should see a list of iPhone simulators (iPhone 15, 16, 17, etc.)

---

### 0.7 Install Android Studio & Android SDK

#### Step 1: Download Android Studio
1. Go to https://developer.android.com/studio
2. Download **Android Studio** (~1GB)
3. Open the `.dmg` file and drag to **Applications**

#### Step 2: Initial Setup Wizard
1. Open **Android Studio**
2. Choose **Standard** installation
3. Select these components:
   - ✅ Android SDK
   - ✅ Android SDK Platform (API 33+)
   - ✅ Android Virtual Device (AVD)
4. Click **Finish** and wait for downloads (~5-10GB)

#### Step 3: Configure Environment Variables
```bash
# Open your shell config file
nano ~/.zshrc

# Add these lines at the end:
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin

# Save (Ctrl+O, Enter, Ctrl+X) and reload:
source ~/.zshrc

# Verify
echo $ANDROID_HOME
```

#### Step 4: Create Android Virtual Device (AVD)
1. In Android Studio, click **More Actions** → **Virtual Device Manager**
2. Click **Create Device**
3. Select **Pixel 9 Pro** (or any recent device)
4. Click **Next**
5. Download system image: **Android 14 (API 34)** with Google APIs
6. Click **Next** → **Finish**

#### Step 5: Verify Emulator
```bash
# List available emulators
emulator -list-avds

# Test start (then close it)
emulator @Pixel_9_Pro_API_34 &
```

---

### 0.8 Install Global CLI Tools

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Install Expo CLI (optional, but useful)
npm install -g expo-cli

# Verify installations
firebase --version  # Should show 14.x.x or higher
expo --version      # Should show 1.x.x or higher
```

---

### 0.9 Setup Checklist - Are We Ready?

Before proceeding, verify:

- [ ] Node.js v22+ installed (`node --version`)
- [ ] npm 10+ installed (`npm --version`)
- [ ] Watchman installed (`watchman --version`)
- [ ] Git configured (`git config --list`)
- [ ] Xcode installed with iOS Simulators
- [ ] Android Studio installed with AVD
- [ ] `ANDROID_HOME` environment variable set
- [ ] Firebase CLI installed (`firebase --version`)

**✅ If all checks pass, proceed to Hour 0.5**

---

## Hour 0.5: Project Initialization

**Goal:** Create Expo project, install dependencies, connect to Git  
**Time:** 30-45 minutes

### 0.5.1 Create Expo Project with Router

```bash
# Create directory
mkdir MessageAI
cd MessageAI

# Initialize Expo project with TypeScript + Router
npx create-expo-app@latest . --template tabs

# This creates:
# - app/ directory (Expo Router structure)
# - package.json
# - tsconfig.json
# - app.json
```

**Note:** Choose **TypeScript** template when prompted.

---

### 0.5.2 Install Core Dependencies

```bash
# Install Firebase SDK
npm install firebase@^12.4.0

# Install Expo modules
npm install expo-sqlite@~16.0.8
npm install expo-contacts@~15.0.10
npm install expo-notifications@~0.32.12
npm install expo-image-picker@~17.0.8
npm install expo-auth-session@~7.0.8
npm install expo-web-browser@~15.0.8
npm install expo-apple-authentication@~8.0.7

# Install React Native community modules
npm install @react-native-async-storage/async-storage@^2.2.0
npm install @react-native-community/netinfo@^11.4.1

# Install animations (with legacy peer deps flag)
npm install react-native-reanimated@~4.1.1 --legacy-peer-deps
npm install react-native-gesture-handler@^2.28.0
npm install react-native-worklets@^0.5.1 --legacy-peer-deps
npm install react-native-worklets-core@^1.6.2 --legacy-peer-deps

# Install utilities
npm install date-fns@^4.1.0
npm install uuid@^13.0.0
npm install react-native-get-random-values@^1.11.0
```

**Why `--legacy-peer-deps`?**  
React 19.x vs 19.1.x version conflicts. These are safe to ignore for our use case.

---

### 0.5.3 Install Dev Dependencies

```bash
# Install testing libraries
npm install --save-dev @testing-library/react-native@^13.3.3
npm install --save-dev @testing-library/jest-native@^5.4.3
npm install --save-dev @types/jest@~29.5.14
npm install --save-dev @types/uuid@^11.0.0
npm install --save-dev jest-expo@^54.0.12

# Install Babel preset
npm install --save-dev babel-preset-expo@^54.0.5
```

---

### 0.5.4 Update package.json Scripts

Open `package.json` and replace the `"scripts"` section with:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --coverageReporters=text --coverageReporters=html",
    "test:unit": "jest --testPathPattern='((?!integration).)*\\.test\\.ts$'",
    "test:integration": "NODE_ENV=test jest --config jest.integration.config.js",
    "test:emulators": "firebase emulators:start --only auth,firestore,functions,storage",
    "test:emulators:kill": "lsof -ti:9099,8080,5001,9199 | xargs kill -9 || true",
    "test:all": "npm run test:unit && npm run test:integration",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

---

### 0.5.5 Create Entry Point (index.ts)

Create `/Users/mylessjs/Desktop/MessageAI/index.ts`:

```typescript
import 'react-native-get-random-values';
import 'expo-router/entry';
```

**Critical:** This file must import `react-native-get-random-values` first (for UUID), then `expo-router/entry`.

---

### 0.5.6 Update app.json Configuration

See **Appendix A.1** for the complete `app.json` configuration.

Key updates needed:
- Set bundle identifier: `com.mlx93.messagingapp`
- Add iOS permissions (contacts, camera, photos)
- Add Android permissions
- Add plugins for notifications, auth

---

### 0.5.7 Initialize Git Repository

```bash
# Initialize Git
git init

# Create .gitignore (see Appendix A.6)
# Copy the .gitignore from Appendix A.6

# Initial commit
git add .
git commit -m "Initial commit: Expo + TypeScript setup"
```

---

### 0.5.8 Create GitHub Repository & Push

1. Go to https://github.com and sign in
2. Click **New repository**
3. Name: `MessageAI`
4. Visibility: **Private** (recommended)
5. **DO NOT** initialize with README
6. Click **Create repository**

Then push:

```bash
# Add remote (replace with your username)
git remote add origin https://github.com/mlx93/MessageAI.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

### 0.5.9 Verify Setup - Run Hello World

```bash
# Start Expo dev server
npm start

# In another terminal, test iOS:
npm run ios

# Or test Android:
npm run android
```

You should see the default Expo tabs app running.

**✅ If the app runs, proceed to Hour 1**

---

## Hour 1: Firebase Configuration

**Goal:** Create Firebase project, enable services, configure app  
**Time:** 45-60 minutes

### 1.1 Create Firebase Project

1. Go to https://console.firebase.google.com
2. Sign in with your Google account
3. Click **Add project**
4. Project name: `messageai-mlx93` (or your preferred name)
5. Click **Continue**
6. Disable Google Analytics (not needed for MVP)
7. Click **Create project**
8. Wait ~30 seconds
9. Click **Continue**

---

### 1.2 Enable Firebase Authentication

1. In left sidebar: **Build** → **Authentication**
2. Click **Get started**
3. Enable **Email/Password**:
   - Click "Email/Password"
   - Toggle **Enable**
   - Click **Save**
4. Enable **Phone**:
   - Click "Phone"
   - Toggle **Enable**
   - Click **Save**
5. Enable **Google**:
   - Click "Google"
   - Toggle **Enable**
   - Enter support email: [your email]
   - Click **Save**
6. Enable **Apple**:
   - Click "Apple"
   - Toggle **Enable**
   - Click **Save**

---

### 1.3 Create Cloud Firestore Database

1. In left sidebar: **Build** → **Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** (we'll add rules later)
4. Location: **us-central1** (or closest to you)
5. Click **Enable**
6. Wait ~30 seconds for creation

---

### 1.4 Enable Cloud Storage

1. In left sidebar: **Build** → **Storage**
2. Click **Get started**
3. Choose **Start in production mode**
4. Use **same location** as Firestore
5. Click **Done**

---

### 1.5 Register iOS App

1. In Firebase Console: **Project Overview**
2. Click **Add app** → **iOS** (Apple icon)
3. Bundle ID: `com.mlx93.messagingapp`
4. App nickname: `MessageAI iOS`
5. Click **Register app**
6. **Download** `GoogleService-Info.plist`
7. Save it to your **Downloads** folder
8. Click **Next** → **Next** → **Continue to console**

---

### 1.6 Register Android App

1. Click **Add app** → **Android**
2. Package name: `com.mlx93.messagingapp`
3. App nickname: `MessageAI Android`
4. Click **Register app**
5. **Download** `google-services.json`
6. Save it to your **Downloads** folder
7. Click **Next** → **Next** → **Continue to console**

---

### 1.7 Get Web Configuration

1. Click **Add app** → **Web** (</> icon)
2. App nickname: `MessageAI Web`
3. Click **Register app**
4. **Copy the entire firebaseConfig object**

It looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "messageai-mlx93.firebaseapp.com",
  projectId: "messageai-mlx93",
  storageBucket: "messageai-mlx93.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

5. Save this to a text file temporarily
6. Click **Continue to console**

---

### 1.8 Create `creds/` Folder & Move Config Files

```bash
# Create credentials folder
mkdir creds

# Move downloaded files (from Downloads)
mv ~/Downloads/GoogleService-Info.plist creds/
mv ~/Downloads/google-services.json creds/

# Create Firebase config markdown file
nano creds/firebaseConfig.md
```

Paste your Firebase config, then save (Ctrl+O, Enter, Ctrl+X).

**Security Note:** The `creds/` folder is in `.gitignore` and will NEVER be committed to Git.

---

### 1.9 Initialize Firebase Functions

```bash
# Login to Firebase CLI
firebase login

# Initialize Firebase in project
firebase init

# Select these options:
# ? Which Firebase features? 
#   ◯ Realtime Database
#   ◯ Firestore
#   ◉ Functions
#   ◯ Hosting
#   ◯ Storage
#   ◉ Emulators

# ? Please select an option: Use an existing project
# ? Select project: messageai-mlx93

# === Functions Setup ===
# ? What language? TypeScript
# ? Do you want to use ESLint? Yes
# ? Do you want to install dependencies now? Yes

# === Emulators Setup ===
# ? Which emulators?
#   ◉ Authentication Emulator
#   ◉ Functions Emulator
#   ◉ Firestore Emulator
#   ◉ Storage Emulator
# ? Authentication port: 9099 (default)
# ? Functions port: 5001 (default)
# ? Firestore port: 8080 (default)
# ? Storage port: 9199 (default)
# ? Download emulators now? Yes
```

This creates:
- `firebase.json` (emulator config)
- `functions/` directory with TypeScript setup

---

### 1.10 Create Firebase Service File

Create `services/firebase.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// REPLACE THIS with your Firebase config from creds/firebaseConfig.md
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
export const auth = Platform.select({
  web: () => getAuth(app),
  default: () => initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  })
})();

// Initialize Firestore
export const db = getFirestore(app);

// Enable offline persistence (web only)
if (Platform.OS === 'web') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Persistence not available');
    }
  });
}

// Initialize Storage
export const storage = getStorage(app);

// Initialize Functions
export const functions = getFunctions(app);

export default app;
```

**Important:** Replace the `firebaseConfig` object with your actual values from `creds/firebaseConfig.md`.

---

### 1.11 Deploy Firestore Security Rules

Create `firestore.rules` (see **Appendix A.2** for complete rules).

Then deploy:

```bash
firebase deploy --only firestore:rules
```

---

### 1.12 Test Firebase Connection

Create a simple test:

```bash
# Start Expo
npm start

# Open iOS Simulator
npm run ios
```

You should be able to access Firebase services without errors.

**✅ If Firebase is connected, proceed to Hour 1.5**

---

## Hour 1.5: File Structure & Configuration

**Goal:** Create project structure, configure TypeScript, Babel, Jest  
**Time:** 30 minutes

### 1.5.1 Create Directory Structure

```bash
# Create main directories
mkdir -p app/{auth,chat,contacts,\(tabs\)}
mkdir -p components/{chat,contacts}
mkdir -p services
mkdir -p hooks
mkdir -p store
mkdir -p types
mkdir -p utils
mkdir -p docs
mkdir -p memory_bank
mkdir -p .cursor/rules

# Create __tests__ directories
mkdir -p services/__tests__
mkdir -p hooks/__tests__
mkdir -p utils/__tests__
```

Final structure should look like:
```
MessageAI/
├── app/
│   ├── auth/           # Authentication screens
│   ├── chat/           # Chat screens
│   ├── contacts/       # Contact screens
│   ├── (tabs)/         # Tab navigation screens
│   └── _layout.tsx     # Root layout
├── components/
│   ├── chat/           # Chat UI components
│   └── contacts/       # Contact components
├── services/           # Firebase & business logic
│   └── __tests__/      # Service tests
├── hooks/              # Custom React hooks
│   └── __tests__/      # Hook tests
├── store/              # Global state (Context)
├── types/              # TypeScript types
├── utils/              # Utility functions
│   └── __tests__/      # Utility tests
├── creds/              # Firebase credentials (gitignored)
├── functions/          # Cloud Functions
├── docs/               # Documentation
├── memory_bank/        # Project memory/context
└── .cursor/rules/      # Cursor AI rules
```

---

### 1.5.2 Create TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
```

---

### 1.5.3 Create Babel Configuration

Create `babel.config.js`:

```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
```

**Critical:** The `react-native-reanimated/plugin` must be **last** in the plugins array.

---

### 1.5.4 Create Jest Configuration

Create `jest.config.js`:

```javascript
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|firebase|@firebase/.*)'
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'store/**/*.{ts,tsx}',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx|js)'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '\\.integration\\.test\\.(ts|tsx|js)$']
};
```

---

### 1.5.5 Create Jest Setup File

Create `jest.setup.js` (see **Appendix A.3** for complete file).

This file mocks Firebase and Expo modules for testing.

---

### 1.5.6 Create .gitignore

See **Appendix A.6** for the complete `.gitignore` file.

Key sections:
- Node modules
- Expo cache
- Firebase debug logs
- **creds/** folder (CRITICAL - never commit credentials!)
- Native folders (iOS/Android)

---

### 1.5.7 Create firebase.json

Create `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": [
    {
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "*.local"
      ],
      "predeploy": [
        "npm --prefix \"$RESOURCE_DIR\" run lint",
        "npm --prefix \"$RESOURCE_DIR\" run build"
      ],
      "source": "functions"
    }
  ],
  "emulators": {
    "auth": {
      "port": 9099
    },
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    },
    "storage": {
      "port": 9199
    },
    "ui": {
      "enabled": true
    },
    "singleProjectMode": true
  }
}
```

---

### 1.5.8 Commit Configuration Changes

```bash
git add .
git commit -m "Configure TypeScript, Babel, Jest, and Firebase"
git push
```

**✅ Configuration complete! Proceed to Hour 2-20**

---

## Hour 2-20: Feature Implementation

**Goal:** Build all MVP features following the prioritized phases  
**Time:** 18 hours

### Implementation Strategy

Follow the **complete feature implementation guide** in:
- **`docs/COMPLETE_FEATURE_LIST.md`** (phases 1-9)

The features are already organized in the correct build order:

#### Phase 1: Foundation (Hour 2) ✅
- Project setup (already done above)
- Firebase configuration (already done above)

#### Phase 2: Authentication (Hour 2-4)
- Phone + OTP authentication
- Profile completion
- Auth state management

#### Phase 3: Data Models (Hour 4-6)
- User model
- Conversation model
- Message model
- TypeScript types

#### Phase 4: Contact Management (Hour 6-8)
- Import phone contacts
- Find registered users
- Display contact list

#### Phase 5: Conversations (Hour 8-12)
- Create direct messages
- Create group chats
- Real-time message sync
- Offline queue with retry

#### Phase 6: Local Persistence (Hour 12-14)
- SQLite database
- Message caching
- Offline-first architecture

#### Phase 7: Media Sharing (Hour 14-16)
- Image picker
- Cloud Storage upload
- Image display in chat

#### Phase 8: Real-Time Features (Hour 16-18)
- Typing indicators
- Online/offline presence
- Read receipts

#### Phase 9: Push Notifications (Hour 18-20)
- FCM setup
- Cloud Function triggers
- Smart notification logic

### Implementation Notes

1. **Create Types First** (`types/index.ts`)
   - Defines all interfaces used across the app
   - See Appendix A.4 for complete types

2. **Build Services Layer**
   - `services/authService.ts`
   - `services/messageService.ts`
   - `services/conversationService.ts`
   - `services/sqliteService.ts`
   - `services/offlineQueue.ts`
   - Each service is documented in `COMPLETE_FEATURE_LIST.md`

3. **Build UI Screens**
   - Follow Expo Router file-based structure
   - Use iMessage-style components
   - Implement optimistic UI

4. **Build Cloud Functions**
   - See `functions/src/index.ts` for complete implementation
   - 5 functions total (OTP, verification, notifications, cleanup)

### Code Quality Standards

- ✅ TypeScript strict mode enabled
- ✅ Async/await for all Firebase operations
- ✅ Error handling with try/catch
- ✅ Loading states for all async operations
- ✅ Optimistic UI updates
- ✅ Offline-first architecture

**✅ When all features are built, proceed to Hour 20-22**

---

## Hour 20-22: Testing Setup

**Goal:** Add comprehensive unit and integration tests  
**Time:** 2 hours

### 2.1 Test Firebase Emulators

```bash
# Start emulators
npm run test:emulators

# In another terminal, verify:
# Auth Emulator: http://localhost:9099
# Firestore Emulator: http://localhost:8080
# Functions Emulator: http://localhost:5001
# Storage Emulator: http://localhost:9199
# Emulator UI: http://localhost:4000
```

**Keep emulators running** for integration tests.

---

### 2.2 Create Emulator Connection Setup

Create `services/__tests__/setup/emulator.ts`:

```typescript
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';
import { connectStorageEmulator } from 'firebase/storage';
import { auth, db, functions, storage } from '../../firebase';

if (process.env.NODE_ENV === 'test') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  connectStorageEmulator(storage, 'localhost', 9199);
}
```

---

### 2.3 Create Integration Tests

Create these test files in `services/__tests__/`:

1. **`authService.integration.test.ts`**
   - Phone OTP send/verify
   - Email signup/login
   - Profile completion

2. **`messageService.integration.test.ts`**
   - Send message
   - Real-time message subscription
   - Mark as read/delivered

3. **`conversationService.integration.test.ts`**
   - Create direct conversation
   - Create group conversation
   - Add/remove participants

4. **`offlineQueue.integration.test.ts`**
   - Queue messages when offline
   - Process queue on reconnect
   - Retry with exponential backoff

5. **`sqliteService.integration.test.ts`**
   - Initialize database
   - Cache messages
   - Retrieve cached data

See `docs/TESTING_COMPLETE.md` for complete test implementations.

---

### 2.4 Run Tests

```bash
# Run unit tests only
npm run test:unit

# Run integration tests (requires emulators running)
npm run test:integration

# Run all tests
npm run test:all

# Generate coverage report
npm run test:coverage
```

**Target Coverage:** 60-70% (current: ~65%)

---

### 2.5 Setup E2E Testing (Optional)

For E2E testing with Maestro, follow:
- `docs/E2E_MAESTRO_SETUP.md`

This is **optional** for MVP but recommended for production.

**✅ When tests pass, proceed to Hour 22-24**

---

## Hour 22-24: Deployment

**Goal:** Deploy Cloud Functions and prepare app for distribution  
**Time:** 2 hours

### 3.1 Deploy Cloud Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Build TypeScript
npm run build

# Deploy to Firebase
npm run deploy

# Or deploy from root:
cd ..
firebase deploy --only functions
```

Verify deployment at:
https://console.firebase.google.com → Functions

---

### 3.2 Build iOS App (TestFlight)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure build
eas build:configure

# Build iOS (development)
eas build --platform ios --profile development

# Build iOS (production)
eas build --platform ios --profile production
```

**Note:** You'll need an Apple Developer account ($99/year) for production builds.

---

### 3.3 Build Android App (Internal Testing)

```bash
# Build Android (development)
eas build --platform android --profile development

# Build Android (production)
eas build --platform android --profile production
```

---

### 3.4 Deploy to App Stores

Follow the detailed guide in:
- `docs/DEPLOYMENT_GUIDE.md`

This includes:
- iOS App Store submission
- Google Play Store submission
- Push notification certificates
- Privacy policy requirements

---

### 3.5 Production Checklist

Before launching:

- [ ] Firebase security rules deployed
- [ ] Cloud Functions deployed and tested
- [ ] Push notifications working
- [ ] App icons and splash screens created
- [ ] Privacy policy URL added to app stores
- [ ] Test on real iOS device
- [ ] Test on real Android device
- [ ] Beta test with 5-10 users
- [ ] Monitor Firebase console for errors
- [ ] Set up crash reporting (Sentry/Firebase Crashlytics)

**✅ Deployment complete!**

---

## Appendices

### Appendix A: Complete Configuration Files

#### A.1 Complete app.json

```json
{
  "expo": {
    "name": "aiMessage",
    "slug": "aimessage",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "scheme": "aimessage",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#007AFF"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.mlx93.messagingapp",
      "infoPlist": {
        "NSCameraUsageDescription": "This app needs access to your camera to take photos for messages.",
        "NSPhotoLibraryUsageDescription": "This app needs access to your photos to share images in messages.",
        "NSContactsUsageDescription": "aiMessage needs access to your contacts to help you connect with friends.",
        "NSMicrophoneUsageDescription": "This app needs access to your microphone for voice messages."
      },
      "googleServicesFile": "./creds/GoogleService-Info.plist"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#007AFF"
      },
      "package": "com.mlx93.messagingapp",
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "READ_CONTACTS",
        "NOTIFICATIONS",
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ],
      "googleServicesFile": "./creds/google-services.json",
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-web-browser",
      "expo-apple-authentication",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#007AFF"
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "aimessage"
      }
    }
  }
}
```

---

#### A.2 Complete firestore.rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
    }
    
    // Users by phone index (for uniqueness) 
    match /usersByPhone/{phone} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
    
    // Conversations
    match /conversations/{conversationId} {
      allow read: if isAuthenticated() && 
        request.auth.uid in resource.data.participants;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
        request.auth.uid in resource.data.participants;
      allow delete: if isAuthenticated() && 
        request.auth.uid in resource.data.participants;
      
      // Messages subcollection
      match /messages/{messageId} {
        allow read: if isAuthenticated() && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow create: if isAuthenticated() && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow update: if isAuthenticated() && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
      
      // Typing indicators subcollection
      match /typing/{userId} {
        allow read: if isAuthenticated() && 
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow write: if isAuthenticated() && request.auth.uid == userId;
      }
    }
    
    // Active conversations (for smart notifications)
    match /activeConversations/{userId} {
      allow read, write: if isOwner(userId);
    }
    
    // User contacts subcollection
    match /users/{userId}/contacts/{contactId} {
      allow read, write: if isOwner(userId);
    }
    
    // Phone verification codes
    // Allow read for OTP auto-fetch (verificationId acts as secure token)
    // Only Cloud Functions can write
    match /verifications/{verificationId} {
      allow read: if true; // Anyone with verificationId can read (needed for OTP auto-fetch)
      allow write: if false; // Only Cloud Functions can write
    }
  }
}
```

---

#### A.3 Complete jest.setup.js

```javascript
// Jest setup file
import '@testing-library/react-native/pure';

// Mock uuid (ES module)
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

// Mock Firebase services for testing
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  initializeAuth: jest.fn(() => ({})),
  getReactNativePersistence: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    commit: jest.fn(),
  })),
  enableIndexedDbPersistence: jest.fn(() => Promise.reject(new Error('Mock'))),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
}));

// Mock Expo modules
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn(),
  getContactsAsync: jest.fn(),
  Fields: {
    PhoneNumbers: 'phoneNumbers',
    Name: 'name',
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock expo modules
jest.mock('expo', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: {
    Screen: jest.fn(),
  },
  Tabs: {
    Screen: jest.fn(),
  },
}));
```

---

#### A.4 Complete types/index.ts

```typescript
export interface User {
  uid: string;
  email?: string;
  phoneNumber: string; // E.164 format: +12025551234
  displayName: string;
  photoURL?: string;
  createdAt: Date;
  lastSeen?: Date;
  isOnline?: boolean;
  fcmToken?: string; // For push notifications
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participants: string[]; // Array of user UIDs
  participantDetails?: User[]; // Populated user objects
  name?: string; // Group name (optional for direct chats)
  photoURL?: string; // Group photo
  lastMessage?: string;
  lastMessageTime?: Date;
  lastMessageSender?: string;
  createdAt: Date;
  createdBy: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  timestamp: Date;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'read';
  readBy?: string[]; // Array of user UIDs who have read this message
  localId?: string; // For optimistic UI
}

export interface Contact {
  id: string;
  name: string;
  phoneNumber: string; // E.164 format
  isRegistered: boolean;
  user?: User; // If registered, includes User object
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  isTyping: boolean;
  timestamp: Date;
}

export interface OfflineMessage {
  id: string;
  conversationId: string;
  message: Partial<Message>;
  retryCount: number;
  lastAttempt?: Date;
  createdAt: Date;
}
```

---

#### A.5 Complete package.json

See section 0.5.4 for the scripts section.

Full dependencies list:
```json
{
  "dependencies": {
    "@expo/vector-icons": "^15.0.2",
    "@react-native-async-storage/async-storage": "^2.2.0",
    "@react-native-community/netinfo": "^11.4.1",
    "babel-preset-expo": "^54.0.5",
    "date-fns": "^4.1.0",
    "expo": "~54.0.16",
    "expo-apple-authentication": "~8.0.7",
    "expo-auth-session": "~7.0.8",
    "expo-constants": "~18.0.9",
    "expo-contacts": "~15.0.10",
    "expo-crypto": "~15.0.7",
    "expo-device": "~8.0.9",
    "expo-font": "^14.0.9",
    "expo-image-manipulator": "~14.0.7",
    "expo-image-picker": "~17.0.8",
    "expo-linking": "~8.0.8",
    "expo-notifications": "~0.32.12",
    "expo-router": "~6.0.13",
    "expo-sqlite": "~16.0.8",
    "expo-status-bar": "~3.0.8",
    "expo-web-browser": "~15.0.8",
    "firebase": "^12.4.0",
    "react": "19.1.0",
    "react-native": "0.81.4",
    "react-native-gesture-handler": "^2.28.0",
    "react-native-get-random-values": "^1.11.0",
    "react-native-keyboard-controller": "^1.18.5",
    "react-native-reanimated": "~4.1.1",
    "react-native-safe-area-context": "~5.6.0",
    "react-native-screens": "~4.16.0",
    "react-native-worklets": "^0.5.1",
    "react-native-worklets-core": "^1.6.2",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "@expo/ngrok": "^4.1.3",
    "@testing-library/jest-native": "^5.4.3",
    "@testing-library/react-native": "^13.3.3",
    "@types/jest": "~29.5.14",
    "@types/react": "~19.1.0",
    "@types/uuid": "^11.0.0",
    "jest": "~29.7.0",
    "jest-expo": "^54.0.12",
    "typescript": "~5.9.2"
  }
}
```

---

#### A.6 Complete .gitignore

```
# Node
node_modules/
npm-debug.log
yarn-error.log
yarn-debug.*

# Expo
.expo/
.expo-shared/
dist/
web-build/
expo-env.d.ts

# Metro
.metro-health-check*

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log

# Functions
functions/node_modules/
functions/lib/

# Credentials folder - NEVER commit these!
creds/

# Native
.kotlin/
*.orig.*
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.pem

# Generated native folders (Expo will create these)
/ios
/android

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# TypeScript
*.tsbuildinfo

# Env
.env
.env.local
.env*.local
```

---

### Appendix B: Troubleshooting

#### B.1 "Element type is invalid" Error

**Symptom:** App crashes with `Element type is invalid` on startup

**Cause:** Conflict between `App.tsx` and Expo Router

**Solution:**
1. Delete `App.tsx` if it exists
2. Ensure `index.ts` only contains:
   ```typescript
   import 'react-native-get-random-values';
   import 'expo-router/entry';
   ```
3. Restart Metro bundler: `npx expo start --clear`

---

#### B.2 React Version Conflicts (Peer Dependencies)

**Symptom:** npm install shows peer dependency warnings (React 19.1.0 vs 19.2.0)

**Solution:** Use `--legacy-peer-deps` flag
```bash
npm install <package-name> --legacy-peer-deps
```

**Why it's safe:** These are version mismatches in dev dependencies that don't affect runtime.

---

#### B.3 SQLite Database Errors

**Symptom:** `SQLite.openDatabase is not a function`

**Cause:** expo-sqlite API changed in v14+

**Solution:** Use the new sync API:
- `SQLite.openDatabaseSync()` instead of `SQLite.openDatabase()`
- `db.execSync()` instead of `db.transaction()`
- `db.runSync()` for INSERT/UPDATE/DELETE
- `db.getAllSync()` for SELECT queries

---

#### B.4 Firebase Emulator Connection Issues

**Symptom:** Tests fail with "Cannot connect to emulator"

**Solution:**
1. Ensure emulators are running: `npm run test:emulators`
2. Check ports are not in use:
   ```bash
   lsof -i :9099  # Auth
   lsof -i :8080  # Firestore
   lsof -i :5001  # Functions
   lsof -i :9199  # Storage
   ```
3. Kill processes if needed:
   ```bash
   npm run test:emulators:kill
   ```
4. Restart emulators

---

#### B.5 iOS Simulator Won't Start

**Solution 1:** Reset simulator
```bash
xcrun simctl erase all
xcrun simctl boot "iPhone 17 Pro"
```

**Solution 2:** Check Xcode Command Line Tools
```bash
xcode-select --print-path
# Should show: /Applications/Xcode.app/Contents/Developer

# If not, run:
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

---

#### B.6 Android Emulator "Waiting for Expo"

**Solution 1:** Enable USB debugging in emulator
1. Open emulator
2. Settings → About → Tap "Build number" 7 times
3. Settings → System → Developer options → Enable USB debugging

**Solution 2:** Clear Metro cache
```bash
npx expo start --clear
```

---

#### B.7 "Cannot find module 'react-native-reanimated'"

**Solution:**
```bash
npm install react-native-reanimated --legacy-peer-deps

# Ensure babel.config.js has:
plugins: ['react-native-reanimated/plugin']

# Clear cache and restart:
npx expo start --clear
```

---

#### B.8 Firebase "Permission Denied" in Firestore

**Cause:** Security rules not deployed or misconfigured

**Solution:**
1. Check `firestore.rules` exists
2. Deploy rules:
   ```bash
   firebase deploy --only firestore:rules
   ```
3. Verify in Firebase Console: Firestore → Rules

---

#### B.9 Push Notifications Not Working

**Checklist:**
- [ ] FCM token is being saved to user document
- [ ] Cloud Function `sendMessageNotification` is deployed
- [ ] Notification permissions granted on device
- [ ] Test on **physical device** (not simulator)
- [ ] Check Firebase Console → Cloud Messaging for errors

---

#### B.10 Expo Build Fails with "Invalid Credentials"

**Solution:**
1. Login to Expo: `eas login`
2. Configure build: `eas build:configure`
3. For iOS, ensure Apple Developer account is linked
4. For Android, ensure keystore is generated:
   ```bash
   eas credentials
   ```

---

### Appendix C: Package Installation Script

Create `scripts/install-deps.sh`:

```bash
#!/bin/bash

echo "🚀 Installing MessageAI dependencies..."

# Install core dependencies
echo "📦 Installing core packages..."
npm install firebase@^12.4.0

# Install Expo modules
echo "📦 Installing Expo modules..."
npm install expo-sqlite@~16.0.8
npm install expo-contacts@~15.0.10
npm install expo-notifications@~0.32.12
npm install expo-image-picker@~17.0.8
npm install expo-auth-session@~7.0.8
npm install expo-web-browser@~15.0.8
npm install expo-apple-authentication@~8.0.7

# Install React Native community modules
echo "📦 Installing React Native modules..."
npm install @react-native-async-storage/async-storage@^2.2.0
npm install @react-native-community/netinfo@^11.4.1

# Install animation libraries (with legacy peer deps)
echo "📦 Installing animation libraries..."
npm install react-native-reanimated@~4.1.1 --legacy-peer-deps
npm install react-native-gesture-handler@^2.28.0
npm install react-native-worklets@^0.5.1 --legacy-peer-deps
npm install react-native-worklets-core@^1.6.2 --legacy-peer-deps

# Install utilities
echo "📦 Installing utilities..."
npm install date-fns@^4.1.0
npm install uuid@^13.0.0
npm install react-native-get-random-values@^1.11.0

# Install dev dependencies
echo "📦 Installing dev dependencies..."
npm install --save-dev @testing-library/react-native@^13.3.3
npm install --save-dev @testing-library/jest-native@^5.4.3
npm install --save-dev @types/jest@~29.5.14
npm install --save-dev @types/uuid@^11.0.0
npm install --save-dev jest-expo@^54.0.12
npm install --save-dev babel-preset-expo@^54.0.5

echo "✅ All dependencies installed!"
echo "🚀 Run 'npm start' to begin development"
```

Make it executable:
```bash
chmod +x scripts/install-deps.sh
./scripts/install-deps.sh
```

---

### Appendix D: Testing Commands Cheat Sheet

```bash
# Unit Tests Only
npm run test:unit

# Integration Tests (requires emulators)
npm run test:integration

# All Tests
npm run test:all

# Watch Mode (auto-rerun on file changes)
npm run test:watch

# Coverage Report
npm run test:coverage

# Firebase Emulators
npm run test:emulators          # Start emulators
npm run test:emulators:kill     # Kill emulator processes

# CI/CD Tests
npm run test:ci                 # For GitHub Actions / CI
```

**Integration Test Workflow:**
```bash
# Terminal 1: Start emulators
npm run test:emulators

# Terminal 2: Run tests
npm run test:integration

# When done, kill emulators
npm run test:emulators:kill
```

---

### Appendix E: Deployment Checklist

#### Pre-Deployment

- [ ] All tests passing (`npm run test:all`)
- [ ] No console errors in development
- [ ] Firestore security rules deployed
- [ ] Cloud Functions deployed
- [ ] Firebase Storage rules configured
- [ ] Environment variables set in `app.json`
- [ ] Bundle identifiers match Firebase registration
- [ ] App icons created (1024x1024 PNG)
- [ ] Splash screen created

#### iOS Deployment

- [ ] Apple Developer account ($99/year)
- [ ] App ID created in Apple Developer Portal
- [ ] Push notification certificates generated
- [ ] TestFlight build uploaded
- [ ] Beta testers invited
- [ ] App Store listing created
- [ ] Privacy policy URL added
- [ ] Screenshots prepared (all device sizes)

#### Android Deployment

- [ ] Google Play Console account ($25 one-time)
- [ ] App signing key generated
- [ ] Internal testing track created
- [ ] APK/AAB uploaded
- [ ] Beta testers invited
- [ ] Play Store listing created
- [ ] Privacy policy URL added
- [ ] Screenshots prepared (all device sizes)

#### Post-Deployment Monitoring

- [ ] Firebase Console: Check for errors
- [ ] Cloud Functions: Monitor execution times
- [ ] Crashlytics: Set up crash reporting
- [ ] Analytics: Set up event tracking
- [ ] Performance Monitoring: Enable Firebase Performance
- [ ] User feedback: Set up in-app feedback system

---

## 📚 Additional Resources

### Official Documentation
- [Expo Documentation](https://docs.expo.dev/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Documentation](https://reactnative.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

### MessageAI Project Docs
- `docs/COMPLETE_FEATURE_LIST.md` - All features with code examples
- `docs/TESTING_COMPLETE.md` - Complete testing guide
- `docs/DEPLOYMENT_GUIDE.md` - App Store deployment
- `memory_bank/06_active_context_progress.md` - Current project status

### Community Support
- [Expo Forums](https://forums.expo.dev/)
- [Firebase Support](https://firebase.google.com/support)
- [React Native Community](https://reactnative.dev/community/overview)

---

## 🎉 Conclusion

You now have a **complete, step-by-step guide** to rebuild MessageAI from scratch.

### What You'll Have After Following This Guide:

✅ **Fully functional WhatsApp-style messaging app**  
✅ **10 core MVP features + 15 bonus features**  
✅ **229+ comprehensive tests (65% coverage)**  
✅ **Production-ready Firebase backend**  
✅ **iMessage-quality UI/UX**  
✅ **Offline-first architecture**  
✅ **Real-time messaging with WebSocket-like performance**  
✅ **Push notifications via FCM**  
✅ **Cloud Functions for server-side logic**  
✅ **Complete deployment pipeline**

### Estimated Timeline:
- **Hour 0-2:** Environment setup + Firebase config
- **Hour 2-20:** Feature implementation
- **Hour 20-22:** Testing setup
- **Hour 22-24:** Deployment prep

**Total:** ~24 hours for a complete, tested, production-ready app.

---

**Questions or Issues?**

Refer to:
- **Appendix B: Troubleshooting** for common errors
- `docs/ALL_BUILD_ERRORS_FIXED.md` for historical issues
- Memory bank files for project context

**Happy Building! 🚀**

