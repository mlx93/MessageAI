import { v4 as uuidv4 } from 'uuid';
import { Message } from '../types';

/**
 * Format timestamp to human-readable format
 */
export const formatTimestamp = (timestamp: Date | any, currentTime?: Date): string => {
  if (!timestamp) return '';
  
  const date = timestamp instanceof Date ? timestamp : timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = currentTime || new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  // Just now (< 1 minute)
  if (diffSeconds < 60) return 'Just now';
  
  // Minutes ago
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  
  // Hours ago (but only if same day) - use UTC to avoid timezone issues
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dateDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysDiff = Math.floor((nowDay - dateDay) / (24 * 60 * 60 * 1000));
  
  if (daysDiff === 0 && diffHours < 24) return `${diffHours}h ago`;
  
  // Yesterday
  if (daysDiff === 1) return 'Yesterday';
  
  // This week - show day of week
  if (daysDiff < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  // Date format
  const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  // Add year if different from current year
  if (date.getFullYear() !== now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  
  return dateString;
};

/**
 * Format last seen timestamp for user presence
 * More verbose format for better UX
 */
export const formatLastSeen = (timestamp: Date | any, currentTime?: Date): string => {
  if (!timestamp) return 'Unknown';
  
  const date = timestamp instanceof Date ? timestamp : timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = currentTime || new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  // Just now (< 1 minute)
  if (diffSeconds < 60) return 'Just now';
  
  // Minutes ago
  if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }
  
  // Calculate calendar days difference - use UTC to avoid timezone issues
  const nowDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dateDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysDiff = Math.floor((nowDay - dateDay) / (24 * 60 * 60 * 1000));
  
  // Hours ago (but only if same day)
  if (daysDiff === 0) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  
  // Yesterday
  if (daysDiff === 1) {
    return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  }
  
  // Days ago (< 7 days)
  if (daysDiff < 7) {
    return `${daysDiff} days ago`;
  }
  
  // Full date format
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
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

