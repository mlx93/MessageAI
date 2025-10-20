# MVP Task List - Part 1 (Hours 0-12)
**Setup through Real-Time Messaging & Offline Support**

---

## 🎯 Pre-Implementation Setup Tasks

### Setup-1: Install Development Tools
- [ ] Install Node.js 18+ via Homebrew: `brew install node`
- [ ] Install Watchman: `brew install watchman`
- [ ] Install Expo CLI globally: `npm install -g expo-cli eas-cli`
- [ ] Install Firebase CLI: `npm install -g firebase-tools`
- [ ] Verify installations: `node --version`, `expo --version`, `firebase --version`
- **Acceptance**: All commands return version numbers

### Setup-2: Install Xcode & iOS Simulator
- [ ] Install Xcode 14.3+ from Mac App Store
- [ ] Run `xcode-select --install` to install command line tools
- [ ] Install CocoaPods: `sudo gem install cocoapods`
- [ ] Open Xcode → Preferences → Components → Install iOS 16.4 Simulator
- [ ] Verify simulator: `xcrun simctl list devices available`
- **Acceptance**: iOS Simulator listed in available devices

### Setup-3: Install Android Studio & Emulator
- [ ] Download and install Android Studio from https://developer.android.com/studio
- [ ] During install, select: Android SDK, Android SDK Platform, Android Virtual Device
- [ ] Add to `~/.zshrc`: `export ANDROID_HOME=$HOME/Library/Android/sdk`
- [ ] Add to PATH: `export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools`
- [ ] Reload shell: `source ~/.zshrc`
- [ ] Open Android Studio → Device Manager → Create Device → Pixel 6, Android 13
- [ ] Verify emulator: `emulator -list-avds`
- **Acceptance**: Android emulator listed

### Setup-4: Create Firebase Project
- [ ] Go to https://console.firebase.google.com
- [ ] Click "Add project" → Name: "messaging-app-mvp"
- [ ] Disable Google Analytics (can add later)
- [ ] Click "Create project"
- **Acceptance**: Firebase project created and dashboard visible

### Setup-5: Enable Firebase Services
- [ ] Go to Authentication → Get Started → Enable "Email/Password"
- [ ] Enable "Google" sign-in (enter support email)
- [ ] Enable "Apple" sign-in
- [ ] Go to Firestore Database → Create database → Start in test mode → Select region (us-central or europe-west)
- [ ] Go to Storage → Get Started → Start in test mode → Use same region
- [ ] Cloud Messaging is auto-enabled (verify in Project Settings)
- **Acceptance**: All 4 services show as enabled in Firebase Console

### Setup-6: Register Firebase Apps
- [ ] Firebase Console → Project Settings → Add app → iOS
- [ ] iOS bundle ID: `com.yourcompany.messagingapp`
- [ ] Download `GoogleService-Info.plist` to Downloads folder
- [ ] Add app → Android → Package: `com.yourcompany.messagingapp`
- [ ] Download `google-services.json` to Downloads folder
- [ ] Add app → Web → Copy firebaseConfig object to text file
- **Acceptance**: 3 apps registered, all config files downloaded

### Setup-7: Initialize Cloud Functions
- [ ] Run `firebase login` and authenticate
- [ ] Run `firebase init functions`
- [ ] Select JavaScript
- [ ] Install dependencies: Yes
- [ ] Navigate to `functions` folder: `cd functions`
- [ ] Install admin SDK: `npm install firebase-admin firebase-functions`
- **Acceptance**: `functions/` directory created with index.js

### Setup-8: Create GitHub Repository
- [ ] Create project directory: `mkdir messaging-app-mvp && cd messaging-app-mvp`
- [ ] Initialize git: `git init && git branch -M main`
- [ ] Create GitHub repo: `gh repo create messaging-app-mvp --private --source=. --remote=origin`
- [ ] Or manually create on GitHub.com and run: `git remote add origin https://github.com/YOUR_USERNAME/messaging-app-mvp.git`
- **Acceptance**: GitHub repo created and linked

---

## PHASE 1: Foundation & Auth (Hours 0-3)

### Hour 0-1: Project Initialization

#### Task 1.1: Create Expo Project
- [ ] Navigate to project directory: `cd messaging-app-mvp`
- [ ] Create Expo app: `npx create-expo-app@latest . --template blank-typescript`
- [ ] Answer "Yes" to TypeScript
- **Acceptance**: Project created with `app.json`, `package.json`, `App.tsx`

