# MessageAI AI Specifications

This folder contains all documentation for implementing AI features in MessageAI.

---

## 🎯 Which Documents to Use?

### ✅ CURRENT IMPLEMENTATION (Firebase-Only)

**Start here for implementation:**

1. **`CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md`** ⭐ **PRIMARY GUIDE**
   - Simplified Firebase-only architecture
   - 3-week implementation plan
   - No AWS Lambda required
   - Batch embedding every 30 seconds
   - All AI processing in Firebase Cloud Functions

2. **`START_IMPLEMENTATION_PROMPT.md`**
   - Quick-start prompt for new Cursor sessions
   - References all necessary documents
   - Ready to copy-paste

3. **`messageai-architecture.md`** (Updated v2.0)
   - Complete Firebase-only system architecture
   - Technology stack decisions
   - Why we chose Firebase-only over hybrid
   - Data flow diagrams

4. **`messageai-persona-prd.md`** ✅ **STILL VALID**
   - User persona (Alex Chen)
   - Product requirements for all 5 features + Proactive Assistant
   - Performance targets
   - Success metrics
   - **Architecture-agnostic - use this for requirements**

5. **`messageai-technical-spec.md`** ⚠️ **PARTIALLY VALID**
   - TypeScript interfaces ✅ Valid
   - Database schemas ✅ Valid
   - API contracts ✅ Valid (adjust Lambda → Firebase)
   - Lambda-specific sections ❌ Ignore

---

### ⚠️ DEPRECATED (Kept for Reference)

These documents describe the **original hybrid Firebase + AWS Lambda architecture**:

- **`messageai-implementation-plan.md`** ❌ DEPRECATED
  - Original 4-week hybrid plan
  - Includes AWS Lambda setup
  - Includes Terraform, AWS CLI
  - **Do NOT use for implementation**

- **`messageai-task-list.md`** ❌ DEPRECATED
  - Day-by-day tasks for hybrid architecture
  - AWS-specific setup steps
  - **Do NOT use for implementation**

---

## 📋 Quick Reference

### Architecture Decision

```
ORIGINAL PLAN:  Firebase Functions → AWS Lambda → OpenAI/Pinecone
CURRENT PLAN:   Firebase Functions → OpenAI/Pinecone (directly)
```

**Why Firebase-Only?**
- ✅ Simpler (one platform, one deployment)
- ✅ Cheaper ($35-65/month vs $50-80/month)
- ✅ Faster development
- ✅ Firebase Functions support 2GB RAM + 540s timeout
- ✅ Perfect for our scale (10 users, 100-300 messages/day)

---

## 🚀 Getting Started

### For New Implementation Sessions:

1. Copy contents of `START_IMPLEMENTATION_PROMPT.md`
2. Paste into a fresh Cursor Composer session
3. Follow the step-by-step guide in `CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md`

### Key Documents to Reference:

```
Implementation Guide:  CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md
Architecture:          messageai-architecture.md (v2.0)
Requirements:          messageai-persona-prd.md
Data Models:           messageai-technical-spec.md (interfaces/schemas sections)
```

---

## 📁 File Overview

```
docs/ai-specs/
├── README.md (this file)
│
├── ✅ CURRENT IMPLEMENTATION
├── CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md  ⭐ Start here
├── START_IMPLEMENTATION_PROMPT.md           Quick-start
├── messageai-architecture.md (v2.0)         System design
├── messageai-persona-prd.md                 Requirements
│
└── ⚠️ DEPRECATED (Reference Only)
    ├── messageai-implementation-plan.md     Original hybrid plan
    ├── messageai-task-list.md               Original task list
    └── messageai-technical-spec.md          Partially valid
```

---

## 🔑 Key Differences

| Aspect | Deprecated Docs | Current Plan |
|--------|----------------|--------------|
| Architecture | Firebase + Lambda | Firebase-only |
| Deployment | 2 pipelines | 1 pipeline |
| Infrastructure | AWS + Firebase | Firebase only |
| Setup | AWS CLI, Terraform | Firebase CLI |
| Embedding | Real-time per message | Batch every 30 sec |
| Timeline | 4 weeks | 3 weeks |
| Complexity | High | Low |

---

## ❓ FAQ

**Q: Why do we still have the old documents?**  
A: For reference and learning. They contain valuable details about features and requirements that are still relevant.

**Q: Can I reference messageai-technical-spec.md?**  
A: Yes! The TypeScript interfaces, database schemas, and data models are still 100% valid. Just ignore the Lambda-specific sections (project structure with `lambda/` folders, deployment scripts, etc.).

**Q: What about messageai-persona-prd.md?**  
A: Fully valid! It's architecture-agnostic and defines product requirements.

**Q: Should I follow messageai-task-list.md?**  
A: No. It has AWS-specific setup tasks. Follow `CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md` instead.

**Q: Do I need AWS Lambda?**  
A: No. The current plan is Firebase-only. All AI processing happens in Firebase Cloud Functions.

---

## 🎯 Success Criteria

Follow `CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md` to implement:

✅ **5 Required Features:**
1. Thread Summarization
2. Action Item Extraction
3. Smart Search (with RAG)
4. Priority Message Detection
5. Decision Tracking

✅ **Advanced Feature:**
6. Proactive Assistant (meeting scheduling, reminders)

✅ **Technical Requirements:**
- Firebase-only architecture
- Pinecone for vector search (RAG)
- AI SDK by Vercel for agents
- OpenAI GPT-4o/4o-mini
- Batch embedding every 30 seconds
- <3s response time for simple operations
- <15s response time for complex operations

---

## 📞 Need Help?

If something is unclear:
1. Check `CURSOR_MESSAGEAI_IMPLEMENTATION_PLAN.md` first
2. Reference `messageai-persona-prd.md` for feature requirements
3. Check `messageai-architecture.md` for system design
4. Use `messageai-technical-spec.md` for data models

**Remember:** Ignore any mention of AWS Lambda, AWS CLI, Terraform, or hybrid architecture in the deprecated docs.

---

**Last Updated:** October 24, 2025  
**Architecture Version:** 2.0 (Firebase-Only)

