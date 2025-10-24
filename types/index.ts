/**
 * Core Type Definitions for aiMessage MVP
 * 
 * These types define the data models for users, messages, and conversations
 * following the architecture specified in messaging_app_prd.md
 */

export interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string; // "firstName lastName"
  phoneNumber: string; // E.164 format (e.g., +12345678900)
  photoURL: string | null;
  initials: string; // "FL" for First Last
  online: boolean;
  lastSeen: Date;
  createdAt: Date;
  fcmToken?: string;
  // Note: Read receipts are always-on for MVP, no settings object
}

export interface Message {
  id: string;
  conversationId: string;
  text: string;
  senderId: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'queued';
  type: 'text' | 'image' | 'system';
  mediaURL?: string;
  localId: string; // For optimistic updates and deduplication
  readBy: string[]; // Array of user IDs who have read this message
  deliveredTo: string[]; // Array of user IDs who have received this message
  deletedBy?: string[]; // Array of user IDs who soft-deleted this message
  // AI-enhanced fields
  priority?: 'urgent' | 'important' | 'normal';
  priorityConfidence?: number;
  priorityReason?: string;
  embedded?: boolean; // Whether message has been embedded for RAG
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participants: string[]; // Array of user IDs
  deletedBy?: string[]; // Array of user IDs who deleted this conversation (per-user deletion)
  unreadCounts?: { [userId: string]: number }; // Per-user unread message count
  lastMessage: {
    text: string;
    timestamp: Date;
    senderId: string;
  };
  participantDetails: {
    [userId: string]: {
      displayName: string;
      photoURL: string | null;
      initials: string;
      unreadCount: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Helper type for Firestore Timestamp conversion
 * Used when reading data from Firestore that needs timestamp conversion
 */
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

/**
 * Contact sync data model
 */
export interface Contact {
  id: string;
  phoneNumber: string;
  name: string;
  isAppUser: boolean;
  appUserId: string | null;
  lastSynced: Date;
}

/**
 * Typing status for real-time indicators
 */
export interface TypingStatus {
  userId: string;
  conversationId: string;
  isTyping: boolean;
  displayName: string;
  timestamp: Date;
}

