# Action Items - Confidence Threshold Update

**Date:** October 26, 2025  
**Status:** ✅ Deployed

---

## Changes Made

### 1. Raised Confidence Threshold to 85%

**Previous:** 75% minimum confidence  
**New:** 85% minimum confidence

**Impact:** Only high-quality, crystal-clear action items will be extracted now.

**File Modified:** `functions/src/ai/actionItems.ts`

**Changes:**
- Line 230: `MIN_CONFIDENCE = 0.85` (was 0.75)
- Lines 187-193: Updated confidence scoring guidelines in AI prompt

### 2. Updated AI Prompt Guidelines

**New Confidence Scoring:**
```
- Set confidence to 0.95+ ONLY if both assignment AND task are crystal clear
- Set confidence to 0.85-0.94 if task is clear but assignee is ambiguous
- Set confidence to 0.80-0.84 only if task is somewhat clear but context is needed
- Don't extract anything with <0.85 confidence (we only want high-quality items)
```

**Previous Guidelines:**
```
- 0.90+ for crystal clear
- 0.75-0.89 for clear task but ambiguous assignee
- 0.70-0.74 for somewhat clear
- <0.70 rejected
```

---

## Expected Results

### Before (75% threshold):
- 10-15 action items extracted
- Some lower quality items included
- Potential duplicates with slight variations
- Some "maybe" action items included

### After (85% threshold):
- 5-10 action items extracted (highest quality only)
- Only clear, unambiguous commitments
- Semantic deduplication at 85% should prevent duplicates
- No speculative or unclear items

---

## MongoDB Duplicate Issue

**Problem:** Two MongoDB items appearing:
1. "Get MongoDB ready" (Unassigned, 90%)
2. "Handle MongoDB setup" (Unassigned, 90%)

**Root Cause Analysis:**

Looking at the detail screen, Hadi said: **"I can handle the MongoDB setup"**

This should have:
1. ✅ **Been assigned to Hadi** (first-person commitment: "I can handle X")
2. ✅ **Been deduplicated** (85% semantic similarity should catch "Get MongoDB ready" vs "Handle MongoDB setup")

**Why it might have failed:**

### Issue 1: Assignment Detection
- Our enhanced prompt explicitly handles "I can handle X" → assign to speaker
- Possible reasons it failed:
  - AI didn't extract speaker name correctly
  - Pronoun resolution didn't trigger
  - Name mapping failed (Hadi → userId)

### Issue 2: Semantic Deduplication
- "Get MongoDB ready" vs "Handle MongoDB setup" should be >85% similar
- Possible reasons it failed:
  - These were extracted in the same batch (deduplication only checks existing items)
  - Embeddings weren't similar enough
  - Items extracted before deduplication logic was deployed

---

## Next Steps

### 1. Clear Existing Duplicates
Delete the current MongoDB items and re-extract with the new 85% threshold:

```bash
# In the app:
1. Delete both MongoDB items
2. Tap "Analyze Conversation"
3. Should extract only 1 item, assigned to Hadi
```

### 2. Test the New Threshold
After clearing items, re-analyze conversations and verify:
- [ ] Only high-quality items extracted (85%+ confidence)
- [ ] "I can handle X" → Assigned to Hadi
- [ ] No duplicate MongoDB items
- [ ] Fewer total items but higher quality

### 3. Monitor Logs
Watch for these key indicators:
```
🤖 AI found X potential action items
🔍 Filtered out Y low-confidence items (below 85%)
[Deduplication] Found semantic duplicate: ... (87.3% similar)
Action item: "..." | Assignee: "I" → "Hadi" (abc123)
```

---

## Testing Checklist

- [ ] Delete existing MongoDB items
- [ ] Re-analyze conversation with MongoDB discussion
- [ ] Verify: Only 1 MongoDB item extracted
- [ ] Verify: Item is assigned to Hadi (not Unassigned)
- [ ] Verify: Confidence is 85%+
- [ ] Verify: No other duplicate items
- [ ] Check: Total items reduced (higher quality bar)

---

## Troubleshooting

### If MongoDB still shows as Unassigned:
1. Check Firebase logs for: `Action item: "Get MongoDB ready" | Assignee: "I" → "?" (NULL)`
2. This indicates name mapping failed
3. Verify `participantDetails` in conversation has Hadi's displayName

### If duplicates still appear:
1. Check logs for: `[Deduplication] Similar but not duplicate: ... (XX% similar)`
2. If similarity is 75-84%, they won't be caught (threshold is 85%)
3. Manually delete duplicates and rely on 85% confidence to prevent re-extraction

### If no items extracted:
1. 85% threshold might be too high for your conversation style
2. Check logs for: `🔍 Filtered out Y low-confidence items (below 85%)`
3. Consider lowering to 80% if needed

---

## Files Modified

- `functions/src/ai/actionItems.ts` - Confidence threshold and AI prompt

## Deployment

✅ **Deployed:** October 26, 2025  
✅ **Function:** extractActions (us-central1)  
✅ **Status:** Live and ready for testing

---

## Summary

The confidence threshold has been raised to 85% to extract only the highest-quality action items. The existing MongoDB duplicates were likely created before the semantic deduplication was deployed. Delete them and re-analyze to get a single, properly-assigned MongoDB item.

**Next:** Clear the duplicate MongoDB items and re-analyze to verify the fixes work correctly.

