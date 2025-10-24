#!/usr/bin/env ts-node
/**
 * Fix Firestore Index Field Names
 * 
 * This script addresses the field name mismatch between:
 * - Code: conversationId (lowercase d)
 * - Indexes: conversationID (uppercase D)
 * 
 * Usage:
 *   npm run fix-index-names
 *   or
 *   ts-node scripts/fix-index-field-names.ts
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const CORRECTED_INDEXES = {
  indexes: [
    // Action Items Collection - CORRECTED field names
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
    
    // Decisions Collection - CORRECTED field names
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
    
    // Proactive Suggestions Collection - CORRECTED field names
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
        { fieldPath: "cacheType", order: "ASCENDING" },
        { fieldPath: "expiresAt", order: "ASCENDING" }
      ]
    },
    {
      collectionGroup: "ai_cache",
      queryScope: "COLLECTION_GROUP",
      fields: [
        { fieldPath: "expiresAt", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "ASCENDING" }
      ]
    },
    
    // Messages Collection - CORRECTED field names
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
  console.log('🔧 Fixing Firestore Index Field Names');
  console.log('=====================================\n');
  
  console.log('📋 Issues identified:');
  console.log('  ❌ Indexes use: conversationID (uppercase D)');
  console.log('  ✅ Code uses: conversationId (lowercase d)');
  console.log('  ❌ This mismatch causes failed-precondition errors\n');
  
  // Write corrected indexes file
  console.log('📝 Writing corrected firestore.indexes.json...');
  const indexPath = path.join(process.cwd(), 'firestore.indexes.json');
  const content = JSON.stringify(CORRECTED_INDEXES, null, 2);
  fs.writeFileSync(indexPath, content);
  console.log(`✅ Written to: ${indexPath}\n`);
  
  // Deploy corrected indexes
  console.log('🚀 Deploying corrected indexes...');
  try {
    execSync('firebase deploy --only firestore:indexes', { 
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: 'inherit'
    });
    console.log('\n✅ Corrected indexes deployed successfully!');
  } catch (error) {
    console.error('\n❌ Failed to deploy corrected indexes:', error);
    process.exit(1);
  }
  
  console.log('\n🎯 Next steps:');
  console.log('  1. Wait 2-3 minutes for indexes to build');
  console.log('  2. Test the app - conversation errors should be resolved');
  console.log('  3. Check Firebase Console for build status');
  
  console.log('\n🔗 Firebase Console:');
  console.log('  https://console.firebase.google.com/project/messageai-mlx93/firestore/indexes');
  
  console.log('\n📊 Expected result:');
  console.log('  - All indexes should use conversationId (lowercase d)');
  console.log('  - No more failed-precondition errors');
  console.log('  - AI features should work properly');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CORRECTED_INDEXES };
