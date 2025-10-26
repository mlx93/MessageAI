/**
 * Debug Utility: Clear SQLite Cache
 * 
 * Add this button somewhere in your app (Settings screen, or temporarily in the Messages tab)
 * for easy cache clearing during development.
 */

import * as SQLite from 'expo-sqlite';
import { Alert, TouchableOpacity, Text } from 'react-native';

export const DebugClearCacheButton = () => {
  const handleClearCache = async () => {
    Alert.alert(
      '⚠️ Clear Cache',
      'This will delete ALL cached messages. You will need to reload conversations from Firestore.\n\nAre you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = SQLite.openDatabaseSync('messages.db');
              
              // Count messages before deletion
              const countResult = db.getFirstSync('SELECT COUNT(*) as count FROM messages') as { count: number };
              const count = countResult.count;
              
              // Delete all cached messages
              db.runSync('DELETE FROM messages');
              
              Alert.alert(
                '✅ Cache Cleared',
                `Deleted ${count} cached messages.\n\nReload the app to see the clean state.`
              );
              
              console.log(`✅ Cache cleared! Deleted ${count} messages.`);
            } catch (error) {
              Alert.alert('❌ Error', `Failed to clear cache: ${error}`);
              console.error('Failed to clear cache:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity
      onPress={handleClearCache}
      style={{
        backgroundColor: '#FF3B30',
        padding: 16,
        borderRadius: 8,
        margin: 16
      }}
    >
      <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
        🗑️ Clear SQLite Cache (Debug)
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Quick Usage:
 * 
 * In app/(tabs)/index.tsx (Messages screen), temporarily add:
 * 
 * import { DebugClearCacheButton } from '../../components/DebugClearCacheButton';
 * 
 * // Add before the conversation list:
 * <DebugClearCacheButton />
 * <FlatList ... />
 */

