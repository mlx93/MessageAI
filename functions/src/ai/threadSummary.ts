import {onCall, HttpsError} from "firebase-functions/v2/https";
import {openai} from "@ai-sdk/openai";
import {generateText} from "ai";
import * as admin from "firebase-admin";
import {cacheSummary} from "../utils/enhancedCache";
import {openaiKey} from "../utils/openai";

interface SummarizeThreadRequest {
  conversationId: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

interface SummarizeThreadResponse {
  summary: string;
  messageCount: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  generatedAt: number;
}

export const summarizeThread = onCall({
  secrets: [openaiKey],
  memory: "2GiB",
  timeoutSeconds: 60,
}, async (request) => {
  const {conversationId, dateRange} = request.data as SummarizeThreadRequest;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!conversationId) {
    throw new HttpsError("invalid-argument", "Conversation ID is required");
  }

  try {
    // If no date range provided, default to last 90 days
    // to capture more history
    const now = new Date();
    const ninetyDaysAgo = new Date(
      now.getTime() - 90 * 24 * 60 * 60 * 1000
    );

    const effectiveDateRange = dateRange || {
      start: ninetyDaysAgo.toISOString(),
      end: now.toISOString(),
    };

    // If no date range provided, use a stable cache key
    // Otherwise cache changes every second as "now" changes
    const cacheKey = dateRange ?
      `summary_${conversationId}_${dateRange.start}_${dateRange.end}` :
      `summary_${conversationId}_all_time`;

    const summary = await cacheSummary(cacheKey, async () => {
      const db = admin.firestore();

      // Query messages from conversations/{convId}/messages/{msgId}
      // Messages are in subcollections, not a root collection
      let query = db
        .collection(`conversations/${conversationId}/messages`)
        .orderBy("timestamp", "asc");

      // Always apply date range (either provided or last 90 days)
      // Convert to Firestore Timestamp for proper comparison
      const startTimestamp = admin.firestore.Timestamp
        .fromDate(new Date(effectiveDateRange.start));
      const endTimestamp = admin.firestore.Timestamp
        .fromDate(new Date(effectiveDateRange.end));

      query = query.where("timestamp", ">=", startTimestamp);
      query = query.where("timestamp", "<=", endTimestamp);

      const snapshot = await query.limit(500).get();
      const messages = snapshot.docs.map((doc) => doc.data())
        .reverse(); // Reverse to get chronological order

      if (messages.length === 0) {
        return {
          summary: "No messages in this date range.",
          messageCount: 0,
          dateRange: {
            start: effectiveDateRange.start,
            end: effectiveDateRange.end,
          },
          generatedAt: Date.now(),
        };
      }

      // Get conversation to look up participant names
      const conversationDoc = await db
        .doc(`conversations/${conversationId}`)
        .get();
      const conversationData = conversationDoc.data();
      const participantDetails = conversationData?.participantDetails || {};

      // Map messages with actual names
      const messagesWithNames = messages.map((m) => {
        const senderName = participantDetails[m.senderId]?.displayName ||
          "Unknown";
        return {
          sender: senderName,
          text: m.text,
        };
      });

      // Choose model based on message count
      const model = messages.length < 50 ? "gpt-4o-mini" : "gpt-4o";

      const result = await generateText({
        model: openai(model),
        prompt: `Summarize this team conversation (${messages.length} messages).

Format your response as:
📝 Thread Summary (${messages.length} messages)

Key Topics:
• [List main discussion topics]

Decisions Made:
• [List any decisions or agreements]

Still Open:
• [List unresolved questions or pending items]

Messages to analyze:
${messagesWithNames.map((m) => `${m.sender}: ${m.text}`).join("\n")}

Keep it concise and do NOT include the individual messages in your response.
Only provide the summary structure above.`,
      });

      return {
        summary: result.text,
        messageCount: messages.length,
        dateRange: {
          start: effectiveDateRange.start,
          end: effectiveDateRange.end,
        },
        generatedAt: Date.now(),
      };
    });

    return summary as SummarizeThreadResponse;
  } catch (error) {
    console.error("Thread summarization error:", error);
    throw new HttpsError("internal", "Failed to summarize thread");
  }
});
