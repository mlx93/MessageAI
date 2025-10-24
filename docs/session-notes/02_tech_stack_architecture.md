# Tech Stack & Architecture

**Last Updated:** October 23, 2025  
**Product:** aiMessage (formerly MessageAI)  
**Version:** 1.0.0

---

## 🏗️ Architecture Overview

aiMessage follows a modern mobile-first architecture optimized for rapid development, real-time synchronization, and offline capability. The stack is built on React Native (via Expo) for the frontend and Firebase for the backend infrastructure, with a service layer pattern and offline-first design.

**Key Principles:**
- **Service Layer:** All business logic encapsulated in reusable services
- **Real-Time First:** Firestore onSnapshot listeners for live updates
- **Offline-First:** SQLite caching with queue-based sync
- **Type-Safe:** TypeScript throughout for better DX
- **Custom UI:** iMessage-style implementation with full control

---

## 📱 Frontend Stack

### **Core Framework**
- **React Native:** 0.81.4
- **Expo SDK:** 54.0.16 (Managed workflow)
- **React:** 19.1.0
- **TypeScript:** 5.9.2
- **Package Manager:** npm 9.8.1

### **Navigation**
- **Expo Router:** v6.0.13
  - File-based routing (app/ directory)
  - Type-safe navigation with params
  - Deep linking support for push notifications
  - Tab and stack navigation
  - iOS-style large titles and transitions

### **State Management**
- **React Hooks:** useState, useEffect, useContext, useCallback, useMemo, useRef
- **Context API:** AuthContext for global auth state
- **Custom Hooks:** 
  - `useTypingIndicator` - Manage typing status
  - `useTypingStatus` - Subscribe to typing indicators
  - `useAuth` - Access authentication state

### **UI Framework & Animations**
- **React Native Core Components:**
  - View, Text, ScrollView, FlatList
  - TouchableOpacity, Pressable
  - Image, TextInput
  - KeyboardAvoidingView
  - Modal, Alert

- **React Native Reanimated:** v4.1.1
  - Swipe gestures for timestamp reveal
  - Smooth spring animations (60 FPS)
  - Gesture-driven interactions

- **React Native Gesture Handler:** v2.28.0
  - Swipe-to-delete contacts
  - Touch-based message interactions
  - Native gesture performance

- **Expo Vector Icons:** v15.0.2
  - Ionicons for iOS-style icons
  - Consistent icon design system

### **Local Storage**

#### SQLite
- **Package:** `expo-sqlite` v16.0.8
- **Use Cases:**
  - Offline message queue
  - Local message cache (instant load)
  - Failed message persistence
  - Chat history backup
  - Batched writes (500ms buffer)

#### AsyncStorage
- **Package:** `@react-native-async-storage/async-storage` v2.2.0
- **Use Cases:**
  - User preferences
  - Authentication tokens
  - Small key-value data
  - Offline queue metadata

### **Media Handling**
- **expo-image-picker:** v17.0.8 - Select images from gallery/camera (allowsEditing + 1:1 crop for avatars)
- **expo-image-manipulator:** v14.0.7 - Resize and compress images (square cropping for profile photos)
- **Progressive Compression:** 60MB+ images handled gracefully

### **Device Features**
- **expo-contacts:** v15.0.10 - Native contact picker (one-tap import)
- **expo-notifications:** v0.32.12 - Push notifications (FCM)
- **expo-device:** v8.0.9 - Device information
- **@react-native-community/netinfo:** v11.4.1 - Network status monitoring
- **expo-linking:** v8.0.8 - Deep linking for notifications
- **expo-clipboard:** v8.0.7 - Copy to clipboard

### **Authentication**
- **expo-auth-session:** v7.0.8 - OAuth flows (social auth)
- **expo-apple-authentication:** v8.0.7 - Apple Sign-In
- **expo-web-browser:** v15.0.8 - OAuth browser sessions

