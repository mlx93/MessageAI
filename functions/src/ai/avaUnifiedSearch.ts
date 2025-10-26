import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {getOpenAIClient, openaiKey} from "../utils/openai";
import {getIndex, pineconeKey} from "../utils/pinecone";

interface UnifiedSearchRequest {
  userQuery: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

interface ActionItemResult {
  id: string;
  task: string;
  assignee: string | null;
  assigneeId: string | null;
  deadline: string | null;
  confidence: number;
  conversationId: string;
  conversationName?: string;
}

interface DecisionResult {
  id: string;
  decision: string;
  rationale: string;
  decisionMaker: string | null;
  madeAt: number;
  confidence: number;
  conversationId: string;
  conversationName?: string;
}

interface MessageResult {
  messageId: string;
  text: string;
  sender: string;
  conversationName: string;
  timestamp: number;
  score: number;
}

interface UnifiedSearchResponse {
  answer: string;
  intent: "unified" | "messages_only" | "general";
  messages?: MessageResult[];
  actionItems?: ActionItemResult[];
  decisions?: DecisionResult[];
  hasResults: boolean;
}

/**
 * Ava Unified Search - Fetches context from messages, action items,
 * and decisions in parallel to provide comprehensive answers
 */
export const avaUnifiedSearch = onCall({
  secrets: [openaiKey, pineconeKey],
  memory: "2GiB",
  timeoutSeconds: 45,
}, async (request) => {
  const {
    userQuery,
    conversationHistory = [],
  } = request.data as UnifiedSearchRequest;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!userQuery || userQuery.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Query is required");
  }

  try {
    console.log(
      `[AvaUnifiedSearch] Processing query for user ${userId}: ` +
      `"${userQuery}"`
    );

    // Step 1: Classify intent - determine if we need all sources
    const needsUnified = await shouldUseUnifiedSearch(
      userQuery,
      conversationHistory
    );

    if (!needsUnified) {
      // Fall back to message-only search
      console.log("[AvaUnifiedSearch] Using message-only search");
      return await handleMessageOnlySearch(userQuery, userId);
    }

    // Step 2: Fetch all data sources in parallel
    console.log("[AvaUnifiedSearch] Fetching from all sources in parallel");
    const [messages, actionItems, decisions] = await Promise.all([
      fetchRelevantMessages(userQuery, userId),
      fetchRelevantActionItems(userQuery, userId),
      fetchRelevantDecisions(userQuery, userId),
    ]);

    console.log(
      `[AvaUnifiedSearch] Fetched ${messages.length} messages, ` +
      `${actionItems.length} action items, ${decisions.length} decisions`
    );

    // Step 3: Check if we have any results
    const hasResults = messages.length > 0 ||
                      actionItems.length > 0 ||
                      decisions.length > 0;

    if (!hasResults) {
      return {
        answer: `I couldn't find any information related to "${userQuery}". ` +
                "Try rephrasing your question or using different keywords.",
        intent: "unified" as const,
        messages: [],
        actionItems: [],
        decisions: [],
        hasResults: false,
      };
    }

    // Step 4: Generate unified answer using GPT-4o-mini
    const answer = await generateUnifiedAnswer(
      userQuery,
      messages,
      actionItems,
      decisions
    );

    return {
      answer,
      intent: "unified" as const,
      messages: messages.slice(0, 5), // Top 5 messages
      actionItems: actionItems.slice(0, 5), // Top 5 action items
      decisions: decisions.slice(0, 3), // Top 3 decisions
      hasResults: true,
    } as UnifiedSearchResponse;
  } catch (error) {
    console.error("[AvaUnifiedSearch] Error:", error);
    throw new HttpsError("internal", "Failed to process unified search");
  }
});

/**
 * Determine if query should use unified search (all sources)
 * or just message search
 * @param {string} query - The user's query
 * @param {Array} conversationHistory - Recent conversation messages
 * @return {Promise<boolean>} Whether to use unified search
 */
async function shouldUseUnifiedSearch(
  query: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  conversationHistory: Array<{role: "user" | "assistant"; content: string}>
): Promise<boolean> {
  const lowerQuery = query.toLowerCase();

  // Keywords that suggest need for action items or decisions
  const actionKeywords = [
    "task", "todo", "doing", "working on", "assigned",
    "responsible", "deadline", "due", "implement", "handle",
  ];

  const decisionKeywords = [
    "decide", "decision", "chose", "chosen", "picked",
    "selected", "went with", "why", "rationale",
  ];

  const hasActionKeywords = actionKeywords.some((kw) =>
    lowerQuery.includes(kw)
  );
  const hasDecisionKeywords = decisionKeywords.some((kw) =>
    lowerQuery.includes(kw)
  );

  // Use unified search if query contains action/decision keywords
  // or if it's asking "what" + "who" (likely needs context)
  const isComprehensiveQuery =
    lowerQuery.includes("what") && lowerQuery.includes("who");

  return hasActionKeywords || hasDecisionKeywords || isComprehensiveQuery;
}

