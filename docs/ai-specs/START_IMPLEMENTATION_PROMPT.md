# MessageAI AI Features: Implementation Start Prompt

**Copy and paste this into a fresh Cursor Composer session to begin implementing:**

---

I'm implementing AI features for my MessageAI messaging app (React Native + Expo SDK 54 with Firebase backend). I need to add 5 required AI features plus a Proactive Assistant using OpenAI GPT-4o/4o-mini, Pinecone for RAG, and AI SDK by Vercel. 

My existing MVP messaging app is complete and production-ready with real-time messaging, offline-first architecture, and SQLite caching. I already have an OpenAI API key ready to use.

Please review these documents to understand the complete context:
- `@CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md` - Our simplified Firebase-only implementation plan (the main guide)
- `@messageai-technical-spec.md` - Complete technical specifications and data models
- `@messageai-architecture.md` - System architecture and technology decisions
- `@messageai-persona-prd.md` - Product requirements for Remote Team Professional persona

I want to start implementing in this order:
1. First, help me set up Pinecone (create account, index, store API keys in Firebase)
2. Then create the utility files (openai.ts, pinecone.ts, cache.ts)
3. Then implement Priority Detection (Feature 4) as our first AI feature
4. Guide me step-by-step, showing me exactly what code to write and where

Let's begin with the Pinecone setup. What's the first step?

