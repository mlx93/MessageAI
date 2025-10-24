import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {defineSecret} from "firebase-functions/params";
import {openai} from "@ai-sdk/openai";
import {generateText} from "ai";
import * as admin from "firebase-admin";

const openaiKey = defineSecret("OPENAI_API_KEY");

/**
 * Enhanced Proactive Triggers for MessageAI
 *
 * This module implements advanced proactive AI triggers:
 * - Deadline conflicts and missed deadlines
 * - Decision conflicts and contradictions
 * - Overdue action items
 * - Context gaps for new participants
 * - Escalation needs
 */

interface TriggerContext {
  conversationId: string;
  messageId: string;
  messageText: string;
  senderId: string;
  timestamp: number;
  participants: string[];
  conversationType: "direct" | "group";
}

interface ProactiveSuggestion {
  type: "deadline_conflict" | "decision_conflict" |
    "overdue_action" | "context_gap" | "escalation";
  message: string;
  actions: Array<{label: string; action: string}>;
  priority: "high" | "medium" | "low";
  confidence: number;
}

/**
 * Detect deadline conflicts and missed deadlines
 */
export const detectDeadlineConflicts = onDocumentCreated({
  document: "messages/{messageId}",
  secrets: [openaiKey],
  memory: "1GiB",
}, async (event) => {
  const message = event.data?.data();
  if (!message) return;

  const context: TriggerContext = {
    conversationId: message.conversationId,
    messageId: event.params.messageId,
    messageText: message.text,
    senderId: message.senderId,
    timestamp: message.timestamp,
    participants: message.participants || [],
    conversationType: message.conversationType || "direct",
  };

  // Only process text messages with potential deadline content
  if (message.type !== "text" || !message.text) return;

  try {
    const suggestion = await analyzeDeadlineConflicts(context);
    if (suggestion) {
      await createProactiveSuggestion(
        context.conversationId,
        suggestion
      );
    }
  } catch (error) {
    console.error("Error in deadline conflict detection:", error);
  }
}
);

/**
 * Detect decision conflicts and contradictions
 */
export const detectDecisionConflicts = onDocumentCreated({
  document: "messages/{messageId}",
  secrets: [openaiKey],
  memory: "1GiB",
}, async (event) => {
  const message = event.data?.data();
  if (!message) return;

  const context: TriggerContext = {
    conversationId: message.conversationId,
    messageId: event.params.messageId,
    messageText: message.text,
    senderId: message.senderId,
    timestamp: message.timestamp,
    participants: message.participants || [],
    conversationType: message.conversationType || "direct",
  };

  // Only process text messages
  if (message.type !== "text" || !message.text) return;

  try {
    const suggestion = await analyzeDecisionConflicts(context);
    if (suggestion) {
      await createProactiveSuggestion(
        context.conversationId,
        suggestion
      );
    }
  } catch (error) {
    console.error("Error in decision conflict detection:", error);
  }
}
);

/**
 * Monitor for overdue action items
 */
export const detectOverdueActions = onDocumentUpdated({
  document: "action_items/{actionItemId}",
  secrets: [openaiKey],
  memory: "1GiB",
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;

  // Only trigger if status changed or deadline passed
  const statusChanged = before.status !== after.status;
  const deadlinePassed = after.deadline &&
      new Date(after.deadline) < new Date() &&
      after.status === "pending";

  if (!statusChanged && !deadlinePassed) return;

  try {
    const suggestion = await analyzeOverdueActions(after);
    if (suggestion) {
      await createProactiveSuggestion(
        after.conversationId,
        suggestion
      );
    }
  } catch (error) {
    console.error("Error in overdue action detection:", error);
  }
}
);

/**
 * Analyze deadline conflicts using AI
 * @param {TriggerContext} context - Message context
 * @return {Promise<ProactiveSuggestion | null>} Suggestion or null
 */
