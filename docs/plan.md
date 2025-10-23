# Messaging UX Improvement Plan

## Phase 1 – Critical Gaps (Must Fix)
- **Verify / extend message deletion:** Review current "hide for one user" logic in `messageService` to confirm it soft-deletes by user; add client-side confirmation + optimistic UI if missing.
- **Long-press copy & delete:** Introduce a reusable `MessageActionSheet` (triggered by long-press) offering `Copy` and `Delete` actions; wire into `app/chat/[id].tsx` rows.
- **Profile picture upload:** Add photo picker on Edit Profile (reuse `imageService`), upload to Storage (`profilePictures/`), update `photoURL`, refresh UI immediately.

## Phase 2 – Group Chat UX (High Value)
- **Participant list screen:** Tapping the chat header opens a modal/screen showing participants, roles, online status, and add/remove controls.
- **Leave group:** From the participant screen provide `Leave Conversation` (remove current user, handle last-admin edge cases, redirect to Messages).
- **Participant count in header:** Update chat header title to append "(N)" for group chats; keep direct chats unchanged.
- **Contact info quick access:** In the participant list, tapping a user opens their profile card (name, photo, last seen, start DM button).

## Phase 3 – Polish (Nice to Have)
- **Tap-to-open action menu:** Reuse `MessageActionSheet` so tapping a bubble invokes the same menu, adding `Forward` (stub or navigate to forward flow).
- **UX cleanup:** Ensure action menus respect ownership (no delete for others), support images/text, and add gentle haptic feedback.