#### Task 1.2: Install Core Dependencies
- [ ] Install Firebase: `npx expo install firebase`
- [ ] Install navigation: `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar`
- [ ] Install storage: `npx expo install expo-sqlite @react-native-async-storage/async-storage`
- [ ] Install UI/media: `npx expo install expo-notifications expo-device expo-contacts expo-image-picker expo-image-manipulator react-native-gifted-chat`
- [ ] Install utilities: `npm install date-fns uuid @react-native-community/netinfo`
- [ ] Install auth: `npx expo install expo-auth-session expo-crypto expo-web-browser`
- **Acceptance**: All packages in package.json

#### Task 1.3: Install Testing Dependencies
- [ ] Install testing libs: `npm install --save-dev @testing-library/react-native @testing-library/jest-native jest-expo @types/uuid`
- **Acceptance**: Dev dependencies installed

#### Task 1.4: Create Project Structure
- [ ] Create directories: `mkdir -p app/{auth,\(tabs\),chat} components/{chat,contacts} services/{__tests__} hooks/{__tests__} store utils types assets`
- [ ] Verify structure: `ls -R app/ components/ services/ hooks/ store/ utils/ types/`
- **Acceptance**: All directories exist

#### Task 1.5: Configure package.json Scripts
- [ ] Open `package.json`
- [ ] Add scripts:
```json
"scripts": {
  "start": "expo start",
  "ios": "expo start --ios",
  "android": "expo start --android",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```
- **Acceptance**: Scripts added and file saved

#### Task 1.6: Create Jest Configuration
- [ ] Create file: `jest.config.js`
- [ ] Add content (from implementation plan)
- [ ] Verify syntax: Run `npm test` (should find no tests yet)
- **Acceptance**: Jest config created, no errors

#### Task 1.6b: Setup Firebase Emulator for Integration Tests
- [ ] Run `firebase init emulators`
- [ ] Select: Authentication, Firestore, Functions
- [ ] Configure ports: Auth (9099), Firestore (8080), Functions (5001)
- [ ] Run `firebase emulators:start` to verify emulators work
- [ ] Create `.env.test` with emulator connection strings:
  ```
  FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
  FIRESTORE_EMULATOR_HOST=localhost:8080
  FUNCTIONS_EMULATOR_HOST=localhost:5001
  ```
- [ ] Create `services/__tests__/setup.ts`:
  ```typescript
  import { connectAuthEmulator } from 'firebase/auth';
  import { connectFirestoreEmulator } from 'firebase/firestore';
  import { auth, db } from '../firebase';
  
  if (process.env.NODE_ENV === 'test') {
    connectAuthEmulator(auth, 'http://localhost:9099');
    connectFirestoreEmulator(db, 'localhost', 8080);
  }
  ```
- [ ] Stop emulators (will run as needed during testing)
- **Acceptance**: Emulators run successfully, can connect from tests

#### Task 1.7: Create Firebase Config
- [ ] Create file: `services/firebase.ts`
- [ ] Paste Firebase web config from Setup-6
- [ ] Add initialization code (from implementation plan)
- [ ] Add exports: `auth`, `db`, `storage`, `functions`
- **Acceptance**: File created with valid config

#### Task 1.8: Configure app.json
- [ ] Open `app.json`
- [ ] Update iOS section: Add bundle ID, permissions (camera, photos, contacts)
- [ ] Update Android section: Add package name, permissions
- [ ] Add plugins: `expo-router`, `expo-notifications`
- [ ] Copy Firebase config files:
  - `cp ~/Downloads/GoogleService-Info.plist ./ios/messagingappmvp/`
  - `cp ~/Downloads/google-services.json ./android/app/`
- **Acceptance**: app.json configured, Firebase files in correct locations

#### Task 1.9: Test Initial Setup
- [ ] Run `npm start`
- [ ] Press 'i' to open iOS Simulator
- [ ] Press 'a' to open Android Emulator
- [ ] Verify app loads (even if blank screen)
- **Acceptance**: App runs on both simulators without errors

#### Task 1.10: Create Firebase Unit Test
- [ ] Create file: `services/__tests__/firebase.test.ts`
- [ ] Add test for auth initialization
- [ ] Add test for db initialization
- [ ] Add test for storage initialization
- [ ] Run tests: `npm test`
- **Acceptance**: 3 tests pass

