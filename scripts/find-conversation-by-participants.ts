/**
 * FIND CONVERSATION BY PARTICIPANTS
 * 
 * This script helps you find a conversation ID by participant names or phone numbers.
 * Useful for confirming which conversation to delete.
 * 
 * Usage:
 * npx ts-node scripts/find-conversation-by-participants.ts
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = resolve(__dirname, '../functions/serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * Search for users by name or phone
 */
async function findUserByName(searchTerm: string): Promise<any[]> {
  const usersSnapshot = await db.collection('users').get();
  
  const matches = usersSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((user: any) => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
      const displayName = (user.displayName || '').toLowerCase();
      const search = searchTerm.toLowerCase();
      
      return fullName.includes(search) || 
             displayName.includes(search) ||
             user.phoneNumber?.includes(search);
    });
  
  return matches;
}

/**
 * Find conversations with specific participants
 */
async function findConversationsByParticipants(participantIds: string[]): Promise<any[]> {
  console.log('\n🔍 Searching for conversations with participants:', participantIds);
  
  const conversationsSnapshot = await db.collection('conversations').get();
  
  const matches = conversationsSnapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((conv: any) => {
      // Check if conversation contains all specified participants
      const convParticipants = conv.participants || [];
      
      // For a direct conversation (2 people), we want exact match
      if (participantIds.length === 2 && convParticipants.length === 2) {
        return participantIds.every((id) => convParticipants.includes(id));
      }
      
      // For group conversations, check if all specified participants are included
      return participantIds.every((id) => convParticipants.includes(id));
    });
  
  return matches;
}

/**
 * Get message count for a conversation
 */
async function getMessageCount(conversationId: string): Promise<number> {
  try {
    const countSnapshot = await db
      .collection(`conversations/${conversationId}/messages`)
      .count()
      .get();
    return countSnapshot.data().count;
  } catch (error) {
    console.error(`Error counting messages for ${conversationId}:`, error);
    return 0;
  }
}

/**
 * Display conversation details
 */
async function displayConversations(conversations: any[]) {
  if (conversations.length === 0) {
    console.log('\n❌ No conversations found');
    return;
  }
  
  console.log(`\n✅ Found ${conversations.length} conversation(s):\n`);
  console.log('='.repeat(80));
  
  for (const conv of conversations) {
    const messageCount = await getMessageCount(conv.id);
    
    console.log(`\nConversation ID: ${conv.id}`);
    console.log(`Type: ${conv.type}`);
    console.log(`Participants (${conv.participants?.length || 0}):`);
    
    conv.participants?.forEach((participantId: string) => {
      const details = conv.participantDetails?.[participantId];
      console.log(`  - ${details?.displayName || 'Unknown'} (${participantId})`);
    });
    
    console.log(`Messages: ${messageCount}`);
    console.log(`Created: ${conv.createdAt?.toDate?.()?.toLocaleString() || 'Unknown'}`);
    
    if (conv.lastMessage) {
      console.log(`Last Message: "${conv.lastMessage.text?.substring(0, 60)}..."`);
      console.log(`Last Message Time: ${conv.lastMessage.timestamp?.toDate?.()?.toLocaleString() || 'Unknown'}`);
    }
    
    console.log('-'.repeat(80));
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 FIND CONVERSATION BY PARTICIPANTS');
  console.log('='.repeat(80));
  
  // Step 1: Find "Myles"
  console.log('\n📱 Searching for user: Myles...');
  const mylesMatches = await findUserByName('Myles');
  
  if (mylesMatches.length === 0) {
    console.error('❌ No user found matching "Myles"');
    process.exit(1);
  }
  
  console.log(`\nFound ${mylesMatches.length} user(s) matching "Myles":`);
  mylesMatches.forEach((user: any) => {
    console.log(`  - ${user.displayName} (${user.phoneNumber}) [${user.id}]`);
  });
  
  const myles = mylesMatches[0];
  console.log(`\n✅ Using: ${myles.displayName} (${myles.id})`);
  
  // Step 2: Find "Dan"
  console.log('\n📱 Searching for user: Dan...');
  const danMatches = await findUserByName('Dan');
  
  if (danMatches.length === 0) {
    console.error('❌ No user found matching "Dan"');
    process.exit(1);
  }
  
  console.log(`\nFound ${danMatches.length} user(s) matching "Dan":`);
  danMatches.forEach((user: any) => {
    console.log(`  - ${user.displayName} (${user.phoneNumber}) [${user.id}]`);
  });
  
  const dan = danMatches[0];
  console.log(`\n✅ Using: ${dan.displayName} (${dan.id})`);
  
  // Step 3: Find conversation between them
  const conversations = await findConversationsByParticipants([myles.id, dan.id]);
  
  // Display results
  await displayConversations(conversations);
  
  console.log('\n✨ To delete a conversation, run:');
  console.log('npx ts-node scripts/delete-conversation-completely.ts <conversation-id>');
}

// Execute
main()
  .then(() => {
    console.log('\n✅ Search complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