/**
 * Format deadline to avoid "Invalid Date" issues
 * @param {any} deadline - Deadline value from Firestore
 * @return {string | null} Formatted deadline or null
 */
function formatDeadline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deadline: any
): string | null {
  if (!deadline) return null;

  try {
    let date: Date | null = null;

    // Handle Firestore Timestamp
    if (typeof deadline === "object" && "toDate" in deadline) {
      date = deadline.toDate();
    } else if (typeof deadline === "object" && "_seconds" in deadline) {
      // Handle timestamp object with _seconds
      date = new Date(deadline._seconds * 1000);
    } else if (typeof deadline === "number") {
      // Handle number (epoch timestamp)
      date = new Date(deadline);
    } else if (typeof deadline === "string") {
      // Handle string
      date = new Date(deadline);
    }

    // Validate the date
    if (date && !isNaN(date.getTime())) {
      return date.toISOString();
    }

    return null;
  } catch (error) {
    console.error("[AvaUnifiedSearch] Error formatting deadline:", error);
    return null;
  }
}

/**
 * Fetch relevant messages using semantic search
 * @param {string} query - The search query
 * @param {string} userId - The user ID
 * @return {Promise<MessageResult[]>} Array of relevant messages
 */
async function fetchRelevantMessages(
  query: string,
  userId: string
): Promise<MessageResult[]> {
  try {
    const openai = getOpenAIClient();

    // Generate query embedding
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // Search Pinecone
    const index = getIndex();
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 20,
      filter: {
        participants: {$in: [userId]},
        deletedBy: {$nin: [userId]},
      },
      includeMetadata: true,
    });

    const relevantMatches = searchResults.matches
      .filter((m) => (m.score || 0) >= 0.3)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 10);

    // Fetch message details from Firestore
    const db = admin.firestore();
    const messages = await Promise.all(
      relevantMatches.map(async (match) => {
        try {
          if (!match.metadata) return null;

          const conversationId = match.metadata.conversationId as string;
          const messageDoc = await db
            .collection(`conversations/${conversationId}/messages`)
            .doc(match.id)
            .get();

          if (!messageDoc.exists) return null;

          const data = messageDoc.data();
          if (!data) return null;

          // Get conversation data for names
          const convDoc = await db.collection("conversations")
            .doc(conversationId).get();
          const convData = convDoc.exists ? convDoc.data() : null;

          const participantDetails = convData?.participantDetails || {};
          const senderId = data.senderId || data.sender;
          const senderName = participantDetails[senderId]?.displayName ||
                           "Unknown";

          // Get conversation name
          let conversationName = "Unknown";
          if (convData) {
            if (convData.isGroup) {
              conversationName = convData.groupName || "Group Chat";
            } else {
              const otherParticipants = Object.entries(participantDetails)
                .filter(([id]) => id !== userId)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map(([, details]) => (details as any)?.displayName)
                .filter(Boolean);
              conversationName = otherParticipants.join(", ") ||
                               "Direct Message";
            }
          }

          let timestamp = Date.now();
          if (data.timestamp) {
            if (typeof data.timestamp === "object" &&
                "toMillis" in data.timestamp) {
              timestamp = data.timestamp.toMillis();
            } else if (typeof data.timestamp === "object" &&
                       "_seconds" in data.timestamp) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              timestamp = (data.timestamp as any)._seconds * 1000;
            } else if (typeof data.timestamp === "number") {
              timestamp = data.timestamp;
            }
          }

          return {
            messageId: match.id,
            text: data.text as string,
            sender: senderName,
            conversationName,
            timestamp,
            score: match.score || 0,
          };
        } catch (error) {
          console.error(`Error fetching message ${match.id}:`, error);
          return null;
        }
      })
    );

    const validMessages = messages.filter(Boolean) as MessageResult[];

    // Deduplicate similar messages
    const uniqueMessages = deduplicateMessages(validMessages);

    return uniqueMessages;
  } catch (error) {
    console.error("[AvaUnifiedSearch] Error fetching messages:", error);
    return [];
  }
}