#### Task 1.11: Initial Git Commit
- [ ] Create `.gitignore` (verify node_modules, .expo, etc. are excluded)
- [ ] Run `git add .`
- [ ] Run `git commit -m "Hour 0-1: Project initialization complete"`
- [ ] Run `git push -u origin main`
- **Acceptance**: Code pushed to GitHub

---

### Hour 1-2: Email/Password Authentication

#### Task 2.1: Create Type Definitions
- [ ] Create file: `types/index.ts`
- [ ] Add `User` interface (from implementation plan)
- [ ] Add `Message` interface
- [ ] Add `Conversation` interface
- **Acceptance**: File created with all 3 interfaces

#### Task 2.2: Create Auth Service
- [ ] Create file: `services/authService.ts`
- [ ] Import Firebase auth functions
- [ ] Implement `signUp` function:
  - Create user with createUserWithEmailAndPassword
  - Create user profile document in users/{uid}
  - Create uniqueness index: `usersByEmail/{email}` → `{ uid, createdAt }`
  - Create uniqueness index: `usersByPhone/{phone}` → `{ uid, createdAt }`
  - Wrap in try-catch to handle permission-denied errors
  - Throw friendly error: "Email or phone number already in use"
- [ ] Implement `signIn` function (update online status)
- [ ] Implement `signOut` function (set offline status)
- [ ] Implement `getUserProfile` function
- **Acceptance**: All 4 functions implemented with uniqueness handling

#### Task 2.3: Create Auth Context
- [ ] Create file: `store/AuthContext.tsx`
- [ ] Define `AuthContextType` interface
- [ ] Create `AuthContext` with createContext
- [ ] Implement `AuthProvider` component with auth state
- [ ] Implement `useAuth` hook
- **Acceptance**: Context created and exports AuthProvider and useAuth

#### Task 2.4: Create Login Screen
- [ ] Create file: `app/auth/login.tsx`
- [ ] Add email and password inputs
- [ ] Add login button with `handleLogin` function
- [ ] Add navigation to register screen
- [ ] Add loading state
- [ ] Add error handling with Alert
- **Acceptance**: Login screen renders with working form

#### Task 2.5: Create Register Screen
- [ ] Create file: `app/auth/register.tsx`
- [ ] Add fields: email, password, firstName, lastName, phoneNumber
- [ ] Add phone number validation (E.164 format)
- [ ] Implement `handleRegister` function
- [ ] Add navigation back to login
- [ ] Add ScrollView for keyboard handling
- **Acceptance**: Register screen renders with all fields

#### Task 2.6: Create App Layout
- [ ] Create file: `app/_layout.tsx`
- [ ] Wrap with `AuthProvider`
- [ ] Configure Stack navigator with auth and tabs screens
- [ ] Set `headerShown: false`
- **Acceptance**: Layout configured with auth provider

#### Task 2.7: Create Entry Point
- [ ] Create file: `app/index.tsx`
- [ ] Use `useAuth` to check auth state
- [ ] Show loading spinner while checking
- [ ] Redirect to tabs if logged in
- [ ] Redirect to login if not logged in
- **Acceptance**: Entry point handles auth routing

#### Task 2.8: Create Placeholder Tabs
- [ ] Create file: `app/(tabs)/_layout.tsx`
- [ ] Configure Tabs navigator with "Chats" tab
- [ ] Create file: `app/(tabs)/index.tsx`
- [ ] Add welcome message with user's name
- [ ] Add sign out button
- **Acceptance**: Tabs layout created, placeholder screen works

#### Task 2.9: Test Auth Flow
- [ ] Run app on iOS Simulator
- [ ] Tap "Sign Up" button
- [ ] Fill in all registration fields
- [ ] Submit form → Should navigate to Chats screen
- [ ] Tap "Sign Out" → Should return to login
- [ ] Log in with same credentials → Should work
- **Acceptance**: Complete auth flow works on simulator

#### Task 2.10: Write Auth Service Tests
- [ ] Create file: `services/__tests__/authService.test.ts`
- [ ] Mock Firebase auth and firestore modules
- [ ] Test `signUp` creates user and profile
- [ ] Test `signIn` updates online status
- [ ] Test `getUserProfile` returns profile or null
- [ ] Test error handling for duplicate email/phone
- [ ] Run tests: `npm test -- authService.test.ts`
- **Acceptance**: All auth tests pass

