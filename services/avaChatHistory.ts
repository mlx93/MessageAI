import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth } from './firebase';

export interface AvaChatSession {
  id: string;
  userId: string;
  title: string;
  lastMessage: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface AvaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AvaChatHistory {
  sessionId: string;
  messages: AvaMessage[];
  title: string;
  createdAt: number;
  updatedAt: number;
}

class AvaChatHistoryService {
  private db = getFirestore();

  async saveChatSession(sessionId: string, title: string, lastMessage: string, messageCount: number): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('Ava: No user ID available for saving chat session');
        return;
      }

      // Use setDoc with the sessionId as the document ID
      // This ensures we can update the same document later
      const sessionDocRef = doc(this.db, 'avaChatSessions', sessionId);
      
      // Check if session already exists
      const existingSession = await getDoc(sessionDocRef);
      
      if (existingSession.exists()) {
        // Update existing session
        await updateDoc(sessionDocRef, {
          title,
          lastMessage,
          messageCount,
          updatedAt: Date.now(),
        });
      } else {
        // Create new session with specific document ID
        await setDoc(sessionDocRef, {
          userId,
          title,
          lastMessage,
          messageCount,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    } catch (error) {
      console.error('Ava: Error saving chat session:', error);
    }
  }

  async getChatSession(sessionId: string): Promise<AvaChatSession | null> {
    try {
      const sessionDocRef = doc(this.db, 'avaChatSessions', sessionId);
      const sessionSnap = await getDoc(sessionDocRef);
      
      if (sessionSnap.exists()) {
        return {
          ...sessionSnap.data(),
          id: sessionSnap.id, // Use Firestore document ID
        } as AvaChatSession;
      }
      return null;
    } catch (error) {
      console.error('Ava: Error getting chat session:', error);
      return null;
    }
  }

  async getRecentChatSessions(limitCount: number = 10): Promise<AvaChatSession[]> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('Ava: No user ID available for getting chat sessions');
        return [];
      }

      const sessionsRef = collection(this.db, 'avaChatSessions');
      const q = query(
        sessionsRef,
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id, // Use Firestore document ID as the unique key
      } as AvaChatSession));
    } catch (error) {
      console.error('Ava: Error getting recent chat sessions:', error);
      return [];
    }
  }

  async saveChatMessages(sessionId: string, messages: AvaMessage[]): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('Ava: No user ID available for saving chat messages');
        return;
      }

      const messagesRef = collection(this.db, 'avaChatMessages');
      
      // Save each message
      for (const message of messages) {
        await addDoc(messagesRef, {
          sessionId,
          userId,
          ...message,
        });
      }
    } catch (error) {
      console.error('Ava: Error saving chat messages:', error);
    }
  }

  async getChatMessages(sessionId: string): Promise<AvaMessage[]> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('Ava: No user ID available for getting chat messages');
        return [];
      }

      const messagesRef = collection(this.db, 'avaChatMessages');
      const q = query(
        messagesRef,
        where('sessionId', '==', sessionId),
        where('userId', '==', userId), // Required for security rules
        orderBy('timestamp', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, // Use Firestore document ID for uniqueness
          role: data.role,
          content: data.content,
          timestamp: data.timestamp,
        };
      });
    } catch (error) {
      console.error('Ava: Error getting chat messages:', error);
      return [];
    }
  }

  generateSessionId(): string {
    return `ava_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateMessageId(): string {
    return `ava_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.log('Ava: No user ID available for deleting chat session');
        return;
      }

      // Delete the session document
      const sessionDoc = doc(this.db, 'avaChatSessions', sessionId);
      await deleteDoc(sessionDoc);

      // Delete all messages for this session
      const messagesRef = collection(this.db, 'avaChatMessages');
      const messagesQuery = query(
        messagesRef,
        where('sessionId', '==', sessionId),
        where('userId', '==', userId)
      );
      
      const messagesSnapshot = await getDocs(messagesQuery);
      const deletePromises = messagesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      console.log('Ava: Successfully deleted session and messages');
    } catch (error) {
      console.error('Ava: Error deleting chat session:', error);
      throw error;
    }
  }
}

export default new AvaChatHistoryService();
