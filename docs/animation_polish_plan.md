# Animation Polish Plan

**Version:** 1.0  
**Date:** October 23, 2025  
**Scope:** Micro-interactions and transition polish  
**Estimated Time:** 2-3 hours total  
**Goal:** Achieve +3 bonus points for "Polish" on rubric

---

## Overview

This plan adds professional micro-interactions and smooth transitions to existing features. All animations run at 60 FPS using `react-native-reanimated` (already installed) and `expo-haptics`.

**Key Principles:**
- Native feel (spring physics, not linear)
- Subtle, not distracting
- Run on UI thread (worklets)
- Haptic feedback for touch events

---

## Prerequisites

Install haptics (if not already):
```bash
npx expo install expo-haptics
```

Import in each file:
```typescript
import * as Haptics from 'expo-haptics';
import { FadeInDown, FadeIn, SlideInUp } from 'react-native-reanimated';
```

---

## 1. List Item Entry Animations (Staggered Fade-In)

**Goal:** Conversations appear with smooth staggered animation on app open

**Current State:**
- Conversations appear instantly
- No transition from skeleton to content

**File:** `app/(tabs)/index.tsx`

**Implementation:**

```typescript
import Animated, { FadeInDown } from 'react-native-reanimated';

// In FlatList renderItem (around line 456):
const renderItem = ({ item, index }: { item: Conversation; index: number }) => {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
    >
      <SwipeableConversationItem item={item} />
    </Animated.View>
  );
};

// Update FlatList:
<FlatList
  data={conversations}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  // ... other props
/>
```

**Why 50ms delay:**
- 10 conversations = 500ms total (feels natural)
- Not too slow, not too fast
- Creates "cascade" effect

**Testing:**
- ✅ Close app, reopen → conversations fade in from top
- ✅ 60 FPS (check with performance monitor)
- ✅ No jank on scroll

---

## 2. Swipe Gesture Polish (Haptic Feedback)

**Goal:** Vibrate when swipe reaches delete threshold

**Current State:**
- Swipe works perfectly
- No tactile feedback at 40px threshold

**File:** `app/(tabs)/index.tsx`

**Implementation:**

```typescript
import * as Haptics from 'expo-haptics';

// Inside SwipeableConversationItem (around line 298):
const hasVibrated = useRef(false);

const panGesture = useMemo(() => Gesture.Pan()
  .onUpdate((event) => {
    'worklet';
    if (event.translationX < 0) {
      translateX.value = Math.max(event.translationX, -80);
      
      // Haptic feedback at threshold (NEW)
      if (event.translationX < -40 && !hasVibrated.current) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        hasVibrated.current = true;
      }
      
      // Reset if swipe back
      if (event.translationX > -40 && hasVibrated.current) {
        hasVibrated.current = false;
      }
    }
  })
  .onEnd((event) => {
    'worklet';
    hasVibrated.current = false; // Reset for next swipe
    
    if (event.translationX < -40) {
      translateX.value = withSpring(-80, { damping: 15 });
    } else {
      translateX.value = withSpring(0);
    }
  }), [translateX]);
```

**Why Medium impact:**
- Light = too subtle
- Medium = clear confirmation
- Heavy = too aggressive

**Testing:**
- ✅ Swipe past 40px → feel vibration
- ✅ Swipe back before 40px → no vibration
- ✅ Works on iOS and Android

---

## 3. Modal/Screen Transitions

**Goal:** Screens fade + scale in, not just slide

**Current State:**
- Default slide-in transition
- Feels abrupt

**Files:** 
- `app/chat/group-info.tsx`
- `app/chat/contact-info.tsx`
- `app/auth/edit-profile.tsx`

**Implementation:**

```typescript
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';

// At top of component:
const GroupInfoScreen = () => {
  const scale = useSharedValue(0.95);
  const opacity = useSharedValue(0);
  
  useEffect(() => {
    // Animate in
    scale.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic)
    });
    opacity.value = withTiming(1, { duration: 200 });
  }, []);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value
  }));
  
  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Existing content */}
    </Animated.View>
  );
};
```

**Alternative (simpler):**
```typescript
// Just add entering prop to root View:
<Animated.View entering={FadeIn.duration(300)} style={styles.container}>
  {/* Content */}
</Animated.View>
```

**Apply to:**
- Group info screen
- Contact info screen
- Edit profile screen
- New message screen

