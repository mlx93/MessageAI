# Action Items Troubleshooting Guide

## 🎯 Action Items State Model

### Conversation-Level Entities ✅ CONFIRMED

Action items are **conversation-level entities** (not per-user):
- When Hadi says "I'll handle MongoDB setup" in a conversation
- That action item exists in the conversation for ALL participants to see
- Both Myles and Hadi can see it (subject to filtering rules below)
- If deleted, it's deleted for everyone (shared conversation artifact)

### Assignment & Privacy Model

**Filtering ensures privacy:**
- Myles only sees items assigned to HIM + unassigned items
- Hadi only sees items assigned to HIM + unassigned items
- Users cannot see items assigned to OTHER users

**Assignment Rules:**
- ✅ Users can **assign themselves** to unassigned items from their conversations
- ✅ Users can **reassign** items from themselves to others in the conversation
- ✅ Users can **unassign** items from themselves (makes them unassigned again)
- ❌ Users cannot assign items they don't have access to
- ❌ Users cannot assign items to users outside the conversation

**Benefits:**
- Collaborative: Team members can pick up unassigned tasks
- Flexible: Reassignment allows workload balancing
- Private: Users don't see tasks assigned to others
- Secure: Assignment limited to conversation participants

---

## 🔍 Current Status: Issues Still Appearing

### ⚠️ Three Problems Persist After Deployment

Even after deploying fixes (80% threshold, enhanced logging, user filtering), we're still seeing:
1. **Multiple MongoDB tasks** - Duplicates not being caught
2. **Wrong source messages** - Detail page shows last message in thread
3. **Unassigned "I'll handle"** - SENDER token not resolving

**Root Cause:** The AI prompt needs improvement with few-shot examples. The fixes provide better logging/validation but don't address the core AI extraction quality issues.

### 📋 Next Steps

**See `ACTION_ITEMS_AI_INTELLIGENCE_IMPROVEMENTS.md` for detailed investigation guide.**

This includes:
- Complete problem analysis
- Files and line numbers to investigate
- 5 sub-tasks for resolution
- Success criteria and testing approach

### Why Re-Extraction Alone Won't Fix This

The backend function was deployed successfully with enhanced logging and lower thresholds, but the changes may not fully solve the issues because the AI prompt itself needs improvement with few-shot examples.

## ✅ Solution: Clear and Re-Extract

### Step 1: Delete Existing Action Items

```bash
# Option 1: Via Firebase Console
1. Go to Firebase Console → Firestore Database
2. Navigate to `action_items` collection
3. Delete all documents (or just the test conversation items)

# Option 2: Via Script (safer - creates backup first)
cd /Users/mylessjs/Desktop/MessageAI
npx ts-node functions/scripts/delete-action-items.ts
```

### Step 2: Re-Extract with New Code

