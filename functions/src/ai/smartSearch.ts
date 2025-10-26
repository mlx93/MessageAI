import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {getOpenAIClient, openaiKey} from "../utils/openai";
import {getIndex, pineconeKey} from "../utils/pinecone";
import {withCache} from "../utils/cache";

interface SmartSearchRequest {
  query: string;
  filters?: {
    conversationId?: string;
    dateRange?: {
      start: string;
      end: string;
    };
    sender?: string;
  };
}

interface SearchResult {
  messageId: string;
  score: number;
  text: string;
  sender: string;
  timestamp: number;
  conversationId: string;
  conversationName?: string;
  conversationType?: "direct" | "group";
  isContext?: boolean; // Marks messages fetched for context
}

export const smartSearch = onCall({
  secrets: [openaiKey, pineconeKey],
  memory: "2GiB",
  timeoutSeconds: 60,
}, async (request) => {
  const {query, filters} = request.data as SmartSearchRequest;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  if (!query || query.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Search query is required");
  }

  try {
    const cacheKey = `search_${userId}_${query}_${
      JSON.stringify(filters)}`;

    const results = await withCache(cacheKey, 10, async () => {
      const startTime = Date.now();

      // Step 1: Generate query embedding
      console.log(`[SmartSearch] Generating embedding for query: "${query}"`);
      const openaiClient = getOpenAIClient();
      const embeddingResponse = await openaiClient.embeddings.create({
        model: "text-embedding-3-large",
        input: query,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;
      console.log(`[SmartSearch] Embedding generated in ${
        Date.now() - startTime}ms`);

      // Step 2: Search Pinecone with higher topK for better recall
      const index = getIndex();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pineconeFilters: any = {
        // Filter by participants array to show ALL messages
        // from user's conversations
        participants: {$in: [userId]},
        // Filter out messages deleted by this user
        // (prevents fetching from Firestore at all)
        deletedBy: {$nin: [userId]},
      };

      if (filters?.conversationId) {
        pineconeFilters.conversationId = {$eq: filters.conversationId};
      }
      if (filters?.dateRange) {
        pineconeFilters.timestamp = {
          $gte: new Date(filters.dateRange.start).getTime(),
          $lte: new Date(filters.dateRange.end).getTime(),
        };
      }

      console.log("[SmartSearch] Querying Pinecone with topK=100");
      const searchResults = await index.query({
        vector: queryEmbedding,
        topK: 100, // Increased from 20 to capture more relevant results
        filter: pineconeFilters,
        includeMetadata: true,
      });

      console.log(`[SmartSearch] Found ${searchResults.matches.length} \
matches from Pinecone`);

      if (searchResults.matches.length === 0) {
        return {results: [], searchTime: Date.now() - startTime};
      }

      // Step 3: Apply smart relevance threshold filtering
      // (Removed GPT-4o reranking - Pinecone cosine similarity is optimal)
      const MIN_THRESHOLD = 0.3; // 30% similarity minimum
      const HIGH_QUALITY_THRESHOLD = 0.4; // 40% for high-quality results
      const MAX_RESULTS = 20; // Maximum total results
      const MIN_RESULTS_DESIRED = 5; // Minimum results to show if possible

      // First, filter by minimum threshold and sort by score
      const filteredMatches = searchResults.matches
        .filter((m) => (m.score || 0) >= MIN_THRESHOLD)
        .sort((a, b) => (b.score || 0) - (a.score || 0));

      console.log(
        `[SmartSearch] ${filteredMatches.length} matches above \
${MIN_THRESHOLD} threshold`
      );

      // Apply smart filtering logic
      let relevantMatches = filteredMatches;
      const highQualityCount = filteredMatches
        .filter((m) => (m.score || 0) >= HIGH_QUALITY_THRESHOLD).length;

      if (highQualityCount >= MIN_RESULTS_DESIRED) {
        // If we have 5+ high-quality results, show only those
        // (up to MAX_RESULTS)
        relevantMatches = filteredMatches
          .filter((m) => (m.score || 0) >= HIGH_QUALITY_THRESHOLD)
          .slice(0, MAX_RESULTS);
        console.log(
          `[SmartSearch] Showing ${relevantMatches.length} \
high-quality results (≥40%)`
        );
      } else {
        // Otherwise, show all 40%+ results plus enough 30-40% to
        // reach 5 total
        const highQualityMatches = filteredMatches
          .filter((m) => (m.score || 0) >= HIGH_QUALITY_THRESHOLD);
        const mediumQualityMatches = filteredMatches.filter((m) => {
          const score = m.score || 0;
          return score >= MIN_THRESHOLD && score < HIGH_QUALITY_THRESHOLD;
        });

        const needed = Math.max(
          0,
          MIN_RESULTS_DESIRED - highQualityMatches.length
        );
        // Max 5 medium-quality
        const mediumToInclude = mediumQualityMatches
          .slice(0, Math.min(needed, 5));

        relevantMatches = [...highQualityMatches, ...mediumToInclude]
          .slice(0, MAX_RESULTS);
        console.log(
          `[SmartSearch] Showing ${highQualityMatches.length} \
high-quality + ${mediumToInclude.length} medium-quality results`
        );
      }

      if (relevantMatches.length === 0) {
        return {results: [], searchTime: Date.now() - startTime};
      }

      // Step 4: Batch fetch all unique conversations first
      const db = admin.firestore();
      const uniqueConversationIds = [
        ...new Set(
          relevantMatches.map((m) => m.metadata?.conversationId as string)
        ),
      ].filter(Boolean);

      console.log(`[SmartSearch] Fetching ${uniqueConversationIds.length} \
unique conversations`);

      const conversationsData = await Promise.all(
        uniqueConversationIds.map(async (convId) => {
          try {
            const convDoc = await db.collection("conversations")
              .doc(convId).get();
            return {
              id: convId,
              data: convDoc.exists ? convDoc.data() : null,
            };
          } catch (error) {
            console.error(`Error fetching conversation ${convId}:`, error);
            return {id: convId, data: null};
          }
        })
      );

      // Create lookup map for quick access
      const conversationMap = new Map(
        conversationsData.map((c) => [c.id, c.data])
      );

      // Helper function to build conversation name from participants
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getConversationName = (convData: any): string => {
        if (!convData) return "Unknown Conversation";

        if (convData.isGroup) {
          return convData.groupName || "Group Chat";
        }

        // For direct messages, get other participant's name
        const participantDetails = convData.participantDetails || {};
        const otherParticipants = Object.entries(participantDetails)
          .filter(([id]) => id !== userId)
          .map(([, details]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d = details as any;
            return d?.displayName;
          })
          .filter(Boolean);

        return otherParticipants.join(", ") || "Direct Message";
      };

      // Step 5: Fetch message data from Firestore in parallel
      console.log(`[SmartSearch] Fetching ${relevantMatches.length} messages`);

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

            // Get conversation data from our pre-fetched map
            const convData = conversationMap.get(conversationId);

            // Filter out messages from hidden/deleted conversations
            if (convData) {
              const isDeleted = convData.deleted === true ||
                              (convData.deletedBy &&
                               Array.isArray(convData.deletedBy) &&
                               convData.deletedBy.includes(userId));
              const isHidden = convData.hiddenBy &&
                             Array.isArray(convData.hiddenBy) &&
                             convData.hiddenBy.includes(userId);

              if (isDeleted || isHidden) {
                return null; // Skip this message
              }
            }

            // Note: Deleted messages already filtered by Pinecone
            // (deletedBy array checked in Pinecone query filter)

            // Convert Firestore timestamp to milliseconds
            let timestamp = Date.now();
            if (data.timestamp) {
              if (typeof data.timestamp === "object" &&
                  "toMillis" in data.timestamp) {
                // Firestore Timestamp object
                timestamp = data.timestamp.toMillis();
              } else if (typeof data.timestamp === "object" &&
                         "_seconds" in data.timestamp) {
                // Raw Firestore timestamp from admin SDK
                timestamp = data.timestamp._seconds * 1000;
              } else if (typeof data.timestamp === "number") {
                // Already a number
                timestamp = data.timestamp;
              }
            }

            // Get sender name from participantDetails
            // (convData already fetched above for filtering)
            const participantDetails = convData?.participantDetails || {};
            const senderId = data.senderId || data.sender;
            const senderName = participantDetails[senderId]?.displayName ||
                             data.senderName ||
                             "Unknown";

            return {
              messageId: match.id,
              score: match.score || 0,
              text: data.text as string,
              sender: senderName,
              timestamp,
              conversationId,
              conversationName: getConversationName(convData),
              conversationType: convData?.isGroup ? "group" : "direct",
            } as SearchResult;
          } catch (error) {
            console.error(`Error processing message ${match.id}:`, error);
            return null;
          }
        })
      );

      const validMessages = messages.filter(Boolean) as SearchResult[];

      // Step 6a: Smart Q&A matching - if high-scoring result is a question,
      // include the answer
      const qaContextMessages = await fetchQAContext(
        db,
        validMessages,
        conversationMap,
        userId,
        getConversationName
      );

      // Step 6b: Smart context filtering - only fetch if <3 high-quality
      // results
      const highQualityResultCount = validMessages
        .filter((m) => m.score >= 0.5).length;
      const shouldFetchContext = highQualityResultCount < 3;

      let contextMessages: SearchResult[] = [];
      if (shouldFetchContext) {
        console.log(
          `[SmartSearch] Only ${highQualityResultCount} high-quality results, \
fetching context...`
        );
        contextMessages = await fetchContextMessages(
          db,
          validMessages,
          conversationMap,
          userId,
          getConversationName,
          query // Pass query for relevance validation
        );
      } else {
        console.log(
          `[SmartSearch] ${highQualityResultCount} high-quality results, \
skipping context fetch`
        );
      }

      // Merge and deduplicate results (Q&A context + regular context)
      const allMessages = [
        ...validMessages,
        ...qaContextMessages,
        ...contextMessages,
      ];
      const uniqueMessages = Array.from(
        new Map(allMessages.map((m) => [m.messageId, m])).values()
      );

      // Sort by conversation, then by timestamp within conversation
      const sortedResults = uniqueMessages.sort((a, b) => {
        if (a.conversationId !== b.conversationId) {
          // Sort conversations by highest score within them
          const aMaxScore = Math.max(
            ...uniqueMessages
              .filter((m) => m.conversationId === a.conversationId &&
                            !m.isContext)
              .map((m) => m.score)
          );
          const bMaxScore = Math.max(
            ...uniqueMessages
              .filter((m) => m.conversationId === b.conversationId &&
                            !m.isContext)
              .map((m) => m.score)
          );
          return bMaxScore - aMaxScore;
        }
        // Within same conversation, sort by timestamp
        return a.timestamp - b.timestamp;
      });

      const totalTime = Date.now() - startTime;

      console.log(
        `[SmartSearch] Returning ${validMessages.length} results + \
${qaContextMessages.length} Q&A answers + \
${contextMessages.length} context messages in ${totalTime}ms`
      );

      return {
        results: sortedResults,
        searchTime: totalTime,
      };
    });

    return results;
  } catch (error) {
    console.error("Smart search error:", error);
    throw new HttpsError("internal", "Failed to perform search");
  }
});

