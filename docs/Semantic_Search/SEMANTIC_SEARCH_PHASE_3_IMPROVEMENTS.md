# Semantic Search Phase 3 Improvements

**Status:** Testing reveals UX and performance issues after Phase 2 deployment  
**Priority:** High - Fix sorting, reduce context clutter, improve performance

---

## 🔍 Issues Identified

### 1. Results Not Sorted by Score
- Search shows 33%, 40%, 63% instead of 63%, 40%, 33%
- Backend sorts correctly, but frontend merging disrupts order
- **Fix:** Sort merged results DESC after deduplication

### 2. Too Much Context Shown
- Context displayed even with 3+ high-quality matches (>50%)
- Orange "Context" badges cluttering results page
- **Current:** Show context for ANY result >40%
- **Desired:** Only show context when <3 results above 50%

### 3. Context Not Validated for Relevance
- Context chosen by proximity (2 before, 3 after) not usefulness
- May not actually help answer the search query
- **Need:** Validate if context messages are relevant

### 4. Missing Message Details View
- Clicking result jumps to chat (loses search context)
- Can't explore full conversation thread
- **Need:** Intermediate details page (like Decision details)

### 5. Still Slow (7 seconds)
- Logs show "Conversation X: N messages" during search
- Keyword search likely fetching ALL conversations
- **Target:** <3s total (semantic <2s + context <1s)

---

## 🎯 Solutions

### **P0: Fix Sorting** (15 min)
**Location:** `app/ava/search.tsx` after line 210

Pseudo code:
```
mergedResults.sort((a, b) => {
  if (a.score !== b.score) return b.score - a.score  // DESC
  return b.timestamp - a.timestamp  // Newest first
})
```

### **P0: Fix Performance** (30 min)
**Investigation:**
1. Add timing logs to `performKeywordSearch` and `performSemanticSearch`
2. Identify if keyword search is causing 7s delay
3. **Solution:** Remove keyword search OR make conditional (only if semantic <3 results)

Expected:
- Semantic: ~2s
- Context: ~1s
- Keyword (if running): ~5-7s ← **This is the problem**

### **P1: Smart Context Filtering** (45 min)
**Location:** Backend `smartSearch.ts` or Frontend `search.tsx`

**Stage 1 - Decide IF to show context:**
```
highQualityCount = results.filter(r => r.score >= 0.5).length
shouldShowContext = highQualityCount < 3
```

**Stage 2 - Validate context relevance (if showing):**

Option A - Keyword Overlap (Fast, recommended):
```
isRelevant(context, query) {
  queryWords = query.split().filter(w => w.length > 3)
  matchCount = queryWords.filter(w => context.includes(w)).length
  return matchCount / queryWords.length >= 0.3  // 30% overlap
}
```

Option B - LLM Validation (Better, slower):
```
Call GPT-4o-mini: "Does this context help answer the query?"
Return: true/false per context message
```

### **P1: Limit Context Display** (1 hour)
**Rules:**
- Max 2-3 context messages total (not per result)
- Only show context for top result per conversation
- Pick context with best keyword overlap

Pseudo code:
```
groupByConversation(results)
for each conversation:
  topResult = highest score
  bestContext = context.filter(isRelevant).slice(0, 2)
  add topResult + bestContext to filtered
  add other non-context results (no context)
```

### **P2: Add Message Details Page** (2-3 hours)
**New Route:** `app/ava/search-result/[messageId].tsx`

Features:
- Show selected message (highlighted)
- Show 10 before + 10 after messages
- Buttons: "Open in Chat" | "Back to Results"
- Similar design to `app/decision/[id].tsx`

---

## ✅ Success Criteria

**Phase 3A (P0/P1):**
- [ ] Results sorted by score DESC
- [ ] Context only when <3 results >50%
- [ ] Max 2-3 context messages shown
- [ ] Search completes in <3s

**Phase 3B (P2):**
- [ ] Message details page created
- [ ] Easy navigation between search/details/chat

---

## 📊 Testing

**Queries:**
1. "database decision" → Expect 3+ results >50%, no context
2. "frontend work" → Expect 2-3 results, minimal context
3. "production issue" → Expect 1-2 results, may need context

**Metrics:**
- Search time <3s
- Context messages shown ≤3
- Results properly sorted

