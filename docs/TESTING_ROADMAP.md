# MessageAI Testing Roadmap
**Created**: October 21, 2025  
**Status**: Testing Phase Not Started  
**Goal**: 70%+ Coverage + 7 E2E Scenarios Automated

---

## Executive Summary

### Current State: Critical Testing Gaps ⚠️

**What's Built**: 100% of MVP features implemented and manually tested  
**What's Tested**: ~5% - mostly placeholder tests with `expect(true).toBe(true)`

**The Problem**:
- 11 test files exist but contain minimal logic
- Firebase Emulator setup deferred (Task 1.6b)
- Integration tests non-existent
- E2E tests non-existent
- Coverage never measured
- No CI/CD automation

**The Risk**:
- Regressions invisible until user reports
- Refactoring is dangerous without test safety net
- Can't ship to production with confidence
- Firebase costs could spike from bugs (infinite loops, etc.)

---

## What Was Missing From Original Testing Prompt

### 1. MessageAI-Specific Context ❌

**Original Prompt**: Generic Expo + Firebase app  
**Missing**: 
- MessageAI's 10 specific MVP features (phone auth, offline queue, typing, etc.)
- The 7 critical test scenarios from `mvp_task_list_part2.md` Tasks 14.1-14.7
- Deferred tasks from Part 1 (Task 1.6b: Firebase Emulator setup)
- Current test file inventory (11 placeholder files)

**Added**:
- Complete feature list with testing priorities
- Mapping of test scenarios to MVP task list
- Current state analysis (11 test files, mostly placeholders)
- MessageAI-specific architecture (Expo Router, SQLite, phone auth)

### 2. Firebase Emulator Integration ❌

**Original Prompt**: Mentioned emulator but no setup guide  
**Missing**:
- Specific Task 1.6b implementation from `mvp_task_list_part1.md`
- Emulator port configuration (Auth: 9099, Firestore: 8080, etc.)
- Connection module pattern for test isolation
- npm scripts for emulator workflows

**Added**:
- Complete Task 1.6b implementation guide
- `services/__tests__/setup.ts` connector module
- `.env.test` configuration
- npm scripts: `test:emulators`, `test:integration`, `test:unit`

### 3. Concrete Test Examples ❌

**Original Prompt**: High-level descriptions  
**Missing**:
- Full working test code for MessageAI features
- Phone auth integration test (primary auth method)
- Offline queue test with exponential backoff
- Firestore security rules tests for email/phone uniqueness

**Added**:
- Complete code examples for each test type
- Integration tests using Firebase Emulator
- Security rules tests with `@firebase/rules-unit-testing`
- Offline queue test with mock AsyncStorage

### 4. E2E Maestro Flows ❌

**Original Prompt**: Mentioned Maestro generically  
**Missing**:
- 7 specific scenarios from MVP Task List (Tasks 14.1-14.7)
- Maestro YAML examples for MessageAI flows
- testID prop requirements for all screens
- Two-device testing approach (iOS + Android)

**Added**:
- 7 complete Maestro flow specifications
- Example YAML with MessageAI-specific selectors
- testID naming conventions
- Instructions for running flows on 2 simulators simultaneously

### 5. Priority & Sequencing ❌

**Original Prompt**: List of test types  
**Missing**:
- Which tests to write first (critical path)
- Time estimates for each phase
- Dependencies between test types (emulator → integration → E2E)
- Coverage targets per phase

**Added**:
- 6-phase prioritized roadmap (12 hours total)
- Phase 1: Emulator setup (unblocks everything)
- Phase 2: Critical integration tests (auth, messages, offline)
- Phases 3-6: Unit, E2E, security, coverage
- Clear success criteria for each phase

### 6. Coverage Analysis ❌

**Original Prompt**: Mentioned coverage reports  
**Missing**:
- Current coverage baseline (never measured)
- Low-coverage file identification
- Regression testing on code changes
- How to reach 70%+ target

**Added**:
- npm script to generate coverage report
- Expected coverage analysis output
- Low-coverage priority list (authService, messageService, offlineQueue)
- `--findRelatedTests` for targeted testing on changes

### 7. Firestore Security Rules Testing ❌

**Original Prompt**: Security not mentioned  
**Missing**:
- Email/phone uniqueness enforcement (critical for auth)
- Conversation access rules (participants only)
- `@firebase/rules-unit-testing` usage
- Test pattern for rules validation

