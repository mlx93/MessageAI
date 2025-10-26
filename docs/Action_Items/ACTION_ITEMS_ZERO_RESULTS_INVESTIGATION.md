# Action Items Extraction Returning Zero Results - Investigation

## Problem
User has 21 conversations, but `extractActions` returns 0 action items for ALL 10 analyzed conversations (11 are skipped as deleted/hidden). Previous commits successfully extracted action items, but recent changes broke extraction.

## Key Evidence
```
📋 Extracting actions from conversation: 2142ca5d-e084-4a78-8c59-fa8ffe3304fe
✅ Extracted 0 action items from 2142ca5d-e084-4a78-8c59-fa8ffe3304fe
```
This repeats for all 10 conversations - EVERY conversation returns 0 items.

## Investigation Steps

### 1. Check Backend Logs for Message Retrieval
**File:** `functions/src/ai/actionItems.ts` (lines 95-136)

The function queries up to 200 messages per conversation:
```typescript
let query = db
  .collection(`conversations/${conversationId}/messages`)
  .where("deleted", "!=", true)
  .orderBy("deleted")
  .orderBy("timestamp", "desc");
```

**Check Firebase Function Logs for:**
- "Messages:" or message count logs after line 114
- Are messages being retrieved? Or is the query returning 0 messages?
- Look for: `if (messages.length === 0) { return {actionItems: [], count: 0}; }` (line 134-136)

**Hypothesis 1:** The query is returning 0 messages because:
- Messages don't have `deleted` field (query fails)
- Firestore index missing for `deleted + timestamp`
- Messages are in wrong collection path

### 2. Check AI Response from GPT-4o
**File:** `functions/src/ai/actionItems.ts` (lines 138-173)

After retrieving messages, the function calls GPT-4o to extract action items.

**Check Logs for:**
- Is the AI returning an empty array: `{actionItems: []}`?
- Are there errors in the AI response parsing?
- Look for logs around line 233: "Action item: ..." - if missing, AI found nothing

**Hypothesis 2:** GPT-4o is too conservative:
- Confidence threshold too high (but it's 0-1, no filtering in code)
- Messages don't match extraction patterns
- AI prompt needs adjustment

### 3. Check Duplicate Detection Logic (CRITICAL)
**File:** `functions/src/ai/actionItems.ts` (lines 191-336)

Recent commits added duplicate detection. This is the most likely culprit.

**The duplicate check compares:**
- `sameTask`: `existing.task === item.task` (line 300)
- `sameMessage`: `existing.messageId === actualMessageId` (line 301)
- `sameAssignee`: `existing.assigneeId === assigneeId` (line 302)

**Check if ALL items are being marked as duplicates:**
- Look for logs: "✓ Skipping duplicate: ..." (line 307-312)
- Are there many completed/deleted items that match new extractions?
- Check line 318-335: Should create NEW items even if matching completed/deleted ones

**Hypothesis 3:** Duplicate detection is broken:
- Comparing against wrong items
- Logic inverted (skipping everything instead of duplicates)
- `existingItems` query is returning too many results

### 4. Verify Message ID Conversion
**File:** `functions/src/ai/actionItems.ts` (lines 234-250)

The AI returns message INDEX (0, 1, 2...) but we need to convert to actual Firestore document ID.

**Check Logs for:**
- "MessageId: [X] → abc123..." conversions (line 295)
- Are conversions failing? Defaulting to wrong message ID?

**Hypothesis 4:** Message ID resolution breaks duplicate detection:
- If `actualMessageId` is always `messages[0].id`, duplicates will match incorrectly
- Check if messages array is in correct order

### 5. Check for Recent Code Changes
**Critical sections that may have changed:**
- Line 299-314: Duplicate detection for PENDING items
- Line 316-335: Handling of completed/deleted items
- Line 356-362: Batch commit logic (only commits if `newItems > 0`)

**Look for:**
- Did duplicate logic accidentally skip ALL items?
- Is `newItems++` being called? (line 353)
- Is the batch.set() call being reached? (line 340-352)

## Quick Test Commands

### Check if messages exist:
```bash
# In Firebase Console > Firestore
# Navigate to: conversations/2142ca5d-e084-4a78-8c59-fa8ffe3304fe/messages
# Verify messages exist with text content and sender
```

### Check backend logs:
```bash
# Firebase Console > Functions > Logs
# Filter: extractActions
# Look for conversation: 2142ca5d-e084-4a78-8c59-fa8ffe3304fe
# Check what's logged between "Extracting actions" and "Extraction complete"
```

### Add diagnostic logging:
Add to line 135 (after messages query):
```typescript
console.log(`📧 Retrieved ${messages.length} messages from conversation`);
console.log(`📧 Sample message: ${messages[0]?.text?.slice(0, 100)}`);
```

Add to line 174 (after AI call):
```typescript
console.log(`🤖 AI found ${result.object.actionItems.length} potential action items`);
```

Add to line 354 (inside batch loop):
```typescript
console.log(`➕ Creating new item #${newItems + 1}`);
```

## Expected Root Cause

**Most Likely:** Duplicate detection logic (lines 299-314) is incorrectly marking ALL items as duplicates, so `newItems` stays 0 and nothing gets committed.

**Check specifically:**
- Is `existingItems` array too large?
- Is the comparison logic correct?
- Are completed/deleted items being checked when they shouldn't be?

## Files to Review
1. `functions/src/ai/actionItems.ts` - Main extraction logic
2. Firebase Console > Functions > Logs - Runtime behavior
3. Firebase Console > Firestore > action_items collection - Check for pending items matching conversations

## Expected Fix
Once you identify which hypothesis is correct, likely fixes:
- **Hypothesis 1:** Fix Firestore query or index
- **Hypothesis 2:** Adjust AI prompt or lower confidence threshold
- **Hypothesis 3:** Fix duplicate detection logic (most likely)
- **Hypothesis 4:** Fix message ID resolution

