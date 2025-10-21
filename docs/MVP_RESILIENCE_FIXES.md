# MVP Resilience Fixes - Testing Readiness Plan

**Created:** October 21, 2025  
**Status:** Implementation Plan  
**Target:** Fix 5 testing scenarios for MVP validation  
**Total Estimated Time:** 4-6 hours

---

## 🎯 Executive Summary

Our messaging infrastructure is **solid** but lacks critical **app lifecycle handling** and **resilience edge cases**. This document outlines fixes needed to pass all 7 MVP testing scenarios with 95%+ confidence.

**Current State:**
- ✅ Real-time messaging: 95% (will pass)
- ⚠️ Offline resilience: 70% (needs improvement)
- ❌ Background handling: 20% (critical failure)
- ⚠️ Persistence: 75% (mostly works)
- ⚠️ Poor network: 60% (needs timeout handling)
- ⚠️ Rapid-fire: 70% (performance concerns)
- ✅ Group chat: 90% (will pass)

**After fixes:**
- All scenarios at 90%+ confidence
- Production-ready resilience
- Better user experience under poor conditions

---

## 🚨 Priority 1: App Lifecycle Handling (CRITICAL - 1 hour)

### **Problem**
App doesn't respond to backgrounding/foregrounding, causing:
- Presence stuck on "online" when app is backgrounded
- Messages missed when returning from background
- No reconnection logic when app resumes
- Firestore listeners may disconnect without cleanup

### **Impact**
**Testing Scenario #3 will FAIL**: Messages sent while app is backgrounded won't arrive properly.

### **Solution: Add AppState Management**

#### **File 1: `store/AuthContext.tsx`**

Add comprehensive app lifecycle handling:

```typescript
import { AppState, AppStateStatus } from 'react-native';
import { processQueue } from '../services/offlineQueue';

// Inside AuthProvider component, add new useEffect:
useEffect(() => {
  if (!user) return;

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    console.log('AppState changed to:', nextAppState);
    
    if (nextAppState === 'active') {
      // App came to foreground
      console.log('App foregrounded - reconnecting...');
      
      try {
        // 1. Set user back online
        await setUserOnline(user.uid);
        
        // 2. Process any queued messages
        await processQueue();
        
        console.log('✅ Reconnection complete');
      } catch (error) {
        console.error('Failed to reconnect:', error);
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background
      console.log('App backgrounded - disconnecting...');
      
      try {
        // Set user offline
        await setUserOffline(user.uid);
        console.log('✅ Set offline');
      } catch (error) {
        console.error('Failed to set offline:', error);
      }
    }
  };

  // Subscribe to app state changes
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  
  // Cleanup on unmount
  return () => {
    subscription.remove();
  };
}, [user]);
```

#### **File 2: `services/presenceService.ts`**

Add heartbeat to keep presence updated:

```typescript
/**
 * Start presence heartbeat
 * Updates lastSeen every 30 seconds while app is active
 * 
 * @param userId - User ID
 * @returns Cleanup function to stop heartbeat
 */
export const startPresenceHeartbeat = (userId: string): (() => void) => {
  const interval = setInterval(async () => {
    try {
      await updateLastSeen(userId);
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }, 30000); // Every 30 seconds

  return () => clearInterval(interval);
};
```

Then in `AuthContext.tsx`, start heartbeat when user is authenticated:

```typescript
useEffect(() => {
  if (!user) return;

  // Start presence heartbeat
  const stopHeartbeat = startPresenceHeartbeat(user.uid);

  return () => {
    stopHeartbeat();
  };
}, [user]);
```

#### **File 3: `app/chat/[id].tsx`**

Add reconnection handling in chat screen:

```typescript
import { AppState } from 'react-native';

// Add inside ChatScreen component:
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      // Refresh messages when returning to foreground
      console.log('Chat screen foregrounded - refreshing...');
      
      // Mark unread messages as read
      if (user && messages.length > 0) {
        const unreadMessages = messages
          .filter(m => m.senderId !== user.uid && !m.readBy.includes(user.uid))
          .map(m => m.id);
        
        if (unreadMessages.length > 0) {
          markMessagesAsRead(conversationId, user.uid, unreadMessages).catch(console.error);
        }
      }
    }
  });

  return () => subscription.remove();
}, [user, messages, conversationId]);
```

### **Testing Criteria**
- [ ] App in foreground → User shows "online"
- [ ] Press home button → User shows "offline" within 5 seconds
- [ ] Return to app → User shows "online" within 5 seconds
- [ ] Send message while app backgrounded → Message arrives when app returns
- [ ] Background for 5 minutes → No presence drift (still shows correct online/offline)

