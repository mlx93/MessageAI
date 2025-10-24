import * as admin from "firebase-admin";

/**
 * Enhanced Caching Utility for MessageAI
 *
 * Features:
 * - Longer TTLs for different types of content
 * - Request batching to reduce API calls
 * - Smart cache invalidation
 * - Cost optimization through aggressive caching
 */

/**
 * Cache entry with metadata and TTL
 * @template T - Type of cached value
 */
interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  cacheType: "ai_response" | "search_result" | "summary" |
    "action_items" | "decisions";
}

/**
 * Enhanced cache class with TTL and access tracking
 */
class EnhancedCache {
  private db = admin.firestore();
  private readonly MAX_BATCH_SIZE = 10;

  /**
   * Get TTL in minutes based on cache type
   * @param {string} cacheType - Type of cache entry
   * @return {number} TTL in minutes
   */
  private getTTL(cacheType: CacheEntry<unknown>["cacheType"]): number {
    switch (cacheType) {
    case "ai_response":
      return 15; // 15 minutes for AI responses
    case "search_result":
      return 30; // 30 minutes for search results
    case "summary":
      return 60; // 1 hour for summaries (they don't change often)
    case "action_items":
      return 10; // 10 minutes for action items (more dynamic)
    case "decisions":
      return 120; // 2 hours for decisions (rarely change)
    default:
      return 15;
    }
  }

  /**
   * Enhanced cache with longer TTLs and access tracking
   * @template T - Type of cached value
   * @param {string} cacheKey - Cache key
   * @param {string} cacheType - Type of cache
   * @param {Function} generator - Function to generate value
   * @param {number} customTTL - Optional custom TTL
   * @return {Promise<T>} Cached or generated value
   */
  async get<T>(
    cacheKey: string,
    cacheType: CacheEntry<T>["cacheType"],
    generator: () => Promise<T>,
    customTTL?: number
  ): Promise<T> {
    const ttlMinutes = customTTL || this.getTTL(cacheType);
    const cacheRef = this.db.collection("ai_cache").doc(cacheKey);

    try {
      // Try to get from cache
      const cached = await cacheRef.get();

      if (cached.exists) {
        const data = cached.data() as CacheEntry<T>;

        // Check if not expired
        if (data.expiresAt > Date.now()) {
          // Update access tracking
          await cacheRef.update({
            accessCount: admin.firestore.FieldValue.increment(1),
            lastAccessed: Date.now(),
          });

          console.log(`Cache hit: ${cacheKey} (${cacheType})`);
          return data.value;
        } else {
          // Expired, delete it
          await cacheRef.delete();
        }
      }
    } catch (error) {
      console.warn("Cache read error:", error);
    }

    // Cache miss - generate new value
    console.log(`Cache miss: ${cacheKey} (${cacheType})`);
    const value = await generator();

    // Store in cache
    try {
      await cacheRef.set({
        value,
        createdAt: Date.now(),
        expiresAt: Date.now() + (ttlMinutes * 60 * 1000),
        accessCount: 1,
        lastAccessed: Date.now(),
        cacheType,
      });
    } catch (error) {
      console.warn("Cache write error:", error);
    }

    return value;
  }

  /**
   * Batch multiple cache requests to reduce API calls
   * @template T - Type of cached values
   * @param {Array} requests - Array of cache requests
   * @return {Promise<T[]>} Array of cached/generated values
   */
  async getBatch<T>(
    requests: Array<{
      key: string;
      generator: () => Promise<T>;
      cacheType: CacheEntry<T>["cacheType"];
      priority?: "high" | "medium" | "low";
    }>
  ): Promise<T[]> {
    // Sort by priority
    const sortedRequests = requests.sort((a, b) => {
      const priorityOrder = {high: 3, medium: 2, low: 1};
      const aPriority = a.priority || "medium";
      const bPriority = b.priority || "medium";
      return priorityOrder[bPriority] - priorityOrder[aPriority];
    });

    // Process in batches
    const results: T[] = [];
    const batchSize = this.MAX_BATCH_SIZE;

    for (let i = 0; i < sortedRequests.length; i += batchSize) {
      const batch = sortedRequests.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((req) => this.get(req.key, req.cacheType, req.generator))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Smart cache invalidation based on patterns
   * @param {string} pattern - Pattern to match cache keys
   * @return {Promise<void>}
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const cacheRef = this.db.collection("ai_cache");
      const snapshot = await cacheRef.where("__name__", ">=", pattern).get();

      const batch = this.db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      if (snapshot.docs.length > 0) {
        await batch.commit();
        const msg = `Invalidated ${snapshot.docs.length} cache entries`;
        console.log(`${msg} matching pattern: ${pattern}`);
      }
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  }

  /**
   * Invalidate cache for a specific conversation
   * @param {string} conversationId - Conversation ID
   * @return {Promise<void>}
   */
  async invalidateConversation(conversationId: string): Promise<void> {
    await this.invalidatePattern(`summary_${conversationId}`);
    await this.invalidatePattern(`actions_${conversationId}`);
    await this.invalidatePattern(`decisions_${conversationId}`);
    await this.invalidatePattern(`search_${conversationId}`);
  }

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    hitRate: number;
    mostAccessed: Array<{key: string; accessCount: number}>;
    expiredEntries: number;
  }> {
    try {
      const snapshot = await this.db.collection("ai_cache").get();
      const now = Date.now();

      let totalAccessCount = 0;
      let expiredCount = 0;
      const entries: Array<{key: string; accessCount: number}> = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as CacheEntry<unknown>;
        totalAccessCount += data.accessCount;

        if (data.expiresAt < now) {
          expiredCount++;
        } else {
          entries.push({
            key: doc.id,
            accessCount: data.accessCount,
          });
        }
      });

