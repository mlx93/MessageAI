# MessageAI Testing Checklist
**Quick Reference for Testing Implementation**  
**Total Time**: 12 hours | **Target Coverage**: 70%+ | **E2E Scenarios**: 7

---

## Phase 1: Firebase Emulator Setup (1 hour) ⏱️

**Goal**: Unblock all integration tests

### Setup Tasks
- [ ] Run `firebase init emulators`
  - Select: Authentication, Firestore, Functions, Storage
  - Ports: Auth (9099), Firestore (8080), Functions (5001), Storage (9199)
  - Confirm with `Y` to download emulators

- [ ] Create `services/__tests__/setup.ts`
  ```typescript
  import { connectAuthEmulator } from 'firebase/auth';
  import { connectFirestoreEmulator } from 'firebase/firestore';
  // ... connect all emulators
  ```

- [ ] Create `.env.test`
  ```
  FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
  FIRESTORE_EMULATOR_HOST=localhost:8080
  ```

- [ ] Add npm scripts to `package.json`
  ```json
  "test:emulators": "firebase emulators:start --only auth,firestore,functions,storage",
  "test:integration": "NODE_ENV=test jest --testPathPattern=integration",
  "test:unit": "jest --testPathPattern='((?!integration).)*\\.test\\.ts$'"
  ```

- [ ] Smoke test: Create user in Auth Emulator → verify in Firestore

**Success**: `npm run test:emulators` runs, one integration test passes

---

## Phase 2: Critical Integration Tests (3 hours) ⏱️⏱️⏱️

### 2.1 Phone Auth (45 min) 🔴 CRITICAL
File: `services/__tests__/authService.integration.test.ts`

- [ ] Test: Send OTP → verify code → create user profile
- [ ] Test: Invalid OTP → error handling
- [ ] Test: Duplicate phone → security rules block
- [ ] Test: User profile has all required fields (uid, phoneNumber, displayName, etc.)

### 2.2 Message Service (30 min) 🔴 CRITICAL
File: `services/__tests__/messageService.integration.test.ts`

- [ ] Test: sendMessage writes to `conversations/{id}/messages`
- [ ] Test: subscribeToMessages receives real-time updates
- [ ] Test: markMessagesAsRead updates readBy array
- [ ] Test: markMessageAsDelivered updates deliveredTo array

### 2.3 Offline Queue (45 min) 🔴 CRITICAL
File: `services/__tests__/offlineQueue.integration.test.ts`

- [ ] Test: queueMessage stores in AsyncStorage when offline
- [ ] Test: processQueue sends on reconnect
- [ ] Test: Exponential backoff (2s, 4s, 8s delays)
- [ ] Test: Mark failed after 3 retries, log to console

### 2.4 Conversation Service (30 min) 🔴 CRITICAL
File: `services/__tests__/conversationService.integration.test.ts`

- [ ] Test: createOrGetConversation deterministic ID (direct) vs UUID (group)
- [ ] Test: addParticipantToConversation (2→3 converts to group)
- [ ] Test: getUserConversations real-time listener
- [ ] Test: updateConversationLastMessage updates timestamp

### 2.5 SQLite Cache (30 min) 🔴 CRITICAL
File: `services/__tests__/sqliteService.integration.test.ts`

- [ ] Test: initDB creates messages and conversations tables
- [ ] Test: cacheMessage INSERT OR REPLACE
- [ ] Test: getCachedMessages returns sorted by timestamp
- [ ] Test: Handle 500+ messages without performance issues

**Success**: 5 integration test files passing, all using Firebase Emulator

---

## Phase 3: Unit Tests (2 hours) ⏱️⏱️

### 3.1 Phone Format (20 min)
File: `utils/__tests__/phoneFormat.test.ts`

- [ ] Test: Preserve E.164 format (+15551234567)
- [ ] Test: Add +1 for 10-digit US numbers
- [ ] Test: Handle formatted numbers (555) 123-4567
- [ ] Test: International numbers (+44, +61, etc.)
- [ ] Test: Invalid formats (empty, letters, special chars)

### 3.2 Message Helpers (20 min)
File: `utils/__tests__/messageHelpers.test.ts`

- [ ] Test: formatTimestamp "Just now" (< 1 min)
- [ ] Test: formatTimestamp "5m ago" (< 1 hour)
- [ ] Test: formatTimestamp "2h ago" (< 24 hours)
- [ ] Test: formatTimestamp "Yesterday" (< 48 hours)
- [ ] Test: formatTimestamp full date (> 48 hours)
- [ ] Test: Edge cases (null, future dates)

