# Push Notification Deep-Link Testing Runbook

## Purpose
Verify that tapping push notifications correctly navigates to the conversation on both iOS and Android.

## Test Scenarios

### Scenario 1: Notification Tap (App Closed)

**iOS Testing:**
1. Device A (iPhone): Completely close MessageAI app (swipe away from app switcher)
2. Device B: Send message to Device A
3. Device A: Wait for notification to appear
4. Device A: Tap notification
5. **Expected Result:**
   - App launches
   - Navigates directly to conversation with Device B
   - Message visible in chat
   - Unread badge cleared

**Android Testing:**
1. Device A (Android): Force stop MessageAI app
2. Device B: Send message to Device A
3. Device A: Wait for notification to appear
4. Device A: Tap notification
5. **Expected Result:**
   - App launches
   - Navigates directly to conversation with Device B
   - Message visible in chat
   - Notification cleared

**Pass Criteria:**
- ✅ App opens to correct conversation (not Messages list)
- ✅ Deep link data preserved
- ✅ No navigation errors
- ✅ < 2 seconds to show chat

**Logs to Capture:**
```
[Notification Service]
Sending notification with data:
{
  "conversationId": "conv123",
  "messageId": "msg456",
  "senderId": "user789"
}

[App Launch]
📱 Notification tapped: conversationId=conv123
🎯 Navigating to /chat/conv123
✅ Chat screen loaded
```

---

### Scenario 2: Notification Tap (App Backgrounded)

**iOS Testing:**
1. Device A: Open MessageAI, then home button (background)
2. Device B: Send message
3. Device A: Wait for notification
4. Device A: Tap notification
5. **Expected Result:**
   - App resumes from background
   - Navigates to conversation
   - Message visible
   - Banner dismissed

**Android Testing:**
1. Device A: Open MessageAI, then home button (background)
2. Device B: Send message
3. Device A: Wait for notification
4. Device A: Tap notification
5. **Expected Result:**
   - App resumes from background
   - Navigates to conversation
   - Message visible
   - Notification cleared

**Pass Criteria:**
- ✅ App resumes (not restarted)
- ✅ Navigation from current screen to chat
- ✅ State preserved
- ✅ Instant navigation (< 1 second)

---

### Scenario 3: Notification Tap (App Active, Different Chat)

**Both Platforms:**
1. Device A: Open conversation with User C
2. Device B: Send message to Device A
3. Device A: Wait for in-app banner OR notification
4. Device A: Tap notification/banner
5. **Expected Result:**
   - Navigate from User C's chat to Device B's chat
   - Proper back stack (can go back to User C)
   - No navigation glitches

**Pass Criteria:**
- ✅ Navigation stack correct
- ✅ Can navigate back
- ✅ No route errors
- ✅ Smooth transition

---

### Scenario 4: Multiple Notifications

**Both Platforms:**
1. Device A: Close app
2. Device B: Send 3 messages
3. Device C: Send 2 messages
4. Device A: Tap notification from Device B
5. **Expected Result:**
   - Opens Device B's chat
   - Other notifications remain (or cleared by OS)

**Pass Criteria:**
- ✅ Correct conversation opened
- ✅ All messages visible
- ✅ Notifications managed properly

---

### Scenario 5: Group Chat Notification

**Both Platforms:**
1. Device A: Close app
2. Device B: Send message in group chat (A, B, C)
3. Device A: Wait for notification
4. Device A: Tap notification
5. **Expected Result:**
   - Opens group conversation
   - Shows all participants
   - Message visible
   - Title shows all names

**Pass Criteria:**
- ✅ Group chat opened
- ✅ Correct participants shown
- ✅ Message visible
- ✅ Title formatted correctly

---

## Deep-Link Data Structure

### Expected Notification Payload:

**iOS (APNS):**
```json
{
  "aps": {
    "alert": {
      "title": "John Smith",
      "body": "Hey, are you there?"
    },
    "badge": 1,
    "sound": "default"
  },
  "conversationId": "conv_123",
  "messageId": "msg_456",
  "senderId": "user_789"
}
```

**Android (FCM):**
```json
{
  "notification": {
    "title": "John Smith",
    "body": "Hey, are you there?",
    "sound": "default"
  },
  "data": {
    "conversationId": "conv_123",
    "messageId": "msg_456",
    "senderId": "user_789"
  },
  "android": {
    "priority": "high"
  }
}
```

---

## Code Verification Checklist

### Client-Side (app/_layout.tsx):

1. **Notification Listener Registered:**
   ```typescript
   useEffect(() => {
     const responseListener = Notifications.addNotificationResponseReceivedListener(
       (response) => {
         const data = response.notification.request.content.data;
         const conversationId = data.conversationId as string;
         
         if (conversationId) {
           router.push(`/chat/${conversationId}`);
         }
       }
     );
     
     return () => responseListener.remove();
   }, []);
   ```
   - ✅ Listener active
   - ✅ Data extracted correctly
   - ✅ Navigation called

2. **Initial Notification Handling:**
   ```typescript
   useEffect(() => {
     Notifications.getLastNotificationResponseAsync()
       .then((response) => {
         if (response) {
           const data = response.notification.request.content.data;
           // Handle deep link on app launch
         }
       });
   }, []);
   ```
   - ✅ Handles cold start
   - ✅ Processes queued notification