**Testing:**
- ✅ Screen fades + scales in smoothly
- ✅ Feels connected to previous screen
- ✅ No performance impact

---

## 4. Optimistic UI Animation

**Goal:** Messages fade in while sending, solidify when confirmed

**Current State:**
- Messages appear instantly (good!)
- No visual distinction between "sending" and "sent"

**File:** `app/chat/[id].tsx`

**Implementation:**

```typescript
// Inside MessageRow component (around line 822):
import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const MessageRow = ({ message, isOwnMessage, /* ... */ }) => {
  const opacity = useSharedValue(message.status === 'sending' ? 0.7 : 1);
  
  // Animate to full opacity when sent
  useEffect(() => {
    if (message.status === 'sent' || message.status === 'delivered') {
      opacity.value = withTiming(1, { duration: 300 });
    }
  }, [message.status]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }));
  
  return (
    <Animated.View style={[styles.messageRow, animatedStyle]}>
      {/* Existing message bubble */}
    </Animated.View>
  );
};
```

**Visual feedback:**
- Sending: 70% opacity (subtle)
- Sent: 100% opacity (solid)
- Queued: 60% opacity + orange chip

**Testing:**
- ✅ Send message → appears at 70%, fades to 100%
- ✅ Offline message → stays at 60% with "Queued" chip
- ✅ Fast network → barely noticeable (good!)

---

## 5. Skeleton Loading Transition

**Goal:** Smooth cross-fade between skeleton and content

**Current State:**
- Skeleton disappears, content appears
- Jarring swap

**File:** `app/(tabs)/index.tsx`

**Implementation:**

```typescript
import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

// Add shared values (around line 20):
const skeletonOpacity = useSharedValue(1);
const contentOpacity = useSharedValue(0);

// When loading finishes:
useEffect(() => {
  if (!isLoadingConversations && conversations.length > 0) {
    // Cross-fade animation
    skeletonOpacity.value = withTiming(0, { duration: 200 });
    contentOpacity.value = withTiming(1, { duration: 300 });
  }
}, [isLoadingConversations, conversations.length]);

const skeletonStyle = useAnimatedStyle(() => ({
  opacity: skeletonOpacity.value,
  position: skeletonOpacity.value === 0 ? 'absolute' as const : 'relative' as const,
}));

const contentStyle = useAnimatedStyle(() => ({
  opacity: contentOpacity.value,
}));

// Render both (overlapping):
<View style={{ flex: 1 }}>
  {/* Skeleton (fades out) */}
  {isLoadingConversations && (
    <Animated.View style={[{ flex: 1 }, skeletonStyle]}>
      <ConversationSkeleton count={8} />
    </Animated.View>
  )}
  
  {/* Content (fades in) */}
  <Animated.View style={[{ flex: 1 }, contentStyle]}>
    <FlatList
      data={conversations}
      // ... props
    />
  </Animated.View>
</View>
```

**Why cross-fade:**
- Smooth transition, not abrupt
- User sees content "materialize"
- Professional feel

**Testing:**
- ✅ Open app → skeleton fades out, list fades in
- ✅ No flicker
- ✅ Subsequent navigation → no skeleton (cached)

---

## 6. Button Press Animations

**Goal:** Buttons scale on press (like iOS)

**Current State:**
- Buttons just change opacity
- Feels flat

**Files:** All screens with buttons

**Implementation:**

```typescript
import { Pressable } from 'react-native';
import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedButton = ({ onPress, children, style }) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));
  
  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10 });
      }}
      onPress={onPress}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// Usage (replace TouchableOpacity):
<AnimatedButton onPress={handleSend} style={styles.sendButton}>
  <Text style={styles.sendButtonText}>Send</Text>
</AnimatedButton>
```

**Apply to:**
- Send button (chat screen)
- Add participant button
- Leave Group button
- Save Changes button
- All primary action buttons

**Testing:**
- ✅ Button scales to 95% on press
- ✅ Springs back to 100% on release
- ✅ Light haptic feedback
- ✅ Feels responsive

---

## 7. New Message Slide-In Animation

**Goal:** New messages slide up from bottom

**Current State:**
- Messages appear instantly

**File:** `app/chat/[id].tsx`

**Implementation:**

