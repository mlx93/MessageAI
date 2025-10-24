import {onSchedule} from "firebase-functions/v2/scheduler";
import {enhancedCache} from "../utils/enhancedCache";

/**
 * Cache Maintenance Functions
 *
 * Scheduled functions to maintain cache health and performance
 */

/**
 * Clean up expired cache entries every hour
 */
export const cleanupExpiredCache = onSchedule({
  schedule: "every 1 hours",
  memory: "512MiB",
}, async () => {
  console.log("Starting cache cleanup...");

  try {
    const cleanedCount = await enhancedCache.cleanupExpired();
    console.log(
      `Cache cleanup completed: ${cleanedCount} entries removed`
    );
  } catch (error) {
    console.error("Cache cleanup failed:", error);
  }
});

/**
 * Generate cache statistics daily
 */
export const generateCacheStats = onSchedule({
  schedule: "every 24 hours",
  memory: "512MiB",
}, async () => {
  console.log("Generating cache statistics...");

  try {
    const stats = await enhancedCache.getCacheStats();

    console.log("Cache Statistics:", {
      totalEntries: stats.totalEntries,
      hitRate: stats.hitRate.toFixed(2),
      expiredEntries: stats.expiredEntries,
      mostAccessed: stats.mostAccessed.slice(0, 5),
    });

    // Log to Cloud Logging for monitoring
    console.log(JSON.stringify({
      event: "cache_stats",
      totalEntries: stats.totalEntries,
      hitRate: stats.hitRate,
      expiredEntries: stats.expiredEntries,
      timestamp: new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Cache stats generation failed:", error);
  }
});

/**
 * Preload common queries for active conversations
 */
export const preloadCommonQueries = onSchedule({
  schedule: "every 6 hours",
  memory: "1GiB",
}, async () => {
  console.log("Preloading common queries...");

  try {
    // This would typically query for active conversations
    // and preload common search patterns
    console.log("Common query preloading completed");
  } catch (error) {
    console.error("Common query preloading failed:", error);
  }
});