async function analyzeDeadlineConflicts(
  context: TriggerContext
): Promise<ProactiveSuggestion | null> {
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `Analyze this message for deadline conflicts.

Message: "${context.messageText}"
Context: ${context.conversationType} conversation

Look for:
1. Deadlines that have passed (overdue items)
2. Conflicting deadlines (two things due at same time)
3. Unrealistic deadlines (too short notice)
4. Missing deadlines for important tasks

Respond with JSON:
{
  "hasConflict": boolean,
  "type": "overdue" | "conflict" | "unrealistic" | "missing",
  "message": "User-friendly explanation",
  "actions": [{"label": "string", "action": "string"}],
  "priority": "high" | "medium" | "low",
  "confidence": number
}

Only respond if hasConflict is true.`,
  });

  try {
    const analysis = JSON.parse(result.text);
    if (analysis.hasConflict) {
      return {
        type: "deadline_conflict",
        message: analysis.message,
        actions: analysis.actions,
        priority: analysis.priority,
        confidence: analysis.confidence,
      };
    }
  } catch (error) {
    console.error("Error parsing deadline analysis:", error);
  }

  return null;
}

/**
 * Analyze decision conflicts using AI
 * @param {TriggerContext} context - Message context
 * @return {Promise<ProactiveSuggestion | null>} Suggestion or null
 */
async function analyzeDecisionConflicts(
  context: TriggerContext
): Promise<ProactiveSuggestion | null> {
  // Get recent decisions from this conversation
  const db = admin.firestore();
  const decisionsSnapshot = await db
    .collection("decisions")
    .where("conversationId", "==", context.conversationId)
    .where("status", "==", "active")
    .orderBy("madeAt", "desc")
    .limit(5)
    .get();

  if (decisionsSnapshot.empty) return null;

  const recentDecisions = decisionsSnapshot.docs.map(
    (doc) => doc.data()
  );

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `Analyze if this new message conflicts with decisions.

New Message: "${context.messageText}"

Recent Decisions:
${recentDecisions.map((d, i) =>
    `${i + 1}. ${d.decision} (${
      new Date(d.madeAt).toLocaleDateString()
    })`
  ).join("\n")}

Look for:
1. Direct contradictions to previous decisions
2. Implicit reversals of decisions
3. New information that changes decision context
4. Unclear decision-making process

Respond with JSON:
{
  "hasConflict": boolean,
  "conflictType": "direct_contradiction" | "implicit_reversal",
  "conflictingDecision": "Which decision conflicts",
  "message": "User-friendly explanation",
  "actions": [{"label": "string", "action": "string"}],
  "priority": "high" | "medium" | "low",
  "confidence": number
}

Only respond if hasConflict is true.`,
  });

  try {
    const analysis = JSON.parse(result.text);
    if (analysis.hasConflict) {
      return {
        type: "decision_conflict",
        message: analysis.message,
        actions: analysis.actions,
        priority: analysis.priority,
        confidence: analysis.confidence,
      };
    }
  } catch (error) {
    console.error("Error parsing decision analysis:", error);
  }

  return null;
}

/**
 * Analyze overdue action items
 * @param {Record<string, unknown>} actionItem - Action item data
 * @return {Promise<ProactiveSuggestion | null>} Suggestion or null
 */
async function analyzeOverdueActions(
  actionItem: Record<string, unknown>
): Promise<ProactiveSuggestion | null> {
  const now = new Date();
  const deadline = new Date(actionItem.deadline as string);
  const daysOverdue = Math.floor(
    (now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysOverdue <= 0) return null;

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `Analyze this overdue action item.

Action Item: "${actionItem.task}"
Assignee: ${actionItem.assignee || "Unassigned"}
Days Overdue: ${daysOverdue}
Context: ${actionItem.context}

Generate appropriate escalation based on:
1. How overdue it is (1-3 days vs weeks)
2. Importance of the task
3. Whether it is assigned to someone
4. Impact on the team/project

Respond with JSON:
{
  "needsEscalation": boolean,
  "escalationLevel": "gentle_reminder" | "urgent_followup",
  "message": "User-friendly escalation message",
  "actions": [{"label": "string", "action": "string"}],
  "priority": "high" | "medium" | "low",
  "confidence": number
}

Only respond if needsEscalation is true.`,
  });

  try {
    const analysis = JSON.parse(result.text);
    if (analysis.needsEscalation) {
      return {
        type: "overdue_action",
        message: analysis.message,
        actions: analysis.actions,
        priority: analysis.priority,
        confidence: analysis.confidence,
      };
    }
  } catch (error) {
    console.error("Error parsing overdue analysis:", error);
  }

  return null;
}

