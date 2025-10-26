# 🎯 Per-User lastMessage System - Implementation Prompt

## 🎉 Good News: This is SAFE to Implement!

**This change is purely a data structure modification - it does NOT touch any UI/UX features!**

### What Actually Changes:
1. ✅ Backend Cloud Functions write to `lastMessagePerUser.{userId}` map (NEW)
2. ✅ Client reads from `lastMessagePerUser[userId]` instead of `lastMessage` (1 line change)
3. ✅ Deletion handler updates user's map entry instead of global field (surgical change)

### What Does NOT Change:
- ❌ Real-time listeners (stay identical - automatically receive new field)
- ❌ UI rendering logic (just reading different field name)
- ❌ Scroll behavior and positioning
- ❌ Cache warming strategy
- ❌ Transitions and animations
- ❌ Gestures and interactions
- ❌ Performance characteristics
- ❌ Offline queue
- ❌ Optimistic updates

**Key Insight:** This is like changing a variable name in your data model. The UI behavior stays exactly the same - it just reads from a different place. All your smooth transitions, animations, caching, and optimizations remain untouched.

---

## 📋 Problem Statement

The current `lastMessage` system has a critical architectural flaw:
- **Single global `lastMessage` field** in Firestore shared by all conversation participants
- When User A deletes the lastMessage, User B still sees it (correct)
- BUT User A also still sees it on Messages screen (incorrect)
- Each user needs their own view of lastMessage based on their personal deletions

## 🎯 Goals

1. **Real-time updates**: When a new message arrives, ALL participants instantly see it as their lastMessage
2. **Per-user deletion**: When User A deletes a message, their lastMessage automatically recalculates to show their next most recent non-deleted message
3. **Performance**: Messages screen must load <200ms, no N+1 queries, no blocking computation
4. **Offline support**: Works seamlessly when offline, syncs when reconnected
5. **Multi-device sync**: User's view is consistent across all their devices

## 🏗️ Current Architecture (BROKEN)

### Firestore Structure
```
conversations/{conversationId}
  - participants: ['user1', 'user2', 'user3']
  - lastMessage: {                    // ❌ GLOBAL - same for everyone
      text: "See you tomorrow!",
      senderId: "user2",
      timestamp: Timestamp,
    }
  - deletedBy: ['user1']              // Conversation-level deletion
  
conversations/{conversationId}/messages/{messageId}
  - text: "See you tomorrow!"
  - senderId: "user2"
  - timestamp: Timestamp
  - deletedBy: ['user3']              // ✅ Per-user message deletion
```

### Current Update Flow (when new message sent)
1. Client calls `sendMessage()` → creates message document
2. Firebase Cloud Function `onMessageCreate` triggers
3. Function updates conversation document:
   ```typescript
   await conversationRef.update({
     lastMessage: { text, senderId, timestamp },
     deletedBy: [],  // Clears deletedBy so conversation reappears
   });
   ```
4. Real-time listener in `app/(tabs)/index.tsx` receives update
5. All users see new lastMessage ✅

### Current Deletion Flow (BROKEN)
1. User deletes message → `deletedBy` array updated on message document
2. Client calls `recalculateLastMessage(conversationId, userId)` (lines 600-635 in `conversationService.ts`)
3. Function queries last 50 messages, finds first non-deleted one
4. Updates GLOBAL `lastMessage` field → **breaks view for other users!** ❌

## ✅ Required Solution: Per-User lastMessage Map

### New Firestore Structure
```
conversations/{conversationId}
  - participants: ['user1', 'user2', 'user3']
  - lastMessage: {                        // ❌ DEPRECATED - keep for migration
      text: "See you tomorrow!",
      senderId: "user2", 
      timestamp: Timestamp,
    }
  - lastMessagePerUser: {                 // ✅ NEW - per-user tracking
      user1: {
        messageId: "msg_123",
        text: "Meeting at 2pm",           // User1's last visible message
        senderId: "user1",
        timestamp: Timestamp,
      },
      user2: {
        messageId: "msg_456",
        text: "See you tomorrow!",        // User2's last visible message
        senderId: "user2",
        timestamp: Timestamp,
      },
      user3: {
        messageId: "msg_456",
        text: "See you tomorrow!",        // User3 deleted msg_456, sees older one
        senderId: "user2",
        timestamp: Timestamp,
      }
    }
  - deletedBy: ['user1']                  // Conversation-level deletion
```

