# MessageAI: Technical Specification for AI Coding Assistants

**Version:** 2.0 - Firebase-Only Architecture  
**Last Updated:** October 24, 2025  
**Purpose:** Complete technical specifications, schemas, interfaces, and code templates for Firebase-only MessageAI AI features.

**🔥 ARCHITECTURE:** This document describes the **Firebase-only architecture** (no AWS Lambda). All AI processing happens within Firebase Cloud Functions.

---

## Table of Contents

1. [Complete Project Structure](#complete-project-structure)
2. [Data Models & TypeScript Interfaces](#data-models--typescript-interfaces)
3. [Database Schemas](#database-schemas)
4. [API Contracts](#api-contracts)
5. [Configuration Files](#configuration-files)
6. [Code Templates](#code-templates)
7. [Testing Specifications](#testing-specifications)
8. [Deployment Scripts](#deployment-scripts)
9. [Environment Variables](#environment-variables)
10. [Common Patterns & Utilities](#common-patterns--utilities)

---

## Complete Project Structure

### Full Directory Tree

```
MessageAI/
├── functions/                          # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts                   # Main entry point
│   │   ├── ai/                        # AI feature functions
│   │   │   ├── priorityDetection.ts   # Feature 4: Priority detection
│   │   │   ├── threadSummary.ts      # Feature 1: Thread summarization
│   │   │   ├── actionItems.ts        # Feature 2: Action item extraction
│   │   │   ├── decisionTracking.ts   # Feature 5: Decision tracking
│   │   │   ├── smartSearch.ts        # Feature 3: Smart search (RAG)
│   │   │   ├── proactiveAgent.ts     # Advanced: Proactive assistant
│   │   │   ├── batchEmbedding.ts     # Background: Batch embedding
│   │   │   └── ragPipeline.ts        # RAG utilities
│   │   └── utils/                     # Shared utilities
│   │       ├── openai.ts             # OpenAI client
│   │       ├── pinecone.ts           # Pinecone client
│   │       └── cache.ts              # Caching utilities
│   ├── package.json
│   └── tsconfig.json
│
├── app/ (existing React Native app)
│   ├── features/
│   │   └── ai/
│   │       ├── AIAssistant.tsx        # Main AI tab
│   │       ├── ThreadSummary.tsx     # Summary UI
│   │       ├── ActionItems.tsx       # Action items list
│   │       ├── SmartSearch.tsx       # Search UI
│   │       ├── Decisions.tsx         # Decisions list
│   │       └── ProactiveSuggestion.tsx # Suggestions
│   └── services/
│       └── ai.service.ts             # AI API wrapper
│
├── scripts/
│   ├── create-pinecone-index.ts      # One-time setup
│   └── embed-existing-messages.ts   # Migration script
│
├── firebase.json                     # Firebase configuration
├── firestore.rules                   # Firestore security rules
├── firestore.indexes.json           # Firestore indexes
└── docs/
    └── ai-specs/
        ├── CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md
        ├── messageai-architecture.md
        ├── messageai-persona-prd.md
        └── messageai-technical-spec.md (this file)
```

---

## Data Models & TypeScript Interfaces

### Core Data Models

```typescript
// types/index.ts

export interface Message {
  id: string
  text: string
  sender: string
  senderId: string
  conversationId: string
  timestamp: number
  messageType: 'text' | 'image' | 'file' | 'system'
  priority?: 'urgent' | 'important' | 'normal'
  priorityConfidence?: number
  priorityReason?: string
  embedded?: boolean
  embeddedAt?: number
  metadata?: {
    replyTo?: string
    mentions?: string[]
    reactions?: Record<string, string[]>
  }
}

export interface Conversation {
  id: string
  name: string
  type: 'dm' | 'group'
  participants: string[]
  createdBy: string
  createdAt: number
  lastMessageAt: number
  lastMessage?: string
  settings?: {
    aiEnabled: boolean
    priorityDetection: boolean
    proactiveSuggestions: boolean
  }
}

export interface User {
  id: string
  email: string
  displayName: string
  photoURL?: string
  preferences?: {
    aiFeatures: {
      enabled: boolean
      priorityDetection: boolean
      proactiveSuggestions: boolean
      quietHours: {
        start: string // "22:00"
        end: string   // "07:00"
      }
    }
    notifications: {
      urgentMessages: boolean
      aiSuggestions: boolean
      actionItemReminders: boolean
    }
  }
  createdAt: number
  lastActiveAt: number
}

export interface ActionItem {
  id: string
  task: string
  assignee: string | null
  deadline: string | null
  context: string
  messageId: string
  conversationId: string
  extractedBy: string
  confidence: number
  status: 'pending' | 'completed' | 'cancelled'
  createdAt: number
  completedAt?: number
  completedBy?: string
}

export interface Decision {
  id: string
  decision: string
  rationale: string
  alternativesConsidered: string[]
  participants: string[]
  messageIds: string[]
  conversationId: string
  extractedBy: string
  confidence: number
  status: 'active' | 'superseded' | 'reversed'
  madeAt: number
  supersededBy?: string
  createdAt: number
}

export interface ProactiveSuggestion {
  id: string
  conversationId: string
  userId: string
  message: string
  type: 'meeting' | 'reminder' | 'context' | 'conflict'
  actions: Array<{
    label: string
    action: string
    payload?: any
  }>
  status: 'pending' | 'accepted' | 'dismissed'
  createdAt: number
  respondedAt?: number
}

export interface SearchResult {
  messageId: string
  score: number
  text: string
  sender: string
  timestamp: number
  conversationId: string
  context?: {
    before: string[]
    after: string[]
  }
}

export interface ThreadSummary {
  summary: string
  messageCount: number
  dateRange: {
    start: string | null
    end: string | null
  }
  generatedAt: number
  keyTopics: string[]
  decisions: string[]
  openQuestions: string[]
}

export interface PriorityDetection {
  priority: 'urgent' | 'important' | 'normal'
  confidence: number
  reason: string
  detectedAt: number
  signals: {
    urgencyKeywords: string[]
    directMention: boolean
    questionPattern: boolean
    timePressure: boolean
  }
}
```

### API Request/Response Types

```typescript
// API Request Types
export interface SummarizeThreadRequest {
  conversationId: string
  dateRange?: {
    start: string
    end: string
  }
}

export interface ExtractActionsRequest {
  conversationId: string
  dateRange?: {
    start: string
    end: string
  }
}

export interface SmartSearchRequest {
  query: string
  filters?: {
    conversationId?: string
    dateRange?: {
      start: string
      end: string
    }
    sender?: string
  }
}

export interface ProactiveAgentRequest {
  conversationId: string
  recentMessages: Message[]
  trigger: string
}

// API Response Types
export interface SummarizeThreadResponse {
  summary: string
  messageCount: number
  dateRange: {
    start: string | null
    end: string | null
  }
  generatedAt: number
}

export interface ExtractActionsResponse {
  actionItems: ActionItem[]
  count: number
}

export interface SmartSearchResponse {
  results: SearchResult[]
  searchTime: number
  totalMatches: number
}

export interface ProactiveAgentResponse {
  agentResponse: string
  toolsUsed: string[]
  processingTime: number
  suggestion?: ProactiveSuggestion
}
```

### Zod Schemas for Validation

```typescript
import { z } from 'zod'

// Priority Detection Schema
export const PriorityDetectionSchema = z.object({
  priority: z.enum(['urgent', 'important', 'normal']),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
  detectedAt: z.number(),
  signals: z.object({
    urgencyKeywords: z.array(z.string()),
    directMention: z.boolean(),
    questionPattern: z.boolean(),
    timePressure: z.boolean()
  })
})

// Action Item Schema
export const ActionItemSchema = z.object({
  actionItems: z.array(z.object({
    task: z.string(),
    assignee: z.string().nullable(),
    deadline: z.string().nullable(),
    context: z.string(),
    messageId: z.string(),
    confidence: z.number().min(0).max(1)
  }))
})

// Decision Schema
export const DecisionSchema = z.object({
  decisions: z.array(z.object({
    decision: z.string(),
    rationale: z.string(),
    alternativesConsidered: z.array(z.string()),
    participants: z.array(z.string()),
    messageIds: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  }))
})

// Thread Summary Schema
export const ThreadSummarySchema = z.object({
  summary: z.string(),
  messageCount: z.number(),
  dateRange: z.object({
    start: z.string().nullable(),
    end: z.string().nullable()
  }),
  generatedAt: z.number(),
  keyTopics: z.array(z.string()),
  decisions: z.array(z.string()),
  openQuestions: z.array(z.string())
})

// Search Result Schema
export const SearchResultSchema = z.object({
  results: z.array(z.object({
    messageId: z.string(),
    score: z.number(),
    text: z.string(),
    sender: z.string(),
    timestamp: z.number(),
    conversationId: z.string(),
    context: z.object({
      before: z.array(z.string()),
      after: z.array(z.string())
    }).optional()
  })),
  searchTime: z.number(),
  totalMatches: z.number()
})
```

---

## Database Schemas

### Firestore Collections Structure

```typescript
// Firestore Collections
interface FirestoreCollections {
  // Core collections
  users: User
  conversations: Conversation
  messages: Message
  
  // AI-generated collections
  action_items: ActionItem
  decisions: Decision
  proactive_suggestions: ProactiveSuggestion
  
  // System collections
  ai_cache: {
    id: string
    value: any
    createdAt: number
    expiresAt: number
  }
  rate_limits: {
    id: string // format: userId_date
    count: number
    expiresAt: number
  }
  ai_usage: {
    id: string
    userId: string
    feature: string
    timestamp: number
    cost: number
    tokens: number
  }
}
```

### Firestore Indexes (firestore.indexes.json)

```json
{
  "indexes": [
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "conversationId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "embedded",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "priority",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "action_items",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "conversationId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "action_items",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "assignee",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "deadline",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "decisions",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "conversationId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "madeAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "proactive_suggestions",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "conversationId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "ai_usage",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "timestamp",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### Firestore Security Rules (firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Messages: users can read messages from conversations they're in
    match /messages/{messageId} {
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/conversations/$(resource.data.conversationId)) &&
        request.auth.uid in get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.participants;
      allow create: if request.auth != null && 
        request.auth.uid == resource.data.senderId &&
        exists(/databases/$(database)/documents/conversations/$(resource.data.conversationId)) &&
        request.auth.uid in get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.participants;
    }
    
    // Conversations: users can read conversations they're in
    match /conversations/{conversationId} {
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      allow create: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    // Action items: users can read from conversations they're in
    match /action_items/{actionItemId} {
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/conversations/$(resource.data.conversationId)) &&
        request.auth.uid in get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.participants;
      allow update: if request.auth != null && 
        request.auth.uid == resource.data.assignee;
    }
    
    // Decisions: users can read from conversations they're in
    match /decisions/{decisionId} {
      allow read: if request.auth != null && 
        exists(/databases/$(database)/documents/conversations/$(resource.data.conversationId)) &&
        request.auth.uid in get(/databases/$(database)/documents/conversations/$(resource.data.conversationId)).data.participants;
    }
    
    // Proactive suggestions: users can read their own suggestions
    match /proactive_suggestions/{suggestionId} {
      allow read, update: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // System collections: only Cloud Functions can write
    match /ai_cache/{cacheId} {
      allow read: if request.auth != null;
      allow write: if false; // Only Cloud Functions
    }
    
    match /rate_limits/{limitId} {
      allow read, write: if false; // Only Cloud Functions
    }
    
    match /ai_usage/{usageId} {
      allow read: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow write: if false; // Only Cloud Functions
    }
  }
}
```

---

## API Contracts

### Firebase Cloud Functions API

```typescript
// functions/src/index.ts
import { onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'

// AI Feature Functions
export { detectPriority } from './ai/priorityDetection'
export { summarizeThread } from './ai/threadSummary'
export { extractActions } from './ai/actionItems'
export { extractDecisions } from './ai/decisionTracking'
export { smartSearch } from './ai/smartSearch'
export { proactiveAgent } from './ai/proactiveAgent'

// Background Functions
export { batchEmbedMessages } from './ai/batchEmbedding'

// Trigger Functions
export { detectPriorityOnMessage } from './ai/priorityDetection'
export { checkProactiveTriggers } from './ai/proactiveTriggers'
```

### Function Signatures

```typescript
// Priority Detection
export const detectPriority = onCall({
  secrets: [openaiKey],
  memory: '1GB',
}, async (request: {
  data: {
    messageText: string
    conversationContext: {
      type: string
      participantCount: number
    }
  }
  auth?: { uid: string }
}) => Promise<PriorityDetection>

// Thread Summarization
export const summarizeThread = onCall({
  secrets: [openaiKey],
  memory: '2GB',
  timeoutSeconds: 60,
}, async (request: {
  data: {
    conversationId: string
    dateRange?: {
      start: string
      end: string
    }
  }
  auth?: { uid: string }
}) => Promise<SummarizeThreadResponse>

// Action Item Extraction
export const extractActions = onCall({
  secrets: [openaiKey],
  memory: '2GB',
  timeoutSeconds: 60,
}, async (request: {
  data: {
    conversationId: string
    dateRange?: {
      start: string
      end: string
    }
  }
  auth?: { uid: string }
}) => Promise<ExtractActionsResponse>

// Smart Search
export const smartSearch = onCall({
  secrets: [openaiKey, pineconeKey],
  memory: '2GB',
  timeoutSeconds: 60,
}, async (request: {
  data: {
    query: string
    filters?: {
      conversationId?: string
      dateRange?: {
        start: string
        end: string
      }
      sender?: string
    }
  }
  auth?: { uid: string }
}) => Promise<SmartSearchResponse>

// Decision Tracking
export const extractDecisions = onCall({
  secrets: [openaiKey],
  memory: '2GB',
  timeoutSeconds: 60,
}, async (request: {
  data: {
    conversationId: string
    dateRange?: {
      start: string
      end: string
    }
  }
  auth?: { uid: string }
}) => Promise<{
  decisions: Decision[]
  count: number
}>

// Proactive Agent
export const proactiveAgent = onCall({
  secrets: [openaiKey, pineconeKey],
  memory: '2GB',
  timeoutSeconds: 60,
}, async (request: {
  data: {
    conversationId: string
    recentMessages: Message[]
    trigger: string
  }
  auth?: { uid: string }
}) => Promise<ProactiveAgentResponse>

// Batch Embedding (Scheduled)
export const batchEmbedMessages = onSchedule({
  schedule: 'every 30 seconds',
  secrets: [openaiKey, pineconeKey],
  memory: '2GB',
}, async () => Promise<void>)
```

---

## Configuration Files

### Firebase Configuration (firebase.json)

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20",
    "memory": "2GB",
    "timeout": "540s"
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  }
}
```

### Functions Package.json

```json
{
  "name": "messageai-functions",
  "version": "1.0.0",
  "description": "MessageAI Firebase Cloud Functions",
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "ai": "^3.0.0",
    "@ai-sdk/openai": "^0.0.66",
    "openai": "^4.0.0",
    "@pinecone-database/pinecone": "^2.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### TypeScript Configuration (functions/tsconfig.json)

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "compileOnSave": true,
  "include": [
    "src"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

---

## Code Templates

### OpenAI Client Utility

```typescript
// functions/src/utils/openai.ts
import OpenAI from 'openai'
import { defineSecret } from 'firebase-functions/params'

const openaiKey = defineSecret('OPENAI_API_KEY')

export const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: openaiKey.value()
  })
}

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const client = getOpenAIClient()
  const response = await client.embeddings.create({
    model: 'text-embedding-3-large',
    input: text
  })
  return response.data[0].embedding
}

export const generateText = async (
  model: 'gpt-4o' | 'gpt-4o-mini',
  prompt: string,
  maxTokens?: number
): Promise<string> => {
  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens || 1000,
    temperature: 0.1
  })
  return response.choices[0]?.message?.content || ''
}
```

### Pinecone Client Utility

```typescript
// functions/src/utils/pinecone.ts
import { Pinecone } from '@pinecone-database/pinecone'
import { defineSecret } from 'firebase-functions/params'

const pineconeKey = defineSecret('PINECONE_API_KEY')

export const getPineconeClient = () => {
  return new Pinecone({
    apiKey: pineconeKey.value()
  })
}

export const getIndex = () => {
  const client = getPineconeClient()
  return client.index('messageai-conversations')
}

export const upsertVectors = async (vectors: Array<{
  id: string
  values: number[]
  metadata: Record<string, any>
}>) => {
  const index = getIndex()
  return await index.upsert(vectors)
}

export const queryVectors = async (
  vector: number[],
  topK: number = 20,
  filter?: Record<string, any>
) => {
  const index = getIndex()
  return await index.query({
    vector,
    topK,
    filter,
    includeMetadata: true
  })
}
```

### Caching Utility

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

export const generateCacheKey = (
  prefix: string,
  ...params: (string | number)[]
): string => {
  return `${prefix}_${params.join('_')}`
}
```

### Rate Limiting Utility

```typescript
// functions/src/utils/rateLimit.ts
import * as admin from 'firebase-admin'

export const checkRateLimit = async (
  userId: string,
  limit: number = 100,
  windowHours: number = 24
): Promise<{ allowed: boolean; count: number; resetAt: number }> => {
  const db = admin.firestore()
  const today = new Date().toISOString().split('T')[0]
  const counterRef = db.collection('rate_limits').doc(`${userId}_${today}`)
  
  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef)
    const data = doc.exists ? doc.data() : { count: 0 }
    const count = data.count || 0
    
    if (count >= limit) {
      return {
        allowed: false,
        count,
        resetAt: Date.now() + (windowHours * 60 * 60 * 1000)
      }
    }
    
    transaction.set(counterRef, {
      count: count + 1,
      expiresAt: Date.now() + (windowHours * 60 * 60 * 1000)
    })
    
    return {
      allowed: true,
      count: count + 1,
      resetAt: Date.now() + (windowHours * 60 * 60 * 1000)
    }
  })
  
  return result
}
```

---

## Testing Specifications

### Unit Test Template

```typescript
// functions/src/__tests__/ai/priorityDetection.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals'
import { detectPriority } from '../ai/priorityDetection'

describe('Priority Detection', () => {
  beforeEach(() => {
    // Mock Firebase admin
    jest.mock('firebase-admin')
  })

  it('should detect urgent messages', async () => {
    const result = await detectPriority({
      data: {
        messageText: 'URGENT: Production is down!',
        conversationContext: {
          type: 'group',
          participantCount: 5
        }
      },
      auth: { uid: 'test-user' }
    } as any)

    expect(result.data.priority).toBe('urgent')
    expect(result.data.confidence).toBeGreaterThan(0.8)
  })

  it('should detect important messages', async () => {
    const result = await detectPriority({
      data: {
        messageText: '@alex Can you review this PR?',
        conversationContext: {
          type: 'dm',
          participantCount: 2
        }
      },
      auth: { uid: 'test-user' }
    } as any)

    expect(result.data.priority).toBe('important')
    expect(result.data.confidence).toBeGreaterThan(0.7)
  })

  it('should classify normal messages', async () => {
    const result = await detectPriority({
      data: {
        messageText: 'Thanks for the update!',
        conversationContext: {
          type: 'group',
          participantCount: 3
        }
      },
      auth: { uid: 'test-user' }
    } as any)

    expect(result.data.priority).toBe('normal')
  })
})
```

### Integration Test Template

```typescript
// functions/src/__tests__/integration/ragPipeline.test.ts
import { describe, it, expect } from '@jest/globals'
import { smartSearch } from '../ai/smartSearch'

describe('RAG Pipeline Integration', () => {
  it('should perform end-to-end search', async () => {
    // This would require actual Pinecone setup
    const result = await smartSearch({
      data: {
        query: 'database migration discussion',
        filters: {
          dateRange: {
            start: '2025-10-01T00:00:00Z',
            end: '2025-10-31T23:59:59Z'
          }
        }
      },
      auth: { uid: 'test-user' }
    } as any)

    expect(result.data.results).toBeDefined()
    expect(result.data.results.length).toBeGreaterThan(0)
    expect(result.data.searchTime).toBeLessThan(3000) // <3 seconds
  })
})
```

### Test Configuration (jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

---

## Deployment Scripts

### Firebase Deployment

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Deploying MessageAI AI Features..."

# Build functions
echo "📦 Building functions..."
cd functions
npm run build

# Deploy to Firebase
echo "🔥 Deploying to Firebase..."
firebase deploy --only functions

# Verify deployment
echo "✅ Verifying deployment..."
firebase functions:list

echo "🎉 Deployment complete!"
```

### Environment Setup

```bash
#!/bin/bash
# setup.sh

echo "🔧 Setting up MessageAI AI Features..."

# Install dependencies
echo "📦 Installing dependencies..."
cd functions
npm install

# Set up secrets
echo "🔐 Setting up secrets..."
echo "Enter your OpenAI API key:"
read -s OPENAI_KEY
firebase functions:secrets:set OPENAI_API_KEY

echo "Enter your Pinecone API key:"
read -s PINECONE_KEY
firebase functions:secrets:set PINECONE_API_KEY

# Create Firestore indexes
echo "📊 Creating Firestore indexes..."
firebase firestore:indexes

echo "✅ Setup complete!"
```

---

## Environment Variables

### Firebase Secrets

```bash
# Required secrets (set via Firebase CLI)
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set PINECONE_API_KEY

# Optional secrets
firebase functions:secrets:set PINECONE_ENVIRONMENT
firebase functions:secrets:set PINECONE_INDEX_NAME
```

### Local Development (.env.local)

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Pinecone
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=messageai-conversations

# Firebase (for local emulator)
FIREBASE_PROJECT_ID=messageai-dev
```

---

## Common Patterns & Utilities

### Error Handling Pattern

```typescript
export const handleAIError = (error: any, context: string) => {
  console.error(`AI Error in ${context}:`, error)
  
  if (error.code === 'rate_limit_exceeded') {
    return {
      error: 'Rate limit exceeded. Please try again later.',
      code: 'RATE_LIMIT'
    }
  }
  
  if (error.code === 'insufficient_quota') {
    return {
      error: 'AI service temporarily unavailable.',
      code: 'QUOTA_EXCEEDED'
    }
  }
  
  return {
    error: 'AI processing failed. Please try again.',
    code: 'AI_ERROR'
  }
}
```

### Response Formatting

```typescript
export const formatAIResponse = <T>(
  data: T,
  processingTime: number,
  cached: boolean = false
) => {
  return {
    data,
    metadata: {
      processingTime,
      cached,
      timestamp: Date.now()
    }
  }
}
```

### Validation Pattern

```typescript
export const validateRequest = <T>(
  data: any,
  schema: z.ZodSchema<T>
): T => {
  try {
    return schema.parse(data)
  } catch (error) {
    throw new Error(`Invalid request data: ${error}`)
  }
}
```

---

## Summary

This technical specification provides everything needed to implement MessageAI's AI features using Firebase-only architecture:

✅ **Complete TypeScript interfaces**  
✅ **Firestore schemas and indexes**  
✅ **API contracts for all functions**  
✅ **Configuration files**  
✅ **Code templates and utilities**  
✅ **Testing specifications**  
✅ **Deployment scripts**  
✅ **Error handling patterns**  

**All content is Firebase-only and accurate for the current architecture.**

---

**End of Technical Specification**