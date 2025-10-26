# Action Items - Intelligence & Bug Fixes

## Critical Issues to Fix

### 1. Assignment Detection Failing for Clear Statements 🐛
**Problem:** "I can handle the MongoDB setup" → Unassigned (should be assigned to Hadi)

**Root Cause:** AI prompt doesn't emphasize first-person commitments strongly enough

**Fix Location:** `functions/src/ai/actionItems.ts` - lines 146-194

**Enhanced Prompt Addition:**
```typescript
First-person commitment detection (CRITICAL):
- "I can handle X" → assign to speaker
- "I'll take care of X" → assign to speaker  
- "Let me do X" → assign to speaker
- "I can do X" → assign to speaker
- Pattern: ANY first-person commitment = assigned to that speaker

Extract speaker name EXACTLY as it appears in the message format.
```

---

### 2. "undefined" Appearing in Action Item Context 🐛
**Problem:** Context shows: "undefined requests Hadi to make charts lighter"

**Root Cause:** When extracting context, if the speaker/subject isn't clear, AI uses "undefined"

**Fix Location:** `functions/src/ai/actionItems.ts` - prompt lines 175-177

**Enhanced Context Guidelines:**
```typescript
- context: Brief context WITHOUT pronouns or undefined references
  * BAD: "undefined requests Hadi to..."
  * GOOD: "Request to make charts lighter for mobile performance"
  * GOOD: "Follow-up from database discussion"
  * Focus on WHAT needs to be done, not WHO said it (we already have assignee field)
```

**Backend Filtering:** Add validation to reject items with "undefined" in context field

---

### 3. Semantic Deduplication for Active Action Items 🔄
**Problem:** Duplicate action items appearing (e.g., "Setup MongoDB" vs "Handle MongoDB setup")

**Root Cause:** No semantic similarity check between existing pending action items

**Solution:** Leverage Decision page deduplication logic with OpenAI embeddings

**Implementation:**
- Generate embedding for new action item task
- Compare with existing pending items using cosine similarity
- Threshold: 85% similarity = duplicate
- Keep higher confidence item, skip lower confidence duplicate
- Only check against active items (status = "pending", not deleted/completed)

**Reference:** `functions/src/ai/decisionTracking.ts` - semantic deduplication at 75% threshold

**Files to modify:**
- `functions/src/ai/actionItems.ts` - Add embedding generation and similarity check
- Use existing `cosineSimilarity()` from `utils/openai.ts`

---

## Intelligence Improvements

### 4. Smarter Pronoun Resolution
**Enhancement:** Map pronouns to conversation participants better

**Examples:**
- "Can you update the docs?" in 2-person chat → assign to other person
- "I'll handle this" → assign to speaker (already attempted, needs strengthening)
- "@Hadi please do X" → assign to Hadi (works)

**Implementation:** Enhance pronoun detection in lines 274-287

---

### 5. Filter by Confidence Threshold (User Adjustable)
**Add:** Settings toggle for confidence threshold

- Default: 75% (current)
- Options: 70%, 75%, 80%, 85%
- Stored in user preferences

---

## Quick Fixes Summary

**Immediate (30 min):**
1. Enhance AI prompt for first-person commitments ("I can handle X" → assigned to speaker)
2. Add "undefined" validation filter in context extraction

**Short-term (1-2 hours):**
3. Semantic deduplication using embeddings (85% similarity threshold)
4. Stronger pronoun → user mapping in 2-person conversations

**Future (2 hours):**
5. Adjustable confidence threshold setting (user preferences)

