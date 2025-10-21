# Android Refresh Steps

**Issue:** Android not showing read receipts or send times after code changes  
**Cause:** Hot reload doesn't always update gesture handlers and animations properly  
**Solution:** Hard refresh the Android app

---

## 🔄 Quick Fix (Try This First)

### Option 1: Reload in Expo
1. In the Expo terminal, press `a` to reopen Android
2. Or shake the device/emulator and tap "Reload"

### Option 2: Clear Metro Cache
```bash
# Stop the current Expo server (Ctrl+C)
npx expo start -c
# Then press 'a' for Android
```

---

## 🔥 Full Restart (If Quick Fix Doesn't Work)

### Complete Reset Steps:

```bash
# 1. Stop Expo server
# Press Ctrl+C in terminal

# 2. Close Android emulator completely
# Click X on emulator window

# 3. Clear all caches
npx expo start -c

# 4. Wait for Metro bundler to start

# 5. Press 'a' to launch Android emulator
```

---

## 📱 Alternative: Manual Reload on Android

If the app is already open on Android:

1. **Shake the device/emulator:**
   - Emulator: Press `Cmd+M` (Mac) or `Ctrl+M` (Windows/Linux)
   - Physical device: Shake the phone

2. **Tap "Reload"** in the dev menu

3. **Or tap "Reload JS Bundle"** for a deeper refresh

---

## 🎯 What Should Work After Restart

### Blue Bubbles (Your Messages)
- ✅ Flush against right edge
- ✅ All move together when swiping left
- ✅ Timestamps appear on right after swipe
- ✅ "Read 12:39 PM" shows below last bubble

### Grey Bubbles (Received Messages)  
- ✅ Stay fixed on left (don't move)
- ✅ "Read 12:39 PM" shows below last bubble (if read)

---

## 🐛 If Still Not Working

### Check Console for Errors
Look for errors related to:
- `react-native-reanimated`
- `react-native-gesture-handler`
- Gesture handlers not initialized

### Verify Reanimated Plugin
Check `babel.config.js` includes:
```javascript
plugins: [
  'react-native-reanimated/plugin', // Must be last
],
```

### Nuclear Option: Reinstall
```bash
# Stop server
rm -rf node_modules
npm install
npx expo start -c
```

---

## 💡 Why This Happens

**Hot Reload Limitations:**
- Gesture handlers require native module reload
- Reanimated shared values need fresh context
- Style changes to animations don't always hot reload

**Android vs iOS:**
- iOS Metro bundler is more aggressive with hot reload
- Android caches more aggressively
- Both benefit from hard refresh on major changes

---

## ✅ Expected Behavior After Restart

1. **Read Receipts Visible:**
   - "Read 11:37 AM" below last message in group
   - Shows for both grey and blue bubbles
   - Only on last message from same sender

2. **Send Times on Swipe:**
   - Swipe any blue bubble left
   - All blue bubbles move together
   - Timestamps appear on right (12:39 PM format)
   - Grey bubbles stay fixed

---

**Try the Quick Fix first, then Full Restart if needed!**