      // Sort by access count
      entries.sort((a, b) => b.accessCount - a.accessCount);

      return {
        totalEntries: snapshot.size,
        hitRate: snapshot.size > 0 ? totalAccessCount / snapshot.size : 0,
        mostAccessed: entries.slice(0, 10),
        expiredEntries: expiredCount,
      };
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return {
        totalEntries: 0,
        hitRate: 0,
        mostAccessed: [],
        expiredEntries: 0,
      };
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanupExpired(): Promise<number> {
    try {
      const now = Date.now();
      const snapshot = await this.db
        .collection("ai_cache")
        .where("expiresAt", "<", now)
        .limit(100) // Process in batches
        .get();

      if (snapshot.empty) {
        return 0;
      }

      const batch = this.db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Cleaned up ${snapshot.size} expired cache entries`);
      return snapshot.size;
    } catch (error) {
      console.error("Cache cleanup error:", error);
      return 0;
    }
  }

  /**
   * Preload common queries
   * @param {string} conversationId - Conversation ID
   * @return {Promise<void>}
   */
  async preloadCommonQueries(conversationId: string): Promise<void> {
    // Placeholder for preloading common search queries
    console.log(`Preloading common queries for ${conversationId}`);
  }
}

// Export singleton instance
export const enhancedCache = new EnhancedCache();

/**
 * Wrapper functions for common cache patterns
 */

/**
 * Cache AI responses with longer TTL
 * @template T - Type of response
 * @param {string} key - Cache key
 * @param {Function} generator - Function to generate response
 * @param {number} customTTL - Optional custom TTL in minutes
 * @return {Promise<T>} Cached or generated response
 */
export async function cacheAIResponse<T>(
  key: string,
  generator: () => Promise<T>,
  customTTL?: number
): Promise<T> {
  return enhancedCache.get(key, "ai_response", generator, customTTL);
}

/**
 * Cache search results with medium TTL
 * @template T - Type of search result
 * @param {string} key - Cache key
 * @param {Function} generator - Function to generate results
 * @return {Promise<T>} Cached or generated results
 */
export async function cacheSearchResult<T>(
  key: string,
  generator: () => Promise<T>
): Promise<T> {
  return enhancedCache.get(key, "search_result", generator);
}

/**
 * Cache summaries with long TTL
 * @template T - Type of summary
 * @param {string} key - Cache key
 * @param {Function} generator - Function to generate summary
 * @return {Promise<T>} Cached or generated summary
 */
export async function cacheSummary<T>(
  key: string,
  generator: () => Promise<T>
): Promise<T> {
  return enhancedCache.get(key, "summary", generator);
}

/**
 * Cache action items with short TTL
 * @template T - Type of action items
 * @param {string} key - Cache key
 * @param {Function} generator - Function to generate action items
 * @return {Promise<T>} Cached or generated action items
 */
export async function cacheActionItems<T>(
  key: string,
  generator: () => Promise<T>
): Promise<T> {
  return enhancedCache.get(key, "action_items", generator);
}

/**
 * Cache decisions with very long TTL
 * @template T - Type of decisions
 * @param {string} key - Cache key
 * @param {Function} generator - Function to generate decisions
 * @return {Promise<T>} Cached or generated decisions
 */
export async function cacheDecisions<T>(
  key: string,
  generator: () => Promise<T>
): Promise<T> {
  return enhancedCache.get(key, "decisions", generator);
}

export default enhancedCache;
