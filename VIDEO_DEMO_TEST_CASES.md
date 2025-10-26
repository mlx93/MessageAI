# Video Demo Test Cases - Ava & Semantic Search

**Purpose:** Quick, impressive test cases for video demonstrations  
**Data:** Based on test-conversations.md (Database Decision, Production Issue, Design Review)  
**Expected Performance:** <3 seconds per search

---

## 🤖 Ava Chat Test Cases (Question Answering)

### Test Case 1: Decision Inquiry ⭐ BEST FOR DEMO
**Query:** "What database did we choose and why?"

**Expected Ava Response:**
```
The team chose PostgreSQL for the analytics database. The decision was based on 
three key factors: PostgreSQL had the best performance at 85ms (compared to MongoDB 
at 90ms and MySQL at 120ms), the team has existing experience with it, and your 
infrastructure already uses PostgreSQL. Dan confirmed this decision and asked 
Hadi to update the docs.
```

**Sources Shown:** 3-5 messages with citations
- Myles: "I lean towards PostgreSQL. We have experience and it handles complex queries well." (59%)
- Dan: "Decision made: PostgreSQL for analytics database. Hadi, update the docs?" (59%)
- Myles: "Update: PostgreSQL averaging 85ms, MongoDB 90ms, MySQL 120ms." (56%)

**Why Great for Demo:**
- ✅ Natural language question
- ✅ Multi-part answer (what + why)
- ✅ Shows Ava citing specific people
- ✅ Fast (<3s)
- ✅ Impressive synthesis of multiple messages

---

### Test Case 2: Team Coordination ⭐ SHOWS URGENCY
**Query:** "What happened with the production issue?"

**Expected Ava Response:**
```
There was a critical production outage where the API was returning 503 errors, 
affecting 40% of requests and all users. Dan identified it as Redis connection 
timeouts. Myles restarted the Redis service, and the error rate dropped from 
40% to 5% within minutes. The team resolved it quickly with Myles monitoring 
for the next hour to ensure stability.
```

**Sources Shown:** 4-5 messages
- Dan: "@Myles URGENT: Production API returning 503 errors..." (70%)
- Myles: "I'm restarting Redis service now. Should be back up in 2 minutes." (100% exact)
- Dan: "Yes, I see improvement. Error rate down to 5% now." (46%)

**Why Great for Demo:**
- ✅ Shows urgency detection
- ✅ Timeline reconstruction
- ✅ Multiple actors coordinating
- ✅ Mix of exact and semantic matches

---

### Test Case 3: People & Assignments
**Query:** "Who is responsible for benchmarks?"

**Expected Ava Response:**
```
Myles is responsible for running the benchmarks. He volunteered to handle 
PostgreSQL and MySQL testing, while Hadi took MongoDB. Dan asked if Myles 
could have the benchmarks ready by Wednesday, and Myles confirmed he would 
handle it.
```

**Sources Shown:** 2-3 messages
- Myles: "I can run benchmarks this week. Should I test all three options?" (64%)
- Dan: "Perfect. Myles, can you have benchmarks ready by Wednesday?" (48%)
- Myles: "I'll handle PostgreSQL and MySQL. Hadi, you take MongoDB?" (41%)

**Why Great for Demo:**
- ✅ Shows person-focused query
- ✅ Identifies assignments from conversation
- ✅ Shows Q&A context detection

---

### Test Case 4: Timeline Query
**Query:** "When did we make the database decision?"

**Expected Ava Response:**
```
The database decision was made on Tuesday, October 24th. The discussion started 
Monday morning when Dan raised the need to decide, Myles ran benchmarks Tuesday, 
and by Tuesday afternoon Dan confirmed the decision to go with PostgreSQL.
```

**Sources Shown:** 2-3 messages with dates

**Why Great for Demo:**
- ✅ Shows temporal understanding
- ✅ Reconstructs timeline from messages
- ✅ Date extraction

---

### Test Case 5: Technical Details ⭐ SHOWS PRECISION
**Query:** "What were the performance benchmarks?"