### **Utilities**
- **date-fns:** v4.1.0 - Date formatting and manipulation
- **uuid:** v13.0.0 - Generate unique identifiers (v4)
- **react-native-get-random-values:** v1.11.0 - UUID polyfill
- **expo-crypto:** v15.0.7 - Cryptographic operations

---

## ☁️ Backend Stack

### **Firebase Services**

#### Authentication
- **Package:** `firebase` v12.4.0
- **Methods:**
  - Email/Password ✅
  - Phone + OTP (primary auth method) ✅
  - Google Sign-In (OAuth) - Code complete
  - Apple Sign-In - Code complete
- **Features:**
  - JWT token management
  - Automatic token refresh
  - Persistent sessions
  - Secure credential storage

#### Cloud Firestore
- **Database Type:** NoSQL document database
- **Features:**
  - Real-time synchronization (< 1 second latency)
  - Offline persistence (local cache)
  - Compound queries with indexes
  - Security rules enforcement
  - Automatic indexing
  - Batched writes (70% reduction via 300ms debounce)
- **Location:** us-south1 (Dallas)
- **Collections:**
  - `users/{uid}` - User profiles
  - `usersByEmail/{email}` - Email uniqueness index
  - `usersByPhone/{phone}` - Phone uniqueness index
  - `conversations/{conversationId}` - Conversations
  - `conversations/{conversationId}/messages/{messageId}` - Messages (subcollection)
  - `conversations/{conversationId}/typing/{userId}` - Typing indicators
  - `presence/{userId}` - Online/offline status (15s heartbeat)
  - `users/{uid}/contacts/{contactId}` - User contacts

#### Cloud Storage
- **Purpose:** Media file storage (images, future: voice/video)
- **Features:**
  - Secure upload/download with signed URLs
  - Progressive image compression
  - CDN distribution
  - Access control via security rules
  - Automatic cleanup on delete
- **Location:** us-central1
- **Structure:** `users/{userId}/media/{filename}`

#### Cloud Functions
- **Runtime:** Node.js with TypeScript
- **Purpose:** Server-side logic
- **Deployed Functions:**
  - `sendMessageNotification` - Push notifications on new messages
  - Smart delivery (only notify when user not in chat)
  - Badge count updates
- **Use Cases:**
  - Send push notifications via FCM
  - Process media uploads
  - Background data processing
  - Webhook handlers

#### Firebase Cloud Messaging (FCM)
- **Integration:** Via Expo Notifications
- **Features:**
  - Cross-platform push notifications
  - Message delivery confirmation
  - Silent background updates
  - Data payloads for deep linking
  - Badge count management
- **Status:**
  - iOS: Working in Expo Go ✅
  - Android: Requires development build ⏸️

---

## 🗄️ Data Models

### **User Document**
**Collection:** `users/{uid}`  
**Document ID:** Firebase Auth UID

```typescript
interface User {
  uid: string;                  // Firebase Auth UID
  email: string;                // User's email
  firstName: string;            // First name
  lastName: string;             // Last name
  displayName: string;          // "firstName lastName"
  phoneNumber: string;          // E.164 format (e.g., +12025551234)
  photoURL: string | null;      // Profile picture URL
  initials: string;             // "FL" for First Last
  online: boolean;              // Current online status
  lastSeen: Date;               // Last activity time
  createdAt: Date;              // Account creation time
  fcmToken?: string;            // Push notification token
}
```

### **Index Collections (for Uniqueness)**
**Collections:** `usersByEmail/{email}`, `usersByPhone/{phoneNumber}`

```typescript
interface UserIndex {
  uid: string;                  // Reference to users/{uid}
  createdAt: Date;              // Index creation time
}
```

### **Conversation Document**
**Collection:** `conversations/{conversationId}`  
**Document ID:** `userId1_userId2` (direct) or UUID (group)

