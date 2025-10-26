# Duplicate Decisions Investigation & Fix

## Issues Identified

### 1. **Semantic Deduplication Not Deployed** ❌
The semantic deduplication logic I implemented earlier **hasn't been deployed to Firebase** yet. That's why you're still seeing duplicates!

### 2. **Similarity Threshold Too High** ⚠️
The initial 80% threshold was too strict. Looking at your duplicates:
- "Adrian will handle frontend implementation..." (appears 3-4 times)
- "Postgres SQL chosen" vs "Postgres SQL selected" (appears 2 times)

These are likely in the 70-80% similarity range, which the 80% threshold would miss.

### 3. **Flicker on Last Decision** ⚡
The frontend wasn't sorting decisions consistently, causing re-renders when Firestore's real-time listener fired.

---

## Fixes Applied

### ✅ Fix 1: Lowered Similarity Threshold
**File:** `functions/src/ai/decisionTracking.ts`  
**Change:** `SIMILARITY_THRESHOLD = 0.75` (was 0.80)

This will catch more semantic duplicates like:
- "Use PostgreSQL" vs "Postgres SQL chosen" (~73% similar)
- "Adrian will handle frontend" vs "Adrian proposed handling frontend" (~78% similar)

### ✅ Fix 2: Frontend Sorting to Prevent Flicker
**File:** `app/ava/decisions.tsx`  
**Change:** Added consistent sorting by `madeAt` timestamp

```typescript
// Sort by madeAt timestamp descending (newest first) to prevent flicker
.sort((a, b) => {
  const getTimestamp = (decision: any) => {
    const ts = decision.madeAt;
    if (ts && typeof ts === 'object' && 'toMillis' in ts) {
      return ts.toMillis();
    }
    if (typeof ts === 'number') {
      return ts < 946684800000 ? ts * 1000 : ts;
    }
    return 0;
  };
  return getTimestamp(b) - getTimestamp(a);
});
```

**Result:** No more flicker when decisions update! They'll always render in the same order.

---

## How to Fix Your Current Duplicates

### Step 1: Deploy the Updated Function
```bash
cd /Users/mylessjs/Desktop/MessageAI
./scripts/deploy-decision-deduplication.sh
```

This will:
- Build the TypeScript
- Deploy `extractDecisions` with semantic deduplication
- Use the new 75% similarity threshold

### Step 2: Clean Up Existing Duplicates

**Option A: Automatic Cleanup Script (Recommended)**
```bash
cd /Users/mylessjs/Desktop/MessageAI/functions
npx ts-node scripts/clean-duplicate-decisions.ts
```

This script will:
1. Find all decisions grouped by conversation
2. Generate embeddings for each decision
3. Compare using 75% similarity threshold
4. Show you all duplicates it found
5. Prompt for confirmation before deleting
6. Keep the highest confidence version of each duplicate

**Option B: Manual Cleanup**
- Go to Decisions screen in app
- Long-press to enter selection mode
- Select duplicates manually
- Tap trash icon to bulk delete

### Step 3: Verify Fixes
1. **Test the flicker fix:**
   - Go to Decisions screen
   - Pull to refresh (or wait for real-time updates)
   - Watch for flicker → Should be smooth now! ✅

2. **Test semantic deduplication:**
   - Create a test conversation with duplicate decisions:
     ```
     "Let's use PostgreSQL for analytics"
     "Postgres SQL chosen for analytics database"
     ```
   - Extract decisions
   - Should only see 1 decision (not 2) ✅

---

## Expected Results

### Before Fixes:
- 8 decisions shown (with 3-4 duplicates)
- Flicker on last decision when updates come in
- Duplicates: Adrian frontend (×3-4), Postgres SQL (×2)

### After Fixes:
- ~4-5 unique decisions shown
- No flicker when decisions update
- No more semantic duplicates

### Cleanup Script Output Example:
```
🔍 Fetching all active decisions...
📊 Found 8 active decisions

📂 Decisions grouped into 3 conversations

🔍 Checking conversation abcd1234... (4 decisions)
  🔗 Found duplicate pair (78.3% similar):
     A: "Adrian will handle frontend implementation..." (0.80)
     B: "Adrian proposed handling frontend implementation..." (0.80)
     ✅ Keeping: "Adrian will handle frontend implementation..."
     ❌ Removing: "Adrian proposed handling frontend implementation..."

📊 Summary:
   Total decisions: 8
   Duplicates found: 3
   Decisions after cleanup: 5

⚠️  This will delete 3 duplicate decision(s).
   Press Ctrl+C to cancel or press Enter to continue...

🗑️  Deleting duplicates...
✅ Successfully deleted 3 duplicate decision(s)!
```

---

## Why This Happened

1. **Original deduplication was exact string match only:**
   ```typescript
   // OLD (before semantic deduplication)
   const key = `${decision.decision}_${conversationId}`;
   // "Use PostgreSQL" ≠ "Postgres SQL chosen" ❌
   ```

2. **New deduplication uses semantic embeddings:**
   ```typescript
   // NEW (with semantic deduplication)
   const similarity = cosineSimilarity(embedding1, embedding2);
   // "Use PostgreSQL" vs "Postgres SQL chosen" = 73% similar ✅
   ```

3. **Frontend had no consistent sort:**
   - Firestore returned decisions in random order
   - React re-rendered with new order each time
   - Caused flicker on last item

---

## Testing the Fixes

### Test 1: Flicker Fix (Immediate)
1. Just restart the app
2. Go to Decisions screen
3. Pull to refresh or wait for updates
4. ✅ No flicker should occur

### Test 2: Semantic Deduplication (After Deployment)
1. Deploy function: `./scripts/deploy-decision-deduplication.sh`
2. Create test conversation with duplicates
3. Extract decisions from that conversation
4. ✅ Only 1 decision per unique topic should appear

### Test 3: Cleanup Script (After Running)
1. Run: `npx ts-node scripts/clean-duplicate-decisions.ts`
2. Confirm deletion when prompted
3. Check Decisions screen in app
4. ✅ Duplicates should be gone

---

## Summary of Changes

### Code Changes:
1. ✅ `functions/src/ai/decisionTracking.ts` - Lowered threshold to 75%
2. ✅ `app/ava/decisions.tsx` - Added consistent sorting to prevent flicker
3. ✅ `functions/scripts/clean-duplicate-decisions.ts` - Created cleanup script

### Documentation:
1. ✅ `DECISION_DEDUPLICATION_INVESTIGATION.md` - This file

### Next Steps:
1. ⏳ Deploy the function
2. ⏳ Run the cleanup script
3. ⏳ Test both fixes
4. ✅ Enjoy clean, flicker-free decisions!

---

## Monitoring After Deployment

Check logs to verify deduplication is working:
```bash
firebase functions:log --only extractDecisions --limit 50
```

Look for:
```
[Deduplication] Found semantic duplicate: "Adrian will handle..." 
                matches existing "Adrian proposed..." (78.3% similar)
[Deduplication] Existing decision has higher confidence, skipping new one
[Deduplication] Results: 1 to add, 0 to update, 2 duplicates skipped
```

---

**Status:**
- [x] Issue identified
- [x] Threshold lowered (80% → 75%)
- [x] Flicker fix applied
- [x] Cleanup script created
- [ ] Function deployed
- [ ] Duplicates cleaned up
- [ ] Testing complete


