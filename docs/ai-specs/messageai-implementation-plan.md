# MessageAI: AI Features Implementation Plan

**⚠️ DEPRECATED - This document describes the ORIGINAL hybrid Firebase + AWS Lambda architecture.**

**✅ CURRENT PLAN: See `CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md` for the simplified Firebase-only architecture.**

This document is kept for reference purposes only.

---

**Version:** 1.0  
**Created:** October 23, 2025  
**Timeline:** 4 weeks to MVP  
**Target Launch:** End of Week 4

---

## Overview

This document outlines the complete implementation plan for adding AI-powered features to MessageAI. The plan is structured in phases, with each phase building on the previous one. All work is scoped for a single full-time developer over 4 weeks.

### Success Criteria
- ✅ All 5 required AI features working
- ✅ Proactive assistant operational
- ✅ Response times meet targets (<3s simple, <15s complex)
- ✅ Accuracy >85% on all features
- ✅ Cost <$1.50 per user/month

---

## Tech Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| **LLM** | OpenAI GPT-4o & GPT-4o-mini | Language models |
| **Agent Framework** | AI SDK by Vercel | Tool calling, streaming |
| **Vector DB** | Pinecone | Semantic search |
| **Embeddings** | OpenAI text-embedding-3-large | Message embeddings |
| **Backend** | Firebase Functions + AWS Lambda | Hybrid architecture |
| **Cache** | Firestore | AI response caching |
| **Mobile** | React Native (existing) | Cross-platform app |

---

## Phase 0: Pre-Implementation Setup (Days 1-2)

**Goal:** Set up all required accounts, tools, and development environment

### Day 1: Account Setup & API Keys

**Morning: Create Accounts (2 hours)**
1. Sign up for OpenAI API
   - Go to platform.openai.com
   - Create account with company email
   - Add payment method
   - Request rate limit increase (if needed)
   - Generate API key, save securely

2. Sign up for Pinecone
   - Go to pinecone.io
   - Create free starter account
   - Create organization "MessageAI"
   - Generate API key

3. Verify AWS access
   - Log in to AWS Console
   - Verify permissions: Lambda, IAM, CloudWatch, Secrets Manager
   - Create new IAM user for development (if needed)
   - Generate access keys

**Afternoon: Development Environment (3 hours)**

1. Install required tools:
```bash
# Node.js 20+ (if not already installed)
nvm install 20
nvm use 20

# AWS CLI
brew install awscli  # macOS
# or download from aws.amazon.com/cli

# Configure AWS credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region: us-east-1

# Terraform (for infrastructure)
brew install terraform
```

2. Set up local development environment:
```bash
# Clone the MessageAI repo
cd ~/projects/messageai

# Install Firebase tools
npm install -g firebase-tools
firebase login

# Create new directories for AI features
mkdir -p functions/src/ai
mkdir -p lambda
mkdir -p lambda/shared
mkdir -p mobile/src/features/ai
```

3. Install dependencies:
```bash
# Firebase Functions dependencies
cd functions
npm install ai @ai-sdk/openai openai @pinecone-database/pinecone zod
npm install --save-dev @types/node typescript

# Lambda dependencies (will set up per function)
cd ../lambda
npm init -y
npm install ai @ai-sdk/openai openai @pinecone-database/pinecone zod
```

**Evening: Environment Configuration (2 hours)**

1. Set up Firebase environment variables:
```bash
# Navigate to Firebase project
firebase functions:config:set \
  openai.api_key="YOUR_OPENAI_KEY" \
  pinecone.api_key="YOUR_PINECONE_KEY" \
  pinecone.environment="us-east-1-aws"
```

2. Set up AWS Secrets Manager:
```bash
# Store OpenAI API key
aws secretsmanager create-secret \
  --name messageai/openai-api-key \
  --secret-string "YOUR_OPENAI_KEY" \
  --region us-east-1

# Store Pinecone API key
aws secretsmanager create-secret \
  --name messageai/pinecone-api-key \
  --secret-string "YOUR_PINECONE_KEY" \
  --region us-east-1
```

