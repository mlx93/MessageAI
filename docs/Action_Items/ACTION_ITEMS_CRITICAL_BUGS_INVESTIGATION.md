# Action Items - Critical Bugs Investigation & Fix

## ⚠️ CRITICAL: Safety-First Approach Required

**BEFORE YOU START:**
- The action items system is PRODUCTION and actively used
- A recent breaking change caused: `ERROR [AIError] extractActions: Cannot read properties of undefined (reading 'toLowerCase')`
- We must test ALL changes in a safe, incremental manner
- NO breaking changes allowed - we need 100% confidence before deploying

**DEPLOYMENT SAFETY CHECKLIST:**
- [ ] Test each fix in isolation before combining
- [ ] Add null checks for ALL property accesses (use optional chaining `?.`)
- [ ] Validate data structures before operations (check arrays, objects exist)
- [ ] Add fallback values for potentially undefined data
- [ ] Test with edge cases: empty conversations, missing fields, null values
- [ ] Check Firebase Functions logs after each deployment
- [ ] Have rollback plan ready (previous working version committed)

## Context
We have three critical bugs in our Action Items system that need investigation and fixing. The system uses GPT-4o for extraction, OpenAI embeddings for semantic deduplication (85% threshold), and Firestore for storage.

**System Architecture:**
- **Backend:** `functions/src/ai/actionItems.ts` - Extraction logic, deduplication, storage
- **Frontend List:** `app/ava/action-items.tsx` - List view with swipe-to-delete and bulk actions
- **Frontend Detail:** `app/ava/action-item-detail/[id].tsx` - Detail view with message context
- **Current Status:** ✅ Extraction working (21 items from 2 conversations)

## Bug 1: UI State Issue - Deleted Items Persist Until Page Reload

