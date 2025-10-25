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
    participantIds: z.array(z.string()),
    decisionMaker: z.string(),
    decisionMakerId: z.string(),
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

    // Check if user is participant in the conversation
    const convDoc = await db.collection("conversations")
      .doc(conversationId).get();
    if (!convDoc.exists) {
      throw new HttpsError("not-found", "Conversation not found");
    }

    const convData = convDoc.data();
    if (!convData?.participants?.includes(userId)) {
      throw new HttpsError(
        "permission-denied",
        "You are not a participant in this conversation"
      );
    }

    // Check if conversation is deleted or hidden for the user
    if (convData?.deleted ||
        convData?.hiddenBy?.includes(userId) ||
        convData?.deletedBy?.includes(userId)) {
      console.log(`Skipping hidden/deleted conv: ${conversationId}`);
      return {decisions: [], count: 0};
    }

    // Get participant names from the conversation metadata
    const participantNames = convData.participantNames || {};

    // Query messages from conversation subcollection
    // Default to last 7 days if no date range specified
    let query = db
      .collection(`conversations/${conversationId}/messages`)
      .orderBy("timestamp", "desc");

    const startDate = dateRange?.start ?
      new Date(dateRange.start) :
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const startTimestamp = admin.firestore.Timestamp.fromDate(startDate);
    query = query.where("timestamp", ">=", startTimestamp);

    if (dateRange?.end) {
      const endTimestamp = admin.firestore.Timestamp
        .fromDate(new Date(dateRange.end));
      query = query.where("timestamp", "<=", endTimestamp);
    }

    const snapshot = await query.limit(200).get();
    const messages: MessageData[] = snapshot.docs
      .filter((doc) => {
        const data = doc.data();
        // Exclude deleted or hidden messages
        return !data.deleted &&
               !data.hiddenBy?.includes(userId) &&
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

Participants Map:
${Object.entries(participantNames)
    .map(([uid, name]) => `${uid}: ${name}`).join("\n")}

Messages:
${messages.map((m, i) => `[${i}] ${m.sender}: ${m.text}`).join("\n\n")}

For each decision:
- decision: The actual decision made
- rationale: Why this decision was made
- alternativesConsidered: Other options discussed
- participants: Names of people involved (use the participant map above)
- participantIds: UIDs of people involved
- decisionMaker: Name of the person who made/announced the decision
- decisionMakerId: UID of the person who made/announced the decision
- messageIds: Relevant message IDs
- confidence: 0-1 score

Distinguish:
- Actual decisions vs. proposals
- Team consensus vs. individual opinions
- Serious decisions vs. sarcasm/jokes`,
    });

    // Check for duplicates before storing
    const existingDecisions = await db.collection("decisions")
      .where("conversationId", "==", conversationId)
      .where("status", "==", "active")
      .get();

    const existingDecisionTexts = new Set(
      existingDecisions.docs.map((doc) => {
        const data = doc.data();
        return `${data.decision}_${data.conversationId}`;
      })
    );

    // Filter out duplicates
    const newDecisions = result.object.decisions.filter((item) =>
      !existingDecisionTexts.has(`${item.decision}_${conversationId}`)
    );

    if (newDecisions.length === 0) {
      return {
        decisions: [],
        count: 0,
        message: "No new decisions found",
      };
    }

    // Store new decisions in Firestore
    const batch = db.batch();

    newDecisions.forEach((item) => {
      const ref = db.collection("decisions").doc();
      batch.set(ref, {
        ...item,
        // Ensure participant names are used
        participants: item.participants.map((p: string) => {
          // If it looks like a UID, try to map it to a name
          if (p.length === 28 && participantNames[p]) {
            return participantNames[p];
          }
          return p;
        }),
        conversationId,
        extractedBy: userId,
        madeAt: Date.now(),
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    return {
      decisions: newDecisions,
      count: newDecisions.length,
      message: `Extracted ${newDecisions.length} new decision${
        newDecisions.length !== 1 ? "s" : ""
      }`,
    };
  } catch (error) {
    console.error("Decision extraction error:", error);
    throw new HttpsError("internal", "Failed to extract decisions");
  }
});

export const deleteDecision = onCall({
  memory: "1GiB",
  timeoutSeconds: 30,
}, async (request) => {
  const {decisionId} = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!decisionId) {
    throw new HttpsError("invalid-argument", "Decision ID is required");
  }

  try {
    const db = admin.firestore();

    // Get the decision to check permissions
    const decisionDoc = await db.collection("decisions")
      .doc(decisionId).get();
    if (!decisionDoc.exists) {
      throw new HttpsError("not-found", "Decision not found");
    }

    const decisionData = decisionDoc.data();
    const conversationId = decisionData?.conversationId;

    // Check if user is participant in the conversation
    const convDoc = await db.collection("conversations")
      .doc(conversationId).get();
    if (!convDoc.exists) {
      throw new HttpsError("not-found", "Conversation not found");
    }

    const convData = convDoc.data();
    if (!convData?.participants?.includes(userId)) {
      throw new HttpsError(
        "permission-denied",
        "You can only delete decisions from your conversations"
      );
    }

    // Delete the decision
    await db.collection("decisions").doc(decisionId).delete();

    return {success: true, message: "Decision deleted successfully"};
  } catch (error) {
    console.error("Decision deletion error:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to delete decision");
  }
});

export const bulkDeleteDecisions = onCall({
  memory: "1GiB",
  timeoutSeconds: 30,
}, async (request) => {
  const {decisionIds} = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!decisionIds || !Array.isArray(decisionIds) ||
      decisionIds.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "Decision IDs array is required"
    );
  }

  try {
    const db = admin.firestore();
    const batch = db.batch();
    let deletedCount = 0;

    // Process each decision
    for (const decisionId of decisionIds) {
      const decisionDoc = await db.collection("decisions")
        .doc(decisionId).get();
      if (!decisionDoc.exists) continue;

      const decisionData = decisionDoc.data();
      const conversationId = decisionData?.conversationId;

      // Check if user is participant in the conversation
      const convDoc = await db.collection("conversations")
        .doc(conversationId).get();
      if (!convDoc.exists) continue;

      const convData = convDoc.data();
      if (!convData?.participants?.includes(userId)) continue;

      // Add to batch delete
      batch.delete(decisionDoc.ref);
      deletedCount++;
    }

    // Commit batch
    if (deletedCount > 0) {
      await batch.commit();
    }

    return {
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} decision${
        deletedCount !== 1 ? "s" : ""
      }`,
    };
  } catch (error) {
    console.error("Bulk decision deletion error:", error);
    throw new HttpsError("internal", "Failed to delete decisions");
  }
});
