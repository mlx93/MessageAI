#!/usr/bin/env ts-node
/**
 * Create Pinecone Index for MessageAI
 * 
 * This script creates a Pinecone index with the correct configuration
 * for storing message embeddings.
 * 
 * Usage:
 *   npm run create-pinecone-index
 *   or
 *   ts-node scripts/create-pinecone-index.ts
 */

import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const INDEX_NAME = 'messageai-conversations';
const DIMENSION = 3072; // text-embedding-3-large dimension
const METRIC = 'cosine';
const CLOUD = 'aws';
const REGION = 'us-east-1';

async function createIndex() {
  console.log('🚀 Creating Pinecone index...\n');

  // Check for API key
  if (!process.env.PINECONE_API_KEY) {
    console.error('❌ PINECONE_API_KEY not found in environment variables');
    console.log('\nPlease set PINECONE_API_KEY in your .env file');
    process.exit(1);
  }

  try {
    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // Check if index already exists
    console.log(`Checking if index "${INDEX_NAME}" exists...`);
    const indexes = await pinecone.listIndexes();
    const indexExists = indexes.indexes?.some(
      (index) => index.name === INDEX_NAME
    );

    if (indexExists) {
      console.log(`\n⚠️  Index "${INDEX_NAME}" already exists!`);
      console.log('Nothing to do.');
      process.exit(0);
    }

    // Create the index
    console.log(`\nCreating index with configuration:`);
    console.log(`  - Name: ${INDEX_NAME}`);
    console.log(`  - Dimension: ${DIMENSION}`);
    console.log(`  - Metric: ${METRIC}`);
    console.log(`  - Cloud: ${CLOUD}`);
    console.log(`  - Region: ${REGION}\n`);

    await pinecone.createIndex({
      name: INDEX_NAME,
      dimension: DIMENSION,
      metric: METRIC,
      spec: {
        serverless: {
          cloud: CLOUD,
          region: REGION,
        },
      },
    });

    console.log('✅ Index created successfully!');
    console.log('\nNote: It may take a few minutes for the index to be ready.');
    console.log('You can check the status in your Pinecone dashboard.');
    console.log('\nNext steps:');
    console.log('  1. Wait for the index to be ready (check Pinecone dashboard)');
    console.log('  2. Run: npm run embed-messages');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error creating index:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run if called directly
createIndex();

export { createIndex };

