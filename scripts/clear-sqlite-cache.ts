/**
 * Clear SQLite Cache
 * 
 * This script clears all cached messages and conversations from the client-side SQLite database.
 * Useful for:
 * - Forcing a full reload of data from Firestore
 * - Clearing stale data after database changes
 * - Testing fresh data loading
 * - Removing deleted conversations from cache
 * 
 * Note: This only runs on the client-side (in the app), not on the server.
 * 
 * Usage: Import and call clearCache() from the app
 */

import { clearCache } from '../services/sqliteService';

async function clearSQLiteCache() {
  try {
    console.log('🧹 Clearing SQLite cache...');
    await clearCache();
    console.log('✅ SQLite cache cleared successfully!');
    console.log('📝 All cached messages and conversations removed');
    console.log('🔄 Data will be reloaded from Firestore on next app use');
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  }
}

// If running as script
if (require.main === module) {
  clearSQLiteCache()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default clearSQLiteCache;