3. Create `.env.local` for local development:
```bash
# In project root
cat > .env.local << EOF
OPENAI_API_KEY=YOUR_OPENAI_KEY
PINECONE_API_KEY=YOUR_PINECONE_KEY
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=messageai-conversations
EOF

# Add to .gitignore
echo ".env.local" >> .gitignore
```

### Day 2: Pinecone Index Creation & Base Infrastructure

**Morning: Create Pinecone Index (2 hours)**

1. Create shared Pinecone utility:
```typescript
// lambda/shared/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone'

let pineconeClient: Pinecone | null = null

export const getPineconeClient = () => {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!
    })
  }
  return pineconeClient
}

export const getIndex = () => {
  const client = getPineconeClient()
  return client.index('messageai-conversations')
}
```

2. Create Pinecone index via script:
```typescript
// scripts/create-pinecone-index.ts
import { Pinecone } from '@pinecone-database/pinecone'

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
})

async function createIndex() {
  try {
    await pinecone.createIndex({
      name: 'messageai-conversations',
      dimension: 3072, // text-embedding-3-large
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    })
    
    console.log('✅ Pinecone index created successfully')
  } catch (error) {
    console.error('Error creating index:', error)
  }
}

createIndex()
```

Run the script:
```bash
npx tsx scripts/create-pinecone-index.ts
```

**Afternoon: Base Lambda Infrastructure (3 hours)**

1. Create Lambda execution role via AWS CLI:
```bash
# Create trust policy
cat > lambda-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name MessageAI-Lambda-Execution-Role \
  --assume-role-policy-document file://lambda-trust-policy.json

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name MessageAI-Lambda-Execution-Role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Attach Secrets Manager access
aws iam attach-role-policy \
  --role-name MessageAI-Lambda-Execution-Role \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

2. Create shared OpenAI utility:
```typescript
// lambda/shared/openai.ts
import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

export const getOpenAIClient = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    })
  }
  return openaiClient
}

export const generateEmbedding = async (text: string) => {
  const client = getOpenAIClient()
  const response = await client.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    encoding_format: 'float'
  })
  return response.data[0].embedding
}
```

3. Create shared cache utility:
```typescript
// lambda/shared/cache.ts
import { Firestore } from '@google-cloud/firestore'

const db = new Firestore()

export const withCache = async <T>(
  cacheKey: string,
  ttlMinutes: number,
  generatorFn: () => Promise<T>
): Promise<T> => {
  const cacheRef = db.collection('cache').doc(cacheKey)
  
  try {
    const cached = await cacheRef.get()
    
    if (cached.exists) {
      const data = cached.data()
      if (data && data.expiresAt > Date.now()) {
        console.log(`Cache hit: ${cacheKey}`)
        return data.value as T
      }
    }
  } catch (error) {
    console.warn('Cache read error:', error)
  }
  
  // Cache miss or expired - generate fresh data
  console.log(`Cache miss: ${cacheKey}`)
  const value = await generatorFn()
  
  // Store in cache
  try {
    await cacheRef.set({
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttlMinutes * 60 * 1000)
    })
  } catch (error) {
    console.warn('Cache write error:', error)
  }
  
  return value
}
```

**Evening: Set Up CI/CD Pipeline (2 hours)**

1. Create GitHub Actions workflow for Lambda deployment:
```yaml
# .github/workflows/deploy-lambda.yml
name: Deploy Lambda Functions

on:
  push:
    branches: [main]
    paths:
      - 'lambda/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd lambda
          npm ci
      
      - name: Build Lambda packages
        run: |
          cd lambda
          npm run build
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to Lambda
        run: |
          cd lambda
          npm run deploy
```

2. Create deployment script:
```json
// lambda/package.json
{
  "scripts": {
    "build": "tsc",
    "deploy": "node scripts/deploy-all.js"
  }
}
```

**End of Day 2 Checklist:**
- ✅ All accounts created (OpenAI, Pinecone, AWS)
- ✅ Development environment set up
- ✅ API keys configured in Secrets Manager
- ✅ Pinecone index created
- ✅ Base Lambda infrastructure ready
- ✅ Shared utilities created (OpenAI, Pinecone, Cache)
- ✅ CI/CD pipeline configured

---

## Phase 1: RAG Pipeline Foundation (Days 3-5)

**Goal:** Build the core RAG (Retrieval-Augmented Generation) pipeline for semantic search

### Day 3: Message Embedding System

**Morning: Firebase Trigger for New Messages (3 hours)**

1. Create Firebase Function to embed new messages:
```typescript
// functions/src/ai/embedMessages.ts
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { CallableRequest } from 'firebase-functions/v2/https'