### **Time Estimate: 1 hour**
- 30 min: Implementation
- 20 min: Testing
- 10 min: Bug fixes

---

## ⚠️ Priority 2: Offline Resilience Improvements (1-1.5 hours)

### **Problem**
Current offline handling:
- ✅ Queues outgoing messages
- ❌ No visual feedback for reconnection
- ❌ No "new messages arrived" indicator
- ❌ User doesn't know if they missed messages

### **Impact**
**Testing Scenario #2**: Offline → Online recovery works but feels uncertain to users.

### **Solution: Enhanced Offline Experience**

#### **File 1: `services/offlineQueue.ts`**

Add reconnection metadata:

```typescript
import { Timestamp } from 'firebase/firestore';

/**
 * Get the timestamp of last successful sync
 * Used to detect messages that arrived while offline
 */
export const getLastSyncTime = async (): Promise<Date> => {
  const timestamp = await AsyncStorage.getItem('last_sync_time');
  return timestamp ? new Date(parseInt(timestamp)) : new Date(0);
};

/**
 * Update last sync timestamp
 * Called after successful message sync
 */
export const updateLastSyncTime = async (): Promise<void> => {
  await AsyncStorage.setItem('last_sync_time', Date.now().toString());
};

/**
 * Process queue and return success metrics
 */
export const processQueue = async (): Promise<{ sent: number; failed: number }> => {
  const queue = await getQueue();
  const remaining: QueuedMessage[] = [];
  let sentCount = 0;
  let failedCount = 0;
  
  for (const msg of queue) {
    try {
      await sendMessage(msg.conversationId, msg.text, msg.senderId, msg.localId);
      await updateConversationLastMessage(msg.conversationId, msg.text, msg.senderId);
      console.log('✅ Sent queued message:', msg.localId);
      sentCount++;
    } catch (error) {
      console.error('❌ Failed to send queued message:', error);
      
      if (msg.retryCount < 3) {
        remaining.push({ ...msg, retryCount: msg.retryCount + 1 });
      } else {
        console.log('❌ Message failed after 3 retries:', msg.localId);
        failedCount++;
      }
    }
  }
  
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  await updateLastSyncTime();
  
  return { sent: sentCount, failed: failedCount };
};
```

#### **File 2: `app/_layout.tsx`**

Show reconnection toast:

```typescript
import { Alert } from 'react-native';

// Inside AppContent, modify NetInfo listener:
useEffect(() => {
  let wasOffline = false;
  
  const unsubscribeNet = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && wasOffline) {
      // Just reconnected
      console.log('🌐 Reconnected - processing queue...');
      
      try {
        const { sent, failed } = await processQueue();
        
        if (sent > 0) {
          Alert.alert(
            'Back Online',
            `${sent} message${sent === 1 ? '' : 's'} sent successfully`,
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('Failed to process offline queue:', error);
      }
      
      wasOffline = false;
    } else if (!state.isConnected) {
      wasOffline = true;
    }
  });
  
  return () => {
    unsubscribeNet();
  };
}, [user]);
```

#### **File 3: `app/chat/[id].tsx`**

Add "reconnecting" indicator:

```typescript
const [isReconnecting, setIsReconnecting] = useState(false);

// Add NetInfo listener for chat screen:
useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    const wasOnline = isOnline;
    setIsOnline(!!state.isConnected);
    
    if (state.isConnected && !wasOnline) {
      // Just reconnected
      setIsReconnecting(true);
      
      // Give Firestore time to sync
      setTimeout(() => {
        setIsReconnecting(false);
      }, 2000);
    }
  });
  
  return unsubscribe;
}, [isOnline]);

// Update offline banner to show reconnecting state:
{!isOnline && (
  <View style={styles.offlineBanner}>
    <Text style={styles.offlineText}>
      {isReconnecting ? '🔄 Reconnecting...' : '📡 No Internet Connection'}
    </Text>
  </View>
)}
```

### **Testing Criteria**
- [ ] Enable airplane mode → Banner shows "No Internet"
- [ ] Send message → Queued successfully
- [ ] Disable airplane mode → "Reconnecting..." appears
- [ ] After 2 seconds → Message sent, toast shows "1 message sent"
- [ ] Receive messages while offline → All appear when reconnected

### **Time Estimate: 1-1.5 hours**
- 45 min: Implementation
- 30 min: Testing
- 15 min: Polish

