/**
 * Global Message Listener
 * 
 * Listens to ALL user conversations and triggers notifications for new messages
 * Handles in-app banners, background notifications, and offline catch-up
 */

import { collection, query, where, onSnapshot, Unsubscribe, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { AppState } from 'react-native';
import { scheduleLocalNotification } from './notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MessageNotification {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: Date;
}

type NotificationCallback = (
  conversationId: string,
  senderName: string,
  messageText: string,
  senderInitials: string
) => void;

let activeConversationId: string | null = null;
let lastSeenMessageIds: Set<string> = new Set();
let inAppNotificationCallback: NotificationCallback | null = null;

/**
 * Set the currently active conversation
 * Used to prevent notifications for messages in the active chat
 */
export const setActiveConversation = (conversationId: string | null) => {
  activeConversationId = conversationId;
};

/**
 * Get the currently active conversation
 */
export const getActiveConversation = (): string | null => {
  return activeConversationId;
};

/**
 * Register callback for in-app notifications
 */
export const registerInAppNotificationCallback = (callback: NotificationCallback) => {
  inAppNotificationCallback = callback;
};

/**
 * Get sender name from conversation participant details
 */
const getSenderName = (senderId: string, conversation: any): string => {
  return conversation.participantDetails?.[senderId]?.displayName || 'Someone';
};

/**
 * Get sender initials from conversation participant details
 */
const getSenderInitials = (senderId: string, conversation: any): string => {
  return conversation.participantDetails?.[senderId]?.initials || '?';
};

/**
 * Handle new message notification logic
 */
const handleNewMessage = async (
  conversationId: string,
  message: MessageNotification,
  conversation: any,
  currentUserId: string
) => {
  // Skip if message is from current user
  if (message.senderId === currentUserId) {
    return;
  }

  // Skip if we've already seen this message
  if (lastSeenMessageIds.has(message.id)) {
    return;
  }

  // Mark as seen
  lastSeenMessageIds.add(message.id);

  // Clean up old message IDs to prevent memory leak (keep last 100)
  if (lastSeenMessageIds.size > 100) {
    const idsArray = Array.from(lastSeenMessageIds);
    lastSeenMessageIds = new Set(idsArray.slice(-100));
  }

  const senderName = getSenderName(message.senderId, conversation);
  const senderInitials = getSenderInitials(message.senderId, conversation);
  const messageText = message.text || 'Photo';

  // Get current app state
  const appState = AppState.currentState;

  console.log(`📬 New message in ${conversationId} from ${senderName}, app state: ${appState}, active: ${activeConversationId}`);

  // SCENARIO 1: User is viewing this exact chat
  if (appState === 'active' && activeConversationId === conversationId) {
    console.log('📬 Message is in active chat - no notification needed');
    return;
  }

  // SCENARIO 2: User is in app but different chat
  if (appState === 'active' && activeConversationId !== conversationId) {
    console.log('📬 Message in different chat - showing in-app banner');
    if (inAppNotificationCallback) {
      inAppNotificationCallback(conversationId, senderName, messageText, senderInitials);
    }
    return;
  }

  // SCENARIO 3: App is backgrounded or inactive
  if (appState === 'background' || appState === 'inactive') {
    console.log('📬 App backgrounded - showing local notification');
    try {
      await scheduleLocalNotification(
        senderName,
        messageText,
        { conversationId }
      );
    } catch (error) {
      console.error('Failed to show local notification:', error);
    }
    return;
  }
};

/**
 * Subscribe to all conversations for a user
 * Monitors new messages and triggers appropriate notifications
 * 
 * @param userId - User ID to monitor conversations for
 * @returns Unsubscribe function
 */
