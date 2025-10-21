# E2E Testing with Maestro - Setup Guide

**Status:** ⏳ Not Yet Implemented  
**Estimated Time:** 4-5 hours  
**Priority:** Medium (after core integration tests)

---

## 📋 Overview

End-to-end tests validate complete user workflows using Maestro, a mobile UI automation framework. This document outlines what needs to be done to implement E2E testing for MessageAI.

---

## 🎯 7 Critical Test Scenarios (From MVP Requirements)

These scenarios must be automated with Maestro:

### 1. Real-Time Chat (2 Simulators)
- User A sends 20 messages rapidly
- All appear on User B within 2 seconds
- No duplicates, correct order, < 1s latency per message

### 2. Offline Resilience
- User A goes offline (airplane mode)
- Sends 3 messages (queued locally)
- Reconnects → all 3 deliver within 10 seconds

### 3. Background Messages
- User A backgrounds app
- User B sends message
- User A receives notification, tap opens correct chat

### 4. Force Quit Persistence
- User A sends 5 messages
- Force quits app
- Reopens → all 5 messages load instantly from SQLite

### 5. Poor Network (3G)
- Throttle network to 3G speed
- Send message → may take 3-5s but delivers successfully
- No crashes, UI responsive

### 6. Rapid Fire (20+ Messages)
- Send 20+ messages as fast as possible
- All delivered in chronological order
- Timestamps sequential, no drops

### 7. Group Chat (3+ Users)
- Create group with 3 users
- User A sends message → B and C receive
- Read receipts track per-user (readBy array)
- Typing shows individual names

---

## 🚀 Prerequisites

### 1. Install Maestro CLI

```bash
# macOS
brew tap mobile-dev-inc/tap
brew install maestro

# Verify installation
maestro --version
```

### 2. Add testID Props to All Screens

Every interactive element needs a `testID` for Maestro to find it:

```typescript
// ✅ Example
<TextInput testID="phone-input" {...props} />
<TouchableOpacity testID="send-button" onPress={send}>
<View testID={`conversation-${userId}`}>
<Text testID={`message-${messageId}`}>
```

**Files to Update:**
- `app/auth/phone-login.tsx`
- `app/auth/verify-otp.tsx`
- `app/(tabs)/index.tsx` (conversation list)
- `app/(tabs)/contacts.tsx`
- `app/chat/[id].tsx` (chat screen)
- `app/new-message.tsx`
- `components/` (all reusable components)

### 3. Test Accounts

Create dedicated test accounts in Firebase:
- User A: `+16505551001` (Test number)
- User B: `+16505551002` (Test number)
- User C: `+16505551003` (Test number)

OTP code for test numbers: `123456`

---

## 📁 Project Structure

```
MessageAI/
├── maestro/
│   ├── flows/
│   │   ├── 01-realtime-chat.yaml
│   │   ├── 02-offline-resilience.yaml
│   │   ├── 03-background-messages.yaml
│   │   ├── 04-force-quit-persistence.yaml
│   │   ├── 05-poor-network.yaml
│   │   ├── 06-rapid-fire.yaml
│   │   └── 07-group-chat.yaml
│   └── helpers/
│       ├── auth-login.yaml
│       └── create-conversation.yaml
└── package.json
```

---

## 📝 Example Maestro Flow

### Scenario 1: Real-Time Chat

**File:** `maestro/flows/01-realtime-chat.yaml`

```yaml
appId: host.exp.Exponent  # Expo Go
---
# Scenario 1: Real-Time Chat (2 Simulators)
# User A sends 20 messages, User B receives all in < 2s

- launchApp:
    appId: ${APP_ID}
    arguments:
      exp: "exp://192.168.1.X:8081"

# Login as User A
- tapOn:
    testID: "phone-input"
- inputText: "+16505551001"
- tapOn:
    testID: "get-otp-button"
- inputText: "123456"
- tapOn:
    testID: "verify-button"
- assertVisible:
    testID: "conversations-list"

# Open chat with User B
- tapOn:
    testID: "conversation-user-b"
- assertVisible:
    testID: "chat-screen"

# Send 20 messages rapidly
- repeat:
    times: 20
    commands:
      - tapOn:
          testID: "message-input"
      - inputText: "Message ${iteration}"
      - tapOn:
          testID: "send-button"
      - assertVisible: "Message ${iteration}"

# Verify all messages sent
- scroll:
    direction: DOWN
    maxScrolls: 5
- assertVisible: "Message 20"

# On User B device (run in parallel):
# - Assert all 20 messages appear
# - Verify order (1, 2, 3, ..., 20)
# - Check timestamps < 2s apart
```

---

## 🔧 Implementation Steps

### Step 1: Add testID Props (2 hours)

**Priority Order:**
1. `app/auth/phone-login.tsx` - Phone input, Get OTP button
2. `app/auth/verify-otp.tsx` - OTP input, Verify button
3. `app/(tabs)/index.tsx` - Conversation items, compose button
4. `app/chat/[id].tsx` - Message input, send button, message items
5. `app/new-message.tsx` - Search input, user items, send button

