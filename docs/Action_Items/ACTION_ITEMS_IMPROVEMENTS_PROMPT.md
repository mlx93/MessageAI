# Action Items - Quality & UX Improvements

## Current Issues
1. **21 action items extracted** from 2 conversations with <50 messages each (threshold may be too low)
2. **"Unassigned" vs "undefined"** assignees appearing - are these the same thing?
3. **No conversation context** - can't see who was in each conversation
4. **All items mixed together** - current user's items not prioritized
5. **Low confidence items showing** - some items at 60-70% confidence

## Improvements to Implement

### 1. Display Conversation Participants (High Priority)
**Goal:** Show who was in each conversation so users understand context

**Implementation:**
- Each action item card should display participant list
- Format: "👥 Dan G, Hadi R, Myles L" (include current user)
- Use existing `participantDetails` from conversation document
- Show first names only for cleaner UI
- Add subtle styling (small text, gray color)

**Files to modify:**
- `app/ava/action-items.tsx` - Already fetches conversation data, add participants to display
- Backend already has `participantDetails`, just pass through to frontend

### 2. Fix Assignee Logic (High Priority)
**Current state:**
- "Unassigned" = No assignee in AI extraction (orange tag)
- "undefined" = Failed to map assignee name to user ID (shows as text)

**Improvements:**
- Remove "undefined" entirely - treat as unassigned
- Better AI prompt: emphasize extracting CLEAR assignments only
- Stricter matching: only create assignee if confidence is high
- Default behavior: If unclear who's assigned, mark as unassigned (don't guess)

**Backend changes (`functions/src/ai/actionItems.ts`):**
- Lines 258-295: Improve assignee resolution logic
- If `assigneeId` is null AND `finalAssignee` is generic (like "undefined"), set `finalAssignee = null`
- Add validation: check if assignee name exists in participantDetails before setting

### 3. Intelligent Confidence Threshold (High Priority)
**Problem:** 60-70% confidence items may not be real action items

**Proposed Solution:**
- Minimum confidence: 75% (filter out 60-70% items)
- Backend: Filter items before returning: `item.confidence >= 0.75`
- Make configurable: add to user preferences or app settings

**Alternative - Tiered Display:**
- High confidence (80%+): Bold, prioritized
- Medium confidence (70-79%): Normal display
- Low confidence (60-69%): Light gray, collapsible section "Show low confidence items"

### 4. Semantic Deduplication & Quality Filtering (Medium Priority)
**Goal:** Apply same intelligence we used for Decisions semantic deduplication

**Approach:**
- Generate embeddings for action item tasks
- Check semantic similarity with existing items (85% threshold)
- Skip items that are too similar: "Schedule meeting" vs "Set up meeting time"
- Use GPT-4o-mini to validate: "Is this a real actionable task?" before creating

**Implementation:**
- Add `generateEmbedding()` call in `extractActions` function
- Store embeddings in action_items collection for future comparisons
- Add validation step: Ask GPT-4o-mini "Rate this as an action item: 1-10"
- Only create if rating >= 7

### 5. User-Focused Sorting & Filtering (High Priority)
**Current:** All items mixed together, no personalization

**Improvements:**
- **Default view:** Show only current user's assigned items
- **Toggle:** "Show all items from my conversations" (opt-in to see team items)
- **Smart sorting:**
  1. Assigned to me + high confidence (90%+)
  2. Assigned to me + medium confidence (75-89%)
  3. Unassigned from my conversations (70%+ only)
  4. Others' items (optional, collapsed by default)

**Frontend changes (`app/ava/action-items.tsx`):**
- Add filter toggle at top
- Update sorting logic (lines 122-134)
- Add section headers: "Your Action Items" / "Team Action Items"

### 6. Better AI Prompt (Medium Priority)
**Current prompt issues:**
- Too broad: extracts discussions as actions
- Low standards: accepts 60% confidence items

**Improved prompt:**
```
Extract ONLY clear, unambiguous action items where:
1. Someone explicitly commits to doing something specific
2. There's a clear deliverable or outcome
3. The task is actionable (not just discussion/decision)

DO extract:
- "I'll have the benchmarks ready by Friday" ✅
- "Can you update the Postgres docs?" ✅
- "@Dan please restart the Redis service" ✅

DON'T extract:
- "We should probably meet sometime" ❌ (too vague)
- "Let me know if you're available" ❌ (not an action)
- "What do you think about the new design?" ❌ (question, not task)

Set confidence to 90%+ ONLY if assignment and task are crystal clear.
Set confidence to 70-80% if task is clear but assignee is ambiguous.
Don't extract anything with <70% confidence.
```

