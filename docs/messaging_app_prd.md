# Product Requirements Document: AI-Enhanced Messaging App

## Executive Summary

A real-time messaging application built with React Native and Firebase, featuring core WhatsApp-like functionality with AI agent capabilities. The app prioritizes reliable message delivery, offline-first architecture, and seamless real-time communication.

**Timeline**: 7 days (MVP gate at 24 hours)  
**Platform**: iOS & Android via React Native/Expo  
**Backend**: Firebase (Firestore, Auth, Cloud Functions, FCM)

---

## Development Philosophy

### Messages First Approach
**CRITICAL**: The entire MVP is about proving messaging infrastructure reliability, not feature completeness.

**Build Order (Non-negotiable)**:
1. Send a text message from User A → appears on User B's device
2. Messages persist locally (works offline)
3. Messages sync on reconnect
4. Handle app lifecycle (background/foreground)

**Only after messaging is solid** should any other features be added.

### Build Vertically, Not Horizontally
- Finish one complete slice at a time
- Don't have 10 half-working features
- Example: Complete auth → complete 1-1 messaging → complete offline → complete groups
- Each slice should be fully functional before moving to the next

### Test on Real Hardware
- Simulators don't accurately represent performance, networking, or app lifecycle
- Use physical devices for all testing
- Test on both iOS and Android devices
- Test on older/slower devices, not just latest flagships

### Definition of "Done"
A feature is done when:
- It works reliably in all testing scenarios
- It survives app restart/crash
- It handles poor network conditions
- It's been tested on physical devices
- Messages never get lost

---

## AI Agent Vision (Post-MVP Context)

### Why AI Features Exist
This messaging app is designed as a **platform for AI-enhanced communication**, not just a chat app. The MVP focuses on rock-solid messaging infrastructure because AI features are only valuable if the underlying messaging is reliable.

### Future AI Integration Points
After MVP is proven, AI features will be layered on top:

**Potential AI Capabilities** (to be scoped post-MVP):
- **Smart Replies**: AI-generated quick response suggestions based on message content
- **Message Summarization**: Summarize long conversation threads
- **Content Moderation**: Automatic detection of inappropriate content
- **Translation**: Real-time message translation between languages
- **Sentiment Analysis**: Understand tone and emotion in conversations
- **Task Extraction**: Automatically identify and extract action items from conversations
- **AI Bot Users**: Special users that are AI agents (can participate in conversations)
- **Automated Responses**: AI handles routine questions/responses

### Integration Architecture (Planned)
```
User Message → Firestore → Cloud Function → AI API (OpenAI/Anthropic/etc) → Response → Firestore → User
```

