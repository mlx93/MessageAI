import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";

/**
 * Proactive Trigger Detection
 *
 * Automatically detects triggers in new messages and calls the proactive agent
 * when certain conditions are met (e.g., meeting scheduling discussions).
 *
 * Rate Limiting: Max 4 suggestions per conversation per 24 hours
 */
export const checkProactiveTriggers = onDocumentCreated({
  document: "conversations/{conversationId}/messages/{messageId}",
  memory: "512MiB",
  timeoutSeconds: 30,
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

    if (recentSuggestions.size >= 4) {
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

    // TRIGGER 1: Meeting Scheduling (3+ participants discussing meeting)
    const schedulingKeywords = [
      "meeting",
      "schedule",
      "meet",
      "call",
      "sync",
      "when can",
      "available",
      "calendar",
    ];

    const hasSchedulingDiscussion = recentMessages.some((m) =>
      schedulingKeywords.some((kw) => m.text.toLowerCase().includes(kw))
    );

    if (hasSchedulingDiscussion && convo.participants.length >= 3) {
      logger.info(
        "Proactive trigger detected: Meeting scheduling in " +
        `conversation ${conversationId}`
      );

      // Generate time suggestions (tomorrow, 3 days, 4 days out)
      const now = new Date();
      const suggestions = [
        new Date(now.getTime() + 24*60*60*1000).toLocaleString(
          "en-US", {weekday: "short", hour: "numeric", minute: "2-digit"}
        ),
        new Date(now.getTime() + 3*24*60*60*1000).toLocaleString(
          "en-US", {weekday: "short", hour: "numeric", minute: "2-digit"}
        ),
        new Date(now.getTime() + 4*24*60*60*1000).toLocaleString(
          "en-US", {weekday: "short", hour: "numeric", minute: "2-digit"}
        ),
      ];

      const suggestionMessage =
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

    // TRIGGER 2: Question Detection (someone needs context)
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

