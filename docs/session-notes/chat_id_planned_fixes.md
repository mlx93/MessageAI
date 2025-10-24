# Planned Fixes for `app/chat/[id].tsx`

## Offline Image Messages Never Resend
Offline image sends currently drop the uploaded URL before queueing, so the retry worker never has the data it needs to dispatch the attachment. This results in images hanging forever in the optimistic state while the recipient never receives them. The fix will persist the `mediaURL` (and any additional attachment metadata) inside the queued payload so retries are fully informed. Once stored, the retry pipeline can hand the payload to `sendImageMessage` just like the live path. We will also add defensive logging to confirm queued media is restored correctly.

## Offline Image Status Misreported
Because the optimistic image bubble is stamped with `status: 'sent'`, users see a misleading success state when they are really offline. We will start the optimistic message in a transitional `sending` status and flip it to `queued` if network connectivity forces a fallback. This allows the existing queue banner and manual retry affordances to surface properly. Updating the status transitions keeps the UI consistent with text message behavior under poor connectivity. The change will be covered by a quick regression test on the queue banner copy.

## NetInfo Re-Subscription Churn
Every connectivity change triggers a full teardown and recreation of message listeners because `isOnline` sits in the effect dependency list. That churn introduces unnecessary Firestore resubscribes, SQLite fetches, and React re-renders during flaky network stretches. We will migrate the “was previously online” tracking into a ref that lives inside the NetInfo callback. With the dependency removed, the effect stays mounted while still showing the reconnect banner promptly. This should smooth the experience on spotty connections without altering visible behavior.

## Sequential Participant Additions
Confirming a batch of new participants currently awaits each Firestore mutation before moving to the next, stretching the confirmation UI for larger groups. We plan to gather the individual `addParticipantToConversation` promises and run them with `Promise.all` so the writes happen in parallel. The UI state (`setCurrentParticipants`) will be updated once after the batch resolves, avoiding intermediate renders. This keeps the “Add participants” flow responsive even with long member lists. We will also measure the before/after timing in development builds to document the improvement.

## Cache Image Messages Immediately
When we optimistically append an image while online, the SQLite cache never receives that record, so reopening the thread offline hides the photo we just sent. The fix mirrors our text-path behavior by calling `cacheMessage` right after pushing the optimistic message. That keeps the recent photo accessible during reconnect windows and reduces duplicate fetches once the live listener synchronizes. We will spot-check the cache tables via the dev inspector to ensure media rows populate as expected.

## Image Upload Feedback
Large uploads can take several seconds and the current footer keeps the image picker active, leading to double taps and user confusion. By wiring the existing `isUploadingImage` flag into the UI we’ll disable the button and display a small loader while `pickAndUploadImage` runs. This communicates that the app is working and prevents queuing duplicate uploads. A lightweight unit test in the component should confirm the loader renders when the flag is true.

## Queue-Banner Scroll Resilience
Tapping the “queued messages” banner calls `scrollToIndex` without a fallback, so the gesture silently fails when the row is outside the render window. Adding `onScrollToIndexFailed` with a conservative offset retry keeps the screen responsive even on long histories. We also wrap the banner trigger in a try/catch that falls back to `scrollToEnd`, guaranteeing some motion. QA can verify the banner behavior on long (>200 message) threads in both simulators.

