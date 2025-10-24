# Implementation Prompt: Rubric Readiness Foundation Hardening

**Context:** You are implementing critical foundation improvements to make aiMessage production-ready with 95% testing confidence. All features are complete, but we need to harden the foundation against edge cases: force-quit persistence, rapid-fire performance, multi-device conflicts, and image upload robustness.

**Current State:** MVP 100% complete, 95% testing confidence achieved for core features, but 4 critical gaps remain that could cause failures under stress.

**Goal:** Implement P1-P5 priorities from RUBRIC_READINESS_PLAN_UPDATED.md to achieve rock-solid reliability, 95% confidence across ALL scenarios, and A-level rubric scores.

---

## 📁 Required Reading (In Order)

1. **`docs/RUBRIC_READINESS_PLAN_UPDATED.md`** - Complete implementation plan (READ FIRST)
2. **`memory_bank/06_active_context_progress.md`** - Current state + Session 5 improvements
3. **`memory_bank/05_current_codebase_state.md`** - File-by-file implementation details
4. **`docs/MessageAI Rubric.md`** - Target evaluation criteria

---

## 🎯 Implementation Order (Critical → Optional)

### Phase 1: Critical Foundation Fixes (Day 1 - 8 hours)

#### **Priority 1: Force-Quit Persistence** 🔥 BLOCKING
**Time:** 4 hours  
**Confidence Impact:** 75% → 95%  
**Files:** `app/chat/[id].tsx`, `services/offlineQueue.ts`

**Problem:** Messages sent right before app kill are lost (not queued).

**Implementation Steps:**

1. **Add `removeFromQueue()` to offlineQueue.ts** (30 min)
   ```typescript
   export const removeFromQueue = async (localId: string): Promise<void> => {
     try {
       const queue = await getQueue();
       const filtered = queue.filter(msg => msg.localId !== localId);
       await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
       console.log(`✅ Removed message ${localId} from queue`);
     } catch (error) {
       console.error('Failed to remove from queue:', error);
     }
   };
   ```

2. **Change handleSend() to queue-first strategy** (3 hours)
   
   In `app/chat/[id].tsx`, find the `handleSend()` function and refactor:
   
   **Before (Optimistic-first):**
   ```typescript
   // Add optimistically
   setMessages(prev => [...prev, optimisticMessage]);
   
   // Try to send
   await sendMessageWithTimeout(...);
   ```
   
   **After (Queue-first):**
   ```typescript
   // 1. Queue FIRST (pessimistic - guarantees persistence)
   await queueMessage({
     localId,
     conversationId,
     text: inputText.trim(),
     senderId: user.uid,
     timestamp: new Date(),
   });
   
   // 2. Show optimistically in UI
   setMessages(prev => [...prev, optimisticMessage]);
   
   // 3. Cache immediately
   await cacheMessage(optimisticMessage);
   
   // 4. Try to send
   try {
     const sentMessage = await sendMessageWithTimeout(
       conversationId,
       inputText.trim(),
       user.uid,
       localId,
       undefined,
       10000
     );
     
     // 5. SUCCESS: Remove from queue
     await removeFromQueue(localId);
     console.log(`✅ Message sent and removed from queue: ${localId}`);
     
   } catch (error) {
     console.log(`⚠️ Send failed, message stays in queue: ${localId}`);
     // Message stays in queue for automatic retry on reconnect
     
     // Update UI to show "queued" status
     setMessages(prev =>
       prev.map(msg =>
         msg.localId === localId
           ? { ...msg, status: 'queued' }
           : msg
       )
     );
   }
   ```

3. **Update processQueue() to use removeFromQueue()** (30 min)
   
   In `services/offlineQueue.ts`, update the success path:
   ```typescript
   // On successful send
   await removeFromQueue(message.localId);
   sent++;
   ```

**Acceptance Criteria:**
- [ ] Kill app within 200ms of tapping Send → message in queue on relaunch
- [ ] Message appears in chat after reconnect
- [ ] Queue contains 0 after successful resend
- [ ] Test with airplane mode: queue → reconnect → auto-send → queue empty

---

#### **Priority 4: Multi-Device Concurrent Edits** 🔥 BLOCKING
**Time:** 4 hours  
**Confidence Impact:** 70% → 95%  
**Files:** `services/conversationService.ts`, `services/messageService.ts`, `app/chat/[id].tsx`

