# Project Brief

**Product:** aiMessage (formerly MessageAI)
**Goal:** Cross‑platform, iMessage‑quality mobile messenger with real‑time sync, offline reliability, and a clean, modern UX.

## Problem → Solution
- Problem: Team chat apps are heavy; SMS is fragmented; many apps lack seamless offline reliability and polished UX on mobile.
- Solution: A focused, mobile‑first messenger with WhatsApp-like simplicity and iMessage‑quality feel, built for speed, reliability, and clarity.

## Scope (MVP COMPLETE)
- Authentication: Phone + OTP (primary), Email/Password (alt). Social (Google/Apple) code present, production build required.
- Contacts: Import phone contacts, normalize to E.164, match registered users.
- Conversations: Direct and Group; inline add/remove; deterministic previews.
- Messaging: Text and images; optimistic UI; read/delivered receipts; typing indicators; presence.
- Offline: SQLite cache + queue‑first strategy with retry/backoff; background flush.
- Notifications: iOS via FCM; Android requires dev build.

## Non‑Goals (Post‑MVP)
- AI agent features, voice notes, video calls, reactions, stories, E2E encryption, message search, web/desktop, backups.

## Success Criteria
- iMessage‑quality UX (smooth, stable, 60 FPS where animated)
- Real‑time (<1s) delivery; deterministic conversation previews
- Offline‑first (queue, cache, retry) with clear user feedback
- Clean, maintainable architecture (service layer) with solid test coverage

## Users & Core Flows
- Users: Consumers chatting 1:1 or in groups.
- Flows: Phone login → setup profile → find contacts → start chat → send text/image → get notifications → see presence/typing/read receipts.

## Constraints & Assumptions
- Expo SDK 54 (managed); React Native 0.81.4; Firebase v12.
- Expo Go limitations: Android push tokens; Social auth needs dev/prod builds.
- Data residency: Firestore us‑south1; Storage us‑central1.

## Quality Bar
- 95%+ testing confidence; stable scroll and image rendering; no flicker; deterministic previews guarded by lastMessageId; write reduction via batching.

## Links
- Architecture: `memory_bank/systemPatterns.md`, `memory_bank/techContext.md`
- Product context: `memory_bank/productContext.md`
- Live status: `memory_bank/activeContext.md`, `memory_bank/progress.md`


