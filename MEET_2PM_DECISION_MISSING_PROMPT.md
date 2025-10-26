# "Meet at 2 PM" Decision Missing - Investigation Prompt

## Problem Statement

The "Meet on the special project at 2 PM" decision is not appearing after re-running decision extraction, despite having 90% confidence and meeting all threshold requirements. This decision exists in Firestore but only in deleted status (last deleted at 10/25/2025 7:31:22 PM). The conversation (Glr9E7Wq_SxP1hf1Hd8N8Mpe5jmsm between Dan and Myles) has 6 messages according to extraction logs, which exceeds the 2+ message requirement. The semantic deduplication system is correctly filtering by `status == "active"` (line 349 of decisionTracking.ts), so it should NOT be blocking this decision since all existing versions are deleted. When extraction runs, logs show "AI extracted 1 decisions, 1 passed quality filters" for this conversation but it's a different decision (likely the "Meet for the special project at 2 PM" was filtered out by the AI during generation). Current thresholds: 73% similarity deduplication, 2+ messages context, 40%+ confidence minimum.

## Evidence from Logs and Database

The most recent extraction logs (from firebase functions:log) show: "extractDecisions: conv=Glr9E7WqcIDrkDMqm8jx_SxP1hf1Hd8N8Mpe5jmsm, user=SxP1hf1Hd8N8Mpe5jmsm" → "Processing 6 messages for extraction" → "AI extracted 1 decisions, 1 passed quality filters" → "[Deduplication] Found semantic duplicate: 'Meet at 2 PM for the special project...' matches existing 'Meet for the special project at 2 PM...' (94.6% similar)" → "[Deduplication] Existing decision has equal/higher confidence, skipping new one" → "[Deduplication] Results: 0 to add, 0 to update, 1 duplicates skipped". This suggests the AI IS extracting the decision, but the deduplication is finding an "existing" decision with 94.6% similarity. However, when running `npx ts-node functions/scripts/show-all-decisions.ts`, ALL versions of "Meet at 2 PM" decisions are in DELETED status (items #8, #14, #16, #17, #24 in deleted list), with NO active version visible. The query at line 349 uses `.where("status", "==", "active")` so deleted decisions should not be compared.

## Investigation Tasks

Investigate why the deduplication system is finding a 94.6% similar "existing" decision when all "Meet at 2 PM" decisions are deleted: (1) Check if there's a race condition where the decision status hasn't propagated when the query runs, (2) Verify the Firestore query at line 347-350 is truly filtering by status before comparison, (3) Check if there's a caching issue causing old decision data to be used, (4) Add more detailed logging to show the ID and status of the "existing" decision it's comparing against (specifically around line 426-455 where similarity comparison happens), (5) Test if manually running the Firestore query `db.collection("decisions").where("conversationId", "==", "Glr9E7Wq...").where("status", "==", "active").get()` returns any decisions, (6) Consider if the semantic deduplication needs to also check the status of the "existing" decision before marking as duplicate, and (7) Review why the log says "Found semantic duplicate" with "Existing decision has equal/higher confidence" when there should be no active existing decision to compare against. The expected behavior is: if all versions of a decision are deleted, re-running extraction should create a new active version.

## Current Code Context

**File:** `functions/src/ai/decisionTracking.ts`  
**Lines 345-512:** Semantic deduplication logic  
**Line 349:** `where("status", "==", "active")` - should filter deleted decisions  
**Line 417:** `SIMILARITY_THRESHOLD = 0.73` - currently 73%  
**Lines 427-481:** Comparison loop that found the 94.6% duplicate  

**Conversation Details:**
- ID: `Glr9E7Wq_SxP1hf1Hd8N8Mpe5jmsm`
- Participants: Dan, Myles
- Messages: 6 total
- Expected Decision: "Meet on the special project at 2 PM" (90% confidence)
- All existing versions: DELETED status

**Test Command:**
```bash
cd /Users/mylessjs/Desktop/MessageAI/functions
npx ts-node scripts/show-all-decisions.ts | grep "2 PM"
```

