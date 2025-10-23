# Reliability & Performance Features Plan

**Date:** October 23, 2025  
**Scope:** 5 features to improve message reliability and system performance  
**Estimated Time:** 6-8 hours total

---

## 1. Message Delivery Failure Retry UI

**Purpose:** Allow users to manually retry failed message sends with clear visual feedback.

**Implementation:** Add a red exclamation icon badge to the right side of failed message bubbles (identified by `status: 'failed'` in Message model) that users can tap to trigger a manual retry. On tap, call the existing `retryFailedMessage(messageId)` function from `offlineQueue.ts` which already handles re-attempting the send with exponential backoff, then update the message status to 'sending' with optimistic UI. If retry fails after 3 attempts, show an Alert with options: "Try Again", "Delete Message", or "Cancel". The icon should pulse subtly using Reanimated to draw attention without being annoying, and include haptic feedback on tap for tactile confirmation.

---

## 2. Message Retry Queue Visibility

**Purpose:** Show users which messages are pending/failed so they understand what's in the offline queue.

**Implementation:** Add a sticky banner at the bottom of the chat screen (above the input bar) that appears when `offlineQueue.getQueueLength() > 0`, displaying text like "3 messages waiting to send" with a small spinner icon. The banner should be dismissible with an X button but reappear if queue grows, and tapping the banner scrolls the FlatList to the first failed/pending message in the conversation for quick access. Use the existing SQLite queue from `offlineQueue.ts` to track pending messages, subscribing to queue changes with a polling interval (check every 2 seconds) or event emitter pattern. Style the banner with yellow background (#FFF3CD) and orange text (#856404) to indicate warning state without alarming users.

---

## 3. Network Status Banner

**Purpose:** Provide clear visual feedback when user is offline to set expectations about message delivery.

**Implementation:** Create a persistent banner component at the very top of the app (below status bar, above navigation header) that monitors network connectivity using `@react-native-community/netinfo`'s `useNetInfo()` hook and displays "No Internet Connection" text with gray background (#E8E8E8) when `isConnected === false`. The banner should slide down from top with 200ms animation when connection drops and slide up when restored, using Reanimated's `SlideInDown`/`SlideOutUp` presets for smooth transitions. Add the banner to `app/_layout.tsx` as a global component so it appears across all screens, and include a small WiFi-off icon on the left side for visual reinforcement. Consider adding "Trying to reconnect..." subtitle with animated dots after 3 seconds of being offline.

---

## 4. Response Streaming (AI Features Context)

**Purpose:** Display AI agent responses incrementally as they generate rather than waiting for complete response, improving perceived performance.

**Explanation:** Response streaming applies primarily to AI features (which are deferred in MessageAI MVP) where LLM responses can take 5-15 seconds to generate. Instead of showing a loading spinner for 15 seconds, streaming displays partial responses as they arrive (e.g., "Summarizing conversation..." → "The team discussed..." → "The team discussed the Q4 roadmap and agreed..."). This is implemented using OpenAI's streaming API (`stream: true` parameter) or Anthropic's streaming endpoint, which returns Server-Sent Events (SSE) that you handle with `EventSource` or the SDK's streaming methods.

**Implementation (if AI features added):** In Cloud Functions, enable streaming on the LLM API call and yield chunks via HTTP response stream. In the mobile app, use `fetch()` with a ReadableStream reader to consume chunks as they arrive, appending each chunk to a local state variable that updates the UI in real-time (e.g., `aiResponse += chunk`). Display in a dedicated AI chat bubble with a typing indicator cursor at the end while streaming, and mark complete when the stream closes. This reduces perceived latency from 15s to ~1s (time to first chunk), dramatically improving UX for AI features.

---

## 5. Rate Limiting (Backend Security)

**Purpose:** Prevent abuse and excessive costs by limiting API requests per user/device to reasonable thresholds.

**Explanation:** Rate limiting restricts how many API calls a user can make in a time window (e.g., 100 messages per minute, 20 AI requests per hour) to prevent spam, denial-of-service attacks, and runaway costs from compromised accounts. Without rate limiting, a malicious user could send 10,000 messages/second, overwhelming Firestore and racking up huge bills, or spam AI endpoints costing $1+ per request.

**Implementation:** Add rate limiting middleware to Cloud Functions using `express-rate-limit` package or Firebase Realtime Database counters. For messaging, allow 60 messages per minute per user (check `userId` from auth token), returning 429 status code if exceeded with "Retry-After" header. For AI features, implement stricter limits: 10 AI requests per hour per user, tracked in Firestore with `userLimits/{userId}/aiRequests: { count: number, windowStart: timestamp }` document that resets hourly. Display user-friendly error messages in the app: "You're sending messages too quickly. Please wait 30 seconds." or "AI request limit reached. Try again in 45 minutes." Consider premium tier users having higher limits (100 AI requests/hour) as a monetization path.

---

## Implementation Priority

1. **Network Status Banner** (1 hour) - Easiest, most visible improvement
2. **Message Retry Queue Visibility** (2 hours) - Uses existing offline queue
3. **Message Delivery Failure Retry UI** (2 hours) - Requires UI polish and testing
4. **Rate Limiting** (2-3 hours) - Backend security, not user-facing
5. **Response Streaming** (N/A) - Only needed if AI features are added

---

## Testing Checklist

**Network Banner:**
- ✅ Enable airplane mode → banner appears within 1 second
- ✅ Disable airplane mode → banner disappears smoothly
- ✅ Banner doesn't cover navigation header or chat content

**Retry UI:**
- ✅ Failed message shows red exclamation icon
- ✅ Tap icon → message status changes to 'sending'
- ✅ Successful retry → icon disappears, message marked as sent
- ✅ Failed retry after 3 attempts → shows alert with options

**Queue Visibility:**
- ✅ Send 3 messages offline → banner shows "3 messages waiting"
- ✅ Go online → banner disappears when queue drains
- ✅ Tap banner → scrolls to first pending message

**Rate Limiting:**
- ✅ Send 61 messages in 1 minute → 61st message returns 429 error
- ✅ Wait 60 seconds → can send messages again
- ✅ Error message clear and actionable

---

**Status:** Ready for implementation  
**Recommended Start:** Network Status Banner (quick win)

