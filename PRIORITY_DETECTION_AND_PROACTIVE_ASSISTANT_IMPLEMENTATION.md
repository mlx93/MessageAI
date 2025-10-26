# Priority Detection & Proactive Assistant Implementation Plan

**Date:** October 26, 2025  
**Status:** Not Visible - Backend Exists, Frontend Disabled  
**Rubric Impact:** 25 points (Feature 4: 15pts + Advanced Feature B: 10pts)

---

## Executive Summary

**Current State:**
- Backend Cloud Functions exist (`detectPriority`, `proactiveAgent`) but are not integrated
- Frontend UI components commented out ("TEMPORARILY DISABLED: AI components while indexes build")
- No visible priority badges, no proactive suggestions appearing in app
- Rubric requires these features to be fully functional and demonstrable

**Gap Analysis:**
- Priority detection runs on message creation but results aren't displayed
- Proactive agent exists but no triggers are calling it
- UI components exist but are disabled in chat screen
- Missing: Integration, testing, visibility, demonstration readiness

**This Document:**
- Summarizes what each feature should do per rubric requirements
- Analyzes current backend implementation strengths and gaps
- Outlines frontend integration approach without code
- Defines testing strategy to ensure rubric compliance
- Provides deployment checklist for demo-ready features

---

## Part 1: Priority Message Detection (Feature 4 - Required)

### Rubric Requirements (15 points)

**Excellent (14-15 points):**
- All 5 required AI features implemented and working excellently
- Features genuinely useful for persona's pain points (Remote Team Professional)
- Natural language commands work 90%+ of the time
- Fast response times (<2s for simple commands)
- Clean UI integration (contextual menus, chat interface, or hybrid)
- Clear loading states and error handling

**Specific to Priority Detection:**
- Flags urgent messages accurately (production issues, blocking problems, ASAP/CRITICAL keywords)
- Identifies important messages (direct questions, time-sensitive, needs response today)
- Works in real-time as messages arrive
- Clear visual indicators (badges, colors, icons)
- Doesn't create notification fatigue with false positives

### Current Backend Implementation

**File:** `functions/src/ai/priorityDetection.ts`

**Strengths:**
1. **Two entry points:**
   - `detectPriority` - Callable function for on-demand detection
   - `detectPriorityOnMessage` - Firestore trigger that runs automatically on message creation

2. **GPT-4o-mini classification:**
   - Fast and cost-effective model choice
   - Clear prompt with three priority levels (urgent/important/normal)
   - Considers urgency keywords, @mentions, questions, time pressure
   - Returns confidence score and reasoning

3. **Automatic persistence:**
   - Updates message document with `priority`, `priorityConfidence`, `priorityReason`
   - Timestamped for tracking

4. **Error handling:**
   - Doesn't fail message creation if detection fails
   - Logs errors for debugging

**Gaps:**
1. **No visibility:** Results stored but never displayed to users
2. **No filtering:** No "Priority Inbox" or filtered view of urgent/important messages
3. **No notifications:** Urgent messages don't trigger special alerts
4. **No feedback loop:** Can't mark false positives or train the system
5. **Limited context:** Doesn't consider conversation history or user patterns
6. **No bulk detection:** Can't retroactively detect priority in existing messages

### Implementation Approach (Frontend Integration)

**1. Visual Indicators in Chat**
- Display priority badges next to messages (🔴 urgent, 🟡 important)
- Show confidence percentage on tap/long-press
- Include AI reasoning in message details
- Subtle styling that doesn't disrupt conversation flow

**2. Priority Inbox Screen**
- New Ava tab or section: "Priority Messages"
- Filter messages by priority level (urgent/important)
- Sort by timestamp or confidence score
- Show conversation context (who, when, where)
- Quick navigation to full conversation

**3. Enhanced Notifications**
- Urgent messages bypass quiet hours
- Custom notification sound/vibration for urgent priority
- Rich notification content showing priority level
- Smart bundling: Don't spam if multiple urgent messages from same conversation

