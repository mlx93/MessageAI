# Decision Deduplication Bug Investigation

**Date:** October 26, 2025  
**Status:** 🔍 Investigation in Progress - Enhanced Logging Deployed

## Problem Statement

A high-confidence decision ("Meet on the special project at 2 PM" - 90% confidence) is being blocked as a duplicate even though all existing versions are in DELETED status. The semantic deduplication system should only compare against `status == "active"` decisions.

## Evidence Collected

### 1. Database State (Verified via Script)
Running `debug-decision-query.ts` for conversation `Glr9E7Wq_SxP1hf1Hd8N8Mpe5jmsm`:

**Query 1: All decisions (no filter)**
- Found **6 total decisions**
- ALL have `status: "deleted"`
- Decision IDs: HXghwKmmt79bnT2uXaL1, XblgR2EZBcJToQ3OQtbU, dOSXPgBWuXXolLUpzBpN, fr80sHTWOmw8W5arlFYg, tfHKuOEZm7asK1RdkYRG, zQri8QnCMuFbGXYbPlYG

**Query 2: Active decisions only (what deduplication uses)**
- Found **0 active decisions** ✅
- This is the expected result!

**Query 3: All active "Meet" decisions across database**
- Found 2 active "Meet" decisions
- BOTH are in DIFFERENT conversations
- Neither matches the target conversation ID

### 2. Critical Observation: Embedding Data

One deleted decision has an embedding already generated:
```
ID: tfHKuOEZm7asK1RdkYRG
Decision: "Meet for the special project at 2 PM...."
Status: deleted
Confidence: 0.9
Has Embedding: YES  ← ← ← ONLY ONE WITH EMBEDDING
Created: Sat Oct 25 2025 19:21:05 GMT-0500
```

This suggests this decision was created during a previous extraction run and later deleted.

### 3. Firebase Logs Analysis

According to the logs from `firebase functions:log`:
```
[Deduplication] Found semantic duplicate: 
  'Meet at 2 PM for the special project...' 
  matches existing 
  'Meet for the special project at 2 PM...' 
  (94.6% similar)

[Deduplication] Existing decision has equal/higher confidence, skipping new one

[Deduplication] Results: 0 to add, 0 to update, 1 duplicates skipped
```

## The Bug: Query vs Reality Mismatch

**Expected Behavior:**
1. Query for `conversationId == X AND status == "active"` → Returns 0 results
2. No existing active decisions to compare against
3. New decision should be created

**Actual Behavior:**
1. Query executes (presumably returns 0 results)
2. Somehow finds a 94.6% similar existing decision
3. Blocks the new decision as a duplicate

## Hypotheses

### Hypothesis 1: Firestore Query Not Filtering (TESTED - RULED OUT)
- ✅ Composite index exists for `conversationId + status`
- ✅ Manual query in script returns 0 active decisions
- ❌ Query IS working correctly when run outside the function

### Hypothesis 2: Race Condition
- Function might be comparing against a decision it just created
- Timing: Query → Create → Query again in same invocation?
- Needs investigation: Is the function being called multiple times rapidly?

### Hypothesis 3: Stale Cache
- Firestore might be serving cached results
- However, Firebase Admin SDK doesn't use persistence by default
- Less likely but possible

### Hypothesis 4: Wrong Conversation ID
- Logs might be from a different conversation
- However, prompt explicitly states the conversation ID
- Can verify with enhanced logging

### Hypothesis 5: Query Executed on Wrong Collection/Index
- Query might not be using the correct index
- Could be scanning wrong data
- Unlikely given index definition exists

## Actions Taken

### 1. Enhanced Logging (DEPLOYED ✅)
Added comprehensive logging to `decisionTracking.ts`:

**Line 350-352:** Log query parameters
```typescript
console.log(
  `[Deduplication] Query params: conversationId="${conversationId}"`
);
```

**Line 362-369:** Log each existing decision returned by query
```typescript
if (existingDecisions.size > 0) {
  console.log("[Deduplication] Existing decision IDs and statuses:");
  existingDecisions.docs.forEach((doc) => {
    const data = doc.data();
    console.log(
      `  - ${doc.id}: status="${data.status}", ` +
      `text="${(data.decision || "").slice(0, 50)}..."`
    );
  });
}
```

