import { collection, doc, setDoc, getDoc, query, where, getDocs, orderBy, onSnapshot, Timestamp, Unsubscribe } from 'firebase/firestore';
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
        photoURL: userData.photoURL,
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
    const conversations = snapshot.docs.map(doc => {
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
      photoURL: userData.photoURL,
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

