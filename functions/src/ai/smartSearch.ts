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

            // Get conversation data for this message
            const convData = conversationMap.get(conversationId);

            // Get sender name from participantDetails
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

      // Step 6: Fetch surrounding context messages for high-scoring results
      console.log(
        "[SmartSearch] Fetching context messages for high-scoring results"
      );
      const contextMessages = await fetchContextMessages(
        db,
        validMessages,
        conversationMap,
        userId,
        getConversationName
      );

      // Merge and deduplicate results
      const allMessages = [...validMessages, ...contextMessages];
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

      console.log(`[SmartSearch] Returning ${validMessages.length} results + \
${contextMessages.length} context messages in ${totalTime}ms`);

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
 * Fetch surrounding context messages for high-scoring results
 * For results with score > 40%, fetch 2-3 messages before and after
 * @param {FirebaseFirestore.Firestore} db - Firestore database
 * @param {SearchResult[]} results - Search results
 * @param {Map} conversationMap - Map of conversation data
 * @param {string} userId - User ID
 * @param {Function} getConversationName - Function to get conversation name
 * @return {Promise<SearchResult[]>} Context messages
 */
async function fetchContextMessages(
  db: admin.firestore.Firestore,
  results: SearchResult[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversationMap: Map<string, any>,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getConversationName: (convData: any) => string
): Promise<SearchResult[]> {
  const CONTEXT_THRESHOLD = 0.4; // 40% - only for high-quality results
  const CONTEXT_BEFORE = 2;
  const CONTEXT_AFTER = 3;

  const highScoringResults = results
    .filter((r) => r.score >= CONTEXT_THRESHOLD);

  if (highScoringResults.length === 0) {
    return [];
  }

  console.log(
    `[Context] Fetching context for ${highScoringResults.length} \
high-scoring results`
  );

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
  for (const [conversationId, convResults] of byConversation) {
    try {
      // Fetch all messages from this conversation, ordered by timestamp
      const messagesSnapshot = await db
        .collection(`conversations/${conversationId}/messages`)
        .orderBy("timestamp", "asc")
        .get();

      const allMessages = messagesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const convData = conversationMap.get(conversationId);
      const participantDetails = convData?.participantDetails || {};

      // For each high-scoring result, find surrounding messages
      for (const result of convResults) {
        const resultIndex = allMessages
          .findIndex((m) => m.id === result.messageId);
        if (resultIndex === -1) continue;

        // Get surrounding messages
        const startIndex = Math.max(0, resultIndex - CONTEXT_BEFORE);
        const endIndex = Math.min(
          allMessages.length,
          resultIndex + CONTEXT_AFTER + 1
        );
        const surroundingMessages = allMessages
          .slice(startIndex, endIndex);

        // Convert to SearchResult format
        for (const msg of surroundingMessages) {
          // Skip if already in results or deleted by user
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const deletedBy = (msg as any).deletedBy || [];
          if (seenMessageIds.has(msg.id) || deletedBy.includes(userId)) {
            continue;
          }

          // Convert timestamp
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let timestamp = Date.now();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((msg as any).timestamp) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof (msg as any).timestamp === "object" &&
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                "toMillis" in (msg as any).timestamp) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              timestamp = (msg as any).timestamp.toMillis();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } else if (
              typeof (msg as any).timestamp === "object" &&
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              "_seconds" in (msg as any).timestamp
            ) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              timestamp = (msg as any).timestamp._seconds * 1000;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } else if (typeof (msg as any).timestamp === "number") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              timestamp = (msg as any).timestamp;
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const senderId = (msg as any).senderId || (msg as any).sender;
          const senderName = participantDetails[senderId]?.displayName ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (msg as any).senderName ||
            "Unknown";

          contextMessages.push({
            messageId: msg.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            score: 0, // Context messages don't have relevance scores
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            text: (msg as any).text as string,
            sender: senderName,
            timestamp,
            conversationId,
            conversationName: getConversationName(convData),
            conversationType: convData?.isGroup ? "group" : "direct",
            isContext: true, // Mark as context message
          });

          seenMessageIds.add(msg.id);
        }
      }
    } catch (error) {
      console.error(
        `[Context] Error fetching context for conversation \
${conversationId}:`,
        error
      );
    }
  }

  console.log(`[Context] Fetched ${contextMessages.length} context messages`);
  return contextMessages;
}
