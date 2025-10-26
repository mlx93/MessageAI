import admin from 'firebase-admin';
import * as readline from 'readline';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Initialize Firebase Admin
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = resolve(__dirname, '../functions/serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function migrateToPerUserLastMessage() {
  console.log('🔍 Finding conversations to migrate...\n');
  
  const conversationsRef = db.collection('conversations');
  const snapshot = await conversationsRef.get();
  
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  console.log(`📊 Found ${snapshot.size} conversations\n`);
  
  for (const convDoc of snapshot.docs) {
    const data = convDoc.data();
    
    // Skip if already migrated
    if (data.lastMessagePerUser) {
      skippedCount++;
      continue;
    }
    
    try {
      const participants = data.participants || [];
      const lastMessage = data.lastMessage;
      
      // Initialize all participants with current global lastMessage
      const lastMessagePerUser: Record<string, any> = {};
      
      participants.forEach((userId: string) => {
        lastMessagePerUser[userId] = {
          messageId: '', // Unknown for old messages
          text: lastMessage?.text || '',
          senderId: lastMessage?.senderId || '',
          timestamp: lastMessage?.timestamp || admin.firestore.Timestamp.now(),
        };
      });
      
      await convDoc.ref.update({
        lastMessagePerUser,
      });
      
      migratedCount++;
      console.log(`✅ Migrated conversation ${convDoc.id} (${participants.length} participants)`);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to migrate ${convDoc.id}:`, error);
    }
  }
  
  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Migrated: ${migratedCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📈 Total: ${snapshot.size}`);
}

// Confirmation prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('⚠️  This will migrate all conversations to per-user lastMessage. Continue? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    migrateToPerUserLastMessage()
      .then(() => {
        console.log('\n✅ Migration complete!');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
      });
  } else {
    console.log('❌ Migration cancelled');
    process.exit(0);
  }
});

