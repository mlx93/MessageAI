#!/usr/bin/env ts-node
/**
 * Force Re-embed All Messages
 * 
 * Marks all messages as embedded:false so the scheduled batchEmbedMessages
 * function will re-process them with new metadata (deletedBy, conversationName, etc.)
 * 
 * Usage: npm run force-reembed
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
if (getApps().length === 0) {
  const serviceAccountPath = join(__dirname, '../functions/serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
  initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || 'messageai-mlx93',
  });
}

const db = getFirestore();

async function forceReembedAll() {
  console.log('🔄 Starting re-embed migration...\n');
  
  try {
    // Get all conversations
    const conversationsSnapshot = await db.collection('conversations').get();
    console.log(`📂 Found ${conversationsSnapshot.size} conversations\n`);
    
    let totalMessages = 0;
    let updatedMessages = 0;
    
    // Process each conversation
    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;
      const convData = convDoc.data();
      const conversationName = convData.isGroup 
        ? (convData.groupName || 'Group Chat')
        : 'Direct Message';
      
      console.log(`📍 Processing: ${conversationName} (${conversationId})`);
      
      // Get all messages in this conversation that are currently embedded
      const messagesSnapshot = await db
        .collection(`conversations/${conversationId}/messages`)
        .where('embedded', '==', true)
        .get();
      
      totalMessages += messagesSnapshot.size;
      
      if (messagesSnapshot.empty) {
        console.log(`   ⏭️  No embedded messages found\n`);
        continue;
      }
      
      console.log(`   📝 Found ${messagesSnapshot.size} embedded messages`);
      
      // Batch update messages to mark as not embedded
      const batchSize = 500; // Firestore batch limit
      let batch = db.batch();
      let batchCount = 0;
      
      for (const msgDoc of messagesSnapshot.docs) {
        batch.update(msgDoc.ref, {
          embedded: false,
          embeddedAt: FieldValue.delete()
        });
        
        batchCount++;
        updatedMessages++;
        
        // Commit batch if we hit the limit
        if (batchCount >= batchSize) {
          await batch.commit();
          console.log(`   ✅ Updated ${batchCount} messages`);
          batch = db.batch();
          batchCount = 0;
        }
      }
      
      // Commit remaining messages in batch
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   ✅ Updated ${batchCount} messages`);
      }
      
      console.log(`   ✅ Total updated: ${messagesSnapshot.size}\n`);
    }
    
    console.log('\n🎉 Migration complete!');
    console.log(`📊 Statistics:`);
    console.log(`   - Total conversations: ${conversationsSnapshot.size}`);
    console.log(`   - Total messages found: ${totalMessages}`);
    console.log(`   - Messages marked for re-embedding: ${updatedMessages}`);
    console.log('\n⏱️  Re-embedding will happen automatically via scheduled function');
    console.log(`   - Runs every 1 minute`);
    console.log(`   - Processes 100 messages per run`);
    console.log(`   - Estimated time: ${Math.ceil(updatedMessages / 100)} minutes`);
    console.log('\n📍 Monitor progress with: firebase functions:log --follow\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
forceReembedAll()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
