# Rubric Readiness Plan (UPDATED - Post Session 5)

**Date:** October 22, 2025 (Updated after Session 5)  
**Status:** Targeting A-level score (90–100) for non-AI sections  
**Confidence:** 70% → 95% with this plan  
**Current State:** MVP 100% Complete + Production Polish ✅  
**Remaining Work:** 2.5-3.5 days of foundation hardening

---

## ✅ What Changed Since Original Plan (Session 5 Completed)

**Session 5 Improvements (6 commits, 93 files changed):**
- ✅ **P6 (Lifecycle) - 90% DONE:** Notification cleanup on app launch, navigation fixes, reconnection already working
- ✅ **P5 (Network) - 50% DONE:** 10s send timeout + 5s retry implemented, just need UI status chips
- ✅ App freeze on relaunch fixed (navigation animation setting)
- ✅ Stale notifications eliminated (clear both delivered + scheduled on launch)
- ✅ Unread badge instant clearing (optimistic UI update)
- ✅ Status indicators accurate (online/background/offline)
- ✅ Navigation stuck issues resolved (proper cleanup + memoization)
- ✅ Notifications from deleted conversations filtered
- ✅ 350 lines dead code removed
- ✅ 82 docs reorganized into session-notes/

**Confidence Update:** 70% → **85%** (Session 5) → **95%** (with remaining work)

---

## 📊 Updated Summary of Current Risks

**CRITICAL (Must Fix):**
1. **Force-quit message persistence (75%)** → P1: Messages right before kill not guaranteed to queue
2. **Rapid-fire performance (80%)** → P2: ScrollView + 20+ messages causes re-render churn, no batching
3. **Conversation race conditions** → P4: No lastMessageId guard, multi-device conflicts possible

**HIGH (Should Fix):**
4. **Image upload robustness** → P3: Fixed 5MB threshold, no progressive tiers, Android URI edge cases
5. **Network UI feedback** → P5: Timeout logic exists, but no inline "Queued • Tap to retry" chips

**MEDIUM (Nice to Have):**
6. **Metrics/telemetry** → P0: No runtime metrics for debugging under load

---

## 🎯 Updated Phased Roadmap (Priority → Acceptance Criteria)

### ✅ P6 – Lifecycle & Notifications (0.1 day) - MOSTLY COMPLETE
**Status:** 90% done (Session 5)  
**Remaining work:** Minor audit logging + deep-link hardening

**What's Already Done:**
- ✅ Stale notification cleanup on app launch
- ✅ Background/foreground handling with AppState
- ✅ Reconnection with offline queue processing
- ✅ Navigation freeze fix
- ✅ Active conversation tracking (100ms delay)

**What's Left:**
- Add reconnection audit logs (console.log timestamps)
- Ensure notification tap always clears active conversation before navigation

**Time:** 0.5 hours  
**Acceptance:**
- Foregrounding after 30s offline → messages and presence update within 1–2s ✅ (already works)
- Notification tap always opens correct chat; no duplicate navigation ✅ (needs verification)

---

### 🔥 P1 – Force-Quit Persistence (0.5 day) - CRITICAL
**Status:** Not started  
**Current confidence:** 75% → Target: 95%

**Problem:** Messages sent right before app kill may be lost

**Implementation:**
1. Change to **queue-first strategy** in `app/chat/[id].tsx`:
   - Always call `queueMessage()` BEFORE `sendMessageWithTimeout()`
   - Remove from queue on successful send
   - SQLite cache updated immediately (optimistic)
   
2. Add `removeFromQueue(localId)` helper in `services/offlineQueue.ts`:
   ```typescript
   export const removeFromQueue = async (localId: string): Promise<void> => {
     const queue = await getQueue();
     const filtered = queue.filter(msg => msg.localId !== localId);
     await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
   }
   ```

3. Update `handleSend()` flow:
   ```typescript
   // 1. Queue first (pessimistic)
   await queueMessage(optimisticMessage);
   
   // 2. Try to send
   try {
     const sentMessage = await sendMessageWithTimeout(...);
     await removeFromQueue(localId); // Remove on success
   } catch (error) {
     // Message stays in queue for retry
   }
   ```

**Time:** 4 hours  
**Files:** `app/chat/[id].tsx`, `services/offlineQueue.ts`  
**Acceptance:**
- Kill app within 200ms of tapping Send → on relaunch, message appears in chat after reconnect ✅
- Queue contains 0 after successful resend ✅

---

### 🔥 P2 – Rapid-Fire Performance (1 day) - CRITICAL
**Status:** Not started  
**Current confidence:** 80% → Target: 95%

