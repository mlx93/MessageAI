# MessageAI: Technical Specification for AI Coding Assistants

**⚠️ NOTE: This document was created for the ORIGINAL hybrid Firebase + AWS Lambda architecture.**

**The project structure, Lambda directories, and deployment scripts in this document reference AWS Lambda, which is NO LONGER USED. The Firebase-only implementation uses similar patterns but all within Firebase Cloud Functions.**

**✅ For current implementation guidance, see `CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md`**

**However, the following sections are still valid:**
- Data Models & TypeScript Interfaces
- Database Schemas
- API Contracts (adjust Lambda → Firebase Functions)
- Configuration Files (exclude Lambda-specific ones)

---

**Purpose:** This document provides complete technical specifications, schemas, interfaces, and code templates needed to build MessageAI's AI features. Designed for AI coding assistants (Cursor, GitHub Copilot, etc.) to have all necessary context.

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
messageai/
├── .github/
│   └── workflows/
│       ├── deploy-lambda.yml
│       ├── deploy-firebase.yml
│       └── test.yml
│
├── functions/                          # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts                   # Main entry point
│   │   ├── ai/
│   │   │   ├── embedMessages.ts       # Message embedding trigger
│   │   │   ├── smartSearch.ts         # Smart search callable
│   │   │   ├── summarizeThread.ts     # Thread summarization
│   │   │   ├── extractActions.ts      # Action item extraction
│   │   │   ├── detectPriority.ts      # Priority detection
│   │   │   ├── extractDecisions.ts    # Decision tracking
│   │   │   ├── proactiveTriggers.ts   # Proactive agent triggers
│   │   │   └── cacheWarmup.ts         # Cache warming scheduled job
│   │   ├── types/
│   │   │   └── index.ts               # Shared TypeScript types
│   │   └── utils/
│   │       ├── cache.ts               # Firestore cache utility
│   │       └── rateLimit.ts           # Rate limiting utility
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.local
│
├── lambda/                             # AWS Lambda Functions
│   ├── shared/                        # Shared utilities
│   │   ├── openai.ts                 # OpenAI client wrapper
│   │   ├── pinecone.ts               # Pinecone client wrapper
│   │   ├── cache.ts                  # Firestore cache utility
│   │   ├── firestore.ts              # Firestore client
│   │   └── types.ts                  # Shared types
│   │
│   ├── embed-message/                # Message embedding
│   │   ├── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── smart-search/                 # RAG search
│   │   ├── index.ts
│   │   ├── reranker.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── summarize-thread/             # Thread summarization
│   │   ├── index.ts
│   │   ├── prompts.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── extract-actions/              # Action item extraction
│   │   ├── index.ts
│   │   ├── schemas.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── detect-priority/              # Priority detection
│   │   ├── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── extract-decisions/            # Decision tracking
│   │   ├── index.ts
│   │   ├── schemas.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── proactive-agent/              # Proactive assistant
│   │   ├── index.ts
│   │   ├── tools.ts
│   │   ├── triggers.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── scripts/
│       ├── deploy-all.js             # Deployment automation
│       └── package-lambda.sh         # Lambda packaging script
│
├── mobile/                            # React Native App
│   ├── src/
│   │   ├── features/
│   │   │   ├── ai/
│   │   │   │   ├── AIAssistant.tsx           # Main AI tab
│   │   │   │   ├── SmartSearch.tsx           # Smart search UI
│   │   │   │   ├── ThreadSummary.tsx         # Summary display
│   │   │   │   ├── ActionItems.tsx           # Action items list
│   │   │   │   ├── ActionItemDetail.tsx      # Action item detail
│   │   │   │   ├── Decisions.tsx             # Decisions list
│   │   │   │   ├── DecisionDetail.tsx        # Decision detail
│   │   │   │   ├── PriorityMessages.tsx      # Priority inbox
│   │   │   │   ├── ProactiveSuggestion.tsx   # Suggestion cards
│   │   │   │   └── AIContextMenu.tsx         # Long-press menu
│   │   │   │
│   │   │   └── chat/                         # Existing chat features
│   │   │       ├── ConversationList.tsx
│   │   │       ├── MessageThread.tsx
│   │   │       └── MessageInput.tsx
│   │   │
│   │   ├── services/
│   │   │   ├── ai.service.ts                 # AI API calls
│   │   │   ├── firebase.service.ts           # Firebase operations
│   │   │   └── notifications.service.ts      # Push notifications
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAIFeature.ts              # AI feature hook
│   │   │   ├── useActionItems.ts            # Action items hook
│   │   │   ├── useDecisions.ts              # Decisions hook
│   │   │   └── useProactiveSuggestions.ts   # Suggestions hook
│   │   │
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── LoadingSpinner.tsx
│   │   │   │   ├── ErrorMessage.tsx
│   │   │   │   └── Button.tsx
│   │   │   └── ai/
│   │   │       ├── AIBadge.tsx              # Priority badge
│   │   │       ├── SummaryCard.tsx          # Summary display
│   │   │       └── ConfidenceBar.tsx        # Confidence indicator
│   │   │
│   │   ├── types/
│   │   │   └── index.ts                     # TypeScript types
│   │   │
│   │   └── utils/
│   │       ├── formatDate.ts
│   │       └── errorHandler.ts
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── babel.config.js
│   └── metro.config.js
│
├── scripts/                           # Utility scripts
│   ├── create-pinecone-index.ts
│   ├── embed-existing-messages.ts
│   ├── test-embeddings.ts
│   ├── test-rag-pipeline.ts
│   └── migrate-data.ts
│
├── tests/                             # Test suites
│   ├── unit/
│   │   ├── rag-pipeline.test.ts
│   │   ├── summarization.test.ts
│   │   ├── action-extraction.test.ts
│   │   └── priority-detection.test.ts
│   ├── integration/
│   │   ├── ai-features.test.ts
│   │   └── proactive-agent.test.ts
│   └── e2e/
│       └── user-flows.test.ts
│
├── infrastructure/                    # Infrastructure as Code
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── lambda.tf
│   │   ├── iam.tf
│   │   └── variables.tf
│   └── firebase/
│       ├── firestore.rules
│       ├── firestore.indexes.json
│       └── storage.rules
│
├── docs/                              # Documentation
│   ├── api/
│   │   └── endpoints.md
│   ├── architecture/
│   │   └── diagrams/
│   └── guides/
│       ├── setup.md
│       └── deployment.md
│
├── .gitignore
├── .eslintrc.js
├── .prettierrc
├── package.json                       # Root package.json
├── README.md
└── LICENSE
```

---

## Data Models & TypeScript Interfaces

### Core Data Models

```typescript
// shared/types.ts or mobile/src/types/index.ts

