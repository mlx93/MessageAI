# Lifecycle Testing Checklist

## Purpose
Capture lifecycle evidence for rubric validation (30s offline → foreground → sync < 2s requirement).

## Prerequisites
- Two test devices (or simulator + device)
- Firebase Emulator running OR production Firebase
- Network monitoring tools (optional)

## Test 1: Offline → Online Sync (Rubric Requirement)

### Steps:
1. **Setup:**
   - Device A: Open chat screen with Device B
   - Device B: Open same chat
   - Verify both show "online" status

2. **Go Offline:**
   - Device A: Enable Airplane Mode
   - Record timestamp: `___:___:___ AM/PM`
   - Device A should show "📡 No Internet Connection" banner

3. **Send Message While Offline:**
   - Device A: Type and send message
   - Verify message shows "Queued • Retry" status
   - Verify message appears in UI immediately (optimistic)

4. **Wait 30 Seconds:**
   - Keep Device A offline for exactly 30 seconds
   - Device B: Verify Device A shows "offline" or "Last seen just now"

5. **Restore Connection:**
   - Device A: Disable Airplane Mode
   - Record timestamp: `___:___:___ AM/PM`
   - Start stopwatch

6. **Measure Sync Time:**
   - Watch Device A: "🔄 Reconnecting..." banner appears
   - Stop stopwatch when:
     - Banner changes to "✅ Back Online"
     - Message status changes from "Queued" to "Sent"
     - Device B receives message
   - **Sync time:** `______ seconds`

### Pass Criteria:
- ✅ Sync time < 2 seconds
- ✅ Message delivered to Device B
- ✅ No data loss
- ✅ Presence updated correctly

### Logs to Capture:
```
[TIMESTAMP] 📤 Processing queue: X messages
[TIMESTAMP] 💾 Flushing batched conversation update
[TIMESTAMP] ✅ Sent queued message: <localId>
[TIMESTAMP] 📊 Queue processed: X sent, X failed, X retries
```

---

## Test 2: App Background → Foreground

### Steps:
1. **Setup:**
   - Device A: Open chat, send a message
   - Verify message delivered

2. **Background App:**
   - Device A: Home button (app to background)
   - Record timestamp: `___:___:___ AM/PM`
   - Verify logs show:
     ```
     User set to inApp: false
     💾 Cache flushed on background
     ```

3. **Send Message (Device B):**
   - Device B: Send message to Device A
   - Device A: Should receive push notification

4. **Foreground App:**
   - Device A: Tap notification or reopen app
   - Record timestamp: `___:___:___ AM/PM`
   - Verify message appears in chat

### Pass Criteria:
- ✅ Push notification received
- ✅ Cache flushed on background
- ✅ Message visible on foreground
- ✅ No UI lag

### Logs to Capture:
```
[TIMESTAMP] User set to inApp: false
[TIMESTAMP] 💾 Cache flushed on background
[TIMESTAMP] 💾 Flushing X messages from cache buffer
[TIMESTAMP] App state changed: active
[TIMESTAMP] User set to inApp: true
```

---

## Test 3: Force-Quit Persistence

### Steps:
1. **Setup:**
   - Device A: Open chat
   - Device A: Send message (wait for "Sent" status)

2. **Immediate Force-Quit:**
   - Device A: Send another message
   - **IMMEDIATELY** force-quit app (swipe away)
   - Record time between send and kill: `______ ms`

3. **Relaunch App:**
   - Device A: Reopen app
   - Navigate to chat

4. **Verify Message:**
   - Check if message appears in chat
   - Check message status (should be "Queued" if network send failed)
   - If online, message should auto-send

### Pass Criteria:
- ✅ Message persisted (either sent or queued)
- ✅ No data loss
- ✅ Queue processed on relaunch

### Logs to Capture:
```
[TIMESTAMP] 1. Queue message FIRST (guarantees persistence)
[TIMESTAMP] 2. Show optimistically in UI
[TIMESTAMP] 3. Cache immediately
[TIMESTAMP] ✅ Message sent and removed from queue: <localId>
[OR if killed]
[TIMESTAMP] 📤 Processing queue: 1 messages  [on relaunch]
```

---

## Test 4: Presence Heartbeat (15s → 22s)

### Steps:
1. **Setup:**
   - Device A: Open chat with Device B
   - Both devices online, showing "online" status

2. **Monitor Heartbeat:**
   - Device A: Watch console logs
   - Verify heartbeat every 15 seconds:
     ```
     [00:00] 💓 Heartbeat: Updated lastSeen
     [00:15] 💓 Heartbeat: Updated lastSeen
     [00:30] 💓 Heartbeat: Updated lastSeen
     ```

3. **Force-Quit Device A:**
   - Device A: Swipe away app
   - Record timestamp: `___:___:___ AM/PM`
   - Heartbeat stops (no more logs)

