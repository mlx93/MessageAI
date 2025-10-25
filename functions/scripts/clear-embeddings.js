#!/usr/bin/env node

/**
 * Script to clear all embedded flags to force re-embedding with new metadata
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
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
  process.exit(1);
}

const db = admin.firestore();

async function clearEmbeddedFlags() {
  console.log('🔄 Clearing embedded flags to force re-embedding...\n');
  
  let totalCleared = 0;

  try {
    // Get all conversations
    const conversationsSnapshot = await db.collection('conversations').get();
    console.log(`Found ${conversationsSnapshot.size} conversations\n`);

    // Process each conversation
    for (const convDoc of conversationsSnapshot.docs) {
      const conversationId = convDoc.id;
      console.log(`Processing conversation: ${conversationId}`);

      // Get all messages that are embedded
      const messagesSnapshot = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .where('embedded', '==', true)
        .get();

      console.log(`  Found ${messagesSnapshot.size} embedded messages`);

      if (messagesSnapshot.size > 0) {
        // Clear embedded flag in batches
        const batch = db.batch();
        messagesSnapshot.docs.forEach(msgDoc => {
          batch.update(msgDoc.ref, {
            embedded: false
          });
        });
        
        await batch.commit();
        totalCleared += messagesSnapshot.size;
        console.log(`  ✅ Cleared ${messagesSnapshot.size} embedded flags`);
      }
    }

    console.log(`\n🎉 Complete! Cleared ${totalCleared} embedded flags`);
    console.log('Messages will be re-embedded with participant metadata on next run');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  }
}

clearEmbeddedFlags();