## 🔧 Implementation Requirements

### 1. Update Cloud Function: onMessageCreate (HIGH PRIORITY)
**File**: `functions/src/index.ts` lines 711-782

When a new message is created, update ALL participants' lastMessage:
```typescript
export const onMessageCreate = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    const { conversationId, messageId } = event.params;
    
    const convRef = admin.firestore().doc(`conversations/${conversationId}`);
    const convSnap = await convRef.get();
    const conversation = convSnap.data();
    const participants = conversation.participants as string[];
    
    // Build per-user lastMessage updates
    const updates: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: [], // Clear conversation deletedBy
    };
    
    // Update lastMessagePerUser for EVERY participant
    participants.forEach((userId: string) => {
      updates[`lastMessagePerUser.${userId}`] = {
        messageId: messageId,
        text: message.text || "📷 Image",
        senderId: message.senderId,
        timestamp: message.timestamp,
      };
    });
    
    // Increment unread counts for recipients
    const recipients = participants.filter(id => id !== message.senderId);
    recipients.forEach((recipientId: string) => {
      updates[`unreadCounts.${recipientId}`] = 
        admin.firestore.FieldValue.increment(1);
    });
    
    await convRef.update(updates);
  }
);
```

### 2. Update Client: Message Deletion Handler
**File**: `app/chat/[id].tsx` lines 1328-1392

When user deletes a message, recalculate ONLY their lastMessage:
```typescript
const handleDeleteMessage = async () => {
  if (!selectedMessage || !user) return;
  
  try {
    // 1. Optimistic UI update
    setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
    
    // 2. Update Firestore message document
    await deleteMessage(conversationId, selectedMessage.id, user.uid);
    
    // 3. Recalculate THIS USER'S lastMessage
    const newLastMessage = await recalculateLastMessageForUser(
      conversationId, 
      user.uid
    );
    
    // 4. Update only this user's entry in lastMessagePerUser
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      [`lastMessagePerUser.${user.uid}`]: newLastMessage || {
        messageId: '',
        text: '',
        senderId: '',
        timestamp: Timestamp.now(),
      }
    });
    
  } catch (error) {
    console.error('Delete failed:', error);
    // Rollback optimistic update
  }
};
```

### 3. Create Helper: recalculateLastMessageForUser
**File**: `services/conversationService.ts` (new function)

```typescript
export const recalculateLastMessageForUser = async (
  conversationId: string,
  userId: string
): Promise<{ messageId: string; text: string; senderId: string; timestamp: Timestamp } | null> => {
  try {
    const messagesQuery = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const messagesSnapshot = await getDocs(messagesQuery);
    
    // Find first message NOT deleted by this user
    for (const messageDoc of messagesSnapshot.docs) {
      const messageData = messageDoc.data();
      const deletedBy = messageData.deletedBy || [];
      
      if (!deletedBy.includes(userId)) {
        return {
          messageId: messageDoc.id,
          text: messageData.text || '📷 Image',
          senderId: messageData.senderId,
          timestamp: messageData.timestamp,
        };
      }
    }
    
    return null; // No visible messages
  } catch (error) {
    console.error('Failed to recalculate lastMessage:', error);
    throw error;
  }
};
```

### 4. Update Messages Screen Display
**File**: `app/(tabs)/index.tsx` lines 532-555

Display user's specific lastMessage from map:
```typescript
<Text style={styles.lastMessage} numberOfLines={1}>
  {(() => {
    // Read from per-user map
    const userLastMessage = item.lastMessagePerUser?.[user.uid];
    
    if (userLastMessage?.text && userLastMessage.text.trim() !== '') {
      return userLastMessage.text;
    }
    
    // Fallback: check if there's a timestamp
    if (userLastMessage?.timestamp) {
      const time = userLastMessage.timestamp.toDate?.().getTime() || 0;
      if (time > new Date('2015-01-01').getTime()) {
        return '📷 Image';
      }
    }
    
    return 'Start a conversation';
  })()}
</Text>
```

### 5. Migration Strategy

