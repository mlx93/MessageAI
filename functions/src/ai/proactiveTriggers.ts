import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";
import {getOpenAIClient, openaiKey} from "../utils/openai";

/**
 * Generate intelligent meeting time suggestions based on conversation context
 * @param {Array} recentMessages - Recent messages from the conversation
 * @return {Promise<string[]>} Array of suggested meeting times
 */
async function generateMeetingSuggestions(
  recentMessages: Array<{text: string; timestamp: unknown}>
): Promise<string[]> {
  try {
    const openai = getOpenAIClient();

    // Build conversation context
    const conversationText = recentMessages
      .slice(-10) // Last 10 messages for context
      .map((m) => m.text)
      .join("\n");

    const systemPrompt = `You are a meeting scheduling assistant. \
Analyze the conversation and extract or suggest 3 meeting times.

Rules:
1. PRIORITIZE times mentioned in the conversation (e.g., "2 PM Sunday")
2. If specific times are mentioned, use those
3. If no specific times, suggest reasonable times based on context
4. Format each suggestion as: "DayOfWeek Time" (e.g., "Sun 2:00 PM")
5. Suggest times in the next 7 days
6. Return ONLY 3 suggestions, one per line, no numbering

Example output:
Sun 2:00 PM
Sun 3:00 PM
Mon 10:00 AM`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {role: "system", content: systemPrompt},
        {role: "user", content: `Conversation:\n${conversationText}`},
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const suggestionsText =
      response.choices[0].message.content?.trim() || "";
    const suggestions = suggestionsText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 3);

    // Fallback if AI doesn't return enough suggestions
    if (suggestions.length < 3) {
      logger.warn(
        "AI returned fewer than 3 suggestions, using fallback"
      );
      return getFallbackMeetingSuggestions();
    }

    logger.info(`Generated meeting suggestions: ${suggestions.join(", ")}`);
    return suggestions;
  } catch (error) {
    logger.error("Error generating meeting suggestions with AI:", error);
    return getFallbackMeetingSuggestions();
  }
}

/**
 * Fallback meeting suggestions when AI fails
 * @return {string[]} Array of default meeting times
 */
function getFallbackMeetingSuggestions(): string[] {
  const now = new Date();
  return [
    new Date(now.getTime() + 24 * 60 * 60 * 1000).toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }),
    new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toLocaleString(
      "en-US",
      {weekday: "short", hour: "numeric", minute: "2-digit"}
    ),
    new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toLocaleString(
      "en-US",
      {weekday: "short", hour: "numeric", minute: "2-digit"}
    ),
  ];
}

/**
 * Proactive Trigger Detection
 *
 * Automatically detects triggers in new messages and calls the proactive agent
 * when certain conditions are met (e.g., meeting scheduling discussions).
 *
 * Rate Limiting: Max 100 suggestions per conversation per 24 hours
 */
