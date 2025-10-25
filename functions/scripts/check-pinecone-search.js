const admin = require('firebase-admin');
const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
if (fs.existsSync(serviceAccountPath)) {
  console.log('✅ Using service account credentials');
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'messageai-mlx93'
  });
} else {
  admin.initializeApp({
    projectId: 'messageai-mlx93'
  });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

async function testSemanticSearch() {
  console.log('🔍 Testing semantic search in Pinecone...\n');

  const index = pinecone.index('messageai-rag');
  
  // Test query
  const query = "What was the production issue?";
  console.log(`Query: "${query}"\n`);

  // Generate embedding for the query
  console.log('Generating embedding...');
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
  });
  const embedding = response.data[0].embedding;
  console.log('✅ Embedding generated\n');

  // Search Pinecone WITHOUT filters first
  console.log('Searching Pinecone (no filters)...');
  const searchResults = await index.query({
    vector: embedding,
    topK: 5,
    includeMetadata: true,
  });

  console.log(`Found ${searchResults.matches.length} matches:\n`);
  searchResults.matches.forEach((match, i) => {
    console.log(`Match ${i + 1}:`);
    console.log(`  Score: ${match.score}`);
    console.log(`  Text: "${match.metadata?.text?.substring(0, 100)}..."`);
    console.log(`  Participants: ${JSON.stringify(match.metadata?.participants)}`);
    console.log(`  UserId: ${match.metadata?.userId}`);
    console.log(`  SenderId: ${match.metadata?.senderId}`);
    console.log('');
  });

  // Now search WITH participant filter
  console.log('\n-------------------------------------------');
  console.log('Searching with participant filter (your userId)...');
  
  // Get a sample userId from the messages
  const db = admin.firestore();
  const userSnapshot = await db.collection('users').limit(1).get();
  const userId = userSnapshot.docs[0]?.id || 'test-user-id';
  console.log(`Using userId: ${userId}\n`);

  const filteredResults = await index.query({
    vector: embedding,
    topK: 5,
    includeMetadata: true,
    filter: {
      participants: { $in: [userId] }
    }
  });

  console.log(`Found ${filteredResults.matches.length} matches with filter:\n`);
  filteredResults.matches.forEach((match, i) => {
    console.log(`Match ${i + 1}:`);
    console.log(`  Score: ${match.score}`);
    console.log(`  Text: "${match.metadata?.text?.substring(0, 100)}..."`);
    console.log(`  Participants: ${JSON.stringify(match.metadata?.participants)}`);
    console.log('');
  });

  if (searchResults.matches.length > 0 && filteredResults.matches.length === 0) {
    console.log('\n⚠️  ISSUE FOUND: Messages exist in Pinecone but are filtered out!');
    console.log('The participants array may not include the correct user IDs.');
    console.log('You may need to re-embed messages with correct participant metadata.');
  } else if (searchResults.matches.length === 0) {
    console.log('\n⚠️  ISSUE FOUND: No matches in Pinecone at all!');
    console.log('The messages may not be embedded properly.');
  } else {
    console.log('\n✅ Search is working correctly!');
  }
}

testSemanticSearch().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
