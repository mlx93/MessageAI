# New Session Prompt: MVP Resilience Fixes to 95%

**Copy this entire prompt into a new Cursor session to implement the remaining resilience fixes.**

---

## 🎯 Objective

Implement the remaining 2 resilience priorities to bring MessageAI from **85% → 95% testing confidence** without breaking any existing features. This is a **2-hour implementation** with clear testing criteria.

**Current State:**
- ✅ App lifecycle (P1): COMPLETE - Background handling works
- ✅ Green/Yellow status indicators: COMPLETE
- ✅ Basic offline queue: Working
- ⚠️ Network timeouts (P4): NOT IMPLEMENTED - Need to add
- ⚠️ Offline UX polish (P2): Basic works, needs user feedback

---

## 📋 What to Implement

### **Priority 4: Network Timeouts (1 hour)** - CRITICAL
Users on 2G/3G connections see messages stuck "sending" forever with no feedback. We need:
1. Add `sendMessageWithTimeout()` wrapper to `services/messageService.ts`
2. Update `handleSend()` in `app/chat/[id].tsx` to use timeout version
3. Update `processQueue()` in `services/offlineQueue.ts` to return metrics and use timeouts

### **Priority 2: Offline UX Improvements (1 hour)** - POLISH
Offline functionality works, but users need better feedback. We need:
1. Add reconnection toast in `app/_layout.tsx` showing "2 messages sent"
2. Add "Reconnecting..." state to offline banner in `app/chat/[id].tsx`

---

## 🚨 CRITICAL: What NOT to Break

