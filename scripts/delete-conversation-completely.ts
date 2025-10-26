/**
 * HARD DELETE CONVERSATION - Complete Removal
 * 
 * This script permanently deletes a conversation from:
 * 1. Firestore (conversation document + all messages)
 * 2. Pinecone (all message embeddings)
 * 3. SQLite cache (if needed - happens client-side on next sync)
 * 
 * ⚠️ WARNING: This is PERMANENT and IRREVERSIBLE!
 * 
 * Usage:
 * npx ts-node scripts/delete-conversation-completely.ts <conversationId>
 */

import admin from 'firebase-admin';
import { Pinecone } from '@pinecone-database/pinecone';
import * as readline from 'readline';
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

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || 'pcsk_4WqACW_U1hep2rXRFfCEJFkUABiuTsc3QdP3bDSjqGVPmqYakP9d4GBMRJWxzp6S7cnLUC'
});

const index = pinecone.index('messageai-conversations');

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (type 'DELETE' to confirm): `, (answer) => {
      rl.close();
      resolve(answer.trim() === 'DELETE');
    });
  });
}

/**
 * Get conversation details for confirmation
 */
async function getConversationDetails(conversationId: string) {
  try {
    const convDoc = await db.collection('conversations').doc(conversationId).get();
    
    if (!convDoc.exists) {
      return null;
    }
    
    const data = convDoc.data();
    const messageCount = await db
      .collection(`conversations/${conversationId}/messages`)
      .count()
      .get();
    
    return {
      id: conversationId,
      type: data?.type || 'unknown',
      participants: data?.participants || [],
      participantDetails: data?.participantDetails || {},
      messageCount: messageCount.data().count,
      createdAt: data?.createdAt?.toDate(),
      lastMessage: data?.lastMessage,
    };
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return null;
  }
}

/**
 * Delete all messages from Firestore
 */
async function deleteMessagesFromFirestore(conversationId: string): Promise<number> {
  console.log('\n📦 Fetching all messages from Firestore...');
  
  const messagesRef = db.collection(`conversations/${conversationId}/messages`);
  const snapshot = await messagesRef.get();
  
  if (snapshot.empty) {
    console.log('No messages found in Firestore');
    return 0;
  }
  
  console.log(`Found ${snapshot.size} messages to delete`);
  
  // Delete in batches of 500 (Firestore limit)
  const batchSize = 500;
  let deletedCount = 0;
  
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch();
    const batchDocs = snapshot.docs.slice(i, i + batchSize);
    
    batchDocs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    deletedCount += batchDocs.length;
    console.log(`  Deleted ${deletedCount}/${snapshot.size} messages...`);
  }
  
  return deletedCount;
}

/**
 * Delete conversation document from Firestore
 */
async function deleteConversationFromFirestore(conversationId: string): Promise<boolean> {
  console.log('\n📄 Deleting conversation document from Firestore...');
  
  try {
    await db.collection('conversations').doc(conversationId).delete();
    console.log('✅ Conversation document deleted');
    return true;
  } catch (error) {
    console.error('❌ Error deleting conversation:', error);
    return false;
  }
}

/**
 * Delete message embeddings from Pinecone
 */
async function deleteEmbeddingsFromPinecone(conversationId: string): Promise<number> {
  console.log('\n🔍 Querying Pinecone for message embeddings...');
  
  try {
    // First, query to find all vector IDs for this conversation
    // We need to use a dummy vector for the query
    const dummyVector = new Array(3072).fill(0);
    
    // Query with filter to find all messages in this conversation
    const queryResponse = await index.query({
      vector: dummyVector,
      filter: {
        conversationId: { $eq: conversationId }
      },
      topK: 10000, // Maximum allowed
      includeMetadata: true,
    });
    
    if (!queryResponse.matches || queryResponse.matches.length === 0) {
      console.log('No embeddings found in Pinecone for this conversation');
      return 0;
    }
    
    console.log(`Found ${queryResponse.matches.length} embeddings to delete`);
    
    // Extract vector IDs
    const vectorIds = queryResponse.matches.map((match) => match.id);
    
    // Delete vectors in batches of 1000 (Pinecone limit)
    const batchSize = 1000;
    let deletedCount = 0;
    
    for (let i = 0; i < vectorIds.length; i += batchSize) {
      const batchIds = vectorIds.slice(i, i + batchSize);
      await index.deleteMany(batchIds);
      deletedCount += batchIds.length;
      console.log(`  Deleted ${deletedCount}/${vectorIds.length} embeddings...`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('❌ Error deleting from Pinecone:', error);
    return 0;
  }
}

/**
 * Main deletion function
 */
async function deleteConversation(conversationId: string) {
  console.log('🔍 Fetching conversation details...\n');
  
  // Get conversation details
  const details = await getConversationDetails(conversationId);
  
  if (!details) {
    console.error('❌ Conversation not found!');
    process.exit(1);
  }
  
  // Display conversation details
  console.log('📋 CONVERSATION DETAILS:');
  console.log('━'.repeat(60));
  console.log(`ID: ${details.id}`);
  console.log(`Type: ${details.type}`);
  console.log(`Participants (${details.participants.length}):`);
  
  details.participants.forEach((participantId: string) => {
    const participantInfo = details.participantDetails[participantId];
    console.log(`  - ${participantInfo?.displayName || 'Unknown'} (${participantId})`);
  });
  
  console.log(`\nTotal Messages: ${details.messageCount}`);
  console.log(`Created: ${details.createdAt?.toLocaleString() || 'Unknown'}`);
  
  if (details.lastMessage) {
    console.log(`Last Message: "${details.lastMessage.text?.substring(0, 50)}..."`);
  }
  
  console.log('━'.repeat(60));
  console.log('\n⚠️  WARNING: This will PERMANENTLY DELETE:');
  console.log(`   • ${details.messageCount} messages from Firestore`);
  console.log(`   • All message embeddings from Pinecone`);
  console.log(`   • The conversation document`);
  console.log('\n   THIS CANNOT BE UNDONE!\n');
  
  // Ask for confirmation
  const confirmed = await confirm('Are you sure you want to DELETE this conversation?');
  
  if (!confirmed) {
    console.log('\n❌ Deletion cancelled');
    process.exit(0);
  }
  
  console.log('\n🚀 Starting deletion process...\n');
  
  // Step 1: Delete messages from Firestore
  const messagesDeleted = await deleteMessagesFromFirestore(conversationId);
  
  // Step 2: Delete conversation document from Firestore
  const conversationDeleted = await deleteConversationFromFirestore(conversationId);
  
  // Step 3: Delete embeddings from Pinecone
  const embeddingsDeleted = await deleteEmbeddingsFromPinecone(conversationId);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ DELETION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Firestore Messages Deleted: ${messagesDeleted}`);
  console.log(`Firestore Conversation Deleted: ${conversationDeleted ? 'Yes' : 'No'}`);
  console.log(`Pinecone Embeddings Deleted: ${embeddingsDeleted}`);
  console.log('='.repeat(60));
  console.log('\n📝 Note: SQLite cache will be cleared on next app sync');
}

// Main execution
const conversationId = process.argv[2];

if (!conversationId) {
  console.error('❌ Error: Conversation ID required');
  console.log('\nUsage: npx ts-node scripts/delete-conversation-completely.ts <conversationId>');
  process.exit(1);
}

deleteConversation(conversationId)
  .then(() => {
    console.log('\n✨ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