**Problem:** Race condition when two devices update lastMessage simultaneously.

**Implementation Steps:**

1. **Add lastMessageId guard to updateConversationLastMessage()** (2 hours)
   
   In `services/conversationService.ts`, find and update:
   
   ```typescript
   export const updateConversationLastMessage = async (
     conversationId: string,
     text: string,
     senderId: string,
     messageId: string  // NEW: message ID for ordering
   ): Promise<void> => {
     try {
       const convRef = doc(db, 'conversations', conversationId);
       
       // Get current state
       const convSnap = await getDoc(convRef);
       const current = convSnap.data();
       
       // Only update if this message is newer (compare IDs lexicographically)
       // UUIDs are time-sortable, so this works
       if (current?.lastMessageId && current.lastMessageId >= messageId) {
         console.log(`⏭️ Skipping stale update: ${messageId} is older than ${current.lastMessageId}`);
         return;
       }
       
       // Update with new message
       await updateDoc(convRef, {
         lastMessage: {
           text: text || 'Photo',
           senderId,
           timestamp: serverTimestamp(),
         },
         lastMessageId: messageId,  // Store for future comparisons
         updatedAt: serverTimestamp(),
         deletedBy: [],  // Clear deletedBy when new message arrives
       });
       
       console.log(`✅ Updated lastMessage for ${conversationId} with message ${messageId}`);
     } catch (error) {
       console.error('Failed to update conversation last message:', error);
       throw error;
     }
   };
   ```

2. **Update all call sites to pass messageId** (1.5 hours)
   
   Find all calls to `updateConversationLastMessage()` and add messageId:
   
   **In `services/messageService.ts`:**
   ```typescript
   // After successful send
   await updateConversationLastMessage(
     conversationId,
     text || 'Photo',
     senderId,
     messageRef.id  // Pass the message ID
   );
   ```
   
   **In `app/chat/[id].tsx`:**
   ```typescript
   // In handleSend after successful send
   await updateConversationLastMessage(
     conversationId,
     inputText.trim(),
     user.uid,
     localId  // Use localId (which becomes the message ID)
   );
   ```

3. **Add atomic unread count increments** (30 min)
   
   In `services/conversationService.ts`, use Firestore increment:
   ```typescript
   import { increment } from 'firebase/firestore';
   
   // When marking conversation as unread
   await updateDoc(convRef, {
     [`unreadCount.${userId}`]: increment(1)
   });
   ```

**Acceptance Criteria:**
- [ ] Two devices send within 100ms → consistent final lastMessage
- [ ] No unread count drift after rapid sends
- [ ] Older messages don't overwrite newer ones
- [ ] Test: Send from Device A at T+0ms, Device B at T+50ms → B's message wins

---

### Phase 2: Performance Optimization (Day 2 - 8 hours)

#### **Priority 2: Rapid-Fire Performance** 🔥 BLOCKING
**Time:** 8 hours  
**Confidence Impact:** 80% → 95%  
**Files:** `app/chat/[id].tsx`, `services/conversationService.ts`, `services/sqliteService.ts`

**Problem:** ScrollView + unbatched writes cause UI lag with 20+ messages.

**Part 1: Replace ScrollView with FlatList** (2 hours)

In `app/chat/[id].tsx`, find the ScrollView (line 791-923) and replace:

**Before:**
```typescript
<ScrollView 
  ref={scrollViewRef}
  style={styles.messagesContainer}
  contentContainerStyle={styles.messagesContent}
>
  {messages.map((message, index) => (
    // Message rendering
  ))}
</ScrollView>
```

**After:**
```typescript
<FlatList
  ref={flatListRef}
  data={messages}
  keyExtractor={item => item.id}
  renderItem={({ item: message, index }) => (
    <MessageRow 
      message={message}
      index={index}
      isOwnMessage={message.senderId === user.uid}
      formatReadReceipt={formatReadReceipt}
      getSenderInfo={getSenderInfo}
      formatDistanceToNow={formatDistanceToNow}
      containerPanGesture={containerPanGesture}
      blueBubblesAnimatedStyle={blueBubblesAnimatedStyle}
      isGroupChat={isGroupChat}
    />
  )}
  contentContainerStyle={styles.messagesContent}
  inverted  // Latest message at bottom
  removeClippedSubviews={true}
  maxToRenderPerBatch={20}
  windowSize={21}
  initialNumToRender={20}
  onEndReachedThreshold={0.5}
  onEndReached={loadMoreMessages}  // For pagination later
/>
```