**Line 473-476:** Log details of duplicate match
```typescript
console.log(
  "[Deduplication] Existing decision details:" +
  ` ID=${existing.id}, confidence=${existing.confidence.toFixed(2)}`
);
```

### 2. Created Debug Script
`functions/scripts/debug-decision-query.ts` - Reusable tool to verify query behavior

### 3. Deployment
- ✅ All functions deployed successfully
- Enhanced logging now active in production
- Next extraction will reveal the actual query behavior

## Next Steps

### Immediate (User to Execute)
1. **Trigger a new decision extraction** for the conversation:
   - Open the MessageAI app
   - Navigate to Ava > Decisions
   - Run extraction on the Dan/Myles conversation

2. **Check Firebase logs** immediately after:
   ```bash
   cd /Users/mylessjs/Desktop/MessageAI
   firebase functions:log --limit 50 | grep -A 10 -B 5 "Deduplication"
   ```

3. **Look for these key log lines:**
   - `[Deduplication] Query params: conversationId="..."`
   - `[Deduplication] Found X existing decisions`
   - If X > 0: `[Deduplication] Existing decision IDs and statuses:`
   - `[Deduplication] Existing decision details: ID=...`

### Expected Results from Logs

**If Bug is Confirmed:**
- Logs will show `Found 0 existing decisions`
- BUT still logs `Found semantic duplicate`
- This would prove a logic error in the comparison loop

**If Query is Actually Returning Results:**
- Logs will show `Found N existing decisions` (N > 0)
- Will see decision IDs and their statuses
- Would prove the query filter isn't working

**If Conversation ID is Wrong:**
- Logs will show different conversation ID
- Would explain the mismatch

## Potential Fixes (Based on Root Cause)

### If Query Filter Not Working:
```typescript
// Option 1: Force fresh read
const existingDecisions = await db.collection("decisions")
  .where("conversationId", "==", conversationId)
  .where("status", "==", "active")
  .get({source: "server"}); // Force server read

// Option 2: Filter in application code
const existingDecisionData: ExistingDecision[] = existingDecisions.docs
  .filter((doc) => doc.data().status === "active") // Extra safety filter
  .map((doc) => { ... });
```

### If Race Condition:
```typescript
// Add check to prevent self-comparison
const existingDecisionData: ExistingDecision[] = existingDecisions.docs
  .map((doc) => {
    const data = doc.data();
    // Skip if created in last 5 seconds (same invocation)
    const createdAt = data.createdAt?.toMillis() || 0;
    if (Date.now() - createdAt < 5000) return null;
    return { ... };
  })
  .filter((d): d is ExistingDecision => d !== null);
```

### If Stale Cache:
```typescript
// Clear Firestore cache before query
db.terminate().then(() => {
  // Re-query after clearing cache
});
```

## Files Modified

1. **functions/src/ai/decisionTracking.ts**
   - Lines 350-352: Added query parameter logging
   - Lines 362-369: Added existing decision details logging
   - Lines 473-476: Added duplicate match details logging

2. **functions/scripts/debug-decision-query.ts** (NEW)
   - Standalone script to verify query behavior
   - Shows all decisions vs active decisions
   - Analyzes conversation-specific and global "Meet" decisions

## Test Conversation Details

- **Conversation ID:** `Glr9E7WqcIDrkDMqm8jx_SxP1hf1Hd8N8Mpe5jmsm`
- **Participants:** Dan, Myles
- **Messages:** 6 total
- **Expected Decision:** "Meet on the special project at 2 PM" (90% confidence)
- **Current State:** All versions DELETED

## Related Documentation

- `MEET_2PM_DECISION_MISSING_PROMPT.md` - Original problem description
- `DECISION_DEDUPLICATION_DEPLOYMENT_COMPLETE.md` - Semantic deduplication implementation
- `DECISION_SEMANTIC_DEDUPLICATION_COMPLETE.md` - Original feature documentation

## Verification Commands

```bash
# Check decision query behavior
cd /Users/mylessjs/Desktop/MessageAI/functions
npx ts-node scripts/debug-decision-query.ts

# Check Firebase logs
firebase functions:log --limit 50 | grep -A 10 "Deduplication"

# Show all decisions
npx ts-node functions/scripts/show-all-decisions.ts | grep "2 PM"
```

---

**Status:** Waiting for user to trigger extraction and provide logs from enhanced logging deployment.