/**
 * Deduplicate messages based on text similarity
 * @param {MessageResult[]} messages - Array of messages
 * @return {MessageResult[]} Deduplicated messages
 */
function deduplicateMessages(messages: MessageResult[]): MessageResult[] {
  const uniqueMessages: MessageResult[] = [];
  const seenTexts = new Set<string>();

  for (const message of messages) {
    // Normalize text for comparison (lowercase, trim, remove extra spaces)
    const normalizedText = message.text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[?!.,"']/g, ""); // Remove punctuation

    // Check if we've seen a very similar message
    let isDuplicate = false;
    for (const seenText of seenTexts) {
      // Calculate simple similarity
      // (percentage of matching words)
      const words1 = normalizedText.split(" ");
      const words2 = seenText.split(" ");
      const commonWords = words1.filter((w) => words2.includes(w));
      const similarity =
        commonWords.length / Math.max(words1.length, words2.length);

      // Stricter threshold: 60% similar (was 70%)
      // Also check if shorter text is 80%+ contained in longer
      const containmentRatio = Math.min(words1.length, words2.length) /
                              Math.max(words1.length, words2.length);
      const isHighContainment = containmentRatio > 0.6 && similarity > 0.8;

      if (similarity > 0.6 || isHighContainment) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueMessages.push(message);
      seenTexts.add(normalizedText);
    }
  }

  return uniqueMessages;
}

/**
 * Fetch relevant action items from Firestore
 * @param {string} query - The search query
 * @param {string} userId - The user ID
 * @return {Promise<ActionItemResult[]>} Array of relevant action items
 */
async function fetchRelevantActionItems(
  query: string,
  userId: string
): Promise<ActionItemResult[]> {
  try {
    const db = admin.firestore();

    // Get user's conversations (excluding hidden/deleted ones)
    const conversationsSnapshot = await db
      .collection("conversations")
      .where("participants", "array-contains", userId)
      .get();

    // Filter out hidden/deleted conversations
    const visibleConversations = conversationsSnapshot.docs.filter((doc) => {
      const data = doc.data();
      // Exclude if conversation is deleted or hidden for this user
      if (data.deleted ||
          data.deletedBy?.includes(userId) ||
          data.hiddenBy?.includes(userId)) {
        return false;
      }
      return true;
    });

    const conversationIds = visibleConversations.map((doc) => doc.id);
    const conversationMap = new Map(
      visibleConversations.map((doc) => [doc.id, doc.data()])
    );

    if (conversationIds.length === 0) {
      return [];
    }

    // Query action items from user's conversations
    // Firestore 'in' operator supports up to 10 items, so batch if needed
    const batchSize = 10;
    const actionItemsPromises: Promise<admin.firestore.QuerySnapshot>[] = [];

    for (let i = 0; i < conversationIds.length; i += batchSize) {
      const batch = conversationIds.slice(i, i + batchSize);
      const promise = db
        .collection("action_items")
        .where("conversationId", "in", batch)
        .where("status", "==", "pending")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();
      actionItemsPromises.push(promise);
    }

    const actionItemsSnapshots = await Promise.all(actionItemsPromises);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allActionItems = actionItemsSnapshots.flatMap((snap) =>
      snap.docs.map((doc) => ({id: doc.id, ...doc.data()}))
    );

    // Simple keyword matching for relevance
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(" ").filter((w) => w.length > 2);

    const relevantItems = allActionItems
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => {
        const taskLower = (item.task || "").toLowerCase();
        const assigneeLower = (item.assignee || "").toLowerCase();
        // Match if any keyword appears in task or assignee
        return keywords.some((kw) =>
          taskLower.includes(kw) || assigneeLower.includes(kw)
        );
      })
      .slice(0, 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        const conversationData = conversationMap.get(item.conversationId);
        let conversationName = "Unknown";

        if (conversationData) {
          if (conversationData.isGroup) {
            conversationName = conversationData.groupName || "Group Chat";
          } else {
            const participantDetails =
              conversationData.participantDetails || {};
            const otherParticipants = Object.entries(participantDetails)
              .filter(([id]) => id !== userId)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map(([, details]) => (details as any)?.displayName)
              .filter(Boolean);
            conversationName = otherParticipants.join(", ") ||
                             "Direct Message";
          }
        }

        return {
          id: item.id,
          task: item.task,
          assignee: item.assignee,
          assigneeId: item.assigneeId,
          deadline: formatDeadline(item.deadline),
          confidence: item.confidence || 0,
          conversationId: item.conversationId,
          conversationName,
        } as ActionItemResult;
      });

    console.log(
      `[AvaUnifiedSearch] Found ${relevantItems.length} relevant action items`
    );
    return relevantItems;
  } catch (error) {
    console.error("[AvaUnifiedSearch] Error fetching action items:", error);
    return [];
  }
}