**Key Design Decisions for AI Layer**:
1. **Message Type**: Add 'ai_response' message type
2. **Bot Users**: Create special user accounts for AI agents
3. **Processing Queue**: Cloud Function queue for AI requests (to handle rate limits)
4. **Streaming**: Support for streaming AI responses (show text as it's generated)
5. **Context Management**: How much conversation history to send to AI APIs
6. **Cost Management**: Rate limiting, caching, user quotas

### When to Start AI Development
**Not until**:
- MVP gate passed (24 hours)
- All testing scenarios pass reliably
- Message delivery is 99%+ reliable
- App is stable on physical devices

**Decision Point**: Day 4-5 of week
- Review MVP performance
- Decide which AI capability to build first
- Scope AI feature requirements
- Update implementation plan

### Infrastructure Preparation (Done in MVP)
Even though AI features are post-MVP, the messaging infrastructure is being designed with AI in mind:
- Cloud Functions already set up (can add AI processing functions)
- Message types are extensible ('text', 'image', can add 'ai_response')
- Real-time listeners support any message type
- User model can accommodate bot users

**Bottom Line**: AI features are the future, but messaging reliability is the MVP. Don't think about AI until messaging is bulletproof.

---

## User Stories

### Authentication & Onboarding
- As a new user, I want to create an account with email, phone number, first name, and last name so that I can access the messaging app
- As a new user, I want my email and phone number to be unique so that there's no account confusion
- As a user, I want to set a profile picture (optional) so that others can recognize me
- As a user without a profile picture, I want to see my initials as a default avatar so that conversations look complete
- As a returning user, I want to log in automatically so that I don't have to enter credentials every time

### Contacts & User Discovery
- As a user, I want to import my phone contacts so that I can find people I know on the app
- As a user, I want to see which of my contacts are on the app so that I can start conversations with them
- As a user, I want to search for users by phone number so that I can find specific people
- As a user, I want to browse my known contacts list so that I can start new conversations
- As a user, I want to start a new conversation directly from a contact's profile so that it's quick and easy

### One-on-One Messaging
- As a user, I want to start a new conversation by selecting a user from the top bar so that I can message anyone
- As a user, I want to send text messages to another user so that I can communicate with them
- As a user, I want to see my latest messages instantly when opening the app (from cache) so that the app feels fast
- As a user, I want to see older conversation history load within 2 seconds so that I can reference past messages
- As a user, I want to see messages appear instantly when I send them so that the app feels responsive
- As a user, I want to see when my messages are delivered and read so that I know the recipient got them
- As a user, I want to receive messages in real-time so that I can have fluid conversations
- As a user, I want to see message timestamps so that I know when messages were sent
- As a user, I want to see my conversation history when I reopen the app so that I can reference past messages
- As a user, I want to send messages even when I'm offline so that I don't lose my thoughts (they should send when I reconnect)

### Presence & Status
- As a user, I want to see if someone is online or offline so that I know if they're available
- As a user, I want to see when someone is typing so that I know they're responding
- As a user, I want others to see when I'm online so that they know I'm available

### Group Messaging
- As a user, I want to add multiple users to a conversation (seamlessly, just like iMessage) so that I can coordinate with multiple people
- As a user, I want group chats to work exactly like one-on-one chats (no special UI) so that the experience is seamless
- As a user, I want to see who sent each message in a group so that I can follow the conversation
- As a user, I want to see who has read my messages in a group so that I know who's up to date
- As a user, I want to receive group messages in real-time just like one-on-one messages

### Media Sharing
- As a user, I want to send images from my gallery so that I can share photos
- As a user, I want to take a photo and send it immediately so that I can share what I'm seeing
- As a user, I want to see images inline in my conversations so that I don't have to download them separately

### Notifications
- As a user, I want to receive notifications when I get a message so that I don't miss important communications
- As a user, I want to see who sent the message in the notification so that I can prioritize my response
- As a user, I want to tap a notification to open the conversation so that I can respond quickly

### Reliability & Offline Support
- As a user, I want messages to never get lost even if my app crashes so that I can trust the app
- As a user, I want to view my conversation history when offline so that I can reference past messages
- As a user, I want the app to handle poor network conditions gracefully so that I can use it anywhere
- As a user, I want messages to sync automatically when I reconnect so that I don't miss anything

---

## MVP Requirements (24-Hour Gate)

### Critical Success Criteria
The MVP must demonstrate **rock-solid messaging infrastructure**. Feature completeness is secondary to reliability.

#### Must-Have Features
1. ✅ One-on-one chat functionality
2. ✅ Real-time message delivery (2+ users)
3. ✅ Message persistence (survives app restarts)
4. ✅ Optimistic UI updates
5. ✅ Online/offline status indicators
6. ✅ Message timestamps
7. ✅ User authentication & profiles
8. ✅ Basic group chat (3+ users)
9. ✅ Message read receipts
10. ✅ Push notifications (foreground minimum)

#### Deployment Target
- Running on local emulator/simulator
- Deployed Firebase backend
- Bonus: TestFlight/APK/Expo Go distribution

---

## Functional Requirements

### 1. Authentication & User Management

#### User Registration
- Email/password authentication via Firebase Auth
- **Social sign-in**: Google Sign-In and Apple Sign-In (preferred method)
- Required fields (for email/password): email, phone number, first name, last name
- Social sign-in: auto-populate name and email, prompt for phone number
- Email must be unique across all users
- Phone number must be unique across all users
- Profile picture optional (defaults to initials avatar)
- Automatic user document creation in Firestore

#### User Profile
- First name and last name (required)
- Display name (derived from first + last name)
- Email (unique, required)
- Phone number (unique, required, normalized to E.164)
- Profile picture (optional - shows initials if not set)
- Online/offline status
- Last seen timestamp
- User ID (Firebase Auth UID)

**Data Model: User Document**
```javascript
users/{userId}: {
  firstName: string,
  lastName: string,
  displayName: string, // "firstName lastName"
  email: string, // unique
  phoneNumber: string, // unique, E.164 format (normalized from any format)
  photoURL: string | null,
  initials: string, // "FL" for First Last
  online: boolean,
  lastSeen: timestamp,
  createdAt: timestamp,
  fcmToken: string | null
}
```

**Email/Phone Uniqueness: Index Collections**
```javascript
// Separate collections for uniqueness enforcement
usersByEmail/{email}: {
  uid: string,
  createdAt: timestamp
}

usersByPhone/{phoneNumber}: {
  uid: string,
  createdAt: timestamp
}
```

#### Contacts & User Discovery
- Import phone contacts on first launch (with permission)
- Match contacts against app users by phone number
- Display "Contacts on App" list showing matched users
- Search functionality:
  - Search within known contacts by name
  - Search globally by exact phone number match
  - No global name search (too many duplicates)
- Start conversation directly from contact profile
- Contact sync: periodic background sync to detect new users

**Data Model: Contact Mapping**
```javascript
users/{userId}/contacts/{contactId}: {
  phoneNumber: string,
  name: string, // from phone contacts
  isAppUser: boolean,
  appUserId: string | null,
  lastSynced: timestamp
}
```

### 2. One-on-One Messaging

#### Core Functionality
- Text message sending/receiving
- Real-time delivery (< 500ms for online users)
- Message ordering by timestamp
- Character limit: 5000 per message
- Message editing: not in MVP (add later)
- Message deletion: not in MVP (add later)

#### Message States
1. **Sending**: Message queued locally, uploading to server (with auto-retry)
2. **Sent**: Server confirmed receipt
3. **Delivered**: Recipient device received message
4. **Read**: Recipient opened conversation and viewed message (if read receipts enabled)
5. **Failed**: Auto-retry exhausted, show error indicator with manual retry button

#### Delivery Guarantees
- At-least-once delivery (handle duplicates via message ID)
- Messages never lost, even during crashes
- Auto-retry logic with exponential backoff (3 attempts in background)
- If auto-retry fails: show red "failed" indicator on message with retry button
- Queue messages when offline, send on reconnect
- Message ordering by Firestore server timestamp (sufficient for MVP)

#### Failed Message Handling
- Failed messages remain in local view with red error indicator
- User can tap retry button to attempt resend
- User can delete/clear failed message from local view (not a true deletion since never sent)
- Failed messages persist in SQLite until successfully sent or manually cleared by user
- Messages with status 'failed' show retry and delete options on tap

**Data Model: Message Document**
```javascript
conversations/{conversationId}/messages/{messageId}: {
  text: string,
  senderId: string,
  timestamp: timestamp, // Firestore server timestamp for ordering
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed',
  type: 'text' | 'image' | 'system',
  mediaURL: string | null,
  localId: string, // for optimistic updates and deduplication
  readBy: string[], // for group chats (only if read receipts enabled)
  deliveredTo: string[] // for tracking delivery
}
```

**Data Model: Conversation Document**
```javascript
conversations/{conversationId}: {
  id: string, // random UUID
  type: 'direct' | 'group',
  participants: string[],
  lastMessage: {
    text: string,
    timestamp: timestamp, // used for conversation list ordering
    senderId: string
  },
  participantDetails: {
    [userId]: {
      displayName: string,
      photoURL: string,
      unreadCount: number,
      readReceiptsEnabled: boolean // per-user setting
    }
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 3. Group Messaging

#### Core Functionality
- Seamless experience: groups work exactly like one-on-one chats (no separate UI)
- Add multiple users to conversation via top bar user selector (same as starting 1-1)
- Conversation automatically becomes "group" when 3+ participants added
- Message attribution (show sender name/avatar)
- Per-user read receipts (array of user IDs)
- No special "create group" flow - just add more people to any conversation

#### Conversation Creation Flow
- Tap "New Conversation" button
- User selector appears in top bar
- Select one user → creates one-on-one conversation
- Select multiple users → creates group conversation
- Can add more users to existing conversation at any time (converts 1-1 to group)

#### Group-Specific Features
- Group name (optional, defaults to participant names like "John, Sarah, Mike")
- Participant list view
- Add participants any time (no permission system in MVP)
- Remove participants: post-MVP
- Group admin roles: post-MVP
- Group icons: post-MVP

#### Message Delivery
- Messages delivered to all participants
- Individual read tracking per user (only if read receipts enabled for that user)
- Typing indicators show actual individual names: "John is typing..." or "Sarah and Mike are typing..."
- Multiple typers: show up to 3 names, then "John, Sarah, and 2 others are typing..."

### 4. Real-Time Features

#### Presence System
- Online/offline status per user
- Last seen timestamp when offline
- Update on app foreground/background
- Apps go offline when:
  - User explicitly closes app
  - App is backgrounded for extended period
  - Network connection lost
  - Device locked/screen off

**Implementation:**
- Firebase Firestore presence using `onDisconnect()`
- Local state management for current user
- Real-time listeners for other users' presence
- No artificial grace period - status reflects actual app state

#### Typing Indicators
- Show "[User] is typing..." in conversation
- Updates as user types in real-time
- Stops showing when user stops typing (no artificial timeout)
- Only show for active conversation
- Implementation: Send typing status updates to Firestore, debounce to avoid excessive writes (max 1 update per 500ms)

**What "debounce" means**: Instead of sending a Firestore update on every keystroke (which could be 100+ writes per second), we wait 500ms after the last keystroke before sending an update. This reduces database writes while keeping the indicator responsive.

**Data Model: Typing Status**
```javascript
conversations/{conversationId}/typing/{userId}: {
  isTyping: boolean,
  timestamp: timestamp
}
```

#### Read Receipts (Always-On for MVP)
- Always enabled - no privacy toggle in MVP
- Update when user opens conversation
- Mark all messages as read when viewing
- Show double blue checkmark for read messages
- Double gray checkmark for delivered
- Single gray checkmark for sent
- Clock icon for sending

### 5. Offline Support & Persistence

#### Local Storage (Expo SQLite)
- Cache all conversations
- Cache last 100 messages per conversation
- Cache user profiles
- Cache media thumbnails

**SQLite Schema:**
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  type TEXT,
  participants TEXT, -- JSON array
  lastMessage TEXT, -- JSON object
  updatedAt INTEGER
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversationId TEXT,
  text TEXT,
  senderId TEXT,
  timestamp INTEGER,
  status TEXT,
  type TEXT,
  mediaURL TEXT,
  localId TEXT,
  FOREIGN KEY(conversationId) REFERENCES conversations(id)
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  displayName TEXT,
  photoURL TEXT,
  online INTEGER,
  lastSeen INTEGER
);
```

#### Sync Strategy
- On app launch: load latest messages from SQLite immediately (instant display)
- Background: sync older conversations from Firestore (within 2 seconds)
- Conflict resolution: server timestamp wins
- Offline queue: persist in SQLite, retry on reconnect

#### Offline Behavior
- View all cached conversations instantly
- Send messages (queued locally)
- View message history
- Show "offline" banner
- Auto-sync when connection restored

### 6. Push Notifications

#### Notification Types
1. **New Message**: "[Sender] sent you a message"
2. **Group Message**: "[Sender] in [Group Name]: [Message preview]"

#### Notification Behavior
- **User actively in the conversation**: No notification - message appears in real-time in UI
- **User in different conversation or app screen**: Send system notification
- **User not in app (background/closed)**: Send system notification with FCM

#### Implementation
- Firebase Cloud Messaging (FCM)
- Store FCM token in user document
- Cloud Function triggers on new message
- Check if recipient is actively viewing that specific conversation (don't send notification)
- If recipient is elsewhere or app is backgrounded/closed, send notification
- Notification payload includes conversation ID for deep linking

#### Notification States
- **Foreground + Active Conversation**: Real-time message display only (no notification)
- **Foreground + Different Screen**: System notification
- **Background**: System notification
- **Killed**: System notification

**Cloud Function: Send Notification**
```javascript
exports.sendMessageNotification = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const conversationId = context.params.conversationId;
    
    // Get conversation and recipients
    // Check if recipients are actively viewing this conversation
    // Send FCM notification to users not in active conversation
  });
```

### 7. Media Support (MVP: Images Only)

#### Image Messaging
- Select from gallery or camera
- Upload to Firebase Storage
- Thumbnail generation: post-MVP
- Max size: 5MB
- Supported formats: JPEG, PNG
- Progress indicator during upload

#### Image Display
- Inline in chat (thumbnail)
- Tap to view full screen
- Download/save: post-MVP
- Image compression before upload

**Data Model: Media Message**
```javascript
{
  type: 'image',
  text: '', // optional caption
  mediaURL: 'gs://bucket/images/messageId.jpg',
  mediaMetadata: {
    width: number,
    height: number,
    size: number
  }
}
```

---

## Technical Architecture

### Frontend Architecture (React Native + Expo)

#### Tech Stack
- **Framework**: React Native with Expo (SDK 50+)
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context + useReducer
- **Local Database**: Expo SQLite (previously mentioned as "Expo Secure Lock" - using SQLite for structured data)
- **Notifications**: Expo Notifications
- **Real-time**: Firebase Firestore SDK with real-time listeners (no polling)
- **Auth**: Firebase Auth with Google Sign-In and Apple Sign-In

#### App Structure
```
app/
├── (auth)/
│   ├── login.tsx
│   ├── register.tsx
│   └── social-auth.tsx       # Google/Apple sign-in
├── (tabs)/
│   ├── index.tsx              # Conversations list (ordered by lastMessage.timestamp)
│   ├── contacts.tsx           # Contacts list with "New Conversation" buttons
│   ├── chat/[id].tsx          # Chat screen (handles 1-1 and groups identically)
│   ├── settings.tsx           # User settings (read receipts toggle)
│   └── profile.tsx            # User profile
├── _layout.tsx                # Root layout
└── +not-found.tsx

components/
├── MessageBubble.tsx
├── ConversationItem.tsx
├── TypingIndicator.tsx        # Shows individual names
├── OnlineStatus.tsx
├── ImageMessage.tsx
├── FailedMessageIndicator.tsx # Error state with retry button
└── ContactItem.tsx            # Contact with "New Conversation" button

services/
├── firebase.ts                # Firebase config
├── authService.ts             # Email/password, Google, Apple auth
├── messageService.ts          # Message CRUD with auto-retry
├── presenceService.ts         # Presence management
├── syncService.ts             # Offline sync
├── notificationService.ts     # FCM handling + active conversation tracking
├── contactService.ts          # Contact import and sync
└── imageService.ts            # Image compression and upload

hooks/
├── useMessages.ts             # Message subscription (real-time listeners)
├── useConversations.ts        # Conversation list (ordered by timestamp)
├── usePresence.ts             # User presence (real-time listeners)
├── useOfflineQueue.ts         # Offline message queue with retry
├── useContacts.ts             # Contact sync and search
└── useTypingIndicator.ts      # Typing status with debounce

store/
├── AuthContext.tsx
├── MessageContext.tsx
├── OfflineContext.tsx
└── SettingsContext.tsx        # Read receipts preference
```

#### Key Libraries
```json
{
  "expo": "~50.0.0",
  "expo-router": "~3.4.0",
  "expo-sqlite": "~13.1.0",
  "expo-notifications": "~0.27.0",
  "firebase": "^10.7.0",
  "react-native-gifted-chat": "^2.4.0",
  "react-native-image-picker": "^7.1.0"
}
```

### Backend Architecture (Firebase)

#### Firestore Structure
```
users/
  {userId}/
    - firstName, lastName, displayName, email, phoneNumber, photoURL, initials
    - online, lastSeen, fcmToken
    - settings: { readReceiptsEnabled: boolean }
    
    contacts/
      {contactId}/
        - phoneNumber, name, isAppUser, appUserId, lastSynced

conversations/
  {conversationId}/  # Random UUID
    - type, participants[], lastMessage (with timestamp for ordering)
    - participantDetails (includes per-user readReceiptsEnabled)
    
    messages/
      {messageId}/
        - text, senderId, timestamp (Firestore server timestamp)
        - status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
        - type, mediaURL, localId, readBy[], deliveredTo[]
    
    typing/
      {userId}/
        - isTyping, displayName, timestamp

fcmTokens/
  {userId}/
    - tokens[] // array of device tokens

activeConversations/  # Track which users are actively viewing which conversations
  {userId}/
    - conversationId: string | null
    - lastActive: timestamp
```

#### Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions for uniqueness checks
    function emailIsUnique(email) {
      return !exists(/databases/$(database)/documents/usersByEmail/$(email));
    }
    
    function phoneIsUnique(phone) {
      return !exists(/databases/$(database)/documents/usersByPhone/$(phone));
    }
    
    // Users can read all profiles, create own with unique email/phone
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == userId 
                    && emailIsUnique(request.resource.data.email)
                    && phoneIsUnique(request.resource.data.phoneNumber);
      allow update: if request.auth.uid == userId;
    }
    
    // Email uniqueness index
    match /usersByEmail/{email} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
    
    // Phone uniqueness index
    match /usersByPhone/{phone} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
    
    // Conversation access for participants only
    match /conversations/{conversationId} {
      allow read, write: if request.auth.uid in resource.data.participants;
      
      match /messages/{messageId} {
        allow read: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
        allow create: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
      
      match /typing/{userId} {
        allow read, write: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
    }
    
    // Active conversations tracking
    match /activeConversations/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

#### Cloud Functions
1. **sendMessageNotification**: Trigger on message create, check activeConversations, send FCM only if recipient not in that conversation
2. **updateConversationMetadata**: Update lastMessage timestamp on new message (for conversation ordering)
3. **syncContactsOnUserCreate**: When new user registers, find existing users with their phone number in contacts
4. **validateUniquePhone**: Cloud Function to ensure phone number uniqueness on registration
5. **validateUniqueEmail**: Cloud Function to ensure email uniqueness on registration
6. **AI Functions** (post-MVP): Process AI agent requests

#### Firebase Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /images/{userId}/{messageId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId 
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### Real-Time Sync Strategy

#### Message Flow
1. **User sends message**:
   - Generate local message ID
   - Add to local SQLite with status "sending"
   - Show optimistically in UI
   - Upload to Firestore
   - Update status to "sent" on success
   - If offline: queue in local storage

2. **User receives message**:
   - Firestore listener fires
   - Check if message exists in SQLite (deduplicate)
   - Add to SQLite
   - Update UI
   - Send "delivered" status update
   - If conversation open: send "read" status

#### Presence Flow
1. **App foreground**:
   - Set user online = true
   - Start heartbeat (update every 30s)
   - Set onDisconnect to mark offline

2. **App background**:
   - Mark user offline after 10s grace period
   - Update lastSeen timestamp
   - Stop heartbeat

#### Conflict Resolution
- Firestore timestamp is source of truth
- Local messages have temporary IDs
- On sync: match by senderId + timestamp + text
- Duplicates: keep server version

---

## Non-Functional Requirements

### Performance
- Message delivery: < 500ms for online users
- App launch: Instant display of latest cached messages, older conversations load within 2 seconds
- Message list scroll: smooth performance (targeting 100-120 FPS on modern devices)
- Image upload: progress indicator, < 10s for 5MB

### Scalability
- Support 100 messages per conversation (MVP)
- Support 50 conversations per user (MVP)
- Group size limit: 50 users (MVP: test with 3-5)

### Reliability
- 99.9% message delivery success rate
- Zero message loss
- Graceful degradation on poor network
- Automatic reconnection with exponential backoff:
  - 1st retry: 1 second delay
  - 2nd retry: 2 seconds delay  
  - 3rd retry: 4 seconds delay
  - After 3 attempts: Mark as failed, show error indicator

### Firestore Performance Considerations
- **Traffic Ramping**: When launching, ramp up traffic gradually (500/50/5 rule)
  - Start with max 500 operations/second to new collections
  - Increase by 50% every 5 minutes
  - Ensures Firestore has time to prepare for load
- **Random UUIDs**: Using random UUIDs for conversation IDs (not sequential) to avoid write contention
- **Index Strategy**: Be mindful that timestamp indexes can cause hotspotting under high load
- **Database Location**: Choose region closest to primary user base (discuss in implementation)

### Message Pagination
- **Initial Load**: Last 100 messages from SQLite cache (instant)
- **Lazy Loading**: Load older messages in batches of 50 when user scrolls to top
- **Performance**: Limit real-time listeners to most recent 100 messages, query older messages on demand
- **Long Conversations**: For conversations with 1000+ messages, use Firestore queries with pagination rather than real-time listeners for history

### Security
- End-to-end encryption: post-MVP
- Firebase Auth for authentication
- Firestore security rules enforce authorization
- HTTPS for all API calls
- Secure token storage (AsyncStorage)

### Accessibility
- Screen reader support: post-MVP
- Minimum touch target: 44x44 points
- Sufficient color contrast (WCAG AA)
- Text scaling support

---

## Testing Strategy

### MVP Testing Scenarios (Must Pass)
1. ✅ **Real-time chat**: 2 devices, send 20 messages rapidly
2. ✅ **Offline resilience**: Send messages while offline, verify delivery on reconnect
3. ✅ **Background messages**: Receive message while app backgrounded
4. ✅ **Persistence**: Force quit app, reopen, verify message history
5. ✅ **Poor network**: Test on 3G, airplane mode, throttled connection
6. ✅ **Group chat**: 3 participants, verify message delivery to all
7. ✅ **Read receipts**: Open conversation, verify read status updates
8. ✅ **Presence**: Go offline, verify other user sees offline status
9. ✅ **Push notifications**: Background app, send message, verify notification

### Testing Tools
- **Devices**: 2+ physical iOS/Android devices
- **Network**: Charles Proxy for throttling
- **Logging**: Firebase Debug View
- **Crash reporting**: Firebase Crashlytics (post-MVP)

---

## Build Sequence (Messages First)

### Day 1 (MVP Gate): Core Messaging
**Hour 0-4**: Setup & Auth
- Initialize Expo project with Expo Router
- Set up Firebase project (Firestore, Auth, Storage)
- Implement authentication:
  - Email/password with phone number validation
  - Google Sign-In integration
  - Apple Sign-In integration
- Create registration form: email, phone, first name, last name
- Cloud Functions to enforce unique email and phone number constraints
- Generate default avatar with initials
- Create user profile on registration with settings (read receipts default on)

**Hour 4-8**: Basic Messaging & Contacts
- Request contacts permission and import phone contacts
- Create contacts list screen with "New Conversation" buttons
- Match contacts against app users by phone number
- Implement user search (within contacts by name, globally by phone)
- Create conversation list screen (ordered by lastMessage.timestamp)
- Implement chat UI (seamless for 1-1 and groups)
- User selector in top bar for adding participants
- Send text message → Firestore (with random UUID conversation ID)
- Real-time message subscription (Firestore listeners)
- Display messages with timestamps ordered by server timestamp

**Hour 8-12**: Offline & Persistence
- Set up Expo SQLite for local caching
- Implement local message caching (instant load of latest messages on launch)
- Cache conversations ordered by timestamp
- Offline message queue with auto-retry (3 attempts with exponential backoff)
- Failed message indicator with manual retry button
- Allow clearing/deleting failed messages from local view
- Sync on reconnect
- Optimistic UI updates (show message immediately, update status after send)

**Hour 12-16**: Message States, Presence & Read Receipts
- Implement delivery status tracking (sending/sent/delivered/read/failed)
- Online/offline indicators using Firestore onDisconnect()
- Read receipts with per-user setting (default on, toggle in settings)
- Privacy: users who disable read receipts don't see others' receipts
- Typing indicators with individual names display
- Debounced typing updates (500ms) to reduce Firestore writes
- Real-time listeners for all presence and typing updates

**Hour 16-20**: Group Chat, Images & Notifications
- Group conversation: seamlessly add multiple users (3+) via top bar
- Group typing indicators with individual names
- Image upload with smart compression (keep original if ≤5MB, compress if >5MB)
- Image message display inline
- FCM setup and token registration
- Track activeConversations collection (which user viewing which conversation)
- Cloud Function for smart push notifications (only send if recipient not in active conversation)
- Notification deep linking to specific conversations

**Hour 20-24**: Polish & Testing
- Run all MVP testing scenarios
- Fix critical bugs
- Deploy to Expo Go
- Demonstrate working app

### Days 2-3: Media & Enhancement
- Image upload/display
- Improved UI/UX
- Background notification handling
- Presence heartbeat optimization
- Error handling improvements

### Days 4-5: AI Layer (Post-MVP)
- Cloud Functions for AI processing
- AI agent message handling
- Integration with external AI APIs
- AI response streaming

### Days 6-7: Polish & Deployment
- Performance optimization
- Bug fixes
- TestFlight/APK distribution
- Documentation

---

## Success Metrics

### MVP Gate Metrics (24 Hours)
- ✅ All 10 MVP features functional
- ✅ Message delivery success rate > 95%
- ✅ Zero crashes during testing scenarios
- ✅ App restarts preserve message history
- ✅ All 7 testing scenarios pass
- ✅ Deployed to Expo Go (or emulator with deployed backend)

**Testing Scenario Pass Criteria**:
1. **Real-time chat (2 devices, 20+ rapid messages)**: All messages delivered in order, no duplicates, < 1 second latency
2. **Offline resilience**: Messages sent while offline are delivered when reconnected (within 10 seconds of reconnection)
3. **Background messages**: Notification received, message appears when app opened
4. **Persistence**: All messages visible after force-quit and reopen
5. **Poor network (3G throttle)**: Messages eventually delivered, no crashes, clear error states
6. **Group chat (3+ participants)**: All participants receive all messages, read receipts work correctly
7. **Read receipts**: Receipts update correctly, privacy setting works

### Week-End Goals
- Message delivery success rate: 99%+
- App launch time: < 2s (cached messages instant)
- 100% of testing scenarios passing reliably
- Deployed to TestFlight/Play Store internal testing
- Ready for AI feature scoping session

---

## Risk Mitigation

### High-Risk Areas
1. **Real-time sync complexity**: Mitigate with simple Firestore listeners, no custom sync logic
2. **Offline queue management**: Use battle-tested SQLite, clear queue logic with retry counters
3. **Push notification reliability**: Test extensively on both platforms, implement fallback to in-app notifications
4. **Time constraint**: Cut features aggressively, prioritize core messaging, follow "messages first" philosophy
5. **Firestore scaling**: Follow 500/50/5 rule for traffic ramp-up, use random UUIDs, monitor for hotspotting
6. **Network resilience**: Implement robust retry logic, clear error states, auto-reconnection

### Contingency Plans
- If group chat delayed: Ship with 1-1 only, add groups in day 2
- If media upload problematic: Ship text-only, add images day 2
- If push notifications fail: Ship with in-app notifications only
- If social auth delayed: Ship with email/password only, add social in day 2
- If contacts import problematic: Ship with manual user search by phone, add contacts day 2
- If React Native issues: Pivot to SwiftUI (iOS only) - **last resort only**
- If Firestore performance issues: Reduce real-time listener scope, increase local caching

### Monitoring & Debugging Strategy
- **Firebase Debug View**: Monitor real-time events and errors
- **Console Logging**: Comprehensive logging for message lifecycle
- **Error Tracking**: Track failed messages, retry attempts, crash scenarios
- **Network Conditions**: Test with Charles Proxy for throttling
- **Cloud Function Logs**: Monitor function execution, failures, latency

---

## ⚠️ POST-MVP FEATURE BOUNDARY ⚠️

**CRITICAL: The features listed below are for context and future planning ONLY.**  

**These features MUST NOT appear in:**
- MVP implementation plan
- MVP task lists
- MVP development work
- First week development cycle

**Post-MVP features are explicitly excluded from the 7-day timeline.**

---

## Future Enhancements (Post-MVP)

### Week 2+ Features
- Voice messages
- Video messages
- Message search
- Message reactions
- Message forwarding
- User blocking
- Group admin controls
- End-to-end encryption
- Message editing/deletion
- Link previews
- Custom emoji/stickers
- Dark mode
- Message export

### AI Agent Features (Scope TBD - Post-MVP Decision Point)
**Note**: AI features require additional scoping session after MVP completion. Decisions needed on:
- Which AI capabilities to prioritize
- Integration patterns with messaging flow
- User interaction models
- Performance and cost implications

**Potential AI capabilities** (not committed):
- Smart reply suggestions
- Message summarization
- Language translation
- Sentiment analysis
- Automated responses
- Task extraction
- Calendar integration

**AI Implementation Timeline**: To be determined after MVP gate and feature scoping session.

---

## Appendix

### Glossary
- **Conversation**: A chat thread between 2+ users
- **Optimistic UI**: Showing updates immediately before server confirmation
- **Presence**: Real-time online/offline status
- **FCM**: Firebase Cloud Messaging

### References
- Firebase Documentation: https://firebase.google.com/docs
- Expo Documentation: https://docs.expo.dev
- React Native Gifted Chat: https://github.com/FaridSafi/react-native-gifted-chat
- WhatsApp-style UI patterns: https://wa.me

### Open Questions
- AI agent interaction patterns (resolve by day 4)
- Conversation archiving strategy (resolve by day 5)
- Media retention policy (resolve by day 6)