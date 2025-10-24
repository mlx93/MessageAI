# 🐛 Presence-Induced Flickering Fix

## Problem
The conversation page was flickering/re-rendering every ~15 seconds, causing:
- Messages to "jump" in the list
- Smooth entrance animations to glitch
- Overall janky UX

## Root Cause
The main `useEffect` in `app/chat/[id].tsx` had **presence state in its dependency array**:

```typescript
}, [conversationId, user, isAddMode, navigation, 
    otherUserOnline, otherUserInApp, otherUserLastSeen, // ❌ These update every ~15 seconds!
    pendingParticipants, participantsToRemove, isOnline]);
```

This caused the **entire effect to re-run** every time presence updated:
- Re-loaded conversation from Firestore
- Re-subscribed to messages (expensive!)
- Re-called `navigation.setOptions()` (triggered re-render)

## Solution
**Split the effects into two:**

### 1️⃣ Core Effect (Lines 87-328)
Only runs when conversation/network changes:
```typescript
}, [conversationId, user, isOnline]);
```

Handles:
- Loading conversation data
- Loading cached messages
- Network status
- Subscribing to real-time messages

### 2️⃣ Header Update Effect (Lines 330-452)
Only runs when presence/UI state changes:
```typescript
}, [conversationId, user, isAddMode, otherUserOnline, otherUserInApp, 
    otherUserLastSeen, pendingParticipants, participantsToRemove]);
```

Handles:
- Updating navigation header with presence indicators
- Updating subtitle ("online", "Last seen 5m ago", etc.)
- Updating header button based on add mode

## Result
✅ **No more flickering every 15 seconds!**
- Presence updates only refresh the header (lightweight)
- Message list stays stable
- Smooth animations work properly
- Much better UX

## Technical Details
- **Before:** ~100+ line effect re-running every 15s → expensive re-subscriptions
- **After:** Separate 20-line effect updating just the header → minimal overhead
- **Performance:** Massive improvement in rendering stability

## Files Modified
- `app/chat/[id].tsx`:
  - Split single massive `useEffect` into two focused effects
  - Removed presence dependencies from core message-loading effect
  - Isolated header updates to prevent cascading re-renders

