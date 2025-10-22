# Bug Fix: iPhone Photo Permission Denied
**Date:** October 22, 2025  
**Type:** iOS Permission Handling  
**Commit:** `25b9fc6`

---

## Overview
Fixed iPhone photo permission denied issue by adding better error handling and user-friendly feedback when photo library access is not granted.

---

## Bug Report

**Problem:** When tapping the image button on iPhone, user sees:
```
LOG  Permission to access photos denied.
```

**Impact:** 
- Users couldn't share images on iPhone
- No clear feedback or guidance to user
- Permission dialog may have been dismissed accidentally
- Worked on Android but not iOS

**Root Cause:**
- Basic permission check without proper error handling
- No user feedback when permission denied
- No guidance to re-enable in Settings if permanently denied

---

## Solution

### Enhanced Permission Flow

**Step 1: Check Permission Status First**
```typescript
const permissionResult = await ImagePicker.getMediaLibraryPermissionsAsync();
```

**Step 2: Request Permission If Not Granted**
```typescript
if (permissionResult.status !== 'granted') {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (status !== 'granted') {
    // Show alert based on whether we can ask again
  }
}
```

**Step 3: Show User-Friendly Alert**

Two different messages based on permission state:

**First Denial (can ask again):**
```
Title: "Photo Access Required"
Message: "aiMessage needs permission to access your photos to share images in conversations."
Button: OK
```

**Permanent Denial (can't ask again):**
```
Title: "Photo Access Required"
Message: "Please enable photo access for aiMessage in your device Settings app to share images."
Button: OK
```

**Step 4: Enhanced Logging**
```typescript
console.log(`Permission to access photos denied (status: ${status}, canAskAgain: ${canAskAgain})`);
```

---

## Code Changes

**File:** `services/imageService.ts`

**Before:**
```typescript
export const pickImage = async (): Promise<string | null> => {
  try {
    // Request permission to access media library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('Permission to access photos denied');
      return null;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error('Failed to pick image:', error);
    return null;
  }
};
```

**After:**
```typescript
export const pickImage = async (): Promise<string | null> => {
  try {
    // Check current permission status first
    const permissionResult = await ImagePicker.getMediaLibraryPermissionsAsync();
    
    // If we don't have permission, request it
    if (permissionResult.status !== 'granted') {
      console.log('Requesting media library permissions...');
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        console.log(`Permission to access photos denied (status: ${status}, canAskAgain: ${canAskAgain})`);
        
        // Import Alert dynamically to avoid circular dependency
        const { Alert } = await import('react-native');
        
        if (!canAskAgain) {
          Alert.alert(
            'Photo Access Required',
            'Please enable photo access for aiMessage in your device Settings app to share images.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Photo Access Required',
            'aiMessage needs permission to access your photos to share images in conversations.',
            [{ text: 'OK' }]
          );
        }
        return null;
      }
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error('Failed to pick image:', error);
    return null;
  }
};
```

---

## Testing

### Test Scenarios

1. **First Time Permission Request:**
   - Tap image button
   - iOS shows permission dialog
   - Tap "Don't Allow"
   - User sees "Photo Access Required" alert with helpful message
   - Can tap image button again to retry

2. **Permanent Denial:**
   - Tap image button after denying multiple times
   - User sees "Photo Access Required" alert
   - Message guides to Settings app
   - User can go to Settings > aiMessage > Photos and enable

3. **Permission Granted:**
   - Tap image button
   - iOS shows permission dialog
   - Tap "Allow"
   - Image picker opens successfully
   - Can select and send images

4. **Android Compatibility:**
   - No changes to Android behavior
   - Continues to work as expected

---

## User Experience Flow

### Before Fix:
1. User taps image button
2. Permission denied (no visible feedback)
3. Console logs error
4. User confused why nothing happened

### After Fix:
1. User taps image button
2. Permission denied
3. **Clear alert appears with explanation**
4. **User knows what to do next**
5. Can retry or go to Settings

---

## iOS Configuration

**Note:** `app.json` already has the required iOS permission description:
```json
"ios": {
  "infoPlist": {
    "NSPhotoLibraryUsageDescription": "This app needs access to your photos to share images in messages."
  }
}
```

This description is shown in the iOS permission dialog when first requesting access.

---

## Considerations

**Why Check Permission Status First?**
- iOS has a limit on how many times you can request a permission
- Checking status first avoids unnecessary requests
- Allows us to detect "can't ask again" state

**Why Dynamic Import of Alert?**
- Avoids potential circular dependencies
- Service files should be self-contained
- React Native Alert only imported when needed

**Why Two Different Messages?**
- First denial: Encourages user to grant permission
- Permanent denial: Provides actionable guidance (go to Settings)

---

## Related Issues

This fix also improves:
- **User Trust:** Clear explanation builds confidence
- **Discoverability:** Users understand why permission is needed
- **Recovery:** Clear path to re-enable if denied

---

## Verification

✅ Permission request shows iOS dialog  
✅ Denial shows clear alert message  
✅ Different messages for first vs permanent denial  
✅ Enhanced logging for debugging  
✅ No breaking changes to Android  
✅ Works on both iOS Simulator and physical devices

---

**Commit:** `25b9fc6`  
**Files Changed:** `services/imageService.ts` (1 file, 28 insertions, 5 deletions)  
**Impact:** Improved user experience when photo permissions not granted on iOS

