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

interface ExistingActionItem {
  id: string;
  task: string;
  assignee: string | null;
  messageId: string;
  conversationId: string;
  status: string;
  [key: string]: unknown;
}

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

    // First, check if the conversation exists and is not deleted/hidden
    const conversationDoc = await db
      .collection("conversations")
      .doc(conversationId)
      .get();

    if (!conversationDoc.exists) {
      console.log(`Conversation ${conversationId} does not exist`);
      return {actionItems: [], count: 0};
    }

    const conversationData = conversationDoc.data();

    // Check if conversation is deleted or hidden for the user
    if (conversationData?.deleted ||
        conversationData?.hiddenBy?.includes(userId) ||
        conversationData?.deletedBy?.includes(userId)) {
      console.log(
        `Skipping hidden/deleted conv: ${conversationId}`
      );
      return {actionItems: [], count: 0};
    }

    // Check if user is a participant
    if (!conversationData?.participants?.includes(userId)) {
      console.log(`User ${userId} is not a participant in conversation`);
      return {actionItems: [], count: 0};
    }

    // Query messages from conversation subcollection
    // Exclude deleted messages
    let query = db
      .collection(`conversations/${conversationId}/messages`)
      .where("deleted", "!=", true)
      .orderBy("deleted")
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
    const messages: MessageData[] = snapshot.docs
      .filter((doc) => {
        const data = doc.data();
        // Additional check to exclude messages that are hidden for this user
        return !data.hiddenBy?.includes(userId) &&
               !data.deletedBy?.includes(userId) &&
               data.text; // Ensure message has content
      })
      .map((doc) => {
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
- assignee: Person assigned - IMPORTANT: Use the EXACT sender name from
  the messages when someone volunteers (e.g., if sender "John Smith" says
  "I'll do it", assignee should be "John Smith", not "I" or "me")
- deadline: Any mentioned deadline (or null)
- context: Brief context from conversation
- messageId: The message ID this came from (use the [index] from the
  messages above)
- confidence: 0-1 score of how confident this is a real action item

Assignee extraction rules:
- If someone says "I'll do X", use their sender name as assignee
- If someone says "@PersonName please do Y", use "PersonName" as assignee
- If unassigned, set assignee to null
- Never use pronouns like "I", "me", "myself" as assignee

Don't extract:
- Completed past actions ("I finished X")
- Hypothetical discussions ("what if we...")
- Rhetorical questions`,
    });

    // Get conversation participants to map names to user IDs
    // (We already fetched conversationDoc earlier)
    const participantDetails =
      conversationDoc.data()?.participantDetails || {};

    // Create a map of display names to user IDs (case-insensitive)
    const nameToUserId: Record<string, string> = {};
    Object.entries(participantDetails).forEach(
      ([userId, details]: [string, unknown]) => {
        const detailsObj = details as {displayName?: string};
        if (detailsObj.displayName) {
          nameToUserId[detailsObj.displayName.toLowerCase()] = userId;
        }
      }
    );

    // Check for existing action items to avoid duplicates
    // Only check PENDING items - completed/deleted items can be re-extracted
    const existingItemsQuery = await db
      .collection("action_items")
      .where("conversationId", "==", conversationId)
      .where("status", "==", "pending")
      .get();

    const existingItems: ExistingActionItem[] = existingItemsQuery.docs.map(
      (doc) => ({
        id: doc.id,
        ...doc.data(),
      } as ExistingActionItem)
    );

    console.log(`Found ${existingItems.length} existing pending action items`);

    // Also check for completed/deleted items that could be resurrected
    const completedOrDeletedQuery = await db
      .collection("action_items")
      .where("conversationId", "==", conversationId)
      .where("status", "in", ["completed", "deleted"])
      .get();

    const completedOrDeletedItems: ExistingActionItem[] =
      completedOrDeletedQuery.docs.map(
        (doc) => ({
          id: doc.id,
          ...doc.data(),
        } as ExistingActionItem)
      );

    console.log(
      `Found ${completedOrDeletedItems.length} completed/deleted items ` +
      "that could be resurrected"
    );

    // Store action items in Firestore
    const batch = db.batch();
    let duplicatesSkipped = 0;
    let newItems = 0;
    let resurrectedItems = 0;

    for (const item of result.object.actionItems) {
      // Convert AI-returned index to actual message ID
      let actualMessageId: string;
      try {
        const messageIndex = parseInt(item.messageId);
        if (isNaN(messageIndex) || messageIndex < 0 ||
            messageIndex >= messages.length) {
          console.warn(
            `Invalid message index: ${item.messageId}, using first message`
          );
          actualMessageId = messages[0]?.id || item.messageId;
        } else {
          actualMessageId = messages[messageIndex].id;
        }
      } catch (e) {
        console.warn(`Failed to parse messageId: ${item.messageId}`, e);
        actualMessageId = messages[0]?.id || item.messageId;
      }

      // Try to map assignee name to user ID
      let assigneeId = null;
      let finalAssignee = item.assignee;

      if (item.assignee) {
        // Check exact match first
        assigneeId = nameToUserId[item.assignee.toLowerCase()] || null;

        // If no exact match, try partial matches or pronoun resolution
        if (!assigneeId) {
          // Check for pronouns or self-references
          const selfReferences = ["i", "me", "myself", "i'll", "i will"];
          if (selfReferences.includes(item.assignee.toLowerCase())) {
            // Find the sender of the original message
            const originalMessage = messages.find(
              (m) => m.id === actualMessageId
            );
            if (originalMessage) {
              // Try to map the sender to a user ID
              assigneeId =
                nameToUserId[originalMessage.sender.toLowerCase()] || null;
              finalAssignee = originalMessage.sender;
            }
          }

          // If still no match, try fuzzy matching on first names
          if (!assigneeId) {
            const assigneeLower = item.assignee.toLowerCase();
            for (const [name, id] of Object.entries(nameToUserId)) {
              if (name.includes(assigneeLower) ||
                  assigneeLower.includes(name)) {
                assigneeId = id;
                break;
              }
            }
          }
        }
      }

      console.log(
        `Action item: "${item.task.slice(0, 50)}..." | ` +
        `Assignee: "${item.assignee}" → ` +
        `"${finalAssignee}" (${assigneeId || "NULL"}) | ` +
        `MessageId: [${item.messageId}] → ${actualMessageId.slice(0, 8)}...`
      );

      // Check for duplicates in PENDING items only
      const isPendingDuplicate = existingItems.some((existing) => {
        const sameTask = existing.task === item.task;
        const sameMessage = existing.messageId === actualMessageId;
        const sameAssignee = existing.assigneeId === assigneeId;
        return sameTask && sameMessage && sameAssignee;
      });

      if (isPendingDuplicate) {
        console.log(
          `✓ Skipping duplicate: "${item.task.slice(0, 40)}..." ` +
          `(assigneeId: ${assigneeId || "NULL"}, ` +
          `msgId: ${actualMessageId.slice(0, 8)}...)`
        );
        duplicatesSkipped++;
        continue;
      }

      // Check if this matches a completed/deleted item that can be
      // resurrected
      const completedOrDeletedMatch = completedOrDeletedItems.find(
        (existing) => {
          const sameTask = existing.task === item.task;
          const sameMessage = existing.messageId === actualMessageId;
          const sameAssignee = existing.assigneeId === assigneeId;
          return sameTask && sameMessage && sameAssignee;
        });

      if (completedOrDeletedMatch) {
        // Resurrect the item by updating it back to pending
        console.log(
          `♻️ Resurrecting ${completedOrDeletedMatch.status} item: ` +
          `"${item.task.slice(0, 40)}..."`
        );

        const itemRef = db.collection("action_items")
          .doc(completedOrDeletedMatch.id);
        batch.update(itemRef, {
          status: "pending",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.delete(),
          deletedAt: admin.firestore.FieldValue.delete(),
          // Update other fields in case they changed
          task: item.task,
          assignee: finalAssignee,
          assigneeId,
          deadline: item.deadline,
          context: item.context,
          confidence: item.confidence,
          extractedBy: userId,
        });
        resurrectedItems++;
        continue;
      }

      // Create new item
      const ref = db.collection("action_items").doc();

      batch.set(ref, {
        task: item.task,
        assignee: finalAssignee, // Use the resolved assignee name
        assigneeId, // Add the user ID for querying
        deadline: item.deadline,
        context: item.context,
        messageId: actualMessageId, // Use actual Firestore document ID
        confidence: item.confidence,
        conversationId,
        extractedBy: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
      });
      newItems++;
    }

    // Only commit if there are items to create or update
    if (newItems > 0 || resurrectedItems > 0) {
      await batch.commit();
      console.log(
        `✓ Committed ${newItems} new action items ` +
        `and resurrected ${resurrectedItems} items to Firestore`
      );
    }

    console.log(
      `📊 Extraction complete for conversation ${conversationId}: ` +
      `${newItems} created, ${resurrectedItems} resurrected, ` +
      `${duplicatesSkipped} duplicates skipped, ` +
      `${result.object.actionItems.length} total found by AI`
    );

    // Return successful response with the new items
    return {
      actionItems: result.object.actionItems
        .slice(0, newItems + resurrectedItems),
      count: newItems + resurrectedItems,
      duplicatesSkipped,
    };
  } catch (error: unknown) {
    // Log detailed error for debugging
    const err = error as {
      message?: string;
      code?: string;
      stack?: string;
    };
    console.error("❌ Action extraction error:", {
      conversationId,
      error: err.message || error,
      code: err.code,
      stack: err.stack?.split("\n").slice(0, 3),
    });

    // Check for specific error types
    if (err.code === "permission-denied") {
      throw new HttpsError(
        "permission-denied",
        "You don't have permission to extract action items" +
        " from this conversation"
      );
    }

    if (err.message?.includes("quota") ||
        err.message?.includes("insufficient_quota")) {
      throw new HttpsError(
        "resource-exhausted",
        "AI service quota exceeded. Please try again later."
      );
    }

    if (err.code === "deadline-exceeded" ||
        err.message?.includes("timeout")) {
      throw new HttpsError(
        "deadline-exceeded",
        "Request timed out. This conversation may be too large. " +
        "Try with a shorter date range."
      );
    }

    // Generic error - still throw but with better message
    throw new HttpsError(
      "internal",
      `Failed to extract action items: ${err.message || "Unknown error"}`
    );
  }
});
