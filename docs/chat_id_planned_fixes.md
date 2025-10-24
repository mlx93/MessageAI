# Planned Fixes for `app/chat/[id].tsx`

## Offline Image Messages Never Resend
Offline image sends currently drop the uploaded URL before queueing, so the retry worker never has the data it needs to dispatch the attachment. This results in images hanging forever in the optimistic state while the recipient never receives them. The fix will persist the `mediaURL` (and any additional attachment metadata) inside the queued payload so retries are fully informed. Once stored, the retry pipeline can hand the payload to `sendImageMessage` just like the live path. We will also add defensive logging to confirm queued media is restored correctly.

## Offline Image Status Misreported
Because the optimistic image bubble is stamped with `status: 'sent'`, users see a misleading success state when they are really offline. We will start the optimistic message in a transitional `sending` status and flip it to `queued` if network connectivity forces a fallback. This allows the existing queue banner and manual retry affordances to surface properly. Updating the status transitions keeps the UI consistent with text message behavior under poor connectivity. The change will be covered by a quick regression test on the queue banner copy.

## NetInfo Re-Subscription Churn
Every connectivity change triggers a full teardown and recreation of message listeners because `isOnline` sits in the effect dependency list. That churn introduces unnecessary Firestore resubscribes, SQLite fetches, and React re-renders during flaky network stretches. We will migrate the “was previously online” tracking into a ref that lives inside the NetInfo callback. With the dependency removed, the effect stays mounted while still showing the reconnect banner promptly. This should smooth the experience on spotty connections without altering visible behavior.

## Sequential Participant Additions
Confirming a batch of new participants currently awaits each Firestore mutation before moving to the next, stretching the confirmation UI for larger groups. We plan to gather the individual `addParticipantToConversation` promises and run them with `Promise.all` so the writes happen in parallel. The UI state (`setCurrentParticipants`) will be updated once after the batch resolves, avoiding intermediate renders. This keeps the “Add participants” flow responsive even with long member lists. We will also measure the before/after timing in development builds to document the improvement.