#### Task 2.11: Git Commit
- [ ] Run `git add .`
- [ ] Run `git commit -m "Hour 1-2: Email/password authentication complete"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

### Hour 2-3: Social Authentication

#### Task 3.1: Configure Google Sign-In
- [ ] Open Firebase Console → Authentication → Sign-in method → Google
- [ ] Copy Web client ID (OAuth 2.0 client ID)
- [ ] Get iOS client ID from Firebase settings
- [ ] Get Android client ID from Firebase settings
- [ ] Add to `app.json` under `expo.ios.config.googleSignIn.reservedClientId`
- **Acceptance**: Google OAuth credentials configured

#### Task 3.2: Implement Google Sign-In Hook
- [ ] Open `services/authService.ts`
- [ ] Import `expo-auth-session/providers/google`
- [ ] Implement `useGoogleAuth` hook with client IDs
- [ ] Implement `signInWithGoogleCredential` function
- [ ] Handle case where phone number is required
- **Acceptance**: Google sign-in functions added

#### Task 3.3: Configure Apple Sign-In
- [ ] Add Apple Sign-In capability in Xcode (if deploying to device)
- [ ] In Firebase Console → Authentication → Apple → Enable
- [ ] Implement `signInWithApple` function in `authService.ts`
- [ ] Handle fullName extraction
- [ ] Handle case where phone required
- **Acceptance**: Apple sign-in function added

#### Task 3.4: Update Login Screen with Social Auth
- [ ] Open `app/auth/login.tsx`
- [ ] Import `useGoogleAuth` hook
- [ ] Add "Sign in with Google" button
- [ ] Add "Sign in with Apple" button (Platform.OS === 'ios')
- [ ] Handle success/error for social auth
- [ ] Handle PHONE_REQUIRED error → prompt for phone
- **Acceptance**: Login screen has social auth buttons

#### Task 3.5: Create Phone Number Prompt Modal
- [ ] Create component: `components/PhonePromptModal.tsx`
- [ ] Add TextInput for phone number
- [ ] Add submit button
- [ ] Call `setDoc` to update user profile with phone
- [ ] Handle validation
- **Acceptance**: Modal prompts for phone after social auth

#### Task 3.6: Test Google Sign-In
- [ ] Run app on iOS Simulator
- [ ] Tap "Sign in with Google"
- [ ] Complete Google OAuth flow
- [ ] If prompted, enter phone number
- [ ] Should navigate to Chats screen
- **Acceptance**: Google sign-in works end-to-end

#### Task 3.7: Test Apple Sign-In
- [ ] Run app on iOS Simulator
- [ ] Tap "Sign in with Apple"
- [ ] Complete Apple auth flow
- [ ] Should navigate to Chats screen
- **Acceptance**: Apple sign-in works (or skip if on simulator without capability)

#### Task 3.8: Write Social Auth Tests
- [ ] Add tests to `services/__tests__/authService.test.ts`
- [ ] Mock Google auth response
- [ ] Test `signInWithGoogleCredential` success
- [ ] Test phone required error
- [ ] Run tests: `npm test`
- **Acceptance**: Social auth tests pass

#### Task 3.9: Git Commit
- [ ] Run `git commit -am "Hour 2-3: Social authentication complete"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

## PHASE 2: User Discovery & Contacts (Hours 3-6)

### Hour 3-4: Contact Import & Matching

#### Task 4.1: Create Contact Service
- [ ] Create file: `services/contactService.ts`
- [ ] Import Expo Contacts and Firestore
- [ ] Implement `requestContactsPermission` function
- [ ] Implement `normalizePhoneNumber` helper
- [ ] Implement `matchPhoneNumbers` function (batch queries)
- **Acceptance**: Contact service file created with helper functions

#### Task 4.2: Implement Contact Import
- [ ] In `contactService.ts`, implement `importContacts` function
- [ ] Use `Contacts.getContactsAsync` with phone numbers field
- [ ] Extract and normalize phone numbers
- [ ] Call `matchPhoneNumbers` to find app users
- [ ] Store in `users/{userId}/contacts` subcollection
- **Acceptance**: importContacts function complete

#### Task 4.3: Implement Get User Contacts
- [ ] In `contactService.ts`, implement `getUserContacts` function
- [ ] Query `users/{userId}/contacts` collection
- [ ] Return array of contacts
- **Acceptance**: getUserContacts function complete

#### Task 4.4: Implement Search by Phone
- [ ] In `contactService.ts`, implement `searchUserByPhone` function
- [ ] Normalize input phone number
- [ ] Query `users` collection where phoneNumber equals input
- [ ] Return User or null
- **Acceptance**: searchUserByPhone function complete