/**
 * Fetch relevant decisions from Firestore
 * @param {string} query - The search query
 * @param {string} userId - The user ID
 * @return {Promise<DecisionResult[]>} Array of relevant decisions
 */
async function fetchRelevantDecisions(
  query: string,
  userId: string
): Promise<DecisionResult[]> {
  try {
    const db = admin.firestore();

    // Get user's conversations (excluding hidden/deleted ones)
    const conversationsSnapshot = await db
      .collection("conversations")
      .where("participants", "array-contains", userId)
      .get();

    // Filter out hidden/deleted conversations
    const visibleConversations = conversationsSnapshot.docs.filter((doc) => {
      const data = doc.data();
      // Exclude if conversation is deleted or hidden for this user
      if (data.deleted ||
          data.deletedBy?.includes(userId) ||
          data.hiddenBy?.includes(userId)) {
        return false;
      }
      return true;
    });

    const conversationIds = visibleConversations.map((doc) => doc.id);
    const conversationMap = new Map(
      visibleConversations.map((doc) => [doc.id, doc.data()])
    );

    if (conversationIds.length === 0) {
      return [];
    }

    // Query decisions from user's conversations
    const batchSize = 10;
    const decisionsPromises: Promise<admin.firestore.QuerySnapshot>[] = [];

    for (let i = 0; i < conversationIds.length; i += batchSize) {
      const batch = conversationIds.slice(i, i + batchSize);
      const promise = db
        .collection("decisions")
        .where("conversationId", "in", batch)
        .where("status", "==", "active")
        .orderBy("madeAt", "desc")
        .limit(20)
        .get();
      decisionsPromises.push(promise);
    }

    const decisionsSnapshots = await Promise.all(decisionsPromises);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDecisions = decisionsSnapshots.flatMap((snap) =>
      snap.docs.map((doc) => ({id: doc.id, ...doc.data()}))
    );

    // Simple keyword matching for relevance
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(" ").filter((w) => w.length > 2);

    const relevantDecisions = allDecisions
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((decision: any) => {
        const decisionLower = (decision.decision || "").toLowerCase();
        const rationaleLower = (decision.rationale || "").toLowerCase();
        // Match if any keyword appears in decision or rationale
        return keywords.some((kw) =>
          decisionLower.includes(kw) || rationaleLower.includes(kw)
        );
      })
      .slice(0, 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((decision: any) => {
        const conversationData = conversationMap.get(decision.conversationId);
        let conversationName = "Unknown";

        if (conversationData) {
          if (conversationData.isGroup) {
            conversationName = conversationData.groupName || "Group Chat";
          } else {
            const participantDetails =
              conversationData.participantDetails || {};
            const otherParticipants = Object.entries(participantDetails)
              .filter(([id]) => id !== userId)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map(([, details]) => (details as any)?.displayName)
              .filter(Boolean);
            conversationName = otherParticipants.join(", ") ||
                             "Direct Message";
          }
        }

        // Parse madeAt timestamp
        let madeAt = Date.now();
        if (decision.madeAt) {
          if (typeof decision.madeAt === "object" &&
              "toMillis" in decision.madeAt) {
            madeAt = decision.madeAt.toMillis();
          } else if (typeof decision.madeAt === "number") {
            madeAt = decision.madeAt;
          }
        }

        return {
          id: decision.id,
          decision: decision.decision,
          rationale: decision.rationale,
          decisionMaker: decision.decisionMaker || null,
          madeAt,
          confidence: decision.confidence || 0,
          conversationId: decision.conversationId,
          conversationName,
        } as DecisionResult;
      });

    console.log(
      `[AvaUnifiedSearch] Found ${relevantDecisions.length} relevant decisions`
    );
    return relevantDecisions;
  } catch (error) {
    console.error("[AvaUnifiedSearch] Error fetching decisions:", error);
    return [];
  }
}

/**
 * Generate unified answer using all sources
 * @param {string} query - The user's query
 * @param {MessageResult[]} messages - Relevant messages
 * @param {ActionItemResult[]} actionItems - Relevant action items
 * @param {DecisionResult[]} decisions - Relevant decisions
 * @return {Promise<string>} The generated answer
 */
async function generateUnifiedAnswer(
  query: string,
  messages: MessageResult[],
  actionItems: ActionItemResult[],
  decisions: DecisionResult[]
): Promise<string> {
  const openai = getOpenAIClient();

  // Build context from all sources
  let contextText = "";

  // Add decisions first (most authoritative)
  if (decisions.length > 0) {
    contextText += "**DECISIONS MADE:**\n";
    decisions.slice(0, 3).forEach((d, i) => {
      const date = new Date(d.madeAt).toLocaleDateString();
      contextText += `[Decision ${i + 1}] "${d.decision}" ` +
        `(${d.confidence * 100}% confidence)\n`;
      contextText += `  - Made by: ${d.decisionMaker || "Team"}\n`;
      contextText += `  - Date: ${date}\n`;
      contextText += `  - Rationale: ${d.rationale}\n`;
      contextText += `  - Context: ${d.conversationName}\n\n`;
    });
  }

  // Add action items (what's being done)
  if (actionItems.length > 0) {
    contextText += "**ACTION ITEMS:**\n";
    actionItems.slice(0, 5).forEach((item, i) => {
      contextText += `[Task ${i + 1}] "${item.task}"\n`;
      contextText += `  - Assigned to: ${item.assignee || "Unassigned"}\n`;
      if (item.deadline) {
        const deadline = new Date(item.deadline).toLocaleDateString();
        contextText += `  - Due: ${deadline}\n`;
      }
      contextText += `  - Context: ${item.conversationName}\n\n`;
    });
  }

  // Add relevant messages (discussion context)
  if (messages.length > 0) {
    contextText += "**RELATED MESSAGES:**\n";
    messages.slice(0, 5).forEach((msg, i) => {
      contextText += `[Message ${i + 1}] From ${msg.sender} in ` +
        `${msg.conversationName}:\n`;
      contextText += `  "${msg.text}"\n\n`;
    });
  }

  const systemPrompt = "You are Ava, a helpful AI assistant. " +
    "Answer the user's question by synthesizing information from " +
    "decisions, action items, and messages.\n\n" +
    "Rules:\n" +
    "- Prioritize decisions for \"what\" questions and action items for " +
    "\"who's doing\" questions\n" +
    "- Cite specific sources (e.g., \"According to the decision...\", " +
    "\"Adrian is working on...\")\n" +
    "- If you have decisions + action items, connect them (e.g., " +
    "\"We decided X, and Adrian is implementing it\")\n" +
    "- Be concise but comprehensive (3-5 sentences)\n" +
    "- Use a friendly, conversational tone\n" +
    "- Use emojis for source types: 📌 for decisions, ✅ for action items, " +
    "📧 for messages\n\n" +
    "Context:\n" +
    contextText;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {role: "system", content: systemPrompt},
      {role: "user", content: query},
    ],
    temperature: 0.7,
    max_tokens: 400,
  });

  return response.choices[0].message.content ||
         "I'm not sure how to answer that.";
}

