# Decision Extraction Bug - Investigation Prompt for Fresh AI Agent

## ✅ UPDATE: BUG FIXED (Oct 25, 2025)

**Root Cause:** `m.text` was `undefined` on some messages, causing `.slice()` to fail
**Fix Applied:** 
1. Added null-safe operator: `(m.text || "").slice(0, 200)`
2. Strengthened message filter to exclude messages without valid text
3. Deployed to production

**Status:** Fixed and deployed. Try analyzing conversations again.

---

# Original Investigation Prompt (For Reference)

## Problem Summary

**User Action:** Clicks "Analyze Conversations" button in Decisions page
**Expected:** Decisions extracted from recent conversations and displayed
**Actual:** JavaScript error causing extraction to fail on multiple conversations

**Error:**
```
[AIError] extractDecisions: {
  "code": "UNKNOWN", 
  "message": "Cannot read properties of undefined (reading 'slice')"
}
```

**Frequency:** Occurring on 4+ different conversations consistently

---

## How Decision Tracking Is Supposed to Work

### Architecture (from messageai-architecture.md)

**Decision tracking does NOT use Pinecone vector DB** - it uses direct AI extraction:

```
User → Firebase Callable Function: extractDecisions(conversationId)
         ↓
Firebase Function authenticates user & checks permissions
         ↓
Query Firestore: /conversations/{conversationId}/messages
         ↓
Filter messages (last 7 days, not hidden/deleted)
         ↓
Build participant name map from conversation.participantProfiles
         ↓
Send messages + participant context to OpenAI GPT-4o
         ↓
AI SDK (Vercel) extracts structured decisions using Zod schema
         ↓
Validate results & filter duplicates
         ↓
Store in Firestore: /decisions collection
         ↓
Return count to frontend
```

**Key Components:**
- **Framework:** AI SDK by Vercel (NOT LangChain)
- **LLM:** OpenAI GPT-4o
- **Storage:** Firestore (messages, conversations, decisions)
- **No Vector DB:** Decisions work on raw message text, not embeddings

### Expected Decision Schema

```typescript
{
  decision: string,
  rationale: string,
  alternativesConsidered: string[],
  participants: string[],      // First names only
  participantIds: string[],
  decisionMaker: string,        // First name
  decisionMakerId: string,
  messageIds: string[],
  confidence: number,           // 0-1
  conversationId: string,
  madeAt: number,
  status: 'active'
}
```

---

## Current Error Details

### Error Pattern
```
ERROR: Cannot read properties of undefined (reading 'slice')
```

This is a **JavaScript runtime error**, meaning:
- Something is `undefined` when we try to call `.slice()` on it
- Happening in the backend Firebase Function
- NOT an OpenAI API error
- NOT a timeout or rate limit issue

### Affected Conversations
```
- 2142ca5d-e084-4a78-8c59-fa8ffe3304fe  ❌ Fails
- 4f38d1b4-14e3-433f-b242-85b11e03b4d0  ❌ Fails  
- 6GrzOIlWbr3r532CNXCs_SxP1hf1Hd8N8Mpe5jmsm  ❌ Fails
- 8a6c4256-7d79-4b1c-863f-2c35f8a6e432  ❌ Fails
- Glr9E7WqcIDrkDMqm8jx_SxP1hf1Hd8N8Mpe5jmsm  ❌ Fails

Some conversations skipped (correctly) as deleted/hidden:
- 24f43790-1028-4be3-bf6c-c6f66c9511c5  ⏭️ Skipped
- 447860ea-c3a8-46e9-a91f-f625d0989ab0  ⏭️ Skipped
```

### Where `.slice()` Is Used

In `functions/src/ai/decisionTracking.ts`, `.slice()` is called on:

1. **Messages array** (line ~187):
   ```typescript
   const limitedMessages = messagesWithNames.slice(0, 50);
   ```

2. **Message text** (line ~206):
   ```typescript
   `[${i}] ${m.senderName}: ${m.text.slice(0, 200)}`
   ```

3. **User ID fallback** (line ~104, 112):
   ```typescript
   uidToName[uid] = `User_${uid.slice(0, 4)}`;
   ```

