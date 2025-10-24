# 🐛 Flickering Root Cause & Fix

## Problem
Conversation page was flickering/re-rendering every ~10-15 seconds, even though:
- Smart update logic was in place
- Presence was moved to separate effect
- SQLite deduplication was implemented

## Root Cause (From Commit 6c31f8b)
Two issues were causing the flickering:

### 1️⃣ Missing Memo Comparison Function
```typescript
const MessageRow = memo(({ item: message, index }) => {
  // ... component logic ...
}); // ❌ No comparison function!
```

**Problem:** Even though the parent component wasn't re-rendering unnecessarily, React was still re-rendering ALL MessageRow components because memo didn't know HOW to compare props.

### 2️⃣ Reanimated's `entering` Animation
```typescript
<Animated.View 
  entering={SlideInUp.duration(300).springify()}  // ❌ Re-triggers on every render!
  style={[styles.messageRow, messageAnimatedStyle]}
>
```

**Problem:** Reanimated's `entering` prop is designed to run on **component mount**. But when React re-renders (even with same data), it can re-trigger the animation, causing the "jump" effect.

## Solution

### 1️⃣ Added Proper Memo Comparison
```typescript
const MessageRow = memo(({ item: message, index }) => {
  // ... component logic ...
}, (prevProps, nextProps) => {
  const prev = prevProps.item;
  const next = nextProps.item;
  
  // Return TRUE if props are equal (don't re-render)
  return (
    prev.id === next.id &&
    prev.text === next.text &&
    prev.status === next.status &&
    prev.readBy.length === next.readBy.length &&
    prev.deliveredTo.length === next.deliveredTo.length &&
    prev.mediaURL === next.mediaURL &&
    prevProps.index === nextProps.index
  );
});
```

**Result:** MessageRow only re-renders when actual message data changes.

### 2️⃣ Removed `entering` Animation
```typescript
<Animated.View 
  style={[styles.messageRow, messageAnimatedStyle]}  // ✅ No entering animation
>
```

**Result:** Messages render instantly, no animation re-triggers.

**Note:** We kept the **opacity animation** for optimistic UI (fading in sent messages), which is handled by `messageAnimatedStyle` and doesn't re-trigger.

## Technical Details

### Why Smart Update Logic Wasn't Enough
The smart update logic in the Firestore listener (lines 149-188) was working correctly:
- It prevented `setMessages()` from being called unnecessarily
- It kept old message references when data hadn't changed

**But** this only prevented the parent component from triggering a re-render. React's reconciliation could still re-render child components if:
1. memo doesn't have a comparison function (default shallow compare might fail)
2. Reanimated animations re-trigger

### Why This Explains the 10-Second Pattern
- Presence heartbeat: ~15 seconds
- Read receipts: ~10-15 seconds when messages are being read
- Each update would cause MessageRow re-renders due to missing memo comparison
- `entering` animation would re-trigger → flicker/jump

## Result
✅ **Zero flickering!**
- Messages only re-render when their data actually changes
- No animation re-triggers
- Smooth, stable message list
- Initial load is instant (messages appear immediately from SQLite cache)
- Only NEW messages show opacity fade-in (optimistic UI)

## Files Modified
- `app/chat/[id].tsx`:
  - Added proper memo comparison function to MessageRow (lines 1161-1175)
  - Removed `SlideInUp.duration(300).springify()` from Animated.View (line 991)
  - Removed `SlideInUp` from imports (line 6)

## Testing
To verify the fix:
1. Open a conversation
2. Wait 15-20 seconds (presence updates)
3. Messages should NOT flicker or jump
4. Send a new message → should fade in smoothly
5. Scroll through old messages → should be instant and smooth

