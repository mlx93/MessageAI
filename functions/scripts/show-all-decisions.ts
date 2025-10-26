#!/usr/bin/env ts-node

/**
 * Show All Decisions - Active and Deleted
 * 
 * This script fetches all decisions from Firestore to help analyze
 * what's being filtered out and why.
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function main() {
  console.log('📊 Fetching ALL decisions from Firestore...\n');
  
  // Get all decisions (no status filter)
  const allDecisionsSnapshot = await db.collection('decisions').get();

  if (allDecisionsSnapshot.empty) {
    console.log('No decisions found in Firestore.');
    return;
  }

  const decisions = allDecisionsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as any[];

  // Group by status
  const byStatus: Record<string, any[]> = {
    active: [],
    deleted: [],
    other: [],
  };

  decisions.forEach(decision => {
    const status = decision.status || 'other';
    if (byStatus[status]) {
      byStatus[status].push(decision);
    } else {
      byStatus.other.push(decision);
    }
  });

  console.log(`📈 Total decisions: ${decisions.length}\n`);
  console.log(`✅ Active: ${byStatus.active.length}`);
  console.log(`❌ Deleted: ${byStatus.deleted.length}`);
  console.log(`❓ Other: ${byStatus.other.length}\n`);

  // Show active decisions
  if (byStatus.active.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ACTIVE DECISIONS (Currently Visible)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    byStatus.active.forEach((decision, i) => {
      console.log(`${i + 1}. "${decision.decision}"`);
      console.log(`   Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
      console.log(`   Decision Maker: ${decision.decisionMaker || 'Unknown'}`);
      console.log(`   Participants: ${decision.participants?.join(', ') || 'None'}`);
      console.log(`   Conversation: ${decision.conversationId?.slice(0, 8)}...`);
      console.log(`   Made At: ${decision.madeAt ? new Date(decision.madeAt).toLocaleDateString() : 'Unknown'}`);
      console.log('');
    });
  }

  // Show deleted decisions
  if (byStatus.deleted.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ DELETED DECISIONS (User Removed)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    byStatus.deleted.forEach((decision, i) => {
      console.log(`${i + 1}. "${decision.decision}"`);
      console.log(`   Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
      console.log(`   Decision Maker: ${decision.decisionMaker || 'Unknown'}`);
      console.log(`   Participants: ${decision.participants?.join(', ') || 'None'}`);
      console.log(`   Conversation: ${decision.conversationId?.slice(0, 8)}...`);
      console.log(`   Deleted At: ${decision.deletedAt ? new Date(decision.deletedAt.toDate()).toLocaleString() : 'Unknown'}`);
      console.log('');
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .then(() => {
    console.log('✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