**Extract MessageRow component:**
```typescript
const MessageRow = memo(({ 
  message, 
  index, 
  isOwnMessage,
  formatReadReceipt,
  getSenderInfo,
  formatDistanceToNow,
  containerPanGesture,
  blueBubblesAnimatedStyle,
  isGroupChat 
}) => {
  // Move all message rendering logic here
  // This prevents re-renders of messages when typing
});
```

**Part 2: Batch Conversation Updates** (2 hours)

In `services/conversationService.ts`, add debounced function:

```typescript
let updateTimer: NodeJS.Timeout | null = null;
let pendingUpdate: { conversationId: string, text: string, senderId: string, messageId: string } | null = null;

export const updateConversationLastMessageBatched = (
  conversationId: string,
  text: string,
  senderId: string,
  messageId: string
) => {
  // Store the latest update
  pendingUpdate = { conversationId, text, senderId, messageId };
  
  // Clear existing timer
  if (updateTimer) clearTimeout(updateTimer);
  
  // Set new timer (300ms debounce)
  updateTimer = setTimeout(async () => {
    if (pendingUpdate) {
      await updateConversationLastMessage(
        pendingUpdate.conversationId,
        pendingUpdate.text,
        pendingUpdate.senderId,
        pendingUpdate.messageId
      );
      pendingUpdate = null;
    }
  }, 300);
};
```

**Update handleSend() to use batched version:**
```typescript
// Instead of immediate update
await updateConversationLastMessageBatched(
  conversationId,
  inputText.trim(),
  user.uid,
  localId
);
```

**Part 3: Batch SQLite Writes** (2 hours)

In `services/sqliteService.ts`, add buffered writes:

```typescript
let writeBuffer: Message[] = [];
let writeTimer: NodeJS.Timeout | null = null;

export const cacheMessageBatched = (message: Message) => {
  writeBuffer.push(message);
  
  // Clear existing timer
  if (writeTimer) clearTimeout(writeTimer);
  
  // Flush after 500ms of no new messages
  writeTimer = setTimeout(async () => {
    if (writeBuffer.length > 0) {
      const batch = [...writeBuffer];
      writeBuffer = [];
      
      console.log(`💾 Batching ${batch.length} SQLite writes`);
      
      // Write all at once
      try {
        const db = await openDatabaseSync('messages.db');
        batch.forEach(msg => {
          db.runSync(
            `INSERT OR REPLACE INTO messages (id, conversationId, senderId, text, timestamp, mediaURL, type, deliveryStatus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [msg.id, msg.conversationId, msg.senderId, msg.text || '', msg.timestamp.toISOString(), msg.mediaURL || '', msg.type || 'text', msg.deliveryStatus || 'sent']
          );
        });
      } catch (error) {
        console.error('Batched SQLite write failed:', error);
      }
    }
  }, 500);
};

// Add flush function for immediate writes (like app close)
export const flushCacheBuffer = async () => {
  if (writeTimer) clearTimeout(writeTimer);
  if (writeBuffer.length > 0) {
    const batch = [...writeBuffer];
    writeBuffer = [];
    batch.forEach(msg => cacheMessage(msg));
  }
};
```

**Part 4: Memoization** (2 hours)

Extract and memoize expensive computations:

```typescript
// Memoize message formatting
const formatMessageTime = useMemo(() => {
  return (timestamp: Date) => format(timestamp, 'h:mm a');
}, []);

// Memoize sender info lookup
const getSenderInfoMemo = useCallback((senderId: string) => {
  return participantDetailsMap[senderId] || { displayName: 'Unknown', initials: '?' };
}, [participantDetailsMap]);

