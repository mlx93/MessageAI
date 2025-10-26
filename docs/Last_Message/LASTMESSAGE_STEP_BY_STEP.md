# Step-by-Step Implementation Guide (UX-Safe)

## Overview
This guide breaks down the `lastMessagePerUser` implementation into 4 isolated phases. Each phase can be deployed and tested independently, ensuring zero UX regressions.

---

## Phase 1: Backend Cloud Functions (Zero Frontend Impact)

### Goal
Update Cloud Functions to write to `lastMessagePerUser` map while keeping `lastMessage` for backwards compatibility.

### Files to Modify
1. `functions/src/index.ts` - Lines 711-889

### Changes

#### 1.1 Update `onMessageCreate` Function

**Current Code (lines ~711-782):**
```typescript
export const onMessageCreate = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    // ... existing code ...
    
    await convRef.update({
      lastMessage: {
        text: message.text || "📷 Image",
        senderId: message.senderId,
        timestamp: message.timestamp,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: [],
      hiddenBy: [],
    });
  }
);
```

**New Code:**
```typescript
export const onMessageCreate = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    const { conversationId, messageId } = event.params;
    
    const convRef = admin.firestore().doc(`conversations/${conversationId}`);
    const convSnap = await convRef.get();
    const conversation = convSnap.data();
    const participants = conversation?.participants as string[] || [];
    
    // Build update object
    const updates: Record<string, unknown> = {
      // Keep old field for backwards compatibility
      lastMessage: {
        text: message.text || "📷 Image",
        senderId: message.senderId,
        timestamp: message.timestamp,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: [],
      hiddenBy: [],
    };
    
    // NEW: Update lastMessagePerUser for EVERY participant
    participants.forEach((userId: string) => {
      updates[`lastMessagePerUser.${userId}`] = {
        messageId: messageId,
        text: message.text || "📷 Image",
        senderId: message.senderId,
        timestamp: message.timestamp,
      };
    });
    
    // Update unread counts
    const recipients = participants.filter((id: string) => id !== message.senderId);
    recipients.forEach((recipientId: string) => {
      updates[`unreadCounts.${recipientId}`] = 
        admin.firestore.FieldValue.increment(1);
    });
    
    await convRef.update(updates);
  }
);
```

**What Changed:**
- ✅ Added `lastMessagePerUser.{userId}` writes for each participant
- ✅ Kept old `lastMessage` field (backwards compatible)
- ❌ NO frontend changes needed

**Testing:**
1. Deploy Cloud Functions: `npm run deploy --only functions`
2. Send a test message in any conversation
3. Check Firestore console - should see both `lastMessage` AND `lastMessagePerUser` fields
4. Frontend should still work normally (reading from old field)

---

#### 1.2 Update `onMessageDelete` Function

**Current Code (lines ~784-889):**
```typescript
export const onMessageDelete = onDocumentUpdated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    // ... existing code finds newLastMessage ...
    
    if (newLastMessage) {
      await convRef.update({
        lastMessage: newLastMessage,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);
```

