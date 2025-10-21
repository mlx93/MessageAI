# Core Features & MVP Scope

**Last Updated:** October 20, 2024

---

## 🎯 MVP Definition

MessageAI MVP focuses on **10 core messaging features** to create a functional WhatsApp-style messaging application. AI agent features and advanced functionality are explicitly excluded from this initial phase.

**Development Timeline:** 24 hours  
**Current Progress:** Hour 3 (Authentication Complete ✅)

---

## ✅ Core Features (Included in MVP)

### **1. Email/Password Authentication** ✅
**Priority:** Critical  
**Hours:** 1-2 (COMPLETE)

**Features:**
- ✅ User registration with email validation
- ✅ Login with email/password
- ✅ Secure password requirements (min 6 characters)
- ✅ Error handling (invalid credentials, user exists)
- ✅ Automatic session persistence
- ✅ Logout functionality

**Implementation:**
- ✅ Firebase Authentication
- ✅ User document creation in Firestore
- ✅ Profile setup (name, phone number)
- ✅ Phone normalization to E.164 format
- ✅ Email/phone uniqueness enforcement

**Testing:**
- ✅ Register new user
- ✅ Login with valid/invalid credentials
- ✅ Session persistence across app restarts

---

### **2. Google Sign-In** ✅
**Priority:** High  
**Hours:** 2-3 (COMPLETE)

**Features:**
- ✅ One-tap Google authentication
- ✅ OAuth 2.0 integration
- ✅ Automatic profile import (name, email, photo)
- ✅ New user account creation
- ✅ Existing user login
- ✅ Phone collection modal when needed

**Implementation:**
- ✅ expo-auth-session
- ✅ Google OAuth client configuration
- ✅ Firebase credential exchange
- ✅ PhonePromptModal component

**Testing:**
- ✅ Sign in with Google account
- ✅ Profile data correctly imported
- ✅ Phone modal appears when needed
- ✅ Subsequent logins work seamlessly

---

### **3. Apple Sign-In** ✅
**Priority:** High (Required for iOS App Store)  
**Hours:** 2-3 (COMPLETE)

**Features:**
- ✅ Native Apple authentication
- ✅ Privacy-preserving email options
- ✅ Automatic profile setup
- ✅ iOS biometric integration
- ✅ Phone collection when needed

**Implementation:**
- ✅ expo-apple-authentication
- ✅ Apple Sign-In configuration
- ✅ Firebase credential exchange
- ✅ PhonePromptModal integration

**Testing:**
- ✅ Sign in with Apple ID (manual test on iOS)
- ⚠️ iOS device required for full testing
- ✅ Privacy options respected

---

### **4. Contacts Management**
**Priority:** Critical  
**Hours:** 4-6

**Features:**
- Import device contacts
- Phone number normalization (E.164 format)
- Match contacts with registered users
- Display matched users for messaging
- Permission handling
- Contact sync

**Implementation:**
- expo-contacts API
- Phone number E.164 conversion utility
- Firestore query by phone number
- usersByPhone index collection lookup

**Testing:**
- Import contacts from device
- Correctly identify registered users
- Handle various phone number formats

---

### **5. Direct Messaging (1-on-1)**
**Priority:** Critical  
**Hours:** 6-10

**Features:**
- Create direct conversation
- Send text messages
- Display message history
- Real-time message updates
- Message timestamps
- Sender/recipient identification
- Offline message queuing

**Implementation:**
- Firestore conversations collection
- Firestore messages subcollection
- Real-time listeners (onSnapshot)
- SQLite offline queue
- react-native-gifted-chat UI

**Testing:**
- Start conversation with contact
- Send and receive messages
- Messages sync in real-time
- Offline messages send when reconnected

---

### **6. Group Messaging**
**Priority:** High  
**Hours:** 8-10

**Features:**
- Create group with multiple participants
- Group name and photo
- Add/remove participants
- Admin management
- Group message history
- Real-time updates for all participants

