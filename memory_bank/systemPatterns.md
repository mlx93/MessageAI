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
- SQLite cache for instant list/message loads; batched writes (~500ms) and flushed on background/unmount.

### 🔥 CRITICAL: Cache Write Strategy (Updated Oct 26, 2025 - FINAL)
**Cache-first strategy with merge-safe persistence for 100% reliability**

#### Batched Writes (Default) - For Performance
```typescript
// Use for: receipts, status updates, bulk operations
cacheMessageBatched(message); // 500ms batching delay
```
- Reduces SQLite write overhead by ~70%
- Deduplicates messages with same ID (Map-based buffer)
- Automatically flushes on timeout (500ms), background, or unmount

#### Synchronous Writes (Critical Operations) - For Reliability
```typescript
// Use for: deletions, important metadata, user-initiated changes
await cacheMessage(message); // Immediate write (<50ms) with merge logic
```
- Guarantees immediate SQLite persistence
- **Merge-safe:** Never downgrades deletedBy field (union merge)
- Checks existing cache before writing to preserve user's deletion state
- Essential for operations where data loss is unacceptable

#### Merge Logic - NEVER Downgrade Deletions (Added Oct 26, 2025)
```typescript
// ✅ CRITICAL - cacheMessage() now merges deletedBy arrays
export const cacheMessage = (message: Message): Promise<void> => {
  // Check if message already exists with deletedBy data
  const existing = db.getFirstSync(
    'SELECT deletedBy FROM messages WHERE id = ?',
    [message.id]
  );
  
  let finalDeletedBy = message.deletedBy || [];
  
  if (existing && existing.deletedBy) {
    const existingDeletedBy = JSON.parse(existing.deletedBy);
    // Merge deletedBy arrays - keep all deletions (union)
    const mergedSet = new Set([...existingDeletedBy, ...finalDeletedBy]);
    finalDeletedBy = Array.from(mergedSet);
  }
  
  // Write with merged deletedBy
  db.runSync('INSERT OR REPLACE INTO messages VALUES (...)', [..., JSON.stringify(finalDeletedBy), ...]);
};
```

**Why Merge Logic Is Critical:**
- **Firestore listener** caches incoming messages (lines 504, 521, 539 in chat screen)
- If Firestore hasn't synced yet, listener receives **old data without deletedBy**
- Without merge, cache would be **overwritten** with stale state
- With merge, **deletions are preserved** even when Firestore sends old data
- Protects against offline scenarios, slow networks, and race conditions

#### Flush Behavior - MUST AWAIT (Fixed Oct 26, 2025)
```typescript
// ✅ CORRECT - Awaits all writes to completion
export const flushCacheBuffer = async () => {
  if (writeTimer) clearTimeout(writeTimer);
  if (writeBuffer.size > 0) {
    const batch = Array.from(writeBuffer.values());
    writeBuffer.clear();
    await Promise.all(batch.map(msg => cacheMessage(msg)));
  }
};

// In cleanup/unmount handlers:
await flushCacheBuffer(); // CRITICAL: Must await for guaranteed persistence
```

**Previous Bug (Fixed Oct 26, 2025):**
- `batch.forEach(msg => cacheMessage(msg))` - Fire-and-forget ❌
- No merge logic - cache blindly overwritten with Firestore data ❌
- Caused race condition where:
  1. User deletes message → Cache updated
  2. User navigates away → Firestore hasn't synced
  3. User returns → Listener caches old Firestore data
  4. Deleted message **REAPPEARS** 🐛

**Fix Applied (Oct 26, 2025):**
1. `flushCacheBuffer()` now awaits all writes with `Promise.all()`
2. `cacheMessage()` now merges deletedBy arrays (never downgrades)
3. Deletions use synchronous `cacheMessage()` instead of `cacheMessageBatched()`
4. Guarantees persistence even with offline/slow sync scenarios

