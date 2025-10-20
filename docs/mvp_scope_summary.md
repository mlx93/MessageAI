# MVP Scope Summary - 24-Hour Checkpoint

## 🎯 What We're Building

**A production-quality WhatsApp-style messaging app with all core features working reliably.**

**NOT building:** AI features (that's for Days 3-7 in full MessageAI.md project)

**Timeline:** 28 hours (realistic for quality implementation)

**Deployment:** Expo Go on iOS + Android simulators

---

## ✅ The 10 Required Features (Hard Gate)

These MUST all work to pass the MVP checkpoint:

| # | Feature | Implementation | Status When Done |
|---|---------|----------------|------------------|
| 1 | **One-on-one chat** | Text messaging between 2 users via Firestore | User A sends → User B receives in < 1 second |
| 2 | **Real-time delivery** | Firestore onSnapshot listeners | Messages appear instantly for online users |
| 3 | **Message persistence** | SQLite local cache | Force-quit app → reopen → messages still there |
| 4 | **Optimistic UI** | Show message immediately before server confirmation | Message appears in UI instantly when sent |
| 5 | **Online/offline status** | Firestore presence with onDisconnect() | Green dot = online, gray = offline |
| 6 | **Message timestamps** | Firestore Timestamp.now() | Every message shows "5m ago" or "12:34 PM" |
| 7 | **User authentication** | Email/password + Google + Apple | Users can sign up, log in, stay logged in |
| 8 | **Group chat (3+)** | Add participants → auto-converts to group | 3 users in one conversation, all receive messages |
| 9 | **Read receipts** | readBy array, always-on for MVP | Double blue checkmark when message read |
| 10 | **Push notifications** | FCM via Expo Go | Background app → receive notification |

---

## 🧪 The 7 Testing Scenarios (Must All Pass)

| # | Scenario | What to Test | Pass Criteria |
|---|----------|--------------|---------------|
| 1 | **Real-time chat** | Send 20 messages rapidly between 2 devices | All delivered, correct order, < 1s latency |
| 2 | **Offline resilience** | Airplane mode → send → reconnect | Messages deliver within 10s of reconnection |
| 3 | **Background messages** | Background app → send message | Notification appears in simulator |
| 4 | **Force-quit persistence** | Force quit → reopen → check messages | All messages visible instantly from cache |
| 5 | **Poor network** | Throttle to 3G or airplane mode toggle | Messages eventually deliver, no crashes |
| 6 | **Rapid-fire** | Send 20+ messages as fast as possible | All messages in correct order |
| 7 | **Group chat** | 3 devices in one conversation | All participants receive all messages |

---

## 🏗️ Tech Stack (Fixed)

**Frontend:**
- React Native with Expo
- Expo Router for navigation
- GiftedChat for UI
- SQLite for local storage

**Backend:**
- Firebase Auth (email/password + Google + Apple)
- Cloud Firestore (real-time database)
- Cloud Storage (image uploads)
- Cloud Functions (1 function: sendMessageNotification)
- Firebase Cloud Messaging (push notifications)

**Testing:**
- Jest for unit tests
- Firebase Emulator for integration tests
- Expo Go for push notification testing

**Deployment:**
- Expo Go (scan QR code to test on simulators/devices)
- No native builds required for MVP

---

## 📊 What's In Scope vs Out of Scope

### ✅ IN SCOPE (MVP - 24 Hours)

**Core Messaging:**
- Send/receive text messages
- Send/receive images (with compression)
- Message delivery states (sending/sent/delivered/read/failed)
- Retry logic for failed messages (2s, 4s, 8s exponential backoff)
- Message timestamps and formatting

**User Features:**
- Email/password signup and login
- Google Sign-In
- Apple Sign-In
- Phone number + email (both unique)
- Profile pictures (optional, initials fallback)
- Online/offline presence indicators
- Typing indicators (shows individual names)

**Contact & Discovery:**
- Import phone contacts
- Match contacts against app users
- Search by phone number
- Start conversation from contacts list

**Conversations:**
- One-on-one chats
- Group chats (seamlessly add participants)
- Conversation list (ordered by most recent)
- Last message preview
- Unread count (basic)

**Offline Support:**
- SQLite caching of messages and conversations
- Offline message queue with auto-retry
- Instant load from cache on app start
- Sync when network reconnects

**Push Notifications:**
- Foreground notifications (via Expo Go)
- Background notifications (via Expo Go)
- Smart delivery (don't notify if user in active conversation)
- Deep linking (notification tap opens conversation)

**Security:**
- Firestore security rules
- Email/phone uniqueness enforcement via security rules
- Authentication required for all operations
- Participants-only access to conversations/messages

**Testing:**
- 70%+ test coverage
- Unit tests for all services
- Integration tests via Firebase Emulator
- All 7 manual test scenarios passing

### ❌ OUT OF SCOPE (Post-MVP)

**NO AI Features:**
- ❌ Thread summarization
- ❌ Action item extraction
- ❌ Smart search
- ❌ Priority message detection
- ❌ Translation features
- ❌ Smart replies
- ❌ AI chat interface
- ❌ RAG pipelines
- ❌ LLM integration
- ❌ Multi-step agents
- ❌ Proactive assistants

**NO Advanced Messaging:**
- ❌ Voice messages
- ❌ Video messages
- ❌ Message editing
- ❌ Message deletion (except failed messages)
- ❌ Message forwarding
- ❌ Message reactions
- ❌ Message search (beyond basic)
- ❌ Link previews
- ❌ Custom emoji/stickers
- ❌ Dark mode

**NO Advanced Features:**
- ❌ User blocking
- ❌ Group admin controls
- ❌ Read receipts privacy toggle (always-on for MVP)
- ❌ Message export
- ❌ End-to-end encryption
- ❌ Stories/status updates
- ❌ Calls (voice or video)
- ❌ Location sharing
- ❌ Contact sync automation

**NO Production Deployment:**
- ❌ TestFlight builds
- ❌ APK builds
- ❌ App Store submission
- ❌ Google Play submission
- ❌ Native splash screens
- ❌ App icons (use Expo defaults)

---

## 🎯 Success Criteria

### **To Pass MVP Checkpoint, You Must Have:**

1. ✅ All 10 features working reliably
2. ✅ All 7 test scenarios passing on iOS + Android simulators
3. ✅ App running in Expo Go via QR code
4. ✅ Firebase backend deployed (Firestore, Auth, Storage, 1 Cloud Function)
5. ✅ 70%+ test coverage
6. ✅ Code on GitHub with clear commits
7. ✅ No critical bugs (app doesn't crash during normal use)

### **What "Working" Means:**

**Not "working":**
- ❌ Features partially implemented
- ❌ Works "most of the time"
- ❌ Requires manual intervention
- ❌ Only works on one platform

**"Working" means:**
- ✅ Feature works 100% reliably
- ✅ Handles edge cases gracefully
- ✅ Works on both iOS and Android
- ✅ Survives app restart/force-quit
- ✅ Works offline and syncs when online

---

## 📁 Deliverables for MVP Checkpoint

1. **GitHub Repository**
   - All code committed
   - Clear README with setup instructions
   - .gitignore properly configured

2. **Working App**
   - Running in Expo Go on iOS Simulator
   - Running in Expo Go on Android Emulator
   - Share QR code to test

3. **Firebase Backend**
   - Firestore database with security rules
   - Cloud Functions deployed (1 function)
   - Cloud Storage configured
   - Authentication enabled (3 methods)

4. **Test Results**
   - All 7 manual test scenarios documented as passing
   - Unit test suite running with 70%+ coverage
   - Integration tests via emulator working

5. **Demo Readiness**
   - Can demonstrate all 10 features
   - Can show offline/online scenarios
   - Can show group chat
   - Can show notifications

---

## ⏱️ Time Breakdown

**Phase 1 (Hours 0-4):** Foundation & Auth
- Project setup
- Email/password auth
- Google/Apple sign-in
- Firestore security rules

**Phase 2 (Hours 4-6):** User Discovery
- Contact import
- Phone number matching
- User search
- Conversation creation

**Phase 3 (Hours 6-12):** Core Messaging
- Real-time messaging
- Optimistic UI
- Offline support
- SQLite caching
- Retry logic

**Phase 4 (Hours 12-18):** Real-Time Features
- Presence system
- Typing indicators
- Read receipts

**Phase 5 (Hours 18-21):** Groups & Media
- Add participants (groups)
- Image upload
- Image compression

**Phase 6 (Hours 21-24):** Push Notifications
- Notification service
- Cloud Function
- Expo Go testing

**Phase 7 (Hours 24-28):** Testing & Polish
- All 7 test scenarios
- Bug fixes
- UI polish
- Final testing

---

## 🚧 Common Pitfalls to Avoid

### **Scope Creep**
- ❌ "Let me just add message editing..."
- ❌ "Read receipts privacy would be nice..."
- ❌ "What if we add voice messages..."
- ✅ Stay laser-focused on 10 features + 7 tests

### **Over-Engineering**
- ❌ "Let me build a custom state management system..."
- ❌ "I'll write my own auth flow..."
- ❌ "Let me optimize this prematurely..."
- ✅ Use proven tools: GiftedChat, Firebase SDK, Expo defaults

### **Under-Testing**
- ❌ "It works on my machine..."
- ❌ "I tested it once..."
- ❌ "Unit tests are optional..."
- ✅ All 7 scenarios must pass consistently

### **Ignoring Offline**
- ❌ "I'll add offline support later..."
- ❌ "Network is usually fine..."
- ✅ Offline support is a HARD REQUIREMENT

### **Deployment Confusion**
- ❌ Trying to build TestFlight/APK for MVP
- ❌ Worrying about App Store submission
- ✅ Just use Expo Go - it's enough for MVP

---

## 🎬 What Happens After MVP?

**If this were the full MessageAI.md project:**

**Days 3-4:** Choose persona + design AI features  
**Days 4-6:** Implement 5 required AI features  
**Day 6-7:** Implement 1 advanced AI capability  
**Day 7:** Polish, demo video, Persona Brainlift doc

**But for our scope:**
- ✅ We're building the **24-hour MVP checkpoint only**
- ✅ This is the messaging foundation
- ✅ AI features would be a separate project (40-60 hours)
- ✅ Our MVP is production-ready and can scale

---

## 📋 Quick Reference Checklist

**Before Starting:**
- [ ] Node.js 18+ installed
- [ ] Expo CLI installed
- [ ] Firebase project created
- [ ] Firebase services enabled (Auth, Firestore, Storage, FCM)
- [ ] Firebase config files downloaded
- [ ] GitHub repo created
- [ ] iOS Simulator working
- [ ] Android Emulator working
- [ ] Expo Go installed on both

**During Development:**
- [ ] Following task lists sequentially
- [ ] Committing after each phase
- [ ] Testing as you go
- [ ] NOT adding features beyond the 10
- [ ] NOT starting AI features

**Before Declaring MVP Complete:**
- [ ] All 10 features implemented
- [ ] All 7 test scenarios pass
- [ ] Test coverage >= 70%
- [ ] App works in Expo Go on both platforms
- [ ] Firebase backend deployed
- [ ] Code pushed to GitHub
- [ ] Can demo to someone else

---

## 🎯 Your North Star

**The goal is NOT:**
- ❌ Build every possible feature
- ❌ Make it perfect
- ❌ Add AI capabilities
- ❌ Deploy to production stores

**The goal IS:**
- ✅ Build a **rock-solid** messaging foundation
- ✅ Prove the infrastructure works reliably
- ✅ Pass all 10 features + 7 tests
- ✅ Have working code on GitHub + Expo Go

**Remember:** WhatsApp was built by 2 developers. You're building the MVP of a WhatsApp-quality messaging infrastructure in 28 hours. That's the win.

**AI features are for later. Focus on messages first.**

---

## 📞 Quick Decisions Guide

**When tempted to add something, ask:**

1. **Is it in the 10 required features?**
   - No → Don't add it
   - Yes → Add it

2. **Is it needed to pass one of the 7 tests?**
   - No → Don't add it
   - Yes → Add it

3. **Is it messaging infrastructure?**
   - No → Probably don't need it
   - Yes → Consider if truly needed

4. **Would WhatsApp have it in their first version?**
   - No → Skip it
   - Yes → Maybe consider

**When stuck, refer back to:**
- ✅ The 10 features list
- ✅ The 7 test scenarios
- ✅ The task lists
- ✅ The implementation plan

**Everything you need is already documented. Just follow the plan.**

---

## 🎉 You're Ready!

- ✅ All documents aligned
- ✅ Scope is clear
- ✅ No AI features to distract you
- ✅ 28-hour realistic timeline
- ✅ 174 trackable tasks
- ✅ Architecture diagrams for reference

**Now go build a production-quality messaging app!** 🚀