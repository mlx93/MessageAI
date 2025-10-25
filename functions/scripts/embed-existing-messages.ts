#!/usr/bin/env ts-node
/**
 * Migration Script: Embed Existing Messages for RAG Search
 * 
 * This script:
 * 1. Fetches all messages from Firestore that haven't been embedded yet
 * 2. Generates embeddings using OpenAI's text-embedding-3-large
 * 3. Stores embeddings in Pinecone for semantic search
 * 4. Updates Firestore to mark messages as embedded
 * 
 * Usage:
 *   npm run embed-messages
 *   or
 *   ts-node scripts/embed-existing-messages.ts
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from parent directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configuration
const BATCH_SIZE = 100; // Process 100 messages at a time
const PINECONE_INDEX_NAME = 'messageai-conversations';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large';

// Initialize Firebase Admin
if (getApps().length === 0) {
  // Try to use service account if available, otherwise use default
  try {
    const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
    const fs = require('fs');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || 'messageai-mlx93',
      });
      console.log('✅ Using service account credentials');
    } else {
      throw new Error('Service account not found');
    }
  } catch (error) {
    // Fallback to default initialization (requires GOOGLE_APPLICATION_CREDENTIALS)
    console.log('⚠️ No service account found, attempting default initialization');
    console.log('📝 To fix this, either:');
    console.log('   1. Download service account key from Firebase Console');
    console.log('   2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
    console.log('   3. Run: gcloud auth application-default login');
    
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'messageai-mlx93',
    });
  }
}

const db = getFirestore();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

interface MessageData {
  id: string;
  text: string;
  senderId: string;
  conversationId: string;
  timestamp: any;
  type: string;
  embedded?: boolean;
}

/**
 * Generate embeddings for a batch of messages
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await openai.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts,
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

/**
 * Upsert embeddings to Pinecone
 */
async function upsertToPinecone(
  vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, any>;
  }>
) {
  const index = pinecone.index(PINECONE_INDEX_NAME);
  
  try {
    await index.upsert(vectors);
    console.log(`✅ Upserted ${vectors.length} vectors to Pinecone`);
  } catch (error) {
    console.error('Error upserting to Pinecone:', error);
    throw error;
  }
}

/**
 * Mark messages as embedded in Firestore
 */