### Server-Side (functions/src/index.ts):

1. **Notification Payload Includes Deep-Link Data:**
   ```typescript
   const message = {
     notification: {
       title: senderName,
       body: messageText || '📷 Image',
     },
     data: {
       conversationId: context.params.conversationId,
       messageId: context.params.messageId,
       senderId: messageData.senderId,
     },
     token: recipientToken,
   };
   ```
   - ✅ Data field populated
   - ✅ All required fields present

2. **Smart Delivery (No Spam):**
   ```typescript
   const activeConvSnap = await admin.firestore()
     .doc(`activeConversations/${recipientId}`)
     .get();
   
   const activeConvId = activeConvSnap.data()?.conversationId;
   
   if (activeConvId === conversationId) {
     // Skip notification - user is already viewing this chat
     return;
   }
   ```
   - ✅ Checks active conversation
   - ✅ Skips notification if already viewing

---

## Platform-Specific Quirks

### iOS:
- **Requires actual device** for testing (simulator doesn't receive remote notifications)
- **Badge counter** handled automatically by APNS
- **Notification center** persists until explicitly cleared
- **Silent notifications** require content-available flag
- **Deep link** works in both foreground and background

### Android:
- **Requires development build** (Expo Go doesn't support FCM in SDK 53+)
- **Notification channels** must be configured
- **Data-only** vs notification messages behave differently
- **Background restrictions** may delay delivery
- **Deep link** works via intent filters

### Expo Go Limitations:
- **iOS:** ✅ Works (uses Expo Push Token)
- **Android:** ❌ Doesn't work (SDK 53+ limitation)
- **Solution:** Create development build with `npx expo run:android`

---

## Troubleshooting Guide

### Issue: Notification received but tap does nothing

**Check:**
1. Listener registered? (`addNotificationResponseReceivedListener`)
2. Data field populated? (check Cloud Function logs)
3. Navigation call executed? (add console.log)
4. Route exists? (`/chat/[id].tsx`)

**Debug:**
```typescript
const responseListener = Notifications.addNotificationResponseReceivedListener(
  (response) => {
    console.log('📱 Notification Response:', JSON.stringify(response, null, 2));
    const data = response.notification.request.content.data;
    console.log('📱 Extracted Data:', data);
    
    if (data.conversationId) {
      console.log(`🎯 Navigating to: /chat/${data.conversationId}`);
      router.push(`/chat/${data.conversationId}`);
    } else {
      console.error('❌ Missing conversationId in notification data');
    }
  }
);
```

---

### Issue: App opens to Messages list instead of chat

**Possible Causes:**
1. Deep-link data missing from notification payload
2. Navigation called before router ready
3. Route parameter malformed

**Fix:**
```typescript
// Wait for router to be ready
setTimeout(() => {
  router.push(`/chat/${conversationId}`);
}, 100);
```

---

### Issue: Android notifications not received

**Check:**
1. Development build created? (not Expo Go)
2. FCM token registered? (check Firestore users/{uid}/fcmToken)
3. Notification permissions granted?
4. Cloud Function deployed?

**Verify Token:**
```typescript
const token = await Notifications.getExpoPushTokenAsync();
console.log('Push Token:', token.data);
// Should see: ExponentPushToken[xxxxxx]
```

---

### Issue: iOS notifications not received

**Check:**
1. Physical device (not simulator)?
2. Notification permissions granted?
3. App in foreground? (foreground notifications need handler)
4. APNs certificate configured in Firebase?

**Verify Permissions:**
```typescript
const { status } = await Notifications.getPermissionsAsync();
console.log('Notification Permission:', status);
// Should be: "granted"
```

---

## Documentation Template

After completing all tests:

### Test Results:

**Date:** `__________`  
**Tester:** `__________`  
**Environment:** Dev / Staging / Production

| Scenario | iOS Status | Android Status | Notes |
|----------|-----------|---------------|-------|
| 1. Tap (App Closed) | ✅ PASS / ❌ FAIL | ✅ PASS / ❌ FAIL | |
| 2. Tap (Backgrounded) | ✅ PASS / ❌ FAIL | ✅ PASS / ❌ FAIL | |
| 3. Tap (Different Chat) | ✅ PASS / ❌ FAIL | ✅ PASS / ❌ FAIL | |
| 4. Multiple Notifications | ✅ PASS / ❌ FAIL | ✅ PASS / ❌ FAIL | |
| 5. Group Chat | ✅ PASS / ❌ FAIL | ✅ PASS / ❌ FAIL | |

**iOS Screenshots:**
- [ ] Notification received
- [ ] App opened to correct chat
- [ ] Navigation stack correct

**Android Screenshots:**
- [ ] Notification received
- [ ] App opened to correct chat
- [ ] Navigation stack correct

**Logs Attached:**
- [ ] Cloud Function logs (notification sent)
- [ ] App logs (notification received, navigation executed)
- [ ] Error logs (if any failures)

**Issues Found:**
- [ ] None
- [ ] [List any issues]

**Sign-off:**
- iOS Ready: ✅ YES / ❌ NO
- Android Ready: ✅ YES / ❌ NO

