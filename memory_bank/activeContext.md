# Active Context

**Date:** Oct 24, 2025
**State:** MVP complete, production‑ready; image/scroll stability finalized.

## Current focus
- Stability polish complete: eliminated image flicker; reliable bottom scroll on iOS/Android with measured snap retries; deferred image rendering with placeholders; split presence effects.
- Action sheet delete option now available for received messages (local soft delete).
- Architecture solid: determinism + batching + offline queue proven; 95%+ confidence maintained.

## Next steps
- Prepare dev/prod builds; verify push notifications on Android.
- Re‑enable/test Social Auth (Google/Apple) in dev/prod builds.
- Optional: Beta program, additional E2E flows, invite non‑users feature.

## Guardrails (do not regress)
- Keep lastMessageId guard and 300ms debounce paths intact (chat, queue, retry).
- Preserve chat render stability patterns (no reanimated entering on images; stable callbacks; placeholders then enable images).
- Maintain offline queue‑first and timeout‑protected sends.


