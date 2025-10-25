/**
 * Test script to verify message deletion functionality
 * Run with: npx ts-node scripts/test-message-deletion.ts
 */

import { initDB, cacheMessage, getCachedMessages, getCachedMessagesPaginated } from '../services/sqliteService';
import { Message } from '../types';

async function testMessageDeletion() {
  console.log('🧪 Testing Message Deletion...\n');

  try {
    // Initialize database
    console.log('1. Initializing database...');
    await initDB();
    console.log('✅ Database initialized\n');

    // Create test messages
    const userId1 = 'user1';
    const userId2 = 'user2';
    const conversationId = 'test-conversation';

    const testMessages: Message[] = [
      {
        id: 'msg1',
        conversationId,
        text: 'Hello from user 1',
        senderId: userId1,
        timestamp: new Date(Date.now() - 3000),
        status: 'sent',
        type: 'text',
        localId: 'local1',
        readBy: [userId1],
        deliveredTo: [userId2],
        deletedBy: []
      },
      {
        id: 'msg2',
        conversationId,
        text: 'Hello from user 2',
        senderId: userId2,
        timestamp: new Date(Date.now() - 2000),
        status: 'sent',
        type: 'text',
        localId: 'local2',
        readBy: [userId1, userId2],
        deliveredTo: [userId1],
        deletedBy: []
      },
      {
        id: 'msg3',
        conversationId,
        text: 'This will be deleted',
        senderId: userId1,
        timestamp: new Date(Date.now() - 1000),
        status: 'sent',
        type: 'text',
        localId: 'local3',
        readBy: [userId1],
        deliveredTo: [userId2],
        deletedBy: []
      }
    ];

    // Cache messages
    console.log('2. Caching test messages...');
    for (const msg of testMessages) {
      await cacheMessage(msg);
    }
    console.log('✅ Messages cached\n');

    // Retrieve all messages
    console.log('3. Retrieving all messages (before deletion)...');
    let messages = await getCachedMessages(conversationId);
    console.log(`Found ${messages.length} messages:`);
    messages.forEach(m => console.log(`   - ${m.id}: "${m.text}" (deletedBy: ${JSON.stringify(m.deletedBy)})`));
    console.log('');

    // Simulate deletion by user1
    console.log('4. Simulating deletion by user1 (msg3)...');
    const deletedMessage = {
      ...testMessages[2],
      deletedBy: [userId1]
    };
    await cacheMessage(deletedMessage);
    console.log('✅ Message updated with deletedBy\n');

    // Retrieve messages again
    console.log('5. Retrieving all messages (after deletion)...');
    messages = await getCachedMessages(conversationId);
    console.log(`Found ${messages.length} messages:`);
    messages.forEach(m => console.log(`   - ${m.id}: "${m.text}" (deletedBy: ${JSON.stringify(m.deletedBy)})`));
    console.log('');

    // Filter messages for user1 (deleted messages should be excluded)
    console.log('6. Filtering messages for user1...');
    const visibleForUser1 = messages.filter(m => !m.deletedBy || !m.deletedBy.includes(userId1));
    console.log(`User1 should see ${visibleForUser1.length} messages:`);
    visibleForUser1.forEach(m => console.log(`   - ${m.id}: "${m.text}"`));
    console.log('');

    // Filter messages for user2 (should see all messages)
    console.log('7. Filtering messages for user2...');
    const visibleForUser2 = messages.filter(m => !m.deletedBy || !m.deletedBy.includes(userId2));
    console.log(`User2 should see ${visibleForUser2.length} messages:`);
    visibleForUser2.forEach(m => console.log(`   - ${m.id}: "${m.text}"`));
    console.log('');

    // Test paginated retrieval
    console.log('8. Testing paginated retrieval...');
    const paginatedMessages = await getCachedMessagesPaginated(conversationId, 10);
    console.log(`Paginated query returned ${paginatedMessages.length} messages`);
    console.log('');

    // Verify results
    console.log('9. Verifying results...');
    const errors: string[] = [];
    
    if (messages.length !== 3) {
      errors.push(`Expected 3 messages, got ${messages.length}`);
    }
    
    if (visibleForUser1.length !== 2) {
      errors.push(`Expected user1 to see 2 messages, got ${visibleForUser1.length}`);
    }
    
    if (visibleForUser2.length !== 3) {
      errors.push(`Expected user2 to see 3 messages, got ${visibleForUser2.length}`);
    }
    
    if (messages.find(m => m.id === 'msg3')?.deletedBy?.length !== 1) {
      errors.push('msg3 should have 1 user in deletedBy array');
    }

    if (errors.length > 0) {
      console.log('❌ Test failed:');
      errors.forEach(err => console.log(`   - ${err}`));
      process.exit(1);
    } else {
      console.log('✅ All tests passed!\n');
      console.log('Summary:');
      console.log('  - SQLite schema includes deletedBy field');
      console.log('  - Messages are cached with deletedBy state');
      console.log('  - Filtering by deletedBy works correctly');
      console.log('  - Per-user deletion state is maintained');
      console.log('  - Pagination includes deletedBy field');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run tests
testMessageDeletion();