**4. Batch Analysis**
- "Analyze Priority" button on Ava screen
- Scans recent messages (last 24h/7d/30d) and applies detection
- Progress indicator during analysis
- Summary: "Found 3 urgent, 7 important messages"
- Stores results in Firestore for persistent filtering

**5. User Feedback Loop**
- "Not urgent" / "Not important" buttons on badges
- Tracks corrections per user
- Future: Use corrections to improve prompts or fine-tune

### Visible Features in Chat Screen

**In-Chat Display:**
- Priority badges appear inline next to sender names in group chats (🔴 urgent, 🟡 important)
- In direct messages, badges appear above the message bubble
- Badges are small, subtle, and don't disrupt message alignment or grouping
- Tapping a badge shows confidence score and AI reasoning in a small tooltip
- No layout shifts or jumps when badges appear (render after message is positioned)

**Priority Inbox (Ava Tab):**
- New screen accessible from Ava navigation: "Priority Messages"
- Shows filtered list of urgent and important messages across all conversations
- Each entry shows: message preview, sender, conversation name, timestamp
- Tapping an entry navigates to full conversation at that message
- "Analyze Priority" button to batch-process recent messages

**Integration Constraints:**
- Badges must not interfere with message grouping logic (isFirstInGroup/isLastInGroup)
- Must not trigger re-renders of MessageRow component unnecessarily
- Priority data loaded asynchronously after initial message render (no blocking)
- Cached in SQLite alongside messages for instant display on return visits
- Respects existing scroll position and doesn't cause layout recalculation

### Testing Strategy

**Core Validation:**
- Send test messages with urgent/important/normal content → verify correct classification
- Check badges appear within 5 seconds without layout shift
- Verify Priority Inbox filters and navigation work correctly
- Test offline behavior (show cached priorities, graceful degradation)
- Validate >85% accuracy on 50+ real messages (per rubric requirement)

---

## Part 2: Proactive Assistant (Advanced Feature B)

### Rubric Requirements (10 points)

**Excellent (9-10 points):**
- Advanced capability fully implemented and impressive
- **Proactive Assistant:** Monitors conversations intelligently, triggers suggestions at right moments, learns from user feedback
- Uses required agent framework correctly (AI SDK by Vercel)
- Response times meet targets (<15s for agents)
- Seamless integration with other features

**Specific Requirements:**
- Detects scheduling needs (3+ people discussing "let's meet", "schedule", "when can we")
- Auto-suggests meeting times based on conversation (no calendar sync required)
- Flags overdue action items proactively
- Surfaces relevant context when someone asks about past discussions
- Only suggests when TRULY helpful (max 1 per conversation per day)

### Current Backend Implementation

**File:** `functions/src/ai/proactiveAgent.ts`

**Strengths:**
1. **Meeting detection logic:**
   - Checks for scheduling keywords (meet, schedule, call, sync, when can)
   - Validates participant count (3+)
   - Generates 3 time suggestions (tomorrow, 3 days, 4 days out)
   - Creates suggestion in Firestore `proactive_suggestions` collection

2. **Overdue action items:**
   - Queries action_items collection for pending items past deadline
   - Creates reminder suggestion with list of overdue tasks
   - Actionable button: "View Action Items"

3. **Graceful handling:**
   - Returns "No proactive action needed" when triggers don't match
   - Logs all processing for debugging
   - Tracks tools used for metrics

**Gaps:**
1. **No triggers:** Backend function exists but nothing calls it
2. **No visibility:** Suggestions stored in Firestore but not displayed in UI
3. **Missing RAG integration:** Planned RAG search for conversation history not implemented
4. **No conflict detection:** Doesn't detect deadline conflicts or decision conflicts
5. **No context gaps:** Doesn't identify when someone needs background information
6. **Limited scope:** Only 2 triggers (meetings, overdue actions) vs 5 planned
7. **No learning:** No feedback loop or usage tracking

### Implementation Approach (Triggers + UI)

**1. Trigger System (Backend)**

