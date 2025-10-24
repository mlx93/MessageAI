import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateConversationLastMessageBatched } from './conversationService';

const QUEUE_KEY = 'offline_messages';

export interface QueuedMessage {
  conversationId: string;
  text: string;
  senderId: string;
  localId: string;
  retryCount: number;
  timestamp: number;
  mediaURL?: string;
  type?: string;
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
  let totalRetries = 0;
  
  if (__DEV__) console.log(`📤 Processing queue: ${queue.length} messages`);
  
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
        msg.mediaURL,
        5000
      );
      const previewText = msg.type === 'image' ? '📷 Image' : msg.text;
      updateConversationLastMessageBatched(msg.conversationId, previewText, msg.senderId, msg.localId);
      
      // Remove from queue on successful send
      await removeFromQueue(msg.localId);
      if (__DEV__) console.log('✅ Sent queued message:', msg.localId);
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
        totalRetries++;
        if (__DEV__) console.log(`🔄 Retry ${msg.retryCount + 1}/3 for message ${msg.localId}`);
      } else {
        // Remove from queue after 3 failed retries
        await removeFromQueue(msg.localId);
        if (__DEV__) console.log('❌ Message failed after 3 retries, removed from queue:', msg.localId);
        failedCount++;
      }
    }
  }
  
  if (__DEV__) console.log(`📊 Queue processed: ${sentCount} sent, ${failedCount} failed, ${totalRetries} retries`);
  
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

/**
 * Retry a single message manually (triggered by user tap on failed message)
 * Returns true if successful, false if failed
 */
export const retryMessage = async (localId: string): Promise<boolean> => {
  const queue = await getQueue();
  const message = queue.find(msg => msg.localId === localId);
  
  if (!message) {
    console.warn(`⚠️ Message ${localId} not found in queue`);
    return false;
  }
  
  try {
    // Import timeout version dynamically to avoid circular dependency
    const { sendMessageWithTimeout } = await import('./messageService');
    
    // Use 10 second timeout for manual retries
    await sendMessageWithTimeout(
      message.conversationId, 
      message.text, 
      message.senderId, 
      message.localId,
      message.mediaURL,
      10000
    );
    const previewText = message.type === 'image' ? '📷 Image' : message.text;
    updateConversationLastMessageBatched(message.conversationId, previewText, message.senderId, message.localId);
    
    // Remove from queue on successful send
    await removeFromQueue(message.localId);
    console.log('✅ Manual retry successful:', message.localId);
    return true;
  } catch (error) {
    console.error('❌ Manual retry failed:', error);
    
    // Update retry count
    const currentQueue = await getQueue();
    const updatedQueue = currentQueue.map(m => 
      m.localId === message.localId ? { ...m, retryCount: m.retryCount + 1 } : m
    );
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
    
    return false;
  }
};

/**
 * Get queued messages for a specific conversation
 */
export const getQueuedMessagesForConversation = async (conversationId: string): Promise<QueuedMessage[]> => {
  const queue = await getQueue();
  return queue.filter(msg => msg.conversationId === conversationId);
};

