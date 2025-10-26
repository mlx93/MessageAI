# Decision UX Improvements

## Changes Needed

### 1. Clean Up Analysis Toast
**Current:** "Found 5 new decisions from the last 7 days. (15 conversations skipped)"
**New:** "Found 5 new decisions from the last 7 days."
- Remove the skipped conversations count entirely
- File: `app/ava/decisions.tsx` line ~188-193

### 2. Show All Participant Names
**Current:** "Dan, Myles +1" (truncates after 2 names)
**New:** "Hadi, Dan, Myles, Adrian" (show all first names unless space runs out)
- Display all participant first names in the decision card
- Only truncate with "+N" if names would overlap the confidence percentage (90%)
- File: `app/ava/decisions.tsx` lines ~384-395

### 3. Create Decision Detail Page
**Current:** Clicking a decision navigates to the conversation (`router.push(\`/chat/${item.conversationId}\`)`)
**New:** Navigate to a dedicated decision detail screen (`router.push(\`/decision/${item.id}\`)`)

**New File:** `app/decision/[id].tsx`
**Display:**
- Full decision text (not truncated)
- Full rationale (not truncated)
- Alternatives considered list
- Decision maker prominently displayed
- All participants
- Confidence score with visual indicator
- **Message snippets section:** Show the relevant messages (using `item.messageIds`) in chronological order with:
  - Sender name
  - Message text
  - Timestamp
  - Visual indicator connecting messages to show conversation flow
- Decision date (derived from message timestamps, not extraction time)

### 4. Fix Decision Date
**Current:** Uses `madeAt` timestamp (extraction time)
**New:** Use the timestamp from the relevant messages
- Backend should set `madeAt` to the timestamp of the last relevant message in `messageIds` array
- File: `functions/src/ai/decisionTracking.ts` line ~324-333
- Fetch the last message timestamp and use that instead of `Date.now()`

## Implementation Order
1. Backend: Fix decision date to use message timestamp
2. Frontend: Remove skipped count from toast
3. Frontend: Expand participant names display
4. Frontend: Create decision detail page with message snippets
5. Frontend: Update decision card tap handler to navigate to detail page

