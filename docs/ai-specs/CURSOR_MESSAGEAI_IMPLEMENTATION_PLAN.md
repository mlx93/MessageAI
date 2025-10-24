# MessageAI: Cursor Implementation Plan (Firebase + Pinecone)

**Version:** 2.0 - Simplified Architecture  
**Created:** October 24, 2025  
**Timeline:** 3-4 weeks to completion  
**Target:** All 5 required features + Proactive Assistant with RAG

---

## Overview

This implementation plan uses a **Firebase-only architecture** with Pinecone for RAG pipeline. No AWS Lambda required. All AI logic runs in Firebase Cloud Functions with enhanced memory/timeout configurations.

### Success Criteria
- ✅ All 5 required AI features working
- ✅ RAG pipeline operational (required by rubric)
- ✅ Proactive assistant with intelligent triggers
- ✅ Response times <2s simple, <15s complex
- ✅ Accuracy >85% on all features

---

## Architecture

```
┌─────────────────────────────────────────────┐
│         React Native App (Existing)         │
│              Expo SDK 54                    │
└─────────────────────────────────────────────┘
                    │
                    ↓ HTTPS
┌─────────────────────────────────────────────┐
│     Firebase Cloud Functions (Node 20)      │
│              2GB RAM, 540s timeout          │
│                                             │
│  Core Functions:                            │
│  • detectPriority()                         │
│  • summarizeThread()                        │
│  • extractActions()                         │
│  • extractDecisions()                       │
│  • smartSearch() ← Uses RAG                 │
│  • proactiveAgent() ← Uses RAG              │
│                                             │
│  Background Jobs:                           │
│  • batchEmbedMessages() ← Every 30 sec      │
└─────────────────────────────────────────────┘
         │                    │
         ↓                    ↓
┌──────────────┐    ┌──────────────────┐
│   OpenAI     │    │    Pinecone      │
│   API        │    │   Vector DB      │
│              │    │                  │
│ • GPT-4o     │    │ • Embeddings     │
│ • GPT-4o-mini│    │ • Semantic search│
│ • Embeddings │    │ • 3072 dims      │
└──────────────┘    └──────────────────┘
```

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React Native + Expo | Existing messaging app |
| **Backend** | Firebase Functions | All AI + business logic |
| **Database** | Firestore | Messages, users, metadata |
| **Vector DB** | Pinecone | RAG pipeline (required) |
| **LLM** | OpenAI GPT-4o/4o-mini | AI features |
| **Embeddings** | text-embedding-3-large | 3072-dim vectors |
| **Agent Framework** | AI SDK by Vercel | Tool calling, streaming |
| **Cache** | Firestore | AI response caching |

---

## Code Structure

```
MessageAI/
├── functions/
│   ├── src/
│   │   ├── ai/
│   │   │   ├── priorityDetection.ts      # Feature 4
│   │   │   ├── threadSummary.ts          # Feature 1
│   │   │   ├── actionItems.ts            # Feature 2
│   │   │   ├── decisionTracking.ts       # Feature 5
│   │   │   ├── smartSearch.ts            # Feature 3 (RAG)
│   │   │   ├── proactiveAgent.ts         # Advanced feature
│   │   │   ├── batchEmbedding.ts         # Background job
│   │   │   └── ragPipeline.ts            # RAG utilities
│   │   ├── utils/
│   │   │   ├── openai.ts                 # OpenAI client
│   │   │   ├── pinecone.ts               # Pinecone client
│   │   │   └── cache.ts                  # Caching utilities
│   │   └── index.ts                      # Export all functions
│   └── package.json
│
├── app/ (existing React Native app)
│   ├── features/
│   │   └── ai/
│   │       ├── AIAssistant.tsx           # Main AI tab
│   │       ├── ThreadSummary.tsx         # Summary UI
│   │       ├── ActionItems.tsx           # Action items list
│   │       ├── SmartSearch.tsx           # Search UI
│   │       ├── Decisions.tsx             # Decisions list
│   │       └── ProactiveSuggestion.tsx   # Suggestions
│   └── services/
│       └── ai.service.ts                 # AI API wrapper
│
├── scripts/
│   ├── create-pinecone-index.ts          # One-time setup
│   └── embed-existing-messages.ts        # Migration script
│
└── docs/
    └── ai-specs/
        └── CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md (this file)
```

---

## Week 1: Setup + Simple Features (Days 1-5)

### Day 1: Infrastructure Setup (4 hours)

**OpenAI Setup:**
```bash
# You already have API key
firebase functions:secrets:set OPENAI_API_KEY
# Paste your existing key
```

**Pinecone Setup:**
1. Go to https://app.pinecone.io/signup
2. Create free starter account
3. Create organization: "MessageAI"
4. Create API key