// Memoize gesture handler (already done in Session 5)
const containerPanGesture = useMemo(() => 
  Gesture.Pan()
    .onUpdate(...)
    .onEnd(...),
  []
);
```

**Acceptance Criteria:**
- [ ] Send 50 messages in 5 seconds → stable 55-60 FPS (use React DevTools profiler)
- [ ] Firestore writes ≈ 1 per message (batched conversation updates ≤ 3 per burst)
- [ ] No dropped frames when scrolling through 100+ messages
- [ ] Typing doesn't cause message re-renders (check with React DevTools)

---

### Phase 3: Media & UX Polish (Day 3 - 6-8 hours)

#### **Priority 3: Image Upload Robustness** ⚠️ HIGH
**Time:** 4-6 hours  
**Confidence Impact:** 70% → 90%  
**Files:** `services/imageService.ts`, `app/chat/[id].tsx`

**Problem:** Fixed 5MB threshold, no MIME validation, no retry logic.

**Part 1: Progressive Compression Tiers** (2 hours)

In `services/imageService.ts`, replace `compressImage()`:

```typescript
export const compressImageProgressive = async (uri: string, size: number): Promise<string> => {
  let width = 1920;
  let quality = 0.7;
  
  console.log(`📸 Compressing image: ${(size / 1024 / 1024).toFixed(2)}MB`);
  
  // Tier 1: >10MB (aggressive)
  if (size > 10 * 1024 * 1024) {
    width = 1280;
    quality = 0.6;
    console.log('📸 Using Tier 1 compression (10MB+): 1280px, 60% quality');
  }
  
  // Tier 2: >20MB (very aggressive)
  if (size > 20 * 1024 * 1024) {
    width = 1024;
    quality = 0.5;
    console.log('📸 Using Tier 2 compression (20MB+): 1024px, 50% quality');
  }
  
  // Tier 3: >50MB (extreme)
  if (size > 50 * 1024 * 1024) {
    width = 800;
    quality = 0.4;
    console.log('📸 Using Tier 3 compression (50MB+): 800px, 40% quality');
  }
  
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  
  const newSize = await getFileSize(compressed.uri);
  console.log(`✅ Compressed: ${(size / 1024 / 1024).toFixed(2)}MB → ${(newSize / 1024 / 1024).toFixed(2)}MB`);
  
  return compressed.uri;
};
```

**Part 2: Upload with Timeout + Retry** (2 hours)

```typescript
export const uploadImageWithTimeout = async (
  uri: string,
  conversationId: string,
  timeoutMs = 15000,
  retryCount = 0
): Promise<string> => {
  const uploadPromise = uploadImage(uri, conversationId);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Upload timeout')), timeoutMs)
  );
  
  try {
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (error) {
    const isTimeout = error.message === 'Upload timeout';
    
    // Retry once on timeout
    if (isTimeout && retryCount < 1) {
      console.log('📸 Upload timeout, retrying...');
      return await uploadImageWithTimeout(uri, conversationId, timeoutMs, retryCount + 1);
    }
    
    // Retry once on network error
    if (!isTimeout && retryCount < 1) {
      console.log('📸 Upload failed, retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
      return await uploadImageWithTimeout(uri, conversationId, timeoutMs, retryCount + 1);
    }
    
    throw error;
  }
};
```

**Part 3: MIME Detection** (1 hour)

```typescript
import * as FileSystem from 'expo-file-system';

export const getMimeType = async (uri: string): Promise<string> => {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    
    // Extract from URI extension
    const extension = uri.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'heic':
        return 'image/heic';
      default:
        return 'image/jpeg'; // Default
    }
  } catch (error) {
    console.error('Failed to detect MIME type:', error);
    return 'image/jpeg';
  }
};

