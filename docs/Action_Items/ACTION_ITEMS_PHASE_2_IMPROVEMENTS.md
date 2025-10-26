# Action Items - Phase 2 Improvements

## Issues Identified from Production Testing

### Issue 1: Task Titles Contain First-Person Pronouns ❌
**Problem:** Tasks are being extracted verbatim with "I'll", "I can", etc.
- "I'll handle PostgreSQL and MySQL" ❌
- "I can handle the MongoDB setup" ❌
- "I'll update the architecture docs today" ❌

**Expected:** Tasks should be written as imperative commands without pronouns:
- "Handle PostgreSQL and MySQL" ✅
- "Handle the MongoDB setup" ✅  
- "Update the architecture docs today" ✅

### Issue 2: First-Person Assignment Still Failing ❌
**Problem:** All items showing as "Unassigned" despite clear "I'll" statements from known users

**Root Cause Analysis:**
The AI prompt TELLS the AI to extract the sender name, but we're relying on the AI to parse "[0] Myles L: message" format. The AI might be:
1. Not parsing the format correctly
2. Extracting "Myles L" which doesn't exactly match displayName in participantDetails
3. Returning the name in a different format

**Better Approach:**
- Instruct AI to return special token like "SENDER" for first-person commitments
- Backend replaces "SENDER" with actual sender's displayName after extraction
- This removes ambiguity and ensures perfect matching

### Issue 3: Batch Deduplication Not Working ❌
**Problem:** Two MongoDB tasks created:
- "I can handle the MongoDB setup" (95%)
- "I'll get MongoDB ready today" (95%)

**Root Cause:** Logic error in batch dedup - when replacing higher confidence item, still marking current as skipped

### Issue 4: Hallucination - Mockups from Wrong Message ❌
**Problem:** "have final mockups by Friday EOD" extracted from "Will do. Thanks for the quick turnaround on mobile optimization"

**Root Cause:** AI prompt not strict enough about ONLY extracting from the specific message, might be looking at surrounding context

## Proposed Solutions

### Solution 1: Rewrite Task Descriptions (New Post-Processing Step)
Add a post-processing step in the backend that:
1. Detects first-person pronouns at start of task
2. Rewrites to imperative form
3. Preserves the rest of the task description

```typescript
function rewriteTaskToImperative(task: string): string {
  // Remove first-person pronouns and convert to imperative
  const patterns = [
    /^I'll\s+/i,
    /^I will\s+/i,
    /^I can\s+/i,
    /^I'm going to\s+/i,
    /^I am going to\s+/i,
    /^Let me\s+/i,
    /^I\s+/i, // Last resort, just "I"
  ];
  
  let rewritten = task;
  for (const pattern of patterns) {
    rewritten = rewritten.replace(pattern, '');
  }
  
  // Capitalize first letter
  if (rewritten.length > 0) {
    rewritten = rewritten.charAt(0).toUpperCase() + rewritten.slice(1);
  }
  
  return rewritten;
}
```

### Solution 2: Use Special Token for Sender Assignment
Update AI prompt to return `"SENDER"` as assignee for first-person commitments, then replace in backend:

**AI Prompt Change:**
```
1. FIRST-PERSON COMMITMENTS - Return "SENDER" as assignee:
   * When message is "[5] John Smith: I can handle the MongoDB setup"
     → assignee = "SENDER" (we'll resolve this to the message sender)
   * When message is "[2] Sarah Lee: I'll take care of the deployment"
     → assignee = "SENDER"
   * Pattern: ANY form of "I/I'll/I can/I will/Let me [do task]"
     → assignee = "SENDER"
```

**Backend Processing:**
```typescript
if (item.assignee === "SENDER" || item.assignee === "sender") {
  // Get the message sender
  const messageIndex = parseInt(item.messageId);
  if (messageIndex >= 0 && messageIndex < messages.length) {
    const senderUserId = messages[messageIndex].sender;
    const senderDetails = participantDetails[senderUserId];
    item.assignee = senderDetails?.displayName || null;
    assigneeId = senderUserId;
  }
}
```

### Solution 3: Fix Batch Deduplication Logic
Current code has bug where we replace but still mark as skipped. Fix:

```typescript
for (let i = 0; i < itemsWithEmbeddings.length; i++) {
  const currentItem = itemsWithEmbeddings[i];
  let isDuplicateInBatch = false;
  let replacedExisting = false;

  for (let j = 0; j < batchDedupedItems.length; j++) {
    const existingNewItem = batchDedupedItems[j];
    
    if (!currentItem.embedding || !existingNewItem.embedding) continue;

    const similarity = cosineSimilarity(currentItem.embedding, existingNewItem.embedding);

    if (similarity >= SIMILARITY_THRESHOLD) {
      isDuplicateInBatch = true;
      
      // Keep higher confidence version
      if (currentItem.confidence > existingNewItem.confidence) {
        console.log("[Batch Dedup] Replacing with higher confidence version");
        batchDedupedItems[j] = currentItem; // Replace
        replacedExisting = true;
        
        // Mark the OLD item as skipped, not the new one
        batchDuplicatesSkipped.push({
          task: existingNewItem.task,
          similarTo: currentItem.task,
          similarity,
        });
      } else {
        console.log("[Batch Dedup] Keeping existing higher confidence version");
        
        // Mark the NEW item as skipped
        batchDuplicatesSkipped.push({
          task: currentItem.task,
          similarTo: existingNewItem.task,
          similarity,
        });
      }
      break;
    }
  }

  // Only add if not a duplicate OR if we replaced an existing item
  if (!isDuplicateInBatch || replacedExisting) {
    if (!replacedExisting) { // Don't add if we already replaced
      batchDedupedItems.push(currentItem);
    }
  }
}
```

### Solution 4: Stricter Anti-Hallucination Rules
Update AI prompt with stronger warnings:

```
CRITICAL ANTI-HALLUCINATION RULES:
- ONLY extract action items that are EXPLICITLY stated in the EXACT message
- DO NOT infer tasks from context or previous messages
- DO NOT extract tasks mentioned in other messages
- If a message says "Will do" without specifying WHAT, DO NOT extract anything
- If a message is just acknowledgment/thanks, DO NOT extract anything
- Examples of messages that should return NO tasks:
  * "Will do" → NO TASK (no specific action mentioned)
  * "Thanks!" → NO TASK (just gratitude)
  * "Will do. Thanks for the quick turnaround" → NO TASK (acknowledgment only)
  * "Sounds good!" → NO TASK (agreement, no commitment)
```

## Implementation Plan

1. ✅ Update AI prompt with "SENDER" token and stricter anti-hallucination rules
2. ✅ Add backend post-processing to replace "SENDER" with actual sender
3. ✅ Add task rewriting function to remove first-person pronouns
4. ✅ Fix batch deduplication logic
5. ✅ Add more logging to track what AI returns vs what we store
6. ✅ Deploy and test

## Testing Checklist

After deployment:
- [ ] "I'll handle PostgreSQL" → Task: "Handle PostgreSQL", Assigned to: sender
- [ ] Multiple similar MongoDB tasks → Only 1 created (highest confidence)
- [ ] "Will do. Thanks!" → NO tasks extracted
- [ ] All first-person commitments properly assigned
- [ ] Task titles have no pronouns

