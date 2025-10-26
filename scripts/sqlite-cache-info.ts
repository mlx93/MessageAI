/**
 * Manually Delete Conversation from SQLite Cache
 * 
 * This is a SIMULATED script that shows what SQL commands would run
 * to delete a conversation from the SQLite cache.
 * 
 * Since SQLite runs client-side in the app, you need to:
 * 1. Sign out and back in (cache clears automatically now)
 * 2. Use the Clear Cache button in the app
 * 3. Delete and reinstall the app (nuclear option)
 */

const conversationId = 'Glr9E7WqcIDrkDMqm8jx_SxP1hf1Hd8N8Mpe5jmsm';

console.log('📱 SQLite Cache Deletion Commands');
console.log('='.repeat(80));
console.log('\nThese SQL commands would be executed on the device:');
console.log('');
console.log(`1. Delete all messages in conversation:`);
console.log(`   DELETE FROM messages WHERE conversationId = '${conversationId}';`);
console.log('');
console.log(`2. Delete conversation metadata:`);
console.log(`   DELETE FROM conversations WHERE id = '${conversationId}';`);
console.log('');
console.log('='.repeat(80));
console.log('\n⚠️  IMPORTANT: SQLite runs ON THE DEVICE, not on the server!');
console.log('\nTo clear the cache, you must:');
console.log('');
console.log('✅ OPTION 1: Sign Out & Back In (RECOMMENDED)');
console.log('   - Cache now clears automatically on sign out');
console.log('   - I just added this to the signOut function');
console.log('   - Restart your app, then sign out and back in');
console.log('');
console.log('✅ OPTION 2: Use Clear Cache Button');
console.log('   - Tap your name → "🧹 Clear Cache"');
console.log('   - Only works if app has reloaded with new code');
console.log('');
console.log('✅ OPTION 3: Delete SQLite Database File Manually');
console.log('   iOS Simulator:');
console.log('   rm -rf ~/Library/Developer/CoreSimulator/Devices/*/data/Containers/Data/Application/*/Library/SQLite/*.db');
console.log('');
console.log('   Android Emulator:');
console.log('   adb shell');
console.log('   cd /data/data/com.mylessjs.messageai/databases');
console.log('   rm *.db');
console.log('   exit');
console.log('');
console.log('✅ OPTION 4: Delete & Reinstall App (NUCLEAR)');
console.log('   - Completely removes all local data');
console.log('   - Guaranteed to work');
console.log('');
console.log('='.repeat(80));
console.log('\n💡 After the cache is cleared, Firestore will show only 1 message');
console.log('   (the one with text "Message" that is marked deleted by both users)');
console.log('');


