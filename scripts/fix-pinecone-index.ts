import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: 'pcsk_4WqACW_U1hep2rXRFfCEJFkUABiuTsc3QdP3bDSjqGVPmqYakP9d4GBMRJWxzp6S7cnLUC'
});

async function recreateIndex() {
  try {
    console.log('🔍 Checking existing index...');
    
    // Check if index exists
    try {
      const existingIndex = pinecone.index('messageai-conversations');
      const stats = await existingIndex.describeIndexStats();
      console.log('📊 Current index stats:', stats);
      
      // Delete existing index
      console.log('🗑️ Deleting existing index...');
      await pinecone.deleteIndex('messageai-conversations');
      console.log('✅ Index deleted');
      
      // Wait for deletion to complete
      console.log('⏳ Waiting for deletion to complete...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    } catch (error) {
      console.log('ℹ️ No existing index found or already deleted');
    }
    
    // Create new index with correct dimensions
    console.log('🆕 Creating new index with 3072 dimensions...');
    await pinecone.createIndex({
      name: 'messageai-conversations',
      dimension: 3072,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
    
    console.log('✅ New index created with 3072 dimensions');
    console.log('🎉 Pinecone index is now ready for embeddings!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

recreateIndex();