const db = admin.firestore()

// Lambda function URL (will be created later)
const LAMBDA_EMBED_URL = process.env.LAMBDA_EMBED_URL || ''

export const onMessageCreated = functions.firestore
  .document('messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const messageData = snapshot.data()
    const messageId = context.params.messageId
    
    // Skip if already embedded
    if (messageData.embedded) return
    
    try {
      // Call Lambda to embed message
      const response = await fetch(LAMBDA_EMBED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          text: messageData.text,
          userId: messageData.userId,
          conversationId: messageData.conversationId,
          timestamp: messageData.timestamp,
          sender: messageData.sender
        })
      })
      
      if (!response.ok) {
        throw new Error(`Lambda error: ${response.statusText}`)
      }
      
      // Mark as embedded
      await snapshot.ref.update({
        embedded: true,
        embeddedAt: admin.firestore.FieldValue.serverTimestamp()
      })
      
      console.log(`✅ Message ${messageId} embedded successfully`)
    } catch (error) {
      console.error(`Error embedding message ${messageId}:`, error)
      // Don't fail - will retry on next trigger
    }
  })
```

2. Create Lambda function to handle embeddings:
```typescript
// lambda/embed-message/index.ts
import { Handler } from 'aws-lambda'
import { generateEmbedding } from '../shared/openai'
import { getIndex } from '../shared/pinecone'