**DO NOT MODIFY THESE (they're already working):**
- ❌ `store/AuthContext.tsx` - AppState handling is COMPLETE, don't touch
- ❌ `services/presenceService.ts` - Green/Yellow indicators working, don't touch
- ❌ Swipe gesture code in `app/chat/[id].tsx` - Don't break the gesture handlers
- ❌ `app/(tabs)/index.tsx` - Status indicators working, don't touch
- ❌ Message rendering logic - Keep ScrollView, don't convert to FlatList
- ❌ `services/conversationService.ts` - Don't add debouncing

**ONLY ADD NEW CODE, DON'T MODIFY EXISTING WORKING FEATURES**

---

## 📖 Implementation Guide

Follow the detailed step-by-step guide in **`@MVP_RESILIENCE_TO_95_PERCENT.md`**. This document contains:
- Exact code to add
- Line numbers to find existing code
- Complete implementation examples
- Testing criteria for each change

**Key files to modify:**
1. `services/messageService.ts` - Add `sendMessageWithTimeout()` function
2. `app/chat/[id].tsx` - Update `handleSend()` to use timeout version, add reconnecting state
3. `services/offlineQueue.ts` - Update `processQueue()` to return metrics
4. `app/_layout.tsx` - Add reconnection toast

---

## 🧪 Testing Protocol

After implementation, test these scenarios:

### **Test 1: Slow Connection (P4)**
1. Enable Chrome DevTools → Network → Slow 3G
2. Send message
3. ✅ Should timeout after 10 seconds
4. ✅ Should show "Slow Connection" alert
5. ✅ Message should be queued
6. Switch to Fast 3G
7. ✅ Message should send successfully

### **Test 2: Offline → Online (P2)**
1. Enable airplane mode
2. Send 2 messages
3. ✅ Messages show as queued
4. Disable airplane mode
5. ✅ Banner shows "🔄 Reconnecting..." for 2 seconds
6. ✅ Alert shows "2 messages sent successfully"

### **Test 3: Regression (Critical)**
After all changes, verify these STILL work:
- [ ] Send message on normal connection → instant delivery
- [ ] Background app → User shows yellow indicator
- [ ] Foreground app → User shows green indicator
- [ ] Group chat with 3+ participants
- [ ] Image sending
- [ ] Swipe gestures still work
- [ ] Read receipts display
- [ ] Typing indicators

---

## ⚙️ Implementation Steps

### **Step 1: Add Network Timeout Wrapper (10 min)**

In `services/messageService.ts`, add this function at the END of the file:

```typescript
/**
 * Send message with timeout
 * Throws error if operation takes > 10 seconds
 */
export const sendMessageWithTimeout = async (
  conversationId: string, 
  text: string, 
  senderId: string, 
  localId: string,
  mediaURL?: string,
  timeoutMs: number = 10000
): Promise<string> => {
  return Promise.race([
    sendMessage(conversationId, text, senderId, localId, mediaURL),
    new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('Send timeout - poor connection')), timeoutMs)
    )
  ]);
};
```

**Verify:**
- Run linter
- No compilation errors
- Export is added

---

### **Step 2: Update handleSend with Timeout (30 min)**

In `app/chat/[id].tsx`:

1. Add import at top:
```typescript
import { sendMessageWithTimeout } from '../../services/messageService';
```

2. Find the `handleSend` function (around line 275-315)

3. Replace the `try` block with timeout logic (see full code in `@MVP_RESILIENCE_TO_95_PERCENT.md`)

**Key changes:**
- Use `sendMessageWithTimeout()` instead of `sendMessage()`
- Catch timeout errors specifically
- Show "Slow Connection" alert
- Queue message on timeout

---

### **Step 3: Update processQueue (20 min)**

In `services/offlineQueue.ts`:

1. Update return type:
```typescript
export const processQueue = async (): Promise<{ sent: number; failed: number }> => {
```

2. Replace entire function body with version that:
   - Uses `sendMessageWithTimeout()` with 5 second timeout
   - Tracks sent/failed counts
   - Returns metrics object

See complete code in `@MVP_RESILIENCE_TO_95_PERCENT.md`.

---

### **Step 4: Add Reconnection Toast (20 min)**

In `app/_layout.tsx`:

1. Add import at top:
```typescript
import { Alert } from 'react-native';
```

2. Find the NetInfo listener (around line 30-37)

3. Replace with version that:
   - Tracks `wasOffline` state
   - Calls `await processQueue()` to get metrics
   - Shows Alert with success count

See complete code in `@MVP_RESILIENCE_TO_95_PERCENT.md`.

---

### **Step 5: Add Reconnecting State (20 min)**

In `app/chat/[id].tsx`:

1. Add state:
```typescript
const [isReconnecting, setIsReconnecting] = useState(false);
```

2. Update NetInfo listener to set `isReconnecting: true` for 2 seconds after reconnect

3. Update offline banner text:
```typescript
{isReconnecting ? '🔄 Reconnecting...' : '📡 No Internet Connection'}
```

See complete code in `@MVP_RESILIENCE_TO_95_PERCENT.md`.

---

### **Step 6: Test Everything (20 min)**

Run all test scenarios above. Verify:
- ✅ New features work
- ✅ Existing features still work
- ✅ No console errors
- ✅ No visual regressions

---

## 📊 Expected Results

After completion:

**Confidence Levels:**
- Real-time messaging: 95% ✅
- Background handling: 95% ✅
- Offline → Online: 95% ✅
- Poor network: 95% ✅
- Force-quit: 75% (acceptable)
- Rapid-fire: 80% (acceptable)
- Group chat: 95% ✅

**Overall: 95% testing confidence** 🎯

---

## 📁 Files to Attach

When starting the new session, attach:

**Required:**
1. `@MVP_RESILIENCE_TO_95_PERCENT.md` - Full implementation guide
2. `@memory_bank/` folder - Project context

**Files you'll be modifying:**
3. `services/messageService.ts`
4. `app/chat/[id].tsx`
5. `services/offlineQueue.ts`
6. `app/_layout.tsx`

---

## ✅ Definition of Done

You'll know you're done when:
1. [ ] `sendMessageWithTimeout()` function added and exported
2. [ ] `handleSend()` uses timeout version and handles timeout errors
3. [ ] `processQueue()` returns `{ sent, failed }` metrics
4. [ ] Reconnection toast shows message count
5. [ ] "Reconnecting..." appears for 2 seconds after reconnect
6. [ ] All 3 test scenarios pass
7. [ ] No console errors
8. [ ] Existing features still work (regression test)

---

## 🚀 Start Implementation

1. Attach the required files listed above
2. Start with Step 1 (Add network timeout wrapper)
3. Follow the detailed guide in `@MVP_RESILIENCE_TO_95_PERCENT.md`
4. Test each change as you go
5. Run full regression test at the end

**Time budget: 2.5 hours** (2h implementation + 30 min testing)

**Goal: 95% testing confidence without breaking any existing features** ✅

