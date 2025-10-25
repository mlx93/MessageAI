import {onCall, HttpsError} from "firebase-functions/v2/https";
import {openai} from "@ai-sdk/openai";
import {generateText} from "ai";
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
      // Step 1: Generate query embedding
      const openaiClient = getOpenAIClient();
      const embeddingResponse = await openaiClient.embeddings.create({
        model: "text-embedding-3-large",
        input: query,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      // Step 2: Search Pinecone
      const index = getIndex();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pineconeFilters: any = {
        // Filter by participants array to show ALL messages
        // from user's conversations
        participants: {$in: [userId]},
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

      const searchResults = await index.query({
        vector: queryEmbedding,
        topK: 20,
        filter: pineconeFilters,
        includeMetadata: true,
      });

      if (searchResults.matches.length === 0) {
        return {results: [], searchTime: Date.now()};
      }

      // Step 3: Rerank with GPT-4o
      const reranked = await generateText({
        model: openai("gpt-4o"),
        prompt: `You are a search result ranker. \
Rank these message results by relevance.
Return only the top 5 most relevant message IDs in order, \
one per line.

Query: "${query}"

Results:
${searchResults.matches.map((m, i) =>
    `[${i}] ID: ${m.id}, Score: ${m.score?.toFixed(3)}, \
Text: ${m.metadata?.text}`
  ).join("\n")}

Return format: Just the IDs, one per line \
(no brackets, no other text).`,
      });

      const rankedIds = reranked.text.trim().split("\n")
        .filter(Boolean).slice(0, 5);

      // Step 4: Get full message data from Firestore
      const db = admin.firestore();
      const messages = await Promise.all(
        rankedIds.map(async (id) => {
          // Messages are in conversations/{convId}/messages/{msgId}
          // We can get conversationId from the metadata
          const match = searchResults.matches.find((m) => m.id === id);
          if (!match || !match.metadata) return null;

          const conversationId = match.metadata.conversationId as string;
          const doc = await db
            .collection(`conversations/${conversationId}/messages`)
            .doc(id)
            .get();

          if (!doc.exists) return null;

          const data = doc.data();
          if (!data) return null;

          // Filter out messages deleted by this user
          const deletedBy = data.deletedBy || [];
          if (deletedBy.includes(userId)) return null;

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

          return {
            messageId: id,
            score: match?.score || 0,
            text: data.text as string,
            sender: data.senderName || data.sender || "Unknown",
            timestamp,
            conversationId: conversationId,
          } as SearchResult;
        })
      );

      return {
        results: messages.filter(Boolean),
        searchTime: Date.now(),
      };
    });

    return results;
  } catch (error) {
    console.error("Smart search error:", error);
    throw new HttpsError("internal", "Failed to perform search");
  }
});
