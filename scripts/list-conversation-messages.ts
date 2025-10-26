/**
 * List All Messages in Conversation
 * 
 * Shows all messages currently in Firestore for a conversation
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccountPath = resolve(__dirname, '../functions/serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function listMessages(conversationId: string) {
  console.log(`\n📨 Messages in conversation: ${conversationId}\n`);
  
  const messagesSnapshot = await db
    .collection(`conversations/${conversationId}/messages`)
    .orderBy('timestamp', 'asc')
    .get();
  
  console.log(`Total messages: ${messagesSnapshot.size}\n`);
  
  if (messagesSnapshot.empty) {
    console.log('✅ No messages found - conversation is empty!');
    return;
  }
  
  messagesSnapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`${index + 1}. ID: ${doc.id}`);
    console.log(`   Text: "${data.text?.substring(0, 80)}"`);
    console.log(`   Sender: ${data.senderId}`);
    console.log(`   Timestamp: ${data.timestamp?.toDate?.()?.toISOString()}`);
    console.log(`   DeletedBy: ${JSON.stringify(data.deletedBy || [])}`);
    console.log('');
  });
}

const conversationId = process.argv[2] || 'Glr9E7WqcIDrkDMqm8jx_SxP1hf1Hd8N8Mpe5jmsm';
listMessages(conversationId).then(() => process.exit(0));