**Example:**

```typescript
// Before
<TextInput placeholder="Enter phone number" {...props} />

// After
<TextInput
  testID="phone-input"
  placeholder="Enter phone number"
  {...props}
/>
```

### Step 2: Create Helper Flows (1 hour)

**`maestro/helpers/auth-login.yaml`:**
```yaml
# Reusable login flow
commands:
  - tapOn:
      testID: "phone-input"
  - inputText: ${PHONE_NUMBER}
  - tapOn:
      testID: "get-otp-button"
  - inputText: "123456"
  - tapOn:
      testID: "verify-button"
  - assertVisible:
      testID: "conversations-list"
```

Usage:
```yaml
- runFlow:
    file: ../helpers/auth-login.yaml
    env:
      PHONE_NUMBER: "+16505551001"
```

### Step 3: Write First Scenario (30 min)

Start with simplest: Scenario 4 (Force Quit Persistence)
- Single device
- No network simulation
- Clear pass/fail criteria

### Step 4: Test on Simulators (30 min)

```bash
# Start iOS Simulator
xcrun simctl boot "iPhone 17 Pro"

# Start Expo
npm start

# Press 'i' to open in simulator

# Run Maestro test
maestro test maestro/flows/01-realtime-chat.yaml
```

### Step 5: Implement Remaining Scenarios (2 hours)

One scenario at a time, test each before moving to next.

---

## 🧪 Running E2E Tests

### Single Test
```bash
maestro test maestro/flows/01-realtime-chat.yaml
```

### All Tests
```bash
maestro test maestro/flows/
```

### With Screenshots
```bash
maestro test --screenshots maestro/flows/01-realtime-chat.yaml
```

### Continuous Mode
```bash
maestro test --continuous maestro/flows/
```

---

## 📊 Success Criteria

Each scenario must:
- ✅ Run without crashes
- ✅ Complete in < 2 minutes
- ✅ Pass consistently (95%+ success rate)
- ✅ Validate all assertions
- ✅ Handle race conditions gracefully

---

## 🚨 Common Issues

### Issue 1: Element Not Found

**Error:** `Element with testID "send-button" not found`

**Solution:**
- Verify testID was added to component
- Check for typos in testID string
- Ensure element is visible (not hidden by keyboard/modal)

### Issue 2: Timing Issues

**Error:** `Assertion failed: Expected "Message 20" to be visible`

**Solution:**
- Add explicit wait: `- waitForVisible: { testID: "message-20" }`
- Increase timeout: `timeout: 10000`
- Use `runFlow: { when: { visible: ... } }`

### Issue 3: Network Simulation

**Challenge:** Maestro doesn't directly control network

**Solution:**
- Use iOS Simulator's Network Link Conditioner
- Or use Charles Proxy to throttle network
- Document manual setup steps

---

## 📚 Resources

### Maestro Documentation
- **Website:** https://maestro.mobile.dev
- **GitHub:** https://github.com/mobile-dev-inc/maestro
- **Examples:** https://maestro.mobile.dev/examples

### MessageAI Test Data
- **Test accounts:** Firebase Console → Authentication
- **Test numbers:** +1 650-555-1001/1002/1003
- **OTP code:** 123456 (for test numbers)

---

## 🎯 Next Steps

1. ✅ **Read this guide**
2. ⏳ **Install Maestro CLI**
3. ⏳ **Add testID props to all screens** (Start with auth screens)
4. ⏳ **Create helper flows** (login, create conversation)
5. ⏳ **Implement Scenario 4** (Force Quit - simplest)
6. ⏳ **Implement remaining 6 scenarios**
7. ⏳ **Add to CI/CD pipeline**

---

## 📅 Timeline

- **Week 1:** Setup + testID props (2 hours)
- **Week 2:** Helper flows + Scenario 4 (1 hour)
- **Week 3:** Scenarios 1, 6, 7 (2 hours)
- **Week 4:** Scenarios 2, 3, 5 (2 hours)
- **Week 5:** Polish + CI/CD (1 hour)

**Total:** ~8-10 hours spread over 5 weeks

---

## 💡 Pro Tips

1. **Start Simple:** Force Quit scenario is easiest (single device, no network)
2. **Test Locally First:** Debug on simulator before moving to CI
3. **Use Variables:** `${PHONE_NUMBER}` instead of hardcoded values
4. **Screenshot Everything:** Add `- screenshot: step-name.png` for debugging
5. **Parallel Tests:** Run 2+ simulators for real-time scenarios

---

**Status:** Ready to implement  
**Blocker:** Requires testID props addition (2 hours)  
**Priority:** Medium (after integration tests reach 70% coverage)

---

**Last Updated:** October 21, 2025  
**Author:** Testing Agent  
**Version:** 1.0

