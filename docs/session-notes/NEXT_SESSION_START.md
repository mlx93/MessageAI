# Next Session Quick Start Guide

**Current Status:** Part 1 Complete ✅  
**Next Phase:** Part 2 - Presence, Typing, Images, Notifications  
**Reference:** `docs/mvp_task_list_part2.md`

---

## 🚀 Quick Start Commands

### Start Development Server
```bash
cd /Users/mylessjs/Desktop/MessageAI
npx expo start --clear
```

Then press:
- `i` for iOS Simulator (iPhone 17 Pro)
- `a` for Android Emulator (Pixel 9 Pro)

---

## 📋 Part 2 Overview

### Phase 4: Presence System (3-4 hours)
**Goal:** Online/offline indicators and "last seen" timestamps

**Files to Create:**
- `services/presenceService.ts`

**Files to Modify:**
- `store/AuthContext.tsx` - Set online on login
- `app/(tabs)/index.tsx` - Show green dot for online users
- `app/chat/[id].tsx` - Show "last seen" timestamp

**Key Functions:**
```typescript
setUserOnline(userId: string)
setUserOffline(userId: string)
subscribeToUserPresence(userId: string, callback)
```

---

### Phase 5: Typing Indicators (2-3 hours)
**Goal:** "User is typing..." display in chat

**Files to Create:**
- `hooks/useTypingIndicator.ts`

**Files to Modify:**
- `app/chat/[id].tsx` - Show typing indicator
- Firestore rules - Add typing collection permissions

**Key Functions:**
```typescript
setTyping(conversationId: string, userId: string, isTyping: boolean)
subscribeToTypingStatus(conversationId: string, callback)
```

---

### Phase 6: Image Upload (3-4 hours)
**Goal:** Send and receive images in chat

**Files to Create:**
- `services/imageService.ts`

**Files to Modify:**
- `app/chat/[id].tsx` - Image picker button, display images
- `services/messageService.ts` - Handle image messages

**Key Functions:**
```typescript
pickImage()
compressImage(uri: string)
uploadImage(uri: string, conversationId: string)
sendImageMessage(conversationId: string, imageUrl: string, senderId: string)
```

**Dependencies:**
```bash
npx expo install expo-image-picker expo-image-manipulator
```

---

### Phase 7-8: Push Notifications (3-4 hours)
**Goal:** FCM push notifications for new messages

**Files to Create:**
- `services/notificationService.ts`
- `functions/src/sendNotification.ts`

**Files to Modify:**
- `app/_layout.tsx` - Request permissions, handle notifications
- `functions/src/index.ts` - Deploy Cloud Function

**Key Functions:**
```typescript
requestNotificationPermissions()
registerForPushNotifications()
handleNotificationReceived(notification)
sendPushNotification(userId: string, title: string, body: string)
```

---

### Phase 9: Testing & Polish (3-4 hours)
**Goal:** Comprehensive testing and bug fixes

**Tasks:**
1. Multi-device testing (2 simulators)
2. Offline resilience testing
3. Group chat testing (3+ users)
4. UI polish and animations
5. Bug fixes
6. Performance optimization
7. All 7 MVP test scenarios

---

## 🧪 Testing Checklist (Before Part 2)

### Manual Testing
- [ ] Register 2-3 test accounts
- [ ] Send messages between accounts
- [ ] Verify real-time delivery (< 1s)
- [ ] Test new message compose flow
- [ ] Test add participant flow
- [ ] Test offline queue (airplane mode)
- [ ] Test app restart (SQLite caching)

### Multi-Device Setup
```bash
# Terminal 1: Start Expo
npx expo start --clear

# Terminal 2: Open iOS Simulator 1
open -a Simulator

# Terminal 3: Open iOS Simulator 2 (if needed)
xcrun simctl boot "iPhone 17 Pro Max"
open -a Simulator

# Press 'i' twice in Terminal 1 to open on both simulators
```

---

## 📊 Current Statistics

### Features Complete
- **MVP Features:** 7 of 10 (70%)
- **Part 1 Tasks:** 7 of 7 (100%)
- **Part 2 Tasks:** 0 of 5 (0%)

### Time Estimates
- **Part 1 Actual:** ~5 hours (12 planned hours)
- **Part 2 Estimate:** 14-18 hours
- **Total MVP Estimate:** 28-34 hours
- **Time Remaining:** 23-29 hours

---

## 🔥 Firebase Console Quick Links

### Firestore
https://console.firebase.google.com/project/messageai-mlx93/firestore

### Authentication
https://console.firebase.google.com/project/messageai-mlx93/authentication

