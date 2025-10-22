# Push Notification Testing Guide

**Created:** October 22, 2025  
**Status:** Ready to Test  
**Features:** Unread counts, In-app banners, Background notifications, Offline catch-up

---

## 🎉 Implementation Complete!

All 4 notification scenarios have been implemented:

✅ **Scenario 1:** In-app banner when message arrives in different chat  
✅ **Scenario 2:** Local notification when app is backgrounded  
✅ **Scenario 3:** Offline catch-up notification on reconnect  
✅ **Scenario 4:** Unread dot indicators with count badges

---

## 📝 What Was Implemented

### 1. Type System Updates
- **File:** `types/index.ts`
- **Change:** Added `unreadCounts?: { [userId: string]: number }` to `Conversation` interface

### 2. Unread Count Tracking
- **File:** `services/conversationService.ts`
- **Functions Added:**
  - `resetUnreadCount(conversationId, userId)` - Reset count when opening chat
  - `getUnreadCount(conversationId, userId)` - Get current unread count

### 3. Cloud Function
- **File:** `functions/src/index.ts`
- **Function:** `onMessageCreate` - Automatically increments unread counts for recipients
- **Status:** ✅ Deployed to Firebase
- **Triggers:** On every new message in any conversation

### 4. In-App Notification Banner
- **File:** `components/InAppNotificationBanner.tsx`
- **Features:**
  - Slides down from top with spring animation
  - Shows sender avatar, name, and message preview
  - Auto-dismisses after 5 seconds
  - Tap to navigate to conversation
  - Swipe up to dismiss

### 5. Global Message Listener
- **File:** `services/globalMessageListener.ts`
- **Features:**
  - Subscribes to ALL user conversations
  - Detects new messages in real-time
  - Determines notification type based on app state
  - Tracks active conversation to prevent duplicate notifications
  - Handles offline timestamp tracking

### 6. UI Updates
- **File:** `app/(tabs)/index.tsx`
- **Features:**
  - Red badge with count on avatar (top-right corner)
  - Blue dot indicator on right side
  - Reads from `unreadCounts` field
  - Updates in real-time

### 7. Chat Screen Updates
- **File:** `app/chat/[id].tsx`
- **Features:**
  - Resets unread count on open
  - Tracks active conversation (dual tracking: Firestore + local)
  - Integrated with global message listener

### 8. App Layout Integration
- **File:** `app/_layout.tsx`
- **Features:**
  - Global message listener subscription
  - In-app notification banner component
  - Offline timestamp tracking
  - Network state monitoring

### 9. Notification Service
- **File:** `services/notificationService.ts`
- **Function:** `scheduleLocalNotification()` - Enhanced for background notifications

---

## 🧪 Testing Scenarios

### Prerequisites
1. Two test accounts with phone numbers:
   - **Account A:** Primary test account
   - **Account B:** Secondary test account
2. Two devices or simulators:
   - **Device 1:** iPhone Simulator or real iPhone
   - **Device 2:** Android Emulator or real Android device
3. Firebase Emulator (optional, for local testing)

---

### Test Scenario 1: In-App Banner (Different Chat)

**Goal:** Verify banner appears when message arrives in non-active chat

**Steps:**
1. **Device 1 (Account A):**
   - Login and open Messages tab
   - Navigate to Chat with User B
   
2. **Device 2 (Account B):**
   - Login and open Messages tab
   - Navigate to Chat with User C (NOT User A)
   
3. **Device 1 (Account A):**
   - Send message: "Hey, are you there?"
   
4. **Device 2 (Account B):**
   - **Expected:** Banner slides down from top showing:
     - User A's avatar with initials
     - "User A"
     - "Hey, are you there?"
   - Banner auto-dismisses after 5 seconds
   
5. **Device 2 (Account B):**
   - Tap banner before it dismisses
   - **Expected:** Navigate to Chat with User A, message visible