export const handler: Handler = async (event) => {
  const { messageId, text, userId, conversationId, timestamp, sender } = JSON.parse(event.body)
  
  try {
    // Generate embedding
    const embedding = await generateEmbedding(text)
    
    // Store in Pinecone
    const index = getIndex()
    await index.upsert([{
      id: messageId,
      values: embedding,
      metadata: {
        userId,
        conversationId,
        timestamp,
        sender,
        text: text.substring(0, 500) // Preview only
      }
    }])
    
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, messageId })
    }
  } catch (error) {
    console.error('Embedding error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
```

3. Deploy Lambda function:
```bash
cd lambda/embed-message
npm install
zip -r function.zip .

aws lambda create-function \
  --function-name messageai-embed-message \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/MessageAI-Lambda-Execution-Role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment Variables="{OPENAI_API_KEY=$OPENAI_KEY,PINECONE_API_KEY=$PINECONE_KEY}"

# Create function URL
aws lambda create-function-url-config \
  --function-name messageai-embed-message \
  --auth-type NONE
```

**Afternoon: Batch Embedding for Existing Messages (3 hours)**

1. Create script to embed existing messages:
```typescript
// scripts/embed-existing-messages.ts
import * as admin from 'firebase-admin'
import { generateEmbedding } from '../lambda/shared/openai'
import { getIndex } from '../lambda/shared/pinecone'

admin.initializeApp()
const db = admin.firestore()

async function embedExistingMessages() {
  const messagesRef = db.collection('messages')
  const snapshot = await messagesRef
    .where('embedded', '==', false)
    .limit(1000) // Process in batches
    .get()
  
  console.log(`Found ${snapshot.size} messages to embed`)
  
  const index = getIndex()
  const batchSize = 100
  let processed = 0
  
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = snapshot.docs.slice(i, i + batchSize)
    
    const embeddings = await Promise.all(
      batch.map(async (doc) => {
        const data = doc.data()
        const embedding = await generateEmbedding(data.text)
        return {
          id: doc.id,
          values: embedding,
          metadata: {
            userId: data.userId,
            conversationId: data.conversationId,
            timestamp: data.timestamp,
            sender: data.sender,
            text: data.text.substring(0, 500)
          }
        }
      })
    )
    
    // Upsert to Pinecone
    await index.upsert(embeddings)
    
    // Mark as embedded in Firestore
    const writeBatch = db.batch()
    batch.forEach(doc => {
      writeBatch.update(doc.ref, { 
        embedded: true,
        embeddedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    })
    await writeBatch.commit()
    
    processed += batch.length
    console.log(`Progress: ${processed}/${snapshot.size}`)
  }
  
  console.log('✅ All existing messages embedded')
}

embedExistingMessages()
```

2. Run the script:
```bash
npx tsx scripts/embed-existing-messages.ts
```

**Evening: Testing & Verification (2 hours)**

1. Create test script to verify embeddings:
```typescript
// scripts/test-embeddings.ts
import { getIndex } from '../lambda/shared/pinecone'
import { generateEmbedding } from '../lambda/shared/openai'

async function testEmbeddings() {
  const index = getIndex()
  
  // Test 1: Check index stats
  const stats = await index.describeIndexStats()
  console.log('Index stats:', stats)
  
  // Test 2: Semantic search
  const queryEmbedding = await generateEmbedding('database migration discussion')
  const results = await index.query({
    vector: queryEmbedding,
    topK: 5,
    includeMetadata: true
  })
  
  console.log('Search results:')
  results.matches.forEach((match, i) => {
    console.log(`${i + 1}. Score: ${match.score}, Text: ${match.metadata?.text}`)
  })
}

testEmbeddings()
```

2. Verify results and fix any issues

### Day 4: Smart Search Implementation

**Morning: Create RAG Search Lambda (3 hours)**

1. Implement semantic search with reranking:
```typescript
// lambda/smart-search/index.ts
import { Handler } from 'aws-lambda'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { generateEmbedding } from '../shared/openai'
import { getIndex } from '../shared/pinecone'
import { withCache } from '../shared/cache'

interface SearchRequest {
  userId: string
  query: string
  filters?: {
    conversationId?: string
    dateRange?: { start: string; end: string }
    sender?: string
  }
}

export const handler: Handler = async (event) => {
  const { userId, query, filters }: SearchRequest = JSON.parse(event.body)
  
  const cacheKey = `search_${userId}_${query}_${JSON.stringify(filters)}`
  
  const results = await withCache(cacheKey, 10, async () => {
    // Step 1: Generate query embedding
    const queryEmbedding = await generateEmbedding(query)
    
    // Step 2: Vector search in Pinecone
    const index = getIndex()
    const pineconeFilters: any = { userId: { $eq: userId } }
    
    if (filters?.conversationId) {
      pineconeFilters.conversationId = { $eq: filters.conversationId }
    }
    if (filters?.dateRange) {
      pineconeFilters.timestamp = {
        $gte: new Date(filters.dateRange.start).getTime(),
        $lte: new Date(filters.dateRange.end).getTime()
      }
    }
    
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 20,
      filter: pineconeFilters,
      includeMetadata: true
    })
    
    // Step 3: Rerank with GPT-4o
    const reranked = await generateText({
      model: openai('gpt-4o'),
      prompt: `You are a search result ranker. Rank these message results by relevance to the query.
      Return only the top 5 most relevant results in order, with their IDs.
      
      Query: "${query}"
      
      Results:
      ${searchResults.matches.map((m, i) => `[${i}] ID: ${m.id}, Text: ${m.metadata?.text}`).join('\n')}
      
      Return format: Just the IDs in order, one per line.`
    })
    
    const rankedIds = reranked.text.split('\n').filter(Boolean).slice(0, 5)
    
    // Step 4: Get full context from Firestore for top results
    // (This would fetch ±3 messages around each result)
    const finalResults = rankedIds.map(id => {
      const match = searchResults.matches.find(m => m.id === id)
      return {
        messageId: id,
        score: match?.score || 0,
        text: match?.metadata?.text,
        conversationId: match?.metadata?.conversationId,
        timestamp: match?.metadata?.timestamp,
        sender: match?.metadata?.sender
      }
    })
    
    return finalResults
  })
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ results })
  }
}
```

2. Deploy Lambda:
```bash
cd lambda/smart-search
zip -r function.zip .

aws lambda create-function \
  --function-name messageai-smart-search \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/MessageAI-Lambda-Execution-Role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 60 \
  --memory-size 1024

aws lambda create-function-url-config \
  --function-name messageai-smart-search \
  --auth-type NONE