async function markAsEmbedded(messages: Array<{id: string; conversationId: string}>) {
  const batch = db.batch();
  
  messages.forEach(({id, conversationId}) => {
    const docRef = db.collection('conversations').doc(conversationId)
      .collection('messages').doc(id);
    batch.update(docRef, {
      embedded: true,
      embeddedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  try {
    await batch.commit();
    console.log(`✅ Marked ${messages.length} messages as embedded`);
  } catch (error) {
    console.error('Error marking messages as embedded:', error);
    throw error;
  }
}

/**
 * Process a batch of messages with participants info
 */
async function processBatch(messages: MessageData[], participants?: string[]) {
  if (messages.length === 0) return;

  console.log(`\nProcessing batch of ${messages.length} messages...`);

  // Filter out empty or invalid messages
  const validMessages = messages.filter((msg) => 
    msg.text && 
    msg.text.trim().length > 0 && 
    msg.type !== 'system'
  );

  if (validMessages.length === 0) {
    console.log('No valid messages in batch, skipping...');
    return;
  }

  try {
    // Step 1: Generate embeddings
    console.log('Generating embeddings...');
    const texts = validMessages.map((msg) => msg.text);
    const embeddings = await generateEmbeddings(texts);

    // Step 2: Prepare vectors for Pinecone
    const vectors = validMessages.map((msg, index) => ({
      id: msg.id,
      values: embeddings[index],
      metadata: {
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        userId: msg.senderId, // The message sender's ID for filtering
        participants: participants || [], // All participants for access control
        timestamp: msg.timestamp?.toMillis ? msg.timestamp.toMillis() : Date.now(),
        text: msg.text.substring(0, 500), // Store preview only
        type: msg.type,
      },
    }));

    // Step 3: Upsert to Pinecone
    await upsertToPinecone(vectors);

    // Step 4: Mark as embedded in Firestore
    await markAsEmbedded(validMessages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
    })));

    console.log(`✅ Successfully processed ${validMessages.length} messages`);
  } catch (error) {
    console.error('Error processing batch:', error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrateMessages() {
  console.log('🚀 Starting message embedding migration...\n');
  console.log(`Configuration:`);
  console.log(`  - Batch Size: ${BATCH_SIZE}`);
  console.log(`  - Embedding Model: ${OPENAI_EMBEDDING_MODEL}`);
  console.log(`  - Pinecone Index: ${PINECONE_INDEX_NAME}\n`);

  let totalProcessed = 0;

  try {
    // First, get all conversations
    const conversationsSnapshot = await db.collection('conversations').get();
    console.log(`Found ${conversationsSnapshot.size} conversations to process\n`);

    // Process each conversation
    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;
      const convData = convDoc.data();
      console.log(`\nProcessing conversation: ${conversationId}`);
      console.log(`  Participants: ${convData.participants?.join(', ')}`);

      // Get all messages for this conversation
      const messagesSnapshot = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();

      console.log(`  Found ${messagesSnapshot.size} messages`);

      // Process messages in batches
      const allMessages: MessageData[] = [];
      for (const msgDoc of messagesSnapshot.docs) {
        const data = msgDoc.data();
        
        // Skip if already embedded
        if (data.embedded) {
          continue;
        }

        // Skip system messages
        if (data.type === 'system' || !data.text || data.text.trim().length === 0) {
          continue;
        }

        allMessages.push({
          id: msgDoc.id,
          conversationId: conversationId,
          text: data.text,
          senderId: data.senderId,
          timestamp: data.timestamp,
          type: data.type || 'text',
        });

      // Process when we have a full batch
      if (allMessages.length >= BATCH_SIZE) {
        const batch = allMessages.splice(0, BATCH_SIZE);
        await processBatch(batch, convData.participants);
        totalProcessed += batch.length;
        console.log(`  Progress: ${totalProcessed} total messages processed`);
        
        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Process any remaining messages
    if (allMessages.length > 0) {
      await processBatch(allMessages, convData.participants);
      totalProcessed += allMessages.length;
      console.log(`  Progress: ${totalProcessed} total messages processed`);
    }

      console.log(`  ✅ Completed conversation ${conversationId}`);
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`Total messages embedded: ${totalProcessed}`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Verify Pinecone index exists
 */
async function verifyPineconeIndex() {
  try {
    const indexes = await pinecone.listIndexes();
    const indexExists = indexes.indexes?.some(
      (index) => index.name === PINECONE_INDEX_NAME
    );

    if (!indexExists) {
      console.error(
        `❌ Pinecone index "${PINECONE_INDEX_NAME}" not found!`
      );
      console.log('\nPlease create the index first using:');
      console.log('  npm run create-pinecone-index');
      process.exit(1);
    }

    console.log(`✅ Pinecone index "${PINECONE_INDEX_NAME}" verified\n`);
  } catch (error) {
    console.error('Error verifying Pinecone index:', error);
    process.exit(1);
  }
}

/**
 * Check environment variables
 */
function checkEnvironment() {
  const requiredVars = ['OPENAI_API_KEY', 'PINECONE_API_KEY'];
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((varName) => console.error(`  - ${varName}`));
    console.log('\nPlease set these in your .env file');
    process.exit(1);
  }

  console.log('✅ Environment variables verified\n');
}

/**
 * Entry point
 */
async function main() {
  try {
    // Verify environment
    checkEnvironment();

    // Verify Pinecone index exists
    await verifyPineconeIndex();

    // Run migration
    await migrateMessages();

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { migrateMessages, processBatch, generateEmbeddings };

