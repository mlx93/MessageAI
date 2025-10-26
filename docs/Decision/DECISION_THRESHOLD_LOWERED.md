# Decision Extraction Thresholds Lowered ✅

**Deployment:** October 26, 2025  
**Status:** ✅ DEPLOYED to Firebase (us-central1)

---

## Changes Made

### 1. **Message Context Threshold**
- **Before:** Required 3+ messages discussing the topic
- **After:** Requires 2+ messages discussing the topic
- **Impact:** Allows decisions with shorter discussions to be captured

### 2. **Confidence Threshold**  
- **Before:** 50% minimum confidence (0.5)
- **After:** 40% minimum confidence (0.4)
- **Impact:** Captures more decisions, including those with weaker signals

---

## Why These Changes?

Looking at your deleted decisions, you had high-quality decisions (80-90% confidence) that weren't being re-extracted:

1. **"Meet on the special project at 2 PM."** (90% confidence)
   - Dan + Myles conversation
   - Likely had only 2 messages, filtered by old 3+ requirement

2. **"Use the proposed design for the project."** (90% confidence)
   - Myles + Adrian conversation
   - May have had minimal messages in 7-day window

3. **"Targeting frontend implementation for the next sprint."** (80% confidence)
   - 4-person conversation
   - High confidence but may have lacked explicit decision language

---

## Expected Results After Re-extraction

**Before (with old thresholds):**
- Only 2 decisions extracted from your conversations

**After (with new thresholds):**
- Should extract 4-5 decisions including:
  - ✅ Hadi mobile charts (already extracted)
  - ✅ Postgres SQL database (already extracted)
  - ✅ Meet at 2 PM decision (should appear now)
  - ✅ Use proposed design (should appear now)
  - ✅ Frontend implementation targeting (should appear now)

---

## New AI Prompt Guidelines

The AI now looks for decisions with:

✅ **2+ messages** of context (was 3+)  
✅ **40%+ confidence** (was 50%+)  
✅ Decision indicators: "Let's go with X", "We decided to...", etc.  
✅ Team consensus or agreement signals  
✅ Meaningful substance (not greetings/small talk)  

---

## Testing

### Step 1: Re-run Extraction
1. Go to Decisions screen in app
2. Tap ⚡ (analytics icon)
3. Wait for extraction to complete

### Step 2: Verify Results
You should now see **more decisions** than before, including:
- The "Meet at 2 PM" decision
- The "Use proposed design" decision  
- The "Frontend implementation" decision

### Step 3: Check Logs
```bash
firebase functions:log --lines 50 | grep "AI extracted"
```

Look for:
```
AI extracted X decisions, Y passed quality filters
```

The number Y should be higher than before (was ~1-2, should be ~4-5 now).

---

## Confidence Score Breakdown

**NEW confidence interpretation:**

| Score | Meaning | Include? |
|-------|---------|----------|
| 0.9-1.0 | Clear, explicit decision with team consensus | ✅ Yes |
| 0.7-0.9 | Decision stated but limited discussion | ✅ Yes |
| 0.5-0.7 | Implicit decision, needs inference | ✅ Yes |
| 0.4-0.5 | Weak decision, minimal context | ✅ Yes (NEW!) |
| <0.4 | Unclear or questionable | ❌ No |

---

## Potential Trade-offs

### Benefits ✅
- Captures more legitimate decisions
- Fewer "missing" decisions that users expect
- Better coverage of conversations with fewer messages

### Risks ⚠️
- May include some lower-quality decisions
- Slightly more noise in the decision list
- More 40-50% confidence decisions visible

**Monitoring:** After testing, if you see too many low-quality decisions, we can adjust back to 45% threshold.

---

## What About the "No messages in conversation" Issues?

Two of your conversations showed "No messages in conversation":
- Myles + Adrian (6GrzOIl...)
- Other conversation

This is likely due to the **7-day time window**. These conversations may have:
- Messages older than 7 days
- All messages deleted or hidden
- No activity in the last week

**Solution:** The app defaults to 7 days. You can adjust this if needed, or manually analyze older conversations.

---

## Summary

✅ **Deployed:** Lower thresholds (2+ messages, 40%+ confidence)  
✅ **Expected:** 4-5 decisions will appear after re-extraction  
✅ **Quality:** Still filtered for decision indicators and substance  
✅ **Testing:** Run extraction and verify missing decisions appear  

---

**Next Step:** Re-run "Extract Decisions" in the app and verify you now see those 3 missing decisions! 🎯

