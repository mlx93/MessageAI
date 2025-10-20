# MVP Task List - Part 2 (Hours 12-28)
**Presence, Typing, Groups, Images, Push Notifications & Testing**

---

## PHASE 4: Presence & Typing (Hours 12-18)

### Hour 12-15: Presence System

#### Task 8.1: Create Presence Service
- [ ] Create file: `services/presenceService.ts`
- [ ] Import Firestore functions (doc, setDoc, onSnapshot, onDisconnect)
- [ ] Implement `setUserOnline` function
  - Set user doc: { online: true, lastSeen: new Date() }
  - Call onDisconnect(userRef).update() to set offline on disconnect
- **Acceptance**: setUserOnline function complete

#### Task 8.2: Implement Set User Offline
- [ ] In `presenceService.ts`, implement `setUserOffline` function
- [ ] Update user doc: { online: false, lastSeen: new Date() }
- **Acceptance**: setUserOffline function complete

#### Task 8.3: Implement Subscribe to User Presence
- [ ] In `presenceService.ts`, implement `subscribeToUserPresence` function
- [ ] Return onSnapshot listener on user doc
- [ ] Callback with (online: boolean, lastSeen: Date)
- **Acceptance**: subscribeToUserPresence function complete

#### Task 8.4: Integrate Presence with Auth
- [ ] Open `store/AuthContext.tsx`
- [ ] Import `setUserOnline` and `setUserOffline`
- [ ] In useEffect where auth state changes, call `setUserOnline(user.uid)` when user signs in
- [ ] In signOut function, call `setUserOffline` before signing out
- **Acceptance**: Presence updates on auth state changes

#### Task 8.5: Add Presence Indicator to Conversations List
- [ ] Open `app/(tabs)/index.tsx`
- [ ] For each conversation, subscribe to other participants' presence
- [ ] Show green dot next to avatar if user is online
- [ ] Show "last seen" timestamp if offline
- **Acceptance**: Online indicators visible in conversations list

#### Task 8.6: Add Presence Indicator to Chat Screen
- [ ] Open `app/chat/[id].tsx`
- [ ] Subscribe to other participants' presence
- [ ] Show status in header: "Online" or "Last seen 5m ago"
- [ ] Style with color: green for online, gray for offline
- **Acceptance**: Presence shown in chat header

#### Task 8.7: Test Presence on 2 Simulators
- [ ] Run app on iOS and Android simulators
- [ ] Sign in as User A on iOS
- [ ] Sign in as User B on Android
- [ ] User A should see User B as "Online"
- [ ] Background User B's app → User A should see "Last seen just now"
- [ ] Bring User B back → User A should see "Online" again
- **Acceptance**: Presence updates in real-time

#### Task 8.8: Write Presence Service Tests
- [ ] Create file: `services/__tests__/presenceService.test.ts`
- [ ] Mock Firestore onDisconnect
- [ ] Test `setUserOnline` sets online and registers disconnect handler
- [ ] Test `subscribeToUserPresence` calls callback on changes
- [ ] Run tests: `npm test`
- **Acceptance**: Presence tests pass

