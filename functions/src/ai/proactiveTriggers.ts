import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions/v2";

/**
 * Proactive Trigger Detection
 *
 * Automatically detects triggers in new messages and calls the proactive agent
 * when certain conditions are met (e.g., meeting scheduling discussions).
 */
export const checkProactiveTriggers = onDocumentCreated(
  "messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    if (!message || !message.text) {
      logger.debug("Skipping trigger check - no message text");
      return;
    }

    const db = admin.firestore();

    try {
      // Get recent messages in conversation
      const snapshot = await db
        .collection(`conversations/${message.conversationId}/messages`)
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

      const recentMessages = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          sender: data.sender as string,
          text: data.text as string,
        };
      });

      // Simple rule-based trigger detection
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

      if (hasSchedulingDiscussion) {
        // Get conversation to check participant count
        const convoDoc = await db
          .collection("conversations")
          .doc(message.conversationId)
          .get();
        const convo = convoDoc.data();

        // Only trigger for group conversations (3+ participants)
        if (convo && convo.participants.length >= 3) {
          logger.info(
            "Proactive trigger detected: Meeting scheduling in " +
            `conversation ${message.conversationId}`
          );

          // Create a proactive suggestion directly
          // (Simplified approach - no need to call the full agent)
          const suggestionMessage =
            "It looks like you're trying to schedule a meeting. " +
            "Would you like me to suggest some times based on " +
            "everyone's availability?";

          await db.collection("proactive_suggestions").add({
            conversationId: message.conversationId,
            userId: convo.participants[0], // First participant
            message: suggestionMessage,
            type: "meeting",
            actions: [
              {label: "Suggest Times", action: "suggest_meeting"},
              {label: "Dismiss", action: "dismiss_suggestion"},
            ],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "pending",
            triggerMessageId: event.params.messageId,
          });

          logger.info(
            "Created proactive suggestion for conversation " +
            `${message.conversationId}`
          );
        }
      }

      // Additional trigger types can be added here:
      // - Deadline mentions without explicit action items
      // - Decision discussions that need formalization
      // - Long threads that could benefit from summarization
      // - Conflict detection in decision-making
    } catch (error) {
      logger.error("Error in proactive trigger detection:", error);
      // Don't throw - we don't want to fail message creation
    }
  }
);

