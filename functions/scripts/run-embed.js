#!/usr/bin/env node

/**
 * Wrapper script to run the embedding process
 * Uses Firebase Functions environment for authentication
 */

const admin = require('firebase-admin');
const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from parent directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configuration
const BATCH_SIZE = 100;
const PINECONE_INDEX_NAME = 'messageai-conversations';
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large';

// Initialize Firebase Admin (using service account if available)
try {
  const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
  const fs = require('fs');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'messageai-mlx93'
    });
    console.log('✅ Using service account credentials');
  } else {
    admin.initializeApp({
      projectId: 'messageai-mlx93'
    });
    console.log('⚠️ Using default credentials');
  }
} catch (error) {
  console.error('Error initializing Firebase:', error);
  admin.initializeApp({
    projectId: 'messageai-mlx93'
  });
}

const db = admin.firestore();

// Initialize OpenAI
const openai = new OpenAI.OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

async function generateEmbeddings(texts) {
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

async function upsertToPinecone(vectors) {
  const index = pinecone.index(PINECONE_INDEX_NAME);
  
  try {
    await index.upsert(vectors);
    console.log(`✅ Upserted ${vectors.length} vectors to Pinecone`);
  } catch (error) {
    console.error('Error upserting to Pinecone:', error);
    throw error;
  }
}

async function processBatch(messages, participants) {
  if (messages.length === 0) return;

  console.log(`Processing batch of ${messages.length} messages...`);

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
    // Generate embeddings
    console.log('Generating embeddings...');
    const texts = validMessages.map((msg) => msg.text);
    const embeddings = await generateEmbeddings(texts);

    // Prepare vectors for Pinecone
    const vectors = validMessages.map((msg, index) => ({
      id: msg.id,
      values: embeddings[index],
      metadata: {
        conversationId: msg.conversationId,
        senderId: msg.senderId,
        userId: msg.senderId,
        participants: participants || [],
        timestamp: msg.timestamp?.toMillis ? msg.timestamp.toMillis() : Date.now(),
        text: msg.text.substring(0, 500),
        type: msg.type,
      },
    }));

    // Upsert to Pinecone
    await upsertToPinecone(vectors);

    // Mark as embedded in Firestore
    const batch = db.batch();
    validMessages.forEach(({id, conversationId}) => {
      const docRef = db.collection('conversations').doc(conversationId)
        .collection('messages').doc(id);
      batch.update(docRef, {
        embedded: true,
        embeddedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    
    await batch.commit();
    console.log(`✅ Marked ${validMessages.length} messages as embedded`);
    
  } catch (error) {
    console.error('Error processing batch:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting message embedding migration...\n');
  console.log(`Configuration:`);
  console.log(`  - Batch Size: ${BATCH_SIZE}`);
  console.log(`  - Embedding Model: ${OPENAI_EMBEDDING_MODEL}`);
  console.log(`  - Pinecone Index: ${PINECONE_INDEX_NAME}\n`);

  let totalProcessed = 0;

  try {
    // Get all conversations
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
      const allMessages = [];
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
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Check environment
if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!process.env.OPENAI_API_KEY) console.error('  - OPENAI_API_KEY');
  if (!process.env.PINECONE_API_KEY) console.error('  - PINECONE_API_KEY');
  console.log('\nPlease ensure .env file exists with these keys');
  process.exit(1);
}

// Verify Pinecone index exists
(async () => {
  try {
    const indexes = await pinecone.listIndexes();
    const indexExists = indexes.indexes?.some(
      (index) => index.name === PINECONE_INDEX_NAME
    );

    if (!indexExists) {
      console.error(`❌ Pinecone index "${PINECONE_INDEX_NAME}" not found!`);
      console.log('Please create the index first');
      process.exit(1);
    }

    console.log(`✅ Pinecone index "${PINECONE_INDEX_NAME}" verified\n`);
    
    // Run main migration
    main();
  } catch (error) {
    console.error('Error verifying Pinecone:', error);
    process.exit(1);
  }
})();