/**
 * Fetch Q&A context - if a high-scoring result is a question,
 * include the answer as a context result
 * @param {FirebaseFirestore.Firestore} db - Firestore database
 * @param {SearchResult[]} results - Search results
 * @param {Map} conversationMap - Map of conversation data
 * @param {string} userId - User ID
 * @param {Function} getConversationName - Function to get conversation name
 * @return {Promise<SearchResult[]>} Answer messages
 */
async function fetchQAContext(
  db: admin.firestore.Firestore,
  results: SearchResult[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversationMap: Map<string, any>,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getConversationName: (convData: any) => string
): Promise<SearchResult[]> {
  const QA_THRESHOLD = 0.6; // 60% - high-scoring results
  const MAX_QA_PAIRS = 3; // Max Q&A pairs to include

  // Question indicators
  const isQuestion = (text: string): boolean => {
    const lowerText = text.toLowerCase().trim();
    return (
      lowerText.includes("?") ||
      lowerText.startsWith("can you") ||
      lowerText.startsWith("could you") ||
      lowerText.startsWith("will you") ||
      lowerText.startsWith("would you") ||
      lowerText.startsWith("who") ||
      lowerText.startsWith("what") ||
      lowerText.startsWith("when") ||
      lowerText.startsWith("where") ||
      lowerText.startsWith("why") ||
      lowerText.startsWith("how") ||
      lowerText.includes("can you ") ||
      lowerText.includes("could you ") ||
      lowerText.includes("will you ")
    );
  };

  // Filter for high-scoring questions
  const questionResults = results
    .filter((r) => r.score >= QA_THRESHOLD && isQuestion(r.text))
    .slice(0, MAX_QA_PAIRS);

  if (questionResults.length === 0) {
    return [];
  }

  console.log(
    `[Q&A Context] Found ${questionResults.length} questions, \
fetching answers...`
  );

  const qaStartTime = Date.now();
  const answerMessages: SearchResult[] = [];
  const seenMessageIds = new Set(results.map((r) => r.messageId));

  // For each question, fetch the next 1-2 messages as potential answers
  for (const questionResult of questionResults) {
    try {
      const conversationId = questionResult.conversationId;

      // ⚡ OPTIMIZATION: Instead of fetching ALL messages, use a targeted query
      // Fetch messages AFTER the question timestamp (limit to next 3 messages)
      const messagesSnapshot = await db
        .collection(`conversations/${conversationId}/messages`)
        .orderBy("timestamp", "asc")
        .startAfter(questionResult.timestamp)
        .limit(3) // Only fetch next 2-3 messages (the answers)
        .get();

      interface MessageDoc {
        id: string;
        text?: string;
        senderId?: string;
        sender?: string;
        senderName?: string;
        deletedBy?: string[];
        timestamp?: {
          toMillis?: () => number;
          _seconds?: number;
        } | number;
      }

      const answerCandidates = messagesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MessageDoc[];

      const convData = conversationMap.get(conversationId);
      const participantDetails = convData?.participantDetails || {};

      // Convert answer messages to SearchResult format
      for (const msg of answerCandidates) {
        // Skip if already in results or deleted by user
        const deletedBy = msg.deletedBy || [];
        if (seenMessageIds.has(msg.id) || deletedBy.includes(userId)) {
          continue;
        }

        // Convert timestamp
        let timestamp = Date.now();
        if (msg.timestamp) {
          if (typeof msg.timestamp === "object" &&
              "toMillis" in msg.timestamp &&
              msg.timestamp.toMillis) {
            timestamp = msg.timestamp.toMillis();
          } else if (
            typeof msg.timestamp === "object" &&
            "_seconds" in msg.timestamp &&
            msg.timestamp._seconds
          ) {
            timestamp = msg.timestamp._seconds * 1000;
          } else if (typeof msg.timestamp === "number") {
            timestamp = msg.timestamp;
          }
        }

        const senderId = msg.senderId || msg.sender || "";
        const senderName = participantDetails[senderId]?.displayName ||
          msg.senderName ||
          "Unknown";

        answerMessages.push({
          messageId: msg.id,
          score: 0, // Answers don't have relevance scores
          text: msg.text || "",
          sender: senderName,
          timestamp,
          conversationId,
          conversationName: getConversationName(convData),
          conversationType: convData?.isGroup ? "group" : "direct",
          isContext: true, // Mark as context (answer to question)
        });

        seenMessageIds.add(msg.id);
      }
    } catch (error) {
      console.error(
        `[Q&A Context] Error fetching answers for question \
${questionResult.messageId}:`,
        error
      );
    }
  }

  console.log(
    `[Q&A Context] Returning ${answerMessages.length} answer messages \
in ${Date.now() - qaStartTime}ms`
  );
  return answerMessages;
}

/**
 * Fetch surrounding context messages for high-scoring results
 * For results with score > 40%, fetch 2-3 messages before and after
 * Only fetch context if <3 high-quality results (>50% score)
 * Validate context relevance using keyword overlap
 * @param {FirebaseFirestore.Firestore} db - Firestore database
 * @param {SearchResult[]} results - Search results
 * @param {Map} conversationMap - Map of conversation data
 * @param {string} userId - User ID
 * @param {Function} getConversationName - Function to get conversation name
 * @param {string} query - Original search query for relevance validation
 * @return {Promise<SearchResult[]>} Context messages
 */
async function fetchContextMessages(
  db: admin.firestore.Firestore,
  results: SearchResult[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversationMap: Map<string, any>,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getConversationName: (convData: any) => string,
  query: string
): Promise<SearchResult[]> {
  const CONTEXT_THRESHOLD = 0.4; // 40% - only for high-quality results
  const CONTEXT_BEFORE = 2;
  const CONTEXT_AFTER = 3;
  const MAX_CONTEXT_MESSAGES = 3; // Global limit on context messages
  const MIN_RELEVANCE = 0.25; // 25% keyword overlap for context to be relevant

  const highScoringResults = results
    .filter((r) => r.score >= CONTEXT_THRESHOLD);

  if (highScoringResults.length === 0) {
    return [];
  }

  console.log(
    `[Context] Fetching context for ${highScoringResults.length} \
high-scoring results (max ${MAX_CONTEXT_MESSAGES} context messages)`
  );

  const contextStartTime = Date.now();

  // Helper function to check if context text is relevant to query
  const isContextRelevant = (contextText: string, searchQuery: string):
    boolean => {
    const queryWords = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3); // Only words >3 chars

    if (queryWords.length === 0) return true; // No meaningful words, include

    const contextLower = contextText.toLowerCase();
    const matchCount = queryWords
      .filter((word) => contextLower.includes(word)).length;
    const relevanceScore = matchCount / queryWords.length;

    return relevanceScore >= MIN_RELEVANCE;
  };

  // Group by conversation for batch fetching
  const byConversation = new Map<string, SearchResult[]>();
  highScoringResults.forEach((result) => {
    const existing = byConversation.get(result.conversationId) || [];
    existing.push(result);
    byConversation.set(result.conversationId, existing);
  });

  const contextMessages: SearchResult[] = [];
  const seenMessageIds = new Set(results.map((r) => r.messageId));

  // Fetch context messages for each conversation
  // Only fetch for the TOP result per conversation to limit context
  for (const [conversationId, convResults] of byConversation) {
    try {
      // Pick the highest-scoring result from this conversation
      const topResult = convResults
        .sort((a, b) => b.score - a.score)[0];

      // ⚡ OPTIMIZATION: Instead of fetching ALL messages, fetch targeted range
      // Fetch messages BEFORE the result (limit to 2 messages)
      const beforeSnapshot = await db
        .collection(`conversations/${conversationId}/messages`)
        .orderBy("timestamp", "desc") // Descending for "before" query
        .startAfter(topResult.timestamp)
        .limit(CONTEXT_BEFORE)
        .get();

      // Fetch messages AFTER the result (limit to 3 messages)
      const afterSnapshot = await db
        .collection(`conversations/${conversationId}/messages`)
        .orderBy("timestamp", "asc")
        .startAfter(topResult.timestamp)
        .limit(CONTEXT_AFTER)
        .get();

      // Define message type for better type safety
      interface MessageDoc {
        id: string;
        text?: string;
        senderId?: string;
        sender?: string;
        senderName?: string;
        deletedBy?: string[];
        timestamp?: {
          toMillis?: () => number;
          _seconds?: number;
        } | number;
      }

      // Combine before (reverse order) and after messages
      const beforeMessages = beforeSnapshot.docs
        .map((doc) => ({id: doc.id, ...doc.data()}))
        .reverse(); // Reverse to chronological order
      const afterMessages = afterSnapshot.docs
        .map((doc) => ({id: doc.id, ...doc.data()}));
      const surroundingMessages = [
        ...beforeMessages,
        ...afterMessages,
      ] as MessageDoc[];

      const convData = conversationMap.get(conversationId);
      const participantDetails = convData?.participantDetails || {};

      // Convert to SearchResult format with relevance validation
      const candidateContextMessages: SearchResult[] = [];
      for (const msg of surroundingMessages) {
        // Skip if already in results or deleted by user
        const deletedBy = msg.deletedBy || [];
        if (seenMessageIds.has(msg.id) || deletedBy.includes(userId)) {
          continue;
        }

        const msgText = msg.text || "";

        // Validate relevance using keyword overlap
        if (!isContextRelevant(msgText, query)) {
          console.log(`[Context] Skipping irrelevant context: "${
            msgText.substring(0, 50)}..."`);
          continue;
        }

        // Convert timestamp
        let timestamp = Date.now();
        if (msg.timestamp) {
          if (typeof msg.timestamp === "object" &&
              "toMillis" in msg.timestamp &&
              msg.timestamp.toMillis) {
            timestamp = msg.timestamp.toMillis();
          } else if (
            typeof msg.timestamp === "object" &&
            "_seconds" in msg.timestamp &&
            msg.timestamp._seconds
          ) {
            timestamp = msg.timestamp._seconds * 1000;
          } else if (typeof msg.timestamp === "number") {
            timestamp = msg.timestamp;
          }
        }

        const senderId = msg.senderId || msg.sender || "";
        const senderName = participantDetails[senderId]?.displayName ||
          msg.senderName ||
          "Unknown";

        candidateContextMessages.push({
          messageId: msg.id,
          score: 0, // Context messages don't have relevance scores
          text: msgText,
          sender: senderName,
          timestamp,
          conversationId,
          conversationName: getConversationName(convData),
          conversationType: convData?.isGroup ? "group" : "direct",
          isContext: true, // Mark as context message
        });

        seenMessageIds.add(msg.id);
      }

      // Limit context messages per conversation (take best 2)
      const limitedContext = candidateContextMessages.slice(0, 2);
      contextMessages.push(...limitedContext);

      // Stop if we've reached the global limit
      if (contextMessages.length >= MAX_CONTEXT_MESSAGES) {
        console.log(
          `[Context] Reached global limit of ${MAX_CONTEXT_MESSAGES} \
context messages`
        );
        break;
      }
    } catch (error) {
      console.error(
        `[Context] Error fetching context for conversation \
${conversationId}:`,
        error
      );
    }
  }

  console.log(
    `[Context] Returning ${contextMessages.length} relevant context messages \
in ${Date.now() - contextStartTime}ms`
  );
  return contextMessages.slice(0, MAX_CONTEXT_MESSAGES);
}