---

## ⚠️ Priority 3: Force-Quit Persistence (30 minutes)

### **Problem**
Messages sent RIGHT before force-quit may be lost:
- Optimistic message shown in UI
- Force-quit happens before Firestore write completes
- Message not in offline queue (only queued on network error)
- App reopens → Message missing

### **Impact**
**Testing Scenario #4**: Force-quit during send → Message lost.

### **Solution: Pessimistic Queue Strategy**

#### **File: `app/chat/[id].tsx`**

Change message sending to queue-first approach:

```typescript
const handleSend = useCallback(async () => {
  if (!inputText.trim() || !user) return;

  const localId = uuidv4();
  const tempMessage: Message = {
    id: localId,
    conversationId,
    text: inputText.trim(),
    senderId: user.uid,
    timestamp: new Date(),
    status: 'sending',
    type: 'text',
    localId,
    readBy: [user.uid],
    deliveredTo: []
  };

  // Optimistic UI
  setMessages(prev => [...prev, tempMessage]);
  setInputText('');
  setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

  try {
    // NEW: Always queue first (prevents loss on force-quit)
    await queueMessage({
      conversationId,
      text: tempMessage.text,
      senderId: user.uid,
      localId
    });
    
    // Then attempt immediate send
    if (isOnline) {
      await sendMessage(conversationId, tempMessage.text, user.uid, localId);
      await updateConversationLastMessage(conversationId, tempMessage.text, user.uid);
      
      // Success - remove from queue
      const { removeFromQueue } = await import('../../services/offlineQueue');
      await removeFromQueue(localId);
    } else {
      console.log('📤 Message queued for offline sending');
    }
  } catch (error: any) {
    console.error('Failed to send message:', error);
    // Message stays in queue for retry
  }
}, [inputText, conversationId, user, isOnline]);
```

#### **File: `services/offlineQueue.ts`**

Add function to remove single message from queue:

```typescript
/**
 * Remove a specific message from queue (after successful send)
 */
export const removeFromQueue = async (localId: string): Promise<void> => {
  const queue = await getQueue();
  const filtered = queue.filter(msg => msg.localId !== localId);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
};
```

#### **Alternative: Load queue on startup**

Add to `app/chat/[id].tsx`:

```typescript
// Load queued messages on mount
useEffect(() => {
  const loadQueuedMessages = async () => {
    const queue = await getQueue();
    const thisConversationQueue = queue.filter(q => q.conversationId === conversationId);
    
    if (thisConversationQueue.length > 0) {
      console.log(`📬 Found ${thisConversationQueue.length} queued messages`);
      
      // Show them in UI as "sending"
      const queuedMessages: Message[] = thisConversationQueue.map(q => ({
        id: q.localId,
        conversationId: q.conversationId,
        text: q.text,
        senderId: q.senderId,
        timestamp: new Date(q.timestamp),
        status: 'sending',
        type: 'text',
        localId: q.localId,
        readBy: [q.senderId],
        deliveredTo: []
      }));
      
      setMessages(prev => [...prev, ...queuedMessages]);
    }
  };
  
  loadQueuedMessages();
}, [conversationId]);
```

### **Testing Criteria**
- [ ] Type message, press Send
- [ ] Immediately force-quit app (double-tap home, swipe up)
- [ ] Reopen app → Navigate to chat
- [ ] Message appears with "sending" status
- [ ] After 2 seconds → Message sends successfully

### **Time Estimate: 30 minutes**
- 20 min: Implementation
- 10 min: Testing

---

## ⚠️ Priority 4: Poor Network Handling (1 hour)

### **Problem**
App doesn't handle poor connections well:
- NetInfo only detects fully offline vs online
- Doesn't distinguish between good WiFi and 2G
- Firestore operations can hang indefinitely
- No timeout on slow sends
- No adaptive retry strategy

### **Impact**
**Testing Scenario #5**: Throttled connection → Messages appear stuck, no user feedback.

### **Solution: Timeout & Adaptive Retry**

#### **File 1: `services/messageService.ts`**

Add timeout wrapper for Firestore operations:

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

#### **File 2: `app/chat/[id].tsx`**

Use timeout version and show feedback:

```typescript
import { sendMessageWithTimeout } from '../../services/messageService';

const handleSend = useCallback(async () => {
  if (!inputText.trim() || !user) return;

  const localId = uuidv4();
  const tempMessage: Message = {
    id: localId,
    conversationId,
    text: inputText.trim(),
    senderId: user.uid,
    timestamp: new Date(),
    status: 'sending',
    type: 'text',
    localId,
    readBy: [user.uid],
    deliveredTo: []
  };

  setMessages(prev => [...prev, tempMessage]);
  setInputText('');
  setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

  try {
    if (isOnline) {
      // Use timeout version (10 second limit)
      await sendMessageWithTimeout(conversationId, tempMessage.text, user.uid, localId);
      await updateConversationLastMessage(conversationId, tempMessage.text, user.uid);
    } else {
      await queueMessage({
        conversationId,
        text: tempMessage.text,
        senderId: user.uid,
        localId
      });
      console.log('📤 Message queued for offline sending');
    }
  } catch (error: any) {
    if (error.message.includes('timeout')) {
      // Timeout - queue for retry
      console.log('⏱️ Send timed out - queuing for retry');
      await queueMessage({
        conversationId,
        text: tempMessage.text,
        senderId: user.uid,
        localId
      });
      
      // Update message status to "queued"
      setMessages(prev => prev.map(m => 
        m.localId === localId ? { ...m, status: 'queued' } : m
      ));
      
      // Show user feedback
      Alert.alert(
        'Slow Connection',
        'Message will send when connection improves',
        [{ text: 'OK' }]
      );
    } else {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.filter(m => m.id !== localId));
    }
  }
}, [inputText, conversationId, user, isOnline]);
```

#### **File 3: `services/offlineQueue.ts`**

Make retry non-blocking:

```typescript
/**
 * Process queue with parallel retry (non-blocking)
 * Returns immediately, retries happen in background
 */
export const processQueue = async (): Promise<{ sent: number; failed: number }> => {
  const queue = await getQueue();
  const remaining: QueuedMessage[] = [];
  let sentCount = 0;
  let failedCount = 0;
  
  // Process messages in parallel (don't block on retries)
  const promises = queue.map(async (msg) => {
    try {
      await sendMessageWithTimeout(
        msg.conversationId, 
        msg.text, 
        msg.senderId, 
        msg.localId,
        undefined,
        5000 // 5 second timeout for retries
      );
      await updateConversationLastMessage(msg.conversationId, msg.text, msg.senderId);
      console.log('✅ Sent queued message:', msg.localId);
      sentCount++;
      return { success: true, msg };
    } catch (error) {
      console.error('❌ Failed to send queued message:', error);
      
      if (msg.retryCount < 3) {
        remaining.push({ ...msg, retryCount: msg.retryCount + 1 });
        return { success: false, msg };
      } else {
        console.log('❌ Message failed after 3 retries:', msg.localId);
        failedCount++;
        return { success: false, msg, permanent: true };
      }
    }
  });
  
  await Promise.allSettled(promises);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  
  return { sent: sentCount, failed: failedCount };
};
```

#### **File 4: Add connection quality detection**

Create `services/networkQuality.ts`:

```typescript
import NetInfo from '@react-native-community/netinfo';

export type NetworkQuality = 'excellent' | 'good' | 'poor' | 'offline';

/**
 * Detect network quality by measuring latency
 */
export const detectNetworkQuality = async (): Promise<NetworkQuality> => {
  const state = await NetInfo.fetch();
  
  if (!state.isConnected) return 'offline';
  
  // Measure latency by timing a Firestore read
  const start = Date.now();
  try {
    const { db } = await import('./firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    
    // Quick read to test latency
    await getDoc(doc(db, 'users', 'test'));
    
    const latency = Date.now() - start;
    
    if (latency < 500) return 'excellent';
    if (latency < 2000) return 'good';
    return 'poor';
  } catch (error) {
    return 'poor';
  }
};

/**
 * Get recommended timeout based on network quality
 */
export const getRecommendedTimeout = (quality: NetworkQuality): number => {
  switch (quality) {
    case 'excellent': return 5000;
    case 'good': return 10000;
    case 'poor': return 20000;
    case 'offline': return 0;
  }
};
```

### **Testing Criteria**
- [ ] Enable Chrome DevTools network throttling → Set to "Slow 3G"
- [ ] Send message → Shows "sending" for max 10 seconds
- [ ] If timeout → Alert shows "Slow Connection"
- [ ] Message queued for retry
- [ ] Improve connection → Message sends on next retry

### **Time Estimate: 1 hour**
- 40 min: Implementation
- 15 min: Testing
- 5 min: Polish

---

## ⚠️ Priority 5: Rapid-Fire Performance (1 hour)