/**
 * User model
 */
export interface User {
  id: string
  email: string
  displayName: string
  photoURL?: string
  createdAt: number
  lastActive: number
  preferences: UserPreferences
}

export interface UserPreferences {
  aiEnabled: boolean
  proactiveSuggestionsEnabled: boolean
  priorityDetectionEnabled: boolean
  notificationSettings: {
    urgent: boolean
    important: boolean
    normal: boolean
  }
  quietHours: {
    enabled: boolean
    start: string // HH:mm format
    end: string
  }
}

/**
 * Message model
 */
export interface Message {
  id: string
  conversationId: string
  userId: string
  text: string
  type: 'text' | 'image' | 'file' | 'system'
  timestamp: number
  sender: {
    id: string
    displayName: string
    photoURL?: string
  }
  // Status tracking
  status: 'sending' | 'sent' | 'delivered' | 'read'
  readBy: string[] // User IDs who read the message
  // AI-related fields
  embedded?: boolean
  embeddedAt?: number
  priority?: 'urgent' | 'important' | 'normal'
  priorityConfidence?: number
  priorityReason?: string
  // Media
  mediaUrl?: string
  mediaType?: string
  // Reactions
  reactions?: Record<string, string[]> // emoji -> userIds
}

/**
 * Conversation model
 */
export interface Conversation {
  id: string
  type: 'dm' | 'group'
  name?: string // For group chats
  participants: string[] // User IDs
  createdAt: number
  lastMessageAt: number
  lastMessage?: {
    text: string
    sender: string
    timestamp: number
  }
  // Typing indicators
  typingUsers: string[]
  // AI features
  hasSummary?: boolean
  hasActionItems?: boolean
  hasDecisions?: boolean
}

/**
 * Thread Summary
 */
export interface ThreadSummary {
  id: string
  conversationId: string
  messageRange: {
    start: string // Message ID
    end: string // Message ID
    startTimestamp: number
    endTimestamp: number
  }
  summary: string
  keyTopics: string[]
  decisionsMade: string[]
  openQuestions: string[]
  participantCount: number
  messageCount: number
  generatedAt: number
  generatedBy: 'gpt-4o' | 'gpt-4o-mini'
  confidence: number
}

/**
 * Action Item
 */
export interface ActionItem {
  id: string
  conversationId: string
  messageId: string // Original message that mentioned this
  task: string
  assignee?: string // User ID
  assigneeName?: string // Display name
  deadline?: number // Unix timestamp
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'high' | 'medium' | 'low'
  context: string // Surrounding context from conversation
  confidence: number // 0-1
  createdAt: number
  updatedAt: number
  completedAt?: number
  completedBy?: string
  // Feedback
  userConfirmed?: boolean
  userDismissed?: boolean
}

/**
 * Decision
 */
export interface Decision {
  id: string
  conversationId: string
  messageIds: string[] // Messages that led to this decision
  decision: string // The actual decision made
  rationale: string // Why this decision was made
  alternativesConsidered: string[]
  participants: string[] // User IDs involved
  madeAt: number
  madeBy?: string // Primary decision maker if any
  status: 'active' | 'superseded' | 'reversed' | 'under_review'
  confidence: number
  // Relationships
  supersedes?: string // Previous decision ID
  supersededBy?: string // Newer decision ID
  relatedDecisions: string[]
  // Categorization
  topic?: string
  tags: string[]
  // Feedback
  userConfirmed?: boolean
}

/**
 * Priority Detection Result
 */
export interface PriorityDetection {
  messageId: string
  priority: 'urgent' | 'important' | 'normal'
  confidence: number
  reason: string
  signals: {
    urgencyKeywords: string[]
    directMention: boolean
    questionToUser: boolean
    timeSensitive: boolean
    blockingIssue: boolean
    senderImportance: number // 0-1
  }
  detectedAt: number
}

/**
 * Proactive Suggestion
 */
export interface ProactiveSuggestion {
  id: string
  userId: string
  conversationId: string
  type: 'meeting_scheduling' | 'reminder' | 'context' | 'conflict' | 'follow_up'
  title: string
  message: string
  actions: SuggestionAction[]
  priority: 'high' | 'medium' | 'low'
  createdAt: number
  expiresAt: number
  // Status
  status: 'pending' | 'accepted' | 'dismissed' | 'expired'
  respondedAt?: number
  // Context
  triggerReason: string
  relevantMessageIds: string[]
  // Agent info
  generatedByAgent: boolean
  agentSteps?: string[] // Tool calls made by agent
}

