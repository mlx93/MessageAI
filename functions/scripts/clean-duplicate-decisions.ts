#!/usr/bin/env ts-node

/**
 * Clean Duplicate Decisions
 * 
 * This script finds and removes semantic duplicate decisions from Firestore.
 * It uses the same embedding + cosine similarity logic as the extractDecisions function.
 * 
 * Usage:
 *   cd functions
 *   npx ts-node scripts/clean-duplicate-decisions.ts
 */

import * as admin from 'firebase-admin';
import OpenAI from 'openai';
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
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cosine similarity function
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

// Generate embedding for text
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
  });
  return response.data[0].embedding;
}

interface DecisionData {
  id: string;
  decision: string;
  confidence: number;
  conversationId: string;
  embedding?: number[];
  madeAt: number;
}

async function main() {
  console.log('🔍 Fetching all active decisions...');
  
  // Get all active decisions
  const decisionsSnapshot = await db.collection('decisions')
    .where('status', '==', 'active')
    .get();

  console.log(`📊 Found ${decisionsSnapshot.size} active decisions\n`);

  // Group decisions by conversation
  const decisionsByConversation = new Map<string, DecisionData[]>();
  
  for (const doc of decisionsSnapshot.docs) {
    const data = doc.data();
    const conversationId = data.conversationId;
    
    if (!conversationId) continue;
    
    const decision: DecisionData = {
      id: doc.id,
      decision: data.decision || '',
      confidence: data.confidence || 0,
      conversationId,
      embedding: data.embedding as number[] | undefined,
      madeAt: data.madeAt || 0,
    };
    
    if (!decisionsByConversation.has(conversationId)) {
      decisionsByConversation.set(conversationId, []);
    }
    decisionsByConversation.get(conversationId)!.push(decision);
  }

  console.log(`📂 Decisions grouped into ${decisionsByConversation.size} conversations\n`);

  const SIMILARITY_THRESHOLD = 0.75; // 75% similarity
  const duplicatePairs: Array<{
    keep: DecisionData;
    remove: DecisionData;
    similarity: number;
  }> = [];

  // Process each conversation
  for (const [conversationId, decisions] of decisionsByConversation) {
    if (decisions.length < 2) continue;

    console.log(`\n🔍 Checking conversation ${conversationId.slice(0, 8)}... (${decisions.length} decisions)`);

    // Generate embeddings for decisions that don't have them
    for (const decision of decisions) {
      if (!decision.embedding || decision.embedding.length === 0) {
        console.log(`  📝 Generating embedding for: "${decision.decision.slice(0, 60)}..."`);
        decision.embedding = await generateEmbedding(decision.decision);
      }
    }

    // Compare each pair of decisions
    for (let i = 0; i < decisions.length; i++) {
      for (let j = i + 1; j < decisions.length; j++) {
        const decisionA = decisions[i];
        const decisionB = decisions[j];

        if (!decisionA.embedding || !decisionB.embedding) continue;

        const similarity = cosineSimilarity(decisionA.embedding, decisionB.embedding);

        if (similarity >= SIMILARITY_THRESHOLD) {
          console.log(`  🔗 Found duplicate pair (${(similarity * 100).toFixed(1)}% similar):`);
          console.log(`     A: "${decisionA.decision.slice(0, 60)}..." (${decisionA.confidence.toFixed(2)})`);
          console.log(`     B: "${decisionB.decision.slice(0, 60)}..." (${decisionB.confidence.toFixed(2)})`);

          // Keep the higher confidence version (or first one if equal)
          const keep = decisionA.confidence >= decisionB.confidence ? decisionA : decisionB;
          const remove = decisionA.confidence >= decisionB.confidence ? decisionB : decisionA;

          duplicatePairs.push({keep, remove, similarity});
          console.log(`     ✅ Keeping: "${keep.decision.slice(0, 60)}..."`);
          console.log(`     ❌ Removing: "${remove.decision.slice(0, 60)}..."`);
        }
      }
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   Total decisions: ${decisionsSnapshot.size}`);
  console.log(`   Duplicates found: ${duplicatePairs.length}`);
  console.log(`   Decisions after cleanup: ${decisionsSnapshot.size - duplicatePairs.length}`);

  if (duplicatePairs.length === 0) {
    console.log('\n✅ No duplicates found! Decisions are clean.');
    return;
  }

  // Prompt for confirmation
  console.log(`\n⚠️  This will delete ${duplicatePairs.length} duplicate decision(s).`);
  console.log('   Press Ctrl+C to cancel or press Enter to continue...');
  
  // Wait for user input
  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });

  // Delete duplicates
  console.log('\n🗑️  Deleting duplicates...');
  const batch = db.batch();

  for (const {remove, similarity} of duplicatePairs) {
    console.log(`   Deleting: "${remove.decision.slice(0, 60)}..." (${(similarity * 100).toFixed(1)}% similar to kept decision)`);
    batch.delete(db.collection('decisions').doc(remove.id));
  }

  await batch.commit();

  console.log(`\n✅ Successfully deleted ${duplicatePairs.length} duplicate decision(s)!`);
  console.log('\n📌 Tip: Re-run "Extract Decisions" in the app to use the new semantic deduplication logic.');
}

main()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

