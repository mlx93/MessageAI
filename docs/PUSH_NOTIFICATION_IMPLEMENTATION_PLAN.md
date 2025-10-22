# Push Notification Implementation Plan

**Created:** October 22, 2025  
**Status:** Ready to Implement  
**Estimated Time:** 6-8 hours

---

## 🎯 Requirements

Your application needs 4 notification scenarios:

1. **In-App, Different Chat:** User is in app but not viewing the chat where message arrived → Show in-app banner
2. **Background:** App is in background/not focused → Show OS notification
3. **Offline Catch-Up:** User was offline, comes back online → Show catch-up notification with count
4. **Unread Indicators:** Show red dot with unread count on conversations list

---

## 📊 Current Architecture

### What You Already Have ✅

```
Firebase Firestore Real-Time Listeners
    ↓ (websocket under the hood)
subscribeToMessages() 
    ↓
Chat Screen Updates in Real-Time
```

**Key Services:**
- `services/messageService.ts` - Real-time message subscription
- `services/notificationService.ts` - Local notifications, FCM token registration
- `services/conversationService.ts` - Conversation management
- `app/_layout.tsx` - Network state detection
- `app/chat/[id].tsx` - Active conversation tracking

### What's Missing ❌

1. **Unread Count Tracking** - No field in Firestore, no UI display
2. **Global Message Listener** - Only subscribes when chat is open
3. **In-App Banner** - No component for foreground notifications
4. **Notification Triggers** - Messages arrive but don't trigger notifications
5. **Offline Catch-Up** - No "you have X new messages" on reconnect

---

## 🏗️ Solution Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User A sends message to Conversation X                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloud Function: onMessageCreate                            │
│  - Increment unreadCounts for all recipients                │
│  - Clear sender from deletedBy array                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Firestore: Message added, unreadCounts updated             │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├──────────────────────────────────────────────┐
                 │                                              │
                 ▼                                              ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│  User B: Active in Chat X    │      │  User C: Not in Chat X       │
│  - Real-time listener fires  │      │  - Real-time listener fires  │
│  - Message appears           │      │  - globalMessageListener     │
│  - Auto mark as read         │      │    detects new message       │
│  - Reset unread count        │      │  - Check app state           │
└──────────────────────────────┘      └──────────┬───────────────────┘
                                                  │
                                                  ├──────────────┬──────────────┐
                                                  │              │              │
                                                  ▼              ▼              ▼
                                       ┌───────────────┐  ┌──────────┐  ┌──────────┐
                                       │ In App,       │  │ App in   │  │ App      │
                                       │ Different     │  │ Background│  │ Offline  │
                                       │ Chat          │  │          │  │          │
                                       │               │  │          │  │          │
                                       │ → Show banner │  │ → Local  │  │ → Queue  │
                                       │   at top      │  │   push   │  │   for    │
                                       │               │  │   notif  │  │   later  │
                                       └───────────────┘  └──────────┘  └──────────┘