**Cloud Function Triggers:**
- Firestore trigger on new messages (detect patterns in real-time)
- Scheduled function (every 5 minutes) checks for:
  - Conversations with 3+ messages in last hour containing scheduling keywords
  - Overdue action items not reminded about recently
  - Questions that could benefit from context (RAG search)
  - Decision conflicts (new decisions contradicting old ones)
  - Deadline conflicts (overlapping deadlines for same person)

**Trigger Conditions:**
- Rate limiting: Max 4 suggestions per conversation per 24 hours
- Response time: Agent responds within ~5 seconds for all suggestion types
- Confidence threshold: Only suggest when >70% confident it's helpful
- User preferences: Respect quiet hours and opt-out settings
- Conversation activity: Don't trigger on stale conversations (no messages in 3+ days)

**Response Speed (All ~5 seconds):**
- Real-time triggers: 3-7 seconds from message creation to suggestion display
- Simple keyword detection: 3-5 seconds (meeting scheduling, overdue reminders)
- RAG-enhanced suggestions: 4-7 seconds (includes semantic search + generation)
  - Embedding generation: ~500-800ms
  - Pinecone search (topK=10-20): ~500-1000ms
  - GPT-4o-mini suggestion: ~1-2s
  - Firestore write + client notification: ~300-500ms

**Performance Optimizations:**
- Use lightweight topK=10-20 for proactive search (vs topK=100 for full search)
- Skip reranking step (pure Pinecone similarity, no GPT-4o overhead)
- Use GPT-4o-mini for fast suggestion generation
- Parallel processing where possible (embedding + metadata fetching)

**2. RAG Integration**

**Search Conversation History:**
- When question detected ("What did we decide about X?")
- Generate query embedding (OpenAI text-embedding-3-large)
- Search Pinecone for relevant past messages (top 5)
- Use context in proactive suggestion: "I found these related discussions..."

**Meeting Context:**
- Search for past meetings between same participants
- Extract typical meeting times/patterns
- Use in time suggestions: "You usually meet Tuesdays at 2pm"

**3. Frontend Integration (Suggestion Cards)**

**UI Components:**
- Suggestion cards displayed above message input
- Blue background with lightbulb icon 💡
- Clear message: "I noticed 3 people discussing a meeting..."
- Action buttons: Time suggestion buttons, "Dismiss", "Not now"
- Slide-up animation when new suggestion appears
- Swipe to dismiss gesture

**Suggestion Types:**
- **Meeting:** Show 3 time options as buttons, "Propose in chat"
- **Reminder:** "View overdue items", "Snooze 1 day"
- **Context:** Show relevant past messages, "Jump to discussion"
- **Conflict:** "Review deadlines", "Reassign task"
- **Decision:** "Compare decisions", "View history"

**4. Feedback Loop**

**User Actions Tracked:**
- Accepted: User clicked a time suggestion or action button
- Dismissed: User explicitly dismissed without action
- Ignored: Suggestion expired after 24h with no interaction
- Not helpful: User marked "Not helpful" (optional feedback button)

**Metrics Dashboard (Admin/Debug):**
- Suggestions generated per day
- Acceptance rate by type
- False positive rate (dismissed immediately)
- Response time (trigger → suggestion shown)
- Most valuable trigger types

### Visible Features in Chat Screen

**Suggestion Cards:**
- Appear above message input area, below any offline/queue banners
- Blue gradient background with lightbulb icon (💡)
- Clear message text explaining what was detected
- 1-3 action buttons (e.g., "Tuesday 2pm", "View Items", "Dismiss")
- Slide-up animation when appearing, slide-down when dismissed
- Swipe-down gesture to dismiss quickly
- Max height 120px to avoid obscuring messages

**Integration Constraints:**
- Cards positioned absolutely to not affect message list layout
- Must not interfere with keyboard avoidance behavior
- Rendered outside FlatList to prevent scroll position changes
- State managed separately from messages (no message re-renders)
- Only one suggestion visible at a time (newest replaces older)
- Dismissed suggestions tracked to prevent re-appearance