#### Task 8.9: Git Commit
- [ ] Run `git commit -am "Hour 12-15: Presence system complete"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

### Hour 15-18: Typing Indicators

#### Task 9.1: Create Typing Indicator Hook
- [ ] Create file: `hooks/useTypingIndicator.ts`
- [ ] Implement `useTypingIndicator` hook
  - Parameters: conversationId, userId, displayName
  - Return `startTyping` function
  - Use useRef to store timeout
  - On startTyping: update typing/{userId} doc with isTyping: true
  - Clear existing timeout, set new timeout (500ms) to set isTyping: false
- **Acceptance**: useTypingIndicator hook complete

#### Task 9.2: Create Typing Status Hook
- [ ] In `hooks/useTypingIndicator.ts`, implement `useTypingStatus` hook
- [ ] Parameters: conversationId, currentUserId
- [ ] Subscribe to typing collection via onSnapshot
- [ ] Filter out current user, only include isTyping: true
- [ ] Return array of typing user names
- [ ] Implement `getTypingText` helper:
  - 1 user: "John is typing..."
  - 2 users: "John and Sarah are typing..."
  - 3+ users: "John, Sarah, and 2 others are typing..."
- **Acceptance**: useTypingStatus hook complete

#### Task 9.3: Integrate Typing Indicator in Chat Screen
- [ ] Open `app/chat/[id].tsx`
- [ ] Import `useTypingIndicator` and `useTypingStatus` hooks
- [ ] Call `useTypingIndicator(conversationId, user.uid, userProfile.displayName)`
- [ ] Call `useTypingStatus(conversationId, user.uid)`
- [ ] Get `startTyping` and `typingText` from hooks
- **Acceptance**: Hooks integrated in chat screen

#### Task 9.4: Call startTyping on Text Input Change
- [ ] In GiftedChat component, add `onInputTextChanged` prop
- [ ] Call `startTyping()` on each text change
- [ ] This will debounce automatically via the 500ms timeout in hook
- **Acceptance**: Typing status sent on typing

#### Task 9.5: Display Typing Indicator
- [ ] Below GiftedChat component, add conditional View
- [ ] If `typingText` is not empty, show Text with typing message
- [ ] Style: light gray background, padding, italic text
- [ ] Position at bottom of chat
- **Acceptance**: Typing indicator displays below messages

#### Task 9.6: Test Typing Indicators on 2 Simulators
- [ ] Open chat between User A (iOS) and User B (Android)
- [ ] User A starts typing → User B should see "User A is typing..."
- [ ] User A stops typing → Indicator disappears after 500ms
- [ ] Both users type simultaneously → Each sees the other's indicator
- **Acceptance**: Typing indicators work in real-time

#### Task 9.7: Test Group Typing Indicators
- [ ] Create group chat with 3 users (need 3rd simulator or physical device)
- [ ] User A types → Others see "User A is typing..."
- [ ] User A and User B both type → User C sees "User A and User B are typing..."
- **Acceptance**: Group typing shows individual names

#### Task 9.8: Write Typing Indicator Tests
- [ ] Create file: `hooks/__tests__/useTypingIndicator.test.ts`
- [ ] Test startTyping updates Firestore
- [ ] Test timeout clears after 500ms
- [ ] Test getTypingText formats correctly for 1, 2, 3+ users
- [ ] Use @testing-library/react-hooks
- [ ] Run tests: `npm test`
- **Acceptance**: Typing indicator tests pass

#### Task 9.9: Git Commit
- [ ] Run `git commit -am "Hour 15-18: Typing indicators complete"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

## PHASE 5: Groups & Images (Hours 18-21)

### Hour 18-19: Group Chat Polish & Testing

#### Task 10.1: Test Add Participant Flow
- [ ] Open existing conversation between 2 users
- [ ] Tap "+ Add" button in chat screen
- [ ] Enter 3rd user's phone number
- [ ] Tap "Add Participant"
- [ ] Should see success message
- [ ] Conversation type should change to "group"
- [ ] Send message → all 3 users should receive
- **Acceptance**: Add participant works, conversation becomes group

#### Task 10.2: Update Conversation List for Groups
- [ ] Open `app/(tabs)/index.tsx`
- [ ] Verify `getConversationTitle` shows participant names for groups
- [ ] Verify `getInitials` shows 👥 emoji for groups
- [ ] Test with group conversation → should display correctly
- **Acceptance**: Groups display differently in list

#### Task 10.3: Test Group Message Delivery
- [ ] With 3 users in group chat
- [ ] User A sends message
- [ ] Verify User B receives it
- [ ] Verify User C receives it
- [ ] All messages should show sender name (via GiftedChat `renderUsernameOnMessage`)
- **Acceptance**: Group messages delivered to all participants

#### Task 10.4: Test Group Read Receipts
- [ ] User A sends message in group
- [ ] User B opens chat → message marked as read by User B
- [ ] User C opens chat → message marked as read by User C
- [ ] Verify readBy array contains both User B and User C UIDs
- **Acceptance**: Group read receipts track per-user

#### Task 10.5: Test Group Typing Indicators
- [ ] In group with 3 users
- [ ] User A types → Others see "User A is typing..."
- [ ] User B also starts typing → User C sees "User A and User B are typing..."
- **Acceptance**: Group typing shows individual names

