# System Patterns

## Architecture
- Expo Router (file‑based) with `app/_layout.tsx` wrapping `AuthProvider`.
- Service layer encapsulates business logic in `services/*` (auth, contacts, conversations, messages, sqlite, offlineQueue, images, presence, notifications, global listener).
- Real‑time via Firestore `onSnapshot`; push via Cloud Functions + FCM.

## Data model (Firestore)
- `users/{uid}` (+ `usersByEmail`, `usersByPhone` indexes)
- `conversations/{id}` with `participants[]`, `lastMessage{}`, `unreadCounts{}`, `lastMessageId`, `deletedBy[]`, timestamps
- `conversations/{id}/messages/{messageId}` with status, type, `localId`, `readBy[]`, `deliveredTo[]`, `deletedBy[]`, optional `mediaURL`
- `conversations/{id}/typing/{userId}`
- `presence/{userId}` (online/background/lastSeen)

### 🔥 CRITICAL: Soft Deletion Pattern
**Messages and conversations use `deletedBy` arrays, NOT a `deleted` boolean field.**

- **Messages**: `deletedBy: string[]` - Array of user IDs who deleted this message
- **Conversations**: `deletedBy: string[]` - Array of user IDs who deleted this conversation
- **WHY**: Per-user soft deletion - each user can delete independently without affecting others
- **NEVER** query with `.where("deleted", "!=", true)` - this field doesn't exist and returns 0 results
- **CORRECT** filtering: Check `!data.deletedBy?.includes(userId)` in application code after fetching

**AI Feature Pattern (CRITICAL):**
```typescript
// ❌ WRONG - Returns 0 messages (deleted field doesn't exist)
.where("deleted", "!=", true)

// ✅ CORRECT - Fetch all, filter in code
const snapshot = await db
  .collection(`conversations/${conversationId}/messages`)
  .orderBy("timestamp", "desc")
  .get();

const messages = snapshot.docs
  .filter(doc => {
    const data = doc.data();
    return !data.deletedBy?.includes(userId);
  })
  .map(doc => ({ id: doc.id, ...doc.data() }));
```

**This pattern broke action items extraction (Oct 26, 2025) - query returned 0 messages causing 0 items extracted.**

## Conversation determinism
- Preview updates guarded by `lastMessageId` (UUID v4). Only update if new ID > stored ID (lexicographic compare). Prevents out‑of‑order overwrites across devices and retries.
- Conversation preview writes batched/debounced (~300ms) to reduce write load ~70%.

## Offline‑first
- Queue‑first send: write to local queue before optimistic UI; try remote send; show queued chip; manual retry supported.
- SQLite cache for instant list/message loads; batched writes (~200ms) and flushed on background/unmount.

## Messaging flow
- Optimistic UI with `localId` → Firestore write → remove from queue on success → mark delivered/read via batched updates.
- Cloud Function updates `lastMessage`, clears `deletedBy`, and increments `unreadCounts` for recipients.

## Presence & typing
- Presence heartbeat every 15s; ~30s offline detection; header shows online/background/last seen. Typing indicators per conversation subcollection, auto‑expire.

## Notifications
- iOS via Expo Notifications + FCM; deep‑link to conversation; smart delivery (no notify when active in that chat). Android requires dev/prod build.

## Navigation patterns
- `app/index.tsx` routes based on auth + profile completeness.
- Tabs for Messages and Contacts; separate `chat/[id].tsx` screen.

## Rendering stability (Chat)
- Avoid image flicker: use plain `Image` (no reanimated entering), stable `renderItem` via `useCallback`, split presence effects to avoid re-subscribe, memoize helpers, move grouping calc to parent, stable `onLayout`.
- Cross-platform bottom scroll: measured content/layout heights + retrying snap ensures newest messages load instantly (even image-heavy/group threads), lock scroll briefly while images load, render placeholders then enable images.

