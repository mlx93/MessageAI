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

      // Step 3: Filter by relevance threshold and sort by score
      // (Removed GPT-4o reranking - Pinecone cosine similarity is optimal)
      const RELEVANCE_THRESHOLD = 0.3; // 30% similarity minimum
      const relevantMatches = searchResults.matches
        .filter((m) => (m.score || 0) >= RELEVANCE_THRESHOLD)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 20); // Return top 20 results (increased from 5)

      console.log(`[SmartSearch] ${relevantMatches.length} matches above \
${RELEVANCE_THRESHOLD} threshold`);

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
      const totalTime = Date.now() - startTime;

      console.log(`[SmartSearch] Returning ${validMessages.length} results \
in ${totalTime}ms`);

      return {
        results: validMessages,
        searchTime: totalTime,
      };
    });

    return results;
  } catch (error) {
    console.error("Smart search error:", error);
    throw new HttpsError("internal", "Failed to perform search");
  }
});