### Storage
https://console.firebase.google.com/project/messageai-mlx93/storage

### Cloud Functions
https://console.firebase.google.com/project/messageai-mlx93/functions

### Cloud Messaging (FCM)
https://console.firebase.google.com/project/messageai-mlx93/settings/cloudmessaging

---

## 📖 Key Documentation

### Part 1 Reference
- `docs/PART1_SESSION_SUMMARY.md` - What we just completed
- `docs/UI_IMPROVEMENTS_IMESSAGE_STYLE.md` - iMessage UI patterns
- `docs/FIRESTORE_SETUP.md` - Security rules and indexes

### Part 2 Reference
- `docs/mvp_task_list_part2.md` - Detailed task breakdown
- `docs/mvp_implementation_plan.md` - Technical specifications
- `docs/architecture.md` - System diagrams

### Memory Bank
- `memory_bank/05_current_codebase_state.md` - Full codebase overview
- `memory_bank/06_active_context_progress.md` - Current progress tracker

---

## 💡 Implementation Tips

### Presence System
- Use Firestore's `onDisconnect()` for reliable offline detection
- Update user status in Firestore: `users/{userId}/presence`
- Listen to presence changes in conversation list and chat screen
- Show green dot for online, "last seen" for offline

### Typing Indicators
- Clear typing status after 500ms of no input
- Use Firestore subcollection: `conversations/{id}/typing/{userId}`
- Show "User is typing..." only for active conversation
- Don't persist typing status (ephemeral data)

### Image Upload
- Compress images before upload (max 5MB)
- Show loading indicator during upload
- Store images in: `Storage/conversations/{conversationId}/{messageId}.jpg`
- Include image dimensions in message metadata

### Push Notifications
- Test with Expo Go first (works in development)
- Request permissions in `app/_layout.tsx`
- Cloud Function triggers on new message creation
- Only send notification if user is offline

---

## 🚧 Known Issues to Address

### Low Priority (Document Only)
1. Unread count not functional (placeholder only)
2. Social auth not testable in Expo Go (production builds only)
3. SQLite can grow large (cleanup strategy needed later)

### Medium Priority (Fix in Part 2)
1. Group conversations not tested (need 3+ users)
2. Offline queue not fully tested (need multi-device)
3. Message delivery status needs refinement

### High Priority (Fix Immediately)
- None! All critical issues resolved ✅

---

## 🎯 Success Criteria for Part 2

### Must Have
- [ ] Online/offline status visible in conversation list
- [ ] "Last seen" timestamp for offline users
- [ ] "User is typing..." indicator in chat
- [ ] Image sending and receiving
- [ ] Push notifications for new messages
- [ ] All 7 test scenarios passing

### Nice to Have
- [ ] Unread count badge functional
- [ ] Group chat tested with 3+ users
- [ ] Offline queue tested with airplane mode
- [ ] UI animations (fade in/out, slide)
- [ ] Performance optimization (pagination)

---

## 🔧 Troubleshooting

### If Build Fails
```bash
# Clear caches
npx expo start --clear
rm -rf node_modules
npm install --legacy-peer-deps
```

### If SQLite Errors
```bash
# Reinstall expo-sqlite
npm uninstall expo-sqlite
npx expo install expo-sqlite
```

### If Firestore Errors
- Check security rules deployed: `docs/FIRESTORE_SETUP.md`
- Verify indexes created in Firebase Console
- Check network connection

### If Real-Time Not Working
- Verify onSnapshot listeners in services
- Check Firestore rules allow read access
- Ensure network connection active

---

## 📝 Git Workflow

### Before Starting Part 2
```bash
# Commit Part 1 changes
git add .
git commit -m "feat: Complete Part 1 MVP + iMessage UI"
git push origin main

# Create Part 2 branch (optional)
git checkout -b part2-implementation
```

### During Part 2
```bash
# Commit after each phase
git add .
git commit -m "feat: Phase 4 - Presence system complete"
git push origin part2-implementation
```

### After Part 2
```bash
# Merge to main
git checkout main
git merge part2-implementation
git push origin main
```

---

## 🎉 Ready to Start!

**Status:** ✅ All prerequisites complete  
**Blockers:** None  
**Confidence:** Very High  
**Estimated Time:** 14-18 hours for Part 2

### First Step
1. Start Expo dev server: `npx expo start --clear`
2. Open simulator: Press `i`
3. Test current features (send messages, new conversation)
4. Start Phase 4: Create `services/presenceService.ts`

---

**Good luck with Part 2! 🚀**

**Reference:** `docs/mvp_task_list_part2.md` for detailed tasks

