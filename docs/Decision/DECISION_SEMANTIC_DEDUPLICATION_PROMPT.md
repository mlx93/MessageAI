# Decision Semantic Deduplication - Implementation Prompt

## Problem Statement

The Decisions feature is currently extracting duplicate decisions that are semantically identical but worded differently. For example, "Use PostgreSQL for the analytics database" (95% confidence) and "Postgres SQL chosen for analytics database" (95% confidence) are both showing in the list, even though they represent the same decision from the same conversation. Similarly, "Finalize and simplify mobile charts to display..." and "Simplify mobile charts to represent 7 days..." are duplicate decisions about chart simplification. The current duplicate prevention in `functions/src/ai/decisionTracking.ts` (lines 330-346) only checks for exact string matches using `${data.decision}_${data.conversationId}`, which misses these semantic duplicates. This creates a cluttered UX where users see the same decision multiple times with slight variations in wording.

## Implementation Task

Enhance the decision extraction process to detect and prevent semantically similar decisions from being added to Firestore. The solution should compare each newly extracted decision against existing decisions in the same conversation using semantic similarity (embeddings via OpenAI's text-embedding-3-small model or GPT-4o comparison). When a new decision has >80% semantic similarity to an existing decision in the same conversation, keep only the higher-confidence version or merge them intelligently. The implementation should: (1) fetch existing decisions for the conversation before the final batch write, (2) compare each new decision's text against existing ones using cosine similarity or LLM-based comparison, (3) either skip the duplicate or update the existing decision if the new one has higher confidence, (4) log all deduplication actions for debugging, and (5) ensure the solution doesn't significantly increase execution time (target <2s overhead for typical extractions). Success criteria: testing with the PostgreSQL and mobile charts examples should result in only one decision per topic being stored, with confidence scores potentially averaged or the highest one selected.

## Current Code Location

**File:** `functions/src/ai/decisionTracking.ts`  
**Lines:** 330-346 (existing exact-match duplicate prevention)  
**Function:** `extractDecisions`

## Test Cases

After implementation, re-analyze a conversation that produces these decisions:
1. "Use PostgreSQL for the analytics database" (95%)
2. "Postgres SQL chosen for analytics database" (95%)
3. "Finalize and simplify mobile charts to display..." (90%)
4. "Simplify mobile charts to represent 7 days..." (90%)

**Expected Result:** Only 2 decisions should be stored (one for PostgreSQL, one for mobile charts), not 4.