### **Problem**
Sending 20+ messages quickly causes:
- 40+ Firestore writes (wasteful)
- UI lag from re-renders
- ScrollView performance issues
- SQLite write bottleneck

### **Impact**
**Testing Scenario #6**: Rapid-fire messages → UI lags, feels sluggish.

### **Solution: Batching & Performance Optimization**

#### **File 1: `app/chat/[id].tsx`**

Replace `ScrollView` with `FlatList`:

```typescript
// Replace ScrollView with FlatList for better performance
<FlatList
  ref={flatListRef}
  data={messages}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    // Your message bubble JSX
  )}
  contentContainerStyle={styles.messagesContainer}
  onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
  onLayout={() => flatListRef.current?.scrollToEnd()}
  initialNumToRender={20}
  maxToRenderPerBatch={10}
  windowSize={10}
  removeClippedSubviews={true}
  getItemLayout={(data, index) => ({
    length: 80, // Approximate message height
    offset: 80 * index,
    index,
  })}
/>
```

#### **File 2: `services/conversationService.ts`**

Batch conversation updates:

```typescript
import { debounce } from 'lodash'; // or implement simple debounce

/**
 * Update conversation last message (debounced)
 * Prevents excessive writes during rapid-fire messages
 */
export const updateConversationLastMessageDebounced = debounce(
  async (conversationId: string, text: string, senderId: string) => {
    await updateConversationLastMessage(conversationId, text, senderId);
  },
  1000, // Wait 1 second after last message
  { leading: true, trailing: true }
);
```

Or implement without lodash:

```typescript
const updateQueue = new Map<string, { text: string; senderId: string; timeout: NodeJS.Timeout }>();

export const updateConversationLastMessageDebounced = (
  conversationId: string, 
  text: string, 
  senderId: string
): void => {
  // Clear existing timeout
  const existing = updateQueue.get(conversationId);
  if (existing) {
    clearTimeout(existing.timeout);
  }
  
  // Set new timeout
  const timeout = setTimeout(async () => {
    await updateConversationLastMessage(conversationId, text, senderId);
    updateQueue.delete(conversationId);
  }, 1000);
  
  updateQueue.set(conversationId, { text, senderId, timeout });
};
```

#### **File 3: `services/sqliteService.ts`**

Batch SQLite cache writes:

```typescript
let cacheQueue: Message[] = [];
let cacheTimeout: NodeJS.Timeout | null = null;

/**
 * Cache message with batching
 * Collects messages and writes in batches for better performance
 */
export const cacheMessageBatched = (message: Message): void => {
  cacheQueue.push(message);
  
  if (cacheTimeout) {
    clearTimeout(cacheTimeout);
  }
  
  cacheTimeout = setTimeout(async () => {
    if (cacheQueue.length === 0) return;
    
    try {
      // Write all queued messages in a single transaction
      const messagesToCache = [...cacheQueue];
      cacheQueue = [];
      
      for (const msg of messagesToCache) {
        await cacheMessage(msg);
      }
      
      console.log(`📝 Cached ${messagesToCache.length} messages`);
    } catch (error) {
      console.error('Failed to batch cache messages:', error);
    }
  }, 500); // Batch writes every 500ms
};
```

#### **File 4: `app/chat/[id].tsx`**

Use batched functions:

```typescript
import { updateConversationLastMessageDebounced } from '../../services/conversationService';
import { cacheMessageBatched } from '../../services/sqliteService';

// In subscribeToMessages callback:
const unsubscribe = subscribeToMessages(conversationId, (newMessages) => {
  setMessages(newMessages);
  
  // Use batched cache instead of individual writes
  newMessages.forEach(msg => cacheMessageBatched(msg));
});

// In handleSend:
await sendMessage(conversationId, tempMessage.text, user.uid, localId);
await updateConversationLastMessageDebounced(conversationId, tempMessage.text, user.uid);
```

#### **File 5: Optimize message rendering**

Use `React.memo` for message bubbles:

```typescript
import React, { memo } from 'react';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showSender: boolean;
  senderName?: string;
}

const MessageBubble = memo(({ message, isOwnMessage, showSender, senderName }: MessageBubbleProps) => {
  // Your message bubble JSX
  return (
    <View style={[styles.messageBubble, isOwnMessage && styles.ownMessage]}>
      {/* ... */}
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if message content changes
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.message.readBy.length === nextProps.message.readBy.length
  );
});
```

