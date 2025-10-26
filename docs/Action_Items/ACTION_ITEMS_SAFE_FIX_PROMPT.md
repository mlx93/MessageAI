# Action Items Bug Fix - Safe Investigation & Repair Prompt

## 🎯 Your Mission

You are tasked with investigating and fixing 4 critical bugs in a production action items system for a React Native messaging app. The system extracts action items from conversations using GPT-4o, performs semantic deduplication with OpenAI embeddings (85% threshold), and stores them in Firestore. **CRITICAL:** This system is actively used in production. A recent change caused a breaking error: `Cannot read properties of undefined (reading 'toLowerCase')`. Your fixes MUST be done incrementally, with extensive safety checks, null guards, and thorough testing at each step. NO breaking changes are acceptable.

## 📋 Context You MUST Read First

1. **Read the investigation document:** `/Users/mylessjs/Desktop/MessageAI/ACTION_ITEMS_CRITICAL_BUGS_INVESTIGATION.md`
   - Contains full bug descriptions, root cause analysis, investigation steps, and safety guardrails
   - Read EVERY section before writing ANY code

2. **Understand the system architecture:**
   - Backend: `functions/src/ai/actionItems.ts` - 793 lines of extraction, deduplication, and storage logic
   - Frontend List: `app/ava/action-items.tsx` - List view with swipe-to-delete, bulk actions, Firestore snapshot listener
   - Frontend Detail: `app/ava/action-item-detail/[id].tsx` - Detail view showing message context (3 before, 5 after source message)
   - Current Status: ✅ Extraction working (21 items from 2 conversations)

3. **Current functionality that MUST NOT break:**
   - Semantic deduplication against existing pending items (85% similarity threshold)
   - Assignee name resolution (pronoun handling, fuzzy matching, first-person extraction)
   - Message ID conversion (AI returns array index, backend converts to Firestore doc ID)
   - Quality filtering (85% confidence minimum)
   - Firestore snapshot listeners in frontend
   - Swipeable components with refs management

## 🐛 The Four Bugs (In Priority Order)

### Bug 1: UI State - Deleted Items Persist Until Page Reload
**Impact:** Medium | **Severity:** Visual glitch, no data corruption
- Symptom: Deleted items remain visible until user leaves/returns to page
- Root Cause: Swipeable refs or snapshot listener issue
- Investigation Focus: Lines 44-173, 321-334 in `action-items.tsx`
- Safety Note: Frontend-only fix, low risk

### Bug 2: Wrong Message Context Displayed
**Impact:** High | **Severity:** User sees wrong information
- Symptom: Detail page shows LAST message instead of source message + context
- Root Cause: Potential index mismatch (DESC query order vs AI index expectations)
- Investigation Focus: Lines 86-127 in `action-item-detail/[id].tsx`, lines 494-510 in `actionItems.ts`
- Safety Note: ⚠️ Changing message ordering could break existing stored messageIds

### Bug 3: No Batch Deduplication
**Impact:** Medium | **Severity:** Creates too many similar items
- Symptom: Multiple similar tasks from same extraction (e.g., 3 MongoDB tasks)
- Root Cause: Only dedupes against existing items, not within same batch
- Implementation: Add batch dedup loop after line 360 in `actionItems.ts`
- Safety Note: New logic, doesn't modify existing code paths

### Bug 4: Assignment Failing for First-Person Commitments
**Impact:** Medium | **Severity:** Items show as "Unassigned" when they shouldn't
- Symptom: "I can handle MongoDB" shows unassigned instead of speaker's name
- Root Cause: AI might receive UIDs instead of displayNames in messages
- Investigation Focus: Lines 176, 288-302, 516-540 in `actionItems.ts`
- Safety Note: Fix must handle both new and existing data formats

## 🛡️ Non-Negotiable Safety Rules

### Before Writing ANY Code:
1. ✅ Read the entire investigation document
2. ✅ Read the relevant source files completely
3. ✅ Add diagnostic logging FIRST (no logic changes)
4. ✅ Deploy logging-only changes and observe behavior
5. ✅ Plan your fix on paper with before/after code

### While Writing Code:
1. ✅ Use optional chaining for ALL property access: `value?.property` not `value.property`
2. ✅ Validate arrays before indexing: `if (index >= 0 && index < arr.length)`
3. ✅ Check types before operations: `if (typeof value === 'string' && value.length > 0)`
4. ✅ Provide fallback values: `value || defaultValue`
5. ✅ Add extensive console.log statements for debugging
6. ✅ Comment your code explaining WHY, not just WHAT
7. ✅ Keep changes minimal - fix ONE bug at a time

### Common Pitfalls You MUST Avoid:
- ❌ NEVER use `.toLowerCase()` without checking if value exists and is a string first
- ❌ NEVER access array indices without bounds checking
- ❌ NEVER assume Firestore fields exist (they might be missing or null)
- ❌ NEVER modify arrays while iterating over them
- ❌ NEVER change existing field names or data structures (breaks old data)
- ❌ NEVER combine multiple bug fixes in one deployment
- ❌ NEVER remove existing null checks or safety guards

### Deployment Protocol:
1. ✅ Test each fix in isolation before moving to next bug
2. ✅ Deploy to Firebase: `cd /Users/mylessjs/Desktop/MessageAI && firebase deploy --only functions`
3. ✅ Watch logs in real-time: `firebase functions:log --only extractActions`
4. ✅ Test with a known conversation (2-3 participants, 20-50 messages)
5. ✅ Verify in Firebase Console that data is correct
6. ✅ Test frontend display and interactions
7. ✅ If ANY error occurs, STOP and rollback immediately