```typescript
interface Conversation {
  id: string;                   // Document ID
  type: 'direct' | 'group';     // Conversation type
  participants: string[];       // Array of user UIDs
  deletedBy?: string[];         // Per-user deletion
  unreadCounts?: {              // Per-user unread count
    [userId: string]: number;
  };
  lastMessage: {                // Latest message preview
    text: string;
    timestamp: Date;
    senderId: string;
  };
  participantDetails: {         // Denormalized for quick access
    [userId: string]: {
      displayName: string;
      photoURL: string | null;
      initials: string;
      unreadCount: number;
    };
  };
  createdAt: Date;              // Conversation creation time
  updatedAt: Date;              // Last update time
  lastMessageId?: string;       // UUID for deterministic updates
}
```

### **Message Document**
**Collection:** `conversations/{conversationId}/messages/{messageId}`  
**Document ID:** Auto-generated UUID

```typescript
interface Message {
  id: string;                   // Document ID
  conversationId: string;       // Parent conversation
  text: string;                 // Message text
  senderId: string;             // UID of sender
  timestamp: Date;              // Message sent time
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  type: 'text' | 'image' | 'system';
  mediaURL?: string;            // Cloud Storage URL for images
  localId: string;              // For optimistic updates and deduplication
  readBy: string[];             // Array of UIDs who read the message
  deliveredTo: string[];        // Array of UIDs who received the message
}
```

### **Typing Status Document**
**Collection:** `conversations/{conversationId}/typing/{userId}`

```typescript
interface TypingStatus {
  userId: string;               // Who is typing
  conversationId: string;       // In which conversation
  isTyping: boolean;            // Currently typing
  displayName: string;          // User's display name
  timestamp: Date;              // Last update time
}
```

### **Presence Document**
**Collection:** `presence/{userId}`

```typescript
interface PresenceStatus {
  online: boolean;              // Online status
  lastSeen: Date;               // Last activity time
  lastHeartbeat: Date;          // Last heartbeat (15s interval)
  inConversation?: string;      // Active conversation ID
}
```

### **Contact Document**
**Collection:** `users/{userId}/contacts/{contactId}`

```typescript
interface Contact {
  id: string;                   // Contact ID
  phoneNumber: string;          // E.164 format
  name: string;                 // Contact name
  isAppUser: boolean;           // Registered on app
  appUserId: string | null;     // UID if registered
  lastSynced: Date;             // Last sync time
}
```

### **Local SQLite Schema**

```sql
-- Offline message queue
CREATE TABLE message_queue (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  media_url TEXT,
  timestamp INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0,
  last_retry INTEGER,
  status TEXT DEFAULT 'pending'
);

-- Cached messages for offline access
CREATE TABLE cached_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  media_url TEXT,
  timestamp INTEGER NOT NULL,
  read_by TEXT, -- JSON array
  delivered_to TEXT, -- JSON array
  synced INTEGER DEFAULT 0
);

-- Cached conversations
CREATE TABLE cached_conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  participants TEXT NOT NULL, -- JSON array
  last_message TEXT,
  last_message_time INTEGER,
  participant_details TEXT, -- JSON object
  unread_counts TEXT, -- JSON object
  synced INTEGER DEFAULT 0
);
```

---

## 🏛️ Architecture Patterns

### **Service Layer Pattern**
All business logic is encapsulated in service modules:

```
services/
├── firebase.ts              # Firebase SDK initialization
├── authService.ts          # Authentication operations
├── otpService.ts           # OTP code management
├── devOtpHelper.ts         # Dev OTP testing helper
├── contactService.ts       # Contact import and matching
├── conversationService.ts  # Conversation management (participant detail updates)
├── messageService.ts       # Message send/receive & soft delete
├── sqliteService.ts        # Local caching
├── offlineQueue.ts         # Offline queue management (queued banner)
├── imageService.ts         # Image upload/compression (profile photos)
├── presenceService.ts      # Presence system
├── notificationService.ts  # Push notification handling
├── globalMessageListener.ts # Global message subscriptions
└── ...
```

**Benefits:**
- Separation of concerns (UI vs business logic)
- Testable business logic (229+ tests)
- Consistent error handling
- Reusable across components
- Easy to mock for testing

### **Real-Time Listeners**
Firestore `onSnapshot` subscriptions for live updates:

