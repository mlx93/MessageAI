import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {openaiKey} from "../utils/openai";
import {pineconeKey} from "../utils/pinecone";

interface ProactiveAgentRequest {
  conversationId: string;
  recentMessages: Array<{sender: string; text: string}>;
  trigger: string;
}

export const proactiveAgent = onCall({
  secrets: [openaiKey, pineconeKey],
  memory: "2GiB",
  timeoutSeconds: 60,
}, async (request) => {
  const {conversationId, recentMessages, trigger} =
    request.data as ProactiveAgentRequest;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!conversationId) {
    throw new HttpsError("invalid-argument",
      "Conversation ID is required");
  }

  try {
    // Simplified proactive agent - make decision and create suggestion
    const db = admin.firestore();

    console.log(`Proactive agent triggered: ${trigger}`);

    // Check for meeting scheduling trigger
    const meetingKeywords = ["meet", "schedule", "call", "sync", "when can"];
    const hasMeetingDiscussion = recentMessages.some((m) =>
      meetingKeywords.some((kw) => m.text.toLowerCase().includes(kw))
    );

    // Check participant count from conversationId
    const convoDoc = await db.collection("conversations")
      .doc(conversationId).get();
    const convoData = convoDoc.data();
    const participantCount = convoData?.participants?.length || 0;

    // Trigger: 3+ people discussing meeting
    if (hasMeetingDiscussion && participantCount >= 3) {
      // Generate meeting time suggestions
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

      // Create proactive suggestion
      await db.collection("proactive_suggestions").add({
        conversationId,
        userId,
        message: `I noticed ${participantCount} people are trying \
to schedule a meeting. Here are some time suggestions:
${suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
        type: "meeting",
        actions: suggestions.map((s) => ({
          label: s,
          action: `schedule_meeting_${s}`,
        })),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
      });

      return {
        agentResponse: "Meeting scheduling suggestion created",
        toolsUsed: ["meetingDetection", "timeSuggestion"],
        triggered: true,
        processingTime: Date.now(),
      };
    }

    // Check for overdue action items
    const overdueSnapshot = await db.collection("action_items")
      .where("conversationId", "==", conversationId)
      .where("status", "==", "pending")
      .get();

    const now = Date.now();
    const overdueItems = overdueSnapshot.docs
      .map((doc) => doc.data())
      .filter((item) => {
        if (item.deadline) {
          const deadlineTime = new Date(item.deadline).getTime();
          return deadlineTime < now;
        }
        return false;
      });

    if (overdueItems.length > 0) {
      // Create reminder suggestion
      await db.collection("proactive_suggestions").add({
        conversationId,
        userId,
        message: `You have ${overdueItems.length} overdue action \
item${overdueItems.length > 1 ? "s" : ""}:
${overdueItems.slice(0, 3).map((item) =>
    `• ${item.task}`).join("\n")}`,
        type: "reminder",
        actions: [{
          label: "View Action Items",
          action: "view_action_items",
        }],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
      });

      return {
        agentResponse: "Overdue action item reminder created",
        toolsUsed: ["overdueDetection"],
        triggered: true,
        processingTime: Date.now(),
      };
    }

    return {
      agentResponse: "No proactive action needed at this time",
      toolsUsed: [],
      triggered: false,
      processingTime: Date.now(),
    };
  } catch (error) {
    console.error("Proactive agent error:", error);
    throw new HttpsError("internal", "Failed to process proactive agent");
  }
});