**Suggestion Types Displayed:**
- **Meeting:** "I noticed 3 people discussing a meeting..." → time buttons
- **Reminder:** "You have 2 overdue action items..." → "View Items" button
- **Context:** "I found relevant past discussions..." → "Show Context" button

### Testing Strategy

**Core Validation:**
- Create 3+ person group, type scheduling keywords → verify suggestion appears <7s
- Create overdue action item → verify reminder triggered <7s
- Test rate limiting (max 4 suggestions per conversation per 24h)
- Test response speed: All real-time triggers <7 seconds
- Verify cards don't cause scroll jumps or keyboard issues
- Validate >80% acceptance rate (suggestions are helpful, not annoying)

---

## Part 3: Integration Checklist

### Backend Setup

**Cloud Functions:**
- [ ] Verify `detectPriority` deployed and callable
- [ ] Verify `detectPriorityOnMessage` trigger active
- [ ] Verify `proactiveAgent` deployed and callable
- [ ] Create new trigger function: `checkProactiveTriggers` (Firestore + scheduled)
- [ ] Test error handling and logging
- [ ] Verify Firebase secrets set (OPENAI_API_KEY)

**Firestore Structure:**
- [ ] Verify messages have `priority`, `priorityConfidence`, `priorityReason` fields
- [ ] Verify `proactive_suggestions` collection exists
- [ ] Add indexes for queries (priority filtering, suggestion status)
- [ ] Test security rules (who can read/update suggestions)

**RAG Pipeline:**
- [ ] Verify Pinecone index exists and has embeddings
- [ ] Test semantic search for conversation history
- [ ] Verify metadata filtering (conversationId, timestamp)

### Frontend Integration

**UI Components:**
- [ ] Uncomment `PriorityBadge` component in chat screen
- [ ] Create `PriorityInbox` screen in Ava tab
- [ ] Uncomment `ProactiveSuggestionCard` component
- [ ] Add "Analyze Priority" button to Ava screen
- [ ] Create feedback buttons (Not urgent, Not important, Not helpful)

**Services:**
- [ ] Uncomment `aiService` import in chat screen
- [ ] Add priority filtering methods to `aiService`
- [ ] Add proactive suggestion subscription
- [ ] Add feedback submission methods
- [ ] Handle offline gracefully (show cached priorities)

**Navigation:**
- [ ] Add Priority Inbox to Ava navigation
- [ ] Add deep links from priority notifications
- [ ] Add navigation from suggestion cards to full conversation

### Testing & Validation

**Manual Testing:**
- [ ] Send urgent message → badge appears within 5 seconds
- [ ] Create 3-person group, discuss meeting → suggestion appears
- [ ] Create overdue action → reminder appears
- [ ] Filter by priority → correct messages shown
- [ ] Dismiss suggestion → doesn't reappear
- [ ] Accept time suggestion → works as expected

**Accuracy Testing:**
- [ ] Test 50 messages, validate priority accuracy >85%
- [ ] Test 20 conversations, validate suggestion relevance >80%
- [ ] Review false positives/negatives
- [ ] Adjust prompts/thresholds as needed

**Performance Testing:**
- [ ] Priority detection <2s per message
- [ ] Proactive agent <15s from trigger to suggestion
- [ ] Priority inbox loads <1s
- [ ] No UI jank or freezing

---

## Part 5: Integration Safeguards

### Preserving Chat Screen Performance