/**
 * Handle message-only search (fallback for non-unified queries)
 * @param {string} query - The search query
 * @param {string} userId - The user ID
 * @return {Promise<UnifiedSearchResponse>} The search response
 */
async function handleMessageOnlySearch(
  query: string,
  userId: string
): Promise<UnifiedSearchResponse> {
  const messages = await fetchRelevantMessages(query, userId);

  if (messages.length === 0) {
    return {
      answer: `I couldn't find any messages related to "${query}". ` +
              "Try rephrasing your question or using different keywords.",
      intent: "messages_only",
      messages: [],
      hasResults: false,
    };
  }

  // Generate simple answer from messages only
  const openai = getOpenAIClient();

  const contextText = messages
    .slice(0, 5)
    .map((msg, i) => {
      return `[Message ${i + 1}] From ${msg.sender} in ` +
        `${msg.conversationName}:\n"${msg.text}"`;
    })
    .join("\n\n");

  const systemPrompt = "You are Ava, a helpful AI assistant. " +
    "Answer the user's question based on the provided message context.\n\n" +
    "Rules:\n" +
    "- Use the message context to answer accurately\n" +
    "- Cite specific messages when relevant " +
    "(e.g., \"According to [sender]...\")\n" +
    "- Be concise but informative (2-4 sentences)\n" +
    "- Use a friendly, conversational tone\n\n" +
    "Message Context:\n" +
    contextText;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {role: "system", content: systemPrompt},
      {role: "user", content: query},
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  const answer = response.choices[0].message.content ||
                "I'm not sure how to answer that.";

  return {
    answer,
    intent: "messages_only",
    messages: messages.slice(0, 5),
    hasResults: true,
  };
}