```

**Afternoon: Firebase Function Wrapper (2 hours)**

1. Create Firebase Function to call Lambda:
```typescript
// functions/src/ai/smartSearch.ts
import * as functions from 'firebase-functions'

const LAMBDA_SEARCH_URL = process.env.LAMBDA_SEARCH_URL || ''

export const smartSearch = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in')
  }
  
  const { query, filters } = data
  const userId = context.auth.uid
  
  try {
    const response = await fetch(LAMBDA_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, query, filters })
    })
    
    const result = await response.json()
    return result
  } catch (error) {
    console.error('Smart search error:', error)
    throw new functions.https.HttpsError('internal', 'Search failed')
  }
})
```

2. Deploy Firebase Functions:
```bash
firebase deploy --only functions
```

**Evening: React Native Integration (3 hours)**

1. Create AI service in React Native:
```typescript
// mobile/src/services/ai.service.ts
import functions from '@react-native-firebase/functions'

export interface SearchResult {
  messageId: string
  score: number
  text: string
  conversationId: string
  timestamp: number
  sender: string
}

export class AIService {
  static async smartSearch(
    query: string,
    filters?: {
      conversationId?: string
      dateRange?: { start: string; end: string }
    }
  ): Promise<SearchResult[]> {
    const searchFunction = functions().httpsCallable('smartSearch')
    const result = await searchFunction({ query, filters })
    return result.data.results
  }
}
```

2. Create Smart Search UI component:
```typescript
// mobile/src/features/ai/SmartSearch.tsx
import React, { useState } from 'react'
import { View, TextInput, FlatList, Text, ActivityIndicator, TouchableOpacity } from 'react-native'
import { AIService, SearchResult } from '../../services/ai.service'

export const SmartSearch: React.FC = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  
  const handleSearch = async () => {
    if (!query.trim()) return
    
    setLoading(true)
    try {
      const searchResults = await AIService.smartSearch(query)
      setResults(searchResults)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16
        }}
        placeholder="🔍 Search conversations..."
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={handleSearch}
      />
      
      {loading && <ActivityIndicator size="large" />}
      
      <FlatList
        data={results}
        keyExtractor={(item) => item.messageId}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              padding: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#eee'
            }}
          >
            <Text style={{ fontWeight: 'bold' }}>{item.sender}</Text>
            <Text>{item.text}</Text>
            <Text style={{ color: '#666', fontSize: 12 }}>
              Score: {item.score.toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}
```

### Day 5: RAG Pipeline Testing & Optimization

**Morning: End-to-End Testing (3 hours)**

1. Create comprehensive test suite:
```typescript
// tests/rag-pipeline.test.ts
import { AIService } from '../mobile/src/services/ai.service'

describe('RAG Pipeline', () => {
  it('should find relevant messages by keyword', async () => {
    const results = await AIService.smartSearch('database migration')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].text).toContain('database')
  })
  
  it('should handle natural language queries', async () => {
    const results = await AIService.smartSearch('when did we decide on the API approach?')
    expect(results.length).toBeGreaterThan(0)
    // Should find decision-related messages
  })
  
  it('should filter by conversation', async () => {
    const results = await AIService.smartSearch('meeting', {
      conversationId: 'backend-team'
    })
    results.forEach(r => {
      expect(r.conversationId).toBe('backend-team')
    })
  })
  
  it('should filter by date range', async () => {
    const startDate = new Date('2025-10-01')
    const endDate = new Date('2025-10-31')
    
    const results = await AIService.smartSearch('project update', {
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    })
    
    results.forEach(r => {
      expect(r.timestamp).toBeGreaterThanOrEqual(startDate.getTime())
      expect(r.timestamp).toBeLessThanOrEqual(endDate.getTime())
    })
  })
})
```

2. Run tests and fix any issues
3. Performance testing with 1000+ messages

**Afternoon: Cache Optimization (2 hours)**

1. Add cache warming for common queries:
```typescript
// functions/src/ai/cacheWarmup.ts
import * as functions from 'firebase-functions'

export const warmCache = functions.pubsub
  .schedule('every 6 hours')
  .onRun(async (context) => {
    const commonQueries = [
      'recent decisions',
      'action items',
      'meeting notes',
      'project updates'
    ]
    
    // Pre-cache common searches
    for (const query of commonQueries) {
      await fetch(LAMBDA_SEARCH_URL, {
        method: 'POST',
        body: JSON.stringify({ query })
      })
    }
  })
