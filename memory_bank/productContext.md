# Product Context

## Why this exists
- Provide a fast, reliable, beautiful mobile messenger that “just works” across iOS and Android.
- Prioritize core messaging quality over breadth of features.

## What it does (MVP)
- Phone‑first onboarding (OTP); optional email.
- Contact import and matching; start 1:1 or group conversations.
- Send text and images with reliable delivery, receipts, presence, typing.
- Work offline with graceful queueing and instant cached history.
- Notify users on iOS (Android in dev/prod builds).

## How it should feel
- iMessage‑style: clean blue/gray bubbles, centered timestamps, subtle animations/haptics.
- Instant: real‑time updates; instant list loads from SQLite; no jank or flicker.
- Trustworthy: queued status with manual retry; clear feedback on reconnect.

## Experience principles
- Focus: optimize the core chat loop; reduce friction.
- Reliability first: never lose a message; never block the UI.
- Determinism: conversation previews update predictably (guarded by message IDs).
- Offline‑first: app is useful without network; sync when back online.

## Key user journeys
1) Onboard: Phone → OTP → Name/Photo → Messages
2) Start chat: Search or pick contact → Send first message
3) Group chat: Inline add members → Continue history with split when needed
4) Share image: Pick/capture → Compress → Upload → Display
5) Offline send: Message queued → Back online → Auto‑retry → Sent

## Out of scope (for now)
- AI, reactions, voice/video, E2E encryption, advanced settings; keep the app focused and fast.


