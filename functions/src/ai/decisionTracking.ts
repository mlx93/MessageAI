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

    console.log(`extractDecisions: conv=${conversationId}, user=${userId}`);

    // Check if user is participant in the conversation
    const convDoc = await db.collection("conversations")
      .doc(conversationId).get();
    if (!convDoc.exists) {
      console.log(`Conversation ${conversationId} not found`);
      throw new HttpsError("not-found", "Conversation not found");
    }

    const convData = convDoc.data();
    console.log(
      `Conversation has ${convData?.participants?.length || 0} participants`
    );
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
    const participantDetails = convData.participantDetails || {};
    const participants = (convData.participants || [])
      .filter((uid: unknown) => uid && typeof uid === "string");

    // Build a map of UID to display name (first name only)
    const uidToName: Record<string, string> = {};
    for (const uid of participants) {
      // Try to get the name from profiles first
      if (participantDetails[uid]) {
        const profile = participantDetails[uid];
        let name = profile.displayName || profile.phoneNumber || "";

        // Extract first name only if it's a full name
        if (name && typeof name === "string" && name.includes(" ")) {
          name = name.split(" ")[0];
        }

        // Validate the name
        if (name && name !== "undefined" && name !== "null") {
          uidToName[uid] = name;
        } else {
          console.log(`No valid name for ${uid}, using fallback`);
          uidToName[uid] = `User_${(uid || "unknown").slice(0, 4)}`;
        }
      } else {
        console.log(`No profile for ${uid}, using fallback`);
        uidToName[uid] = `User_${(uid || "unknown").slice(0, 4)}`;
      }
    }

    console.log("Participant mapping:", JSON.stringify(uidToName));

    if (Object.keys(uidToName).length === 0) {
      console.log("WARNING: No participant names mapped!");
    }

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
        // Exclude deleted or hidden messages, and validate required fields
        return !data.deleted &&
               !data.hiddenBy?.includes(userId) &&
               !data.deletedBy?.includes(userId) &&
               data.text &&
               typeof data.text === "string" &&
               data.text.trim().length > 0 &&
               data.senderId &&
               typeof data.senderId === "string"; // Ensure senderId exists
      })
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text as string,
          sender: data.senderId as string,
          timestamp: data.timestamp as number,
          conversationId: data.conversationId as string,
        };
      });

    if (messages.length === 0) {
      console.log(`No messages in conversation ${conversationId}`);
      return {decisions: [], count: 0, message: "No messages in date range"};
    }

    console.log(`Processing ${messages.length} messages for extraction`);

    // Map messages to include sender names
    const messagesWithNames = messages.map((m) => {
      let senderName = uidToName[m.sender];
      if (!senderName) {
        // Try to add this sender to the map if not already there
        if (participantDetails[m.sender]) {
          const profile = participantDetails[m.sender];
          let name = profile.displayName || profile.phoneNumber || "";
          if (name && typeof name === "string" && name.includes(" ")) {
            name = name.split(" ")[0];
          }
          if (name && name !== "undefined" && name !== "null") {
            senderName = name;
            uidToName[m.sender] = name;
          }
        }
      }

      return {
        ...m,
        senderName: senderName || `User_${(m.sender || "unknown").slice(0, 4)}`,
      };
    });

    let result;
    try {
      // Limit messages to prevent token limit issues
      const limitedMessages = messagesWithNames.slice(0, 50);

      result = await generateObject({
        model: openai("gpt-4o"),
        schema: DecisionSchema,
        prompt: `Extract decisions made in this team conversation.

ONLY extract decisions that meet ALL these criteria:
1. **Decision Indicators**: Look for explicit decision language:
   - "Let's go with X", "We decided to...", "The decision is..."
   - "After discussion, we'll...", "We've chosen to..."
   - "Agreed, we'll do X", "Final decision: X"
   - Poll results, "Everyone agree?", "All in favor?"
   
2. **Context Required**: Decision must have supporting context
   - At least 3+ messages discussing the topic
   - Clear rationale or discussion visible
   - Not just a single message announcement
   
3. **Substance Required**: Decision must be meaningful
   - NOT greetings ("Hi", "Hello", "Hey there")
   - NOT small talk ("How's it going?", "What's up?")
   - NOT off-topic chat (weather, sports, casual banter)
   - NOT questions without answers
   - NOT jokes, sarcasm, or informal banter
   
4. **Team Consensus**: Look for agreement signals
   - Multiple participants agreeing
   - Clear resolution after discussion
   - Consensus statements

EXCLUDE these patterns:
- Greetings and salutations
- Social pleasantries
- Single-message announcements without discussion
- Proposals that weren't accepted
- Questions or suggestions (unless answered with agreement)
- Off-topic or casual conversation
- Unclear or ambiguous statements

Conversation Participants:
${Object.entries(uidToName)
    .map(([uid, name]) => `- ${name} (ID: ${uid})`).join("\n")}

Messages (with names):
${limitedMessages.map((m, i) =>
    `[${i}] ${m.senderName}: ${(m.text || "").slice(0, 200)}`
  ).join("\n\n")}

For each decision found:
- decision: The actual decision made (clear and specific)
- rationale: Why this decision was made (from the discussion)
- alternativesConsidered: Other options discussed (if any)
- participants: Array of participant NAMES (use actual names)
- participantIds: Array of participant UIDs matching the names
- decisionMaker: NAME of the person who made/announced the decision
- decisionMakerId: UID of the person who made/announced the decision
- messageIds: Relevant message IDs (use the [numbers] from messages)
- confidence: 0-1 score (be honest - use low scores for unclear decisions)
  * 0.9-1.0: Clear, explicit decision with team consensus
  * 0.7-0.9: Decision stated but limited discussion
  * 0.5-0.7: Implicit decision, needs inference
  * <0.5: Unclear or questionable (DO NOT INCLUDE THESE)

IMPORTANT: 
- Use the actual names from the conversation, NOT generic names
- If confidence is below 0.5, do NOT include the decision
- Quality over quantity - better to return nothing than false positives
- Distinguish actual decisions from proposals, opinions, or casual chat`,
      });
    } catch (aiError: unknown) {
      const error = aiError as Error & {cause?: unknown};
      console.error("AI generation failed:", error);
      console.error("AI error details:", {
        message: error?.message,
        cause: error?.cause,
      });
      // Return empty result if AI fails
      return {
        decisions: [],
        count: 0,
        message: "Failed to extract decisions from conversation",
      };
    }

    // Check if result is valid
    if (!result || !result.object || !result.object.decisions) {
      console.error("Invalid result from AI:", result);
      return {
        decisions: [],
        count: 0,
        message: "No decisions found in conversation",
      };
    }

    // Filter out low-confidence decisions (below 0.5)
    const highConfidenceDecisions = result.object.decisions.filter((item) => {
      if (item.confidence < 0.5) {
        console.log(`Filtering out low-confidence decision: "${item.decision}" (${item.confidence})`);
        return false;
      }
      
      // Additional validation: ensure decision has substance
      if (!item.decision || item.decision.trim().length < 10) {
        console.log("Filtering out decision with insufficient content");
        return false;
      }
      
      // Check for greeting patterns
      const greetingPatterns = /^(hi|hello|hey|good morning|good afternoon|good evening|what's up|how are you|how's it going)/i;
      if (greetingPatterns.test(item.decision.trim())) {
        console.log(`Filtering out greeting: "${item.decision}"`);
        return false;
      }
      
      return true;
    });

    console.log(`AI extracted ${result.object.decisions.length} decisions, ${highConfidenceDecisions.length} passed quality filters`);

    if (highConfidenceDecisions.length === 0) {
      return {
        decisions: [],
        count: 0,
        message: "No high-quality decisions found in conversation",
      };
    }

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
    const newDecisions = highConfidenceDecisions.filter((item) =>
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

    // We need to get message timestamps for accurate decision dates
    // Build a map of message IDs to their timestamps
    const messageIdToTimestamp: Record<string, number> = {};
    messages.forEach((msg) => {
      messageIdToTimestamp[msg.id] = msg.timestamp;
    });

    newDecisions.forEach((item) => {
      const ref = db.collection("decisions").doc();

      // Ensure we have valid participant names
      const validatedParticipants = item.participants.map((p: string) => {
        // If it's a UID that we have a name for, use the name
        if (uidToName[p]) {
          return uidToName[p];
        }
        // If it already looks like a name, keep it
        if (p && p.length < 30 && !p.includes("Participant")) {
          return p;
        }
        // Fallback to a generic name if needed
        return "Unknown";
      }).filter((name: string) => name !== "Unknown" && name !== "undefined");

      // Validate decision maker name
      let validatedDecisionMaker = item.decisionMaker;
      if (item.decisionMakerId && uidToName[item.decisionMakerId]) {
        validatedDecisionMaker = uidToName[item.decisionMakerId];
      } else if (!validatedDecisionMaker ||
                 validatedDecisionMaker === "undefined" ||
                 validatedDecisionMaker === "Unnamed Participant") {
        // Try to get from first participant
        validatedDecisionMaker = validatedParticipants[0] || "Unknown";
      }

      // Get the timestamp from the last relevant message
      // messageIds come from the AI as array indices [0, 1, 2, ...]
      let decisionTimestamp = Date.now();
      if (item.messageIds && item.messageIds.length > 0) {
        // messageIds are indices into the messagesWithNames array
        // Find the latest timestamp from the relevant messages
        const messageTimestamps = item.messageIds
          .map((idx) => {
            // idx could be a string like "0" or "1"
            const index = parseInt(String(idx), 10);
            if (!isNaN(index) && index < messagesWithNames.length) {
              const ts = messagesWithNames[index].timestamp;
              // Check if timestamp is a Firestore Timestamp object
              if (ts && typeof ts === "object" && "toMillis" in ts) {
                return (ts as any).toMillis();
              }
              // Check if timestamp is in seconds instead of milliseconds
              if (typeof ts === "number" && ts < 946684800000) {
                return ts * 1000; // Convert seconds to milliseconds
              }
              return ts as number;
            }
            return null;
          })
          .filter((ts): ts is number => ts !== null && ts > 0);

        if (messageTimestamps.length > 0) {
          decisionTimestamp = Math.max(...messageTimestamps);
        }
      }

      batch.set(ref, {
        ...item,
        participants: validatedParticipants,
        decisionMaker: validatedDecisionMaker,
        conversationId,
        extractedBy: userId,
        madeAt: decisionTimestamp,
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
  } catch (error: unknown) {
    const err = error as Error & {code?: string; stack?: string};
    console.error("Decision extraction error:", err);
    console.error("Error details:", {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });
    const errorMsg = err?.message || "Failed to extract decisions";
    throw new HttpsError("internal", errorMsg);
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
