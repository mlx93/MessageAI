# Tech Stack & Architecture

**Last Updated:** October 20, 2024

---

## 🏗️ Architecture Overview

MessageAI follows a modern mobile-first architecture optimized for rapid development, real-time synchronization, and offline capability. The stack is built on React Native (via Expo) for the frontend and Firebase for the backend infrastructure.

---

## 📱 Frontend Stack

### **Core Framework**
- **React Native:** 0.81.4
- **Expo SDK:** 54.0.13 (Managed workflow)
- **React:** 19.1.0
- **TypeScript:** 5.9.2

### **Navigation**
- **Expo Router:** v6.0.12
  - File-based routing
  - Type-safe navigation
  - Deep linking support
  - Tab and stack navigation

### **UI Framework**
- **React Native Gifted Chat:** v2.8.1
  - Pre-built chat UI components
  - Message bubbles, input, avatars
  - Customizable and accessible

- **React Native Core Components:**
  - View, Text, ScrollView
  - TouchableOpacity, Pressable
  - Image, TextInput
  - FlatList for performant lists

### **State Management**
- **React Hooks:** useState, useEffect, useContext
- **Custom Hooks:** (To be implemented)
  - useAuth - Authentication state
  - useMessages - Message subscriptions
  - useContacts - Contact management
  - useNetwork - Network status

### **Local Storage**

#### SQLite
- **Package:** `expo-sqlite` v16.0.8
- **Use Cases:**
  - Offline message queue
  - Local message cache
  - Failed message persistence
  - Chat history backup

#### AsyncStorage
- **Package:** `@react-native-async-storage/async-storage` v2.2.0
- **Use Cases:**
  - User preferences
  - Authentication tokens
  - Small key-value data
  - App settings

### **Media Handling**
- **expo-image-picker:** v17.0.8 - Select images from gallery/camera
- **expo-image-manipulator:** v14.0.7 - Resize and compress images
- **React Native Image:** Built-in image display with caching

### **Device Features**
- **expo-contacts:** v15.0.9 - Access device contacts
- **expo-notifications:** v0.32.12 - Push notifications
- **expo-device:** v8.0.9 - Device information
- **@react-native-community/netinfo:** v11.4.1 - Network status

### **Utilities**
- **date-fns:** v4.1.0 - Date formatting and manipulation
- **uuid:** v13.0.0 - Generate unique identifiers

---

## ☁️ Backend Stack

### **Firebase Services**

#### Authentication
- **Package:** `firebase` v12.4.0
- **Methods:**
  - Email/Password
  - Google Sign-In (OAuth)
  - Apple Sign-In
- **Features:**
  - JWT token management
  - Automatic token refresh
  - Persistent sessions

#### Cloud Firestore
- **Database Type:** NoSQL document database
- **Features:**
  - Real-time synchronization
  - Offline persistence
  - Compound queries
  - Security rules
  - Automatic indexing
- **Location:** us-south1 (Dallas)

#### Cloud Storage
- **Purpose:** Media file storage (images, future: voice messages)
- **Features:**
  - Secure upload/download
  - Automatic compression
  - CDN distribution
  - Access control via security rules
- **Location:** us-central1

#### Cloud Functions
- **Runtime:** Node.js with TypeScript
- **Purpose:** Server-side logic
- **Use Cases:**
  - Send push notifications
  - Process media uploads
  - Background data processing
  - Webhook handlers

#### Firebase Cloud Messaging (FCM)
- **Integration:** Via Expo Notifications
- **Features:**
  - Cross-platform push notifications
  - Message delivery confirmation
  - Silent background updates
  - Data payloads

---

## 🗄️ Data Models

### **User Document**
**Collection:** `users`  
**Document ID:** Firebase Auth UID

```typescript
interface User {
  uid: string;                  // Firebase Auth UID
  email: string;                // User's email
  phoneNumber?: string | null;  // E.164 format (e.g., +12025551234)
  displayName: string;          // User's name
  photoURL?: string | null;     // Profile picture URL
  createdAt: Timestamp;         // Account creation time
  lastSeen: Timestamp;          // Last activity time
  isOnline: boolean;            // Current online status
}
```

### **Index Collections (for Uniqueness)**
**Collections:** `usersByEmail/{email}`, `usersByPhone/{phoneNumber}`

```typescript
interface UserIndex {
  uid: string;                  // Reference to users/{uid}
  createdAt: Timestamp;         // Index creation time
}
```

### **Conversation Document**
**Collection:** `conversations`  
**Document ID:** Auto-generated