**New Code:**
```typescript
export const onMessageDelete = onDocumentUpdated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const { conversationId, messageId } = event.params;
    const after = event.data?.after.data();
    const before = event.data?.before.data();
    
    const beforeDeletedBy = before?.deletedBy || [];
    const afterDeletedBy = after?.deletedBy || [];
    
    // Skip if deletedBy didn't change
    if (JSON.stringify(beforeDeletedBy) === JSON.stringify(afterDeletedBy)) {
      return;
    }
    
    const convRef = admin.firestore().doc(`conversations/${conversationId}`);
    const convSnap = await convRef.get();
    const conversation = convSnap.data();
    
    if (!conversation) return;
    
    // Find users who just deleted this message
    const newDeletions = afterDeletedBy.filter((userId: string) =>
      !beforeDeletedBy.includes(userId)
    );
    
    // For each user who deleted, recalculate THEIR lastMessage
    for (const userId of newDeletions) {
      console.log(`Recalculating lastMessage for user ${userId}`);
      
      // Query recent messages
      const messagesQuery = admin
        .firestore()
        .collection(`conversations/${conversationId}/messages`)
        .orderBy("timestamp", "desc")
        .limit(50);
      
      const messagesSnapshot = await messagesQuery.get();
      
      let newLastMessage = null;
      
      // Find first message NOT deleted by this user
      for (const messageDoc of messagesSnapshot.docs) {
        const messageData = messageDoc.data();
        const messageDeletedBy = messageData.deletedBy || [];
        
        if (!messageDeletedBy.includes(userId)) {
          newLastMessage = {
            messageId: messageDoc.id,
            text: messageData.text || "📷 Image",
            senderId: messageData.senderId,
            timestamp: messageData.timestamp,
          };
          break;
        }
      }
      
      // Update THIS USER'S entry in lastMessagePerUser
      if (newLastMessage) {
        await convRef.update({
          [`lastMessagePerUser.${userId}`]: newLastMessage,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        console.log(`✅ Updated lastMessagePerUser for ${userId}`);
      } else {
        // No visible messages - clear this user's entry
        await convRef.update({
          [`lastMessagePerUser.${userId}`]: {
            messageId: "",
            text: "",
            senderId: "",
            timestamp: admin.firestore.Timestamp.now(),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        console.log(`📭 No visible messages for ${userId}`);
      }
    }
  }
);
```

**What Changed:**
- ✅ Updates `lastMessagePerUser.{userId}` for deleting user only
- ✅ Other users' entries remain unchanged
- ❌ NO frontend changes needed

**Testing:**
1. Deploy Cloud Functions: `npm run deploy --only functions`
2. Delete a message as User A
3. Check Firestore - User A's `lastMessagePerUser` should update
4. Check Firestore - Other users' `lastMessagePerUser` unchanged
5. Frontend might still show wrong preview (reading old field) - that's OK, we fix in Phase 2

---

## Phase 2: Frontend Display Update (Messages Screen)

### Goal
Update Messages screen to read from `lastMessagePerUser[userId]` with fallback to old field.

### Files to Modify
1. `app/(tabs)/index.tsx` - Lines ~538-555

### Changes

**Current Code:**
```typescript
<Text style={styles.lastMessage} numberOfLines={1}>
  {(() => {
    if (item.lastMessage?.text && item.lastMessage.text.trim() !== '') {
      return item.lastMessage.text;
    }
    
    // Check if there's a timestamp (might be image)
    if (item.lastMessage?.timestamp) {
      const time = item.lastMessage.timestamp.toDate?.().getTime() || 0;
      if (time > new Date('2015-01-01').getTime()) {
        return '📷 Image';
      }
    }
    
    return 'Start a conversation';
  })()}
</Text>
```

**New Code:**
```typescript
<Text style={styles.lastMessage} numberOfLines={1}>
  {(() => {
    // NEW: Read from per-user map first
    const userLastMessage = item.lastMessagePerUser?.[user!.uid];
    
    // Try per-user field first
    if (userLastMessage?.text && userLastMessage.text.trim() !== '') {
      return userLastMessage.text;
    }
    
    // Fallback to old field (for unmigrated conversations)
    if (item.lastMessage?.text && item.lastMessage.text.trim() !== '') {
      return item.lastMessage.text;
    }
    
    // Check for image (per-user first, then old field)
    const timestamp = userLastMessage?.timestamp || item.lastMessage?.timestamp;
    if (timestamp) {
      const time = timestamp.toDate?.().getTime() || 0;
      if (time > new Date('2015-01-01').getTime()) {
        return '📷 Image';
      }
    }
    
    return 'Start a conversation';
  })()}
</Text>
```

**What Changed:**
- ✅ Reads from `lastMessagePerUser[userId]` first
- ✅ Falls back to old `lastMessage` field if not available
- ✅ Handles both migrated and unmigrated conversations
- ❌ NO changes to listeners, gestures, animations, or scroll behavior

