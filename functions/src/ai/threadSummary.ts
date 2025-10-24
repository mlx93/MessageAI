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
    // If no date range provided, default to last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const effectiveDateRange = dateRange || {
      start: sevenDaysAgo.toISOString(),
      end: now.toISOString(),
    };

    // Create cache key based on conversation + date range
    const cacheKey = `summary_${conversationId}_${
      effectiveDateRange.start
    }_${effectiveDateRange.end}`;

    const summary = await cacheSummary(cacheKey, async () => {
      const db = admin.firestore();

      // Query messages by date range
      let query = db.collection("messages")
        .where("conversationId", "==", conversationId)
        .orderBy("timestamp", "asc");

      // Always apply date range (either provided or last 7 days)
      query = query.where("timestamp", ">=",
        new Date(effectiveDateRange.start).getTime());
      query = query.where("timestamp", "<=",
        new Date(effectiveDateRange.end).getTime());

      const snapshot = await query.limit(500).get();
      const messages = snapshot.docs.map((doc) => doc.data())
        .reverse(); // Reverse to get chronological order

      if (messages.length === 0) {
        return {summary: "No messages in this date range."};
      }

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

Messages:
${messages.map((m) => `${m.sender}: ${m.text}`).join("\n\n")}

Keep it concise but capture all important points.`,
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