1. Open your app
2. Go to Ava → Action Items
3. Tap "Analyze Conversations" 
4. Select the test conversations (#backend-team, etc.)
5. Wait for extraction to complete

### Step 3: Verify Fixes

Check Firebase Functions logs:
```bash
firebase functions:log extractActions --limit 50
```

Look for:
- `[Batch Dedup] Comparing: "Handle MongoDB..." vs "Get MongoDB..." = 82%`
- `[Batch Dedup] Found duplicate in batch: ... 82% similar`
- `[Batch Dedup] Results: X unique items, 1 batch duplicates removed`
- `✓ Task/message match validated (85% word overlap)`

---

## 🤔 Understanding "Unassigned I'll handle" Issue

### The Problem
You're seeing action items like:
- Task: "Handle the MongoDB setup"
- Assignee: **undefined** or **null**

This means the SENDER token resolution is failing.

### Why It's Happening

The prompt tells AI to return `assignee: "SENDER"` for first-person commitments like "I'll handle MongoDB". Then the backend should resolve "SENDER" to the actual user ID.

**The resolution code is in lines 724-760:**

```typescript
// Handle special "SENDER" token for first-person commitments
if (item.assignee && 
    (item.assignee.toUpperCase() === "SENDER" ||
     item.assignee.toLowerCase() === "sender")) {
  // Get the message sender for this action item
  const messageIndex = parseInt(item.messageId);
  if (!isNaN(messageIndex) && 
      messageIndex >= 0 && 
      messageIndex < messages.length) {
    const sourceSenderId = messages[messageIndex].sender as string;
    const senderDetails = participantDetails[sourceSenderId];
    
    assigneeId = sourceSenderId; // This is the USER ID
    finalAssignee = senderDetails?.displayName || sourceSenderId.slice(0, 10);
  }
}
```

**If assigneeId is null, it means one of these failed:**
1. AI didn't return "SENDER" (returned null instead)
2. messageIndex parsing failed
3. messages[messageIndex] doesn't exist
4. sender field is missing from message

### The Fix

I added validation logging in my deployment that will show WHERE this is failing:

```typescript
// My new logging shows:
✓ Message index 5 → ID abc123... | Text: "I'll handle MongoDB..."
✓ Task/message match validated (85% word overlap)
⚠️ Low match between task and message (25% match):
   Task: "Handle MongoDB setup"
   Message: "Thanks for the update"
   This might indicate AI returned wrong message index
```

---

## 📋 Issue-by-Issue Status

### Issue 1: Wrong Message Context ⚠️ Needs Re-Extraction
**Status:** Enhanced logging deployed, but you need to re-extract to see it in action

**What to check:**
```bash
firebase functions:log extractActions | grep "Task/message match"
```

Look for warnings like:
```
⚠️ Low match between task and message (25% match):
   Task: "Have final mockups by Friday"
   Message: "Thanks for the quick turnaround"
```

If you see this, the AI is returning the wrong message index.

### Issue 2: Multiple MongoDB Items ⚠️ Needs Re-Extraction  
**Status:** Threshold lowered to 80%, but existing duplicates won't be auto-removed

**What to do:**
1. Delete all existing action items
2. Re-extract with new code
3. Check logs for: `[Batch Dedup] 1 batch duplicates removed`

**If still seeing duplicates:**
- The similarity might be <80% (need to lower further to 75%)
- Check logs for actual similarity score

### Issue 3: Users Seeing Other Users' Items ✅ Should Be Fixed
**Status:** Frontend filtering deployed, takes effect immediately (no re-extraction needed)

**What to test:**
1. Clear browser/app cache
2. Reload app
3. Log in as Myles → Should only see his items + unassigned
4. Log in as Hadi → Should only see his items + unassigned

**If still seeing others' items:**
- Check console logs: `📋 Filtered to X items (assigned to you or unassigned)`
- The filter might not be applying correctly

---

## 🎯 Improving Action Item Intelligence

### Current Approach: GPT-4o Prompt (Good for Single Conversation)

**You don't need RAG because:**
- You're extracting from ONE conversation at a time
- GPT-4o already sees ALL messages from that conversation
- RAG is for searching across MANY conversations

### How to Make the Prompt More Intelligent

Looking at your test conversations, here's what's working vs. not working:

#### ✅ Working Well:
- Direct assignments: "Myles, can you have benchmarks ready by Wednesday?"
- First-person commitments: "I'll handle PostgreSQL and MySQL"
- Clear deadlines: "by Friday EOD"

#### ❌ Not Working Well:
- Duplicate detection (MongoDB tasks)
- Sender resolution (unassigned "I'll handle")
- Message context (wrong source message)

### Recommended Improvements:

#### 1. Add Few-Shot Examples to Prompt

Instead of just rules, show GPT-4o EXACTLY what you want:

```typescript
const fewShotExamples = `
EXAMPLE CONVERSATION 1:
[0] Hadi Raad: I can handle the MongoDB setup
[1] Myles Lewis: Sounds good

CORRECT EXTRACTION:
{
  "task": "Handle the MongoDB setup",
  "assignee": "SENDER",  // Will resolve to Hadi Raad (sender of message [0])
  "messageId": "0",       // The message where commitment was made
  "confidence": 0.95,
  "context": "Database setup for analytics project"
}

EXAMPLE CONVERSATION 2:
[0] Dan Greenlee: Myles, can you have benchmarks ready by Wednesday?
[1] Myles Lewis: Yes, I'll handle it

CORRECT EXTRACTION:
{
  "task": "Have benchmarks ready by Wednesday",
  "assignee": "Myles",    // Explicitly named in message [0]
  "messageId": "0",       // The message where task was assigned
  "deadline": "Wednesday",
  "confidence": 0.98,
  "context": "Performance benchmarking for database selection"
}

EXAMPLE CONVERSATION 3 (DUPLICATE - DON'T EXTRACT):
[0] Hadi Raad: I'll get MongoDB ready today
[1] Dan Greenlee: Great
[2] Hadi Raad: I can handle the MongoDB setup

DON'T extract both [0] and [2] - they're semantically identical!
Our deduplication will catch this, but you should prefer the MORE SPECIFIC one.
Extract message [0] with deadline "today" (more specific) over message [2] (generic).
`;

// Add to prompt:
prompt: fewShotExamples + "\n\n" + existingPrompt + "\n\n" + messagesForPrompt
```

#### 2. Improve Confidence Scoring

Add specific examples of confidence levels:

```typescript
Confidence Scoring Examples:

0.98 (Crystal Clear):
- "Myles, can you have benchmarks ready by Wednesday?" 
  → Assignee: Myles (explicit), Task: benchmarks, Deadline: Wednesday

0.95 (Very Clear):
- "I'll handle the MongoDB setup"
  → Assignee: SENDER, Task: MongoDB setup, Clear commitment

0.90 (Clear but Slightly Ambiguous):
- "I can start backend API changes"
  → Assignee: SENDER, Task: backend API, But "can" is weaker than "will"

0.85 (Minimum Acceptable):
- "Once you have mockups, I can start the API work"
  → Conditional commitment, less clear

0.80 and below (DON'T EXTRACT):
- "Maybe I should update the docs?"
  → Hypothetical, no clear commitment
```

#### 3. Stricter Anti-Hallucination Rules

Add negative examples:

```typescript
CRITICAL: DO NOT EXTRACT These Common False Positives:

❌ "Will do" or "Will do. Thanks for the quick turnaround"
   → NO SPECIFIC TASK mentioned, just acknowledgment

❌ "Sounds good!" or "Perfect!" or "Great work!"
   → Agreement/praise, NOT an action item

❌ "I'm monitoring error rates" (PRESENT TENSE)
   → Already doing it NOW, not a future commitment

❌ "Let me know when it's back up"
   → Request for information, NOT a task assignment

✅ "I'll monitor for the next hour to ensure stability"
   → Clear FUTURE commitment with specific duration
```

---

## 🚀 Deployment Checklist

### Frontend Changes (No Build Needed)
- [x] User filtering deployed to `app/ava/action-items.tsx`
- [ ] Reload app to see changes
- [ ] Test with multiple users

### Backend Changes (Build Automatic)
- [x] Firebase Functions automatically runs `npm run build` during deployment
- [x] TypeScript compiled to JavaScript
- [x] Deployed to us-central1
- [ ] **BUT: Need to re-extract action items for changes to take effect!**

### Testing Steps
1. [ ] Delete existing action items (Firebase Console or script)
2. [ ] Re-extract action items using new code
3. [ ] Check Firebase logs for new diagnostic output
4. [ ] Verify fixes:
   - [ ] Only 1 MongoDB task (not 2)
   - [ ] Correct source message highlighted
   - [ ] Users only see their items + unassigned

---

## 🐛 Common Issues

### "I deployed but nothing changed"
→ You need to **re-extract** action items. The deployment only affects NEW extractions.

### "I'm still seeing duplicate MongoDB tasks"
→ Delete old items and re-extract. Old duplicates won't be automatically removed.

### "Users are still seeing each other's items"
→ Check if frontend changes took effect. Try hard refresh or clear cache.

### "I'm seeing 'unassigned' for 'I'll handle' tasks"
→ Check Firebase logs for SENDER resolution errors. My new logging will show WHERE it's failing.

### "Source message is still wrong"
→ Check Firebase logs for task/message match warnings. If match is <30%, AI returned wrong index.

---

## 📊 Expected Firebase Logs After Re-Extraction

```bash
# Should see this for each action item:

🤖 AI found 10 potential action items

🔍 AI returned these items with messageIds:
  [0] Task: "Handle the MongoDB setup..." | MessageId: 5 | Assignee: SENDER | Confidence: 95%
  [1] Task: "Have benchmarks ready by Wednesday..." | MessageId: 3 | Assignee: Myles | Confidence: 98%

📋 Messages array (DESC order, newest first):
  [0] "Perfect. Great decision process team!" | (Dan Greenlee)
  [1] "I can help with the schema design..." | (Myles Lewis)
  [2] "I'll update the architecture docs today" | (Hadi Raad)
  [3] "Decision made: PostgreSQL for analytics..." | (Dan Greenlee)
  [4] "I agree. PostgreSQL makes sense..." | (Hadi Raad)
  ... and 10 more messages

✓ Message index 5 → ID abc123... | Text: "I can handle the MongoDB setup..."
✓ Task/message match validated (89% word overlap)

[Batch Dedup] Comparing: "Handle the MongoDB setup..." vs "Get MongoDB ready today..." = 82.5%
[Batch Dedup] Found duplicate in batch: ... 82.5% similar
[Batch Dedup] Keeping higher confidence version

[Batch Deduplication] Results: 9 unique items, 1 batch duplicates removed

✅ Not a duplicate - proceeding to create
➕ Creating new item #1
```

---

## 🎯 Next Steps

1. **Delete existing action items** from Firebase Console
2. **Re-extract** using the app
3. **Check logs** to verify all 3 fixes are working
4. **If issues persist**, the logs will now show exactly WHERE they're failing

The deployment was successful - you just need to re-run the extraction process to use the new code!

