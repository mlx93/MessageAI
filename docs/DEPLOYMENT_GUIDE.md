# MessageAI MVP - Deployment Guide

**Last Updated:** October 21, 2025  
**MVP Version:** 1.0.0  
**Status:** Ready for Testing

---

## 🚀 Quick Start Deployment

### 1. Deploy Cloud Functions

```bash
# Navigate to functions directory
cd /Users/mylessjs/Desktop/MessageAI/functions

# Install dependencies (if needed)
npm install

# Deploy to Firebase
firebase deploy --only functions

# Expected output:
# ✔  functions[sendMessageNotification(us-central1)]: Successful create operation.
# ✔  functions[cleanupTypingIndicators(us-central1)]: Successful create operation.
```

**Verify Deployment:**
- Open Firebase Console → Functions
- You should see 2 functions listed:
  - `sendMessageNotification` (Firestore trigger)
  - `cleanupTypingIndicators` (Scheduled)

---

### 2. Update Firestore Security Rules

**Add these rules to your Firestore security rules:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ... existing rules ...
    
    // Active conversations for smart notifications
    match /activeConversations/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Typing indicators
    match /conversations/{conversationId}/typing/{userId} {
      allow read: if request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

**Deploy Rules:**
```bash
firebase deploy --only firestore:rules
```

---

### 3. Update Firebase Storage Rules

**Ensure images can be uploaded:**

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Allow authenticated users to upload images
    match /images/{conversationId}/{imageFile} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
                   && request.resource.size < 10 * 1024 * 1024  // 10MB limit
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

**Deploy Storage Rules:**
```bash
firebase deploy --only storage
```

---

## 📱 Test the App

### Start Expo Development Server

```bash
# From project root
cd /Users/mylessjs/Desktop/MessageAI

# Start Expo
npm start
```

### Test on iOS Simulator

```bash
# In the Expo terminal, press 'i'
# Or run:
npm run ios
```

### Test on Android Emulator

```bash
# Make sure Android emulator is running
# In the Expo terminal, press 'a'
# Or run:
npm run android
```

---

## 🧪 Manual Testing Checklist

### Test 1: Presence System

1. **Setup:**
   - Open app on iOS simulator (User A)
   - Open app on Android emulator (User B)
   - Both users logged in

2. **Test:**
   - User A should see User B as "Online" with green dot
   - User B backgrounds app
   - User A should see "Last seen just now"
   - User B returns
   - User A should see green dot again

### Test 2: Typing Indicators

1. **Setup:**
   - User A and User B in same conversation

2. **Test:**
   - User A types
   - User B sees "User A is typing..."
   - User A stops typing
   - Indicator disappears after 500ms

### Test 3: Image Upload

1. **Setup:**
   - User A in any conversation

2. **Test:**
   - Tap 📷 button
   - Select image from photos
   - Loading spinner appears
   - Image uploads and displays at 200x200
   - Message sent with "📷 Image" preview

3. **Compression Test:**
   - Upload image larger than 5MB
   - Check Firebase Storage console
   - Verify file size is reduced

### Test 4: Push Notifications

1. **Setup:**
   - User B has app open but not in conversation
   - User A sends message to User B

2. **Test:**
   - User B should receive notification
   - Tap notification
   - Opens to correct conversation

3. **Smart Delivery Test:**
   - User B opens conversation with User A
   - User A sends message
   - User B should NOT receive notification (already viewing)
   - User B exits conversation
   - User A sends message
   - User B receives notification

### Test 5: Group Notifications

1. **Setup:**
   - Create group with 3 users (A, B, C)

2. **Test:**
   - User A sends message
   - User B (backgrounded) receives notification
   - User C (backgrounded) receives notification
   - Notification title shows group context

---

## 🔍 Verify Cloud Functions

### Check Function Logs

```bash
# View live logs
firebase functions:log

# Or in Firebase Console:
# Functions → Select function → Logs tab
```

### Test Notification Function

1. Send a message in the app
2. Check logs for:
   ```
   New message {messageId} in conversation {conversationId}
   Recipients: user2, user3
   Users to notify: user2, user3
   Sending notification to user2: Alice
   Notification 1 sent successfully
   ```

### Test Cleanup Function

- Runs automatically every 5 minutes
- Check logs after 5-10 minutes
- Should see: `Cleaned up X old typing indicators`

---

## ⚠️ Troubleshooting

### Cloud Functions Not Deploying

```bash
# Check Firebase login
firebase login

# Check project
firebase use

# Try deploying with debug flag
firebase deploy --only functions --debug
```

### Notifications Not Working

1. **Check FCM Token:**
   ```typescript
   // In app logs, look for:
   "Push token: ExponentPushToken[...]"
   ```

2. **Check Firestore:**
   - User document should have `fcmToken` field
   - `activeConversations` document should exist when viewing chat

3. **Check Cloud Function Logs:**
   - Should see "Sending notification to..."
   - If errors, check token validity

### Images Not Uploading

1. **Check Storage Rules:**
   - Ensure authenticated users can write to `images/`

2. **Check File Size:**
   - Max 10MB (after compression)

3. **Check Permissions:**
   - App should request photo library permissions

### Presence Not Updating

1. **Check Firestore:**
   - User document should have `online` and `lastSeen` fields

2. **Check Auth:**
   - Ensure `setUserOnline()` is called after login
   - Check AuthContext for presence service imports

---

## 📊 Monitor Performance

### Firebase Console

1. **Firestore:**
   - Monitor read/write operations
   - Check for index creation needs

2. **Cloud Functions:**
   - Monitor invocations
   - Check execution time
   - Watch for errors

3. **Storage:**
   - Monitor bandwidth usage
   - Check file sizes

### Expo DevTools

1. **Performance:**
   - Monitor JS frame rate
   - Check for UI lag

2. **Network:**
   - Monitor Firestore requests
   - Check image upload times

---

## 🎯 Success Criteria

### All Systems Green ✅

- [ ] Cloud Functions deployed and triggering
- [ ] Notifications sending successfully
- [ ] Images uploading and displaying
- [ ] Presence updating in real-time
- [ ] Typing indicators working
- [ ] No errors in logs
- [ ] App performs smoothly on both platforms

---

## 📞 Support

### Firebase Issues
- Firebase Console: https://console.firebase.google.com
- Firebase Docs: https://firebase.google.com/docs

### Expo Issues
- Expo Docs: https://docs.expo.dev
- Expo Forums: https://forums.expo.dev

### Code Issues
- Check `docs/KNOWN_ISSUES.md`
- Review `docs/FIXES_APPLIED.md`

---

## 🎉 Ready for Production Testing!

Once all tests pass:

1. ✅ Tag release: `git tag v1.0.0-mvp`
2. ✅ Push to GitHub: `git push origin v1.0.0-mvp`
3. ✅ Document test results
4. ✅ Begin polish phase (if needed)

---

**Good luck with testing! 🚀**