```typescript
// Example: Listen to new messages
const unsubscribe = onSnapshot(
  query(
    collection(db, `conversations/${conversationId}/messages`),
    orderBy('timestamp', 'desc'),
    limit(50)
  ),
  (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        // Handle new message (< 1 second latency)
        const message = { id: change.doc.id, ...change.doc.data() };
        addMessageToUI(message);
      }
    });
  }
);
```

### **Offline-First Architecture**

1. **Optimistic Updates:**
   - Update local UI immediately
   - Write to SQLite queue
   - Sync to Firestore in background
   - Show "queued" status if offline

2. **Retry Logic:**
   - Exponential backoff for failed operations
   - Max retry attempts: 3
   - Backoff formula: `2^retryCount * 1000ms`
   - Queue telemetry for monitoring

3. **Network Detection:**
   - Monitor with `@react-native-community/netinfo`
   - Pause sync when offline
   - Resume and process queue when connection restored
   - Show reconnection feedback to user

4. **Batching:**
   - SQLite writes: 500ms buffer
   - Firestore conversation updates: 300ms debounce
   - 70% reduction in Firestore writes
   - Flush on app background/chat unmount

### **Deterministic Updates**
- **lastMessageId Guard:** Prevents out-of-order conversation updates
- **UUID v4 Ordering:** Lexicographic comparison for race conditions
- **Atomic Increments:** Unread count operations use Firestore increment()

### **Error Handling Strategy**

```typescript
// Centralized error handling
try {
  await sendMessage(message);
} catch (error) {
  console.error('Send message failed:', error);
  
  // Queue for retry
  await queueMessage(message);
  
  // Show user feedback
  Alert.alert('Message Queued', 'Will send when online');
}
```

---

## 🧪 Testing Strategy

### **Unit Tests**
- **Framework:** Jest v29.7.0
- **Coverage:** 60-65% statements (target: 70%+)
- **Location:** `__tests__/` folders next to source files
- **Suites:**
  - `utils/__tests__/messageHelpers.test.ts` (60+ tests)
  - `utils/__tests__/phoneFormat.test.ts` (10 tests)
  - `services/__tests__/authService.test.ts` (6 tests)
  - `services/__tests__/conversationService.test.ts` (6 tests)

### **Integration Tests**
- **Tool:** Firebase Emulators
- **Services:** Auth (9099), Firestore (8080), Functions (5001), Storage (9199)
- **Approach:** Test against local emulator suite
- **Suites:**
  - `services/__tests__/authService.integration.test.ts` (38 tests)
  - `services/__tests__/messageService.integration.test.ts` (30 tests)
  - `services/__tests__/conversationService.integration.test.ts` (25 tests)
  - `services/__tests__/offlineQueue.integration.test.ts` (28 tests)
  - `services/__tests__/sqliteService.integration.test.ts` (32 tests)
- **Total:** 153 integration tests

### **E2E Tests**
- **Platform:** iOS Simulator + Android Emulator
- **Tool:** Manual testing protocols
- **Scenarios:** 7 core user flows
- **Future:** Maestro flows planned

### **Test Coverage Summary**
- **Total Tests:** 229+ tests
- **Integration Tests:** 153 tests (5 suites)
- **Unit Tests:** 76+ tests (3 suites)
- **Coverage:** ~60-65% statements
- **MVP Requirements Tested:** 8 out of 10 fully covered

---

## 🔐 Security Architecture

### **Authentication Flow**
1. User enters phone number
2. Firebase sends OTP code
3. User verifies OTP
4. JWT token issued
5. Token stored in AsyncStorage
6. Token auto-refreshed before expiry
7. Profile setup for new users

### **Firestore Security Rules**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User can read/write their own document
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    // Conversation access for participants only
    match /conversations/{convId} {
      allow read: if request.auth.uid in resource.data.participants;
      allow write: if request.auth.uid in resource.data.participants;
      
      // Messages subcollection
      match /messages/{messageId} {
        allow read: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(convId)).data.participants;
        allow write: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(convId)).data.participants;
      }
    }
    
    // Email uniqueness index
    match /usersByEmail/{email} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    
    // Phone uniqueness index
    match /usersByPhone/{phone} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

