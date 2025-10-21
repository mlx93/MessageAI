import { v4 as uuidv4 } from 'uuid';
import { Message } from '../types';

/**
 * Format timestamp to human-readable format
 */
export const formatTimestamp = (timestamp: Date | any): string => {
  if (!timestamp) return '';
  
  const date = timestamp instanceof Date ? timestamp : timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Just now (< 1 minute)
  if (diffSeconds < 60) return 'Just now';
  
  // Minutes ago
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  
  // Hours ago
  if (diffHours < 24) return `${diffHours}h ago`;
  
  // Days ago (< 7 days)
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // Date format
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Generate local message ID for optimistic UI
 */
export const generateLocalMessageId = (): string => {
  return uuidv4();
};

/**
 * Sort messages by timestamp ascending
 */
export const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => {
    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
    return timeA - timeB;
  });
};