### 3.3 Typing Indicator Hook (30 min)
File: `hooks/__tests__/useTypingIndicator.test.ts`

- [ ] Test: startTyping updates Firestore typing subcollection
- [ ] Test: Debounce clears after 500ms of inactivity
- [ ] Test: getTypingText for 1 user ("John is typing...")
- [ ] Test: getTypingText for 2 users ("John and Sarah are typing...")
- [ ] Test: getTypingText for 3+ users ("John, Sarah, and 2 others...")

### 3.4 Presence Service (20 min)
File: `services/__tests__/presenceService.test.ts`

- [ ] Test: setUserOnline updates user doc { online: true }
- [ ] Test: onDisconnect handler registered
- [ ] Test: setUserOffline updates { online: false, lastSeen }
- [ ] Test: subscribeToUserPresence calls callback on changes

### 3.5 Contact Service (30 min)
File: `services/__tests__/contactService.test.ts`

- [ ] Test: normalizePhoneNumber converts to E.164
- [ ] Test: matchPhoneNumbers batches queries (max 10 per query)
- [ ] Test: searchUserByPhone normalizes before query
- [ ] Test: importContacts filters contacts with phone numbers

**Success**: 5 unit test files with real assertions (no more placeholders)

---

## Phase 4: E2E with Maestro (4 hours) ⏱️⏱️⏱️⏱️

### Setup (1 hour)
- [ ] Install Maestro: `brew tap mobile-dev-inc/tap && brew install maestro`
- [ ] Create `maestro/` directory
- [ ] Add testID props to all screens:
  - [ ] `app/auth/phone-login.tsx`
  - [ ] `app/auth/verify-otp.tsx`
  - [ ] `app/(tabs)/index.tsx`
  - [ ] `app/chat/[id].tsx`
  - [ ] `app/new-message.tsx`
- [ ] Test: `maestro test maestro/smoke.yaml` launches Expo Go

### E2E Flows (3 hours)

#### 4.1 Scenario 1: Real-Time Chat (30 min) 🔴
File: `maestro/01-realtime-chat.yaml`

- [ ] Launch Expo Go on iOS Simulator
- [ ] Login as User A (+15551111111)
- [ ] Open chat with User B
- [ ] Send 20 messages rapidly (loop)
- [ ] **On Android Emulator**: Assert all 20 messages appear < 2s

#### 4.2 Scenario 2: Offline Resilience (30 min) 🔴
File: `maestro/02-offline-resilience.yaml`

- [ ] Enable airplane mode
- [ ] Send 3 messages (queued)
- [ ] Assert "Offline" banner visible
- [ ] Disable airplane mode
- [ ] Assert all 3 messages deliver within 10s

#### 4.3 Scenario 3: Background Messages (30 min) 🔴
File: `maestro/03-background-messages.yaml`

- [ ] User A backgrounds app (swipe up)
- [ ] User B sends message
- [ ] Assert notification appears on User A
- [ ] Tap notification → opens correct conversation

#### 4.4 Scenario 4: Force Quit Persistence (20 min) 🔴
File: `maestro/04-force-quit-persistence.yaml`

- [ ] Send 5 messages in chat
- [ ] Force quit app (swipe up)
- [ ] Wait 5 seconds
- [ ] Reopen app
- [ ] Navigate to conversation
- [ ] Assert all 5 messages visible instantly (from SQLite)

#### 4.5 Scenario 5: Poor Network (20 min) 🟡
File: `maestro/05-poor-network.yaml`

- [ ] Enable Network Link Conditioner → 3G profile
- [ ] Send message
- [ ] Assert delivers within 5 seconds
- [ ] No crashes, UI remains responsive

#### 4.6 Scenario 6: Rapid Fire (20 min) 🟡
File: `maestro/06-rapid-fire.yaml`

- [ ] Send 20+ messages as fast as possible (1 char + send)
- [ ] Assert all delivered to recipient
- [ ] Assert correct order (timestamps sequential)

#### 4.7 Scenario 7: Group Chat (30 min) 🔴
File: `maestro/07-group-chat.yaml`

- [ ] Create group with 3 users
- [ ] User A sends message
- [ ] Assert User B receives (check on Android)
- [ ] Assert User C receives (check on physical device if available)
- [ ] Verify read receipts (readBy array tracks per-user)

**Success**: All 7 Maestro flows passing on simulators

---

## Phase 5: Security & Rules (1 hour) ⏱️

### 5.1 Setup (20 min)
- [ ] Install: `npm install --save-dev @firebase/rules-unit-testing`
- [ ] Create `firestore.rules.test.ts`
- [ ] Load rules: `fs.readFileSync('firestore.rules', 'utf8')`