**Expected Ava Response:**
```
Myles ran performance benchmarks on three databases: PostgreSQL averaged 85ms, 
MongoDB averaged 90ms, and MySQL averaged 120ms. The team's requirement was 
sub-100ms response times, so both PostgreSQL and MongoDB met the requirements.
```

**Sources Shown:** 2-3 messages
- Myles: "Update: PostgreSQL averaging 85ms, MongoDB 90ms, MySQL 120ms." (75%)
- Hadi: "Both PostgreSQL and MongoDB meet our requirements." (52%)

**Why Great for Demo:**
- ✅ Shows numeric data extraction
- ✅ Comparative analysis
- ✅ Technical precision

---

## 🔍 Semantic Search Test Cases (Direct Search)

### Test Case 1: Exact Keyword Match ⭐ SHOWS 100% SCORE
**Query:** "Redis"

**Expected Results:**
```
1. Myles L - Dan G, Myles L (Exact 100%)
   "Redis is back up. Error rates should start dropping now."

2. Myles L - Dan G, Myles L (Exact 100%)
   "I'm restarting Redis service now. Should be back up in 2 minutes."

3. Dan G - Dan G, Myles L (Exact 100%)
   "All users affected, this is critical. Looks like redis connection timeouts."
```

**Why Great for Demo:**
- ✅ Shows green "Exact" badges
- ✅ All results at 100%
- ✅ Instant results (<2s)
- ✅ Perfect for keyword precision demo

---

### Test Case 2: Semantic Match (Decision) ⭐ BEST OVERALL
**Query:** "What database did we choose?"

**Expected Results:**
```
1. Myles L - 59%
   "I lean towards PostgreSQL. We have experience and it handles complex 
    queries well."

2. Dan G - 59%
   "Decision made: PostgreSQL for analytics database. Hadi, update the docs?"

3. Hadi R - 56%
   "Both PostgreSQL and MongoDB meet our requirements."

4. Hadi R - 56%
   "I'm thinking PostgreSQL vs MongoDB. What do you think?"
```

**Why Great for Demo:**
- ✅ Shows semantic understanding
- ✅ Sorted by relevance (59% → 56%)
- ✅ Multiple perspectives on same topic
- ✅ Natural language query

---

### Test Case 3: Q&A Context Detection ⭐ SHOWS NEW FEATURE
**Query:** "Who will run benchmarks?"

**Expected Results:**
```
1. Myles L - 64%
   "I can run benchmarks this week. Should I test all three options?"

2. Dan G - 48% (Question)
   "Perfect. Myles, can you have benchmarks ready by Wednesday?"

3. Hadi R - Context (Answer to question 2)
   "Yes, that would help. I can handle the MongoDB setup."
```

**Why Great for Demo:**
- ✅ Shows Q&A detection (orange "Context" badge)
- ✅ Demonstrates answer follows question
- ✅ Smart context feature highlight

---

### Test Case 4: Production Emergency ⭐ SHOWS URGENCY
**Query:** "production issue"

**Expected Results:**
```
1. Dan G - 68%
   "@Myles URGENT: Production API returning 503 errors. 40% of requests failing."

2. Myles L - 52%
   "How many users affected? I'm checking logs now."

3. Dan G - 46%
   "All users affected. This is critical. Looks like Redis connection timeouts."
```

**Why Great for Demo:**
- ✅ Shows urgent message detection
- ✅ Real-world crisis scenario
- ✅ Semantic match on "issue" → "urgent", "critical"

---

### Test Case 5: Team Member Query
**Query:** "What did Hadi work on?"

**Expected Results:**
```
1. Hadi R - 58%
   "I'll update the architecture docs today."

2. Hadi R - 52%
   "I'm thinking PostgreSQL vs MongoDB. What do you think?"

3. Hadi R - 48%
   "Yes, that would help. I can handle the MongoDB setup."

4. Dan G - 45%
   "Hadi, can you make mobile charts lighter? Maybe 7 days instead of 30?"
```

**Why Great for Demo:**
- ✅ Person-focused search
- ✅ Shows multiple activities
- ✅ Mix of statements and assignments