## 📝 Your Step-by-Step Process

### Phase 1: Investigation (NO code changes yet)
1. Read all source files mentioned above
2. Check Firebase Console -> Firestore -> action_items collection
   - Pick 2-3 existing items
   - Verify messageId values (should be doc IDs, not array indices)
   - Check conversation's messages collection to confirm correct message
3. Add diagnostic logging only (see investigation doc for specific logs)
4. Deploy logging changes and run extraction on test conversation
5. Study Firebase logs to understand actual behavior
6. Document findings before proposing any fixes

### Phase 2: Bug 1 Fix (Frontend UI State)
1. Add logging to track deletion flow and snapshot updates
2. Verify query in `aiService.getAllActionItems()` filters correctly
3. If needed: Add swipeable ref cleanup in useEffect cleanup function
4. Test with single item deletion, then bulk deletion
5. Deploy and verify fix

### Phase 3: Bug 2 Fix (Message Context)
1. Confirm messageId values in Firestore are doc IDs (not indices)
2. Add logging to track index conversion in backend
3. Verify messages array order (DESC) matches AI prompt display order
4. If fix needed: Add fallback logic with extensive null checks
5. Test with NEW extractions only (don't modify old data)
6. Deploy and verify detail page shows correct context

### Phase 4: Bug 3 Fix (Batch Deduplication)
1. Implement batch deduplication loop (see investigation doc for full code)
2. Insert after line 360 in `actionItems.ts`
3. Add null checks for embeddings
4. Update subsequent loop to use dedupedItems instead of itemsWithEmbeddings
5. Update final summary logs
6. Test with conversation having 2-3 similar tasks
7. Deploy and verify only 1 highest-confidence item created

### Phase 5: Bug 4 Fix (Assignment)
1. Add logging to show what m.sender contains vs what AI needs
2. If m.sender is UID: Map to displayName before sending to AI
3. Add participantDetails diagnostic logs
4. Implement message format fix (see investigation doc)
5. Add null checks for participantDetails access
6. Test with first-person commitments ("I can handle X")
7. Deploy and verify correct assignee names

## 🎯 Success Criteria

After all fixes, you should observe:

### Bug 1 Fixed:
- ✅ Swipe to delete immediately removes item from UI
- ✅ No "ghost" items remaining
- ✅ No console errors about refs or snapshots

### Bug 2 Fixed:
- ✅ Detail page highlights the SOURCE message (yellow background, "Source" badge)
- ✅ Shows 3 messages before and 5 after (when available)
- ✅ Messages in chronological order
- ✅ All participants have correct names displayed

### Bug 3 Fixed:
- ✅ Extract from conversation with similar tasks → only 1 created (highest confidence)
- ✅ Firebase logs show: "[Batch Dedup] X duplicates removed"
- ✅ Different tasks still created separately
- ✅ No false positives (non-duplicate tasks kept)

### Bug 4 Fixed:
- ✅ "I can handle MongoDB" → assigned to speaker
- ✅ "I'll do the testing" → assigned to speaker
- ✅ Firebase logs show: "🔧 Resolved self-reference 'I' → 'John Smith'"
- ✅ No more "Unassigned" for clear commitments

### Overall Health:
- ✅ Zero new errors in Firebase Functions logs
- ✅ Extraction completes in <10s for typical conversations
- ✅ All existing action items remain visible and functional
- ✅ No breaking changes to data structures
- ✅ All existing null checks and safety guards preserved

## 📚 Key Files & Line Numbers

- `functions/src/ai/actionItems.ts`:
  - Lines 100-134: Message query and filtering
  - Lines 147-253: AI prompt with assignee extraction rules
  - Lines 331-360: Embedding generation
  - Lines 362-447: Existing item deduplication (add batch dedup before this)
  - Lines 494-510: MessageId index conversion
  - Lines 516-634: Assignee resolution and pronoun handling
  - Lines 700-721: Firestore batch creation

- `app/ava/action-items.tsx`:
  - Lines 44-173: useEffect with snapshot listener
  - Lines 321-334: handleDelete function
  - Lines 42: swipeableRefs Map

- `app/ava/action-item-detail/[id].tsx`:
  - Lines 36-134: loadActionItem function
  - Lines 86-127: Message context fetching

## ⚠️ Final Warnings

1. **This is production code.** Thousands of users depend on it working correctly.
2. **Take your time.** It's better to spend 2 hours investigating than deploy a broken fix.
3. **Test thoroughly.** Every edge case, every null value, every empty array.
4. **Log everything.** You can never have too much logging during debugging.
5. **One fix at a time.** Deploy and verify each bug fix before moving to the next.
6. **Ask for help if unsure.** If you're not 100% confident in a fix, document concerns.

## 🚀 Your First Action

Start by reading these files in this order:
1. `/Users/mylessjs/Desktop/MessageAI/ACTION_ITEMS_CRITICAL_BUGS_INVESTIGATION.md` (full investigation document)
2. `/Users/mylessjs/Desktop/MessageAI/functions/src/ai/actionItems.ts` (backend logic)
3. `/Users/mylessjs/Desktop/MessageAI/app/ava/action-items.tsx` (frontend list)
4. `/Users/mylessjs/Desktop/MessageAI/app/ava/action-item-detail/[id].tsx` (frontend detail)

Then, begin Phase 1: Investigation with diagnostic logging only. Good luck! 🍀