export interface SuggestionAction {
  id: string
  label: string
  type: 'accept' | 'dismiss' | 'custom'
  payload?: any // Custom data for the action
}

/**
 * Search Result
 */
export interface SearchResult {
  messageId: string
  conversationId: string
  text: string
  sender: {
    id: string
    displayName: string
  }
  timestamp: number
  score: number // Relevance score 0-1
  context: {
    before: Message[] // 3 messages before
    after: Message[] // 3 messages after
  }
}

/**
 * AI Feature Usage
 */
export interface AIFeatureUsage {
  userId: string
  date: string // YYYY-MM-DD
  features: {
    smartSearch: number
    threadSummary: number
    actionExtraction: number
    priorityDetection: number
    decisionTracking: number
    proactiveAgent: number
  }
  totalRequests: number
  costEstimate: number // USD
}

/**
 * Cache Entry
 */
export interface CacheEntry<T> {
  key: string
  value: T
  createdAt: number
  expiresAt: number
  hitCount?: number
}

/**
 * Rate Limit
 */
export interface RateLimit {
  userId: string
  date: string // YYYY-MM-DD
  count: number
  limit: number
  resetAt: number
}
```

### API Request/Response Types

```typescript
// API contracts for all endpoints

/**
 * Smart Search API
 */
export interface SmartSearchRequest {
  query: string
  filters?: {
    conversationId?: string
    dateRange?: {
      start: string // ISO date
      end: string
    }
    sender?: string
    limit?: number
  }
}

export interface SmartSearchResponse {
  results: SearchResult[]
  totalResults: number
  searchTime: number // milliseconds
  cached: boolean
}

/**
 * Thread Summarization API
 */
export interface SummarizeThreadRequest {
  conversationId: string
  messageIds?: string[] // If not provided, summarize entire conversation
  messageRange?: {
    start: number // timestamp
    end: number
  }
}

export interface SummarizeThreadResponse {
  summary: ThreadSummary
  generationTime: number
  cached: boolean
}

/**
 * Action Item Extraction API
 */
export interface ExtractActionsRequest {
  conversationId: string
  messageIds?: string[] // If not provided, extract from recent messages
  timeRange?: {
    start: number
    end: number
  }
}

export interface ExtractActionsResponse {
  actionItems: ActionItem[]
  extractionTime: number
  confidence: number
}

/**
 * Priority Detection API
 */
export interface DetectPriorityRequest {
  messageId: string
  message: Message
  context: {
    conversationType: 'dm' | 'group'
    participantCount: number
    userRole?: string
  }
}

export interface DetectPriorityResponse {
  detection: PriorityDetection
  detectionTime: number
}

/**
 * Decision Extraction API
 */
export interface ExtractDecisionsRequest {
  conversationId: string
  messageIds?: string[]
  timeRange?: {
    start: number
    end: number
  }
}

export interface ExtractDecisionsResponse {
  decisions: Decision[]
  extractionTime: number
  confidence: number
}

/**
 * Proactive Agent API
 */
export interface ProactiveAgentRequest {
  conversationId: string
  trigger: 'meeting_scheduling' | 'overdue_actions' | 'decision_conflict'
  recentMessages: Message[]
  context: {
    participants: string[]
    conversationType: 'dm' | 'group'
  }
}

export interface ProactiveAgentResponse {
  suggestion?: ProactiveSuggestion
  agentThought: string
  toolsUsed: string[]
  processingTime: number
}

/**
 * Embedding API (internal)
 */
export interface EmbedMessageRequest {
  messageId: string
  text: string
  userId: string
  conversationId: string
  timestamp: number
  sender: string
}

export interface EmbedMessageResponse {
  success: boolean
  messageId: string
  embeddingDimensions: number
}
```

---

## Database Schemas

### Firestore Collections Structure

```typescript
/**
 * Firestore Collection: users
 * Document ID: userId (from Firebase Auth)
 */
interface UsersCollection {
  [userId: string]: User
}

/**
 * Firestore Collection: conversations
 * Document ID: auto-generated
 */
interface ConversationsCollection {
  [conversationId: string]: Conversation
}

/**
 * Firestore Collection: messages
 * Document ID: auto-generated
 * Index: conversationId, timestamp (composite)
 */
interface MessagesCollection {
  [messageId: string]: Message
}

/**
 * Firestore Collection: action_items
 * Document ID: auto-generated
 * Index: userId, status, deadline (composite)
 * Index: conversationId, status
 */
interface ActionItemsCollection {
  [actionItemId: string]: ActionItem
}

/**
 * Firestore Collection: decisions
 * Document ID: auto-generated
 * Index: conversationId, madeAt
 * Index: topic, status
 */
interface DecisionsCollection {
  [decisionId: string]: Decision
}

/**
 * Firestore Collection: thread_summaries
 * Document ID: auto-generated
 * Index: conversationId, generatedAt
 */
interface ThreadSummariesCollection {
  [summaryId: string]: ThreadSummary
}

/**
 * Firestore Collection: proactive_suggestions
 * Document ID: auto-generated
 * Index: userId, status, createdAt
 * Index: conversationId, status
 */
interface ProactiveSuggestionsCollection {
  [suggestionId: string]: ProactiveSuggestion
}

/**
 * Firestore Collection: cache
 * Document ID: cache key (hashed)
 * TTL: Set expiresAt for automatic deletion
 */
