# How to Clear SQLite Cache

The SQLite cache stores messages and conversations locally on the device for offline access and fast loading. After deleting data from Firestore, you may need to clear this cache to prevent deleted data from reappearing.

## Methods to Clear SQLite Cache

### Method 1: Automatic (Recommended)
**The cache clears automatically in these scenarios:**

1. **User Signs Out**
   - The `clearCache()` function is automatically called during sign-out
   - All cached messages and conversations are removed
   - Fresh data loads when user signs back in

2. **App Restart After Server Deletion**
   - When the app tries to load a deleted conversation from Firestore, it gets a "not found" error
   - The listener detects this and the conversation naturally disappears
   - New messages won't be cached for deleted conversations

### Method 2: Force Reload in App
**Add a button or trigger in your app:**

```typescript
import { clearCache } from '../services/sqliteService';

// In your component or screen
const handleClearCache = async () => {
  try {
    await clearCache();
    console.log('✅ Cache cleared! Reloading...');
    // Optionally reload the screen or navigate
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
};
```

### Method 3: Clean Restart Script
**Kill all processes and start fresh:**

```bash
./clean-restart.sh
```

This script:
- Kills all running Node/Metro processes
- Clears Expo caches (`.expo`, `node_modules/.cache`)
- Clears Watchman cache
- Starts Expo with `--clear` flag

### Method 4: Manual Database Reset
**Delete the SQLite database file directly:**

**iOS Simulator:**
```bash
# Find and delete the database
rm -rf ~/Library/Developer/CoreSimulator/Devices/*/data/Containers/Data/Application/*/Library/SQLite/*.db
```

**Android Emulator:**
```bash
adb shell
cd /data/data/com.mylessjs.messageai/databases
rm *.db
exit
```

**Note:** This will clear ALL cached data, and the app will rebuild the cache from Firestore on next launch.

### Method 5: Expo Go Cache Clear
**If using Expo Go:**

1. **On iOS:**
   - Close Expo Go completely
   - Open Settings → Expo Go → Clear Cache
   - Or delete and reinstall Expo Go

2. **On Android:**
   - Go to Settings → Apps → Expo Go
   - Tap "Storage" → "Clear Data" → "Clear Cache"
   - Or uninstall and reinstall Expo Go

## What Gets Cleared

When you run `clearCache()`, it executes:

```sql
DELETE FROM messages;
DELETE FROM conversations;
```

This removes:
- ✅ All cached messages across all conversations
- ✅ All cached conversation metadata
- ✅ Read receipts and delivery status (cached)
- ✅ Priority badges and AI metadata (cached)

This preserves:
- ✅ User authentication state
- ✅ User profile data
- ✅ App settings and preferences
- ✅ Firestore data (source of truth)

## When to Clear Cache

You should clear the SQLite cache when:

1. **After deleting data from Firestore** (like we just did with Myles & Dan's conversation)
2. **When messages show incorrect status** (stuck on "sending", wrong read receipts)
3. **When conversations show stale data** (old messages, wrong participant names)
4. **When testing changes** to message loading or caching logic
5. **When data seems corrupted** (duplicate messages, missing messages)
6. **After schema changes** to the SQLite tables

## After Clearing Cache

Once the cache is cleared:

1. **First App Open:**
   - App loads conversation list from Firestore
   - Conversations appear one by one as they're fetched
   - May take 1-2 seconds for initial load

2. **Opening a Conversation:**
   - Messages load from Firestore (not cache)
   - First 30 messages load immediately
   - Older messages load on scroll
   - All messages get cached as they load

3. **Subsequent Opens:**
   - Cache is now rebuilt
   - Fast loading returns (< 100ms from cache)
   - Real-time updates continue normally

## For the Deleted Myles & Dan Conversation

Since we just deleted the conversation from Firestore, the cache will handle it automatically:

1. **Next app launch:**
   - App queries Firestore for conversations
   - Deleted conversation (`Glr9E7WqcIDrkDMqm8jx_SxP1hf1Hd8N8Mpe5jmsm`) won't be in the results
   - Listener won't find it, so it won't appear in the UI

2. **If user tries to open it:**
   - If somehow they have a cached reference
   - Firestore returns "not found"
   - App handles gracefully and removes from UI

3. **SQLite cache cleanup:**
   - Old cached messages from deleted conversation remain until:
     - User signs out (automatic clear)
     - You run `clearCache()` manually
     - Database exceeds size limit and gets pruned (automatic)

**Recommendation:** For immediate cleanup, sign out and sign back in, or add a "Clear Cache" button in your app's debug menu.

## Adding a Clear Cache Button (Optional)

You can add this to your settings screen or debug menu:

```typescript
// In your Settings screen
import { clearCache } from '../services/sqliteService';
import { Alert } from 'react-native';

const handleClearCache = async () => {
  Alert.alert(
    'Clear Cache',
    'This will remove all cached messages and conversations. They will reload from the server.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear Cache',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearCache();
            Alert.alert('Success', 'Cache cleared! Pull down to refresh.');
          } catch (error) {
            Alert.alert('Error', 'Failed to clear cache');
          }
        },
      },
    ]
  );
};

// In your JSX
<TouchableOpacity onPress={handleClearCache}>
  <Text>🧹 Clear Local Cache</Text>
</TouchableOpacity>
```

## Verification

To verify the cache was cleared, check the logs:

```typescript
import { getCachedMessages } from '../services/sqliteService';

// Check if conversation has cached messages
const messages = await getCachedMessages('some-conversation-id');
console.log(`Cached messages: ${messages.length}`); // Should be 0 after clearing
```

---

**Summary for Myles & Dan Conversation:**
- ✅ Deleted from Firestore (71 messages)
- ✅ Deleted from Pinecone (71 embeddings)
- ⏳ SQLite cache will clear automatically on next sign-out
- 💡 Or manually clear by signing out/in or using `clearCache()`

