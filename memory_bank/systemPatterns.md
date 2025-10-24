# System Patterns

## Architecture
- Expo Router (file‑based) with `app/_layout.tsx` wrapping `AuthProvider`.
- Service layer encapsulates business logic in `services/*` (auth, contacts, conversations, messages, sqlite, offlineQueue, images, presence, notifications, global listener).
- Real‑time via Firestore `onSnapshot`; push via Cloud Functions + FCM.

## Data model (Firestore)
- `users/{uid}` (+ `usersByEmail`, `usersByPhone` indexes)
- `conversations/{id}` with `participants[]`, `lastMessage{}`, `unreadCounts{}`, `lastMessageId`, `deletedBy[]`, timestamps
- `conversations/{id}/messages/{messageId}` with status, type, `localId`, `readBy[]`, `deliveredTo[]`, optional `mediaURL`
- `conversations/{id}/typing/{userId}`
- `presence/{userId}` (online/background/lastSeen)

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

## AI Architecture (Currently Disabled)
- **Service Layer**: `aiService.ts` with error handling wrapper; `aiErrorHandler.ts` for graceful offline degradation.
- **RAG Pipeline**: Pinecone vector search with OpenAI embeddings; migration scripts for existing messages.
- **Proactive Triggers**: Enhanced triggers in Cloud Functions (deadline conflicts, decision conflicts, overdue actions, context gaps).
- **Cache Optimization**: Enhanced cache with longer TTLs (60min summaries, 30min search, 120min decisions), request batching, smart invalidation.
- **Chat Integration**: Summarize button (✨), priority badges (🔴🟡), action items banner, proactive suggestion cards, thread summary modal.
- **Current Status**: All AI features temporarily disabled while Firestore indexes build (5-15 minutes)

## AI Data Flow (Temporarily Disabled)
- **User Action** → AI Service → Error Handler → Cache Check → AI Function → Response
- **Offline Detection**: NetInfo check before AI calls; graceful degradation with user-friendly messages.
- **Error Recovery**: Exponential backoff for retries; rate limit handling; timeout management.
- **Cache Strategy**: Aggressive caching reduces API costs by 40%+; automatic cleanup of expired entries.

## Current Temporary State (Git Commit: 452f9e8)
- **AI Features Disabled**: All AI components commented out with `// TEMPORARILY DISABLED:` markers
- **Core App Functional**: Messaging, contacts, presence, offline queue all working perfectly
- **Index Building**: Firestore composite indexes deployed and building (5-15 minutes)
- **Re-enable Process**: Uncomment all disabled sections once indexes are ready
- **Documentation**: `AI_FEATURES_TEMPORARILY_DISABLED.md` contains complete re-enable guide


