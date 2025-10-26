import { getCachedMessagesPaginated } from './sqliteService';
import { subscribeToMessagesPaginated } from './messageService';
import { cacheMessage } from './sqliteService';
import { Message } from '../types';

interface BackgroundSyncConfig {
  conversationId: string;
  userId?: string; // NEW: Store userId for filtering
  lastSyncTime: Date;
  syncInterval: number; // milliseconds
}

interface SyncResult {
  newMessages: Message[];
  updatedMessages: Message[];
  syncTime: Date;
}

/**
 * Background sync service for offline-first messaging
 * Handles syncing messages when app comes back to foreground
 */
export class BackgroundSyncService {
  private syncConfigs = new Map<string, BackgroundSyncConfig>();
  private syncTimeouts = new Map<string, NodeJS.Timeout>();
  private isAppInForeground = true;
  
  /**
   * Start background sync for a conversation
   * userId is required to filter deleted messages
   */
  startSync(conversationId: string, syncInterval: number = 30000, userId?: string): void {
    // Prevent rapid start/stop cycles - check if already running
    if (this.syncConfigs.has(conversationId)) {
      const existingConfig = this.syncConfigs.get(conversationId)!;
      // If same interval and userId, don't restart
      if (existingConfig.syncInterval === syncInterval && existingConfig.userId === userId) {
        console.log(`⏭️ Background sync already running for ${conversationId} - skipping restart`);
        return;
      }
      // Different config - stop old one first
      this.stopSync(conversationId);
    }
    
    const config: BackgroundSyncConfig = {
      conversationId,
      userId, // Store userId for filtering
      lastSyncTime: new Date(),
      syncInterval
    };
    
    this.syncConfigs.set(conversationId, config);
    
    // Start periodic sync
    const timeout = setTimeout(() => {
      this.performSync(conversationId, userId);
    }, syncInterval);
    
    this.syncTimeouts.set(conversationId, timeout);
    
    console.log(`🔄 Background sync started for ${conversationId} (${syncInterval}ms interval${userId ? ', filtered' : ''})`);
  }
  
  /**
   * Stop background sync for a conversation
   */
  stopSync(conversationId: string): void {
    const timeout = this.syncTimeouts.get(conversationId);
    if (timeout) {
      clearTimeout(timeout);
      this.syncTimeouts.delete(conversationId);
    }
    
    this.syncConfigs.delete(conversationId);
    console.log(`⏹️ Background sync stopped for ${conversationId}`);
  }
  
  /**
   * Perform sync for a conversation
   * Requires userId to filter deleted messages
   */
  async performSync(conversationId: string, userId?: string): Promise<SyncResult> {
    const config = this.syncConfigs.get(conversationId);
    if (!config) {
      throw new Error(`No sync config found for ${conversationId}`);
    }
    
    try {
      console.log(`🔄 Performing background sync for ${conversationId}`);
      
      // Get cached messages to compare - FILTER BY USERID
      const cachedMessages = await getCachedMessagesPaginated(conversationId, 50, userId);
      const lastCachedTime = cachedMessages.length > 0 
        ? cachedMessages[cachedMessages.length - 1].timestamp 
        : config.lastSyncTime;
      
      // Subscribe to new messages since last sync
      const newMessages: Message[] = [];
      const updatedMessages: Message[] = [];
      
      return new Promise((resolve, reject) => {
        const unsubscribe = subscribeToMessagesPaginated(conversationId, 50, (messages) => {
          // FILTER OUT DELETED MESSAGES
          const visibleMessages = userId
            ? messages.filter(m => !m.deletedBy || !m.deletedBy.includes(userId))
            : messages;
          
          // Find new messages
          const newSinceLastSync = visibleMessages.filter(msg => 
            msg.timestamp > lastCachedTime
          );
          
          // Find updated messages (status changes, read receipts, etc.)
          const updatedSinceLastSync = visibleMessages.filter(msg => {
            const cachedMsg = cachedMessages.find(cached => cached.id === msg.id);
            return cachedMsg && (
              cachedMsg.status !== msg.status ||
              cachedMsg.readBy.length !== msg.readBy.length ||
              cachedMsg.deliveredTo.length !== msg.deliveredTo.length
            );
          });
          
          newMessages.push(...newSinceLastSync);
          updatedMessages.push(...updatedSinceLastSync);
          
          // Cache new messages - these are already filtered
          newSinceLastSync.forEach(msg => cacheMessage(msg));
          
          // Update sync time
          config.lastSyncTime = new Date();
          
          unsubscribe();
          
          console.log(`✅ Background sync complete: ${newSinceLastSync.length} new, ${updatedSinceLastSync.length} updated`);
          
          resolve({
            newMessages,
            updatedMessages,
            syncTime: config.lastSyncTime
          });
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          unsubscribe();
          reject(new Error('Sync timeout'));
        }, 10000);
      });
      
    } catch (error) {
      console.error(`Background sync failed for ${conversationId}:`, error);
      throw error;
    } finally {
      // Schedule next sync
      if (this.syncConfigs.has(conversationId)) {
        const timeout = setTimeout(() => {
          this.performSync(conversationId, userId);
        }, config.syncInterval);
        
        this.syncTimeouts.set(conversationId, timeout);
      }
    }
  }
  
  /**
   * Handle app state changes
   */
  onAppStateChange(nextAppState: string): void {
    const wasInForeground = this.isAppInForeground;
    this.isAppInForeground = nextAppState === 'active';
    
    if (wasInForeground && !this.isAppInForeground) {
      // App went to background - start background sync
      console.log('📱 App went to background - starting background sync');
      this.startBackgroundSync();
    } else if (!wasInForeground && this.isAppInForeground) {
      // App came to foreground - perform immediate sync
      console.log('📱 App came to foreground - performing immediate sync');
      this.performImmediateSync();
    }
  }
  
  /**
   * Start background sync for all active conversations
   */
  private startBackgroundSync(): void {
    // Reduce sync frequency when in background
    this.syncConfigs.forEach((config, conversationId) => {
      this.stopSync(conversationId);
      this.startSync(conversationId, 60000, config.userId); // Pass userId
    });
  }
  
  /**
   * Perform immediate sync when app comes to foreground
   */
  private async performImmediateSync(): Promise<void> {
    const syncPromises = Array.from(this.syncConfigs.entries()).map(([conversationId, config]) => 
      this.performSync(conversationId, config.userId).catch(error => {
        console.warn(`Immediate sync failed for ${conversationId}:`, error);
      })
    );
    
    await Promise.allSettled(syncPromises);
    
    // Reset to normal sync frequency
    this.syncConfigs.forEach((config, conversationId) => {
      this.stopSync(conversationId);
      this.startSync(conversationId, 30000, config.userId); // Pass userId
    });
  }
  
  /**
   * Get sync status for all conversations
   */
  getSyncStatus(): { [conversationId: string]: { lastSync: Date; interval: number } } {
    const status: { [conversationId: string]: { lastSync: Date; interval: number } } = {};
    
    this.syncConfigs.forEach((config, conversationId) => {
      status[conversationId] = {
        lastSync: config.lastSyncTime,
        interval: config.syncInterval
      };
    });
    
    return status;
  }
  
  /**
   * Clear all sync configurations
   */
  clearAllSyncs(): void {
    this.syncConfigs.forEach((_, conversationId) => {
      this.stopSync(conversationId);
    });
  }
}

// Singleton instance
export const backgroundSyncService = new BackgroundSyncService();