#### Task 10.6: Git Commit
- [ ] Run `git commit -am "Hour 18-19: Group chat tested and working"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

### Hour 19-21: Image Upload

#### Task 11.1: Create Image Service
- [ ] Create file: `services/imageService.ts`
- [ ] Import ImagePicker, ImageManipulator, Firebase Storage
- [ ] Implement `pickImage` function
  - Request media library permissions
  - Launch image picker
  - Return URI or null
- **Acceptance**: pickImage function complete

#### Task 11.2: Implement Image Compression
- [ ] In `imageService.ts`, implement `compressImage` function
- [ ] Use ImageManipulator.manipulateAsync
- [ ] Resize to max width 1920px
- [ ] Compress quality 0.7, format JPEG
- [ ] Return compressed URI
- **Acceptance**: compressImage function complete

#### Task 11.3: Implement Image Upload
- [ ] In `imageService.ts`, implement `uploadImage` function
- [ ] Fetch image as blob
- [ ] Check blob size
- [ ] If > 5MB, call compressImage
- [ ] Create storage ref: `images/${conversationId}/${Date.now()}.jpg`
- [ ] Upload blob with uploadBytes
- [ ] Return download URL via getDownloadURL
- **Acceptance**: uploadImage function complete

#### Task 11.4: Update Message Service for Images
- [ ] Open `services/messageService.ts`
- [ ] Create `sendImageMessage` function
  - Similar to sendMessage but type: 'image'
  - Include mediaURL field
  - Include mediaMetadata (width, height, size, compressed)
- **Acceptance**: sendImageMessage function added

#### Task 11.5: Add Image Picker Button to Chat
- [ ] Open `app/chat/[id].tsx`
- [ ] Import image service functions
- [ ] Add image picker icon/button to chat input area
- [ ] Use GiftedChat's `renderActions` or `renderComposer` prop
- [ ] On press, call `pickImage()`, then `uploadImage()`, then `sendImageMessage()`
- [ ] Show loading indicator during upload
- **Acceptance**: Image picker button added to chat

#### Task 11.6: Handle Image Display in Chat
- [ ] GiftedChat handles image display automatically via message.image field
- [ ] Ensure message format includes `image: mediaURL` for image messages
- [ ] Verify images render inline in chat
- [ ] Tap image to view full screen (GiftedChat Lightbox feature)
- **Acceptance**: Images display in chat messages

#### Task 11.7: Test Image Upload Flow
- [ ] Open chat, tap image picker button
- [ ] Select image from simulator (drag image into simulator)
- [ ] Should show loading indicator
- [ ] Image uploads to Firebase Storage
- [ ] Image message appears in chat
- [ ] Tap image → opens full screen view
- **Acceptance**: Image upload and display works

#### Task 11.8: Test Image Compression
- [ ] Upload image larger than 5MB (use large photo)
- [ ] Verify compression occurs (check Firebase Storage file size)
- [ ] Image should be < 5MB in storage
- [ ] Quality should be acceptable
- **Acceptance**: Large images compressed before upload

#### Task 11.9: Test Image in Group Chat
- [ ] Send image in group chat
- [ ] Verify all participants receive image message
- [ ] Verify image displays for all users
- **Acceptance**: Image messaging works in groups

#### Task 11.10: Write Image Service Tests
- [ ] Create file: `services/__tests__/imageService.test.ts`
- [ ] Mock ImagePicker and ImageManipulator
- [ ] Test `pickImage` requests permissions
- [ ] Test `compressImage` reduces size
- [ ] Test `uploadImage` uploads to correct path
- [ ] Run tests: `npm test`
- **Acceptance**: Image service tests pass

#### Task 11.11: Git Commit
- [ ] Run `git commit -am "Hour 19-21: Image upload complete"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

## PHASE 6: Push Notifications (Hours 21-24)

### Hour 21-22: Notification Service Setup

#### Task 12.1: Create Notification Service
- [ ] Create file: `services/notificationService.ts`
- [ ] Import expo-notifications
- [ ] Set notification handler with setNotificationHandler
  - shouldShowAlert: true
  - shouldPlaySound: true
  - shouldSetBadge: true
- **Acceptance**: Notification service file created with handler

#### Task 12.2: Implement Register for Push
- [ ] In `notificationService.ts`, implement `registerForPushNotifications` function
- [ ] Check existing permissions with getPermissionsAsync
- [ ] Request permissions if not granted
- [ ] Get Expo push token with getExpoPushTokenAsync
- [ ] Save token to user doc in Firestore: { fcmToken: token }
- **Acceptance**: registerForPushNotifications function complete

