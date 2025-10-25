const { Pinecone } = require('@pinecone-database/pinecone');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

async function listIndexes() {
  console.log('📋 Listing all Pinecone indexes...\n');

  try {
    const indexes = await pinecone.listIndexes();
    
    if (indexes.indexes && indexes.indexes.length > 0) {
      console.log(`Found ${indexes.indexes.length} index(es):\n`);
      
      for (const indexInfo of indexes.indexes) {
        console.log(`Index Name: ${indexInfo.name}`);
        console.log(`  Dimension: ${indexInfo.dimension}`);
        console.log(`  Metric: ${indexInfo.metric}`);
        console.log(`  Host: ${indexInfo.host}`);
        console.log(`  State: ${indexInfo.status?.state}`);
        console.log('');
        
        // Try to get stats for this index
        try {
          const index = pinecone.index(indexInfo.name);
          const stats = await index.describeIndexStats();
          console.log(`  Stats:`);
          console.log(`    Total vectors: ${stats.totalRecordCount || 0}`);
          console.log(`    Dimensions: ${stats.dimension}`);
          console.log('');
        } catch (e) {
          console.log(`  Could not get stats: ${e.message}\n`);
        }
      }
    } else {
      console.log('❌ No indexes found!');
      console.log('You need to create a Pinecone index first.');
    }
    
    console.log('\n📝 Note: Your .env file has:');
    console.log(`PINECONE_INDEX_NAME=${process.env.PINECONE_INDEX_NAME || '(not set)'}`);
    
  } catch (error) {
    console.error('Error listing indexes:', error);
  }
}

listIndexes().then(() => {
  console.log('\n✅ Done');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