interface CacheCollection {
  [cacheKey: string]: CacheEntry<any>
}

/**
 * Firestore Collection: rate_limits
 * Document ID: userId_YYYY-MM-DD
 * TTL: 24 hours
 */
interface RateLimitsCollection {
  [rateLimitKey: string]: RateLimit
}

/**
 * Firestore Collection: ai_usage
 * Document ID: userId_YYYY-MM-DD
 */
interface AIUsageCollection {
  [usageKey: string]: AIFeatureUsage
}
```

### Firestore Indexes

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "conversationId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "conversationId", "order": "ASCENDING" },
        { "fieldPath": "priority", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "action_items",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "assignee", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "deadline", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "action_items",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "conversationId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "decisions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "conversationId", "order": "ASCENDING" },
        { "fieldPath": "madeAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "decisions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "madeAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "proactive_suggestions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### Pinecone Vector Metadata Schema

```typescript
/**
 * Pinecone Vector Metadata
 * Each vector stored in Pinecone has this metadata structure
 */
export interface PineconeVectorMetadata {
  // Required fields
  messageId: string
  userId: string
  conversationId: string
  timestamp: number // Unix timestamp
  sender: string // User ID who sent the message
  
  // Message content (truncated for preview)
  text: string // First 500 characters
  
  // Message type
  messageType: 'text' | 'image' | 'file' | 'system'
  
  // Conversation type
  conversationType: 'dm' | 'group'
  
  // Participant count (useful for filtering)
  participantCount?: number
  
  // Optional filtering fields
  priority?: 'urgent' | 'important' | 'normal'
  hasActionItems?: boolean
  hasDecisions?: boolean
  
  // Embedding metadata
  embeddedAt: number
  embeddingModel: string // e.g., "text-embedding-3-large"
}

/**
 * Pinecone Query Filter Examples
 */
export type PineconeFilter = {
  userId?: { $eq: string }
  conversationId?: { $eq: string }
  timestamp?: { $gte: number; $lte: number }
  conversationType?: { $eq: 'dm' | 'group' }
  priority?: { $in: string[] }
  sender?: { $eq: string }
}
```

---

## API Contracts

### Firebase Cloud Functions

```typescript
// functions/src/index.ts

import * as admin from 'firebase-admin'
import * as functions from 'firebase-functions'

admin.initializeApp()

// Export all callable functions
export { smartSearch } from './ai/smartSearch'
export { summarizeThread } from './ai/summarizeThread'
export { extractActions } from './ai/extractActions'
export { detectPriority } from './ai/detectPriority'
export { extractDecisions } from './ai/extractDecisions'

// Export triggers
export { onMessageCreated } from './ai/embedMessages'
export { onMessageCreated as detectPriorityTrigger } from './ai/detectPriority'
export { checkProactiveTriggers } from './ai/proactiveTriggers'

// Export scheduled functions
export { warmCache } from './ai/cacheWarmup'
export { cleanupExpiredCache } from './ai/cacheWarmup'
```

### Lambda Function URLs

```typescript
// Environment variables for Lambda function URLs

export const LAMBDA_ENDPOINTS = {
  EMBED_MESSAGE: process.env.LAMBDA_EMBED_MESSAGE_URL,
  SMART_SEARCH: process.env.LAMBDA_SMART_SEARCH_URL,
  SUMMARIZE_THREAD: process.env.LAMBDA_SUMMARIZE_THREAD_URL,
  EXTRACT_ACTIONS: process.env.LAMBDA_EXTRACT_ACTIONS_URL,
  DETECT_PRIORITY: process.env.LAMBDA_DETECT_PRIORITY_URL,
  EXTRACT_DECISIONS: process.env.LAMBDA_EXTRACT_DECISIONS_URL,
  PROACTIVE_AGENT: process.env.LAMBDA_PROACTIVE_AGENT_URL,
} as const
```

---

## Configuration Files

### Root package.json

```json
{
  "name": "messageai",
  "version": "1.0.0",
  "description": "AI-powered messaging app for remote teams",
  "private": true,
  "workspaces": [
    "functions",
    "lambda",
    "mobile"
  ],
  "scripts": {
    "install:all": "npm install && cd functions && npm install && cd ../lambda && npm install && cd ../mobile && npm install",
    "build:functions": "cd functions && npm run build",
    "build:lambda": "cd lambda && npm run build",
    "deploy:functions": "firebase deploy --only functions",
    "deploy:lambda": "cd lambda && npm run deploy",
    "deploy:all": "npm run deploy:functions && npm run deploy:lambda",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\""
  },
  "devDependencies": {
    "@types/jest": "^29.5.5",
    "@types/node": "^20.8.0",
    "@typescript-eslint/eslint-plugin": "^6.7.5",
    "@typescript-eslint/parser": "^6.7.5",
    "eslint": "^8.51.0",
    "eslint-config-prettier": "^9.0.0",
    "eslint-plugin-prettier": "^5.0.1",
    "jest": "^29.7.0",
    "prettier": "^3.0.3",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.1",
    "tsx": "^3.13.0",
    "typescript": "^5.2.2"
  }
}
```

### Firebase Functions package.json

```json
{
  "name": "messageai-functions",
  "version": "1.0.0",
  "description": "Firebase Cloud Functions for MessageAI",
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log",
    "test": "jest"
  },
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "ai": "^3.0.0",
    "@ai-sdk/openai": "^0.0.20",
    "openai": "^4.20.0",
    "@pinecone-database/pinecone": "^1.1.2",
    "firebase-admin": "^11.11.1",
    "firebase-functions": "^4.5.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "typescript": "^5.2.2",
    "firebase-functions-test": "^3.1.0"
  }
}
```

### Lambda package.json (template for each function)

```json
{
  "name": "messageai-lambda-[function-name]",
  "version": "1.0.0",
  "description": "Lambda function for [feature]",
  "main": "index.js",
  "scripts": {
    "build": "tsc",
    "package": "npm run build && zip -r function.zip .",
    "deploy": "npm run package && aws lambda update-function-code --function-name messageai-[function-name] --zip-file fileb://function.zip",
    "test": "jest"
  },
  "dependencies": {
    "ai": "^3.0.0",
    "@ai-sdk/openai": "^0.0.20",
    "openai": "^4.20.0",
    "@pinecone-database/pinecone": "^1.1.2",
    "@google-cloud/firestore": "^7.1.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.126",
    "@types/node": "^20.8.0",
    "typescript": "^5.2.2"
  }
}
```

### TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./lib",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "lib", "**/*.test.ts"]
}
```

### ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json'],
    sourceType: 'module',
  },
  ignorePatterns: [
    '/lib/**/*', // Ignore built files.
    '/node_modules/**/*',
  ],
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': 'off', // Allow console logs in cloud functions
  },
}
```

### Prettier Configuration

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### Firebase Configuration (firebase.json)

```json
{
  "functions": {
    "source": "functions",
    "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"],
    "runtime": "nodejs20"
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "emulators": {
    "functions": {
      "port": 5001
    },
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

### Firestore Security Rules

```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function isConversationParticipant(conversationId) {
      return request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isOwner(userId);
    }
    
    // Conversations collection
    match /conversations/{conversationId} {
      allow read: if isAuthenticated() && isConversationParticipant(conversationId);
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && isConversationParticipant(conversationId);
      allow delete: if false; // Never allow deletion
    }
    
    // Messages collection
    match /messages/{messageId} {
      allow read: if isAuthenticated() && 
                     isConversationParticipant(resource.data.conversationId);
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() && 
                       (isOwner(resource.data.userId) || 
                        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'readBy']));
      allow delete: if isOwner(resource.data.userId);
    }
    
    // Action items collection
    match /action_items/{itemId} {
      allow read: if isAuthenticated() && 
                     (isOwner(resource.data.assignee) || 
                      isConversationParticipant(resource.data.conversationId));
      allow write: if isAuthenticated();
    }
    
    // Decisions collection
    match /decisions/{decisionId} {
      allow read: if isAuthenticated() && 
                     isConversationParticipant(resource.data.conversationId);
      allow write: if isAuthenticated();
    }
    
    // Thread summaries
    match /thread_summaries/{summaryId} {
      allow read: if isAuthenticated() && 
                     isConversationParticipant(resource.data.conversationId);
      allow write: if false; // Only server can write
    }
    
    // Proactive suggestions
    match /proactive_suggestions/{suggestionId} {
      allow read: if isAuthenticated() && isOwner(resource.data.userId);
      allow update: if isAuthenticated() && isOwner(resource.data.userId);
      allow create, delete: if false; // Only server can create/delete
    }
    
    // Cache (server-only)
    match /cache/{cacheKey} {
      allow read, write: if false; // Only server access
    }
    
    // Rate limits (server-only)
    match /rate_limits/{limitKey} {
      allow read, write: if false;
    }
    
    // AI usage (server-only)
    match /ai_usage/{usageKey} {
      allow read: if isAuthenticated() && usageKey.matches('$(request.auth.uid)_.*');
      allow write: if false;
    }
  }
}
```

---

## Code Templates

### Lambda Function Template

```typescript
// lambda/[function-name]/index.ts
import { Handler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { z } from 'zod'

// Import shared utilities
import { getOpenAIClient } from '../shared/openai'
import { getIndex } from '../shared/pinecone'
import { withCache } from '../shared/cache'

// Define request schema with Zod
const RequestSchema = z.object({
  // Define your request fields here
  param1: z.string(),
  param2: z.number().optional(),
})

type RequestType = z.infer<typeof RequestSchema>

// Define response interface
interface ResponseType {
  result: string
  processingTime: number
}

/**
 * Lambda handler function
 */
export const handler: Handler<APIGatewayProxyEvent, APIGatewayProxyResult> = async (event) => {
  const startTime = Date.now()
  
  try {
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}')
    const request = RequestSchema.parse(body)
    
    // Log request (remove sensitive data in production)
    console.log('Request received:', { ...request, timestamp: Date.now() })
    
    // Process request
    const result = await processRequest(request)
    
    // Calculate processing time
    const processingTime = Date.now() - startTime
    
    // Log success
    console.log('Request processed successfully', { processingTime })
    
    // Return response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Configure appropriately
      },
      body: JSON.stringify({
        result,
        processingTime,
      } as ResponseType),
    }
  } catch (error) {
    // Log error
    console.error('Error processing request:', error)
    
    // Determine error type and response
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Invalid request',
          details: error.errors,
        }),
      }
    }
    
    // Generic error response
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}

/**
 * Process the request (main business logic)
 */
async function processRequest(request: RequestType): Promise<string> {
  // Implement your logic here
  
  // Example: Use cache
  const cacheKey = `function_${request.param1}`
  const result = await withCache(cacheKey, 5, async () => {
    // Generate result (expensive operation)
    return `Processed: ${request.param1}`
  })
  
  return result
}
```

### Firebase Callable Function Template

```typescript
// functions/src/ai/[feature].ts
import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { z } from 'zod'

// Initialize Firestore (if not already initialized in index.ts)
const db = admin.firestore()

// Lambda endpoint URL
const LAMBDA_URL = process.env.LAMBDA_[FEATURE]_URL || ''

// Request schema
const RequestSchema = z.object({
  param1: z.string(),
  param2: z.number().optional(),
})

/**
 * Callable function for [feature]
 */
export const [featureName] = functions.https.onCall(async (data, context) => {
  // Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in to use this feature'
    )
  }
  
  const userId = context.auth.uid
  
  try {
    // Validate request data
    const request = RequestSchema.parse(data)
    
    // Rate limiting
    await checkRateLimit(userId)
    
    // Call Lambda function
    const response = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        userId,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`Lambda error: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    // Track usage
    await trackUsage(userId, '[feature]')
    
    return result
  } catch (error) {
    console.error(`Error in ${[featureName]}:`, error)
    
    if (error instanceof z.ZodError) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid request data')
    }
    
    throw new functions.https.HttpsError('internal', 'An error occurred processing your request')
  }
})

