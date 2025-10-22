# Issue Remediation Plan

## Objectives
- Restore deterministic conversation updates so concurrent sends never drop a message preview.
- Activate the intended batching pipeline for conversation previews and SQLite writes.
- Guarantee cached messages flush on lifecycle transitions.
- Align emulator tests with production Firestore paths and cover the queue-first flow.
- Capture rubric-required lifecycle evidence and verify notification deep links.

## Workstreams & Tasks

### 1. Conversation Update Determinism
- **Inspect current UUID usage**: confirm that callers still pass `localId` to `updateConversationLastMessage`.
- **Design fix**: decide on authoritative ordering token (Firestore doc id or timestamp field) and document rationale.
- **Implement guard-update**: update `updateConversationLastMessage` to compare against the new token; adjust all call sites (`sendMessageWithTimeout`, queue processing, image sends) to supply it.
- **Backfill tests**: add unit tests covering stale-update rejection and acceptance when two messages share close timestamps.

### 2. Batching Infrastructure Wiring
- **Conversation batching**: replace direct calls with `updateConversationLastMessageBatched` in chat send path and queue processing.
- **SQLite batching**: switch snapshot writes and optimistic enqueue to `cacheMessageBatched`.
- **Lifecycle hook**: register `flushCacheBuffer` on app background/exit (AppState listener) and when leaving a chat.
- **Instrumentation**: add concise logs so we can confirm batching triggers during manual QA (remove or gate by `__DEV__`).

### 3. Offline Queue Reliability
- **queue-first audit**: ensure queue entries include any metadata needed for conversation updates after guard change.
- **Retry UI**: verify status chip and retry handler still align with new batching; adjust as needed to avoid double updates.
- **Telemetry placeholders**: add lightweight counters (queue length, retry attempts) behind a dev-only logger for easier debugging.

### 4. Test Suite Alignments
- **Message service integration**: rewrite tests to use `conversations/{id}/messages`, exercising create, read receipts, and guard behaviour end-to-end.
- **Offline queue integration**: add scenario that simulates app restart, reconnect, and conversation preview update.
- **Presence heartbeat tests**: cover 15 s heartbeat + 22 s staleness logic with mocked timers.
- **Unit coverage**: add focused tests for batching helpers and `flushCacheBuffer` semantics.

### 5. Lifecycle & Notification Verification
- **Automation script**: create a Maestro/Detox or manual log checklist to capture “30 s offline → foreground → sync < 2 s” evidence.
- **Deep-link runbook**: execute notification tap flows on both platforms (Android dev build, iOS Expo) and document outcomes.
- **Memory bank update**: record test evidence, updated confidence scores, and remaining risks once validation passes.

## Validation Plan
- **Automated tests**: run `npm test`, targeted integration suites, and new heartbeat queue specs.
- **Manual scenarios**:
  1. Two-device rapid send to confirm previews stay correct.
  2. Rapid-fire message burst and verify batching logs.
  3. Offline send, force quit, relaunch, reconnect → ensure messages send and preview updates.
  4. Push notification tap to confirm proper deep linking.
  5. Lifecycle audit capturing timestamps for rubric documentation.
- **Documentation**: update memory bank (`06_active_context_progress.md`) and create appendices for lifecycle logs and notification results.

## Exit Criteria
- All identified findings resolved with green unit/integration suites.
- Lifecycle evidence logged and referenced in memory bank.
- Manual QA checklist completed without regressions.
- No lingering TODOs around batching or queue metrics.