Add migration to handle existing conversations:
```typescript
// One-time migration script
export const migrateToPerUserLastMessage = async () => {
  const conversationsRef = collection(db, 'conversations');
  const snapshot = await getDocs(conversationsRef);
  
  for (const convDoc of snapshot.docs) {
    const data = convDoc.data();
    
    // Skip if already migrated
    if (data.lastMessagePerUser) continue;
    
    const participants = data.participants || [];
    const lastMessage = data.lastMessage;
    
    // Initialize all participants with current global lastMessage
    const lastMessagePerUser: Record<string, any> = {};
    participants.forEach((userId: string) => {
      lastMessagePerUser[userId] = {
        messageId: '', // Unknown for old messages
        text: lastMessage?.text || '',
        senderId: lastMessage?.senderId || '',
        timestamp: lastMessage?.timestamp || Timestamp.now(),
      };
    });
    
    await updateDoc(convDoc.ref, {
      lastMessagePerUser,
    });
  }
};
```

## 🧪 Testing Checklist

### Scenario 1: New Message in Group
1. User A sends message to group with B, C, D
2. ✅ All users see new message as lastMessage on Messages screen
3. ✅ Updates appear instantly (real-time)

### Scenario 2: User Deletes Message
1. User B deletes the lastMessage
2. ✅ User B's Messages screen shows previous non-deleted message
3. ✅ Users A, C, D still see original lastMessage
4. ✅ No flicker or delay

### Scenario 3: Offline Deletion
1. User C goes offline
2. User C deletes lastMessage locally
3. ✅ UI updates immediately
4. User C goes online
5. ✅ Firestore syncs, recalculation happens
6. ✅ Consistent across User C's devices

### Scenario 4: Performance
1. Open Messages screen with 50 conversations
2. ✅ Loads in <200ms
3. ✅ No N+1 queries to Firestore
4. ✅ Real-time updates don't cause lag

### Scenario 5: Edge Cases
1. All messages deleted by user → ✅ Shows "Start a conversation"
2. User joins existing conversation → ✅ lastMessage initializes correctly
3. Participant removed from conversation → ✅ Their entry remains (historical data)

## ⚠️ Critical Constraints & UX Guardrails

### Data Integrity (DO NOT BREAK)
1. **DO NOT break existing message deletion** - `deletedBy` on messages must continue working
2. **DO NOT break conversation deletion** - `deletedBy` on conversations must continue working  
3. **DO NOT add N+1 queries** - All data must come from conversation document
4. **DO NOT block UI** - All recalculations must be async
5. **DO NOT lose messages** - Handle race conditions carefully

### Core UX Features to PRESERVE (DO NOT TOUCH)

#### 1. Messages Screen → Chat Screen Transitions
**Location**: `app/(tabs)/index.tsx` lines 1-1155
**Features to Preserve:**
- ✅ Avatar transitions with shared element animations
- ✅ Smooth navigation with no flicker (skeleton crossfade, lines 32-34)
- ✅ Optimistic UI updates (no loading spinners)
- ✅ Real-time Firestore listener (lines 66-152)
- ✅ Conversation filtering for empty/deleted conversations (lines 68-133)
- ✅ Swipe-to-delete gesture (DO NOT MODIFY)
- ✅ Pull-to-refresh behavior (DO NOT MODIFY)
- ✅ Skeleton loading animation (lines 897-1036)

**What Changes:**
- ❌ ONLY change line ~538-555: Replace `item.lastMessage.text` with `item.lastMessagePerUser?.[user.uid]?.text`
- ❌ That's it! Everything else stays identical.

#### 2. Chat Screen Scrolling & Rendering
**Location**: `app/chat/[id].tsx` lines 1-2554
**Features to PRESERVE:**
- ✅ Inverted FlatList logic (lines 103-120) - maintains scroll position
- ✅ Cache warming strategy (lines 306-355) - instant <100ms load without flicker
- ✅ Change detection optimization (lines 421-460) - prevents flicker on status updates
- ✅ Container-level swipe gestures (lines 252-975) - blue bubble timestamp reveal
- ✅ Memory management (lines 239-249) - performance for large conversations
- ✅ Image rendering strategy (shouldRenderImages) - prevents layout jumps
- ✅ Keyboard behavior and positioning
- ✅ Message grouping and spacing
- ✅ Optimistic send/delete (lines 1328-1392)

**What Changes:**
- ❌ ONLY modify lines 1343-1392 in `handleDeleteMessage`:
  - After line 1349 (deleteMessage call), add recalculation
  - Update `lastMessagePerUser.${user.uid}` instead of global `lastMessage`
