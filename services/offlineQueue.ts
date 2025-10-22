import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendMessage } from './messageService';
import { updateConversationLastMessage } from './conversationService';

const QUEUE_KEY = 'offline_messages';

export interface QueuedMessage {
  conversationId: string;
  text: string;
  senderId: string;
  localId: string;
  retryCount: number;
  timestamp: number;
}

/**
 * Add a message to the offline queue
 */
export const queueMessage = async (message: Omit<QueuedMessage, 'retryCount' | 'timestamp'>): Promise<void> => {
  const queue = await getQueue();
  queue.push({ 
    ...message, 
    retryCount: 0,
    timestamp: Date.now()
  });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

/**
 * Get the offline message queue
 */
export const getQueue = async (): Promise<QueuedMessage[]> => {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  return data ? JSON.parse(data) : [];
};

/**
 * Remove a message from the queue (called after successful send)
 */
export const removeFromQueue = async (localId: string): Promise<void> => {
  try {
    const queue = await getQueue();
    const filtered = queue.filter(msg => msg.localId !== localId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    console.log(`✅ Removed message ${localId} from queue`);
  } catch (error) {
    console.error('Failed to remove from queue:', error);
  }
};

/**
 * Process queue and return success metrics
 * Uses timeout version of sendMessage to handle slow connections
 */
export const processQueue = async (): Promise<{ sent: number; failed: number }> => {
  const queue = await getQueue();
  let sentCount = 0;
  let failedCount = 0;
  
  for (const msg of queue) {
    try {
      // Import timeout version dynamically to avoid circular dependency
      const { sendMessageWithTimeout } = await import('./messageService');
      
      // Use 5 second timeout for retries (shorter than initial send)
      await sendMessageWithTimeout(
        msg.conversationId, 
        msg.text, 
        msg.senderId, 
        msg.localId,
        undefined,
        5000
      );
      await updateConversationLastMessage(msg.conversationId, msg.text, msg.senderId, msg.localId);
      
      // Remove from queue on successful send
      await removeFromQueue(msg.localId);
      console.log('✅ Sent queued message:', msg.localId);
      sentCount++;
    } catch (error) {
      console.error('❌ Failed to send queued message:', error);
      
      if (msg.retryCount < 3) {
        // Retry with exponential backoff
        const delay = Math.pow(2, msg.retryCount + 1) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Update retry count in queue
        const currentQueue = await getQueue();
        const updatedQueue = currentQueue.map(m => 
          m.localId === msg.localId ? { ...m, retryCount: m.retryCount + 1 } : m
        );
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
      } else {
        // Remove from queue after 3 failed retries
        await removeFromQueue(msg.localId);
        console.log('❌ Message failed after 3 retries, removed from queue:', msg.localId);
        failedCount++;
      }
    }
  }
  
  return { sent: sentCount, failed: failedCount };
};

/**
 * Clear the offline queue
 */
export const clearQueue = async (): Promise<void> => {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([]));
};

/**
 * Get queue size
 */
export const getQueueSize = async (): Promise<number> => {
  const queue = await getQueue();
  return queue.length;
};