**Create Pinecone Index:**
```bash
# Via Pinecone dashboard:
# - Name: messageai-conversations
# - Dimensions: 3072
# - Metric: cosine
# - Cloud: AWS us-east-1
```

**Store Pinecone Key:**
```bash
firebase functions:secrets:set PINECONE_API_KEY
# Paste Pinecone key
```

**Install Dependencies:**
```bash
cd functions
npm install ai @ai-sdk/openai openai @pinecone-database/pinecone zod
```

**Create Utility Files:**

```typescript
// functions/src/utils/openai.ts
import OpenAI from 'openai'

export const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
}

export const generateEmbedding = async (text: string) => {
  const client = getOpenAIClient()
  const response = await client.embeddings.create({
    model: 'text-embedding-3-large',
    input: text
  })
  return response.data[0].embedding
}
```

```typescript
// functions/src/utils/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone'

export const getPineconeClient = () => {
  return new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!
  })
}

export const getIndex = () => {
  const client = getPineconeClient()
  return client.index('messageai-conversations')
}
```

```typescript
// functions/src/utils/cache.ts
import * as admin from 'firebase-admin'

export const withCache = async <T>(
  cacheKey: string,
  ttlMinutes: number,
  generatorFn: () => Promise<T>
): Promise<T> => {
  const db = admin.firestore()
  const cacheRef = db.collection('ai_cache').doc(cacheKey)
  
  try {
    const cached = await cacheRef.get()
    if (cached.exists) {
      const data = cached.data()
      if (data && data.expiresAt > Date.now()) {
        return data.value as T
      }
    }
  } catch (error) {
    console.warn('Cache read error:', error)
  }
  
  const value = await generatorFn()
  
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

---

### Day 2-3: Priority Detection (Feature 4)

**Implementation:**
```typescript
// functions/src/ai/priorityDetection.ts
import { onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

const openaiKey = defineSecret('OPENAI_API_KEY')

export const detectPriority = onCall({
  secrets: [openaiKey],
  memory: '1GB',
}, async (request) => {
  const { messageText, conversationContext } = request.data
  
  const result = await generateText({
    model: openai('gpt-4o-mini'),
    prompt: `Analyze message priority for team communication.
    
Message: "${messageText}"
Context: ${conversationContext.type} conversation with ${conversationContext.participantCount} people

Determine priority level:
- URGENT: Production issues, blocking problems, explicit urgency (ASAP, CRITICAL)
- IMPORTANT: Direct questions, time-sensitive, needs response today
- NORMAL: FYI, can wait, no immediate action needed

Consider:
- Urgency keywords
- Direct @mentions
- Questions to specific people
- Time pressure indicators
- Conversation context

Reply in this exact format:
Priority: [urgent|important|normal]
Confidence: [0-1]
Reason: [brief explanation]`
  })
  
  // Parse result
  const lines = result.text.split('\n')
  const priority = lines[0].split(':')[1].trim()
  const confidence = parseFloat(lines[1].split(':')[1].trim())
  const reason = lines[2].split(':')[1].trim()
  
  return {
    priority,
    confidence,
    reason,
    detectedAt: Date.now()
  }
})
```

**Firebase Trigger for Real-Time Detection:**
```typescript
// functions/src/ai/priorityDetection.ts (add this)
import { onDocumentCreated } from 'firebase-functions/v2/firestore'

export const detectPriorityOnMessage = onDocumentCreated(
  'messages/{messageId}',
  async (event) => {
    const message = event.data?.data()
    if (!message) return
    
    const detection = await detectPriority({
      data: {
        messageText: message.text,
        conversationContext: {
          type: message.conversationType || 'dm',
          participantCount: message.participantCount || 2
        }
      }
    } as any)
    
    // Update message with priority
    await event.data?.ref.update({
      priority: detection.data.priority,
      priorityConfidence: detection.data.confidence,
      priorityReason: detection.data.reason
    })
  }
)
```

**React Native Integration:**
```typescript
// app/services/ai.service.ts
import functions from '@react-native-firebase/functions'

export class AIService {
  static async detectPriority(messageText: string, context: any) {
    const fn = functions().httpsCallable('detectPriority')
    const result = await fn({ messageText, conversationContext: context })
    return result.data
  }
}
```

**UI: Priority Badges**
```typescript
// In your message rendering:
{message.priority === 'urgent' && <Text style={styles.urgentBadge}>🔴</Text>}
{message.priority === 'important' && <Text style={styles.importantBadge}>🟡</Text>}
```

---

### Day 4: Thread Summarization (Feature 1)

**Implementation - Queries by Date Range:**
```typescript
// functions/src/ai/threadSummary.ts
import { onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import * as admin from 'firebase-admin'
import { withCache } from '../utils/cache'

const openaiKey = defineSecret('OPENAI_API_KEY')

export const summarizeThread = onCall({
  secrets: [openaiKey],
  memory: '2GB',
  timeoutSeconds: 60,
}, async (request) => {
  const { conversationId, dateRange } = request.data
  const userId = request.auth?.uid
  
  if (!userId) {
    throw new Error('Unauthorized')
  }
  
  // Create cache key based on conversation + date range
  const cacheKey = `summary_${conversationId}_${dateRange?.start || 'all'}_${dateRange?.end || 'now'}`
  
  const summary = await withCache(cacheKey, 5, async () => {
    const db = admin.firestore()
    
    // Query messages by date range
    let query = db.collection('messages')
      .where('conversationId', '==', conversationId)
      .orderBy('timestamp', 'desc')
    
    if (dateRange?.start) {
      query = query.where('timestamp', '>=', new Date(dateRange.start).getTime())
    }
    if (dateRange?.end) {
      query = query.where('timestamp', '<=', new Date(dateRange.end).getTime())
    }
    
    const snapshot = await query.limit(500).get()
    const messages = snapshot.docs.map(doc => doc.data())
    
    if (messages.length === 0) {
      return { summary: 'No messages in this date range.' }
    }
    
    // Choose model based on message count
    const model = messages.length < 50 ? 'gpt-4o-mini' : 'gpt-4o'
    
    const result = await generateText({
      model: openai(model),
      prompt: `Summarize this team conversation (${messages.length} messages).

Format your response as:
📝 Thread Summary (${messages.length} messages)

Key Topics:
• [List main discussion topics]

Decisions Made:
• [List any decisions or agreements]

Still Open:
• [List unresolved questions or pending items]

Messages:
${messages.map(m => `${m.sender}: ${m.text}`).join('\n\n')}

Keep it concise but capture all important points.`
    })
    
    return {
      summary: result.text,
      messageCount: messages.length,
      dateRange: dateRange || { start: null, end: null },
      generatedAt: Date.now()
    }
  })
  
  return summary
})
```

**React Native UI:**
```typescript
// app/features/ai/ThreadSummary.tsx
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { AIService } from '../../services/ai.service'

export const ThreadSummary: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const [summary, setSummary] = useState<string>('')
  const [loading, setLoading] = useState(false)
  
  const handleSummarize = async (days?: number) => {
    setLoading(true)
    try {
      const dateRange = days ? {
        start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      } : undefined
      
      const result = await AIService.summarizeThread(conversationId, dateRange)
      setSummary(result.summary)
    } catch (error) {
      console.error('Summarization error:', error)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
        Thread Summary
      </Text>
      
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        <TouchableOpacity onPress={() => handleSummarize(1)}>
          <Text style={{ color: 'blue' }}>Last 24h</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSummarize(7)}>
          <Text style={{ color: 'blue' }}>Last Week</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSummarize()}>
          <Text style={{ color: 'blue' }}>All Time</Text>
        </TouchableOpacity>
      </View>
      
      {loading && <ActivityIndicator />}
      {summary && <Text>{summary}</Text>}
    </View>
  )
}
```

---

### Day 5: Action Item Extraction (Feature 2)

**Implementation - Queries by Date Range:**
```typescript
// functions/src/ai/actionItems.ts
import { onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import * as admin from 'firebase-admin'

const openaiKey = defineSecret('OPENAI_API_KEY')

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

export const extractActions = onCall({
  secrets: [openaiKey],
  memory: '2GB',
  timeoutSeconds: 60,
}, async (request) => {
  const { conversationId, dateRange } = request.data
  const userId = request.auth?.uid
  
  if (!userId) {
    throw new Error('Unauthorized')
  }
  
  const db = admin.firestore()
  
  // Query messages by date range
  let query = db.collection('messages')
    .where('conversationId', '==', conversationId)
    .orderBy('timestamp', 'desc')
  
  if (dateRange?.start) {
    query = query.where('timestamp', '>=', new Date(dateRange.start).getTime())
  }
  if (dateRange?.end) {
    query = query.where('timestamp', '<=', new Date(dateRange.end).getTime())
  }
  
  const snapshot = await query.limit(200).get()
  const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  
  if (messages.length === 0) {
    return { actionItems: [] }
  }
  
  const result = await generateObject({
    model: openai('gpt-4o'),
    schema: ActionItemSchema,
    prompt: `Extract action items from this team conversation.

Look for patterns:
- "I'll handle X", "I can do Y"
- "Can you do Z?", "@person please..."
- "Someone needs to...", "We should..."
- "TODO:", direct questions requiring action

Messages:
${messages.map((m, i) => `[${i}] ${m.sender}: ${m.text}`).join('\n\n')}

For each action item:
- task: Clear description of what needs to be done
- assignee: Person assigned (or null if unassigned)
- deadline: Any mentioned deadline (or null)
- context: Brief context from conversation
- messageId: The message ID this came from
- confidence: 0-1 score of how confident this is a real action item

Don't extract:
- Completed past actions ("I finished X")
- Hypothetical discussions ("what if we...")
- Rhetorical questions`
  })
  
  // Store action items in Firestore
  const batch = db.batch()
  
  result.object.actionItems.forEach(item => {
    const ref = db.collection('action_items').doc()
    batch.set(ref, {
      ...item,
      conversationId,
      extractedBy: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    })
  })
  
  await batch.commit()
  
  return {
    actionItems: result.object.actionItems,
    count: result.object.actionItems.length
  }
})
```

---

## Week 2: RAG Pipeline + Smart Search (Days 6-10)

### Day 6-7: Batch Embedding System

**Scheduled Function (Every 30 Seconds):**
```typescript
// functions/src/ai/batchEmbedding.ts
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineSecret } from 'firebase-functions/params'
import * as admin from 'firebase-admin'
import { getOpenAIClient } from '../utils/openai'
import { getIndex } from '../utils/pinecone'