```

---

## 📁 New Files to Create

### 1. `components/InAppNotificationBanner.tsx`
**Purpose:** Slide-down banner for in-app notifications

```tsx
// Features:
- Slides down from top when new message arrives
- Shows sender name, message preview, conversation avatar
- Tap to navigate to conversation
- Auto-dismiss after 5 seconds
- Multiple messages queue up
- Swipe up to dismiss
```

### 2. `services/globalMessageListener.ts`
**Purpose:** Listen to ALL conversations, not just active one

```tsx
// Features:
- Subscribe to all user's conversations
- Detect new messages in any conversation
- Check if message is in active conversation (if so, ignore)
- Trigger notification based on app state
- Handle unread count updates
```

### 3. `hooks/useInAppNotifications.ts`
**Purpose:** Manage in-app notification state

```tsx
// Features:
- Queue of pending notifications
- Show/hide banner animation
- Navigation on tap
- Auto-dismiss timer
```

---

## 🔧 Files to Modify

### 1. `types/index.ts`
**Add unread counts to Conversation interface:**

```typescript
export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participants: string[];
  deletedBy?: string[];
  unreadCounts?: { [userId: string]: number }; // ⭐ NEW
  lastMessage: {
    text: string;
    timestamp: Date;
    senderId: string;
  };
  participantDetails: {
    [userId: string]: {
      displayName: string;
      photoURL: string | null;
      initials: string;
      unreadCount: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. `services/conversationService.ts`
**Add unread count management functions:**

```typescript
/**
 * Reset unread count for a user in a conversation
 * Called when user opens a chat
 */
export const resetUnreadCount = async (
  conversationId: string, 
  userId: string
): Promise<void> => {
  await updateDoc(doc(db, 'conversations', conversationId), {
    [`unreadCounts.${userId}`]: 0
  });
};

/**
 * Increment unread count for recipients (called by Cloud Function)
 * This is typically done server-side, but we'll have a client-side version too
 */
export const incrementUnreadCount = async (
  conversationId: string,
  recipientIds: string[]
): Promise<void> => {
  const updates: any = {};
  recipientIds.forEach(uid => {
    updates[`unreadCounts.${uid}`] = firebase.firestore.FieldValue.increment(1);
  });
  
  await updateDoc(doc(db, 'conversations', conversationId), updates);
};
```

### 3. `services/notificationService.ts`
**Add notification trigger functions:**

```typescript
/**
 * Show in-app notification banner (when app is in foreground)
 */
export const showInAppNotification = (
  conversationId: string,
  senderName: string,
  messageText: string,
  senderInitials: string
) => {
  // This will be handled by InAppNotificationBanner component
  // We'll emit an event that the component listens to
};

/**
 * Show local push notification (when app is backgrounded)
 */
export const showLocalPushNotification = async (
  conversationId: string,
  senderName: string,
  messageText: string
): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: senderName,
      body: messageText,
      data: { conversationId },
      sound: true,
    },
    trigger: null, // Show immediately
  });
};

/**
 * Show catch-up notification after coming back online
 */
export const showCatchUpNotification = async (
  newMessageCount: number,
  conversations: Array<{name: string, count: number}>
): Promise<void> => {
  const body = conversations.length === 1
    ? `${conversations[0].count} new messages from ${conversations[0].name}`
    : `${newMessageCount} new messages from ${conversations.length} chats`;
    
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New Messages',
      body,
      sound: true,
    },
    trigger: null,
  });
};
```

### 4. `app/_layout.tsx`
**Add offline catch-up notification logic:**

```typescript
// Current implementation already processes queue on reconnect
// We need to add:
// 1. Track lastSeenAt timestamp when going offline
// 2. On reconnect, query messages after lastSeenAt
// 3. Show catch-up notification with count

useEffect(() => {
  const unsubscribeNet = NetInfo.addEventListener(async (state) => {
    if (state.isConnected && wasOffline.current) {
      // Process queue (already done)
      const { sent, failed } = await processQueue();
      
      // ⭐ NEW: Check for new messages received while offline
      if (user) {
        const newMessagesInfo = await checkNewMessagesSinceOffline(user.uid);
        if (newMessagesInfo.totalCount > 0) {
          await showCatchUpNotification(
            newMessagesInfo.totalCount,
            newMessagesInfo.conversations
          );
        }
      }
      
      wasOffline.current = false;
    } else if (!state.isConnected) {
      // ⭐ NEW: Track when we went offline
      if (user) {
        await AsyncStorage.setItem('lastSeenAt', new Date().toISOString());
      }
      wasOffline.current = true;
    }
  });
  
  return () => unsubscribeNet();
}, [user]);
```

### 5. `app/(tabs)/index.tsx`
**Add unread dot indicators:**

```typescript
// In ConversationsScreen, display unread count badge

const renderConversation = ({ item }: { item: Conversation }) => {
  const unreadCount = item.unreadCounts?.[user!.uid] || 0;
  
  return (
    <TouchableOpacity onPress={() => handleOpenChat(item.id)}>
      <View style={styles.conversationRow}>
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text>{getInitials(item)}</Text>
          
          {/* ⭐ NEW: Unread indicator dot */}
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
        
        {/* Conversation details */}
        <View style={styles.details}>
          <Text style={styles.name}>{getConversationTitle(item)}</Text>
          <Text style={styles.preview}>{item.lastMessage.text}</Text>
        </View>
        
        <View style={styles.rightSide}>
          <Text style={styles.timestamp}>
            {formatTimestamp(item.lastMessage.timestamp)}
          </Text>
          
          {/* ⭐ NEW: Blue dot for unread */}
          {unreadCount > 0 && (
            <View style={styles.blueDot} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  blueDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
    marginTop: 4,
  },
});
```

### 6. `app/chat/[id].tsx`
**Reset unread count when opening chat:**

```typescript
// Add to useEffect when component mounts
useEffect(() => {
  if (!user || !conversationId) return;
  
  // ⭐ NEW: Reset unread count when entering chat
  resetUnreadCount(conversationId, user.uid).catch(err => {
    console.error('Failed to reset unread count:', err);
  });
  
  // Mark conversation as active (already implemented)
  setActiveConversation(user.uid, conversationId);
  
  return () => {
    setActiveConversation(user.uid, null);
  };
}, [user, conversationId]);
```

### 7. `functions/src/index.ts`
**Add Cloud Function to update unread counts:**

```typescript
/**
 * Cloud Function: Increment unread counts when new message is sent
 * Triggers on message create in any conversation
 */
export const onMessageCreate = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { conversationId } = context.params;
    const senderId = message.senderId;
    
    // Get conversation
    const convRef = admin.firestore().doc(`conversations/${conversationId}`);
    const convSnap = await convRef.get();
    
    if (!convSnap.exists) return;
    
    const conversation = convSnap.data()!;
    const recipients = conversation.participants.filter(
      (id: string) => id !== senderId
    );
    
    // Build unread count updates
    const updates: any = {
      lastMessage: {
        text: message.text || 'Photo',
        timestamp: message.timestamp,
        senderId: senderId,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: [], // Clear deletedBy so conversation reappears
    };
    
    // Increment unread count for each recipient
    recipients.forEach((recipientId: string) => {
      updates[`unreadCounts.${recipientId}`] = 
        admin.firestore.FieldValue.increment(1);
    });
    
    await convRef.update(updates);
    
    console.log(
      `✅ Updated unread counts for ${recipients.length} recipients in ${conversationId}`
    );
  });
```

---

## 🔄 Notification Decision Logic

### When a Message Arrives

```typescript
// In globalMessageListener.ts

const handleNewMessage = async (
  conversationId: string,
  message: Message,
  conversation: Conversation
) => {
  // Skip if message is from current user
  if (message.senderId === currentUserId) return;
  
  // Get app state
  const appState = AppState.currentState;
  const activeConversationId = await getActiveConversation();
  
  // SCENARIO 1: User is viewing this exact chat
  if (appState === 'active' && activeConversationId === conversationId) {
    // Do nothing - message will appear in chat and be auto-marked as read
    return;
  }
  
  // SCENARIO 2: User is in app but different chat
  if (appState === 'active' && activeConversationId !== conversationId) {
    // Show in-app banner
    showInAppNotification(
      conversationId,
      getSenderName(message.senderId, conversation),
      message.text,
      getSenderInitials(message.senderId, conversation)
    );
    return;
  }
  
  // SCENARIO 3: App is backgrounded
  if (appState === 'background' || appState === 'inactive') {
    // Show local push notification
    await showLocalPushNotification(
      conversationId,
      getSenderName(message.senderId, conversation),
      message.text
    );
    return;
  }
};
```

---

## 🧪 Testing Plan

### Test Scenario 1: In-App, Different Chat
1. Open app, go to Chat A
2. Have another user send message to Chat B
3. **Expected:** Banner slides down showing "User B: Message preview"
4. Tap banner → Navigate to Chat B
5. **Expected:** Banner dismisses, Chat B opens, message is there

### Test Scenario 2: Background Notification
1. Open app, then minimize (home button)
2. Have another user send message
3. **Expected:** OS notification appears on lock screen
4. Tap notification → App opens to that chat

### Test Scenario 3: Offline Catch-Up
1. Enable airplane mode on device
2. Have another user send 3 messages across 2 chats
3. Disable airplane mode
4. **Expected:** Notification shows "5 new messages from 2 chats"

### Test Scenario 4: Unread Indicators
1. Receive messages in 3 different chats while app is closed
2. Open app
3. **Expected:** Conversation list shows:
   - Chat A: Red badge "3" on avatar, blue dot on right
   - Chat B: Red badge "1" on avatar, blue dot on right
   - Chat C: Red badge "1" on avatar, blue dot on right
4. Open Chat A
5. **Expected:** Badge and dot disappear for Chat A
6. Go back to list
7. **Expected:** Chat B and C still have badges/dots

---

## 🚀 Implementation Order

### Phase 1: Foundation (2 hours)
1. ✅ Update `types/index.ts` with unread counts
2. ✅ Add unread count functions to `conversationService.ts`
3. ✅ Create Cloud Function for auto-incrementing unread counts
4. ✅ Deploy Cloud Function

### Phase 2: Unread Indicators (1 hour)
5. ✅ Update conversations list to show unread badges
6. ✅ Update chat screen to reset unread count on open
7. ✅ Test unread count tracking

### Phase 3: In-App Notifications (2 hours)
8. ✅ Create `InAppNotificationBanner` component
9. ✅ Create `hooks/useInAppNotifications.ts`
10. ✅ Integrate banner into `app/_layout.tsx`
11. ✅ Test in-app banner notifications

### Phase 4: Background & Global Listener (2 hours)
12. ✅ Create `services/globalMessageListener.ts`
13. ✅ Add background notification triggers
14. ✅ Integrate global listener into `app/_layout.tsx`
15. ✅ Test background notifications

### Phase 5: Offline Catch-Up (1 hour)
16. ✅ Add offline timestamp tracking
17. ✅ Add catch-up notification logic
18. ✅ Test offline catch-up scenario

### Phase 6: Testing & Polish (1 hour)
19. ✅ Test all 4 scenarios end-to-end
20. ✅ Fix bugs and edge cases
21. ✅ Update memory bank documentation

---

## 📊 Technical Decisions

### Why Local Notifications?
- ✅ Work on both iOS and Android without dev build
- ✅ No Expo Go limitations
- ✅ Same UX as push notifications when app is backgrounded
- ✅ Simpler to implement than FCM
- ❌ Don't work when app is force-quit (acceptable for MVP)

### Why Not FCM Remote Push?
- ❌ Requires development build for Android
- ❌ Requires paid Expo account for projectId
- ❌ More complex server-side setup
- ✅ Can add later for production (Cloud Functions already ready)

### Why In-App Banners?
- ✅ Better UX than alerts
- ✅ Non-intrusive
- ✅ Matches iOS/WhatsApp patterns
- ✅ Can queue multiple notifications

### Unread Count Storage Location
- ✅ Store in Firestore conversation document (`unreadCounts: { [userId]: number }`)
- ✅ Denormalized for fast reads
- ✅ Updated via Cloud Function for consistency
- ✅ Can be reset client-side (instant feedback)

---

## 🔒 Security Considerations

### Firestore Rules Update
```javascript
// conversations/{conversationId}
match /conversations/{conversationId} {
  allow read: if isParticipant(conversationId, request.auth.uid);
  allow update: if isParticipant(conversationId, request.auth.uid) 
    && onlyUpdatingOwnUnreadCount(request.resource.data, resource.data);
}

// Helper function
function onlyUpdatingOwnUnreadCount(newData, oldData) {
  let affectedKeys = newData.unreadCounts.keys().toSet()
    .difference(oldData.unreadCounts.keys().toSet());
  
  return affectedKeys.size() == 1 
    && affectedKeys.hasOnly([request.auth.uid])
    && newData.unreadCounts[request.auth.uid] == 0;
}
```

---

## 🎯 Success Criteria

After implementation, all 4 scenarios should work:

1. ✅ In-app banner appears when message arrives in different chat
2. ✅ Local notification appears when app is backgrounded
3. ✅ Catch-up notification shows message count after offline period
4. ✅ Unread dots appear in conversation list with accurate counts
5. ✅ Unread counts reset when opening chat
6. ✅ No duplicate notifications (proper de-duplication)
7. ✅ Works on both iOS and Android simulators

---

## 📝 Next Steps

Ready to implement? Let's start with **Phase 1: Foundation** (Task #1 in the TODO list).

Would you like me to:
1. Start implementing immediately (I'll update the types and create the Cloud Function)
2. Review the plan first and make adjustments
3. Answer questions about the architecture

Just say "start implementing" and I'll begin with Task #1! 🚀