**Added**:
- Complete `firestore.rules.test.ts` implementation
- Email uniqueness test (usersByEmail collection)
- Phone uniqueness test (usersByPhone collection)
- Conversation/message access control tests

### 8. MessageAI Testing Priorities ❌

**Original Prompt**: Generic priority guidance  
**Missing**:
- Phone auth is PRIMARY auth (not email/password)
- Offline queue is critical for reliability
- Real-time sync is core value prop
- Group conversation complexity
- SQLite cache enables instant loads

**Added**:
- Section "MessageAI-Specific Testing Priorities"
- Detailed explanation of why each feature matters
- Edge cases specific to MessageAI (E.164 formatting, deterministic IDs, etc.)
- Business impact of each test area

---

## Testing Roadmap: 6 Phases, 12 Hours

### Phase 1: Foundation (1 hour) 🔴 BLOCKING

**Goal**: Setup Firebase Emulator to unblock integration tests

**Tasks**:
- [ ] Run `firebase init emulators` (10 min)
  - Select: Auth, Firestore, Functions, Storage
  - Ports: 9099, 8080, 5001, 9199
- [ ] Create `services/__tests__/setup.ts` (15 min)
  - Connect to emulators with `connectAuthEmulator`, etc.
- [ ] Create `.env.test` (5 min)
- [ ] Add npm scripts (10 min)
  - `test:emulators`, `test:integration`, `test:unit`
- [ ] Verify with smoke test (20 min)
  - Test: Create user in Auth Emulator → verify in Firestore

**Deliverable**: `firebase emulators:start` runs successfully, one integration test passes

**Priority**: 🔴 **CRITICAL** - Blocks all integration tests

---

### Phase 2: Critical Integration Tests (3 hours) 🔴 HIGH

**Goal**: Test the 5 most critical features with real Firebase

**Tasks**:

#### 2.1 Phone Auth Integration (45 min)
File: `services/__tests__/authService.integration.test.ts`
- [ ] Test: Send OTP → verify code → create user profile
- [ ] Test: Invalid OTP code → error handling
- [ ] Test: Duplicate phone number → security rules prevent
- [ ] Test: User profile created with all required fields

Why critical: Phone auth is **primary authentication method**

#### 2.2 Message Service Integration (30 min)
File: `services/__tests__/messageService.integration.test.ts`
- [ ] Test: sendMessage writes to Firestore subcollection
- [ ] Test: subscribeToMessages receives real-time updates
- [ ] Test: markMessagesAsRead updates readBy array
- [ ] Test: markMessageAsDelivered updates deliveredTo array

Why critical: Core messaging functionality, read receipts

#### 2.3 Offline Queue Integration (45 min)
File: `services/__tests__/offlineQueue.integration.test.ts`
- [ ] Test: Queue messages when offline (AsyncStorage)
- [ ] Test: Process queue on reconnect
- [ ] Test: Exponential backoff (2s, 4s, 8s delays)
- [ ] Test: Mark failed after 3 retries

Why critical: **Reliability** - users must trust messages will send

#### 2.4 Conversation Service Integration (30 min)
File: `services/__tests__/conversationService.integration.test.ts`
- [ ] Test: createOrGetConversation deterministic ID for direct
- [ ] Test: Add 3rd participant converts to group
- [ ] Test: getUserConversations real-time listener
- [ ] Test: updateConversationLastMessage

Why critical: Group chat complexity, deterministic IDs

#### 2.5 SQLite Cache Integration (30 min)
File: `services/__tests__/sqliteService.integration.test.ts`
- [ ] Test: initDB creates tables
- [ ] Test: cacheMessage stores and retrieves
- [ ] Test: getCachedMessages loads conversation
- [ ] Test: Handle 500+ messages

Why critical: Instant loads, offline UX

**Deliverable**: 5 integration test files passing against Firebase Emulator

**Priority**: 🔴 **HIGH** - Core functionality

---

### Phase 3: Unit Tests (2 hours) 🟡 MEDIUM

**Goal**: Expand existing placeholder tests to 70%+ coverage

**Tasks**:

#### 3.1 Phone Format Utility (20 min)
File: `utils/__tests__/phoneFormat.test.ts` (exists, expand)
- [ ] Add international number tests (+44, +61, etc.)
- [ ] Add invalid format edge cases
- [ ] Test: Empty string, special characters

#### 3.2 Message Helpers (20 min)
File: `utils/__tests__/messageHelpers.test.ts` (exists, expand)
- [ ] Test all formatTimestamp cases: "Just now", "5m ago", "2h ago", "Yesterday", full date
- [ ] Test edge cases: future timestamps, null values

