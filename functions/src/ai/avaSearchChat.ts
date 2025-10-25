import {onCall, HttpsError} from "firebase-functions/v2/https";
import {getOpenAIClient, openaiKey} from "../utils/openai";
import {smartSearch} from "./smartSearch";
import {pineconeKey} from "../utils/pinecone";

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
  const {userQuery, conversationHistory = []} = request.data as AvaSearchChatRequest;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!userQuery || userQuery.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Query is required");
  }

  try {
    console.log(`[AvaSearchChat] Processing query for user ${userId}: "${userQuery}"`);

    // Step 1: Classify intent
    const intent = await classifyIntent(userQuery, conversationHistory);
    console.log(`[AvaSearchChat] Detected intent: ${intent}`);

    // Step 2: Route based on intent
    if (intent === "search") {
      // Use semantic search to answer the question
      return await handleSearchQuery(userQuery, userId, request);
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
 */
async function classifyIntent(
  query: string,
  conversationHistory: Array<{role: "user" | "assistant"; content: string}>
): Promise<"search" | "summarize" | "general"> {
  const openai = getOpenAIClient();

  const systemPrompt = `You are an intent classifier for an AI chat assistant. Classify the user's query into one of these categories:

- "search": User is asking a question about past messages, decisions, or information they discussed. Questions like "What did we decide?", "Did anyone mention X?", "When did Y happen?", "Tell me about Z"
- "summarize": User wants a summary of a conversation or messages (e.g., "Summarize my chat with John")
- "general": Greetings, help requests, action item queries, or other general questions

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

  const intent = response.choices[0].message.content?.toLowerCase().trim() || "general";

  // Validate intent
  if (intent.includes("search")) return "search";
  if (intent.includes("summarize")) return "summarize";
  return "general";
}

/**
 * Handle search queries by finding relevant messages and generating an answer
 */
async function handleSearchQuery(
  query: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any
): Promise<AvaSearchChatResponse> {
  // Step 1: Perform semantic search
  console.log(`[AvaSearchChat] Performing semantic search for: "${query}"`);

  // Call the smartSearch function directly
  const searchResponse = await smartSearch.run({
    data: {query, filters: {}},
    auth: request.auth,
    rawRequest: request.rawRequest,
  });

  const searchResults = searchResponse.results || [];

  if (searchResults.length === 0) {
    return {
      answer: `I couldn't find any messages related to "${query}". Try rephrasing your question or using different keywords.`,
      intent: "search",
      sources: [],
    };
  }

  // Step 2: Use top 5 results as context
  const topResults = searchResults.slice(0, 5);
  console.log(`[AvaSearchChat] Using ${topResults.length} results as context`);

  // Step 3: Generate answer using GPT-4o-mini
  const openai = getOpenAIClient();

  const contextText = topResults
    .map((result, i) => {
      return `[Message ${i + 1}] From ${result.sender} in ${result.conversationName || "Unknown"}:\n"${result.text}"`;
    })
    .join("\n\n");

  const systemPrompt = `You are Ava, a helpful AI assistant. Answer the user's question based on the provided message context.

Rules:
- Use the message context to answer accurately
- Cite specific messages when relevant (e.g., "According to [sender]...")
- If the context doesn't fully answer the question, say what you found and acknowledge gaps
- Be concise but informative (2-4 sentences)
- Use a friendly, conversational tone

Message Context:
${contextText}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {role: "system", content: systemPrompt},
      {role: "user", content: query},
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  const answer = response.choices[0].message.content || "I'm not sure how to answer that.";

  // Step 4: Format sources
  const sources = topResults.map((result) => ({
    messageId: result.messageId,
    text: result.text,
    sender: result.sender,
    conversationName: result.conversationName || "Unknown",
    timestamp: result.timestamp,
    score: result.score,
  }));

  console.log(`[AvaSearchChat] Generated answer with ${sources.length} sources`);

  return {
    answer,
    intent: "search",
    sources,
  };
}