**Implementation:**
- Conversation document with type: 'group'
- participantIds array
- adminIds for permissions
- Same messages subcollection as direct chat

**Testing:**
- Create group with 3+ participants
- All members receive messages
- Add/remove participants
- Admin permissions work correctly

---

### **7. Media Sharing (Images)**
**Priority:** High  
**Hours:** 10-12

**Features:**
- Select image from gallery
- Take photo with camera
- Image compression before upload
- Upload to Cloud Storage
- Display images in chat
- Download and view images
- Loading states

**Implementation:**
- expo-image-picker
- expo-image-manipulator (compression)
- Cloud Storage upload
- Message with mediaUrl field
- Image viewer component

**Testing:**
- Send image from gallery
- Take and send photo
- Images display correctly
- Works offline (queue upload)

---

### **8. Read Receipts (Always-On)**
**Priority:** Medium  
**Hours:** 12-14

**Features:**
- Single checkmark: Message sent
- Double checkmark: Message delivered
- Blue checkmarks: Message read
- Read receipt per message
- Real-time read status updates
- No privacy toggle (always on for MVP)

**Implementation:**
- Message deliveryStatus field
- Message readBy array
- Update on message view
- Checkmark icons in message bubble

**Testing:**
- Send message, verify checkmarks
- Recipient reads message
- Checkmarks turn blue
- Works in groups (multiple recipients)

---

### **9. Typing Indicators**
**Priority:** Medium  
**Hours:** 14-15

**Features:**
- "User is typing..." display
- Real-time updates
- Multiple users typing (groups)
- Automatic timeout after 3 seconds

**Implementation:**
- Firestore typing indicators collection
- Temporary documents (auto-delete)
- Real-time listener
- Debounced input handler

**Testing:**
- Start typing, indicator appears
- Stop typing, indicator disappears
- Works in groups
- Performance acceptable

---

### **10. Push Notifications**
**Priority:** High  
**Hours:** 16-20

**Features:**
- Notification on new message
- Show sender name and message preview
- Tap notification to open chat
- Badge count update
- Sound and vibration
- Silent when app is open

**Implementation:**
- expo-notifications
- FCM configuration
- Cloud Function to send notifications
- Notification permissions
- Device token registration

**Testing:**
- Receive notification when app closed
- Receive notification when app backgrounded
- Tap opens correct conversation
- No notification when chat is open

---

## ❌ Excluded Features (Post-MVP)

### **AI Agent Features**
Saved for Phase 2 after core messaging is stable:
- AI conversation partners
- Message generation
- Automated responses
- Context-aware suggestions
- AI profile customization

### **Voice Messages**
- Record audio
- Play audio in chat
- Audio waveform visualization

### **Video Calls**
- Video calling
- Screen sharing
- Video messaging

### **Advanced Features**
- Message reactions (emoji)
- Message forwarding
- Message search
- Story/Status updates
- Disappearing messages
- Message edit/delete
- Chat backup and restore
- Multi-device sync
- Web app

### **Security**
- End-to-end encryption (basic security only in MVP)
- Message verification
- Two-factor authentication

### **Customization**
- Chat themes
- Custom wallpapers
- Font size adjustment
- Notification customization

---

## 📅 Implementation Timeline

### **Hour 0-1: Setup** ✅ COMPLETE
- ✅ Expo project creation
- ✅ Firebase configuration
- ✅ Testing setup
- ✅ Git repository

### **Hour 1-2: Email/Password Auth** ✅ COMPLETE
- ✅ Create auth types
- ✅ Implement auth service
- ✅ Build login/register screens
- ✅ Phone normalization
- ✅ Uniqueness enforcement
- ✅ Auth context and routing

### **Hour 2-3: Social Auth** ✅ COMPLETE
- ✅ Google Sign-In implementation
- ✅ Apple Sign-In implementation
- ✅ Phone collection modal
- ✅ OAuth integration
- ✅ Test authentication flows

