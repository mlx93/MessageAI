# Rubric Readiness Plan (Meeting MessageAI Rubric - Non-AI Sections)

Date: October 22, 2025
Status: Targeting A-level score (90–100) for non-AI sections
Confidence: 70% → 95% with this plan

---

## Objectives
- Guarantee reliability across core messaging, offline-first behavior, lifecycle, and performance.
- Close gaps identified in memory_bank and recent sessions.
- Provide verifiable acceptance criteria mapped to the rubric.

---

## Summary of Current Risks (from memory_bank + code review)
- Force-quit message persistence (75%): messages right before kill not guaranteed to queue.
- Rapid-fire performance (80%): 20+ messages can cause double writes and ScrollView re-render churn.
- Image upload service: compression and large file handling unproven at scale; fetch→blob path may fail on Android URIs.
- Multi-device concurrency: race conditions possible with simultaneous edits (lastMessage, unread counts, participant updates).
- Slow connection recovery: 10s send timeout + 5s retry helps, but extreme 2G may still fail; need backoff and user feedback harmonized.

---

## Phased Roadmap (Priority → Acceptance Criteria)

### P0 – Verification & Guardrails (0.5 day)
- Add runtime guards and logging around message sends, queue processing, and conversation updates.
- Instrument metrics: queue sizes, retry counts, average send latency, image upload durations.
- Acceptance:
  - Console logs (dev) show metrics on reconnect and after 20-message burst.
  - Errors are caught and surfaced with user-safe messages; no unhandled rejections.

### P1 – Force-Quit Persistence (0.5 day)
- Change to queue-first strategy in `app/chat/[id].tsx`:
  - Always enqueue a payload before attempting Firestore send; remove on success.
  - Ensure SQLite cache reflects optimistic message immediately.
- Add `removeFromQueue(localId)` helper in `services/offlineQueue.ts`.
- Acceptance:
  - Kill app within 200ms of tapping Send → on relaunch, message appears in chat after reconnect (or remains queued until network).
  - Queue contains 0 after successful resend.

### P2 – Rapid-Fire Performance (1 day)
- Replace messages `ScrollView` with `FlatList` (windowed rendering, keyExtractor=message.id).
- Batch conversation `lastMessage` updates (debounce 250–500ms) in `conversationService` to avoid 2 writes per message.
- Batch SQLite `cacheMessage` writes (buffer 300–500ms).
- Memoize message rows; move inline functions out of render.
- Acceptance:
  - 50 messages in 5 seconds: stable 55–60 FPS on iPhone 17 sim, no dropped frames.
  - Firestore writes ≈ 1 per message (message doc), conversation updates batched ≤ 3 per burst.

### P3 – Image Upload Robustness (0.5–1 day)
- Validate Android file URIs; switch to `FileSystem.uploadAsync` (Expo) for reliability where applicable.
- Add progressive compression tiers: >10MB → width 1280, quality 0.6; >20MB → width 1024, quality 0.5.
- Add mime-type detection; support PNG/JPEG/HEIC (convert HEIC → JPEG on iOS).
- Add upload timeout (15s) + retry (2x) with user feedback.
- Acceptance:
  - 25MB photo uploads on iOS & Android with compression; total upload < 8s on Wi-Fi.
  - Failed upload provides retry CTA without losing message draft.

### P4 – Multi-Device Concurrent Edits (0.5–1 day)
- Make `updateConversationLastMessage` idempotent and conflict-aware:
  - Include `lastMessageId` in update; ignore stale updates.
  - For unread counts, move to per-user field increments via a Cloud Function or server-side transaction if needed later.
- Add minimal transactional writes (batched) where two fields are updated together.
- Acceptance:
  - Two devices send within 100ms → consistent final `lastMessage` and no unread count drift.

### P5 – Slow Network Resilience (0.5 day)
- Harmonize timeouts/backoff:
  - Send: 10s (UI) → queue; Queue retry: 5s → exponential backoff up to 20s.
  - NetInfo quality check (optional): if poor, use immediate queue and background retry.
