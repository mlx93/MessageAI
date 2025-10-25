# Fix Empty Conversation Display After Message Deletion

## Problem
When user deletes all visible messages in a conversation, it still appears on Messages screen with stale preview. Opening shows empty chat.

**Goal:** Hide conversations from Messages screen when user has no visible messages remaining.

---

## Requirements

### Behavior
- Conversation disappears when user deletes all their visible messages
- Works same for direct chats and group chats (per-user state)
- Reappears when someone sends new message
- Offline: Queue deletion, don't hide locally until synced

### Performance
- Messages screen load: <100ms (maintain cache warmup)
- Conversations have ~100 messages max
- Efficient queries with deletedBy filtering

### Multi-User State
- User A deletes all → hidden for User A only
- User B still sees conversation
- Each user has independent visibility

---

## Implementation Approach

### Strategy: Recalculate lastMessage on Deletion

**Core Logic:**
When a message is deleted, recalculate the conversation's `lastMessage` field to reflect the most recent message still visible to that user.

**How it works:**
1. User deletes message → triggers `updateConversationAfterMessageDeletion()`
2. Query all messages in conversation WHERE `deletedBy` does NOT include userId
3. Get most recent visible message (order by timestamp DESC, limit 1)
4. Update conversation's `lastMessage` field with that message
5. If NO visible messages found → set `lastMessage` to null or special marker
6. Messages screen filters out conversations with null/marker lastMessage

**Why this approach:**
- Simple: Uses existing `lastMessage` field, no schema changes
- Fast: Single query per deletion (~100 messages max)
- Clean: Messages screen just checks `if (conversation.lastMessage)` 
- Works offline: Queue the update, apply when synced
- Per-user: Each user's deletions trigger their own recalculation

**Edge cases:**
- **Group chat with multiple deleters:** Each user's deletion updates lastMessage to their view. Last deleter "wins" but that's OK - the real filter happens client-side based on each user's deletedBy state
- **All messages deleted:** lastMessage becomes null, conversation disappears from Messages screen
- **New message arrives:** Sets new lastMessage, conversation reappears
- **Pagination:** Older messages beyond 30-message listener window may exist, need to query full conversation for accurate lastMessage

**Implementation considerations:**
- Query must scan messages collection (not just cached 30 from listener)
- Consider adding index on `(conversationId, timestamp)` for performance
- Cache the calculated lastMessage in SQLite for fast Messages screen load
- Update both Firestore and SQLite cache atomically

### ⚠️ PERFORMANCE SAFEGUARDS (CRITICAL)

To maintain <100ms load times and smooth UX from MESSAGE_DELETION_FIX:

**1. Keep Deletion Optimistic (Don't Block UI)**
```
// Deletion path must stay instant
handleDelete() {
  optimisticallyRemoveFromUI()        // Instant
  updateMessageDeletedBy()            // Fast (single write)
  queueConversationUpdateAsync()      // Background, don't await
}
```

**2. Messages Screen: Filter on lastMessage Field Only**
```
// CORRECT: Fast, uses cached field
conversations.filter(c => c.lastMessage !== null)

// WRONG: Slow, queries each conversation
// DON'T DO THIS: conversations.forEach(c => queryMessages(c.id))
```

**3. Background Processing**
- Conversation update should be async (don't block deletion)
- Use cached message count when possible (avoid full query)
- Batch Firestore writes (message + conversation in one transaction)

**4. Offline Behavior**
- Queue conversation update with message deletion
- Apply both when online
- Don't query messages while offline

If these safeguards aren't followed, deletion could slow from 50ms → 500ms and Messages screen from 100ms → 1500ms, breaking the smooth UX we just optimized.

---

## Key Functions to Modify

1. **conversationService.ts** - `updateConversationAfterMessageDeletion()`
   - Query visible messages for user (filter by deletedBy)
   - Update conversation visibility state
   - Handle both direct and group chats

2. **Messages Screen** - Filter logic
   - Apply visibility filter based on chosen approach
   - Maintain <100ms load time via cache

3. **messageService.ts** - Verify
   - Deletion triggers conversation update
   - Offline queuing works correctly

---

## Testing Priorities

- [ ] Delete all messages → conversation disappears
- [ ] Delete some messages → lastMessage updates to next visible
- [ ] Group chat: each user sees their own lastMessage state
- [ ] New message → conversation reappears with new lastMessage
- [ ] Offline → queues properly, updates when online
- [ ] Performance: <100ms Messages screen load maintained
- [ ] No flicker when conversation disappears/reappears

---

## Notes

This approach is simpler than adding new fields, but has one tradeoff: in group chats, the `lastMessage` field represents the last deleter's view. However, this doesn't affect correctness because:

1. Messages screen loads conversations
2. For each conversation, client-side filtering happens based on current user's `deletedBy` state
3. If current user deleted all messages, their filter will hide it regardless of what `lastMessage` says
4. The `lastMessage` field is primarily for preview text/timestamp, not for determining visibility

Focus on maintaining smooth UX - this should be invisible to users.