**Problems:**
1. **ScrollView** (line 791-923 in chat/[id].tsx) - not virtualized, renders all messages
2. **No batching** - 2 Firestore writes per message (message + conversation update)
3. **No SQLite batching** - sync write per message blocks main thread
4. **Inline handlers** - recreated on every render

**Implementation:**

**Part 1: Replace ScrollView with FlatList** (2 hours)
```typescript
<FlatList
  ref={flatListRef}
  data={messages}
  keyExtractor={item => item.id}
  renderItem={({ item, index }) => <MessageRow message={item} index={index} />}
  contentContainerStyle={styles.messagesContent}
  inverted  // Latest at bottom
  removeClippedSubviews={true}
  maxToRenderPerBatch={20}
  windowSize={21}
  initialNumToRender={20}
/>
```

**Part 2: Batch Conversation Updates** (2 hours)
Add debounced update to `services/conversationService.ts`:
```typescript
let updateTimer: NodeJS.Timeout | null = null;
let pendingUpdate: { conversationId: string, text: string, senderId: string } | null = null;

export const updateConversationLastMessageBatched = (
  conversationId: string,
  text: string,
  senderId: string
) => {
  pendingUpdate = { conversationId, text, senderId };
  
  if (updateTimer) clearTimeout(updateTimer);
  
  updateTimer = setTimeout(async () => {
    if (pendingUpdate) {
      await updateConversationLastMessage(
        pendingUpdate.conversationId,
        pendingUpdate.text,
        pendingUpdate.senderId
      );
      pendingUpdate = null;
    }
  }, 300); // 300ms debounce
};
```

**Part 3: Batch SQLite Writes** (2 hours)
Add buffered writes to `services/sqliteService.ts`:
```typescript
let writeBuffer: Message[] = [];
let writeTimer: NodeJS.Timeout | null = null;

export const cacheMessageBatched = (message: Message) => {
  writeBuffer.push(message);
  
  if (writeTimer) clearTimeout(writeTimer);
  
  writeTimer = setTimeout(async () => {
    if (writeBuffer.length > 0) {
      const batch = [...writeBuffer];
      writeBuffer = [];
      
      // Write all at once
      batch.forEach(msg => cacheMessage(msg));
    }
  }, 500); // 500ms buffer
};
```

**Part 4: Memoize Components** (1 hour)
```typescript
const MessageRow = memo(({ message, index }) => {
  // Component logic
});
```

**Time:** 8 hours  
**Files:** `app/chat/[id].tsx`, `services/conversationService.ts`, `services/sqliteService.ts`  
**Acceptance:**
- 50 messages in 5 seconds: stable 55–60 FPS on iPhone 17 sim ✅
- Firestore writes ≈ 1 per message (batched conversation updates ≤ 3 per burst) ✅
- No dropped frames, smooth scrolling ✅

---

### 🔥 P4 – Multi-Device Concurrent Edits (0.5-1 day) - CRITICAL
**Status:** Not started  
**Current confidence:** 70% → Target: 95%

**Problem:** Race condition when two devices update conversation simultaneously

**Implementation:**

**Part 1: Add Message ID Guard** (2 hours)
Update `services/conversationService.ts`:
```typescript
export const updateConversationLastMessage = async (
  conversationId: string,
  text: string,
  senderId: string,
  messageId: string  // NEW parameter
): Promise<void> => {
  const convRef = doc(db, 'conversations', conversationId);
  
  // Get current state
  const convSnap = await getDoc(convRef);
  const current = convSnap.data();
  
  // Only update if this message is newer
  if (current?.lastMessageId && current.lastMessageId >= messageId) {
    console.log('Skipping stale update');
    return;
  }
  
  await updateDoc(convRef, {
    lastMessage: {
      text,
      senderId,
      timestamp: serverTimestamp(),
    },
    lastMessageId: messageId,  // Store for comparison
    updatedAt: serverTimestamp(),
  });
};
```

**Part 2: Update All Call Sites** (1 hour)
Pass messageId to all `updateConversationLastMessage()` calls

**Part 3: Atomic Unread Increments** (2 hours)
Use Firestore increment for unread counts:
```typescript
await updateDoc(convRef, {
  [`unreadCount.${userId}`]: increment(1)
});
```

**Time:** 4-6 hours  
**Files:** `services/conversationService.ts`, `services/messageService.ts`, `app/chat/[id].tsx`  
**Acceptance:**
- Two devices send within 100ms → consistent final `lastMessage` ✅
- No unread count drift ✅

---

### ⚠️ P3 – Image Upload Robustness (0.5-1 day) - HIGH PRIORITY
**Status:** Not started  
**Current confidence:** 70% → Target: 90%