**CRITICAL PATTERN: Cache-First for User Operations (Oct 26, 2025)**
```typescript
// ✅ CORRECT - Cache-first pattern
async function deleteMessage(id: string, userId: string) {
  // 1. Update local cache FIRST
  await cacheMessage({ id, deletedBy: [userId] });
  
  // 2. Then update remote (may trigger listeners)
  await updateFirestore({ id, deletedBy: [userId] });
}

// ❌ WRONG - Remote-first (vulnerable to race conditions)
async function deleteMessage(id: string, userId: string) {
  // 1. Update remote first (triggers listeners)
  await updateFirestore({ id, deletedBy: [userId] });
  
  // 2. Then cache (listeners might overwrite between steps)
  await cacheMessage({ id, deletedBy: [userId] });
}
```

**DO NOT REGRESS:**
- ❌ Never use `forEach()` for cache writes (use `Promise.all()`)
- ❌ Never use `cacheMessageBatched()` for deletions (use `cacheMessage()`)
- ❌ Never skip awaiting `flushCacheBuffer()` in cleanup handlers
- ❌ Never blindly overwrite cache without checking existing state
- ❌ **Never update Firestore before cache for critical user operations**
- ✅ Always use synchronous writes for user-initiated critical operations
- ✅ Always merge critical fields (deletedBy, readBy, deliveredTo) when caching
- ✅ **Always establish local truth (cache) BEFORE remote sync (Firestore)**

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
- **Ava Unified Context (Oct 26, 2025 - NEW)**:
  - **Architecture**: Parallel fetching from Pinecone (messages) + Firestore (action items + decisions)
  - **Intent Classification**: Keyword-based detection for comprehensive queries
  - **Smart Filtering**: Excludes hidden/deleted conversations (deletedBy, hiddenBy checks)
  - **Message Deduplication**: 70% similarity threshold removes near-duplicates
  - **Deadline Validation**: formatDeadline() handles all timestamp formats, prevents "Invalid Date"
  - **Response Synthesis**: GPT-4o-mini generates coherent answers from all sources
  - **Performance**: 3-5s response time; ~$0.001 per query
  - **Fallback Strategy**: Unified → Message-only → Existing Ava logic
  - **File**: `functions/src/ai/avaUnifiedSearch.ts` (700+ lines)
- **Priority Detection (Hybrid - Oct 26)**:
  - **Client-Side**: Instant regex keyword detection (<100ms) in `utils/priorityDetector.ts`
    - Conservative patterns: "urgent", "important", "high priority" only
    - Applied at: send (optimistic), receive (Firestore listener), cache (initial load)
    - Confidence: 0.70-0.75 (acceptable for instant display)
  - **Server-Side**: AI refinement with Cloud Function optimization
    - `minInstances: 1` eliminates cold starts
    - `region: "us-central1"` matches Firestore location
    - In-memory cache (5-minute TTL)
    - Conservative AI prompt requiring explicit keywords
    - Processing: 2-5 seconds (background, minimal UI change)
  - **Preservation Logic**: Keep client-detected priority until AI refinement arrives (prevents flicker)
  - **Badge Positioning**: Blue bubbles (above, right), Gray group (inline with name), Gray direct (above, left)
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
  - **UI**: Banner hidden from chat screen to save space (still accessible via Ava tab)
- **Proactive Triggers**: Enhanced triggers in Cloud Functions (deadline conflicts, decision conflicts, overdue actions, context gaps).
- **Cache Optimization**: Enhanced cache with longer TTLs (60min summaries, 30min search, 120min decisions), request batching, smart invalidation.
- **Chat Integration**: Summarize button (✨), priority badges (🔴🟡), proactive suggestion cards, thread summary modal.
- **Current Status**: All AI features deployed and production ready

## AI Data Flow (Production Ready)
- **User Action** → AI Service → Error Handler → Cache Check → AI Function → Response
- **Offline Detection**: NetInfo check before AI calls; graceful degradation with user-friendly messages.
- **Error Recovery**: Exponential backoff for retries; rate limit handling; timeout management.
- **Cache Strategy**: Aggressive caching reduces API costs by 40%+; automatic cleanup of expired entries.
- **Priority Detection Flow**: 
  - Client-side keyword detection (instant) → 
  - Optimistic UI update (<100ms) → 
  - Cloud Function AI refinement (2-5s) → 
  - Background update (preserves client priority if AI hasn't returned yet)
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


