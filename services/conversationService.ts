import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, query, where, orderBy, onSnapshot, Timestamp, Unsubscribe, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { Conversation, User } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new conversation or get existing one
 * For direct messages, uses deterministic ID (sorted participant IDs joined)
 * For groups, uses UUID
 */
export const createOrGetConversation = async (participantIds: string[]): Promise<string> => {
  const sorted = [...participantIds].sort();
  
  // For direct messages, check if conversation exists
  if (participantIds.length === 2) {
    const q = query(
      collection(db, 'conversations'),
      where('type', '==', 'direct'),
      where('participants', '==', sorted)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
  }
  
  // Create new conversation
  const conversationId = participantIds.length === 2 
    ? sorted.join('_')  // Deterministic ID for direct messages
    : uuidv4();  // Random UUID for groups
  
  // Fetch participant details
  const participantDetails: any = {};
  for (const uid of participantIds) {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const userData = userSnap.data() as User;
      participantDetails[uid] = {
        displayName: userData.displayName,
        ...(userData.photoURL && { photoURL: userData.photoURL }), // Only include if not null/undefined
        initials: userData.initials,
        unreadCount: 0
      };
    }
  }
  
  const conversation: Conversation = {
    id: conversationId,
    type: participantIds.length === 2 ? 'direct' : 'group',
    participants: participantIds,
    lastMessage: { text: '', timestamp: new Date(), senderId: '' },
    participantDetails,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  await setDoc(doc(db, 'conversations', conversationId), conversation);
  
  return conversationId;
};

/**
 * Subscribe to user's conversations (real-time)
 */
export const getUserConversations = (userId: string, callback: (conversations: Conversation[]) => void): Unsubscribe => {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('updatedAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          lastMessage: {
            ...data.lastMessage,
            timestamp: data.lastMessage?.timestamp?.toDate() || new Date()
          }
        } as Conversation;
      })
      // Filter out conversations deleted by this user
      .filter(conversation => {
        const deletedBy = conversation.deletedBy || [];
        return !deletedBy.includes(userId);
      })
      // Filter out archived conversations (from conversation splitting)
      .filter(conversation => {
        return !conversation.archivedAt;
      });
    callback(conversations);
  });
};

/**
 * Update conversation's last message
 */
export const updateConversationLastMessage = async (conversationId: string, text: string, senderId: string): Promise<void> => {
  await setDoc(doc(db, 'conversations', conversationId), {
    lastMessage: { text, timestamp: Timestamp.now(), senderId },
    updatedAt: Timestamp.now()
  }, { merge: true });
};

/**
 * Add a participant to a conversation (converts to group if 3+)
 */
export const addParticipantToConversation = async (conversationId: string, userId: string): Promise<void> => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationSnap = await getDoc(conversationRef);
  
  if (!conversationSnap.exists()) throw new Error('Conversation not found');
  
  const conversation = conversationSnap.data() as Conversation;
  
  // Check if user already in conversation
  if (conversation.participants.includes(userId)) {
    throw new Error('User already in conversation');
  }
  
  // Add participant
  const updatedParticipants = [...conversation.participants, userId];
  
  // Fetch new participant details
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (userSnap.exists()) {
    const userData = userSnap.data() as User;
    conversation.participantDetails[userId] = {
      displayName: userData.displayName,
      ...(userData.photoURL && { photoURL: userData.photoURL }), // Only include if not null/undefined
      initials: userData.initials,
      unreadCount: 0
    };
  }
  
  // Update conversation type if now 3+ participants
  const newType = updatedParticipants.length >= 3 ? 'group' : 'direct';
  
  await setDoc(conversationRef, {
    participants: updatedParticipants,
    type: newType,
    participantDetails: conversation.participantDetails,
    updatedAt: Timestamp.now()
  }, { merge: true });
};

/**
 * Get a single conversation by ID
 */
export const getConversation = async (conversationId: string): Promise<Conversation | null> => {
  const conversationSnap = await getDoc(doc(db, 'conversations', conversationId));
  
  if (!conversationSnap.exists()) return null;
  
  const data = conversationSnap.data();
  return {
    id: conversationSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    lastMessage: {
      ...data.lastMessage,
      timestamp: data.lastMessage?.timestamp?.toDate() || new Date()
    }
  } as Conversation;
};