---

## 🎬 Video Demo Script (2 Minutes)

### Part 1: Semantic Search (45 seconds)

1. **Show Speed:** Type "Redis" → Press Search
   - *"Here's an exact keyword match - notice the 100% scores and green 'Exact' badges."*
   - **Time: 2 seconds**

2. **Show Semantic:** Type "What database did we choose?"
   - *"Now a natural language query - it understands 'database decision' semantically."*
   - *"Results sorted by relevance: 59%, 56%, showing different perspectives."*
   - **Time: 2-3 seconds**

3. **Show Q&A Context:** Click top result
   - *"Notice the orange 'Context' badge - this is an answer to the question above it."*
   - *"Our AI detected the question-answer pattern automatically."*

### Part 2: Ava Chat (45 seconds)

4. **Show Ava:** Open Ava chat → Type "What database did we choose and why?"
   - *"Watch Ava synthesize an answer from multiple messages..."*
   - **Time: 3-4 seconds**
   
5. **Show Answer:**
   - *"Ava gives a comprehensive answer citing specific team members."*
   - *"She explains the decision, the reasoning, and even the next steps."*

6. **Show Sources:** Scroll to sources
   - *"Click any source to see the original message in context."*

### Part 3: Production Emergency (30 seconds)

7. **Show Emergency Search:** Type "production issue"
   - *"Here's a real production emergency - found in 2 seconds."*
   - *"Shows urgent messages, timeline, and resolution."*

8. **Ask Ava:** "What happened with the production issue?"
   - *"Ava reconstructs the entire incident: what happened, who fixed it, how long it took."*
   - *"This is the power of AI-powered search."*

---

## 📊 Expected Performance

| Test Case | Expected Time | Result Count | Score Range |
|-----------|--------------|--------------|-------------|
| "Redis" (exact) | <2s | 3-4 | 100% |
| "What database..." | 2-3s | 4-5 | 56-59% |
| "Who will run..." | 2-3s | 3-4 | 48-64% + context |
| "production issue" | 2-3s | 3-4 | 46-68% |
| Ava: "What database..." | 3-4s | Answer + 3-5 sources | N/A |
| Ava: "What happened..." | 3-4s | Answer + 4-5 sources | N/A |

---

## ✅ Pre-Demo Checklist

### Data Setup:
- [ ] Verify test conversations exist in database
- [ ] Confirm messages are embedded in Pinecone
- [ ] Test all queries return results

### App Setup:
- [ ] Login as test user with access to test conversations
- [ ] Clear any cached searches
- [ ] Ensure good network connection

### Demo Environment:
- [ ] Screen recording software ready
- [ ] Device in portrait mode (mobile view)
- [ ] Good lighting, no notifications
- [ ] Practice run (2-3 times)

---

## 🎯 Key Talking Points

### For Semantic Search:
1. **Speed:** "Results in 2-3 seconds, even searching thousands of messages"
2. **Intelligence:** "Understands natural language, not just keywords"
3. **Precision:** "Exact matches at 100%, semantic matches scored by relevance"
4. **Context:** "Automatically detects question-answer patterns"

### For Ava:
1. **Synthesis:** "Doesn't just find messages - synthesizes answers"
2. **Citations:** "Cites specific people and messages, fully transparent"
3. **Multi-message:** "Combines information from multiple sources"
4. **Natural:** "Talk to Ava like a team member, not a search engine"

---

## 🚨 Backup Queries (If Main Ones Fail)

### Semantic Search Backups:
- "benchmarks" (exact match)
- "database decision" (semantic)
- "urgent" (finds production issues)
- "Myles" (person search)

### Ava Backups:
- "What was the performance of PostgreSQL?"
- "Who fixed the Redis problem?"
- "What tasks did Myles complete?"

---

## 📝 Notes

- All test cases use data from test-conversations.md
- Queries designed to showcase different features
- Results are predictable and impressive
- Total demo time: ~2 minutes for full flow
- Can be shortened to 60 seconds (just show best cases)

**Ready for recording!** 🎥