**Success Criteria:**
- ✅ Banner appears within 1 second of message send
- ✅ Banner shows correct sender name and message
- ✅ Banner auto-dismisses after 5 seconds
- ✅ Tapping banner navigates to correct chat
- ✅ No banner if already viewing Chat with User A

**Console Logs to Watch:**
```
🔔 Setting up global message listener
📬 New message in {conversationId} from User A, app state: active, active: {otherConversationId}
📬 Message in different chat - showing in-app banner
```

---

### Test Scenario 2: Background Notification

**Goal:** Verify local notification appears when app is backgrounded

**Steps:**
1. **Device 2 (Account B):**
   - Login and open Messages tab
   - Press Home button to background app (don't force quit)
   
2. **Device 1 (Account A):**
   - Send message to User B: "Testing background notifications"
   
3. **Device 2 (Account B):**
   - **Expected:** OS notification appears on lock screen/notification center:
     - Title: "User A"
     - Body: "Testing background notifications"
   
4. **Device 2 (Account B):**
   - Tap notification
   - **Expected:** App opens directly to Chat with User A

**Success Criteria:**
- ✅ Notification appears within 2 seconds
- ✅ Notification shows correct sender and message
- ✅ Tapping notification opens app to correct chat
- ✅ Works on both iOS and Android

**Console Logs to Watch:**
```
📬 New message in {conversationId} from User A, app state: background, active: null
📬 App backgrounded - showing local notification
📬 Local notification scheduled: User A
```

**Note:** This uses local notifications, not remote FCM push. Works in Expo Go!

---

### Test Scenario 3: Offline Catch-Up

**Goal:** Verify catch-up notification when reconnecting after offline period

**Steps:**
1. **Device 2 (Account B):**
   - Login and open Messages tab
   - Enable Airplane Mode
   
2. **Device 1 (Account A):**
   - Send 3 messages to User B:
     - "Message 1"
     - "Message 2"
     - "Message 3"
   
3. **Device 1 (Account A):**
   - Also send 2 messages in a different chat with User B (if available)
   
4. **Device 2 (Account B):**
   - Wait 10 seconds
   - Disable Airplane Mode
   - **Expected:** Alert appears: "Back Online - X messages sent successfully"
   - **Expected:** All 5 messages appear in their respective chats

**Success Criteria:**
- ✅ Reconnection alert shows correct count
- ✅ All messages received
- ✅ Unread counts updated correctly

**Console Logs to Watch:**
```
📴 Marked user as offline for catch-up notifications
🌐 Reconnected - processing queue...
📊 Checking new messages since {timestamp}
```

**Current Limitation:** Offline catch-up notification doesn't show detailed breakdown. This can be enhanced in future iterations.

---

### Test Scenario 4: Unread Indicators

**Goal:** Verify unread count badges and dots appear correctly

**Steps:**
1. **Device 2 (Account B):**
   - Login and open Messages tab
   - Stay on Messages tab (don't open any chats)
   
2. **Device 1 (Account A):**
   - Send 3 messages to User B in Chat 1
   - Send 5 messages to User B in Chat 2 (if available)
   
3. **Device 2 (Account B):**
   - **Expected:** Conversations list shows:
     - **Chat 1:** Red badge "3" on avatar, blue dot on right
     - **Chat 2:** Red badge "5" on avatar, blue dot on right
   
4. **Device 2 (Account B):**
   - Tap to open Chat 1
   - **Expected:** Badge and dot disappear immediately
   
5. **Device 2 (Account B):**
   - Navigate back to Messages tab
   - **Expected:** Chat 1 has no badge/dot, Chat 2 still has badge "5" and blue dot
   
6. **Device 2 (Account B):**
   - Open Chat 2
   - **Expected:** Badge and dot disappear

**Success Criteria:**
- ✅ Badge shows correct count (up to 99+)
- ✅ Blue dot appears when unread > 0
- ✅ Badge positioned on avatar (top-right corner)
- ✅ Badge disappears when opening chat
- ✅ Real-time updates (no refresh needed)

**Console Logs to Watch:**
```
✅ Incremented unread counts for X recipients in {conversationId}
✅ Reset unread count for user {userId} in conversation {conversationId}
```

---

## 🔍 Advanced Testing

### Test 5: Unread Count Persistence

**Goal:** Verify unread counts survive app restart

**Steps:**
1. Receive 5 messages while app is closed
2. Force-quit app
3. Reopen app
4. **Expected:** Conversations show correct unread counts

**Success Criteria:**
- ✅ Counts persist across app restarts
- ✅ Counts sync from Firestore on app open

---

### Test 6: Multiple Conversations

**Goal:** Verify unread counts work correctly with multiple chats

**Steps:**
1. Have 3-4 active conversations
2. Receive messages in different chats while viewing another chat
3. **Expected:** Each conversation shows correct individual unread count
4. Open each chat one by one
5. **Expected:** Count resets only for opened chat

**Success Criteria:**
- ✅ Independent counts per conversation
- ✅ No cross-contamination
- ✅ All counts accurate

---

### Test 7: Group Chats

**Goal:** Verify unread counts work in group conversations

**Steps:**
1. Create group chat with 3+ users
2. User A sends 5 messages
3. User B (recipient) views Messages tab
4. **Expected:** Group chat shows badge "5"
5. User C (different recipient) also checks
6. **Expected:** Group chat shows badge "5" for User C too

**Success Criteria:**
- ✅ Each user has independent unread count
- ✅ Counts update correctly for all participants

---

### Test 8: Edge Cases

#### 8a: Send Message to Yourself
1. Send message to own conversation
2. **Expected:** No notification, no unread count increment

#### 8b: Rapid Message Burst
1. Send 20 messages quickly (< 5 seconds)
2. **Expected:** All messages counted, badge shows "20" or "20+"

#### 8c: Banner Queue
1. Receive messages from 3 different chats within 5 seconds
2. **Expected:** Banners queue and show one at a time

#### 8d: Network Flapping
1. Toggle airplane mode on/off rapidly
2. **Expected:** No duplicate notifications

---

## 🐛 Debugging

### Console Logs

**Global Message Listener:**
```
🔔 Setting up global message listener for user {userId}
📬 New message in {conversationId} from {senderName}
📬 Message is in active chat - no notification needed
📬 Message in different chat - showing in-app banner
📬 App backgrounded - showing local notification
🔕 Stopping global message listener for user {userId}
```

**Unread Counts:**
```
✅ Reset unread count for user {userId} in conversation {conversationId}
✅ Incremented unread counts for X recipients in {conversationId}
```

**Cloud Function:**
```
✅ Incremented unread counts for 2 recipients in {conversationId}
```

### Firebase Console

**Check Firestore:**
1. Open Firebase Console → Firestore Database
2. Navigate to `conversations/{conversationId}`
3. Check `unreadCounts` field:
   ```json
   {
     "unreadCounts": {
       "user1_uid": 3,
       "user2_uid": 0
     }
   }
   ```

**Check Cloud Functions:**
1. Open Firebase Console → Functions
2. Find `onMessageCreate` function
3. Check Logs tab for execution logs

### Common Issues

#### Banner Not Appearing
- **Check:** Is global message listener running?
  - Look for `🔔 Setting up global message listener`
- **Check:** Is active conversation set correctly?
  - Open chat, check console for `Set this conversation as active locally`
- **Check:** Is app in foreground?
  - AppState should be `active`

#### Background Notification Not Showing
- **iOS:** Notifications should work in Expo Go
- **Android:** May not work in Expo Go (use dev build or wait for production)
- **Check:** Is app truly backgrounded? (not force-quit)
- **Check:** Notification permissions granted?

#### Unread Count Not Updating
- **Check:** Is Cloud Function deployed?
  - Run: `firebase deploy --only functions:onMessageCreate`
- **Check:** Cloud Function logs for errors
- **Check:** Firestore rules allow writes to `unreadCounts`

#### Unread Count Not Resetting
- **Check:** Is `resetUnreadCount()` being called?
  - Look for `Reset unread count for user` in console
- **Check:** Firestore rules allow updates to `unreadCounts.{userId}`

---

## 📊 Test Results Template

Use this template to document your test results:

```markdown
### Test Run: [Date/Time]
**Tester:** [Your Name]
**Devices:** iPhone Simulator + Android Emulator
**Firebase Project:** messageai-mlx93

#### Scenario 1: In-App Banner
- [ ] Banner appeared within 1 second: ✅/❌
- [ ] Correct sender name displayed: ✅/❌
- [ ] Correct message preview: ✅/❌
- [ ] Auto-dismiss after 5 seconds: ✅/❌
- [ ] Navigation on tap: ✅/❌
- **Notes:** 

#### Scenario 2: Background Notification
- [ ] Notification appeared: ✅/❌
- [ ] Correct title and body: ✅/❌
- [ ] Navigation on tap: ✅/❌
- [ ] Works on iOS: ✅/❌
- [ ] Works on Android: ✅/❌
- **Notes:**

#### Scenario 3: Offline Catch-Up
- [ ] Offline tracking: ✅/❌
- [ ] Reconnection alert: ✅/❌
- [ ] All messages received: ✅/❌
- **Notes:**

#### Scenario 4: Unread Indicators
- [ ] Red badge shows correct count: ✅/❌
- [ ] Blue dot appears: ✅/❌
- [ ] Badge disappears on open: ✅/❌
- [ ] Real-time updates: ✅/❌
- **Notes:**

#### Overall Status: ✅/⚠️/❌
**Issues Found:** [List any bugs]
**Next Steps:** [What needs fixing]
```

---

## ✅ Implementation Checklist

- [x] Add `unreadCounts` field to Conversation type
- [x] Create `resetUnreadCount()` function
- [x] Create `getUnreadCount()` function
- [x] Create Cloud Function `onMessageCreate`
- [x] Deploy Cloud Function to Firebase
- [x] Create `InAppNotificationBanner` component
- [x] Create `globalMessageListener` service
- [x] Integrate banner into app layout
- [x] Add unread badges to conversations list
- [x] Add blue dot indicators
- [x] Update chat screen to reset counts
- [x] Add offline tracking
- [x] Enhance `scheduleLocalNotification()`
- [ ] Test all 4 scenarios
- [ ] Document test results
- [ ] Fix any bugs found
- [ ] Update memory bank

---

## 🚀 Next Steps

After testing is complete:

1. **Fix Bugs:** Address any issues found during testing
2. **Update Documentation:** Document final state in memory bank
3. **Commit Changes:** Git commit with descriptive message
4. **Optional Enhancements:**
   - Add offline catch-up detailed breakdown
   - Add notification sound customization
   - Add notification vibration patterns
   - Add "Mark all as read" feature
   - Add notification settings screen

---

## 📝 Notes

### Why Local Notifications?
- ✅ Work on both iOS and Android without dev build
- ✅ No Expo Go limitations (iOS works perfectly)
- ✅ Same UX as remote push when app is backgrounded
- ✅ Simpler to implement than FCM
- ❌ Don't work when app is force-quit (acceptable for MVP)

### Future: Remote Push Notifications
When ready for production:
1. Create EAS development build
2. Enable FCM in Firebase Console
3. Update Cloud Function to send remote pushes
4. Test on real devices
5. Submit to App Store

### Architecture Benefits
- **Scalable:** Global listener handles all conversations
- **Efficient:** Only subscribes to latest message per conversation
- **Smart:** Prevents duplicate notifications
- **Flexible:** Easy to add new notification types

---

**Status:** Ready for Testing 🧪  
**Next:** Run all test scenarios and document results