const openaiKey = defineSecret('OPENAI_API_KEY')
const pineconeKey = defineSecret('PINECONE_API_KEY')

export const batchEmbedMessages = onSchedule({
  schedule: 'every 30 seconds',
  secrets: [openaiKey, pineconeKey],
  memory: '2GB',
}, async () => {
  const db = admin.firestore()
  
  // Get unembedded messages
  const snapshot = await db.collection('messages')
    .where('embedded', '==', false)
    .limit(100)
    .get()
  
  if (snapshot.empty) {
    console.log('No messages to embed')
    return
  }
  
  console.log(`Embedding ${snapshot.size} messages`)
  
  // Generate embeddings
  const openai = getOpenAIClient()
  const texts = snapshot.docs.map(doc => doc.data().text)
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: texts
  })
  
  // Prepare vectors for Pinecone
  const vectors = snapshot.docs.map((doc, i) => {
    const data = doc.data()
    return {
      id: doc.id,
      values: response.data[i].embedding,
      metadata: {
        userId: data.userId,
        conversationId: data.conversationId,
        timestamp: data.timestamp,
        sender: data.sender,
        text: data.text.substring(0, 500) // Preview only
      }
    }
  })
  
  // Upsert to Pinecone
  const index = getIndex()
  await index.upsert(vectors)
  
  // Mark as embedded in Firestore
  const batch = db.batch()
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      embedded: true,
      embeddedAt: admin.firestore.FieldValue.serverTimestamp()
    })
  })
  await batch.commit()
  
  console.log(`✅ Embedded ${snapshot.size} messages`)
})
```

**One-Time Script for Existing Messages:**
```typescript
// scripts/embed-existing-messages.ts
import * as admin from 'firebase-admin'
import { getOpenAIClient } from '../functions/src/utils/openai'
import { getIndex } from '../functions/src/utils/pinecone'