**Critical Requirements:**
- Priority badges must render AFTER message positioning (no layout shifts)
- Suggestion cards positioned absolutely (don't affect FlatList layout)
- No new subscriptions that trigger message re-renders
- Priority data loaded asynchronously and cached in SQLite
- All animations use worklet-safe patterns (no Reanimated conflicts)

**Potential Issues to Monitor:**
- Badge rendering causing MessageRow re-renders → Solution: Memoize with priority in comparison
- Suggestion cards interfering with keyboard → Solution: KeyboardAvoidingView padding adjustment
- Priority detection slowing message sends → Solution: Fire-and-forget pattern (no blocking)
- Excessive re-renders from proactive suggestion updates → Solution: Separate state management

---

## Part 4: Success Metrics

### Feature 4: Priority Detection (15 points)

**Quantitative:**
- ✅ >85% accuracy on manual review (50+ messages)
- ✅ <2s response time (95th percentile)
- ✅ Visible badges in chat, priority inbox functional
- ✅ Notifications working for urgent messages

**Qualitative:**
- ✅ Solves "missing important messages" pain point
- ✅ Natural and unobtrusive UI
- ✅ Clear reasoning shown to user
- ✅ Error handling graceful (offline, API failures)

### Advanced Feature B: Proactive Assistant (10 points)

**Quantitative:**
- ✅ Meeting detection working (3+ people + keywords)
- ✅ Time suggestions generated and actionable
- ✅ Overdue reminders triggered correctly
- ✅ <7s response time for all suggestion types (95th percentile)
- ✅ RAG integration functional with optimized performance

**Qualitative:**
- ✅ Solves "time zone coordination" pain point
- ✅ Suggestions truly helpful (>80% acceptance)
- ✅ Not annoying or intrusive (<10% immediate dismissals)
- ✅ AI SDK framework used correctly
- ✅ Impressive demo (wow factor)

---

## Part 5: Critical Fixes Required

### Backend

1. **Create Trigger Function** (`checkProactiveTriggers`)
   - Scheduled function (every 5 minutes)
   - Check active conversations for trigger patterns
   - Call `proactiveAgent` when conditions met
   - Respect rate limiting and user preferences

2. **Implement RAG Search** in `proactiveAgent`
   - Add tool for searching conversation history
   - Generate embeddings for queries
   - Query Pinecone with context filters
   - Include relevant results in suggestions

3. **Enhance Priority Detection**
   - Add bulk analysis endpoint (retroactive detection)
   - Add confidence calibration (track accuracy)
   - Add feedback endpoint (mark false positives)

### Frontend

1. **Enable Existing Components**
   - Uncomment all AI component imports
   - Verify styling matches current design system
   - Test on iOS and Android

2. **Create Priority Inbox**
   - New screen in Ava section
   - Filter messages by priority
   - Show conversation context
   - Quick navigation to full chat

3. **Subscription to Suggestions**
   - Real-time listener on `proactive_suggestions`
   - Filter by conversationId and status
   - Display as cards above input
   - Handle accept/dismiss actions

### Testing

1. **End-to-End Tests**
   - Full user flow: Message → Detection → Badge display
   - Full trigger flow: Pattern → Suggestion → Action
   - Error scenarios: Offline, API failure, timeout

2. **Accuracy Validation**
   - Manual review of 50+ messages
   - Calculate precision/recall
   - Adjust prompts if <85% accuracy

3. **Performance Profiling**
   - Measure response times under load
   - Check for memory leaks
   - Verify battery impact minimal

---

## Conclusion

**Current Situation:**
Backend functions exist but are disconnected from the UI. Users cannot see priority badges or proactive suggestions, making these features invisible for rubric evaluation.

**Required Work (Estimate: 8-12 hours):**
1. Backend triggers (2-3 hours): Create scheduled function to call proactive agent
2. Frontend integration (3-4 hours): Enable components, wire up subscriptions
3. Testing (2-3 hours): Validate accuracy, fix bugs, tune prompts
4. Demo preparation (1-2 hours): Create test scenarios, record video

**Priority Order:**
1. Enable priority badges (highest impact, easiest)
2. Create priority inbox (demonstrate filtering)
3. Add proactive triggers (scheduled function)
4. Enable suggestion cards (complete advanced feature)
5. Test and tune for demo (ensure rubric compliance)

**Rubric Impact:**
Successfully implementing these features brings 25 points (15 + 10) and demonstrates AI capabilities that genuinely help the Remote Team Professional persona manage information overload and coordination challenges.

