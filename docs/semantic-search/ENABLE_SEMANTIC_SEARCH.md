# Enable Semantic Search - Quick Setup Guide

## Problem
Your smart search is only showing exact (keyword) matches because there are no message embeddings in Pinecone for semantic search.

## Solution
Follow these steps to populate Pinecone with message embeddings:

### 1. ✅ .env file created
The `.env` file has been created using your existing API keys from:
- `openAI_key` file
- `messageAI-pinecone-apikey` file

The .env file is:
- ✅ Properly configured with your actual API keys
- ✅ Already in .gitignore (won't be committed to git)
- ✅ Ready to use for the embedding script

### 2. Set up Firebase credentials
The script needs Firebase Admin access. You likely already have this set up since you're using Firebase Functions. If not:

Option A - Use existing Firebase CLI auth (recommended):
```bash
firebase login  # If not already logged in
```

Option B - Use service account key:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"
```

### 3. Run the embedding script
```bash
npm run embed-messages
```

This will:
- Fetch all messages from your Firestore conversations
- Generate OpenAI embeddings for each message
- Store vectors in Pinecone with proper metadata
- Mark messages as embedded in Firestore

### 4. Verify it worked
The script will show progress like:
```
🚀 Starting message embedding migration...
Found X conversations to process
Processing conversation: conv_id
  Found Y messages
  Generating embeddings...
  ✅ Upserted Y vectors to Pinecone
```

### 5. Test semantic search
After embeddings are created, your smart search will automatically work with both:
- **Exact matches** (green "Exact" badge)
- **Semantic matches** (with similarity scores)

## How It Works

Your search implementation already does BOTH types of search in parallel:

```typescript
// In app/ava/search.tsx
const [keywordResults, semanticResults] = await Promise.all([
  performKeywordSearch(searchQuery.trim(), userId),  // Exact text matches
  performSemanticSearch(searchQuery.trim()),         // AI-powered semantic search
]);
```

The semantic search:
1. Converts your query to an embedding vector
2. Searches Pinecone for similar message vectors
3. Returns messages ranked by semantic similarity
4. Shows similarity scores (e.g., "87%")

## Troubleshooting

### If the script fails:
1. Check your API keys are correct
2. Ensure Firebase is properly authenticated
3. Check the Pinecone index exists: `messageai-conversations`
4. Look for error messages in the console

### If search still doesn't work:
1. Check Firebase Functions logs: `firebase functions:log`
2. Verify embeddings exist in Pinecone dashboard
3. Ensure the smartSearch function is deployed: `firebase deploy --only functions:smartSearch`

## Notes
- The script will skip messages already marked as embedded
- System messages and empty messages are automatically filtered
- Each message embedding includes metadata for access control
- Rate limiting prevents API throttling (1 second between batches)
