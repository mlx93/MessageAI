import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {getOpenAIClient, openaiKey} from "../utils/openai";
import {getIndex, pineconeKey} from "../utils/pinecone";

interface AvaSearchChatRequest {
  userQuery: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

interface AvaSearchChatResponse {
  answer: string;
  intent: "search" | "summarize" | "general";
  sources?: Array<{
    messageId: string;
    text: string;
    sender: string;
    conversationName: string;
    timestamp: number;
    score: number;
  }>;
}

/**
 * Ava chat endpoint that intelligently routes queries and uses
 * semantic search to answer questions with citations
 */
export const avaSearchChat = onCall({
  secrets: [openaiKey, pineconeKey],
  memory: "1GiB",
  timeoutSeconds: 30,
}, async (request) => {
  const {
    userQuery,
    conversationHistory = [],
  } = request.data as AvaSearchChatRequest;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!userQuery || userQuery.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Query is required");
  }

  try {
    console.log(
      `[AvaSearchChat] Processing query for user ${userId}: "${userQuery}"`
    );

    // Step 1: Classify intent
    const intent = await classifyIntent(userQuery, conversationHistory);
    console.log(`[AvaSearchChat] Detected intent: ${intent}`);

    // Step 2: Route based on intent
    if (intent === "search") {
      // Use semantic search to answer the question
      return await handleSearchQuery(userQuery, userId);
    }

    // For other intents (summarize, general), return a response
    // indicating that the existing Ava logic should handle it
    return {
      answer: "", // Empty answer means use existing logic
      intent,
    } as AvaSearchChatResponse;
  } catch (error) {
    console.error("[AvaSearchChat] Error:", error);
    throw new HttpsError("internal", "Failed to process query");
  }
});

/**
 * Classify user intent using GPT-4o-mini
 * @param {string} query - The user's query
 * @param {Array} conversationHistory - Recent conversation messages
 * @return {Promise<string>} The classified intent
 */
async function classifyIntent(
  query: string,
  conversationHistory: Array<{role: "user" | "assistant"; content: string}>
): Promise<"search" | "summarize" | "general"> {
  const openai = getOpenAIClient();

  const systemPrompt = `You are an intent classifier for an AI chat \
assistant. Classify the user's query into one of these categories:

- "search": User is asking a question about past messages, decisions, or \
information they discussed. Questions like "What did we decide?", "Did \
anyone mention X?", "When did Y happen?", "Tell me about Z"
- "summarize": User wants a summary of a conversation or messages (e.g., \
"Summarize my chat with John")
- "general": Greetings, help requests, action item queries, or other \
general questions

Reply with ONLY one word: "search", "summarize", or "general"`;

  const contextMessages = conversationHistory.slice(-3).map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {role: "system", content: systemPrompt},
      ...contextMessages,
      {role: "user", content: query},
    ],
    temperature: 0.1,
    max_tokens: 10,
  });

  const intent = response.choices[0].message.content?.toLowerCase()
    .trim() || "general";

  // Validate intent
  if (intent.includes("search")) return "search";
  if (intent.includes("summarize")) return "summarize";
  return "general";
}

/**
 * Handle search queries by finding relevant messages and generating answer
 * @param {string} query - The search query
 * @param {string} userId - The user ID
 * @return {Promise<AvaSearchChatResponse>} The search response
 */
async function handleSearchQuery(
  query: string,
  userId: string
): Promise<AvaSearchChatResponse> {
  // Step 1: Perform semantic search using Pinecone directly
  console.log(
    `[AvaSearchChat] Performing semantic search for: "${query}"`
  );

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
    .slice(0, 5);

  if (relevantMatches.length === 0) {
    return {
      answer: `I couldn't find any messages related to "${query}". \
Try rephrasing your question or using different keywords.`,
      intent: "search",
      sources: [],
    };
  }

  // Step 2: Fetch message details from Firestore
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

        // Get conversation data
        const convDoc = await db.collection("conversations")
          .doc(conversationId).get();
        const convData = convDoc.exists ? convDoc.data() : null;

        // Get sender name
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
            conversationName = otherParticipants.join(", ") || "Direct Message";
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

  const validMessages = messages.filter(Boolean) as Array<{
    messageId: string;
    text: string;
    sender: string;
    conversationName: string;
    timestamp: number;
    score: number;
  }>;

  if (validMessages.length === 0) {
    return {
      answer: `I couldn't find any messages related to "${query}". \
Try rephrasing your question or using different keywords.`,
      intent: "search",
      sources: [],
    };
  }

  // Step 3: Use top 5 results as context
  const topResults = validMessages.slice(0, 5);
  console.log(`[AvaSearchChat] Using ${topResults.length} results as context`);

  // Step 4: Generate answer using GPT-4o-mini
  const openaiClient = getOpenAIClient();

  const contextText = topResults
    .map((result, i) => {
      return `[Message ${i + 1}] From ${result.sender} in \
${result.conversationName || "Unknown"}:\n"${result.text}"`;
    })
    .join("\n\n");

  const systemPrompt = `You are Ava, a helpful AI assistant. Answer the \
user's question based on the provided message context.

Rules:
- Use the message context to answer accurately
- Cite specific messages when relevant (e.g., "According to [sender]...")
- If the context doesn't fully answer the question, say what you found \
and acknowledge gaps
- Be concise but informative (2-4 sentences)
- Use a friendly, conversational tone

Message Context:
${contextText}`;

  const response = await openaiClient.chat.completions.create({
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

  // Step 5: Format sources
  const sources = topResults.map((result) => ({
    messageId: result.messageId,
    text: result.text,
    sender: result.sender,
    conversationName: result.conversationName,
    timestamp: result.timestamp,
    score: result.score,
  }));

  console.log(
    `[AvaSearchChat] Generated answer with ${sources.length} sources`
  );

  return {
    answer,
    intent: "search",
    sources,
  };
}