### 5.2 Email Uniqueness (15 min)
- [ ] Test: User 1 creates `usersByEmail/test@example.com` → SUCCESS
- [ ] Test: User 2 tries same email → FAIL (permission-denied)

### 5.3 Phone Uniqueness (15 min)
- [ ] Test: User 1 creates `usersByPhone/+15551234567` → SUCCESS
- [ ] Test: User 2 tries same phone → FAIL (permission-denied)

### 5.4 Conversation Access (10 min)
- [ ] Test: User in participants array can read/write
- [ ] Test: User not in participants cannot read

**Success**: Security rules enforced, 4 tests passing

---

## Phase 6: Coverage & Polish (1 hour) ⏱️

### 6.1 Coverage Report (5 min)
```bash
npm test -- --coverage --coverageReporters=text --coverageReporters=html
open coverage/index.html
```

### 6.2 Identify Gaps (10 min)
Expected low-coverage files:
- `services/authService.ts` - Phone auth error paths
- `services/notificationService.ts` - FCM token handling
- `app/chat/[id].tsx` - Chat screen component logic

### 6.3 Add Missing Tests (30 min)
- [ ] Write tests for files < 50% coverage
- [ ] Focus on high-churn or critical files first
- [ ] Target: 70%+ overall coverage

### 6.4 Document Testing (15 min)
Create `docs/TESTING_GUIDE.md`:
- [ ] How to run tests (`npm test`, `npm run test:integration`)
- [ ] How to start emulators (`npm run test:emulators`)
- [ ] How to run Maestro flows (`maestro test maestro/01-realtime-chat.yaml`)
- [ ] How to add new tests (patterns, conventions)

**Success**: 70%+ coverage, testing documented

---

## Final Checklist: Definition of Done ✅

### Must Have (Blocking Production)
- [ ] Firebase Emulator running with npm scripts
- [ ] 5 integration tests passing (auth, messages, offline, conversations, SQLite)
- [ ] 7 Maestro E2E flows passing (all critical scenarios)
- [ ] Security rules tested (email/phone uniqueness)
- [ ] Coverage >= 70% statements

### Should Have (Before Launch)
- [ ] 5 unit tests expanded from placeholders
- [ ] Coverage >= 60% branches
- [ ] Testing guide documented
- [ ] CI/CD pipeline configured (GitHub Actions)

### Nice to Have (Post-Launch)
- [ ] Component tests for screens (React Native Testing Library)
- [ ] Performance tests (message load times)
- [ ] Accessibility tests (screen reader navigation)
- [ ] Load tests (100+ conversations, 1000+ messages)

---

## Quick Commands Reference

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests (requires emulator)
npm run test:emulators  # Terminal 1
npm run test:integration  # Terminal 2

# Run specific test file
npm test -- authService.test.ts

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage

# Run Maestro flow
maestro test maestro/01-realtime-chat.yaml

# Run all Maestro flows
maestro test maestro/

# Firebase Emulator UI
# After starting emulators, open: http://localhost:4000
```

---

## Progress Tracking

### Phase 1: Foundation ⬜
- [ ] Emulator setup
- [ ] Smoke test passing

### Phase 2: Integration Tests ⬜
- [ ] Auth ⬜
- [ ] Messages ⬜
- [ ] Offline Queue ⬜
- [ ] Conversations ⬜
- [ ] SQLite ⬜

### Phase 3: Unit Tests ⬜
- [ ] Phone Format ⬜
- [ ] Message Helpers ⬜
- [ ] Typing Hook ⬜
- [ ] Presence ⬜
- [ ] Contacts ⬜

### Phase 4: E2E Tests ⬜
- [ ] Setup + testIDs ⬜
- [ ] Scenario 1 ⬜
- [ ] Scenario 2 ⬜
- [ ] Scenario 3 ⬜
- [ ] Scenario 4 ⬜
- [ ] Scenario 5 ⬜
- [ ] Scenario 6 ⬜
- [ ] Scenario 7 ⬜

### Phase 5: Security ⬜
- [ ] Rules testing setup ⬜
- [ ] Email uniqueness ⬜
- [ ] Phone uniqueness ⬜
- [ ] Access control ⬜

### Phase 6: Coverage ⬜
- [ ] Report generated ⬜
- [ ] Gaps filled ⬜
- [ ] 70%+ achieved ⬜
- [ ] Guide documented ⬜

---

**Total Estimated Time**: 12 hours  
**Priority**: 🔴 High (before production launch)  
**Blocker**: None (all prerequisites met)

**Last Updated**: October 21, 2025  
**Status**: Ready to execute

