# Force Complete Reload - Instructions

## The Problem
Metro bundler (Expo's JavaScript bundler) is serving cached/old code even though files have been updated.

## Solution: Complete Clean Restart

### Step 1: Kill Everything
```bash
# Kill any running Expo/Metro processes
lsof -ti:8081 | xargs kill -9
lsof -ti:19000 | xargs kill -9
lsof -ti:19001 | xargs kill -9
killall node 2>/dev/null
```

### Step 2: Clear All Caches
```bash
cd /Users/mylessjs/Desktop/MessageAI

# Clear Metro cache
rm -rf .expo
rm -rf node_modules/.cache

# Clear watchman cache (if installed)
watchman watch-del-all 2>/dev/null || true
```

### Step 3: Start Fresh
```bash
# Start with clean cache
npx expo start --clear

# Wait for "Metro waiting on exp://..." message
# Then press 'i' for iOS Simulator
```

### Step 4: In Simulator
Once the app loads:
- Press `Cmd + D` (iOS) or `Cmd + M` (Android)
- Tap "Reload"
- OR: `Cmd + R` (iOS) to force reload

---

## Verification Checklist

After reload, verify these features:

### ✅ Profile Photo Upload
1. Open Messages tab
2. Tap profile icon (top right)
3. Tap "Edit Profile"
4. **Should see:** Large avatar at top with "Tap to change photo" text
5. Tap avatar → select photo → should upload

### ✅ Group Info Back Button
1. Open any group chat (3+ people)
2. Tap the header (group name + participant count)
3. **Should see:** 
   - Back button (← arrow) at top left
   - "Group Info" title
   - List of participants

### ✅ Contact Info Back Button
1. From Group Info, tap any participant
2. **Should see:**
   - Back button (← arrow) at top left
   - Contact name as title
   - "Send Message" button at bottom

### ✅ Send Message Works
1. From Contact Info screen
2. Tap "Send Message" button
3. **Should:** Navigate directly to chat with that user
4. **Should NOT:** Show any errors or crash

---

## If Still Not Working

### Check Console Output
Look for these errors in the terminal:
- ❌ `Cannot find module` → missing import
- ❌ `undefined is not an object` → runtime error
- ❌ `Element type is invalid` → component issue

### Verify File Contents
```bash
# Check if Stack import exists
grep "Stack" app/group/\\[id\\].tsx
grep "Stack" app/contact/\\[userId\\].tsx

# Should see: "import { ... Stack } from 'expo-router'"
```

### Last Resort: Hard Reset
```bash
# Delete everything and reinstall
rm -rf node_modules
rm -rf .expo
npm install
npx expo start --clear
```

---

## What Changed (For Reference)

**Files Modified:**
1. `app/group/[id].tsx` - Added Stack.Screen with back button
2. `app/contact/[userId].tsx` - Added Stack.Screen with back button  
3. `app/auth/edit-profile.tsx` - Profile photo upload already there
4. `services/conversationService.ts` - Fixed timer type for React Native

**All code is present and correct** - this is purely a cache/reload issue.