/**
 * Delete a conversation
 * Only deletes the conversation document, not the messages
 * For full deletion, messages would need to be deleted separately
 */
export const deleteConversation = async (conversationId: string, userId: string): Promise<void> => {
  try {
    // Verify user is a participant
    const conversationSnap = await getDoc(doc(db, 'conversations', conversationId));
    if (!conversationSnap.exists()) {
      throw new Error('Conversation not found');
    }
    
    const conversation = conversationSnap.data() as Conversation;
    if (!conversation.participants.includes(userId)) {
      throw new Error('Not authorized to delete this conversation');
    }
    
    // Per-user deletion: Add user to deletedBy array instead of deleting
    const currentDeletedBy = conversation.deletedBy || [];
    if (!currentDeletedBy.includes(userId)) {
      await updateDoc(doc(db, 'conversations', conversationId), {
        deletedBy: arrayUnion(userId)
      });
    }
    
    // Note: Conversation remains in database but is filtered out for this user
    // Messages are preserved for other participants
    // If all participants delete, conversation still exists but is hidden for all
    
    console.log(`✅ Conversation ${conversationId} hidden for user ${userId}`);
  } catch (error) {
    console.error('Delete conversation error:', error);
    throw error;
  }
};

/**
 * Split conversation when participants change
 * 
 * When participants are added or removed from a conversation, this function:
 * 1. Archives the old conversation (sets archivedAt timestamp)
 * 2. Creates a new conversation with the new participant set
 * 3. Returns the new conversation ID
 * 
 * This ensures:
 * - People who leave can't see new messages
 * - New people can't see old messages
 * - Message history is preserved per participant set
 * 
 * @param oldConversationId - ID of the existing conversation
 * @param newParticipantIds - Array of participant IDs for the new conversation
 * @param initiatorId - ID of the user making the change
 * @returns New conversation ID
 */
export const splitConversation = async (
  oldConversationId: string,
  newParticipantIds: string[],
  initiatorId: string
): Promise<string> => {
  try {
    // Get the old conversation
    const oldConvSnap = await getDoc(doc(db, 'conversations', oldConversationId));
    if (!oldConvSnap.exists()) {
      throw new Error('Original conversation not found');
    }

    const oldConversation = oldConvSnap.data() as Conversation;

    // Check if participants actually changed
    const oldParticipants = [...oldConversation.participants].sort();
    const newParticipants = [...newParticipantIds].sort();
    
    if (oldParticipants.join(',') === newParticipants.join(',')) {
      // No change in participants, return original conversation
      console.log('⏭️ No participant change detected, keeping same conversation');
      return oldConversationId;
    }

    console.log(`🔀 Splitting conversation: ${oldParticipants.length} → ${newParticipants.length} participants`);

    // Archive the old conversation
    await updateDoc(doc(db, 'conversations', oldConversationId), {
      archivedAt: Timestamp.now(),
      archivedBy: initiatorId,
      archivedReason: 'participants_changed',
      updatedAt: Timestamp.now(),
    });

    // Create new conversation with new participant set
    const newConversationId = await createOrGetConversation(newParticipantIds);

    console.log(`✅ Conversation split: ${oldConversationId} → ${newConversationId}`);
    console.log(`   Old: [${oldParticipants.join(', ')}]`);
    console.log(`   New: [${newParticipants.join(', ')}]`);

    return newConversationId;
  } catch (error) {
    console.error('Split conversation error:', error);
    throw error;
  }
};

/**
 * Check if conversation should be split when adding participant
 * 
 * This is a helper function that determines whether adding a participant
 * should trigger a conversation split. Currently returns true if the
 * conversation has message history (to preserve privacy).
 * 
 * @param conversationId - ID of the conversation
 * @returns true if conversation should be split, false otherwise
 */
export const shouldSplitOnParticipantAdd = async (conversationId: string): Promise<boolean> => {
  try {
    // Check if conversation has any messages
    const messagesQuery = query(
      collection(db, `conversations/${conversationId}/messages`),
      orderBy('timestamp', 'asc')
    );
    
    const messagesSnap = await getDocs(messagesQuery);
    const hasMessages = !messagesSnap.empty;

    // Split if there are existing messages (to preserve privacy)
    return hasMessages;
  } catch (error) {
    console.error('Check split condition error:', error);
    // Default to not splitting on error
    return false;
  }
};