/**
 * Check rate limit for user
 */
async function checkRateLimit(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const limitKey = `${userId}_${today}`
  const limitRef = db.collection('rate_limits').doc(limitKey)
  
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(limitRef)
    const currentCount = doc.exists ? doc.data()?.count || 0 : 0
    
    if (currentCount >= 100) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Daily request limit reached. Please try again tomorrow.'
      )
    }
    
    transaction.set(
      limitRef,
      {
        count: currentCount + 1,
        resetAt: Date.now() + 24 * 60 * 60 * 1000,
      },
      { merge: true }
    )
  })
}

/**
 * Track feature usage
 */
async function trackUsage(userId: string, feature: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const usageKey = `${userId}_${today}`
  const usageRef = db.collection('ai_usage').doc(usageKey)
  
  await usageRef.set(
    {
      userId,
      date: today,
      [`features.${feature}`]: admin.firestore.FieldValue.increment(1),
      totalRequests: admin.firestore.FieldValue.increment(1),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  )
}
```

### React Native Hook Template

```typescript
// mobile/src/hooks/useAIFeature.ts
import { useState, useCallback } from 'react'
import functions from '@react-native-firebase/functions'

interface UseAIFeatureOptions<TRequest, TResponse> {
  functionName: string
  onSuccess?: (response: TResponse) => void
  onError?: (error: Error) => void
}

/**
 * Generic hook for calling AI features
 */
export function useAIFeature<TRequest, TResponse>({
  functionName,
  onSuccess,
  onError,
}: UseAIFeatureOptions<TRequest, TResponse>) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<TResponse | null>(null)
  
  const execute = useCallback(
    async (request: TRequest) => {
      setLoading(true)
      setError(null)
      
      try {
        const callable = functions().httpsCallable<TRequest, TResponse>(functionName)
        const result = await callable(request)
        
        setData(result.data)
        onSuccess?.(result.data)
        
        return result.data
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error occurred')
        setError(error)
        onError?.(error)
        throw error
      } finally {
        setLoading(false)
      }
    },
    [functionName, onSuccess, onError]
  )
  
  const reset = useCallback(() => {
    setLoading(false)
    setError(null)
    setData(null)
  }, [])
  
  return {
    execute,
    loading,
    error,
    data,
    reset,
  }
}
```

### React Native Component Template

```typescript
// mobile/src/features/ai/[Feature].tsx
import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
} from 'react-native'
import { useAIFeature } from '../../hooks/useAIFeature'

interface FeatureProps {
  conversationId: string
  onComplete?: () => void
}

export const Feature: React.FC<FeatureProps> = ({ conversationId, onComplete }) => {
  const [results, setResults] = useState([])
  
  const { execute, loading, error } = useAIFeature({
    functionName: 'featureName',
    onSuccess: (data) => {
      setResults(data.results)
      onComplete?.()
    },
  })
  
  const handleExecute = () => {
    execute({ conversationId })
  }
  
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handleExecute}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Execute Feature</Text>
        )}
      </TouchableOpacity>
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error.message}</Text>
        </View>
      )}
      
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.resultItem}>
            <Text>{item.text}</Text>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#C00',
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
})
```

---

## Testing Specifications

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'functions/src/**/*.ts',
    'lambda/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
}
```

### Test Template

```typescript
// tests/unit/[feature].test.ts
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  firestore: jest.fn(),
  initializeApp: jest.fn(),
}))

// Mock OpenAI
jest.mock('openai')

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup mocks
    jest.clearAllMocks()
  })
  
  afterEach(() => {
    // Cleanup
  })
  
  describe('function name', () => {
    it('should process valid input correctly', async () => {
      // Arrange
      const input = { param: 'value' }
      
      // Act
      const result = await functionUnderTest(input)
      
      // Assert
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
    })
    
    it('should handle errors gracefully', async () => {
      // Arrange
      const invalidInput = { param: null }
      
      // Act & Assert
      await expect(functionUnderTest(invalidInput)).rejects.toThrow()
    })
    
    it('should use cache when available', async () => {
      // Test caching behavior
    })
  })
})
```

---

## Deployment Scripts

### Lambda Deployment Script