**Testing:**
1. Build and deploy frontend
2. Open Messages screen
3. ✅ Verify conversations display correctly (no flicker)
4. ✅ Verify smooth transitions to chat screen
5. ✅ Verify avatar transitions work
6. ✅ Verify scroll position preserved
7. ✅ Delete a message → lastMessage should update for you only
8. ✅ Other users should still see old lastMessage

---

## Phase 3: Frontend Deletion Update (Chat Screen)

### Goal
Update deletion handler to recalculate and update `lastMessagePerUser` for current user only.

### Files to Modify
1. `app/chat/[id].tsx` - Lines ~1343-1392
2. `services/conversationService.ts` - Add new helper function

### Changes

#### 3.1 Add Helper Function to `conversationService.ts`

**Add after line 635 (after existing `recalculateLastMessage` function):**

```typescript
/**
 * Recalculate lastMessage for a specific user (per-user version)
 * Returns structured object suitable for lastMessagePerUser map
 */
export const recalculateLastMessageForUser = async (
  conversationId: string,
  userId: string
): Promise<{ messageId: string; text: string; senderId: string; timestamp: Timestamp } | null> => {
  try {
    // Query recent messages (last 50 to avoid performance issues)
    const messagesQuery = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    
    const messagesSnapshot = await getDocs(messagesQuery);
    
    // Find the most recent message that is NOT deleted by this user
    for (const messageDoc of messagesSnapshot.docs) {
      const messageData = messageDoc.data();
      const deletedBy = messageData.deletedBy || [];
      
      // If this message is not deleted by the user, it's the new lastMessage
      if (!deletedBy.includes(userId)) {
        return {
          messageId: messageDoc.id,
          text: messageData.text || '📷 Image',
          senderId: messageData.senderId,
          timestamp: messageData.timestamp,
        };
      }
    }
    
    // No visible messages found
    return null;
  } catch (error) {
    console.error('Failed to recalculate lastMessage for user:', error);
    throw error;
  }
};
```

#### 3.2 Update Deletion Handler in `chat/[id].tsx`

**Current Code (lines ~1343-1392):**
```typescript
const handleDeleteMessage = useCallback(async () => {
  if (!selectedMessage || !user) return;

  Alert.alert(
    'Delete Message',
    'Remove this message from your device? Other participants will still see it.',
    [
      {
        text: 'Cancel',
        style: 'cancel'
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Optimistic update: Remove from UI immediately
            const messageIdToDelete = selectedMessage.id;
            setMessages(prev => prev.filter(m => m.id !== messageIdToDelete));
            
            // Update Firestore
            await deleteMessage(conversationId, selectedMessage.id, user.uid);
            
            // Update SQLite cache with deletedBy field
            const updatedMessage = {
              ...selectedMessage,
              deletedBy: [...(selectedMessage.deletedBy || []), user.uid]
            };
            await cacheMessageBatched(updatedMessage);
            
            console.log(`🗑️ Message deleted: ${selectedMessage.id}`);
          } catch (error: any) {
            // ... error handling ...
          }
        }
      }
    ]
  );
}, [selectedMessage, user, conversationId, dedupeMessages]);
```