export const checkProactiveTriggers = onDocumentCreated({
  document: "conversations/{conversationId}/messages/{messageId}",
  memory: "512MiB",
  timeoutSeconds: 30,
  secrets: [openaiKey],
}, async (event) => {
  const message = event.data?.data();
  const {conversationId, messageId} = event.params;

  if (!message || !message.text) {
    logger.debug("Skipping trigger check - no message text");
    return;
  }

  const db = admin.firestore();

  try {
    // Rate Limiting: Check how many suggestions created in last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSuggestions = await db
      .collection("proactive_suggestions")
      .where("conversationId", "==", conversationId)
      .where(
        "createdAt",
        ">=",
        admin.firestore.Timestamp.fromDate(twentyFourHoursAgo)
      )
      .get();

    if (recentSuggestions.size >= 100) {
      logger.debug(
        `Rate limit reached for conversation ${conversationId} ` +
        `(${recentSuggestions.size} suggestions in 24h)`
      );
      return;
    }

    // Get recent messages in conversation
    const snapshot = await db
      .collection(`conversations/${conversationId}/messages`)
      .orderBy("timestamp", "desc")
      .limit(10)
      .get();

    const recentMessages = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        sender: data.senderId as string,
        text: data.text as string,
        timestamp: data.timestamp,
      };
    });

    // Get conversation to check participant count
    const convoDoc = await db
      .collection("conversations")
      .doc(conversationId)
      .get();
    const convo = convoDoc.data();

    if (!convo) {
      logger.error(`Conversation ${conversationId} not found`);
      return;
    }

    // TRIGGER 1: Question Detection (someone needs context)
    // CHECK FIRST! Questions should trigger Ava, not meetings
    const questionKeywords = [
      "what did we decide",
      "what was",
      "can someone remind",
      "where did we",
      "who said",
      "when did we",
    ];

    const hasQuestionNeedingContext = recentMessages.some((m) =>
      questionKeywords.some((kw) => m.text.toLowerCase().includes(kw))
    );

    if (hasQuestionNeedingContext) {
      logger.info(
        "Proactive trigger detected: Context gap in " +
        `conversation ${conversationId}`
      );

      await db.collection("proactive_suggestions").add({
        conversationId,
        userId: convo.participants[0],
        message: "I noticed someone asking about past discussions. " +
          "Would you like me to search the conversation history?",
        type: "context_gap",
        priority: "low",
        confidence: 0.75,
        actions: [
          {label: "Search History", action: "search_context"},
          {label: "Dismiss", action: "dismiss"},
        ],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
        triggerMessageId: messageId,
      });

      logger.info(
        `Created context gap suggestion for conversation ${conversationId}`
      );
      return;
    }

    // TRIGGER 2: Meeting Scheduling
    // ONLY if NEW message says "schedule" or "meet"
    // Conservative: explicit scheduling words in CURRENT message only
    const meetingKeywords = ["schedule", "meet"];
    const currentMessageText = message.text.toLowerCase();

    const isSchedulingMessage = meetingKeywords.some((kw) =>
      currentMessageText.includes(kw)
    );

    if (isSchedulingMessage && convo.participants.length >= 2) {
      logger.info(
        "Proactive trigger detected: Meeting scheduling in " +
        `conversation ${conversationId} ` +
        "(current message contains scheduling keyword)"
      );

      // Use AI to extract proposed meeting times from conversation
      const suggestions = await generateMeetingSuggestions(recentMessages);

      const suggestionMessage = convo.participants.length === 2 ?
        "I noticed you're trying to schedule a meeting. " +
        "Here are some time suggestions:\n" +
        suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n") :
        `I noticed ${convo.participants.length} people are ` +
        "trying to schedule a meeting. Here are some time suggestions:\n" +
        suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n");

      await db.collection("proactive_suggestions").add({
        conversationId,
        userId: convo.participants[0], // First participant
        message: suggestionMessage,
        type: "meeting",
        priority: "medium",
        confidence: 0.85,
        actions: suggestions.map((s) => ({
          label: s,
          action: `schedule_meeting_${s}`,
        })),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
        triggerMessageId: messageId,
      });

      logger.info(
        `Created meeting suggestion for conversation ${conversationId}`
      );
      return; // Only one suggestion per trigger
    }

    // TRIGGER 3: Check for overdue action items
    const overdueSnapshot = await db.collection("action_items")
      .where("conversationId", "==", conversationId)
      .where("status", "==", "pending")
      .get();

    const now2 = Date.now();
    const overdueItems = overdueSnapshot.docs
      .map((doc) => doc.data())
      .filter((item) => {
        if (item.deadline) {
          const deadlineTime = new Date(item.deadline).getTime();
          return deadlineTime < now2;
        }
        return false;
      });

    if (overdueItems.length > 0) {
      logger.info(
        "Proactive trigger detected: Overdue actions in " +
        `conversation ${conversationId}`
      );

      await db.collection("proactive_suggestions").add({
        conversationId,
        userId: convo.participants[0],
        message: `You have ${overdueItems.length} overdue action ` +
          `item${overdueItems.length > 1 ? "s" : ""}:\n` +
          overdueItems.slice(0, 3).map((item) => `• ${item.task}`).join("\n"),
        type: "overdue_action",
        priority: "high",
        confidence: 1.0,
        actions: [{
          label: "View Action Items",
          action: "view_action_items",
        }],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
        triggerMessageId: messageId,
      });

      logger.info(
        `Created overdue reminder for conversation ${conversationId}`
      );
    }
  } catch (error) {
    logger.error("Error in proactive trigger detection:", error);
    // Don't throw - we don't want to fail message creation
  }
});

