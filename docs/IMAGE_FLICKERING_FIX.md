# 🖼️ Image Flickering Fix

## Problem
Images were flickering/reloading every ~10 seconds, even though the parent MessageRow was properly memoized.

## Root Cause

### Issue 1: CachedImage Not Memoized
```typescript
export default function CachedImage({ uri, ... }) {  // ❌ No memo!
  const [loading, setLoading] = useState(true);
  // ...
}
```

**Problem:** Even though MessageRow was memoized, CachedImage itself wasn't. React would re-mount the entire component on every parent re-render, resetting the loading state and re-fetching the image.

### Issue 2: Unstable Callback Props
```typescript
<CachedImage
  uri={message.mediaURL!}
  onPress={() => setViewerImageUrl(message.mediaURL!)}     // ❌ New function on every render!
  onLongPress={() => handleLongPressMessage(message)}      // ❌ New function on every render!
/>
```

**Problem:** Even if CachedImage was memoized, inline arrow functions create new function references on every render. CachedImage's memo comparison would see different functions and re-render anyway.

## Solution

### 1️⃣ Memoized CachedImage Component
```typescript
const CachedImage = memo(({ uri, ... }) => {
  const [loading, setLoading] = useState(true);
  // ... component logic ...
}, (prevProps, nextProps) => {
  // Only re-render if URI or handlers changed
  return (
    prevProps.uri === nextProps.uri &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onLongPress === nextProps.onLongPress
  );
});

export default CachedImage;
```

**Result:** CachedImage only re-renders when its props actually change!

### 2️⃣ Stable Callbacks in MessageRow
```typescript
const MessageRow = memo(({ item: message, index }) => {
  // ...
  
  // Stable callbacks to prevent CachedImage re-render
  const handleImagePress = useCallback(() => {
    setViewerImageUrl(message.mediaURL!);
  }, [message.mediaURL]);
  
  const handleImageLongPress = useCallback(() => {
    handleLongPressMessage(message);
  }, [message]);
  
  return (
    <CachedImage
      uri={message.mediaURL!}
      onPress={handleImagePress}      // ✅ Stable function reference
      onLongPress={handleImageLongPress}  // ✅ Stable function reference
    />
  );
});
```

**Result:** Callback references stay stable across re-renders (only change if `message.mediaURL` or `message` object changes).

## Technical Details

### Why Images Were Flickering Every 10 Seconds
1. Read receipts update every ~10 seconds
2. MessageRow properly didn't re-render (memo working)
3. **BUT** CachedImage wasn't memoized → re-mounted anyway
4. `useState(true)` for loading → image shows loading spinner
5. Image re-fetches from URL → visible flicker

### The React Component Lifecycle Issue
Without memo, React components re-mount when:
- Parent re-renders (even if props unchanged)
- Component is moved in the tree
- Key changes

With memo, components only re-render when:
- Props change (shallow comparison)
- Custom comparison function returns false

### Why Stable Callbacks Matter
```typescript
// BAD: New function every render
<CachedImage onPress={() => foo()} />
// React sees: onPress !== onPress → re-render!

// GOOD: Stable function reference
const handlePress = useCallback(() => foo(), []);
<CachedImage onPress={handlePress} />
// React sees: onPress === onPress → skip re-render!
```

## Performance Impact

### Before
- ❌ Image re-mounts every ~10 seconds (read receipts)
- ❌ Loading state resets
- ❌ Image re-fetches from network/cache
- ❌ Visible flicker and loading spinner
- ❌ Poor UX, especially on slow networks

### After
- ✅ Image only mounts once when message first appears
- ✅ Loading state preserved across parent re-renders
- ✅ Image cached in memory, no re-fetch
- ✅ Zero flickering
- ✅ Smooth, native iMessage-like UX

## Additional Benefits

### 1. Network Savings
- Images only loaded once per message
- Cached by React Native's Image component
- No redundant network requests

### 2. Memory Efficiency
- Component state preserved (no re-initialization)
- Image bitmap stays in memory
- Less garbage collection pressure

### 3. Battery Life
- Fewer network requests
- Less CPU for re-rendering
- Less GPU for re-painting

## Files Modified

### `components/CachedImage.tsx`
```diff
- export default function CachedImage({ uri, ... }) {
+ const CachedImage = memo(({ uri, ... }) => {
    const [loading, setLoading] = useState(true);
    // ...
    return content;
- }
+ }, (prevProps, nextProps) => {
+   return (
+     prevProps.uri === nextProps.uri &&
+     prevProps.onPress === nextProps.onPress &&
+     prevProps.onLongPress === nextProps.onLongPress
+   );
+ });
+ 
+ export default CachedImage;
```

### `app/chat/[id].tsx`
```diff
  const MessageRow = memo(({ item: message, index }) => {
    // ...
    
+   // Stable callbacks to prevent CachedImage re-render
+   const handleImagePress = useCallback(() => {
+     setViewerImageUrl(message.mediaURL!);
+   }, [message.mediaURL]);
+   
+   const handleImageLongPress = useCallback(() => {
+     handleLongPressMessage(message);
+   }, [message]);
    
    return (
      <CachedImage
        uri={message.mediaURL!}
-       onPress={() => setViewerImageUrl(message.mediaURL!)}
-       onLongPress={() => handleLongPressMessage(message)}
+       onPress={handleImagePress}
+       onLongPress={handleImageLongPress}
      />
    );
  });
```

## Testing Checklist
- [x] Send image message → loads once
- [x] Wait 15-20 seconds → image stays stable (no reload)
- [x] Scroll up/down → images don't reload
- [x] Press image → opens viewer (onPress stable)
- [x] Long press image → shows action sheet (onLongPress stable)
- [x] Receive new message → no image re-renders for old messages

## Best Practices Applied

1. **Memoize Expensive Components:** Components with state (like loading/error) should be memoized to preserve state across parent re-renders

2. **Stable Callbacks:** Use `useCallback` for any function passed as props to memoized components

3. **Custom Comparison Functions:** For memo, define what "unchanged" means (in this case: same URI and same handlers)

4. **Component Composition:** Keep stateful logic in memoized components to prevent state resets

## Future Optimizations

### Image Caching Service
Currently relies on React Native's built-in Image cache. Could add:
- Local disk cache (react-native-fast-image)
- Preloading for faster initial display
- Progressive JPEG loading
- Thumbnail → full-res transition

### Virtual List Optimization
For conversations with many images:
- Only render images in viewport
- Unload off-screen images
- Lazy load images as user scrolls

