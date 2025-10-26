# Semantic Search Optimization - Phase A-D Improvements

**Date:** October 25, 2025  
**Status:** Planning Phase - Ready for Implementation  
**Context:** Following successful semantic search overhaul, addressing quality, context, performance, and Ava integration

---

## 📊 Test Results Analysis

**Current Performance:**
- ✅ Search works with relevance scores 30-60%
- ✅ Actual sender names displayed (Dan G, Myles L, Hadi R, Adrian L)
- ✅ Conversation names shown correctly
- ❌ Too many low-relevance results (30-40% range cluttering results)
- ❌ Missing contextual messages surrounding high-scoring results
- ❌ Conversation fetching extremely slow (5-8 seconds for 27 conversations)
- ❌ Semantic search not integrated into Ava chatbot

---

## 🎯 Phase A: Smart Relevance Threshold

### **Problem**
Current 30% threshold shows too many marginally relevant results:
- "Database decision" query: 60%, 58%, 50%, 45% scores (good)
- "Production issue" query: Only 38% (borderline)
- "Frontend work" query: 63%, 40%, 34%, 34% (last two are noise)

### **Desired Behavior**
If 5+ results are above 40%, show only those (up to 20 max). Otherwise, show all 40%+ results plus enough 30-40% results to reach 5 total results.

### **Implementation Path**
Location: `functions/src/ai/smartSearch.ts` around lines 102-106

Possible approach:
- Keep initial 30% threshold for Pinecone filtering
- After sorting, count results above 40%
- Apply secondary filtering based on count
- Consider adding logging to show applied threshold

---

## 🧠 Phase B: Context-Aware Search (Surrounding Messages)

### **Problem**
"Dashboard feedback" query misses follow-up discussion:
- Found: "Hey team! I've shared new dashboard mockups" (48%)
- Found: "Good feedback! I can simplify charts for mobile" (41%)
- **MISSING:** "Layout looks clean, but I'm concerned about real-time chart performance"
- **MISSING:** "Those charts might be heavy for mobile users"
- **MISSING:** Follow-up messages that don't contain "dashboard"

### **Desired Behavior**
For high-scoring results (>40%), fetch 2-3 messages before and after to provide conversation context.

### **Implementation Path**
Location: `functions/src/ai/smartSearch.ts` - new function after message fetching

Considerations:
- Fetch surrounding messages by timestamp ordering
- Deduplicate if message already in results
- Mark contextual messages differently (UI badge change needed)
- Maintain chronological order within conversation
- Batch Firestore queries for performance

UI change needed: `app/ava/search.tsx` - add "Context" badge for surrounding messages

---

## ⚡ Phase C: Performance Optimization (Conversation Fetching)

### **Problem**
Logs show 5-8 second delay iterating ALL 27 conversations:
```
LOG  Conversation 4f38d1b4-14e3-433f-b242-85b11e03b4d0: 22 messages
LOG  Conversation 55b7530e-1908-4f55-80e5-6fdc3750dc2e: 0 messages
... (iterating ALL conversations unnecessarily)
```

### **Root Cause**
Frontend keyword search (`performKeywordSearch`) fetches ALL conversations, then searches ALL messages in each conversation. This happens even though backend semantic search already provides `conversationName` in results.

### **Solution Path**
Location: `app/ava/search.tsx` lines 60-131 (performKeywordSearch function)

Two possible approaches:
1. **Option A (Quick fix):** Use backend's `conversationName` for semantic results, only fetch for keyword results
2. **Option B (Optimal):** Refactor keyword search to only search conversations that have matching messages (requires Firestore query optimization)

Expected impact: 5-8s → <2s

---

## 🤖 Phase D: Ava Integration with Semantic Search

### **Problem**
Users ask Ava questions like "What did we decide about the database?" but Ava doesn't utilize semantic search results.

### **Vision**
Ava should detect search-type questions, run semantic search, and generate natural language answers with citations while preserving existing summarization features.

### **Proposed Architecture**
```
User Query → Intent Classification
    ├─→ "search" → Semantic Search → Generate Answer with Sources
    ├─→ "summarize" → Existing Summarization (preserve)
    └─→ "general" → Existing General Chat (preserve)
```

### **Implementation Path**
Location: `functions/src/ai/avaChat.ts` or new file

Suggested approach:
1. Add intent classification (GPT-4o-mini prompt)
2. Create search-based response generator
3. Modify Ava chat handler to route based on intent
4. Update frontend to display sources alongside answer

Key considerations:
- Reuse existing `smartSearch()` function
- Use top 3-5 semantic results as context
- Cite sources in response
- Preserve all existing Ava functionality
- Frontend should display answer + source messages

---

## 📋 Implementation Priority

### **Priority 1: Phase C (Performance)** ⚡
**Time:** 15-30 minutes | **Impact:** 5-8s → <2s

### **Priority 2: Phase A (Relevance)** 🎯  
**Time:** 30-45 minutes | **Impact:** Cleaner results

### **Priority 3: Phase B (Context)** 🧠
**Time:** 2-3 hours | **Impact:** Richer conversation flow

### **Priority 4: Phase D (Ava)** 🤖
**Time:** 4-6 hours | **Impact:** Major feature enhancement

---

## 🧪 Testing Strategy

**Phase A:** Test queries with varying result distributions (0, 3, 10+ results above 40%)

**Phase B:** Verify "Dashboard feedback" includes follow-up messages; check deduplication and ordering

**Phase C:** Time search end-to-end; verify conversation names still display

**Phase D:** Test "What did we decide?" vs "Summarize" vs "Hello" to verify intent routing

---

## ✅ Success Criteria

- [ ] Phase A: Max 5 items between 30-40% shown when needed
- [ ] Phase B: Context messages appear for high-scoring results  
- [ ] Phase C: Search completes in <2 seconds
- [ ] Phase D: Ava answers search questions with citations
- [ ] All: No regressions to existing features

---

*Use this as primary prompt for next agent session. Agent should analyze current code and implement solutions.*