export const subscribeToAllConversations = (
  userId: string
): Unsubscribe => {
  // Reset seen messages when starting new subscription
  lastSeenMessageIds.clear();

  console.log(`🔔 Starting global message listener for user ${userId}`);

  // Subscribe to all conversations where user is a participant
  const conversationsQuery = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId)
  );

  const conversationUnsubscribes: Map<string, Unsubscribe> = new Map();

  // Listen to conversation changes
  const conversationsUnsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const conversationId = change.doc.id;
      const conversationData = change.doc.data();

      if (change.type === 'added' || change.type === 'modified') {
        // Skip conversations that the current user has deleted
        const deletedBy = conversationData.deletedBy || [];
        if (deletedBy.includes(userId)) {
          console.log(`🚫 Skipping deleted conversation ${conversationId}`);
          // Unsubscribe if we were previously subscribed
          const existingUnsubscribe = conversationUnsubscribes.get(conversationId);
          if (existingUnsubscribe) {
            existingUnsubscribe();
            conversationUnsubscribes.delete(conversationId);
          }
          return;
        }

        // Subscribe to messages in this conversation if not already subscribed
        if (!conversationUnsubscribes.has(conversationId)) {
          const messagesQuery = query(
            collection(db, `conversations/${conversationId}/messages`),
            orderBy('timestamp', 'desc'),
            limit(1) // Only get the latest message
          );

          const messagesUnsubscribe = onSnapshot(messagesQuery, (messagesSnapshot) => {
            messagesSnapshot.docChanges().forEach((messageChange) => {
              if (messageChange.type === 'added') {
                const messageData = messageChange.doc.data();
                const message: MessageNotification = {
                  id: messageChange.doc.id,
                  conversationId,
                  senderId: messageData.senderId,
                  text: messageData.text || '',
                  timestamp: messageData.timestamp?.toDate() || new Date(),
                };

                // Handle the new message
                handleNewMessage(conversationId, message, conversationData, userId);
              }
            });
          });

          conversationUnsubscribes.set(conversationId, messagesUnsubscribe);
        }
      } else if (change.type === 'removed') {
        // Unsubscribe from messages when conversation is removed
        const unsubscribe = conversationUnsubscribes.get(conversationId);
        if (unsubscribe) {
          unsubscribe();
          conversationUnsubscribes.delete(conversationId);
        }
      }
    });
  });

  // Return combined unsubscribe function
  return () => {
    console.log(`🔕 Stopping global message listener for user ${userId}`);
    conversationsUnsubscribe();
    conversationUnsubscribes.forEach((unsubscribe) => unsubscribe());
    conversationUnsubscribes.clear();
  };
};

/**
 * Track when user goes offline
 * Stores timestamp for offline catch-up notifications
 */
export const markOffline = async (userId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      `lastSeenAt_${userId}`,
      new Date().toISOString()
    );
    console.log('📴 Marked user as offline for catch-up notifications');
  } catch (error) {
    console.error('Failed to mark offline:', error);
  }
};

/**
 * Get new messages since user went offline
 * Used for offline catch-up notifications
 * 
 * @param userId - User ID
 * @returns Object with total count and per-conversation breakdown
 */
export const getNewMessagesSinceOffline = async (
  userId: string
): Promise<{
  totalCount: number;
  conversations: Array<{ name: string; count: number; conversationId: string }>;
}> => {
  try {
    const lastSeenAtStr = await AsyncStorage.getItem(`lastSeenAt_${userId}`);
    if (!lastSeenAtStr) {
      return { totalCount: 0, conversations: [] };
    }

    const lastSeenAt = new Date(lastSeenAtStr);
    console.log(`📊 Checking new messages since ${lastSeenAt.toISOString()}`);

    // This would require a more complex query in production
    // For now, we'll return a simple response
    // In a real implementation, you'd query Firestore for messages after lastSeenAt
    
    // Clear the timestamp after checking
    await AsyncStorage.removeItem(`lastSeenAt_${userId}`);

    return { totalCount: 0, conversations: [] };
  } catch (error) {
    console.error('Failed to get new messages since offline:', error);
    return { totalCount: 0, conversations: [] };
  }
};

