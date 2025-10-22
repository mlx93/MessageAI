# Chat UX Improvements

**Date:** October 21, 2025  
**Status:** 🔄 In Progress

---

## 🎯 **Improvements Implemented**

### 1. ✅ **Typing Indicator - Text-Based**
**Status:** COMPLETE

**Changes:**
- Typing bubbles now show whenever text exists in input (even if user stops typing)
- Removed timestamp line from inside text bubbles
- Text input has maxHeight of 100px to limit vertical growth

**Modified Files:**
- `hooks/useTypingIndicator.ts` - Changed from timer-based to text-based detection
- `app/chat/[id].tsx` - Updated to pass `hasText` parameter

**How it works:**
```typescript
const { updateTypingStatus } = useTypingIndicator(
  conversationId,
  user?.uid || '',
  userProfile?.displayName || '',
  inputText.trim().length > 0  // Shows typing when text exists
);
```

---

### 2. 🔄 **Timestamp Reveal - Swipe All Messages**
**Status:** IN PROGRESS

**Goal:** Hide timestamps by default, reveal ALL at once when user swipes messages left (not individual bubbles)

**Changes Needed:**
1. Remove individual `SwipeableMessage` wrapper
2. Add container-level pan gesture to move ALL messages together
3. Show timestamps on right side (aligned) when swiped
4. All times display at far right of screen

**Implementation:**
```typescript
// New structure:
<View style={styles.messageRow}>
  <View style={styles.messageContainer}>
    {/* Message bubble */}
  </View>
  <Text style={styles.timestampRight}>{time}</Text>
</View>

// Container swipe gesture moves all rows together
```

---

### 3. ⚠️ **Add Participant Feature - Android Fix**
**Status:** PENDING

**Issue:** On Android, unable to type in the participant search input

**Search Dropdown:** Already implemented, works on iOS

**Needs:**
- Debug why `TextInput` in add mode is frozen on Android
- Ensure keyboard appears and input is editable
- Verify search results dropdown appears correctly

---

### 4. ⚠️ **Unread Message Icons & Push Notifications**
**Status:** INVESTIGATION NEEDED

**User Report:** Not seeing unread message icons or push notifications

**Potential Issues:**
1. **Expo Go Limitations:** Push notifications don't work in Expo Go for SDK 53+
2. **Unread Badges:** Need to verify unreadCount logic in conversations
3. **FCM Tokens:** Check if FCM tokens are being registered