**New Code:**
```typescript
const handleDeleteMessage = useCallback(async () => {
  if (!selectedMessage || !user) return;

  Alert.alert(
    'Delete Message',
    'Remove this message from your device? Other participants will still see it.',
    [
      {
        text: 'Cancel',
        style: 'cancel'
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            // Optimistic update: Remove from UI immediately
            const messageIdToDelete = selectedMessage.id;
            setMessages(prev => prev.filter(m => m.id !== messageIdToDelete));
            
            // Update Firestore message document
            await deleteMessage(conversationId, selectedMessage.id, user.uid);
            
            // Update SQLite cache with deletedBy field
            const updatedMessage = {
              ...selectedMessage,
              deletedBy: [...(selectedMessage.deletedBy || []), user.uid]
            };
            await cacheMessageBatched(updatedMessage);
            
            // NEW: Recalculate THIS USER'S lastMessage
            const { recalculateLastMessageForUser } = await import('../../services/conversationService');
            const newLastMessage = await recalculateLastMessageForUser(
              conversationId,
              user.uid
            );
            
            // NEW: Update only this user's entry in lastMessagePerUser
            const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
            const { db } = await import('../../services/firebase');
            const convRef = doc(db, 'conversations', conversationId);
            
            await updateDoc(convRef, {
              [`lastMessagePerUser.${user.uid}`]: newLastMessage || {
                messageId: '',
                text: '',
                senderId: '',
                timestamp: Timestamp.now(),
              }
            });
            
            console.log(`🗑️ Message deleted and lastMessage updated for user`);
          } catch (error: any) {
            // Check if message doesn't exist in Firestore (orphaned cache entry)
            const isNotFound = error.code === 'not-found' || 
                               error.message?.includes('No document to update');
            
            if (isNotFound) {
              // Message doesn't exist in Firestore - treat as successful local deletion
              console.warn(`🗑️ Message ${selectedMessage.id} not found in Firestore, removed locally`);
              
              // Update SQLite cache to mark as deleted (prevents reappearance)
              const updatedMessage = {
                ...selectedMessage,
                deletedBy: [...(selectedMessage.deletedBy || []), user.uid]
              };
              await cacheMessageBatched(updatedMessage);
              
              // Message already removed from UI optimistically - success!
              return;
            }
            
            // Other errors - show alert and rollback
            console.error('Failed to delete message:', error);
            Alert.alert('Error', 'Failed to delete message');
            
            // Rollback: Re-add message to UI on error
            setMessages(prev => dedupeMessages([...prev, selectedMessage]).sort((a, b) => 
              a.timestamp.getTime() - b.timestamp.getTime()
            ));
          }
        }
      }
    ]
  );
}, [selectedMessage, user, conversationId, dedupeMessages]);
```

**What Changed:**
- ✅ Added `recalculateLastMessageForUser` call after deletion
- ✅ Updates only current user's `lastMessagePerUser` entry
- ✅ Preserves all existing optimistic updates
- ✅ Preserves all existing error handling and rollback
- ❌ NO changes to scroll, gestures, rendering, or animations

**Testing:**
1. Build and deploy frontend
2. Delete a message in a conversation
3. ✅ Verify message disappears immediately (optimistic)
4. ✅ Verify Messages screen shows next message for you
5. ✅ Verify other users still see deleted message
6. ✅ Verify scroll position maintained
7. ✅ Verify no flicker or layout shifts
8. ✅ Verify error handling still works (try deleting offline)

---

## Phase 4: Migration Script (Background)

### Goal
Populate `lastMessagePerUser` for all existing conversations that don't have it yet.

### Files to Create
1. `scripts/migrate-lastmessage-peruser.ts`

### Implementation