```typescript
interface Conversation {
  type: 'direct' | 'group';     // Conversation type
  participantIds: string[];      // Array of user UIDs
  participantDetails: {          // Denormalized for quick access
    [uid: string]: {
      displayName: string;
      photoURL?: string;
    }
  };
  lastMessage: {                 // Latest message preview
    text: string;
    senderId: string;
    timestamp: Timestamp;
  };
  lastMessageTime: Timestamp;    // For sorting conversations
  createdAt: Timestamp;          // Conversation creation time
  
  // Group-specific fields (optional)
  groupName?: string;
  groupPhotoURL?: string;
  adminIds?: string[];           // Group admins
}
```

### **Message Document**
**Collection:** `conversations/{conversationId}/messages`  
**Document ID:** Auto-generated

```typescript
interface Message {
  senderId: string;              // UID of sender
  senderName: string;            // Denormalized for display
  text: string;                  // Message text
  mediaUrl?: string | null;      // Cloud Storage URL for media
  mediaType?: 'image' | 'video' | 'audio' | null;
  timestamp: Timestamp;          // Message sent time
  deliveryStatus: 'sending' | 'sent' | 'delivered' | 'failed';
  readBy: string[];              // Array of UIDs who read the message
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
  synced INTEGER DEFAULT 0
);
```

---

## 🏛️ Architecture Patterns

### **Service Layer Pattern**
All business logic is encapsulated in service modules:

```
services/
├── authService.ts          # Authentication operations
├── userService.ts          # User CRUD operations
├── conversationService.ts  # Conversation management
├── messageService.ts       # Message send/receive
├── contactService.ts       # Contact import and matching
├── storageService.ts       # Media upload/download
├── notificationService.ts  # Push notification handling
└── offlineService.ts       # Offline queue management
```

**Benefits:**
- Separation of concerns
- Testable business logic
- Consistent error handling
- Reusable across components

### **Real-Time Listeners**
Firestore `onSnapshot` subscriptions for live updates:

```typescript
// Example: Listen to new messages
onSnapshot(
  query(
    collection(db, `conversations/${conversationId}/messages`),
    orderBy('timestamp', 'desc'),
    limit(50)
  ),
  (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        // Handle new message
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

2. **Retry Logic:**
   - Exponential backoff for failed operations
   - Max retry attempts: 3
   - Backoff formula: `2^retryCount * 1000ms`

3. **Network Detection:**
   - Monitor with `@react-native-community/netinfo`
   - Pause sync when offline
   - Resume when connection restored

### **Error Handling Strategy**

```typescript
// Centralized error handling
class AppError extends Error {
  code: string;
  retryable: boolean;
  
  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

// Usage
try {
  await sendMessage(message);
} catch (error) {
  if (error.retryable) {
    // Add to retry queue
  } else {
    // Show error to user
  }
}
```

---

## 🧪 Testing Strategy

### **Unit Tests**
- **Framework:** Jest v54.0.12
- **Coverage Target:** 80%+ for services
- **Location:** `__tests__/` folders next to source files

### **Integration Tests**
- **Tool:** Firebase Emulators
- **Services:** Auth, Firestore, Functions
- **Approach:** Test against local emulator suite

### **E2E Tests**
- **Platform:** iOS Simulator + Android Emulator
- **Tool:** Manual testing + Expo Go
- **Scenarios:** 7 core user flows

### **Mocks & Stubs**
Configured in `jest.setup.js`:
- Firebase services
- Expo modules
- AsyncStorage
- Native modules

---

## 🔐 Security Architecture

### **Authentication Flow**
1. User enters credentials
2. Firebase Auth validates
3. JWT token issued
4. Token stored in AsyncStorage
5. Token auto-refreshed before expiry

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
      allow read: if request.auth.uid in resource.data.participantIds;
      allow write: if request.auth.uid in resource.data.participantIds;
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
      allow write: if request.auth.uid == userId;
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

# Open iOS Simulator
Press 'i'

# Open Android Emulator
Press 'a'

# Hot reload enabled - changes appear instantly
```

### **Testing**
```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Start Firebase Emulators
firebase emulators:start
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
- Legacy peer deps flag for React version conflicts
- Regular updates for security patches

### **Version Control**
- `package-lock.json` committed to repo
- Exact versions for stability
- `npm ci` for production deployments

---

## 🔄 Data Flow

### **Message Send Flow**
1. User types message
2. Create message object with temp ID
3. Add to local SQLite queue
4. Display in UI optimistically
5. Upload media to Cloud Storage (if any)
6. Write message to Firestore
7. Remove from SQLite queue on success
8. Update UI with server timestamp

### **Message Receive Flow**
1. Firestore listener detects new doc
2. Download media from Cloud Storage (if any)
3. Save to local SQLite cache
4. Update UI
5. Mark as read in Firestore
6. Send read receipt

---

**Last Updated:** October 20, 2024