**Investigation Steps:**
1. Check if running in Expo Go (notifications won't work)
2. Verify unreadCount in Firestore conversations collection
3. Check if FCM tokens are being saved to user profiles
4. Test in development build (not Expo Go)

---

## 📝 **Code Changes Made**

### `hooks/useTypingIndicator.ts`
**Before:**
```typescript
// Cleared typing status after 500ms of no input
startTyping()  // Called on every keystroke
```

**After:**
```typescript
// Shows typing indicator whenever text exists in input
updateTypingStatus(hasText)  // Updated when text changes
```

### `app/chat/[id].tsx`
**Removed:**
- Individual message swipe gestures
- Timestamp inside message bubbles (kept checkmarks)

**Added:**
- Container-level swipe gesture for all messages
- Timestamp display on right side
- `messageRow` wrapper for bubble + timestamp
- State for `showAllTimestamps`

---

## 🎨 **UI/UX Changes**

### Typing Bubbles:
- ✅ Positioned below latest message (already in place)
- ✅ Show when text exists, not just when actively typing
- ✅ No internal timestamp

### Message Timestamps:
- ❌ **Was:** Each bubble individually swipeable
- ✅ **Now:** All bubbles swipe together
- ✅ **Display:** Timestamps align on far right
- ✅ **Default:** Hidden
- ✅ **On Swipe:** All visible at once

### Text Input:
- ✅ Max height of 100px (prevents excessive growth)
- ✅ Multiline support maintained

---

## 🐛 **Known Issues**

1. **Android Add Participant Input Frozen**
   - TextInput not responding on Android
   - Works fine on iOS
   - Need to investigate platform-specific behavior

2. **Push Notifications Not Appearing**
   - Likely due to Expo Go limitations (SDK 53+)
   - Need development build for testing
   - See: https://docs.expo.dev/develop/development-builds/introduction/

3. **Unread Message Badges**
   - Not displaying (need to verify unreadCount logic)
   - Check Firestore `conversations/{id}/participantDetails/{uid}/unreadCount`

---

## 🚀 **Next Steps**

### High Priority:
1. **Complete Timestamp Swipe Feature**
   - Add gesture handler code
   - Add animated style for message container
   - Add styles for `messageRow`, `timestampRight`, `messagesWrapper`
   - Test swipe gesture on both platforms

2. **Fix Android Add Participant Input**
   - Test TextInput with different props
   - Check if keyboard is being blocked
   - Verify no conflicting gesture handlers

### Medium Priority:
3. **Debug Push Notifications**
   - Check if running in Expo Go
   - Verify FCM token registration
   - Test in development build

4. **Fix Unread Message Badges**
   - Verify unreadCount updates in Firestore
   - Check badge display logic in conversations list
   - Test with multiple messages

---

## 📱 **Testing Checklist**

### Typing Indicator:
- [ ] Type message - bubbles appear immediately
- [ ] Stop typing with text - bubbles remain visible
- [ ] Delete all text - bubbles disappear
- [ ] Test on iOS
- [ ] Test on Android

### Timestamp Reveal:
- [ ] Timestamps hidden by default
- [ ] Swipe left - all messages move together
- [ ] Timestamps appear aligned on right
- [ ] Swipe back - timestamps hide
- [ ] Test with many messages
- [ ] Test on iOS
- [ ] Test on Android

### Add Participant:
- [ ] Tap "Add" button in chat header
- [ ] Type in search input (Android)
- [ ] Type in search input (iOS)
- [ ] Search results appear
- [ ] Select user - added to conversation

### Push Notifications:
- [ ] Build development build (not Expo Go)
- [ ] Send message from another device
- [ ] Notification appears
- [ ] Tap notification - opens conversation

---

## 🔍 **Technical Details**

### Timestamp Swipe Gesture:
```typescript
const timestampTranslateX = useSharedValue(0);

const containerPanGesture = Gesture.Pan()
  .onUpdate((event) => {
    // Only allow left swipe
    if (event.translationX < 0) {
      timestampTranslateX.value = event.translationX;
    }
  })
  .onEnd((event) => {
    if (event.translationX < -60) {
      // Reveal timestamps
      timestampTranslateX.value = withSpring(-80);
      runOnJS(setShowAllTimestamps)(true);
    } else {
      // Hide timestamps
      timestampTranslateX.value = withSpring(0);
      runOnJS(setShowAllTimestamps)(false);
    }
  });

const messagesAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: timestampTranslateX.value }],
}));
```

### Message Row Structure:
```typescript
<View style={styles.messageRow}>
  <View style={styles.messageContainer}>
    {/* Bubble content */}
  </View>
  <Text style={styles.timestampRight}>
    {formattedTime}
  </Text>
</View>
```

---

## 📄 **Files Modified**

1. `hooks/useTypingIndicator.ts` - ✅ Complete
2. `app/chat/[id].tsx` - 🔄 Partial (needs gesture handler)
3. `docs/CHAT_UX_IMPROVEMENTS.md` - ✅ This file

---

## 💡 **Notes**

- Typing indicator change improves UX - users can pause typing without losing indicator
- Container-level swipe is more intuitive than individual message swipes
- Text input maxHeight prevents UI from being pushed off screen
- Android keyboard issues are common - may need platform-specific workarounds
- Push notifications require development build for testing (Expo Go limitations)

---