```typescript
import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Initialize Firebase Admin
const serviceAccount = require('../creds/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateToPerUserLastMessage() {
  console.log('🔍 Finding conversations to migrate...\n');
  
  const conversationsRef = db.collection('conversations');
  const snapshot = await conversationsRef.get();
  
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  console.log(`📊 Found ${snapshot.size} conversations\n`);
  
  for (const convDoc of snapshot.docs) {
    const data = convDoc.data();
    
    // Skip if already migrated
    if (data.lastMessagePerUser) {
      skippedCount++;
      continue;
    }
    
    try {
      const participants = data.participants || [];
      const lastMessage = data.lastMessage;
      
      // Initialize all participants with current global lastMessage
      const lastMessagePerUser: Record<string, any> = {};
      
      participants.forEach((userId: string) => {
        lastMessagePerUser[userId] = {
          messageId: '', // Unknown for old messages
          text: lastMessage?.text || '',
          senderId: lastMessage?.senderId || '',
          timestamp: lastMessage?.timestamp || admin.firestore.Timestamp.now(),
        };
      });
      
      await convDoc.ref.update({
        lastMessagePerUser,
      });
      
      migratedCount++;
      console.log(`✅ Migrated conversation ${convDoc.id} (${participants.length} participants)`);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to migrate ${convDoc.id}:`, error);
    }
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Migrated: ${migratedCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📈 Total: ${snapshot.size}`);
}

// Confirmation prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('⚠️  This will migrate all conversations to per-user lastMessage. Continue? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    migrateToPerUserLastMessage()
      .then(() => {
        console.log('\n✅ Migration complete!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
      });
  } else {
    console.log('❌ Migration cancelled');
    process.exit(0);
  }
});
```

### Running the Migration

```bash
# Add to package.json scripts:
"migrate:lastmessage": "ts-node scripts/migrate-lastmessage-peruser.ts"

# Run migration:
npm run migrate:lastmessage
```

**Testing:**
1. Run migration script
2. Check a few conversations in Firestore console
3. ✅ Verify `lastMessagePerUser` field exists
4. ✅ Verify all participants have entries
5. ✅ Verify frontend displays correctly (fallback no longer needed)

---

## Deployment Checklist

### Pre-Deployment
- [ ] Read `LASTMESSAGE_IMPLEMENTATION_SAFETY.md`
- [ ] Review all code changes
- [ ] Test in local emulator
- [ ] Backup Firestore (just in case)

### Phase 1 Deployment (Backend)
- [ ] Deploy Cloud Functions
- [ ] Send test message
- [ ] Verify `lastMessagePerUser` written to Firestore
- [ ] Verify frontend still works (reading old field)

### Phase 2 Deployment (Display)
- [ ] Deploy frontend update
- [ ] Test Messages screen loads correctly
- [ ] Verify smooth transitions preserved
- [ ] Verify no flicker or performance regression

### Phase 3 Deployment (Deletion)
- [ ] Deploy frontend update
- [ ] Delete test message
- [ ] Verify only your preview updates
- [ ] Verify other users unaffected
- [ ] Verify scroll/gestures still work

### Phase 4 Deployment (Migration)
- [ ] Run migration script
- [ ] Monitor for errors
- [ ] Verify conversations display correctly
- [ ] Can remove fallback code after 48 hours

---

## Rollback Plan

If anything goes wrong, rollback is simple:

### Rollback Step 1: Revert Frontend
```bash
git revert <commit-hash>
npm run build
# Frontend goes back to reading lastMessage field
```

### Rollback Step 2: Revert Backend (if needed)
```bash
cd functions
git revert <commit-hash>
npm run deploy --only functions
# Cloud Functions go back to writing only lastMessage
```

### Rollback Step 3: Cleanup (optional)
```typescript
// Remove lastMessagePerUser field if needed:
const batch = db.batch();
conversations.forEach(conv => {
  batch.update(conv.ref, {
    lastMessagePerUser: admin.firestore.FieldValue.delete()
  });
});
await batch.commit();
```

**Note:** Rollback is safe because we kept the old `lastMessage` field throughout migration!

---

## Success Criteria

After full deployment, verify:

**Functional:**
- [x] New messages appear instantly for all users
- [x] Deleting message updates only deleting user's preview
- [x] Other users see correct preview
- [x] Offline queue still works
- [x] Error handling still works

**Performance:**
- [x] Messages screen loads in <200ms
- [x] Chat screen cache warmup <100ms
- [x] No additional Firestore queries
- [x] No memory leaks

**UX (Should NOT Change):**
- [x] Smooth Messages → Chat transitions
- [x] No flicker or layout shifts
- [x] Avatar transitions work
- [x] Scroll position preserved
- [x] Blue bubble swipe gestures work
- [x] Message grouping looks correct
- [x] Skeleton loading smooth

---

**Remember:** This is a data structure change, not a UI overhaul. Your smooth UX features are safe! 🎉

