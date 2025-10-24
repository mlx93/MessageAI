import { getCachedMessagesPaginated, getCachedMessagesBefore } from './sqliteService';
import { loadOlderMessages } from './messageService';
import { Message } from '../types';

interface PreloadConfig {
  conversationId: string;
  currentMessages: Message[];
  scrollPosition: number;
  totalHeight: number;
}

interface PreloadResult {
  olderMessages: Message[];
  newerMessages: Message[];
  cacheHit: boolean;
}

/**
 * Smart preloading service for anticipatory caching
 * Predicts what messages the user might need next
 */
export class PreloadService {
  private preloadCache = new Map<string, Message[]>();
  private preloadPromises = new Map<string, Promise<PreloadResult>>();
  
  /**
   * Preload messages based on user behavior patterns
   */
  async preloadMessages(config: PreloadConfig): Promise<PreloadResult> {
    const { conversationId, currentMessages, scrollPosition, totalHeight } = config;
    
    // Check if we already have a preload in progress
    const existingPromise = this.preloadPromises.get(conversationId);
    if (existingPromise) {
      return existingPromise;
    }
    
    const preloadPromise = this._performPreload(config);
    this.preloadPromises.set(conversationId, preloadPromise);
    
    try {
      const result = await preloadPromise;
      return result;
    } finally {
      this.preloadPromises.delete(conversationId);
    }
  }
  
  private async _performPreload(config: PreloadConfig): Promise<PreloadResult> {
    const { conversationId, currentMessages, scrollPosition, totalHeight } = config;
    
    // Calculate scroll percentage
    const scrollPercentage = totalHeight > 0 ? scrollPosition / totalHeight : 0;
    
    // Determine what to preload based on scroll position
    const shouldPreloadOlder = scrollPercentage < 0.3; // User is near top
    const shouldPreloadNewer = scrollPercentage > 0.7; // User is near bottom
    
    const result: PreloadResult = {
      olderMessages: [],
      newerMessages: [],
      cacheHit: false
    };
    
    try {
      // Preload older messages if user is scrolling up
      if (shouldPreloadOlder && currentMessages && currentMessages.length > 0) {
        const oldestMessage = currentMessages[0];
        if (oldestMessage && oldestMessage.timestamp) {
          const beforeTimestamp = oldestMessage.timestamp;
          
          // Try cache first
          const cachedOlder = await getCachedMessagesBefore(conversationId, beforeTimestamp, 20);
          if (cachedOlder && cachedOlder.length > 0) {
            result.olderMessages = cachedOlder;
            result.cacheHit = true;
            console.log(`🎯 Preload: Cache hit for older messages (${cachedOlder.length})`);
          } else {
            // Preload from Firestore in background
            const firestoreOlder = await loadOlderMessages(conversationId, beforeTimestamp, 20);
            if (firestoreOlder && firestoreOlder.length > 0) {
              result.olderMessages = firestoreOlder;
              console.log(`🎯 Preload: Loaded ${firestoreOlder.length} older messages from Firestore`);
            }
          }
        }
      }
      
      // Preload newer messages if user is scrolling down
      if (shouldPreloadNewer && currentMessages && currentMessages.length > 0) {
        const newestMessage = currentMessages[currentMessages.length - 1];
        if (newestMessage && newestMessage.timestamp) {
          const afterTimestamp = newestMessage.timestamp;
        
        // For newer messages, we'd typically wait for real-time updates
        // But we can preload any cached messages that might be newer
        const cachedNewer = await getCachedMessagesPaginated(conversationId, 10);
        const newerThanCurrent = cachedNewer && cachedNewer.length > 0 
          ? cachedNewer.filter(msg => msg.timestamp > afterTimestamp)
          : [];
        
        if (newerThanCurrent.length > 0) {
          result.newerMessages = newerThanCurrent;
          result.cacheHit = true;
          console.log(`🎯 Preload: Cache hit for newer messages (${newerThanCurrent.length})`);
        }
        }
      }
      
    } catch (error) {
      console.warn('Preload failed:', error);
    }
    
    return result;
  }
  
  /**
   * Warm up cache for conversations user is likely to visit
   */
  async warmupConversations(conversationIds: string[]): Promise<void> {
    const warmupPromises = conversationIds.map(async (id) => {
      try {
        // Preload recent messages for each conversation
        const messages = await getCachedMessagesPaginated(id, 15);
        this.preloadCache.set(id, messages);
        console.log(`🔥 Cache warmup: ${id} (${messages.length} messages)`);
      } catch (error) {
        console.warn(`Cache warmup failed for ${id}:`, error);
      }
    });
    
    await Promise.allSettled(warmupPromises);
  }
  
  /**
   * Get preloaded messages for a conversation
   */
  getPreloadedMessages(conversationId: string): Message[] {
    return this.preloadCache.get(conversationId) || [];
  }
  
  /**
   * Clear preload cache to free memory
   */
  clearCache(): void {
    this.preloadCache.clear();
    this.preloadPromises.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { conversations: number; totalMessages: number } {
    let totalMessages = 0;
    this.preloadCache.forEach(messages => {
      totalMessages += messages.length;
    });
    
    return {
      conversations: this.preloadCache.size,
      totalMessages
    };
  }
}

// Singleton instance
export const preloadService = new PreloadService();
