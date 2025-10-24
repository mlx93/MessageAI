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
- Avoid image flicker: use plain `Image` (no reanimated entering), stable `renderItem` via `useCallback`, split presence effects to avoid re‑subscribe, memoize helpers, move grouping calc to parent, stable `onLayout`.
- Cross‑platform bottom scroll: prefer `setTimeout` sequencing; lock scroll briefly while images load; render placeholders then enable images.


