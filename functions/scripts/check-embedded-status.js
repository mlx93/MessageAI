const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
  console.log('✅ Using service account credentials');
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'messageai-mlx93'
  });
} else {
  admin.initializeApp({
    projectId: 'messageai-mlx93'
  });
}

const db = admin.firestore();

async function checkEmbeddedStatus() {
  console.log('🔍 Checking embedded status of messages...\n');

  const conversations = await db.collection('conversations').get();
  
  let totalMessages = 0;
  let embeddedTrue = 0;
  let embeddedFalse = 0;
  let embeddedUndefined = 0;

  for (const convDoc of conversations.docs) {
    const messagesSnapshot = await db
      .collection(`conversations/${convDoc.id}/messages`)
      .get();

    messagesSnapshot.docs.forEach((msgDoc) => {
      const data = msgDoc.data();
      totalMessages++;
      
      if (data.embedded === true) {
        embeddedTrue++;
      } else if (data.embedded === false) {
        embeddedFalse++;
      } else if (data.embedded === undefined || !('embedded' in data)) {
        embeddedUndefined++;
        if (embeddedUndefined <= 5) {
          console.log(`Message without embedded field: ${msgDoc.id} in ${convDoc.id}`);
        }
      }
    });
  }

  console.log('\n📊 SUMMARY:');
  console.log(`Total messages: ${totalMessages}`);
  console.log(`Embedded = true: ${embeddedTrue}`);
  console.log(`Embedded = false: ${embeddedFalse}`);
  console.log(`Embedded = undefined/missing: ${embeddedUndefined}`);
  
  if (embeddedFalse > 0) {
    console.log(`\n⏳ ${embeddedFalse} messages waiting to be embedded`);
  }
  
  if (embeddedUndefined > 0) {
    console.log(`\n⚠️ ${embeddedUndefined} messages don't have the embedded field!`);
    console.log('These messages will NEVER be embedded by batchEmbedMessages.');
    console.log('You need to add the embedded: false field to these messages.');
  }
}

checkEmbeddedStatus().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
