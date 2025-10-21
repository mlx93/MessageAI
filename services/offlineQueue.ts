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
 * Process the offline queue (send all queued messages)
 */
export const processQueue = async (): Promise<void> => {
  const queue = await getQueue();
  const remaining: QueuedMessage[] = [];
  
  for (const msg of queue) {
    try {
      await sendMessage(msg.conversationId, msg.text, msg.senderId, msg.localId);
      await updateConversationLastMessage(msg.conversationId, msg.text, msg.senderId);
      console.log('✅ Sent queued message:', msg.localId);
    } catch (error) {
      console.error('❌ Failed to send queued message:', error);
      
      if (msg.retryCount < 3) {
        // Retry with exponential backoff
        const delay = Math.pow(2, msg.retryCount + 1) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
        remaining.push({ ...msg, retryCount: msg.retryCount + 1 });
      } else {
        // Mark as failed after 3 retries
        console.log('❌ Message failed after 3 retries:', msg.localId);
      }
    }
  }
  
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
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