#### Task 4.5: Create Contacts Screen
- [ ] Create file: `app/(tabs)/contacts.tsx`
- [ ] Import contact service functions
- [ ] Add state for contacts list and search input
- [ ] Implement `loadContacts` function (calls importContacts + getUserContacts)
- [ ] Implement `startConversation` function (creates conversation, navigates to chat)
- [ ] Implement `searchAndStartChat` function (searches by phone)
- **Acceptance**: Contacts screen file created with all functions

#### Task 4.6: Add Contacts UI
- [ ] In `contacts.tsx`, add phone number search TextInput at top
- [ ] Add "Start Chat" button below input
- [ ] Add FlatList showing contacts (name, phone, "New Conversation" button)
- [ ] Style with padding, borders, touchable feedback
- **Acceptance**: Contacts screen UI complete

#### Task 4.7: Update Tab Layout
- [ ] Open `app/(tabs)/_layout.tsx`
- [ ] Add Contacts tab: `<Tabs.Screen name="contacts" options={{ title: 'Contacts' }} />`
- [ ] Ensure both Chats and Contacts tabs visible
- **Acceptance**: Tab bar shows both tabs

#### Task 4.8: Test Contact Import
- [ ] Run app on iOS Simulator
- [ ] Go to Contacts tab
- [ ] Grant contacts permission when prompted
- [ ] Should see list of contacts who are app users
- [ ] If none, register another user with a phone in your simulator contacts
- **Acceptance**: Contact import works, matched users displayed

#### Task 4.9: Test Search by Phone
- [ ] In Contacts tab, enter a known phone number
- [ ] Tap "Start Chat"
- [ ] Should create conversation and navigate to chat screen
- **Acceptance**: Search by phone works

#### Task 4.10: Write Contact Service Tests
- [ ] Create file: `services/__tests__/contactService.test.ts`
- [ ] Mock Expo Contacts and Firestore
- [ ] Test `normalizePhoneNumber` formats correctly
- [ ] Test `matchPhoneNumbers` batches queries
- [ ] Test `searchUserByPhone` finds user
- [ ] Run tests: `npm test`
- **Acceptance**: Contact service tests pass

