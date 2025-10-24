#!/usr/bin/env ts-node
/**
 * Create Firestore Indexes Configuration File
 * 
 * This script generates a proper firestore.indexes.json file
 * with all required indexes for AI features.
 * 
 * Usage:
 *   npm run create-indexes-file
 *   or
 *   ts-node scripts/create-indexes-file.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const INDEXES_CONFIG = {
  indexes: [
    // Action Items Collection
    {
      collectionGroup: "action_items",
      queryScope: "COLLECTION_GROUP",
      fields: [
        { fieldPath: "conversationId", order: "ASCENDING" },
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "action_items", 
      queryScope: "COLLECTION_GROUP",
      fields: [
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "DESCENDING" }
      ]
    },
    
    // Decisions Collection
    {
      collectionGroup: "decisions",
      queryScope: "COLLECTION_GROUP", 
      fields: [
        { fieldPath: "conversationId", order: "ASCENDING" },
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "madeAt", order: "DESCENDING" }
      ]
    },
    {
      collectionGroup: "decisions",
      queryScope: "COLLECTION_GROUP",
      fields: [
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "madeAt", order: "DESCENDING" }
      ]
    },
    
    // Proactive Suggestions Collection
    {
      collectionGroup: "proactive_suggestions",
      queryScope: "COLLECTION_GROUP",
      fields: [
        { fieldPath: "conversationId", order: "ASCENDING" },
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "DESCENDING" }
      ]
    },
    
    // AI Cache Collection
    {
      collectionGroup: "ai_cache",
      queryScope: "COLLECTION_GROUP",
      fields: [
        { fieldPath: "expiresAt", order: "ASCENDING" }
      ]
    },
    {
      collectionGroup: "ai_cache",
      queryScope: "COLLECTION_GROUP", 
      fields: [
        { fieldPath: "cacheType", order: "ASCENDING" },
        { fieldPath: "expiresAt", order: "ASCENDING" }
      ]
    },
    
    // Messages Collection (for RAG search)
    {
      collectionGroup: "messages",
      queryScope: "COLLECTION_GROUP",
      fields: [
        { fieldPath: "embedded", order: "ASCENDING" },
        { fieldPath: "timestamp", order: "ASCENDING" }
      ]
    },
    {
      collectionGroup: "messages",
      queryScope: "COLLECTION_GROUP",
      fields: [
        { fieldPath: "conversationId", order: "ASCENDING" },
        { fieldPath: "timestamp", order: "ASCENDING" }
      ]
    }
  ],
  fieldOverrides: []
};

function main() {
  console.log('📝 Creating firestore.indexes.json...\n');
  
  const indexPath = path.join(process.cwd(), 'firestore.indexes.json');
  const content = JSON.stringify(INDEXES_CONFIG, null, 2);
  
  fs.writeFileSync(indexPath, content);
  
  console.log('✅ Created firestore.indexes.json with the following indexes:');
  console.log('');
  
  INDEXES_CONFIG.indexes.forEach((index, i) => {
    const fields = index.fields.map(f => 
      `${f.fieldPath}(${f.order})`
    ).join(', ');
    console.log(`  ${i + 1}. ${index.collectionGroup}: ${fields}`);
  });
  
  console.log(`\n📊 Total indexes: ${INDEXES_CONFIG.indexes.length}`);
  console.log(`📁 File location: ${indexPath}`);
  
  console.log('\n🚀 Next steps:');
  console.log('  1. Run: firebase deploy --only firestore:indexes');
  console.log('  2. Check Firebase Console for build status');
  console.log('  3. Wait for indexes to finish building');
  
  console.log('\n🔗 Firebase Console:');
  console.log('  https://console.firebase.google.com/project/messageai-mlx93/firestore/indexes');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { INDEXES_CONFIG };
