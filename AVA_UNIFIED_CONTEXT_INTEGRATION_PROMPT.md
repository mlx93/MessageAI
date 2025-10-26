# Ava Unified Context Integration - Full Implementation Prompt

## Goal
Enable Ava to use **combined context** from all 3 AI features (semantic search, action items, and decisions) when answering user queries. Currently, Ava can access each feature separately but cannot synthesize information across them in a single response.

## Problem Statement
**Current State:** Ava handles queries in silos:
- Search queries → returns only messages from Pinecone
- "show action items" → returns only action items list
- "show decisions" → redirects to Decisions tab

**Desired State:** Ava synthesizes across all data sources:
- User: "What did we decide about the database and who's working on it?"
- Ava: Returns the PostgreSQL decision + Adrian's action item + related messages in one unified response

## Implementation Requirements

### 1. Backend Changes (Cloud Functions)
**File:** `functions/src/ai/avaSearchChat.ts` (or create new unified function)

**Required Capabilities:**
- Intent classification: Detect when query needs action items, decisions, or all three
- Parallel data fetching: Query Firestore for action items + decisions alongside Pinecone search
- Context enrichment: Include structured data (tasks, decisions) in GPT prompt
- Unified response: Generate natural language that synthesizes all sources

**Example Flow:**
```typescript
1. Classify intent: "database" → likely needs decisions + action items + messages
2. Fetch in parallel:
   - Pinecone: Top 10 messages about "database"
   - Firestore: Active decisions matching "database" keywords
   - Firestore: Pending action items related to conversations with "database"
3. Build enriched prompt:
   - "User asked: [query]"
   - "Relevant decisions: [decision list with makers and dates]"
   - "Relevant action items: [tasks with assignees and deadlines]"
   - "Relevant messages: [message context]"
4. GPT-4o generates unified answer with citations
```

### 2. Frontend Changes
**File:** `app/ava/chat.tsx` - Update `getAvaResponse()` function

**Enhancements:**
- Display different badges for source types (📌 Decision, ✅ Action Item, 📧 Message)
- Show structured data inline (assignees, deadlines, decision makers)
- Maintain existing fallback behavior for simple queries

### 3. AI Prompt Engineering
**Update prompts to:**
- Recognize cross-feature queries ("who's working on X", "what did we decide about Y")
- Synthesize information from multiple sources coherently
- Cite sources clearly with type labels

## Files Needed for Context

### Core Implementation Files
- `services/aiService.ts` - Current AI service methods (avaSearchChat, extractActions, extractDecisions)
- `app/ava/chat.tsx` - Ava chatbot UI and query handling (lines 399-617)
- `functions/src/ai/smartSearch.ts` - Semantic search implementation
- `functions/src/ai/actionItems.ts` - Action item extraction logic
- `functions/src/ai/decisionTracking.ts` - Decision extraction logic

### Data Structures & Types
- `types/index.ts` - ActionItem, Decision, SearchResult interfaces
- `services/aiService.ts` (lines 17-100) - Interface definitions

### Reference Documentation
- `memory_bank/activeContext.md` - Current AI feature status and recent fixes
- `memory_bank/systemPatterns.md` - Architecture patterns
- `ACTION_ITEMS_PHASE_2_IMPROVEMENTS.md` - Recent action item improvements
- `SEMANTIC_SEARCH_PHASE_3_FINAL_SUMMARY.md` - Search implementation details
- `DECISION_DEDUPLICATION_DEPLOYMENT_COMPLETE.md` - Decision tracking details

## Success Criteria

### Example Queries That Should Work
1. **Cross-feature synthesis:** "What decisions were made about Redis and who's implementing them?"
   - Returns: Decision about using Redis + Action items assigned + Related messages

2. **Task context:** "Show me all database tasks and why we chose that database"
   - Returns: Action items for database setup + PostgreSQL decision + Discussion messages

3. **Person-centric:** "What is Adrian working on and why?"
   - Returns: Adrian's action items + Decisions he made + Messages he sent

### Response Format
```
📌 **Decision:** Use PostgreSQL for backend (Oct 20 by Adrian, 85% confidence)
   Rationale: Better JSON support and performance

✅ **Action Items:**
   • Set up PostgreSQL database - Adrian (Due: Oct 27)
   • Write migration scripts - Dan (Due: Oct 30)

📧 **Related Discussion:**
   1. "PostgreSQL has better JSON support" - Dan in Team Chat
   2. "I'll handle the database setup" - Adrian in Team Chat
```

## Technical Approach

### Phase 1: Backend Unified Query Function
1. Create `functions/src/ai/avaUnifiedSearch.ts`
2. Implement parallel fetching (Pinecone + Firestore queries)
3. Add relevance filtering (only include items/decisions matching query context)
4. Build enriched prompt with all three data sources

### Phase 2: Frontend Integration
1. Update `getAvaResponse()` to call new unified function
2. Add response formatting for structured data types
3. Implement visual badges and source attribution

### Phase 3: Prompt Optimization
1. Test with real queries from test-conversations.md
2. Tune relevance thresholds to avoid information overload
3. Optimize for response coherence and citation accuracy

## Expected Performance
- Response time: 3-5s (parallel fetching + GPT-4o-mini)
- Cost: ~2-3x current search cost (acceptable for unified experience)
- Accuracy: 80%+ relevant context inclusion

## Implementation Priority
**High Priority** - This is a key differentiator for Ava. Users expect AI assistants to synthesize information across their knowledge base, not just answer in silos. Current limitation feels fragmented.

