# Action Items - Critical Bug Fixes

**Date:** October 26, 2025  
**Priority:** CRITICAL

## Issues Found

### 1. 🐛 Deletion Not Working
**Problem:** Some action items won't delete

**Root Cause:** Query in `getAllActionItems()` filters for `status == 'pending'`, which means when we update to `status = 'deleted'`, the Firestore snapshot listener should automatically remove them. But there might be caching issues or permission problems.

**Location:** `services/aiService.ts` line 269

### 2. 🐛 Hidden/Deleted Conversation Messages Appearing
**Problem:** Action items appearing from hidden/deleted conversations

**Root Cause:** Backend `extractActions` function doesn't properly filter out messages from hidden conversations or check if individual messages are hidden for the user.

**Location:** `functions/src/ai/actionItems.ts` lines 95-120

**Current Code:**
```typescript
// Query messages from conversation subcollection
let query = db
  .collection(`conversations/${conversationId}/messages`)
  .orderBy("timestamp", "desc");
  
// Filters messages by deletedBy array, but doesn't check hiddenBy
const messages: MessageData[] = snapshot.docs
  .filter((doc) => {
    const data = doc.data();
    return !data.hiddenBy?.includes(userId) &&
           !data.deletedBy?.includes(userId) &&
           data.text;
  })
```

**Issue:** The conversation-level check happens BEFORE message query, but the query itself doesn't respect the conversation's hidden/deleted status properly.

### 3. 🐛 Random Name Assignments (Sara, etc)
**Problem:** Seeing random names like "Sara" in assignments

**Possible Causes:**
1. Test data in Firebase
2. Participant mapping picking up wrong users
3. Old action items from deleted/hidden conversations
4. Fuzzy name matching gone wrong

## Fixes Required

### Fix 1: Improve Deletion (Frontend)
**File:** `app/ava/action-items.tsx`

Add better error handling and refresh after delete:

```typescript
const handleDelete = async (itemId: string) => {
  try {
    console.log(`🗑️ Deleting action item: ${itemId}`);
    await updateDoc(doc(db, 'action_items', itemId), {
      status: 'deleted',
      deletedAt: serverTimestamp(),
      deletedBy: auth.currentUser?.uid,
    });
    
    // Force close the swipeable
    const ref = swipeableRefs.get(itemId);
    ref?.close();
    
    // Optimistically remove from state
    setActionItems(prev => prev.filter(item => item.id !== itemId));
    
    console.log(`✅ Deleted action item: ${itemId}`);
  } catch (error) {
    console.error('❌ Error deleting action item:', error);
    Alert.alert('Error', `Failed to delete action item: ${error.message}`);
  }
};
```

### Fix 2: Backend - Better Hidden/Deleted Filtering
**File:** `functions/src/ai/actionItems.ts`

Strengthen the conversation-level checks:

```typescript
// Check if conversation is deleted or hidden for the user
if (conversationData?.deleted ||
    conversationData?.hiddenBy?.includes(userId) ||
    conversationData?.deletedBy?.includes(userId)) {
  console.log(
    `⏭️  Skipping hidden/deleted conv: ${conversationId}`
  );
  return {actionItems: [], count: 0, message: 'Conversation is hidden or deleted'};
}
```

### Fix 3: Clean Up Orphaned Action Items
Need a cleanup script to remove action items from:
- Deleted conversations
- Hidden conversations
- Conversations the user is no longer part of

**Script Location:** `functions/scripts/clean-orphaned-action-items.ts`

```typescript
// Pseudo-code
for each action_item in Firestore:
  - Get conversation
  - If conversation doesn't exist: DELETE item
  - If conversation.deletedBy includes extractedBy: DELETE item
  - If conversation.hiddenBy includes extractedBy: DELETE item
  - If extractedBy not in conversation.participants: DELETE item
```

### Fix 4: Prevent Future Orphaned Items
**File:** `app/ava/action-items.tsx`

When analyzing conversations, skip hidden/deleted ones:

```typescript
// Skip deleted or hidden conversations
if (convData.deleted || 
    convData.hiddenBy?.includes(userId) ||
    convData.deletedBy?.includes(userId)) {
  console.log(`⏭️ Skipping deleted/hidden conversation: ${convDoc.id}`);
  skippedConversations++;
  setAnalyzingProgress((i + 1) / totalConversations);
  continue;
}
```

**Status:** ✅ Already implemented (line 225-232)

## Investigation Steps

### Check for "Sara" in Database
```bash
# In Firebase console or via script
1. Check all action_items for assignee = "Sara"
2. Check conversations for participantDetails with displayName = "Sara"
3. Check if "Sara" is a real user or test data
```

### Check Hidden Conversations
```bash
# Query to find hidden conversations with action items
1. Get all action_items
2. For each item, check if conversation.hiddenBy includes current user
3. Delete orphaned items
```

## Implementation Priority

1. **IMMEDIATE:** Fix deletion (Frontend optimization)
2. **IMMEDIATE:** Add cleanup script to remove orphaned items
3. **SHORT-TERM:** Strengthen backend hidden/deleted filtering
4. **MONITOR:** Watch for "Sara" or other random names

## Testing Checklist

- [ ] Delete action item → Should disappear immediately
- [ ] Hide conversation → Action items from it should not appear
- [ ] Delete conversation → Action items from it should not appear
- [ ] Leave conversation → Action items from it should not appear
- [ ] Run cleanup script → Orphaned items removed
- [ ] Re-analyze conversations → No items from hidden/deleted conversations

