const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
let credential;

if (fs.existsSync(serviceAccountPath)) {
  console.log('✅ Using service account credentials');
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'messageai-mlx93'
  });
} else {
  console.log('⚠️ Using default credentials');
  admin.initializeApp({
    projectId: 'messageai-mlx93'
  });
}

const db = admin.firestore();

async function checkTestMessages() {
  console.log('🔍 Checking for test conversation messages...\n');

  // Search terms from test-conversations.md
  const testKeywords = [
    'PostgreSQL',
    'MongoDB',
    'Redis',
    'production issue',
    'dashboard mockups',
    'Adrian Lorenzo',
    'Hadi Raad',
    'Dan Greenlee',
    'benchmarks',
    'frontend implementation'
  ];

  const allConversations = await db.collection('conversations').get();
  console.log(`Found ${allConversations.size} total conversations\n`);

  let totalMessages = 0;
  let embeddedMessages = 0;
  let testMessages = 0;
  let testEmbeddedMessages = 0;

  for (const convDoc of allConversations.docs) {
    const convId = convDoc.id;
    const messagesSnapshot = await db
      .collection(`conversations/${convId}/messages`)
      .get();

    if (messagesSnapshot.size === 0) continue;

    console.log(`\nConversation: ${convId}`);
    console.log(`  Total messages: ${messagesSnapshot.size}`);

    let convTestMessages = 0;
    let convEmbeddedMessages = 0;

    messagesSnapshot.docs.forEach((msgDoc) => {
      const data = msgDoc.data();
      totalMessages++;

      if (data.embedded === true) {
        embeddedMessages++;
        convEmbeddedMessages++;
      }

      // Check if this is a test message
      const text = (data.text || '').toLowerCase();
      const isTestMessage = testKeywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      );

      if (isTestMessage) {
        testMessages++;
        convTestMessages++;
        if (data.embedded === true) {
          testEmbeddedMessages++;
        }
        console.log(`  📝 Test message found: "${data.text.substring(0, 50)}..." (embedded: ${data.embedded === true})`);
      }
    });

    if (convTestMessages > 0) {
      console.log(`  ✅ Found ${convTestMessages} test messages (${convEmbeddedMessages} total embedded)`);
    }
  }

  console.log('\n========================================');
  console.log('📊 SUMMARY:');
  console.log(`Total messages: ${totalMessages}`);
  console.log(`Embedded messages: ${embeddedMessages} (${Math.round(embeddedMessages/totalMessages*100)}%)`);
  console.log(`Test-related messages: ${testMessages}`);
  console.log(`Test messages embedded: ${testEmbeddedMessages} (${Math.round(testEmbeddedMessages/testMessages*100)}%)`);
  
  if (testEmbeddedMessages < testMessages) {
    console.log('\n⚠️  Some test messages are NOT embedded yet!');
    console.log('Run: cd functions && node scripts/clear-embeddings.js');
    console.log('Then wait 1-2 minutes for the batchEmbedMessages function to run');
  } else if (testMessages === 0) {
    console.log('\n❌ No test messages found! The test conversations may not be created yet.');
  } else {
    console.log('\n✅ All test messages are embedded!');
  }
}

checkTestMessages().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