**Problems:**
- Fixed 5MB threshold (line 105 in imageService.ts)
- Single compression tier
- No MIME validation
- No upload timeout/retry
- fetch→blob may fail on Android URIs

**Implementation:**

**Part 1: Progressive Compression Tiers** (2 hours)
```typescript
export const compressImageProgressive = async (uri: string, size: number): Promise<string> => {
  let width = 1920;
  let quality = 0.7;
  
  // Tier 1: >10MB
  if (size > 10 * 1024 * 1024) {
    width = 1280;
    quality = 0.6;
  }
  
  // Tier 2: >20MB
  if (size > 20 * 1024 * 1024) {
    width = 1024;
    quality = 0.5;
  }
  
  // Tier 3: >50MB
  if (size > 50 * 1024 * 1024) {
    width = 800;
    quality = 0.4;
  }
  
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  
  return compressed.uri;
};
```

**Part 2: MIME Detection + Format Conversion** (1 hour)
```typescript
import * as FileSystem from 'expo-file-system';

const getMimeType = async (uri: string): Promise<string> => {
  const info = await FileSystem.getInfoAsync(uri);
  // Extract from URI or use expo-image-picker metadata
  return 'image/jpeg'; // Default
};

// Convert HEIC → JPEG on iOS
if (mimeType === 'image/heic') {
  uri = await convertToJPEG(uri);
}
```

**Part 3: Upload Timeout + Retry** (2 hours)
```typescript
export const uploadImageWithTimeout = async (
  uri: string,
  conversationId: string,
  timeoutMs = 15000
): Promise<string> => {
  const uploadPromise = uploadImage(uri, conversationId);
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Upload timeout')), timeoutMs)
  );
  
  try {
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (error) {
    // Retry once
    console.log('Upload failed, retrying...');
    return await Promise.race([uploadImage(uri, conversationId), timeoutPromise]);
  }
};
```

**Part 4: Android URI Handling** (1 hour)
Use `FileSystem.uploadAsync` for reliability

**Time:** 4-6 hours  
**Files:** `services/imageService.ts`, `app/chat/[id].tsx`  
**Acceptance:**
- 25MB photo uploads on iOS & Android with compression; total upload < 8s on Wi-Fi ✅
- Failed upload provides retry CTA without losing message draft ✅

---

### ⚠️ P5 – Slow Network UI Feedback (0.5 day) - MEDIUM PRIORITY
**Status:** 50% complete (timeout logic exists)  
**Current confidence:** 85% → Target: 95%

**What's Already Done:**
- ✅ 10s send timeout in `sendMessageWithTimeout()` (Session 3)
- ✅ 5s retry timeout in queue processing (Session 3)
- ✅ Exponential backoff (2s, 4s, 8s)

**What's Missing:**
- Inline status chips for queued messages
- Manual retry button

**Implementation:**

**Part 1: Queued Message UI** (2 hours)
```typescript
// In message bubble rendering
{message.status === 'queued' && (
  <View style={styles.queuedChip}>
    <Text style={styles.queuedText}>Queued</Text>
    <TouchableOpacity onPress={() => handleRetryMessage(message.localId)}>
      <Text style={styles.retryText}>Tap to retry</Text>
    </TouchableOpacity>
  </View>
)}
```

**Part 2: Manual Retry Handler** (1 hour)
```typescript
const handleRetryMessage = async (localId: string) => {
  const queue = await getQueue();
  const message = queue.find(m => m.localId === localId);
  
  if (message) {
    try {
      await sendMessageWithTimeout(...);
      await removeFromQueue(localId);
    } catch (error) {
      Alert.alert('Retry Failed', 'Message will be retried automatically when online');
    }
  }
};
```

**Time:** 3 hours  
**Files:** `app/chat/[id].tsx`, `services/offlineQueue.ts`  
**Acceptance:**
- On throttled 2G: sends convert to queued within 10s ✅ (already works)
- User can tap queued message to force retry ✅ (NEW)

---

### 📊 P0 – Verification & Guardrails (0.5 day) - OPTIONAL
**Status:** Not started  
**Priority:** Medium (helpful for debugging)

**Implementation:**

**Part 1: Runtime Metrics** (2 hours)
```typescript
// In messageService.ts
const metrics = {
  sendCount: 0,
  sendLatency: [] as number[],
  queueSize: 0,
  retryCount: 0,
};

export const logMetrics = () => {
  console.log('📊 Metrics:', {
    ...metrics,
    avgLatency: metrics.sendLatency.reduce((a, b) => a + b, 0) / metrics.sendLatency.length,
  });
};
```