// Add to pickImage()
export const pickImage = async (): Promise<string | null> => {
  // ... existing code ...
  
  const mimeType = await getMimeType(result.assets[0].uri);
  console.log(`📸 Picked image: ${mimeType}`);
  
  return result.assets[0].uri;
};
```

**Part 4: Update uploadImage() to use progressive compression** (1 hour)

```typescript
export const uploadImage = async (uri: string, conversationId: string): Promise<string> => {
  try {
    // Check file size
    const size = await getFileSize(uri);
    let finalUri = uri;
    
    // Always compress images > 5MB (but now with progressive tiers)
    if (size > 5 * 1024 * 1024) {
      console.log(`📸 Image is ${(size / 1024 / 1024).toFixed(2)}MB, compressing...`);
      finalUri = await compressImageProgressive(uri, size);
    }
    
    // Use timeout wrapper for actual upload
    return await uploadImageWithTimeout(finalUri, conversationId);
  } catch (error) {
    console.error('Failed to upload image:', error);
    throw error;
  }
};
```

**Acceptance Criteria:**
- [ ] 25MB photo uploads successfully with compression
- [ ] Total upload time < 8s on Wi-Fi
- [ ] Failed upload shows retry option (Alert.alert)
- [ ] Message draft not lost on upload failure
- [ ] Test with: 5MB (no compression), 12MB (Tier 1), 25MB (Tier 2), 60MB (Tier 3)

---

#### **Priority 5: Slow Network UI Feedback** ⚠️ MEDIUM
**Time:** 3 hours  
**Confidence Impact:** 85% → 95%  
**Files:** `app/chat/[id].tsx`, `services/offlineQueue.ts`

**Problem:** No visual feedback for queued messages.

**Part 1: Queued Message UI** (2 hours)

In `app/chat/[id].tsx`, add status chip rendering:

```typescript
// In message bubble rendering (inside the blue bubble section)
{isOwnMessage && message.status === 'queued' && (
  <View style={styles.queuedChip}>
    <Ionicons name="time-outline" size={14} color="#FF9800" style={{ marginRight: 4 }} />
    <Text style={styles.queuedText}>Queued</Text>
    <TouchableOpacity 
      onPress={() => handleRetryMessage(message.localId)}
      style={styles.retryButton}
    >
      <Text style={styles.retryText}>Retry</Text>
    </TouchableOpacity>
  </View>
)}
```

**Add styles:**
```typescript
queuedChip: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(255, 152, 0, 0.1)',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 12,
  marginTop: 4,
  alignSelf: 'flex-end',
},
queuedText: {
  fontSize: 12,
  color: '#FF9800',
  marginRight: 8,
},
retryButton: {
  paddingHorizontal: 6,
  paddingVertical: 2,
},
retryText: {
  fontSize: 12,
  color: '#007AFF',
  fontWeight: '600',
},
```

**Part 2: Manual Retry Handler** (1 hour)

```typescript
const handleRetryMessage = async (localId: string) => {
  try {
    const queue = await getQueue();
    const message = queue.find(m => m.localId === localId);
    
    if (!message) {
      Alert.alert('Error', 'Message not found in queue');
      return;
    }
    
    // Show loading
    setMessages(prev =>
      prev.map(msg =>
        msg.localId === localId
          ? { ...msg, status: 'sending' }
          : msg
      )
    );
    
    // Try to send with timeout
    await sendMessageWithTimeout(
      message.conversationId,
      message.text,
      message.senderId,
      localId,
      undefined,
      10000
    );
    
    // Success: remove from queue
    await removeFromQueue(localId);
    
    // Update UI
    setMessages(prev =>
      prev.map(msg =>
        msg.localId === localId
          ? { ...msg, status: 'sent' }
          : msg
      )
    );
    
    Alert.alert('✅ Sent', 'Message sent successfully');
    
  } catch (error) {
    console.error('Manual retry failed:', error);
    
    // Update UI back to queued
    setMessages(prev =>
      prev.map(msg =>
        msg.localId === localId
          ? { ...msg, status: 'queued' }
          : msg
      )
    );
    
    Alert.alert(
      'Retry Failed',
      'Message will be retried automatically when online'
    );
  }
};
```

**Acceptance Criteria:**
- [ ] Messages show "Queued • Retry" chip when in offline queue
- [ ] Tap "Retry" attempts immediate send
- [ ] Success removes chip and shows normal message
- [ ] Failure shows alert and keeps chip visible
- [ ] Test: Send with airplane mode → see chip → reconnect → chip disappears

---

### Phase 4: Optional Enhancements

#### **Priority 0: Metrics & Guardrails** 📊 OPTIONAL
**Time:** 3 hours  
**Priority:** Nice to have

See RUBRIC_READINESS_PLAN_UPDATED.md for details. Only implement if time allows.

#### **Priority 6: Lifecycle Audit** ✅ 90% DONE
**Time:** 0.5 hours  
**Status:** Mostly complete from Session 5

Just add console.log timestamps for reconnection events.

---

## ✅ Testing Protocol

After implementing each priority, run these tests:

### P1 (Force-Quit) Tests
```
1. Open app → send message
2. Within 200ms, force quit app (swipe up)
3. Relaunch app
4. Expected: Message in queue, auto-sends on reconnect
5. Verify: Queue empty after successful send
```

### P2 (Performance) Tests
```
1. Open chat with 50+ messages
2. Scroll rapidly up and down
3. Expected: 55-60 FPS, no lag
4. Open React DevTools profiler
5. Send 20 messages rapidly
6. Expected: No re-renders of old messages
7. Check Firestore console
8. Expected: ≈ 1 write per message (batched conversation updates)
```

### P4 (Multi-Device) Tests
```
1. Open same conversation on 2 devices
2. Send from Device A at T+0ms
3. Send from Device B at T+50ms
4. Expected: Both devices show same lastMessage (most recent)
5. Send 10 messages from each device simultaneously
6. Expected: No unread count drift, consistent lastMessage
```

### P3 (Image Upload) Tests
```
1. Pick 5MB image → uploads without compression
2. Pick 15MB image → compresses with Tier 1 (1280px, 60%)
3. Pick 25MB image → compresses with Tier 2 (1024px, 50%)
4. Pick 60MB image → compresses with Tier 3 (800px, 40%)
5. Turn on airplane mode → upload fails → retry option shown
6. Expected: All uploads < 8s on Wi-Fi, compression logged
```

### P5 (Queued Status) Tests
```
1. Turn on airplane mode
2. Send 3 messages
3. Expected: All show "Queued • Retry" chip
4. Tap "Retry" on one message
5. Expected: Shows "Retry Failed" alert
6. Turn off airplane mode
7. Expected: All chips disappear after auto-send
```

---

## 🎯 Success Criteria (All Must Pass)

- [ ] **P1:** Message sent within 200ms of force-quit appears in queue on relaunch
- [ ] **P2:** 50 messages in 5 seconds at 55-60 FPS, batched Firestore writes
- [ ] **P4:** Two simultaneous sends have consistent lastMessage, no unread drift
- [ ] **P3:** 25MB photo uploads in < 8s with progressive compression
- [ ] **P5:** Queued messages show status chip with working manual retry

**Overall Target:** 95% testing confidence across all scenarios

---

## 💡 Implementation Tips

1. **Start with P1** - It's the most critical and affects all other work
2. **Test incrementally** - Don't wait until the end to test
3. **Use console.log liberally** - Add timestamps and metrics
4. **Commit after each priority** - Don't bundle P1-P5 into one commit
5. **Update memory bank** - Document what was implemented and tested

---

## 📝 Commit Message Templates

```
P1 Complete: Force-quit persistence with queue-first strategy

