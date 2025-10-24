# Test Conversations for AI Features (Video-Ready)

**Focused on 3 key scenarios to test all AI features with max 3 users per conversation**

---

## Scenario 1: #backend-team (Database Decision)
**Participants:** Myles Lewis, Dan Greenlee, Hadi Raad  
**Context:** 15 messages over 2 days - database migration decision

### Day 1 - Monday 9:00 AM PT

**Dan Greenlee:** Team, we need to decide on the database for analytics. Deadline is Friday.

**Hadi Raad:** I'm thinking PostgreSQL vs MongoDB. What do you think?

**Myles Lewis:** I lean towards PostgreSQL. We have experience and it handles complex queries well.

**Dan Greenlee:** Good point. What about performance? We need sub-100ms response times.

**Myles Lewis:** I can run benchmarks this week. Should I test all three options?

**Hadi Raad:** Yes, that would help. I can handle the MongoDB setup.

**Dan Greenlee:** Perfect. Myles, can you have benchmarks ready by Wednesday?

**Myles Lewis:** I'll handle PostgreSQL and MySQL. Hadi, you take MongoDB?

**Hadi Raad:** Sounds good. I'll get MongoDB ready today.

### Day 2 - Tuesday 2:00 PM PT

**Myles Lewis:** Update: PostgreSQL averaging 85ms, MongoDB 90ms, MySQL 120ms.

**Hadi Raad:** Both PostgreSQL and MongoDB meet our requirements.

**Dan Greenlee:** What about team experience? Myles and I are comfortable with PostgreSQL.

**Myles Lewis:** Our existing infrastructure already uses PostgreSQL too.

**Hadi Raad:** I agree. PostgreSQL makes sense - good performance, team experience, fits our stack.

**Dan Greenlee:** Decision made: PostgreSQL for analytics database. Hadi, update the docs?

**Hadi Raad:** I'll update the architecture docs today.

**Myles Lewis:** I can help with the schema design. Let's sync tomorrow.

**Dan Greenlee:** Perfect. Great decision process team!

---

## Scenario 2: Direct Message (Urgent Production Issue)
**Participants:** Myles Lewis, Dan Greenlee, Hadi Raad  
**Context:** 8 messages over 30 minutes - critical production outage

### 2:15 PM PT

**Dan Greenlee:** @Myles URGENT: Production API returning 503 errors. 40% of requests failing.

**Myles Lewis:** How many users affected? I'm checking logs now.

**Hadi Raad:** I'm seeing the same errors. This is affecting all users.

**Dan Greenlee:** All users affected. This is critical. Looks like Redis connection timeouts.

**Myles Lewis:** I'm restarting Redis service now. Should be back up in 2 minutes.

**Hadi Raad:** Good. I'm monitoring error rates. Let me know when it's back up.

**Myles Lewis:** Redis is back up. Error rates should start dropping now.

**Dan Greenlee:** Yes, I see improvement. Error rate down to 5% now.

**Myles Lewis:** Great! I'll monitor for the next hour to ensure stability.

**Dan Greenlee:** Perfect. Thanks for the quick response. Could have been much worse.

---

## Scenario 3: #design-review (UI Feedback)
**Participants:** Myles Lewis, Dan Greenlee, Hadi Raad, Adrian Lorenzo  
**Context:** 12 messages over 2 days - dashboard design feedback

### Day 1 - Tuesday 11:00 AM PT

**Hadi Raad:** Hey team! I've shared new dashboard mockups in Figma. Can you review?

**Myles Lewis:** Layout looks clean, but I'm concerned about real-time chart performance.

**Dan Greenlee:** I agree. Those charts might be heavy for mobile users.

**Adrian Lorenzo:** The color scheme looks great! I like the new branding.

**Hadi Raad:** Good feedback! I can simplify charts for mobile. What about desktop?

**Myles Lewis:** Desktop version looks good. Sidebar navigation is intuitive.

**Dan Greenlee:** Hadi, can you make mobile charts lighter? Maybe 7 days instead of 30?

**Hadi Raad:** Perfect! I'll update mockups and share tomorrow.

**Myles Lewis:** Once you have final mockups, I can start backend API changes.

**Adrian Lorenzo:** I'll handle frontend implementation. Target next sprint?

**Hadi Raad:** I'll have final mockups by Friday EOD.

### Day 2 - Wednesday 2:00 PM PT

**Hadi Raad:** Updated mockups ready! I've simplified mobile charts and reduced data points.

**Myles Lewis:** These look much better! Mobile performance should be good now.

**Dan Greenlee:** Agreed. Desktop version still looks great.

**Dan Greenlee:** The mobile version looks much cleaner now. Great work!

**Hadi Raad:** Great! Let me know if you need any design clarification.

**Myles Lewis:** Will do. Thanks for the quick turnaround on mobile optimization.

**Adrian Lorenzo:** Yes, great work Hadi!

---

## AI Feature Testing Scenarios

### Thread Summarization Tests
- **Scenario 1**: 15 messages over 2 days - should extract database decision process and timeline
- **Scenario 2**: 8 messages over 30 minutes - should summarize urgent production issue resolution with team coordination
- **Scenario 3**: 12 messages over 2 days - should extract design feedback and decisions

### Action Item Extraction Tests
- **Scenario 1**: "Myles, can you have benchmarks ready by Wednesday?" → Action item for Myles
- **Scenario 2**: "I'm restarting Redis service now" → Action item for Myles
- **Scenario 3**: "Hadi, can you have final mockups by Friday?" → Action item for Hadi

### Smart Search Tests
- **Query**: "What did we decide about the database?" → Should find PostgreSQL decision
- **Query**: "What was the production issue?" → Should find Redis outage details and team coordination
- **Query**: "Who is handling the frontend work?" → Should find Dan's assignments

### Priority Message Detection Tests
- **Scenario 2**: "URGENT: Production API returning 503 errors" → Should flag as urgent (🔴)
- **Scenario 1**: "Team, we need to decide on the database" → Should flag as important (🟡)
- **Scenario 3**: "Hey team! I've shared new dashboard mockups" → Should flag as normal (⚪)

### Decision Tracking Tests
- **Scenario 1**: "Decision made: PostgreSQL for analytics database" → Should extract decision
- **Scenario 2**: "Redis is back up" → Should extract resolution decision
- **Scenario 3**: "These look much better!" → Should extract design approval decision

### Proactive Assistant Triggers
- **Scenario 1**: "We need to decide by Friday" → Should trigger deadline reminder
- **Scenario 2**: Production outage → Should trigger escalation notification
- **Scenario 3**: "I can start backend API changes" → Should trigger meeting scheduling suggestion

---

## Test Data Setup Instructions

1. **Create these 3 conversations** with exact message content and timestamps
2. **Assign participants** (Myles Lewis, Dan Greenlee, Hadi Raad, Adrian Lorenzo)
3. **Set message statuses** (sent, delivered, read)
4. **Test each AI feature** with the scenarios above
5. **Verify AI responses** match expected behavior from PRD

These condensed conversations provide focused test data that thoroughly exercises all AI features while being digestible for video demonstration.