```bash
#!/bin/bash
# lambda/scripts/package-lambda.sh

set -e

FUNCTION_NAME=$1
REGION=${2:-us-east-1}

if [ -z "$FUNCTION_NAME" ]; then
  echo "Usage: ./package-lambda.sh <function-name> [region]"
  exit 1
fi

echo "📦 Packaging Lambda function: $FUNCTION_NAME"

cd "lambda/$FUNCTION_NAME"

# Install dependencies
echo "📥 Installing dependencies..."
npm install --production

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Create deployment package
echo "📦 Creating deployment package..."
zip -r function.zip . -x "*.ts" "tsconfig.json" "*.test.js" "node_modules/@types/*"

# Deploy to AWS
echo "🚀 Deploying to AWS Lambda..."
aws lambda update-function-code \
  --function-name "messageai-$FUNCTION_NAME" \
  --zip-file fileb://function.zip \
  --region "$REGION"

# Cleanup
rm function.zip

echo "✅ Deployment complete!"
```

### All Functions Deployment

```javascript
// lambda/scripts/deploy-all.js
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const LAMBDA_DIR = path.join(__dirname, '..')
const FUNCTIONS = [
  'embed-message',
  'smart-search',
  'summarize-thread',
  'extract-actions',
  'detect-priority',
  'extract-decisions',
  'proactive-agent',
]

async function deployAll() {
  console.log('🚀 Deploying all Lambda functions...\n')
  
  for (const func of FUNCTIONS) {
    console.log(`\n📦 Deploying ${func}...`)
    
    try {
      execSync(`./scripts/package-lambda.sh ${func}`, {
        cwd: LAMBDA_DIR,
        stdio: 'inherit',
      })
      console.log(`✅ ${func} deployed successfully`)
    } catch (error) {
      console.error(`❌ Failed to deploy ${func}:`, error.message)
      process.exit(1)
    }
  }
  
  console.log('\n✅ All functions deployed successfully!')
}

deployAll()
```

---

## Environment Variables

### Complete .env.local Template

```bash
# .env.local - DO NOT COMMIT THIS FILE

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...
OPENAI_ORG_ID=org-...

# Pinecone Configuration
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=messageai-conversations

# AWS Configuration
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=...

# Firebase Configuration
FIREBASE_PROJECT_ID=messageai-prod
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Lambda Function URLs (set after deployment)
LAMBDA_EMBED_MESSAGE_URL=https://...lambda-url.us-east-1.on.aws/
LAMBDA_SMART_SEARCH_URL=https://...lambda-url.us-east-1.on.aws/
LAMBDA_SUMMARIZE_THREAD_URL=https://...lambda-url.us-east-1.on.aws/
LAMBDA_EXTRACT_ACTIONS_URL=https://...lambda-url.us-east-1.on.aws/
LAMBDA_DETECT_PRIORITY_URL=https://...lambda-url.us-east-1.on.aws/
LAMBDA_EXTRACT_DECISIONS_URL=https://...lambda-url.us-east-1.on.aws/
LAMBDA_PROACTIVE_AGENT_URL=https://...lambda-url.us-east-1.on.aws/

# Feature Flags
ENABLE_PROACTIVE_ASSISTANT=true
ENABLE_PRIORITY_DETECTION=true
ENABLE_DECISION_TRACKING=true

# Rate Limits
RATE_LIMIT_PER_USER_DAILY=100
RATE_LIMIT_PER_IP_HOURLY=1000

# Cache Configuration
CACHE_TTL_SUMMARY=300000           # 5 minutes in ms
CACHE_TTL_SEARCH=600000            # 10 minutes in ms
CACHE_TTL_ACTIONS=180000           # 3 minutes in ms

# Model Configuration
DEFAULT_LLM_MODEL=gpt-4o
SIMPLE_LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-large

# Development
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug
```

---

## Common Patterns & Utilities

### Error Handler Utility

```typescript
// shared/errorHandler.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTH_ERROR', 401)
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_ERROR', 429)
  }
}

export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }
  
  if (error instanceof Error) {
    return new AppError(error.message, 'INTERNAL_ERROR', 500)
  }
  
  return new AppError('An unknown error occurred', 'UNKNOWN_ERROR', 500)
}
```

### Logger Utility

```typescript
// shared/logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel
  
  constructor(level: string = 'info') {
    this.level = LogLevel[level.toUpperCase() as keyof typeof LogLevel] || LogLevel.INFO
  }
  
  debug(message: string, meta?: any) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, meta)
    }
  }
  
  info(message: string, meta?: any) {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, meta)
    }
  }
  
  warn(message: string, meta?: any) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, meta)
    }
  }
  
  error(message: string, error?: Error, meta?: any) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, { error, ...meta })
    }
  }
}

export const logger = new Logger(process.env.LOG_LEVEL)
```

### Retry Utility

```typescript
// shared/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    delayMs?: number
    backoff?: 'linear' | 'exponential'
    onRetry?: (attempt: number, error: Error) => void
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoff = 'exponential',
    onRetry,
  } = options
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error
      }
      
      const delay = backoff === 'exponential'
        ? delayMs * Math.pow(2, attempt - 1)
        : delayMs * attempt
      
      onRetry?.(attempt, error as Error)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new Error('Should never reach here')
}
```

### Performance Monitor

```typescript
// shared/performance.ts
export class PerformanceMonitor {
  private startTime: number
  private checkpoints: Map<string, number>
  
  constructor() {
    this.startTime = Date.now()
    this.checkpoints = new Map()
  }
  
  checkpoint(name: string) {
    this.checkpoints.set(name, Date.now() - this.startTime)
  }
  
  getDuration(checkpointName?: string): number {
    if (checkpointName) {
      return this.checkpoints.get(checkpointName) || 0
    }
    return Date.now() - this.startTime
  }
  
  getReport(): Record<string, number> {
    const report: Record<string, number> = {
      total: this.getDuration(),
    }
    
    this.checkpoints.forEach((duration, name) => {
      report[name] = duration
    })
    
    return report
  }
}
```