```

2. Monitor cache hit rates in CloudWatch

**Evening: Documentation & Handoff (2 hours)**

1. Document RAG pipeline architecture
2. Create troubleshooting guide
3. Add monitoring dashboards

**End of Phase 1 Checklist:**
- ✅ Message embedding pipeline operational
- ✅ Pinecone index populated with all messages
- ✅ Smart search working with natural language
- ✅ Caching implemented and tested
- ✅ React Native UI integrated
- ✅ End-to-end tests passing
- ✅ Performance meets targets (<3s searches)

---

## Phase 2: Core AI Features (Days 6-10)

**Goal:** Implement the 5 required AI features

### Day 6-7: Thread Summarization & Action Item Extraction

**Day 6 Morning: Thread Summarization Lambda (3 hours)**

```typescript
// lambda/summarize-thread/index.ts
import { Handler } from 'aws-lambda'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { withCache } from '../shared/cache'

export const handler: Handler = async (event) => {
  const { conversationId, messageIds, userId } = JSON.parse(event.body)
  
  const cacheKey = `summary_${conversationId}_${messageIds.join('_')}`
  
  const summary = await withCache(cacheKey, 5, async () => {
    // Fetch messages from Firestore
    const messages = await fetchMessages(messageIds)
    
    const messageCount = messages.length
    const model = messageCount < 50 ? 'gpt-4o-mini' : 'gpt-4o'
    
    const result = await generateText({
      model: openai(model),
      prompt: `Summarize this conversation thread (${messageCount} messages).
      
      Format:
      📝 Thread Summary (timeframe, ${messageCount} messages)
      
      Key Topics:
      • Topic 1
      • Topic 2
      
      Decisions Made:
      • Decision 1
      
      Still Open:
      • Question 1
      
      Messages:
      ${messages.map(m => `${m.sender}: ${m.text}`).join('\n\n')}`
    })
    
    return result.text
  })
  
  return {
    statusCode: 200,
    body: JSON.stringify({ summary })
  }
}
```

**Day 6 Afternoon: Action Item Extraction (3 hours)**

```typescript
// lambda/extract-actions/index.ts
import { Handler } from 'aws-lambda'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'

const ActionItemSchema = z.object({
  actionItems: z.array(z.object({
    task: z.string(),
    assignee: z.string().nullable(),
    deadline: z.string().nullable(),
    context: z.string(),
    messageId: z.string(),
    confidence: z.number().min(0).max(1)
  }))
})

export const handler: Handler = async (event) => {
  const { conversationId, messages } = JSON.parse(event.body)
  
  const result = await generateObject({
    model: openai('gpt-4o'),
    schema: ActionItemSchema,
    prompt: `Extract action items from this conversation.
    
    Look for patterns like:
    - "I'll handle X"
    - "Can you do Y?"
    - "Someone needs to Z"
    - "TODO:"
    - Direct questions requiring action
    
    Messages:
    ${messages.map((m, i) => `[${i}] ${m.sender}: ${m.text}`).join('\n\n')}
    
    Return confidence scores for each action item (0-1).`
  })
  
  // Store action items in Firestore
  const db = admin.firestore()
  const batch = db.batch()
  
  result.object.actionItems.forEach(item => {
    const ref = db.collection('action_items').doc()
    batch.set(ref, {
      ...item,
      conversationId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    })
  })
  
  await batch.commit()
  
  return {
    statusCode: 200,
    body: JSON.stringify({ actionItems: result.object.actionItems })
  }
}
```

**Day 6 Evening: React Native UI (2 hours)**

Create UI components for both features

**Day 7: Testing & Refinement**

Full day of testing, edge cases, and prompt refinement

### Day 8-9: Priority Detection & Decision Tracking

**Day 8: Priority Detection**

Similar structure to Day 6:
- Morning: Lambda implementation with GPT-4o-mini
- Afternoon: Real-time classification on message create
- Evening: UI integration

**Day 9: Decision Tracking**

- Morning: Decision extraction Lambda
- Afternoon: Decision repository in Firestore
- Evening: Decision search UI

### Day 10: Integration Testing

**Full Day: End-to-End Testing**

1. Test all 5 features together
2. Performance benchmarking
3. User acceptance testing
4. Bug fixes

**End of Phase 2 Checklist:**
- ✅ Thread summarization (<3s for <100 messages)
- ✅ Action item extraction (>85% accuracy)
- ✅ Smart search working
- ✅ Priority detection operational
- ✅ Decision tracking functional
- ✅ All features integrated in React Native app
- ✅ Cache hit rate >40%
- ✅ Error handling robust

---

## Phase 3: Proactive Assistant (Days 11-13)

**Goal:** Implement advanced multi-step AI agent

### Day 11: Agent Framework Setup

**Morning: AI SDK Agent Configuration (3 hours)**

```typescript
// lambda/proactive-agent/index.ts
import { Handler } from 'aws-lambda'
import { openai } from '@ai-sdk/openai'
import { generateText, tool } from 'ai'
import { z } from 'zod'