admin.initializeApp()

async function embedExistingMessages() {
  const db = admin.firestore()
  
  // Query in batches
  const batchSize = 100
  let hasMore = true
  let processed = 0
  
  while (hasMore) {
    const snapshot = await db.collection('messages')
      .where('embedded', '==', false)
      .limit(batchSize)
      .get()
    
    if (snapshot.empty) {
      hasMore = false
      break
    }
    
    const openai = getOpenAIClient()
    const texts = snapshot.docs.map(doc => doc.data().text)
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: texts
    })
    
    const vectors = snapshot.docs.map((doc, i) => {
      const data = doc.data()
      return {
        id: doc.id,
        values: response.data[i].embedding,
        metadata: {
          userId: data.userId,
          conversationId: data.conversationId,
          timestamp: data.timestamp,
          sender: data.sender,
          text: data.text.substring(0, 500)
        }
      }
    })
    
    const index = getIndex()
    await index.upsert(vectors)
    
    const batch = db.batch()
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { embedded: true })
    })
    await batch.commit()
    
    processed += snapshot.size
    console.log(`Progress: ${processed} messages embedded`)
  }
  
  console.log('✅ All messages embedded')
}

embedExistingMessages()
```

---

### Day 8-9: Smart Search with RAG (Feature 3)

**Implementation:**
```typescript
// functions/src/ai/smartSearch.ts
import { onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'
import * as admin from 'firebase-admin'
import { getOpenAIClient } from '../utils/openai'
import { getIndex } from '../utils/pinecone'
import { withCache } from '../utils/cache'

const openaiKey = defineSecret('OPENAI_API_KEY')
const pineconeKey = defineSecret('PINECONE_API_KEY')

export const smartSearch = onCall({
  secrets: [openaiKey, pineconeKey],
  memory: '2GB',
  timeoutSeconds: 60,
}, async (request) => {
  const { query, filters } = request.data
  const userId = request.auth?.uid
  
  if (!userId) {
    throw new Error('Unauthorized')
  }
  
  const cacheKey = `search_${userId}_${query}_${JSON.stringify(filters)}`
  
  const results = await withCache(cacheKey, 10, async () => {
    // Step 1: Generate query embedding
    const openaiClient = getOpenAIClient()
    const embeddingResponse = await openaiClient.embeddings.create({
      model: 'text-embedding-3-large',
      input: query
    })
    const queryEmbedding = embeddingResponse.data[0].embedding
    
    // Step 2: Search Pinecone
    const index = getIndex()
    const pineconeFilters: any = {
      userId: { $eq: userId }
    }
    
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
    
    if (searchResults.matches.length === 0) {
      return { results: [] }
    }
    
    // Step 3: Rerank with GPT-4o
    const reranked = await generateText({
      model: openai('gpt-4o'),
      prompt: `You are a search result ranker. Rank these message results by relevance.
Return only the top 5 most relevant message IDs in order, one per line.

Query: "${query}"

Results:
${searchResults.matches.map((m, i) => 
  `[${i}] ID: ${m.id}, Score: ${m.score?.toFixed(3)}, Text: ${m.metadata?.text}`
).join('\n')}

Return format: Just the IDs, one per line (no brackets, no other text).`
    })
    
    const rankedIds = reranked.text.trim().split('\n').filter(Boolean).slice(0, 5)
    
    // Step 4: Get full message data from Firestore
    const db = admin.firestore()
    const messages = await Promise.all(
      rankedIds.map(async (id) => {
        const doc = await db.collection('messages').doc(id).get()
        if (!doc.exists) return null
        
        const match = searchResults.matches.find(m => m.id === id)
        return {
          messageId: id,
          score: match?.score || 0,
          ...doc.data()
        }
      })
    )
    
    return {
      results: messages.filter(Boolean),
      searchTime: Date.now()
    }
  })
  
  return results
})
```

**React Native UI:**
```typescript
// app/features/ai/SmartSearch.tsx
import React, { useState } from 'react'
import { View, TextInput, FlatList, Text, ActivityIndicator, TouchableOpacity } from 'react-native'
import { AIService } from '../../services/ai.service'

export const SmartSearch: React.FC = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  const handleSearch = async () => {
    if (!query.trim()) return
    
    setLoading(true)
    try {
      const data = await AIService.smartSearch(query)
      setResults(data.results)
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
        placeholder="🔍 Search conversations (e.g., 'database discussion')"
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
              Relevance: {(item.score * 100).toFixed(0)}%
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}
```

---

### Day 10: Decision Tracking (Feature 5)

**Implementation:**
```typescript
// functions/src/ai/decisionTracking.ts
import { onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { z } from 'zod'
import * as admin from 'firebase-admin'

const openaiKey = defineSecret('OPENAI_API_KEY')

const DecisionSchema = z.object({
  decisions: z.array(z.object({
    decision: z.string(),
    rationale: z.string(),
    alternativesConsidered: z.array(z.string()),
    participants: z.array(z.string()),
    messageIds: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  }))
})

export const extractDecisions = onCall({
  secrets: [openaiKey],
  memory: '2GB',
  timeoutSeconds: 60,
}, async (request) => {
  const { conversationId, dateRange } = request.data
  const userId = request.auth?.uid
  
  if (!userId) {
    throw new Error('Unauthorized')
  }
  
  const db = admin.firestore()
  
  // Query messages by date range
  let query = db.collection('messages')
    .where('conversationId', '==', conversationId)
    .orderBy('timestamp', 'desc')
  
  if (dateRange?.start) {
    query = query.where('timestamp', '>=', new Date(dateRange.start).getTime())
  }
  if (dateRange?.end) {
    query = query.where('timestamp', '<=', new Date(dateRange.end).getTime())
  }
  
  const snapshot = await query.limit(200).get()
  const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  
  if (messages.length === 0) {
    return { decisions: [] }
  }
  
  const result = await generateObject({
    model: openai('gpt-4o'),
    schema: DecisionSchema,
    prompt: `Extract decisions made in this team conversation.

Look for patterns:
- "Let's go with X", "We decided to..."
- "The decision is...", "After discussion, we'll..."
- Consensus signals (multiple agreements)
- Poll results, "Everyone agree?"

Messages:
${messages.map((m, i) => `[${i}] ${m.sender}: ${m.text}`).join('\n\n')}

For each decision:
- decision: The actual decision made
- rationale: Why this decision was made
- alternativesConsidered: Other options discussed
- participants: Who was involved
- messageIds: Relevant message IDs
- confidence: 0-1 score

Distinguish:
- Actual decisions vs. proposals
- Team consensus vs. individual opinions
- Serious decisions vs. sarcasm/jokes`
  })
  
  // Store decisions in Firestore
  const batch = db.batch()
  
  result.object.decisions.forEach(item => {
    const ref = db.collection('decisions').doc()
    batch.set(ref, {
      ...item,
      conversationId,
      extractedBy: userId,
      madeAt: Date.now(),
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })
  })
  
  await batch.commit()
  
  return {
    decisions: result.object.decisions,
    count: result.object.decisions.length
  }
})
```

---

## Week 3: Proactive Assistant (Days 11-15)

### Day 11-13: Proactive Agent with RAG

**Implementation:**
```typescript
// functions/src/ai/proactiveAgent.ts
import { onCall } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { openai } from '@ai-sdk/openai'
import { generateText, tool } from 'ai'
import { z } from 'zod'
import * as admin from 'firebase-admin'
import { getOpenAIClient } from '../utils/openai'
import { getIndex } from '../utils/pinecone'

const openaiKey = defineSecret('OPENAI_API_KEY')
const pineconeKey = defineSecret('PINECONE_API_KEY')

// RAG search tool for agent
async function ragSearch(query: string, conversationId: string, userId: string) {
  const openaiClient = getOpenAIClient()
  const embeddingResponse = await openaiClient.embeddings.create({
    model: 'text-embedding-3-large',
    input: query
  })
  
  const index = getIndex()
  const results = await index.query({
    vector: embeddingResponse.data[0].embedding,
    topK: 10,
    filter: {
      userId: { $eq: userId },
      conversationId: { $eq: conversationId }
    },
    includeMetadata: true
  })
  
  return results.matches.map(m => ({
    text: m.metadata?.text,
    score: m.score
  }))
}

export const proactiveAgent = onCall({
  secrets: [openaiKey, pineconeKey],
  memory: '2GB',
  timeoutSeconds: 60,
}, async (request) => {
  const { conversationId, recentMessages, trigger } = request.data
  const userId = request.auth?.uid
  
  if (!userId) {
    throw new Error('Unauthorized')
  }
  
  const agentTools = {
    // Tool 1: Search conversation history (RAG)
    searchConversationHistory: tool({
      description: 'Search past conversation history using semantic search',
      parameters: z.object({
        query: z.string(),
      }),
      execute: async ({ query }) => {
        const results = await ragSearch(query, conversationId, userId)
        return {
          found: results.length,
          messages: results.slice(0, 5)
        }
      }
    }),
    
    // Tool 2: Suggest meeting times
    suggestMeetingTimes: tool({
      description: 'Suggest meeting times based on conversation patterns',
      parameters: z.object({
        participants: z.array(z.string()),
        topic: z.string(),
      }),
      execute: async ({ participants, topic }) => {
        // Simple time suggestions (no calendar API)
        return {
          suggestions: [
            "Tomorrow (Fri) 2:00 PM",
            "Monday 10:00 AM",
            "Tuesday 3:00 PM"
          ],
          reasoning: `Based on discussion about "${topic}" with ${participants.length} people`
        }
      }
    }),
    
    // Tool 3: Check overdue action items
    checkOverdueActions: tool({
      description: 'Check for overdue action items in this conversation',
      parameters: z.object({
        conversationId: z.string(),
      }),
      execute: async ({ conversationId }) => {
        const db = admin.firestore()
        const snapshot = await db.collection('action_items')
          .where('conversationId', '==', conversationId)
          .where('status', '==', 'pending')
          .where('deadline', '<', Date.now())
          .get()
        
        return {
          count: snapshot.size,
          items: snapshot.docs.map(doc => doc.data())
        }
      }
    }),
    
    // Tool 4: Send suggestion to users
    sendSuggestion: tool({
      description: 'Send a proactive suggestion to the conversation',
      parameters: z.object({
        message: z.string(),
        type: z.enum(['meeting', 'reminder', 'context']),
        actions: z.array(z.object({
          label: z.string(),
          action: z.string()
        }))
      }),
      execute: async (params) => {
        const db = admin.firestore()
        await db.collection('proactive_suggestions').add({
          conversationId,
          userId,
          ...params,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'pending'
        })
        return { success: true }
      }
    })
  }
  
  const result = await generateText({
    model: openai('gpt-4o'),
    tools: agentTools,
    maxSteps: 5,
    system: `You are a proactive assistant monitoring team conversations.

You have access to conversation history through semantic search.

Detect when to take action:
1. Meeting scheduling: 3+ people discussing "let's meet", "schedule", "when can we"
2. Overdue items: Action items past deadline with no updates
3. Need context: Someone asks about past decisions or discussions

Use tools to:
- Search past conversation history
- Check for overdue action items
- Suggest meeting times (based on discussion, not calendar)
- Send helpful suggestions

Only suggest when TRULY helpful. Max 1 suggestion per conversation per day.`,
    prompt: `Conversation: ${conversationId}
Trigger: ${trigger}

Recent messages:
${recentMessages.map((m: any) => `${m.sender}: ${m.text}`).join('\n')}

Should I take any proactive action?

If yes:
1. Use searchConversationHistory to find relevant context
2. Use appropriate tools to help
3. Use sendSuggestion to deliver the suggestion

If no:
Simply explain why no action is needed.`
  })
  
  return {
    agentResponse: result.text,
    toolsUsed: result.toolCalls?.map(t => t.toolName) || [],
    processingTime: Date.now()
  }
})
```

**Trigger Detection:**
```typescript
// functions/src/ai/proactiveTriggers.ts
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { getFirestore } from 'firebase-admin/firestore'

export const checkProactiveTriggers = onDocumentCreated(
  'messages/{messageId}',
  async (event) => {
    const message = event.data?.data()
    if (!message) return
    
    const db = getFirestore()
    
    // Get recent messages in conversation
    const snapshot = await db.collection('messages')
      .where('conversationId', '==', message.conversationId)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get()
    
    const recentMessages = snapshot.docs.map(doc => doc.data())
    
    // Simple rule-based triggers
    const schedulingKeywords = ['meeting', 'schedule', 'meet', 'call', 'sync', 'when can']
    const hasSchedulingDiscussion = recentMessages.some(m =>
      schedulingKeywords.some(kw => m.text.toLowerCase().includes(kw))
    )
    
    if (hasSchedulingDiscussion) {
      // Get conversation to check participant count
      const convoDoc = await db.collection('conversations').doc(message.conversationId).get()
      const convo = convoDoc.data()
      
      if (convo && convo.participants.length >= 3) {
        // Trigger proactive agent
        console.log('Triggering proactive agent for meeting scheduling')
        
        // Call proactive agent (you'd implement this call)
        // For now, just log the trigger
      }
    }
  }
)
```

---

### Day 14: UI Integration

**Proactive Suggestion Component:**
```typescript
// app/features/ai/ProactiveSuggestion.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import firestore from '@react-native-firebase/firestore'

export const ProactiveSuggestions: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const [suggestions, setSuggestions] = useState<any[]>([])
  
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('proactive_suggestions')
      .where('conversationId', '==', conversationId)
      .where('status', '==', 'pending')
      .onSnapshot(snapshot => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setSuggestions(data)
      })
    
    return unsubscribe
  }, [conversationId])
  
  const handleAccept = async (suggestionId: string) => {
    await firestore().collection('proactive_suggestions').doc(suggestionId).update({
      status: 'accepted'
    })
  }
  
  const handleDismiss = async (suggestionId: string) => {
    await firestore().collection('proactive_suggestions').doc(suggestionId).update({
      status: 'dismissed'
    })
  }
  
  if (suggestions.length === 0) return null
  
  return (
    <View style={styles.container}>
      {suggestions.map(suggestion => (
        <View key={suggestion.id} style={styles.suggestionCard}>
          <Text style={styles.title}>💡 AI Suggestion</Text>
          <Text style={styles.message}>{suggestion.message}</Text>
          
          <View style={styles.actions}>
            {suggestion.actions.map((action: any, index: number) => (
              <TouchableOpacity
                key={index}
                style={styles.actionButton}
                onPress={() => handleAccept(suggestion.id)}
              >
                <Text style={styles.actionText}>{action.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => handleDismiss(suggestion.id)}
            >
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  suggestionCard: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
  dismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dismissText: {
    color: '#666',
  },
})
```

---

## Week 4: Polish & Testing (Days 16-20)

### Day 16: Performance Optimization

**Caching Strategy:**
```typescript
// Already implemented in withCache utility
// Add more aggressive caching:

// functions/src/ai/threadSummary.ts - increase TTL
const summary = await withCache(cacheKey, 15, async () => { // 15 minutes

// functions/src/ai/smartSearch.ts - cache common queries
const commonQueries = ['recent decisions', 'action items', 'meeting notes']
```

**Cost Optimization:**
- Use GPT-4o-mini for priority detection ✅
- Use GPT-4o-mini for summaries <50 messages ✅
- Use GPT-4o only for: reranking, decision extraction, agent
- Cache aggressively (5-15 minute TTLs)

---

### Day 17-18: Testing

**Test Checklist:**
- [ ] Priority detection accuracy >85%
- [ ] Thread summarization captures key points
- [ ] Action items extracted correctly
- [ ] Smart search finds relevant messages (RAG working)
- [ ] Decisions tracked accurately
- [ ] Proactive agent triggers appropriately
- [ ] Response times <2s (simple), <15s (complex)
- [ ] Error handling works
- [ ] Offline behavior (shows "AI needs internet")

---

### Day 19-20: Integration & Polish

**AI Service Wrapper:**
```typescript
// app/services/ai.service.ts
import functions from '@react-native-firebase/functions'
import NetInfo from '@react-native-community/netinfo'

export class AIService {
  static async checkOnline() {
    const state = await NetInfo.fetch()
    if (!state.isConnected) {
      throw new Error('AI features require internet connection')
    }
  }
  
  static async detectPriority(messageText: string, context: any) {
    await this.checkOnline()
    const fn = functions().httpsCallable('detectPriority')
    const result = await fn({ messageText, conversationContext: context })
    return result.data
  }
  
  static async summarizeThread(conversationId: string, dateRange?: any) {
    await this.checkOnline()
    const fn = functions().httpsCallable('summarizeThread')
    const result = await fn({ conversationId, dateRange })
    return result.data
  }
  
  static async extractActions(conversationId: string, dateRange?: any) {
    await this.checkOnline()
    const fn = functions().httpsCallable('extractActions')
    const result = await fn({ conversationId, dateRange })
    return result.data
  }
  
  static async smartSearch(query: string, filters?: any) {
    await this.checkOnline()
    const fn = functions().httpsCallable('smartSearch')
    const result = await fn({ query, filters })
    return result.data
  }
  
  static async extractDecisions(conversationId: string, dateRange?: any) {
    await this.checkOnline()
    const fn = functions().httpsCallable('extractDecisions')
    const result = await fn({ conversationId, dateRange })
    return result.data
  }
}
```

---

## Deployment Checklist

### Firebase Functions
```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:detectPriority
firebase deploy --only functions:batchEmbedMessages
```

### Firestore Indexes
Create these composite indexes:
- `messages`: `conversationId` (ASC) + `timestamp` (DESC)
- `action_items`: `conversationId` (ASC) + `status` (ASC) + `createdAt` (DESC)
- `decisions`: `conversationId` (ASC) + `status` (ASC) + `madeAt` (DESC)

---

## Success Criteria (Rubric Alignment)

### Required AI Features (15 points)
1. ✅ Thread Summarization - Queries by date range
2. ✅ Action Item Extraction - Queries by date range
3. ✅ Smart Search - Full RAG pipeline
4. ✅ Priority Detection - Real-time classification
5. ✅ Decision Tracking - Extracts from conversations

### Advanced AI Capability (10 points)
✅ Proactive Assistant:
- Monitors conversations intelligently
- Triggers suggestions at right moments
- Uses RAG to access conversation history
- Learns from user feedback (accept/dismiss)
- Suggests meeting times (no calendar sync needed)

### Technical Implementation (5 points)
- ✅ API keys secured (Firebase secrets)
- ✅ Function calling/tool use (AI SDK tools)
- ✅ RAG pipeline (Pinecone + embeddings)
- ✅ Clean code structure

---

## Key Features

**What Makes This Plan Work:**
1. **Firebase-only** - Simpler architecture, easier to maintain
2. **Batch embedding** - Every 5 minutes, not real-time
3. **Date range queries** - Features query Firestore directly
4. **RAG for search & agent** - Meets rubric requirements
5. **No calendar APIs** - Text-based meeting suggestions
6. **AI SDK throughout** - Clean, TypeScript-native code
7. **10 users, 100-300 msgs/day** - Very manageable costs

**Estimated Costs (10 users, 300 msgs/day):**
- OpenAI embeddings: ~$0.50/month
- OpenAI GPT calls: ~$5-10/month
- Pinecone: Free tier (100K vectors)
- Firebase Functions: Free tier sufficient
- **Total: ~$5-10/month**

---

## Next Steps

1. **Set up Pinecone** (you have OpenAI already)
2. **Install dependencies** in functions/
3. **Create utility files** (openai.ts, pinecone.ts, cache.ts)
4. **Implement features** in order (priority → summary → actions → search → decisions → agent)
5. **Test thoroughly**
6. **Deploy to Firebase**

Ready to start? Let's begin with the Pinecone setup! 🚀

