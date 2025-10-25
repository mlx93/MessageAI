const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

async function checkParticipants() {
  console.log('🔍 Checking participant metadata in Pinecone...\n');

  const index = pinecone.index('messageai-conversations');
  
  // Test query about production issue
  const query = "production issue Redis errors";
  console.log(`Query: "${query}"\n`);

  // Generate embedding for the query
  console.log('Generating embedding...');
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
  });
  const embedding = response.data[0].embedding;
  console.log('✅ Embedding generated\n');

  // Search without filters
  console.log('Searching Pinecone (no filters)...');
  const searchResults = await index.query({
    vector: embedding,
    topK: 10,
    includeMetadata: true,
  });

  console.log(`Found ${searchResults.matches.length} matches:\n`);
  
  // Group by participant arrays
  const participantGroups = {};
  
  searchResults.matches.forEach((match, i) => {
    const participants = match.metadata?.participants || [];
    const key = JSON.stringify(participants.sort());
    
    if (!participantGroups[key]) {
      participantGroups[key] = [];
    }
    
    participantGroups[key].push({
      score: match.score,
      text: match.metadata?.text?.substring(0, 80),
      sender: match.metadata?.sender,
      senderId: match.metadata?.senderId,
      userId: match.metadata?.userId,
    });
    
    if (i < 3) {
      console.log(`Top Match ${i + 1}:`);
      console.log(`  Score: ${match.score}`);
      console.log(`  Text: "${match.metadata?.text?.substring(0, 80)}..."`);
      console.log(`  Participants: ${JSON.stringify(participants)}`);
      console.log(`  SenderId: ${match.metadata?.senderId}`);
      console.log(`  UserId: ${match.metadata?.userId}`);
      console.log('');
    }
  });

  console.log('\n-------------------------------------------');
  console.log('📊 Participant Groups Found:');
  
  Object.entries(participantGroups).forEach(([participants, messages]) => {
    console.log(`\nParticipants: ${participants}`);
    console.log(`  ${messages.length} messages with these participants`);
    
    if (JSON.parse(participants).length === 0) {
      console.log('  ⚠️ WARNING: Empty participants array!');
      console.log('  These messages won\'t be found by any user search');
    }
  });

  // Check if participants are empty or missing
  const emptyParticipants = searchResults.matches.filter(m => 
    !m.metadata?.participants || m.metadata.participants.length === 0
  );
  
  if (emptyParticipants.length > 0) {
    console.log('\n⚠️  ISSUE FOUND: Some messages have empty or missing participants!');
    console.log(`${emptyParticipants.length} out of ${searchResults.matches.length} messages have no participants`);
    console.log('\nThese messages need to be re-embedded with proper participant metadata.');
    console.log('Run: cd functions && node scripts/clear-embeddings.js');
  } else {
    console.log('\n✅ All messages have participant metadata!');
  }
}

checkParticipants().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