### **Testing Criteria**
- [ ] Send 20 messages rapidly (tap Send button quickly)
- [ ] UI stays responsive (< 100ms input lag)
- [ ] All messages appear in correct order
- [ ] Scroll performance smooth (60 FPS)
- [ ] No memory leaks (check with React DevTools)
- [ ] Conversation list updates only once after all messages

### **Time Estimate: 1 hour**
- 30 min: FlatList conversion
- 20 min: Batching implementation
- 10 min: Testing

---

## 📊 Implementation Summary

### **Total Time: 4.5-6 hours**

| Priority | Task | Time | Blocking? | Impact |
|----------|------|------|-----------|---------|
| 🚨 P1 | App Lifecycle | 1h | YES | Critical |
| ⚠️ P2 | Offline UX | 1-1.5h | NO | Medium |
| ⚠️ P3 | Force-Quit | 30m | NO | Medium |
| ⚠️ P4 | Poor Network | 1h | NO | High |
| ⚠️ P5 | Rapid-Fire | 1h | NO | Low |

### **Recommended Order**
1. **P1: App Lifecycle** (MUST DO - 1h) ← Start here
2. **P4: Poor Network** (High impact - 1h)
3. **P2: Offline UX** (Polish - 1.5h)
4. **P3: Force-Quit** (Edge case - 30m)
5. **P5: Rapid-Fire** (Nice to have - 1h)

### **Minimum Viable Fixes (2 hours)**
If time is limited, do only:
1. App Lifecycle (P1) - 1h
2. Poor Network Timeouts (P4) - 1h

This gets you from 20% → 85% confidence on testing scenarios.

---

## 🧪 Testing Protocol

### **After Each Fix**
1. Clear app data
2. Force close app
3. Restart app
4. Test specific scenario
5. Document result

### **Final Integration Test**
Run all 7 scenarios in sequence:
1. Real-time chat (2 simulators)
2. Airplane mode → Send → Reconnect
3. Background app → Send message → Foreground
4. Send message → Force quit → Reopen
5. Throttle to 2G → Send message
6. Send 25 messages rapidly
7. Group chat with 3+ users

### **Success Criteria**
- [ ] All messages delivered
- [ ] No data loss
- [ ] No UI freezes
- [ ] Presence accurate
- [ ] User feedback clear
- [ ] Error handling graceful

---

## 📝 Files to Modify

### **Create New Files** (2)
- `services/networkQuality.ts` (optional, for P4)
- None required for MVP fixes

### **Modify Existing Files** (6)
1. `store/AuthContext.tsx` ← App lifecycle
2. `services/presenceService.ts` ← Heartbeat
3. `app/_layout.tsx` ← Reconnection toast
4. `app/chat/[id].tsx` ← Multiple fixes (FlatList, timeout, AppState)
5. `services/offlineQueue.ts` ← Parallel retry, metrics
6. `services/messageService.ts` ← Timeout wrapper

### **Optional Optimizations** (3)
- `services/conversationService.ts` ← Debounced updates
- `services/sqliteService.ts` ← Batched writes
- `components/MessageBubble.tsx` ← Memoized component (new file)

---

## 🎯 Expected Outcomes

### **Before Fixes**
- Testing confidence: 60%
- Will pass 2/7 scenarios cleanly
- 3/7 scenarios partial/flaky
- 2/7 scenarios likely fail

### **After P1 Only** (1 hour)
- Testing confidence: 85%
- Will pass 5/7 scenarios cleanly
- 2/7 scenarios partial
- Critical gap closed

### **After All Fixes** (5 hours)
- Testing confidence: 95%
- Will pass 7/7 scenarios cleanly
- Production-ready resilience
- Best-in-class offline experience

---

## 💡 Additional Recommendations

### **Nice-to-Have (Post-MVP)**
1. **Message retry UI** - Let users manually retry failed messages
2. **Connection quality indicator** - Show WiFi/3G/4G signal strength
3. **Offline mode badge** - Persistent indicator when offline
4. **Message delivery animation** - Visual feedback for send → delivered → read
5. **Smart sync** - Only sync messages from last N days when reconnecting

### **Production Considerations**
1. **Analytics** - Track offline queue size, retry success rate
2. **Monitoring** - Alert if queue sizes grow abnormally
3. **User feedback** - Survey users about offline experience
4. **Performance** - Profile with 1000+ messages in chat

---

**Created:** October 21, 2025  
**Status:** Ready for Implementation  
**Next Step:** Implement P1 (App Lifecycle) - 1 hour

**Questions?** Refer to code comments or testing protocol above.

