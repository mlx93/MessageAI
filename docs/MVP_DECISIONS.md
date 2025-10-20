# MVP Implementation Decisions

**Date:** January 2025  
**Status:** Ready to Build

---

## ✅ Technical Decisions Made

### 1. Read Receipts
**Decision:** Always-on for MVP (Option A)
- No settings toggle
- No privacy controls
- All users see read receipts by default
- Simplifies implementation
- Can add privacy toggle post-MVP

**Implementation:**
- Remove `settings: { readReceiptsEnabled }` from User model
- Always update `readBy` array when user views messages
- Always show double blue checkmark for read messages

---

### 2. Email/Phone Uniqueness Enforcement
**Decision:** Index collections + Firestore security rules
- Create separate collections: `usersByEmail/` and `usersByPhone/`
- Use Firestore security rules with `exists()` checks
- Use batch writes to atomically create user + indexes
- If security rules fail, delete Firebase Auth user

**Implementation:**
```typescript
// During signup, create 3 documents atomically:
1. users/{uid} → user profile
2. usersByEmail/{email} → { uid, createdAt }
3. usersByPhone/{phone} → { uid, createdAt }

// Security rules prevent duplicates
```

**Benefits:**
- Prevents race conditions
- Enforced at database level
- No client-side queries needed
- Works even if client bypasses validation

---

### 3. Phone Number Validation
**Decision:** Option B - Normalize input
- Accept various formats: `(555) 123-4567`, `555-123-4567`, `+15551234567`
- Convert to E.164 format: `+15551234567`
- Store normalized version in database
- Improves user experience (less frustration with formatting)

**Implementation:**
```typescript
export const normalizePhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('1') && cleaned.length === 11) return `+${cleaned}`;
  return `+1${cleaned}`; // Assume US
};
```

---

### 4. Failed Message Handling
**Decision:** Persist until user manually retries or deletes
- Failed messages stay in conversation view with red error indicator
- Tap message → show "Retry" and "Delete" options
- Persist in SQLite until action taken
- No auto-deletion

**User Flow:**
1. Message fails after 3 auto-retries
2. Shows red ! icon in chat
3. User taps message → Alert with options
4. "Retry" → attempts send again
5. "Delete" → removes from local SQLite only (never sent to server anyway)

---

### 5. Firebase Emulators
**Decision:** Set up from the start
- Critical for testing without production data
- Allows offline testing
- Required for integration tests
- Setup included in initial configuration

**Ports:**
- Auth Emulator: `9099`
- Firestore Emulator: `8080`
- Functions Emulator: `5001`
- Emulator UI: `4000`

---

### 6. Push Notifications
**Decision:** Use Expo's push notification service
- Simpler than native FCM for MVP
- Works in Expo Go during development
- No need for native builds to test
- Can migrate to FCM post-MVP if needed

**Cloud Function will:**
- Get Expo push token from user doc
- Send via Expo's API (not direct FCM)
- Check `activeConversations` to avoid spamming

---

## 📁 Updated Files

These documents have been updated to reflect the decisions:

1. **messaging_app_prd.md**
   - User model: removed `settings` object
   - Security rules: added uniqueness helpers
   - Failed message handling: clarified persistence
   - Read receipts: marked as always-on

2. **mvp_implementation_plan.md**
   - Types: updated User interface
   - Auth service: added phone normalization
   - Auth service: implemented index-based uniqueness

3. **SETUP_GUIDE.md** (NEW)
   - Complete step-by-step setup instructions
   - Includes all tools, Firebase, emulators
   - Troubleshooting section
   - Time estimates

4. **MVP_DECISIONS.md** (NEW - this file)
   - Summary of all technical decisions
   - Rationale for each choice
   - Implementation notes

---

## 🚀 Current Status: READY TO BUILD

### Setup Checklist
- [ ] Node.js 18+ verified
- [ ] Xcode + iOS Simulator installed
- [ ] Android Studio + Emulator installed
- [ ] Expo CLI installed
- [ ] Firebase CLI installed
- [ ] Firebase project created with all services
- [ ] Firebase config files downloaded
- [ ] Cloud Functions initialized
- [ ] Firebase Emulators configured
- [ ] GitHub repository created

**Once checklist is complete, proceed to Task 1.1: Create Expo Project**

---

## 📋 Quick Reference

### Firebase Project Details
- **Project ID:** `messaging-app-mvp`
- **Services Enabled:**
  - Authentication (Email, Google, Apple)
  - Firestore Database
  - Cloud Storage
  - Cloud Functions
  - Cloud Messaging (auto-enabled)

### GitHub Repository
- **URL:** `https://github.com/mlx93/messaging-app-mvp`
- **Visibility:** Private

### App Bundle IDs
- **iOS:** `com.yourcompany.messagingapp`
- **Android:** `com.yourcompany.messagingapp`

---

## 🎯 Next Actions

1. **Complete setup** following SETUP_GUIDE.md
2. **Verify checklist** above is all ✅
3. **Start Task 1.1** from mvp_task_list_part1.md
4. **Follow task lists sequentially** (174 tasks total)
5. **Commit after each phase**

---

## ⚠️ Out of Scope (Don't Build These)

Reminder of what NOT to build in MVP:

- ❌ No AI features
- ❌ No read receipts privacy toggle
- ❌ No message editing/deletion (except failed messages)
- ❌ No voice/video messages
- ❌ No message reactions
- ❌ No dark mode
- ❌ No TestFlight/APK builds (use Expo Go)

**Stay focused on the 10 MVP features + 7 test scenarios!**