### 7. Ava Integration - Natural Language Action Item Queries (High Priority)
**Goal:** Allow users to ask Ava questions about their action items in natural language

**User Experience:**
- User asks: "What do I need to do today?"
- User asks: "What's Hadi working on?"
- User asks: "Show me overdue action items"
- User asks: "What did Dan agree to do in the Redis conversation?"
- Ava responds with natural language, citing specific action items

**Query Detection Logic:**
1. **Intent Classification** (GPT-4o-mini call):
   - Detect if user query is about action items vs general chat
   - Keywords: "action", "todo", "task", "working on", "need to do", "assigned to", "overdue"
   - Question patterns: "what do I...", "what is [person]...", "show me..."
   - Return: `{ isActionItemQuery: boolean, queryType: 'user' | 'assignee' | 'status' | 'conversation' }`

2. **Context Retrieval**:
   - Fetch relevant action items based on query type:
     - `user`: Current user's assigned items
     - `assignee`: Items assigned to mentioned person (resolve name to userId)
     - `status`: Filter by pending/completed/overdue
     - `conversation`: Items from specific conversation (use semantic search to find conversation)
   - Include metadata: assignee name, conversation name, participants, deadline, confidence
   - Limit to top 20 most relevant items

3. **Smart Filtering**:
   - Date-based: "today" = items with today's deadline, "this week" = next 7 days
   - Person-based: Extract names from query, map to userIds, filter by assigneeId
   - Priority-based: "important" or "urgent" = high confidence items (90%+)
   - Overdue: Compare deadline with current date

4. **LLM Response Generation** (GPT-4o-mini call):
   - System prompt: "You are Ava, a helpful assistant. Answer questions about action items naturally."
   - Context: JSON array of relevant action items with full details
   - User query: Original question
   - Response format: Natural language with inline references
   - Example: "You have 3 action items today: 1) Prepare benchmarks (90% confidence, from Dan & Hadi conversation)..."

5. **Response Formatting**:
   - Include actionable suggestions: "Tap any item to mark complete"
   - Show confidence indicators: "I'm confident this is assigned to you" vs "This might be unassigned"
   - Offer drill-down: "Want to see all items from that conversation?"
   - Handle empty results: "I couldn't find any action items matching that. Try 'show all my tasks'?"

**Integration Points:**
- Add to existing `avaSearchChat` function (currently handles semantic search queries)
- Reuse intent classification pattern (already implemented for search vs general chat)
- Action items query path runs BEFORE semantic search (faster, more relevant)
- Falls back to general chat if not an action item query

**Frontend Changes:**
- No UI changes needed - works through existing Ava chat interface
- Consider adding quick action buttons: "View item", "Mark complete", "See conversation"
- Show action item cards inline in Ava chat (reuse existing action item card component)

**Backend Function** (`avaActionItemsChat`):
- Input: `{ query: string, userId: string }`
- Steps: Intent classification → Retrieve items → Filter/sort → LLM generation
- Output: `{ response: string, actionItems: ActionItem[], suggestedActions: string[] }`
- Caching: Cache common queries ("my tasks", "overdue") for 5 minutes

**Success Criteria:**
- User can ask about their action items conversationally
- Responses include specific, relevant items with context
- Natural language feels helpful, not robotic
- Reduces need to navigate to action items screen for quick checks


## Recommended Implementation Order
1. **Fix undefined assignees** (15 min) - Quick win
2. **Add conversation participants display** (30 min) - Better context
3. **Raise confidence threshold to 75%** (5 min) - Immediate quality improvement
4. **User-focused sorting** (45 min) - Better UX
5. **Improve AI prompt** (20 min) - Better extraction quality
6. **Ava integration** (2 hours) - Natural language queries for action items
7. **Semantic validation** (2 hours) - Advanced quality filtering

## Success Metrics
- **Quality:** <10 action items from 2 conversations with 50 messages
- **Accuracy:** 90%+ of displayed items are real action items users agree with
- **UX:** Current user's items clearly visible, team items secondary
- **Clarity:** Every item shows conversation participants for context
- **No errors:** Zero "undefined" assignees
- **Ava Integration:** Users can query action items naturally, get relevant responses in <2 seconds

