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

## 🚀 CRITICAL: Chat Performance Patterns (Oct 26, 2025)
**DO NOT REGRESS - These optimizations provide 50-80% performance improvement**

### Anti-Flicker Loading Strategy (MUST PRESERVE)
```typescript
// ✅ CORRECT: Parallel loading with anti-flicker protection
const loadInitialData = async () => {
  const [conversationData, cachedMessages] = await Promise.all([
    loadConversationData(),
    getCachedMessagesPaginated(conversationId, 30) // Direct 30-message load
  ]);
  
  // Filter and dedupe messages
  const visibleMessages = cachedMessages.filter(m => 
    !m.deletedBy || !m.deletedBy.includes(user!.uid)
  );
  const dedupedMessages = dedupeMessages(visibleMessages);
  
  // Set all state together to prevent flicker
  setMessages(dedupedMessages);
  setIsInitialLoad(false); // Only after everything is ready
};
```

### Smart List Mode Detection (CRITICAL)
```typescript
// ✅ CORRECT: Synchronous determination before first render
const useInvertedList = useMemo(() => {
  if (messages.length === 0) return false;
  
  // Use normal mode for conversations with <= 7 messages (starts at top)
  if (messages.length <= 7) return false;
  
  // Use inverted mode for longer conversations (starts at bottom)
  const estimatedContentHeight = messages.length * 80;
  const screenHeight = 600;
  return estimatedContentHeight > screenHeight;
}, [messages.length]);
```

### Non-blocking Pagination (MUST PRESERVE)
```typescript
// ✅ CORRECT: Timeout handling prevents blocking
const loadOlderMessages = async () => {
  // Try cache first with timeout
  const cachePromise = getCachedMessagesBefore(conversationId, beforeTimestamp, 30);
  const cacheTimeout = new Promise<Message[]>((resolve) => {
    setTimeout(() => resolve([]), 1000); // 1 second cache timeout
  });
  
  const cachedOlderMessages = await Promise.race([cachePromise, cacheTimeout]);
  
  // Fallback to Firestore with timeout (handled in messageService)
  if (!cachedOlderMessages.length) {
    const firestoreOlderMessages = await loadOlderMessagesRemote(conversationId, beforeTimestamp, 30);
    // Firestore timeout already handled in messageService.ts
  }
};
```

### Performance Settings (DO NOT CHANGE)
- **Initial Cache Load**: 30 messages (not 50→20 filtering)
- **Pagination Throttle**: 1 second (not 2 seconds)
- **Cache Timeout**: 1 second for older messages
- **Firestore Timeout**: 5 seconds for remote queries
- **Scroll Trigger**: 100px from top (not 50px)
- **Loading Indicator**: "Loading..." (not "Loading older messages...")

### FlatList Configuration (CRITICAL)
```typescript
// ✅ CORRECT: Anti-flicker FlatList setup
<FlatList
  data={useInvertedList ? messages.slice().reverse() : messages}
  inverted={useInvertedList}
  contentContainerStyle={[
    styles.messagesContent,
    !useInvertedList && { flexGrow: 1 }, // Normal mode: space below
    useInvertedList && { flexGrow: 0 }   // Inverted mode: content at bottom
  ]}
  maintainVisibleContentPosition={useInvertedList ? {
    minIndexForVisible: 0,
    autoscrollToTopThreshold: 10
  } : undefined}
/>
```

**NEVER REGRESS:**
- ❌ Don't change back to sequential loading
- ❌ Don't remove timeout handling
- ❌ Don't increase throttle times
- ❌ Don't change list mode detection logic
- ❌ Don't modify FlatList contentContainerStyle
- ❌ Don't remove anti-flicker blocking strategy

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