```typescript
import { SlideInUp } from 'react-native-reanimated';

// In MessageRow:
<Animated.View
  entering={SlideInUp.duration(300).springify()}
  style={styles.messageRow}
>
  {/* Message bubble */}
</Animated.View>
```

**Why slide up:**
- Natural "sending" direction
- Matches keyboard appearance
- Smooth, not jarring

**Testing:**
- ✅ Send message → slides up from bottom
- ✅ Receive message → slides up from bottom
- ✅ Fast chat → no lag, smooth

---

## Implementation Checklist

### Core Animations (60 min)
- [ ] List item entry animations (15 min)
- [ ] Swipe haptic feedback (10 min)
- [ ] Modal/screen transitions (20 min)
- [ ] Skeleton cross-fade (15 min)

### Message Animations (45 min)
- [ ] Optimistic UI fade (20 min)
- [ ] New message slide-in (15 min)
- [ ] Queued message pulse (10 min - optional)

### Button Animations (30 min)
- [ ] Create AnimatedButton component (15 min)
- [ ] Replace TouchableOpacity in 5-8 key buttons (15 min)

**Total Time:** 2-3 hours

---

## Additional Polish Ideas (Optional)

### 8. Typing Indicator Animation (Already Exists!)
Your typing indicator already uses smooth opacity animation (3 dots pulsing). ✅

### 9. Read Receipt Fade-In
When message is read, checkmarks fade in:
```typescript
// In read receipt rendering:
<Animated.View entering={FadeIn.duration(200)}>
  <Text>✓✓</Text>
</Animated.View>
```

### 10. Unread Badge Bounce
When new message arrives, badge bounces in:
```typescript
import { BounceIn } from 'react-native-reanimated';

<Animated.View entering={BounceIn}>
  <View style={styles.unreadBadge}>
    <Text>{unreadCount}</Text>
  </View>
</Animated.View>
```

---

## Performance Guidelines

**Do:**
- ✅ Use `worklets` for gestures (runs on UI thread)
- ✅ Use `withSpring()` for natural motion
- ✅ Use `entering` props (built-in, optimized)
- ✅ Keep animations under 300ms

**Don't:**
- ❌ Use `Animated.timing()` with linear easing (feels robotic)
- ❌ Animate layout properties (use transform/opacity)
- ❌ Chain too many animations (lags)
- ❌ Use `setState` in gesture handlers (use shared values)

---

## Testing Strategy

### Manual Testing:
1. **FPS Monitor:** Enable in Expo (shake device → Show Performance Monitor)
2. **Device Testing:** Test on older devices (iPhone 12, Pixel 4)
3. **Slow Animation:** Enable in iOS Settings → Developer → Slow Animations

### Success Criteria:
- ✅ 60 FPS maintained during all animations
- ✅ No jank on list scroll
- ✅ Haptics feel natural, not excessive
- ✅ Animations complete before user interaction
- ✅ Works on iOS and Android

---

## Rubric Impact

**Before Animation Polish:**
- Mobile Quality: 18-19/20
- Polish Bonus: 0/3

**After Animation Polish:**
- Mobile Quality: 20/20 ✅ (60 FPS + smooth transitions)
- Polish Bonus: +2-3 points ✅ (micro-interactions, haptics, design system)

**Total Impact:** +3-4 points on rubric

---

## Files to Modify

1. `app/(tabs)/index.tsx` - List animations, swipe haptics, skeleton transition
2. `app/chat/[id].tsx` - Message animations, button press
3. `app/chat/group-info.tsx` - Screen transition
4. `app/chat/contact-info.tsx` - Screen transition
5. `app/auth/edit-profile.tsx` - Screen transition, button press
6. `components/AnimatedButton.tsx` - NEW (reusable component)

**Total:** 6 files modified, 1 new component

---

## Quick Start

**Priority order:**
1. **Swipe haptic feedback** (10 min, high impact, 1 file)
2. **List entry animations** (15 min, immediate visual wow, 1 file)
3. **Button press animations** (30 min, create component, apply everywhere)
4. **Skeleton cross-fade** (15 min, polish loading experience)
5. **Screen transitions** (20 min, apply to 3 screens)
6. **Message animations** (35 min, optimize existing flow)

**Skip if time-limited:**
- Read receipt fade (minor)
- Badge bounce (nice-to-have)
- Queued message pulse (already has chip)

---

**Ready to implement? Start with swipe haptics (easiest win), then list animations (biggest visual impact).**

