import { collection, addDoc, query, orderBy, onSnapshot, Timestamp, doc, updateDoc, arrayUnion, writeBatch, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { Message } from '../types';

/**
 * Send a message to a conversation
 */
export const sendMessage = async (
  conversationId: string, 
  text: string, 
  senderId: string, 
  localId: string,
  mediaURL?: string
): Promise<string> => {
  const messageRef = await addDoc(collection(db, `conversations/${conversationId}/messages`), {
    text,
    senderId,
    timestamp: Timestamp.now(),
    status: 'sent',
    type: mediaURL ? 'image' : 'text',
    localId,
    readBy: [senderId],
    deliveredTo: [],
    ...(mediaURL && { mediaURL })
  });
  
  return messageRef.id;
};

/**
 * Subscribe to messages in a conversation (real-time)
 */
export const subscribeToMessages = (
  conversationId: string, 
  callback: (messages: Message[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, `conversations/${conversationId}/messages`),
    orderBy('timestamp', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        conversationId,
        text: data.text || '',
        senderId: data.senderId,
        timestamp: data.timestamp?.toDate() || new Date(),
        status: data.status || 'sent',
        type: data.type || 'text',
        mediaURL: data.mediaURL,
        localId: data.localId,
        readBy: data.readBy || [],
        deliveredTo: data.deliveredTo || [],
        deletedBy: data.deletedBy || []
      } as Message;
    });
    callback(messages);
  });
};

/**
 * Mark messages as read by a user
 */
export const markMessagesAsRead = async (
  conversationId: string, 
  userId: string, 
  messageIds: string[]
): Promise<void> => {
  if (messageIds.length === 0) return;
  
  const batch = writeBatch(db);
  
  for (const messageId of messageIds) {
    const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
    batch.update(messageRef, {
      readBy: arrayUnion(userId),
      status: 'read'
    });
  }
  
  await batch.commit();
};

/**
 * Mark a message as delivered to a user
 */
export const markMessageAsDelivered = async (
  conversationId: string, 
  messageId: string, 
  userId: string
): Promise<void> => {
  const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
  await updateDoc(messageRef, {
    deliveredTo: arrayUnion(userId),
    status: 'delivered'
  });
};

/**
 * Soft-delete a message for a specific user
 * Message remains visible to other users
 */
export const deleteMessage = async (
  conversationId: string,
  messageId: string,
  userId: string
): Promise<void> => {
  const messageRef = doc(db, `conversations/${conversationId}/messages`, messageId);
  await updateDoc(messageRef, {
    deletedBy: arrayUnion(userId)
  });
};

/**
 * Send message with timeout
 * Throws error if operation takes > 10 seconds
 * 
 * @param conversationId - Conversation ID
 * @param text - Message text
 * @param senderId - Sender user ID
 * @param localId - Local message ID for deduplication
 * @param mediaURL - Optional media URL
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Message ID
 */
export const sendMessageWithTimeout = async (
  conversationId: string, 
  text: string, 
  senderId: string, 
  localId: string,
  mediaURL?: string,
  timeoutMs: number = 10000
): Promise<string> => {
  return Promise.race([
    sendMessage(conversationId, text, senderId, localId, mediaURL),
    new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('Send timeout - poor connection')), timeoutMs)
    )
  ]);
};

/**
 * Send an image message
 */
export const sendImageMessage = async (
  conversationId: string,
  imageUrl: string,
  senderId: string,
  localId: string,
  caption?: string
): Promise<string> => {
  return sendMessage(conversationId, caption || 'Image', senderId, localId, imageUrl);
};