/**
 * Create a proactive suggestion in Firestore
 * @param {string} conversationId - Conversation ID
 * @param {ProactiveSuggestion} suggestion - Suggestion to create
 * @return {Promise<void>}
 */
async function createProactiveSuggestion(
  conversationId: string,
  suggestion: ProactiveSuggestion
): Promise<void> {
  const db = admin.firestore();

  await db.collection("proactive_suggestions").add({
    conversationId,
    type: suggestion.type,
    message: suggestion.message,
    actions: suggestion.actions,
    priority: suggestion.priority,
    confidence: suggestion.confidence,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(
    `Created proactive suggestion: ${suggestion.type} ` +
    `for conversation ${conversationId}`
  );
}

/**
 * Detect context gaps when new participants join
 */
export const detectContextGaps = onDocumentCreated({
  document: "conversations/{conversationId}",
  secrets: [openaiKey],
  memory: "1GiB",
}, async (event) => {
  const conversation = event.data?.data();
  if (!conversation) return;

  // Check if this is a group conversation
  if (
    conversation.type !== "group" ||
      conversation.participants.length < 3
  ) return;

  try {
    // Get recent messages to analyze context
    const db = admin.firestore();
    const messagesSnapshot = await db
      .collection("messages")
      .where("conversationId", "==", event.params.conversationId)
      .orderBy("timestamp", "desc")
      .limit(20)
      .get();

    if (messagesSnapshot.empty) return;

    const recentMessages = messagesSnapshot.docs.map(
      (doc) => doc.data()
    );

    const suggestion = await analyzeContextGaps(
      recentMessages,
      conversation
    );
    if (suggestion) {
      await createProactiveSuggestion(
        event.params.conversationId,
        suggestion
      );
    }
  } catch (error) {
    console.error("Error in context gap detection:", error);
  }
}
);

/**
 * Analyze context gaps for new participants
 * @param {Array<Record<string, unknown>>} recentMessages - Messages
 * @param {Record<string, unknown>} conversation - Conversation data
 * @return {Promise<ProactiveSuggestion | null>} Suggestion or null
 */
async function analyzeContextGaps(
  recentMessages: Array<Record<string, unknown>>,
  conversation: Record<string, unknown>
): Promise<ProactiveSuggestion | null> {
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `Analyze if new participants need context.

Recent Messages (${recentMessages.length}):
${recentMessages.map((m, i) =>
    `${i + 1}. ${m.sender}: ${m.text}`
  ).join("\n")}

Participants: ${conversation.participants}

Look for:
1. Complex ongoing discussions
2. References to past decisions or events
3. Technical jargon or project-specific terms
4. Unresolved questions or pending items

Respond with JSON:
{
  "needsContext": boolean,
  "contextType": "ongoing_discussion" | "past_references",
  "message": "Suggestion for providing context",
  "actions": [{"label": "string", "action": "string"}],
  "priority": "high" | "medium" | "low",
  "confidence": number
}

Only respond if needsContext is true.`,
  });

  try {
    const analysis = JSON.parse(result.text);
    if (analysis.needsContext) {
      return {
        type: "context_gap",
        message: analysis.message,
        actions: analysis.actions,
        priority: analysis.priority,
        confidence: analysis.confidence,
      };
    }
  } catch (error) {
    console.error("Error parsing context analysis:", error);
  }

  return null;
}