#### 3.3 Typing Indicator Hook (30 min)
File: `hooks/__tests__/useTypingIndicator.test.ts` (exists, expand)
- [ ] Test debounce logic (500ms timeout)
- [ ] Test getTypingText for 1, 2, 3+ users
- [ ] Test cleanup on unmount

#### 3.4 Presence Service (20 min)
File: `services/__tests__/presenceService.test.ts` (exists, expand)
- [ ] Test setUserOnline with onDisconnect handler
- [ ] Test subscribeToUserPresence callback

#### 3.5 Contact Service (30 min)
File: `services/__tests__/contactService.test.ts` (exists, expand)
- [ ] Test normalizePhoneNumber logic
- [ ] Test matchPhoneNumbers batch queries (10-item limit)
- [ ] Test searchUserByPhone

**Deliverable**: 5 unit test files with real assertions (not placeholders)

**Priority**: 🟡 **MEDIUM** - Coverage target

---

### Phase 4: E2E with Maestro (4 hours) 🔴 HIGH

**Goal**: Automate the 7 critical test scenarios from MVP Task List

**Setup** (1 hour):
- [ ] Install Maestro CLI: `brew tap mobile-dev-inc/tap && brew install maestro`
- [ ] Add testID props to all screens (30 min)
  - `app/auth/phone-login.tsx`
  - `app/auth/verify-otp.tsx`
  - `app/(tabs)/index.tsx`
  - `app/chat/[id].tsx`
  - `app/new-message.tsx`
- [ ] Create `maestro/` directory structure
- [ ] Test Maestro can launch Expo Go: `maestro test maestro/smoke.yaml`

**E2E Flows** (3 hours):

#### 4.1 Scenario 1: Real-Time Chat (30 min)
File: `maestro/01-realtime-chat.yaml`
- [ ] User A sends 20 messages rapidly
- [ ] Assert all appear on User B within 2 seconds
- [ ] Verify no duplicates, correct order

**Test on**: iOS Simulator + Android Emulator (2 devices)

#### 4.2 Scenario 2: Offline Resilience (30 min)
File: `maestro/02-offline-resilience.yaml`
- [ ] User A goes offline (airplane mode)
- [ ] Sends 3 messages (queued)
- [ ] Reconnects → all 3 deliver within 10s

**Test on**: iOS Simulator with Network Link Conditioner

#### 4.3 Scenario 3: Background Messages (30 min)
File: `maestro/03-background-messages.yaml`
- [ ] User A backgrounds app
- [ ] User B sends message
- [ ] Assert notification appears
- [ ] Tap notification → opens correct chat

**Test on**: iOS Simulator (supports notifications in Expo Go)

#### 4.4 Scenario 4: Force Quit Persistence (20 min)
File: `maestro/04-force-quit-persistence.yaml`
- [ ] User A sends 5 messages
- [ ] Force quit app
- [ ] Reopen → assert all 5 messages visible instantly

**Test on**: iOS Simulator

#### 4.5 Scenario 5: Poor Network (20 min)
File: `maestro/05-poor-network.yaml`
- [ ] Enable 3G throttling
- [ ] Send message
- [ ] Assert delivers within 5 seconds
- [ ] No crashes, UI responsive

**Test on**: iOS Simulator with Network Link Conditioner

#### 4.6 Scenario 6: Rapid Fire (20 min)
File: `maestro/06-rapid-fire.yaml`
- [ ] Send 20+ messages as fast as possible
- [ ] Assert all delivered in order
- [ ] Timestamps sequential

**Test on**: iOS Simulator

#### 4.7 Scenario 7: Group Chat (30 min)
File: `maestro/07-group-chat.yaml`
- [ ] Create group with 3 users
- [ ] User A sends message
- [ ] Assert User B and User C receive
- [ ] Read receipts track per-user

**Test on**: iOS + Android + physical device (if available)

**Deliverable**: 7 Maestro flows passing on simulators

**Priority**: 🔴 **HIGH** - Validates critical user journeys

---

### Phase 5: Security & Rules (1 hour) 🟡 MEDIUM

**Goal**: Test Firestore security rules enforcement

**Tasks**:

#### 5.1 Setup Rules Testing (20 min)
- [ ] Install `@firebase/rules-unit-testing`
- [ ] Create `firestore.rules.test.ts`
- [ ] Setup test environment pointing to emulator

