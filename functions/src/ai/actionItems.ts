import {onCall, HttpsError} from "firebase-functions/v2/https";
import {openai} from "@ai-sdk/openai";
import {generateObject} from "ai";
import {z} from "zod";
import * as admin from "firebase-admin";
import {openaiKey} from "../utils/openai";

const ActionItemSchema = z.object({
  actionItems: z.array(z.object({
    task: z.string(),
    assignee: z.string().nullable(),
    deadline: z.string().nullable(),
    context: z.string(),
    messageId: z.string(),
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

interface ExtractActionsRequest {
  conversationId: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export const extractActions = onCall({
  secrets: [openaiKey],
  memory: "2GiB",
  timeoutSeconds: 60,
}, async (request) => {
  const {conversationId, dateRange} =
    request.data as ExtractActionsRequest;
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

    // Query messages from conversation subcollection
    let query = db
      .collection(`conversations/${conversationId}/messages`)
      .orderBy("timestamp", "desc");

    if (dateRange?.start) {
      const startTimestamp = admin.firestore.Timestamp
        .fromDate(new Date(dateRange.start));
      query = query.where("timestamp", ">=", startTimestamp);
    }
    if (dateRange?.end) {
      const endTimestamp = admin.firestore.Timestamp
        .fromDate(new Date(dateRange.end));
      query = query.where("timestamp", "<=", endTimestamp);
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
      return {actionItems: [], count: 0};
    }

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: ActionItemSchema,
      prompt: `Extract action items from this team conversation.

Look for patterns:
- "I'll handle X", "I can do Y"
- "Can you do Z?", "@person please..."
- "Someone needs to...", "We should..."
- "TODO:", direct questions requiring action

Messages:
${messages.map((m, i) => `[${i}] ${m.sender}: ${m.text}`).join("\n\n")}

For each action item:
- task: Clear description of what needs to be done
- assignee: Person assigned (or null if unassigned)
- deadline: Any mentioned deadline (or null)
- context: Brief context from conversation
- messageId: The message ID this came from
- confidence: 0-1 score of how confident this is a real action item

Don't extract:
- Completed past actions ("I finished X")
- Hypothetical discussions ("what if we...")
- Rhetorical questions`,
    });

    // Store action items in Firestore
    const batch = db.batch();

    result.object.actionItems.forEach((item) => {
      const ref = db.collection("action_items").doc();
      batch.set(ref, {
        ...item,
        conversationId,
        extractedBy: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
      });
    });

    await batch.commit();

    return {
      actionItems: result.object.actionItems,
      count: result.object.actionItems.length,
    };
  } catch (error) {
    console.error("Action extraction error:", error);
    throw new HttpsError("internal", "Failed to extract action items");
  }
});
