import {onCall, HttpsError} from "firebase-functions/v2/https";
import {openai} from "@ai-sdk/openai";
import {generateObject} from "ai";
import {z} from "zod";
import * as admin from "firebase-admin";
import {openaiKey} from "../utils/openai";

const DecisionSchema = z.object({
  decisions: z.array(z.object({
    decision: z.string(),
    rationale: z.string(),
    alternativesConsidered: z.array(z.string()),
    participants: z.array(z.string()),
    messageIds: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  })),
});

interface MessageData {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  conversationId: string;
}

interface ExtractDecisionsRequest {
  conversationId: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export const extractDecisions = onCall({
  secrets: [openaiKey],
  memory: "2GiB",
  timeoutSeconds: 60,
}, async (request) => {
  const {conversationId, dateRange} =
    request.data as ExtractDecisionsRequest;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!conversationId) {
    throw new HttpsError("invalid-argument",
      "Conversation ID is required");
  }

  try {
    const db = admin.firestore();

    // Query messages by date range
    let query = db.collection("messages")
      .where("conversationId", "==", conversationId)
      .orderBy("timestamp", "desc");

    if (dateRange?.start) {
      query = query.where("timestamp", ">=",
        new Date(dateRange.start).getTime());
    }
    if (dateRange?.end) {
      query = query.where("timestamp", "<=",
        new Date(dateRange.end).getTime());
    }

    const snapshot = await query.limit(200).get();
    const messages: MessageData[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        text: data.text as string,
        sender: data.sender as string,
        timestamp: data.timestamp as number,
        conversationId: data.conversationId as string,
      };
    });

    if (messages.length === 0) {
      return {decisions: [], count: 0};
    }

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: DecisionSchema,
      prompt: `Extract decisions made in this team conversation.

Look for patterns:
- "Let's go with X", "We decided to..."
- "The decision is...", "After discussion, we'll..."
- Consensus signals (multiple agreements)
- Poll results, "Everyone agree?"

Messages:
${messages.map((m, i) => `[${i}] ${m.sender}: ${m.text}`).join("\n\n")}

For each decision:
- decision: The actual decision made
- rationale: Why this decision was made
- alternativesConsidered: Other options discussed
- participants: Who was involved
- messageIds: Relevant message IDs
- confidence: 0-1 score

Distinguish:
- Actual decisions vs. proposals
- Team consensus vs. individual opinions
- Serious decisions vs. sarcasm/jokes`,
    });

    // Store decisions in Firestore
    const batch = db.batch();

    result.object.decisions.forEach((item) => {
      const ref = db.collection("decisions").doc();
      batch.set(ref, {
        ...item,
        conversationId,
        extractedBy: userId,
        madeAt: Date.now(),
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    return {
      decisions: result.object.decisions,
      count: result.object.decisions.length,
    };
  } catch (error) {
    console.error("Decision extraction error:", error);
    throw new HttpsError("internal", "Failed to extract decisions");
  }
});