#### Task 4.11: Git Commit
- [ ] Run `git commit -am "Hour 3-4: Contact import and search complete"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

### Hour 4-6: Conversation Management

#### Task 5.1: Create Conversation Service
- [ ] Create file: `services/conversationService.ts`
- [ ] Import Firestore and types
- [ ] Implement `createOrGetConversation` function
  - Check if direct convo exists (query where participants == sorted IDs)
  - If not, create new conversation with deterministic ID (for direct) or UUID (for group)
  - Fetch participant details and populate participantDetails
- **Acceptance**: createOrGetConversation function complete

#### Task 5.2: Implement Get User Conversations
- [ ] In `conversationService.ts`, implement `getUserConversations` function
- [ ] Query conversations where participants array-contains userId
- [ ] Order by updatedAt desc
- [ ] Return onSnapshot listener
- **Acceptance**: getUserConversations function complete

#### Task 5.3: Implement Update Last Message
- [ ] In `conversationService.ts`, implement `updateConversationLastMessage` function
- [ ] Update conversation doc with lastMessage object and updatedAt
- [ ] Use merge: true
- **Acceptance**: updateConversationLastMessage function complete

#### Task 5.4: Implement Add Participant
- [ ] In `conversationService.ts`, implement `addParticipantToConversation` function
- [ ] Get current conversation
- [ ] Add new userId to participants array
- [ ] Fetch new participant details
- [ ] Update type to 'group' if participants >= 3
- [ ] Update conversation doc
- **Acceptance**: addParticipantToConversation function complete

#### Task 5.5: Create Conversations List Screen
- [ ] Create file: `app/(tabs)/index.tsx`
- [ ] Import conversation service and types
- [ ] Add state for conversations list
- [ ] Use `getUserConversations` in useEffect
- [ ] Implement `getConversationTitle` helper (shows other user's name for direct, participant names for group)
- [ ] Implement `getInitials` helper (initials for direct, 👥 for group)
- **Acceptance**: Conversations screen logic complete

#### Task 5.6: Add Conversations List UI
- [ ] In `index.tsx`, create FlatList with renderItem
- [ ] Each item shows: avatar (circle with initials), title, last message preview, timestamp, unread badge
- [ ] Use TouchableOpacity to navigate to chat screen
- [ ] Add empty state: "No conversations yet"
- [ ] Style with flexbox, borders, padding
- **Acceptance**: Conversations list UI complete

#### Task 5.7: Create Message Helpers Utility
- [ ] Create file: `utils/messageHelpers.ts`
- [ ] Implement `formatTimestamp` function (Just now, 5m ago, 2h ago, etc.)
- [ ] Implement `generateLocalMessageId` using uuid
- [ ] Implement `sortMessagesByTimestamp` helper
- **Acceptance**: Utility functions created

#### Task 5.8: Setup Firestore Security Rules
- [ ] Open Firebase Console → Firestore → Rules
- [ ] Replace with security rules from implementation plan including:
  - User read/create/update rules
  - **Email uniqueness check**: `emailIsUnique()` helper function
  - **Phone uniqueness check**: `phoneIsUnique()` helper function
  - usersByEmail and usersByPhone collection rules
  - Conversation and message rules
  - Typing indicator rules
  - activeConversations rules
- [ ] Click "Publish" to deploy rules
- [ ] Test: Try to create user with duplicate email → should fail with permission-denied
- [ ] Test: Try to create user with duplicate phone → should fail with permission-denied
- **Acceptance**: Security rules deployed, uniqueness constraints enforced

#### Task 5.9: Create Firestore Indexes
- [ ] Open Firebase Console → Firestore → Indexes
- [ ] Create composite index:
  - Collection: conversations
  - Fields: participants (Array-contains), updatedAt (Descending)
- [ ] Create composite index:
  - Collection group: messages
  - Fields: conversationId (Ascending), timestamp (Ascending)
- [ ] Or run app and click the auto-generated index links in console errors
- **Acceptance**: Required indexes created

#### Task 5.9: Create Firestore Indexes
- [ ] Open Firebase Console → Firestore → Indexes
- [ ] Create composite index:
  - Collection: conversations
  - Fields: participants (Array-contains), updatedAt (Descending)
- [ ] Create composite index:
  - Collection group: messages
  - Fields: conversationId (Ascending), timestamp (Ascending)
- [ ] **OR** run app and let Firestore auto-suggest indexes:
  - When a query needs an index, Firestore shows error with creation link
  - Click the link to auto-create the index
  - This is often faster than manual creation
- [ ] **Note**: Additional indexes may be needed for typing indicators or other queries
  - Firestore will auto-suggest these via console error links during testing
- **Acceptance**: Required indexes created or noted for auto-creation

#### Task 5.10: Update Contacts Screen Integration
- [ ] Open `app/(tabs)/contacts.tsx`
- [ ] Ensure `startConversation` function calls `createOrGetConversation`
- [ ] Ensure navigation uses correct route: `/chat/${conversationId}`
- **Acceptance**: Contacts integration complete

#### Task 5.10: Test Conversation Creation
- [ ] Run app, go to Contacts tab
- [ ] Start conversation with a contact
- [ ] Should navigate to chat screen
- [ ] Go back, should see conversation in Chats list
- **Acceptance**: Conversation creation works

#### Task 5.11: Write Conversation Service Tests
- [ ] Create file: `services/__tests__/conversationService.test.ts`
- [ ] Mock Firestore
- [ ] Test `createOrGetConversation` creates new or returns existing
- [ ] Test `addParticipantToConversation` updates type to group
- [ ] Run tests: `npm test`
- **Acceptance**: Conversation tests pass

#### Task 5.12: Git Commit
- [ ] Run `git commit -am "Hour 4-6: Conversation management complete"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

## PHASE 3: Real-Time Messaging (Hours 6-12)

### Hour 6-9: Message Service & Chat UI

#### Task 6.1: Create Message Service
- [ ] Create file: `services/messageService.ts`
- [ ] Import Firestore and types
- [ ] Implement `sendMessage` function
  - Add message to conversations/{id}/messages collection
  - Set timestamp, status: 'sent', readBy: [senderId]
- **Acceptance**: sendMessage function complete

#### Task 6.2: Implement Subscribe to Messages
- [ ] In `messageService.ts`, implement `subscribeToMessages` function
- [ ] Query messages collection ordered by timestamp asc
- [ ] Return onSnapshot listener
- [ ] Convert Firestore timestamps to Date objects
- **Acceptance**: subscribeToMessages function complete

