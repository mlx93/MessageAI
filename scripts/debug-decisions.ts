/**
 * Debug script to investigate why decisions aren't being extracted
 */

import * as admin from 'firebase-admin';
import * as serviceAccount from '../functions/serviceAccountKey.json';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  projectId: 'messageai-mlx93',
});

const db = admin.firestore();

async function debugDecisions() {
  console.log('🔍 Debugging Decision Extraction Issues\n');

  // 1. Check existing decisions
  console.log('📊 Checking existing decisions...');
  const decisionsSnapshot = await db.collection('decisions')
    .where('status', '==', 'active')
    .get();
  
  console.log(`Found ${decisionsSnapshot.docs.length} active decisions\n`);
  
  if (decisionsSnapshot.docs.length > 0) {
    console.log('Sample decision:');
    const sample = decisionsSnapshot.docs[0].data();
    console.log(JSON.stringify(sample, null, 2));
    console.log('\n');
  }

  // 2. Check a specific conversation that failed
  const convId = 'Glr9E7WqcIDrkDMqm8jx_SxP1hf1Hd8N8Mpe5jmsm';
  console.log(`🔍 Checking conversation: ${convId}\n`);
  
  const convDoc = await db.collection('conversations').doc(convId).get();
  if (!convDoc.exists) {
    console.log('❌ Conversation not found!');
    return;
  }
  
  const convData = convDoc.data();
  console.log('Conversation data:');
  console.log(`- Participants: ${convData?.participants?.length || 0}`);
  console.log(`- Has participantDetails: ${!!convData?.participantDetails}`);
  console.log(`- Has participantProfiles: ${!!convData?.participantProfiles}`);
  
  if (convData?.participantDetails) {
    console.log('participantDetails:');
    console.log(JSON.stringify(convData.participantDetails, null, 2));
  }
  
  // 3. Check messages in the conversation
  console.log('\n📝 Checking messages...');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const messagesQuery = db
    .collection(`conversations/${convId}/messages`)
    .orderBy('timestamp', 'desc')
    .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
    .limit(10);
  
  const messagesSnapshot = await messagesQuery.get();
  console.log(`Found ${messagesSnapshot.docs.length} messages in last 7 days`);
  
  if (messagesSnapshot.docs.length > 0) {
    console.log('\nSample messages:');
    messagesSnapshot.docs.slice(0, 3).forEach((doc, i) => {
      const msg = doc.data();
      console.log(`\n[${i + 1}] Full message data:`);
      console.log(JSON.stringify(msg, null, 2));
    });
  } else {
    // Try without date filter
    console.log('\n🔍 Trying without date filter...');
    const allMessagesSnapshot = await db
      .collection(`conversations/${convId}/messages`)
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    console.log(`Found ${allMessagesSnapshot.docs.length} total messages`);
    if (allMessagesSnapshot.docs.length > 0) {
      const latestMsg = allMessagesSnapshot.docs[0].data();
      const latestDate = latestMsg.timestamp?.toDate?.() || new Date(latestMsg.timestamp);
      console.log(`Latest message date: ${latestDate}`);
      console.log(`Days ago: ${Math.floor((Date.now() - latestDate.getTime()) / (24 * 60 * 60 * 1000))}`);
    }
  }
}

debugDecisions()
  .then(() => {
    console.log('\n✅ Debug complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });

