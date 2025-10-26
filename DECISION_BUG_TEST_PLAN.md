# Quick Test Plan - Decision Deduplication Bug

## What Was Done

✅ **Enhanced logging deployed** to production  
✅ **Debug script created** to verify query behavior  
✅ **Root cause hypotheses** identified  

## What You Need to Do Now

### Step 1: Trigger a New Extraction

1. Open MessageAI app
2. Go to **Ava > Decisions**
3. Tap the **"Analyze Conversations"** button
4. Let it complete

### Step 2: Check the Logs Immediately

```bash
cd /Users/mylessjs/Desktop/MessageAI
firebase functions:log --limit 100 | grep -B 5 -A 10 "Deduplication"
```

### Step 3: Look for These Key Lines

The enhanced logging will show:

```
[Deduplication] Query params: conversationId="Glr9E7Wq..."
[Deduplication] Found X existing decisions
```

**If X = 0:**
- Query is working correctly
- But if you still see "Found semantic duplicate", that's our bug!
- The comparison logic is wrong

**If X > 0:**
- Query is returning results it shouldn't
- You'll see IDs and statuses of what it found
- This means the Firestore filter isn't working

**If X > 0 AND shows deleted decisions:**
- The `.where("status", "==", "active")` filter is broken
- Would be a critical Firestore issue

### Step 4: Share the Results

Copy the full log output and we can determine the exact root cause.

## What to Expect

Based on your original logs, you should see:
- `Processing 6 messages for extraction`
- `AI extracted 1 decisions, 1 passed quality filters`
- **NEW:** `[Deduplication] Query params: conversationId="..."`
- **NEW:** `[Deduplication] Found X existing decisions`
- `Found semantic duplicate... (94.6% similar)`
- **NEW:** `[Deduplication] Existing decision details: ID=...`

The new lines will tell us exactly what the query returned and what it's comparing against.

## Alternative: Manual Query Test

If you want to verify the query without triggering extraction:

```bash
cd /Users/mylessjs/Desktop/MessageAI/functions
npx ts-node scripts/debug-decision-query.ts
```

This will show:
- All decisions in the conversation (should be 6, all deleted)
- Active decisions only (should be 0)
- Analysis of the mismatch

---

**Ready for next step once logs are collected!**

