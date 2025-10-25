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

async function checkConversationParticipants() {
  console.log('🔍 Checking conversation participants...\n');

  const conversations = await db.collection('conversations').get();
  
  let totalConversations = 0;
  let withParticipants = 0;
  let emptyParticipants = 0;
  let noParticipants = 0;

  conversations.docs.forEach((convDoc) => {
    const data = convDoc.data();
    totalConversations++;
    
    if (!data.participants) {
      noParticipants++;
      console.log(`❌ No participants field: ${convDoc.id}`);
    } else if (data.participants.length === 0) {
      emptyParticipants++;
      console.log(`⚠️ Empty participants array: ${convDoc.id}`);
    } else {
      withParticipants++;
      if (withParticipants <= 5) {
        console.log(`✅ Conversation ${convDoc.id} has participants: ${JSON.stringify(data.participants)}`);
      }
    }
  });

  console.log('\n📊 SUMMARY:');
  console.log(`Total conversations: ${totalConversations}`);
  console.log(`With participants: ${withParticipants}`);
  console.log(`Empty participants array: ${emptyParticipants}`);
  console.log(`No participants field: ${noParticipants}`);
  
  if (emptyParticipants > 0 || noParticipants > 0) {
    console.log('\n⚠️ ISSUE: Some conversations have no participants!');
    console.log('Messages from these conversations will have empty participant metadata.');
  }
}

checkConversationParticipants().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