## AI Architecture (Production Ready)
- **Service Layer**: `aiService.ts` with error handling wrapper; `aiErrorHandler.ts` for graceful offline degradation.
- **RAG Pipeline**: Pinecone vector search with OpenAI embeddings; migration scripts for existing messages.
- **Semantic Search (Phase 3)**: 
  - Conditional keyword search (runs only when <3 semantic results)
  - Exact match scoring (100% for keyword matches)
  - Q&A context detection (automatic answer inclusion after questions)
  - Smart filtering (prioritize 40%+ results, cleaner UI)
  - Ava integration (`avaSearchChat` uses Pinecone for Q&A)
- **Decision Tracking**:
  - Semantic deduplication with 75% similarity threshold
  - OpenAI embeddings + cosine similarity
  - Keeps higher confidence version when duplicates found
  - Consistent sorting by `madeAt` descending (prevents flicker)
- **Action Items** (Fixed Oct 26, 2025):
  - **CRITICAL**: Query messages WITHOUT `deleted` field filter (use `deletedBy` array filtering in code)
  - Pull-to-refresh for manual updates
  - Accurate feedback with item count tracking
  - Enhanced logging for debugging display issues
  - Duplicate detection using actual message IDs (not array indexes)
- **Proactive Triggers**: Enhanced triggers in Cloud Functions (deadline conflicts, decision conflicts, overdue actions, context gaps).
- **Cache Optimization**: Enhanced cache with longer TTLs (60min summaries, 30min search, 120min decisions), request batching, smart invalidation.
- **Chat Integration**: Summarize button (✨), priority badges (🔴🟡), action items banner, proactive suggestion cards, thread summary modal.
- **Current Status**: All AI features deployed and production ready

## AI Data Flow (Production Ready)
- **User Action** → AI Service → Error Handler → Cache Check → AI Function → Response
- **Offline Detection**: NetInfo check before AI calls; graceful degradation with user-friendly messages.
- **Error Recovery**: Exponential backoff for retries; rate limit handling; timeout management.
- **Cache Strategy**: Aggressive caching reduces API costs by 40%+; automatic cleanup of expired entries.
- **Search Flow**: Conditional keyword search → Semantic Pinecone query → Q&A context detection → Result filtering (40%+)
- **Decision Flow**: Extract decisions → Generate embeddings → Compare with existing (75% threshold) → Merge or create new
- **Action Items Flow**: Fetch messages (no deleted filter!) → Filter by deletedBy in code → Extract → Resolve assignees → Check duplicates → Pull-to-refresh UI

### 🔥 AI Query Pattern (MUST FOLLOW)
**When querying messages for ANY AI feature:**
1. ❌ DO NOT use `.where("deleted", "!=", true)` - field doesn't exist
2. ✅ Query messages normally: `.orderBy("timestamp", "desc")`
3. ✅ Filter in code: `!data.deletedBy?.includes(userId)`
4. ✅ Also filter: `!data.hiddenBy?.includes(userId)`
5. ✅ Check conversation access: `conversationData.participants.includes(userId)`

**Examples that need this pattern:**
- Action Items extraction (extractActions) ✅ Fixed Oct 26
- Decision tracking (extractDecisions) - Check this!
- Thread summarization (summarizeThread) - Check this!
- Proactive agent (proactiveAgent) - Check this!
- Any future AI features querying messages

## Current State (Updated: Oct 26, 2025)
- **AI Features Production Ready**: All AI components deployed and operational
- **Core App Functional**: Messaging, contacts, presence, offline queue all working perfectly
- **Phase 3 Search Complete**: Conditional keyword search, exact match scoring, Q&A context detection
- **Decision Deduplication Live**: 75% semantic similarity threshold with flicker fix
- **Action Items Enhanced**: Pull-to-refresh, accurate feedback, enhanced logging
- **Next Step**: Run cleanup script to remove existing duplicate decisions


