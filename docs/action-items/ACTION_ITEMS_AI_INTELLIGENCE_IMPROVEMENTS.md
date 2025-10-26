# Action Items - AI Intelligence Improvements Investigation

**Date:** October 26, 2025  
**Status:** Investigation Required  
**Agent Task:** Investigate and resolve 3 persistent AI extraction issues

---

## 🎯 5-Sentence Problem Statement

Despite deploying fixes for duplicate detection (80% threshold), message context validation, and user filtering, we're still seeing three critical issues with AI action item extraction: (1) Multiple semantically identical MongoDB tasks being created ("Handle MongoDB setup" and "Get MongoDB ready today"), (2) action item detail pages showing the LAST message in the thread instead of the SOURCE message that generated the action item, and (3) first-person commitments like "I'll handle MongoDB" showing as unassigned instead of being assigned to the message sender. The root causes appear to be: inadequate GPT-4o prompt engineering causing the AI to extract duplicates and return wrong message indexes, and SENDER token resolution failing in the backend. We need to improve the AI prompt using few-shot examples from the test conversations (top 70 lines of ACTION_ITEMS_PHASE_3_CRITICAL_FIXES_PROMPT.md show expected behavior), add better validation/fallbacks, and ensure the messageId and assignee resolution logic works correctly. The goal is to make extraction more intelligent without adding RAG (since we're only analyzing one conversation at a time with full message history available to GPT-4o).

---

## 🐛 Three Persistent Issues

### Issue A: Duplicate MongoDB Tasks Still Created
**Problem:** Two items exist in Firestore:
- "Handle the MongoDB setup" (Hadi, 95% confidence)
- "Get MongoDB ready today" (Hadi, 95% confidence)