const agentTools = {
  checkCalendars: tool({
    description: 'Check calendar availability for users',
    parameters: z.object({
      userIds: z.array(z.string()),
      dateRange: z.object({
        start: z.string(),
        end: z.string()
      })
    }),
    execute: async ({ userIds, dateRange }) => {
      // Call Firebase Function to check calendars
      return await getCalendarAvailability(userIds, dateRange)
    }
  }),
  
  sendSuggestion: tool({
    description: 'Send a proactive suggestion to users',
    parameters: z.object({
      conversationId: z.string(),
      message: z.string(),
      actions: z.array(z.object({
        label: z.string(),
        action: z.string()
      }))
    }),
    execute: async (params) => {
      return await createSuggestion(params)
    }
  })
}

export const handler: Handler = async (event) => {
  const { conversationId, recentMessages, trigger } = JSON.parse(event.body)
  
  const result = await generateText({
    model: openai('gpt-4o'),
    tools: agentTools,
    maxSteps: 5,
    system: `You are a proactive assistant monitoring team conversations.
    
    Detect when:
    - 3+ people trying to schedule a meeting
    - Action items are overdue
    - Decisions conflict with past decisions
    
    Use tools to help. Only suggest when truly helpful.`,
    prompt: `Conversation: ${conversationId}
    Trigger: ${trigger}
    
    Recent messages:
    ${recentMessages.map(m => `${m.sender}: ${m.text}`).join('\n')}
    
    Should I take any proactive action?`
  })
  
  return {
    statusCode: 200,
    body: JSON.stringify({ result: result.text })
  }
}
```

**Afternoon: Trigger Detection (3 hours)**

Implement Firebase Functions to detect when to invoke agent

**Evening: Tool Implementation (2 hours)**

Implement calendar integration and suggestion delivery

### Day 12: Meeting Scheduling Feature

**Full Day:**
1. Implement meeting time suggestion algorithm
2. Integrate with Google Calendar API / Microsoft Graph
3. Build suggestion UI in React Native
4. Test multi-person scheduling

### Day 13: Agent Testing & Refinement

**Full Day:**
1. Test all proactive scenarios
2. Tune agent prompts
3. Adjust trigger sensitivity
4. User feedback collection

**End of Phase 3 Checklist:**
- ✅ Proactive agent operational
- ✅ Meeting scheduling working (3+ people)
- ✅ Response time <15 seconds
- ✅ Suggestion acceptance rate >40%
- ✅ No spam (max 5 suggestions/day/user)

---

## Phase 4: Polish & Launch Prep (Days 14-15)

### Day 14: Performance Optimization

**Morning: Cost Optimization (3 hours)**
1. Implement aggressive caching
2. Switch simple operations to GPT-4o-mini
3. Add request batching
4. Monitor API usage

**Afternoon: Error Handling (2 hours)**
1. Add retry logic
2. Graceful degradation
3. User-friendly error messages
4. Logging and monitoring

**Evening: Security Audit (2 hours)**
1. API key rotation
2. Rate limiting per IP
3. Input sanitization
4. Permission checks

### Day 15: Launch Preparation

**Morning: Documentation (3 hours)**
1. User guide
2. Admin documentation
3. Troubleshooting guide
4. API documentation

**Afternoon: Beta Testing (3 hours)**
1. Invite 10 beta testers
2. Collect feedback
3. Fix critical bugs
4. Prepare for rollout

**Evening: Deployment (2 hours)**
1. Deploy to production
2. Monitor metrics
3. Gradual rollout (10% → 100%)

---

## Post-Launch (Week 5+)

### Week 5: Monitoring & Iteration

**Daily:**
- Monitor error rates
- Track cost per user
- Collect user feedback
- Fix bugs

**Weekly:**
- Analyze feature usage
- Optimize prompts
- Improve accuracy
- Cost optimization

### Success Metrics to Track

**Technical Metrics:**
- Response times (target: <3s simple, <15s complex)
- Error rates (target: <2%)
- Cache hit rate (target: >40%)
- Cost per user (target: <$1.50)

**Product Metrics:**
- Feature usage (target: 60% DAU using AI)
- Accuracy ratings (target: >85% useful)
- Suggestion acceptance (target: >40%)
- User satisfaction (target: NPS 40+)

---

## Contingency Plans

### If Behind Schedule

**Priority 1 (Must Have):**
- Thread Summarization
- Smart Search
- Priority Detection

**Priority 2 (Should Have):**
- Action Item Extraction
- Decision Tracking

**Priority 3 (Nice to Have):**
- Proactive Assistant

### If Over Budget

**Cost Reduction Strategies:**
1. Use GPT-4o-mini for 80% of operations
2. Implement more aggressive caching
3. Reduce embedding frequency
4. Batch API requests
5. Implement daily request limits

### If Technical Blockers

**Fallback Options:**
1. Pinecone → Supabase Vector
2. Lambda → Firebase Functions only
3. GPT-4o → GPT-3.5-turbo for simple tasks
4. Real-time → Scheduled batch processing

---

## Risk Mitigation

### Technical Risks

**Risk:** OpenAI API outage  
**Mitigation:** Implement failover to cached responses, queue requests, graceful degradation

**Risk:** Pinecone rate limits  
**Mitigation:** Implement exponential backoff, request queuing, alternative search (keyword)

**Risk:** Lambda cold starts  
**Mitigation:** Provisioned concurrency on critical functions, keep-warm pings

### Product Risks

**Risk:** Low user adoption  
**Mitigation:** In-app onboarding, proactive demos, feature discovery tips

**Risk:** AI accuracy issues  
**Mitigation:** User feedback loop, prompt refinement, confidence thresholds

**Risk:** Cost overruns  
**Mitigation:** Daily cost monitoring, per-user limits, aggressive caching

---

## Success Criteria

### Week 4 Demo (Grading)

Must demonstrate:
1. ✅ All 5 required features working
2. ✅ Proactive assistant suggesting meeting times
3. ✅ Natural language commands 90%+ success rate
4. ✅ Response times <2s simple, <15s complex
5. ✅ Clean UI with contextual menus
6. ✅ API keys secured
7. ✅ RAG pipeline operational
8. ✅ Error handling robust

### Production Launch

Additional requirements:
1. ✅ 7-day uptime >99.5%
2. ✅ Cost per user <$1.50/month
3. ✅ User satisfaction >80%
4. ✅ Feature usage >60% DAU
5. ✅ No security vulnerabilities

---

## Appendix: Quick Reference Commands

### Deploy Firebase Functions
```bash
firebase deploy --only functions
```

### Deploy Lambda Function
```bash
cd lambda/function-name
zip -r function.zip .
aws lambda update-function-code --function-name messageai-function-name --zip-file fileb://function.zip
```

### Test Lambda Locally
```bash
sam local invoke FunctionName --event event.json
```

### Check Pinecone Index Stats
```bash
curl -X GET "https://API_KEY@api.pinecone.io/indexes/messageai-conversations/describe_index_stats"
```

### Monitor Costs
```bash
# OpenAI
curl https://api.openai.com/v1/usage

# AWS
aws ce get-cost-and-usage --time-period Start=2025-10-01,End=2025-10-31 --granularity MONTHLY --metrics BlendedCost
```

### View Lambda Logs
```bash
aws logs tail /aws/lambda/messageai-function-name --follow
```

---

**End of Implementation Plan**