#### Task 12.3: Implement Set Active Conversation
- [ ] In `notificationService.ts`, implement `setActiveConversation` function
- [ ] Update `activeConversations/{userId}` doc with conversationId and lastActive timestamp
- [ ] This is used by Cloud Function to avoid sending notification if user is in that chat
- **Acceptance**: setActiveConversation function complete

#### Task 12.4: Call Register on App Start
- [ ] Open `app/_layout.tsx`
- [ ] Import registerForPushNotifications
- [ ] In useEffect, call registerForPushNotifications(user.uid) when user is authenticated
- **Acceptance**: Push token registered on app start

#### Task 12.5: Call Set Active Conversation in Chat Screen
- [ ] Open `app/chat/[id].tsx`
- [ ] Import setActiveConversation
- [ ] In useEffect, call `setActiveConversation(user.uid, conversationId)` on mount
- [ ] In cleanup function, call `setActiveConversation(user.uid, null)` on unmount
- **Acceptance**: Active conversation tracked when user enters/exits chat

#### Task 12.6: Setup Notification Listener
- [ ] In `app/_layout.tsx`, add notification listener
- [ ] Use Notifications.addNotificationReceivedListener
- [ ] On notification received, extract conversationId from data
- [ ] Navigate to that conversation if not already there
- **Acceptance**: Notification tap navigates to conversation

#### Task 12.7: Test Foreground Notifications
- [ ] Open app on simulator
- [ ] Background the app (Cmd+Shift+H)
- [ ] Send message from another device
- [ ] Should see system notification appear
- [ ] Tap notification → app opens to conversation
- **Acceptance**: Foreground notifications work