### **Storage Security Rules**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/media/{filename} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId 
        && request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }

    match /users/{userId}/profile-photos/{filename} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId
        && request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## 🚀 Development Workflow

### **Local Development**
```bash
# Start Expo dev server
npx expo start

# Open iOS Simulator (press 'i')
# Open Android Emulator (press 'a')

# Hot reload enabled - changes appear instantly
# Fast Refresh preserves component state
```

### **Testing**
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Start Firebase Emulators
npm run test:emulators
```

### **Building**
```bash
# Build for iOS (requires Mac + Xcode)
eas build --platform ios

# Build for Android
eas build --platform android

# Build for both
eas build --platform all
```

---

## 📦 Package Management

### **Dependency Strategy**
- Use Expo-compatible packages when available
- For native modules, use Expo modules API
- Regular updates for security patches
- Exact versions for stability

### **Version Control**
- `package-lock.json` committed to repo
- Exact versions for stability
- `npm ci` for production deployments

---

## 🔄 Data Flow

### **Message Send Flow**
1. User types message
2. Create message object with localId (UUID)
3. Add to local SQLite queue
4. Display in UI optimistically with "sending" status
5. Upload media to Cloud Storage (if image)
6. Write message to Firestore `conversations/{id}/messages`
7. Remove from SQLite queue on success
8. Update UI with "sent" status and server timestamp
9. Cloud Function sends push notification to other users
10. Recipients' apps receive notification and update UI

### **Message Receive Flow**
1. Firestore listener detects new message document
2. Download media from Cloud Storage (if image)
3. Save to local SQLite cache (batched)
4. Update UI with new message
5. Mark as "delivered" in Firestore
6. User opens chat → mark as "read" in Firestore
7. Sender sees "read" status update in real-time

### **Offline → Online Flow**
1. User sends message while offline
2. Message added to SQLite queue with status "queued"
3. UI shows message with "queued" chip
4. Network reconnects
5. Process queue with exponential backoff
6. Show "Back Online - X messages sent" alert
7. Update UI with "sent" status
8. Clear queue on success

---

## 🎨 UI Design System

### **iMessage-Style Components**

**Colors:**
- Primary: `#007AFF` (iOS Blue)
- Own Message Bubble: `#007AFF` (blue background, white text)
- Other Message Bubble: `#E8E8E8` (light gray background, black text)
- Background: `#FFFFFF` (white)
- Borders: `#E8E8E8` (light gray)
- Disabled: `#C0C0C0` (gray)
- Green Dot (Online): `#34C759`
- Yellow Dot (Background): `#FFD60A`

**Typography:**
- Large Title: 34px, Bold (iOS large navigation titles)
- Header Title: 17px, Semibold
- Message Text: 15px, Regular
- Timestamp: 12px, Regular
- Pill Text: 15px, Regular
- Button Text: 16px, Semibold

**Navigation:**
- Large titles in tab navigation (iOS-style)
- Custom back button (arrow only, no text)
- Header right buttons (blue text/icons)
- Tab bar icons with active/inactive colors

**Message Bubbles:**
- Border radius: 18px
- Padding: 10px horizontal, 8px vertical
- Max width: 70% of screen
- Own messages: Right-aligned, blue, `marginLeft: 'auto'`
- Other messages: Left-aligned, gray
- Timestamps revealed on swipe (smooth spring animation)
- Read receipts below bubbles: "Read 9:45 AM" or "Delivered"

**Components:**
- `ConversationTypingIndicator.tsx` - Typing dots on conversation rows
- `ImageViewer.tsx` - Full-screen image viewer with pinch-to-zoom
- `InAppNotificationBanner.tsx` - Banner for new messages while in app

---

**Last Updated:** October 23, 2025  
**Status:** Production-ready with comprehensive architecture
