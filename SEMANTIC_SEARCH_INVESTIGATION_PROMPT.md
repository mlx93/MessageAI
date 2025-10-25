# Semantic Search Quality Investigation

## Problem Description

Our messaging app's semantic search feature is returning poor quality results with low relevance scores (23-29% similarity), displaying "Unknown" as sender names, and critically, showing messages that users have deleted or hidden from their view. The search is also slow and returns very few results (often just 1-2 matches) even when relevant messages exist in the database. For queries like "What was the production issue?" about Redis errors, the system returns unrelated messages like "No problem" or "Good, I'm monitoring error rates" instead of the actual incident description and resolution details that exist in the test conversations.

## Goals & Current Issues

**Goal**: Provide fast, accurate semantic search that finds contextually relevant messages from conversations the user participates in, while respecting privacy by filtering out deleted/hidden content and displaying proper sender names.

**What's Wrong**: The search is finding messages in Pinecone that have participant metadata and are embedded correctly, but the relevance scores are extremely low, sender names are not being retrieved properly (showing "Unknown"), and the filtering logic for deleted messages isn't working consistently. The GPT-4o reranking step may also be contributing to poor result quality. Additionally, timing logs suggest the search takes several seconds to complete, and the number of results returned is suspiciously low compared to the known test data in the system. Test queries for specific incidents are failing to find the most relevant messages even though they've been confirmed to exist and be embedded in the vector database.

## System Architecture Context

Our AI infrastructure uses a Firebase-only architecture where all processing happens in Firebase Cloud Functions (2GB RAM, 540s timeout). The semantic search flow works as follows: (1) User query triggers the `smartSearch()` callable function, (2) Function generates query embedding using OpenAI's `text-embedding-3-large` model, (3) Queries Pinecone vector database (index: `messageai-conversations`, 3072 dimensions, cosine similarity) with participant metadata filtering, (4) Retrieves top 20 matches, (5) Reranks results using GPT-4o to select top 5, (6) Fetches full message data from Firestore including sender names, (7) Returns results to client. Messages are embedded automatically within 60 seconds via the `batchEmbedMessages()` scheduled function that fetches conversation participants and stores them in Pinecone metadata. The system uses AI SDK by Vercel for agent orchestration and caches results in Firestore with a 10-minute TTL.

## Relevant Files to Investigate

**Backend (Firebase Cloud Functions):**
- `functions/src/ai/smartSearch.ts` - Main semantic search implementation (lines 1-176): Query embedding generation, Pinecone querying with filters, GPT-4o reranking, Firestore data fetching, deleted message filtering, timestamp conversion
- `functions/src/ai/batchEmbedding.ts` - Automatic message embedding (lines 1-173): Scheduled function that embeds new messages, fetches conversation participants, stores metadata in Pinecone
- `functions/src/utils/pinecone.ts` - Pinecone client setup and utilities: Index configuration, vector operations
- `functions/src/utils/openai.ts` - OpenAI client setup: API key management, model configuration

**Frontend (React Native):**
- `app/ava/search.tsx` - Search UI component (lines 60-183): Performs both keyword and semantic search in parallel, displays results with sender names and timestamps, handles deleted message filtering on client side

**Key Areas to Examine:**
- Participant metadata filtering in Pinecone queries
- Sender name retrieval from Firestore (why showing "Unknown")
- Deleted message filtering logic (deletedBy array check)
- GPT-4o reranking prompt and effectiveness
- Timestamp conversion and formatting
- Relevance score calculation and thresholds