**Part 2: Error Guards** (1 hour)
Wrap all async operations in try-catch with user-friendly messages

**Time:** 3 hours  
**Files:** `services/messageService.ts`, `services/offlineQueue.ts`, `services/conversationService.ts`  
**Acceptance:**
- Console logs show metrics on reconnect and after 20-message burst ✅
- No unhandled rejections ✅

---

## 📋 Updated Deliverables Checklist

### CRITICAL (Must Have)
- [ ] **P1:** Queue-first send + `removeFromQueue()` - 4 hours
- [ ] **P2:** FlatList + batching (conversation + SQLite) + memoization - 8 hours
- [ ] **P4:** Conflict-aware conversation updates (lastMessageId) - 4-6 hours

### HIGH (Should Have)
- [ ] **P3:** Robust image pipeline (compression tiers, MIME, timeout/retry) - 4-6 hours
- [ ] **P5:** Queued status UI + manual retry - 3 hours

### MEDIUM (Nice to Have)
- [ ] **P0:** Metrics + runtime guards - 3 hours
- [x] **P6:** Lifecycle reconnection (90% done) - 0.5 hours

**Total Time:** 26.5-33.5 hours → **2.5-3.5 days** of focused work

---

## 🎯 Updated Rubric Mapping (Non-AI Sections)

| Rubric Section | Current | Target | Priority Items |
|----------------|---------|--------|----------------|
| Real-Time Delivery | 85% | 95% | P2 (batching), P4 (conflicts) |
| Offline Support | 85% | 95% | P1 (queue-first), P5 (UI feedback) |
| Group Chat | 85% | 95% | P2 (performance), P4 (lastMessageId) |
| Mobile Lifecycle | 90% | 95% | P6 (minor audit logs) ✅ mostly done |
| Performance & UX | 80% | 95% | P2 (FlatList), P3 (media) |
| Documentation | 95% | 95% | ✅ Already excellent |

**Overall Confidence:** 85% → **95%** with P1-P5 complete

---

## 🧪 Updated Test Plan (Manual + Automated)

### Manual Scenarios (After Implementation)
1. **Force-quit test:** Send message → kill app within 200ms → relaunch → verify queued resend
2. **Rapid-fire test:** Send 50 messages in 5 seconds on 2 devices → observe FPS (55-60), no lag
3. **Multi-device test:** Two devices send within 100ms → verify consistent lastMessage
4. **Image upload test:** Upload 25MB photo on iOS & Android → verify compression + upload < 8s
5. **Slow network test:** Throttle to 2G → verify queued status chip + manual retry works
6. **Lifecycle test:** Background 30s → foreground → verify messages + presence update within 2s

### Automated (Follow-up)
- Integration tests for queue-first send & reconnection
- Unit tests for image compression selection and MIME conversion
- Performance tests for FlatList rendering (50+ messages)

---

## ⏱️ Updated Timeline (estimates)

**Day 1: Critical Fixes** (8 hours)
- Morning: P1 (Force-quit persistence) - 4 hours
- Afternoon: P4 (Multi-device conflicts) - 4 hours

**Day 2: Performance & Media** (8 hours)
- Morning: P2 Part 1-2 (FlatList + conversation batching) - 4 hours
- Afternoon: P2 Part 3-4 (SQLite batching + memoization) - 4 hours

**Day 3: Polish & Validation** (6-8 hours)
- Morning: P3 (Image robustness) - 4 hours
- Afternoon: P5 (Queued status UI) + P6 (audit logs) - 2-4 hours
- Evening: Manual testing all scenarios

**Total: 22-24 hours = 2.5-3 days**

---

## 🔗 Updated Links
- memory_bank/10_oct22_session5_polish.md (latest session)
- memory_bank/06_active_context_progress.md (all sessions)
- memory_bank/05_current_codebase_state.md (file status)
- docs/MessageAI Rubric.md (target criteria)

---

## ✅ Summary: What's Different

**Session 5 Completed:**
- ✅ Lifecycle & notifications (P6) - 90% done
- ✅ Network timeouts (P5) - 50% done
- ✅ Navigation fixes
- ✅ Code cleanup (350 lines removed)

**Still Critical:**
- 🔥 P1: Force-quit persistence (queue-first)
- 🔥 P2: Rapid-fire performance (FlatList + batching)
- 🔥 P4: Multi-device conflicts (lastMessageId)

**Confidence Journey:**
- Original: 70%
- After Session 5: 85%
- After P1-P5: **95%** ← Target

**Estimated Time:** 2.5-3.5 days of focused implementation