**Expected:** Only ONE task should be created (they're semantically identical)

**Current State:**
- Backend deployed with 80% similarity threshold (was 85%)
- Batch deduplication should catch 82% similarity
- But duplicates persist in database

### Issue B: Wrong Source Message in Detail View
**Problem:** Action item detail page shows wrong message context
- Item: "Have final mockups by Friday EOD"
- Shows: Last message in thread instead of source message
- Expected: Should highlight the message "I'll have final mockups by Friday EOD"

**Current State:**
- Enhanced logging deployed to validate task/message matches
- messageId conversion from AI index to Firestore document ID
- Frontend loads context but highlights wrong message

### Issue C: Unassigned "I'll Handle" Tasks
**Problem:** First-person commitments not assigned to sender
- Message: "I can handle the MongoDB setup" (Hadi)
- Task created: "Handle the MongoDB setup"
- Assignee: **null/undefined** ❌
- Expected: Assigned to Hadi ✅

**Current State:**
- AI should return `assignee: "SENDER"`
- Backend should resolve SENDER → actual user ID
- Resolution logic exists but failing

---

## 📚 Key Files to Investigate

### 1. AI Prompt Engineering
**File:** `functions/src/ai/actionItems.ts`
- **Lines 171-291:** Main GPT-4o prompt with extraction rules
- **Lines 244-277:** ASSIGNEE EXTRACTION RULES (SENDER token instructions)
- **Lines 219-234:** Anti-hallucination rules
- **Current Issue:** Prompt may be too generic, needs few-shot examples

### 2. Message Index & Resolution
**File:** `functions/src/ai/actionItems.ts`
- **Lines 293-319:** NEW logging showing AI output and message array
- **Lines 643-710:** MessageId conversion logic (index → document ID)
- **Lines 677-710:** NEW task/message validation (warns if <30% match)
- **Lines 724-760:** SENDER token resolution to actual user ID

### 3. Duplicate Detection
**File:** `functions/src/ai/actionItems.ts`
- **Lines 419-503:** Batch deduplication (threshold now 80%)
- **Lines 457-463:** NEW similarity logging for all comparisons
- **Lines 585-655:** Existing item duplicate check (uses 85% threshold)

### 4. Expected Behavior Reference
**File:** `docs/Action_Items/ACTION_ITEMS_PHASE_3_CRITICAL_FIXES_PROMPT.md`
- **Lines 1-86:** Expected action items from test conversations
- **Lines 14-51:** Scenario 1 (#backend-team) - Shows MongoDB should dedupe
- **Lines 78-83:** Shows "Have final mockups" with correct source message
- **Use these as few-shot examples for GPT-4o**

### 5. Test Conversations
**File:** `test-conversations.md`
- **Lines 1-50:** Scenario 1 (#backend-team) with MongoDB messages
- **Lines 107:** "I'll have final mockups by Friday EOD" (correct source)
- **Lines 23, 29:** Two MongoDB messages that should dedupe

---

## 🔍 Investigation Sub-Tasks

### Sub-Task 1: Diagnose Duplicate Detection Failure
**Goal:** Understand why MongoDB tasks aren't deduplicating

**Steps:**
1. Check Firebase Functions logs for latest extraction: `firebase functions:log extractActions --limit 100`
2. Look for: `[Batch Dedup] Comparing: "Handle MongoDB..." vs "Get MongoDB..."`
3. Verify similarity score shown (should be ~82%)
4. Check if comparison even happens (both items in same batch?)
5. Determine: Are they being extracted in different runs? Or same batch but threshold still too high?

**Hypothesis:** 
- Either: Similarity is actually <80% (need to lower to 75%)
- Or: AI is extracting them with different wording, lowering similarity
- Or: They're being extracted in separate extraction runs

### Sub-Task 2: Diagnose Wrong Source Message
**Goal:** Understand why messageId points to wrong message

**Steps:**
1. Check Firebase logs for task/message validation: `grep "Task/message match"`
2. Look for warnings: `⚠️ Low match between task and message (25% match)`
3. Check AI output logs: `🔍 AI returned these items with messageIds:`
4. Compare AI-returned index vs actual message array: `📋 Messages array (DESC order)`
5. Verify: Is AI returning wrong index? Or is conversion logic buggy?

**Hypothesis:**
- AI is returning incorrect message index (needs better prompt guidance)
- Or: AI is confused by DESC message order
- Or: messageId conversion has off-by-one error

### Sub-Task 3: Diagnose SENDER Token Resolution Failure
**Goal:** Understand why "I'll handle" tasks are unassigned

**Steps:**
1. Check Firebase logs for SENDER resolution in action
2. Look for AI output: Does it show `Assignee: SENDER` or `Assignee: null`?
3. Check message index access: Does `messages[messageIndex].sender` exist?
4. Verify participantDetails has sender's display name
5. Trace through resolution logic with actual log output

**Hypothesis:**
- AI isn't returning "SENDER" (returns null instead)
- Or: messageIndex is wrong, so wrong sender is resolved
- Or: Sender field missing from message data
- Or: participantDetails doesn't have the user

### Sub-Task 4: Improve AI Prompt with Few-Shot Examples
**Goal:** Make GPT-4o more accurate using concrete examples

**Steps:**
1. Extract 3-5 example conversations from lines 1-86 of CRITICAL_FIXES_PROMPT
2. Format as few-shot examples showing correct extractions
3. Add to prompt BEFORE the generic rules
4. Include examples of what NOT to extract (duplicates)
5. Show correct SENDER token usage with actual names

**Example Structure:**
```
EXAMPLE 1 (First-person commitment):
[0] Hadi Raad: I can handle the MongoDB setup
→ Extract: {task: "Handle MongoDB setup", assignee: "SENDER", messageId: "0"}

EXAMPLE 2 (Direct assignment):
[0] Dan: Myles, can you have benchmarks ready by Wednesday?
→ Extract: {task: "Have benchmarks ready by Wednesday", assignee: "Myles", messageId: "0"}

EXAMPLE 3 (Duplicate - DON'T extract both):
[0] Hadi: I'll get MongoDB ready today
[5] Hadi: I can handle the MongoDB setup
→ Only extract ONE (prefer more specific: message [0] with deadline)
```

### Sub-Task 5: Add Validation & Fallbacks
**Goal:** Detect and handle edge cases gracefully

**Recommendations:**
1. **Task/Message Validation:** Already deployed (warns <30% match)
2. **SENDER Fallback:** If resolution fails, assign to conversation creator or leave unassigned with clear reason
3. **MessageId Validation:** Verify message exists and contains relevant text BEFORE storing
4. **Duplicate Prevention:** Log similarity scores for ALL comparisons (already deployed)
5. **Confidence Adjustment:** Lower confidence if assignee is unclear

---

## 🎯 Success Criteria

After investigation and fixes:

1. **Duplicates Fixed:**
   - Only 1 MongoDB task in Firestore (not 2)
   - Firebase logs show: `[Batch Dedup] 1 batch duplicates removed`
   - Similarity of 82% successfully triggers deduplication

2. **Source Message Fixed:**
   - Action item detail page highlights correct source message
   - "Have final mockups by Friday" shows Hadi's message, not last message
   - Firebase logs show: `✓ Task/message match validated (>70% word overlap)`

3. **SENDER Assignment Fixed:**
   - "I'll handle MongoDB" assigns to Hadi (not unassigned)
   - Firebase logs show: `✓ Resolved SENDER → Hadi Raad (uid: xxx)`
   - All first-person commitments properly assigned

---

## 📊 Testing Approach

1. **Delete all action items** from Firebase Console (fresh start)
2. **Re-extract** from test conversations after fixes
3. **Check Firebase logs** for all diagnostic output
4. **Verify in app:**
   - Only 1 MongoDB task exists
   - Detail pages show correct source messages
   - All "I'll handle" tasks are assigned
5. **Test with multiple users** to verify filtering still works

---

## 🚀 Deliverables

1. **Improved AI Prompt** with few-shot examples (no code changes needed elsewhere)
2. **Root Cause Analysis** for each issue with logs/evidence
3. **Fix Verification** showing before/after Firebase logs
4. **Updated Documentation** explaining the improvements

---

## 💡 Key Insights

- **No RAG needed:** GPT-4o already sees full conversation history
- **Few-shot > Rules:** Concrete examples teach better than abstract rules
- **Validation critical:** Catch AI mistakes before storing in Firestore
- **Logging essential:** New diagnostic logs will reveal exact failure points
- **Iterative fixes:** May need to adjust thresholds/prompts based on real data

---

**Next Steps:** Investigate each sub-task in order, check Firebase logs extensively, and improve the AI prompt with few-shot examples from the test conversations.

