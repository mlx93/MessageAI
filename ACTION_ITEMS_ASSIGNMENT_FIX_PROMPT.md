# Action Items Assignment & Extraction Logic - Fix Required

## Context
We have an action items extraction system using GPT-4o that analyzes team conversation messages and extracts actionable tasks. The system is working but has critical assignment detection issues that need to be fixed.

## Current Problems

### Problem 1: First-Person Commitments Not Assigning Correctly
When someone says **"I can handle X"** or **"I'll handle X"**, the system should assign the task to that speaker, but it's currently showing as "Unassigned". For example, if Hadi says "I can handle the MongoDB setup", the task should be assigned to Hadi automatically.

### Problem 2: Second-Person Assignments Not Working
When someone says **"You do X"** or **"Hadi, you take Y"**, the system should assign the task to the person being addressed. For example, "Hadi, you take the frontend work" should assign the task to Hadi. Currently, these show as "Unassigned" as well.

### Problem 3: Task Extraction From Wrong Context
Looking at a conversation showing casual messages like "You did an awesome job!", "Yes, great work Hadi!", and "Thanks everyone for the great conversation today!", the system is extracting a task called "Sharing Updated mockups" which doesn't appear anywhere in those messages. The AI is hallucinating or inferring tasks that weren't actually discussed.

## Technical Architecture

**File Location:** `functions/src/ai/actionItems.ts` (Firebase Cloud Function)

**Flow:**
1. Function receives conversationId and retrieves messages from Firestore
2. Messages are formatted as: `[index] SenderName: message text`
3. GPT-4o analyzes with structured output (Zod schema)
4. Returns array of action items with: task, assignee, deadline, context, messageId, confidence
5. Backend maps assignee names to user IDs using participantDetails
6. Frontend displays items with assignee names

**Key Code Sections:**
- Lines 147-223: AI prompt with extraction rules
- Lines 195-212: Assignee extraction rules (CRITICAL section)
- Lines 338-419: Backend pronoun resolution and name mapping
- Lines 349-363: Self-reference detection ("I", "me", "myself")
- Lines 363-391: Other-reference detection ("you" - added but may be buggy)

## What Needs to Be Fixed

### Fix 1: Strengthen First-Person Detection
The AI prompt already includes these patterns, but they're not working consistently:
```
"I can handle X" → assign to speaker
"I'll take care of X" → assign to speaker
"Let me do X" → assign to speaker
```

**Required:** The AI must extract the speaker's EXACT NAME from the message format (e.g., if message is `[5] Hadi R: I can handle the MongoDB setup`, assignee should be "Hadi R", NOT "I" or "me"). The backend fallback logic (lines 352-363) tries to resolve "I" to the speaker, but it's better if the AI extracts the correct name upfront.

### Fix 2: Implement Robust Second-Person Detection
Currently partially implemented (lines 363-391) but not working. When the AI extracts assignee as "you" or "You", the backend should:
1. Find the sender of the message
2. In 2-person conversations, assign to the OTHER participant
3. In group conversations, look for explicit names like "Hadi, you take X" → extract "Hadi" as assignee

**Challenge:** The AI needs to understand that in "Hadi, you take the frontend", the assignee is "Hadi", not "you".

### Fix 3: Prevent Hallucination and Improve Context Matching
The AI is extracting tasks that don't exist in the conversation. Looking at messages like:
- "You did an awesome job!"
- "Yes, great work Hadi!"
- "Thanks everyone for the great conversation today!"

There's no mention of "mockups" or "sharing" anything. The extracted task "Sharing Updated mockups" appears to be completely fabricated.

**Required:** Strengthen the AI prompt to:
1. Only extract tasks that are EXPLICITLY stated in the messages
2. The task text must use words that appear in the actual messages
3. If no clear action item exists, return empty array rather than inferring
4. Increase confidence threshold further if needed (currently 85%)

## Current AI Prompt Excerpt (Lines 195-222)

```
Assignee extraction rules (CRITICAL):
- First-person commitments = ALWAYS assign to speaker:
  * "I can handle X" → assign to speaker
  * "I'll take care of X" → assign to speaker
  * "Let me do X" → assign to speaker
  * ANY "I will/can/should/could do X" → assign to speaker
- Direct assignments:
  * "@PersonName please do Y" → assign to PersonName
  * "PersonName, can you do Y?" → assign to PersonName
- In 2-person conversations:
  * "Can you do X?" → assign to the OTHER person (not the speaker)
  * "Could you handle X?" → assign to the OTHER person
- If completely unassigned, set assignee to null
- NEVER use pronouns like "I", "me", "myself", "you" as assignee value
- NEVER use generic terms like "someone", "anyone", "they" as assignee
- Always extract the actual NAME from the sender field
```

## Desired Behavior Examples

| Message | Current Behavior | Expected Behavior |
|---------|-----------------|-------------------|
| `[2] Hadi R: I can handle the MongoDB setup` | Assignee: null (Unassigned) | Assignee: "Hadi R" |
| `[5] Dan G: Hadi, you take the frontend work` | Assignee: null or "you" | Assignee: "Hadi" |
| `[8] Myles L: Can you finish the benchmarks?` (in 2-person chat) | Assignee: null | Assignee: "Dan G" (the other person) |
| Casual conversation with no action items | Extracts "Sharing Updated mockups" | Return empty array (no items) |

## Solution Approach

You need to:
1. **Revise the AI prompt** (lines 147-223) to be more explicit about extracting speaker names and parsing "PersonName, you..." patterns
2. **Fix the backend fallback logic** (lines 338-419) to better handle "you" references in group conversations
3. **Add stronger hallucination prevention** to the prompt - emphasize that task text must contain words from the actual messages
4. **Test with the sample messages** provided to ensure "I can handle" assigns correctly and casual conversations don't generate fake tasks

## Additional Context
- Messages format: `[index] DisplayName: message text`
- Confidence threshold: 85% minimum (recently raised from 75%)
- Semantic deduplication: 85% similarity threshold (already implemented)
- participantDetails map: `{userId: {displayName: "First Last"}}`
- The system uses `nameToUserId` mapping (case-insensitive) to convert names to Firebase user IDs

Please fix these issues by updating the AI prompt and backend logic to correctly assign tasks based on first-person ("I/I'll") and second-person ("you/PersonName, you") patterns, and prevent extraction of tasks that don't exist in the conversation.