- Added removeFromQueue() helper to offlineQueue.ts
- Changed handleSend() to queue-first (pessimistic)
- Messages now guaranteed to queue before sending
- Queue cleared on successful send
- Tested: Force-quit within 200ms → message in queue on relaunch

Files: app/chat/[id].tsx, services/offlineQueue.ts
Time: 4 hours
Confidence: 75% → 95%
```

```
P2 Complete: Rapid-fire performance with FlatList + batching

- Replaced ScrollView with FlatList (windowed rendering)
- Added conversation update batching (300ms debounce)
- Added SQLite write batching (500ms buffer)
- Memoized MessageRow component
- Tested: 50 messages in 5s at 55-60 FPS, batched writes

Files: app/chat/[id].tsx, services/conversationService.ts, services/sqliteService.ts
Time: 8 hours
Confidence: 80% → 95%
```

---

## 🚨 Critical Notes

1. **Don't skip P1** - Without queue-first, messages will be lost on force-quit
2. **Don't skip P2** - FlatList is essential for performance with 50+ messages
3. **Don't skip P4** - Multi-device conflicts will cause data inconsistency
4. **Test on real devices** - Simulator performance is not representative
5. **P3 and P5 can be optional** - But strongly recommended for production

---

## 📚 Additional Resources

- **React Native FlatList Docs:** https://reactnative.dev/docs/flatlist
- **Firestore Batching:** https://firebase.google.com/docs/firestore/manage-data/transactions
- **Image Manipulation:** https://docs.expo.dev/versions/latest/sdk/imagemanipulator/
- **Memory Bank:** See memory_bank/06_active_context_progress.md for current state

---

## ✅ Final Checklist

Before marking complete, verify:

- [ ] All P1-P5 acceptance criteria passing
- [ ] All test scenarios passing
- [ ] No linter errors
- [ ] No console errors
- [ ] Committed with descriptive messages
- [ ] Memory bank updated
- [ ] RUBRIC_READINESS_PLAN_UPDATED.md marked as complete

**Expected Outcome:** 95% testing confidence, A-level rubric scores, production-ready foundation

---

Good luck! Focus on P1-P4 first (critical), then P3-P5 (high/medium). Remember: quality over speed. Each priority should be fully tested before moving to the next.

