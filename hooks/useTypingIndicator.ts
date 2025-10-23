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
 * Shows typing indicator ONLY when:
 * - User has text in the input box AND
 * - User has the input focused (selected)
 * 
 * Immediately clears when either condition becomes false
 * 
 * @param conversationId - ID of the conversation
 * @param userId - Current user's ID
 * @param displayName - Current user's display name
 * @param hasText - Whether there's text in the input box
 * @param isFocused - Whether the input is currently focused
 * @returns Object with updateTypingStatus function
 */
export const useTypingIndicator = (
  conversationId: string,
  userId: string,
  displayName: string,
  hasText: boolean,
  isFocused: boolean
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateTypingStatus = useCallback(async (isTyping: boolean) => {
    try {
      await setDoc(
        doc(db, `conversations/${conversationId}/typing`, userId),
        {
          isTyping,
          displayName,
          timestamp: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error('Failed to update typing status:', error);
    }
  }, [conversationId, userId, displayName]);

  // Update typing status: only show when BOTH hasText AND isFocused
  useEffect(() => {
    const isActuallyTyping = hasText && isFocused;
    updateTypingStatus(isActuallyTyping);
  }, [hasText, isFocused, updateTypingStatus]);

  // Cleanup on unmount - immediately clear typing status
  useEffect(() => {
    return () => {
      // Clear typing status when component unmounts (user leaves chat)
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

  return { updateTypingStatus };
};

/**
 * Hook to listen to typing status from other users
 * 
 * @param conversationId - ID of the conversation
 * @param currentUserId - Current user's ID (to exclude from typing list)
 * @returns Object with typingText string and typingUsers array with user details
 */
export const useTypingStatus = (conversationId: string, currentUserId: string) => {
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; displayName: string }>>([]);

  useEffect(() => {
    const typingCollectionRef = collection(db, `conversations/${conversationId}/typing`);
    
    const unsubscribe = onSnapshot(
      typingCollectionRef,
      (snapshot) => {
        const typing = snapshot.docs
          .filter(doc => doc.id !== currentUserId && doc.data().isTyping)
          .map(doc => ({
            userId: doc.id,
            displayName: doc.data().displayName
          }));
        
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
      return `${typingUsers[0].displayName} is typing...`;
    }
    
    if (typingUsers.length === 2) {
      return `${typingUsers[0].displayName} and ${typingUsers[1].displayName} are typing...`;
    }
    
    // 3 or more users
    const remaining = typingUsers.length - 2;
    return `${typingUsers[0].displayName}, ${typingUsers[1].displayName}, and ${remaining} ${remaining === 1 ? 'other' : 'others'} are typing...`;
  }, [typingUsers]);

  return { 
    typingText: getTypingText(),
    typingUsers // Return raw user data for custom rendering
  };
};

