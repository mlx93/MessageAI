# Action Items Display Bug - Debug Investigation

**Date:** October 25, 2025  
**Status:** 🔍 INVESTIGATING

## Problem Summary

Action items extraction succeeds but UI doesn't update after analysis completes.

### Expected Behavior
- User taps "Analyze Conversations"
- System analyzes 21 conversations
- Extracts action items from 6 of them
- UI updates to show newly extracted items (or confirms all are duplicates)

### Actual Behavior
- Analysis completes successfully
- Shows "Analysis complete: 6 successful, 0 errors"
- UI shows 1 item (or empty state?)
- Logs show: "10 items total, filtered to 1 item (assigned to you or unassigned)"
- All extractions return 0 new items (duplicates detected correctly)

## Key Findings

### 1. Real-Time Listener is Working
```
📋 All action items snapshot received: 10 items
📋 Filtered to 1 items (assigned to you or unassigned)
```

**This proves:**
- Firestore has 10 pending action items
- Listener receives updates correctly
- Client-side filtering reduces to 1 item for current user

### 2. Duplicate Detection is Working
```
✅ Extracted 0 action items (from all conversations)
Analysis complete: 6 successful, 0 errors
```

**This proves:**
- Extraction logic works
- All found items are duplicates (correctly skipped)
- No new items created in Firestore

### 3. The Real Question

**Are those 10 items assigned correctly?**

The filtering logic is:
```typescript
return data.assigneeId === userId || !data.assigneeId;
```

This means we show items that are:
1. Assigned to the current user (`assigneeId === userId`)
2. Unassigned (`!data.assigneeId` - meaning assigneeId is null/undefined)

**Possible Issues:**
1. Items have `assigneeId` set to OTHER users (not null, not current user)
2. Items have `assigneeId: ""` (empty string, not null) - would fail the filter
3. Items assigned to the current user but not showing due to UI bug

## Diagnostic Steps

### Step 1: Check Firestore Data Structure
```bash
# Check actual assigneeId values in Firestore Console
# For the 10 pending action items:
# - How many have assigneeId: null?
# - How many have assigneeId: <current_user_id>?
# - How many have assigneeId: <other_user_id>?
```

### Step 2: Enhanced Logging

Add detailed logging to understand the filtering:

```typescript
// In app/ava/action-items.tsx, line 55-60
const userItems = snapshot.docs.filter((doc: any) => {
  const data = doc.data();
  const isMatch = data.assigneeId === userId || !data.assigneeId;
  console.log(`📋 Item "${data.task?.slice(0, 30)}..." | assigneeId: ${data.assigneeId || 'NULL'} | userId: ${userId} | match: ${isMatch}`);
  return isMatch;
});
```

### Step 3: Check Default Assignee Logic

In the Cloud Function (line 276-282 of `functions/src/ai/actionItems.ts`):

```typescript
// Default to the current user if unassigned (their own action queue)
if (!assigneeId && !item.assignee) {
  assigneeId = userId;
  finalAssignee = currentUserName;
  console.log(
    `Defaulting unassigned item to current user: ${currentUserName}`
  );
}
```

**This logic might be the issue!** Unassigned items are being assigned to the user who runs the extraction, not left as `null`.

**Example:**
1. User A extracts action items → Unassigned items get `assigneeId = User A's ID`
2. User B opens the action items screen → Sees 0 items because they're all assigned to User A
3. User B tries to analyze → Finds duplicates (items already exist) → Creates 0 new items
4. User B's screen stays empty (correct, because no items are assigned to them)

## Root Cause Hypothesis

The issue is in the **default assignee logic**:

```typescript
// Current behavior (line 276-282)
if (!assigneeId && !item.assignee) {
  assigneeId = userId;  // ❌ Assigns to whoever runs extraction
  finalAssignee = currentUserName;
}
```

**This causes:**
- Items that should be unassigned get assigned to the user who runs extraction
- Other users can't see these items (they're not assigned to them, not null)
- Re-running extraction finds duplicates (items already exist)

## Proposed Fix

**Option 1: Remove Default Assignment (Recommended)**

Leave unassigned items as `null` so ALL users see them:

```typescript
// Don't default to current user - leave as unassigned
if (!assigneeId && !item.assignee) {
  assigneeId = null;  // ✅ Leave unassigned
  finalAssignee = null; // ✅ Leave unassigned
  console.log(`Item left unassigned (visible to all users)`);
}
```

**Option 2: Fix the Filtering Logic**

Change the UI to show items assigned to ANY user:

```typescript
// Show ALL items, not just assigned to current user
const userItems = snapshot.docs; // Don't filter

// OR show items from conversations user is in
const userItems = snapshot.docs.filter((doc: any) => {
  const data = doc.data();
  // Check if user is a participant in the conversation
  return userConversationIds.includes(data.conversationId);
});
```

**Option 3: Fix Assignment Resolution**

Better assignee resolution logic that doesn't default to extractor:

```typescript
// If no assignee can be determined, leave as null
if (!assigneeId && !item.assignee) {
  assigneeId = null;  // Unassigned
  finalAssignee = "Unassigned"; // Display value
  console.log(`No assignee determined - leaving unassigned`);
}
```

## Testing Plan

### Test 1: Check Existing Items
1. Open Firestore Console
2. Go to `action_items` collection
3. Check the 10 pending items:
   - Note each `assigneeId` value
   - Note each `assignee` value
   - Count how many are null vs assigned

### Test 2: Add Debug Logging
1. Add detailed logging to filtering (see Step 2 above)
2. Run the app
3. Open Action Items screen
4. Check logs to see which items are being filtered out and why

### Test 3: Test Fix
1. Update default assignment logic (Option 1)
2. Deploy function: `firebase deploy --only functions:extractActions`
3. Delete existing test action items (or mark as completed)
4. Run extraction again
5. Verify items appear for all users

## Expected Outcomes

### If Root Cause is Correct

**Before Fix:**
- User A extracts → Creates 3 items with `assigneeId = User A`
- User B opens screen → Sees 0 items (filtered out)
- User B analyzes → Finds 3 duplicates → Creates 0 new items
- User B still sees 0 items (correct, but confusing)

**After Fix:**
- User A extracts → Creates 3 items with `assigneeId = null`
- User B opens screen → Sees 3 items (unassigned, visible to all)
- User B analyzes → Finds 3 duplicates → Creates 0 new items
- User B still sees 3 items (correct and expected)

## Next Steps

1. ✅ **Immediate**: Add debug logging to confirm hypothesis
2. ⏳ **Once Confirmed**: Implement Option 1 (remove default assignment)
3. ⏳ **Deploy**: Update Cloud Function
4. ⏳ **Test**: Verify items appear correctly for all users
5. ⏳ **Document**: Update memory bank with findings

---

**Status:** Awaiting confirmation of Firestore data structure and assigneeId values