- ❌ DO NOT touch scroll behavior, gestures, rendering, or caching

#### 3. Real-Time Listener & Data Flow
**Location**: `app/(tabs)/index.tsx` lines 66-152
**Features to PRESERVE:**
- ✅ Real-time conversation updates via Firestore listener
- ✅ Automatic UI refresh when data changes
- ✅ No additional queries (single listener for all conversations)
- ✅ Presence subscription (lines 154-192)
- ✅ Typing indicators

**What Changes:**
- ❌ NONE! Listener stays identical. It will automatically receive `lastMessagePerUser` updates.

#### 4. Offline Queue & Sync
**Location**: `services/offlineQueue.ts`, `app/chat/[id].tsx` lines 1394-1461
**Features to PRESERVE:**
- ✅ Queue-first message sending strategy
- ✅ Automatic retry with exponential backoff
- ✅ Optimistic UI updates
- ✅ Batched Firestore writes (300ms debounce)
- ✅ Cache synchronization

**What Changes:**
- ❌ NONE for offline queue
- ❌ Backend Cloud Function will update `lastMessagePerUser` instead of `lastMessage`

#### 5. Performance Characteristics (MUST MAINTAIN)
- ✅ Messages screen load: <200ms for 50 conversations
- ✅ Chat screen cache warmup: <100ms
- ✅ No flicker or layout shifts
- ✅ Smooth 60fps animations
- ✅ No additional Firestore queries
- ✅ Batched writes (300ms debounce preserved)

### Implementation Strategy to Preserve UX

1. **Backend First (Zero UI Impact)**
   - Update Cloud Functions to write to both `lastMessage` AND `lastMessagePerUser`
   - This is 100% backwards compatible - existing client still works
   - Deploy and test - no user-facing changes

2. **Client Display Update (Minimal Change)**
   - Update Messages screen to READ from `lastMessagePerUser[userId]`
   - Fall back to `lastMessage` if not available (migration safety)
   - This is ONE LINE change in display logic - no UX impact

3. **Client Deletion Update (Surgical Change)**
   - Update `handleDeleteMessage` to recalculate per-user field
   - Preserve all existing optimistic updates, error handling, rollback
   - Change ONLY the Firestore update target

4. **Migration Script (Non-Blocking)**
   - Run once to populate `lastMessagePerUser` for existing conversations
   - No user-facing changes during migration
   - Conversations without migration still work (fallback to `lastMessage`)

### Testing Protocol (Verify No Regressions)

After each change, verify these remain unchanged:

**Visual/UX Tests:**
1. ✅ Messages → Chat transition is smooth (no flicker)
2. ✅ Avatars transition correctly
3. ✅ Scroll position maintained when navigating back
4. ✅ Blue bubble swipe reveals timestamp
5. ✅ Message grouping looks correct
6. ✅ Loading skeleton crossfades smoothly
7. ✅ Swipe-to-delete conversation works
8. ✅ Pull-to-refresh works

**Performance Tests:**
1. ✅ Messages screen loads in <200ms
2. ✅ Chat screen cache warmup <100ms
3. ✅ No additional network requests
4. ✅ Smooth scrolling (no jank)
5. ✅ No memory leaks

**Functional Tests:**
1. ✅ New messages appear instantly for all users
2. ✅ Deleting message shows next message for deleting user only
3. ✅ Other users still see deleted message
4. ✅ Offline queue still works
5. ✅ Optimistic updates still work
6. ✅ Error handling and rollback still works

## 📊 Success Metrics

- ✅ New message → instant lastMessage update for all users (<100ms perceived delay)
- ✅ Delete message → user's lastMessage recalculates correctly (<500ms)
- ✅ Messages screen load time unchanged (<200ms for 50 conversations)
- ✅ No Firestore query increase (stays at O(conversations) not O(conversations * messages))
- ✅ Works offline with automatic sync

## 🚀 Deployment Plan

1. Deploy Cloud Function updates first (backwards compatible)
2. Deploy client updates (reads new field, falls back to old)
3. Run migration script (populate lastMessagePerUser for existing conversations)
4. Monitor for 48 hours
5. Remove old lastMessage field references (cleanup)

---

**Key Insight**: The solution is a **map structure** (`lastMessagePerUser`) where each user has their own lastMessage entry. This is efficient (single document read), real-time (Firestore listener), and scalable (O(1) per user lookup).