#### Task 12.8: Git Commit
- [ ] Run `git commit -am "Hour 21-22: Notification service setup"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

### Hour 22-24: Cloud Functions for Smart Notifications

#### Task 13.1: Create Cloud Function
- [ ] Navigate to `functions/` directory
- [ ] Open `index.js`
- [ ] Import firebase-admin and firebase-functions
- [ ] Initialize admin SDK: `admin.initializeApp()`
- **Acceptance**: Cloud function file ready

#### Task 13.2: Implement Send Message Notification Function
- [ ] In `index.js`, create `exports.sendMessageNotification` function
- [ ] Trigger: `.document('conversations/{conversationId}/messages/{messageId}').onCreate()`
- [ ] Get message data from snap.data()
- [ ] Get conversationId from context.params
- [ ] Fetch conversation document to get participants
- [ ] Filter recipients (exclude sender)
- **Acceptance**: Function skeleton created with trigger

#### Task 13.3: Check Active Conversations
- [ ] In function, for each recipient, fetch their activeConversations doc
- [ ] Check if conversationId matches current conversation
- [ ] Create array of activeUsers (users currently in this chat)
- [ ] Create array of usersToNotify (recipients not in activeUsers)
- **Acceptance**: Active conversation check implemented

#### Task 13.4: Send FCM Notifications
- [ ] For each user in usersToNotify, fetch their user doc to get fcmToken
- [ ] Use admin.messaging().send() to send notification
- [ ] Notification payload:
  - title: Sender's display name or "New Message"
  - body: message.text
  - data: { conversationId }
- [ ] Handle errors (log but don't throw)
- **Acceptance**: FCM sending implemented

#### Task 13.5: Deploy Cloud Function
- [ ] Ensure in functions directory: `cd functions`
- [ ] Run `npm install` to verify dependencies
- [ ] Run `firebase deploy --only functions`
- [ ] Wait for deployment to complete
- [ ] Check Firebase Console → Functions to verify deployment
- **Acceptance**: Cloud Function deployed successfully

#### Task 13.6: Update Firestore Security Rules for Active Conversations
- [ ] Open Firebase Console → Firestore → Rules
- [ ] Add rule for activeConversations collection:
  ```javascript
  match /activeConversations/{userId} {
    allow read, write: if request.auth.uid == userId;
  }
  ```
- [ ] Publish rules
- **Acceptance**: Security rules updated

#### Task 13.7: Test Background Notifications
- [ ] Run app on 2 simulators
- [ ] User A opens chat with User B
- [ ] User B backgrounds their app completely
- [ ] User A sends message
- [ ] User B should receive notification
- [ ] Tap notification → opens to conversation
- **Acceptance**: Background notifications work

#### Task 13.8: Test Smart Notification Logic
- [ ] User A and User B both have chat open (same conversation)
- [ ] User A sends message
- [ ] User B should NOT receive notification (they're in the chat)
- [ ] User B exits chat
- [ ] User A sends another message
- [ ] User B should NOW receive notification
- **Acceptance**: Smart notification logic works

#### Task 13.9: Test Group Notifications
- [ ] Create group with 3 users
- [ ] User A sends message
- [ ] User B (not in chat) should get notification
- [ ] User C (not in chat) should get notification
- **Acceptance**: Group notifications delivered to all inactive users

#### Task 13.10: Write Cloud Function Tests
- [ ] Create file: `functions/test/index.test.js`
- [ ] Use firebase-functions-test
- [ ] Mock Firestore and FCM
- [ ] Test function extracts correct data
- [ ] Test function sends to correct recipients
- [ ] Run: `npm test` in functions directory
- **Acceptance**: Cloud Function tests pass

#### Task 13.11: Git Commit
- [ ] Run `git commit -am "Hour 22-24: Cloud Functions deployed"`
- [ ] Run `git push`
- **Acceptance**: Code pushed to GitHub

---

## PHASE 7: Testing & Polish (Hours 24-28)

### Hour 24-26: Comprehensive Testing

#### Task 14.1: Test Scenario 1 - Real-Time Chat
- [ ] Open app on iOS and Android simulators
- [ ] User A (iOS) and User B (Android) in same chat
- [ ] User A sends 20 messages rapidly (type and send as fast as possible)
- [ ] All 20 messages appear on User B within 2 seconds
- [ ] No duplicates, all in correct order
- [ ] Latency < 1 second per message
- [ ] **Pass Criteria**: ✅ All messages delivered, no duplicates, correct order
- **Acceptance**: Scenario 1 PASSED

#### Task 14.2: Test Scenario 2 - Offline Resilience
- [ ] User A opens chat with User B
- [ ] Turn on airplane mode on User A's device
- [ ] User A sends 3 messages
- [ ] Messages show "Offline" banner, appear in UI immediately
- [ ] Turn off airplane mode
- [ ] Within 10 seconds, all 3 messages delivered to server
- [ ] User B receives all 3 messages
- [ ] **Pass Criteria**: ✅ Messages queued offline, delivered on reconnect
- **Acceptance**: Scenario 2 PASSED

#### Task 14.3: Test Scenario 3 - Background Messages
- [ ] User A opens app
- [ ] Background the app (go to home screen)
- [ ] User B sends message to User A
- [ ] User A receives system notification
- [ ] Notification shows sender name and message preview
- [ ] Tap notification → app opens to conversation
- [ ] **Pass Criteria**: ✅ Notification received, tap opens correct chat
- **Acceptance**: Scenario 3 PASSED

#### Task 14.4: Test Scenario 4 - Force Quit Persistence
- [ ] User A opens chat, sends 5 messages
- [ ] Force quit app (swipe up in app switcher)
- [ ] Wait 10 seconds
- [ ] Reopen app
- [ ] Navigate to same conversation
- [ ] All 5 messages visible instantly (from SQLite cache)
- [ ] **Pass Criteria**: ✅ All messages persist and load instantly
- **Acceptance**: Scenario 4 PASSED

#### Task 14.5: Test Scenario 5 - Poor Network Conditions
- [ ] Enable Network Link Conditioner (macOS): Settings → Developer → Network Link Conditioner
- [ ] Set to "3G" or "Edge" profile
- [ ] User A sends message
- [ ] Message may take 3-5 seconds to deliver
- [ ] No crashes, UI remains responsive
- [ ] Message eventually delivers successfully
- [ ] Error handling shows retry if needed
- [ ] **Pass Criteria**: ✅ App handles slow network gracefully, message delivers
- **Acceptance**: Scenario 5 PASSED

#### Task 14.6: Test Scenario 6 - Rapid Fire Messages
- [ ] User A sends 20+ messages as quickly as possible (type 1 character, send, repeat)
- [ ] All messages appear in User B's chat
- [ ] All messages in correct chronological order
- [ ] Timestamps are sequential
- [ ] No messages dropped or lost
- [ ] **Pass Criteria**: ✅ All 20+ messages delivered in order
- **Acceptance**: Scenario 6 PASSED

#### Task 14.7: Test Scenario 7 - Group Chat
- [ ] Create group with 3 users (iOS, Android simulators + physical device if available)
- [ ] User A sends message
- [ ] User B receives message
- [ ] User C receives message
- [ ] All read receipts track correctly (readBy array has all user IDs)
- [ ] Typing indicators show correctly (individual names)
- [ ] **Pass Criteria**: ✅ All participants receive messages, read receipts work
- **Acceptance**: Scenario 7 PASSED

#### Task 14.8: Document Test Results
- [ ] Create file: `TEST_RESULTS.md`
- [ ] Document each scenario with:
  - Test date/time
  - Pass/Fail status
  - Screenshots if issues
  - Notes on any edge cases
- [ ] All 7 scenarios should be PASSED
- **Acceptance**: Test results documented

#### Task 14.9: Git Commit
- [ ] Run `git commit -am "Hour 24-26: All test scenarios passed"`
- [ ] Run `git push`
- **Acceptance**: Test results pushed to GitHub

---

### Hour 26-28: Polish & Final Testing

#### Task 15.1: Add Loading States
- [ ] Open all screens (login, register, chat, contacts)
- [ ] Verify loading indicators show during async operations
- [ ] Add ActivityIndicator where missing
- [ ] Test: All buttons show loading state when pressed
- **Acceptance**: Loading states added throughout app

#### Task 15.2: Improve Error Handling
- [ ] Review all try-catch blocks
- [ ] Ensure user-friendly error messages (Alert.alert)
- [ ] Log errors to console for debugging
- [ ] Test: Disconnect network mid-operation → should show clear error
- **Acceptance**: Error handling improved with user feedback

#### Task 15.3: Add Failed Message Retry UI
- [ ] Open `app/chat/[id].tsx`
- [ ] For messages with status: 'failed', show red error icon
- [ ] Add TouchableOpacity around failed messages
- [ ] On tap, show alert with "Retry" and "Delete" options
- [ ] Retry: Re-send message
- [ ] Delete: Remove from local SQLite (not Firestore since it never sent)
- **Acceptance**: Failed message UI with retry/delete works

#### Task 15.4: Polish Conversation List UI
- [ ] Add pull-to-refresh on conversation list
- [ ] Add swipe actions (iOS) or long-press menu (Android) for delete conversation (optional)
- [ ] Ensure avatars look good (circular, colored background)
- [ ] Test: List scrolls smoothly with 20+ conversations
- **Acceptance**: Conversation list polished and performant

#### Task 15.5: Polish Chat Screen UI
- [ ] Adjust GiftedChat styling (bubble colors, fonts)
- [ ] Ensure images render at good quality
- [ ] Add proper spacing and padding
- [ ] Test: Chat scrolls smoothly with 100+ messages
- **Acceptance**: Chat UI polished

#### Task 15.6: Add Read Receipts Visual Indicator
- [ ] In chat screen, show checkmarks next to message status
- [ ] Clock icon: sending
- [ ] Single gray checkmark: sent
- [ ] Double gray checkmark: delivered
- [ ] Double blue checkmark: read
- [ ] Use GiftedChat's `renderTicks` prop
- **Acceptance**: Read receipt visual indicators added

#### Task 15.7: Run Test Coverage Report
- [ ] Run `npm test -- --coverage`
- [ ] Check coverage report in terminal
- [ ] Target: 70%+ statements, 60%+ branches
- [ ] If below target, add more unit tests to critical services
- **Acceptance**: Test coverage >= 70% statements

#### Task 15.8: Performance Testing
- [ ] Test app launch time: Should show cached messages < 2 seconds
- [ ] Test message scroll: Should be 60+ FPS (smooth)
- [ ] Test with 50+ conversations: List should render quickly
- [ ] Test with 500+ messages in one chat: Should handle gracefully with pagination
- **Acceptance**: Performance meets targets

#### Task 15.9: Accessibility Check
- [ ] Enable VoiceOver (iOS) or TalkBack (Android)
- [ ] Navigate through app with screen reader
- [ ] Ensure buttons have labels
- [ ] Ensure text has minimum contrast
- [ ] Fix any accessibility issues found
- **Acceptance**: Basic accessibility working

#### Task 15.10: Final Bug Fixes
- [ ] Review all console warnings and errors
- [ ] Fix any remaining bugs found during testing
- [ ] Test edge cases:
  - Empty state screens
  - Very long messages (1000+ characters)
  - Special characters in messages (emoji, unicode)
  - Multiple rapid taps on buttons (debounce if needed)
- **Acceptance**: No critical bugs remain

#### Task 15.11: Create E2E Test Checklist
- [ ] Create file: `E2E_TEST_CHECKLIST.md`
- [ ] Document complete testing procedure:
  - Setup (2 devices/simulators)
  - User registration flow
  - Contact import and search
  - Conversation creation
  - Message sending (text and image)
  - Group chat creation
  - All 7 test scenarios
  - Expected results for each
- **Acceptance**: E2E checklist created

#### Task 15.12: Final Git Commit
- [ ] Run `git add .`
- [ ] Run `git commit -m "Hour 26-28: Polish and final testing complete - MVP READY"`
- [ ] Run `git push`
- [ ] Create Git tag: `git tag v1.0.0-mvp`
- [ ] Push tag: `git push origin v1.0.0-mvp`
- **Acceptance**: Final code pushed with version tag

---

## 🎉 MVP COMPLETION CHECKLIST

### ✅ Feature Completeness

- [ ] **One-on-one chat**: Working with real-time delivery
- [ ] **Real-time message delivery**: < 1 second latency
- [ ] **Message persistence**: SQLite cache, survives force quit
- [ ] **Optimistic UI updates**: Messages appear instantly before server confirmation
- [ ] **Online/offline status**: Real-time presence with indicators
- [ ] **Message timestamps**: Displayed and formatted correctly
- [ ] **User authentication**: Email/password + Google + Apple sign-in
- [ ] **Basic group chat**: 3+ users, add participants, proper attribution
- [ ] **Message read receipts**: Always-on, per-user tracking in groups
- [ ] **Push notifications**: Foreground and background, smart delivery

### ✅ Test Scenarios

- [ ] **Scenario 1**: Two devices real-time (20+ messages) - PASSED
- [ ] **Scenario 2**: Offline → reconnect - PASSED
- [ ] **Scenario 3**: Background messages + notifications - PASSED
- [ ] **Scenario 4**: Force quit persistence - PASSED
- [ ] **Scenario 5**: Poor network (3G) - PASSED
- [ ] **Scenario 6**: Rapid-fire 20+ messages - PASSED
- [ ] **Scenario 7**: Group chat 3+ participants - PASSED

### ✅ Code Quality

- [ ] Test coverage >= 70% statements
- [ ] All unit tests passing
- [ ] No console errors in production
- [ ] Code committed to GitHub with clear history
- [ ] README.md with setup instructions

### ✅ Deployment

- [ ] Firebase backend fully deployed (Auth, Firestore, Storage, Functions)
- [ ] Cloud Functions deployed and working
- [ ] App running on iOS Simulator
- [ ] App running on Android Emulator
- [ ] Ready for physical device testing (optional: TestFlight/APK)

### ✅ Documentation

- [ ] Implementation plan followed
- [ ] Test results documented
- [ ] E2E test checklist created
- [ ] Known issues documented (if any)

---

## 🚀 Next Steps (Post-MVP)

1. **Physical Device Testing**: Deploy to TestFlight (iOS) and generate APK (Android) for real device testing
2. **Performance Optimization**: Optimize large conversation loading, implement pagination
3. **AI Features**: Begin scoping AI agent capabilities (smart replies, summarization, etc.)
4. **Enhanced Features**: Add features from post-MVP list (voice messages, message editing, etc.)
5. **Production Deployment**: Prepare for App Store and Google Play submission

---

## ✅ MVP COMPLETE!

**Congratulations! You've built a production-ready WhatsApp-style messaging app with:**
- Rock-solid real-time messaging infrastructure
- Comprehensive offline support with retry logic
- Full user authentication with social sign-in
- Contact-based user discovery
- Seamless group chat functionality
- Image sharing with smart compression
- Intelligent push notifications
- 70%+ test coverage
- All 7 testing scenarios passing

**The foundation is solid. Time to ship! 🎉**