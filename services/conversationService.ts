import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, updateDoc, query, where, orderBy, onSnapshot, Timestamp, Unsubscribe, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { Conversation, User } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new conversation or get existing one
 * For direct messages, uses deterministic ID (sorted participant IDs joined)
 * For groups, uses UUID
 * 
 * @param participantIds - Array of user IDs to include in the conversation
 * @param currentUserId - ID of the current user (required for querying existing groups)
 */
export const createOrGetConversation = async (participantIds: string[], currentUserId: string): Promise<string> => {
  if (!currentUserId) {
    throw new Error('currentUserId is required');
  }
  
  const sorted = [...participantIds].sort();
  
  // For direct messages, check if conversation exists by deterministic ID
  if (participantIds.length === 2) {
    const deterministicId = sorted.join('_');
    try {
      const existingConv = await getDoc(doc(db, 'conversations', deterministicId));
      
      if (existingConv.exists()) {
        console.log(`✅ Found existing direct conversation: ${deterministicId}`);
        return existingConv.id;
      }
    } catch (readError: any) {
      // If we can't read the conversation (permission error), it might exist but we're not in it
      // This shouldn't happen, but if it does, we'll try to create it anyway
      console.warn(`⚠️ Could not read direct conversation ${deterministicId}:`, readError.message);
    }
  }
  
  // For groups, check if conversation with same participants already exists
  if (participantIds.length >= 3) {
    // Ensure current user is in the participant list
    if (!participantIds.includes(currentUserId)) {
      console.warn(`⚠️ Current user ${currentUserId} is not in participant list, cannot query existing groups`);
    } else {
      try {
        // Query conversations where CURRENT USER is a participant (avoids permission errors)
        const q = query(
          collection(db, 'conversations'),
          where('participants', 'array-contains', currentUserId)
        );
        const snapshot = await getDocs(q);
        
        // Filter locally for exact participant match
        for (const docSnap of snapshot.docs) {
          const conv = docSnap.data() as Conversation;
          const convParticipants = [...conv.participants].sort();
          
          // Check if participants arrays are identical
          if (convParticipants.length === sorted.length && 
              convParticipants.every((val, index) => val === sorted[index])) {
            console.log(`✅ Found existing group conversation: ${docSnap.id}`);
            return docSnap.id;
          }
        }
        console.log(`🔍 No existing group found with ${sorted.length} participants, creating new one`);
      } catch (queryError) {
        console.error('Error querying for existing group:', queryError);
        // Continue to create new conversation if query fails
      }
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
  
  try {
    await setDoc(doc(db, 'conversations', conversationId), conversation);
    console.log(`✅ Created new ${conversation.type} conversation: ${conversationId}`);
  } catch (setDocError: any) {
    console.error('Error creating conversation with setDoc:', setDocError);
    
    // If it's a permission error, the conversation might already exist
    if (setDocError.code === 'permission-denied') {
      console.warn(`⚠️ Permission denied when creating ${conversationId}. It may already exist.`);
      // Return the ID anyway - if it exists, navigation will work
      return conversationId;
    }
    
    throw new Error(`Failed to create conversation: ${setDocError.message || setDocError}`);
  }
  
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
          lastMessage: data.lastMessage ? {
            text: data.lastMessage.text || '',
            senderId: data.lastMessage.senderId || '',
            timestamp: data.lastMessage.timestamp?.toDate() || new Date(0) // Epoch if no timestamp
          } : {
            text: '',
            senderId: '',
            timestamp: new Date(0) // Epoch indicates no messages yet
          }
        } as Conversation;
      })
      // Filter out conversations deleted by this user
      .filter(conversation => {
        const deletedBy = conversation.deletedBy || [];
        return !deletedBy.includes(userId);
      });
    callback(conversations);
  });
};

/**
 * Update conversation's last message
 */
export const updateConversationLastMessage = async (conversationId: string, text: string, senderId: string): Promise<void> => {
  // When a new message arrives, the conversation should reappear for users who deleted it
  // Clear the deletedBy array so conversation shows up in everyone's list
  await setDoc(doc(db, 'conversations', conversationId), {
    lastMessage: { text, timestamp: Timestamp.now(), senderId },
    updatedAt: Timestamp.now(),
    deletedBy: [] // Reset deleted status - conversation reappears for all users
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
 * 1. Keeps the old conversation active for original participants
 * 2. Creates a new conversation with the new participant set
 * 3. Returns the new conversation ID
 * 
 * This ensures:
 * - Original participants can still access old conversation and history
 * - New people can't see old messages (they're not in old conversation)
 * - People who leave can still see old messages but not new ones
 * - Message history is preserved per participant set
 * 
 * Example:
 * - User A and B have conversation with 100 messages
 * - User A adds User C
 * - Old conversation (A+B) remains visible to both A and B with all history
 * - New conversation (A+B+C) starts fresh for all 3 users
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
    console.log(`   Initiator ID: ${initiatorId}`);

    // Check if target conversation already exists
    let existingNewConversationId: string;
    try {
      existingNewConversationId = await createOrGetConversation(newParticipantIds, initiatorId);
    } catch (createError: any) {
      console.error('Error in createOrGetConversation:', createError);
      // If creation/fetching fails, provide a helpful error message
      const errorMsg = createError.message || 'Unknown error';
      throw new Error(`Unable to create group chat: ${errorMsg}. Please try again.`);
    }
    
    // If it's the same as the old conversation, no split needed
    if (existingNewConversationId === oldConversationId) {
      console.log('⏭️ Target conversation is same as source, no split needed');
      return oldConversationId;
    }
    
    // DON'T archive the old conversation - keep it active for original participants
    // Just update the timestamp so it doesn't interfere with sorting
    try {
      await updateDoc(doc(db, 'conversations', oldConversationId), {
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Failed to update old conversation timestamp:', error);
      // Continue anyway - not critical
    }

    console.log(`✅ Conversation split: ${oldConversationId} → ${existingNewConversationId}`);
    console.log(`   Old conversation kept active: [${oldParticipants.join(', ')}]`);
    console.log(`   New conversation: [${newParticipants.join(', ')}]`);

    return existingNewConversationId;
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

/**
 * Reset unread count for a user in a conversation
 * Called when user opens a chat
 * 
 * @param conversationId - ID of the conversation
 * @param userId - ID of the user whose unread count to reset
 */
export const resetUnreadCount = async (
  conversationId: string, 
  userId: string
): Promise<void> => {
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      [`unreadCounts.${userId}`]: 0
    });
    console.log(`✅ Reset unread count for user ${userId} in conversation ${conversationId}`);
  } catch (error) {
    console.error('Failed to reset unread count:', error);
    throw error;
  }
};

/**
 * Get unread count for a user in a conversation
 * 
 * @param conversationId - ID of the conversation
 * @param userId - ID of the user
 * @returns Unread count or 0 if not set
 */
export const getUnreadCount = async (
  conversationId: string,
  userId: string
): Promise<number> => {
  try {
    const convSnap = await getDoc(doc(db, 'conversations', conversationId));
    if (!convSnap.exists()) return 0;
    
    const data = convSnap.data() as Conversation;
    return data.unreadCounts?.[userId] || 0;
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
};