4. **Participant names** (line ~96):
   ```typescript
   if (name && name.includes(" ")) {
     name = name.split(" ")[0];
   }
   ```

**Most Likely Culprit:** `m.text` is `undefined` on some messages

---

## Investigation Tasks

### 1. Identify the Exact Line Causing the Error
- [ ] Check Firebase Console logs for stack trace
- [ ] Identify which `.slice()` call is failing
- [ ] Determine what variable is `undefined`

### 2. Examine Message Data Structure
- [ ] Check if some messages have `text: undefined` or `text: null`
- [ ] Verify all messages in these conversations have a `text` field
- [ ] Check for messages with empty text vs undefined text

### 3. Review Recent Code Changes
The extraction function was recently modified to:
- Limit to 50 messages with `.slice(0, 50)`
- Truncate text with `.text.slice(0, 200)`
- Extract first names with `.split(' ')[0]`

**Hypothesis:** One of these operations is called on `undefined`

### 4. Add Null Safety
Need to add checks like:
```typescript
m.text?.slice(0, 200) || ''
messagesWithNames?.slice(0, 50) || []
uid?.slice(0, 4) || 'Unknown'
```

### 5. Fix the Root Cause
Options:
1. Add null/undefined checks before `.slice()` calls
2. Filter out messages with undefined/null text earlier
3. Provide default values for missing fields

---

## Files to Investigate

### Primary Suspect
- `/Users/mylessjs/Desktop/MessageAI/functions/src/ai/decisionTracking.ts`
  - Lines ~150-210 (message processing and AI prompt building)
  - The error is happening BEFORE the AI call (it's a JS error, not AI error)

### Supporting Files
- `/Users/mylessjs/Desktop/MessageAI/services/aiService.ts`
  - Check how `extractDecisions()` is called from frontend
  - See if any preprocessing happens

- `/Users/mylessjs/Desktop/MessageAI/app/ava/decisions.tsx`
  - Frontend that calls the extraction
  - Error handling and retry logic

### Test Data
- `/Users/mylessjs/Desktop/MessageAI/test-conversations.md` (lines 144-147)
  - Shows expected decision extraction scenarios
  - Can use to verify fix

---

## Expected Deliverables

1. **Root Cause Identification**
   - Exact line number causing the error
   - Which variable is `undefined`
   - Why it's undefined (data issue vs code issue)

2. **Fix Implementation**
   - Add null safety to all `.slice()` calls
   - Filter out invalid messages early
   - Handle edge cases gracefully

3. **Testing**
   - Verify fix works on the 4+ failing conversations
   - Ensure valid decisions are still extracted
   - Confirm no regression on working conversations

4. **Prevention**
   - Add validation for required fields
   - Better error messages
   - Log which field is missing

---

## Context: Recent Changes

The extraction function was recently updated with:
- Message limiting (50 messages max)
- Text truncation (200 chars max)
- Better participant name mapping
- First name extraction
- Comprehensive logging

**These changes likely introduced the bug** by adding `.slice()` calls without null checks.

---

## Success Criteria

✅ Extraction runs without JavaScript errors
✅ Decisions with proper participant names appear in UI
✅ Firebase logs show successful extraction
✅ All 4+ failing conversations now work
✅ No regression on existing working conversations

---

## Quick Fix Suggestion

Most likely fix needed in `decisionTracking.ts`:

```typescript
// Before (BROKEN):
`[${i}] ${m.senderName}: ${m.text.slice(0, 200)}`

// After (FIXED):
`[${i}] ${m.senderName}: ${(m.text || '').slice(0, 200)}`
```

And/or filter messages earlier:

```typescript
// Filter out messages without text
.filter((doc) => {
  const data = doc.data();
  return !data.deleted &&
         !data.hiddenBy?.includes(userId) &&
         !data.deletedBy?.includes(userId) &&
         data.text && typeof data.text === 'string'; // ← Add this
})
```

---

**Start here:** Read `functions/src/ai/decisionTracking.ts` lines 150-210 and identify which `.slice()` call is on an undefined value. The error is a JavaScript runtime error, not an AI/API error.

