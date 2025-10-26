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

### 7. Batch Analysis Improvements (Low Priority)
**Issue:** Analyzing all 21 conversations creates too many items

**Suggestions:**
- Default: Analyze only last 7 days (add date filter UI)
- Limit: Max 5 action items per conversation
- Smart selection: Analyze only conversations with recent activity
- Progress indicator: Show which conversation is being analyzed

## Recommended Implementation Order
1. **Fix undefined assignees** (15 min) - Quick win
2. **Add conversation participants display** (30 min) - Better context
3. **Raise confidence threshold to 75%** (5 min) - Immediate quality improvement
4. **User-focused sorting** (45 min) - Better UX
5. **Improve AI prompt** (20 min) - Better extraction quality
6. **Semantic validation** (2 hours) - Advanced quality filtering

## Success Metrics
- **Quality:** <10 action items from 2 conversations with 50 messages
- **Accuracy:** 90%+ of displayed items are real action items users agree with
- **UX:** Current user's items clearly visible, team items secondary
- **Clarity:** Every item shows conversation participants for context
- **No errors:** Zero "undefined" assignees