#### Task 6.3: Implement Mark Messages as Read
- [ ] In `messageService.ts`, implement `markMessagesAsRead` function
- [ ] Use writeBatch to update multiple messages
- [ ] Update readBy array with arrayUnion(userId)
- [ ] Update status to 'read'
- **Acceptance**: markMessagesAsRead function complete

#### Task 6.4: Implement Mark Message as Delivered
- [ ] In `messageService.ts`, implement `markMessageAsDelivered` function
- [ ] Update single message deliveredTo array
- [ ] Update status to 'delivered'
- **Acceptance**: markMessageAsDelivered function complete

#### Task 6.5: Create Chat Screen
- [ ] Create file: `app/chat/[id].tsx`
- [ ] Import GiftedChat, message service, auth context
- [ ] Get conversationId from route params
- [ ] Add state for messages array and isOnline
- [ ] Setup NetInfo listener for network status
- **Acceptance**: Chat screen file created with imports and state

#### Task 6.6: Implement Message Subscription
- [ ] In chat screen useEffect, call `subscribeToMessages`
- [ ] Convert Firebase messages to GiftedChat format (_id, text, createdAt, user)
- [ ] Reverse messages array (GiftedChat expects newest first)
- [ ] Mark messages as delivered if not from current user
- [ ] Mark messages as read on first load
- **Acceptance**: Messages load and display in chat

#### Task 6.7: Implement Send Message
- [ ] In chat screen, implement `onSend` callback
- [ ] Extract message text and generate localId (uuid)
- [ ] Optimistically add message to UI immediately
- [ ] If online: call `sendMessage` and `updateConversationLastMessage`
- [ ] If offline: call `queueMessage` (will implement next phase)
- [ ] Add error handling with Alert
- **Acceptance**: Send message function complete

#### Task 6.8: Add Offline Indicator
- [ ] In chat screen render, check `isOnline` state
- [ ] If offline, show banner at top: "Offline - Messages will send when connected"
- [ ] Style with orange background, white text
- **Acceptance**: Offline banner shows when offline

#### Task 6.9: Add "Add Participant" Button
- [ ] In chat screen, add TouchableOpacity button (top right)
- [ ] Button text: "+ Add"
- [ ] On press, navigate to `/chat/add-participant?conversationId=${id}`
- [ ] Position absolute with zIndex
- **Acceptance**: Add button visible and clickable

#### Task 6.10: Create Add Participant Screen
- [ ] Create file: `app/chat/add-participant.tsx`
- [ ] Add TextInput for phone number
- [ ] Add "Add Participant" button
- [ ] Implement `handleAddUser`: search by phone, add to conversation, navigate back
- [ ] Show success/error alerts
- **Acceptance**: Add participant screen works

#### Task 6.11: Test Real-Time Messaging on 2 Simulators
- [ ] Start iOS Simulator
- [ ] Start Android Emulator
- [ ] Register 2 different users (one on each)
- [ ] User A starts conversation with User B (via phone search)
- [ ] Send message from A → should appear on B within 1 second
- [ ] Send message from B → should appear on A within 1 second
- [ ] Send 10 rapid messages → all should appear in order
- **Acceptance**: Real-time messaging works between simulators

#### Task 6.12: Write Message Service Tests
- [ ] Create file: `services/__tests__/messageService.test.ts`
- [ ] Mock Firestore
- [ ] Test `sendMessage` creates message doc
- [ ] Test `markMessagesAsRead` updates readBy array
- [ ] Test `markMessageAsDelivered` updates deliveredTo
- [ ] Run tests: `npm test`
- **Acceptance**: Message service tests pass

