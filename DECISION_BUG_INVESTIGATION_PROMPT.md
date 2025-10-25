# 🔍 Decision Extraction Bug - Investigation Brief

## ✅ FIXED (Oct 25, 2025 - Evening)

**Root Cause:** Multiple `.slice()` calls on potentially undefined values  
**Fixes Applied:**
1. ✅ `(m.text || "").slice(0, 200)` - null-safe text truncation
2. ✅ `(uid || "unknown").slice(0, 4)` - null-safe UID fallback (2 locations)
3. ✅ `(m.sender || "unknown").slice(0, 4)` - null-safe sender fallback
4. ✅ Filter participants to exclude undefined values
5. ✅ Validate message.sender exists before processing
6. ✅ Check `typeof name === "string"` before calling `.split()`

**Deployed:** All fixes live in production

If you still see errors after deployment, there may be another undefined field. Continue reading below for investigation guide.

---

## Previous Status: BROKEN ❌ (Now Fixed)

**Symptom:** Clicking "Analyze Conversations" causes JavaScript errors  
**Error:** `Cannot read properties of undefined (reading 'slice')`  
**Impact:** No decisions can be extracted from conversations  
**Urgency:** High - core AI feature is non-functional

---

## The Error

```javascript
[AIError] extractDecisions: {
  "code": "UNKNOWN", 
  "message": "Cannot read properties of undefined (reading 'slice')"
}
```

**Failing on 4+ conversations consistently**  
**Location:** Backend Firebase Function `extractDecisions`  
**Type:** JavaScript runtime error (NOT OpenAI API error)

---

## What Decisions Should Do

### Purpose
Extract team decisions from message conversations and display them in a dedicated UI.

### Architecture
```
Frontend (app/ava/decisions.tsx)
    ↓
Firebase Function: extractDecisions(conversationId)
    ↓
1. Fetch last 7 days of messages from Firestore
2. Build participant name map (UID → first name)
3. Send to OpenAI GPT-4o via AI SDK (Vercel)
4. Extract structured decisions (Zod schema)
5. Save to Firestore /decisions collection
    ↓
Frontend displays decisions (swipe-to-delete, bulk operations)
```

**Does NOT use Pinecone** - works directly with message text

---

## Sample Decision (From Logs)

**Problem:** Current decisions have generic data instead of real names:
```json
{
  "participants": ["Team members"],          // ❌ Should be ["Myles", "Hadi", "Dan"]
  "messageIds": ["0", "1", "2", "3"],        // ❌ Should be Firestore message IDs
  "decision": "Run tests in sequence",
  "confidence": 0.6
}
```

**Expected:**
```json
{
  "participants": ["Myles", "Hadi", "Dan"],  // ✅ First names from profiles
  "decisionMaker": "Myles",                  // ✅ Who made the decision
  "messageIds": ["abc123", "def456"],        // ✅ Actual Firestore IDs
  "decision": "Run tests in sequence",
  "confidence": 0.9
}
```

---

## Investigation Checklist

### 1. Find ALL `.slice()` Calls in `decisionTracking.ts`

Search for every instance of `.slice(` and check if the variable could be undefined:

- [ ] `messagesWithNames.slice(0, 50)` - could messagesWithNames be undefined?
- [ ] `m.text.slice(0, 200)` - **FIXED** with `(m.text || "").slice()`  
- [ ] `uid.slice(0, 4)` - could uid be undefined? (lines ~104, 112)
- [ ] `m.sender.slice(0, 4)` - could m.sender be undefined? (line ~178)
- [ ] `name.split(" ")[0]` - could name be undefined after split?
- [ ] Any other `.slice()` calls?

### 2. Check Variable Definitions

For each `.slice()` call, verify:
```typescript
// Is this safe?
uid.slice(0, 4)          // What if uid is undefined?
m.sender.slice(0, 4)     // What if sender is undefined?
name.split(" ")[0]       // What if name is undefined?
```

### 3. Check Message Data Integrity

The messages might have:
- `text: undefined` ✅ Already filtered
- `sender: undefined` ⚠️ NOT CHECKED
- `timestamp: undefined` ⚠️ NOT CHECKED

### 4. Most Likely Culprits

Based on code review, these are most likely to fail:

**Line ~104:**
```typescript
uidToName[uid] = `User_${uid.slice(0, 4)}`;
```
If `uid` is undefined from the participants array

**Line ~178:**
```typescript
senderName: senderName || `User_${m.sender.slice(0, 4)}`,
```
If `m.sender` is undefined

---

## Fix Strategy

### Immediate Fix (Null Safety)

Add guards before ALL `.slice()` calls:

```typescript
// Before:
uid.slice(0, 4)

// After:
(uid || 'unknown').slice(0, 4)
```

### Better Fix (Data Validation)

Filter out invalid data earlier:

```typescript
// Filter participants
const participants = (convData.participants || [])
  .filter(uid => uid && typeof uid === 'string');

// Validate messages
.filter((doc) => {
  const data = doc.data();
  return data.text &&
         typeof data.text === 'string' &&
         data.sender &&
         typeof data.sender === 'string' &&  // ← Add this
         data.text.trim().length > 0;
})
```

---

## Files to Check

1. **`/Users/mylessjs/Desktop/MessageAI/functions/src/ai/decisionTracking.ts`**
   - Lines 80-120: Participant name mapping
   - Lines 140-180: Message processing
   - Lines 185-220: AI prompt building
   - **Focus on any `.slice()` call**

2. **`/Users/mylessjs/Desktop/MessageAI/app/ava/decisions.tsx`**
   - Verify error handling
   - Check frontend filtering logic

3. **Linter Warnings:**
   ```
   decisionTracking.ts:240:23 - Unexpected any
   decisionTracking.ts:342:19 - Unexpected any
   ```
   These are in error handlers - fix by typing errors properly

---

## Success Criteria

✅ No JavaScript runtime errors during extraction  
✅ Decisions show real participant names (not "Team members")  
✅ Decision maker is identified correctly  
✅ messageIds contain real Firestore document IDs (not "0", "1", "2")  
✅ At least 1-2 decisions extracted from test conversations  
✅ All 4+ failing conversations now work  

---

## Debugging Strategy

1. **Find the crash:** Search ALL `.slice()` calls, add null guards
2. **Fix participant names:** Ensure uidToName map is properly built and used
3. **Fix messageIds:** AI is returning array indices instead of actual message IDs
4. **Test:** Re-deploy and verify extraction works
5. **Clean up:** Fix TypeScript any warnings

---

## Key Insight

The error "Cannot read properties of undefined (reading 'slice')" means:
- A variable is `undefined` when we call `.slice()` on it
- This is a **data validation issue**, not an AI issue
- The fix is adding null guards and better filtering
- The error happens BEFORE the AI call (during data preparation)

**Start by:** Reading `decisionTracking.ts` lines 80-220 and finding EVERY `.slice()` call. Add null guards to each one.

---

## Additional Notes

- Decisions extracted so far have wrong data: "participants": ["Team members"]
- This suggests the AI prompt isn't working correctly OR data mapping failed
- After fixing the crash, also need to verify participant mapping logic
- Frontend filtering is working (showing 0/14 decisions due to "Team members" being filtered out)

---

**Priority:** Fix the `.slice()` crash first, then fix participant name mapping.

