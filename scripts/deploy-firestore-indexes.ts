#!/usr/bin/env ts-node
/**
 * Deploy Firestore Indexes for AI Features
 * 
 * This script creates and deploys all required Firestore indexes for:
 * - Action items (AI-generated tasks)
 * - Decisions (AI-extracted decisions)
 * - Proactive suggestions (AI recommendations)
 * - AI cache (performance optimization)
 * - Messages (RAG search support)
 * 
 * Usage:
 *   npm run deploy-indexes
 *   or
 *   ts-node scripts/deploy-firestore-indexes.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface FirestoreIndex {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: Array<{
    fieldPath: string;
    order?: 'ASCENDING' | 'DESCENDING';
    arrayConfig?: 'CONTAINS';
  }>;
}

const REQUIRED_INDEXES: FirestoreIndex[] = [
  // Action Items Collection
  {
    collectionGroup: 'action_items',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'conversationId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'action_items',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  },
  
  // Decisions Collection
  {
    collectionGroup: 'decisions',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'conversationId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'madeAt', order: 'DESCENDING' }
    ]
  },
  {
    collectionGroup: 'decisions',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'madeAt', order: 'DESCENDING' }
    ]
  },
  
  // Proactive Suggestions Collection
  {
    collectionGroup: 'proactive_suggestions',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'conversationId', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'createdAt', order: 'DESCENDING' }
    ]
  },
  
  // AI Cache Collection
  {
    collectionGroup: 'ai_cache',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'expiresAt', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'ai_cache',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'cacheType', order: 'ASCENDING' },
      { fieldPath: 'expiresAt', order: 'ASCENDING' }
    ]
  },
  
  // Messages Collection (for RAG search)
  {
    collectionGroup: 'messages',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'embedded', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'ASCENDING' }
    ]
  },
  {
    collectionGroup: 'messages',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: 'conversationId', order: 'ASCENDING' },
      { fieldPath: 'timestamp', order: 'ASCENDING' }
    ]
  }
];

/**
 * Generate firestore.indexes.json content
 */
function generateIndexesFile(): string {
  const indexesContent = {
    indexes: REQUIRED_INDEXES,
    fieldOverrides: []
  };
  
  return JSON.stringify(indexesContent, null, 2);
}

/**
 * Deploy indexes using Firebase CLI
 */
function deployIndexes(): void {
  console.log('🚀 Deploying Firestore indexes...\n');
  
  try {
    // Deploy indexes
    const deployCommand = 'firebase deploy --only firestore:indexes';
    console.log(`Running: ${deployCommand}`);
    
    const output = execSync(deployCommand, { 
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    
    console.log('\n✅ Firestore indexes deployed successfully!');
    
  } catch (error) {
    console.error('\n❌ Failed to deploy indexes:', error);
    process.exit(1);
  }
}

/**
 * Verify indexes are deployed
 */
function verifyIndexes(): void {
  console.log('\n🔍 Verifying deployed indexes...\n');
  
  try {
    const output = execSync('firebase firestore:indexes', { 
      encoding: 'utf8',
      cwd: process.cwd()
    });
    
    const indexes = JSON.parse(output);
    const deployedCount = indexes.indexes?.length || 0;
    
    console.log(`📊 Found ${deployedCount} deployed indexes`);
    
    // Check for required collections
    const requiredCollections = [
      'action_items', 'decisions', 'proactive_suggestions', 
      'ai_cache', 'messages'
    ];
    
    const deployedCollections = new Set(
      indexes.indexes?.map((idx: any) => idx.collectionGroup) || []
    );
    
    console.log('\n📋 Collection coverage:');
    requiredCollections.forEach(collection => {
      const hasIndex = deployedCollections.has(collection);
      console.log(`  ${hasIndex ? '✅' : '❌'} ${collection}`);
    });
    
    const missingCollections = requiredCollections.filter(
      col => !deployedCollections.has(col)
    );
    
    if (missingCollections.length > 0) {
      console.log(`\n⚠️  Missing indexes for: ${missingCollections.join(', ')}`);
      console.log('   Some AI features may not work properly.');
    } else {
      console.log('\n🎉 All required indexes are deployed!');
    }
    
  } catch (error) {
    console.error('❌ Failed to verify indexes:', error);
  }
}

/**
 * Main deployment function
 */
async function main() {
  console.log('🔥 Firestore Index Deployment Script');
  console.log('=====================================\n');
  
  console.log('📋 Required indexes:');
  REQUIRED_INDEXES.forEach((index, i) => {
    const fields = index.fields.map(f => 
      `${f.fieldPath}(${f.order || f.arrayConfig})`
    ).join(', ');
    console.log(`  ${i + 1}. ${index.collectionGroup}: ${fields}`);
  });
  
  console.log(`\n📊 Total indexes to deploy: ${REQUIRED_INDEXES.length}\n`);
  
  // Generate and write firestore.indexes.json
  console.log('📝 Generating firestore.indexes.json...');
  const indexesContent = generateIndexesFile();
  const indexPath = path.join(process.cwd(), 'firestore.indexes.json');
  
  fs.writeFileSync(indexPath, indexesContent);
  console.log(`✅ Written to: ${indexPath}\n`);
  
  // Deploy indexes
  deployIndexes();
  
  // Verify deployment
  verifyIndexes();
  
  console.log('\n🎯 Next steps:');
  console.log('  1. Test AI features in the app');
  console.log('  2. Check Firebase Console for index build status');
  console.log('  3. Monitor query performance');
  
  console.log('\n📚 Documentation:');
  console.log('  - Firebase Console: https://console.firebase.google.com/project/messageai-mlx93/firestore/indexes');
  console.log('  - Index build status: Check the "Building" tab in Firebase Console');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { REQUIRED_INDEXES, generateIndexesFile, deployIndexes, verifyIndexes };