**Symptom:** When deleting all action items, a few remain visible on the page. When the user leaves and returns, those items are gone (they were actually deleted in Firestore, but the UI didn't update properly).

**Root Cause Analysis:**
The issue is likely related to how Swipeable components maintain refs and how the snapshot listener updates the state.

**Files to Investigate:**
- `app/ava/action-items.tsx` (lines 44-173: useEffect and snapshot listener setup)
- `app/ava/action-items.tsx` (lines 321-334: handleDelete function)
- `services/aiService.ts` (check `getAllActionItems()` query definition)

**Questions to Answer:**
1. Is the Firestore snapshot listener (`aiService.getAllActionItems().onSnapshot`) properly detecting deletions?
2. When we update an item's status to 'deleted' (line 324), does the query filter (status == "pending") automatically remove it from the results?
3. Are we closing Swipeable refs properly after deletion, or could they be keeping ghost items visible?
4. Is there a race condition between the delete operation and the snapshot listener update?
5. Is the `swipeableRefs` Map being cleaned up when items are removed?

**Investigation Steps (SAFE APPROACH):**
1. **Step 1 - Add Logging Only (NO code changes):**
   - Add console logs in `handleDelete` to track deletion flow
   - Log snapshot listener updates: `console.log('Snapshot updated:', snapshot.docs.length)`
   - Track swipeable refs: `console.log('Refs in map:', swipeableRefs.size)`
   - Deploy and test - verify logging works

2. **Step 2 - Verify Query Logic:**
   - Check `aiService.getAllActionItems()` implementation
   - Confirm it queries: `.where("status", "==", "pending")`
   - Test query manually in Firebase Console
   - NO CODE CHANGES YET

3. **Step 3 - Fix Swipeable Refs (if needed):**
   - Add ref cleanup in useEffect cleanup function
   - Clear refs when items are removed from state
   - Test with 1-2 items first

**Safety Guardrails for Fix:**
- Always use optional chaining: `ref?.close()` not `ref.close()`
- Check Map has entry before accessing: `if (swipeableRefs.has(itemId))`
- Add null check before state updates
- Test deletion of single item before testing bulk delete

---

## Bug 2: Action Item Detail Shows Wrong Message Context

**Symptom:** The Action Item Details page (image shows conversation context) consistently displays the LAST message in the conversation instead of highlighting the message that generated the action item and showing surrounding context (messages before and after).

**Root Cause Hypothesis:**
The messageId conversion in backend uses DESC-ordered messages array, but AI returns indices expecting ASC order. The mismatch causes wrong message selection.

**Files to Investigate:**
- `app/ava/action-item-detail/[id].tsx` (lines 86-127: message fetching and context logic)
- `functions/src/ai/actionItems.ts` (lines 494-510: messageId parsing and assignment)
- `functions/src/ai/actionItems.ts` (line 103: message query order)

**Key Data Points:**
- The `messageId` field in action_items should contain the Firestore document ID of the message that triggered the action item
- The AI returns `messageId` as an index (e.g., "5" for `[5] Name: message`)
- Backend converts this index to actual message ID: `actualMessageId = messages[messageIndex].id`
- **CRITICAL:** Backend queries messages with `.orderBy("timestamp", "desc")` (line 103), so `messages[0]` is the NEWEST message
- **CRITICAL:** AI prompt shows messages with index: `[${i}] ${m.sender}: ${m.text}` where `i` is the array position
- If AI sees oldest message at `[0]` but backend array has newest at `[0]`, indices are backwards!

**Questions to Answer:**
1. Is the messageId being stored correctly in Firestore (actual document ID vs index)?
2. Is the backend converting AI index correctly considering DESC order?
3. Does the detail page query messages in the correct order to find context?
4. Are we reversing the array before/after sending to AI or before/after getting indices back?

**Investigation Steps (SAFE APPROACH):**

1. **Step 1 - Inspect Actual Data (NO code changes):**
   ```bash
   # Check what's actually stored in Firestore
   # Go to Firebase Console -> Firestore -> action_items
   # Pick an item and check:
   # - messageId field (should be a Firestore doc ID, not "5" or an index)
   # - conversationId field
   # Then check that conversation's messages collection
   # Find the message with that ID and verify it's the RIGHT message
   ```

2. **Step 2 - Add Diagnostic Logging (Safe, no logic changes):**
   ```typescript
   // In functions/src/ai/actionItems.ts, line 495 area:
   console.log('📊 Message Index Conversion Diagnostic:');
   console.log(`- AI returned index: ${item.messageId}`);
   console.log(`- Messages array length: ${messages.length}`);
   console.log(`- Messages array order: DESC (newest first)`);
   console.log(`- Message[0] timestamp: ${messages[0]?.timestamp}`);
   console.log(`- Message[last] timestamp: ${messages[messages.length-1]?.timestamp}`);
   console.log(`- Converted to ID: ${actualMessageId}`);
   console.log(`- Message text preview: ${messages[messageIndex]?.text?.slice(0, 50)}`);
   ```
   - Deploy ONLY this logging change
   - Extract action items from a test conversation
   - Check Firebase logs to see if indices match expectations

3. **Step 3 - Understand the Order Issue:**
   - Messages are fetched DESC (newest first)
   - AI prompt concatenates them in current array order
   - So AI sees: `[0] NEWEST ... [N] OLDEST`
   - If AI says messageId="5", it means 6th message in DESC order (6th newest)
   - Current code does: `messages[5].id` ✅ This should be correct
   - **BUT:** Check if prompt reverses the array for display!

4. **Step 4 - Check Detail Page Logic:**
   - Detail page queries messages with `orderBy('timestamp', 'asc')` (line 88)
   - This is OPPOSITE order from backend extraction
   - Then finds index of messageId in ASC array
   - This SHOULD work correctly since it's finding by ID not index

**Safety Guardrails for Fix:**
- ⚠️ **CRITICAL:** Any change to message ordering could break existing stored messageIds
- Test fix with NEW extractions only, don't modify old data
- Always validate array index before access: `if (messageIndex >= 0 && messageIndex < messages.length)`
- Add fallback: `actualMessageId = messages[messageIndex]?.id || messages[0]?.id || item.messageId`
- Check for edge cases:
  - Empty messages array
  - Invalid index (negative, too large, NaN)
  - Missing message at that index
  - Null or undefined timestamps

---

## Bug 3: Semantic Deduplication Not Working Within Same Batch

**Symptom:** Multiple similar MongoDB tasks are being generated (e.g., "I'll get MongoDB ready today", "I can handle the MongoDB setup"). These are too similar and should be deduplicated.

**Root Cause Analysis:**
- Semantic deduplication (85% similarity threshold) only compares NEW items against EXISTING pending items in Firestore
- It does NOT deduplicate within the batch of newly extracted items from the same extraction run
- This means if AI extracts 5 similar tasks in one run, all 5 get created (no cross-checking within the batch)

**Expected Behavior:**
- If the AI extracts 5 MongoDB-related tasks in a single conversation, they should be deduplicated against each other BEFORE being saved
- Only the highest-confidence version should be kept
- This should happen BEFORE comparing to existing items

**Files to Fix:**
- `functions/src/ai/actionItems.ts` (lines 325-447: deduplication logic)
- Specifically: Need to add batch deduplication between lines 336-370

**Questions to Answer:**
1. Why is the AI extracting multiple similar tasks? Is it from different messages or the same message?
   - Answer: Likely from different messages in same conversation (both discussing MongoDB setup)
2. Should we deduplicate within the batch BEFORE comparing to existing items, or AFTER?
   - Answer: BEFORE - cleaner and more efficient
3. When deduplicating within a batch, which item should we keep (highest confidence? earliest in conversation?)
   - Answer: Keep highest confidence (more reliable)

**Implementation Approach (SAFE & TESTED):**

**STEP 1: Generate embeddings for all quality items** ✅ Already done at lines 331-336

**STEP 2 (NEW): Add batch deduplication logic**
```typescript
// Insert after line 360 (after embeddings generated, before comparing to existing)

console.log('[Batch Deduplication] Checking for duplicates within newly extracted items...');
const batchDedupedItems: typeof itemsWithEmbeddings = [];
const batchDuplicatesSkipped: Array<{task: string; similarTo: string; similarity: number}> = [];

for (let i = 0; i < itemsWithEmbeddings.length; i++) {
  const currentItem = itemsWithEmbeddings[i];
  let isDuplicateInBatch = false;

  // Compare against items already added to dedupedNewItems
  for (const existingNewItem of batchDedupedItems) {
    // Safety check: ensure both embeddings exist
    if (!currentItem.embedding || !existingNewItem.embedding) {
      console.warn('[Batch Dedup] Missing embedding, skipping comparison');
      continue;
    }

    const similarity = cosineSimilarity(currentItem.embedding, existingNewItem.embedding);

    if (similarity >= SIMILARITY_THRESHOLD) {
      isDuplicateInBatch = true;
      console.log(
        `[Batch Dedup] Found duplicate in batch: "${currentItem.task.slice(0, 50)}..." ` +
        `(conf: ${currentItem.confidence.toFixed(2)}) matches ` +
        `"${existingNewItem.task.slice(0, 50)}..." ` +
        `(conf: ${existingNewItem.confidence.toFixed(2)}) - ` +
        `${(similarity * 100).toFixed(1)}% similar`
      );

      // Keep higher confidence version
      if (currentItem.confidence > existingNewItem.confidence) {
        console.log('[Batch Dedup] Replacing with higher confidence version');
        const indexToReplace = batchDedupedItems.indexOf(existingNewItem);
        if (indexToReplace !== -1) {
          batchDedupedItems[indexToReplace] = currentItem;
        }
      } else {
        console.log('[Batch Dedup] Keeping existing higher confidence version');
      }

      batchDuplicatesSkipped.push({
        task: currentItem.task,
        similarTo: existingNewItem.task,
        similarity,
      });

      break; // Stop checking other items in batch
    }
  }

  if (!isDuplicateInBatch) {
    batchDedupedItems.push(currentItem);
  }
}

console.log(
  `[Batch Deduplication] Results: ${batchDedupedItems.length} unique items, ` +
  `${batchDuplicatesSkipped.length} batch duplicates removed`
);

// Now use batchDedupedItems instead of itemsWithEmbeddings for existing item comparison
```

**STEP 3: Update existing deduplication loop** 
- Change `for (const newItem of itemsWithEmbeddings)` to `for (const newItem of batchDedupedItems)`
- Continue with existing logic

**STEP 4: Update final logs**
- Include batch duplicate count in final summary

**Safety Guardrails for This Fix:**

1. **Null Safety:**
   - Check embeddings exist before comparison: `if (!currentItem.embedding || !existingNewItem.embedding)`
   - Handle empty arrays: `if (itemsWithEmbeddings.length === 0) return ...`

2. **Array Index Safety:**
   - Check index is valid: `if (indexToReplace !== -1 && indexToReplace < batchDedupedItems.length)`
   - Use array methods safely: `.indexOf()`, `.includes()`

3. **Logic Safety:**
   - Keep same SIMILARITY_THRESHOLD (85%)
   - Use same cosineSimilarity function (no changes)
   - Preserve confidence comparison logic exactly
   - Don't modify original itemsWithEmbeddings array

4. **Testing Strategy:**
   - Test with conversation that has 2-3 clearly similar tasks
   - Verify logs show batch deduplication working
   - Check Firebase to confirm only 1 item created (highest confidence)
   - Test with conversation with NO similar tasks (should create all)
   - Test with empty results (should return gracefully)

5. **Rollback Plan:**
   - Keep this logic in a clearly marked section with comments
   - Easy to comment out entire block if issues arise
   - Doesn't affect existing item comparison logic

---

## Bug 4 (Bonus): Assignment Still Not Working for First-Person Commitments

**Symptom:** "I can handle the MongoDB setup" and "I'll get MongoDB ready today" are both showing as "Unassigned" despite our recent fixes.

**Root Cause Analysis:**
The AI is being instructed to extract the speaker's name from the message format `[index] Name: message`, but it may be:
1. Still returning "I" instead of parsing the name
2. Parsing the name but backend lookup is failing
3. Name format in prompt doesn't match actual displayNames

**Files to Investigate:**
- `functions/src/ai/actionItems.ts` (lines 209-243: AI prompt instructions for assignee extraction)
- `functions/src/ai/actionItems.ts` (lines 516-540: Pronoun resolution fallback logic)
- `functions/src/ai/actionItems.ts` (lines 288-302: nameToUserId mapping creation)

**Questions to Answer:**
1. Is the AI actually extracting the speaker's name, or still returning "I"?
2. Is the backend fallback logic (lines 526-540) being triggered?
3. Are the console logs showing the resolution process?
4. Does the nameToUserId mapping have the correct participant names?
5. Is there a case-sensitivity issue in name matching?

**Investigation Steps (SAFE APPROACH):**

1. **Step 1 - Check Actual AI Responses (NO code changes):**
   ```bash
   # Check Firebase Functions logs
   firebase functions:log --only extractActions --limit 50
   
   # Look for:
   # - What AI returned: check for "assignee: 'I'" vs "assignee: 'John Smith'"
   # - Resolution logs: "🔧 Resolved self-reference"
   # - Name mapping logs: nameToUserId contents
   ```

2. **Step 2 - Verify Message Format Sent to AI:**
   - Check line 176: `${messages.map((m, i) => [${i}] ${m.sender}: ${m.text}).join("\n\n")}`
   - The `m.sender` field - what does it contain?
   - Is it the displayName, or a userId, or phoneNumber?
   - If it's "user_abc123", AI can't extract it!

3. **Step 3 - Check participantDetails Structure:**
   ```typescript
   // Add diagnostic logging at line 290:
   console.log('👥 Participant Details for mapping:');
   Object.entries(participantDetails).forEach(([userId, details]: [string, unknown]) => {
     const detailsObj = details as {displayName?: string; phoneNumber?: string};
     console.log(`  ${userId}: displayName="${detailsObj.displayName}", phone="${detailsObj.phoneNumber}"`);
   });
   console.log('📋 nameToUserId mapping:', JSON.stringify(nameToUserId, null, 2));
   ```

4. **Step 4 - Enhance Message Display to AI:**
   - Messages should show displayName, not sender UID
   - Check if we need to map sender to displayName BEFORE sending to AI
   - Current: `m.sender` (might be UID)
   - Needed: `participantDetails[m.sender]?.displayName || m.sender`

**Potential Fix (TEST CAREFULLY):**

```typescript
// Line 176 area - update message formatting for AI prompt:
const messagesForPrompt = messages.map((m, i) => {
  // Map sender ID to display name for clarity
  const senderProfile = participantDetails[m.sender as string];
  const senderName = senderProfile?.displayName || 
                     (typeof m.sender === 'string' ? m.sender.slice(0, 8) : 'Unknown');
  return `[${i}] ${senderName}: ${m.text}`;
}).join("\n\n");

// Then use messagesForPrompt in the prompt instead of inline mapping
```

**Safety Guardrails:**
- Always check `participantDetails` exists and is an object
- Use optional chaining: `participantDetails?.[m.sender]?.displayName`
- Provide fallback names: `|| 'Unknown'`
- Don't break existing working cases (some might already have names)
- Test with:
  - Normal case: displayName exists
  - Edge case: participantDetails missing
  - Edge case: sender not in participantDetails
  - Edge case: displayName is null/undefined

---

## 🔒 Comprehensive Safety Checklist (Must Complete Before ANY Fix)

### Before Writing Code:
- [ ] Read ALL sections of this document
- [ ] Understand the current system architecture
- [ ] Identify which specific file and lines need changes
- [ ] Plan the fix with clear before/after code
- [ ] Identify all potential edge cases

### While Writing Code:
- [ ] Use TypeScript strict mode (check types, no `any`)
- [ ] Add null checks: `value?.property` instead of `value.property`
- [ ] Check array bounds: `if (index >= 0 && index < arr.length)`
- [ ] Validate objects exist: `if (obj && typeof obj === 'object')`
- [ ] Provide fallback values: `value || defaultValue`
- [ ] Add descriptive console.logs for debugging
- [ ] Keep changes minimal and focused
- [ ] Comment your code explaining WHY, not just WHAT

### Common Pitfalls to Avoid:
- ❌ Don't use `toLowerCase()` without checking if string exists first
- ❌ Don't access array indices without bounds checking
- ❌ Don't assume Firestore fields exist (they might be missing)
- ❌ Don't modify arrays while iterating over them
- ❌ Don't change existing field names or structures (breaks old data)
- ❌ Don't combine multiple fixes in one deployment

### Before Deployment:
- [ ] Test locally with Firebase emulator (if possible)
- [ ] Add extensive logging to track execution
- [ ] Review all changes one more time
- [ ] Commit current working state (for rollback)
- [ ] Deploy to a test function first (if available)
- [ ] Have Firebase Console open to monitor logs

### After Deployment:
- [ ] Watch Firebase Functions logs in real-time
- [ ] Test with a known working conversation
- [ ] Test with edge cases (empty, single message, etc.)
- [ ] Verify no errors in logs
- [ ] Check Firestore - are items created correctly?
- [ ] Test frontend - do items display properly?
- [ ] If ANY errors occur, rollback immediately

---

## 🛠️ Debugging Commands

```bash
# Check Firebase Functions logs for the most recent extraction
firebase functions:log --only extractActions --limit 100

# Watch logs in real-time while testing
firebase functions:log --only extractActions

# Check a specific action_items document in Firestore
# Go to: https://console.firebase.google.com/project/messageai-mlx93/firestore/data/action_items

# Test a single conversation extraction (replace CONV_ID)
# In app: Navigate to conversation -> Ava tab -> Tap action items -> Analyze button

# Check current function code deployed to production
cat functions/src/ai/actionItems.ts | grep -A 10 "messageId parsing"
```

---

## ✅ Expected Outputs After Fixes

### Bug 1 - UI State Fixed:
- ✅ Deleting action items immediately removes them from the UI (no ghost items)
- ✅ Swipeable refs are properly cleaned up
- ✅ No console errors about missing refs

### Bug 2 - Message Context Fixed:
- ✅ Action item detail page shows the ACTUAL message that generated the task
- ✅ Context shows 3 messages before and 5 after (if available)
- ✅ Source message is highlighted with yellow background and "Source" badge
- ✅ Messages are in chronological order

### Bug 3 - Batch Deduplication Fixed:
- ✅ Only one MongoDB task is extracted (the highest confidence one)
- ✅ Firebase logs show: "Batch Dedup: X duplicates removed"
- ✅ Similar tasks from same extraction run are deduplicated
- ✅ Different tasks (even if similar words) are kept separate

### Bug 4 - Assignment Fixed:
- ✅ "I can handle the MongoDB setup" is assigned to the person who said it
- ✅ "I'll get MongoDB ready today" is assigned correctly
- ✅ Firebase logs show: "🔧 Resolved self-reference 'I' → 'John Smith'"
- ✅ No more "Unassigned" for clear first-person commitments

### Overall System Health:
- ✅ No new errors in Firebase logs
- ✅ Extraction completes in <10 seconds for typical conversations
- ✅ All existing action items remain visible and functional
- ✅ No breaking changes to data structures

