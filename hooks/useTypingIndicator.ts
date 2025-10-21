/**
 * Typing Indicator Hooks
 * 
 * Provides real-time typing status for conversations
 * Uses Firestore to track who is currently typing
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Hook to send typing status updates
 * 
 * Automatically clears typing status after 500ms of no input
 * 
 * @param conversationId - ID of the conversation
 * @param userId - Current user's ID
 * @param displayName - Current user's display name
 * @returns Object with startTyping function
 */
export const useTypingIndicator = (
  conversationId: string,
  userId: string,
  displayName: string
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startTyping = useCallback(async () => {
    try {
      // Set typing status to true
      await setDoc(
        doc(db, `conversations/${conversationId}/typing`, userId),
        {
          isTyping: true,
          displayName,
          timestamp: serverTimestamp(),
        }
      );
      
      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Stop typing after 500ms of inactivity
      timeoutRef.current = setTimeout(async () => {
        try {
          await setDoc(
            doc(db, `conversations/${conversationId}/typing`, userId),
            {
              isTyping: false,
              displayName,
              timestamp: serverTimestamp(),
            }
          );
        } catch (error) {
          console.error('Failed to clear typing status:', error);
        }
      }, 500);
    } catch (error) {
      console.error('Failed to set typing status:', error);
    }
  }, [conversationId, userId, displayName]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Clear typing status when component unmounts
      setDoc(
        doc(db, `conversations/${conversationId}/typing`, userId),
        {
          isTyping: false,
          displayName,
          timestamp: serverTimestamp(),
        }
      ).catch(error => {
        console.error('Failed to clear typing status on unmount:', error);
      });
    };
  }, [conversationId, userId, displayName]);

  return { startTyping };
};

/**
 * Hook to listen to typing status from other users
 * 
 * @param conversationId - ID of the conversation
 * @param currentUserId - Current user's ID (to exclude from typing list)
 * @returns Object with typingText string
 */
export const useTypingStatus = (conversationId: string, currentUserId: string) => {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  useEffect(() => {
    const typingCollectionRef = collection(db, `conversations/${conversationId}/typing`);
    
    const unsubscribe = onSnapshot(
      typingCollectionRef,
      (snapshot) => {
        const typing = snapshot.docs
          .filter(doc => doc.id !== currentUserId && doc.data().isTyping)
          .map(doc => doc.data().displayName);
        
        setTypingUsers(typing);
      },
      (error) => {
        console.error('Failed to listen to typing status:', error);
      }
    );

    return unsubscribe;
  }, [conversationId, currentUserId]);

  /**
   * Format typing status text based on number of users typing
   */
  const getTypingText = useCallback(() => {
    if (typingUsers.length === 0) {
      return '';
    }
    
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`;
    }
    
    if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    }
    
    // 3 or more users
    const remaining = typingUsers.length - 2;
    return `${typingUsers[0]}, ${typingUsers[1]}, and ${remaining} ${remaining === 1 ? 'other' : 'others'} are typing...`;
  }, [typingUsers]);

  return { typingText: getTypingText() };
};