#### 5.2 Email Uniqueness Test (15 min)
- [ ] Test: User 1 creates email → User 2 tries same email → FAIL
- [ ] Verify `usersByEmail` collection rules

#### 5.3 Phone Uniqueness Test (15 min)
- [ ] Test: User 1 creates phone → User 2 tries same phone → FAIL
- [ ] Verify `usersByPhone` collection rules

#### 5.4 Conversation Access Test (10 min)
- [ ] Test: User in participants can read/write
- [ ] Test: User not in participants cannot read

**Deliverable**: Security rules tested and enforced

**Priority**: 🟡 **MEDIUM** - Production readiness

---

### Phase 6: Coverage & Polish (1 hour) 🟢 LOW

**Goal**: Reach 70%+ coverage and document testing

**Tasks**:

#### 6.1 Generate Coverage Report (5 min)
```bash
npm test -- --coverage --coverageReporters=text --coverageReporters=html
```

#### 6.2 Identify Low-Coverage Files (10 min)
Expected gaps:
- `services/authService.ts` - Phone auth error paths
- `services/notificationService.ts` - FCM token handling
- `app/chat/[id].tsx` - Chat screen logic (needs component tests)

#### 6.3 Add Missing Tests (30 min)
Focus on files below 50% coverage

#### 6.4 Document Testing Guide (15 min)
Create `docs/TESTING_GUIDE.md`:
- How to run tests
- How to start emulators
- How to run Maestro flows
- How to add new tests

**Deliverable**: 70%+ coverage achieved, testing documented

**Priority**: 🟢 **LOW** - Polish

---

## Success Criteria

By end of testing roadmap (12 hours), MessageAI will have:

✅ **Firebase Emulator**: Running with npm scripts  
✅ **Integration Tests**: 5 test files covering Auth, Messages, Conversations, Offline, SQLite  
✅ **Unit Tests**: 5 test files expanded from placeholders  
✅ **E2E Tests**: 7 Maestro flows for all critical scenarios  
✅ **Security Rules Tests**: Email/phone uniqueness enforced  
✅ **Coverage**: 70%+ statements, 60%+ branches  
✅ **Documentation**: TESTING_GUIDE.md with setup instructions

---

## Quick Start: First 30 Minutes

To get started immediately:

```bash
# 1. Setup Firebase Emulator (10 min)
firebase init emulators
# Select: Auth (9099), Firestore (8080), Functions (5001), Storage (9199)

# 2. Create emulator connector (10 min)
# Create services/__tests__/setup.ts with connectAuthEmulator, etc.

# 3. Write first integration test (10 min)
# Create services/__tests__/authService.integration.test.ts
# Test: Sign up with phone → verify user created in Firestore

# 4. Run test against emulator
npm run test:emulators  # In one terminal
npm run test:integration  # In another terminal

# Expected: ✅ 1 passing test
```

---

## Comparison: Original vs. Improved Prompt

| Aspect | Original Prompt | Improved Prompt |
|--------|----------------|-----------------|
| **Context** | Generic Expo app | MessageAI-specific (10 features, 11 test files) |
| **Priorities** | No prioritization | 6 phases, 12 hours, clear priority levels |
| **Emulator Setup** | Mentioned | Complete Task 1.6b implementation guide |
| **Test Examples** | High-level | Full working code for each test type |
| **E2E Scenarios** | Generic | 7 specific scenarios from MVP Task List |
| **Coverage** | Mentioned | Gap analysis + path to 70%+ target |
| **Security** | Not mentioned | Firestore rules testing with examples |
| **Sequencing** | No dependencies | Phase 1 unblocks Phase 2, etc. |
| **Time Estimates** | None | 12 hours total, per-task estimates |

---

## Next Steps

1. **Review** this roadmap with team
2. **Schedule** 12-hour testing sprint (2-3 days)
3. **Start** with Phase 1 (Firebase Emulator setup)
4. **Track** progress in `memory_bank/06_active_context_progress.md`
5. **Update** this document as tests are completed

---

## Notes

- Testing was **intentionally deferred** during MVP development to ship faster
- Now we need to **backfill tests** before production
- Focus on **integration tests** over unit tests (more valuable for Firebase apps)
- **E2E tests** validate the critical user journeys that matter most
- **Don't aim for 100% coverage** - 70%+ with high-value tests is better than 90%+ with brittle tests

---

**Status**: Ready to execute  
**Owner**: Testing team  
**Timeline**: 12 hours (2-3 days)  
**Blocker**: None - all prerequisites met