#### Task 6.13: Git Commit
- [ ] Run `git commit -am "Hour 6-9: Real-time messaging complete"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

### Hour 9-12: Offline Support & SQLite

#### Task 7.1: Create SQLite Service
- [ ] Create file: `services/sqliteService.ts`
- [ ] Import expo-sqlite
- [ ] Open database: `SQLite.openDatabase('messages.db')`
- [ ] Implement `initDB` function
  - Create messages table (id, conversationId, text, senderId, timestamp, status, type, localId, readBy, deliveredTo)
  - Create conversations table (id, type, participants, lastMessage, participantDetails, updatedAt)
- **Acceptance**: SQLite service with initDB created

#### Task 7.2: Implement Cache Message
- [ ] In `sqliteService.ts`, implement `cacheMessage` function
- [ ] INSERT OR REPLACE into messages table
- [ ] Serialize readBy and deliveredTo as JSON strings
- **Acceptance**: cacheMessage function complete

#### Task 7.3: Implement Get Cached Messages
- [ ] In `sqliteService.ts`, implement `getCachedMessages` function
- [ ] SELECT from messages WHERE conversationId
- [ ] ORDER BY timestamp ASC
- [ ] Deserialize JSON fields
- [ ] Return Promise<Message[]>
- **Acceptance**: getCachedMessages function complete

#### Task 7.4: Implement Cache Conversation
- [ ] In `sqliteService.ts`, implement `cacheConversation` function
- [ ] INSERT OR REPLACE into conversations table
- [ ] Serialize participants, lastMessage, participantDetails as JSON
- **Acceptance**: cacheConversation function complete

#### Task 7.5: Create Offline Queue Service
- [ ] Create file: `services/offlineQueue.ts`
- [ ] Import AsyncStorage and message service
- [ ] Define QueuedMessage interface (conversationId, text, senderId, localId, retryCount)
- [ ] Implement `queueMessage` function (adds to AsyncStorage)
- [ ] Implement `getQueue` function (reads from AsyncStorage)
- **Acceptance**: Offline queue basics created

#### Task 7.6: Implement Process Queue
- [ ] In `offlineQueue.ts`, implement `processQueue` function
- [ ] Get queue from AsyncStorage
- [ ] For each message, try to send
- [ ] On success, remove from queue
- [ ] On failure, increment retryCount
- [ ] If retryCount > 3, mark as failed (log to console)
- [ ] Implement exponential backoff: 2s, 4s, 8s delays
- **Acceptance**: processQueue with retry logic complete

#### Task 7.7: Initialize SQLite on App Start
- [ ] Open `app/_layout.tsx`
- [ ] Import `initDB` from sqliteService
- [ ] Call `initDB()` in useEffect on mount
- [ ] Add error handling
- **Acceptance**: SQLite initialized on app start

#### Task 7.8: Setup Queue Processing on Network Reconnect
- [ ] In `app/_layout.tsx`, import NetInfo
- [ ] Add NetInfo.addEventListener in useEffect
- [ ] When state.isConnected becomes true, call `processQueue()`
- **Acceptance**: Queue processes on reconnect

#### Task 7.9: Update Chat Screen to Cache Messages
- [ ] Open `app/chat/[id].tsx`
- [ ] Import `cacheMessage` from sqliteService
- [ ] In message subscription callback, call `cacheMessage(m)` for each message
- **Acceptance**: Messages cached as they arrive

#### Task 7.10: Update Chat Screen to Load Cached Messages First
- [ ] In chat screen, add another useEffect that runs before subscription
- [ ] Call `getCachedMessages(conversationId)`
- [ ] Set messages state with cached data immediately
- [ ] Then subscription will update with fresh data
- **Acceptance**: Cached messages load instantly on open

#### Task 7.11: Test Offline Message Queue
- [ ] Run app on simulator
- [ ] Turn on airplane mode (Cmd+Shift+H, toggle airplane mode in Settings)
- [ ] Send a message → should show "Offline" banner
- [ ] Message appears in UI immediately (optimistic)
- [ ] Turn off airplane mode
- [ ] Within 10 seconds, message should send and show "sent" status
- **Acceptance**: Offline queue works

#### Task 7.12: Test Persistence After Force Quit
- [ ] Run app, send several messages
- [ ] Force quit app (swipe up in app switcher)
- [ ] Reopen app
- [ ] Navigate to conversation
- [ ] Should see all previous messages instantly (from SQLite cache)
- **Acceptance**: Messages persist after force quit

#### Task 7.13: Write SQLite Tests
- [ ] Create file: `services/__tests__/sqliteService.test.ts`
- [ ] Mock expo-sqlite
- [ ] Test `cacheMessage` inserts into table
- [ ] Test `getCachedMessages` retrieves messages
- [ ] Run tests: `npm test`
- **Acceptance**: SQLite tests pass

#### Task 7.14: Write Offline Queue Tests
- [ ] Create file: `services/__tests__/offlineQueue.test.ts`
- [ ] Mock AsyncStorage
- [ ] Test `queueMessage` adds to storage
- [ ] Test `processQueue` retries with backoff
- [ ] Run tests: `npm test`
- **Acceptance**: Queue tests pass

#### Task 7.15: Git Commit
- [ ] Run `git commit -am "Hour 9-12: Offline support complete"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub, Part 1 complete

---

## ✅ Part 1 Complete - Continue to Part 2