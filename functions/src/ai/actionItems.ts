import {onCall, HttpsError} from "firebase-functions/v2/https";
import {openai} from "@ai-sdk/openai";
import {generateObject} from "ai";
import {z} from "zod";
import * as admin from "firebase-admin";
import {
  openaiKey,
  generateEmbedding,
  cosineSimilarity,
} from "../utils/openai";

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
    // Messages use deletedBy array, not a deleted boolean field
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
      console.log(`⚠️ No messages found for conversation ${conversationId}`);
      return {actionItems: [], count: 0};
    }

    console.log(
      `📧 Retrieved ${messages.length} messages from ` +
      `conversation ${conversationId}`
    );
    console.log(`📧 Sample message: ${messages[0]?.text?.slice(0, 100)}`);

    // Get conversation participants to map sender IDs to display names
    const participantDetails =
      conversationDoc.data()?.participantDetails || {};

    // Create a map of sender IDs to display names for message formatting
    const senderIdToName: Record<string, string> = {};
    Object.entries(participantDetails).forEach(
      ([userId, details]: [string, unknown]) => {
        const detailsObj = details as {displayName?: string};
        if (detailsObj.displayName) {
          senderIdToName[userId] = detailsObj.displayName;
        }
      }
    );

    // Format messages for AI prompt with display names
    const messagesForPrompt = messages.map((m, i) => {
      // Map sender ID to display name for clarity
      const senderName = senderIdToName[m.sender as string] ||
                         (typeof m.sender === "string" ?
                           m.sender.slice(0, 10) : "Unknown");
      return `[${i}] ${senderName}: ${m.text}`;
    }).join("\n\n");

    const result = await generateObject({
      model: openai("gpt-4o"),
      schema: ActionItemSchema,
      prompt: "Extract ONLY clear, unambiguous action items from this " +
        `team conversation.

An action item must have:
1. Someone explicitly commits to doing something specific
2. A clear deliverable or outcome
3. An actionable task (not just discussion/decision)

DO extract (examples):
- "I'll have the benchmarks ready by Friday" ✅ (clear commitment)
- "Can you update the Postgres docs?" ✅ (specific request)
- "@Dan please restart the Redis service" ✅ (direct assignment)
- "I'll send you the report tomorrow" ✅ (explicit action)
- "I can handle the MongoDB setup" ✅ (first-person commitment)
- "Let me take care of the deployment" ✅ (first-person ownership)

DON'T extract (examples):
- "We should probably meet sometime" ❌ (too vague, no commitment)
- "Let me know if you're available" ❌ (not an action, just inquiry)
- "What do you think about the new design?" ❌ (question, not task)
- "I finished the setup yesterday" ❌ (completed past action)
- "Maybe we could try that approach" ❌ (hypothetical discussion)
- "Great work!", "Thanks!", "Awesome!" ❌ (casual conversation, no task)
- "You did an awesome job!" ❌ (praise, not a task assignment)

Messages:
${messagesForPrompt}

For each action item:
- task: Clear description of what needs to be done. The task MUST use words 
  that actually appear in the messages - do NOT infer or hallucinate tasks.
- assignee: Person assigned - CRITICAL RULES BELOW
- deadline: Any mentioned deadline (or null)
- context: Brief context from conversation (focus on WHAT, not WHO)
- messageId: The message ID this came from (use the [index] from the
  messages above)
- confidence: 0-1 score of how confident this is a real action item

CRITICAL TASK EXTRACTION RULES (Anti-Hallucination):
- The task description MUST contain words/phrases from the actual messages
- If you cannot find a specific action using words from the messages,
  DO NOT extract it
- When in doubt, return an empty array rather than guessing or inferring
- Casual conversations with no specific tasks should return NO items
- Examples:
  * Message: "You did an awesome job!" → NO TASK (praise, not action)
  * Message: "Thanks for the great work today!" → NO TASK
    (gratitude, not assignment)
  * Message: "See you tomorrow!" → NO TASK (casual conversation)

Confidence scoring rules:
- Set confidence to 0.95+ ONLY if both assignment AND task are crystal clear
- Set confidence to 0.85-0.94 if task is clear but assignee is ` +
        `ambiguous
- Set confidence to 0.80-0.84 only if task is somewhat clear but ` +
        `context is needed
- Don't extract anything with <0.85 confidence (we only want high-quality items)

ASSIGNEE EXTRACTION RULES (CRITICAL - READ CAREFULLY):

1. FIRST-PERSON COMMITMENTS - Extract the speaker's EXACT NAME:
   * When message is "[5] John Smith: I can handle the MongoDB setup"
     → assignee = "John Smith" (NOT "I" or "me")
   * When message is "[2] Sarah Lee: I'll take care of the deployment"
     → assignee = "Sarah Lee"
   * When message is "[8] Dan G: Let me do the testing"
     → assignee = "Dan G"
   * Pattern: ANY form of "I/I'll/I can/I will/Let me [do task]"
     → Extract the sender name from [index] Name: format

2. DIRECT NAME ASSIGNMENTS - Extract the person mentioned:
   * When message is "[3] Hadi R: Dan, you take the frontend work"
     → assignee = "Dan" (extract the name BEFORE the comma and "you")
   * When message is "[7] Mike: Sarah, can you handle the API?"
     → assignee = "Sarah"
   * When message is "[1] John: @Alice please review the PR"
     → assignee = "Alice"
   * Pattern: "PersonName, you [do task]" OR "@PersonName [do task]"
     → Extract PersonName as assignee (NOT "you")

3. SECOND-PERSON IN 2-PERSON CHATS:
   * If ONLY 2 different senders appear in ALL messages
   * And message is "[4] Alice: Can you finish the report?"
     → assignee = the OTHER person's name (Bob, if Bob is the only other sender)
   * Pattern: Count unique senders. If exactly 2, "you" = the non-speaker

4. FALLBACK:
   * If no clear assignment, set assignee to null
   * NEVER use pronouns ("I", "me", "you") as the final assignee value
   * NEVER use generic terms ("someone", "anyone")
   
IMPORTANT: The assignee field should ALWAYS contain an actual person's name
or null. Parse the message format carefully: [index] SenderName: message

Context field rules (CRITICAL):
- Focus on WHAT needs to be done, NOT WHO said it
- NEVER include "undefined" in the context
- BAD: "undefined requests to make charts lighter"
- BAD: "John asked someone to update docs"
- GOOD: "Make charts lighter for mobile performance"
- GOOD: "Update documentation after database migration"
- GOOD: "Follow-up from yesterday's discussion about Redis"
- Keep it brief (1-2 sentences max) and descriptive`,
    });

    console.log(
      `🤖 AI found ${result.object.actionItems.length} potential action items`
    );

    // Filter by confidence threshold (minimum 85%)
    const MIN_CONFIDENCE = 0.85;
    const qualityItems = result.object.actionItems.filter(
      (item) => {
        // Check confidence threshold
        if (item.confidence < MIN_CONFIDENCE) return false;

        // Filter out items with "undefined" in context
        if (item.context && item.context.toLowerCase().includes("undefined")) {
          console.log(
            "🚫 Filtered out item with \"undefined\" in context: " +
            `"${item.task.slice(0, 50)}..." | ` +
            `Context: "${item.context}"`
          );
          return false;
        }

        return true;
      },
    );

    if (qualityItems.length < result.object.actionItems.length) {
      console.log(
        "🔍 Filtered out " +
        `${result.object.actionItems.length - qualityItems.length} ` +
        `low-confidence items (below ${MIN_CONFIDENCE * 100}%)`
      );
    }

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

    console.log(
      `Found ${existingItems.length} existing pending action items ` +
      `in conversation ${conversationId}`
    );

    // Generate embeddings for semantic deduplication
    console.log(
      "[Deduplication] Generating embeddings for semantic comparison..."
    );
    const embeddingStartTime = Date.now();

    // Generate embeddings for all quality items
    const itemsWithEmbeddings = await Promise.all(
      qualityItems.map(async (item) => {
        const embedding = await generateEmbedding(item.task);
        return {...item, embedding};
      })
    );

    // Generate embeddings for existing items that don't have them
    interface ExistingItemWithEmbedding extends ExistingActionItem {
      embedding?: number[];
    }

    const existingItemsWithEmbeddings:
      ExistingItemWithEmbedding[] = await Promise.all(
        existingItems.map(async (item) => {
          // Check if embedding already exists
          const itemData = item as unknown as {embedding?: number[]};
          if (itemData.embedding && itemData.embedding.length > 0) {
            return {...item, embedding: itemData.embedding};
          }
          // Generate new embedding
          const embedding = await generateEmbedding(item.task);
          return {...item, embedding};
        })
      );

    console.log(
      `[Deduplication] Embeddings generated in ${
        Date.now() - embeddingStartTime}ms`
    );

    // STEP 1: Batch deduplication - dedupe within newly extracted items
    console.log(
      "[Batch Deduplication] Checking for duplicates within " +
      "newly extracted items..."
    );
    const SIMILARITY_THRESHOLD = 0.85;
    const batchDedupedItems: typeof itemsWithEmbeddings = [];
    const batchDuplicatesSkipped: Array<{
      task: string;
      similarTo: string;
      similarity: number;
    }> = [];

    for (let i = 0; i < itemsWithEmbeddings.length; i++) {
      const currentItem = itemsWithEmbeddings[i];
      let isDuplicateInBatch = false;

      // Compare against items already added to batchDedupedItems
      for (const existingNewItem of batchDedupedItems) {
        // Safety check: ensure both embeddings exist
        if (!currentItem.embedding || !existingNewItem.embedding) {
          console.warn(
            "[Batch Dedup] Missing embedding, skipping comparison"
          );
          continue;
        }

        const similarity = cosineSimilarity(
          currentItem.embedding,
          existingNewItem.embedding
        );

        if (similarity >= SIMILARITY_THRESHOLD) {
          isDuplicateInBatch = true;
          console.log(
            `[Batch Dedup] Found duplicate in batch: "${
              currentItem.task.slice(0, 50)
            }..." ` +
            `(conf: ${currentItem.confidence.toFixed(2)}) matches ` +
            `"${existingNewItem.task.slice(0, 50)}..." ` +
            `(conf: ${existingNewItem.confidence.toFixed(2)}) - ` +
            `${(similarity * 100).toFixed(1)}% similar`
          );

          // Keep higher confidence version
          if (currentItem.confidence > existingNewItem.confidence) {
            console.log(
              "[Batch Dedup] Replacing with higher confidence version"
            );
            const indexToReplace = batchDedupedItems.indexOf(existingNewItem);
            if (indexToReplace !== -1 &&
                indexToReplace < batchDedupedItems.length) {
              batchDedupedItems[indexToReplace] = currentItem;
            }
          } else {
            console.log(
              "[Batch Dedup] Keeping existing higher confidence version"
            );
          }

          batchDuplicatesSkipped.push({
            task: currentItem.task,
            similarTo: existingNewItem.task,
            similarity,
          });

          break; // Stop checking other items in batch
        }
      }

      if (!isDuplicateInBatch) {
        batchDedupedItems.push(currentItem);
      }
    }

    console.log(
      `[Batch Deduplication] Results: ${batchDedupedItems.length} ` +
      `unique items, ${batchDuplicatesSkipped.length} batch duplicates removed`
    );

    // STEP 2: Compare batch-deduplicated items against existing items
    const itemsToCreate: typeof batchDedupedItems = [];
    const semanticDuplicatesSkipped: Array<{
      newTask: string;
      existingTask: string;
      similarity: number;
    }> = [];

    for (const newItem of batchDedupedItems) {
      let isSemanticDuplicate = false;
      let bestMatch: ExistingItemWithEmbedding | null = null;
      let bestSimilarity = 0;

      // Compare with all existing pending items
      for (const existing of existingItemsWithEmbeddings) {
        if (!existing.embedding || !newItem.embedding) continue;

        const similarity = cosineSimilarity(
          newItem.embedding,
          existing.embedding
        );

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = existing;
        }

        if (similarity >= SIMILARITY_THRESHOLD) {
          isSemanticDuplicate = true;
          console.log(
            `[Deduplication] Found semantic duplicate: "${
              newItem.task.slice(0, 60)
            }..." matches existing "${
              existing.task.slice(0, 60)
            }..." (${(similarity * 100).toFixed(1)}% similar)`
          );

          // Get existing confidence from the data
          const existingData = existing as unknown as {confidence?: number};
          const existingConfidence = existingData.confidence || 0;

          console.log(
            "[Deduplication] Existing item details:" +
            ` ID=${existing.id}, confidence=${existingConfidence.toFixed(2)}`
          );

          // Keep the higher confidence version
          if (newItem.confidence > existingConfidence) {
            console.log(
              "[Deduplication] New item has higher confidence " +
              `(${newItem.confidence.toFixed(2)} vs ${
                existingConfidence.toFixed(2)}), ` +
              "but skipping for now (update logic TBD)"
            );
          } else {
            console.log(
              "[Deduplication] Existing item has equal/higher " +
              "confidence, skipping new one"
            );
          }

          semanticDuplicatesSkipped.push({
            newTask: newItem.task,
            existingTask: existing.task,
            similarity,
          });

          break; // Stop checking other existing items
        }
      }

      // If no semantic duplicate found, check for borderline matches
      if (!isSemanticDuplicate) {
        if (bestMatch && bestSimilarity > 0.75) {
          console.log(
            `[Deduplication] Similar but not duplicate: "${
              newItem.task.slice(0, 60)
            }..." vs "${
              bestMatch.task.slice(0, 60)
            }..." (${(bestSimilarity * 100).toFixed(1)}% similar)`
          );
        }
        itemsToCreate.push(newItem);
      }
    }

    console.log(
      `[Deduplication] Results: ${itemsToCreate.length} to create, ` +
      `${semanticDuplicatesSkipped.length} semantic duplicates skipped`
    );

    if (itemsToCreate.length === 0 && semanticDuplicatesSkipped.length > 0) {
      console.log(
        `✓ All ${semanticDuplicatesSkipped.length} items were semantic ` +
        "duplicates - no new items to create"
      );
      return {
        actionItems: [],
        count: 0,
        duplicatesSkipped: semanticDuplicatesSkipped.length,
        message: `No new unique action items found - ${
          semanticDuplicatesSkipped.length} semantic duplicate(s) detected`,
      };
    }

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

    for (const item of itemsToCreate) {
      // Convert AI-returned index to actual message ID
      // IMPORTANT: messages array is in DESC order (newest first)
      // AI receives them with [0]=newest, [N]=oldest
      // When AI returns index "5", we use messages[5].id
      let actualMessageId: string;
      try {
        const messageIndex = parseInt(item.messageId);
        if (isNaN(messageIndex)) {
          console.warn(
            `⚠️ Non-numeric messageId: ${item.messageId}, using first message`
          );
          actualMessageId = messages[0]?.id || item.messageId;
        } else if (messageIndex < 0 || messageIndex >= messages.length) {
          console.warn(
            `⚠️ Message index out of range: ${messageIndex} ` +
            `(valid range: 0-${messages.length - 1}), using first message`
          );
          actualMessageId = messages[0]?.id || item.messageId;
        } else {
          const selectedMessage = messages[messageIndex];
          if (!selectedMessage || !selectedMessage.id) {
            console.warn(
              "⚠️ Message at index " + messageIndex + " is invalid, " +
              "using first message"
            );
            actualMessageId = messages[0]?.id || item.messageId;
          } else {
            actualMessageId = selectedMessage.id;
            // Log for verification
            console.log(
              `✓ Message index ${messageIndex} → ID ${
                actualMessageId.slice(0, 8)
              }... | ` +
              `Text: "${selectedMessage.text?.slice(0, 40)}..."`
            );
          }
        }
      } catch (e) {
        console.warn(
          `⚠️ Failed to parse messageId: ${item.messageId}`,
          e
        );
        actualMessageId = messages[0]?.id || item.messageId;
      }

      // Try to map assignee name to user ID
      let assigneeId = null;
      let finalAssignee = item.assignee;

      if (item.assignee) {
        // Check exact match first (case-insensitive)
        assigneeId = nameToUserId[item.assignee.toLowerCase()] || null;

        // If no exact match, try partial matches or pronoun resolution
        if (!assigneeId) {
          // Check for pronouns or self-references
          const selfReferences = ["i", "me", "myself", "i'll", "i will"];
          const otherReferences = ["you", "you'll", "you will", "your"];

          if (selfReferences.includes(item.assignee.toLowerCase())) {
            // FIRST-PERSON: Find the sender of the original message
            const originalMessage = messages.find(
              (m) => m.id === actualMessageId
            );
            if (originalMessage) {
              // Map the sender to a user ID
              assigneeId =
                nameToUserId[originalMessage.sender.toLowerCase()] || null;
              finalAssignee = originalMessage.sender;
              console.log(
                `🔧 Resolved self-reference "${item.assignee}" → ` +
                `"${finalAssignee}" (${assigneeId || "NULL"})`
              );
            }
          } else if (otherReferences.includes(item.assignee.toLowerCase())) {
            // SECOND-PERSON: Handle "you" references
            const originalMessage = messages.find(
              (m) => m.id === actualMessageId
            );

            if (originalMessage) {
              // Get all unique participant names from messages
              const uniqueSenders = new Set(
                messages.map((m) => m.sender.toLowerCase())
              );

              // Check if this is a 2-person conversation
              if (uniqueSenders.size === 2) {
                // In 2-person chats, "you" means the OTHER participant
                const senderId =
                  nameToUserId[originalMessage.sender.toLowerCase()];
                const participantIds = Object.keys(participantDetails);

                // Find the OTHER participant
                const otherParticipantId = participantIds.find(
                  (id) => id !== senderId
                );

                if (otherParticipantId) {
                  assigneeId = otherParticipantId;
                  const details = participantDetails[
                    otherParticipantId
                  ] as {displayName?: string};
                  finalAssignee = details?.displayName || null;
                  console.log(
                    "🔧 Resolved 2-person \"you\" → " +
                    `"${finalAssignee}" (${assigneeId})`
                  );
                }
              } else {
                // GROUP CHAT: "you" is ambiguous, should stay null
                // (The AI should have extracted the actual name)
                console.log(
                  `⚠️ Ambiguous "you" in group chat (${uniqueSenders.size} ` +
                  "participants) - AI should have extracted actual name"
                );
                finalAssignee = null;
              }
            }
          }

          // If still no match, try fuzzy matching on first names
          // or partial names
          if (!assigneeId && item.assignee) {
            const assigneeLower = item.assignee.toLowerCase().trim();

            // Try to match first name or partial name
            for (const [fullName, id] of Object.entries(nameToUserId)) {
              const fullNameLower = fullName.toLowerCase();
              const firstName = fullNameLower.split(" ")[0];

              // Match if assignee is the first name, or if contained
              if (assigneeLower === firstName ||
                  fullNameLower.includes(assigneeLower) ||
                  assigneeLower.includes(firstName)) {
                assigneeId = id;
                // Use the full display name from participantDetails
                const details =
                  participantDetails[id] as {displayName?: string};
                finalAssignee = details?.displayName || null;
                console.log(
                  `🔧 Fuzzy matched "${item.assignee}" → ` +
                  `"${finalAssignee}" (${assigneeId})`
                );
                break;
              }
            }
          }
        }

        // If still no assigneeId AND the assignee name is
        // generic/invalid, treat as unassigned
        if (!assigneeId && item.assignee) {
          const invalidNames = [
            "undefined", "null", "unknown", "someone", "anyone",
            "participant", "user", "person", "they", "them",
            "you", "your", // Explicitly mark remaining pronouns as invalid
          ];
          if (invalidNames.some((invalid) =>
            item.assignee && item.assignee.toLowerCase().includes(invalid)
          )) {
            console.log(
              `⚠️ Invalid/generic assignee name "${item.assignee}" → null`
            );
            finalAssignee = null;
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

        if (sameTask || sameMessage || sameAssignee) {
          console.log(
            `🔍 Duplicate check for "${item.task.slice(0, 30)}...": ` +
            `sameTask=${sameTask}, sameMessage=${sameMessage}, ` +
            `sameAssignee=${sameAssignee} ` +
            `(existing: task="${existing.task.slice(0, 30)}...", ` +
            `msgId=${existing.messageId?.slice(0, 8)}, ` +
            `assigneeId=${existing.assigneeId || "NULL"})`
          );
        }

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

      console.log(
        "✅ Not a duplicate - proceeding to create: " +
        `"${item.task.slice(0, 40)}..."`
      );

      // Check if this matches a completed/deleted item
      // If found, create a NEW item instead of resurrecting the old one
      // This preserves history while making the action item visible again
      const completedOrDeletedMatch = completedOrDeletedItems.find(
        (existing) => {
          const sameTask = existing.task === item.task;
          const sameMessage = existing.messageId === actualMessageId;
          const sameAssignee = existing.assigneeId === assigneeId;
          return sameTask && sameMessage && sameAssignee;
        });

      if (completedOrDeletedMatch) {
        // Don't skip - create a NEW duplicate item instead
        // The old completed/deleted item stays as history
        console.log(
          `♻️ Found ${completedOrDeletedMatch.status} item: ` +
          `"${item.task.slice(0, 40)}..." - creating new active duplicate`
        );
        // Fall through to create new item below
      }

      // Create new item
      const ref = db.collection("action_items").doc();

      console.log(
        `➕ Creating new item #${newItems + 1}: ` +
        `"${item.task.slice(0, 40)}..."`
      );
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
        embedding: item.embedding, // Store embedding for future deduplication
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
      });
      newItems++;
    }

    // Only commit if there are items to create
    if (newItems > 0) {
      await batch.commit();
      console.log(
        `✓ Committed ${newItems} new action items to Firestore`
      );
    }

    console.log(
      `📊 Extraction complete for conversation ${conversationId}: ` +
      `${newItems} created, ` +
      `${duplicatesSkipped} duplicates skipped, ` +
      `${batchDuplicatesSkipped.length} batch duplicates removed, ` +
      `${semanticDuplicatesSkipped.length} semantic duplicates skipped, ` +
      `${itemsToCreate.length} passed deduplication, ` +
      `${qualityItems.length} passed quality filter, ` +
      `${result.object.actionItems.length} total found by AI`
    );

    // Return successful response with the new items
    return {
      actionItems: itemsToCreate.slice(0, newItems),
      count: newItems,
      duplicatesSkipped: duplicatesSkipped + semanticDuplicatesSkipped.length,
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
