# Decision Extraction Debugging Guide

## What We Fixed

1. **Better Error Handling**: Added try-catch around AI generation with early return
2. **Result Validation**: Check if AI result is valid before using it
3. **Message Limiting**: Process only first 50 messages to avoid token limits
4. **Text Truncation**: Limit each message to 200 characters
5. **Comprehensive Logging**: Added detailed logs at each step

## How to Debug

### Step 1: Check Firebase Logs
Go to: https://console.firebase.google.com/project/messageai-mlx93/logs

Look for logs from `extractDecisions` function:

### Step 2: What to Look For

**Success Pattern:**
```
extractDecisions: conv=..., user=...
Conversation has X participants
Participant mapping: {"uid1":"Myles","uid2":"Hadi",...}
Processing Y messages for extraction
Extracted Z new decisions
```

**Failure Patterns:**

1. **No Participants Mapped:**
```
WARNING: No participant names mapped!
```
→ This means participantProfiles is empty in the conversation

2. **No Messages:**
```
No messages in conversation...
```
→ Conversation has no messages in the last 7 days, or all are hidden/deleted

3. **AI Generation Failed:**
```
AI generation failed: ...
AI error details: {message: "...", cause: "..."}
```
→ OpenAI API error (rate limit, token limit, etc.)

4. **Invalid Result:**
```
Invalid result from AI: ...
```
→ AI returned but didn't provide valid decisions

### Step 3: Common Issues & Solutions

**Issue: "No participant names mapped"**
- Conversation doesn't have `participantProfiles` field
- Need to update conversation metadata with participant profiles

**Issue: "AI generation failed: token limit"**
- Conversation has very long messages
- Already limited to 50 messages and 200 chars each
- May need to reduce further

**Issue: "No messages in date range"**
- All messages in conversation are older than 7 days
- Or all messages are hidden/deleted for this user

**Issue: HTTP 500 errors**
- Check the outer catch block logs for stack trace
- Usually means conversation data is malformed

## Testing

1. Try analyzing conversations again
2. Check Firebase logs for the specific conversation IDs that failed
3. Look for the log patterns above
4. Share the logs if you need help debugging

## Next Steps

If you see specific error patterns in the logs, we can:
1. Fix conversation metadata issues
2. Adjust message limits further
3. Add fallback logic for missing data
4. Improve error messages

