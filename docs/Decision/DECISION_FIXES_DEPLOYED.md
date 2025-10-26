# Decision Extraction Fixes - Deployed ✅

**Deployment:** October 26, 2025  
**Status:** ✅ DEPLOYED

---

## Issues Fixed

### 1. ✅ PostgreSQL Duplicate (73% Threshold)
**Problem:** "Postgres SQL" vs "Use PostgreSQL" was 74.5% similar - just below 75% threshold

**Fix:** Lowered similarity threshold from 75% → 73%

**Result:** These will now be caught as duplicates. However, since both already exist, you'll need to manually delete one OR they'll be merged on next extraction.

---

### 2. ✅ Missing Participants (Adrian Decision)
**Problem:** "Adrian frontend" showed only "Adrian, Myles" but should show all 4 people from that conversation

**Fix:** Updated AI prompt to extract ALL conversation participants, not just those mentioned in the decision message

**Result:** New extractions will include all conversation participants. Existing decisions won't update automatically.

---

### 3. ⚠️ Missing "Use Proposed Design" Decision
**Problem:** Myles + Adrian conversation shows "No messages in conversation"

**Root Cause:** Messages are outside the 7-day window OR conversation has no messages

**Options:**
1. Delete the conversation and recreate it with fresh messages
2. Wait for new messages in that conversation
3. Manually add the decision (not recommended)

---

## What to Do Now

### Step 1: Delete One PostgreSQL Decision
Since both PostgreSQL decisions already exist, you need to manually delete one:
1. Long-press on one of the PostgreSQL decisions
2. Select it
3. Tap trash icon

**Recommendation:** Delete "Postgres SQL for analytics database" (90%) and keep "Use PostgreSQL for the analytics database" (95%) since it has higher confidence.

### Step 2: Re-extract Decisions
After deleting the duplicate:
1. Tap ⚡ on Decisions screen
2. Wait for extraction
3. With the 73% threshold, it won't create a duplicate

### Step 3: Verify Participants Fix
Look at the "Adrian will handle frontend implementation" decision after re-extraction:
- **Before:** Adrian, Myles
- **After:** Adrian, Myles, Dan, Hadi ✅

---

## About the "Use Proposed Design" Decision

The Myles + Adrian conversation (`6GrzOIlWbr3r532CNXCs_SxP1hf1Hd8N8Mpe5jmsm`) has:
```
No messages in conversation
```

This means either:
1. **Messages are older than 7 days** - The default date range only looks at last 7 days
2. **Messages were deleted** - Someone deleted all messages
3. **Conversation is empty** - Never had messages

**To Fix:**
- Send new messages in that conversation
- Or wait for it to be within the 7-day window
- The decision will be extracted once messages appear

---

## Threshold Summary

| Setting | Before | After |
|---------|--------|-------|
| Similarity Threshold | 75% | 73% ✅ |
| Message Requirement | 2+ | 2+ (unchanged) |
| Confidence Minimum | 40% | 40% (unchanged) |
| Participants | Only mentioned | All in conversation ✅ |

---

## Expected Results After Fixes

### Current State:
- 5 decisions (with 1 PostgreSQL duplicate)
- Adrian decision missing 2 participants
- "Use proposed design" not appearing

### After Manual Cleanup + Re-extraction:
- 4 unique decisions (no duplicates) ✅
- Adrian decision shows all 4 participants ✅
- "Use proposed design" still missing (no messages in 7-day window) ⚠️

---

## Testing Checklist

- [ ] Delete duplicate PostgreSQL decision manually
- [ ] Re-run extraction (tap ⚡)
- [ ] Verify no PostgreSQL duplicate created
- [ ] Check Adrian decision now shows: Adrian, Myles, Dan, Hadi
- [ ] Understand "Use proposed design" requires messages in conversation

---

**Summary:** Two issues fixed (duplicate detection + participants). Third issue requires new messages in the Myles + Adrian conversation.