### **Hour 3-4: Contacts** ⏳ NEXT
- Import device contacts
- Match users by phone
- Search by phone number
- Contacts screen UI

### **Hour 4-8: Conversations**
- Contact import and matching
- User search by phone
- Conversation creation (direct)
- Conversation list screen
- Group creation

### **Hour 8-12: Messaging Core**
- Message service
- Chat screen with Gifted Chat
- Send text messages
- Real-time message updates
- Message history

### **Hour 12-16: Media & Real-time Features**
- Image upload and sharing
- Read receipts implementation
- Typing indicators
- Offline message queue

### **Hour 16-20: Notifications**
- Push notification setup
- Cloud Function for FCM
- Notification permissions
- Test delivery

### **Hour 20-24: Polish & Testing**
- Bug fixes
- UI polish
- Performance optimization
- End-to-end testing
- Documentation

---

## 🧪 Testing Scenarios

### **Scenario 1: New User Registration**
1. User opens app
2. Taps "Register"
3. Enters email, password, name, phone
4. Account created
5. Redirected to contacts screen

**Success Criteria:**
- Account created in Firebase Auth
- User document in Firestore
- Index documents created
- No duplicate email/phone

---

### **Scenario 2: Contact Discovery**
1. User grants contact permissions
2. App imports device contacts
3. Phone numbers normalized to E.164
4. Matches against registered users
5. Displays list of available contacts

**Success Criteria:**
- All contacts imported
- Registered users identified correctly
- Various phone formats handled

---

### **Scenario 3: Direct Conversation**
1. User taps on contact
2. Conversation created (or loaded)
3. User sends text message
4. Message appears instantly
5. Recipient receives in real-time

**Success Criteria:**
- Conversation document created
- Message sent to Firestore
- Real-time sync works
- Timestamps correct

---

### **Scenario 4: Group Chat**
1. User creates group
2. Adds 3+ participants
3. Sets group name
4. Sends message to group
5. All participants receive

**Success Criteria:**
- Group conversation created
- All participants added
- Messages broadcast correctly
- Participant list accurate

---

### **Scenario 5: Image Sharing**
1. User taps image icon
2. Selects photo from gallery
3. Image compressed
4. Upload to Cloud Storage
5. Message with image sent
6. Recipient sees image

**Success Criteria:**
- Image uploaded successfully
- Message contains mediaUrl
- Image displays in chat
- Compression reduces file size

---

### **Scenario 6: Read Receipts**
1. User A sends message to User B
2. Single checkmark (sent)
3. User B receives message
4. Double checkmark (delivered)
5. User B reads message
6. Blue checkmarks (read)

**Success Criteria:**
- Checkmarks update correctly
- Read status syncs in real-time
- Works in groups

---

### **Scenario 7: Push Notifications**
1. User A sends message
2. User B's app is closed
3. Notification received on User B's device
4. Shows sender and preview
5. User B taps notification
6. App opens to conversation

**Success Criteria:**
- Notification delivered
- Content accurate
- Deep link works
- Badge count updates

---

## 📊 Success Metrics

### **Functionality**
- ✅ All 10 features implemented
- ✅ All 7 test scenarios pass
- ✅ No critical bugs

### **Performance**
- Message send latency < 500ms
- App launch time < 3 seconds
- Smooth scrolling (60 FPS)

### **Reliability**
- Offline queue works
- No data loss
- Retry logic successful

---

## 📚 Documentation References

- **Full Requirements:** `docs/messaging_app_prd.md`
- **Implementation Plan:** `docs/mvp_implementation_plan.md`
- **Task Breakdown:** `docs/mvp_task_list_part1.md` & `part2.md`
- **Architecture:** `docs/architecture.md`
- **Decisions Log:** `docs/MVP_DECISIONS.md`

---

**Next Step:** Begin contact management implementation (Hour 3-4)

**Last Updated:** October 21, 2025