---

## Additional Specifications

### Prompt Templates

```typescript
// lambda/shared/prompts.ts

export const PROMPTS = {
  SUMMARIZE_THREAD: (messages: string[], messageCount: number) => `
Summarize this conversation thread with ${messageCount} messages.

Format your response exactly as follows:
📝 Thread Summary (timeframe, ${messageCount} messages)

Key Topics:
• [Topic 1]
• [Topic 2]

Decisions Made:
• [Decision 1]

Still Open:
• [Question 1]

Messages:
${messages.join('\n\n')}

Keep it concise but capture all important points.
`,

  EXTRACT_ACTIONS: (messages: string[]) => `
Extract all action items from this conversation.

Look for patterns like:
- "I'll handle X"
- "Can you do Y?"
- "Someone needs to Z"
- "TODO:"
- Direct questions requiring action

For each action item, identify:
- Task description
- Assignee (if mentioned)
- Deadline (if mentioned)
- Context

Messages:
${messages.map((m, i) => `[${i}] ${m}`).join('\n\n')}

Return confidence scores (0-1) for each item.
`,

  DETECT_PRIORITY: (message: string, context: any) => `
Analyze the priority of this message.

Message: "${message}"

Context:
- Conversation type: ${context.conversationType}
- Participants: ${context.participantCount}
- Time: ${new Date().toISOString()}

Determine priority level:
- URGENT: Requires immediate attention (production issues, blocking problems, explicit urgency)
- IMPORTANT: Should be addressed today (direct questions, time-sensitive, stakeholder requests)
- NORMAL: FYI, can be handled when convenient

Consider:
- Urgency keywords (URGENT, ASAP, CRITICAL, etc.)
- Direct mentions (@user)
- Questions directed at specific people
- Time pressure indicators
- Context from conversation type

Return your assessment with confidence score and reasoning.
`,

  EXTRACT_DECISIONS: (messages: string[]) => `
Extract all decisions made in this conversation.

Look for patterns like:
- "Let's go with X"
- "We decided to..."
- "After discussion, we'll..."
- Consensus signals (multiple agreements)
- "Final decision: ..."

For each decision, identify:
- The decision itself
- Rationale/reasoning
- Alternatives that were considered
- Who made/agreed to it
- When it was made

Messages:
${messages.map((m, i) => `[${i}] ${m}`).join('\n\n')}

Be careful to distinguish between:
- Actual decisions vs. proposals
- Individual opinions vs. team consensus
- Serious decisions vs. sarcasm/jokes
`,

  RERANK_SEARCH: (query: string, results: string[]) => `
You are a search result ranker. Rank these message results by relevance to the query.
Return only the top 5 most relevant results in order, with their IDs.

Query: "${query}"

Results:
${results}

Return format: Just the IDs in order, one per line. No explanation needed.
`,
}
```

### Constants

```typescript
// shared/constants.ts

export const MODELS = {
  GPT_4O: 'gpt-4o-2024-08-06',
  GPT_4O_MINI: 'gpt-4o-mini',
  EMBEDDING: 'text-embedding-3-large',
} as const

export const CACHE_TTL = {
  SUMMARY: 5 * 60 * 1000, // 5 minutes
  SEARCH: 10 * 60 * 1000, // 10 minutes
  ACTIONS: 3 * 60 * 1000, // 3 minutes
  DECISIONS: 15 * 60 * 1000, // 15 minutes
} as const

export const RATE_LIMITS = {
  PER_USER_DAILY: 100,
  PER_IP_HOURLY: 1000,
} as const

export const PRIORITIES = {
  URGENT: 'urgent',
  IMPORTANT: 'important',
  NORMAL: 'normal',
} as const

export const AI_FEATURES = {
  SMART_SEARCH: 'smartSearch',
  THREAD_SUMMARY: 'threadSummary',
  ACTION_EXTRACTION: 'actionExtraction',
  PRIORITY_DETECTION: 'priorityDetection',
  DECISION_TRACKING: 'decisionTracking',
  PROACTIVE_AGENT: 'proactiveAgent',
} as const

export const SUGGESTION_TYPES = {
  MEETING_SCHEDULING: 'meeting_scheduling',
  REMINDER: 'reminder',
  CONTEXT: 'context',
  CONFLICT: 'conflict',
  FOLLOW_UP: 'follow_up',
} as const
```

---

## Development Workflow

### Git Workflow

```bash
# Branch naming convention
feature/ai-smart-search
bugfix/priority-detection-accuracy
hotfix/cache-memory-leak
refactor/lambda-error-handling

# Commit message convention
feat: add smart search RAG pipeline
fix: correct priority detection false positives
docs: update API documentation for action items
test: add unit tests for summarization
refactor: extract common cache utility
perf: optimize Pinecone query performance
```

### Development Commands Cheat Sheet

```bash
# Start Firebase emulators
firebase emulators:start

# Deploy single function
firebase deploy --only functions:smartSearch

# Tail Firebase logs
firebase functions:log --only smartSearch

# Test Lambda locally
cd lambda/smart-search
npm test

# Deploy Lambda
./scripts/package-lambda.sh smart-search

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Check test coverage
npm test -- --coverage

# Lint code
npm run lint

# Format code
npm run format

# Build all TypeScript
npm run build

# Check TypeScript types
tsc --noEmit
```

---

**End of Technical Specification Document**

This document should be kept in sync with the actual implementation. Update as the project evolves.