4. **Check Device B:**
   - Wait 22 seconds
   - Device B: Refresh or wait for presence update
   - Verify Device A shows "offline" or "Last seen X seconds ago"

### Pass Criteria:
- ✅ Heartbeat updates every 15 seconds while active
- ✅ Heartbeat stops on force-quit
- ✅ Device B detects offline within 22-37 seconds
- ✅ Average detection: ~30 seconds (matches WhatsApp)

### Logs to Capture:
```
[DEVICE A - Before quit]
[00:00] 💓 Heartbeat: Updated lastSeen
[00:15] 💓 Heartbeat: Updated lastSeen
[00:30] 💓 Heartbeat: Updated lastSeen
[00:30] Force-quit [NO MORE LOGS]

[DEVICE B - After quit]
[00:37] Checking presence... lastSeen: 30s ago
[00:52] Status changed to "offline"
```

---

## Test 5: Batching Performance

### Steps:
1. **Setup:**
   - Device A: Open chat
   - Enable __DEV__ mode logs

2. **Send Burst Messages:**
   - Device A: Send 10 messages rapidly (within 2 seconds)
   - Watch console logs

3. **Verify Batching:**
   - Count actual Firestore writes
   - Should be significantly less than 10 (one per message)
   - Look for batching logs

### Pass Criteria:
- ✅ Conversation updates batched (300ms debounce)
- ✅ SQLite writes batched (500ms buffer)
- ✅ <3 Firestore conversation writes for 10 messages
- ✅ 1-2 SQLite batch writes for 10 messages

### Logs to Capture:
```
[TIMESTAMP] 📦 Batching conversation update (300ms debounce)
[TIMESTAMP] 📦 Batching conversation update (300ms debounce)
...
[TIMESTAMP] 💾 Flushing batched conversation update
[TIMESTAMP] 💾 Batching 10 SQLite writes
[TIMESTAMP] ✅ Successfully wrote 10 messages to SQLite
```

---

## Test 6: Multi-Device Determinism

### Steps:
1. **Setup:**
   - Device A & B: Open same chat

2. **Concurrent Sends:**
   - Device A: Send message
   - Device B: Send message (within 100ms)
   - Record which was sent first (by checking Firestore IDs)

3. **Check Conversation Preview:**
   - Both devices: Exit chat, view Messages list
   - Verify both show the SAME last message preview
   - Should show the message with the larger messageId

### Pass Criteria:
- ✅ Both devices show same last message
- ✅ No race condition (deterministic ordering)
- ✅ Message with larger UUID appears in preview

### Logs to Capture:
```
[DEVICE A]
[TIMESTAMP] ✅ Updated lastMessage for conv1 with message msg-123

[DEVICE B]
[TIMESTAMP] ✅ Updated lastMessage for conv1 with message msg-456
[OR]
[TIMESTAMP] ⏭️ Skipping stale update: msg-456 is older than msg-789
```

---

## Appendix: Console Log Patterns

### Success Patterns:
```bash
# Batching working
📦 Batching conversation update (300ms debounce)
💾 Flushing batched conversation update
💾 Batching X SQLite writes
✅ Successfully wrote X messages to SQLite

# Lifecycle working
User set to inApp: false
💾 Cache flushed on background
💾 Flushing X messages from cache buffer

# Queue working
📤 Processing queue: X messages
✅ Sent queued message: <localId>
📊 Queue processed: X sent, X failed, X retries

# Presence working
💓 Heartbeat: Updated lastSeen (every 15s)

# Determinism working
✅ Updated lastMessage for conv1 with message <id>
⏭️ Skipping stale update: <oldId> is older than <newId>
```

### Failure Patterns:
```bash
# Cache not flushing
❌ Missing: "Cache flushed on background"

# Queue not processing
❌ Queue size increasing
❌ No "Processing queue" log on reconnect

# Heartbeat not working
❌ No heartbeat logs
❌ Presence stuck on "background" after force-quit

# Race conditions
❌ Different last messages on two devices
❌ Multiple conversation updates without debouncing
```

---

## Documentation of Results

After completing all tests, document:

1. **Test Environment:**
   - Date: `__________`
   - Devices: `__________`
   - Network: `__________`
   - Firebase: Emulator / Production

2. **Results Summary:**
   - Test 1 (Offline→Online): PASS / FAIL - Sync time: `____ s`
   - Test 2 (Background→Foreground): PASS / FAIL
   - Test 3 (Force-Quit): PASS / FAIL
   - Test 4 (Heartbeat): PASS / FAIL - Detection time: `____ s`
   - Test 5 (Batching): PASS / FAIL - Writes: `____`
   - Test 6 (Determinism): PASS / FAIL

3. **Attach Logs:**
   - Copy all relevant console outputs
   - Take screenshots of timing evidence
   - Note any anomalies or edge cases

4. **Update Memory Bank:**
   - Add test evidence to `06_active_context_progress.md`
   - Update confidence scores
   - List any remaining risks