- Show inline status chip per queued message: “Queued • Tap to retry now”.
- Acceptance:
  - On throttled 2G: sends convert to queued within 10s; resend happens automatically on reconnect; user can force retry.

### P6 – Lifecycle & Notifications (0.5 day)
- Background/foreground already implemented: add minimal reconnection audit logs.
- Ensure notification tap deep-link always resets active conversation id.
- Acceptance:
  - Foregrounding after 30s offline → messages and presence update within 1–2s.
  - Notification tap always opens correct chat; no duplicate navigation.

---

## Rubric Mapping (Non-AI Sections)
- Real-Time Delivery: P2/P4 reduce latency spikes and conflicts; maintain <300ms typical delivery.
- Offline Support & Persistence: P1/P5 ensure queue-first reliability; reconnection & clarity.
- Group Chat Functionality: P2/P4 stabilize read receipts and last message attribution.
- Mobile Lifecycle Handling: P6 confirms quick reconnect and stable presence.
- Performance & UX: P2/P3 improve list virtualization, batching, and media reliability.
- Documentation & Deployment: This plan, plus README updates, ensures “Excellent”.

---

## Fragile / Bug-Prone Areas (Inspect + Harden)
- `app/chat/[id].tsx`:
  - Optimistic UI + ScrollView (replace with FlatList), inline handlers, large render tree.
  - Send path before queue-first (P1).
- `services/offlineQueue.ts`:
  - No `removeFromQueue(localId)` yet; JSON list growth and lack of compaction.
  - Sequential retry with inline backoff; consider splitting retry scheduler.
- `services/conversationService.ts`:
  - `updateConversationLastMessage` overwrites without message ID guard (race risk).
  - Mixed reads/writes without transactions for unread counts.
- `services/imageService.ts`:
  - fetch→blob for large files; Android URI edge cases; no MIME validation; fixed 5MB compression threshold.
- `services/sqliteService.ts`:
  - Sync writes per message; no batching; potential main-thread blocking.
- `app/_layout.tsx`:
  - NetInfo listener logic central to reconnection; ensure single subscription and safe alerts.

---

## Foundation Gaps (Not Solid Yet)
- Message sending not queue-first → can lose messages on kill (P1).
- No virtualization for message list → perf risk (P2).
- Conversation update conflicts (no lastMessageId guard) → race risk (P4).
- Media pipeline: limited formats & error handling (P3).
- Retry/backoff harmonization across UI and queue (P5).
- Lack of minimal metrics/telemetry for debugging under load (P0).

---

## Deliverables Checklist
- P0 logs + metrics
- P1 queue-first + removeFromQueue()
- P2 FlatList + batching (conversation + SQLite) + memoization
- P3 robust image pipeline (compression tiers, MIME, timeout/retry)
- P4 conflict-aware conversation updates (lastMessageId)
- P5 unified backoff + queued status UI
- P6 lifecycle reconnection audit + notification deep-link hardening
- README updates + testing guide addendum

---

## Test Plan (Manual + Automated)
- Manual Scenarios:
  - 20/50-message bursts on two devices; observe FPS, write counts, and delivery order.
  - Force quit moments after send; verify queued resend on relaunch.
  - Throttled 2G + airplane mode toggles; verify queue behaviors and alerts.
  - 25MB image upload on iOS & Android; ensure compression and timely upload.
  - Simultaneous send from two devices within 100ms; verify lastMessage consistency.
- Automated (follow-up):
  - Integration tests for queue-first send & reconnection.
  - Unit tests for image compression selection and MIME conversion.

---

## Ownership & Timeline (estimates)
- Day 1: P0, P1, P5
- Day 2: P2 (FlatList + batching)
- Day 3: P3 (media), P4 (conflicts), P6 (lifecycle polish)
- Docs/validation as we go

---

## Links
- memory_bank/06_active_context_progress.md (sessions & status)
- memory_bank/05_current_codebase_state.md (file-by-file status)
- docs/MVP_RESILIENCE_FIXES.md (prior plan)
- docs/MessageAI Rubric.md (target criteria)
