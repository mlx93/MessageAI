/**
 * Verify Conversation Deletion
 * 
 * This script checks if a conversation was successfully deleted from:
 * 1. Firestore (conversation document + messages)
 * 2. Pinecone (message embeddings)
 * 
 * Usage:
 * npx ts-node scripts/verify-conversation-deleted.ts <conversationId>
 */

import admin from 'firebase-admin';
import { Pinecone } from '@pinecone-database/pinecone';
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
 * Check if conversation exists in Firestore
 */
async function checkFirestoreConversation(conversationId: string): Promise<{
  exists: boolean;
  messageCount: number;
}> {
  console.log('🔍 Checking Firestore...');
  
  // Check conversation document
  const convDoc = await db.collection('conversations').doc(conversationId).get();
  
  if (!convDoc.exists) {
    console.log('  ✅ Conversation document: NOT FOUND (deleted)');
  } else {
    console.log('  ❌ Conversation document: STILL EXISTS');
    const data = convDoc.data();
    console.log('  Data:', JSON.stringify(data, null, 2));
  }
  
  // Check messages subcollection
  const messagesSnapshot = await db
    .collection(`conversations/${conversationId}/messages`)
    .get();
  
  const messageCount = messagesSnapshot.size;
  
  if (messageCount === 0) {
    console.log('  ✅ Messages subcollection: EMPTY (deleted)');
  } else {
    console.log(`  ❌ Messages subcollection: STILL HAS ${messageCount} MESSAGES`);
    console.log('  Sample messages:', messagesSnapshot.docs.slice(0, 3).map(doc => ({
      id: doc.id,
      text: doc.data().text?.substring(0, 50),
      sender: doc.data().senderId,
    })));
  }
  
  return {
    exists: convDoc.exists,
    messageCount: messageCount,
  };
}

/**
 * Check if embeddings exist in Pinecone
 */
async function checkPineconeEmbeddings(conversationId: string): Promise<{
  embeddingCount: number;
  sampleIds: string[];
}> {
  console.log('\n🔍 Checking Pinecone...');
  
  try {
    // Query Pinecone with filter for this conversation
    const dummyVector = new Array(3072).fill(0);
    
    const queryResponse = await index.query({
      vector: dummyVector,
      filter: {
        conversationId: { $eq: conversationId }
      },
      topK: 10000,
      includeMetadata: true,
    });
    
    const embeddingCount = queryResponse.matches?.length || 0;
    const sampleIds = queryResponse.matches?.slice(0, 5).map(m => m.id) || [];
    
    if (embeddingCount === 0) {
      console.log('  ✅ Pinecone embeddings: NONE FOUND (deleted)');
    } else {
      console.log(`  ❌ Pinecone embeddings: STILL HAS ${embeddingCount} EMBEDDINGS`);
      console.log('  Sample IDs:', sampleIds);
      console.log('  Sample metadata:', queryResponse.matches?.slice(0, 2).map(m => m.metadata));
    }
    
    return {
      embeddingCount,
      sampleIds,
    };
  } catch (error) {
    console.error('  ❌ Error querying Pinecone:', error);
    return {
      embeddingCount: -1,
      sampleIds: [],
    };
  }
}

/**
 * Main verification function
 */
async function verifyDeletion(conversationId: string) {
  console.log('🔍 VERIFYING CONVERSATION DELETION');
  console.log('='.repeat(80));
  console.log(`Conversation ID: ${conversationId}\n`);
  
  // Check Firestore
  const firestoreResult = await checkFirestoreConversation(conversationId);
  
  // Check Pinecone
  const pineconeResult = await checkPineconeEmbeddings(conversationId);
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(80));
  
  const conversationDeleted = !firestoreResult.exists;
  const messagesDeleted = firestoreResult.messageCount === 0;
  const embeddingsDeleted = pineconeResult.embeddingCount === 0;
  
  console.log(`Conversation Document: ${conversationDeleted ? '✅ DELETED' : '❌ STILL EXISTS'}`);
  console.log(`Messages: ${messagesDeleted ? '✅ DELETED' : `❌ ${firestoreResult.messageCount} REMAIN`}`);
  console.log(`Pinecone Embeddings: ${embeddingsDeleted ? '✅ DELETED' : `❌ ${pineconeResult.embeddingCount} REMAIN`}`);
  
  console.log('\n' + '='.repeat(80));
  
  if (conversationDeleted && messagesDeleted && embeddingsDeleted) {
    console.log('✅ SUCCESS: Conversation completely deleted from all systems!');
  } else {
    console.log('❌ WARNING: Conversation data still exists in one or more systems');
    
    if (!conversationDeleted) {
      console.log('\n🔧 To delete conversation document:');
      console.log(`   firebase firestore:delete conversations/${conversationId}`);
    }
    
    if (!messagesDeleted) {
      console.log('\n🔧 To delete messages:');
      console.log(`   npx ts-node scripts/delete-conversation-completely.ts ${conversationId}`);
    }
    
    if (!embeddingsDeleted) {
      console.log('\n🔧 To delete embeddings manually:');
      console.log(`   Use Pinecone console or re-run deletion script`);
    }
  }
  
  console.log('='.repeat(80));
}

// Main execution
const conversationId = process.argv[2];

if (!conversationId) {
  console.error('❌ Error: Conversation ID required');
  console.log('\nUsage: npx ts-node scripts/verify-conversation-deleted.ts <conversationId>');
  console.log('\nExample:');
  console.log('npx ts-node scripts/verify-conversation-deleted.ts Glr9E7WqcIDrkDMqm8jx_SxP1hf1Hd8N8Mpe5jmsm');
  process.exit(1);
}

verifyDeletion(conversationId)
  .then(() => {
    console.log('\n✨ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

